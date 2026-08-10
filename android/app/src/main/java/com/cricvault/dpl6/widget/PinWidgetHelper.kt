package com.cricvault.dpl6.widget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import com.cricvault.dpl6.model.OverlayMode

object PinWidgetHelper {
    fun request(context: Context, mode: OverlayMode): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
        val manager = AppWidgetManager.getInstance(context)
        if (!manager.isRequestPinAppWidgetSupported) return false
        val provider = when (mode) {
            OverlayMode.COMPACT -> CompactWidgetProvider::class.java
            OverlayMode.STANDARD -> StandardWidgetProvider::class.java
            OverlayMode.EXPANDED -> ExpandedWidgetProvider::class.java
        }
        return manager.requestPinAppWidget(ComponentName(context, provider), null, null)
    }
}
