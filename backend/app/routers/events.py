from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(tags=["events"])


@router.get("/", response_model=List[schemas.EventListItem])
def list_events(db: Session = Depends(get_db)):
    events = (
        db.query(models.Event)
        .filter(models.Event.is_public == True)
        .order_by(models.Event.starts_at)
        .all()
    )

    return [
        schemas.EventListItem(
            id=str(event.id),
            title=event.title,
            location=event.location,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            tags=[t.tag for t in event.tags] if event.tags else [],
        )
        for event in events
    ]


@router.get("/{event_id}", response_model=schemas.EventDetail)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return schemas.EventDetail(
        id=str(event.id),
        organizer_id=str(event.organizer_id),
        title=event.title,
        description=event.description,
        location=event.location,
        starts_at=event.starts_at,
        ends_at=event.ends_at,
        is_public=event.is_public,
        tags=[t.tag for t in event.tags] if event.tags else [],
    )
