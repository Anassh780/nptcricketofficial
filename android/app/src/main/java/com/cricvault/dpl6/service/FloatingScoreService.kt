package com.cricvault.dpl6.service

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleService
import androidx.lifecycle.lifecycleScope
import com.cricvault.dpl6.R
import com.cricvault.dpl6.data.LiveScoreRepository
import com.cricvault.dpl6.deeplink.FloatingScoreEntryActivity
import com.cricvault.dpl6.model.LiveConnectionState
import com.cricvault.dpl6.model.LiveMatchState
import com.cricvault.dpl6.model.OverlayMode
import com.cricvault.dpl6.overlay.FloatingScoreWindowManager
import com.cricvault.dpl6.storage.OverlayPositionStore
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.launch

class FloatingScoreService : LifecycleService() {
    private val repository = LiveScoreRepository()
    private lateinit var positionStore: OverlayPositionStore
    private lateinit var overlay: FloatingScoreWindowManager
    private var scoreJob: Job? = null
    private var staleJob: Job? = null
    private var activeMatchId = ""
    private var activeMode = OverlayMode.COMPACT
    private var latestState = LiveMatchState()
    private var stoppedByUser = false

    override fun onCreate() {
        super.onCreate()
        positionStore = OverlayPositionStore(applicationContext)
        overlay = FloatingScoreWindowManager(
            context = applicationContext,
            scope = lifecycleScope,
            positionStore = positionStore,
            onModeChange = ::switchMode,
            onClose = ::stopOverlay,
        )
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_STOP -> {
                stopOverlay()
                return Service.START_NOT_STICKY
            }
            ACTION_TOGGLE -> {
                val hidden = overlay.toggleVisibility()
                updateNotification(if (hidden) "Live score hidden · tap Show to restore" else null)
                return Service.START_NOT_STICKY
            }
            ACTION_SWITCH_MODE -> {
                OverlayMode.from(intent.getStringExtra(EXTRA_MODE))?.let(::switchMode)
                return Service.START_NOT_STICKY
            }
        }

        if (!Settings.canDrawOverlays(this)) {
            stopSelf()
            return Service.START_NOT_STICKY
        }
        val matchId = intent?.getStringExtra(EXTRA_MATCH_ID)?.takeIf(::validMatchId) ?: "live"
        val requestedMode = OverlayMode.from(intent?.getStringExtra(EXTRA_MODE)) ?: OverlayMode.COMPACT
        stoppedByUser = false
        startForegroundSafely(notification("Connecting to live score…"))
        lifecycleScope.launch {
            if (activeMatchId != matchId) {
                activeMatchId = matchId
                activeMode = requestedMode
                positionStore.saveActive(matchId, requestedMode)
                subscribeToScore(matchId)
            } else if (activeMode != requestedMode) {
                switchMode(requestedMode)
            } else {
                overlay.show(requestedMode, latestState)
                overlay.showIfHidden()
            }
        }
        return Service.START_NOT_STICKY
    }

    private fun subscribeToScore(matchId: String) {
        scoreJob?.cancel()
        staleJob?.cancel()
        latestState = LiveMatchState(matchId = matchId, connection = LiveConnectionState.CONNECTING)
        scoreJob = lifecycleScope.launch {
            repository.observe(matchId)
                .distinctUntilChanged()
                .collect { state ->
                    latestState = state
                    overlay.show(activeMode, state)
                    updateNotification()
                }
        }
        staleJob = lifecycleScope.launch {
            while (true) {
                delay(15_000)
                if (!Settings.canDrawOverlays(this@FloatingScoreService)) {
                    stopOverlay()
                    break
                }
                val state = latestState
                if (state.result.isBlank() && state.updatedAt > 0 && System.currentTimeMillis() - state.updatedAt > 60_000) {
                    latestState = state.copy(connection = LiveConnectionState.DELAYED)
                    overlay.update(latestState)
                    updateNotification()
                }
            }
        }
    }

    private fun switchMode(newMode: OverlayMode) {
        activeMode = newMode
        lifecycleScope.launch {
            positionStore.saveActive(activeMatchId.ifBlank { "live" }, newMode)
            overlay.show(newMode, latestState)
            updateNotification()
        }
    }

    private fun stopOverlay() {
        if (stoppedByUser) return
        stoppedByUser = true
        scoreJob?.cancel()
        staleJob?.cancel()
        overlay.remove()
        lifecycleScope.launch { positionStore.clearActive() }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        overlay.onConfigurationChanged()
    }

    override fun onDestroy() {
        scoreJob?.cancel()
        staleJob?.cancel()
        overlay.remove()
        super.onDestroy()
    }

    private fun startForegroundSafely(value: Notification) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, value, type)
    }

    private fun updateNotification(overrideText: String? = null) {
        getSystemService(NotificationManager::class.java).notify(
            NOTIFICATION_ID,
            notification(overrideText),
        )
    }

    private fun notification(overrideText: String? = null): Notification {
        val state = latestState
        val content = overrideText ?: when {
            state.result.isNotBlank() -> state.result
            state.battingTeam == "Waiting for match" -> state.connection.label
            else -> "${state.battingTeam} ${state.scoreText} · ${state.oversText} overs"
        }
        val openUri = Uri.parse("$WEB_ORIGIN/open/live-score/${activeMatchId.ifBlank { "live" }}?mode=floating&size=${activeMode.wireValue}")
        val openIntent = Intent(Intent.ACTION_VIEW, openUri, this, FloatingScoreEntryActivity::class.java)
            .putExtra(FloatingScoreEntryActivity.EXTRA_MANAGE_ONLY, true)
        val open = PendingIntent.getActivity(this, 10, openIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val toggle = servicePendingIntent(ACTION_TOGGLE, 11)
        val stop = servicePendingIntent(ACTION_STOP, 12)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_cricvault)
            .setContentTitle("CricVault Live Score")
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, "Open Match", open)
            .addAction(0, "Hide / Show", toggle)
            .addAction(0, "Stop", stop)
            .build()
    }

    private fun servicePendingIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, FloatingScoreService::class.java).setAction(action)
        return PendingIntent.getService(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Floating live score",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Keeps the user-requested CricVault score visible above other apps."
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val EXTRA_MATCH_ID = "match_id"
        const val EXTRA_MODE = "overlay_mode"
        private const val ACTION_START = "com.cricvault.dpl6.action.START_FLOATING_SCORE"
        private const val ACTION_STOP = "com.cricvault.dpl6.action.STOP_FLOATING_SCORE"
        private const val ACTION_TOGGLE = "com.cricvault.dpl6.action.TOGGLE_FLOATING_SCORE"
        private const val ACTION_SWITCH_MODE = "com.cricvault.dpl6.action.SWITCH_FLOATING_MODE"
        private const val CHANNEL_ID = "floating_live_score"
        private const val NOTIFICATION_ID = 6006
        private const val WEB_ORIGIN = "https://nptcricketofficial.vercel.app"
        private val MATCH_ID = Regex("^[A-Za-z0-9_-]{1,80}$")

        fun validMatchId(value: String): Boolean = MATCH_ID.matches(value)

        fun start(context: Context, matchId: String, mode: OverlayMode) {
            require(validMatchId(matchId)) { "Invalid match ID" }
            val intent = Intent(context, FloatingScoreService::class.java)
                .setAction(ACTION_START)
                .putExtra(EXTRA_MATCH_ID, matchId)
                .putExtra(EXTRA_MODE, mode.wireValue)
            ContextCompat.startForegroundService(context, intent)
        }
    }
}
