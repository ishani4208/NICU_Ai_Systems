import os
import sys
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import models, transforms
from PIL import Image
from preprocess import generate_mel_spectrogram

class NICUClassifier:
    def __init__(self, model_path="resnet18_nicu.pth"):
        self.device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(model_path, map_location=self.device)
        
        self.classes = checkpoint['classes']
        self.model = models.resnet18(weights=None)
        self.model.fc = nn.Linear(self.model.fc.in_features, len(self.classes))
        self.model.load_state_dict(checkpoint['model_state_dict'])
        self.model = self.model.to(self.device)
        self.model.eval()

        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])

    def predict(self, audio_path, temp_spec_dir="temp_specs"):
        os.makedirs(temp_spec_dir, exist_ok=True)
        spec_path = os.path.join(temp_spec_dir, "temp_mel.png")
        
        # 1. Generate Mel-spectrogram
        generate_mel_spectrogram(audio_path, spec_path)

        # 2. Run Inference
        img = Image.open(spec_path).convert('RGB')
        input_tensor = self.transform(img).unsqueeze(0).to(self.device)

        with torch.no_grad():
            outputs = self.model(input_tensor)
            probs = F.softmax(outputs, dim=1)[0]
            confidence, pred_idx = torch.max(probs, 0)

        predicted_class = self.classes[pred_idx.item()]
        confidence_val = float(confidence.item())

        return {
            "predicted_class": predicted_class,
            "confidence": confidence_val,
            "spectrogram_path": spec_path,
            "all_probabilities": {self.classes[i]: float(probs[i]) for i in range(len(self.classes))}
        }

# Quick test helper
if __name__ == "__main__":
    model_file = "resnet18_nicu.pth"
    if not os.path.exists(model_file):
        print(f"Model weight file '{model_file}' not found. Please train the model first using train.py.")
    else:
        classifier = NICUClassifier(model_file)
        sample = sys.argv[1] if len(sys.argv) > 1 else "demo_samples/sample_normal.wav"
        if os.path.exists(sample):
            res = classifier.predict(sample)
            print("Inference Result:")
            print(res)
        else:
            print(f"Sample audio '{sample}' not found.")
