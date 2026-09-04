import os
import shutil
import pandas as pd
import numpy as np
import librosa
import matplotlib
matplotlib.use('Agg')
from matplotlib.figure import Figure
from matplotlib.backends.backend_agg import FigureCanvasAgg
import librosa.display
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
    try:
        os.makedirs(os.path.dirname(output_img_path), exist_ok=True)

        # Load audio
        y, sr = librosa.load(audio_path, sr=sr)
        
        # Denoise / Filter
        y_filtered = butter_bandpass_filter(y, lowcut=100.0, highcut=2000.0, fs=sr)
        
        # Compute Mel-Spectrogram
        mel_spec = librosa.feature.melspectrogram(y=y_filtered, sr=sr, n_mels=n_mels, hop_length=hop_length, fmax=2000)
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # Save as image using Object-Oriented Matplotlib (100% thread safe)
        fig = Figure(figsize=(4, 4), dpi=100)
        canvas = FigureCanvasAgg(fig)
        ax = fig.add_axes([0, 0, 1, 1])
        ax.set_axis_off()
        librosa.display.specshow(mel_spec_db, sr=sr, fmax=2000, cmap='viridis', ax=ax)
        fig.savefig(output_img_path, bbox_inches='tight', pad_inches=0)
    except Exception as e:
        print(f"Error processing {audio_path}: {e}")

# --- 2. Batch Processing & Train/Val/Test Split ---
def process_dataset(metadata_csv="dataset/metadata.csv", audio_dir="dataset/Lung_Sounds", output_root="dataset_spectrograms"):
    if not os.path.exists(metadata_csv):
        print(f"Error: Metadata file '{metadata_csv}' not found.")
        return

    if os.path.exists(output_root):
        shutil.rmtree(output_root)

    df = pd.read_csv(metadata_csv)
    df['Label'] = df['Label'].astype(str).str.strip()
    
    train_df, test_df = train_test_split(df, test_size=0.15, stratify=df['Label'], random_state=42)
    train_df, val_df = train_test_split(train_df, test_size=0.176, stratify=train_df['Label'], random_state=42) # ~70/15/15
    
    splits = {'train': train_df, 'val': val_df, 'test': test_df}
    labels = set(df['Label'])

    # Pre-create all required directory structures
    for split_name in ['train', 'val', 'test']:
        for label in labels:
            os.makedirs(os.path.join(output_root, split_name, label), exist_ok=True)
    
    for split_name, split_df in splits.items():
        print(f"Processing {split_name} split ({len(split_df)} files)...")
        for idx, row in split_df.iterrows():
            filename = str(row['FileName']).strip()
            if not filename.endswith('.wav'):
                filename += '.wav'
            
            label = str(row['Label']).strip()
            
            src_audio = os.path.join(audio_dir, filename)
            if not os.path.exists(src_audio):
                print(f"Warning: Audio file {src_audio} does not exist. Skipping...")
                continue
                
            dest_dir = os.path.join(output_root, split_name, label)
            dest_img = os.path.join(dest_dir, os.path.splitext(filename)[0] + '.png')
            generate_mel_spectrogram(src_audio, dest_img)

    print("Preprocessing completed successfully for ALL splits!")

if __name__ == "__main__":
    process_dataset(
        metadata_csv="dataset/metadata.csv",
        audio_dir="dataset/Lung_Sounds",
        output_root="dataset_spectrograms"
    )
