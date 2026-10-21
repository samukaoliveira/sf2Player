
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ControladorMidiService {

  private midiAccess: MIDIAccess | null = null;
  private entradaConectada: MIDIInput | null = null;

  public conectado = false;
  public nomeControladorConectado: string | null = null;

  async conectar(
    aoPressionar: (nota: number, velocidade: number) => void,
    aoSoltar: (nota: number) => void,
    aoSustain: (ativo: boolean) => void,
    aoControlChange?: (
      controle: number,
      valor: number,
      canal: number
    ) => void,
    aoPitchBend?: (
      valor: number,
      canal: number
    ) => void
  ): Promise<string[]> {

    if (!navigator.requestMIDIAccess) {
      throw new Error(
        'Seu navegador não suporta Web MIDI API.'
      );
    }

    this.desconectar();

    try {
      this.midiAccess = await navigator.requestMIDIAccess();

      const entradas = Array.from(
        this.midiAccess.inputs.values()
      );

      const nomesEntradas = entradas.map(
        input => input.name || 'Entrada MIDI sem nome'
      );

      console.log('Entradas MIDI disponíveis:', nomesEntradas);

      if (entradas.length === 0) {
        throw new Error(
          'Nenhuma entrada MIDI encontrada. Verifique se o controlador está conectado.'
        );
      }

      const entrada =
        entradas.find(input =>
          !/midi through/i.test(input.name || '')
        ) || entradas[0];

      this.entradaConectada = entrada;
      this.nomeControladorConectado =
        entrada.name || 'Controlador MIDI sem nome';

      this.conectado = true;

      entrada.onmidimessage = (event: MIDIMessageEvent) => {
        const dados = event.data;

        if (!dados || dados.length < 2) {
          return;
        }

        const status = dados[0];
        const comando = status & 0xF0;
        const canal = status & 0x0F;

        const notaOuControle = dados[1];
        const valor = dados.length > 2 ? dados[2] : 0;

        // Note On
        if (comando === 0x90 && valor > 0) {
          aoPressionar(notaOuControle, valor);
          return;
        }

        // Note Off ou Note On com velocidade zero
        if (
          comando === 0x80 ||
          (comando === 0x90 && valor === 0)
        ) {
          aoSoltar(notaOuControle);
          return;
        }

        // Pitch Bend: mensagem MIDI própria de 14 bits
        if (comando === 0xE0 && dados.length >= 3) {
          const valor14Bits =
            dados[1] | (dados[2] << 7);

          // Faixa: 0 a 16383; centro: 8192
          aoPitchBend?.(valor14Bits, canal);
          return;
        }

        // Control Change: modulação, sustain e outros controles
        if (comando === 0xB0) {
          const controle = notaOuControle;

          if (controle === 64) {
            aoSustain(valor >= 64);
          }

          aoControlChange?.(controle, valor, canal);
        }
      };

      console.log(
        'MIDI conectado:',
        this.nomeControladorConectado,
        '| ID:',
        entrada.id
      );

      return nomesEntradas;

    } catch (erro) {
      this.desconectar();

      console.error('Erro ao conectar MIDI:', erro);

      throw erro;
    }
  }

  desconectar(): void {
    if (this.entradaConectada) {
      this.entradaConectada.onmidimessage = null;
      this.entradaConectada = null;
    }

    this.midiAccess = null;
    this.conectado = false;
    this.nomeControladorConectado = null;
  }
}
