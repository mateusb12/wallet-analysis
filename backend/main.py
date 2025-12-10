import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from backend.source.features.analysis import analysis_router
from backend.source.features.analysis.analysis_router import analysis_bp
from backend.source.features.auth import auth_router
from backend.source.features.auth.auth_router import auth_bp
from backend.source.features.market_data.market_data_router import market_data_bp

# Updated imports pointing to the features folder

# Load env from the root of your project
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(__file__)), '.env'))

app = FastAPI(title="CalcInvest API", version="0.2.0")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(auth_bp)
app.include_router(market_data_bp)
app.include_router(analysis_bp)

@app.get("/")
def health_check():
    return {"status": "ok", "framework": "FastAPI"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)