import os
import zipfile
import shutil
import pandas as pd

def ingest_dataset():
    raw_dir = "dataset_raw"
    ls_zip = os.path.join(raw_dir, "LS.zip")
    ls_csv = os.path.join(raw_dir, "LS.csv")
    
    if not os.path.exists(ls_zip) or not os.path.exists(ls_csv):
        print("LS.zip or LS.csv not found in dataset_raw!")
        return

    print("Extracting LS.zip...")
    extracted_ls_dir = os.path.join(raw_dir, "extracted_LS")
    os.makedirs(extracted_ls_dir, exist_ok=True)
    
    with zipfile.ZipFile(ls_zip, 'r') as zip_ref:
        zip_ref.extractall(extracted_ls_dir)

    # Read metadata
    df = pd.read_csv(ls_csv)
    print("LS.csv sample:")
    print(df.head())

    # Map detailed categories to standard MVP 3 classes (Normal, Wheeze, Crackle)
    label_map = {
        'Normal': 'Normal',
        'Wheezing': 'Wheeze',
        'Rhonchi': 'Wheeze',          # Rhonchi are low-pitched wheezes
        'Coarse Crackles': 'Crackle',
        'Fine Crackles': 'Crackle',
        'Pleural Rub': 'Crackle'       # Group friction rubs with discontinuous crackles
    }

    target_audio_dir = os.path.join("dataset", "Lung_Sounds")
    os.makedirs(target_audio_dir, exist_ok=True)

    processed_metadata = []

    for _, row in df.iterrows():
        sound_id = str(row['Lung Sound ID']).strip()
        raw_label = str(row['Lung Sound Type']).strip()
        
        mapped_label = label_map.get(raw_label, 'Normal')
        
        # Look for the wav file in extracted_LS
        possible_filename = f"{sound_id}.wav"
        src_path = None
        
        for root, dirs, files in os.walk(extracted_ls_dir):
            if possible_filename in files:
                src_path = os.path.join(root, possible_filename)
                break
                
        if src_path and os.path.exists(src_path):
            dest_filename = f"{sound_id}.wav"
            dest_path = os.path.join(target_audio_dir, dest_filename)
            shutil.copy2(src_path, dest_path)
            processed_metadata.append({"FileName": dest_filename, "Label": mapped_label, "RawLabel": raw_label})
        else:
            print(f"Warning: File {possible_filename} for Sound ID '{sound_id}' not found.")

    out_df = pd.DataFrame(processed_metadata)
    out_csv = os.path.join("dataset", "metadata.csv")
    out_df.to_csv(out_csv, index=False)
    
    print(f"\nSuccessfully ingested {len(out_df)} real audio files into dataset/Lung_Sounds/")
    print("Class breakdown:")
    print(out_df['Label'].value_counts())

    # Create real audio demo samples
    demo_dir = "demo_samples"
    os.makedirs(demo_dir, exist_ok=True)

    normal_sample = out_df[out_df['Label'] == 'Normal'].iloc[0]['FileName']
    wheeze_sample = out_df[out_df['Label'] == 'Wheeze'].iloc[0]['FileName']
    crackle_sample = out_df[out_df['Label'] == 'Crackle'].iloc[0]['FileName']

    shutil.copy2(os.path.join(target_audio_dir, normal_sample), os.path.join(demo_dir, "sample_normal.wav"))
    shutil.copy2(os.path.join(target_audio_dir, wheeze_sample), os.path.join(demo_dir, "sample_wheeze.wav"))
    shutil.copy2(os.path.join(target_audio_dir, crackle_sample), os.path.join(demo_dir, "sample_crackle.wav"))

    print(f"Demo samples updated in {demo_dir}/ with real audio recordings:")
    print(f" - sample_normal.wav ({normal_sample})")
    print(f" - sample_wheeze.wav ({wheeze_sample})")
    print(f" - sample_crackle.wav ({crackle_sample})")

if __name__ == "__main__":
    ingest_dataset()
