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
  {
    nome: "FatBoy - Pianos",
    arquivo: soundfontUrl("FatBoy-v0 - EPs.sf2"),
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
  {
    nome: "FatBoy - EPs",
    arquivo: soundfontUrl("FatBoy-v0 - EPs.sf2"),
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
  {
    nome: "FatBoy - Guitars",
    arquivo: soundfontUrl("FatBoy-v0 - Guitars.sf2"),
    categoria: "Guitarras"
  },

  // BELLS
  {
    nome: "Bells",
    arquivo: soundfontUrl("bells.sf2"),
    categoria: "Claves e Bells"
  },
  {
    nome: "Yamaha Montage - Bells",
    arquivo: soundfontUrl("General_Montage_Bells.sf2"),
    categoria: "Claves e Bells"
  },
  {
    nome: "FatBoy - Clavis e Bells",
    arquivo: soundfontUrl("FatBoy-v0 - Clavis e Bells.sf2"),
    categoria: "Teclas"
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
  },

  // LEADS
  {
    nome: "FatBoy - Leads",
    arquivo: soundfontUrl("FatBoy-v0 - Leads.sf2"),
    categoria: "Leads"
  },

  // ÓRGÃOS
  {
    nome: "FatBoy - Organs",
    arquivo: soundfontUrl("FatBoy-v0 - Organs.sf2"),
    categoria: "Órgãos"
  },

  // STRINGS
  {
    nome: "FatBoy - Strings",
    arquivo: soundfontUrl("FatBoy-v0 - Strings.sf2"),
    categoria: "Strings"
  },

  // VIOLIN
  {
    nome: "FatBoy - Violin",
    arquivo: soundfontUrl("FatBoy-v0-3 - Violin.sf2"),
    categoria: "Strings"
  },
  {
    nome: "FatBoy - Cello",
    arquivo: soundfontUrl("FatBoy-v0-3 - Cello.sf2"),
    categoria: "Strings"
  },
  // PIANOS - SÉRIE A
{
  nome: "Roland Fantom X - So True",
  arquivo: soundfontUrl("A001 So True....sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Concert Piano",
  arquivo: soundfontUrl("A002 ConcertPiano.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Warm Piano",
  arquivo: soundfontUrl("A003 Warm Piano.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Warm Pad Piano",
  arquivo: soundfontUrl("A004 Warm Pad Pno.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Warm Strings Piano",
  arquivo: soundfontUrl("A005 Warm Str Pno.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Beale Street Walk",
  arquivo: soundfontUrl("A006 BealeSt Walk.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Rapsody",
  arquivo: soundfontUrl("A007 Rapsody.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - JD-800 Piano",
  arquivo: soundfontUrl("A008 JD-800 Piano.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - SA Dance Piano",
  arquivo: soundfontUrl("A009 SA Dance Pno.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - FS E-Grand",
  arquivo: soundfontUrl("A010 FS E-Grand.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - FS Blend Piano",
  arquivo: soundfontUrl("A011 FS Blend Pno.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - LA Piano",
  arquivo: soundfontUrl("A012 LA Piano.sf2"),
  categoria: "Pianos"
},

// PIANOS - Roland Fantom X
{
  nome: "Roland Fantom X - Concert Grand",
  arquivo: soundfontUrl("F001 ConcertGrand.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Hall Concert",
  arquivo: soundfontUrl("F002 Hall Concert.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Bright Tune",
  arquivo: soundfontUrl("F003 Bright Tune.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Mellow Tune",
  arquivo: soundfontUrl("F004 Mellow Tune.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Ultimate Grand",
  arquivo: soundfontUrl("F009 UltimatGrand.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - X Pure Grand",
  arquivo: soundfontUrl("F010 X Pure Grand.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Studio Grand",
  arquivo: soundfontUrl("F011 Studio Grand.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - 88 Concert Piano",
  arquivo: soundfontUrl("F012 88ConcertPno.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Dry Studio 88",
  arquivo: soundfontUrl("F013 DryStudio88.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - First Choice",
  arquivo: soundfontUrl("F014 First Choice.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Rokkin' Piano",
  arquivo: soundfontUrl("F015 Rokkin' pF.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Dark Grand",
  arquivo: soundfontUrl("F016 Dark Grand.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Piano Oz",
  arquivo: soundfontUrl("F017 Piano Oz.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Piano",
  arquivo: soundfontUrl("F017.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Grand Hall",
  arquivo: soundfontUrl("F018 Grand Hall.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - X Piano + Strings",
  arquivo: soundfontUrl("F019 X Piano +Str.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Arie Piano",
  arquivo: soundfontUrl("F020 Arie Piano.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Cicada Piano",
  arquivo: soundfontUrl("F021 Cicada Piano.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Clare Voyent",
  arquivo: soundfontUrl("F022 Clare Voyent.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - X Piano + Pad",
  arquivo: soundfontUrl("F023 X Piano +Pad.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - X Piano + Vox",
  arquivo: soundfontUrl("F024 X Piano +Vox.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - FX Piano",
  arquivo: soundfontUrl("F025 FX Piano.sf2"),
  categoria: "Pianos"
},
{
  nome: "Roland Fantom X - Ambient Piano",
  arquivo: soundfontUrl("F026 AmbientPiano.sf2"),
  categoria: "Pianos"
},
// LEADS - ROLAND FANTOM X
{
  nome: "Roland Fantom X - R&B TriLead",
  arquivo: soundfontUrl("C053 R&B TriLead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - PeakArpSine",
  arquivo: soundfontUrl("C054 PeakArpSine.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Theramax",
  arquivo: soundfontUrl("C055 Theramax.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - FS Square Lead",
  arquivo: soundfontUrl("C056 FS Sqr Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Dawn Of Pan",
  arquivo: soundfontUrl("C057 Dawn Of Pan.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Square Diamond",
  arquivo: soundfontUrl("C058 Sqr Diamond.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - FS SoftLead",
  arquivo: soundfontUrl("C059 FS SoftLead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Mid Saw Lead",
  arquivo: soundfontUrl("C060 Mid Saw Ld.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - FS ResoLead",
  arquivo: soundfontUrl("C061 FS ResoLead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Dig-n-Duke",
  arquivo: soundfontUrl("C062 Dig-n-Duke.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Modulated Lead",
  arquivo: soundfontUrl("C063 Modulated Ld.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Waspy Lead",
  arquivo: soundfontUrl("C064 Waspy Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Mew Lead",
  arquivo: soundfontUrl("C065 Mew Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Violin Lead",
  arquivo: soundfontUrl("C066 Violin Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Oscillo Lead",
  arquivo: soundfontUrl("C067 Oscillo Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - JP Saw Lead",
  arquivo: soundfontUrl("C068 JP Saw Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - MG Square Lead",
  arquivo: soundfontUrl("C069 MG Sqr Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Tristar",
  arquivo: soundfontUrl("C070 Tristar.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Mod Lead",
  arquivo: soundfontUrl("C071 Mod Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Digital Lead 1",
  arquivo: soundfontUrl("C072 Digital Ld 1.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Chubby Lead",
  arquivo: soundfontUrl("C073 Chubby Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Sneaky Leady",
  arquivo: soundfontUrl("C074 Sneaky Leady.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - SoloNzPeaker",
  arquivo: soundfontUrl("C075 SoloNzPeaker.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Clone Zone",
  arquivo: soundfontUrl("C076 Clone Zone.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Legato Tkno",
  arquivo: soundfontUrl("C077 Legato Tkno.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - SliCed Lead",
  arquivo: soundfontUrl("G089 SliCed Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Synthi Fizz",
  arquivo: soundfontUrl("G090 Synthi Fizz.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Mini Growl",
  arquivo: soundfontUrl("G091 Mini Growl.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Jupiter Lead",
  arquivo: soundfontUrl("G092 Jupiter Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - X-Pulse Lead",
  arquivo: soundfontUrl("G093 X-Pulse Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Jupi Square",
  arquivo: soundfontUrl("G094 Jupi Square.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - TriStac Lead",
  arquivo: soundfontUrl("G095 TriStac Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Modular Lead",
  arquivo: soundfontUrl("G096 Modular Lead.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Sinetific",
  arquivo: soundfontUrl("G097 Sinetific.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Dirty D_A",
  arquivo: soundfontUrl("G098 Dirty D_A.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - EuronalSynth",
  arquivo: soundfontUrl("G099 EuronalSynth.sf2"),
  categoria: "Leads"
},
{
  nome: "Roland Fantom X - Xtrem Sine",
  arquivo: soundfontUrl("G100 Xtrem Sine.sf2"),
  categoria: "Leads"
}
];