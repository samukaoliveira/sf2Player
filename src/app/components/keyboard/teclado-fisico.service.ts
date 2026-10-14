import { Injectable } from '@angular/core';
import { MAPA_TECLADO_FISICO } from './teclado-fisico.config';

@Injectable({
  providedIn: 'root'
})
export class TecladoFisicoService {
  private teclasPressionadas = new Set<string>();

  private obterTecla(event: KeyboardEvent): string {
    return event.key.length === 1
      ? event.key.toLowerCase()
      : event.key;
  }

  pressionar(
    event: KeyboardEvent,
    tocarNota: (nota: number) => void
  ): void {
    if (
      event.repeat ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    ) {
      return;
    }

    const elemento = event.target as HTMLElement | null;
    const tag = elemento?.tagName;

    if (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      elemento?.isContentEditable
    ) {
      return;
    }

    const tecla = this.obterTecla(event);
    const nota = MAPA_TECLADO_FISICO[tecla];

    if (nota === undefined) {
      return;
    }

    event.preventDefault();
    this.teclasPressionadas.add(tecla);
    tocarNota(nota);
  }

  soltar(
    event: KeyboardEvent,
    soltarNota: (nota: number) => void
  ): void {
    const tecla = this.obterTecla(event);

    if (!this.teclasPressionadas.has(tecla)) {
      return;
    }

    event.preventDefault();
    this.teclasPressionadas.delete(tecla);

    const nota = MAPA_TECLADO_FISICO[tecla];

    if (nota !== undefined) {
      soltarNota(nota);
    }
  }

  liberarTodas(
    soltarNota: (nota: number) => void
  ): void {
    for (const tecla of this.teclasPressionadas) {
      const nota = MAPA_TECLADO_FISICO[tecla];

      if (nota !== undefined) {
        soltarNota(nota);
      }
    }

    this.teclasPressionadas.clear();
  }
}
