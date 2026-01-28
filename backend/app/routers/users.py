import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, schemas
from .auth import get_current_user, verify_password, hash_password

router = APIRouter()


@router.get("/me", response_model=schemas.UserWithSettings)
def get_me(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Ensure settings row exists
    if current_user.settings is None:
        settings = models.UserSettings(user_id=current_user.id)
        db.add(settings)
        db.commit()
        db.refresh(current_user)

    return current_user


@router.patch("/me/settings", response_model=schemas.UserSettingsBase)
def update_my_settings(
    payload: schemas.UserSettingsUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Create settings if missing
    if current_user.settings is None:
        current_user.settings = models.UserSettings(user_id=current_user.id)
        db.add(current_user.settings)
        db.commit()
        db.refresh(current_user)

    s = current_user.settings

    if payload.theme is not None:
        s.theme = payload.theme
    if payload.email_notifications is not None:
        s.email_notifications = payload.email_notifications
    if payload.push_notifications is not None:
        s.push_notifications = payload.push_notifications

    db.commit()
    db.refresh(s)
    return s


# ---------- NEW: profile/account update ----------
@router.patch("/me", response_model=schemas.UserWithSettings)
def update_me(
    payload: schemas.UserUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = payload.model_dump(exclude_unset=True)

    # Enforce unique username if changed
    if "username" in data and data["username"]:
        existing = (
            db.query(models.User)
            .filter(
                models.User.username == data["username"],
                models.User.id != current_user.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken.",
            )

    for field, value in data.items():
        setattr(current_user, field, value)

    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user


# ---------- NEW: change password ----------
@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
def change_password(
    payload: schemas.ChangePassword,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Basic length check
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters long.",
        )

    if not current_user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You do not have a password set.",
        )

    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
