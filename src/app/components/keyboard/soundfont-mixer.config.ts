
import { SoundFontMixer } from './soundfont-mixer.model';

export const SOUNDFONTS: SoundFontMixer[] = [
  {
    nome: 'Kurzweil Piano',
    arquivo: 'assets/soundfonts/k-pc88.sf2',
    soundFontId: null,
    canal: 0,
    banco: 0,
    programa: 0,
    volume: 85,
    ativo: true
  },
  {
    nome: 'Strings',
    arquivo: 'assets/soundfonts/strings2.sf2',
    soundFontId: null,
    canal: 1,
    banco: 0,
    programa: 3,
    volume: 80,
    ativo: true
  },
  {
    nome: 'Organ',
    arquivo: 'assets/soundfonts/organ.sf2',
    soundFontId: null,
    canal: 2,
    banco: 0,
    programa: 0,
    volume: 80,
    ativo: true
  },
  {
    nome: 'EP',
    arquivo: 'assets/soundfonts/nord_EP.sf2',
    soundFontId: null,
    canal: 2,
    banco: 0,
    programa: 0,
    volume: 80,
    ativo: true
  }
];
