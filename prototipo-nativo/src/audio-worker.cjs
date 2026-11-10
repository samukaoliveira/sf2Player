const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { parentPort } = require('worker_threads');
const libfluidsynth = require('js-synthesizer/libfluidsynth');
const JSSynth = require('js-synthesizer');

const SAMPLE_RATE = 44100;
const FRAMES = 512;
const CHANNELS = 8;
const soundFonts = new Map();
const audioOutput = spawn('aplay', ['-q', '-t', 'raw', '-f', 'S16_LE', '-r', String(SAMPLE_RATE), '-c', '2']);
const left = new Float32Array(FRAMES);
const right = new Float32Array(FRAMES);
let synth;
let closing = false;
audioOutput.on('error', error => {
  closing = true;
  parentPort.postMessage({ type: 'error', message: `Não foi possível iniciar a saída ALSA (aplay): ${error.message}` });
});
audioOutput.on('exit', code => {
  if (!closing) {
    closing = true;
    parentPort.postMessage({ type: 'error', message: `A saída ALSA terminou (código ${code}). Verifique se aplay e um dispositivo de áudio estão disponíveis.` });
  }
});

async function start() {
  JSSynth.Synthesizer.initializeWithFluidSynthModule(libfluidsynth);
  await JSSynth.waitForReady();
  synth = new JSSynth.Synthesizer();
  synth.init(SAMPLE_RATE, { midiChannelCount: CHANNELS, chorusActive: true, reverbActive: true });
  synth.setInterpolation(1);
  for (let channel = 0; channel < CHANNELS; channel++) {
    synth.midiControl(channel, 7, 127);
    synth.midiControl(channel, 10, 64);
  }
  parentPort.postMessage({ type: 'ready' });
  render();
}

function render() {
  if (closing || !synth) return;
  synth.render([left, right]);
  const pcm = Buffer.allocUnsafe(FRAMES * 4);
  for (let frame = 0; frame < FRAMES; frame++) {
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[frame])) * 32767), frame * 4);
    pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[frame])) * 32767), frame * 4 + 2);
  }
  if (audioOutput.stdin.destroyed || audioOutput.killed) return;
  if (audioOutput.stdin.write(pcm)) setImmediate(render);
  else audioOutput.stdin.once('drain', render);
}

async function loadSoundFont(channel, file, requestedBank = 0, requestedProgram = 0) {
  if (!Number.isInteger(channel) || channel < 0 || channel >= CHANNELS) throw new Error('Canal inválido.');
  const filename = path.resolve(file);
  const key = filename.toLowerCase();
  let id = soundFonts.get(key);
  if (id === undefined) {
    const data = fs.readFileSync(filename);
    if (data.length < 12 || data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'sfbk') {
      throw new Error('O arquivo não parece ser um SoundFont SF2 válido.');
    }
    id = await synth.loadSFont(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
    soundFonts.set(key, id);
  }
  const bank = Number.isInteger(Number(requestedBank)) ? Number(requestedBank) : 0;
  const program = Number.isInteger(Number(requestedProgram)) ? Number(requestedProgram) : 0;
  synth.midiProgramSelect(channel, id, bank, program);
  parentPort.postMessage({ type: 'loaded', channel, file: filename, name: path.basename(filename), id });
}

function forChannels(channel, callback) {
  const channels = Number.isInteger(channel) && channel >= 0 && channel < CHANNELS ? [channel] : Array.from({ length: CHANNELS }, (_, i) => i);
  channels.forEach(callback);
}

parentPort.on('message', async message => {
  try {
    if (message.type === 'load-soundfont') await loadSoundFont(message.channel, message.file, message.bank, message.program);
    if (message.type === 'note-on' && synth) forChannels(message.channel, ch => synth.midiNoteOn(ch, message.note, message.velocity || 100));
    if (message.type === 'note-off' && synth) forChannels(message.channel, ch => synth.midiNoteOff(ch, message.note));
    if (message.type === 'all-notes-off' && synth) forChannels(message.channel, ch => synth.midiAllNotesOff(ch));
    if (message.type === 'control' && synth) synth.midiControl(message.channel, message.controller, message.value);
    if (message.type === 'pitch-bend' && synth) synth.midiPitchBend(message.channel, message.value);
    if (message.type === 'volume' && synth) synth.midiControl(message.channel, 7, Math.round(message.value * 127 / 100));
    if (message.type === 'effects' && synth) {
      synth.midiControl(message.channel, 91, Math.round(message.reverb * 127 / 100));
      synth.midiControl(message.channel, 93, Math.round(message.chorus * 127 / 100));
    }
    if (message.type === 'program' && synth) {
      const fontId = soundFonts.get(path.resolve(message.file).toLowerCase());
      if (fontId === undefined) throw new Error('Carregue primeiro o SoundFont deste canal.');
      synth.midiProgramSelect(message.channel, fontId, message.bank || 0, message.program || 0);
    }
    if (message.type === 'global-effects' && synth) {
      synth.setReverbOn(message.reverb > 0);
      synth.setReverbLevel(Math.max(0, Math.min(1, message.reverb / 100)));
      synth.setChorusOn(message.chorus > 0);
      synth.setChorusLevel(Math.max(0, Math.min(10, message.chorus / 10)));
    }
    if (message.type === 'close') {
      closing = true;
      if (synth) synth.close();
      audioOutput.stdin.end();
    }
  } catch (error) {
    parentPort.postMessage({ type: 'error', channel: message.channel, message: error.message });
  }
});

start().catch(error => parentPort.postMessage({ type: 'error', message: error.message }));
