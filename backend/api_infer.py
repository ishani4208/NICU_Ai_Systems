"""
Bridge script invoked by the Node/Express backend as a subprocess.
Runs filter -> mel-spectrogram -> ResNet18 classification for one audio file
and prints a single JSON object to stdout so Node can parse it. The clinical
report is generated separately by api_report.py so the result shows up fast.

Usage:
    python api_infer.py <audio_path> <spec_output_dir>
"""
import sys
import json
import os
import traceback

# Make sure imports work regardless of the cwd the process was spawned from.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: api_infer.py <audio_path> <spec_output_dir>"}))
        sys.exit(1)

    audio_path, spec_output_dir = sys.argv[1], sys.argv[2]

    try:
        from inference import NICUClassifier

        model_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resnet18_nicu.pth")
        classifier = NICUClassifier(model_path)

        res = classifier.predict(audio_path, temp_spec_dir=spec_output_dir, generate_report=False)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e), "trace": traceback.format_exc()}))
        sys.exit(1)


if __name__ == "__main__":
    main()
