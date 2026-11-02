# NICU AI — Respiratory Sound Classifier

A ResNet18 classifier (Normal / Crackle / Wheeze) on mel-spectrograms, with a
React + Node/Express dashboard, PDF-exportable decision-support reports, and a
standalone Streamlit demo.

> **Research demo.** The model is trained on the HLS-CMDS chest-simulator
> dataset (adult manikin), not on neonatal patients. Output is decision support
> only and needs clinician confirmation.

```
NICU_Ai_Systems/
  .venv/                   # Python virtual environment (shared)
  backend/
    api_infer.py           # CLI bridge: audio in -> JSON (class, confidence, probabilities) out
    api_report.py          # CLI bridge: class + confidence in -> JSON clinical report out
    app.py                 # Standalone Streamlit demo
    preprocess.py          # audio -> mel-spectrograms, grouped train/val/test split
    train.py, evaluate.py  # training, evaluation, grouped k-fold CV (--cv)
    inference.py, utils.py # classifier wrapper, report generation (LLM chain + template)
    resnet18_nicu.pth      # trained weights
    dataset/, dataset_raw/, dataset_spectrograms/, demo_samples/
    .env                   # API keys (not committed)
    server/                # Express API: upload, run inference, store & search records
  frontend/                # React (Vite) dashboard: upload, history, report view, PDF export
```

Run all Python scripts from `backend/` (they use paths relative to it).

## How it works

1. The React dashboard uploads a `.wav`/`.mp3` file (plus optional clinical notes
   and a report provider) to the Express API.
2. Express saves the file and runs `python api_infer.py <audio> <specDir>`.
3. The Python script runs filter → mel-spectrogram → ResNet18 classification
   and prints one JSON line. Express stores the record (report status
   "pending") and returns it right away, so the browser shows the
   classification and spectrogram first.
4. In the background Express runs `python api_report.py <class> <confidence>
   <provider> <notes>`, which writes the clinical report (see *Report
   providers*). The browser polls until the report is ready.
5. Records are stored in `backend/server/data/records.json` under a short
   number (001, 002, ...). Numbers are never reused after a delete.
6. The History page lists and searches past records by report number
   (`12`, `#12`, `012`), filename, class or notes. Press `/` to jump to the
   search box. Each row has a PDF download icon and a delete button (with
   confirmation); the report page has "Download PDF" and "Delete" too.

## Prerequisites

- Python 3.10 or newer (developed on 3.12)
- Node.js 20 or newer
- At least one LLM API key for AI reports (optional: without any key, the app
  falls back to a fixed template report)

On macOS, install the tools with Homebrew if you do not have them:
`brew install python node`.

Commands below are given for **Windows (PowerShell)** and **macOS / Linux
(Terminal)**. Use the block for your system.

## First-time setup

Run these from the repository root.

**Windows (PowerShell)**

```powershell
# 1. Python environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt

# 2. API server dependencies
cd backend\server
npm install

# 3. Frontend dependencies
cd ..\..\frontend
npm install
```

**macOS / Linux (Terminal)**

```bash
# 1. Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# 2. API server dependencies
cd backend/server
npm install

# 3. Frontend dependencies
cd ../../frontend
npm install
```

Create `backend/.env` with your keys (all optional, add the ones you have).
On Windows use `notepad backend\.env`; on macOS use `nano backend/.env`.

```
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...
```

Make sure `backend/resnet18_nicu.pth` exists (it is in the repository).

## Start the project

Use two terminals, both starting from the repository root.

**Terminal 1 — API server (http://localhost:5000)**

Windows (PowerShell):

```powershell
cd backend\server
$env:PYTHON_BIN = (Resolve-Path "..\..\.venv\Scripts\python.exe").Path
npm start
```

macOS / Linux:

```bash
cd backend/server
export PYTHON_BIN="$(cd ../.. && pwd)/.venv/bin/python"
npm start
```

`PYTHON_BIN` must point at the virtual environment's Python. Otherwise the
server runs the system `python`, which does not have PyTorch.

> **macOS:** since macOS Monterey, the AirPlay Receiver uses port 5000, so the
> server may fail to start or answer with 403. Either turn it off in System
> Settings → General → AirDrop & Handoff → AirPlay Receiver, or use another
> port for both the server and the frontend:
>
> ```bash
> # Terminal 1
> PORT=5001 npm start
> # Terminal 2
> API_PORT=5001 npm run dev
> ```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

Open the address Vite prints, usually http://localhost:5173. If that port is
taken, Vite picks the next free one and prints it. The frontend proxies `/api`
and `/storage` to port 5000 (or `API_PORT` if set).

On Windows, if PowerShell blocks `npm`, use `npm.cmd` instead.

### Using the app

1. On the home page, choose an audio file, pick a report provider, optionally
   add clinical notes, and click **Analyze & Generate Report**.
2. Open **History** to search past reports, or click the download icon on a row
   to save it as PDF (choose "Save as PDF" in the print dialog).
3. Click the **NICU AI** logo to return to the home page. The sun/moon button
   switches between light and dark mode.

Sample audio from the test split is in `backend/dataset/test_audio/`.

### Streamlit demo (optional)

Windows (PowerShell):

```powershell
.\.venv\Scripts\Activate.ps1
cd backend
streamlit run app.py
```

macOS / Linux:

```bash
source .venv/bin/activate
cd backend
streamlit run app.py
```

## Report providers

The provider dropdown controls how the clinical report is written. **Auto**
tries, in order: Gemini, Groq, OpenRouter, and finally a fixed template report.
If you pick one provider, it is tried first and the rest follow.

| Option | Needs | Notes |
|---|---|---|
| Gemini | `GEMINI_API_KEY` | Models `gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash` |
| Groq | `GROQ_API_KEY` | Models `llama-3.3-70b-versatile`, `openai/gpt-oss-120b` |
| OpenRouter | `OPENROUTER_API_KEY` | Uses `openrouter/free`; free tier is limited per day |
| Template only | nothing | Fixed text from the class and confidence, no AI |

Providers without a key are skipped, and failures are printed in the API
server terminal. Each report records which model wrote it.

## Retrain and evaluate

Activate the virtual environment first (`.\.venv\Scripts\Activate.ps1` on
Windows, `source .venv/bin/activate` on macOS / Linux), then:

```bash
cd backend
python preprocess.py          # spectrograms + grouped train/val/test split
python train.py --epochs 20   # saves the best checkpoint to resnet18_nicu.pth
python evaluate.py            # train/val/test metrics
python evaluate.py --cv       # grouped 5-fold cross-validation
```

On macOS / Linux, `python` inside an activated virtual environment is the
environment's Python; outside it, use `python3`.

The split is grouped by identical audio content so duplicate recordings never
appear in both train and test. Last measured: about 95.7% test accuracy and
95.4% ± 2.2% in grouped 5-fold cross-validation, on simulator data only.

## Troubleshooting

| Problem | Fix |
|---|---|
| Analysis fails with a PyTorch or module error | Set `PYTHON_BIN` to the `.venv` Python before `npm start` |
| macOS: server fails on port 5000, or answers 403 | AirPlay Receiver uses that port; turn it off or use `PORT=5001` and `API_PORT=5001` (see above) |
| Report says "Template report" | No provider worked; check keys in `backend/.env` and the API server terminal, then restart the server |
| Groq returns "Invalid API Key" | Create a new key at console.groq.com and update `.env` |
| Changed `.env` but nothing changed | Restart the API server (it reads `.env` on start) |
| Frontend port differs from 5173 | Another app uses it; open the port Vite printed |

## Ideas for next steps

- Swap the JSON file store for SQLite/Postgres once you need multi-user auth.
- Keep the Python classifier resident (long-running process via stdin/stdout
  or a small FastAPI service) instead of spawning a new process per request —
  this avoids reloading the ResNet18 weights every time.
- Add patient/session grouping so multiple recordings can be tied to one
  NICU patient over time, with a trend chart of classifications.
- Add authentication (even basic) before deploying anywhere beyond localhost,
  since this currently has no access control.
- Validate on real, patient-grouped recordings (for example ICBHI or SPRSound)
  before making any clinical claims.
