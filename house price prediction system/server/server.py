from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import server.util as util

app = FastAPI(title="Bangalore Home Price Prediction API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class PredictRequest(BaseModel):
    total_sqft: float
    bhk: int
    bath: int
    location: str

@app.on_event("startup")
async def startup_event():
    util.load_saved_artifacts()

@app.get("/api/get_location_names")
def get_location_names():
    return {"locations": util.get_location_names()}

@app.post("/api/predict_home_price")
def predict_home_price(req: PredictRequest):
    try:
        price = util.get_estimated_price(req.location, req.total_sqft, req.bhk, req.bath)
        return {"estimated_price": price}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health")
def health():
    return {"status": "ok"}

# Serve frontend
app.mount("/", StaticFiles(directory="client", html=True), name="client")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
