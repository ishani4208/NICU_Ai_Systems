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
from concurrent.futures import ThreadPoolExecutor

# --- 1. Signal Processing Filters & Audio Normalization ---
def butter_bandpass_filter(data, lowcut=100.0, highcut=2000.0, fs=22050, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    sos = butter(order, [low, high], btype='band', output='sos')
    return sosfiltfilt(sos, data)

def generate_mel_spectrogram(audio_path, output_img_path, sr=22050, n_mels=128, hop_length=512, target_duration=15.0):
    try:
        os.makedirs(os.path.dirname(output_img_path), exist_ok=True)

        # 1. Load audio
        y, sr = librosa.load(audio_path, sr=sr)
        
        # 2. Standardize duration so spectrogram time-frequency scales match
        target_len = int(target_duration * sr)
        if len(y) < target_len and len(y) > 0:
            repeats = int(np.ceil(target_len / len(y)))
            y = np.tile(y, repeats)[:target_len]
        elif len(y) > target_len:
            y = y[:target_len]
            
        # 3. Peak normalization to eliminate volume discrepancies
        max_amp = np.max(np.abs(y))
        if max_amp > 0:
            y = y / max_amp

        # 4. Butterworth Bandpass Denoise / Filter (100Hz - 2000Hz)
        y_filtered = butter_bandpass_filter(y, lowcut=100.0, highcut=2000.0, fs=sr)
        
        # 5. Compute Mel-Spectrogram
        mel_spec = librosa.feature.melspectrogram(
            y=y_filtered, sr=sr, n_mels=n_mels, hop_length=hop_length, fmax=2000
        )
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # 6. Save as image using Object-Oriented Matplotlib (thread safe)
        fig = Figure(figsize=(4, 4), dpi=100)
        canvas = FigureCanvasAgg(fig)
        ax = fig.add_axes([0, 0, 1, 1])
        ax.set_axis_off()
        librosa.display.specshow(mel_spec_db, sr=sr, fmax=2000, cmap='viridis', ax=ax)
        fig.savefig(output_img_path, bbox_inches='tight', pad_inches=0)
    except Exception as e:
        print(f"Error processing {audio_path}: {e}")

def _process_item(item):
    src_audio, dest_img = item
    generate_mel_spectrogram(src_audio, dest_img)

# --- 2. Batch Processing & Train/Val/Test Split ---
def process_dataset(metadata_csv="dataset/metadata.csv", audio_dir="dataset/Lung_Sounds", output_root="dataset_spectrograms"):
    if not os.path.exists(metadata_csv):
        print(f"Error: Metadata file '{metadata_csv}' not found.")
        return

    if os.path.exists(output_root):
        shutil.rmtree(output_root)

    df = pd.read_csv(metadata_csv)
    df['Label'] = df['Label'].astype(str).str.strip()
    
    # 70% Train, 15% Val, 15% Test with stratification
    train_df, test_df = train_test_split(df, test_size=0.15, stratify=df['Label'], random_state=42)
    train_df, val_df = train_test_split(train_df, test_size=0.176, stratify=train_df['Label'], random_state=42)
    
    splits = {'train': train_df, 'val': val_df, 'test': test_df}
    labels = sorted(list(set(df['Label'])))

    # Pre-create all required directory structures
    for split_name in ['train', 'val', 'test']:
        for label in labels:
            os.makedirs(os.path.join(output_root, split_name, label), exist_ok=True)
    
    tasks = []
    for split_name, split_df in splits.items():
        print(f"Preparing {split_name} split ({len(split_df)} files)...")
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
            tasks.append((src_audio, dest_img))

    print(f"Generating {len(tasks)} spectrograms using multithreaded processing...")
    with ThreadPoolExecutor(max_workers=8) as executor:
        list(executor.map(_process_item, tasks))

    print("Preprocessing completed successfully for ALL splits!")

if __name__ == "__main__":
    process_dataset(
        metadata_csv="dataset/metadata.csv",
        audio_dir="dataset/Lung_Sounds",
        output_root="dataset_spectrograms"
    )
