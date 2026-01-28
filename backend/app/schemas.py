from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, ConfigDict
from uuid import UUID

from .models import UserRole, RSVPStatus, NotificationKind


# --------------------
# User schemas
# --------------------
class UserBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str
    role: UserRole


class UserCreate(BaseModel):
    email: EmailStr
    display_name: str
    role: UserRole = UserRole.student
    password: Optional[str] = None


#Here we are adding users to be able to work from the backend.
# User settings schemas (

class UserSettingsBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    theme: str = "system"  # "light" | "dark" | "system"
    email_notifications: bool = True
    push_notifications: bool = False


class UserSettingsUpdate(BaseModel):
    theme: Optional[str] = None
    email_notifications: Optional[bool] = None
    push_notifications: Optional[bool] = None


class UserWithSettings(UserBase):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_data: Optional[str] = None
    settings: Optional[UserSettingsBase] = None


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    avatar_data: Optional[str] = None



# --------------------
# Event schemas
# --------------------
class EventBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organizer_id: UUID
    title: str
    description: str
    location: str
    starts_at: datetime
    ends_at: datetime
    capacity: Optional[int] = None
    is_public: bool = True
    organization_id: Optional[UUID] = None
    tags: List[str] = []


class EventCreate(BaseModel):
    organizer_id: UUID
    title: str
    description: str
    location: str
    starts_at: datetime
    ends_at: datetime
    capacity: Optional[int] = None
    is_public: bool = True
    organization_id: Optional[UUID] = None
    tags: List[str] = []


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    starts_at: Optional[datetime] = None
    ends_at: Optional[datetime] = None
    capacity: Optional[int] = None
    is_public: Optional[bool] = None
    organization_id: Optional[UUID] = None
    tags: Optional[List[str]] = None


class EventListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    location: str
    starts_at: datetime
    ends_at: datetime
    tags: List[str] = []



class EventDetail(EventBase):
    pass


# --------------------
# RSVP schemas
# --------------------
class RSVPBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    event_id: UUID
    status: RSVPStatus
    created_at: datetime


class RSVPCreate(BaseModel):
    event_id: UUID
    status: RSVPStatus = RSVPStatus.rsvped



class RSVPUpdate(BaseModel):
    status: RSVPStatus


# Notification schemas
class NotificationBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    event_id: Optional[UUID] = None
    kind: NotificationKind
    title: str
    message: str
    is_read: bool
    created_at: datetime
    read_at: Optional[datetime] = None


class NotificationCreate(BaseModel):
    user_id: UUID
    event_id: Optional[UUID] = None
    kind: NotificationKind = NotificationKind.reminder
    title: str
    message: str



class NotificationUpdate(BaseModel):
    is_read: Optional[bool] = None
    read_at: Optional[datetime] = None

    

class ChangePassword(BaseModel):
    current_password: str
    new_password: str

