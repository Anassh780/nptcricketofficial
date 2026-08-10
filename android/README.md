# CricVault DPL 6 Android companion

This module contains two separate native Android features connected to the existing Firebase Realtime Database score at `dpl6/liveScore`:

1. A draggable system overlay using `TYPE_APPLICATION_OVERLAY`. It remains visible above other apps only after the user explicitly grants Android's **Display over other apps** permission.
2. Three launcher-controlled AppWidgets (Compact, Standard, Expanded). They are normal home-screen widgets and never substitute for the floating overlay.

The web entry point is the verified HTTPS pattern:

```text
https://nptcricketofficial.vercel.app/open/live-score/{matchId}?mode=floating&size=compact
https://nptcricketofficial.vercel.app/open/live-score/{matchId}?mode=pin&size=compact
```

`size` accepts only `compact`, `standard`, or `expanded`. The Android entry activity rejects other hosts, paths, modes, sizes, and malformed match IDs. No authentication token or score payload is carried in the URL.

## Build

1. Install Android Studio and Android SDK 35.
2. Open this `android` directory.
3. Allow Gradle sync to finish.
4. Run `gradlew.bat assembleDebug lintDebug testDebugUnitTest`.
5. Install `app/build/outputs/apk/debug/app-debug.apk` on a device.

The Firebase file must remain at `app/google-services.json`; it contains a client for `com.cricvault.dpl6`.

## App Link signing

Android verifies the website association against the certificate that signed the installed APK. Debug and release certificates have different SHA-256 fingerprints. The checked-in `public/.well-known/assetlinks.json` includes this machine's debug certificate (`82:FF:D2:C0:86:E6:EC:E3:3E:8A:CE:94:53:5F:12:48:D7:A6:61:AF:9F:79:1A:C2:37:D9:32:2A:DB:84:01:11`) for direct testing. Before publishing through Google Play, add the **Play App Signing** SHA-256 fingerprint from Play Console to that same array and redeploy the website.

Verification commands:

```text
adb shell pm set-app-links --package com.cricvault.dpl6 0 all
adb shell pm verify-app-links --re-verify com.cricvault.dpl6
adb shell pm get-app-links com.cricvault.dpl6
adb shell am start -a android.intent.action.VIEW -c android.intent.category.BROWSABLE -d "https://nptcricketofficial.vercel.app/open/live-score/live?mode=floating&size=compact"
```

## Runtime behavior

- The entry activity explains overlay access and opens only Android's official permission page.
- The foreground service starts while that activity is visible, shows one ongoing notification, and uses the truthful `specialUse` subtype declaration required by the current target SDK.
- One Firebase listener feeds the selected Compact, Standard, or Expanded overlay presentation.
- Dragging updates the existing WindowManager entry instead of recreating it.
- DataStore keeps an independent last position for each size.
- Close and notification Stop remove the window, cancel score collection, remove the notification, and clear the active session.
- Process death does not silently relaunch the overlay. The user starts it again from the website, app, or notification where Android permits.
