import os
import zipfile
import shutil
import pandas as pd

def ingest_dataset():
    raw_dir = "dataset_raw"
    ls_zip = os.path.join(raw_dir, "LS.zip")
    ls_csv = os.path.join(raw_dir, "LS.csv")
    mix_zip = os.path.join(raw_dir, "Mix.zip")
    mix_csv = os.path.join(raw_dir, "Mix.csv")
    
    target_audio_dir = os.path.join("dataset", "Lung_Sounds")
    os.makedirs(target_audio_dir, exist_ok=True)

    label_map = {
        'Normal': 'Normal',
        'Wheezing': 'Wheeze',
        'Rhonchi': 'Wheeze',          # Rhonchi are low-pitched continuous wheezes
        'Coarse Crackles': 'Crackle',
        'Fine Crackles': 'Crackle',
        'Pleural Rub': 'Crackle'       # Group friction rubs with discontinuous crackles
    }

    processed_metadata = []

    # --- 1. Ingest Isolated Lung Sounds (LS) ---
    if os.path.exists(ls_zip) and os.path.exists(ls_csv):
        print("Extracting LS.zip (Isolated Lung Sounds)...")
        extracted_ls_dir = os.path.join(raw_dir, "extracted_LS")
        os.makedirs(extracted_ls_dir, exist_ok=True)
        with zipfile.ZipFile(ls_zip, 'r') as zip_ref:
            zip_ref.extractall(extracted_ls_dir)

        df_ls = pd.read_csv(ls_csv)
        for _, row in df_ls.iterrows():
            sound_id = str(row['Lung Sound ID']).strip()
            raw_label = str(row['Lung Sound Type']).strip()
            mapped_label = label_map.get(raw_label, 'Normal')
            possible_filename = f"{sound_id}.wav"
            
            src_path = None
            for root, dirs, files in os.walk(extracted_ls_dir):
                if possible_filename in files:
                    src_path = os.path.join(root, possible_filename)
                    break
                    
            if src_path and os.path.exists(src_path):
                dest_filename = f"ls_{sound_id}.wav"
                dest_path = os.path.join(target_audio_dir, dest_filename)
                shutil.copy2(src_path, dest_path)
                processed_metadata.append({"FileName": dest_filename, "Label": mapped_label, "RawLabel": raw_label, "Source": "LS"})

    # --- 2. Ingest Mixed Heart & Lung Sounds (Mix) ---
    if os.path.exists(mix_zip) and os.path.exists(mix_csv):
        print("Extracting Mix.zip (Mixed Heart & Lung Sounds)...")
        extracted_mix_dir = os.path.join(raw_dir, "extracted_Mix")
        os.makedirs(extracted_mix_dir, exist_ok=True)
        with zipfile.ZipFile(mix_zip, 'r') as zip_ref:
            zip_ref.extractall(extracted_mix_dir)

        df_mix = pd.read_csv(mix_csv)
        
        # Scan extracted_Mix for all .wav files
        mix_wav_map = {}
        for root, dirs, files in os.walk(extracted_mix_dir):
            for f in files:
                if f.lower().endswith('.wav') and not f.startswith('._'):
                    mix_wav_map[f] = os.path.join(root, f)

        for _, row in df_mix.iterrows():
            mixed_id = str(row['Mixed Sound ID']).strip()
            raw_label = str(row['Lung Sound Type']).strip()
            mapped_label = label_map.get(raw_label, 'Normal')

            # Search for matching file
            matching_file = None
            for fname, fpath in mix_wav_map.items():
                if mixed_id in fname:
                    matching_file = fpath
                    break

            if matching_file and os.path.exists(matching_file):
                dest_filename = f"mix_{os.path.basename(matching_file)}"
                dest_path = os.path.join(target_audio_dir, dest_filename)
                shutil.copy2(matching_file, dest_path)
                processed_metadata.append({"FileName": dest_filename, "Label": mapped_label, "RawLabel": raw_label, "Source": "Mix"})
            else:
                # Fallback: copy any additional wav files in Mix
                pass

        # Ingest remaining unmapped Mix wav files to maximize sample usage
        ingested_files = set(m["FileName"] for m in processed_metadata)
        for fname, fpath in mix_wav_map.items():
            dest_name = f"mix_{fname}"
            if dest_name not in ingested_files:
                # Infer label from filename if available or default
                inferred_label = "Normal"
                for key, mapped_val in label_map.items():
                    if key.lower() in fname.lower():
                        inferred_label = mapped_val
                        break
                dest_path = os.path.join(target_audio_dir, dest_name)
                shutil.copy2(fpath, dest_path)
                processed_metadata.append({"FileName": dest_name, "Label": inferred_label, "RawLabel": "Mixed", "Source": "Mix_Extra"})

    out_df = pd.DataFrame(processed_metadata)
    out_csv = os.path.join("dataset", "metadata.csv")
    out_df.to_csv(out_csv, index=False)
    
    print(f"\nSuccessfully ingested ALL {len(out_df)} audio files into dataset/Lung_Sounds/")
    print("Class breakdown across entire dataset:")
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

    print(f"\nDemo samples updated in {demo_dir}/ with real audio recordings:")
    print(f" - sample_normal.wav ({normal_sample})")
    print(f" - sample_wheeze.wav ({wheeze_sample})")
    print(f" - sample_crackle.wav ({crackle_sample})")

if __name__ == "__main__":
    ingest_dataset()
