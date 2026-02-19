"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    const profile = localStorage.getItem("pickscout_profile");
    if (profile) {
      router.replace("/dashboard");
    } else {
      router.replace("/onboarding");
    }
  }, [router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-primary)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "24px" }}>🎯</span>
        <span style={{ fontSize: "20px", fontWeight: 800 }}>
          Pick<span style={{ color: "var(--accent-green)" }}>Scout</span>
        </span>
      </div>
    </div>
  );
}
