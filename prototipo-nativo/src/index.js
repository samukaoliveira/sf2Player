const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const { Worker } = require('worker_threads');
const {
  QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel,
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
window.resize(1120, 800);
const central = new QWidget();
const layout = new QVBoxLayout();
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

layout.addWidget(label('SamNat Synth · 8 partes · FluidSynth no Node', 'font-size: 22px; font-weight: 700; padding: 6px;'));
const status = label('Inicializando áudio...', 'color: #93c5fd; padding: 4px 6px;');
layout.addWidget(status);

const worker = new Worker(path.join(__dirname, 'audio-worker.cjs'));
const slots = Array.from({ length: CHANNELS }, (_, channel) => ({
  channel, file: '', bank: 0, program: 0, volume: 85, reverb: 0, chorus: 0, active: false, midiVolumeCC: null
}));
const rows = [];
let midiLearnChannel = null;
const rowHost = new QWidget();
const rowLayout = new QVBoxLayout();
rowHost.setLayout(rowLayout);
const scroll = new QScrollArea();
scroll.setWidget(rowHost);
scroll.setWidgetResizable(true);
layout.addWidget(scroll);

function chooseSoundFont(channel) {
  const dialog = new QFileDialog(window, `SoundFont do canal ${channel + 1}`, SF_DIR, 'SoundFonts (*.sf2)');
  dialog.setFileMode(FileMode.ExistingFile);
  dialog.setNameFilter('SoundFonts (*.sf2)');
  dialog.exec();
  const selected = dialog.selectedFiles();
  if (!selected.length) return;
  const file = selected[0];
  slots[channel].file = file;
  rows[channel].name.setText(path.basename(file));
  rows[channel].program.setText('0');
  worker.postMessage({ type: 'load-soundfont', channel, file, bank: slots[channel].bank, program: slots[channel].program });
  status.setText(`Carregando ${path.basename(file)} no canal ${channel + 1}...`);
}

function makeSlot(slot) {
  const row = new QWidget();
  const line = new QHBoxLayout();
  row.setLayout(line);
  row.setInlineStyle('background-color: #1f2937; border: 1px solid #374151; border-radius: 7px; margin: 3px; padding: 6px;');
  line.addWidget(label(`PARTE ${slot.channel + 1}`, 'font-weight: 700; min-width: 62px;'));
  const name = label('Sem SF2', 'color: #d1d5db; min-width: 120px;');
  line.addWidget(name);
  line.addWidget(button('Abrir SF2', () => chooseSoundFont(slot.channel)));
  const bank = new QLineEdit(); bank.setPlaceholderText('Banco'); bank.setText('0'); bank.setMaximumWidth(58);
  bank.addEventListener('textChanged', value => { const n = Number(value); if (Number.isInteger(n) && n >= 0) slot.bank = n; });
  line.addWidget(bank);
  const program = new QLineEdit(); program.setPlaceholderText('Preset'); program.setText('0'); program.setMaximumWidth(58);
  program.addEventListener('textChanged', value => {
    const n = Number(value); if (Number.isInteger(n) && n >= 0 && n <= 127) {
      slot.program = n;
      if (slot.file) worker.postMessage({ type: 'program', channel: slot.channel, file: slot.file, bank: slot.bank, program: n });
    }
  });
  line.addWidget(program);
  const volumeLabel = label(`Vol ${slot.volume}%`, 'min-width: 62px;');
  line.addWidget(volumeLabel);
  const volumeControl = slider(0, 100, slot.volume, value => {
    slot.volume = value; volumeLabel.setText(`Vol ${value}%`);
    worker.postMessage({ type: 'volume', channel: slot.channel, value });
  });
  line.addWidget(volumeControl);
  const reverb = slider(0, 100, slot.reverb, value => { slot.reverb = value; worker.postMessage({ type: 'effects', channel: slot.channel, reverb: value, chorus: slot.chorus }); });
  reverb.setMaximumWidth(90); line.addWidget(label('Rev')); line.addWidget(reverb);
  const chorus = slider(0, 100, slot.chorus, value => { slot.chorus = value; worker.postMessage({ type: 'effects', channel: slot.channel, reverb: slot.reverb, chorus: value }); });
  chorus.setMaximumWidth(90); line.addWidget(label('Cho')); line.addWidget(chorus);
  const test = button('C4', () => {
    worker.postMessage({ type: 'note-on', channel: slot.channel, note: 60, velocity: 100 });
    setTimeout(() => worker.postMessage({ type: 'note-off', channel: slot.channel, note: 60 }), 350);
  });
  line.addWidget(test);
  const midiLearn = button('MIDI Learn', () => { midiLearnChannel = slot.channel; status.setText(`MIDI Learn: mova um controle para associar ao volume da parte ${slot.channel + 1}.`); });
  line.addWidget(midiLearn);
  rows[slot.channel] = { name, bank, program, volumeControl, volumeLabel, reverb, chorus, midiLearn };
  rowLayout.addWidget(row);
}
slots.forEach(makeSlot);

const keyboard = new QWidget();
const keys = new QHBoxLayout(); keyboard.setLayout(keys);
layout.addWidget(label('Teclado de duas oitavas · notas nas partes carregadas'));
for (let note = 48; note <= 72; note++) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const key = button(`${names[note % 12]}${Math.floor(note / 12) - 1}`, () => {
    worker.postMessage({ type: 'note-on', note, velocity: 100 });
    setTimeout(() => worker.postMessage({ type: 'note-off', note }), 250);
  });
  keys.addWidget(key);
}

const tools = new QWidget(); const toolsLayout = new QHBoxLayout(); tools.setLayout(toolsLayout); layout.addWidget(tools);
toolsLayout.addWidget(button('Importar SF2 para biblioteca', () => importSoundFont()));
const catalog = require('./soundfont-catalog.json');
const sfUrl = new QLineEdit(); sfUrl.setPlaceholderText('URL direta de um arquivo SF2'); sfUrl.setMinimumWidth(280);
const catalogList = new QComboBox();
catalog.items.forEach(item => catalogList.addItem(`${item.category} · ${item.name}`));
catalogList.addEventListener('currentIndexChanged', index => {
  const item = catalog.items[index];
  if (item) sfUrl.setText(`${catalog.baseUrl}${item.file.split('/').map(encodeURIComponent).join('/')}`);
});
toolsLayout.addWidget(catalogList);
toolsLayout.addWidget(sfUrl);
toolsLayout.addWidget(button('Baixar SF2', () => downloadSoundFont()));
const sceneName = new QLineEdit(); sceneName.setPlaceholderText('Nome da cena'); toolsLayout.addWidget(sceneName);
toolsLayout.addWidget(button('Salvar cena', () => saveScene()));
const sceneList = new QComboBox(); toolsLayout.addWidget(sceneList);
toolsLayout.addWidget(button('Carregar cena', () => loadScene()));
toolsLayout.addWidget(button('Excluir cena', () => deleteScene()));
const midiList = new QComboBox(); midiList.setMinimumWidth(210); toolsLayout.addWidget(midiList);
toolsLayout.addWidget(button('Atualizar MIDI', refreshMidi));
toolsLayout.addWidget(button('Conectar MIDI', connectMidi));
layout.addWidget(label(`Biblioteca local: ${SF_DIR}`, 'color: #9ca3af; padding: 4px;'));

let midiInput = null;
let midi;
function refreshMidi() {
  try {
    midi = require('midi');
    const input = new midi.Input();
    midiList.clear();
    for (let i = 0; i < input.getPortCount(); i++) midiList.addItem(input.getPortName(i));
    input.closePort();
    status.setText(`${midiList.count()} entradas MIDI encontradas.`);
  } catch (error) { status.setText(`MIDI indisponível: ${error.message}. Instale a dependência midi.`); }
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
      if (command === 0x90 && value > 0) worker.postMessage({ type: 'note-on', note, velocity: value });
      else if (command === 0x80 || (command === 0x90 && value === 0)) worker.postMessage({ type: 'note-off', note });
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
  scenes.forEach(scene => sceneList.addItem(scene.name));
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
    rows[slot.channel].bank.setText(String(slot.bank)); rows[slot.channel].program.setText(String(slot.program));
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
          status.setText(`SoundFont baixado: ${path.basename(destination)}`);
        } catch (error) { fs.unlinkSync(temporary); status.setText(`Download inválido: ${error.message}`); }
      });
    });
    output.on('error', error => { fs.unlink(temporary, () => undefined); status.setText(`Falha salvando SoundFont: ${error.message}`); });
  });
  request.on('error', error => status.setText(`Falha no download: ${error.message}`));
}

worker.on('message', message => {
  if (message.type === 'ready') status.setText('Motor pronto · escolha SF2 nas partes e toque pelo teclado ou MIDI.');
  if (message.type === 'loaded') status.setText(`Parte ${message.channel + 1}: ${message.name} carregada.`);
  if (message.type === 'error') status.setText(`Áudio${message.channel === undefined ? '' : ` · parte ${message.channel + 1}`}: ${message.message}`);
});
worker.on('error', error => status.setText(`Falha no worker de áudio: ${error.message}`));
refreshScenes();
process.once('exit', () => { if (midiInput) midiInput.closePort(); worker.postMessage({ type: 'close' }); });
app.addEventListener('aboutToQuit', () => {
  if (midiInput) midiInput.closePort();
  worker.postMessage({ type: 'close' });
  worker.terminate();
});
window.show();
global.__samnatNativeWindow = window;
app.exec();
