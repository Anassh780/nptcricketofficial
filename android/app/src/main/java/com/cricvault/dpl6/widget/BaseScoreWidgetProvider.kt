package com.cricvault.dpl6.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.cricvault.dpl6.R
import com.cricvault.dpl6.data.LiveScoreRepository
import com.cricvault.dpl6.deeplink.FloatingScoreEntryActivity
import com.cricvault.dpl6.model.LiveMatchState
import com.cricvault.dpl6.overlay.ScoreViewBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

abstract class BaseScoreWidgetProvider : AppWidgetProvider() {
    protected abstract val layoutId: Int

    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { manager.updateAppWidget(it, baseViews(context).apply { setTextViewText(R.id.widget_status, "SYNCING") }) }
        val pending = goAsync()
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
        scope.launch {
            runCatching { LiveScoreRepository().fetchCurrent() }
                .onSuccess { state -> ids.forEach { manager.updateAppWidget(it, render(context, state)) } }
                .onFailure {
                    ids.forEach {
                        manager.updateAppWidget(it, baseViews(context).apply { setTextViewText(R.id.widget_status, "TAP TO RETRY") })
                    }
                }
            pending.finish()
            scope.cancel()
        }
    }

    private fun render(context: Context, state: LiveMatchState): RemoteViews = baseViews(context).apply {
        setTextViewText(R.id.widget_batting, state.battingTeam.uppercase())
        setTextViewText(R.id.widget_bowling, state.bowlingTeam.uppercase())
        setTextViewText(R.id.widget_score, state.scoreText)
        setTextViewText(R.id.widget_overs, "${state.oversText} OVERS")
        setTextViewText(R.id.widget_status, state.statusLabel)
        setTextViewText(
            R.id.widget_context,
            when {
                state.result.isNotBlank() -> state.result.uppercase()
                state.runsRequired != null -> "NEED ${state.runsRequired} RUNS FROM ${state.ballsRemaining} BALLS · RRR ${state.requiredRunRate}"
                else -> "INNINGS ${state.innings} · CRR ${state.currentRunRate}"
            },
        )
        setTextViewText(R.id.widget_striker, state.striker.name.uppercase())
        setTextViewText(R.id.widget_striker_score, "${state.striker.runs}* (${state.striker.balls})")
        setTextViewText(R.id.widget_non_striker, state.nonStriker.name.uppercase())
        setTextViewText(R.id.widget_non_striker_score, "${state.nonStriker.runs} (${state.nonStriker.balls})")
        setTextViewText(R.id.widget_bowler, state.bowler.name.uppercase())
        setTextViewText(R.id.widget_bowler_score, "${state.bowler.wickets}/${state.bowler.runs} (${state.bowlerOversText})")
        setTextViewText(R.id.widget_balls, state.recentBalls.ifEmpty { listOf("Waiting for first ball") }.joinToString("   "))
        ScoreViewBinder.decodeEmbeddedImage(state.battingTeamLogo)?.let { setImageViewBitmap(R.id.widget_batting_logo, it) }
        ScoreViewBinder.decodeEmbeddedImage(state.bowlingTeamLogo)?.let { setImageViewBitmap(R.id.widget_bowling_logo, it) }
    }

    private fun baseViews(context: Context): RemoteViews {
        val views = RemoteViews(context.packageName, layoutId)
        val refresh = Intent(context, javaClass).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(
                AppWidgetManager.EXTRA_APPWIDGET_IDS,
                AppWidgetManager.getInstance(context).getAppWidgetIds(ComponentName(context, javaClass)),
            )
        }
        views.setOnClickPendingIntent(
            R.id.widget_root,
            PendingIntent.getBroadcast(context, javaClass.name.hashCode(), refresh, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE),
        )
        views.setOnClickPendingIntent(
            R.id.widget_brand,
            PendingIntent.getActivity(
                context,
                javaClass.name.hashCode(),
                Intent(context, FloatingScoreEntryActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            ),
        )
        return views
    }
}
