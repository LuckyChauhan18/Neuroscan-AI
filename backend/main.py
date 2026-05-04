from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from database import init_indexes
from auth import router as auth_router
from routes.upload import router as upload_router
from routes.reports import router as reports_router
from routes.history import router as history_router
from routes.feedback import router as feedback_router
from middleware import RequestLoggingMiddleware
from exceptions import NeuroScanError
from logger import get_logger

logger = get_logger("main")

app = FastAPI(
    title="NeuroScan AI — Epileptic Seizure Detection",
    description="AI-powered EEG analysis for epileptic seizure detection",
    version="2.0.0",
)

# Order matters: CORSMiddleware first so preflight is handled before logging.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)


# ── Global exception handlers ─────────────────────────────────────────────────

@app.exception_handler(NeuroScanError)
async def neuroscan_error_handler(request: Request, exc: NeuroScanError) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.error(
        f"Application error [{exc.code}]: {exc.message}",
        extra={"request_id": request_id, "path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content={"detail": exc.message, "code": exc.code, "request_id": request_id},
    )


@app.exception_handler(Exception)
async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", None)
    logger.critical(
        f"Unhandled exception: {exc}",
        exc_info=True,
        extra={"request_id": request_id, "path": request.url.path},
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An unexpected error occurred. Please try again.",
            "request_id": request_id,
        },
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(reports_router)
app.include_router(history_router)
app.include_router(feedback_router)


# ── Lifecycle ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup() -> None:
    logger.info("NeuroScan AI starting up (v2.0.0)")
    init_indexes()
    logger.info("MongoDB indexes initialized")


@app.get("/")
def root():
    return {
        "name": "NeuroScan AI",
        "version": "2.0.0",
        "description": "Epileptic Seizure Detection from EEG Signals",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
