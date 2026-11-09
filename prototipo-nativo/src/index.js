const path = require('path');
const { Worker } = require('worker_threads');
const {
  QApplication,
  QMainWindow,
  QWidget,
  QVBoxLayout,
  QHBoxLayout,
  QLabel,
  QPushButton,
  QSlider,
  QFileDialog,
  FileMode,
  Orientation
} = require('@nodegui/nodegui');

const app = new QApplication();
const window = new QMainWindow();
window.setWindowTitle('SamNat Synth — Protótipo nativo');
window.resize(940, 620);

const central = new QWidget();
const layout = new QVBoxLayout();
central.setLayout(layout);
central.setInlineStyle('background-color: #111827; color: #f9fafb; padding: 18px;');
window.setCentralWidget(central);

const heading = new QLabel();
heading.setText('SamNat Synth · 4 canais · motor compartilhado');
heading.setInlineStyle('font-size: 22px; font-weight: 700; padding: 6px;');
layout.addWidget(heading);

const status = new QLabel();
status.setText('Inicializando o motor de áudio...');
status.setInlineStyle('color: #93c5fd; padding: 4px 6px 12px 6px;');
layout.addWidget(status);

const worker = new Worker(path.join(__dirname, 'audio-worker.cjs'));
worker.unref();
const channelRows = [];

function selecionarSoundFont(canal) {
  const dialog = new QFileDialog(window, `SoundFont do canal ${canal + 1}`, '', 'SoundFonts (*.sf2 *.sf3)');
  dialog.setFileMode(FileMode.ExistingFile);
  dialog.setNameFilter('SoundFonts (*.sf2 *.sf3)');
  dialog.exec();
  const arquivos = dialog.selectedFiles();
  if (!arquivos.length) return;

  const arquivo = arquivos[0];
  channelRows[canal].soundfont.setText(path.basename(arquivo));
  channelRows[canal].soundfontPath = arquivo;
  worker.postMessage({ type: 'load-soundfont', canal, arquivo });
  status.setText(`Carregando SoundFont no canal ${canal + 1}...`);
}

for (let canal = 0; canal < 4; canal++) {
  const row = new QWidget();
  row.setInlineStyle('background-color: #1f2937; border: 1px solid #374151; border-radius: 8px; margin: 5px; padding: 8px;');
  const rowLayout = new QHBoxLayout();
  row.setLayout(rowLayout);

  const channelLabel = new QLabel();
  channelLabel.setText(`CANAL ${canal + 1}`);
  channelLabel.setInlineStyle('font-weight: 700; min-width: 76px;');
  rowLayout.addWidget(channelLabel);

  const soundfont = new QLabel();
  soundfont.setText('Nenhum SoundFont');
  soundfont.setInlineStyle('color: #d1d5db; min-width: 165px;');
  rowLayout.addWidget(soundfont);

  const browse = new QPushButton();
  browse.setText('Escolher SF2');
  browse.addEventListener('clicked', () => selecionarSoundFont(canal));
  rowLayout.addWidget(browse);

  const volumeLabel = new QLabel();
  volumeLabel.setText('Volume 100%');
  volumeLabel.setInlineStyle('min-width: 100px;');
  rowLayout.addWidget(volumeLabel);

  const volume = new QSlider();
  volume.setOrientation(Orientation.Horizontal);
  volume.setMinimum(0);
  volume.setMaximum(100);
  volume.setValue(100);
  volume.setMinimumWidth(150);
  volume.addEventListener('valueChanged', valor => {
    volumeLabel.setText(`Volume ${valor}%`);
    worker.postMessage({ type: 'volume', canal, valor });
  });
  rowLayout.addWidget(volume);

  const note = new QPushButton();
  note.setText('Tocar nota');
  note.addEventListener('clicked', () => worker.postMessage({ type: 'test-note', canal }));
  rowLayout.addWidget(note);

  channelRows[canal] = { soundfont, soundfontPath: '', volume, volumeLabel };
  layout.addWidget(row);
}

const footer = new QLabel();
footer.setText('Cada canal carrega um SoundFont e controla seu próprio volume MIDI.');
footer.setInlineStyle('color: #9ca3af; padding: 10px 6px;');
layout.addWidget(footer);

worker.on('message', message => {
  if (message.type === 'ready') status.setText('Motor compartilhado pronto · escolha um SoundFont por canal.');
  if (message.type === 'loaded') status.setText(`Canal ${message.canal + 1}: ${message.nome} carregado.`);
  if (message.type === 'error') status.setText(`Áudio: ${message.message}`);
});

worker.on('error', error => status.setText(`Falha no processo de áudio: ${error.message}`));
process.once('beforeExit', () => worker.postMessage({ type: 'close' }));
window.show();
global.__samnatNativeWindow = window;
app.exec();
