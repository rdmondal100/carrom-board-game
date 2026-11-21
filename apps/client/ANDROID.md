# The Android apps

The Android apps are the same client wrapped with Capacitor 8 (`capacitor.config.ts`,
`android/`). Since spec 16 one Gradle project builds several apps (**flavors**): one per
game plus the all-games hub. See §9 for what each flavor needs. App names come from
`src/constants/brand.ts` (the hub brand is still a placeholder, `HUB_NAME`).

| Flavor | applicationId | Web build | Release build |
|---|---|---|---|
| `carrom` | `com.carromadda.app` (spec 11, already fixed) | `VITE_APP_GAMES=carrom` | yes |
| `hub` | `com.carromadda.hub` | `VITE_APP_GAMES=all` | yes |
| `ludo` | `com.carromadda.ludo` | `VITE_APP_GAMES=ludo` | when spec 18 is done |
| `callbreak` | `com.carromadda.callbreak` | `VITE_APP_GAMES=callbreak` | when spec 19 is done |
| `nodipar` | `com.carromadda.nodipar` | `VITE_APP_GAMES=nodipar` | when spec 20 is done |

> **Change an app id before that app's first Play upload if you want another one.**
> After that upload it can never change. They live in `android/app/build.gradle` (`APP_FLAVORS`).
> The hub id should follow the hub brand once it is picked.

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
| `pnpm android <flavor> [task]` | HAPP-8: `node scripts/androidBuild.mjs`: flavor resources, web build for that flavor (`.env.android` + `.env.android.<flavor>`), `cap sync`, then Gradle. Task: `assembleDebug` (default), `assembleRelease`, `bundleDebug`, `bundleRelease`, or `sync` (no Gradle) |
| `pnpm android:sync` | = `pnpm android carrom sync` |
| `pnpm android:build` | = `pnpm android carrom assembleDebug` → `android/app/build/outputs/apk/carrom/debug/app-carrom-debug.apk` |
| `pnpm android:open` | open `android/` in Android Studio (pick the variant, e.g. `hubDebug`, in *Build Variants*) |
| `pnpm android:assets` | regenerate icons + splash from `assets/` (main = carrom's) |

Install a debug APK on a phone with USB debugging on:
`adb install -r android/app/build/outputs/apk/hub/debug/app-hub-debug.apk`

Android Studio's Run button uses whatever web build was synced last: run
`pnpm android <flavor> sync` first for the flavor you are about to run.

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
pnpm android carrom bundleRelease   # or: pnpm android hub bundleRelease
```

PowerShell: `$env:CARROM_KEYSTORE_FILE = "C:\keys\carrom-upload.jks"` (and so on).
One upload key can sign every flavor (each is still its own Play app).

Output: `android/app/build/outputs/bundle/carromRelease/app-carrom-release.aab`. Check it is
signed: `jarsigner -verify android/app/build/outputs/bundle/carromRelease/app-carrom-release.aab`.
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
- App id for Gradle: `CARROM_ADMOB_APP_ID=ca-app-pub-...~...` (env var, or `-PcarromAdmobAppId=`); other apps: §9.
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

**Server env** (`apps/server/.env`): `PLAY_PACKAGE_NAMES=com.carromadda.app,com.carromadda.hub`
(every app that sells packs, comma list; spec 16) and `PLAY_SERVICE_ACCOUNT_JSON=` the key file's
JSON on **one line**. Leave both empty to keep purchases off (`/iap/verify` → 503). Never commit the key.
The app sends its own package id with each purchase; a package not in the list gets 400.

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

## 9. One app per game + the hub app (spec 16)

Every flavor is a separate app on Play, so each one needs its own setup. Do it for `carrom`
and `hub` now; for `ludo`, `callbreak` and `nodipar` when their spec is done (their release
builds are switched off until then: `RELEASE_FLAVORS` in `build.gradle` and `scripts/androidBuild.mjs`).

Per flavor:

1. **Play listing**: Play Console → *Create app* with the flavor's applicationId (table at the top).
   Ship the per-game apps first and the hub app later, and give the hub real extra value (all
   games, one wallet, friends) so it doesn't trip Play's repetitive-content policy.
2. **Products** (only apps that sell coin packs): create `coins_500`, `coins_1200`, `coins_2600`
   in that app (§8). Add its package to the server's `PLAY_PACKAGE_NAMES`, and give the service
   account the same permissions for that app.
3. **AdMob**: add the app in AdMob and make its rewarded, interstitial and (optional) banner units.
   - App id → Gradle: env `<FLAVOR>_ADMOB_APP_ID` (e.g. `HUB_ADMOB_APP_ID=ca-app-pub-...~...`)
     or `-P<flavor>AdmobAppId=`. Unset = Google's test app id.
   - Unit ids → `apps/client/.env.android.<flavor>` (gitignored; overrides `.env.android`):
     `VITE_ADMOB_REWARDED_ID`, `VITE_ADMOB_INTERSTITIAL_ID`, `VITE_ADMOB_BANNER_ID`.
   - The SSV callback URL is the same server for every app.
4. **Google sign-in**: in the *same* Google Cloud project, add an Android OAuth client with the
   flavor's package and SHA-1 (debug and upload/Play signing keys). The server needs no change: the
   app still asks for an ID token for the web client.
5. **Signing**: the same upload keystore works for all (§5). Enrol each app in Play App Signing.
6. **Icon and splash**: `src/<flavor>/res/` overrides `main`. For now the non-carrom apps show
   main's foreground on their own colour (adaptive icon only; pre-Android 8 shows carrom's icon)
   and carrom's splash. For real art, generate it with `pnpm android:assets` from that app's
   `assets/` files and move the generated `mipmap-*` / `drawable*` folders from `src/main/res`
   into `src/<flavor>/res` (then regenerate main from carrom's art).
7. **Name**: `src/<flavor>/res/values*/strings.xml` are written by the build script from
   `src/constants/brand.ts` (`values-bn` = the Bangla launcher name). Change names in brand.ts.

**Manual check (spec 16):**
- [ ] The web hub on a phone browser: game cards, carrom plays, the shop has a Carrom tab and "All games".
- [ ] The carrom app (`pnpm android carrom assembleDebug`) opens straight into carrom; "More games" links to the web hub.
- [ ] The hub app (`pnpm android hub assembleDebug`) shows every game (Ludo, Callbreak, Nodi Par as "coming soon"),
      installs next to the carrom app, and has its own name and icon colour.
- [ ] A coin pack bought in the hub app is credited (its package is in `PLAY_PACKAGE_NAMES`).

## 10. Voice chat (spec 17)

Voice is WebRTC audio inside the WebView: Opus mono at about 24 kbps, peer to peer between the
people in a room (max 3 links each). Signalling rides on the room connection; the server never
hears or records any audio.

### 10.1 Android

- `AndroidManifest.xml` declares `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` (+ an optional
  microphone feature, so phones without one can still install). Nothing is asked at start: the
  first mic tap calls `getUserMedia`, the WebView asks Capacitor, and Capacitor shows Android's
  permission dialog. "Don't allow" → one toast, mic stays off, the game goes on.
- Audio follows Android's call routing: speaker, or the wired / Bluetooth headset when one is
  connected (that is what `MODIFY_AUDIO_SETTINGS` is for).
- When the app goes to the background the mic is muted and other players' audio is silenced; it
  comes back when the app returns. Leaving the room (or closing the page) closes every link and
  stops the mic.
- Play Console → *App content*: declare the microphone use (voice chat between players; not
  recorded) and keep the in-game block and report buttons — Play's user-generated content policy.

### 10.2 TURN server (coturn)

Most Bangladeshi mobile networks put phones behind carrier NAT, where peer to peer fails without a
relay. Run coturn on a small VPS with a public IP (1 vCPU is plenty to start; a relayed voice link
costs ~3 kB/s each way).

1. Install: `sudo apt install coturn`, and set `TURNSERVER_ENABLED=1` in `/etc/default/coturn`.
2. `/etc/turnserver.conf` (REST shared-secret scheme; the server makes 1-hour credentials):
   ```
   listening-port=3478
   tls-listening-port=5349
   fingerprint
   use-auth-secret
   static-auth-secret=<long random string, the same as the API's TURN_SECRET>
   realm=turn.example.com
   total-quota=300
   stale-nonce=600
   no-multicast-peers
   no-cli
   # Your certificate for turns: (e.g. from certbot for turn.example.com)
   cert=/etc/letsencrypt/live/turn.example.com/fullchain.pem
   pkey=/etc/letsencrypt/live/turn.example.com/privkey.pem
   # Never relay to private networks.
   denied-peer-ip=10.0.0.0-10.255.255.255
   denied-peer-ip=172.16.0.0-172.31.255.255
   denied-peer-ip=192.168.0.0-192.168.255.255
   denied-peer-ip=127.0.0.0-127.255.255.255
   ```
   Behind a cloud NAT (AWS, GCP…) also set `external-ip=<public ip>/<private ip>`.
3. Firewall: open 3478 UDP+TCP, 5349 TCP, and the relay range UDP 49152–65535.
4. `sudo systemctl restart coturn`.
5. API env (`apps/server/.env`):
   ```
   TURN_URLS=turn:turn.example.com:3478?transport=udp,turn:turn.example.com:3478?transport=tcp,turns:turn.example.com:5349?transport=tcp
   TURN_SECRET=<the same static-auth-secret>
   ```
   Both or neither; the server refuses to start with only one. `GET /voice/ice` (signed in) then
   returns STUN + TURN with `username = <expiry>:<userId>` and an HMAC-SHA1 password. The secret
   itself never reaches a client.
6. Check: open <https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/>, paste
   the TURN URL with a username/password from `/voice/ice`, *Gather candidates*: a `relay`
   candidate means TURN works.

**Manual check (spec 17):**
- [ ] Two phones on **different mobile networks** (e.g. Grameenphone and Robi, Wi-Fi off) join a
      private carrom room by invite link. Both tap the mic: they hear each other in the lobby and
      during the game. In `chrome://webrtc-internals` (desktop) or the coturn log, the link is relayed.
- [ ] The first mic tap shows Android's permission dialog; "Don't allow" → one toast, the game goes on.
- [ ] Speaking rings light up; per-player mute silences only that player.
- [ ] Wired headset and a Bluetooth headset: audio switches to them and back to the speaker.
- [ ] App to the background: the other phone hears nothing; back to the app: voice returns.
- [ ] Ranked game: no voice until both tap "Turn on voice".
- [ ] Block a player: their voice stops at once and stays off in the next room; report → toast.
- [ ] Settings → Voice chat → Off: no mic button and no voice in any room; Push to talk works by holding.
