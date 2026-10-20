
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
  ressonancia: number;

  // Recepção de comandos MIDI
  pitchBendAtivado: boolean;
  modulacaoAtivada: boolean;
}
