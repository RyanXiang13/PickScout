"use client";

import { useState, useEffect, useCallback } from "react";
import { Capper, fetchLeaderboard } from "@/lib/api";
import CapperCard from "@/components/CapperCard";

const SPORTS = ["All", "Basketball", "Football", "Hockey", "Baseball", "Soccer", "Esports", "Olympics", "Tennis", "MMA/UFC"];
const CREDIBILITY_FILTERS = [
    { key: "", label: "All Cappers" },
    { key: "verified", label: "✓ Verified" },
    { key: "unverified", label: "? Unverified" },
    { key: "suspicious", label: "⚠ High Risk" },
];

interface Profile {
    bankroll: number;
    unit_size: number;
    risk_tolerance: string;
}

export default function DashboardPage() {
    const [cappers, setCappers] = useState<Capper[]>([]);
    const [loading, setLoading] = useState(true);
    const [sport, setSport] = useState("All");
    const [credFilter, setCredFilter] = useState("");
    const [unitSize, setUnitSize] = useState(5);
    const [profile, setProfile] = useState<Profile | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Load profile from localStorage
    useEffect(() => {
        const raw = localStorage.getItem("pickscout_profile");
        if (raw) {
            const p: Profile = JSON.parse(raw);
            setProfile(p);
            setUnitSize(p.unit_size);
        }
    }, []);

    const loadCappers = useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchLeaderboard(
                sport !== "All" ? sport : undefined,
                credFilter || undefined
            );
            setCappers(data);
            setLastUpdated(new Date());
        } catch {
            // On error, show empty state
            setCappers([]);
        } finally {
            setLoading(false);
        }
    }, [sport, credFilter]);

    useEffect(() => {
        loadCappers();
    }, [loadCappers]);

    const verifiedCount = cappers.filter((c) => c.credibility === "verified").length;
    const totalPicks = cappers.reduce((acc, c) => acc + (c.active_picks?.length || 0), 0);

    return (
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)" }}>
            {/* Header */}
            <header
                style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 50,
                    background: "rgba(8,11,20,0.92)",
                    backdropFilter: "blur(16px)",
                    borderBottom: "1px solid var(--border)",
                }}
            >
                {/* Top row: logo + unit size input */}
                <div
                    style={{
                        maxWidth: "1100px",
                        margin: "0 auto",
                        padding: "14px 20px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "16px",
                    }}
                >
                    {/* Logo */}
                    <a
                        href="/"
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            textDecoration: "none",
                            flexShrink: 0,
                        }}
                    >
                        <span style={{ fontSize: "20px" }}>🎯</span>
                        <span style={{ fontSize: "18px", fontWeight: 800, color: "var(--text-primary)" }}>
                            Pick<span style={{ color: "var(--accent-green)" }}>Scout</span>
                        </span>
                    </a>

                    {/* Stats bar */}
                    <div
                        style={{
                            display: "flex",
                            gap: "20px",
                            alignItems: "center",
                            flex: 1,
                            justifyContent: "center",
                        }}
                    >
                        <div style={{ textAlign: "center", display: "none" }}>
                            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-green)" }}>{verifiedCount}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Verified</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                            <div style={{ fontSize: "16px", fontWeight: 700 }}>{totalPicks}</div>
                            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Today&apos;s Picks</div>
                        </div>
                        {lastUpdated && (
                            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                        )}
                    </div>

                    {/* Unit Size Input */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            flexShrink: 0,
                            background: "rgba(0,214,143,0.06)",
                            border: "1px solid rgba(0,214,143,0.2)",
                            borderRadius: "10px",
                            padding: "6px 12px",
                        }}
                    >
                        <span style={{ fontSize: "11px", color: "var(--accent-green)", fontWeight: 600, whiteSpace: "nowrap" }}>
                            1u =
                        </span>
                        <span style={{ fontSize: "12px", color: "var(--accent-green)", fontWeight: 500 }}>$</span>
                        <input
                            id="unit-size-input"
                            type="number"
                            value={unitSize}
                            onChange={(e) => setUnitSize(parseFloat(e.target.value) || 1)}
                            style={{
                                background: "transparent",
                                border: "none",
                                outline: "none",
                                color: "var(--accent-green)",
                                fontWeight: 700,
                                fontSize: "15px",
                                width: "64px",
                            }}
                            min={1}
                            step={0.5}
                        />
                    </div>
                </div>

                {/* Sport filter row */}
                <div
                    style={{
                        maxWidth: "1100px",
                        margin: "0 auto",
                        padding: "0 20px 12px",
                        display: "flex",
                        gap: "6px",
                        overflowX: "auto",
                        paddingBottom: "12px",
                    }}
                >
                    {SPORTS.map((s) => (
                        <button
                            key={s}
                            id={`sport-filter-${s.toLowerCase().replace("/", "-")}`}
                            className={`filter-chip ${sport === s ? "active" : ""}`}
                            onClick={() => setSport(s)}
                        >
                            {s}
                        </button>
                    ))}

                    <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "0 4px", flexShrink: 0 }} />

                    {CREDIBILITY_FILTERS.map((f) => (
                        <button
                            key={f.key}
                            id={`cred-filter-${f.key || "all"}`}
                            className={`filter-chip ${credFilter === f.key ? "active" : ""}`}
                            onClick={() => setCredFilter(f.key)}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Main Content */}
            <main
                style={{
                    maxWidth: "1100px",
                    margin: "0 auto",
                    padding: "24px 20px",
                }}
            >
                {/* Bankroll summary (if logged in) */}
                {profile && (
                    <div
                        style={{
                            background: "linear-gradient(135deg, rgba(0,214,143,0.08), rgba(79,142,247,0.05))",
                            border: "1px solid rgba(0,214,143,0.15)",
                            borderRadius: "14px",
                            padding: "16px 20px",
                            marginBottom: "24px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: "12px",
                        }}
                    >
                        <div>
                            <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "2px" }}>Your bankroll</p>
                            <p style={{ fontSize: "20px", fontWeight: 800 }}>${profile.bankroll.toLocaleString()}</p>
                        </div>
                        <div style={{ display: "flex", gap: "24px" }}>
                            <div>
                                <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Unit size</p>
                                <p style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent-green)" }}>${unitSize.toFixed(2)}</p>
                            </div>
                            <div>
                                <p style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Risk profile</p>
                                <p style={{ fontSize: "16px", fontWeight: 700, textTransform: "capitalize" }}>{profile.risk_tolerance}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Section title */}
                <div style={{ marginBottom: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                        <h2 style={{ fontSize: "17px", fontWeight: 700, marginBottom: "2px" }}>
                            {sport === "All" ? "Today's Picks" : `${sport} Picks`}
                            {credFilter && (
                                <span style={{ color: "var(--text-secondary)", fontWeight: 400, fontSize: "14px", marginLeft: "8px" }}>
                                    · {CREDIBILITY_FILTERS.find((f) => f.key === credFilter)?.label}
                                </span>
                            )}
                        </h2>
                        <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                            Numbers update live when you change unit size ↗
                        </p>
                    </div>
                    <button
                        id="refresh-btn"
                        onClick={loadCappers}
                        style={{
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "8px",
                            padding: "6px 12px",
                            color: "var(--text-secondary)",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s",
                        }}
                    >
                        ↻ Refresh
                    </button>
                </div>

                {/* Cards */}
                {loading ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="skeleton"
                                style={{ height: "140px", borderRadius: "16px" }}
                            />
                        ))}
                    </div>
                ) : cappers.length === 0 ? (
                    <div
                        style={{
                            textAlign: "center",
                            padding: "60px 20px",
                            color: "var(--text-secondary)",
                        }}
                    >
                        <div style={{ fontSize: "40px", marginBottom: "12px" }}>📭</div>
                        <p style={{ fontSize: "16px", fontWeight: 600, marginBottom: "6px" }}>No picks found</p>
                        <p style={{ fontSize: "13px" }}>
                            The scraper hasn&apos;t run yet, or no picks match your filter.
                            <br />
                            Try removing filters or run <code style={{ background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: "4px" }}>python seeder.py</code> to load demo data.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {cappers.map((capper, i) => (
                            <CapperCard
                                key={capper.id}
                                capper={capper}
                                unitSize={unitSize}
                                index={i}
                            />
                        ))}
                    </div>
                )}
            </main>

            {/* Footer disclaimer */}
            <footer
                style={{
                    maxWidth: "1100px",
                    margin: "40px auto 0",
                    padding: "20px",
                    borderTop: "1px solid var(--border)",
                    textAlign: "center",
                }}
            >
                <p style={{ fontSize: "11px", color: "var(--text-secondary)", lineHeight: "1.6" }}>
                    ⚠️ PickScout is for entertainment purposes only. Past performance does not guarantee future results.
                    Always gamble responsibly. We do not endorse any specific picks or cappers.
                </p>
            </footer>
        </div>
    );
}
