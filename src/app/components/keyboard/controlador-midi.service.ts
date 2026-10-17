
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

      // Prioriza uma entrada que não seja a porta virtual Midi Through.
      // Nenhum nome específico de controlador fica fixo no código.
      const entrada =
        entradas.find(input =>
          !/midi through/i.test(input.name || '')
        ) || entradas[0];

      //await entrada.open();

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

        // Note On: nota pressionada.
        if (comando === 0x90 && valor > 0) {
          aoPressionar(notaOuControle, valor);
          return;
        }

        // Note Off ou Note On com velocidade zero.
        if (
          comando === 0x80 ||
          (comando === 0x90 && valor === 0)
        ) {
          aoSoltar(notaOuControle);
          return;
        }

        // Control Change: knobs, sliders e pedais.
        if (comando === 0xB0) {
          const controle = notaOuControle;

          if (controle === 64) {
            aoSustain(valor >= 64);
          }

          if (aoControlChange) {
            aoControlChange(controle, valor, canal);
          }
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

      //this.entradaConectada.close().catch(erro => {
      //  console.warn('Erro ao fechar entrada MIDI:', erro);
      //});

      this.entradaConectada = null;
    }

    this.conectado = false;
    this.nomeControladorConectado = null;
  }
}
