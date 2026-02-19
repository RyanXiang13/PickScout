"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = 1 | 2 | 3;

const RISK_OPTIONS = [
    {
        key: "conservative",
        label: "Conservative",
        desc: "1% per unit — play it safe, minimize losses",
        emoji: "🛡️",
    },
    {
        key: "moderate",
        label: "Moderate",
        desc: "2% per unit — balanced approach",
        emoji: "⚖️",
    },
    {
        key: "aggressive",
        label: "Aggressive",
        desc: "3% per unit — higher risk, higher reward",
        emoji: "🔥",
    },
];

export default function OnboardingPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [bankroll, setBankroll] = useState("");
    const [unitSize, setUnitSize] = useState("");
    const [riskTolerance, setRiskTolerance] = useState("moderate");
    const [loading, setLoading] = useState(false);

    // Auto-suggest unit size based on bankroll + risk
    const suggestUnitSize = (br: string, risk: string) => {
        const amount = parseFloat(br);
        if (isNaN(amount)) return;
        const pct = risk === "conservative" ? 0.01 : risk === "moderate" ? 0.02 : 0.03;
        setUnitSize((amount * pct).toFixed(2));
    };

    const handleBankrollNext = () => {
        if (!bankroll || parseFloat(bankroll) <= 0) return;
        suggestUnitSize(bankroll, riskTolerance);
        setStep(2);
    };

    const handleRiskSelect = (key: string) => {
        setRiskTolerance(key);
        suggestUnitSize(bankroll, key);
    };

    const handleFinish = async () => {
        setLoading(true);
        const profile = {
            bankroll: parseFloat(bankroll),
            unit_size: parseFloat(unitSize),
            risk_tolerance: riskTolerance,
        };

        // Save to localStorage for quick access in dashboard
        localStorage.setItem("pickscout_profile", JSON.stringify(profile));

        // Also POST to API (fire and forget)
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
        fetch(`${apiUrl}/api/users/profile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profile),
        }).catch(() => { }); // Non-blocking

        router.push("/dashboard");
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "24px",
                background:
                    "radial-gradient(ellipse at 50% 0%, rgba(0,214,143,0.08) 0%, transparent 60%), var(--bg-primary)",
            }}
        >
            {/* Logo */}
            <div className="animate-fade-in-up" style={{ marginBottom: "48px", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center", marginBottom: "8px" }}>
                    <span style={{ fontSize: "28px" }}>🎯</span>
                    <span style={{ fontSize: "26px", fontWeight: 800, letterSpacing: "-0.5px" }}>
                        Pick<span style={{ color: "var(--accent-green)" }}>Scout</span>
                    </span>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
                    Tail the hot hand. Know your numbers.
                </p>
            </div>

            {/* Step indicator */}
            <div
                className="animate-fade-in-up-delay-1"
                style={{
                    display: "flex",
                    gap: "8px",
                    marginBottom: "32px",
                    alignItems: "center",
                }}
            >
                {[1, 2, 3].map((s) => (
                    <div
                        key={s}
                        style={{
                            width: s === step ? "32px" : "8px",
                            height: "8px",
                            borderRadius: "100px",
                            background: s <= step ? "var(--accent-green)" : "rgba(255,255,255,0.1)",
                            transition: "all 0.3s ease",
                        }}
                    />
                ))}
            </div>

            {/* Card */}
            <div
                className="card animate-fade-in-up-delay-2"
                style={{ width: "100%", maxWidth: "440px", padding: "36px" }}
            >
                {/* Step 1 — Bankroll */}
                {step === 1 && (
                    <div>
                        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
                            What&apos;s your bankroll?
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px", lineHeight: "1.6" }}>
                            This is the total amount you&apos;re willing to play with. We&apos;ll use it to calculate exactly how much to bet on each pick.
                        </p>
                        <div style={{ position: "relative", marginBottom: "20px" }}>
                            <span
                                style={{
                                    position: "absolute",
                                    left: "14px",
                                    top: "50%",
                                    transform: "translateY(-50%)",
                                    color: "var(--text-secondary)",
                                    fontSize: "16px",
                                    fontWeight: 600,
                                }}
                            >
                                $
                            </span>
                            <input
                                id="bankroll-input"
                                className="input-dark"
                                type="number"
                                placeholder="1000"
                                value={bankroll}
                                onChange={(e) => setBankroll(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleBankrollNext()}
                                style={{
                                    width: "100%",
                                    padding: "14px 14px 14px 32px",
                                    fontSize: "18px",
                                    fontWeight: 600,
                                }}
                                autoFocus
                            />
                        </div>
                        <div
                            style={{
                                display: "flex",
                                gap: "8px",
                                marginBottom: "24px",
                                flexWrap: "wrap",
                            }}
                        >
                            {["100", "250", "500", "1000", "2500"].map((amt) => (
                                <button
                                    key={amt}
                                    onClick={() => setBankroll(amt)}
                                    style={{
                                        padding: "6px 14px",
                                        borderRadius: "100px",
                                        border: "1px solid rgba(255,255,255,0.1)",
                                        background:
                                            bankroll === amt
                                                ? "rgba(0,214,143,0.12)"
                                                : "rgba(255,255,255,0.04)",
                                        color:
                                            bankroll === amt ? "var(--accent-green)" : "var(--text-secondary)",
                                        fontSize: "13px",
                                        fontWeight: 500,
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    ${amt}
                                </button>
                            ))}
                        </div>
                        <button
                            id="bankroll-next"
                            className="btn-primary"
                            onClick={handleBankrollNext}
                            disabled={!bankroll || parseFloat(bankroll) <= 0}
                            style={{
                                width: "100%",
                                padding: "14px",
                                borderRadius: "12px",
                                fontSize: "15px",
                                opacity: !bankroll || parseFloat(bankroll) <= 0 ? 0.4 : 1,
                            }}
                        >
                            Continue →
                        </button>
                    </div>
                )}

                {/* Step 2 — Risk Tolerance */}
                {step === 2 && (
                    <div>
                        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
                            Risk tolerance?
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px", lineHeight: "1.6" }}>
                            This sets your standard unit size. You can always adjust it on the dashboard.
                        </p>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                            {RISK_OPTIONS.map((opt) => (
                                <button
                                    key={opt.key}
                                    id={`risk-${opt.key}`}
                                    onClick={() => handleRiskSelect(opt.key)}
                                    style={{
                                        padding: "16px",
                                        borderRadius: "12px",
                                        border: `1px solid ${riskTolerance === opt.key
                                                ? "rgba(0,214,143,0.4)"
                                                : "rgba(255,255,255,0.08)"
                                            }`,
                                        background:
                                            riskTolerance === opt.key
                                                ? "rgba(0,214,143,0.08)"
                                                : "rgba(255,255,255,0.03)",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        transition: "all 0.2s",
                                    }}
                                >
                                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <span style={{ fontSize: "22px" }}>{opt.emoji}</span>
                                        <div>
                                            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-primary)" }}>
                                                {opt.label}
                                            </div>
                                            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "2px" }}>
                                                {opt.desc}
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <button
                            id="risk-next"
                            className="btn-primary"
                            onClick={() => setStep(3)}
                            style={{ width: "100%", padding: "14px", borderRadius: "12px", fontSize: "15px" }}
                        >
                            Continue →
                        </button>
                    </div>
                )}

                {/* Step 3 — Review */}
                {step === 3 && (
                    <div>
                        <h1 style={{ fontSize: "22px", fontWeight: 700, marginBottom: "8px" }}>
                            You&apos;re all set 🎯
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "28px" }}>
                            Review your setup. You can change any of this in settings.
                        </p>

                        {/* Summary */}
                        <div
                            style={{
                                background: "rgba(255,255,255,0.03)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "12px",
                                padding: "20px",
                                marginBottom: "24px",
                            }}
                        >
                            {[
                                { label: "Bankroll", value: `$${parseFloat(bankroll).toLocaleString()}` },
                                { label: "Unit size (1u)", value: `$${parseFloat(unitSize).toFixed(2)}` },
                                { label: "Risk profile", value: riskTolerance.charAt(0).toUpperCase() + riskTolerance.slice(1) },
                            ].map((row) => (
                                <div
                                    key={row.label}
                                    style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "8px 0",
                                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                                    }}
                                >
                                    <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>{row.label}</span>
                                    <span style={{ fontWeight: 600, fontSize: "15px" }}>{row.value}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            id="finish-onboarding"
                            className="btn-primary"
                            onClick={handleFinish}
                            disabled={loading}
                            style={{ width: "100%", padding: "14px", borderRadius: "12px", fontSize: "15px" }}
                        >
                            {loading ? "Loading..." : "Go to Dashboard →"}
                        </button>
                    </div>
                )}
            </div>

            <p style={{ marginTop: "20px", fontSize: "12px", color: "var(--text-secondary)", textAlign: "center", maxWidth: "360px", lineHeight: "1.5" }}>
                ⚠️ For entertainment purposes only. Past performance does not guarantee future results. Gamble responsibly.
            </p>
        </div>
    );
}
