const fs = require('fs');
const { parentPort } = require('worker_threads');
const Speaker = require('speaker');
const libfluidsynth = require('js-synthesizer/libfluidsynth');
const JSSynth = require('js-synthesizer');

const SAMPLE_RATE = 44100;
const FRAMES = 512;
const CHANNELS = 4;
const soundFonts = new Map();
const speaker = new Speaker({ channels: 2, bitDepth: 16, sampleRate: SAMPLE_RATE, signed: true });
const left = new Float32Array(FRAMES);
const right = new Float32Array(FRAMES);
const output = [left, right];
let synth;
let encerrando = false;

async function iniciarMotor() {
  JSSynth.Synthesizer.initializeWithFluidSynthModule(libfluidsynth);
  await JSSynth.waitForReady();
  synth = new JSSynth.Synthesizer();
  synth.init(SAMPLE_RATE);
  synth.setInterpolation(1);
  for (let canal = 0; canal < CHANNELS; canal++) {
    synth.midiControl(canal, 7, 127);
    synth.midiControl(canal, 10, 64);
  }
  parentPort.postMessage({ type: 'ready' });
  renderizar();
}

function renderizar() {
  if (encerrando || !synth) return;
  synth.render(output);
  const pcm = Buffer.allocUnsafe(FRAMES * 2 * 2);
  for (let frame = 0; frame < FRAMES; frame++) {
    const l = Math.max(-1, Math.min(1, left[frame]));
    const r = Math.max(-1, Math.min(1, right[frame]));
    pcm.writeInt16LE(Math.round(l * 32767), frame * 4);
    pcm.writeInt16LE(Math.round(r * 32767), frame * 4 + 2);
  }
  if (speaker.write(pcm)) {
    setImmediate(renderizar);
  } else {
    speaker.once('drain', renderizar);
  }
}

async function carregarSoundFont(canal, arquivo) {
  const chave = arquivo.toLowerCase();
  let id = soundFonts.get(chave);
  if (id === undefined) {
    const dados = fs.readFileSync(arquivo);
    const bytes = dados.buffer.slice(dados.byteOffset, dados.byteOffset + dados.byteLength);
    id = await synth.loadSFont(bytes);
    soundFonts.set(chave, id);
  }
  synth.midiProgramSelect(canal, id, 0, 0);
  parentPort.postMessage({ type: 'loaded', canal, nome: require('path').basename(arquivo) });
}

parentPort.on('message', async message => {
  try {
    if (message.type === 'load-soundfont') await carregarSoundFont(message.canal, message.arquivo);
    if (message.type === 'volume' && synth) {
      synth.midiControl(message.canal, 7, Math.round(message.valor * 127 / 100));
    }
    if (message.type === 'test-note' && synth) {
      const nota = 60;
      synth.midiNoteOn(message.canal, nota, 100);
      setTimeout(() => synth && synth.midiNoteOff(message.canal, nota), 450);
    }
    if (message.type === 'close') {
      encerrando = true;
      speaker.end();
      if (synth) synth.close();
    }
  } catch (error) {
    parentPort.postMessage({ type: 'error', message: error.message });
  }
});

iniciarMotor().catch(error => parentPort.postMessage({ type: 'error', message: error.message }));
