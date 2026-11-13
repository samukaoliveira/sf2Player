const path = require('path');
const { spawn } = require('child_process');
const { parentPort } = require('worker_threads');

const CHANNELS = 8;
const SAMPLE_RATE = 44100;
const soundFonts = new Map();
const channelPresets = new Map();
const activeKeyboardNotes = new Map();
let audioDevice = null;
let fluidsynth = null;
let fluidsynthStderr = '';
let audioDriverError = '';
let lastAudioError = '';
let startupPrompt = '';
let pendingCommand = null;
let shellReadyResolve;
let shellReadyReject;
let shellReady = Promise.resolve();
let shellIsReady = false;
let messageQueue = Promise.resolve();
let closing = false;

parentPort.postMessage({ type: 'audio-stage', stage: 'Preparando FluidSynth nativo...' });

function sameOutput(a, b) {
  return !!a && !!b && a.device === b.device && a.sink === b.sink && JSON.stringify(a.env || {}) === JSON.stringify(b.env || {});
}

function isPrompt(text) {
  return /(?:^|\r?\n)> $/.test(text);
}

function withoutPrompt(text) {
  return text.replace(/(?:^|\r?\n)> $/, '').trim();
}

function resolveInitialShell() {
  if (!shellReadyResolve) return;
  const resolve = shellReadyResolve;
  shellReadyResolve = null;
  shellReadyReject = null;
  shellIsReady = true;
  resolve();
}

function rejectInitialShell(error) {
  if (!shellReadyReject) return;
  const reject = shellReadyReject;
  shellReadyResolve = null;
  shellReadyReject = null;
  reject(error);
}

function onFluidStdout(child, chunk) {
  const text = chunk.toString();
  if (pendingCommand && pendingCommand.child === child) {
    pendingCommand.output += text;
    if (isPrompt(pendingCommand.output)) {
      const command = pendingCommand;
      pendingCommand = null;
      clearTimeout(command.timer);
      command.resolve(withoutPrompt(command.output));
    }
    return;
  }

  startupPrompt = (startupPrompt + text).slice(-12000);
  if (isPrompt(startupPrompt)) {
    startupPrompt = '';
    resolveInitialShell();
  }
}

function command(text, timeoutMs = 10000) {
  const child = fluidsynth;
  if (!child || !child.stdin || child.stdin.destroyed || child.exitCode !== null) {
    return Promise.reject(new Error('FluidSynth nativo não está em execução.'));
  }
  return shellReady.then(() => new Promise((resolve, reject) => {
    if (pendingCommand) {
      reject(new Error('A interface de comandos FluidSynth já está ocupada.'));
      return;
    }
    const pending = {
      child,
      output: '',
      resolve,
      reject,
      timer: setTimeout(() => {
        if (pendingCommand === pending) pendingCommand = null;
        const response = pending.output.trim().slice(-1200);
        const stderr = fluidsynthStderr.trim().slice(-800);
        reject(new Error([
          `FluidSynth não respondeu ao comando “${text.split(/\s+/, 1)[0]}” dentro de ${Math.round(timeoutMs / 1000)} s.`,
          response && `Saída do FluidSynth: ${response}`,
          stderr && `Diagnóstico do FluidSynth: ${stderr}`
        ].filter(Boolean).join('\n')));
      }, timeoutMs)
    };
    pendingCommand = pending;
    child.stdin.write(`${text}\n`, error => {
      if (error && pendingCommand === pending) {
        pendingCommand = null;
        clearTimeout(pending.timer);
        reject(error);
      }
    });
  }));
}

function fluidQuote(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function parsePresets(output) {
  const presets = [];
  for (const line of output.split(/\r?\n/)) {
    // FluidSynth 2.2 prints `000-000 Name`; Zynthian/other releases may print
    // `000 000: Name`. Accept both spellings from `inst <sfont-id>`.
    const match = line.match(/^\s*(\d{1,3})\s*[-\s]\s*(\d{1,3})\s*:?\s+(.+?)\s*$/);
    if (!match) continue;
    const bank = Number.parseInt(match[1], 10);
    const program = Number.parseInt(match[2], 10);
    const name = match[3].trim();
    if (Number.isInteger(bank) && Number.isInteger(program) && name) presets.push({ bank, program, name });
  }
  return presets;
}

function audioDriverArgs(target) {
  if (typeof target.sink === 'string' && target.sink) {
    return {
      driver: 'pulseaudio',
      device: target.sink,
      env: { ...(target.env || {}), PULSE_SINK: target.sink },
      args: ['-a', 'pulseaudio', '-o', `audio.pulseaudio.device=${target.sink}`]
    };
  }
  return {
    driver: 'alsa',
    device: target.device,
    env: target.env || {},
    args: ['-a', 'alsa', '-o', `audio.alsa.device=${target.device}`]
  };
}

async function startEngine(target) {
  const audio = audioDriverArgs(target);
  lastAudioError = '';
  parentPort.postMessage({ type: 'audio-stage', stage: `Abrindo FluidSynth nativo em ${target.label}...` });
  shellReady = new Promise((resolve, reject) => {
    shellReadyResolve = resolve;
    shellReadyReject = reject;
  });
  shellIsReady = false;
  startupPrompt = '';
  fluidsynthStderr = '';
  audioDriverError = '';
  const args = [
    ...audio.args,
    '-n', '-K', '16', '-r', String(SAMPLE_RATE), '-g', '1', '-C', '0', '-R', '0',
    '-o', 'synth.polyphony=128',
    '-o', 'synth.reverb.active=0',
    '-o', 'synth.chorus.active=0'
  ];
  const childEnv = { ...process.env, ...audio.env };
  if (childEnv.SAMNAT_AUDIO_LIB_DIR) {
    childEnv.LD_LIBRARY_PATH = [childEnv.SAMNAT_AUDIO_LIB_DIR, childEnv.LD_LIBRARY_PATH].filter(Boolean).join(path.delimiter);
  }
  const child = spawn('fluidsynth', args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: childEnv
  });
  fluidsynth = child;
  parentPort.postMessage({
    type: 'audio-stage',
    stage: `FluidSynth iniciado (PID ${child.pid || 'pendente'}); esperando abrir ${audio.driver} em ${target.label}...`
  });

  const startupTimeout = setTimeout(() => {
    rejectInitialShell(new Error(`FluidSynth não abriu a saída em ${target.label} dentro de 15 segundos. ${fluidsynthStderr.trim()}`));
  }, 15000);
  child.stdout.on('data', chunk => onFluidStdout(child, chunk));
  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    fluidsynthStderr = (fluidsynthStderr + text).slice(-4000);
    if (/(?:error|failed|unable|cannot|could not).{0,120}(?:audio|pulseaudio|alsa|jack|sdl)|(?:audio|pulseaudio|alsa|jack|sdl).{0,120}(?:error|failed|unable|cannot|could not)|no such device/i.test(text)) {
      audioDriverError = fluidsynthStderr.trim();
      lastAudioError = audioDriverError;
      parentPort.postMessage({ type: 'audio-output-error', message: audioDriverError });
    }
  });
  child.once('error', error => {
    const detail = new Error(`Não foi possível iniciar o FluidSynth nativo: ${error.message}`);
    rejectInitialShell(detail);
    if (fluidsynth === child) fluidsynth = null;
  });
  child.on('exit', (code, signal) => {
    const detail = fluidsynthStderr.trim();
    const error = new Error(`FluidSynth encerrou (código ${code}, ${signal || 'sem sinal'}). ${detail}`);
    lastAudioError = error.message;
    if (!shellIsReady) rejectInitialShell(error);
    if (pendingCommand && pendingCommand.child === child) {
      clearTimeout(pendingCommand.timer);
      pendingCommand.reject(error);
      pendingCommand = null;
    }
    if (fluidsynth === child) {
      fluidsynth = null;
      if (!closing) parentPort.postMessage({ type: 'audio-output-error', message: error.message });
    }
  });
  try {
    await shellReady;
    // The shell prompt can arrive just before FluidSynth reports that the
    // selected backend failed to open its audio device.
    await new Promise(resolve => setTimeout(resolve, 300));
    if (audioDriverError) throw new Error(`FluidSynth iniciou, mas não abriu a saída ${target.label}: ${audioDriverError}`);
  } finally {
    clearTimeout(startupTimeout);
  }

  parentPort.postMessage({ type: 'ready', backend: audio.driver, label: target.label });
}

async function stopEngine() {
  const child = fluidsynth;
  fluidsynth = null;
  if (!child) return;
  rejectInitialShell(new Error('FluidSynth foi encerrado.'));
  if (pendingCommand && pendingCommand.child === child) {
    clearTimeout(pendingCommand.timer);
    pendingCommand.reject(new Error('FluidSynth foi reiniciado.'));
    pendingCommand = null;
  }
  if (child.exitCode !== null) return;
  await new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(forceTimer);
      resolve();
    };
    child.once('exit', finish);
    const forceTimer = setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => { child.kill('SIGKILL'); finish(); }, 1000);
    }, 1500);
    if (child.stdin && !child.stdin.destroyed) child.stdin.end('quit\n');
    else child.kill('SIGTERM');
  });
}

async function loadSoundFont(channel, file, requestedBank = 0, requestedProgram = 0) {
  if (!Number.isInteger(channel) || channel < 0 || channel >= CHANNELS) throw new Error('Canal inválido.');
  const filename = path.resolve(file);
  const key = filename.toLowerCase();
  let entry = soundFonts.get(key);
  parentPort.postMessage({
    type: 'audio-stage',
    stage: `Parte ${channel + 1}: ${entry ? 'selecionando preset de' : 'carregando'} ${path.basename(filename)}...`
  });
  if (!entry) {
    const output = await command(`load ${fluidQuote(filename)}`, 60000);
    const idMatch = output.match(/loaded SoundFont has ID\s+(\d+)/i);
    if (!idMatch) throw new Error(`FluidSynth não confirmou a carga do SF2 “${path.basename(filename)}”. ${output.slice(-1000)}`);
    const id = Number(idMatch[1]);
    parentPort.postMessage({ type: 'audio-stage', stage: `Parte ${channel + 1}: lendo presets de ${path.basename(filename)}...` });
    const instruments = await command(`inst ${id}`, 15000);
    const presets = parsePresets(instruments);
    if (!presets.length) throw new Error(`FluidSynth carregou “${path.basename(filename)}”, mas não encontrou presets.`);
    entry = { id, presets };
    soundFonts.set(key, entry);
  }

  const bank = Number.isInteger(Number(requestedBank)) ? Number(requestedBank) : 0;
  const program = Number.isInteger(Number(requestedProgram)) ? Number(requestedProgram) : 0;
  const requested = entry.presets.find(preset => preset.bank === bank && preset.program === program);
  const preset = requested || entry.presets[0];
  parentPort.postMessage({ type: 'audio-stage', stage: `Parte ${channel + 1}: selecionando ${preset.name} (${preset.bank}/${preset.program})...` });
  await command(`select ${channel} ${entry.id} ${preset.bank} ${preset.program}`);
  channelPresets.set(channel, { file: filename, bank: preset.bank, program: preset.program, presetName: preset.name });
  parentPort.postMessage({
    type: 'loaded', channel, file: filename, name: path.basename(filename), id: entry.id,
    bank: preset.bank, program: preset.program, presetName: preset.name,
    requestedBank: bank, requestedProgram: program,
    usedFallback: !requested
  });
}

function channelsFor(channel) {
  return Number.isInteger(channel) && channel >= 0 && channel < CHANNELS ? [channel] : [...channelPresets.keys()];
}

async function sendMidi(commandName, channel, ...args) {
  return command(`${commandName} ${channel} ${args.join(' ')}`);
}

async function selectAudioDevice(target) {
  if (!target || typeof target.device !== 'string' || !target.device.trim() || target.device.includes('\0')) return;
  if (sameOutput(target, audioDevice)) {
    parentPort.postMessage({ type: 'ready', backend: target.sink ? 'pulseaudio' : 'alsa', label: target.label });
    return;
  }
  const assignments = [...channelPresets.entries()].map(([channel, part]) => [channel, { ...part }]);
  await stopEngine();
  audioDevice = null;
  soundFonts.clear();
  channelPresets.clear();
  try {
    await startEngine(target);
    audioDevice = target;
  } catch (error) {
    lastAudioError = error.message;
    audioDevice = null;
    for (const [channel, part] of assignments) channelPresets.set(channel, part);
    parentPort.postMessage({ type: 'audio-output-error', message: error.message });
    await stopEngine();
    return;
  }
  for (const [channel, part] of assignments) {
    try {
      await loadSoundFont(channel, part.file, part.bank, part.program);
    } catch (error) {
      parentPort.postMessage({ type: 'error', operation: 'load-soundfont', channel, message: error.message });
    }
  }
}

async function handleMessage(message) {
  try {
    if (message.type === 'audio-device') {
      await selectAudioDevice(message.output);
      return;
    }
    if (message.type === 'load-soundfont') {
      if (!fluidsynth) throw new Error(lastAudioError || 'FluidSynth ainda não abriu uma saída de áudio.');
      await loadSoundFont(message.channel, message.file, message.bank, message.program);
      return;
    }
    if (message.type === 'note-on' && fluidsynth) {
      const channels = channelsFor(message.channel);
      if (Number.isInteger(message.channel) && !channelPresets.has(message.channel)) channels.push(message.channel);
      for (const channel of channels) await sendMidi('noteon', channel, message.note, message.velocity || 100);
      if (message.source === 'keyboard') activeKeyboardNotes.set(message.note, channels);
      parentPort.postMessage({
        type: 'note-dispatched', action: 'on', note: message.note, channels,
        hasSoundFont: channels.some(channel => channelPresets.has(channel))
      });
      return;
    }
    if (message.type === 'note-off' && fluidsynth) {
      const channels = message.source === 'keyboard' && activeKeyboardNotes.has(message.note)
        ? activeKeyboardNotes.get(message.note)
        : channelsFor(message.channel);
      for (const channel of channels) await sendMidi('noteoff', channel, message.note);
      if (message.source === 'keyboard') activeKeyboardNotes.delete(message.note);
      parentPort.postMessage({ type: 'note-dispatched', action: 'off', note: message.note, channels });
      return;
    }
    if (message.type === 'all-notes-off' && fluidsynth) {
      for (const channel of channelsFor(message.channel)) await sendMidi('cc', channel, 123, 0);
      return;
    }
    if (message.type === 'control' && fluidsynth) {
      await sendMidi('cc', message.channel, message.controller, message.value);
      return;
    }
    if (message.type === 'pitch-bend' && fluidsynth) {
      await sendMidi('pitch_bend', message.channel, message.value - 8192);
      return;
    }
    if (message.type === 'volume' && fluidsynth) {
      await sendMidi('cc', message.channel, 7, Math.round(message.value * 127 / 100));
      return;
    }
    if (message.type === 'effects' && fluidsynth) {
      await sendMidi('cc', message.channel, 91, Math.round(message.reverb * 127 / 100));
      await sendMidi('cc', message.channel, 93, Math.round(message.chorus * 127 / 100));
      await command(`set synth.reverb.active ${message.reverb > 0 ? 1 : 0}`);
      await command(`set synth.chorus.active ${message.chorus > 0 ? 1 : 0}`);
      return;
    }
    if (message.type === 'program' && fluidsynth) {
      const part = channelPresets.get(message.channel);
      if (!part) throw new Error('Carregue primeiro um SoundFont neste canal.');
      await loadSoundFont(message.channel, part.file, message.bank, message.program);
      return;
    }
    if (message.type === 'global-effects' && fluidsynth) {
      await command(`set synth.reverb.active ${message.reverb > 0 ? 1 : 0}`);
      await command(`set synth.chorus.active ${message.chorus > 0 ? 1 : 0}`);
      return;
    }
    if (message.type === 'close') {
      closing = true;
      await stopEngine();
      parentPort.postMessage({ type: 'closed' });
    }
  } catch (error) {
    parentPort.postMessage({ type: 'error', operation: message.type, channel: message.channel, message: error.message });
  }
}

parentPort.on('message', message => {
  messageQueue = messageQueue.then(() => handleMessage(message)).catch(error => {
    parentPort.postMessage({ type: 'error', operation: message.type, channel: message.channel, message: error.message });
  });
});
