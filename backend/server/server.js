const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { spawn } = require("child_process");

const db = require("./db");

const app = express();
const PORT = process.env.PORT || 5000;

// Root of the Python project (one level up from /server)
const PROJECT_ROOT = path.join(__dirname, "..");
const PYTHON_BIN = process.env.PYTHON_BIN || "python";
const MAX_NOTES_LENGTH = 2000;
const PROVIDERS = ["auto", "gemini", "groq", "openrouter", "ollama", "template"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STORAGE_DIR = path.join(__dirname, "storage");
const AUDIO_DIR = path.join(STORAGE_DIR, "audio");
const SPEC_DIR = path.join(STORAGE_DIR, "specs");
[STORAGE_DIR, AUDIO_DIR, SPEC_DIR].forEach((d) => fs.mkdirSync(d, { recursive: true }));

app.use(cors());
app.use(express.json());
app.use("/storage", express.static(STORAGE_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, AUDIO_DIR),
    filename: (req, file, cb) => {
      const id = req.uploadId;
      cb(null, `${id}${path.extname(file.originalname) || ".wav"}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (req, file, cb) => {
    const ok = /\.(wav|mp3)$/i.test(file.originalname);
    cb(ok ? null : new Error("Only .wav or .mp3 files are supported"), ok);
  },
});

// Assign the record id before multer names the file
app.use((req, res, next) => {
  req.uploadId = uuidv4();
  next();
});

// Runs a Python bridge script that prints one JSON object on its last stdout line
function runPython(script, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, [script, ...args], { cwd: PROJECT_ROOT });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("error", reject);
    proc.on("close", (code) => {
      if (stderr.trim()) console.warn(stderr.trim());
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr || `${script} exited with code ${code}`));
      }
      try {
        const lastLine = stdout.trim().split("\n").pop();
        const parsed = JSON.parse(lastLine);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse ${script} output: ${stdout}\n${stderr}`));
      }
    });
  });
}

// Runs in the background after the classification has already been returned
async function generateReport(id, predictedClass, confidence, provider, notes) {
  try {
    const out = await runPython("api_report.py", [predictedClass, String(confidence), provider, notes]);
    db.updateRecord(id, { report: out.report, reportSource: out.report_source, reportStatus: "done" });
  } catch (err) {
    console.error(`Report generation failed for ${id}:`, err.message);
    db.updateRecord(id, { reportStatus: "failed" });
  }
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/records", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

  const id = req.uploadId;
  const provider = PROVIDERS.includes(req.body.provider) ? req.body.provider : "auto";
  const notes = String(req.body.notes || "").trim().slice(0, MAX_NOTES_LENGTH);
  const audioPath = req.file.path;
  const specDir = path.join(SPEC_DIR, id);

  try {
    const result = await runPython("api_infer.py", [audioPath, specDir]);

    const record = {
      id,
      filename: req.file.originalname,
      createdAt: new Date().toISOString(),
      provider,
      notes,
      predictedClass: result.predicted_class,
      confidence: result.confidence,
      probabilities: result.all_probabilities,
      report: "",
      reportSource: null,
      reportStatus: "pending",
      audioUrl: `/storage/audio/${path.basename(audioPath)}`,
      spectrogramUrl: `/storage/specs/${id}/temp_mel.png`,
    };

    db.addRecord(record);
    res.status(201).json(record);

    generateReport(id, record.predictedClass, record.confidence, provider, notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/records", (req, res) => {
  const { q } = req.query;
  const records = db.search(q).map(({ report, ...meta }) => meta); // list view omits full report
  res.json(records);
});

app.get("/api/records/:id", (req, res) => {
  const record = db.getById(req.params.id);
  if (!record) return res.status(404).json({ error: "Record not found" });
  res.json(record);
});

app.delete("/api/records/:id", (req, res) => {
  const record = db.getById(req.params.id);
  if (!record) return res.status(404).json({ error: "Record not found" });

  db.deleteRecord(record.id);
  // Only ever remove files derived from the stored record, never from request input
  if (UUID_RE.test(record.id)) fs.rmSync(path.join(SPEC_DIR, record.id), { recursive: true, force: true });
  fs.rmSync(path.join(AUDIO_DIR, path.basename(record.audioUrl)), { force: true });
  res.status(204).end();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Unexpected error" });
});

// A restart interrupts any report that was still being written
db.failStalePending();

app.listen(PORT, () => {
  console.log(`NICU AI API server running on http://localhost:${PORT}`);
});
