const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { Worker } = require('worker_threads');
const {
  QApplication, QMainWindow, QWidget, QBoxLayout, Direction, QLabel,
  QPushButton, QSlider, QFileDialog, FileMode, Orientation, QComboBox,
  QScrollArea, QLineEdit
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
central.setInlineStyle('background-color: #111827; color: #f9fafb; padding: 14px;');
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
  widget.addEventListener('clicked', handler);
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
  parent.addWidget(line);
  return lineLayout;
}

layout.addWidget(label('SamNat Synth · 8 partes · FluidSynth nativo', 'font-size: 22px; font-weight: 700; padding: 6px;'));
const status = label('Inicializando áudio...', 'color: #93c5fd; padding: 4px 6px;');
layout.addWidget(status);

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
function testAudioOutput(output) {
  if (!output) return;
  if (audioTester) {
    status.setText('O teste de áudio já está em execução.');
    return;
  }
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
    status.setText(`Não foi possível iniciar ${command}: ${error.message}`);
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
    testAudioButton.setEnabled(audioDevices.length > 0);
    const detail = [error, outputText.trim()].filter(Boolean).join('\n').slice(-1200);
    status.setText(code === 0 && !timedOut
      ? `Teste por ${backend} terminou sem erro em ${output.label}. Se ficou mudo, a rota abriu; confira mixer/saída física.`
      : `Falha no teste direto por ${backend} em ${output.label} (código ${code === null ? 1 : code}): ${detail || `${signal || command} terminou sem detalhes.`}`);
  };
  testAudioButton.setEnabled(false);
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
audioLineLayout.addWidget(label('Saída de áudio'));
audioLineLayout.addWidget(audioDeviceList);
audioLineLayout.addWidget(button('Atualizar saídas', refreshAudioDevices));
const testAudioButton = button('Teste direto de som (440 Hz)', () => {
  const output = audioDevices[audioDeviceList.currentIndex()];
  if (!output) return;
  status.setText(`Preparando teste de 440 Hz em ${output.label}...`);
  testAudioOutput(output);
});
audioLineLayout.addWidget(testAudioButton);
layout.addWidget(audioLine);
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
const slots = Array.from({ length: CHANNELS }, (_, channel) => ({
  channel, file: '', bank: 0, program: 0, presetName: '', loaded: false,
  syncingPreset: false, volume: 85, reverb: 0, chorus: 0, active: false, midiVolumeCC: null
}));
const rows = [];
let midiLearnChannel = null;
const rowHost = new QWidget();
const rowLayout = new QBoxLayout(Direction.TopToBottom);
rowHost.setLayout(rowLayout);
const scroll = new QScrollArea();
scroll.setWidget(rowHost);
scroll.setWidgetResizable(true);

function chooseSoundFont(channel) {
  const dialog = new QFileDialog(window, `SoundFont do canal ${channel + 1}`, SF_DIR, 'SoundFonts (*.sf2)');
  dialog.setFileMode(FileMode.ExistingFile);
  dialog.setNameFilter('SoundFonts (*.sf2)');
  dialog.exec();
  const selected = dialog.selectedFiles();
  if (!selected.length) return;
  const file = selected[0];
  slots[channel].loaded = false;
  rows[channel].test.setEnabled(false);
  rows[channel].name.setText(path.basename(file));
  slots[channel].syncingPreset = true;
  slots[channel].program = 0;
  rows[channel].program.setText('0');
  slots[channel].syncingPreset = false;
  slots[channel].file = file;
  worker.postMessage({ type: 'load-soundfont', channel, file, bank: slots[channel].bank, program: slots[channel].program });
  status.setText(audioReady
    ? `Carregando ${path.basename(file)} no canal ${channel + 1}...`
    : `SF2 selecionado; aguardando áudio. Estado: ${audioStartupStage}`);
}

function makeSlot(slot) {
  const row = new QWidget();
  const stack = new QBoxLayout(Direction.TopToBottom);
  row.setLayout(stack);
  row.setInlineStyle('background-color: #1f2937; border: 1px solid #374151; border-radius: 7px; margin: 3px; padding: 6px;');
  const sourceLine = horizontal(stack);
  sourceLine.addWidget(label(`PARTE ${slot.channel + 1}`, 'font-weight: 700;'));
  const name = label('Sem SF2', 'color: #d1d5db;');
  sourceLine.addWidget(name);
  sourceLine.addWidget(button('Abrir SF2', () => chooseSoundFont(slot.channel)));
  const bank = new QLineEdit(); bank.setPlaceholderText('Banco'); bank.setText('0'); bank.setMaximumWidth(58);
  bank.addEventListener('textChanged', value => {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 0) {
      slot.bank = n;
      if (slot.file && slot.loaded) worker.postMessage({ type: 'program', channel: slot.channel, file: slot.file, bank: slot.bank, program: slot.program });
    }
  });
  sourceLine.addWidget(bank);
  const program = new QLineEdit(); program.setPlaceholderText('Preset'); program.setText('0'); program.setMaximumWidth(58);
  program.addEventListener('textChanged', value => {
    const n = Number(value); if (!slot.syncingPreset && Number.isInteger(n) && n >= 0 && n <= 127) {
      slot.program = n;
      if (slot.file) worker.postMessage({ type: 'program', channel: slot.channel, file: slot.file, bank: slot.bank, program: n });
    }
  });
  sourceLine.addWidget(program);
  const mixLine = horizontal(stack);
  const volumeLabel = label(`Vol ${slot.volume}%`, 'min-width: 62px;');
  mixLine.addWidget(volumeLabel);
  const volumeControl = slider(0, 100, slot.volume, value => {
    slot.volume = value; volumeLabel.setText(`Vol ${value}%`);
    worker.postMessage({ type: 'volume', channel: slot.channel, value });
  });
  mixLine.addWidget(volumeControl);
  const reverb = slider(0, 100, slot.reverb, value => { slot.reverb = value; worker.postMessage({ type: 'effects', channel: slot.channel, reverb: value, chorus: slot.chorus }); });
  reverb.setMaximumWidth(90); mixLine.addWidget(label('Rev')); mixLine.addWidget(reverb);
  const chorus = slider(0, 100, slot.chorus, value => { slot.chorus = value; worker.postMessage({ type: 'effects', channel: slot.channel, reverb: slot.reverb, chorus: value }); });
  chorus.setMaximumWidth(90); mixLine.addWidget(label('Cho')); mixLine.addWidget(chorus);
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
  rows[slot.channel] = { name, bank, program, test, volumeControl, volumeLabel, reverb, chorus, midiLearn };
  rowLayout.addWidget(row);
}
slots.forEach(makeSlot);
const systemSoundFont = ['/usr/share/sounds/sf2/FluidR3_GM.sf2', '/usr/share/soundfonts/default.sf2']
  .find(file => fs.existsSync(file));
if (systemSoundFont) {
  slots[0].file = systemSoundFont;
  rows[0].name.setText(`${path.basename(systemSoundFont)} (sistema)`);
  worker.postMessage({ type: 'load-soundfont', channel: 0, file: systemSoundFont, bank: 0, program: 0 });
}

const keyboard = new QWidget();
const keyboardLayout = new QBoxLayout(Direction.TopToBottom); keyboard.setLayout(keyboardLayout);
layout.addWidget(label('Teclado de duas oitavas · notas nas partes carregadas'));
const keyRows = [horizontal(keyboardLayout), horizontal(keyboardLayout)];
for (let note = 48; note <= 72; note++) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const key = button(`${names[note % 12]}${Math.floor(note / 12) - 1}`, () => {
    worker.postMessage({ type: 'note-on', source: 'keyboard', note, velocity: 100 });
    setTimeout(() => worker.postMessage({ type: 'note-off', source: 'keyboard', note }), 250);
  });
  key.setMinimumWidth(42);
  keyRows[note <= 60 ? 0 : 1].addWidget(key);
}
layout.addWidget(keyboard);
scroll.setMaximumHeight(310);
layout.addWidget(scroll);

const tools = new QWidget(); const toolsLayout = new QBoxLayout(Direction.TopToBottom); tools.setLayout(toolsLayout); layout.addWidget(tools);
const libraryLine = horizontal(toolsLayout);
libraryLine.addWidget(button('Importar SF2 para biblioteca', () => importSoundFont()));
const catalog = require('./soundfont-catalog.json');
const sfUrl = new QLineEdit(); sfUrl.setPlaceholderText('URL direta de um arquivo SF2'); sfUrl.setMinimumWidth(280);
const catalogList = new QComboBox();
catalog.items.forEach(item => catalogList.addItem(undefined, `${item.category} · ${item.name}`));
catalogList.addEventListener('currentIndexChanged', index => {
  const item = catalog.items[index];
  if (item) sfUrl.setText(`${catalog.baseUrl}${item.file.split('/').map(encodeURIComponent).join('/')}`);
});
libraryLine.addWidget(catalogList);
libraryLine.addWidget(sfUrl);
libraryLine.addWidget(button('Baixar SF2', () => downloadSoundFont()));
const sceneLine = horizontal(toolsLayout);
const sceneName = new QLineEdit(); sceneName.setPlaceholderText('Nome da cena');
sceneLine.addWidget(sceneName);
sceneLine.addWidget(button('Salvar cena', () => saveScene()));
const sceneList = new QComboBox(); sceneLine.addWidget(sceneList);
sceneLine.addWidget(button('Carregar cena', () => loadScene()));
sceneLine.addWidget(button('Excluir cena', () => deleteScene()));
const midiLine = horizontal(toolsLayout);
const midiList = new QComboBox(); midiLine.addWidget(midiList);
midiLine.addWidget(button('Atualizar MIDI', refreshMidi));
midiLine.addWidget(button('Conectar MIDI', connectMidi));
layout.addWidget(label(`Biblioteca local: ${SF_DIR}`, 'color: #9ca3af; padding: 4px;'));

let midiInput = null;
let midi;
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
function connectMidi() {
  try {
    if (!midi) midi = require('midi');
    if (midiInput) { midiInput.closePort(); midiInput = null; }
    midiInput = new midi.Input();
    const port = midiList.currentIndex();
    if (port < 0 || port >= midiInput.getPortCount()) throw new Error('Selecione uma entrada MIDI.');
    midiInput.on('message', (_delta, bytes) => {
      const command = bytes[0] & 0xf0;
      const note = bytes[1]; const value = bytes[2] || 0;
      const channel = (bytes[0] & 0x0f) % CHANNELS;
      if (command === 0x90 && value > 0) worker.postMessage({ type: 'note-on', channel, note, velocity: value });
      else if (command === 0x80 || (command === 0x90 && value === 0)) worker.postMessage({ type: 'note-off', channel, note });
      else if (command === 0xb0) {
        if (bytes[1] === 64) slots.forEach(s => worker.postMessage({ type: 'control', channel: s.channel, controller: 64, value }));
        if (bytes[1] === 1) slots.forEach(s => worker.postMessage({ type: 'control', channel: s.channel, controller: 1, value }));
        if (midiLearnChannel !== null) {
          slots[midiLearnChannel].midiVolumeCC = bytes[1];
          status.setText(`CC ${bytes[1]} associado ao volume da parte ${midiLearnChannel + 1}.`);
          midiLearnChannel = null;
        } else {
          slots.filter(s => s.midiVolumeCC === bytes[1]).forEach(s => {
            s.volume = Math.round(value * 100 / 127);
            rows[s.channel].volumeControl.setValue(s.volume);
            rows[s.channel].volumeLabel.setText(`Vol ${s.volume}%`);
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
function refreshScenes(selectName) {
  const scenes = readScenes(); sceneList.clear();
  scenes.forEach(scene => sceneList.addItem(undefined, scene.name));
  if (selectName) {
    const index = scenes.findIndex(scene => scene.name === selectName);
    if (index >= 0) sceneList.setCurrentIndex(index);
  }
}
function writeScenes(scenes) { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(SCENE_FILE, JSON.stringify(scenes, null, 2)); }
function saveScene() {
  const name = sceneName.text().trim(); if (!name) { status.setText('Informe um nome para a cena.'); return; }
  const scenes = readScenes();
  const data = { name, slots: slots.map(({ channel, ...slot }) => ({ channel, ...slot })) };
  const existing = scenes.findIndex(scene => scene.name === name);
  if (existing < 0) scenes.push(data); else scenes[existing] = data;
  writeScenes(scenes); refreshScenes(name); status.setText(`Cena “${name}” salva.`);
}
function loadScene() {
  const scene = readScenes()[sceneList.currentIndex()]; if (!scene) return;
  scene.slots.forEach(saved => {
    const slot = slots[saved.channel]; if (!slot) return;
    Object.assign(slot, saved);
    slot.loaded = false;
    slot.syncingPreset = true;
    rows[slot.channel].bank.setText(String(slot.bank)); rows[slot.channel].program.setText(String(slot.program));
    slot.syncingPreset = false;
    rows[slot.channel].test.setEnabled(false);
    rows[slot.channel].name.setText(slot.file ? path.basename(slot.file) : 'Sem SF2');
    rows[slot.channel].volumeControl.setValue(slot.volume); rows[slot.channel].volumeLabel.setText(`Vol ${slot.volume}%`);
    rows[slot.channel].reverb.setValue(slot.reverb); rows[slot.channel].chorus.setValue(slot.chorus);
    if (slot.file && fs.existsSync(slot.file)) worker.postMessage({ type: 'load-soundfont', channel: slot.channel, file: slot.file, bank: slot.bank, program: slot.program });
    worker.postMessage({ type: 'volume', channel: slot.channel, value: slot.volume });
    worker.postMessage({ type: 'effects', channel: slot.channel, reverb: slot.reverb, chorus: slot.chorus });
  });
  status.setText(`Cena “${scene.name}” carregada.`);
}
function deleteScene() {
  const index = sceneList.currentIndex(); const scenes = readScenes(); if (index < 0) return;
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
  if (message.type === 'audio-stage') {
    audioStartupStage = message.stage;
    writeAudioWorkerLog(`AUDIO STAGE: ${message.stage}`);
    status.setText(message.stage);
  }
  if (message.type === 'error' && message.channel === undefined) clearTimeout(audioStartupTimer);
  if (message.type === 'audio-output-error') {
    audioReady = false;
    audioStartupStage = `Erro ao abrir áudio: ${message.message}`;
    writeAudioWorkerLog(`AUDIO OUTPUT ERROR: ${message.message}`);
    clearTimeout(audioStartupTimer);
    status.setText(audioStartupStage);
  }
  if (message.type === 'ready') {
    audioReady = true;
    audioStartupStage = `FluidSynth pronto em ${message.label}.`;
    writeAudioWorkerLog(`AUDIO READY: ${message.backend} ${message.label}`);
    clearTimeout(audioStartupTimer);
    status.setText(audioDevices.length
      ? `FluidSynth nativo abriu ${message.backend} em ${message.label} · carregue um SF2 para tocar teclado ou MIDI.`
      : 'FluidSynth nativo pronto, mas nenhuma saída real foi detectada no ALSA ou PulseAudio/PipeWire.');
  }
  if (message.type === 'loaded') {
    const slot = slots[message.channel];
    slot.bank = message.bank;
    slot.program = message.program;
    slot.presetName = message.presetName;
    slot.syncingPreset = true;
    rows[message.channel].bank.setText(String(message.bank));
    rows[message.channel].program.setText(String(message.program));
    slot.syncingPreset = false;
    slot.loaded = true;
    rows[message.channel].test.setEnabled(true);
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
    if (message.operation === 'load-soundfont' && Number.isInteger(message.channel)) {
      slots[message.channel].loaded = false;
      rows[message.channel].test.setEnabled(false);
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
  if (audioTester) audioTester.kill('SIGTERM');
  if (midiInput) midiInput.closePort();
  worker.postMessage({ type: 'close' });
  workerCloseTimer = setTimeout(() => worker.terminate(), 3000);
});
window.show();
// Qode injects Qt's event loop into Node's loop. Calling app.exec() here
// starts a blocking Qt-only loop, which starves Node timers, Worker messages,
// and child-process events (including FluidSynth and the direct audio test).
global.__samnatNativeApp = app;
global.__samnatNativeWindow = window;
