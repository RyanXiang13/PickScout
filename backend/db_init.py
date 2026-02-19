"""
db_init.py — Run once to create all Supabase tables.
Usage: python db_init.py
"""

import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL")


def initialize_database():
    print("🔌 Connecting to Supabase (Session pooler)...")
    conn = None
    try:
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()

        create_tables_sql = """
        -- ─── USERS ────────────────────────────────────────────────
        -- Casual bettors who use the dashboard
        CREATE TABLE IF NOT EXISTS users (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email           TEXT UNIQUE,
            bankroll        DECIMAL(12, 2) DEFAULT 0.00,
            unit_size       DECIMAL(10, 2) DEFAULT 5.00,
            risk_tolerance  VARCHAR(20)
                            CHECK (risk_tolerance IN ('conservative','moderate','aggressive'))
                            DEFAULT 'moderate',
            created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- ─── CAPPERS ──────────────────────────────────────────────
        -- The pick-makers found on Reddit / Discord
        CREATE TABLE IF NOT EXISTS cappers (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            username        VARCHAR(255) UNIQUE NOT NULL,
            platform        VARCHAR(50)  NOT NULL,   -- 'Reddit' | 'Discord'
            display_name    VARCHAR(255),
            profile_url     TEXT,
            total_wins      INTEGER      DEFAULT 0,
            total_losses    INTEGER      DEFAULT 0,
            total_units_won DECIMAL(10, 2) DEFAULT 0.00,
            credibility     VARCHAR(20)
                            CHECK (credibility IN ('verified','unverified','suspicious'))
                            DEFAULT 'unverified',
            last_active     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- ─── PICKS ────────────────────────────────────────────────
        -- Immutable ledger — rows are never deleted
        CREATE TABLE IF NOT EXISTS picks (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            capper_id       UUID REFERENCES cappers(id) ON DELETE CASCADE,
            sport           VARCHAR(100),
            matchup         VARCHAR(255),
            pick_text       VARCHAR(255) NOT NULL,
            odds            INTEGER      NOT NULL,   -- American odds, e.g. -110
            risk_units      DECIMAL(5, 2) DEFAULT 1.00,
            status          VARCHAR(20)
                            CHECK (status IN ('pending','won','lost','pushed'))
                            DEFAULT 'pending',
            game_start_time TIMESTAMP WITH TIME ZONE,
            source_url      TEXT,
            raw_post_text   TEXT,
            created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- ─── INDEXES ──────────────────────────────────────────────
        CREATE INDEX IF NOT EXISTS idx_picks_capper_id ON picks(capper_id);
        CREATE INDEX IF NOT EXISTS idx_picks_status    ON picks(status);
        CREATE INDEX IF NOT EXISTS idx_picks_created   ON picks(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_cappers_units   ON cappers(total_units_won DESC);
        """

        print("⚙️  Executing schema...")
        cursor.execute(create_tables_sql)
        conn.commit()
        print("✅ All tables created successfully!")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise
    finally:
        if conn:
            cursor.close()
            conn.close()
            print("🔒 Connection closed.")


if __name__ == "__main__":
    initialize_database()
