from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from .. import models, schemas

router = APIRouter()

@router.get("/", response_model=List[schemas.EventListItem])
def list_events(
    q: Optional[str] = Query(None),
    tag: Optional[str] = Query(None),
    sort: str = Query("relevance"),
    db: Session = Depends(get_db),
):
    query = db.query(models.Event)

    if q:
        ilike = f"%{q.lower()}%"
        query = query.filter(
            models.Event.title.ilike(ilike) | models.Event.location.ilike(ilike)
        )

    # TODO: join tags table when we wire tags in models
    if sort == "title":
        query = query.order_by(models.Event.title.asc())
    else:
        query = query.order_by(models.Event.starts_at.asc())

    events = query.limit(100).all()

    # For now, return empty tags list; we’ll join tags later
    return [
        schemas.EventListItem(
            id=str(e.id),
            title=e.title,
            location=e.location,
            starts_at=e.starts_at,
            ends_at=e.ends_at,
            tags=[],
        )
        for e in events
    ]


@router.get("/{event_id}", response_model=schemas.EventBase)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).get(event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
