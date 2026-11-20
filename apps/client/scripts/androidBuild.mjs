// APP-1: run a Gradle task with the wrapper (gradlew.bat on Windows); default: a debug APK.
// Run after `android:sync`. Output: android/app/build/outputs/apk/debug/app-debug.apk
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const androidDir = fileURLToPath(new URL('../android/', import.meta.url));
const win = process.platform === 'win32';
// Full path: cmd may be set not to look in the current folder.
const gradlew = join(androidDir, win ? 'gradlew.bat' : 'gradlew');
const task = process.argv[2] ?? 'assembleDebug';
const res = spawnSync(win ? `"${gradlew}"` : gradlew, [task], { cwd: androidDir, stdio: 'inherit', shell: win });
process.exit(res.status ?? 1);
