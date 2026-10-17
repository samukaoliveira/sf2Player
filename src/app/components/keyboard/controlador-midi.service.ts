
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ControladorMidiService {

  private midiAccess: MIDIAccess | null = null;
  private entradaConectada: MIDIInput | null = null;
  public conectado = false;

  private readonly nomeControlador = 'Samson Carbon49';

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

    this.midiAccess = await navigator.requestMIDIAccess();

    const entradas = Array.from(
      this.midiAccess.inputs.values()
    );

    console.log(
      'Entradas MIDI disponíveis:',
      entradas.map(input => input.name)
    );

    const entrada = entradas.find(input =>
      input.name?.includes(this.nomeControlador)
    );

    if (!entrada) {
      throw new Error(
        `Controlador ${this.nomeControlador} não encontrado.`
      );
    }

    this.entradaConectada = entrada;
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

        // Preserva o comportamento do sustain.
        if (controle === 64) {
          aoSustain(valor >= 64);
        }

        // Permite aprender qualquer CC recebido.
        if (aoControlChange) {
          aoControlChange(
            controle,
            valor,
            canal
          );
        }
      }
    };

    console.log(
      'MIDI conectado:',
      entrada.name
    );

    return entradas.map(
      input => input.name ?? 'Entrada MIDI sem nome'
    );
  }

  desconectar(): void {
    if (this.entradaConectada) {
      this.entradaConectada.onmidimessage = null;
      this.entradaConectada = null;
    }

    this.conectado = false;
  }
}
