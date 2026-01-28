from __future__ import annotations

from datetime import datetime
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user


router = APIRouter(prefix="/notifications")



# Current user notifications
@router.get("/me", response_model=List[schemas.NotificationBase])
def list_my_notifications(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db ),
):

    return (
        db.query(models.Notification)
        .filter(models.Notification.user_id == current_user.id)
        .order_by(models.Notification.created_at.desc())
        .all()
    )

# mark notifcaitons
@router.post("/me/mark-all-read")
def mark_all_my_notifications_read(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    now = datetime.utcnow()

    q = (
        db.query(models.Notification )
        .filter(
            models.Notification.user_id == current_user.id,
            models.Notification.is_read == False,  # noqa: E712
        )
    )

    count = q.count()

    q.update(
        {
            models.Notification.is_read: True,
            models.Notification.read_at: now,
        },
        synchronize_session=False,
    )

    db.commit()

    return {"updated": count}



# Single notification updates-

@router.patch("/{notification_id}", response_model=schemas.NotificationBase)
def update_my_notification(
    notification_id: UUID,
    payload: schemas.NotificationUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    notif = db.get(models.Notification, notification_id)

    if not notif or notif.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

    if payload.is_read is not None:
        notif.is_read = payload.is_read
        if payload.is_read and notif.read_at is None:
            notif.read_at = payload.read_at or datetime.utcnow()
        if not payload.is_read:
            notif.read_at = None

    if payload.read_at is not None and notif.is_read:
        notif.read_at = payload.read_at

    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif
