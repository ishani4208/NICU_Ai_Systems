// Tiny JSON-file backed data store — no native deps, good enough for a demo app.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "records.json");

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ records: [] }, null, 2));
}

function readAll() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  try {
    return JSON.parse(raw).records || [];
  } catch {
    return [];
  }
}

function writeAll(records) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify({ records }, null, 2));
}

function addRecord(record) {
  const records = readAll();
  records.unshift(record); // newest first
  writeAll(records);
  return record;
}

function getById(id) {
  return readAll().find((r) => r.id === id) || null;
}

function search(query) {
  const records = readAll();
  if (!query) return records;
  const q = query.toLowerCase();
  return records.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.filename.toLowerCase().includes(q) ||
      r.predictedClass.toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q)
  );
}

module.exports = { readAll, writeAll, addRecord, getById, search };
