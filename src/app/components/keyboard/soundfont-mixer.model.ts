
export interface SoundFontMixer {
  nome: string;
  arquivo: string;
  soundFontId: number | null;
  canal: number;
  banco: number;
  programa: number;
  volume: number;
  ativo: boolean;

  // Efeitos individuais do slot
  brilho: number;
  reverb: number;
  chorus: number;
  cutoff: number;
  release?: number;
  attack?: number;
  decay?: number;
  waveform?: OscillatorType;
  depth?: number;
  rate?: number;
  ressonancia: number;
  equalizador: number[];

  // Recepção de comandos MIDI
  pitchBendAtivado: boolean;
  modulacaoAtivada: boolean;
}
