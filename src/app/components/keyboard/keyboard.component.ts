import { Component, OnDestroy } from '@angular/core';
import { SoundFontMixer } from './soundfont-mixer.model';
import {
  MotorSoundFont,
  ProgramaSoundFont
} from './motor-soundfont.model';
import { SOUNDFONTS } from './soundfont-mixer.config';
import { SOUNDFONT_CATALOGO } from './soundfont-catalog.config';
import { TecladoFisicoService } from './teclado-fisico.service';
import { ControladorMidiService } from './controlador-midi.service';

declare const JSSynth: any;

@Component({
  selector: 'keyboard',
  templateUrl: './keyboard.component.html',
  styleUrls: ['./keyboard.component.scss']
})
export class KeyboardComponent implements OnDestroy {
  context: AudioContext | null = null;

  inicializando = false;
  pronto = false;
  erro = '';

  sustainAtivado = false;
  sustainPressionado = false;

  soundfontCatalogo = SOUNDFONT_CATALOGO;

  soundfonts: MotorSoundFont[] = SOUNDFONTS.map(
    (sf: SoundFontMixer) => ({
      ...sf,
      synth: null,
      audioNode: null,
      programas: []
    })
  );

  readonly BUFFER_SIZE = 512;

  readonly teclas: number[] = Array.from(
    { length: 25 },
    (_, i) => 48 + i
  );

  readonly nomesNotas = [
    'C', 'C#', 'D', 'D#', 'E', 'F',
    'F#', 'G', 'G#', 'A', 'A#', 'B'
  ];

  private motoresPorNota =
    new Map<number, MotorSoundFont[]>();

  dispositivosMidi: string[] = [];

  constructor(
    private tecladoFisico: TecladoFisicoService,
    private controladorMidi: ControladorMidiService
  ) {}

  aoPressionarTecla(event: KeyboardEvent): void {
    this.tecladoFisico.pressionar(
      event,
      nota => this.tocarNota(nota)
    );
  }

  aoSoltarTecla(event: KeyboardEvent): void {
    this.tecladoFisico.soltar(
      event,
      nota => this.soltarNota(nota)
    );
  }

  liberarTeclasFisicas(): void {
    this.tecladoFisico.liberarTodas(
      nota => this.soltarNota(nota)
    );
  }

  async iniciarAudio(): Promise<void> {
    if (this.pronto || this.inicializando) {
      return;
    }

    this.inicializando = true;
    this.erro = '';

    try {
      await JSSynth.waitForReady();

      this.context = new AudioContext();

      for (const sf of this.soundfonts) {
        sf.synth = new JSSynth.Synthesizer();
        sf.synth.init(this.context.sampleRate);

        sf.audioNode = sf.synth.createAudioNode(
          this.context,
          this.BUFFER_SIZE
        );

        sf.audioNode.connect(this.context.destination);
        sf.soundFontId = null;
        sf.programas = [];

        if (sf.arquivo) {
          await this.carregarSoundFontInicial(sf);
        }

        sf.synth.midiControl(sf.canal, 64, 0);
        this.aplicarVolume(sf);
      }

      await this.context.resume();

      this.pronto = true;
      this.atualizarSustain();

    } catch (e) {
      console.error('Erro ao iniciar áudio:', e);

      this.erro =
        'Não foi possível inicializar os motores de áudio.';

      await this.fecharRecursos();

    } finally {
      this.inicializando = false;
    }
  }

  private async carregarSoundFontInicial(
    sf: MotorSoundFont
  ): Promise<void> {
    if (!sf.synth || !sf.arquivo) {
      return;
    }

    const resposta = await fetch(sf.arquivo);

    if (!resposta.ok) {
      throw new Error(
        `Erro HTTP ${resposta.status}: ${sf.arquivo}`
      );
    }

    const dados = await resposta.arrayBuffer();
    const id = await sf.synth.loadSFont(dados);

    if (typeof id !== 'number' || id < 0) {
      throw new Error(
        `Falha ao carregar ${sf.arquivo}`
      );
    }

    sf.soundFontId = id;

    this.carregarProgramas(sf);
    this.selecionarPreset(sf);

    console.log(
      `SoundFont carregado: ${sf.arquivo}`,
      'ID:', id,
      'Presets:', sf.programas.length
    );
  }

  /**
   * Lê os presets reais do arquivo SF2.
   *
   * getSFontObject() retorna o objeto SoundFont.
   * getPresetIterable() permite percorrer os presets.
   */
  private carregarProgramas(sf: MotorSoundFont): void {
    sf.programas = [];

    if (!sf.synth || sf.soundFontId == null) {
      return;
    }

    const soundFont = sf.synth.getSFontObject(
      sf.soundFontId
    );

    if (!soundFont) {
      console.warn(
        `Não foi possível obter o objeto SF2 de ${sf.nome}`
      );
      return;
    }

    const presets: ProgramaSoundFont[] = Array.from(
      soundFont.getPresetIterable(),
      (preset: any): ProgramaSoundFont => ({
        nome: preset.name,
        banco: preset.bankNum,
        programa: preset.num
      })
    );

    // Ordena por banco e depois pelo número do programa.
    presets.sort((a, b) =>
      a.banco - b.banco ||
      a.programa - b.programa
    );

    sf.programas = presets;

    if (presets.length === 0) {
      console.warn(
        `Nenhum preset encontrado em ${sf.arquivo}`
      );
      return;
    }

    // Mantém a seleção atual se ela existir no novo SF2.
    const atual = presets.find(
      p =>
        p.banco === sf.banco &&
        p.programa === sf.programa
    );

    // Caso não exista, seleciona o primeiro preset disponível.
    if (!atual) {
      sf.banco = presets[0].banco;
      sf.programa = presets[0].programa;
    }
  }

  async trocarSoundFont(
    sf: MotorSoundFont,
    arquivo: string
  ): Promise<void> {
    if (!sf.synth || !arquivo || sf.arquivo === arquivo) {
      return;
    }

    const arquivoAnterior = sf.arquivo;
    const idAnterior = sf.soundFontId;

    this.erro = '';

    try {
      const resposta = await fetch(arquivo);

      if (!resposta.ok) {
        throw new Error(
          `Erro HTTP ${resposta.status}: ${arquivo}`
        );
      }

      const dados = await resposta.arrayBuffer();
      const novoId = await sf.synth.loadSFont(dados);

      if (typeof novoId !== 'number' || novoId < 0) {
        throw new Error(`Falha ao carregar ${arquivo}`);
      }

      // Atualiza o slot para o novo SoundFont.
      sf.arquivo = arquivo;
      sf.soundFontId = novoId;

      if (!arquivoAnterior) {
        sf.ativo = true;
      }

      this.carregarProgramas(sf);
      this.selecionarPreset(sf);
      this.aplicarVolume(sf);

      // Descarrega o arquivo anterior depois da troca.
      if (idAnterior != null) {
        try {
          await sf.synth.unloadSFontAsync(idAnterior);
        } catch (e) {
          console.warn(
            'Não foi possível descarregar o SoundFont anterior:',
            e
          );
        }
      }

      console.log(
        `SoundFont alterado no ${sf.nome}:`,
        arquivo,
        'Presets:', sf.programas.length
      );

    } catch (e) {
      console.error('Erro ao trocar SoundFont:', e);

      this.erro =
        `Não foi possível carregar o SoundFont ${arquivo}.`;

      sf.arquivo = arquivoAnterior;
      sf.soundFontId = idAnterior;
    }
  }

  selecionarPreset(sf: MotorSoundFont): void {
    if (!sf.synth || sf.soundFontId == null) {
      return;
    }

    sf.synth.midiProgramSelect(
      sf.canal,
      sf.soundFontId,
      sf.banco,
      sf.programa
    );
  }

  selecionarProgramaPorNome(
    sf: MotorSoundFont,
    valor: string
  ): void {
    if (!valor || !valor.includes(':')) {
      return;
    }

    const [bancoTexto, programaTexto] = valor.split(':');

    const banco = Number(bancoTexto);
    const programa = Number(programaTexto);

    if (
      !Number.isInteger(banco) ||
      !Number.isInteger(programa)
    ) {
      return;
    }

    const existe = sf.programas.some(
      p =>
        p.banco === banco &&
        p.programa === programa
    );

    if (!existe) {
      return;
    }

    sf.banco = banco;
    sf.programa = programa;

    this.selecionarPreset(sf);
  }

  alterarPrograma(
    sf: MotorSoundFont,
    programaExibido: number | string
  ): void {
    const valor = Number(programaExibido);

    if (!Number.isFinite(valor)) {
      return;
    }

    sf.programa = Math.max(
      0,
      Math.min(127, Math.trunc(valor) - 1)
    );

    this.selecionarPreset(sf);
  }

  alterarBanco(
    sf: MotorSoundFont,
    bancoSelecionado: number | string
  ): void {
    const valor = Number(bancoSelecionado);

    if (!Number.isFinite(valor)) {
      return;
    }

    sf.banco = Math.max(
      0,
      Math.min(16383, Math.trunc(valor))
    );

    this.selecionarPreset(sf);
  }

  aplicarVolume(sf: MotorSoundFont): void {
    if (!sf.synth) {
      return;
    }

    const percentual = Math.max(
      0,
      Math.min(100, Number(sf.volume) || 0)
    );

    const volumeMidi = sf.ativo
      ? Math.round(percentual * 127 / 100)
      : 0;

    sf.synth.midiControl(
      sf.canal,
      7,
      volumeMidi
    );
  }

  alterarVolume(
    sf: MotorSoundFont,
    volume: number | string
  ): void {
    const valor = Number(volume);

    if (!Number.isFinite(valor)) {
      return;
    }

    sf.volume = Math.max(
      0,
      Math.min(100, valor)
    );

    this.aplicarVolume(sf);
  }

  alternarSoundFont(
    sf: MotorSoundFont,
    ativo: boolean
  ): void {
    sf.ativo = ativo;

    if (!ativo && sf.synth) {
      sf.synth.midiControl(sf.canal, 64, 0);
      sf.synth.midiAllNotesOff(sf.canal);

      for (const [nota, motores] of this.motoresPorNota) {
        if (!motores.includes(sf)) {
          continue;
        }

        const restantes = motores.filter(
          motor => motor !== sf
        );

        if (restantes.length) {
          this.motoresPorNota.set(nota, restantes);
        } else {
          this.motoresPorNota.delete(nota);
        }
      }

      this.atualizarSustain();
    }

    this.aplicarVolume(sf);
  }

  tocarNota(nota: number): void {
    if (!this.pronto) {
      return;
    }

    const anteriores = this.motoresPorNota.get(nota);

    if (anteriores) {
      for (const motor of anteriores) {
        motor.synth?.midiNoteOff(motor.canal, nota);
      }
    }

    const motoresAtivos: MotorSoundFont[] = [];

    for (const sf of this.soundfonts) {
      if (
        !sf.ativo ||
        !sf.synth ||
        sf.soundFontId == null
      ) {
        continue;
      }

      sf.synth.midiNoteOn(sf.canal, nota, 100);
      motoresAtivos.push(sf);
    }

    if (motoresAtivos.length) {
      this.motoresPorNota.set(nota, motoresAtivos);
    } else {
      this.motoresPorNota.delete(nota);
    }
  }

  soltarNota(nota: number): void {
    if (!this.pronto) {
      return;
    }

    this.liberarNota(nota);
  }

  private liberarNota(nota: number): void {
    const motores = this.motoresPorNota.get(nota);

    if (!motores) {
      return;
    }

    for (const motor of motores) {
      motor.synth?.midiNoteOff(motor.canal, nota);
    }

    this.motoresPorNota.delete(nota);
  }

  private atualizarSustain(): void {
    const valor = this.sustainEstaAtivo() ? 127 : 0;

    for (const sf of this.soundfonts) {
      if (!sf.synth) {
        continue;
      }

      sf.synth.midiControl(sf.canal, 64, valor);
    }
  }

  private sustainEstaAtivo(): boolean {
    return this.sustainAtivado || this.sustainPressionado;
  }

  alternarSustain(): void {
    this.sustainAtivado = !this.sustainAtivado;
    this.atualizarSustain();
  }

  pressionarSustain(): void {
    this.sustainPressionado = true;
    this.atualizarSustain();
  }

  soltarSustain(): void {
    this.sustainPressionado = false;
    this.atualizarSustain();
  }

  nomeNota(nota: number): string {
    const nome = this.nomesNotas[nota % 12];
    const oitava = Math.floor(nota / 12) - 1;

    return `${nome}${oitava}`;
  }

  ehTeclaPreta(nota: number): boolean {
    return [1, 3, 6, 8, 10].includes(nota % 12);
  }

  private async fecharRecursos(): Promise<void> {
    this.pronto = false;
    this.motoresPorNota.clear();

    for (const sf of this.soundfonts) {
      if (sf.synth) {
        try {
          await sf.synth.close();
        } catch (e) {
          console.warn(
            `Erro ao fechar ${sf.nome}:`,
            e
          );
        }
      }

      sf.synth = null;
      sf.audioNode = null;
      sf.soundFontId = null;
      sf.programas = [];
    }

    if (this.context) {
      const contexto = this.context;
      this.context = null;

      if (contexto.state !== 'closed') {
        await contexto.close();
      }
    }
  }

  async conectarControladorMidi(): Promise<void> {
    try {
      this.dispositivosMidi =
        await this.controladorMidi.conectar(
          (nota, velocidade) => {
            if (!this.pronto) {
              return;
            }

            this.tocarNotaComVelocidade(nota, velocidade);
          },
          nota => {
            this.soltarNota(nota);
          },
          ativo => {
            this.sustainPressionado = ativo;
            this.atualizarSustain();
          }
        );

      this.erro = '';

    } catch (e) {
      console.error('Erro MIDI:', e);

      this.erro = e instanceof Error
        ? e.message
        : 'Não foi possível conectar o controlador MIDI.';
    }
  }

  private tocarNotaComVelocidade(
    nota: number,
    velocidade: number
  ): void {
    if (!this.pronto) {
      return;
    }

    // Preserva a velocidade de toque enviada pelo controlador.
    const anteriores = this.motoresPorNota.get(nota);

    if (anteriores) {
      for (const motor of anteriores) {
        motor.synth?.midiNoteOff(motor.canal, nota);
      }
    }

    const motoresAtivos: MotorSoundFont[] = [];

    for (const sf of this.soundfonts) {
      if (
        !sf.ativo ||
        !sf.synth ||
        sf.soundFontId == null
      ) {
        continue;
      }

      sf.synth.midiNoteOn(
        sf.canal,
        nota,
        velocidade
      );

      motoresAtivos.push(sf);
    }

    if (motoresAtivos.length) {
      this.motoresPorNota.set(nota, motoresAtivos);
    } else {
      this.motoresPorNota.delete(nota);
    }
  }

  ngOnDestroy(): void {
    this.controladorMidi.desconectar();
    this.liberarTeclasFisicas();
    void this.fecharRecursos();
  }
}
