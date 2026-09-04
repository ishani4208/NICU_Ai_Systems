import sys
import os

# Set UTF-8 output encoding for Windows terminal
sys.stdout.reconfigure(encoding='utf-8')

from inference import NICUClassifier

def run_test():
    print("=" * 60)
    print(" NeoListen AI System - End-to-End Test ")
    print("=" * 60)
    
    classifier = NICUClassifier("resnet18_nicu.pth")
    
    sample_file = "demo_samples/sample_wheeze.wav"
    if len(sys.argv) > 1:
        sample_file = sys.argv[1]
        
    print(f"\n[1] Processing Audio File: {sample_file}")
    
    # Run prediction and generate LLM clinical report
    result = classifier.predict(sample_file, generate_report=True)
    
    print(f"\n[2] Audio Classification Result:")
    print(f"    - Predicted Class : {result['predicted_class']}")
    print(f"    - Confidence      : {result['confidence'] * 100:.2f}%")
    print(f"    - Spectrogram PNG : {result['spectrogram_path']}")
    
    print("\n[3] Class Probabilities:")
    for cls, prob in result['all_probabilities'].items():
        print(f"    - {cls:8s}: {prob * 100:.2f}%")
        
    print("\n" + "=" * 60)
    print(" GENERATED CLINICAL DECISION SUPPORT REPORT ")
    print("=" * 60 + "\n")
    print(result.get('clinical_report', 'No report generated.'))
    print("=" * 60)

if __name__ == "__main__":
    run_test()
