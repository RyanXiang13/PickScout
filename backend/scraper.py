"""
scraper.py — Fetches sports pick posts from Reddit via public JSON feeds.
No API key required — uses Reddit's public .json endpoints.

For each post found, if no record is detected in title/body, we fetch the
post's comment thread and look for the OP's own comments that may contain
their record (very common on Reddit).

Usage: python scraper.py
"""

import re
import os
import time
import httpx
from datetime import datetime, timezone
from db_client import get_supabase

# Optional: Gemini Vision for bet slip images
try:
    import google.generativeai as genai
    _GEMINI_KEY = os.getenv("GEMINI_API_KEY", "")
    if _GEMINI_KEY:
        genai.configure(api_key=_GEMINI_KEY)
        _VISION_MODEL = genai.GenerativeModel("gemini-1.5-flash")
        print("✨ Gemini Vision enabled — will read bet slip images")
    else:
        _VISION_MODEL = None
except ImportError:
    _VISION_MODEL = None

HEADERS = {"User-Agent": "PickScout/1.0 (sports picks aggregator)"}

SUBREDDITS = [
    # General betting
    "sportsbook",
    "sportsbetting",
    # Pick-focused
    "PickOfTheDay",
    "SportsPicksHub",
    # Sport-specific
    "nba",
    "nfl",
    "nhl",
    "baseball",
    "soccer",
    # Prop bets & parlays
    "PrizePicks",
    "parlays",
]

SEARCH_QUERIES = [
    "POTD",
    "Pick of the Day",
    "daily pick",
    "free pick",
    "record",
    "units",
]

# ---------------------------------------------------------------------------
# Regex patterns
# ---------------------------------------------------------------------------

# Exhaustive record pattern — catches every real-world format seen on Reddit:
#   (50-25)  [50-25]  50W-25L  50W/25L  50-25  Record: 50-25
#   went 50-25  going 50-25  50 and 25  50/25  50-25-3 (with push)
#   "last X picks" style is intentionally excluded (too noisy)
RECORD_PATTERN = re.compile(
    r"""
    (?:
        # (50-25) or (50–25)
        \((\d{1,4})\s*[-–/]\s*(\d{1,4})(?:\s*[-–/]\s*\d{1,3})?\)
        |
        # [50-25]
        \[(\d{1,4})\s*[-–/]\s*(\d{1,4})(?:\s*[-–/]\s*\d{1,3})?\]
        |
        # 50W-25L  or  50W/25L
        (\d{1,4})\s*W\s*[-–/]\s*(\d{1,4})\s*L
        |
        # went/going/sitting/currently X-Y
        (?:went|going|sitting|currently|finished|record\s+is|i(?:'m|\sam)\s+)?
        (?:record|rec|season|ytd|overall|this\s+(?:week|month|season))\s*:?\s*
        (\d{1,4})\s*[-–]\s*(\d{1,4})
        |
        # bare "50 and 25"  (only match if both numbers present)
        \b(\d{1,4})\s+and\s+(\d{1,4})\s+(?:on\s+the\s+)?(?:season|week|month|year|picks?)
        |
        # "went 50-25" / "going 8-0" — verb signals it's a record
        (?:went|going|finished|sitting|currently\s+at)\s+(\d{1,4})\s*[-–]\s*(\d{1,4})
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)

UNITS_PATTERN = re.compile(
    r"([+-]?(?:\d+\.)?\d+)\s*u(?:nits?)?", re.IGNORECASE
)
ODDS_PATTERN = re.compile(r"([+-]\d{2,4})")

HYPE_WORDS = ["lock", "guaranteed", "can't miss", "whale", "free money", "99%", "easy money", "can't lose"]

# A post must contain at least ONE of these to be considered a sports pick.
# This filters out sports articles, news posts, discussion threads, etc.
BETTING_KEYWORDS = [
    "bet", "pick", "potd", "tail", "parlay", "moneyline", "ml ", " ml",
    "spread", "cover", "over/under", "o/u", "over ", "under ",
    "units", " unit", "+ev", "sharp", "fade", "lock",
    "fanduel", "draftkings", "prizepicks", "betmgm", "caesars", "stake",
    "wager", "puck line", "run line", "ats", "prop", "same game",
]

SPORT_KEYWORDS = {
    "Basketball": ["nba", "basketball", "lakers", "celtics", "bulls", "warriors", "bucks", "nets"],
    "Football":   ["nfl", "football", "chiefs", "patriots", "cowboys", "eagles", "49ers"],
    "Hockey":     ["nhl", "hockey", "leafs", "bruins", "rangers", "puck", "oilers"],
    "Baseball":   ["mlb", "baseball", "yankees", "dodgers", "mets", "astros"],
    "Soccer":     ["mls", "soccer", "premier", "la liga", "champions league", "bundesliga", "serie a"],
    "Esports":    ["esports", "cs2", "lol", "valorant", "dota", "overwatch", "csgo"],
    "Olympics":   ["olympics", "olympic", "curling", "biathlon", "skating", "alpine"],
    "Tennis":     ["tennis", "atp", "wta", "wimbledon", "us open", "french open"],
    "MMA/UFC":    ["ufc", "mma", "bellator", "fighter", "knockout", "submission"],
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def detect_sport(text: str) -> str:
    text_lower = text.lower()
    for sport, keywords in SPORT_KEYWORDS.items():
        if any(kw in text_lower for kw in keywords):
            return sport
    return "Other"


def extract_record(text: str) -> tuple[int, int] | None:
    """Return (wins, losses) if a record is found in text, else None."""
    m = RECORD_PATTERN.search(text)
    if not m:
        return None
    groups = [g for g in m.groups() if g is not None]
    if len(groups) < 2:
        return None
    try:
        return int(groups[0]), int(groups[1])
    except ValueError:
        return None


def parse_credibility(text: str, has_record: bool) -> str:
    if has_record:
        return "verified"
    if any(w in text.lower() for w in HYPE_WORDS):
        return "suspicious"
    return "unverified"


def _get_with_retry(url: str, params: dict = None, max_retries: int = 3) -> httpx.Response:
    """GET with exponential backoff on 429 rate-limit responses."""
    delay = 2
    for attempt in range(max_retries):
        resp = httpx.get(url, params=params, headers=HEADERS, timeout=12.0)
        if resp.status_code == 429:
            print(f"  ⏳ Rate limited — waiting {delay}s before retry...")
            time.sleep(delay)
            delay *= 2
            continue
        return resp
    return resp  # Return last response even if still 429


def fetch_op_comments(permalink: str, author: str) -> str:
    """
    Fetch the comment thread for a post and return the concatenated text
    of all TOP-LEVEL comments made by the OP. Falls back to "" on error.
    Reddit comment JSON: GET /r/sub/comments/{id}.json
    """
    url = f"https://www.reddit.com{permalink}.json"
    try:
        time.sleep(0.8)  # Polite delay before each comment fetch
        resp = _get_with_retry(url, params={"limit": 50, "depth": 1})
        resp.raise_for_status()
        data = resp.json()
        # data[1] is the comments listing
        comments = data[1]["data"]["children"]
        op_texts = []
        for c in comments:
            cd = c.get("data", {})
            if cd.get("author", "").lower() == author.lower():
                body = cd.get("body", "")
                if body and body != "[deleted]":
                    op_texts.append(body)
        return "\n".join(op_texts)
    except Exception:
        return ""


def analyze_image_post(image_url: str) -> str:
    """
    Send a Reddit bet-slip image to Gemini Vision and return structured text
    describing the pick (team, bet type, odds, stake). Returns "" if Vision
    is not configured or the image can't be read.
    """
    if not _VISION_MODEL or not image_url:
        return ""
    try:
        img_bytes = httpx.get(image_url, timeout=10.0).content
        import PIL.Image, io
        img = PIL.Image.open(io.BytesIO(img_bytes))
        prompt = (
            "This is a sports bet slip screenshot. "
            "Extract and return ONLY: the team or player being bet on, "
            "the bet type (moneyline/spread/over-under/prop), "
            "the American odds (e.g. -110 or +150), "
            "and the stake/risk amount if visible. "
            "Format: TEAM | BET_TYPE | ODDS | STAKE. "
            "If you cannot read the slip clearly, return UNREADABLE."
        )
        response = _VISION_MODEL.generate_content([prompt, img])
        text = response.text.strip()
        if "UNREADABLE" in text.upper():
            return ""
        return text
    except Exception as e:
        return ""

# ---------------------------------------------------------------------------
# Core parser
# ---------------------------------------------------------------------------

def parse_post(post_data: dict) -> dict | None:
    """Parse a Reddit post into a structured pick dict. Returns None if not a valid pick."""
    title     = post_data.get("title", "")
    body      = post_data.get("selftext", "")
    author    = post_data.get("author", "")
    permalink = post_data.get("permalink", "")
    url       = f"https://reddit.com{permalink}"
    post_hint = post_data.get("post_hint", "")
    image_url = post_data.get("url", "") if post_hint == "image" else ""

    full_text = f"{title}\n{body}"
    text_lower = full_text.lower()

    # ── Gate 1: Must contain at least one betting keyword ──────────────────
    # This is the primary filter that kills sports articles, news, etc.
    if not any(kw in text_lower for kw in BETTING_KEYWORDS):
        # Also accept if it's an image post — could be a bet slip
        if not image_url:
            return None

    # ── Image posts: try Gemini Vision to read the bet slip ───────────────
    vision_text = ""
    if image_url:
        vision_text = analyze_image_post(image_url)
        if vision_text:
            print(f"  👁️  Vision extracted: {vision_text[:80]}")
            full_text = f"{full_text}\n{vision_text}"
            text_lower = full_text.lower()

    # ── Gate 2: Must have American odds ───────────────────────────────────
    odds_match = ODDS_PATTERN.search(full_text)
    if not odds_match:
        return None
    try:
        odds = int(odds_match.group(1))
    except ValueError:
        return None

    # Sanity-check odds range — real American odds are -5000 to +10000
    # but very extreme values are usually stats/scores, not odds
    if not (-2500 <= odds <= 5000):
        return None

    # Try to find record in title + body first
    record = extract_record(full_text)

    # If not found, fetch OP's own comments and check there
    op_comment_text = ""
    if record is None and permalink:
        op_comment_text = fetch_op_comments(permalink, author)
        if op_comment_text:
            record = extract_record(op_comment_text)

    wins, losses = record if record else (0, 0)

    # Build complete context for sport / credibility detection
    all_text = f"{full_text}\n{op_comment_text}"

    # Parse units risk
    units_match = UNITS_PATTERN.search(all_text)
    risk_units = abs(float(units_match.group(1))) if units_match else 1.0
    risk_units = min(risk_units, 10.0)

    # Parse cumulative units won/lost from post (e.g. "+25.5u on the season")
    units_history = re.search(r"([+-]\d+\.?\d*)\s*u(?:nits?)?", body, re.IGNORECASE)
    total_units = float(units_history.group(1)) if units_history else 0.0

    sport       = detect_sport(all_text)
    credibility = parse_credibility(all_text, has_record=(record is not None))
    pick_text   = title[:200] if title else "Unknown Pick"

    return {
        "author":        author,
        "pick_text":     pick_text,
        "odds":          odds,
        "risk_units":    risk_units,
        "sport":         sport,
        "matchup":       "",
        "wins":          wins,
        "losses":        losses,
        "total_units":   total_units,
        "credibility":   credibility,
        "source_url":    url,
        "raw_post_text": all_text[:2000],
    }


# ---------------------------------------------------------------------------
# Reddit fetch
# ---------------------------------------------------------------------------

def fetch_reddit_posts(subreddit: str, query: str, limit: int = 25) -> list[dict]:
    """Fetch posts from a subreddit using Reddit's public JSON API."""
    url = f"https://www.reddit.com/r/{subreddit}/search.json"
    params = {
        "q":           query,
        "sort":        "new",
        "limit":       limit,
        "restrict_sr": "true",
        "t":           "week",
    }
    try:
        resp = _get_with_retry(url, params=params)
        resp.raise_for_status()
        children = resp.json()["data"]["children"]
        return [c["data"] for c in children]
    except Exception as e:
        print(f"  ⚠️  Failed to fetch r/{subreddit} ({query}): {e}")
        return []


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def upsert_capper(sb, author: str, parsed: dict) -> str | None:
    capper_data = {
        "username":        author,
        "platform":        "Reddit",
        "display_name":    author,
        "profile_url":     f"https://reddit.com/u/{author}",
        "total_wins":      parsed["wins"],
        "total_losses":    parsed["losses"],
        "total_units_won": parsed["total_units"],
        "credibility":     parsed["credibility"],
        "last_active":     datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = sb.table("cappers").upsert(capper_data, on_conflict="username").execute()
        return resp.data[0]["id"]
    except Exception as e:
        print(f"  ⚠️  Could not upsert capper {author}: {e}")
        return None


def insert_pick(sb, capper_id: str, parsed: dict):
    pick_data = {
        "capper_id":    capper_id,
        "sport":        parsed["sport"],
        "matchup":      parsed["matchup"],
        "pick_text":    parsed["pick_text"],
        "odds":         parsed["odds"],
        "risk_units":   parsed["risk_units"],
        "status":       "pending",
        "source_url":   parsed["source_url"],
        "raw_post_text": parsed["raw_post_text"],
    }
    try:
        sb.table("picks").insert(pick_data).execute()
    except Exception as e:
        print(f"  ⚠️  Could not insert pick: {e}")


# ---------------------------------------------------------------------------
# Main runner
# ---------------------------------------------------------------------------

def run_scraper():
    sb = get_supabase()
    print("🔍 PickScout Scraper starting...\n")

    seen_urls  = set()   # Deduplicate by permalink
    picks_added = 0

    for subreddit in SUBREDDITS:
        for query in SEARCH_QUERIES:
            posts = fetch_reddit_posts(subreddit, query)
            for post in posts:
                author    = post.get("author", "")
                permalink = post.get("permalink", "")
                url       = f"https://reddit.com{permalink}"

                if not author or author == "[deleted]" or url in seen_urls:
                    continue

                parsed = parse_post(post)
                if not parsed:
                    continue

                seen_urls.add(url)
                capper_id = upsert_capper(sb, author, parsed)
                if capper_id:
                    insert_pick(sb, capper_id, parsed)
                    picks_added += 1
                    cred  = parsed["credibility"]
                    record_str = f" ({parsed['wins']}-{parsed['losses']})" if parsed["wins"] or parsed["losses"] else ""
                    emoji = "🟢" if cred == "verified" else "🟡" if cred == "unverified" else "🔴"
                    print(f"  {emoji} [{cred}]{record_str} {author}: {parsed['pick_text'][:55]}")

    print(f"\n✅ Scraper done. {picks_added} picks added.")


if __name__ == "__main__":
    run_scraper()
