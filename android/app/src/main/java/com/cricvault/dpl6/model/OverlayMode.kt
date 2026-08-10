package com.cricvault.dpl6.model

enum class OverlayMode(val wireValue: String) {
    COMPACT("compact"),
    STANDARD("standard"),
    EXPANDED("expanded");

    fun next(): OverlayMode = when (this) {
        COMPACT -> STANDARD
        STANDARD -> EXPANDED
        EXPANDED -> COMPACT
    }

    companion object {
        fun from(value: String?): OverlayMode? = entries.firstOrNull {
            it.wireValue.equals(value, ignoreCase = true)
        }
    }
}
