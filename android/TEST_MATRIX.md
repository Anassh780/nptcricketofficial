# Android device test matrix

Automated build checks validate compilation, resources, lint, and unit tests. The following behaviors require a real device or emulator because Windows does not currently have an Android emulator/device attached.

| Test | API 26 | API 29 | API 31 | API 33 | API 34 | API 35+ |
|---|---:|---:|---:|---:|---:|---:|
| Permission not granted / explanation | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Grant / deny / revoke overlay access | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Start from verified website App Link | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Compact / Standard / Expanded overlay | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Drag to every edge and rotate | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Open another app and home screen | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Network loss / recovery / delayed state | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Delivery / wicket / innings / result update | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Close panel / Hide / Show / notification Stop | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Process death and explicit restart | Pending device test | Pending | Pending | Pending | Pending | Pending |
| Duplicate request / switch match | Pending device test | Pending | Pending | Pending | Pending | Pending |
| AppWidget pin accepted / refused | Pending device test | Pending | Pending | Pending | Pending | Pending |

Do not mark these rows passed without running them on the corresponding Android version. App Link verification also requires the deployed `assetlinks.json` and a fingerprint matching the APK actually installed on the device.
