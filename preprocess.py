import os
import shutil
import pandas as pd
import numpy as np
import librosa
import matplotlib.pyplot as plt
from scipy.signal import butter, sosfiltfilt
from sklearn.model_selection import train_test_split

# --- 1. Signal Processing Filters ---
def butter_bandpass_filter(data, lowcut=100.0, highcut=2000.0, fs=22050, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    sos = butter(order, [low, high], btype='band', output='sos')
    return sosfiltfilt(sos, data)

def generate_mel_spectrogram(audio_path, output_img_path, sr=22050, n_mels=128, hop_length=512):
    # Load audio
    y, sr = librosa.load(audio_path, sr=sr)
    
    # Denoise / Filter
    y_filtered = butter_bandpass_filter(y, lowcut=100.0, highcut=2000.0, fs=sr)
    
    # Compute Mel-Spectrogram
    mel_spec = librosa.feature.melspectrogram(y=y_filtered, sr=sr, n_mels=n_mels, hop_length=hop_length, fmax=2000)
    mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
    
    # Save as image without borders/axes
    fig = plt.figure(figsize=(4, 4), dpi=100)
    ax = plt.Axes(fig, [0., 0., 1., 1.])
    ax.set_axis_off()
    fig.add_axes(ax)
    librosa.display.specshow(mel_spec_db, sr=sr, fmax=2000, cmap='viridis')
    plt.savefig(output_img_path, bbox_inches='tight', pad_inches=0)
    plt.close(fig)

# --- 2. Batch Processing & Train/Val/Test Split ---
def process_dataset(metadata_csv="dataset/metadata.csv", audio_dir="dataset/Lung_Sounds", output_root="dataset_spectrograms"):
    if not os.path.exists(metadata_csv):
        print(f"Error: Metadata file '{metadata_csv}' not found.")
        return

    if os.path.exists(output_root):
        shutil.rmtree(output_root)

    df = pd.read_csv(metadata_csv)

    
    # Target 3 main classes for MVP (Normal, Wheeze, Crackle) or take all available
    train_df, test_df = train_test_split(df, test_size=0.15, stratify=df['Label'], random_state=42)
    train_df, val_df = train_test_split(train_df, test_size=0.176, stratify=train_df['Label'], random_state=42) # ~70/15/15
    
    splits = {'train': train_df, 'val': val_df, 'test': test_df}
    
    for split_name, split_df in splits.items():
        print(f"Processing {split_name} split ({len(split_df)} files)...")
        for _, row in split_df.iterrows():
            filename = str(row['FileName'])
            if not filename.endswith('.wav'):
                filename += '.wav'
            
            label = str(row['Label']).strip()
            
            src_audio = os.path.join(audio_dir, filename)
            if not os.path.exists(src_audio):
                print(f"Warning: Audio file {src_audio} does not exist. Skipping...")
                continue
                
            dest_dir = os.path.join(output_root, split_name, label)
            os.makedirs(dest_dir, exist_ok=True)
            
            dest_img = os.path.join(dest_dir, filename.replace('.wav', '.png'))
            generate_mel_spectrogram(src_audio, dest_img)

if __name__ == "__main__":
    process_dataset(
        metadata_csv="dataset/metadata.csv",
        audio_dir="dataset/Lung_Sounds",
        output_root="dataset_spectrograms"
    )
    print("Preprocessing completed!")
