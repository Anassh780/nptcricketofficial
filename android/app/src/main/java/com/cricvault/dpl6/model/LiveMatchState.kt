package com.cricvault.dpl6.model

import java.util.Locale

enum class LiveConnectionState(val label: String) {
    CONNECTING("RECONNECTING"),
    LIVE("LIVE"),
    DELAYED("DATA DELAYED"),
    ENDED("MATCH ENDED"),
    UNAVAILABLE("UNAVAILABLE")
}

data class PlayerLine(
    val name: String = "",
    val runs: Long = 0,
    val balls: Long = 0,
    val fours: Long = 0,
    val sixes: Long = 0,
)

data class BowlerLine(
    val name: String = "",
    val runs: Long = 0,
    val balls: Long = 0,
    val wickets: Long = 0,
    val maidens: Long = 0,
)

data class LiveMatchState(
    val matchId: String = "",
    val innings: Long = 1,
    val battingTeam: String = "Waiting for match",
    val bowlingTeam: String = "DPL 6",
    val battingTeamLogo: String? = null,
    val bowlingTeamLogo: String? = null,
    val runs: Long = 0,
    val wickets: Long = 0,
    val balls: Long = 0,
    val striker: PlayerLine = PlayerLine(name = "Striker"),
    val nonStriker: PlayerLine = PlayerLine(name = "Non-striker"),
    val bowler: BowlerLine = BowlerLine(name = "Bowler"),
    val target: Long? = null,
    val matchOvers: Long = 20,
    val recentBalls: List<String> = emptyList(),
    val partnershipRuns: Long = 0,
    val partnershipBalls: Long = 0,
    val lastWicket: String = "No wicket recorded",
    val currentOverRuns: Long = 0,
    val result: String = "",
    val updatedAt: Long = 0,
    val connection: LiveConnectionState = LiveConnectionState.CONNECTING,
) {
    val scoreText: String get() = "$runs/$wickets"
    val oversText: String get() = "${balls / 6}.${balls % 6}"
    val bowlerOversText: String get() = "${bowler.balls / 6}.${bowler.balls % 6}"
    val ballsRemaining: Long get() = (matchOvers * 6 - balls).coerceAtLeast(0)
    val runsRequired: Long? get() = target?.let { (it - runs).coerceAtLeast(0) }
    val currentRunRate: String get() = if (balls == 0L) "0.00" else "%.2f".format(Locale.US, runs * 6.0 / balls)
    val requiredRunRate: String get() = if (runsRequired == null || ballsRemaining == 0L) "—" else "%.2f".format(Locale.US, runsRequired!! * 6.0 / ballsRemaining)
    val statusLabel: String get() = when {
        result.isNotBlank() -> "FINAL"
        else -> connection.label
    }
}
