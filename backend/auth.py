from datetime import datetime, timedelta
from typing import Optional
import re
from jose import JWTError, jwt
import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
import os
from database import get_db
from models import serialize
from logger import get_logger

logger = get_logger("auth")

# ── Input validation constants ────────────────────────────────────────────────

_EMAIL_RE    = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]{2,}$')
_USERNAME_RE = re.compile(r'^[a-zA-Z0-9._-]{3,20}$')
_SPECIAL_RE  = re.compile(r'[._-]')   # username must contain at least one


def _validate_password(password: str) -> str:
    """Return an error message, or '' if the password is valid."""
    if len(password) < 8:
        return "Password must be at least 8 characters long."
    if not re.search(r'[A-Z]', password):
        return "Password must contain at least one uppercase letter."
    if not re.search(r'[0-9]', password):
        return "Password must contain at least one number."
    if not re.search(r'[^A-Za-z0-9]', password):
        return "Password must contain at least one special character."
    return ''


def _validate_register_input(data) -> None:
    """Raise HTTPException 422 for any invalid field."""
    if not data.full_name or len(data.full_name.strip()) < 2:
        raise HTTPException(422, "Full name must be at least 2 characters.")
    if not _USERNAME_RE.match(data.username):
        raise HTTPException(422, "Username must be 3–20 characters using letters, numbers, _ . or -")
    if not _SPECIAL_RE.search(data.username):
        raise HTTPException(422, "Username must contain at least one _ . or -")
    if not _EMAIL_RE.match(data.email):
        raise HTTPException(422, "Enter a valid email address.")
    pw_error = _validate_password(data.password)
    if pw_error:
        raise HTTPException(422, pw_error)

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
router = APIRouter(prefix="/api/auth", tags=["Authentication"])


# ── Pydantic schemas ─────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: str
    father_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None          # "Male" | "Female" | "Other"
    password: str


class UserResponse(BaseModel):
    id: str
    username: str
    email: str
    full_name: str
    father_name: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse


# ── Utilities ────────────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    payload["exp"] = expire
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)):
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise exc
    except JWTError:
        raise exc

    db = get_db()
    user = db["users"].find_one({"username": username})
    if not user:
        raise exc
    return serialize(user)


# ── Routes ───────────────────────────────────────────────────────────────────

@router.post("/register", response_model=Token)
def register(data: UserCreate):
    _validate_register_input(data)

    db = get_db()
    if db["users"].find_one({"username": data.username}):
        logger.warning("Registration failed: username already taken", extra={"user_id": data.username})
        raise HTTPException(400, "Username already registered")
    if db["users"].find_one({"email": data.email}):
        logger.warning("Registration failed: email already taken", extra={"user_id": data.username})
        raise HTTPException(400, "Email already registered")

    doc = {
        "username": data.username,
        "email": data.email,
        "full_name": data.full_name,
        "father_name": data.father_name or "",
        "age": data.age,
        "sex": data.sex or "",
        "hashed_password": get_password_hash(data.password),
        "created_at": datetime.utcnow(),
    }
    result = db["users"].insert_one(doc)
    doc["_id"] = result.inserted_id
    user = serialize(doc)

    logger.info("New user registered", extra={"user_id": data.username})
    token = create_access_token({"sub": user["username"]})
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_db()
    user_doc = db["users"].find_one({"username": form_data.username})
    if not user_doc or not verify_password(form_data.password, user_doc["hashed_password"]):
        logger.warning("Login failed: bad credentials", extra={"user_id": form_data.username})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = serialize(user_doc)
    logger.info("User logged in", extra={"user_id": user["username"]})
    token = create_access_token({"sub": user["username"]})
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse(**user),
    )


@router.get("/profile", response_model=UserResponse)
def get_profile(current_user: dict = Depends(get_current_user)):
    return UserResponse(**{k: current_user.get(k) for k in UserResponse.model_fields})


class UserUpdate(BaseModel):
    full_name:   Optional[str] = None
    father_name: Optional[str] = None
    age:         Optional[int] = None
    sex:         Optional[str] = None
    email:       Optional[str] = None
    password:    Optional[str] = None   # new password (plain); omit to keep unchanged


@router.patch("/profile", response_model=UserResponse)
def update_profile(
    data: UserUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    updates: dict = {}

    if data.full_name is not None:
        updates["full_name"] = data.full_name.strip()
    if data.father_name is not None:
        updates["father_name"] = data.father_name.strip()
    if data.age is not None:
        updates["age"] = data.age
    if data.sex is not None:
        updates["sex"] = data.sex
    if data.email is not None:
        # Check email not taken by another user
        existing = db["users"].find_one({"email": data.email})
        if existing and str(existing["_id"]) != current_user["id"]:
            raise HTTPException(400, "Email already in use by another account.")
        updates["email"] = data.email.strip()
    if data.password:
        pw_error = _validate_password(data.password)
        if pw_error:
            raise HTTPException(422, pw_error)
        updates["hashed_password"] = get_password_hash(data.password)

    if not updates:
        raise HTTPException(400, "No fields provided to update.")

    db["users"].update_one(
        {"username": current_user["username"]},
        {"$set": updates},
    )
    updated = db["users"].find_one({"username": current_user["username"]})
    user = serialize(updated)
    return UserResponse(**{k: user.get(k) for k in UserResponse.model_fields})
