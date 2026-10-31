"""
Bridge script invoked by the Node/Express backend as a subprocess.
Generates the clinical report for an already-classified recording and prints a
single JSON object to stdout. It does not load the model, so it starts fast.

Usage:
    python api_report.py <predicted_class> <confidence> <provider> [clinical_notes]
"""
import sys
import json
import os
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: api_report.py <predicted_class> <confidence> <provider> [clinical_notes]"}))
        sys.exit(1)

    predicted_class, provider = sys.argv[1], sys.argv[3]
    notes = sys.argv[4] if len(sys.argv) > 4 else ""

    try:
        confidence = float(sys.argv[2])
        from utils import generate_clinical_report_with_source

        report, source = generate_clinical_report_with_source(
            predicted_class, confidence, rag_context=notes, provider=provider
        )
        print(json.dumps({"report": report, "report_source": source}))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
