import os
import argparse
import torch
import torch.nn as nn
import torch.optim as optim
import numpy as np
import random
from sklearn.metrics import f1_score
from torchvision import datasets, models, transforms
from torch.utils.data import DataLoader

class SpecAugment:
    """Random time/frequency masking on a (C, F, T) spectrogram tensor."""
    def __init__(self, max_freq=30, max_time=30, n_masks=2):
        self.max_freq, self.max_time, self.n_masks = max_freq, max_time, n_masks

    def __call__(self, x):
        x = x.clone()
        _, f, t = x.shape
        for _ in range(self.n_masks):
            fw = random.randint(0, self.max_freq)
            f0 = random.randint(0, f - fw)
            x[:, f0:f0 + fw, :] = x.mean()
            tw = random.randint(0, self.max_time)
            t0 = random.randint(0, t - tw)
            x[:, :, t0:t0 + tw] = x.mean()
        return x

def train_model(data_dir="dataset_spectrograms", num_epochs=20, batch_size=16, lr=0.0003, seed=42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    data_transforms = {
        'train': transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            SpecAugment(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ]),
        'val': transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
        ])
    }

    train_path = os.path.join(data_dir, 'train')
    val_path = os.path.join(data_dir, 'val')

    if not os.path.exists(train_path) or not os.path.exists(val_path):
        raise FileNotFoundError(f"Dataset directories '{train_path}' or '{val_path}' do not exist.")

    image_datasets = {x: datasets.ImageFolder(os.path.join(data_dir, x), data_transforms[x]) for x in ['train', 'val']}
    dataloaders = {x: DataLoader(image_datasets[x], batch_size=batch_size, shuffle=(x == 'train')) for x in ['train', 'val']}
    
    class_names = image_datasets['train'].classes
    num_classes = len(class_names)
    print(f"Detected classes: {class_names}")

    # Inverse-frequency weights from the training split: N / (K * count_c)
    counts = np.bincount(image_datasets['train'].targets, minlength=num_classes)
    class_weights = (counts.sum() / (num_classes * counts)).tolist()
    class_weights_tensor = torch.FloatTensor(class_weights).to(device)
    print(f"Applied Class Weights: {dict(zip(class_names, class_weights))}")

    model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    num_ftrs = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Dropout(0.3),
        nn.Linear(num_ftrs, num_classes)
    )
    model = model.to(device)

    criterion = nn.CrossEntropyLoss(weight=class_weights_tensor)
    optimizer = optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs)

    best_f1 = -1.0

    for epoch in range(num_epochs):
        for phase in ['train', 'val']:
            if phase == 'train':
                model.train()
            else:
                model.eval()

            running_loss = 0.0
            running_corrects = 0
            all_preds, all_labels = [], []

            for inputs, labels in dataloaders[phase]:
                inputs = inputs.to(device)
                labels = labels.to(device)

                optimizer.zero_grad()
                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    _, preds = torch.max(outputs, 1)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)
                running_corrects += torch.sum(preds == labels.data)
                all_preds += preds.cpu().tolist()
                all_labels += labels.cpu().tolist()

            if phase == 'train':
                scheduler.step()

            epoch_loss = running_loss / len(image_datasets[phase])
            epoch_acc = running_corrects.double() / len(image_datasets[phase])

            epoch_f1 = f1_score(all_labels, all_preds, average='macro')

            print(f"Epoch {epoch+1}/{num_epochs} [{phase}] Loss: {epoch_loss:.4f} Acc: {epoch_acc:.4f} MacroF1: {epoch_f1:.4f}")

            if phase == 'val' and epoch_f1 > best_f1:
                best_f1 = epoch_f1
                tmp_path = 'resnet18_nicu_tmp.pth'
                torch.save({
                    'model_state_dict': model.state_dict(),
                    'classes': class_names
                }, tmp_path)
                try:
                    os.replace(tmp_path, 'resnet18_nicu.pth')
                except Exception:
                    pass

    print(f"Training Complete. Best Validation Macro-F1: {best_f1:.4f}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train ResNet-18 NICU Classifier")
    parser.add_argument("--epochs", type=int, default=20, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=16, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.0003, help="Learning rate")
    args = parser.parse_args()

    train_model(num_epochs=args.epochs, batch_size=args.batch_size, lr=args.lr)
