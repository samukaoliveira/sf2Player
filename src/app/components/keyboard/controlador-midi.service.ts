import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ControladorMidiService {
  private acessoMidi: MIDIAccess | null = null;
  private entradaAtual: MIDIInput | null = null;

  conectado = false;
  nomeDispositivo = '';

  async conectar(
    aoTocarNota: (nota: number, velocidade: number) => void,
    aoSoltarNota: (nota: number) => void,
    aoSustain: (ativo: boolean) => void
  ): Promise<string[]> {
    if (!('requestMIDIAccess' in navigator)) {
      throw new Error(
        'Web MIDI não está disponível neste navegador.'
      );
    }

    this.acessoMidi = await navigator.requestMIDIAccess();

    const entradas = Array.from(
      this.acessoMidi.inputs.values()
    );

    if (entradas.length === 0) {
      throw new Error(
        'Nenhum dispositivo MIDI de entrada foi encontrado.'
      );
    }

    this.entradaAtual = entradas[0];
    this.nomeDispositivo =
      this.entradaAtual.name || 'Controlador MIDI';

    this.entradaAtual.onmidimessage = (evento: MIDIMessageEvent) => {
      const dados = evento.data;

      if (!dados || dados.length < 2) {
        return;
      }

      const status = dados[0] & 0xF0;
      const nota = dados[1];
      const valor = dados.length > 2 ? dados[2] : 0;

      // Note On: status 0x90 e velocidade maior que zero.
      if (status === 0x90 && valor > 0) {
        aoTocarNota(nota, valor);
        return;
      }

      // Note Off, incluindo Note On com velocidade zero.
      if (
        status === 0x80 ||
        (status === 0x90 && valor === 0)
      ) {
        aoSoltarNota(nota);
        return;
      }

      // Control Change: sustain é CC64.
      if (status === 0xB0 && nota === 64) {
        aoSustain(valor >= 64);
      }
    };

    this.conectado = true;

    return entradas.map(
      entrada => entrada.name || 'Dispositivo MIDI'
    );
  }

  selecionarEntrada(nome: string): void {
    if (!this.acessoMidi) {
      return;
    }

    const entrada = Array.from(
      this.acessoMidi.inputs.values()
    ).find(item => item.name === nome);

    if (!entrada) {
      return;
    }

    if (this.entradaAtual) {
      this.entradaAtual.onmidimessage = null;
    }

    this.entradaAtual = entrada;
    this.nomeDispositivo = entrada.name || nome;
  }

  desconectar(): void {
    if (this.entradaAtual) {
      this.entradaAtual.onmidimessage = null;
    }

    this.entradaAtual = null;
    this.acessoMidi = null;
    this.conectado = false;
    this.nomeDispositivo = '';
  }
}
