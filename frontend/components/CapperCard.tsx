"use client";

import { Capper, calcHistoricalProfit, calcProfit, formatOdds, winRate } from "@/lib/api";

interface CapperCardProps {
    capper: Capper;
    unitSize: number;
    index: number;
}

const SPORT_EMOJIS: Record<string, string> = {
    Basketball: "🏀",
    Football: "🏈",
    Hockey: "🏒",
    Baseball: "⚾",
    Soccer: "⚽",
    Esports: "🎮",
    Olympics: "🏅",
    Tennis: "🎾",
    "MMA/UFC": "🥊",
    Other: "🎯",
};

const PLATFORM_COLORS: Record<string, string> = {
    Reddit: "#ff4500",
    Discord: "#5865f2",
};

export default function CapperCard({ capper, unitSize, index }: CapperCardProps) {
    const historicalProfit = calcHistoricalProfit(capper.total_units_won, unitSize);
    const totalGames = capper.total_wins + capper.total_losses;
    const wr = winRate(capper.total_wins, capper.total_losses);
    const hasRecord = totalGames > 0;

    const credBadgeClass =
        capper.credibility === "verified"
            ? "badge-verified"
            : capper.credibility === "suspicious"
                ? "badge-suspicious"
                : "badge-unverified";

    const credLabel =
        capper.credibility === "verified"
            ? "✓ Verified Record"
            : capper.credibility === "suspicious"
                ? "⚠ Suspicious"
                : "? Unverified";

    return (
        <div
            className={`card ${capper.credibility === "verified"
                    ? "glow-green"
                    : capper.credibility === "suspicious"
                        ? "glow-red"
                        : ""
                }`}
            style={{
                padding: "20px",
                animationDelay: `${index * 0.05}s`,
                opacity: 0,
                animation: `fadeInUp 0.4s ease ${index * 0.05}s forwards`,
                borderLeft: `3px solid ${capper.credibility === "verified"
                        ? "var(--accent-green)"
                        : capper.credibility === "suspicious"
                            ? "var(--accent-red)"
                            : "rgba(245,166,35,0.5)"
                    }`,
            }}
        >
            {/* Header Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {/* Avatar */}
                    <div
                        style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "50%",
                            background: `linear-gradient(135deg, ${PLATFORM_COLORS[capper.platform] || "#4f8ef7"
                                }33, ${PLATFORM_COLORS[capper.platform] || "#4f8ef7"}11)`,
                            border: `2px solid ${PLATFORM_COLORS[capper.platform] || "#4f8ef7"}44`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "14px",
                            fontWeight: 700,
                            color: PLATFORM_COLORS[capper.platform] || "#4f8ef7",
                        }}
                    >
                        {(capper.display_name || capper.username)[0].toUpperCase()}
                    </div>

                    <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <a
                                href={capper.profile_url || "#"}
                                target={capper.profile_url ? "_blank" : undefined}
                                rel="noopener noreferrer"
                                style={{
                                    fontSize: "14px",
                                    fontWeight: 700,
                                    color: "var(--text-primary)",
                                    textDecoration: "none",
                                }}
                            >
                                {capper.display_name || capper.username}
                            </a>
                            <span className={`badge ${credBadgeClass}`}>{credLabel}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
                            <span
                                style={{
                                    fontSize: "11px",
                                    color: PLATFORM_COLORS[capper.platform] || "var(--text-secondary)",
                                    fontWeight: 600,
                                }}
                            >
                                {capper.platform}
                            </span>
                            {hasRecord && (
                                <>
                                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>•</span>
                                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                                        {capper.total_wins}W - {capper.total_losses}L
                                    </span>
                                    <span style={{ color: "rgba(255,255,255,0.2)", fontSize: "10px" }}>•</span>
                                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{wr}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Historical Profit */}
                <div style={{ textAlign: "right" }}>
                    <div
                        style={{
                            fontSize: "18px",
                            fontWeight: 800,
                            color:
                                historicalProfit >= 0 ? "var(--accent-green)" : "var(--accent-red)",
                        }}
                    >
                        {historicalProfit >= 0 ? "+" : ""}${Math.abs(historicalProfit).toFixed(2)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "1px" }}>
                        if tailed (all-time)
                    </div>
                </div>
            </div>

            {/* Active Picks */}
            {capper.active_picks && capper.active_picks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {capper.active_picks.map((pick, i) => {
                        const sport = pick.sport || "Other";
                        const emoji = SPORT_EMOJIS[sport] || "🎯";
                        const profit = calcProfit(pick.odds, unitSize, pick.risk_units);
                        const isPlus = pick.odds > 0;

                        return (
                            <div
                                key={pick.id || i}
                                style={{
                                    background: "rgba(255,255,255,0.03)",
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    borderRadius: "10px",
                                    padding: "12px 14px",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    gap: "12px",
                                }}
                            >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                                        <span style={{ fontSize: "13px" }}>{emoji}</span>
                                        <span style={{ fontSize: "11px", color: "var(--text-secondary)", fontWeight: 500 }}>
                                            {sport}
                                        </span>
                                        {pick.matchup && (
                                            <>
                                                <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                                                <span style={{ fontSize: "11px", color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {pick.matchup}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {pick.pick_text}
                                    </div>
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                                    {/* Odds */}
                                    <div
                                        style={{
                                            padding: "4px 10px",
                                            borderRadius: "6px",
                                            background: isPlus ? "rgba(0,214,143,0.1)" : "rgba(255,255,255,0.06)",
                                            color: isPlus ? "var(--accent-green)" : "var(--text-primary)",
                                            fontSize: "13px",
                                            fontWeight: 700,
                                        }}
                                    >
                                        {formatOdds(pick.odds)}
                                    </div>

                                    {/* Units risk + profit */}
                                    <div style={{ textAlign: "right" }}>
                                        <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent-green)" }}>
                                            +${profit.toFixed(2)}
                                        </div>
                                        <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
                                            {pick.risk_units}u • if wins
                                        </div>
                                    </div>

                                    {/* Source */}
                                    {pick.source_url && (
                                        <a
                                            href={pick.source_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                width: "28px",
                                                height: "28px",
                                                borderRadius: "6px",
                                                background: "rgba(255,255,255,0.05)",
                                                border: "1px solid rgba(255,255,255,0.08)",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                textDecoration: "none",
                                                fontSize: "12px",
                                                color: "var(--text-secondary)",
                                                flexShrink: 0,
                                                transition: "all 0.2s",
                                            }}
                                            title="View original post"
                                        >
                                            ↗
                                        </a>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div
                    style={{
                        padding: "14px",
                        borderRadius: "10px",
                        background: "rgba(255,255,255,0.02)",
                        border: "1px dashed rgba(255,255,255,0.08)",
                        textAlign: "center",
                        color: "var(--text-secondary)",
                        fontSize: "13px",
                    }}
                >
                    No picks posted today
                </div>
            )}
        </div>
    );
}
