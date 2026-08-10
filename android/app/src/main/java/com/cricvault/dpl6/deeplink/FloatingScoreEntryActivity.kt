package com.cricvault.dpl6.deeplink

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.app.ActivityCompat
import com.cricvault.dpl6.R
import com.cricvault.dpl6.model.OverlayMode
import com.cricvault.dpl6.service.FloatingScoreService
import com.cricvault.dpl6.widget.PinWidgetHelper

class FloatingScoreEntryActivity : ComponentActivity() {
    private var pendingMatchId = "live"
    private var pendingMode = OverlayMode.COMPACT
    private var waitingForOverlayPermission = false
    private var pendingStartAfterNotificationPermission = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_floating_score_entry)
        wireControls()
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        if (!waitingForOverlayPermission) return
        waitingForOverlayPermission = false
        if (Settings.canDrawOverlays(this)) {
            startWithNotificationPermission()
        } else {
            showMessage("Permission was not granted. CricVault will not draw above other apps until you approve it.")
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS && pendingStartAfterNotificationPermission) {
            pendingStartAfterNotificationPermission = false
            startOverlay()
        }
    }

    private fun handleIntent(incoming: Intent) {
        val request = parseRequest(incoming)
        if (request == null && incoming.action == Intent.ACTION_VIEW) {
            showMessage("This CricVault link is invalid or belongs to an unsupported host.")
            return
        }
        if (request == null) {
            showLauncherState()
            return
        }
        pendingMatchId = request.matchId
        pendingMode = request.mode
        findViewById<TextView>(R.id.entry_match).text = "MATCH ${request.matchId.takeLast(8).uppercase()} · ${request.mode.wireValue.uppercase()}"
        if (incoming.getBooleanExtra(EXTRA_MANAGE_ONLY, false)) {
            showMessage("Your floating live score is controlled from the ongoing CricVault notification.")
            return
        }
        if (request.pin) {
            requestPin(request.mode)
        } else if (Settings.canDrawOverlays(this)) {
            startWithNotificationPermission()
        } else {
            findViewById<View>(R.id.entry_permission_panel).visibility = View.VISIBLE
            showMessage("Android requires your approval before CricVault can keep a draggable live score above WhatsApp, YouTube, and other apps.")
        }
    }

    private fun wireControls() {
        findViewById<Button>(R.id.entry_allow_overlay).setOnClickListener {
            waitingForOverlayPermission = true
            val permissionIntent = Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:$packageName"),
            )
            startActivity(permissionIntent)
        }
        mapOf(
            R.id.entry_float_compact to OverlayMode.COMPACT,
            R.id.entry_float_standard to OverlayMode.STANDARD,
            R.id.entry_float_expanded to OverlayMode.EXPANDED,
        ).forEach { (id, mode) ->
            findViewById<Button>(id).setOnClickListener {
                pendingMode = mode
                if (Settings.canDrawOverlays(this)) startWithNotificationPermission()
                else {
                    findViewById<View>(R.id.entry_permission_panel).visibility = View.VISIBLE
                    showMessage("To float this score, first review the explanation below and open Android's official permission screen.")
                }
            }
        }
        mapOf(
            R.id.entry_pin_compact to OverlayMode.COMPACT,
            R.id.entry_pin_standard to OverlayMode.STANDARD,
            R.id.entry_pin_expanded to OverlayMode.EXPANDED,
        ).forEach { (id, mode) ->
            findViewById<Button>(id).setOnClickListener { requestPin(mode) }
        }
    }

    private fun startWithNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            pendingStartAfterNotificationPermission = true
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        } else {
            startOverlay()
        }
    }

    private fun startOverlay() {
        runCatching { FloatingScoreService.start(this, pendingMatchId, pendingMode) }
            .onSuccess {
                Toast.makeText(this, "Floating live score started", Toast.LENGTH_SHORT).show()
                finish()
            }
            .onFailure { showMessage("The floating score could not start: ${it.message}") }
    }

    private fun requestPin(mode: OverlayMode) {
        val requested = PinWidgetHelper.request(this, mode)
        showMessage(
            if (requested) "Android opened the launcher confirmation. The widget is added only if you approve it."
            else "This launcher does not support in-app widget pinning. Long-press the home screen and add CricVault from Widgets.",
        )
    }

    private fun showLauncherState() {
        findViewById<TextView>(R.id.entry_match).text = "DPL 6 LIVE SCORE"
        showMessage("Choose a floating size or request a normal launcher widget. Floating mode requires Android's display-over-other-apps permission.")
    }

    private fun showMessage(message: String) {
        findViewById<TextView>(R.id.entry_message).text = message
    }

    private fun parseRequest(incoming: Intent): EntryRequest? {
        if (incoming.action != Intent.ACTION_VIEW) return null
        val uri = incoming.data ?: return null
        if (uri.scheme != "https" || uri.host != APP_LINK_HOST) return null
        val parts = uri.pathSegments
        if (parts.size != 3 || parts[0] != "open" || parts[1] != "live-score") return null
        val matchId = parts[2]
        if (!FloatingScoreService.validMatchId(matchId)) return null
        val mode = OverlayMode.from(uri.getQueryParameter("size")) ?: return null
        val action = uri.getQueryParameter("mode")
        if (action != "floating" && action != "pin") return null
        return EntryRequest(matchId, mode, action == "pin")
    }

    private data class EntryRequest(val matchId: String, val mode: OverlayMode, val pin: Boolean)

    companion object {
        const val EXTRA_MANAGE_ONLY = "manage_only"
        private const val APP_LINK_HOST = "nptcricketofficial.vercel.app"
        private const val REQUEST_NOTIFICATIONS = 206
    }
}
