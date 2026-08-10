package com.cricvault.dpl6.data

import com.cricvault.dpl6.model.BowlerLine
import com.cricvault.dpl6.model.LiveConnectionState
import com.cricvault.dpl6.model.LiveMatchState
import com.cricvault.dpl6.model.PlayerLine
import com.google.firebase.database.DataSnapshot
import com.google.firebase.database.DatabaseError
import com.google.firebase.database.FirebaseDatabase
import com.google.firebase.database.ValueEventListener
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

class LiveScoreRepository(
    private val database: FirebaseDatabase = FirebaseDatabase.getInstance(),
) {
    private val league = database.reference.child("dpl6")

    fun observe(requestedMatchId: String): Flow<LiveMatchState> = callbackFlow {
        var teamLogos: Map<String, String> = emptyMap()
        var latestScore: DataSnapshot? = null
        var connected = false

        fun emitCurrent(connection: LiveConnectionState = LiveConnectionState.LIVE) {
            latestScore?.let { trySend(mapState(it, teamLogos, requestedMatchId, connection)) }
        }

        league.child("teams").get()
            .addOnSuccessListener {
                teamLogos = mapTeamLogos(it)
                emitCurrent(if (connected) LiveConnectionState.LIVE else LiveConnectionState.CONNECTING)
            }

        val scoreReference = league.child("liveScore")
        val listener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                latestScore = snapshot
                trySend(mapState(snapshot, teamLogos, requestedMatchId, if (connected) LiveConnectionState.LIVE else LiveConnectionState.CONNECTING))
            }

            override fun onCancelled(error: DatabaseError) {
                val delayed = latestScore?.let {
                    mapState(it, teamLogos, requestedMatchId, LiveConnectionState.DELAYED)
                } ?: LiveMatchState(connection = LiveConnectionState.UNAVAILABLE)
                trySend(delayed)
            }
        }
        val connectionReference = database.getReference(".info/connected")
        val connectionListener = object : ValueEventListener {
            override fun onDataChange(snapshot: DataSnapshot) {
                connected = snapshot.getValue(Boolean::class.java) == true
                emitCurrent(if (connected) LiveConnectionState.LIVE else LiveConnectionState.DELAYED)
            }

            override fun onCancelled(error: DatabaseError) {
                connected = false
                emitCurrent(LiveConnectionState.DELAYED)
            }
        }
        scoreReference.addValueEventListener(listener)
        connectionReference.addValueEventListener(connectionListener)
        awaitClose {
            scoreReference.removeEventListener(listener)
            connectionReference.removeEventListener(connectionListener)
        }
    }

    suspend fun fetchCurrent(requestedMatchId: String = "live"): LiveMatchState {
        val teams = league.child("teams").get().await()
        val score = league.child("liveScore").get().await()
        return mapState(score, mapTeamLogos(teams), requestedMatchId, LiveConnectionState.LIVE)
    }

    private fun mapState(
        score: DataSnapshot,
        teamLogos: Map<String, String>,
        requestedMatchId: String,
        connection: LiveConnectionState,
    ): LiveMatchState {
        if (!score.exists()) return LiveMatchState(connection = LiveConnectionState.UNAVAILABLE)
        val actualMatchId = score.text("matchId")
        val validIdentity = requestedMatchId == "live" || actualMatchId == requestedMatchId
        if (!validIdentity) {
            return LiveMatchState(matchId = requestedMatchId, connection = LiveConnectionState.UNAVAILABLE)
        }
        val batting = score.text("batting", "Waiting for match")
        val bowling = score.text("bowling", "DPL 6")
        val strikerName = score.text("striker", "Striker")
        val nonStrikerName = score.text("nonStriker", "Non-striker")
        val bowlerName = score.text("bowler", "Bowler")
        val striker = score.child("batters").child(strikerName)
        val nonStriker = score.child("batters").child(nonStrikerName)
        val bowler = score.child("bowlers").child(bowlerName)
        val result = score.text("result")
        val marks = score.child("overMarks").children.mapNotNull { it.value?.toString() }.takeLast(6)
        val target = (score.child("target").value as? Number)?.toLong()
        val mappedConnection = when {
            !validIdentity -> LiveConnectionState.UNAVAILABLE
            result.isNotBlank() -> LiveConnectionState.ENDED
            else -> connection
        }
        return LiveMatchState(
            matchId = actualMatchId,
            innings = score.number("innings").coerceAtLeast(1),
            battingTeam = batting,
            bowlingTeam = bowling,
            battingTeamLogo = teamLogos[batting],
            bowlingTeamLogo = teamLogos[bowling],
            runs = score.number("runs"),
            wickets = score.number("wickets"),
            balls = score.number("balls"),
            striker = PlayerLine(strikerName, striker.number("runs"), striker.number("balls"), striker.number("fours"), striker.number("sixes")),
            nonStriker = PlayerLine(nonStrikerName, nonStriker.number("runs"), nonStriker.number("balls"), nonStriker.number("fours"), nonStriker.number("sixes")),
            bowler = BowlerLine(bowlerName, bowler.number("runs"), bowler.number("balls"), bowler.number("wickets"), bowler.number("maidens")),
            target = target,
            matchOvers = score.number("matchOvers").takeIf { it > 0 } ?: 20,
            recentBalls = marks,
            partnershipRuns = score.number("partnershipRuns"),
            partnershipBalls = score.number("partnershipBalls"),
            lastWicket = score.child("fall").children.mapNotNull { it.value?.toString() }.lastOrNull() ?: "No wicket recorded",
            currentOverRuns = marks.sumOf { it.toLongOrNull() ?: 0 },
            result = result,
            updatedAt = score.number("updatedAt"),
            connection = mappedConnection,
        )
    }

    private fun mapTeamLogos(snapshot: DataSnapshot): Map<String, String> = buildMap {
        snapshot.children.forEach { team ->
            val name = team.text("name")
            val logo = team.text("logo")
            if (name.isNotBlank() && logo.isNotBlank()) put(name, logo)
        }
    }

    private fun DataSnapshot.text(key: String, fallback: String = ""): String =
        child(key).value?.toString()?.trim().takeUnless { it.isNullOrBlank() } ?: fallback

    private fun DataSnapshot.number(key: String): Long =
        (child(key).value as? Number)?.toLong() ?: 0
}
