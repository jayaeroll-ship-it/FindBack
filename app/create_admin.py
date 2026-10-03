from getpass import getpass
from sqlalchemy import select
from .config import Settings
from .db import create_database
from .models import User
from .security import hasher

if __name__ == "__main__":
    from pydantic import TypeAdapter, EmailStr
    email = str(TypeAdapter(EmailStr).validate_python(input("Administrator email: "))).lower()
    password = getpass("New administrator password (12+ characters): ")
    if not 12 <= len(password) <= 128:
        raise SystemExit("Password must contain 12–128 characters")
    _, factory = create_database(Settings().database_url)
    with factory() as db:
        if db.scalar(select(User).where(User.email == email)):
            raise SystemExit("Account already exists; use an existing administrator to change its role")
        db.add(User(email=email, name="Administrator", role="admin", password_hash=hasher.hash(password)))
        db.commit()
    print("Administrator created.")
