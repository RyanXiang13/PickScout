"""
scraper.py — Fetches today's POTD posts from Reddit via public JSON feeds.
No API key required — uses Reddit's public .json endpoints.
Usage: python scraper.py
"""

import re
import httpx
from datetime import datetime, timezone
from db_client import get_supabase

HEADERS = {"User-Agent": "PickScout/1.0 (sports picks aggregator)"}

SUBREDDITS = ["sportsbook", "sportsbetting", "sportspicks"]

SEARCH_QUERIES = ["POTD", "Pick of the Day", "daily pick"]

# Regex patterns for extracting data from post titles/bodies
RECORD_PATTERN = re.compile(
    r"(?:record|rec)[\s:]*(\d+)\s*[-–]\s*(\d+)", re.IGNORECASE
)
UNITS_PATTERN = re.compile(
    r"([+-]?\d+\.?\d*)\s*u(?:nits?)?", re.IGNORECASE
)
ODDS_PATTERN = re.compile(r"([+-]\d{2,4})")

SPORT_KEYWORDS = {
    "Basketball": ["nba", "basketball", "lakers", "celtics", "bulls", "warriors"],
    "Football": ["nfl", "football", "chiefs", "patriots", "cowboys"],
    "Hockey": ["nhl", "hockey", "leafs", "bruins", "rangers", "puck"],
    "Baseball": ["mlb", "baseball", "yankees", "dodgers", "mets"],
    "Soccer": ["mls", "soccer", "premier", "la liga", "champions league"],
    "Esports": ["esports", "cs2", "lol", "valorant", "dota", "overwatch"],
    "Olympics": ["olympics", "olympic", "curling", "biathlon", "skating"],
    "Tennis": ["tennis", "atp", "wta", "wimbledon", "us open"],
    "MMA/UFC": ["ufc", "mma", "bellator", "fighter"],
}


def detect_sport(text: str) -> str:
    text_lower = text.lower()
    for sport, keywords in SPORT_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return sport
    return "Other"


def parse_credibility(text: str) -> str:
    """Determine credibility based on presence of a verifiable record."""
    if RECORD_PATTERN.search(text):
        return "verified"
    hype_words = ["lock", "guaranteed", "can't miss", "whale", "free money", "99%"]
    if any(w in text.lower() for w in hype_words):
        return "suspicious"
    return "unverified"


def parse_post(post_data: dict) -> dict | None:
    """Parse a Reddit post into a structured pick dict. Returns None if not a valid pick."""
    title = post_data.get("title", "")
    body = post_data.get("selftext", "")
    author = post_data.get("author", "")
    url = f"https://reddit.com{post_data.get('permalink', '')}"
    full_text = f"{title}\n{body}"

    # Must have at least odds to be considered a pick
    odds_match = ODDS_PATTERN.search(full_text)
    if not odds_match:
        return None

    try:
        odds = int(odds_match.group(1))
    except ValueError:
        return None

    # Parse record
    record_match = RECORD_PATTERN.search(full_text)
    wins = int(record_match.group(1)) if record_match else 0
    losses = int(record_match.group(2)) if record_match else 0

    # Parse units
    units_match = UNITS_PATTERN.search(full_text)
    risk_units = float(units_match.group(1)) if units_match else 1.0
    risk_units = abs(risk_units)  # Ensure positive

    # Parse total units won (look for explicit +/-Xu in body)
    units_history_match = re.search(r"([+-]\d+\.?\d*)\s*u(?:nits?)?", body, re.IGNORECASE)
    total_units = float(units_history_match.group(1)) if units_history_match else 0.0

    sport = detect_sport(full_text)
    credibility = parse_credibility(full_text)

    # Try to extract a clean pick text from the title
    pick_text = title[:200] if title else "Unknown Pick"

    return {
        "author": author,
        "pick_text": pick_text,
        "odds": odds,
        "risk_units": min(risk_units, 10.0),  # Cap at 10u
        "sport": sport,
        "matchup": "",
        "wins": wins,
        "losses": losses,
        "total_units": total_units,
        "credibility": credibility,
        "source_url": url,
        "raw_post_text": full_text[:2000],
    }


def fetch_reddit_posts(subreddit: str, query: str, limit: int = 10) -> list[dict]:
    """Fetch posts from a subreddit using Reddit's public JSON API."""
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {
        "q": query,
        "sort": "new",
        "limit": limit,
        "restrict_sr": "true",
        "t": "day",
    }
    try:
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=10.0)
        resp.raise_for_status()
        children = resp.json()["data"]["children"]
        return [c["data"] for c in children]
    except Exception as e:
        print(f"  ⚠️  Failed to fetch r/{subreddit} ({query}): {e}")
        return []


def upsert_capper(sb, author: str, parsed: dict) -> str | None:
    """Upsert a capper record, return their UUID."""
    capper_data = {
        "username": author,
        "platform": "Reddit",
        "display_name": author,
        "profile_url": f"https://reddit.com/u/{author}",
        "total_wins": parsed["wins"],
        "total_losses": parsed["losses"],
        "total_units_won": parsed["total_units"],
        "credibility": parsed["credibility"],
        "last_active": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = sb.table("cappers").upsert(capper_data, on_conflict="username").execute()
        return resp.data[0]["id"]
    except Exception as e:
        print(f"  ⚠️  Could not upsert capper {author}: {e}")
        return None


def insert_pick(sb, capper_id: str, parsed: dict):
    """Insert a pick into the immutable picks ledger."""
    pick_data = {
        "capper_id": capper_id,
        "sport": parsed["sport"],
        "matchup": parsed["matchup"],
        "pick_text": parsed["pick_text"],
        "odds": parsed["odds"],
        "risk_units": parsed["risk_units"],
        "status": "pending",
        "source_url": parsed["source_url"],
        "raw_post_text": parsed["raw_post_text"],
    }
    try:
        sb.table("picks").insert(pick_data).execute()
    except Exception as e:
        print(f"  ⚠️  Could not insert pick: {e}")


def run_scraper():
    sb = get_supabase()
    print("🔍 PickScout Scraper starting...\n")

    scraped_authors = set()
    picks_added = 0

    for subreddit in SUBREDDITS:
        for query in SEARCH_QUERIES:
            posts = fetch_reddit_posts(subreddit, query)
            for post in posts:
                author = post.get("author", "")
                if not author or author in scraped_authors or author == "[deleted]":
                    continue

                parsed = parse_post(post)
                if not parsed:
                    continue

                scraped_authors.add(author)
                capper_id = upsert_capper(sb, author, parsed)
                if capper_id:
                    insert_pick(sb, capper_id, parsed)
                    picks_added += 1
                    cred = parsed["credibility"]
                    emoji = "🟢" if cred == "verified" else "🟡" if cred == "unverified" else "🔴"
                    print(f"  {emoji} [{cred}] {author}: {parsed['pick_text'][:60]}")

    print(f"\n✅ Scraper done. {picks_added} picks added.")


if __name__ == "__main__":
    run_scraper()
