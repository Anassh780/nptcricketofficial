package com.cricvault.dpl6.model

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class OverlayModeTest {
    @Test fun parsesOnlySupportedModes() {
        assertEquals(OverlayMode.COMPACT, OverlayMode.from("compact"))
        assertEquals(OverlayMode.STANDARD, OverlayMode.from("STANDARD"))
        assertEquals(OverlayMode.EXPANDED, OverlayMode.from("expanded"))
        assertNull(OverlayMode.from("giant"))
        assertNull(OverlayMode.from(null))
    }

    @Test fun cyclesWithoutCreatingAnotherSession() {
        assertEquals(OverlayMode.STANDARD, OverlayMode.COMPACT.next())
        assertEquals(OverlayMode.EXPANDED, OverlayMode.STANDARD.next())
        assertEquals(OverlayMode.COMPACT, OverlayMode.EXPANDED.next())
    }
}
