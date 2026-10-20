import { environment } from "src/environments/environment";

export interface SoundFontOpcao {
  nome: string;
  arquivo: string;
  categoria: string;
}

export interface SoundFontGrupo {
  categoria: string;
  opcoes: SoundFontOpcao[];
}

/**
 * Monta a URL de um SoundFont no Oracle Object Storage.
 * O soundfontBaseUrl deve apontar para o caminho base
 * dos objetos SF2 disponibilizados pela PAR.
 */
function soundfontUrl(arquivo: string): string {
  const baseUrl = environment.soundfontBaseUrl.replace(/\/+$/, "");
  return `${baseUrl}/${arquivo.split("/").map(encodeURIComponent).join("/")}`;
}

export const SOUNDFONT_CATALOGO: SoundFontOpcao[] = [
  // PIANOS
  {
    nome: "Yamaha Montage - Pianos",
    arquivo: soundfontUrl("General_Montage_Pianos.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Yamaha Concert Grand",
    arquivo: soundfontUrl("ConcertGrand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Grand Upright N",
    arquivo: soundfontUrl("Grand_Upright__N.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Kurzweil K2500",
    arquivo: soundfontUrl("Kurzweil K2500.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Kurzweil PC88",
    arquivo: soundfontUrl("k-pc88.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Libre Digital Grand",
    arquivo: soundfontUrl("LibreDigitalGrand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "LSPModel Bosendorfer Imperial [Yamaha CP88]",
    arquivo: soundfontUrl("LSPModel Bosendorfer Imperial [Yamaha CP88].sf2"),
    categoria: "Pianos"
  },
  {
    nome: "MIDI Grand 2",
    arquivo: soundfontUrl("MIDIGrand_2.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Nord Imperial Grand",
    arquivo: soundfontUrl("Nord Imperial Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Nord Romantic Grand",
    arquivo: soundfontUrl("Nord Romantic Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Nord Royal Grand 3D",
    arquivo: soundfontUrl("RoyalGrand3D.sf2"),
    categoria: "Pianos"
  },

  // PIANOS ELÉTRICOS
  {
    nome: "Big M1 Piano 16",
    arquivo: soundfontUrl("Big_M1_piano_16.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "Custom DX EP",
    arquivo: soundfontUrl("CustomDXEP.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "Custom Libre FM EP",
    arquivo: soundfontUrl("Custom_Libre_FM_EP.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "DX7 E-Piano 1",
    arquivo: soundfontUrl("DX7_E_Piano_1.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "FM EP Layers 2x",
    arquivo: soundfontUrl("FMEP_Layers_2x.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "KORG D1 Digital Piano EPiano2 (Retro)",
    arquivo: soundfontUrl("KORG D1 Digital Piano EPiano2（Retro）.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "KORG D1 Digital Piano EPiano (Solid)",
    arquivo: soundfontUrl("KORG D1 Digital Piano EPiano（Solid）.sf2"),
    categoria: "Pianos Elétricos"
  },
  {
    nome: "Nord EP",
    arquivo: soundfontUrl("nord_EP.sf2"),
    categoria: "Pianos Elétricos"
  },

  // ÓRGÃOS
  {
    nome: "Organ ESQ-1",
    arquivo: soundfontUrl("ORGAN1__ESQ-1_.sf2"),
    categoria: "Órgãos"
  },
  {
    nome: "Organ",
    arquivo: soundfontUrl("organ.sf2"),
    categoria: "Órgãos"
  },
  {
    nome: "Percussion Organ",
    arquivo: soundfontUrl("Perc_Organ.sf2"),
    categoria: "Órgãos"
  },
  {
    nome: "Yamaha Montage - Organs",
    arquivo: soundfontUrl("General_Montage_Organs.sf2"),
    categoria: "Órgãos"
  },

  // SYNTHS E LEADS
  {
    nome: "Fantasia 2",
    arquivo: soundfontUrl("Fantasia_2.sf2"),
    categoria: "Synths e Leads"
  },
  {
    nome: "Leads",
    arquivo: soundfontUrl("leads.sf2"),
    categoria: "Synths e Leads"
  },
  {
    nome: "Sin Pad ESQ-1",
    arquivo: soundfontUrl("SINPAD__ESQ-1_.sf2"),
    categoria: "Synths e Leads"
  },
  {
    nome: "TBOSf",
    arquivo: soundfontUrl("TBOSf.sf2"),
    categoria: "Synths e Leads"
  },
  {
    nome: "Yamaha Montage - Leads/Synths",
    arquivo: soundfontUrl("General_Montage_Leads.sf2"),
    categoria: "Synths e Leads"
  },

  // PADS
  {
    nome: "Concert Pad Production",
    arquivo: soundfontUrl("Concert_Pad_Production.sf2"),
    categoria: "Pads"
  },
  {
    nome: "Yamaha Montage - Pads",
    arquivo: soundfontUrl("General_Montage_Pads.sf2"),
    categoria: "Pads"
  },

  // STRINGS
  {
    nome: "Strings",
    arquivo: soundfontUrl("strings.sf2"),
    categoria: "Strings"
  },
  {
    nome: "Strings 2",
    arquivo: soundfontUrl("strings2.sf2"),
    categoria: "Strings"
  },
  {
    nome: "Yamaha Montage - Strings",
    arquivo: soundfontUrl("General_Montage_Strings.sf2"),
    categoria: "Strings"
  },

  // BAIXOS
  {
    nome: "SRX Bass",
    arquivo: soundfontUrl("srx_bass.sf2"),
    categoria: "Baixos"
  },
  {
    nome: "Yamaha Montage - Bass",
    arquivo: soundfontUrl("General_Montage_Bass.sf2"),
    categoria: "Baixos"
  },

  // GUITARRAS
  {
    nome: "91 Slow Chorus Guitar",
    arquivo: soundfontUrl("91SlowChorusGuitar.sf2"),
    categoria: "Guitarras"
  },
  {
    nome: "Yamaha Montage - Guitars",
    arquivo: soundfontUrl("General_Montage_Guitars.sf2"),
    categoria: "Guitarras"
  },

  // BELLS
  {
    nome: "Bells",
    arquivo: soundfontUrl("bells.sf2"),
    categoria: "Bells"
  },
  {
    nome: "Yamaha Montage - Bells",
    arquivo: soundfontUrl("General_Montage_Bells.sf2"),
    categoria: "Bells"
  },

  // SOPROS
  {
    nome: "Yamaha Montage - Flutes",
    arquivo: soundfontUrl("General_Montage_Flutes.sf2"),
    categoria: "Sopros"
  },

  // PERCUSSÃO
  {
    nome: "Yamaha Montage - Drums",
    arquivo: soundfontUrl("General_Montage_Drums.sf2"),
    categoria: "Percussão"
  },

  // FX E OUTROS
  {
    nome: "Korg AG-10",
    arquivo: soundfontUrl("Korg_AG-10.sf2"),
    categoria: "FX e Outros"
  },
  {
    nome: "Roland U20",
    arquivo: soundfontUrl("Roland_U20.sf2"),
    categoria: "FX e Outros"
  },
  {
    nome: "Yamaha Montage - FX",
    arquivo: soundfontUrl("General_Montage_FX.sf2"),
    categoria: "FX e Outros"
  },

  // WORLD
  {
    nome: "Yamaha Montage - World",
    arquivo: soundfontUrl("General_Montage_World.sf2"),
    categoria: "World"
  }
];