package com.cricvault.dpl6.model

import org.junit.Assert.assertEquals
import org.junit.Test

class LiveMatchStateTest {
    @Test fun derivesCricketRatesAndChaseWithoutFabricatedValues() {
        val state = LiveMatchState(runs = 100, wickets = 3, balls = 60, target = 151, matchOvers = 20)
        assertEquals("100/3", state.scoreText)
        assertEquals("10.0", state.oversText)
        assertEquals(51, state.runsRequired)
        assertEquals(60, state.ballsRemaining)
        assertEquals("10.00", state.currentRunRate)
        assertEquals("5.10", state.requiredRunRate)
    }

    @Test fun finalResultAlwaysUsesFinalStatus() {
        val state = LiveMatchState(result = "Falcons won by 5 wickets", connection = LiveConnectionState.DELAYED)
        assertEquals("FINAL", state.statusLabel)
    }
}
