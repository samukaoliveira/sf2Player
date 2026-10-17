export interface CenaSoundFont {
  arquivo: string;
  banco: number;
  programa: number;
  volume: number;
  ativo: boolean;
}

export interface Cena {
  nome: string;
  soundfonts: CenaSoundFont[];
  associacoesMidiVolume: { [nome: string]: number };
}