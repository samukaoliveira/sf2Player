const TAMANHO_BUFFER = 4096;
const ATRASO_FRAMES = 2048;

class Sf2MixerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.esquerda = new Float32Array(TAMANHO_BUFFER);
    this.direita = new Float32Array(TAMANHO_BUFFER);
    this.indiceEscrita = 0;
  }

  process(entradas, saidas) {
    const saida = saidas[0];
    if (!saida || !saida[0] || !saida[1]) return true;
    const canalEsquerdo = saida[0];
    const canalDireito = saida[1];

    for (let quadro = 0; quadro < canalEsquerdo.length; quadro++) {
      let amostraEsquerda = 0;
      let amostraDireita = 0;
      for (let entrada = 0; entrada < entradas.length; entrada++) {
        const canais = entradas[entrada];
        if (!canais || !canais[0]) continue;
        amostraEsquerda += canais[0][quadro] || 0;
        amostraDireita += (canais[1] || canais[0])[quadro] || 0;
      }

      const indiceLeitura = (this.indiceEscrita - ATRASO_FRAMES + TAMANHO_BUFFER) % TAMANHO_BUFFER;
      canalEsquerdo[quadro] = this.esquerda[indiceLeitura];
      canalDireito[quadro] = this.direita[indiceLeitura];
      this.esquerda[this.indiceEscrita] = amostraEsquerda;
      this.direita[this.indiceEscrita] = amostraDireita;
      this.indiceEscrita = (this.indiceEscrita + 1) % TAMANHO_BUFFER;
    }
    return true;
  }
}

registerProcessor('sf2-mixer', Sf2MixerProcessor);
