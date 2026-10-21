
import { SoundFontMixer } from './soundfont-mixer.model';
import { environment } from "src/environments/environment";

function soundfontUrl(arquivo: string): string {
  const baseUrl = environment.soundfontBaseUrl.replace(/\/+$/, "");
  return `${baseUrl}/${arquivo.split("/").map(encodeURIComponent).join("/")}`;
}

export const SOUNDFONTS: SoundFontMixer[] = [
  {
    nome: 'Kurzweil Piano',
    arquivo: soundfontUrl('k-pc88.sf2'),
    soundFontId: null,
    canal: 0,
    banco: 0,
    programa: 0,
    volume: 85,
    ativo: true,
    brilho: 100,
    reverb: 0,
    chorus: 0,
    cutoff: 12000,
    ressonancia: 0.7,
    pitchBendAtivado: true,
    modulacaoAtivada: true
  },
  {
    nome: 'Strings',
    arquivo: soundfontUrl('strings2.sf2'),
    soundFontId: null,
    canal: 1,
    banco: 0,
    programa: 3,
    volume: 80,
    ativo: true,
    brilho: 100,
    reverb: 0,
    chorus: 0,
    cutoff: 12000,
    ressonancia: 0.7,
    pitchBendAtivado: true,
    modulacaoAtivada: true
  },
  {
    nome: 'Organ',
    arquivo: soundfontUrl('organ.sf2'),
    soundFontId: null,
    canal: 2,
    banco: 0,
    programa: 0,
    volume: 80,
    ativo: true,
    brilho: 100,
    reverb: 0,
    chorus: 0,
    cutoff: 12000,
    ressonancia: 0.7,
    pitchBendAtivado: true,
    modulacaoAtivada: true
  },
  {
    nome: 'EP',
    arquivo: soundfontUrl('nord_EP.sf2'),
    soundFontId: null,
    canal: 2,
    banco: 0,
    programa: 0,
    volume: 80,
    ativo: true,
    brilho: 100,
    reverb: 0,
    chorus: 0,
    cutoff: 12000,
    ressonancia: 0.7,
    pitchBendAtivado: true,
    modulacaoAtivada: true
  },
  {
    nome: 'EP',
    arquivo: soundfontUrl('nord_EP.sf2'),
    soundFontId: null,
    canal: 2,
    banco: 0,
    programa: 0,
    volume: 80,
    ativo: true,
    brilho: 100,
    reverb: 0,
    chorus: 0,
    cutoff: 12000,
    ressonancia: 0.7,
    pitchBendAtivado: true,
    modulacaoAtivada: true
  },
  {
    nome: 'EP',
    arquivo: soundfontUrl('nord_EP.sf2'),
    soundFontId: null,
    canal: 2,
    banco: 0,
    programa: 0,
    volume: 80,
    ativo: true,
    brilho: 100,
    reverb: 0,
    chorus: 0,
    cutoff: 12000,
    ressonancia: 0.7,
    pitchBendAtivado: true,
    modulacaoAtivada: true
  }
];
