const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const { Worker } = require('worker_threads');
const {
  QApplication, QMainWindow, QWidget, QBoxLayout, Direction, QLabel,
  QPushButton, QSlider, QCheckBox, QFileDialog, FileMode, Orientation, QComboBox,
  QScrollArea, QLineEdit, QShortcut, QKeySequence, QProgressBar, ShortcutContext,
  QDialog, QIcon, QSize, DialogCode, WidgetEventTypes, AlignmentFlag
} = require('@nodegui/nodegui');

const CHANNELS = 8;
const DATA_DIR = path.join(os.homedir(), '.samnat-synth');
const SF_DIR = path.join(DATA_DIR, 'soundfonts');
const SCENE_FILE = path.join(DATA_DIR, 'scenes.json');
const ICON_DIR = path.join(__dirname, 'icons');
const APP_LOGO_FILE = [
  path.join(__dirname, 'samnat-logo.png'),
  path.join(__dirname, '../deploy/linux/SamnatSynthNative/default.png')
].find(file => fs.existsSync(file));
const DEFAULT_SCENE_NAME = 'Cena inicial';
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
function setButtonIcon(widget, name, size = 18) {
  const file = path.join(ICON_DIR, `${name}.svg`);
  if (!fs.existsSync(file)) return;
  widget.setIcon(new QIcon(file));
  widget.setIconSize(new QSize(size, size));
}
function setSlotInstrumentIcon(slot, name = slot.presetName || slot.file) {
  const text = String(name || '').toLowerCase();
  const categories = [
    { pattern: /drum|percussion|bateria/, icon: 'drums', label: 'Bateria' },
    { pattern: /electric[\s_-]?pianos?|e.?pianos?|\beps\b|rhodes|wurli/, icon: 'eps', label: 'Piano elétrico' },
    { pattern: /violin|viola|cello|contrabass/, icon: 'violin', label: 'Cordas · solista' },
    { pattern: /bass|baixo/, icon: 'bass', label: 'Baixo' },
    { pattern: /guitar|guitarra/, icon: 'guitars', label: 'Guitarras' },
    { pattern: /lead|saw/, icon: 'leads', label: 'Leads' },
    { pattern: /organ|drawbar|church|accordion|acordion|bandoneon/, icon: 'organs', label: 'Órgãos' },
    { pattern: /pad|warm|halo|space voice|sweep/, icon: 'pads', label: 'Pads' },
    { pattern: /piano|harpsi|grand|dx7/, icon: 'pianos', label: 'Pianos' },
    { pattern: /string|cordas/, icon: 'strings', label: 'Cordas' },
    { pattern: /world|ethnic|oriental/, icon: 'world', label: 'World' },
    { pattern: /ice rain|\bfx\b|effect/, icon: 'fx', label: 'Efeitos' },
    { pattern: /bell|chime|harp/, icon: 'bells', label: 'Sinos e harpa' },
    { pattern: /brass|trumpet|trombone/, icon: 'brass', label: 'Metais' },
    { pattern: /flute|piccolo/, icon: 'flute', label: 'Flauta' }
  ];
  const category = categories.find(({ pattern }) => pattern.test(text));
  const icon = category?.icon || 'instrument';
  const file = path.join(ICON_DIR, `${icon}.svg`);
  if (fs.existsSync(file)) rows[slot.channel]?.instrumentIcon.setPixmap(new QIcon(file).pixmap(26, 26));
  rows[slot.channel]?.instrumentIcon.setToolTip(`Categoria do timbre: ${category?.label || 'Instrumento'}`);
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
const status = label('Inicializando áudio...', 'font-size: 12px; color: #165dba; padding: 6px 9px; background: #e7f3ff; border: 1px solid #cfe4ff; border-radius: 9px;');
status.setAlignment(AlignmentFlag.AlignCenter);
status.setWordWrap(true);
status.setMinimumWidth(120);
status.setMinimumHeight(42);
const systemUsageLabel = label('CPU --%\nRAM --', 'font-size: 13px; font-weight: 600; color: #344054; padding: 8px 10px; background: #f2f4f7; border: 1px solid #e1e5eb; border-radius: 8px;');
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
    systemUsageLabel.setText(`CPU ${cpuText}%\nRAM ${usedMb}/${totalMb} MiB · ${ramPercent}%`);
  } catch (_) {
    const totalMb = Math.round(os.totalmem() / 1048576);
    const usedMb = Math.round((os.totalmem() - os.freemem()) / 1048576);
    const ramPercent = totalMb > 0 ? Math.round(usedMb * 100 / totalMb) : 0;
    systemUsageLabel.setText(`CPU --%\nRAM ${usedMb}/${totalMb} MiB · ${ramPercent}%`);
  }
}
updateSystemUsage();
const systemUsageTimer = setInterval(updateSystemUsage, 5000);
if (APP_LOGO_FILE) {
  const logo = new QLabel();
  logo.setFixedSize(48, 48);
  logo.setScaledContents(true);
  logo.setPixmap(new QIcon(APP_LOGO_FILE).pixmap(48, 48));
  headerLayout.addWidget(logo);
}
headerLayout.addWidget(titleBlock);
headerLayout.addWidget(status, 1);
headerLayout.addWidget(systemUsageLabel);
const batteryStatusLabel = label('▰ --%', 'font-size: 15px; font-weight: 700; color: #344054; padding: 8px 10px; background: #f2f4f7; border: 1px solid #e1e5eb; border-radius: 8px;');
const batteryWarningLabel = label('Bateria abaixo de 20% · conecte o carregador.', 'font-size: 13px; font-weight: 700; color: #a12622; padding: 9px 12px; background: #fff1f0; border: 1px solid #fecdca; border-radius: 8px;');
batteryWarningLabel.setVisible(false);
headerLayout.addWidget(batteryStatusLabel);
const shutdownButton = button('Desligar');
setButtonIcon(shutdownButton, 'power');
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
layout.addWidget(batteryWarningLabel);

const midiConnectionPanel = new QWidget();
const midiConnectionLayout = new QBoxLayout(Direction.LeftToRight);
midiConnectionPanel.setLayout(midiConnectionLayout);
midiConnectionLayout.setContentsMargins(12, 8, 12, 8);
midiConnectionLayout.setSpacing(9);
midiConnectionPanel.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 9px;');
midiConnectionLayout.addWidget(label('Controlador MIDI', 'font-size: 13px; font-weight: 700; color: #344054;'));
const midiList = new QComboBox();
midiList.setMinimumHeight(36);
midiList.setMinimumWidth(150);
midiConnectionLayout.addWidget(midiList, 3);
const midiRouting = new QComboBox();
midiRouting.addItem(undefined, 'Controlador: todas as partes');
midiRouting.addItem(undefined, 'Controlador: canal correspondente');
midiRouting.setMinimumHeight(36);
midiRouting.setMinimumWidth(170);
midiConnectionLayout.addWidget(midiRouting, 2);
const refreshMidiButton = button('Atualizar', () => refreshMidi(false));
setButtonIcon(refreshMidiButton, 'refresh');
midiConnectionLayout.addWidget(refreshMidiButton);
const defaultMidiButton = button('Usar como padrão', () => connectMidi(false));
setButtonIcon(defaultMidiButton, 'connect');
midiConnectionLayout.addWidget(defaultMidiButton);
const audioOptionsButton = button('Áudio', openAudioTestDialog);
setButtonIcon(audioOptionsButton, 'audio');
audioOptionsButton.setToolTip('Selecionar saída e testar o áudio');
midiConnectionLayout.addWidget(audioOptionsButton);
layout.addWidget(midiConnectionPanel);

function readPowerSupplyValue(supply, field) {
  try { return fs.readFileSync(path.join('/sys/class/power_supply', supply, field), 'utf8').trim(); }
  catch (_) { return ''; }
}
function updateBatteryStatus() {
  try {
    const supplies = fs.readdirSync('/sys/class/power_supply');
    const battery = supplies.find(name => readPowerSupplyValue(name, 'type') === 'Battery');
    if (!battery) {
      batteryStatusLabel.setVisible(false);
      batteryWarningLabel.setVisible(false);
      return;
    }
    const capacity = Number.parseInt(readPowerSupplyValue(battery, 'capacity'), 10);
    if (!Number.isFinite(capacity)) throw new Error('capacidade da bateria indisponível');
    const batteryState = readPowerSupplyValue(battery, 'status').toLowerCase();
    const externalPower = supplies.some(name => {
      const type = readPowerSupplyValue(name, 'type').toLowerCase();
      return ['mains', 'usb', 'usb_c', 'wireless'].includes(type) && readPowerSupplyValue(name, 'online') === '1';
    });
    const charging = batteryState === 'charging';
    const low = capacity < 20;
    batteryStatusLabel.setVisible(true);
    batteryStatusLabel.setText(`${charging || externalPower ? '▰+' : '▰'} ${capacity}%`);
    batteryStatusLabel.setToolTip(charging ? 'Bateria carregando' : externalPower ? 'Carregador conectado' : 'Bateria descarregando');
    batteryStatusLabel.setInlineStyle(low
      ? 'font-size: 15px; font-weight: 700; color: #b42318; padding: 8px 10px; background: #fff1f0; border: 1px solid #fecdca; border-radius: 8px;'
      : charging || externalPower
        ? 'font-size: 15px; font-weight: 700; color: #067647; padding: 8px 10px; background: #ecfdf3; border: 1px solid #abefc6; border-radius: 8px;'
        : 'font-size: 15px; font-weight: 700; color: #344054; padding: 8px 10px; background: #f2f4f7; border: 1px solid #e1e5eb; border-radius: 8px;');
    batteryWarningLabel.setVisible(low && !externalPower && !charging);
  } catch (_) {
    batteryStatusLabel.setVisible(true);
    batteryStatusLabel.setText('▰ --%');
    batteryStatusLabel.setToolTip('Estado da bateria indisponível');
    batteryWarningLabel.setVisible(false);
  }
}
updateBatteryStatus();
const batteryStatusTimer = setInterval(updateBatteryStatus, 30000);

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
sidePanel.setMinimumWidth(330);
sidePanel.setMaximumWidth(660);
sidePanel.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 12px;');
workspaceLayout.addWidget(sidePanel);
const mixerPanel = new QWidget();
const mixerLayout = new QBoxLayout(Direction.TopToBottom);
mixerPanel.setLayout(mixerLayout);
mixerLayout.setContentsMargins(0, 0, 0, 0);
mixerLayout.setSpacing(10);
workspaceLayout.addWidget(mixerPanel, 1);
workspaceLayout.setStretch(0, 7);
workspaceLayout.setStretch(1, 13);

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
let startupSceneLoadAttempted = false;
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
audioDeviceList.setMinimumHeight(38);
audioDeviceList.setMinimumWidth(300);
let audioDevices = [];
let refreshingAudioDevices = false;
const audioDialog = new QDialog(window);
audioDialog.setWindowTitle('Saída e teste de áudio');
audioDialog.setMinimumWidth(560);
const audioDialogLayout = new QBoxLayout(Direction.TopToBottom);
audioDialogLayout.setContentsMargins(18, 16, 18, 16);
audioDialogLayout.setSpacing(12);
audioDialog.setLayout(audioDialogLayout);
audioDialogLayout.addWidget(label('Selecione a saída e toque um tom curto para conferir o áudio.', 'font-size: 14px; font-weight: 600; color: #344054;'));
const audioDeviceLine = new QWidget();
const audioDeviceLineLayout = new QBoxLayout(Direction.LeftToRight);
audioDeviceLine.setLayout(audioDeviceLineLayout);
audioDeviceLineLayout.setContentsMargins(0, 0, 0, 0);
audioDeviceLineLayout.setSpacing(8);
audioDeviceLineLayout.addWidget(label('Saída', 'font-size: 12px; font-weight: 700; color: #475467;'));
audioDeviceLineLayout.addWidget(audioDeviceList, 1);
const refreshAudioButton = button('Atualizar', refreshAudioDevices);
setButtonIcon(refreshAudioButton, 'refresh', 16);
audioDeviceLineLayout.addWidget(refreshAudioButton);
audioDialogLayout.addWidget(audioDeviceLine);
const testAudioButton = button('Teste direto de som · 440 Hz', () => {
  const output = audioDevices[audioDeviceList.currentIndex()];
  if (!output) return;
  setAudioTestStatus(`Preparando teste de 440 Hz em ${output.label}...`);
  testAudioOutput(output);
});
setButtonIcon(testAudioButton, 'audio');
audioDialogLayout.addWidget(testAudioButton);
audioDialogLayout.addWidget(label('Atalhos: volume F11/F12 · brilho F5 (−)/F6 (+) · teclas Fn', 'font-size: 12px; color: #65676b;'));
const audioDialogStatus = label('Pronto para testar a saída selecionada.', 'font-size: 12px; color: #165dba; padding: 8px 10px; background: #e7f3ff; border: 1px solid #cfe4ff; border-radius: 8px;');
audioDialogStatus.setWordWrap(true);
audioDialogStatus.setMinimumHeight(48);
audioDialogLayout.addWidget(audioDialogStatus);
const audioDialogActions = new QWidget();
const audioDialogActionsLayout = new QBoxLayout(Direction.LeftToRight);
audioDialogActions.setLayout(audioDialogActionsLayout);
audioDialogActionsLayout.setContentsMargins(0, 0, 0, 0);
audioDialogActionsLayout.setSpacing(8);
const closeAudioDialogButton = button('Fechar', () => audioDialog.reject());
setButtonIcon(closeAudioDialogButton, 'close', 16);
audioDialogActionsLayout.addStretch(1);
audioDialogActionsLayout.addWidget(closeAudioDialogButton);
audioDialogLayout.addWidget(audioDialogActions);
function openAudioTestDialog() {
  audioDialog.exec();
}
function setAudioTestStatus(message) {
  status.setText(message);
  audioDialogStatus.setText(message);
}
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
    setAudioTestStatus('Teste terminado; reabrindo FluidSynth e restaurando os timbres...');
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
    setAudioTestStatus(`O teste terminou, mas o FluidSynth não reabriu: ${resumeError}`);
  } else {
    setAudioTestStatus(`${result}${pending.wasRunning ? ' FluidSynth e os timbres foram restaurados.' : ''}`);
  }
}

function testAudioOutput(output) {
  if (!output) return;
  if (audioTester || pendingAudioTest) {
    setAudioTestStatus('O teste de áudio já está em execução.');
    return;
  }
  const requestId = ++audioTestRequestId;
  pendingAudioTest = { requestId, output, phase: 'pausing', wasRunning: false };
  audioDeviceList.setEnabled(false);
  testAudioButton.setEnabled(false);
  setAudioTestStatus(`Liberando a saída ${output.label} para o teste ALSA...`);
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
  setAudioTestStatus(`Processo ${command} criado para ${output.label}; enviando tom de 440 Hz por 1,25 s...`);
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
    setAudioTestStatus(`O teste excedeu 6 segundos; encerrando ${command}...`);
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
    setAudioTestStatus(`Reproduzindo 440 Hz por 1,25 s via ${backend} em ${output.label}.`);
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
    audioDialogStatus.setText(audioStartupStage);
  }
}

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
    shortcut.setContext(ShortcutContext.ApplicationShortcut);
    shortcut.setAutoRepeat(true);
    shortcut.addEventListener('activated', () => adjustSystemVolume(action));
    volumeShortcuts.push(shortcut);
  } catch (error) {
    writeAudioWorkerLog(`SHORTCUT unavailable (${sequence}): ${error.message}`);
  }
}
addVolumeShortcut('Ctrl+F11', 'down');
addVolumeShortcut('Ctrl+F12', 'up');
addVolumeShortcut('F11', 'down');
addVolumeShortcut('F12', 'up');
addVolumeShortcut('Volume Up', 'up');
addVolumeShortcut('Volume Down', 'down');
addVolumeShortcut('Volume Mute', 'mute');

function adjustScreenBrightness(action) {
  const helper = '/usr/local/bin/samnat-brightness';
  if (!fs.existsSync(helper)) {
    status.setText('Controle de brilho disponível na imagem embarcada.');
    return;
  }
  const result = spawnSync(helper, [action], { encoding: 'utf8', timeout: 2000 });
  const detail = (result.stdout || result.stderr || '').trim().split(/\r?\n/).slice(-1)[0];
  status.setText(result.status === 0
    ? (detail || `Brilho ${action === 'up' ? 'aumentado' : 'reduzido'}.`)
    : `Não foi possível ajustar o brilho${detail ? `: ${detail}` : '.'}`);
}
const brightnessShortcuts = [];
function addBrightnessShortcut(sequence, action) {
  try {
    const shortcut = new QShortcut(window);
    const key = new QKeySequence(sequence);
    if (key.isEmpty()) return;
    shortcut.setKey(key);
    shortcut.setContext(ShortcutContext.ApplicationShortcut);
    shortcut.setAutoRepeat(true);
    shortcut.addEventListener('activated', () => adjustScreenBrightness(action));
    brightnessShortcuts.push(shortcut);
  } catch (error) {
    writeAudioWorkerLog(`BRIGHTNESS SHORTCUT unavailable (${sequence}): ${error.message}`);
  }
}
addBrightnessShortcut('F5', 'down');
addBrightnessShortcut('F6', 'up');
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
  setAudioTestStatus(`Abrindo ${output.label}...`);
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
    volume: 85, reverb: 0, chorus: 0, active: false, midiVolumeCC: null,
    controllerId: null, controllerName: ''
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
  row.soundFontProgress.setValue(0);
  row.soundFontProgress.setFormat('Timbre na memória · 0%');
  row.soundFontProgress.setVisible(false);
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
  row.instrumentIcon.clear();
  row.midiDevice.setText('MIDI · Padrão');
  row.midiDevice.setToolTip('Usar o controlador MIDI padrão neste slot');
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
  setSlotInstrumentIcon(slots[channel], file);
  slots[channel].syncingPreset = true;
  slots[channel].program = 0;
  slots[channel].programs = [];
  slots[channel].file = file;
  setProgramOptions(slots[channel], [], 0, 0, 'Lendo presets...');
  slots[channel].syncingPreset = false;
  beginSoundFontProgress(channel);
  worker.postMessage({ type: 'load-soundfont', channel, file, bank: slots[channel].bank, program: slots[channel].program });
  status.setText(audioReady
    ? `Carregando ${path.basename(file)} no canal ${channel + 1}...`
    : `SF2 selecionado; aguardando áudio. Estado: ${audioStartupStage}`);
}

function beginSoundFontProgress(channel) {
  const progress = rows[channel]?.soundFontProgress;
  if (!progress) return;
  progress.setValue(0);
  progress.setFormat('Carregando timbre na memória · 0% (estimativa)');
  progress.setVisible(true);
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
  const instrumentIcon = new QLabel();
  instrumentIcon.setFixedSize(28, 28);
  instrumentIcon.setScaledContents(true);
  sourceLine.addWidget(instrumentIcon);
  const name = label('Sem SF2', 'color: #65676b;');
  sourceLine.addWidget(name, 1);
  const openSoundFontButton = button('Abrir SF2', () => chooseSoundFont(slot.channel));
  setButtonIcon(openSoundFontButton, 'folder');
  openSoundFontButton.setMinimumWidth(105);
  sourceLine.addWidget(openSoundFontButton);
  const midiDevice = button('MIDI · Padrão', () => openSlotMidiDialog(slot));
  setButtonIcon(midiDevice, 'midi');
  midiDevice.setMinimumWidth(118);
  midiDevice.setToolTip('Escolher qual controlador MIDI controla este slot');
  const soundFontProgress = new QProgressBar();
  soundFontProgress.setRange(0, 100);
  soundFontProgress.setValue(0);
  soundFontProgress.setFormat('Timbre na memória · %p%');
  soundFontProgress.setTextVisible(true);
  soundFontProgress.setFixedHeight(20);
  soundFontProgress.setInlineStyle('border: 1px solid #d0d5dd; border-radius: 6px; background: #f2f4f7; color: #344054; text-align: center;');
  soundFontProgress.setVisible(false);
  stack.addWidget(soundFontProgress);
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
  setButtonIcon(test, 'note', 16);
  test.setEnabled(false);
  mixLine.addWidget(test);
  const midiLearn = button('MIDI Learn', () => { midiLearnChannel = slot.channel; status.setText(`MIDI Learn: mova um controle para associar ao volume da parte ${slot.channel + 1}.`); });
  setButtonIcon(midiLearn, 'midi', 16);
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
  modulationLine.addStretch(1);
  modulationLine.addWidget(midiDevice);
  rows[slot.channel] = { container: row, name, instrumentIcon, midiDevice, bank, program, test, soundFontProgress, volumeControl, volumeLabel, reverb, chorus, midiLearn, modulation };
  rowLayout.addWidget(row);
  row.setVisible(true);
}
ensureSlotCount(1);
const systemSoundFont = ['/usr/share/sounds/sf2/FluidR3_GM.sf2', '/usr/share/soundfonts/default.sf2']
  .find(file => fs.existsSync(file));

const keyboard = new QWidget();
const keyboardLayout = new QBoxLayout(Direction.TopToBottom);
keyboard.setLayout(keyboardLayout);
keyboardLayout.setContentsMargins(12, 10, 12, 10);
keyboardLayout.setSpacing(7);
keyboard.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 11px;');
keyboardLayout.addWidget(label('Teclado virtual', 'font-size: 13px; font-weight: 700; color: #344054;'));
const keybed = new QWidget();
keybed.setMinimumHeight(115);
keybed.setFixedHeight(115);
keybed.setInlineStyle('background: #ffffff;');
keyboardLayout.addWidget(keybed);

// Five octaves (C2–B6), with white keys spanning the bed and black keys
// positioned over their usual semitone boundaries.
const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const blackPitchClasses = [1, 3, 6, 8, 10];
const whiteNotes = [];
for (let note = 36; note <= 95; note++) {
  if (!blackPitchClasses.includes(note % 12)) whiteNotes.push(note);
}
const whiteKeys = [];
const blackKeys = [];
const pianoKeyWidgets = new Map();
const pianoKeyStyles = new Map();
const activePianoNoteSources = new Map();
function updatePianoKeyHighlight(note, active) {
  const widget = pianoKeyWidgets.get(note);
  const styles = pianoKeyStyles.get(note);
  if (widget && styles) widget.setInlineStyle(active ? styles.active : styles.idle, false);
}
function setPianoNoteActive(note, source, active) {
  if (!pianoKeyStyles.has(note)) return;
  let sources = activePianoNoteSources.get(note);
  const wasActive = Boolean(sources?.size);
  if (active) {
    if (!sources) {
      sources = new Set();
      activePianoNoteSources.set(note, sources);
    }
    sources.add(source);
  } else if (sources) {
    sources.delete(source);
    if (!sources.size) activePianoNoteSources.delete(note);
  }
  const isActive = Boolean(activePianoNoteSources.get(note)?.size);
  if (wasActive !== isActive) updatePianoKeyHighlight(note, isActive);
}
function clearPianoVisualNotes(sourcePrefix = '') {
  for (const [note, sources] of activePianoNoteSources) {
    for (const source of sources) {
      if (!sourcePrefix || source.startsWith(sourcePrefix)) sources.delete(source);
    }
    if (!sources.size) {
      activePianoNoteSources.delete(note);
      updatePianoKeyHighlight(note, false);
    }
  }
}
function createPianoKey(note, isBlack) {
  const key = new QPushButton(keybed);
  key.setText('');
  key.setMinimumSize(0, 0);
  key.setToolTip(`${noteNames[note % 12]}${Math.floor(note / 12) - 1}`);
  const idleStyle = isBlack
    ? 'QPushButton { background-color: #17191e; border: 1px solid #08090c; border-radius: 0 0 3px 3px; padding: 0; } QPushButton:hover { background-color: #35465d; } QPushButton:pressed { background-color: #1874e8; }'
    : 'QPushButton { background-color: #ffffff; border: 1px solid #9ca3af; border-radius: 0 0 3px 3px; padding: 0; } QPushButton:hover { background-color: #eaf2ff; } QPushButton:pressed { background-color: #b9d6ff; }';
  const activeStyle = isBlack
    ? 'QPushButton { background-color: #1874e8; border: 1px solid #0b55bd; border-radius: 0 0 3px 3px; padding: 0; } QPushButton:hover, QPushButton:pressed { background-color: #0b55bd; }'
    : 'QPushButton { background-color: #9bc2ff; border: 1px solid #1874e8; border-radius: 0 0 3px 3px; padding: 0; } QPushButton:hover, QPushButton:pressed { background-color: #b9d6ff; }';
  key.setInlineStyle(idleStyle, false);
  pianoKeyWidgets.set(note, key);
  pianoKeyStyles.set(note, { idle: idleStyle, active: activeStyle });
  key.addEventListener('pressed', () => {
    setPianoNoteActive(note, 'virtual-keyboard', true);
    worker.postMessage({ type: 'note-on', source: 'keyboard', note, velocity: 100 });
  });
  key.addEventListener('released', () => {
    setPianoNoteActive(note, 'virtual-keyboard', false);
    worker.postMessage({ type: 'note-off', source: 'keyboard', note });
  });
  return key;
}
whiteNotes.forEach(note => {
  whiteKeys.push({ note, widget: createPianoKey(note, false) });
});
whiteNotes.forEach((note, whiteIndex) => {
  const hasBlackAfter = whiteIndex < whiteNotes.length - 1 && blackPitchClasses.includes((note + 1) % 12);
  if (hasBlackAfter) blackKeys.push({ note: note + 1, whiteIndex, widget: createPianoKey(note + 1, true) });
});
function resizePiano(width = keybed.width()) {
  const actualWidth = Math.floor(width);
  if (actualWidth <= 0) return;

  const height = 115;
  const whiteWidth = actualWidth / whiteKeys.length;
  const blackWidth = whiteWidth * 0.62;
  const blackHeight = Math.round(height * 0.63);

  whiteKeys.forEach(({ widget }, index) => {
    const x1 = Math.round(index * whiteWidth);
    const x2 = Math.round((index + 1) * whiteWidth);
    widget.setGeometry(x1, 0, x2 - x1, height);
  });

  blackKeys.forEach(({ whiteIndex, widget }) => {
    const boundary = (whiteIndex + 1) * whiteWidth;
    const x = Math.round(boundary - blackWidth / 2);
    widget.setGeometry(x, 0, Math.round(blackWidth), blackHeight);
    widget.raise();
  });
}
keybed.addEventListener(WidgetEventTypes.Resize, () => resizePiano(keybed.width()), { afterDefault: true });
resizePiano(840);
const slotsToolbar = horizontal(mixerLayout);
slotCountLabel = label('Instrumentos · 1/8 partes', 'font-size: 16px; font-weight: 700; color: #344054;');
slotsToolbar.addWidget(slotCountLabel);
slotsToolbar.addStretch(1);
addSlotButton = button('+ Adicionar slot', addSlot);
setButtonIcon(addSlotButton, 'add');
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

function sectionPanel(parent, titleText, stretch = 0) {
  const panel = new QWidget();
  const panelLayout = new QBoxLayout(Direction.TopToBottom);
  panel.setLayout(panelLayout);
  panelLayout.setContentsMargins(11, 10, 11, 10);
  panelLayout.setSpacing(8);
  panel.setInlineStyle('background: #ffffff; border: 1px solid #e1e5eb; border-radius: 10px;');
  panelLayout.addWidget(label(titleText, 'font-size: 14px; font-weight: 700; color: #344054;'));
  parent.addWidget(panel, stretch);
  return panelLayout;
}

const scenePanelLayout = sectionPanel(toolsLayout, 'Cenas', 1);
const sceneName = new QLineEdit();
sceneName.setPlaceholderText('Nome da cena');
sceneName.setMinimumHeight(36);
scenePanelLayout.addWidget(sceneName);
const sceneSaveLine = horizontal(scenePanelLayout);
const saveSceneButton = button('Salvar cena', () => saveScene());
setButtonIcon(saveSceneButton, 'save');
sceneSaveLine.addWidget(saveSceneButton, 1);
const newSceneButton = button('Nova Cena', startNewScene);
setButtonIcon(newSceneButton, 'add');
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
scenePadArea.setMinimumHeight(240);
scenePadArea.setInlineStyle('border: 0; background: transparent;');
scenePanelLayout.addWidget(scenePadArea, 1);
let scenePadRows = [];
const sceneList = new QComboBox();
sceneList.setMinimumHeight(36);
scenePanelLayout.addWidget(sceneList);
const sceneLoadLine = horizontal(scenePanelLayout);
const loadSceneButton = button('Carregar', () => loadScene());
setButtonIcon(loadSceneButton, 'folder');
sceneLoadLine.addWidget(loadSceneButton, 1);
const deleteSceneButton = button('Excluir', () => deleteScene());
setButtonIcon(deleteSceneButton, 'trash');
sceneLoadLine.addWidget(deleteSceneButton, 1);

let midiInputs = new Map();
let midi;
let midiPorts = [];
let defaultMidiInputId = null;
let refreshingMidiList = false;
let midiHotplugTimer = null;
let pendingSceneMidiLearn = null;
const midiCcState = new Map();
const midiOpenErrors = new Map();
midiList.addEventListener('currentIndexChanged', index => {
  if (refreshingMidiList) return;
  const port = midiPorts[index];
  if (!port || !midiInputs.has(port.id)) return;
  defaultMidiInputId = port.id;
  updateSlotMidiButtons();
});
function getMidiPorts() {
  if (!midi) midi = require('midi');
  const probe = new midi.Input();
  try {
    const occurrences = new Map();
    return Array.from({ length: probe.getPortCount() }, (_, index) => {
      const name = probe.getPortName(index);
      const occurrence = occurrences.get(name) || 0;
      occurrences.set(name, occurrence + 1);
      return { id: `${name}\u0000${occurrence}`, name, index };
    });
  } finally {
    probe.closePort();
  }
}
function closeMidiInput(id) {
  const connection = midiInputs.get(id);
  if (connection) {
    clearPianoVisualNotes(`midi:${id}:`);
    try { connection.input.closePort(); } catch (_) { /* The ALSA port may already have disappeared. */ }
    midiInputs.delete(id);
  }
}
function closeAllMidiInputs() {
  for (const id of [...midiInputs.keys()]) closeMidiInput(id);
  defaultMidiInputId = null;
}
function slotMidiInputId(slot) {
  return slot.controllerId || defaultMidiInputId;
}
function updateSlotMidiButtons() {
  rows.forEach((row, channel) => {
    const slot = slotCache[channel];
    if (!row || !slot) return;
    const id = slotMidiInputId(slot);
    const connection = id ? midiInputs.get(id) : null;
    const savedName = slot.controllerId ? slot.controllerName : '';
    const name = connection?.name || savedName || 'Aguardando controlador';
    const shortName = name.length > 15 ? `${name.slice(0, 13)}…` : name;
    row.midiDevice.setText(`MIDI · ${shortName}`);
    row.midiDevice.setToolTip(slot.controllerId
      ? `${connection ? 'Controlador deste slot' : 'Controlador desconectado'}: ${name}. Clique para trocar.`
      : `${connection ? 'Controlador padrão para este slot' : 'Nenhum controlador conectado'}. Clique para escolher um controlador específico.`);
  });
}
function openSlotMidiDialog(slot) {
  const dialog = new QDialog(window);
  dialog.setWindowTitle(`Controlador MIDI · parte ${slot.channel + 1}`);
  dialog.setMinimumWidth(390);
  const dialogLayout = new QBoxLayout(Direction.TopToBottom);
  dialogLayout.setContentsMargins(18, 16, 18, 16);
  dialogLayout.setSpacing(12);
  dialog.setLayout(dialogLayout);
  dialogLayout.addWidget(label('Escolha qual controlador toca este slot.', 'font-size: 14px; font-weight: 600; color: #344054;'));
  const choices = [{ id: null, name: 'Padrão · primeiro controlador conectado' }, ...midiPorts
    .filter(port => midiInputs.has(port.id))
    .map(port => ({ id: port.id, name: port.name }))];
  const selector = new QComboBox();
  choices.forEach(choice => selector.addItem(undefined, choice.name));
  const selectedIndex = choices.findIndex(choice => choice.id === (slot.controllerId || null));
  selector.setCurrentIndex(selectedIndex >= 0 ? selectedIndex : 0);
  dialogLayout.addWidget(selector);
  const actions = new QWidget();
  const actionsLayout = new QBoxLayout(Direction.LeftToRight);
  actionsLayout.setContentsMargins(0, 0, 0, 0);
  actionsLayout.setSpacing(8);
  actions.setLayout(actionsLayout);
  const cancel = button('Cancelar', () => dialog.reject());
  const apply = button('Aplicar', () => dialog.accept());
  setButtonIcon(cancel, 'close', 16);
  setButtonIcon(apply, 'check', 16);
  actionsLayout.addWidget(cancel, 1);
  actionsLayout.addWidget(apply, 1);
  dialogLayout.addWidget(actions);
  if (dialog.exec() !== DialogCode.Accepted) return;
  const choice = choices[selector.currentIndex()] || choices[0];
  slot.controllerId = choice.id;
  slot.controllerName = choice.id ? choice.name : '';
  updateSlotMidiButtons();
  status.setText(choice.id
    ? `Parte ${slot.channel + 1} controlada por “${choice.name}”.`
    : `Parte ${slot.channel + 1} seguirá o controlador padrão.`);
}
function refreshMidi(silent = false) {
  try {
    const previousConnectionCount = midiInputs.size;
    const ports = getMidiPorts();
    const availableIds = new Set(ports.map(port => port.id));
    for (const id of [...midiInputs.keys()]) {
      if (!availableIds.has(id)) closeMidiInput(id);
    }
    for (const id of [...midiOpenErrors.keys()]) if (!availableIds.has(id)) midiOpenErrors.delete(id);
    midiPorts = ports;
    refreshingMidiList = true;
    midiList.clear();
    ports.forEach(port => midiList.addItem(undefined, port.name));
    for (const port of ports) {
      if (midiInputs.has(port.id)) continue;
      let input = null;
      try {
        if (!midi) midi = require('midi');
        input = new midi.Input();
        input.on('message', (_delta, bytes) => handleMidiMessage(port.id, bytes));
        input.openPort(port.index);
        midiInputs.set(port.id, { input, name: port.name });
        midiOpenErrors.delete(port.id);
      } catch (error) {
        try { input?.closePort(); } catch (_) { /* Failed MIDI open. */ }
        if (midiOpenErrors.get(port.id) !== error.message) {
          status.setText(`Não foi possível abrir o controlador “${port.name}”: ${error.message}`);
          midiOpenErrors.set(port.id, error.message);
        }
      }
    }
    if (!midiInputs.has(defaultMidiInputId)) defaultMidiInputId = ports.find(port => midiInputs.has(port.id))?.id || null;
    const defaultIndex = ports.findIndex(port => port.id === defaultMidiInputId);
    if (defaultIndex >= 0) midiList.setCurrentIndex(defaultIndex);
    refreshingMidiList = false;
    updateSlotMidiButtons();
    if (!ports.length) {
      if (!silent || previousConnectionCount) status.setText('MIDI pronto; aguardando controlador. Entradas novas conectarão automaticamente.');
      return;
    }
    if (!silent) {
      status.setText(`${midiInputs.size}/${ports.length} controlador(es) MIDI conectado(s). Padrão: ${midiInputs.get(defaultMidiInputId)?.name || 'nenhum'}.`);
    }
  } catch (error) {
    refreshingMidiList = false;
    if (!silent) status.setText(`Falha ao carregar MIDI: ${error.message}`);
  }
}
function midiTriggerLabel(trigger) {
  if (!trigger) return 'MIDI Learn';
  const source = trigger.type === 'note' ? `Nota ${trigger.data1}` : `CC ${trigger.data1}`;
  return `${source} · CH ${trigger.channel + 1}${trigger.inputName ? ` · ${trigger.inputName}` : ''}`;
}
function startSceneMidiLearn(sceneName) {
  if (!midiInputs.size) {
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
    item.midiTrigger.data1 === trigger.data1 && item.midiTrigger.inputId === trigger.inputId);
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
function findSceneForMidiTrigger(type, channel, data1, inputId) {
  return readScenes().find(scene => scene.midiTrigger && scene.midiTrigger.type === type &&
    scene.midiTrigger.channel === channel && scene.midiTrigger.data1 === data1 &&
    (!scene.midiTrigger.inputId || scene.midiTrigger.inputId === inputId));
}
function handleSceneMidiEvent(command, channel, data1, value, inputId) {
  const learningType = command === 0x90 && value > 0 ? 'note' : command === 0xb0 ? 'cc' : null;
  if (pendingSceneMidiLearn && learningType) {
    saveSceneMidiTrigger(pendingSceneMidiLearn, {
      type: learningType, channel, data1, inputId,
      inputName: midiInputs.get(inputId)?.name || ''
    });
    return true;
  }
  if (command === 0x90 && value > 0) {
    const scene = findSceneForMidiTrigger('note', channel, data1, inputId);
    if (scene) {
      loadSceneByName(scene.name);
      return true;
    }
  }
  if (command === 0x80 || (command === 0x90 && value === 0)) {
    return Boolean(findSceneForMidiTrigger('note', channel, data1, inputId));
  }
  if (command === 0xb0) {
    const key = `${inputId}:${channel}:${data1}`;
    const previousValue = midiCcState.get(key) ?? 0;
    midiCcState.set(key, value);
    if (previousValue === 0 && value > 0) {
      const scene = findSceneForMidiTrigger('cc', channel, data1, inputId);
      if (scene) {
        loadSceneByName(scene.name);
        return true;
      }
    }
  }
  return false;
}
function routedSlotsForMidi(inputId, midiChannel) {
  return slots.filter(slot => slotMidiInputId(slot) === inputId &&
    (midiRouting.currentIndex() === 0 || slot.channel === midiChannel % CHANNELS));
}
function handleMidiMessage(inputId, bytes) {
  if (clearingScene || !bytes || bytes.length < 2) return;
  const command = bytes[0] & 0xf0;
  const note = bytes[1];
  const value = bytes[2] || 0;
  const midiChannel = bytes[0] & 0x0f;
  if (handleSceneMidiEvent(command, midiChannel, note, value, inputId)) return;
  const channel = midiChannel % CHANNELS;
  const targetSlots = routedSlotsForMidi(inputId, midiChannel);
  const channels = targetSlots.map(slot => slot.channel);
  const visualSource = `midi:${inputId}:${midiChannel}`;
  if (command === 0x90 && value > 0) {
    if (targetSlots.length) setPianoNoteActive(note, visualSource, true);
    worker.postMessage({ type: 'note-on', source: 'midi', route: 'slots', inputId, channel, channels, note, velocity: value });
  } else if (command === 0x80 || (command === 0x90 && value === 0)) {
    setPianoNoteActive(note, visualSource, false);
    worker.postMessage({ type: 'note-off', source: 'midi', inputId, channel, note });
  } else if (command === 0xb0) {
    if (bytes[1] === 64 || bytes[1] === 1) {
      targetSlots.filter(slot => bytes[1] !== 1 || (slot.loaded && slot.modulationEnabled))
        .forEach(slot => worker.postMessage({ type: 'control', channel: slot.channel, controller: bytes[1], value }));
    }
    const learningSlot = midiLearnChannel === null ? null : slots[midiLearnChannel];
    if (learningSlot && slotMidiInputId(learningSlot) === inputId) {
      learningSlot.midiVolumeCC = bytes[1];
      status.setText(`CC ${bytes[1]} associado ao volume da parte ${midiLearnChannel + 1}.`);
      midiLearnChannel = null;
    } else {
      targetSlots.filter(slot => slot.midiVolumeCC === bytes[1]).forEach(slot => {
        slot.volume = Math.round(value * 100 / 127);
        rows[slot.channel].volumeControl.setValue(slot.volume);
        rows[slot.channel].volumeLabel.setText(`Volume ${slot.volume}%`);
      });
    }
  } else if (command === 0xe0) {
    const bend = bytes[1] | (value << 7);
    targetSlots.forEach(slot => worker.postMessage({ type: 'pitch-bend', channel: slot.channel, value: bend }));
  }
}
function connectMidi(silent = false) {
  const port = midiPorts[midiList.currentIndex()];
  if (!port || !midiInputs.has(port.id)) {
    if (!silent) status.setText('Selecione um controlador MIDI conectado.');
    return;
  }
  defaultMidiInputId = port.id;
  updateSlotMidiButtons();
  status.setText(`Controlador padrão: ${port.name}. As entradas MIDI detectadas permanecem conectadas.`);
}

function readScenes() {
  try {
    const scenes = JSON.parse(fs.readFileSync(SCENE_FILE, 'utf8'));
    return Array.isArray(scenes) ? scenes : [];
  } catch (_) { return []; }
}
function resolveBundledSoundFont(relativePath) {
  const candidates = [path.join(SF_DIR, relativePath), path.join(__dirname, '..', 'soundfonts', relativePath)];
  return candidates.find(file => fs.existsSync(file)) || candidates[0];
}
function makeDefaultScene() {
  const definitions = [
    ['Pianos/k-pc88.sf2', 0, 0],
    ['Pads/General_Montage_Pads_Warm.sf2', 0, 89],
    ['Strings e Brass/General_Montage_Strings_Section.sf2', 0, 48],
    ['Organs/General_Montage_Organs_Drawbar.sf2', 0, 16],
    ['Pianos/General_Montage_DX7.sf2', 0, 5],
    ['Synths/General_Montage_Leads.sf2', 0, 81],
    ['General_Montage_Bells.sf2', 0, 6],
    ['Bells e FX/General_Montage_FX.sf2', 0, 96]
  ];
  return {
    name: DEFAULT_SCENE_NAME,
    midiTrigger: null,
    slotCount: CHANNELS,
    slots: definitions.map(([relativePath, bank, program], channel) => ({
      channel,
      file: resolveBundledSoundFont(relativePath),
      bank,
      program,
      volume: channel === 0 ? 100 : 0,
      reverb: 0,
      chorus: 0,
      modulationEnabled: false,
      midiVolumeCC: null,
      controllerId: null,
      controllerName: ''
    }))
  };
}
function ensureDefaultScene() {
  const scenes = readScenes();
  if (scenes.some(scene => scene.name === DEFAULT_SCENE_NAME)) return;
  scenes.unshift(makeDefaultScene());
  writeScenes(scenes);
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
    setButtonIcon(launch, 'play', 16);
    launch.setMinimumHeight(42);
    launch.setInlineStyle('padding: 8px 10px; border: 1px solid #b8c9e2; border-radius: 8px; background: #edf4ff; color: #174ea6; font-weight: 700;');
    const learn = button(midiTriggerLabel(scene.midiTrigger), () => startSceneMidiLearn(scene.name));
    setButtonIcon(learn, 'midi', 14);
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
  updateSlotMidiButtons();
  sceneName.setText('');
  sceneList.setCurrentIndex(-1);
}
function beginSceneOperation(operation, message) {
  if (clearingScene) return;
  clearPianoVisualNotes();
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
    slots: slots.map(({ channel, file, bank, program, volume, reverb, chorus, modulationEnabled, midiVolumeCC, controllerId, controllerName }) => ({
      channel, file, bank, program, volume, reverb, chorus, modulationEnabled, midiVolumeCC, controllerId, controllerName
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
    slot.controllerId = typeof slot.controllerId === 'string' ? slot.controllerId : null;
    slot.controllerName = typeof slot.controllerName === 'string' ? slot.controllerName : '';

    const row = rows[index];
    slot.syncingPreset = true;
    row.bank.setText(String(slot.bank));
    row.test.setEnabled(false);
    row.name.setText(slot.file ? path.basename(slot.file) : 'Sem SF2');
    setSlotInstrumentIcon(slot);
    row.soundFontProgress.setValue(0);
    row.soundFontProgress.setFormat('Timbre na memória · 0%');
    row.soundFontProgress.setVisible(false);
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
      beginSoundFontProgress(index);
      worker.postMessage({ type: 'load-soundfont', channel: index, file: slot.file, bank: slot.bank, program: slot.program });
    } else if (slot.file) {
      missingFiles++;
      row.name.setText(`${path.basename(slot.file)} · arquivo ausente`);
    }
    worker.postMessage({ type: 'volume', channel: index, value: slot.volume });
    worker.postMessage({ type: 'effects', channel: index, reverb: slot.reverb, chorus: slot.chorus });
  });
  updateSlotMidiButtons();
  status.setText(missingFiles
    ? `Cena “${scene.name}” carregada; ${missingFiles} arquivo(s) SF2 não encontrado(s).`
    : `Cena “${scene.name}” carregada com ${slots.length} parte(s).`);
}
function deleteScene() {
  const index = sceneList.currentIndex(); const scenes = readScenes(); if (index < 0) return;
  if (pendingSceneMidiLearn === scenes[index]?.name) pendingSceneMidiLearn = null;
  scenes.splice(index, 1); writeScenes(scenes); refreshScenes(); status.setText('Cena removida.');
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
    setAudioTestStatus(`${pending.result} FluidSynth e os timbres foram restaurados.`);
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
    audioDialogStatus.setText(message.stage);
  }
  if (message.type === 'error' && message.channel === undefined) clearTimeout(audioStartupTimer);
  if (message.type === 'audio-output-error') {
    audioReady = false;
    slots.forEach(slot => rows[slot.channel].modulation.setEnabled(false));
    audioStartupStage = `Erro ao abrir áudio: ${message.message}`;
    writeAudioWorkerLog(`AUDIO OUTPUT ERROR: ${message.message}`);
    clearTimeout(audioStartupTimer);
    status.setText(audioStartupStage);
    audioDialogStatus.setText(audioStartupStage);
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
    if (!startupSceneLoadAttempted) {
      startupSceneLoadAttempted = true;
      adjustSystemVolume('init');
      const initialScene = readScenes().find(scene => scene.name === DEFAULT_SCENE_NAME);
      if (initialScene?.slots?.length === CHANNELS && initialScene.slots.every(slot => slot.file && fs.existsSync(slot.file))) {
        setTimeout(() => loadSceneByName(DEFAULT_SCENE_NAME), 0);
      } else if (systemSoundFont) {
        slots[0].file = systemSoundFont;
        rows[0].name.setText(`${path.basename(systemSoundFont)} (sistema)`);
        setSlotInstrumentIcon(slots[0], systemSoundFont);
        beginSoundFontProgress(0);
        worker.postMessage({ type: 'load-soundfont', channel: 0, file: systemSoundFont, bank: 0, program: 0 });
        if (initialScene) status.setText(`A cena inicial está sem alguns SF2; abri ${path.basename(systemSoundFont)} como fallback.`);
      } else if (initialScene) {
        const missing = initialScene.slots.filter(slot => slot.file && !fs.existsSync(slot.file)).length;
        status.setText(`Cena inicial salva, mas ${missing} SF2 não estão disponíveis na biblioteca local.`);
      }
    }
  }
  if (message.type === 'soundfont-progress') {
    const progressBar = rows[message.channel]?.soundFontProgress;
    if (progressBar) {
      const progress = Math.max(0, Math.min(100, Number(message.progress) || 0));
      progressBar.setValue(progress);
      if (progress === 100) {
        progressBar.setFormat('Timbre carregado na memória · 100%');
      } else if (message.residentBytes !== undefined && message.expectedBytes > 0) {
        const residentMiB = Math.round(message.residentBytes / 1048576);
        const expectedMiB = Math.round(message.expectedBytes / 1048576);
        progressBar.setFormat(`RAM do timbre · ${progress}% estimados (${residentMiB}/${expectedMiB} MiB)`);
      } else {
        progressBar.setFormat(`Carregando timbre na memória · ${progress}% (estimativa)`);
      }
      progressBar.setVisible(true);
    }
  }
  if (message.type === 'loaded') {
    const slot = slots[message.channel];
    if (!slot || !rows[message.channel]) return;
    slot.bank = message.bank;
    slot.program = message.program;
    slot.presetName = message.presetName;
    setSlotInstrumentIcon(slot, message.presetName || message.name);
    slot.syncingPreset = true;
    rows[message.channel].bank.setText(String(message.bank));
    slot.syncingPreset = false;
    setProgramOptions(slot, message.presets, message.bank, message.program);
    slot.loaded = true;
    rows[message.channel].test.setEnabled(true);
    rows[message.channel].modulation.setEnabled(audioReady);
    rows[message.channel].soundFontProgress.setValue(100);
    rows[message.channel].soundFontProgress.setFormat('Timbre carregado na memória · 100%');
    rows[message.channel].soundFontProgress.setVisible(true);
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
        rows[message.channel].soundFontProgress.setVisible(false);
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
ensureDefaultScene();
refreshScenes(DEFAULT_SCENE_NAME);
refreshMidi();
midiHotplugTimer = setInterval(() => refreshMidi(true), 2000);
app.addEventListener('aboutToQuit', () => {
  appClosing = true;
  clearInterval(systemUsageTimer);
  clearInterval(batteryStatusTimer);
  clearInterval(midiHotplugTimer);
  if (audioTester) audioTester.kill('SIGTERM');
  closeAllMidiInputs();
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
