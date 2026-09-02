import os
import pandas as pd
import numpy as np
from scipy.io import wavfile

def create_synthetic_audio(filepath, duration=2.0, sr=22050, sound_type="Normal"):
    """Generates synthetic audio signals representing normal breathing, wheeze, or crackle."""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    
    if sound_type == "Normal":
        # Soft bandpass white noise simulation
        signal = np.random.normal(0, 0.1, size=len(t))
    elif sound_type == "Wheeze":
        # High pitched continuous tone overlay
        signal = 0.3 * np.sin(2 * np.pi * 400 * t) + np.random.normal(0, 0.05, size=len(t))
    elif sound_type == "Crackle":
        # Discontinuous explosive sounds (spikes)
        signal = np.random.normal(0, 0.05, size=len(t))
        spikes = np.random.choice(len(t), size=20, replace=False)
        signal[spikes] += np.random.choice([-1.0, 1.0], size=20) * 0.8
    else:
        signal = np.random.normal(0, 0.1, size=len(t))

    # Normalize to 16-bit PCM integer range
    signal_norm = np.int16(signal / (np.max(np.abs(signal)) + 1e-6) * 32767)
    wavfile.write(filepath, sr, signal_norm)

def setup_dummy_dataset(output_dir="dataset", num_samples_per_class=10):
    audio_dir = os.path.join(output_dir, "Lung_Sounds")
    os.makedirs(audio_dir, exist_ok=True)
    
    classes = ["Normal", "Wheeze", "Crackle"]
    metadata = []
    
    for label in classes:
        for i in range(1, num_samples_per_class + 1):
            filename = f"{label.lower()}_{i:03d}.wav"
            filepath = os.path.join(audio_dir, filename)
            create_synthetic_audio(filepath, sound_type=label)
            metadata.append({"FileName": filename, "Label": label})
            
    df = pd.DataFrame(metadata)
    csv_path = os.path.join(output_dir, "metadata.csv")
    df.to_csv(csv_path, index=False)
    print(f"Created {len(df)} synthetic audio files and saved metadata to {csv_path}")

def setup_demo_samples(demo_dir="demo_samples"):
    os.makedirs(demo_dir, exist_ok=True)
    samples = {
        "sample_normal.wav": "Normal",
        "sample_wheeze.wav": "Wheeze",
        "sample_crackle.wav": "Crackle"
    }
    for filename, sound_type in samples.items():
        filepath = os.path.join(demo_dir, filename)
        create_synthetic_audio(filepath, sound_type=sound_type)
    print(f"Created 3 demo samples in {demo_dir}")

if __name__ == "__main__":
    setup_dummy_dataset()
    setup_demo_samples()
