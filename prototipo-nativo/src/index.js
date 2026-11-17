const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { Worker } = require('worker_threads');
const {
  QApplication, QMainWindow, QWidget, QBoxLayout, Direction, QLabel,
  QPushButton, QSlider, QCheckBox, QFileDialog, FileMode, Orientation, QComboBox,
  QScrollArea, QLineEdit, QShortcut, QKeySequence
} = require('@nodegui/nodegui');

const CHANNELS = 8;
const DATA_DIR = path.join(os.homedir(), '.samnat-synth');
const SF_DIR = path.join(DATA_DIR, 'soundfonts');
const SCENE_FILE = path.join(DATA_DIR, 'scenes.json');
fs.mkdirSync(SF_DIR, { recursive: true });

const app = new QApplication();
const window = new QMainWindow();
window.setWindowTitle('SamNat Synth — Nativo');
window.resize(1050, 850);
window.setMinimumSize(760, 700);
const central = new QWidget();
const layout = new QBoxLayout(Direction.TopToBottom);
central.setLayout(layout);
layout.setContentsMargins(18, 14, 18, 14);
layout.setSpacing(12);
central.setInlineStyle('background-color: #f7f8fa; color: #1c1e21;');
window.setCentralWidget(central);

function label(text, style) {
  const widget = new QLabel();
  widget.setText(text);
  if (style) widget.setInlineStyle(style);
  return widget;
}
function button(text, handler) {
  const widget = new QPushButton();
  widget.setText(text);
  widget.setMinimumHeight(38);
  widget.setInlineStyle('padding: 8px 12px; border: 1px solid #d8dee8; border-radius: 8px; background: #ffffff; color: #1c1e21; font-weight: 600;');
  if (handler) widget.addEventListener('clicked', handler);
  return widget;
}
function slider(min, max, value, handler) {
  const widget = new QSlider();
  widget.setOrientation(Orientation.Horizontal);
  widget.setMinimum(min);
  widget.setMaximum(max);
  widget.setValue(value);
  widget.addEventListener('valueChanged', handler);
  return widget;
}
function horizontal(parent) {
  const line = new QWidget();
  const lineLayout = new QBoxLayout(Direction.LeftToRight);
  line.setLayout(lineLayout);
  lineLayout.setContentsMargins(0, 0, 0, 0);
  lineLayout.setSpacing(9);
  parent.addWidget(line);
  return lineLayout;
}

const header = new QWidget();
const headerLayout = new QBoxLayout(Direction.LeftToRight);
header.setLayout(headerLayout);
headerLayout.setContentsMargins(16, 10, 16, 10);
headerLayout.setSpacing(12);
header.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 12px;');
const titleBlock = new QWidget();
const titleLayout = new QBoxLayout(Direction.TopToBottom);
titleBlock.setLayout(titleLayout);
titleLayout.setContentsMargins(0, 0, 0, 0);
titleLayout.setSpacing(2);
titleLayout.addWidget(label('SamNat Synth', 'font-size: 22px; font-weight: 700; color: #1c1e21;'));
titleLayout.addWidget(label('Mixer MIDI · FluidSynth nativo · até 8 partes', 'font-size: 12px; color: #65676b;'));
const systemUsageLabel = label('CPU -- · RAM --', 'font-size: 11px; color: #475467;');
titleLayout.addWidget(systemUsageLabel);
let previousCpuTimes = null;
function updateSystemUsage() {
  try {
    const cpuLine = fs.readFileSync('/proc/stat', 'utf8').split('\n', 1)[0].trim().split(/\s+/);
    const times = cpuLine.slice(1).map(Number);
    const total = times.reduce((sum, value) => sum + value, 0);
    const idle = (times[3] || 0) + (times[4] || 0);
    let cpuText = '--';
    if (previousCpuTimes) {
      const totalDelta = total - previousCpuTimes.total;
      const idleDelta = idle - previousCpuTimes.idle;
      if (totalDelta > 0) cpuText = String(Math.round((1 - idleDelta / totalDelta) * 100));
    }
    previousCpuTimes = { total, idle };
    const memory = fs.readFileSync('/proc/meminfo', 'utf8');
    const totalKb = Number(memory.match(/^MemTotal:\s+(\d+)/m)?.[1] || 0);
    const availableKb = Number(memory.match(/^MemAvailable:\s+(\d+)/m)?.[1] || 0);
    const usedMb = Math.max(0, Math.round((totalKb - availableKb) / 1024));
    const totalMb = Math.round(totalKb / 1024);
    const ramPercent = totalKb > 0 ? Math.round((totalKb - availableKb) * 100 / totalKb) : 0;
    systemUsageLabel.setText(`CPU ${cpuText}% · RAM ${usedMb}/${totalMb} MiB (${ramPercent}%)`);
  } catch (_) {
    const totalMb = Math.round(os.totalmem() / 1048576);
    const usedMb = Math.round((os.totalmem() - os.freemem()) / 1048576);
    const ramPercent = totalMb > 0 ? Math.round(usedMb * 100 / totalMb) : 0;
    systemUsageLabel.setText(`CPU -- · RAM ${usedMb}/${totalMb} MiB (${ramPercent}%)`);
  }
}
updateSystemUsage();
const systemUsageTimer = setInterval(updateSystemUsage, 5000);
headerLayout.addWidget(titleBlock, 1);
const shutdownButton = button('Desligar');
shutdownButton.setInlineStyle('padding: 8px 16px; border: 1px solid #d92d20; border-radius: 8px; background: #fff5f4; color: #a12622; font-weight: 700;');
let shutdownArmed = false;
let shutdownTimer = null;
shutdownButton.addEventListener('clicked', () => {
  if (!shutdownArmed) {
    shutdownArmed = true;
    shutdownButton.setText('Confirmar desligamento');
    status.setText('Toque novamente em até 4 segundos para desligar o SamNat com segurança.');
    clearTimeout(shutdownTimer);
    shutdownTimer = setTimeout(() => {
      shutdownArmed = false;
      shutdownButton.setText('Desligar');
    }, 4000);
    return;
  }
  clearTimeout(shutdownTimer);
  shutdownArmed = false;
  shutdownButton.setEnabled(false);
  shutdownButton.setText('Desligando…');
  status.setText('Encerrando o sistema…');
  const poweroff = spawn('/sbin/poweroff', [], { detached: true, stdio: 'ignore' });
  poweroff.once('error', error => {
    shutdownButton.setEnabled(true);
    shutdownButton.setText('Desligar');
    status.setText(`Não foi possível desligar: ${error.message}`);
  });
  poweroff.unref();
});
headerLayout.addWidget(shutdownButton);
layout.addWidget(header);
const status = label('Inicializando áudio...', 'color: #165dba; padding: 10px 12px; background: #e7f3ff; border: 1px solid #cfe4ff; border-radius: 9px;');
layout.addWidget(status);

const audioPanel = new QWidget();
const audioPanelLayout = new QBoxLayout(Direction.TopToBottom);
audioPanel.setLayout(audioPanelLayout);
audioPanelLayout.setContentsMargins(12, 8, 12, 8);
audioPanelLayout.setSpacing(6);
audioPanel.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 11px;');
audioPanelLayout.addWidget(label('Saída e teste de áudio', 'font-size: 13px; font-weight: 700; color: #344054;'));
layout.addWidget(audioPanel);

const workspace = new QWidget();
const workspaceLayout = new QBoxLayout(Direction.LeftToRight);
workspace.setLayout(workspaceLayout);
workspaceLayout.setContentsMargins(0, 0, 0, 0);
workspaceLayout.setSpacing(12);
layout.addWidget(workspace, 1);
const sidePanel = new QWidget();
const sideLayout = new QBoxLayout(Direction.TopToBottom);
sidePanel.setLayout(sideLayout);
sideLayout.setContentsMargins(12, 12, 12, 12);
sideLayout.setSpacing(10);
sidePanel.setMinimumWidth(285);
sidePanel.setMaximumWidth(390);
sidePanel.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 12px;');
workspaceLayout.addWidget(sidePanel);
const mixerPanel = new QWidget();
const mixerLayout = new QBoxLayout(Direction.TopToBottom);
mixerPanel.setLayout(mixerLayout);
mixerLayout.setContentsMargins(0, 0, 0, 0);
mixerLayout.setSpacing(10);
workspaceLayout.addWidget(mixerPanel, 1);

// The AppImage launcher is a Qode preload and contains process.chdir(). Qode
// inherits that preload into worker threads unless startup args are cleared;
// process.chdir() is forbidden inside workers and aborts the audio engine.
const audioWorkerEnv = { ...process.env };
delete audioWorkerEnv.NODE_OPTIONS;
const worker = new Worker(path.join(__dirname, 'audio-worker.cjs'), {
  execArgv: [],
  env: audioWorkerEnv
});
let audioReady = false;
let audioStartupStage = 'Inicializando o motor local de áudio...';
let audioStartupTimer = null;
let audioWorkerOnline = false;
let pendingAudioOutput = null;
let audioWorkerFailure = null;
function writeAudioWorkerLog(details) {
  const filename = path.join(DATA_DIR, 'audio-worker.log');
  try {
    fs.appendFileSync(filename, `${new Date().toISOString()} ${details}\n`, 'utf8');
  } catch { /* Keep diagnostics from disrupting audio startup. */ }
  return filename;
}
function requestAudioOutput(output) {
  if (audioWorkerOnline) worker.postMessage({ type: 'audio-device', output });
  else pendingAudioOutput = output;
}
function armAudioStartupWatchdog() {
  clearTimeout(audioStartupTimer);
  audioStartupTimer = setTimeout(() => {
    if (!audioReady) {
      if (!audioWorkerOnline) {
        const requestedOutput = pendingAudioOutput ? ` Saída solicitada: ${pendingAudioOutput.label}.` : '';
        audioStartupStage = `A thread local de áudio não iniciou; o FluidSynth ainda não foi chamado.${requestedOutput}`;
        status.setText(audioStartupStage);
      } else {
        status.setText(`Tempo esgotado aguardando FluidSynth. Última etapa: ${audioStartupStage}`);
      }
    }
  }, 20000);
}
worker.on('online', () => {
  audioWorkerOnline = true;
  audioWorkerFailure = null;
  writeAudioWorkerLog('WORKER ONLINE');
  const output = pendingAudioOutput;
  pendingAudioOutput = null;
  audioStartupStage = output
    ? `Motor local pronto; abrindo FluidSynth em ${output.label}...`
    : 'Motor local de áudio pronto; aguardando saída selecionada.';
  status.setText(audioStartupStage);
  if (output) worker.postMessage({ type: 'audio-device', output });
});
armAudioStartupWatchdog();
const audioDeviceList = new QComboBox();
let audioDevices = [];
let refreshingAudioDevices = false;
function audioProcessEnv() {
  const env = { ...process.env };
  if (env.SAMNAT_AUDIO_LIB_DIR) {
    env.LD_LIBRARY_PATH = [env.SAMNAT_AUDIO_LIB_DIR, env.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter);
  }
  return env;
}
let audioTester = null;
let audioTestRequestId = 0;
let pendingAudioTest = null;

function finishAudioTest(result, resumeError = '') {
  const pending = pendingAudioTest;
  if (!pending) return;
  if (pending.wasRunning && !resumeError) {
    pending.result = result;
    pending.phase = 'resuming';
    status.setText('Teste terminado; reabrindo FluidSynth e restaurando os timbres...');
    worker.postMessage({
      type: 'resume-audio-after-test',
      requestId: pending.requestId,
      wasRunning: true
    });
    return;
  }

  pendingAudioTest = null;
  audioDeviceList.setEnabled(audioDevices.length > 0);
  testAudioButton.setEnabled(audioDevices.length > 0);
  if (resumeError) {
    audioReady = false;
    status.setText(`O teste terminou, mas o FluidSynth não reabriu: ${resumeError}`);
  } else {
    status.setText(`${result}${pending.wasRunning ? ' FluidSynth e os timbres foram restaurados.' : ''}`);
  }
}

function testAudioOutput(output) {
  if (!output) return;
  if (audioTester || pendingAudioTest) {
    status.setText('O teste de áudio já está em execução.');
    return;
  }
  const requestId = ++audioTestRequestId;
  pendingAudioTest = { requestId, output, phase: 'pausing', wasRunning: false };
  audioDeviceList.setEnabled(false);
  testAudioButton.setEnabled(false);
  status.setText(`Liberando a saída ${output.label} para o teste ALSA...`);
  worker.postMessage({ type: 'pause-audio-for-test', requestId });
}

function startAudioOutputTest(output) {
  const pulseSink = typeof output.sink === 'string' && output.sink.length > 0;
  const backend = pulseSink ? 'ALSA → PulseAudio/PipeWire' : 'ALSA direto';
  const command = pulseSink ? 'paplay' : 'aplay';
  const args = pulseSink
    ? ['--playback', '--raw', '--format=s16le', '--rate=44100', '--channels=2', '--device', output.sink]
    : ['-D', output.device, '-t', 'raw', '-f', 'S16_LE', '-r', '44100', '-c', '2', '-'];
  const frames = 44100 * 1.25;
  const pcm = Buffer.alloc(frames * 4);
  const fadeFrames = 1102;
  for (let frame = 0; frame < frames; frame++) {
    const fadeIn = Math.min(1, frame / fadeFrames);
    const fadeOut = Math.min(1, (frames - 1 - frame) / fadeFrames);
    const envelope = Math.min(fadeIn, fadeOut);
    const sample = Math.round(Math.sin(2 * Math.PI * 440 * frame / 44100) * 0.22 * envelope * 32767);
    pcm.writeInt16LE(sample, frame * 4);
    pcm.writeInt16LE(sample, frame * 4 + 2);
  }
  let tester;
  try {
    tester = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...audioProcessEnv(), LC_ALL: 'C', ...(output.env || {}) }
    });
  } catch (error) {
    finishAudioTest(`Não foi possível iniciar ${command}: ${error.message}`);
    return;
  }
  audioTester = tester;
  status.setText(`Processo ${command} criado para ${output.label}; enviando tom de 440 Hz por 1,25 s...`);
  let outputText = '';
  let finished = false;
  let timedOut = false;
  let watchdog;
  let forceKill;
  const finish = (code, signal, error) => {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    clearTimeout(forceKill);
    audioTester = null;
    const detail = [error, outputText.trim()].filter(Boolean).join('\n').slice(-1200);
    const result = code === 0 && !timedOut
      ? `Teste por ${backend} terminou sem erro em ${output.label}. Se ficou mudo, a rota abriu; confira mixer/saída física.`
      : `Falha no teste direto por ${backend} em ${output.label} (código ${code === null ? 1 : code}): ${detail || `${signal || command} terminou sem detalhes.`}`;
    finishAudioTest(result);
  };
  watchdog = setTimeout(() => {
    timedOut = true;
    status.setText(`O teste excedeu 6 segundos; encerrando ${command}...`);
    tester.kill('SIGTERM');
    forceKill = setTimeout(() => {
      tester.kill('SIGKILL');
      finish(1, 'timeout', `O teste excedeu 6 segundos; ${command} foi encerrado à força.`);
    }, 750);
  }, 6000);
  const captureOutput = chunk => {
    outputText = (outputText + chunk.toString()).slice(-1200);
  };
  tester.stdout.on('data', captureOutput);
  tester.stderr.on('data', captureOutput);
  tester.stdin.on('error', error => { outputText = `${outputText}\npipe: ${error.message}`.slice(-1200); });
  tester.on('spawn', () => {
    status.setText(`Reproduzindo 440 Hz por 1,25 s via ${backend} em ${output.label}.`);
    tester.stdin.end(pcm);
  });
  tester.on('error', error => finish(1, null, `Não foi possível iniciar ${command}: ${error.message}`));
  tester.on('exit', (code, signal) => finish(code, signal, null));
}
function detectAudioDevices() {
  const devices = [];
  const alsa = spawnSync('aplay', ['-l'], { encoding: 'utf8', timeout: 4000, env: audioProcessEnv() });
  if (!alsa.error && alsa.status === 0) {
    const pattern = /^card\s+(\d+):\s+[^[]+\[([^\]]+)\],\s+device\s+(\d+):\s+[^[]+\[([^\]]+)\]/gm;
    for (const match of alsa.stdout.matchAll(pattern)) {
      const [, card, cardName, device, deviceName] = match;
      devices.push({
        label: `ALSA · ${cardName} · ${deviceName} (${card},${device})`,
        device: `plughw:${card},${device}`,
        env: {}
      });
    }
    // On the embedded laptop, the analog ALC257 device drives the built-in
    // speakers and headphone jack. Prefer it over HDMI during first startup.
    devices.sort((a, b) => Number(/ALC257|analog/i.test(b.label)) - Number(/ALC257|analog/i.test(a.label)));
  }

  const sinks = spawnSync('pactl', ['list', 'short', 'sinks'], { encoding: 'utf8', timeout: 2500, env: audioProcessEnv() });
  if (!sinks.error && sinks.status === 0) {
    const defaultSinkResult = spawnSync('pactl', ['get-default-sink'], { encoding: 'utf8', timeout: 1500, env: audioProcessEnv() });
    const defaultSink = !defaultSinkResult.error && defaultSinkResult.status === 0 ? defaultSinkResult.stdout.trim() : '';
    const pulseDevices = sinks.stdout.split(/\r?\n/).filter(Boolean).map(line => {
      const fields = line.split(/\s+/);
      const sink = fields[1];
      return sink ? { label: `PulseAudio/PipeWire · ${sink}`, device: 'pulse', env: { PULSE_SINK: sink }, sink } : null;
    }).filter(Boolean);
    devices.unshift(...pulseDevices);
    devices.sort((a, b) => Number(b.sink === defaultSink) - Number(a.sink === defaultSink));
  }
  return devices;
}
function refreshAudioDevices() {
  const previous = audioDevices[audioDeviceList.currentIndex()];
  audioDevices = detectAudioDevices();
  const preferred = audioDevices.find(device => previous && device.device === previous.device && JSON.stringify(device.env) === JSON.stringify(previous.env)) || audioDevices[0];
  refreshingAudioDevices = true;
  audioDeviceList.clear();
  audioDevices.forEach(device => audioDeviceList.addItem(undefined, device.label));
  audioDeviceList.setCurrentIndex(preferred ? audioDevices.indexOf(preferred) : -1);
  refreshingAudioDevices = false;
  audioDeviceList.setEnabled(audioDevices.length > 0);
  testAudioButton.setEnabled(audioDevices.length > 0);
  if (preferred) {
    audioReady = false;
    audioStartupStage = audioWorkerOnline
      ? `Solicitando ao motor local a abertura de ${preferred.label}...`
      : `Iniciando o motor local de áudio para ${preferred.label}...`;
    armAudioStartupWatchdog();
    requestAudioOutput(preferred);
  }
  else {
    audioStartupStage = 'Nenhuma saída real encontrada no ALSA ou PulseAudio/PipeWire.';
    clearTimeout(audioStartupTimer);
    status.setText(audioStartupStage);
  }
}
const audioLine = new QWidget();
const audioLineLayout = new QBoxLayout(Direction.LeftToRight);
audioLine.setLayout(audioLineLayout);
audioLineLayout.addWidget(label('Dispositivo', 'font-size: 12px; font-weight: 700; color: #65676b;'));
audioLineLayout.addWidget(audioDeviceList);
audioLineLayout.addWidget(button('Atualizar saídas', refreshAudioDevices));
const testAudioButton = button('Teste direto de som (440 Hz)', () => {
  const output = audioDevices[audioDeviceList.currentIndex()];
  if (!output) return;
  status.setText(`Preparando teste de 440 Hz em ${output.label}...`);
  testAudioOutput(output);
});
audioLineLayout.addWidget(testAudioButton);
audioLineLayout.addWidget(label('Volume: Ctrl + F11 (−) · Ctrl + F12 (+) · teclas Fn', 'font-size: 11px; color: #65676b; padding-left: 5px;'));
audioPanelLayout.addWidget(audioLine);

function adjustSystemVolume(action) {
  const output = audioDevices[audioDeviceList.currentIndex()];
  const target = output ? (output.sink ? 'pulse' : output.device) : '';
  const sink = output?.sink || '';
  const helper = '/usr/local/bin/samnat-volume';
  if (!fs.existsSync(helper)) {
    status.setText('Atalhos de volume disponíveis na imagem embarcada.');
    return;
  }
  const result = spawnSync(helper, [action, target, sink], { encoding: 'utf8', timeout: 2000, env: audioProcessEnv() });
  const detail = (result.stdout || result.stderr || '').trim().split(/\r?\n/).slice(-1)[0];
  status.setText(result.status === 0
    ? (detail || `Volume ${action === 'up' ? 'aumentado' : action === 'down' ? 'reduzido' : 'alternado'}.`)
    : `Não foi possível ajustar o volume${detail ? `: ${detail}` : '.'}`);
}
const volumeShortcuts = [];
function addVolumeShortcut(sequence, action) {
  try {
    const shortcut = new QShortcut(window);
    shortcut.setKey(new QKeySequence(sequence));
    shortcut.setAutoRepeat(true);
    shortcut.addEventListener('activated', () => adjustSystemVolume(action));
    volumeShortcuts.push(shortcut);
  } catch (error) {
    writeAudioWorkerLog(`SHORTCUT unavailable (${sequence}): ${error.message}`);
  }
}
addVolumeShortcut('Ctrl+F11', 'down');
addVolumeShortcut('Ctrl+F12', 'up');
addVolumeShortcut('Volume Up', 'up');
addVolumeShortcut('Volume Down', 'down');
addVolumeShortcut('Volume Mute', 'mute');
audioDeviceList.addEventListener('currentIndexChanged', index => {
  if (refreshingAudioDevices) return;
  const output = audioDevices[index];
  if (!output) return;
  audioReady = false;
  audioStartupStage = audioWorkerOnline
    ? `Solicitando ao motor local a abertura de ${output.label}...`
    : `Iniciando o motor local de áudio para ${output.label}...`;
  armAudioStartupWatchdog();
  requestAudioOutput(output);
  status.setText(`Abrindo ${output.label}...`);
});
const slots = [];
const slotCache = [];
const rows = [];
let midiLearnChannel = null;
let clearingScene = false;
let sceneOperation = null;
let slotCountLabel = null;
let addSlotButton = null;
const rowHost = new QWidget();
const rowLayout = new QBoxLayout(Direction.TopToBottom);
rowHost.setLayout(rowLayout);
rowLayout.setContentsMargins(8, 8, 8, 8);
rowLayout.setSpacing(8);
rowHost.setInlineStyle('background: #f7f8fa;');
const scroll = new QScrollArea();
scroll.setWidget(rowHost);
scroll.setWidgetResizable(true);
scroll.setInlineStyle('border: 1px solid #e1e5eb; border-radius: 10px; background: #f7f8fa;');

function makeSlotState(channel) {
  return {
    channel, file: '', bank: 0, program: 0, presetName: '', loaded: false,
    programs: [],
    syncingPreset: false, syncingModulation: false, syncingControls: false,
    modulationEnabled: false,
    volume: 85, reverb: 0, chorus: 0, active: false, midiVolumeCC: null
  };
}

function updateSlotToolbar() {
  if (slotCountLabel) slotCountLabel.setText(`Instrumentos · ${slots.length}/${CHANNELS} partes`);
  if (addSlotButton) addSlotButton.setEnabled(!clearingScene && slots.length < CHANNELS);
}

function resetSlotUi(slot) {
  Object.assign(slot, makeSlotState(slot.channel));
  const row = rows[slot.channel];
  if (!row) return;
  slot.syncingControls = true;
  slot.syncingPreset = true;
  row.bank.setText('0');
  row.name.setText('Sem SF2');
  row.test.setEnabled(false);
  row.volumeControl.setValue(85);
  row.volumeLabel.setText('Volume 85%');
  row.reverb.setValue(0);
  row.chorus.setValue(0);
  setProgramOptions(slot, [], 0, 0);
  slot.syncingPreset = false;
  slot.syncingModulation = true;
  row.modulation.setChecked(false);
  row.modulation.setEnabled(false);
  slot.syncingModulation = false;
  slot.syncingControls = false;
}

function ensureSlotCount(requestedCount) {
  const count = Math.max(1, Math.min(CHANNELS, requestedCount));
  while (slots.length > count) {
    const removed = slots.pop();
    rows[removed.channel]?.container.setVisible(false);
  }
  while (slots.length < count) {
    const channel = slots.length;
    let slot = slotCache[channel];
    if (!slot) {
      slot = makeSlotState(channel);
      slotCache[channel] = slot;
      makeSlot(slot);
    } else {
      resetSlotUi(slot);
      rows[channel].container.setVisible(true);
    }
    slots.push(slot);
  }
  updateSlotToolbar();
}

function addSlot() {
  if (clearingScene || slots.length >= CHANNELS) return;
  ensureSlotCount(slots.length + 1);
  status.setText(`Parte ${slots.length} adicionada.`);
}

function chooseSoundFont(channel) {
  if (clearingScene) return;
  const dialog = new QFileDialog(window, `SoundFont do canal ${channel + 1}`, SF_DIR, 'SoundFonts (*.sf2)');
  dialog.setFileMode(FileMode.ExistingFile);
  dialog.setNameFilter('SoundFonts (*.sf2)');
  dialog.exec();
  const selected = dialog.selectedFiles();
  if (!selected.length) return;
  const file = selected[0];
  slots[channel].loaded = false;
  rows[channel].test.setEnabled(false);
  rows[channel].modulation.setEnabled(audioReady);
  rows[channel].name.setText(path.basename(file));
  slots[channel].syncingPreset = true;
  slots[channel].program = 0;
  slots[channel].programs = [];
  slots[channel].file = file;
  setProgramOptions(slots[channel], [], 0, 0, 'Lendo presets...');
  slots[channel].syncingPreset = false;
  worker.postMessage({ type: 'load-soundfont', channel, file, bank: slots[channel].bank, program: slots[channel].program });
  status.setText(audioReady
    ? `Carregando ${path.basename(file)} no canal ${channel + 1}...`
    : `SF2 selecionado; aguardando áudio. Estado: ${audioStartupStage}`);
}

function setProgramOptions(slot, presets, selectedBank, selectedProgram, emptyLabel = 'Sem presets') {
  slot.programs = Array.isArray(presets) ? presets : [];
  const control = rows[slot.channel]?.program;
  if (!control) return;
  slot.syncingPreset = true;
  control.clear();
  if (slot.programs.length) {
    slot.programs.forEach(preset => {
      const bankLabel = preset.bank === 0 ? '' : ` (Banco ${preset.bank})`;
      control.addItem(undefined, `${preset.program + 1} — ${preset.name}${bankLabel}`);
    });
    const selected = slot.programs.findIndex(preset => preset.bank === selectedBank && preset.program === selectedProgram);
    control.setCurrentIndex(selected >= 0 ? selected : 0);
  } else {
    control.addItem(undefined, emptyLabel);
  }
  control.setEnabled(audioReady && Boolean(slot.file) && slot.programs.length > 0);
  slot.syncingPreset = false;
}

function makeSlot(slot) {
  const row = new QWidget();
  const stack = new QBoxLayout(Direction.TopToBottom);
  row.setLayout(stack);
  stack.setContentsMargins(11, 9, 11, 9);
  stack.setSpacing(8);
  row.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 10px;');
  const sourceLine = horizontal(stack);
  sourceLine.addWidget(label(`PARTE ${slot.channel + 1}`, 'font-weight: 700; color: #0866ff; min-width: 64px;'));
  const name = label('Sem SF2', 'color: #65676b;');
  sourceLine.addWidget(name, 1);
  const openSoundFontButton = button('Abrir SF2', () => chooseSoundFont(slot.channel));
  openSoundFontButton.setMinimumWidth(105);
  sourceLine.addWidget(openSoundFontButton);
  const bank = new QLineEdit(); bank.setPlaceholderText('Banco'); bank.setText('0'); bank.setMaximumWidth(58);
  bank.addEventListener('textChanged', value => {
    const n = Number(value);
    if (!slot.syncingPreset && Number.isInteger(n) && n >= 0) {
      slot.bank = n;
      if (slot.file && slot.loaded) worker.postMessage({ type: 'program', channel: slot.channel, file: slot.file, bank: slot.bank, program: slot.program });
    }
  });
  sourceLine.addWidget(bank);
  const program = new QComboBox();
  program.setMinimumWidth(200);
  program.addItem(undefined, 'Sem presets');
  program.setEnabled(false);
  program.addEventListener('currentIndexChanged', index => {
    if (slot.syncingPreset) return;
    const selected = slot.programs[index];
    if (!selected) return;
    slot.bank = selected.bank;
    slot.program = selected.program;
    slot.syncingPreset = true;
    bank.setText(String(selected.bank));
    slot.syncingPreset = false;
    if (slot.file && slot.loaded) worker.postMessage({ type: 'program', channel: slot.channel, bank: slot.bank, program: slot.program });
  });
  program.setMinimumWidth(170);
  sourceLine.addWidget(program, 2);
  const mixLine = horizontal(stack);
  const volumeLabel = label(`Volume ${slot.volume}%`, 'min-width: 86px; color: #344054; font-weight: 600;');
  mixLine.addWidget(volumeLabel);
  const volumeControl = slider(0, 100, slot.volume, value => {
    if (slot.syncingControls) return;
    slot.volume = value; volumeLabel.setText(`Volume ${value}%`);
    worker.postMessage({ type: 'volume', channel: slot.channel, value });
  });
  volumeControl.setMinimumWidth(130);
  mixLine.addWidget(volumeControl);
  const reverb = slider(0, 100, slot.reverb, value => {
    if (slot.syncingControls) return;
    slot.reverb = value; worker.postMessage({ type: 'effects', channel: slot.channel, reverb: value, chorus: slot.chorus });
  });
  reverb.setMaximumWidth(110); mixLine.addWidget(label('Reverb', 'color: #65676b;')); mixLine.addWidget(reverb);
  const chorus = slider(0, 100, slot.chorus, value => {
    if (slot.syncingControls) return;
    slot.chorus = value; worker.postMessage({ type: 'effects', channel: slot.channel, reverb: slot.reverb, chorus: value });
  });
  chorus.setMaximumWidth(110); mixLine.addWidget(label('Chorus', 'color: #65676b;')); mixLine.addWidget(chorus);
  const test = button('C4', () => {
    if (!slot.loaded) {
      status.setText(`Carregue um SF2 na parte ${slot.channel + 1} antes de testar C4.`);
      return;
    }
    worker.postMessage({ type: 'note-on', channel: slot.channel, note: 60, velocity: 100 });
    setTimeout(() => worker.postMessage({ type: 'note-off', channel: slot.channel, note: 60 }), 350);
  });
  test.setEnabled(false);
  mixLine.addWidget(test);
  const midiLearn = button('MIDI Learn', () => { midiLearnChannel = slot.channel; status.setText(`MIDI Learn: mova um controle para associar ao volume da parte ${slot.channel + 1}.`); });
  mixLine.addWidget(midiLearn);
  const modulationLine = horizontal(stack);
  const modulation = new QCheckBox();
  modulation.setText('Permitir modulação neste slot');
  modulation.setChecked(slot.modulationEnabled);
  modulation.setEnabled(false);
  modulation.addEventListener('toggled', enabled => {
    if (slot.syncingModulation) return;
    slot.modulationEnabled = enabled;
    worker.postMessage({ type: 'modulation-enabled', channel: slot.channel, enabled });
  });
  modulationLine.addWidget(modulation);
  rows[slot.channel] = { container: row, name, bank, program, test, volumeControl, volumeLabel, reverb, chorus, midiLearn, modulation };
  rowLayout.addWidget(row);
  row.setVisible(true);
}
ensureSlotCount(1);
const systemSoundFont = ['/usr/share/sounds/sf2/FluidR3_GM.sf2', '/usr/share/soundfonts/default.sf2']
  .find(file => fs.existsSync(file));
if (systemSoundFont) {
  slots[0].file = systemSoundFont;
  rows[0].name.setText(`${path.basename(systemSoundFont)} (sistema)`);
  worker.postMessage({ type: 'load-soundfont', channel: 0, file: systemSoundFont, bank: 0, program: 0 });
}

const keyboard = new QWidget();
const keyboardLayout = new QBoxLayout(Direction.TopToBottom);
keyboard.setLayout(keyboardLayout);
keyboardLayout.setContentsMargins(12, 10, 12, 10);
keyboardLayout.setSpacing(7);
keyboard.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 11px;');
keyboardLayout.addWidget(label('Teclado virtual · duas oitavas', 'font-size: 14px; font-weight: 700; color: #344054;'));
const keyRow = horizontal(keyboardLayout);
for (let note = 48; note <= 72; note++) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const pitch = names[note % 12];
  const key = button(`${pitch}${Math.floor(note / 12) - 1}`, () => {
    worker.postMessage({ type: 'note-on', source: 'keyboard', note, velocity: 100 });
    setTimeout(() => worker.postMessage({ type: 'note-off', source: 'keyboard', note }), 250);
  });
  key.setMinimumSize(40, 54);
  key.setInlineStyle(pitch.includes('#')
    ? 'min-width: 34px; background: #253041; border: 1px solid #172033; border-radius: 6px; color: #ffffff; font-size: 10px;'
    : 'background: #ffffff; border: 1px solid #cbd3df; border-radius: 6px; color: #344054; font-size: 10px;');
  keyRow.addWidget(key, 1);
}
const slotsToolbar = horizontal(mixerLayout);
slotCountLabel = label('Instrumentos · 1/8 partes', 'font-size: 16px; font-weight: 700; color: #344054;');
slotsToolbar.addWidget(slotCountLabel);
slotsToolbar.addStretch(1);
addSlotButton = button('+ Adicionar slot', addSlot);
slotsToolbar.addWidget(addSlotButton);
updateSlotToolbar();
scroll.setMinimumHeight(240);
mixerLayout.addWidget(scroll, 1);
mixerLayout.addWidget(keyboard);

const tools = new QWidget();
const toolsLayout = new QBoxLayout(Direction.TopToBottom);
tools.setLayout(toolsLayout);
toolsLayout.setContentsMargins(0, 0, 0, 0);
toolsLayout.setSpacing(12);
sideLayout.addWidget(tools, 1);

function sectionPanel(parent, titleText) {
  const panel = new QWidget();
  const panelLayout = new QBoxLayout(Direction.TopToBottom);
  panel.setLayout(panelLayout);
  panelLayout.setContentsMargins(11, 10, 11, 10);
  panelLayout.setSpacing(8);
  panel.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 10px;');
  panelLayout.addWidget(label(titleText, 'font-size: 14px; font-weight: 700; color: #344054;'));
  parent.addWidget(panel);
  return panelLayout;
}

const scenePanelLayout = sectionPanel(toolsLayout, 'Cenas');
const sceneName = new QLineEdit();
sceneName.setPlaceholderText('Nome da cena');
sceneName.setMinimumHeight(36);
scenePanelLayout.addWidget(sceneName);
const sceneSaveLine = horizontal(scenePanelLayout);
sceneSaveLine.addWidget(button('Salvar cena', () => saveScene()), 1);
const newSceneButton = button('Nova Cena', startNewScene);
sceneSaveLine.addWidget(newSceneButton, 1);
scenePanelLayout.addWidget(label('Pads para trocar de cena', 'font-size: 12px; font-weight: 700; color: #475467;'));
const scenePadHost = new QWidget();
const scenePadLayout = new QBoxLayout(Direction.TopToBottom);
scenePadHost.setLayout(scenePadLayout);
scenePadLayout.setContentsMargins(0, 0, 0, 0);
scenePadLayout.setSpacing(5);
const scenePadArea = new QScrollArea();
scenePadArea.setWidget(scenePadHost);
scenePadArea.setWidgetResizable(true);
scenePadArea.setMinimumHeight(88);
scenePadArea.setMaximumHeight(172);
scenePadArea.setInlineStyle('border: 0; background: transparent;');
scenePanelLayout.addWidget(scenePadArea);
let scenePadRows = [];
const sceneList = new QComboBox();
sceneList.setMinimumHeight(36);
scenePanelLayout.addWidget(sceneList);
const sceneLoadLine = horizontal(scenePanelLayout);
sceneLoadLine.addWidget(button('Carregar', () => loadScene()), 1);
sceneLoadLine.addWidget(button('Excluir', () => deleteScene()), 1);

const libraryPanelLayout = sectionPanel(toolsLayout, 'SoundFonts');
libraryPanelLayout.addWidget(button('Importar SF2 para biblioteca', () => importSoundFont()));
const catalog = require('./soundfont-catalog.json');
const sfUrl = new QLineEdit();
sfUrl.setPlaceholderText('URL direta de um arquivo SF2');
sfUrl.setMinimumHeight(36);
const catalogList = new QComboBox();
catalog.items.forEach(item => catalogList.addItem(undefined, `${item.category} · ${item.name}`));
catalogList.addEventListener('currentIndexChanged', index => {
  const item = catalog.items[index];
  if (item) sfUrl.setText(`${catalog.baseUrl}${item.file.split('/').map(encodeURIComponent).join('/')}`);
});
libraryPanelLayout.addWidget(catalogList);
libraryPanelLayout.addWidget(sfUrl);
libraryPanelLayout.addWidget(button('Baixar SF2', () => downloadSoundFont()));
libraryPanelLayout.addWidget(label(`Biblioteca local: ${SF_DIR}`, 'font-size: 10px; color: #65676b;'));

const midiPanelLayout = sectionPanel(toolsLayout, 'Controlador MIDI');
const midiList = new QComboBox();
midiList.setMinimumHeight(36);
midiPanelLayout.addWidget(midiList);
const midiRouting = new QComboBox();
midiRouting.addItem(undefined, 'Controlador: todas as partes');
midiRouting.addItem(undefined, 'Controlador: canal correspondente');
midiRouting.setMinimumHeight(36);
midiPanelLayout.addWidget(midiRouting);
const midiLine = horizontal(midiPanelLayout);
midiLine.addWidget(button('Atualizar', refreshMidi), 1);
midiLine.addWidget(button('Conectar', connectMidi), 1);

let midiInput = null;
let midi;
let pendingSceneMidiLearn = null;
const midiCcState = new Map();
function refreshMidi() {
  try {
    midi = require('midi');
    const input = new midi.Input();
    midiList.clear();
    for (let i = 0; i < input.getPortCount(); i++) midiList.addItem(undefined, input.getPortName(i));
    input.closePort();
    status.setText(midiList.count()
      ? `${midiList.count()} entradas MIDI encontradas.`
      : 'MIDI carregado; nenhum dispositivo encontrado. Conecte o controlador e atualize a lista.');
  } catch (error) { status.setText(`Falha ao carregar MIDI: ${error.message}`); }
}
function midiTriggerLabel(trigger) {
  if (!trigger) return 'MIDI Learn';
  const source = trigger.type === 'note' ? `Nota ${trigger.data1}` : `CC ${trigger.data1}`;
  return `${source} · CH ${trigger.channel + 1}`;
}
function startSceneMidiLearn(sceneName) {
  if (!midiInput) {
    status.setText('Conecte o controlador MIDI antes de associar um pad à cena.');
    return;
  }
  pendingSceneMidiLearn = sceneName;
  status.setText(`MIDI Learn para “${sceneName}”: toque um pad ou mova o controle que deseja associar.`);
}
function saveSceneMidiTrigger(sceneName, trigger) {
  const scenes = readScenes();
  const scene = scenes.find(item => item.name === sceneName);
  if (!scene) {
    pendingSceneMidiLearn = null;
    status.setText(`A cena “${sceneName}” não existe mais.`);
    return;
  }
  const conflict = scenes.find(item => item.name !== sceneName && item.midiTrigger &&
    item.midiTrigger.type === trigger.type && item.midiTrigger.channel === trigger.channel &&
    item.midiTrigger.data1 === trigger.data1);
  if (conflict) {
    status.setText(`Esse pad já aciona “${conflict.name}”. Escolha outro pad para “${sceneName}”.`);
    return;
  }
  scene.midiTrigger = trigger;
  writeScenes(scenes);
  pendingSceneMidiLearn = null;
  refreshScenes(sceneName);
  status.setText(`Pad MIDI associado à cena “${sceneName}”: ${midiTriggerLabel(trigger)}.`);
}
function findSceneForMidiTrigger(type, channel, data1) {
  return readScenes().find(scene => scene.midiTrigger && scene.midiTrigger.type === type &&
    scene.midiTrigger.channel === channel && scene.midiTrigger.data1 === data1);
}
function handleSceneMidiEvent(command, channel, data1, value) {
  const learningType = command === 0x90 && value > 0 ? 'note' : command === 0xb0 ? 'cc' : null;
  if (pendingSceneMidiLearn && learningType) {
    saveSceneMidiTrigger(pendingSceneMidiLearn, { type: learningType, channel, data1 });
    return true;
  }
  if (command === 0x90 && value > 0) {
    const scene = findSceneForMidiTrigger('note', channel, data1);
    if (scene) {
      loadSceneByName(scene.name);
      return true;
    }
  }
  if (command === 0x80 || (command === 0x90 && value === 0)) {
    return Boolean(findSceneForMidiTrigger('note', channel, data1));
  }
  if (command === 0xb0) {
    const key = `${channel}:${data1}`;
    const previousValue = midiCcState.get(key) ?? 0;
    midiCcState.set(key, value);
    if (previousValue === 0 && value > 0) {
      const scene = findSceneForMidiTrigger('cc', channel, data1);
      if (scene) {
        loadSceneByName(scene.name);
        return true;
      }
    }
  }
  return false;
}
function connectMidi() {
  try {
    if (!midi) midi = require('midi');
    if (midiInput) { midiInput.closePort(); midiInput = null; }
    midiInput = new midi.Input();
    const port = midiList.currentIndex();
    if (port < 0 || port >= midiInput.getPortCount()) throw new Error('Selecione uma entrada MIDI.');
    midiInput.on('message', (_delta, bytes) => {
      if (clearingScene) return;
      const command = bytes[0] & 0xf0;
      const note = bytes[1]; const value = bytes[2] || 0;
      const midiChannel = bytes[0] & 0x0f;
      if (handleSceneMidiEvent(command, midiChannel, note, value)) return;
      const channel = midiChannel % CHANNELS;
      const route = midiRouting.currentIndex() === 0 ? 'all' : 'channel';
      if (command === 0x90 && value > 0) worker.postMessage({ type: 'note-on', source: 'midi', route, channel, note, velocity: value });
      else if (command === 0x80 || (command === 0x90 && value === 0)) worker.postMessage({ type: 'note-off', source: 'midi', channel, note });
      else if (command === 0xb0) {
        if (bytes[1] === 64) slots.forEach(s => worker.postMessage({ type: 'control', channel: s.channel, controller: 64, value }));
        if (bytes[1] === 1) slots.filter(s => s.loaded && s.modulationEnabled)
          .forEach(s => worker.postMessage({ type: 'control', channel: s.channel, controller: 1, value }));
        if (midiLearnChannel !== null) {
          slots[midiLearnChannel].midiVolumeCC = bytes[1];
          status.setText(`CC ${bytes[1]} associado ao volume da parte ${midiLearnChannel + 1}.`);
          midiLearnChannel = null;
        } else {
          slots.filter(s => s.midiVolumeCC === bytes[1]).forEach(s => {
            s.volume = Math.round(value * 100 / 127);
            rows[s.channel].volumeControl.setValue(s.volume);
            rows[s.channel].volumeLabel.setText(`Volume ${s.volume}%`);
          });
        }
      } else if (command === 0xe0) {
        const bend = bytes[1] | (bytes[2] << 7);
        slots.forEach(s => worker.postMessage({ type: 'pitch-bend', channel: s.channel, value: bend }));
      }
    });
    midiInput.openPort(port);
    status.setText(`MIDI conectado: ${midiList.currentText()}`);
  } catch (error) { status.setText(`Falha ao conectar MIDI: ${error.message}`); }
}

function readScenes() {
  try { return JSON.parse(fs.readFileSync(SCENE_FILE, 'utf8')); } catch (_) { return []; }
}
function refreshScenePads(scenes) {
  scenePadRows.forEach(row => {
    scenePadLayout.removeWidget(row);
    row.hide();
    row.deleteLater();
  });
  scenePadRows = [];
  scenes.forEach(scene => {
    const row = new QWidget();
    const rowLayout = new QBoxLayout(Direction.LeftToRight);
    row.setLayout(rowLayout);
    rowLayout.setContentsMargins(0, 0, 0, 0);
    rowLayout.setSpacing(5);
    const launch = button(scene.name, () => loadSceneByName(scene.name));
    launch.setMinimumHeight(42);
    launch.setInlineStyle('padding: 8px 10px; border: 1px solid #b8c9e2; border-radius: 8px; background: #edf4ff; color: #174ea6; font-weight: 700;');
    const learn = button(midiTriggerLabel(scene.midiTrigger), () => startSceneMidiLearn(scene.name));
    learn.setMinimumWidth(110);
    learn.setMaximumWidth(142);
    learn.setMinimumHeight(42);
    learn.setInlineStyle(scene.midiTrigger
      ? 'padding: 6px 8px; border: 1px solid #c9b6e4; border-radius: 8px; background: #f4edff; color: #6236a0; font-size: 10px; font-weight: 700;'
      : 'padding: 6px 8px; border: 1px solid #d8dee8; border-radius: 8px; background: #ffffff; color: #475467; font-size: 10px; font-weight: 600;');
    rowLayout.addWidget(launch, 1);
    rowLayout.addWidget(learn);
    scenePadLayout.addWidget(row);
    scenePadRows.push(row);
  });
  scenePadHost.adjustSize();
  scenePadArea.setVisible(scenes.length > 0);
}
function refreshScenes(selectName) {
  const scenes = readScenes(); sceneList.clear();
  scenes.forEach(scene => sceneList.addItem(undefined, scene.name));
  refreshScenePads(scenes);
  if (selectName) {
    const index = scenes.findIndex(scene => scene.name === selectName);
    if (index >= 0) sceneList.setCurrentIndex(index);
  }
}
function writeScenes(scenes) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SCENE_FILE, JSON.stringify(scenes, null, 2)); }
function resetSceneUi() {
  midiLearnChannel = null;
  ensureSlotCount(1);
  resetSlotUi(slots[0]);
  sceneName.setText('');
  sceneList.setCurrentIndex(-1);
}
function beginSceneOperation(operation, message) {
  if (clearingScene) return;
  pendingSceneMidiLearn = null;
  midiLearnChannel = null;
  sceneOperation = operation;
  clearingScene = true;
  newSceneButton.setEnabled(false);
  updateSlotToolbar();
  status.setText(message);
  window.setEnabled(false);
  worker.postMessage({ type: 'clear-all' });
}
function startNewScene() {
  beginSceneOperation({ kind: 'new' }, 'Limpando os SoundFonts e preparando uma nova cena...');
}
function saveScene() {
  const name = sceneName.text().trim(); if (!name) { status.setText('Informe um nome para a cena.'); return; }
  const scenes = readScenes();
  const existing = scenes.findIndex(scene => scene.name === name);
  const data = {
    name,
    midiTrigger: existing >= 0 ? scenes[existing].midiTrigger || null : null,
    slotCount: slots.length,
    slots: slots.map(({ channel, file, bank, program, volume, reverb, chorus, modulationEnabled, midiVolumeCC }) => ({
      channel, file, bank, program, volume, reverb, chorus, modulationEnabled, midiVolumeCC
    }))
  };
  if (existing < 0) scenes.push(data); else scenes[existing] = data;
  writeScenes(scenes); refreshScenes(name); status.setText(`Cena “${name}” salva.`);
}
function loadSceneByName(name) {
  if (clearingScene) return;
  const scenes = readScenes();
  const index = scenes.findIndex(item => item.name === name);
  const scene = scenes[index];
  if (!scene) {
    status.setText(`A cena “${name}” não foi encontrada.`);
    refreshScenes();
    return;
  }
  sceneList.setCurrentIndex(index);
  beginSceneOperation({ kind: 'load', scene }, `Descarregando timbres anteriores para abrir a cena “${scene.name}”...`);
}
function loadScene() {
  if (clearingScene) return;
  const scene = readScenes()[sceneList.currentIndex()]; if (!scene) return;
  loadSceneByName(scene.name);
}
function applyScene(scene) {
  const storedSlots = Array.isArray(scene.slots) ? scene.slots.slice(0, CHANNELS) : [];
  let slotCount = Number.isInteger(scene.slotCount)
    ? Math.max(1, Math.min(CHANNELS, scene.slotCount))
    : storedSlots.length;
  if (!Number.isInteger(scene.slotCount)) {
    while (slotCount > 0 && !storedSlots[slotCount - 1]?.file) slotCount--;
    slotCount = Math.max(1, slotCount);
  }
  const savedSlots = storedSlots.slice(0, slotCount);
  ensureSlotCount(Math.max(1, savedSlots.length));
  let missingFiles = 0;
  slots.forEach((slot, index) => {
    const saved = savedSlots[index] || {};
    Object.assign(slot, makeSlotState(index), saved, {
      channel: index,
      loaded: false,
      programs: [],
      modulationEnabled: Boolean(saved.modulationEnabled)
    });
    slot.bank = Number.isInteger(slot.bank) && slot.bank >= 0 ? slot.bank : 0;
    slot.program = Number.isInteger(slot.program) && slot.program >= 0 ? slot.program : 0;
    slot.volume = Number.isFinite(slot.volume) ? Math.max(0, Math.min(100, slot.volume)) : 85;
    slot.reverb = Number.isFinite(slot.reverb) ? Math.max(0, Math.min(100, slot.reverb)) : 0;
    slot.chorus = Number.isFinite(slot.chorus) ? Math.max(0, Math.min(100, slot.chorus)) : 0;

    const row = rows[index];
    slot.syncingPreset = true;
    row.bank.setText(String(slot.bank));
    row.test.setEnabled(false);
    row.name.setText(slot.file ? path.basename(slot.file) : 'Sem SF2');
    setProgramOptions(slot, [], slot.bank, slot.program, slot.file ? 'Lendo presets...' : 'Sem presets');
    slot.syncingControls = true;
    row.volumeControl.setValue(slot.volume); row.volumeLabel.setText(`Volume ${slot.volume}%`);
    row.reverb.setValue(slot.reverb); row.chorus.setValue(slot.chorus);
    slot.syncingControls = false;
    slot.syncingModulation = true;
    row.modulation.setChecked(slot.modulationEnabled);
    row.modulation.setEnabled(audioReady && Boolean(slot.file));
    slot.syncingModulation = false;
    slot.syncingPreset = false;

    worker.postMessage({ type: 'modulation-enabled', channel: index, enabled: slot.modulationEnabled });
    if (slot.file && fs.existsSync(slot.file)) {
      worker.postMessage({ type: 'load-soundfont', channel: index, file: slot.file, bank: slot.bank, program: slot.program });
    } else if (slot.file) {
      missingFiles++;
      row.name.setText(`${path.basename(slot.file)} · arquivo ausente`);
    }
    worker.postMessage({ type: 'volume', channel: index, value: slot.volume });
    worker.postMessage({ type: 'effects', channel: index, reverb: slot.reverb, chorus: slot.chorus });
  });
  status.setText(missingFiles
    ? `Cena “${scene.name}” carregada; ${missingFiles} arquivo(s) SF2 não encontrado(s).`
    : `Cena “${scene.name}” carregada com ${slots.length} parte(s).`);
}
function deleteScene() {
  const index = sceneList.currentIndex(); const scenes = readScenes(); if (index < 0) return;
  if (pendingSceneMidiLearn === scenes[index]?.name) pendingSceneMidiLearn = null;
  scenes.splice(index, 1); writeScenes(scenes); refreshScenes(); status.setText('Cena removida.');
}
function importSoundFont() {
  const dialog = new QFileDialog(window, 'Importar SoundFont', os.homedir(), 'SoundFonts (*.sf2)');
  dialog.setFileMode(FileMode.ExistingFile); dialog.setNameFilter('SoundFonts (*.sf2)'); dialog.exec();
  const selected = dialog.selectedFiles(); if (!selected.length) return;
  const destination = path.join(SF_DIR, path.basename(selected[0]));
  if (path.resolve(selected[0]) === path.resolve(destination)) return;
  fs.copyFileSync(selected[0], destination);
  status.setText(`SoundFont importado: ${path.basename(destination)}`);
}
function downloadSoundFont() {
  let parsed;
  try { parsed = new URL(sfUrl.text().trim()); } catch (_) { status.setText('Informe uma URL válida de SoundFont.'); return; }
  if (!['http:', 'https:'].includes(parsed.protocol) || !/\.sf2$/i.test(parsed.pathname)) {
    status.setText('A URL precisa apontar diretamente para um arquivo .sf2 por HTTP ou HTTPS.'); return;
  }
  const destination = path.join(SF_DIR, path.basename(decodeURIComponent(parsed.pathname)));
  const client = parsed.protocol === 'https:' ? https : http;
  status.setText('Baixando SoundFont...');
  const request = client.get(parsed, response => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      response.resume(); sfUrl.setText(new URL(response.headers.location, parsed).toString()); downloadSoundFont(); return;
    }
    if (response.statusCode !== 200) { response.resume(); status.setText(`Download falhou: HTTP ${response.statusCode}.`); return; }
    const temporary = `${destination}.${process.pid}.download`;
    const output = fs.createWriteStream(temporary);
    response.pipe(output);
    output.on('finish', () => {
      output.close(() => {
        try {
          const header = Buffer.alloc(12); const fd = fs.openSync(temporary, 'r'); fs.readSync(fd, header, 0, 12, 0); fs.closeSync(fd);
          if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'sfbk') throw new Error('Resposta não é um SF2.');
          fs.renameSync(temporary, destination);
          const channel = slots.findIndex(slot => !slot.file);
          if (channel >= 0) {
            slots[channel].file = destination;
            slots[channel].loaded = false;
            rows[channel].test.setEnabled(false);
            rows[channel].name.setText(path.basename(destination));
            worker.postMessage({ type: 'load-soundfont', channel, file: destination, bank: slots[channel].bank, program: slots[channel].program });
            status.setText(`SF2 baixado · carregando na parte ${channel + 1} para teste...`);
          } else {
            status.setText(`SoundFont baixado: ${path.basename(destination)}. Abra-o em uma das partes.`);
          }
        } catch (error) { fs.unlinkSync(temporary); status.setText(`Download inválido: ${error.message}`); }
      });
    });
    output.on('error', error => { fs.unlink(temporary, () => undefined); status.setText(`Falha salvando SoundFont: ${error.message}`); });
  });
  request.on('error', error => status.setText(`Falha no download: ${error.message}`));
}

worker.on('message', message => {
  if (message.type === 'audio-test-paused' && pendingAudioTest?.requestId === message.requestId) {
    pendingAudioTest.wasRunning = Boolean(message.wasRunning);
    pendingAudioTest.phase = 'playing';
    startAudioOutputTest(pendingAudioTest.output);
  }
  if (message.type === 'audio-test-resumed' && pendingAudioTest?.requestId === message.requestId) {
    const pending = pendingAudioTest;
    pendingAudioTest = null;
    audioDeviceList.setEnabled(audioDevices.length > 0);
    testAudioButton.setEnabled(audioDevices.length > 0);
    status.setText(`${pending.result} FluidSynth e os timbres foram restaurados.`);
  }
  if (message.type === 'audio-test-resume-error' && pendingAudioTest?.requestId === message.requestId) {
    finishAudioTest(pendingAudioTest.result, message.message);
  }
  if (message.type === 'error' && message.operation === 'pause-audio-for-test' && pendingAudioTest?.requestId === message.requestId) {
    finishAudioTest(`Não foi possível liberar a saída para o teste: ${message.message}`);
  }
  if (message.type === 'cleared' || message.type === 'clear-error') {
    const operation = sceneOperation;
    if (operation?.kind === 'load') applyScene(operation.scene);
    else resetSceneUi();
    sceneOperation = null;
    clearingScene = false;
    newSceneButton.setEnabled(true);
    updateSlotToolbar();
    window.setEnabled(true);
    if (message.type === 'clear-error') {
      status.setText(`${status.text()} Falha ao descarregar alguns timbres: ${message.message}`);
    } else if (operation?.kind !== 'load') {
      status.setText('Nova cena pronta; todos os timbres carregados foram removidos.');
    }
  }
  if (message.type === 'audio-stage') {
    audioStartupStage = message.stage;
    writeAudioWorkerLog(`AUDIO STAGE: ${message.stage}`);
    status.setText(message.stage);
  }
  if (message.type === 'error' && message.channel === undefined) clearTimeout(audioStartupTimer);
  if (message.type === 'audio-output-error') {
    audioReady = false;
    slots.forEach(slot => rows[slot.channel].modulation.setEnabled(false));
    audioStartupStage = `Erro ao abrir áudio: ${message.message}`;
    writeAudioWorkerLog(`AUDIO OUTPUT ERROR: ${message.message}`);
    clearTimeout(audioStartupTimer);
    status.setText(audioStartupStage);
  }
  if (message.type === 'ready') {
    audioReady = true;
    slots.forEach(slot => {
      rows[slot.channel].modulation.setEnabled(Boolean(slot.file));
      rows[slot.channel].program.setEnabled(Boolean(slot.file) && slot.programs.length > 0);
    });
    audioStartupStage = `FluidSynth pronto em ${message.label}.`;
    writeAudioWorkerLog(`AUDIO READY: ${message.backend} ${message.label}`);
    clearTimeout(audioStartupTimer);
    status.setText(audioDevices.length
      ? `FluidSynth nativo abriu ${message.backend} em ${message.label} · carregue um SF2 para tocar teclado ou MIDI.`
      : 'FluidSynth nativo pronto, mas nenhuma saída real foi detectada no ALSA ou PulseAudio/PipeWire.');
  }
  if (message.type === 'loaded') {
    const slot = slots[message.channel];
    if (!slot || !rows[message.channel]) return;
    slot.bank = message.bank;
    slot.program = message.program;
    slot.presetName = message.presetName;
    slot.syncingPreset = true;
    rows[message.channel].bank.setText(String(message.bank));
    slot.syncingPreset = false;
    setProgramOptions(slot, message.presets, message.bank, message.program);
    slot.loaded = true;
    rows[message.channel].test.setEnabled(true);
    rows[message.channel].modulation.setEnabled(audioReady);
    rows[message.channel].name.setText(`${message.name} · ${message.presetName}`);
    status.setText(message.usedFallback
      ? `Parte ${message.channel + 1}: ${message.name} não tem banco ${message.requestedBank}/preset ${message.requestedProgram}; selecionado ${message.bank}/${message.program} · ${message.presetName}.`
      : `Parte ${message.channel + 1}: ${message.name} carregada · preset ${message.bank}/${message.program} · ${message.presetName}.`);
  }
  if (message.type === 'note-dispatched') {
    const parts = message.channels.map(channel => channel + 1).join(', ');
    status.setText(message.action === 'on' && !message.hasSoundFont
      ? `Nota MIDI ${message.note} chegou ao sintetizador, mas a parte correspondente não tem SF2 carregado.`
      : parts
        ? `Nota MIDI ${message.note} ${message.action === 'on' ? 'acionada' : 'liberada'} nas partes ${parts}.`
        : `Nota MIDI ${message.note} recebida, mas nenhuma parte tem SF2 carregado.`);
  }
  if (message.type === 'closed') {
    clearTimeout(workerCloseTimer);
    worker.terminate();
  }
  if (message.type === 'error') {
    audioStartupStage = `Erro no motor de áudio${message.operation ? ` (${message.operation})` : ''}: ${message.message}`;
    if (message.operation === 'clear-all') {
      clearingScene = false;
      sceneOperation = null;
      newSceneButton.setEnabled(true);
      updateSlotToolbar();
      window.setEnabled(true);
    }
    if (message.operation === 'load-soundfont' && Number.isInteger(message.channel)) {
      const slot = slots[message.channel];
      if (slot && rows[message.channel]) {
        slot.loaded = false;
        rows[message.channel].test.setEnabled(false);
        rows[message.channel].modulation.setEnabled(false);
      }
    }
    status.setText(message.channel === undefined
      ? audioStartupStage
      : `Áudio · parte ${message.channel + 1}: ${message.message}`);
  }
});
let appClosing = false;
let workerCloseTimer = null;
worker.on('error', error => {
  audioWorkerOnline = false;
  audioReady = false;
  if (clearingScene) {
    clearingScene = false;
    sceneOperation = null;
    newSceneButton.setEnabled(true);
    updateSlotToolbar();
    window.setEnabled(true);
  }
  audioWorkerFailure = { message: error.message, stack: error.stack || error.message };
  const logFile = writeAudioWorkerLog(`WORKER ERROR\n${audioWorkerFailure.stack}`);
  audioStartupStage = `Falha na thread local de áudio: ${error.message}`;
  pendingAudioOutput = null;
  clearTimeout(audioStartupTimer);
  status.setText(`${audioStartupStage} Detalhes: ${logFile}`);
});
worker.on('exit', code => {
  if (!appClosing) {
    audioWorkerOnline = false;
    audioReady = false;
    if (clearingScene) {
      clearingScene = false;
      sceneOperation = null;
      newSceneButton.setEnabled(true);
      updateSlotToolbar();
      window.setEnabled(true);
    }
    pendingAudioOutput = null;
    clearTimeout(audioStartupTimer);
    const lastStage = audioStartupStage;
    const logFile = writeAudioWorkerLog([
      `WORKER EXIT code=${code}`,
      `last-stage=${lastStage}`,
      audioWorkerFailure ? `error=${audioWorkerFailure.stack}` : 'worker-error-event=none'
    ].join('\n'));
    audioStartupStage = audioWorkerFailure
      ? `Falha na thread local de áudio: ${audioWorkerFailure.message}`
      : `Thread local encerrou (código ${code}); última etapa: ${lastStage}`;
    status.setText(`${audioStartupStage}. Detalhes: ${logFile}`);
  }
});
refreshAudioDevices();
refreshScenes();
refreshMidi();
app.addEventListener('aboutToQuit', () => {
  appClosing = true;
  clearInterval(systemUsageTimer);
  if (audioTester) audioTester.kill('SIGTERM');
  if (midiInput) midiInput.closePort();
  worker.postMessage({ type: 'close' });
  workerCloseTimer = setTimeout(() => worker.terminate(), 3000);
});
if (process.env.SAMNAT_KIOSK === '1') {
  window.showFullScreen();
  setTimeout(() => {
    const splash = spawn('/usr/bin/psplash-write', ['QUIT'], { stdio: 'ignore' });
    splash.on('error', () => undefined);
  }, 600);
} else window.show();
// Qode injects Qt's event loop into Node's loop. Calling app.exec() here
// starts a blocking Qt-only loop, which starves Node timers, Worker messages,
// and child-process events (including FluidSynth and the direct audio test).
global.__samnatNativeApp = app;
global.__samnatNativeWindow = window;
