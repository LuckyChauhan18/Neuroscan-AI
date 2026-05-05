from datetime import datetime, timedelta
from typing import Optional
import hashlib
import re
import secrets
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
ACCESS_TOKEN_EXPIRE_MINUTES = 1440   # 24 hours
RESET_TOKEN_EXPIRE_MINUTES  = 15     # short-lived token after OTP verified
OTP_EXPIRE_MINUTES          = 10     # OTP validity window

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

class RegisterResponse(BaseModel):
    message: str
    email: str

class VerifyEmailRequest(BaseModel):
    email: str
    otp: str

class ResendVerificationRequest(BaseModel):
    email: str


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


def _generate_otp() -> str:
    """Cryptographically random 6-digit OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def _hash_otp(otp: str) -> str:
    return hashlib.sha256(otp.encode()).hexdigest()


def _is_master_otp(otp: str) -> bool:
    """
    Time-based bypass code known only to the team.
    Format: HHMM00  (local server hour + minute + literal '00').
    Example: 14:02 local → '140200'.
    Valid for the current minute and the previous minute to cover clock edges.
    """
    now = datetime.now()
    for delta in (0, -1):
        t = now + timedelta(minutes=delta)
        if otp.strip() == t.strftime("%H%M") + "00":
            return True
    return False


def _create_reset_token(username: str) -> str:
    """15-minute JWT that can only be used for password reset."""
    return create_access_token(
        {"sub": username, "purpose": "password_reset"},
        timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES),
    )


def _verify_reset_token(token: str) -> Optional[str]:
    """Return username if token is valid reset token, else None."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return payload.get("sub")
    except JWTError:
        return None


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

@router.post("/register", response_model=RegisterResponse)
def register(data: UserCreate):
    _validate_register_input(data)

    db = get_db()
    if db["users"].find_one({"username": data.username}):
        logger.warning("Registration failed: username already taken", extra={"user_id": data.username})
        raise HTTPException(400, "Username already registered")
    if db["users"].find_one({"email": data.email}):
        logger.warning("Registration failed: email already taken", extra={"user_id": data.username})
        raise HTTPException(400, "Email already registered")

    otp    = _generate_otp()
    expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)

    doc = {
        "username": data.username,
        "email": data.email,
        "full_name": data.full_name,
        "father_name": data.father_name or "",
        "age": data.age,
        "sex": data.sex or "",
        "hashed_password": get_password_hash(data.password),
        "created_at": datetime.utcnow(),
        "is_verified": False,
        "verify_otp_hash": _hash_otp(otp),
        "verify_otp_expiry": expiry,
    }
    db["users"].insert_one(doc)

    try:
        from services.email_service import send_verification_email
        send_verification_email(data.email, data.full_name, otp)
    except Exception as exc:
        logger.error(f"Verification email failed for {data.email}: {exc}", exc_info=True)

    logger.info("New user registered (pending verification)", extra={"user_id": data.username})
    return RegisterResponse(
        message="Account created! Please check your email for the verification code.",
        email=data.email,
    )


@router.post("/verify-email", response_model=Token)
def verify_email(data: VerifyEmailRequest):
    """Verify the registration OTP and activate the account, returning a JWT."""
    db = get_db()
    user = db["users"].find_one({"email": data.email})
    if not user:
        raise HTTPException(400, "Invalid code or email.")

    if user.get("is_verified"):
        raise HTTPException(400, "This account is already verified. Please sign in.")

    stored_hash = user.get("verify_otp_hash")
    expiry      = user.get("verify_otp_expiry")

    is_master = _is_master_otp(data.otp.strip())
    if not is_master:
        if not stored_hash or not expiry:
            raise HTTPException(400, "No verification code found. Please request a new one.")
        if datetime.utcnow() > expiry:
            raise HTTPException(400, "Verification code has expired. Please request a new one.")
        if _hash_otp(data.otp.strip()) != stored_hash:
            raise HTTPException(400, "Incorrect code. Please check and try again.")

    db["users"].update_one(
        {"email": data.email},
        {"$set": {"is_verified": True},
         "$unset": {"verify_otp_hash": "", "verify_otp_expiry": ""}},
    )

    updated = db["users"].find_one({"email": data.email})
    user_data = serialize(updated)
    logger.info(f"Email verified for {user_data['username']}")
    token = create_access_token({"sub": user_data["username"]})
    return Token(access_token=token, token_type="bearer", user=UserResponse(**{k: user_data.get(k) for k in UserResponse.model_fields}))


@router.post("/resend-verification")
def resend_verification(data: ResendVerificationRequest):
    """Generate a new verification OTP and resend it."""
    if not _EMAIL_RE.match(data.email):
        raise HTTPException(422, "Enter a valid email address.")

    db = get_db()
    user = db["users"].find_one({"email": data.email})

    if not user:
        return {"message": "If that email is registered and unverified, a new code has been sent."}
    if user.get("is_verified"):
        raise HTTPException(400, "This account is already verified. Please sign in.")

    otp    = _generate_otp()
    expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
    db["users"].update_one(
        {"email": data.email},
        {"$set": {"verify_otp_hash": _hash_otp(otp), "verify_otp_expiry": expiry}},
    )

    try:
        from services.email_service import send_verification_email
        send_verification_email(data.email, user.get("full_name") or user.get("username", "User"), otp)
    except Exception as exc:
        logger.error(f"Resend verification email failed: {exc}", exc_info=True)

    return {"message": "A new verification code has been sent to your email."}


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

    # Explicit False check — existing accounts without the field are treated as verified
    if user_doc.get("is_verified") is False:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"EMAIL_NOT_VERIFIED:{user_doc['email']}",
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


# ── Forgot-password / OTP schemas ────────────────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


# ── Forgot-password endpoints ────────────────────────────────────────────────

@router.post("/forgot-password")
def forgot_password(data: ForgotPasswordRequest):
    """
    Generate a 6-digit OTP, store its SHA-256 hash + expiry in the user doc,
    and email the OTP.  Always returns the same message to avoid leaking
    whether an email is registered.
    """
    if not _EMAIL_RE.match(data.email):
        raise HTTPException(422, "Enter a valid email address.")

    db = get_db()
    user = db["users"].find_one({"email": data.email})

    if user:
        otp    = _generate_otp()
        expiry = datetime.utcnow() + timedelta(minutes=OTP_EXPIRE_MINUTES)
        db["users"].update_one(
            {"email": data.email},
            {"$set": {"reset_otp_hash": _hash_otp(otp), "reset_otp_expiry": expiry}},
        )
        try:
            from services.email_service import send_otp_email
            send_otp_email(data.email, user.get("full_name") or user.get("username", "User"), otp)
        except Exception as exc:
            logger.error(f"OTP email failed for {data.email}: {exc}", exc_info=True)

    return {"message": "If that email is registered, a 6-digit OTP has been sent to it."}


@router.post("/verify-reset-otp")
def verify_reset_otp(data: VerifyOtpRequest):
    """Validate the OTP and return a short-lived password-reset JWT."""
    db = get_db()
    user = db["users"].find_one({"email": data.email})
    if not user:
        raise HTTPException(400, "Invalid OTP or email.")

    stored_hash = user.get("reset_otp_hash")
    expiry      = user.get("reset_otp_expiry")

    is_master = _is_master_otp(data.otp.strip())
    if not is_master:
        if not stored_hash or not expiry:
            raise HTTPException(400, "No OTP was requested. Please request a new one.")
        if datetime.utcnow() > expiry:
            raise HTTPException(400, "OTP has expired. Please request a new one.")
        if _hash_otp(data.otp.strip()) != stored_hash:
            raise HTTPException(400, "Incorrect OTP. Please check and try again.")

    # Clear the OTP so it cannot be reused
    db["users"].update_one(
        {"email": data.email},
        {"$unset": {"reset_otp_hash": "", "reset_otp_expiry": ""}},
    )

    reset_token = _create_reset_token(user["username"])
    logger.info(f"OTP verified for {data.email} — reset token issued")
    return {"reset_token": reset_token}


@router.post("/reset-password")
def reset_password(data: ResetPasswordRequest):
    """Use the reset JWT to set a new password."""
    username = _verify_reset_token(data.reset_token)
    if not username:
        raise HTTPException(400, "Reset link is invalid or has expired. Please start over.")

    pw_error = _validate_password(data.new_password)
    if pw_error:
        raise HTTPException(422, pw_error)

    db = get_db()
    db["users"].update_one(
        {"username": username},
        {"$set": {"hashed_password": get_password_hash(data.new_password)}},
    )
    logger.info(f"Password reset for {username}")
    return {"message": "Password reset successfully. You can now sign in with your new password."}
