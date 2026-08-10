package com.cricvault.dpl6.storage

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.cricvault.dpl6.model.OverlayMode
import kotlinx.coroutines.flow.first

private val Context.overlayDataStore by preferencesDataStore(name = "floating_score")

data class StoredPosition(val x: Int, val y: Int)

class OverlayPositionStore(private val context: Context) {
    private fun xKey(mode: OverlayMode) = intPreferencesKey("${mode.wireValue}_x")
    private fun yKey(mode: OverlayMode) = intPreferencesKey("${mode.wireValue}_y")
    private fun setKey(mode: OverlayMode) = booleanPreferencesKey("${mode.wireValue}_position_set")

    suspend fun position(mode: OverlayMode): StoredPosition? {
        val values = context.overlayDataStore.data.first()
        if (values[setKey(mode)] != true) return null
        return StoredPosition(values[xKey(mode)] ?: 0, values[yKey(mode)] ?: 0)
    }

    suspend fun savePosition(mode: OverlayMode, x: Int, y: Int) {
        context.overlayDataStore.edit {
            it[xKey(mode)] = x
            it[yKey(mode)] = y
            it[setKey(mode)] = true
        }
    }

    suspend fun saveActive(matchId: String, mode: OverlayMode) {
        context.overlayDataStore.edit {
            it[stringPreferencesKey("active_match_id")] = matchId
            it[stringPreferencesKey("active_mode")] = mode.wireValue
        }
    }

    suspend fun clearActive() {
        context.overlayDataStore.edit {
            it.remove(stringPreferencesKey("active_match_id"))
            it.remove(stringPreferencesKey("active_mode"))
        }
    }
}
