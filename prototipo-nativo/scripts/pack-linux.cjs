const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const appDir = path.join(root, 'deploy', 'linux', 'build', 'SamnatSynthNative.AppDir');
const outputDir = path.join(root, 'release-linux');
const stage = path.join(root, 'build-linux');
const modules = path.join(root, 'node_modules');
const appName = 'SamnatSynthNative';
const qode = path.join(modules, '@nodegui', 'qode', 'binaries', 'qode');
const appImageTool = path.join(root, 'build-linuxdeployqt', 'squashfs-root', 'usr', 'bin', 'appimagetool');
const alsaPluginDir = '/usr/lib/x86_64-linux-gnu/alsa-lib';
const pulseAlsaPlugin = path.join(alsaPluginDir, 'libasound_module_pcm_pulse.so');
const aplayLookup = spawnSync('sh', ['-c', 'command -v aplay'], { encoding: 'utf8' });
const paplayLookup = spawnSync('sh', ['-c', 'command -v paplay'], { encoding: 'utf8' });
const pactlLookup = spawnSync('sh', ['-c', 'command -v pactl'], { encoding: 'utf8' });
const fluidsynthLookup = spawnSync('sh', ['-c', 'command -v fluidsynth'], { encoding: 'utf8' });

if (process.platform !== 'linux' || process.arch !== 'x64') {
  throw new Error('This build script produces a Linux x86_64 AppImage.');
}
if (aplayLookup.status !== 0 || !aplayLookup.stdout.trim()) {
  throw new Error('Could not find aplay, required to include the Linux audio backend.');
}
if (paplayLookup.status !== 0 || !paplayLookup.stdout.trim()) {
  throw new Error('Could not find paplay, required for direct PulseAudio/PipeWire output diagnostics.');
}
if (pactlLookup.status !== 0 || !pactlLookup.stdout.trim()) {
  throw new Error('Could not find pactl, required to detect PulseAudio/PipeWire sinks.');
}
if (fluidsynthLookup.status !== 0 || !fluidsynthLookup.stdout.trim()) {
  throw new Error('Could not find the native fluidsynth executable required by the app audio engine.');
}
if (!fs.existsSync(pulseAlsaPlugin)) {
  throw new Error(`Could not find the ALSA PulseAudio plugin required by the direct output test: ${pulseAlsaPlugin}`);
}
for (const required of [stage, qode, appImageTool, aplayLookup.stdout && aplayLookup.stdout.trim(), paplayLookup.stdout && paplayLookup.stdout.trim(), pactlLookup.stdout && pactlLookup.stdout.trim(), fluidsynthLookup.stdout && fluidsynthLookup.stdout.trim()]) {
  if (!fs.existsSync(required)) throw new Error(`Missing build input: ${required}`);
}

fs.rmSync(appDir, { recursive: true, force: true });
fs.mkdirSync(appDir, { recursive: true });
fs.cpSync(path.join(root, 'deploy', 'linux', appName), appDir, { recursive: true });
fs.cpSync(stage, path.join(appDir, 'dist'), { recursive: true, dereference: true });
fs.copyFileSync(qode, path.join(appDir, 'qode'));
fs.chmodSync(path.join(appDir, 'qode'), 0o755);
const linkerCache = spawnSync('ldconfig', ['-p'], { encoding: 'utf8' });
const alsaLibrary = linkerCache.stdout && linkerCache.stdout.match(/libasound\.so\.2\s+\([^)]*\)\s+=>\s+(\S+)/);
if (!alsaLibrary) throw new Error('Could not find the system ALSA runtime library required by MIDI.');
fs.mkdirSync(path.join(appDir, 'lib'), { recursive: true });
fs.copyFileSync(alsaLibrary[1], path.join(appDir, 'lib', 'libasound.so.2'));
fs.mkdirSync(path.join(appDir, 'bin'), { recursive: true });
fs.copyFileSync(aplayLookup.stdout.trim(), path.join(appDir, 'bin', 'aplay'));
fs.chmodSync(path.join(appDir, 'bin', 'aplay'), 0o755);
fs.copyFileSync(paplayLookup.stdout.trim(), path.join(appDir, 'bin', 'paplay'));
fs.chmodSync(path.join(appDir, 'bin', 'paplay'), 0o755);
fs.copyFileSync(pactlLookup.stdout.trim(), path.join(appDir, 'bin', 'pactl'));
fs.chmodSync(path.join(appDir, 'bin', 'pactl'), 0o755);
fs.copyFileSync(fluidsynthLookup.stdout.trim(), path.join(appDir, 'bin', 'fluidsynth'));
fs.chmodSync(path.join(appDir, 'bin', 'fluidsynth'), 0o755);
fs.cpSync('/usr/share/alsa', path.join(appDir, 'share', 'alsa'), { recursive: true });
fs.cpSync(alsaPluginDir, path.join(appDir, 'lib', 'alsa-lib'), { recursive: true });

// Bundle FluidSynth and the client-side audio libraries used by paplay, pactl,
// and ALSA's Pulse plugin. Keep glibc from the host to preserve AppImage ABI.
const audioLibDir = path.join(appDir, 'lib', 'audio');
fs.mkdirSync(audioLibDir, { recursive: true });
const glibcRuntime = /^(?:lib(?:c|m|pthread|dl|rt|resolv|util|anl|nsl)\.so(?:\.|$)|ld-linux)/;
const audioBinaries = [
  fluidsynthLookup.stdout.trim(), aplayLookup.stdout.trim(), paplayLookup.stdout.trim(),
  pactlLookup.stdout.trim(), pulseAlsaPlugin
];
const copiedLibraries = new Set();
for (const binary of audioBinaries) {
  const dependencies = spawnSync('ldd', [binary], { encoding: 'utf8' });
  if (dependencies.status !== 0 || !dependencies.stdout || /not found/.test(dependencies.stdout)) {
    throw new Error(`Could not resolve audio runtime dependencies for ${binary}: ${dependencies.stderr || dependencies.stdout || dependencies.error}`);
  }
  const resolvedPaths = dependencies.stdout.split(/\r?\n/).flatMap(line => {
    const mapped = line.match(/=>\s+(\/\S+)/);
    const direct = line.match(/^\s*(\/\S+)\s+\(/);
    return mapped ? [mapped[1]] : direct ? [direct[1]] : [];
  });
  for (const source of resolvedPaths) {
    const filename = path.basename(source);
    if (glibcRuntime.test(filename) || copiedLibraries.has(filename)) continue;
    const destination = path.join(audioLibDir, filename);
    if (!fs.existsSync(destination)) fs.copyFileSync(source, destination);
    copiedLibraries.add(filename);
  }
}

const appRun = `#!/bin/sh
HERE="$(dirname "$(readlink -f "$0")")"
QT_HOME="$HERE/dist/node_modules/@nodegui/nodegui/miniqt/6.4.1/gcc_64"
export LD_LIBRARY_PATH="$QT_HOME/lib:$HERE/lib:\${LD_LIBRARY_PATH:-}"
export PATH="$HERE/bin:\${PATH:-/usr/bin:/bin}"
export ALSA_CONFIG_PATH="$HERE/share/alsa/alsa.conf"
export ALSA_PLUGIN_DIR="$HERE/lib/alsa-lib"
export SAMNAT_AUDIO_LIB_DIR="$HERE/lib/audio"
export QT_PLUGIN_PATH="$QT_HOME/plugins"
export QT_QPA_PLATFORM_PLUGIN_PATH="$QT_HOME/plugins/platforms"
export QT_QPA_PLATFORM="\${QT_QPA_PLATFORM:-xcb}"
cd "$HERE"
exec "$HERE/qode" "$HERE/dist/index.js" "$@"
`;
fs.writeFileSync(path.join(appDir, 'AppRun'), appRun, { mode: 0o755 });
fs.chmodSync(path.join(appDir, 'AppRun'), 0o755);
fs.mkdirSync(outputDir, { recursive: true });

const resultFile = path.join(outputDir, `${appName}-x86_64.AppImage`);
fs.rmSync(resultFile, { force: true });
const result = spawnSync(appImageTool, [appDir, resultFile], {
  cwd: root,
  env: { ...process.env, ARCH: 'x86_64' },
  stdio: 'inherit'
});
if (result.error) throw result.error;
if (result.status !== 0 || !fs.existsSync(resultFile)) {
  throw new Error(`AppImage creation failed (exit ${result.status}).`);
}
fs.chmodSync(resultFile, 0o755);
console.log(`AppImage ready: ${resultFile}`);
