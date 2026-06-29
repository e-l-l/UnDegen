"""Undegen API.

Local-first app: the frontend reads from Dexie, not this API. This backend is the
cloud mirror + sync target + push-notification trigger. Every data route is scoped
to the caller's JWT, so Supabase RLS filters rows to that user.
"""

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from deps import CurrentUser, get_current_user
from models import Activity, ActivityBase

settings = get_settings()

app = FastAPI(title="Undegen API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/activities", response_model=list[Activity])
def list_activities(user: CurrentUser = Depends(get_current_user)) -> list[Activity]:
    """All of the caller's activities. RLS guarantees only their rows return."""
    res = user.db.table("activities").select("*").order("position").execute()
    return [Activity(**row) for row in res.data]


@app.post("/activities", response_model=Activity, status_code=201)
def create_activity(
    body: ActivityBase, user: CurrentUser = Depends(get_current_user)
) -> Activity:
    """Create an activity. user_id comes from the JWT, never the request body."""
    payload = body.model_dump(mode="json", exclude_none=True)
    payload["user_id"] = str(user.id)
    res = user.db.table("activities").insert(payload).execute()
    return Activity(**res.data[0])
