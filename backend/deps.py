"""FastAPI dependencies: authenticate the request and hand back a user-scoped DB client."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from supabase import Client

from supabase_client import user_client


@dataclass
class CurrentUser:
    id: UUID
    token: str
    db: Client  # RLS-scoped to this user


async def _access_token(authorization: str | None = Header(default=None)) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1].strip()


async def get_current_user(token: str = Depends(_access_token)) -> CurrentUser:
    """Validate the Supabase JWT and return the user + an RLS-scoped client.

    The client is bound to the caller's token, so all queries are filtered to
    their own rows by the RLS policies in 0001_initial_schema.sql.
    """
    db = user_client(token)
    res = db.auth.get_user(token)  # verifies the JWT against Supabase Auth
    if res is None or res.user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        )
    return CurrentUser(id=UUID(res.user.id), token=token, db=db)
