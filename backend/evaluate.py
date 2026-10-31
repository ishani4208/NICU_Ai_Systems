import argparse
import glob
import os
import re
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from PIL import Image
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader, Dataset
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import (
    accuracy_score, balanced_accuracy_score, f1_score,
    classification_report, confusion_matrix,
)
import pandas as pd
from inference import NICUClassifier
from preprocess import assign_groups
from train import SpecAugment

# Synthetic clips from create_dummy_dataset.py, e.g. crackle_001.png
SYNTHETIC = re.compile(r"^(crackle|wheeze|normal)_\d+$")


def predict_split(clf, split_dir, batch_size=16):
    ds = datasets.ImageFolder(split_dir, clf.transform)
    if ds.classes != list(clf.classes):
        raise ValueError(f"Class order mismatch: folders {ds.classes} vs model {clf.classes}")
    y_true, y_pred = [], []
    with torch.no_grad():
        for x, t in DataLoader(ds, batch_size=batch_size):
            y_pred += clf.model(x.to(clf.device)).argmax(1).cpu().tolist()
            y_true += t.tolist()
    stems = [os.path.splitext(os.path.basename(p))[0] for p, _ in ds.samples]
    return ds.classes, y_true, y_pred, stems


def report(title, classes, y_true, y_pred):
    print(f"\n===== {title} (n={len(y_true)}) =====")
    if not y_true:
        print("No samples.")
        return
    print(f"Accuracy          : {accuracy_score(y_true, y_pred):.4f}")
    print(f"Balanced accuracy : {balanced_accuracy_score(y_true, y_pred):.4f}")
    print(f"Macro F1          : {f1_score(y_true, y_pred, average='macro'):.4f}")
    labels = list(range(len(classes)))
    print(classification_report(y_true, y_pred, labels=labels, target_names=classes, digits=3, zero_division=0))
    print("Confusion matrix (rows=true, cols=pred):", classes)
    print(confusion_matrix(y_true, y_pred, labels=labels))


class _Samples(Dataset):
    def __init__(self, items, transform):
        self.items, self.transform = items, transform

    def __len__(self):
        return len(self.items)

    def __getitem__(self, i):
        path, label = self.items[i]
        return self.transform(Image.open(path).convert('RGB')), label


def cross_validate(data_dir, audio_dir, folds=5, epochs=12, batch_size=16, lr=3e-4, seed=42):
    """Grouped, stratified k-fold over train+val+test. Each fold trains a fresh model for a fixed number of epochs and is scored once on its held-out fold."""
    classes = sorted(os.listdir(os.path.join(data_dir, 'train')))
    paths, labels = [], []
    for split in ('train', 'val', 'test'):
        for ci, c in enumerate(classes):
            for p in sorted(glob.glob(os.path.join(data_dir, split, c, '*.png'))):
                paths.append(p)
                labels.append(ci)
    labels = np.array(labels)
    df = pd.DataFrame({'FileName': [os.path.splitext(os.path.basename(p))[0] + '.wav' for p in paths]})
    groups = assign_groups(df, audio_dir).values
    print(f"{len(paths)} samples, {len(set(groups))} independent groups, classes {classes}")

    norm = transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
    train_tf = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), SpecAugment(), norm])
    eval_tf = transforms.Compose([transforms.Resize((224, 224)), transforms.ToTensor(), norm])
    device = torch.device('cuda:0' if torch.cuda.is_available() else 'cpu')

    all_true, all_pred, rows = [], [], []
    skf = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=seed)
    for k, (tr, te) in enumerate(skf.split(paths, labels, groups), 1):
        assert not set(groups[tr]) & set(groups[te])
        random.seed(seed + k); np.random.seed(seed + k); torch.manual_seed(seed + k)

        counts = np.bincount(labels[tr], minlength=len(classes))
        weights = torch.FloatTensor(counts.sum() / (len(classes) * counts)).to(device)
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
        model.fc = nn.Sequential(nn.Dropout(0.3), nn.Linear(model.fc.in_features, len(classes)))
        model = model.to(device)
        criterion = nn.CrossEntropyLoss(weight=weights)
        optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
        scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs)

        train_dl = DataLoader(_Samples([(paths[i], labels[i]) for i in tr], train_tf), batch_size=batch_size, shuffle=True)
        test_dl = DataLoader(_Samples([(paths[i], labels[i]) for i in te], eval_tf), batch_size=batch_size)
        for _ in range(epochs):
            model.train()
            for x, y in train_dl:
                optimizer.zero_grad()
                criterion(model(x.to(device)), y.to(device)).backward()
                optimizer.step()
            scheduler.step()

        model.eval()
        y_true, y_pred = [], []
        with torch.no_grad():
            for x, y in test_dl:
                y_pred += model(x.to(device)).argmax(1).cpu().tolist()
                y_true += y.tolist()
        acc, bal, f1 = accuracy_score(y_true, y_pred), balanced_accuracy_score(y_true, y_pred), f1_score(y_true, y_pred, average='macro')
        rows.append((acc, bal, f1))
        all_true += y_true
        all_pred += y_pred
        print(f"Fold {k}/{folds}: n={len(te)} groups={len(set(groups[te]))} acc={acc:.4f} balanced_acc={bal:.4f} macro_f1={f1:.4f}", flush=True)

    r = np.array(rows)
    print(f"\nGrouped {folds}-fold CV ({epochs} epochs/fold):")
    for name, col in zip(('Accuracy', 'Balanced accuracy', 'Macro F1'), r.T):
        print(f"{name:18s}: {col.mean():.4f} +/- {col.std(ddof=1):.4f}  (min {col.min():.4f}, max {col.max():.4f})")
    print("Pooled confusion matrix (rows=true, cols=pred):", classes)
    print(confusion_matrix(all_true, all_pred))


def main():
    parser = argparse.ArgumentParser(description="Evaluate the NICU classifier on spectrogram splits")
    parser.add_argument("--model", default="resnet18_nicu.pth")
    parser.add_argument("--data_dir", default="dataset_spectrograms")
    parser.add_argument("--splits", nargs="+", default=["train", "val", "test"])
    parser.add_argument("--cv", action="store_true", help="Run grouped k-fold cross-validation instead")
    parser.add_argument("--folds", type=int, default=5)
    parser.add_argument("--cv_epochs", type=int, default=12)
    parser.add_argument("--audio_dir", default="dataset/Lung_Sounds")
    args = parser.parse_args()

    if args.cv:
        cross_validate(args.data_dir, args.audio_dir, folds=args.folds, epochs=args.cv_epochs)
        return

    clf = NICUClassifier(args.model)
    print(f"Model classes: {clf.classes} | device: {clf.device}")

    for split in args.splits:
        classes, y_true, y_pred, stems = predict_split(clf, os.path.join(args.data_dir, split))
        report(f"{split} - all samples", classes, y_true, y_pred)

        keep = [i for i, s in enumerate(stems) if not SYNTHETIC.match(s)]
        if len(keep) != len(stems):
            report(f"{split} - excluding synthetic clips", classes,
                   [y_true[i] for i in keep], [y_pred[i] for i in keep])


if __name__ == "__main__":
    main()
