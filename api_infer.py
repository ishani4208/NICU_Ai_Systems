"""
Bridge script invoked by the Node/Express backend as a subprocess.
Runs the full pipeline (filter -> mel-spectrogram -> ResNet18 classification ->
LLM clinical report) for a single audio file and prints a single JSON object
to stdout so Node can parse it.

Usage:
    python api_infer.py <audio_path> <provider> <spec_output_dir>
"""
import sys
import json
import os
import traceback

# Make sure imports work regardless of the cwd the process was spawned from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: api_infer.py <audio_path> <provider> <spec_output_dir>"}))
        sys.exit(1)

    audio_path, provider, spec_output_dir = sys.argv[1], sys.argv[2], sys.argv[3]

    try:
        from inference import NICUClassifier
        from utils import generate_clinical_report

        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resnet18_nicu.pth")
        classifier = NICUClassifier(model_path)

        res = classifier.predict(audio_path, temp_spec_dir=spec_output_dir, generate_report=False)
        res["clinical_report"] = generate_clinical_report(
            res["predicted_class"], res["confidence"], provider=provider
        )

        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
