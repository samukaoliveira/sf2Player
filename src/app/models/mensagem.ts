import { Conversa } from "./conversa";
import { Usuario } from "./usuario";

export interface Mensagem {
  id: number;
  conteudo: string;
  horaEnvio: string;
  conversa: Conversa;
  sender: Usuario;
}
