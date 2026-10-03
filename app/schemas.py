from datetime import date
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

CATEGORIES = ("Electronics", "Bags", "Keys", "Jewelry", "Clothing", "Documents", "Other")


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12, max_length=128)
    bot_token: str = Field(default="", max_length=2048)


class Registration(Credentials):
    name: str = Field(min_length=2, max_length=80)
    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class Forgot(BaseModel):
    email: EmailStr
    bot_token: str = Field(default="", max_length=2048)


class Reset(BaseModel):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=12, max_length=128)


class Account(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    @field_validator("name", mode="before")
    @classmethod
    def clean_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class PasswordChange(BaseModel):
    current_password: str = Field(max_length=128)
    password: str = Field(min_length=12, max_length=128)


class AccountDeletion(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)


class ReportInput(BaseModel):
    kind: Literal["lost", "found"]
    title: str = Field(min_length=4, max_length=120)
    description: str = Field(min_length=20, max_length=3000)
    category: str
    color: str = Field(default="", max_length=40)
    brand: str = Field(default="", max_length=80)
    area: str = Field(min_length=3, max_length=120)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    event_date: date
    bot_token: str = Field(default="", max_length=2048)

    @field_validator("title", "description", "area", "color", "brand", mode="before")
    @classmethod
    def clean_text(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("category")
    @classmethod
    def category_known(cls, v):
        if v not in CATEGORIES:
            raise ValueError("Choose a supported category")
        return v

    @field_validator("event_date")
    @classmethod
    def valid_date(cls, v):
        if v > date.today() or v < date(2000, 1, 1):
            raise ValueError("Date must be between 2000 and today")
        return v

    @model_validator(mode="after")
    def coordinates_paired(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Provide both coordinates or neither")
        for name in ("title", "description", "area"):
            if not getattr(self, name).strip():
                raise ValueError(f"{name} cannot be blank")
        return self


class ClaimInput(BaseModel):
    evidence: str = Field(min_length=30, max_length=5000)
    bot_token: str = Field(default="", max_length=2048)
    @field_validator("evidence", mode="before")
    @classmethod
    def clean_evidence(cls, v):
        return v.strip() if isinstance(v, str) else v


class Decision(BaseModel):
    status: Literal["accepted", "rejected"]
    note: str = Field(min_length=5, max_length=1000)
    @field_validator("note", mode="before")
    @classmethod
    def clean_note(cls, v):
        return v.strip() if isinstance(v, str) else v


class MessageInput(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    @field_validator("body")
    @classmethod
    def not_blank(cls, v):
        if not v.strip():
            raise ValueError("Message cannot be empty")
        return v.strip()


class Review(BaseModel):
    status: Literal["published", "hidden"]


class RoleChange(BaseModel):
    role: Literal["user", "moderator", "admin"]
    disabled: bool = False

