package com.cricvault.dpl6.overlay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.Insets
import android.graphics.Rect
import android.graphics.Typeface
import android.os.Build
import android.view.Gravity
import android.view.LayoutInflater
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.WindowInsets
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.doOnLayout
import com.cricvault.dpl6.R
import com.cricvault.dpl6.model.LiveMatchState
import com.cricvault.dpl6.model.OverlayMode
import com.cricvault.dpl6.storage.OverlayPositionStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

class FloatingScoreWindowManager(
    private val context: Context,
    private val scope: CoroutineScope,
    private val positionStore: OverlayPositionStore,
    private val onModeChange: (OverlayMode) -> Unit,
    private val onClose: () -> Unit,
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private var container: LinearLayout? = null
    private var scoreView: View? = null
    private var params: WindowManager.LayoutParams? = null
    private var mode = OverlayMode.COMPACT
    private var latestState = LiveMatchState()
    private var hidden = false
    private var edgeAnimator: ValueAnimator? = null
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop

    suspend fun show(newMode: OverlayMode, state: LiveMatchState) {
        latestState = state
        if (container != null && mode == newMode) {
            update(state)
            return
        }
        removeView(savePosition = container != null)
        mode = newMode
        val overlay = buildOverlay(newMode)
        val restored = positionStore.position(newMode)
        val layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            android.graphics.PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = restored?.x ?: dp(12)
            y = restored?.y ?: dp(96)
        }
        container = overlay
        params = layoutParams
        windowManager.addView(overlay, layoutParams)
        hidden = false
        overlay.doOnLayout { clampAndApply() }
        update(state)
    }

    fun update(state: LiveMatchState) {
        latestState = state
        scoreView?.let { ScoreViewBinder.bind(it, state) }
    }

    fun toggleVisibility(): Boolean {
        val view = container ?: return false
        hidden = !hidden
        view.visibility = if (hidden) View.GONE else View.VISIBLE
        return hidden
    }

    fun showIfHidden() {
        hidden = false
        container?.visibility = View.VISIBLE
    }

    fun onConfigurationChanged() {
        container?.post { clampAndApply() }
    }

    fun remove() {
        removeView(savePosition = true)
    }

    private fun buildOverlay(overlayMode: OverlayMode): LinearLayout {
        val wrapper = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            clipChildren = false
            clipToPadding = false
        }
        val toolbar = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(10), 0, dp(4), dp(5))
            contentDescription = context.getString(R.string.drag_live_score)
        }
        val dragLabel = TextView(context).apply {
            text = "⋮⋮  DRAG LIVE SCORE"
            setTextColor(Color.rgb(145, 160, 168))
            textSize = 10f
            typeface = Typeface.DEFAULT_BOLD
            gravity = Gravity.CENTER_VERTICAL
            minHeight = dp(44)
        }
        val modeButton = controlButton(overlayMode.wireValue.uppercase()) {
            onModeChange(overlayMode.next())
        }
        val closeButton = controlButton("×") { onClose() }.apply {
            textSize = 22f
            contentDescription = context.getString(R.string.close_floating_score)
        }
        toolbar.addView(dragLabel, LinearLayout.LayoutParams(0, dp(44), 1f))
        toolbar.addView(modeButton, LinearLayout.LayoutParams(dp(88), dp(44)))
        toolbar.addView(closeButton, LinearLayout.LayoutParams(dp(44), dp(44)))
        attachDrag(toolbar)

        val layout = when (overlayMode) {
            OverlayMode.COMPACT -> R.layout.widget_compact
            OverlayMode.STANDARD -> R.layout.widget_standard
            OverlayMode.EXPANDED -> R.layout.widget_expanded
        }
        val card = LayoutInflater.from(context).inflate(layout, wrapper, false)
        scoreView = card
        val width = overlayWidth(overlayMode)
        wrapper.addView(toolbar, LinearLayout.LayoutParams(width, dp(49)))
        wrapper.addView(card, LinearLayout.LayoutParams(width, overlayHeight(overlayMode)))
        return wrapper
    }

    private fun controlButton(label: String, action: () -> Unit) = TextView(context).apply {
        text = label
        gravity = Gravity.CENTER
        setTextColor(Color.rgb(198, 255, 69))
        textSize = 10f
        typeface = Typeface.DEFAULT_BOLD
        isClickable = true
        isFocusable = true
        minWidth = dp(44)
        minHeight = dp(44)
        setOnClickListener { action() }
    }

    private fun attachDrag(handle: View) {
        var initialX = 0
        var initialY = 0
        var initialTouchX = 0f
        var initialTouchY = 0f
        var pressTimestamp = 0L
        var dragging = false
        handle.setOnTouchListener { _, event ->
            val layout = params ?: return@setOnTouchListener false
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    edgeAnimator?.cancel()
                    initialX = layout.x
                    initialY = layout.y
                    initialTouchX = event.rawX
                    initialTouchY = event.rawY
                    pressTimestamp = event.eventTime
                    dragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - initialTouchX
                    val dy = event.rawY - initialTouchY
                    if (!dragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) dragging = true
                    if (dragging) {
                        layout.x = initialX + dx.roundToInt()
                        layout.y = initialY + dy.roundToInt()
                        clamp(layout)
                        container?.let { windowManager.updateViewLayout(it, layout) }
                    }
                    true
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    if (dragging) {
                        snapToNearestEdge()
                    } else if (event.eventTime - pressTimestamp < 250) {
                        handle.performClick()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun snapToNearestEdge() {
        val view = container ?: return
        val layout = params ?: return
        val safe = safeBounds()
        val left = safe.left + dp(6)
        val right = (safe.right - view.width - dp(6)).coerceAtLeast(left)
        val destination = if (layout.x + view.width / 2 < safe.centerX()) left else right
        edgeAnimator?.cancel()
        edgeAnimator = ValueAnimator.ofInt(layout.x, destination).apply {
            duration = 180
            addUpdateListener {
                layout.x = it.animatedValue as Int
                clamp(layout)
                runCatching { windowManager.updateViewLayout(view, layout) }
            }
            doOnEnd { persistPosition() }
            start()
        }
    }

    private fun ValueAnimator.doOnEnd(action: () -> Unit) {
        addListener(object : android.animation.AnimatorListenerAdapter() {
            override fun onAnimationEnd(animation: android.animation.Animator) = action()
        })
    }

    private fun clampAndApply() {
        val view = container ?: return
        val layout = params ?: return
        clamp(layout)
        runCatching { windowManager.updateViewLayout(view, layout) }
        persistPosition()
    }

    private fun clamp(layout: WindowManager.LayoutParams) {
        val view = container ?: return
        val safe = safeBounds()
        layout.x = layout.x.coerceIn(safe.left, (safe.right - view.width).coerceAtLeast(safe.left))
        layout.y = layout.y.coerceIn(safe.top, (safe.bottom - view.height).coerceAtLeast(safe.top))
    }

    private fun safeBounds(): Rect {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val metrics = windowManager.currentWindowMetrics
            val insets: Insets = metrics.windowInsets.getInsetsIgnoringVisibility(
                WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout(),
            )
            return Rect(
                insets.left,
                insets.top,
                metrics.bounds.width() - insets.right,
                metrics.bounds.height() - insets.bottom,
            )
        }
        @Suppress("DEPRECATION")
        val metrics = android.util.DisplayMetrics().also { windowManager.defaultDisplay.getMetrics(it) }
        return Rect(0, 0, metrics.widthPixels, metrics.heightPixels)
    }

    private fun persistPosition() {
        val layout = params ?: return
        scope.launch { positionStore.savePosition(mode, layout.x, layout.y) }
    }

    private fun removeView(savePosition: Boolean) {
        edgeAnimator?.cancel()
        if (savePosition) persistPosition()
        container?.let { runCatching { windowManager.removeViewImmediate(it) } }
        container = null
        scoreView = null
        params = null
    }

    private fun overlayWidth(overlayMode: OverlayMode): Int {
        val safeWidth = safeBounds().width() - dp(16)
        val desired = when (overlayMode) {
            OverlayMode.COMPACT -> dp(330)
            OverlayMode.STANDARD -> dp(380)
            OverlayMode.EXPANDED -> dp(430)
        }
        return desired.coerceAtMost(safeWidth)
    }

    private fun overlayHeight(overlayMode: OverlayMode): Int {
        val desired = when (overlayMode) {
            OverlayMode.COMPACT -> dp(150)
            OverlayMode.STANDARD -> dp(245)
            OverlayMode.EXPANDED -> dp(310)
        }
        return desired.coerceAtMost(safeBounds().height() - dp(61)).coerceAtLeast(dp(120))
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).roundToInt()
}
