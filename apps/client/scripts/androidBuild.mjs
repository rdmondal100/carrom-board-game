// HAPP-8: build one Android app flavor.
//   node scripts/androidBuild.mjs <flavor> [task]
//   flavor: carrom | ludo | callbreak | nodipar | hub
//   task:   assembleDebug (default) | assembleRelease | bundleDebug | bundleRelease | sync (web + cap sync only)
// Steps: write the flavor's launcher name/icon resources (from src/constants/brand.ts), build the web
// with that flavor's VITE_APP_GAMES and .env.android (+ optional .env.android.<flavor>, which wins),
// `cap sync android`, then Gradle `<assemble|bundle><Flavor><Debug|Release>`.
// Output: android/app/build/outputs/apk/<flavor>/<debug|release>/ (or bundle/<flavor>Release/).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
// Node strips the types itself (brand.ts is plain data).
import { GAME_APP_NAMES, HUB_NAME } from '../src/constants/brand.ts';

const clientDir = fileURLToPath(new URL('../', import.meta.url));
const androidDir = join(clientDir, 'android');
const win = process.platform === 'win32';

/** HAPP-7 the flavors in android/app/build.gradle; only RELEASE ones get release builds (same list there). */
const FLAVORS = ['carrom', 'ludo', 'callbreak', 'nodipar', 'hub'];
const RELEASE = ['carrom', 'hub'];
const TASKS = ['assembleDebug', 'assembleRelease', 'bundleDebug', 'bundleRelease', 'sync'];
/** Placeholder launcher-icon backgrounds until each app has its own art (carrom keeps main's icon). */
const ICON_BACKGROUNDS = { hub: '#7C3AED', ludo: '#DC2626', callbreak: '#15803D', nodipar: '#0369A1' };

function fail(msg) {
  console.error(`androidBuild: ${msg}`);
  process.exit(1);
}

const [flavor, task = 'assembleDebug'] = process.argv.slice(2);
if (!FLAVORS.includes(flavor)) fail(`flavor must be one of ${FLAVORS.join(', ')} (got "${flavor ?? ''}")`);
if (!TASKS.includes(task)) fail(`task must be one of ${TASKS.join(', ')} (got "${task}")`);
if (/Release$/.test(task) && !RELEASE.includes(flavor)) fail(`${flavor} has no release build yet (its game isn't playable)`);

const xml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, "\\'");

function write(path, text) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, text);
}

/** HAPP-7 launcher name (en + bn) and, for the non-carrom apps, a placeholder adaptive icon. */
function writeFlavorRes(name) {
  const res = join(androidDir, 'app', 'src', name, 'res');
  const label = name === 'hub' ? HUB_NAME : GAME_APP_NAMES[name];
  for (const [dir, text] of [['values', label.en], ['values-bn', label.bn]]) {
    write(join(res, dir, 'strings.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/androidBuild.mjs from src/constants/brand.ts; edit brand.ts, not this file. -->
<resources>
    <string name="app_name">${xml(text)}</string>
    <string name="title_activity_main">${xml(text)}</string>
</resources>
`);
  }
  const bg = ICON_BACKGROUNDS[name];
  if (!bg) return;
  write(join(res, 'values', 'flavor_colors.xml'), `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="flavor_icon_background">${bg}</color>
</resources>
`);
  const icon = `<?xml version="1.0" encoding="utf-8"?>
<!-- Placeholder: main's foreground on this app's colour. Replace with the app's own icon (see ANDROID.md §9). -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/flavor_icon_background" />
    <foreground>
        <inset android:drawable="@mipmap/ic_launcher_foreground" android:inset="16.7%" />
    </foreground>
</adaptive-icon>
`;
  write(join(res, 'mipmap-anydpi-v26', 'ic_launcher.xml'), icon);
  write(join(res, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), icon);
}

/** KEY=VALUE lines of an env file (no expansion); {} when it doesn't exist. */
function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

function run(cmd, args, cwd, env) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  // Windows: quote the full path (cmd may not look in the current folder) and go through the shell for .cmd/.bat.
  const res = spawnSync(win && cmd.includes(' ') ? `"${cmd}"` : cmd, args, { cwd, env, stdio: 'inherit', shell: win });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

for (const f of FLAVORS) writeFlavorRes(f);

// Process env beats .env files in Vite, so the flavor's own file overrides .env.android.
const env = {
  ...process.env,
  ...readEnvFile(join(clientDir, `.env.android.${flavor}`)),
  VITE_APP_GAMES: flavor === 'hub' ? 'all' : flavor,
};
run('pnpm', ['exec', 'tsc', '--noEmit'], clientDir, env);
run('pnpm', ['exec', 'vite', 'build', '--mode', 'android'], clientDir, env);
run('pnpm', ['exec', 'cap', 'sync', 'android'], clientDir, env);
if (task === 'sync') process.exit(0);

const cap = (s) => s[0].toUpperCase() + s.slice(1);
const [, verb, type] = /^(assemble|bundle)(Debug|Release)$/.exec(task);
run(join(androidDir, win ? 'gradlew.bat' : 'gradlew'), [`${verb}${cap(flavor)}${type}`], androidDir, env);
