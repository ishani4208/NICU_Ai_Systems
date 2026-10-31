// Tiny JSON-file backed data store — no native deps, good enough for a demo app.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "records.json");

function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ records: [] }, null, 2));
}

function formatDisplayId(n) {
  return String(n).padStart(3, "0");
}

function maxDisplayNumber(records) {
  return records.reduce((max, r) => Math.max(max, parseInt(r.displayId, 10) || 0), 0);
}

// Give older records a display ID, oldest first. Returns true if anything changed.
function backfillDisplayIds(records) {
  const missing = records.filter((r) => !r.displayId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  let next = maxDisplayNumber(records);
  missing.forEach((r) => {
    r.displayId = formatDisplayId(++next);
  });
  return missing.length > 0;
}

function readAll() {
  ensureDb();
  const raw = fs.readFileSync(DB_FILE, "utf-8");
  let records;
  try {
    records = JSON.parse(raw).records || [];
  } catch {
    return [];
  }
  if (backfillDisplayIds(records)) writeAll(records);
  return records;
}

function readCounter() {
  ensureDb();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8")).counter || 0;
  } catch {
    return 0;
  }
}

// The counter keeps report numbers unique even after a report is deleted
function writeAll(records, counter = readCounter()) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify({ counter, records }, null, 2));
}

function addRecord(record) {
  const records = readAll();
  const next = Math.max(readCounter(), maxDisplayNumber(records)) + 1;
  record.displayId = formatDisplayId(next);
  records.unshift(record); // newest first
  writeAll(records, next);
  return record;
}

function updateRecord(id, patch) {
  const records = readAll();
  const record = records.find((r) => r.id === id);
  if (!record) return null;
  Object.assign(record, patch);
  writeAll(records);
  return record;
}

function deleteRecord(id) {
  const records = readAll();
  const remaining = records.filter((r) => r.id !== id);
  if (remaining.length === records.length) return false;
  writeAll(remaining);
  return true;
}

// Reports still "pending" at startup were interrupted by a restart
function failStalePending() {
  const records = readAll();
  let changed = false;
  records.forEach((r) => {
    if (r.reportStatus === "pending") {
      r.reportStatus = "failed";
      changed = true;
    }
  });
  if (changed) writeAll(records);
}

function getById(id) {
  return readAll().find((r) => r.id === id) || null;
}

// 0 = exact number, 1 = number starts with the digits, 2 = contains them, -1 = no match
function idMatchTier(displayId, digits) {
  const padded = String(displayId);
  const plain = String(parseInt(padded, 10));
  if (parseInt(digits, 10) === parseInt(padded, 10)) return 0;
  if (plain.startsWith(digits) || padded.startsWith(digits)) return 1;
  if (padded.includes(digits)) return 2;
  return -1;
}

function search(query) {
  const records = readAll();
  const q = (query || "").trim().toLowerCase();
  if (!q) return records;

  // A number ("1", "#1", "01") searches report numbers only, best match first
  const digits = q.replace(/^#/, "");
  if (/^\d+$/.test(digits)) {
    return records
      .map((r) => ({ r, tier: idMatchTier(r.displayId, digits) }))
      .filter((x) => x.tier >= 0)
      .sort((a, b) => a.tier - b.tier || parseInt(a.r.displayId, 10) - parseInt(b.r.displayId, 10))
      .map((x) => x.r);
  }

  return records.filter(
    (r) =>
      r.id.toLowerCase().includes(q) ||
      r.filename.toLowerCase().includes(q) ||
      r.predictedClass.toLowerCase().includes(q) ||
      (r.notes || "").toLowerCase().includes(q)
  );
}

module.exports = { readAll, writeAll, addRecord, updateRecord, deleteRecord, failStalePending, getById, search };
