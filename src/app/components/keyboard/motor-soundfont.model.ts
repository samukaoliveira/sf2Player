import { SoundFontMixer } from './soundfont-mixer.model';

export interface ProgramaSoundFont {
  nome: string;
  banco: number;
  programa: number;
}

export interface MotorSoundFont extends SoundFontMixer {
  synth: any | null;
  audioNode: AudioNode | null;
  programas: ProgramaSoundFont[];
}
