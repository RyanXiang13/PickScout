"""
seeder.py — Seeds the database with realistic mock capper/pick data.
Run once after db_init.py so the frontend has data to display immediately.
Usage: python seeder.py
"""

import os
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from db_client import get_supabase

load_dotenv()

MOCK_CAPPERS = [
    {
        "username": "LolPropKing1",
        "platform": "Reddit",
        "display_name": "LolPropKing1",
        "profile_url": "https://reddit.com/u/LolPropKing1",
        "total_wins": 228,
        "total_losses": 175,
        "total_units_won": 105.84,
        "credibility": "verified",
    },
    {
        "username": "wes2211",
        "platform": "Reddit",
        "display_name": "wes2211",
        "profile_url": "https://reddit.com/u/wes2211",
        "total_wins": 41,
        "total_losses": 46,
        "total_units_won": 61.13,
        "credibility": "verified",
    },
    {
        "username": "lordestros",
        "platform": "Reddit",
        "display_name": "lordestros",
        "profile_url": "https://reddit.com/u/lordestros",
        "total_wins": 28,
        "total_losses": 22,
        "total_units_won": 18.40,
        "credibility": "verified",
    },
    {
        "username": "SecuredTys_Free",
        "platform": "Discord",
        "display_name": "SecuredTys (Free Picks)",
        "profile_url": None,
        "total_wins": 0,
        "total_losses": 0,
        "total_units_won": 0.00,
        "credibility": "unverified",
    },
]

MOCK_PICKS = [
    {
        "capper_username": "LolPropKing1",
        "sport": "Esports",
        "matchup": "Alliance vs. Johnny Speeds (CS2)",
        "pick_text": "Alliance Map 2 ML",
        "odds": -145,
        "risk_units": 5.0,
        "status": "pending",
        "game_start_time": datetime.now(timezone.utc) + timedelta(hours=4),
        "source_url": "https://reddit.com/r/sportsbook",
        "raw_post_text": "Record: 228-175. Alliance looking strong today. 5u play.",
    },
    {
        "capper_username": "wes2211",
        "sport": "Olympics",
        "matchup": "Great Britain (W) vs. Canada",
        "pick_text": "Great Britain (W) ML",
        "odds": 140,
        "risk_units": 2.0,
        "status": "pending",
        "game_start_time": datetime.now(timezone.utc) + timedelta(hours=2),
        "source_url": "https://reddit.com/r/sportsbook",
        "raw_post_text": "Record: 41-46 +61.13u. Value on GB here at +140. 2u play.",
    },
    {
        "capper_username": "lordestros",
        "sport": "Hockey",
        "matchup": "Sweden vs. Switzerland (Women's Hockey)",
        "pick_text": "Under 4.5 Goals",
        "odds": -115,
        "risk_units": 1.0,
        "status": "pending",
        "game_start_time": datetime.now(timezone.utc) + timedelta(hours=6),
        "source_url": "https://reddit.com/r/sportsbook",
        "raw_post_text": "Record: 28-22. Both teams play tight defense. Under 4.5 1u.",
    },
    {
        "capper_username": "SecuredTys_Free",
        "sport": "Basketball",
        "matchup": "Lakers vs. Warriors",
        "pick_text": "Lakers -5.5",
        "odds": -110,
        "risk_units": 1.0,
        "status": "pending",
        "game_start_time": datetime.now(timezone.utc) + timedelta(hours=8),
        "source_url": None,
        "raw_post_text": "Free pick from Discord. No track record found.",
    },
]


def seed():
    sb = get_supabase()
    print("🌱 Seeding cappers...")

    capper_id_map = {}

    for capper in MOCK_CAPPERS:
        resp = (
            sb.table("cappers")
            .upsert(capper, on_conflict="username")
            .execute()
        )
        inserted = resp.data[0]
        capper_id_map[capper["username"]] = inserted["id"]
        print(f"  ✅ Capper: {capper['username']} ({capper['credibility']})")

    print("\n🎯 Seeding picks...")
    for pick in MOCK_PICKS:
        username = pick.pop("capper_username")
        pick["capper_id"] = capper_id_map[username]
        pick["game_start_time"] = pick["game_start_time"].isoformat()

        sb.table("picks").insert(pick).execute()
        print(f"  ✅ Pick: {pick['pick_text']} ({pick['sport']})")

    print("\n🎉 Seeding complete!")


if __name__ == "__main__":
    seed()
