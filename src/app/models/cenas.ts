
export interface CenaSoundFont {
  arquivo: string;
  banco: number;
  programa: number;
  volume: number;
  ativo: boolean;

  brilho?: number;
  reverb?: number;
  chorus?: number;
  pitchBendAtivado?: boolean;
  modulacaoAtivada?: boolean;
}

export interface Cena {
  nome: string;
  soundfonts: CenaSoundFont[];
  associacoesMidiVolume: { [nome: string]: number };
}
