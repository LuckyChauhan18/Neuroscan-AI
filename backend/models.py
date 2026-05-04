from bson import ObjectId


def serialize(doc: dict) -> dict:
    """Convert a MongoDB document to a JSON-serializable dict."""
    if doc is None:
        return None
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    if "user_id" in doc:
        doc["user_id"] = str(doc["user_id"])
    if "prediction_id" in doc:
        doc["prediction_id"] = str(doc["prediction_id"])
    return doc


def to_object_id(id_str: str) -> ObjectId:
    try:
        return ObjectId(id_str)
    except Exception:
        return None
