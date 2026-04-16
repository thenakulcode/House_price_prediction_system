# BHP — Bengaluru Home Price Predictor (v2)

A full-stack ML web application that predicts Bengaluru residential property prices using a Linear Regression model, rebuilt with **FastAPI** and a completely redesigned dark luxury UI.

---

## Project Structure

```
bhp/
├── server.py               # FastAPI server (replaces Flask)
├── util.py                 # Model loading & prediction logic
├── requirements.txt        # Python dependencies
├── artifacts/
│   ├── columns.json                        # Feature columns used by the model
│   └── banglore_home_prices_model.pickle   # Trained scikit-learn model
└── client/                 # Static frontend (served by FastAPI)
    ├── index.html
    ├── app.css
    └── app.js
```

---

## Setup & Run

### 1. Place the model artifacts

Copy your model files into the `artifacts/` folder:
```
artifacts/columns.json
artifacts/banglore_home_prices_model.pickle
```

### 2. Create a virtual environment

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Run the server

```bash
python server.py
```

Then open **http://localhost:8000** in your browser.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/api/health` | Health check |
| `GET`  | `/api/get_location_names` | Returns list of all localities |
| `POST` | `/api/predict_home_price` | Returns estimated price |

### POST `/api/predict_home_price`

**Request body (JSON):**
```json
{
  "total_sqft": 1000,
  "bhk": 2,
  "bath": 2,
  "location": "rajaji nagar"
}
```

**Response:**
```json
{
  "estimated_price": 202.38
}
```

---

## Changes from v1 (Flask)

| Feature | v1 (Flask) | v2 (FastAPI) |
|---------|-----------|-------------|
| Framework | Flask 1.0 | FastAPI 0.111 |
| API style | Form POST | JSON body (Pydantic) |
| Auto docs | ❌ | ✅ `/docs` (Swagger UI) |
| Frontend served | Separate (nginx) | Built-in StaticFiles |
| Async support | ❌ | ✅ |
| Data validation | Manual | Pydantic models |

---

## Tech Stack

- **Backend**: FastAPI + Uvicorn
- **ML**: scikit-learn (Linear Regression), NumPy
- **Frontend**: Vanilla HTML/CSS/JS (zero dependencies)
- **Fonts**: Playfair Display + DM Sans (Google Fonts)
