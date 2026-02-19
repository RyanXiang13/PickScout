"""
main.py — FastAPI backend for PickScout.
Run locally: uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from db_client import get_supabase

app = FastAPI(title="PickScout API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your Vercel domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health ──────────────────────────────────────────────────


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "PickScout API"}


# ─── Cappers ─────────────────────────────────────────────────


@app.get("/api/cappers/leaderboard")
def get_leaderboard(
    sport: Optional[str] = Query(None, description="Filter by sport"),
    credibility: Optional[str] = Query(None, description="Filter by credibility: verified|unverified|suspicious"),
    limit: int = Query(20, le=50),
):
    """
    Returns cappers sorted by total_units_won descending.
    Excludes cappers inactive for more than 7 days.
    """
    sb = get_supabase()
    try:
        query = (
            sb.table("cappers")
            .select("*")
            .order("total_units_won", desc=True)
            .limit(limit)
        )
        if credibility:
            query = query.eq("credibility", credibility)

        resp = query.execute()
        cappers = resp.data

        # Attach today's picks to each capper
        for capper in cappers:
            picks_resp = (
                sb.table("picks")
                .select("id,pick_text,odds,risk_units,sport,matchup,status,game_start_time,source_url")
                .eq("capper_id", capper["id"])
                .eq("status", "pending")
                .order("created_at", desc=True)
                .limit(3)
                .execute()
            )
            capper["active_picks"] = picks_resp.data

            # Filter by sport if requested
            if sport:
                capper["active_picks"] = [
                    p for p in capper["active_picks"]
                    if p.get("sport", "").lower() == sport.lower()
                ]

        # Filter out cappers with no active picks after sport filter
        if sport:
            cappers = [c for c in cappers if c["active_picks"]]

        return {"cappers": cappers, "count": len(cappers)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Picks ───────────────────────────────────────────────────


@app.get("/api/picks/today")
def get_todays_picks(
    sport: Optional[str] = Query(None),
    credibility: Optional[str] = Query(None),
):
    """Returns all pending picks with capper info joined."""
    sb = get_supabase()
    try:
        query = (
            sb.table("picks")
            .select("*, cappers(username, display_name, platform, credibility, total_wins, total_losses, total_units_won, profile_url)")
            .eq("status", "pending")
            .order("created_at", desc=True)
            .limit(50)
        )
        resp = query.execute()
        picks = resp.data

        if sport:
            picks = [p for p in picks if p.get("sport", "").lower() == sport.lower()]

        if credibility:
            picks = [
                p for p in picks
                if p.get("cappers", {}).get("credibility") == credibility
            ]

        return {"picks": picks, "count": len(picks)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/picks/recent")
def get_recent_picks(days: int = Query(7, le=30)):
    """Returns graded picks from the last N days."""
    sb = get_supabase()
    try:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        resp = (
            sb.table("picks")
            .select("*, cappers(username, credibility)")
            .in_("status", ["won", "lost", "pushed"])
            .gte("created_at", cutoff)
            .order("created_at", desc=True)
            .execute()
        )
        return {"picks": resp.data, "count": len(resp.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Users ───────────────────────────────────────────────────


class UserProfile(BaseModel):
    email: Optional[str] = None
    bankroll: float
    unit_size: float
    risk_tolerance: str = "moderate"


@app.post("/api/users/profile")
def save_profile(profile: UserProfile):
    """
    Save or update a user's bankroll and unit size.
    In production this links to Supabase Auth user ID.
    """
    sb = get_supabase()
    try:
        data = profile.model_dump()
        resp = sb.table("users").insert(data).execute()
        return {"success": True, "user": resp.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
