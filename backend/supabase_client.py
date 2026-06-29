"""Supabase client factories.

Two clients, two purposes:
  - service_client(): service-role key, BYPASSES RLS. Cron jobs, push fan-out,
    admin tasks only. Never built from request input.
  - user_client(jwt): anon key + the caller's JWT. RLS is enforced — every query
    sees only that user's rows. This is what request handlers use.
"""

from functools import lru_cache

from supabase import Client, create_client

from config import get_settings


@lru_cache
def service_client() -> Client:
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def user_client(access_token: str) -> Client:
    s = get_settings()
    client = create_client(s.supabase_url, s.supabase_anon_key)
    # Scope PostgREST + Storage calls to this user's JWT so RLS filters rows.
    client.postgrest.auth(access_token)
    return client
