<div align="center">

# 🧠 NeuroScan AI

**AI-Powered Epileptic Seizure Detection from EEG Signals**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TensorFlow](https://img.shields.io/badge/TensorFlow-2.16+-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)](https://tensorflow.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> Built for research, clinical support, and medical education.  
> **Not a certified medical device — always consult a qualified neurologist.**

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [AI Models](#-ai-models)
- [Dataset](#-dataset)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [API Endpoints](#-api-endpoints)
- [Medical Disclaimer](#️-medical-disclaimer)

---

## 🔬 Overview

**NeuroScan AI** is a full-stack web application that uses an ensemble of deep learning models to detect epileptic seizures from EEG (Electroencephalogram) signals. Users can upload either raw CSV EEG data or spectrogram images, and the system will:

1. Run inference using the appropriate AI model
2. Generate a structured clinical-style PDF/DOCX report
3. Store results securely in MongoDB
4. Deliver reports via email (optional)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🖼️ **Image Analysis** | Upload EEG spectrogram images (PNG/JPG) → EfficientNetB0 CNN |
| 🤖 **Hybrid Ensemble** | CNN + Gemini Vision AI fusion for maximum accuracy |
| 📄 **CSV Analysis** | Upload raw 178-point EEG CSV rows → LSTM tabular model |
| 📊 **Report Engine** | GPT-4o / OpenRouter powered clinical medical reports |
| 📧 **Email Delivery** | Auto-sends PDF/DOCX report to user's email |
| 🔐 **Auth System** | JWT-based registration & login with bcrypt hashing |
| 📂 **History** | Full prediction history per user with stored reports |
| 🌊 **Live EEG Viz** | Real-time animated EEG background with authentic signal patterns |
| ☁️ **Cloud Storage** | Spectrogram images stored on Cloudflare R2 |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   React Frontend                │
│  (Vite + TailwindCSS + Framer Motion)           │
│  Upload → Mode Select → Results → History       │
└──────────────────┬──────────────────────────────┘
                   │ REST API (JSON)
┌──────────────────▼──────────────────────────────┐
│              FastAPI Backend                    │
│                                                 │
│  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  CSV Route  │  │     Image Route           │  │
│  │  (tabular)  │  │  (spectrogram / image)   │  │
│  └──────┬──────┘  └────────────┬─────────────┘  │
│         │                      │                │
│  ┌──────▼──────┐  ┌────────────▼─────────────┐  │
│  │  Epilepsy   │  │ EpilepsyImage.h5          │  │
│  │  .h5 (LSTM) │  │ (EfficientNetB0)          │  │
│  │  5-class    │  │ + Gemini Vision Ensemble  │  │
│  └──────┬──────┘  └────────────┬─────────────┘  │
│         └──────────┬───────────┘                │
│              ┌─────▼─────┐                      │
│              │  Report   │  (OpenRouter / GPT)  │
│              │  Engine   │                      │
│              └─────┬─────┘                      │
└────────────────────┼────────────────────────────┘
          ┌──────────┼──────────┐
     ┌────▼────┐ ┌───▼────┐ ┌──▼──────────┐
     │ MongoDB │ │   R2   │ │ Email (SMTP)│
     │  Atlas  │ │ Storage│ │  Reports   │
     └─────────┘ └────────┘ └────────────┘
```

---

## 🤖 AI Models

### 1. EfficientNetB0 CNN — `EpilepsyImage.h5`
- **Input:** PNG/JPG EEG spectrogram images (STFT-generated)
- **Architecture:** EfficientNetB0 → GlobalAveragePooling → Dense(256) → Dense(128) → Dense(1, sigmoid)
- **Task:** Binary seizure/non-seizure classification
- **Note:** Trained on ~75% Non-Seizure / ~25% Seizure data; uses threshold = 0.25 to correct class imbalance bias

### 2. CNN + Gemini Vision Hybrid (Ensemble)
- **Input:** EEG spectrogram image
- **How it works:** EfficientNetB0 (35% weight) + Gemini Vision (65% weight) → weighted probability fusion
- **Advantage:** Gemini's broad medical visual knowledge compensates for training-data distribution shift

### 3. LSTM Tabular Model — `Epilepsy.h5`
- **Input:** 178 EEG signal values from a CSV row (1 second of data)
- **Architecture:** Auto-detected (flat Dense, LSTM, or subsampled LSTM depending on model shape)
- **Output:** 5-class softmax (class 1 = seizure) or binary sigmoid
- **Dataset:** UCI Epileptic Seizure Recognition (11,500 samples)

---

## 📊 Dataset

**UCI Epileptic Seizure Recognition Dataset**  
🔗 [https://archive.ics.uci.edu/ml/datasets/Epileptic+Seizure+Recognition](https://archive.ics.uci.edu/ml/datasets/Epileptic+Seizure+Recognition)

| Property | Value |
|---|---|
| Subjects | 500 individuals |
| Samples | 11,500 rows (23 × 500) |
| Features | 178 EEG data points per row (1 second @ 178 Hz) |
| Classes | 5 (class 1 = seizure, 2–5 = non-seizure) |
| Task used | Binary: class 1 vs rest |

**Class labels:**
- `1` — Epileptic seizure activity ⚡
- `2` — EEG recorded from tumor area
- `3` — EEG from healthy brain area (tumor patient)
- `4` — Eyes closed (healthy subject)
- `5` — Eyes open (healthy subject)

---

## 🛠️ Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| FastAPI | 0.104.1 | REST API framework |
| TensorFlow | ≥2.16.0 | ML model inference |
| PyMongo | 4.6.1 | MongoDB driver |
| Google Generative AI | ≥0.3.0 | Gemini Vision ensemble |
| SciPy + NumPy | latest | Signal processing (STFT) |
| ReportLab | 4.0.8 | PDF report generation |
| python-docx | 1.1.0 | DOCX report generation |
| boto3 | ≥1.34.0 | Cloudflare R2 (S3-compat) |
| python-jose | 3.3.0 | JWT authentication |
| bcrypt | 4.1.2 | Password hashing |

### Frontend
| Package | Purpose |
|---|---|
| React 18 + Vite | UI framework & bundler |
| TailwindCSS | Utility-first styling |
| Framer Motion | Animations & transitions |
| react-dropzone | File drag-and-drop |
| react-router-dom | Client-side routing |
| react-icons | Icon library |
| Canvas API | Real-time EEG visualization |

---

## 📁 Project Structure

```
NeuroScan-AI/
├── backend/
│   ├── main.py                  # FastAPI app entry point
│   ├── auth.py                  # JWT auth logic
│   ├── database.py              # MongoDB connection
│   ├── models.py                # Pydantic schemas
│   ├── middleware.py            # CORS & request logging
│   ├── ml_models/
│   │   ├── Epilepsy.h5          # LSTM tabular model (CSV input)
│   │   └── EpilepsyImage.h5     # EfficientNetB0 (image input)
│   ├── routes/
│   │   ├── upload.py            # /api/upload — main inference route
│   │   ├── reports.py           # /api/reports — report fetch & email
│   │   └── history.py           # /api/history — user history
│   └── services/
│       ├── tabular_model.py     # CSV LSTM inference
│       ├── image_model.py       # EfficientNetB0 + ensemble inference
│       ├── gemini_fallback.py   # Gemini Vision integration
│       ├── spectrogram.py       # STFT spectrogram generation
│       ├── openrouter_report.py # Medical report generation (LLM)
│       ├── email_service.py     # SMTP email with PDF/DOCX attachment
│       └── r2_storage.py        # Cloudflare R2 file storage
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js
    └── src/
        ├── App.jsx              # Routes & layout
        ├── api.js               # Axios API client
        ├── index.css            # Global styles & design tokens
        ├── components/
        │   ├── EEGBackground.jsx   # Animated EEG canvas background
        │   ├── Footer.jsx          # Footer with confusion matrices
        │   ├── Navbar.jsx
        │   └── ...
        └── pages/
            ├── Landing.jsx      # Home page
            ├── Upload.jsx       # File upload with mode selector
            ├── Results.jsx      # Prediction results & report viewer
            ├── History.jsx      # Past analyses
            ├── Profile.jsx      # User profile
            ├── Login.jsx
            └── Register.jsx
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- MongoDB Atlas account
- Cloudflare R2 bucket (optional)
- Google Gemini API key
- OpenRouter API key (for report generation)

### 1. Clone the repository
```bash
git clone https://github.com/LuckyChauhan18/Neuroscan-AI.git
cd Neuroscan-AI
```

### 2. Backend setup
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Frontend setup
```bash
cd frontend
npm install
```

### 4. Add model weights
Download the trained models and place them in `backend/ml_models/`:
- `Epilepsy.h5` — LSTM tabular model
- `EpilepsyImage.h5` — EfficientNetB0 image model

### 5. Configure environment variables
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your keys (see section below)
```

### 6. Run the application

**Backend (terminal 1):**
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Frontend (terminal 2):**
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) 🎉

---

## 🔑 Environment Variables

Create `backend/.env` with the following:

```env
# MongoDB
MONGODB_URL=mongodb+srv://<user>:<pass>@cluster.mongodb.net/neuroscan

# JWT
SECRET_KEY=your-super-secret-jwt-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# Google Gemini
GEMINI_API_KEY=your-gemini-api-key

# OpenRouter (report generation)
OPENROUTER_API_KEY=your-openrouter-api-key

# Cloudflare R2 (optional)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=neuroscan-spectrograms
R2_PUBLIC_URL=https://your-bucket.r2.dev

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASSWORD=your-app-password
EMAIL_FROM=your@gmail.com

# Model thresholds (optional overrides)
SEIZURE_THRESHOLD=0.25
ENSEMBLE_WEIGHT_EFF=0.35
ENSEMBLE_WEIGHT_GEMINI=0.65
ENSEMBLE_THRESHOLD=0.35
```

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Register new user |
| `POST` | `/api/auth/login` | Login → JWT token |
| `POST` | `/api/upload` | Upload EEG file → run inference |
| `GET` | `/api/history` | Get user's prediction history |
| `GET` | `/api/reports/{id}` | Fetch a specific report |
| `POST` | `/api/reports/{id}/email` | Email the report |
| `GET` | `/api/profile` | Get user profile |
| `PUT` | `/api/profile` | Update user profile |
| `GET` | `/health` | Health check |

---

## ⚕️ Medical Disclaimer

> **NeuroScan AI is an AI-assisted research and educational tool.**
>
> - It is **NOT a certified medical device**
> - It does **NOT provide medical diagnoses**
> - All predictions may be **incorrect**
> - **Always consult a qualified neurologist or physician** before making any clinical decisions
> - Results are for **informational and research purposes only**

---

## 👨‍💻 Author

**Lucky Chauhan**  
📧 [20nancyyy@gmail.com](mailto:20nancyyy@gmail.com)  
🐙 [github.com/LuckyChauhan18](https://github.com/LuckyChauhan18)

---

<div align="center">
Made with ❤️ by the NeuroScan AI Team · For research & educational use only
</div>
