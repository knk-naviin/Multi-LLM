import pickle
from pathlib import Path
from sentence_transformers import SentenceTransformer
from sklearn.linear_model import LogisticRegression

from train_data import training_data

# Separate text and labels
texts = [x[0] for x in training_data]
labels = [x[1] for x in training_data]

# Load embedding model
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Convert text to embeddings
X = embedder.encode(texts)

# Train classifier
clf = LogisticRegression()
clf.fit(X, labels)

# Save classifier relative to this script directory.
output_path = Path(__file__).resolve().parent / "model.pkl"
with output_path.open("wb") as f:
    pickle.dump(clf, f)

print("✅ Classifier trained and saved!")
