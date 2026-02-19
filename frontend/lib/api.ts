const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Capper {
    id: string;
    username: string;
    display_name: string;
    platform: 'Reddit' | 'Discord';
    profile_url: string | null;
    total_wins: number;
    total_losses: number;
    total_units_won: number;
    credibility: 'verified' | 'unverified' | 'suspicious';
    last_active: string;
    active_picks: Pick[];
}

export interface Pick {
    id: string;
    capper_id: string;
    sport: string;
    matchup: string;
    pick_text: string;
    odds: number;
    risk_units: number;
    status: 'pending' | 'won' | 'lost' | 'pushed';
    game_start_time: string | null;
    source_url: string | null;
    cappers?: Capper;
}

export async function fetchLeaderboard(
    sport?: string,
    credibility?: string
): Promise<Capper[]> {
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (credibility) params.set('credibility', credibility);

    const res = await fetch(`${API_URL}/api/cappers/leaderboard?${params}`, {
        next: { revalidate: 300 }, // Cache for 5 mins
    });

    if (!res.ok) throw new Error('Failed to fetch leaderboard');
    const data = await res.json();
    return data.cappers;
}

export async function fetchTodaysPicks(
    sport?: string,
    credibility?: string
): Promise<Pick[]> {
    const params = new URLSearchParams();
    if (sport) params.set('sport', sport);
    if (credibility) params.set('credibility', credibility);

    const res = await fetch(`${API_URL}/api/picks/today?${params}`, {
        next: { revalidate: 300 },
    });

    if (!res.ok) throw new Error('Failed to fetch picks');
    const data = await res.json();
    return data.picks;
}

/** 
 * Calculate American odds profit for a given unit size.
 * Returns profit in dollars for 1 unit won.
 */
export function calcProfit(odds: number, unitSize: number, riskUnits: number): number {
    const stake = unitSize * riskUnits;
    if (odds > 0) {
        return (odds / 100) * stake;
    } else {
        return (100 / Math.abs(odds)) * stake;
    }
}

/**
 * Calculate total historical profit if user had tailed a capper.
 */
export function calcHistoricalProfit(totalUnitsWon: number, unitSize: number): number {
    return totalUnitsWon * unitSize;
}

export function formatOdds(odds: number): string {
    return odds > 0 ? `+${odds}` : `${odds}`;
}

export function winRate(wins: number, losses: number): string {
    const total = wins + losses;
    if (total === 0) return 'N/A';
    return `${((wins / total) * 100).toFixed(1)}%`;
}
