
#list of our imports
import os
from datetime import datetime, timedelta
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas

router = APIRouter()

#add secrets
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


#has the password before use
def hash_password(password: str) -> str:
    return pwd_context.hash(password )

#make sure password links
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify( plain_password, hashed_password)

def normalize_email(email: str) -> str:
    return email.strip().lower()
class Token(BaseModel ):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str
    first_name: str | None = None
    last_name: str | None = None
    password: str
    role: models.UserRole = models.UserRole.student


class LoginRequest(BaseModel):
    email: EmailStr
    password: str

#create tokens for accessing in db
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()

    now = datetime.utcnow()

    to_encode.update({"iat": now} )
    expire = now + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)


#find the current users
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id_str: str | None = payload.get("sub")
        if not user_id_str:
            raise credentials_exception

        user_id = uuid.UUID(user_id_str) 
    except (JWTError, ValueError):
        # ValueError handles invalid UUID strings
        raise credentials_exception

    user = db.get(models.User, user_id)
    if not user:
        raise credentials_exception

    return user


#enroll user after registration
@router.post("/register", response_model=schemas.UserBase, status_code=status.HTTP_201_CREATED)
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)
    
    stmt = select(models.User).where(models.User.email == normalized_email)
    if db.execute(stmt).scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.User(
        email=normalized_email,
        display_name=payload.display_name,
        first_name=payload.first_name,
        last_name=payload.last_name,
        role=payload.role,
        password_hash=hash_password(payload.password),
    )
    #add to the database
    db.add(user)

    db.commit()

    db.refresh(user)
    return user


# added the login post
@router.post("/login", response_model=Token)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    normalized_email = normalize_email(payload.email)

    stmt = select(models.User).where(models.User.email == normalized_email)

    user = db.execute(stmt).scalars().first()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)



#push curr 
@router.get("/me", response_model=schemas.UserBase)
async def read_me(current_user=Depends(get_current_user)):
    return current_user
