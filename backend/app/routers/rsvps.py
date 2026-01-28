from __future__ import annotations

from datetime import datetime
from uuid import UUID
from typing import Dict, List, Optional, Set

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user


router = APIRouter(prefix="/rsvps")


#statuses that should count toward capacity
ACTIVE_STATUSES: Set[models.RSVPStatus] = {
    models.RSVPStatus.rsvped,
    models.RSVPStatus.checked_in,
    models.RSVPStatus.waitlisted,
}

#statuses that represent a "yes" RSVP for notification / organizer push purposes
YES_STATUSES: Set[models.RSVPStatus] = {
    models.RSVPStatus.rsvped,
    models.RSVPStatus.checked_in,
}
def _get_event_or_404(db: Session, event_id: UUID) -> models.Event:
    event = db.get(models.Event, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )
    return event


def _count_active_rsvps(db: Session, event_id: UUID) -> int:
    return (
        db.query(models.RSVP)
        .filter(
            models.RSVP.event_id == event_id,
            models.RSVP.status.in_(list(ACTIVE_STATUSES)),
        )
        .count()
    )


def _ensure_capacity(
    db: Session,
    event: models.Event,
    existing_rsvp: Optional[models.RSVP] = None,
):
    """
    Enforce event capacity for new "active" RSVPs.

    If the user already occupies an active slot, allow status updates
    without re-checking capacity.
    """
    if event.capacity is None:
        return

    if existing_rsvp and existing_rsvp.status in ACTIVE_STATUSES:
        return

    active_count = _count_active_rsvps(db, event.id)
    if active_count >= event.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event capacity has been reached",
        )


def _should_create_rsvp_notification(
    new_status: models.RSVPStatus,
    old_status: Optional[models.RSVPStatus],
) -> bool:
    return new_status in YES_STATUSES and (old_status not in YES_STATUSES)


def _add_rsvp_notification(
    db: Session,
    user: models.User,
    event: models.Event,
):
    title = f"RSVP'd for {event.title}"
    message = f"You RSVP'd for {event.title}."

    notif = models.Notification(
        user_id=user.id,
        event_id=event.id,
        kind=models.NotificationKind.rsvp,
        title=title,
        message=message,
        is_read=False,
        created_at=datetime.utcnow(),
    )

    db.add(notif)



# Current user reads


@router.get("/me", response_model=List[schemas.RSVPBase])
def list_my_rsvps(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.RSVP)
        .filter(models.RSVP.user_id == current_user.id)
        .order_by(models.RSVP.created_at.desc())
        .all()
    )



@router.get("/me/map", response_model=Dict[UUID, models.RSVPStatus])
def my_rsvp_map(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(models.RSVP.event_id, models.RSVP.status)
        .filter(models.RSVP.user_id == current_user.id)
        .all()
    )
    return {event_id: status_ for event_id, status_ in rows}


@router.get("/me/{event_id}", response_model=Optional[schemas.RSVPBase])
def get_my_rsvp_for_event(
    event_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(models.RSVP)
        .filter(
            models.RSVP.user_id == current_user.id,
            models.RSVP.event_id == event_id,
        )
        .first()
    )


# 
# Create / Update (toggle)
@router.post("", response_model=schemas.RSVPBase, status_code=status.HTTP_201_CREATED)
def create_or_update_rsvp(
    payload: schemas.RSVPCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db ),
):
    event = _get_event_or_404(db, payload.event_id)

    existing = (
        db.query(models.RSVP )
        .filter(
            models.RSVP.user_id == current_user.id,
            models.RSVP.event_id == event.id,
        )
        .first()
    )

    # only enforce capacity if the new status is "active"
    if payload.status in ACTIVE_STATUSES:
        _ensure_capacity(db, event, existing)

    if existing:
        old_status = existing.status
        existing.status = payload.status

        if _should_create_rsvp_notification(payload.status, old_status):
            _add_rsvp_notification(db, current_user, event)

        db.add(existing)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Event capacity has been reached",
            )

        db.refresh(existing)
        return existing

    rsvp = models.RSVP(
        user_id=current_user.id,
        event_id=event.id,
        status=payload.status,
    )

    if _should_create_rsvp_notification(payload.status, None):
        _add_rsvp_notification(db, current_user, event)

    db.add(rsvp)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event capacity has been reached",
        )

    db.refresh(rsvp)
    return rsvp


@router.put("/me/{event_id}", response_model=schemas.RSVPBase)
def update_my_rsvp(
    event_id: UUID,
    payload: schemas.RSVPUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = _get_event_or_404(db, event_id)

    existing = (
        db.query(models.RSVP)
        .filter(
            models.RSVP.user_id == current_user.id,
            models.RSVP.event_id == event_id,
        )
        .first()
    )

    if not existing:
        create_payload = schemas.RSVPCreate(event_id=event_id, status=payload.status)
        return create_or_update_rsvp(create_payload, current_user, db)

    if payload.status in ACTIVE_STATUSES:
        _ensure_capacity(db, event, existing)

    old_status = existing.status
    existing.status = payload.status

    if _should_create_rsvp_notification(payload.status, old_status):
        _add_rsvp_notification(db, current_user, event)

    db.add(existing)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Event capacity has been reached",
        )

    db.refresh(existing)
    return existing



@router.delete("/me/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_rsvp(
    event_id: UUID,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rsvp = (
        db.query(models.RSVP)
        .filter(
            models.RSVP.user_id == current_user.id,
            models.RSVP.event_id == event_id,
        )
        .first()
    )

    if not rsvp:
        return

    db.delete(rsvp)
    db.commit()


# Event-level helper
@router.get("/event/{event_id}/count")
def get_event_rsvp_count(
    event_id: UUID,
    db: Session = Depends(get_db),
):
    event = _get_event_or_404(db, event_id)
    count = _count_active_rsvps(db, event.id)

    cap = event.capacity
    is_full = bool(cap is not None and count >= cap)

    return {
        "event_id": str(event.id),
        "count": count,
        "capacity": cap,
        "is_full": is_full,
    }
