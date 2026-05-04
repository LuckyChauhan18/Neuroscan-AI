from pymongo import MongoClient, ASCENDING
from pymongo.database import Database
import os
from logger import get_logger

logger = get_logger("database")

_client: MongoClient = None


def get_client() -> MongoClient:
    global _client
    if _client is None:
        _client = MongoClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    return _client


def get_db() -> Database:
    return get_client()[os.getenv("MONGODB_DB_NAME", "neuroscan")]


def init_indexes():
    db = get_db()
    db["users"].create_index([("username", ASCENDING)], unique=True)
    db["users"].create_index([("email", ASCENDING)], unique=True)
    db["predictions"].create_index([("user_id", ASCENDING)])
    db["feedbacks"].create_index([("prediction_id", ASCENDING)])
    logger.info("MongoDB indexes initialized")
