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

export function normalizarCategoriaSoundFont(categoria: string): string {
  const chave = categoria.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLocaleLowerCase();
  const categorias: { [chave: string]: string } = {
    'pianos eletricos': 'Electric Pianos',
    'eps': 'Electric Pianos',
    'orgaos': 'Organs',
    'synths e leads': 'Leads',
    'baixos': 'Bass',
    'guitarras': 'Guitars',
    'claves e bells': 'Keys & Bells',
    'teclas': 'Keys & Bells',
    'sopros': 'Winds',
    'percussao': 'Drums',
    'fx e outros': 'FX',
    'bells': 'Keys & Bells'
  };
  return categorias[chave] || categoria.trim();
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
    arquivo: soundfontUrl("Kurzweil_K2500.sf2"),
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
    arquivo: soundfontUrl("LSPModel_Bosendorfer_Imperial_[Yamaha_CP88].sf2"),
    categoria: "Pianos"
  },
  {
    nome: "MIDI Grand 2",
    arquivo: soundfontUrl("MIDIGrand_2.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Nord Imperial Grand",
    arquivo: soundfontUrl("Nord_Imperial_Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Nord Romantic Grand",
    arquivo: soundfontUrl("Nord_Romantic_Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Nord Royal Grand 3D",
    arquivo: soundfontUrl("RoyalGrand3D.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "FatBoy - Pianos",
    arquivo: soundfontUrl("FatBoy-v0_-_EPs.sf2"),
    categoria: "Pianos"
  },

  // PIANOS ELÉTRICOS
  {
    nome: "Big M1 Piano 16",
    arquivo: soundfontUrl("Big_M1_piano_16.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "Custom DX EP",
    arquivo: soundfontUrl("CustomDXEP.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "Custom Libre FM EP",
    arquivo: soundfontUrl("Custom_Libre_FM_EP.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "DX7 E-Piano 1",
    arquivo: soundfontUrl("DX7_E_Piano_1.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "FM EP Layers 2x",
    arquivo: soundfontUrl("FMEP_Layers_2x.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "KORG D1 Digital Piano EPiano2 (Retro)",
    arquivo: soundfontUrl("KORG_D1_Digital_Piano_EPiano2（Retro）.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "KORG D1 Digital Piano EPiano (Solid)",
    arquivo: soundfontUrl("KORG_D1_Digital_Piano_EPiano（Solid）.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "Nord EP",
    arquivo: soundfontUrl("nord_EP.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "FatBoy - EPs",
    arquivo: soundfontUrl("FatBoy-v0_-_EPs.sf2"),
    categoria: "Electric Pianos"
  },

  // ÓRGÃOS
  {
    nome: "Organ ESQ-1",
    arquivo: soundfontUrl("ORGAN1__ESQ-1_.sf2"),
    categoria: "Organs"
  },
  {
    nome: "Organ",
    arquivo: soundfontUrl("organ.sf2"),
    categoria: "Organs"
  },
  {
    nome: "Percussion Organ",
    arquivo: soundfontUrl("Perc_Organ.sf2"),
    categoria: "Organs"
  },
  {
    nome: "Yamaha Montage - Organs",
    arquivo: soundfontUrl("General_Montage_Organs.sf2"),
    categoria: "Organs"
  },

  // SYNTHS E LEADS
  {
    nome: "Fantasia 2",
    arquivo: soundfontUrl("Fantasia_2.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Leads",
    arquivo: soundfontUrl("leads.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Sin Pad ESQ-1",
    arquivo: soundfontUrl("SINPAD__ESQ-1_.sf2"),
    categoria: "Leads"
  },
  {
    nome: "TBOSf",
    arquivo: soundfontUrl("TBOSf.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Yamaha Montage - Leads/Synths",
    arquivo: soundfontUrl("General_Montage_Leads.sf2"),
    categoria: "Leads"
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
    categoria: "Bass"
  },
  {
    nome: "Yamaha Montage - Bass",
    arquivo: soundfontUrl("General_Montage_Bass.sf2"),
    categoria: "Bass"
  },

  // GUITARRAS
  {
    nome: "91 Slow Chorus Guitar",
    arquivo: soundfontUrl("91SlowChorusGuitar.sf2"),
    categoria: "Guitars"
  },
  {
    nome: "Yamaha Montage - Guitars",
    arquivo: soundfontUrl("General_Montage_Guitars.sf2"),
    categoria: "Guitars"
  },
  {
    nome: "FatBoy - Guitars",
    arquivo: soundfontUrl("FatBoy-v0_-_Guitars.sf2"),
    categoria: "Guitars"
  },

  // BELLS
  {
    nome: "Bells",
    arquivo: soundfontUrl("bells.sf2"),
    categoria: "Keys & Bells"
  },
  {
    nome: "Yamaha Montage - Bells",
    arquivo: soundfontUrl("General_Montage_Bells.sf2"),
    categoria: "Keys & Bells"
  },
  {
    nome: "FatBoy - Clavis e Bells",
    arquivo: soundfontUrl("FatBoy-v0_-_Clavis_e_Bells.sf2"),
    categoria: "Keys & Bells"
  },

  // SOPROS
  {
    nome: "Yamaha Montage - Flutes",
    arquivo: soundfontUrl("General_Montage_Flutes.sf2"),
    categoria: "Winds"
  },

  // PERCUSSÃO
  {
    nome: "Yamaha Montage - Drums",
    arquivo: soundfontUrl("General_Montage_Drums.sf2"),
    categoria: "Drums"
  },

  // FX E OUTROS
  {
    nome: "Korg AG-10",
    arquivo: soundfontUrl("Korg_AG-10.sf2"),
    categoria: "FX"
  },
  {
    nome: "Roland U20",
    arquivo: soundfontUrl("Roland_U20.sf2"),
    categoria: "FX"
  },
  {
    nome: "Yamaha Montage - FX",
    arquivo: soundfontUrl("General_Montage_FX.sf2"),
    categoria: "FX"
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
    arquivo: soundfontUrl("FatBoy-v0_-_Leads.sf2"),
    categoria: "Leads"
  },

  // ÓRGÃOS
  {
    nome: "FatBoy - Organs",
    arquivo: soundfontUrl("FatBoy-v0_-_Organs.sf2"),
    categoria: "Organs"
  },

  // STRINGS
  {
    nome: "FatBoy - Strings",
    arquivo: soundfontUrl("FatBoy-v0_-_Strings.sf2"),
    categoria: "Strings"
  },

  // VIOLIN
  {
    nome: "FatBoy - Violin",
    arquivo: soundfontUrl("FatBoy-v0-3_-_Violin.sf2"),
    categoria: "Strings"
  },
  {
    nome: "FatBoy - Cello",
    arquivo: soundfontUrl("FatBoy-v0-3_-_Cello.sf2"),
    categoria: "Strings"
  },

  // PIANOS - SÉRIE A
  {
    nome: "Roland Fantom X - So True",
    arquivo: soundfontUrl("A001_So_True....sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Concert Piano",
    arquivo: soundfontUrl("A002_ConcertPiano.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Warm Piano",
    arquivo: soundfontUrl("A003_Warm_Piano.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Warm Pad Piano",
    arquivo: soundfontUrl("A004_Warm_Pad_Pno.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Warm Strings Piano",
    arquivo: soundfontUrl("A005_Warm_Str_Pno.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Beale Street Walk",
    arquivo: soundfontUrl("A006_BealeSt_Walk.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Rapsody",
    arquivo: soundfontUrl("A007_Rapsody.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - JD-800 Piano",
    arquivo: soundfontUrl("A008_JD-800_Piano.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - SA Dance Piano",
    arquivo: soundfontUrl("A009_SA_Dance_Pno.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - FS E-Grand",
    arquivo: soundfontUrl("A010_FS_E-Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - FS Blend Piano",
    arquivo: soundfontUrl("A011_FS_Blend_Pno.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - LA Piano",
    arquivo: soundfontUrl("A012_LA_Piano.sf2"),
    categoria: "Pianos"
  },

  // PIANOS - ROLAND FANTOM X
  {
    nome: "Roland Fantom X - Concert Grand",
    arquivo: soundfontUrl("F001_ConcertGrand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Hall Concert",
    arquivo: soundfontUrl("F002_Hall_Concert.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Bright Tune",
    arquivo: soundfontUrl("F003_Bright_Tune.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Mellow Tune",
    arquivo: soundfontUrl("F004_Mellow_Tune.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Ultimate Grand",
    arquivo: soundfontUrl("F009_UltimatGrand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - X Pure Grand",
    arquivo: soundfontUrl("F010_X_Pure_Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Studio Grand",
    arquivo: soundfontUrl("F011_Studio_Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - 88 Concert Piano",
    arquivo: soundfontUrl("F012_88ConcertPno.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Dry Studio 88",
    arquivo: soundfontUrl("F013_DryStudio88.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - First Choice",
    arquivo: soundfontUrl("F014_First_Choice.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Rokkin' Piano",
    arquivo: soundfontUrl("F015_Rokkin'_pF.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Dark Grand",
    arquivo: soundfontUrl("F016_Dark_Grand.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Piano Oz",
    arquivo: soundfontUrl("F017_Piano_Oz.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Piano",
    arquivo: soundfontUrl("F017.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Grand Hall",
    arquivo: soundfontUrl("F018_Grand_Hall.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - X Piano + Strings",
    arquivo: soundfontUrl("F019_X_Piano_+Str.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Arie Piano",
    arquivo: soundfontUrl("F020_Arie_Piano.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Cicada Piano",
    arquivo: soundfontUrl("F021_Cicada_Piano.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Clare Voyent",
    arquivo: soundfontUrl("F022_Clare_Voyent.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - X Piano + Pad",
    arquivo: soundfontUrl("F023_X_Piano_+Pad.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - X Piano + Vox",
    arquivo: soundfontUrl("F024_X_Piano_+Vox.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - FX Piano",
    arquivo: soundfontUrl("F025_FX_Piano.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Roland Fantom X - Ambient Piano",
    arquivo: soundfontUrl("F026_AmbientPiano.sf2"),
    categoria: "Pianos"
  },

  // LEADS - ROLAND FANTOM X
  {
    nome: "Roland Fantom X - R&B TriLead",
    arquivo: soundfontUrl("C053_R&B_TriLead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - PeakArpSine",
    arquivo: soundfontUrl("C054_PeakArpSine.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Theramax",
    arquivo: soundfontUrl("C055_Theramax.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - FS Square Lead",
    arquivo: soundfontUrl("C056_FS_Sqr_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Dawn Of Pan",
    arquivo: soundfontUrl("C057_Dawn_Of_Pan.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Square Diamond",
    arquivo: soundfontUrl("C058_Sqr_Diamond.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - FS SoftLead",
    arquivo: soundfontUrl("C059_FS_SoftLead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mid Saw Lead",
    arquivo: soundfontUrl("C060_Mid_Saw_Ld.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - FS ResoLead",
    arquivo: soundfontUrl("C061_FS_ResoLead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Dig-n-Duke",
    arquivo: soundfontUrl("C062_Dig-n-Duke.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Modulated Lead",
    arquivo: soundfontUrl("C063_Modulated_Ld.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Waspy Lead",
    arquivo: soundfontUrl("C064_Waspy_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mew Lead",
    arquivo: soundfontUrl("C065_Mew_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Violin Lead",
    arquivo: soundfontUrl("C066_Violin_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Oscillo Lead",
    arquivo: soundfontUrl("C067_Oscillo_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - JP Saw Lead",
    arquivo: soundfontUrl("C068_JP_Saw_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - MG Square Lead",
    arquivo: soundfontUrl("C069_MG_Sqr_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Tristar",
    arquivo: soundfontUrl("C070_Tristar.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mod Lead",
    arquivo: soundfontUrl("C071_Mod_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Digital Lead 1",
    arquivo: soundfontUrl("C072_Digital_Ld_1.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Chubby Lead",
    arquivo: soundfontUrl("C073_Chubby_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Sneaky Leady",
    arquivo: soundfontUrl("C074_Sneaky_Leady.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - SoloNzPeaker",
    arquivo: soundfontUrl("C075_SoloNzPeaker.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Clone Zone",
    arquivo: soundfontUrl("C076_Clone_Zone.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Legato Tkno",
    arquivo: soundfontUrl("C077_Legato_Tkno.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - SliCed Lead",
    arquivo: soundfontUrl("G089_SliCed_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Synthi Fizz",
    arquivo: soundfontUrl("G090_Synthi_Fizz.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mini Growl",
    arquivo: soundfontUrl("G091_Mini_Growl.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Jupiter Lead",
    arquivo: soundfontUrl("G092_Jupiter_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - X-Pulse Lead",
    arquivo: soundfontUrl("G093_X-Pulse_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Jupi Square",
    arquivo: soundfontUrl("G094_Jupi_Square.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - TriStac Lead",
    arquivo: soundfontUrl("G095_TriStac_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Modular Lead",
    arquivo: soundfontUrl("G096_Modular_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Sinetific",
    arquivo: soundfontUrl("G097_Sinetific.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Dirty D_A",
    arquivo: soundfontUrl("G098_Dirty_D_A.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - EuronalSynth",
    arquivo: soundfontUrl("G099_EuronalSynth.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Xtrem Sine",
    arquivo: soundfontUrl("G100_Xtrem_Sine.sf2"),
    categoria: "Leads"
  },

  // KURZWEIL K2500
  {
    nome: "Kurzweil K2500 - Bass",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Bass.sf2"),
    categoria: "Bass"
  },
  {
    nome: "Kurzweil K2500 - Bells",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Bells.sf2"),
    categoria: "Keys & Bells"
  },
  {
    nome: "Kurzweil K2500 - Brass",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Brass.sf2"),
    categoria: "Brass"
  },
  {
    nome: "Kurzweil K2500 - Choir",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Choir.sf2"),
    categoria: "Choir"
  },
  {
    nome: "Kurzweil K2500 - Drums",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Drums.sf2"),
    categoria: "Drums"
  },
  {
    nome: "Kurzweil K2500 - EPianos",
    arquivo: soundfontUrl("Kurzweil_K2500_-_EPianos.sf2"),
    categoria: "Electric Pianos"
  },
  {
    nome: "Kurzweil K2500 - Flutes",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Flutes.sf2"),
    categoria: "Flutes"
  },
  {
    nome: "Kurzweil K2500 - Guitars",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Guitars.sf2"),
    categoria: "Guitars"
  },
  {
    nome: "Kurzweil K2500 - Leads",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Leads.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Kurzweil K2500 - Organs",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Organs.sf2"),
    categoria: "Organs"
  },
  {
    nome: "Kurzweil K2500 - Pads",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Pads.sf2"),
    categoria: "Pads"
  },
  {
    nome: "Kurzweil K2500 - Pianos",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Pianos.sf2"),
    categoria: "Pianos"
  },
  {
    nome: "Kurzweil K2500 - Strings",
    arquivo: soundfontUrl("Kurzweil_K2500_-_Strings.sf2"),
    categoria: "Strings"
  },
  {
    nome: "Kurzweil K2500 - World",
    arquivo: soundfontUrl("Kurzweil_K2500_-_World.sf2"),
    categoria: "World"
  },
  // LEADS - ROLAND FANTOM X
  {
    nome: "Roland Fantom X - R&B TriLead",
    arquivo: soundfontUrl("C053_R&B_TriLead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - PeakArpSine",
    arquivo: soundfontUrl("C054_PeakArpSine.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Theramax",
    arquivo: soundfontUrl("C055_Theramax.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - FS Square Lead",
    arquivo: soundfontUrl("C056_FS_Sqr_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Dawn Of Pan",
    arquivo: soundfontUrl("C057_Dawn_Of_Pan.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Square Diamond",
    arquivo: soundfontUrl("C058_Sqr_Diamond.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - FS SoftLead",
    arquivo: soundfontUrl("C059_FS_SoftLead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mid Saw Lead",
    arquivo: soundfontUrl("C060_Mid_Saw_Ld.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - FS ResoLead",
    arquivo: soundfontUrl("C061_FS_ResoLead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Dig-n-Duke",
    arquivo: soundfontUrl("C062_Dig-n-Duke.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Modulated Lead",
    arquivo: soundfontUrl("C063_Modulated_Ld.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Waspy Lead",
    arquivo: soundfontUrl("C064_Waspy_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mew Lead",
    arquivo: soundfontUrl("C065_Mew_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Violin Lead",
    arquivo: soundfontUrl("C066_Violin_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Oscillo Lead",
    arquivo: soundfontUrl("C067_Oscillo_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - JP Saw Lead",
    arquivo: soundfontUrl("C068_JP_Saw_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - MG Square Lead",
    arquivo: soundfontUrl("C069_MG_Sqr_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Tristar",
    arquivo: soundfontUrl("C070_Tristar.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Mod Lead",
    arquivo: soundfontUrl("C071_Mod_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Digital Lead 1",
    arquivo: soundfontUrl("C072_Digital_Ld_1.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Chubby Lead",
    arquivo: soundfontUrl("C073_Chubby_Lead.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Sneaky Leady",
    arquivo: soundfontUrl("C074_Sneaky_Leady.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - SoloNzPeaker",
    arquivo: soundfontUrl("C075_SoloNzPeaker.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Clone Zone",
    arquivo: soundfontUrl("C076_Clone_Zone.sf2"),
    categoria: "Leads"
  },
  {
    nome: "Roland Fantom X - Legato Tkno",
    arquivo: soundfontUrl("C077_Legato_Tkno.sf2"),
    categoria: "Leads"
  }
];
