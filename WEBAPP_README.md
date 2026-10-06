# NeoListen AI — Web Dashboard

A React + Node/Express frontend for the NICU respiratory sound classifier. The
original Streamlit demo (`app.py`) is unchanged and still works standalone;
this adds a full web app on top of the same Python pipeline
(`inference.py`, `preprocess.py`, `utils.py`).

```
NICU_Ai_Systems/
  api_infer.py     # CLI bridge: audio in -> JSON (class, confidence, report) out
  server/          # Express API: upload, run inference, store & search records
  client/          # React (Vite) dashboard: upload, history, report view
```

## How it works

1. React dashboard uploads a `.wav`/`.mp3` file to the Express API.
2. Express saves the file, spawns `python api_infer.py <audio> <provider> <specDir>`.
3. The Python script runs the existing filter → mel-spectrogram → ResNet18
   pipeline, then generates the Groq/Gemini clinical report, and prints one
   JSON line to stdout.
4. Express stores the result (metadata + report + file URLs) in
   `server/data/records.json` and returns it to the browser.
5. The History page lists/searches past records by ID, filename, class, or
   notes; clicking a row opens the full report.

## Setup

### 1. Python environment (same as the Streamlit app)

```powershell
pip install -r requirements.txt
```

Make sure `GROQ_API_KEY` / `GEMINI_API_KEY` are set in a `.env` file in
`NICU_Ai_Systems/` (same as before), and that `resnet18_nicu.pth` exists.

If `python` isn't on your PATH, set `PYTHON_BIN` env var for the server, e.g.
`$env:PYTHON_BIN = "py"`.

### 2. Backend

```powershell
cd server
npm install
npm run dev    # http://localhost:5000
```

### 3. Frontend

```powershell
cd client
npm install
npm run dev    # http://localhost:5173 (proxies /api and /storage to :5000)
```

Open http://localhost:5173 — upload a sample on the Dashboard tab, then check
the History tab to search/filter and reopen any past report by ID.

## Ideas for next steps

- Swap the JSON file store for SQLite/Postgres once you need multi-user auth.
- Keep the Python classifier resident (long-running process via stdin/stdout
  or a small FastAPI service) instead of spawning a new process per request —
  this avoids reloading the ResNet18 weights every time.
- Add patient/session grouping so multiple recordings can be tied to one
  NICU patient over time, with a trend chart of classifications.
- Add authentication (even basic) before deploying anywhere beyond localhost,
  since this currently has no access control.
- Export a report as PDF for clinical charting.
