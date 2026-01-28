from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from . import models  # noqa: F401
from .routers import auth, events, organizer, rsvps, notifications, users


Base.metadata.create_all(bind=engine)

app = FastAPI(title="Unify")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


# register routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(organizer.router, prefix="/api/organizer", tags=["organizer"])
app.include_router(rsvps.router, prefix="/api", tags=["rsvps"])
app.include_router(notifications.router, prefix="/api", tags=["notifications"])
app.include_router(users.router, prefix="/api/users", tags=["users"])
