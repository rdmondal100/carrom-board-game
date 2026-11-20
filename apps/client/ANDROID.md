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

## 7. Ads (AdMob, spec 13)

Android only; the web build shows no ads. Dev and debug builds use Google's **test** ids, so
clicking them is safe.

**AdMob console (once):**
1. Create the app and three ad units: rewarded, interstitial, banner (banner only if you will
   turn on the menu banner).
2. Rewarded unit → *Server-side verification* → callback URL `https://<your API>/ads/ssv`.
   Set the reward to 25 coins (the server pays `ADS_CONFIG.rewardedCoins` whatever AdMob says).
3. *Privacy & messaging* → create a GDPR message (and others you need). The app shows Google's
   consent form (UMP) at start when it is required; no ad is requested before it.

**Release build:**
- App id for Gradle: `CARROM_ADMOB_APP_ID=ca-app-pub-...~...` (env var, or `-PcarromAdmobAppId=`).
  Without it the build uses Google's test app id.
- Ad unit ids in `.env.android`: `VITE_ADMOB_REWARDED_ID`, `VITE_ADMOB_INTERSTITIAL_ID`,
  `VITE_ADMOB_BANNER_ID`. All three must be set, or the build falls back to test ids.
- `VITE_ADS_MENU_BANNER=true` turns on a small banner on menu screens (never on the game screen).

**Manual check (spec 13), with test ids:**
- [ ] A fresh install in an EEA locale/VPN shows the consent form before any ad.
- [ ] Shop → "Watch an ad for 25 coins": the ad plays; the balance goes up by 25 within a few
      seconds (needs the API reachable by Google for SSV). The 6th ad of the day isn't offered.
- [ ] Closing the rewarded ad early gives no coins.
- [ ] Finish 3 games: leaving the 3rd end screen shows one interstitial; the next one comes only
      after 3 more games *and* 3 minutes. No ad on app start or during a match.

## 8. Coin packs (Google Play Billing, spec 14)

Android only; the web Shop says packs are "available in the Android app". The app never credits
coins itself: it sends the purchase token to `POST /iap/verify`, the server checks it with the
Play Developer API, credits the pack once, then consumes it.

**Play Console (once):**
1. The app (`com.carromadda.app`) must be uploaded to a track (internal testing is enough) before
   products can be created.
2. *Monetize → Products → In-app products*: create `coins_500`, `coins_1200`, `coins_2600`
   (one-time, consumable use). Set prices in BDT; the app shows Play's localized price.
3. *Google Cloud*: create a service account, make a JSON key, enable the
   **Google Play Android Developer API** for that project.
4. *Play Console → Users and permissions*: invite the service account's email and grant it
   **View financial data** and **Manage orders and subscriptions** for this app.
   New permissions can take up to a day to start working.
5. *Settings → License testing*: add the tester Google accounts (they pay with test cards).

**Server env** (`apps/server/.env`): `PLAY_PACKAGE_NAME=com.carromadda.app` and
`PLAY_SERVICE_ACCOUNT_JSON=` the key file's JSON on **one line**. Leave both empty to keep
purchases off (`/iap/verify` → 503). Never commit the key.

**Pending payments:** a slow payment method leaves the purchase pending; the server answers 202 and
credits nothing. On every app start (once signed in) the app sends Play's unfinished purchases again,
so the pack is credited after the payment completes. A purchase made while signed in to one account
can't be claimed by another (Play's account id = user id).

**Manual check (spec 14), on the internal testing track with a license tester:**
- [ ] Shop shows three packs with Play's prices (৳).
- [ ] Buying `coins_500` with the "always approves" test card adds 500 coins; the same pack can be
      bought again right away (it was consumed).
- [ ] "Slow test card, approves after a few minutes": the toast says pending; after it approves,
      closing and reopening the app credits the coins once.
- [ ] Closing the purchase sheet gives nothing and shows "Purchase not completed".
- [ ] The web Shop shows the Android-only message.
