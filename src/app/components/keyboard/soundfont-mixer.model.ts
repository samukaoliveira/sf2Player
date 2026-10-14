export interface SoundFontMixer {
  nome: string;
  arquivo: string;
  soundFontId: number | null;
  canal: number;
  banco: number;
  programa: number;
  volume: number;
  ativo: boolean;
}
