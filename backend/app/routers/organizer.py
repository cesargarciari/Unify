from __future__ import annotations

from datetime import datetime
from typing import List, Set
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from .auth import get_current_user


router = APIRouter()


# -----------------------------
# Helpers
# -----------------------------

def event_to_list_item(event: models.Event) -> schemas.EventListItem:
    return schemas.EventListItem(
        id=event.id,
        title=event.title,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        tags=[t.tag for t in event.tags] if event.tags else [],
    )


def event_to_detail(event: models.Event) -> schemas.EventDetail:
    return schemas.EventDetail(
        id=event.id,
        organizer_id=event.organizer_id,
        title=event.title,
        description=event.description,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        capacity=event.capacity,
        is_public=event.is_public,
        organization_id=event.organization_id,
        tags=[t.tag for t in event.tags] if event.tags else [],
    )


def _assert_org_access(event: models.Event, current_user: models.User):
    if current_user.role not in (models.UserRole.organizer, models.UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organizers can perform this action",
        )

    if event.organizer_id != current_user.id and current_user.role != models.UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this event",
        )


YES_STATUSES: Set[models.RSVPStatus] = {
    models.RSVPStatus.rsvped,
    models.RSVPStatus.checked_in,
}


# -----------------------------
# Organizer-owned event CRUD
# -----------------------------

@router.get("/events", response_model=List[schemas.EventListItem])
def list_my_events(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    List events owned by the current organizer.
    GET /api/organizer/events
    """
    if current_user.role not in (models.UserRole.organizer, models.UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organizers can view organizer events",
        )

    events = (
        db.query(models.Event)
        .filter(models.Event.organizer_id == current_user.id)
        .order_by(models.Event.starts_at)
        .all()
    )

    return [event_to_list_item(e) for e in events]


@router.get("/events/{event_id}", response_model=schemas.EventDetail)
def get_my_event(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Get a single event owned by the current organizer.
    GET /api/organizer/events/{event_id}
    """
    event = db.get(models.Event, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _assert_org_access(event, current_user)

    return event_to_detail(event)


@router.post("/events", response_model=schemas.EventDetail, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: schemas.EventCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create a new event as the current organizer.
    POST /api/organizer/events
    Body: EventCreate
    """
    if current_user.role not in (models.UserRole.organizer, models.UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organizers can create events",
        )

    if payload.organizer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create events for another organizer",
        )

    event = models.Event(
        organizer_id=current_user.id,
        organization_id=payload.organization_id,
        title=payload.title,
        description=payload.description,
        location=payload.location,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        capacity=payload.capacity,
        is_public=payload.is_public,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    for tag_str in payload.tags or []:
        tag_str = tag_str.strip()
        if not tag_str:
            continue
        db.add(models.EventTag(event_id=event.id, tag=tag_str))

    if payload.tags:
        db.commit()
        db.refresh(event)

    return event_to_detail(event)


@router.put("/events/{event_id}", response_model=schemas.EventDetail)
def update_event(
    event_id: UUID,
    payload: schemas.EventUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Update an existing event owned by the current organizer.
    PUT /api/organizer/events/{event_id}
    Body: EventUpdate
    """
    if current_user.role not in (models.UserRole.organizer, models.UserRole.admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organizers can edit events",
        )

    event = db.get(models.Event, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Event not found",
        )

    _assert_org_access(event, current_user)

    if getattr(payload, "organizer_id", event.organizer_id) != event.organizer_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot change event organizer",
        )

    update_data = payload.model_dump(
        exclude_unset=True,
        exclude={"tags", "organizer_id", "id"},
    )

    for field, value in update_data.items():
        setattr(event, field, value)

    if payload.tags is not None:
        db.query(models.EventTag).filter(models.EventTag.event_id == event.id).delete()

        for tag_str in payload.tags:
            tag_str = (tag_str or "").strip()
            if not tag_str:
                continue
            db.add(models.EventTag(event_id=event.id, tag=tag_str))

    db.commit()
    db.refresh(event)

    return event_to_detail(event)


#added push
@router.post("/events/{event_id}/send-push")
def send_push_notification_mock(
    event_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    event = db.get(models.Event, event_id)
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    _assert_org_access(event, current_user)

    rsvp_rows = (
        db.query(models.RSVP)
        .filter(
            models.RSVP.event_id == event.id,
            models.RSVP.status.in_(list(YES_STATUSES)),
        )
        .all()
    )

    if not rsvp_rows:
        return {"sent": 0}

    title = f"Reminder: {event.title}"

    starts_str = ""
    try:
        starts_str = event.starts_at.strftime("%b %d, %Y %I:%M %p")
    except Exception:
        starts_str = "soon"

    message = f"{event.title} is coming up {('on ' + starts_str) if starts_str else 'soon'} at {event.location}."

    created = 0

    for rsvp in rsvp_rows:
        notif = models.Notification(
            user_id=rsvp.user_id,
            event_id=event.id,
            kind=models.NotificationKind.reminder,
            title=title,
            message=message,
            is_read=False,
            created_at=datetime.utcnow(),
        )
        db.add(notif)
        created += 1

    db.commit()

    return {"sent": created}
