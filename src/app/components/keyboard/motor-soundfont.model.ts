
import { SoundFontMixer } from './soundfont-mixer.model';

export interface ProgramaSoundFont {
  nome: string;
  banco: number;
  programa: number;
}

export interface EfeitosSoundFont {
  filtro: BiquadFilterNode | null;
  ganhoSeco: GainNode | null;
  ganhoReverb: GainNode | null;
  convolver: ConvolverNode | null;
  ganhoChorus: GainNode | null;
  atrasoChorus: DelayNode | null;
  osciladorChorus: OscillatorNode | null;
  profundidadeChorus: GainNode | null;
}

export interface MotorSoundFont extends SoundFontMixer {
  synth: any | null;
  audioNode: AudioNode | null;
  programas: ProgramaSoundFont[];
  efeitos: EfeitosSoundFont;
  carregando: boolean;
  progresso: number;
}
