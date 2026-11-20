# Carrom Adda on Android

The Android app is the same client wrapped with Capacitor 8 (`capacitor.config.ts`,
`android/`). App id `com.carromadda.app`, name "Carrom Adda".

> **Change the app id before the first Play upload if you want another one.**
> After that upload it can never change. It lives in `capacitor.config.ts`
> (`appId`) and `android/app/build.gradle` (`namespace`, `applicationId`).

## 1. One-time setup

- Android Studio (it brings the Android SDK and a JDK).
- `JAVA_HOME` pointing at a JDK 21 or newer. Android Studio's own works:
  - Windows (Git Bash): `export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"`
  - PowerShell: `$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"`
  - The Gradle wrapper is 9.2.1 because Android Studio's JDK is 25 (Gradle 8 can't run on it).
- `ANDROID_HOME` = the SDK folder (Windows: `%LOCALAPPDATA%\Android\Sdk`).
- `apps/client/.env.android` — copy `.env.android.example` and fill in:
  - `VITE_API_BASE_URL` = the server as the **phone** sees it. Never `localhost`
    (the build stops if it is). Use **https**: the app's page is `https://localhost`
    and Android blocks plain `http` calls from it. For a quick test on your own
    PC, put the dev server behind an https tunnel (e.g. cloudflared, ngrok).
  - `VITE_GOOGLE_CLIENT_ID` = the Google **web** client ID (same as on the web).
- Server `.env`: `CORS_ORIGIN` must include `https://localhost` (Android app) and
  `capacitor://localhost` (iOS later), as in `apps/server/.env.example`.

## 2. Everyday commands (from `apps/client`)

| Command | What it does |
|---|---|
| `pnpm android:sync` | `vite build --mode android` (reads `.env.android`) + copy into `android/` |
| `pnpm android:build` | sync + debug APK → `android/app/build/outputs/apk/debug/app-debug.apk` |
| `pnpm android:open` | open `android/` in Android Studio (run on a phone from there) |
| `pnpm android:assets` | regenerate icons + splash from `assets/` |

Install the debug APK on a phone with USB debugging on:
`adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

## 3. Icon and splash

Source art lives in `apps/client/assets/` (placeholders for now: a board drawn from shapes):

- `icon.png` 1024×1024 (legacy icon), `icon-foreground.png` + `icon-background.png`
  1024×1024 (adaptive icon; keep the art inside the middle ~60 %),
- `splash.png` + `splash-dark.png` 2732×2732 (art small, in the middle).

Replace them with real art, run `pnpm android:assets`, and commit the changed
files under `android/app/src/main/res/`.

## 4. Google sign-in on Android

The app uses the native account picker (`@capgo/capacitor-social-login`) and asks
Google for an ID token for the **web** client ID, so the server's
`GOOGLE_CLIENT_IDS` needs no new entry. Google still has to know the app:

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID →
   **Android**. Package name `com.carromadda.app`.
2. SHA-1 of the signing key. Make one Android client per key:
   - debug key: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - your upload key (section 5): `keytool -list -v -keystore carrom-upload.jks -alias carrom`
   - Play App Signing key: Play Console → Test and release → App integrity → copy its SHA-1.
3. Nothing to paste into the app: the Android clients only have to exist in the
   same Google Cloud project as the web client.

If the picker opens and then fails with "developer error", the SHA-1 or package
name doesn't match.

## 5. Signed release (AAB for Play)

### 5.1 Create the upload keystore (once)

```sh
keytool -genkeypair -v -keystore carrom-upload.jks -alias carrom \
  -keyalg RSA -keysize 2048 -validity 10000
```

Keep `carrom-upload.jks` and its passwords **outside the repo** (password
manager + a backup). `*.jks`, `*.keystore` and `.env.android` are gitignored.
With Play App Signing (the default) this is only the upload key; if it is lost,
Play support can reset it.

### 5.2 Bump the version

In `android/app/build.gradle` → `defaultConfig`:

- `versionCode` + 1 for **every** upload (Play refuses a code it has seen),
- `versionName` = what players see, e.g. `0.2.0`.

### 5.3 Build

Gradle signs only when these env vars are set (no secret ever goes in a file in git):

```sh
export CARROM_KEYSTORE_FILE=/full/path/to/carrom-upload.jks
export CARROM_KEYSTORE_PASSWORD=...
export CARROM_KEY_ALIAS=carrom
export CARROM_KEY_PASSWORD=...
pnpm android:sync
node scripts/androidBuild.mjs bundleRelease
```

PowerShell: `$env:CARROM_KEYSTORE_FILE = "C:\keys\carrom-upload.jks"` (and so on).

Output: `android/app/build/outputs/bundle/release/app-release.aab`. Check it is
signed: `jarsigner -verify android/app/build/outputs/bundle/release/app-release.aab`.
Upload it in Play Console (internal testing first).

## 6. Manual check on a real phone (spec 11)

- [ ] Back button: in a local match → pause menu; back again → resumes; in an
      online match → "leave?" dialog; in a menu → previous screen; on Home → "exit?"
- [ ] The app stays portrait when the phone is turned
- [ ] Notch / gesture bar: header and bottom buttons are not covered
- [ ] In a match the status and navigation bars hide (swipe shows them briefly)
      and the screen doesn't sleep; leaving the match brings the bars back
- [ ] Haptics on striker hit and pocket; none with Settings → Vibration off
- [ ] Google login with the native picker (debug key's SHA-1 registered)
- [ ] Airplane mode: a Vs-bot game works; Online / Ranked show the offline message
- [ ] An online game against another device
