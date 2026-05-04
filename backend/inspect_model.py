"""
Run this once to see your model's exact architecture:
  cd backend
  python inspect_model.py
"""
import os
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

MODEL_PATH = os.path.join(os.path.dirname(__file__), "ml_models", "Epilepsy.h5")

from tensorflow.keras.models import load_model

print(f"\nLoading: {MODEL_PATH}")
model = load_model(MODEL_PATH)

print("\n── Input ──────────────────────────────────")
print("  input_shape :", model.input_shape)

print("\n── Output ─────────────────────────────────")
print("  output_shape:", model.output_shape)
last_layer = model.layers[-1]
print("  last layer  :", last_layer.__class__.__name__)
print("  activation  :", getattr(last_layer, "activation", None))
print("  units       :", getattr(last_layer, "units", None))

print("\n── Full summary ───────────────────────────")
model.summary()
