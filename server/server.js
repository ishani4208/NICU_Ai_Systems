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

function runInference(audioPath, provider, specDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_BIN, ["api_infer.py", audioPath, provider, specDir], {
      cwd: PROJECT_ROOT,
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));

    proc.on("close", (code) => {
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(stderr || `Python process exited with code ${code}`));
      }
      try {
        const lastLine = stdout.trim().split("\n").pop();
        const parsed = JSON.parse(lastLine);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve(parsed);
      } catch (e) {
        reject(new Error(`Failed to parse inference output: ${stdout}\n${stderr}`));
      }
    });
  });
}

app.get("/api/health", (req, res) => res.json({ status: "ok" }));

app.post("/api/records", upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded" });

  const id = req.uploadId;
  const provider = req.body.provider === "gemini" ? "gemini" : "groq";
  const notes = req.body.notes || "";
  const audioPath = req.file.path;
  const specDir = path.join(SPEC_DIR, id);

  try {
    const result = await runInference(audioPath, provider, specDir);

    const record = {
      id,
      filename: req.file.originalname,
      createdAt: new Date().toISOString(),
      provider,
      notes,
      predictedClass: result.predicted_class,
      confidence: result.confidence,
      probabilities: result.all_probabilities,
      report: result.clinical_report,
      audioUrl: `/storage/audio/${path.basename(audioPath)}`,
      spectrogramUrl: `/storage/specs/${id}/temp_mel.png`,
    };

    db.addRecord(record);
    res.status(201).json(record);
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

app.use((err, req, res, next) => {
  console.error(err);
  res.status(400).json({ error: err.message || "Unexpected error" });
});

app.listen(PORT, () => {
  console.log(`NICU AI API server running on http://localhost:${PORT}`);
});
