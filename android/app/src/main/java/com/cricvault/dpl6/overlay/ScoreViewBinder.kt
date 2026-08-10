package com.cricvault.dpl6.overlay

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Base64
import android.util.LruCache
import android.view.View
import android.widget.ImageView
import android.widget.TextView
import com.cricvault.dpl6.R
import com.cricvault.dpl6.model.LiveMatchState

object ScoreViewBinder {
    private val imageCache = LruCache<Int, Bitmap>(8)

    fun bind(root: View, state: LiveMatchState) {
        root.text(R.id.widget_batting, state.battingTeam.uppercase())
        root.text(R.id.widget_bowling, state.bowlingTeam.uppercase())
        root.text(R.id.widget_score, state.scoreText)
        root.text(R.id.widget_overs, "${state.oversText} OVERS")
        root.text(R.id.widget_status, state.statusLabel)
        root.text(
            R.id.widget_context,
            when {
                state.result.isNotBlank() -> state.result.uppercase()
                state.runsRequired != null -> "NEED ${state.runsRequired} RUNS FROM ${state.ballsRemaining} BALLS · RRR ${state.requiredRunRate}"
                else -> "INNINGS ${state.innings} · CRR ${state.currentRunRate}"
            },
        )
        root.text(R.id.widget_striker, state.striker.name.uppercase())
        root.text(R.id.widget_striker_score, "${state.striker.runs}* (${state.striker.balls})")
        root.text(R.id.widget_non_striker, state.nonStriker.name.uppercase())
        root.text(R.id.widget_non_striker_score, "${state.nonStriker.runs} (${state.nonStriker.balls})")
        root.text(R.id.widget_bowler, state.bowler.name.uppercase())
        root.text(R.id.widget_bowler_score, "${state.bowler.wickets}/${state.bowler.runs} (${state.bowlerOversText})")
        root.text(R.id.widget_balls, state.recentBalls.ifEmpty { listOf("Waiting for first ball") }.joinToString("   "))
        root.image(R.id.widget_batting_logo, decodeEmbeddedImage(state.battingTeamLogo))
        root.image(R.id.widget_bowling_logo, decodeEmbeddedImage(state.bowlingTeamLogo))
        root.contentDescription = buildString {
            append(state.battingTeam)
            append(' ')
            append(state.scoreText)
            append(" after ")
            append(state.oversText)
            append(" overs against ")
            append(state.bowlingTeam)
            append(". ")
            append(state.statusLabel)
        }
    }

    fun decodeEmbeddedImage(value: String?): Bitmap? {
        if (value.isNullOrBlank() || !value.startsWith("data:image/")) return null
        val cacheKey = value.hashCode()
        imageCache.get(cacheKey)?.let { return it }
        return runCatching {
            val encoded = value.substringAfter(',', "")
            val bytes = Base64.decode(encoded, Base64.DEFAULT)
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
        }.getOrNull()?.also { imageCache.put(cacheKey, it) }
    }

    private fun View.text(id: Int, value: CharSequence) {
        findViewById<TextView>(id)?.text = value
    }

    private fun View.image(id: Int, bitmap: Bitmap?) {
        findViewById<ImageView>(id)?.apply {
            if (bitmap == null) {
                visibility = View.INVISIBLE
            } else {
                setImageBitmap(bitmap)
                visibility = View.VISIBLE
            }
        }
    }
}
