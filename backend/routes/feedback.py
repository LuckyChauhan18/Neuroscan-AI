from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from database import get_db
from auth import get_current_user
from models import serialize, to_object_id
from logger import get_logger

logger = get_logger("routes.feedback")

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])


class FeedbackCreate(BaseModel):
    prediction_id: str
    rating: int       # 1–5
    comment: str = ""


@router.post("/")
def create_feedback(
    data: FeedbackCreate,
    current_user: dict = Depends(get_current_user),
):
    if not 1 <= data.rating <= 5:
        raise HTTPException(400, "Rating must be between 1 and 5")

    db = get_db()

    # Verify the prediction belongs to this user
    oid = to_object_id(data.prediction_id)
    if not oid or not db["predictions"].find_one({"_id": oid, "user_id": current_user["id"]}):
        raise HTTPException(404, "Prediction not found")

    doc = {
        "user_id": current_user["id"],
        "prediction_id": data.prediction_id,
        "rating": data.rating,
        "comment": data.comment or "",
        "created_at": datetime.utcnow(),
    }
    result = db["feedbacks"].insert_one(doc)
    doc["_id"] = result.inserted_id
    f = serialize(doc)

    logger.info(
        f"Feedback submitted: prediction={data.prediction_id} rating={data.rating}",
        extra={"user_id": current_user["id"]},
    )
    return {
        "id": f["id"],
        "prediction_id": f["prediction_id"],
        "rating": f["rating"],
        "comment": f["comment"],
        "created_at": doc["created_at"].isoformat(),
    }


@router.get("/{prediction_id}")
def get_feedback(
    prediction_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    docs = (
        db["feedbacks"]
        .find({"prediction_id": prediction_id, "user_id": current_user["id"]})
        .sort("created_at", -1)
    )
    return [
        {
            "id": str(f["_id"]),
            "rating": f["rating"],
            "comment": f["comment"],
            "created_at": f["created_at"].isoformat(),
        }
        for f in docs
    ]
