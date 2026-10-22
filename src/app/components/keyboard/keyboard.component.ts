import { Component, OnDestroy } from '@angular/core';
import { SoundFontMixer } from './soundfont-mixer.model';
import {
  MotorSoundFont,
  ProgramaSoundFont
} from './motor-soundfont.model';
import { SOUNDFONTS } from './soundfont-mixer.config';
import { SOUNDFONT_CATALOGO,
  SoundFontGrupo,
  SoundFontOpcao } from './soundfont-catalog.config';
import { TecladoFisicoService } from './teclado-fisico.service';
import { ControladorMidiService } from './controlador-midi.service';
import { Cena, CenaSoundFont } from '../../models/cenas';

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

  nomeArquivo = '';

  soundfontCatalogo = SOUNDFONT_CATALOGO;
  soundfontGrupos: SoundFontGrupo[] = [];

  soundfonts: MotorSoundFont[] = SOUNDFONTS.map(
    (sf: SoundFontMixer, index: number) => ({
      ...sf,
      arquivo: index === 0 ? sf.arquivo : '',
      ativo: index === 0 ? sf.ativo : false,
      synth: null,
      audioNode: null,
      soundFontId: null,
      programas: [],
      brilho: 100,
      reverb: 0,
      chorus: 0,
      cutoff: 12000,
      ressonancia: 0.7,
      pitchBendAtivado: true,
      modulacaoAtivada: true,
      carregando: false,
      progresso: 0,
      efeitos: {
        filtro: null,
        ganhoSeco: null,
        ganhoReverb: null,
        convolver: null,
        ganhoChorus: null,
        atrasoChorus: null,
        osciladorChorus: null,
        profundidadeChorus: null
      }
    })
  );

  private soundFontCache =
  new WeakMap<object, Map<string, number>>();

  BUFFER_SIZE = 512;

  controladoresMidi: MIDIInput[] = [];
  controladorSelecionadoId = '';

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

  // Timbre que está aguardando um controle MIDI.
  midiLearnAlvo: MotorSoundFont | null = null;

  // Associação entre o nome do timbre e o número do CC.
  midiCCPorSoundFont: { [nome: string]: number } = {};

  dispositivosMidi: string[] = [];

  // Cenas salvas pelo usuário.
  cenas: Cena[] = [];

  // Nome digitado ao salvar uma cena.
  nomeNovaCena = '';

  // Cena selecionada na lista.
  cenaSelecionada = '';

  private readonly chaveCenas = 'sf2Player.cenas';

  constructor(
    public tecladoFisico: TecladoFisicoService,
    public controladorMidi: ControladorMidiService
  ) {
    this.midiCCPorSoundFont = {};
    this.carregarCenasSalvas();
    this.agruparSoundFonts();
  }

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

  async iniciarAudio(bufferSize: number): Promise<void> {
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
        sf.synth.init(this.context.sampleRate, {
          reverbActive: false,
          chorusActive: false,

          // Mantém os parâmetros explícitos para facilitar
          // futuros testes de configuração.
          reverbRoomSize: 0.2,
          reverbDamp: 0,
          reverbWidth: 0.5,
          reverbLevel: 0,

          chorusNr: 3,
          chorusLevel: 0,
          chorusSpeed: 0.3,
          chorusDepth: 8
        });

        sf.synth.setReverbOn(false);
        sf.synth.setChorusOn(false);

        sf.audioNode = sf.synth.createAudioNode(
          this.context,
          bufferSize
        );

        console.log({
          sampleRate: this.context.sampleRate,
          baseLatencyMs: this.context.baseLatency * 1000,
          outputLatencyMs:
            typeof this.context.outputLatency === 'number'
              ? this.context.outputLatency * 1000
              : 'Não disponível'
        });

        //sf.audioNode.connect(this.context.destination);
        this.criarEfeitosDoSlot(sf);
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

    sf.carregando = true;

    try {
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
    } catch (erro) {
      console.error(
        `Erro ao carregar o timbre ${sf.arquivo}:`,
        erro
      );

      throw erro;
    } finally {
      sf.carregando = false;
    }
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
    const cache = this.obterCacheSoundFonts(sf.synth);

    this.erro = '';
    sf.carregando = true;
    sf.progresso = 0;

    try {
      let novoId = cache.get(arquivo);

      // Se já estiver carregado, reutiliza o ID.
      if (novoId == null) {
        const resposta = await fetch(arquivo);

        if (!resposta.ok) {
          throw new Error(
            `Erro HTTP ${resposta.status}: ${arquivo}`
          );
        }

        const tamanhoTotal = Number(
          resposta.headers.get('Content-Length')
        );

        const leitor = resposta.body?.getReader();

        if (!leitor) {
          throw new Error(
            'Não foi possível ler o arquivo SF2.'
          );
        }

        const blocos: Uint8Array[] = [];
        let totalRecebido = 0;

        while (true) {
          const { done, value } = await leitor.read();

          if (done) break;

          if (value) {
            blocos.push(value);
            totalRecebido += value.byteLength;

            if (tamanhoTotal > 0) {
              sf.progresso = Math.min(
                100,
                Math.round(
                  (totalRecebido / tamanhoTotal) * 100
                )
              );
            }
          }
        }

        const dados = new Uint8Array(totalRecebido);
        let deslocamento = 0;

        for (const bloco of blocos) {
          dados.set(bloco, deslocamento);
          deslocamento += bloco.byteLength;
        }

        sf.progresso = 100;

        novoId = await sf.synth.loadSFont(dados.buffer);

        if (typeof novoId !== 'number' || novoId < 0) {
          throw new Error(`Falha ao carregar ${arquivo}`);
        }

        // Armazena para reutilizar nas próximas trocas.
        cache.set(arquivo, novoId);

        console.log('SoundFont carregado e armazenado em cache:', arquivo);

      } else {
        console.log('SoundFont reutilizado do cache:', arquivo);
        sf.progresso = 100;
      }

      // Atualiza o slot com o ID novo ou recuperado.
      sf.arquivo = arquivo;
      sf.soundFontId = novoId;

      if (!arquivoAnterior) {
        sf.ativo = true;
      }

      this.carregarProgramas(sf);
      this.selecionarPreset(sf);
      this.aplicarVolume(sf);

    } catch (e) {
      console.error('Erro ao trocar SoundFont:', e);

      this.erro =
        `Não foi possível carregar o SoundFont ${arquivo.split('/').pop()}.`;

      sf.arquivo = arquivoAnterior;

      // Recupera o ID anterior, se houver.
      sf.soundFontId = arquivoAnterior
        ? cache.get(arquivoAnterior) ?? null
        : null;

    } finally {
      sf.carregando = false;
      sf.progresso = 0;
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


  private atualizarModulacao(): void {
    for (const sf of this.soundfonts) {
      if (
        !sf.synth ||
        sf.soundFontId == null
      ) {
        continue;
      }

      // CC1: Modulation.
      // Zera a modulação dos timbres que a desativaram.
      const valor = sf.ativo && sf.modulacaoAtivada
        ? 127
        : 0;

      sf.synth.midiControl(
        sf.canal,
        1,
        valor
      );
    }
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
          if (!this.pronto) return;

          this.tocarNotaComVelocidade(nota, velocidade);
        },
        nota => {
          this.soltarNota(nota);
        },
        ativo => {
          this.sustainPressionado = ativo;
          this.atualizarSustain();
        },
        (controle, valor, canal) => {
          this.aoReceberControlChange(
            controle,
            valor,
            canal
          );
        },
        (valor, canal) => {
          this.aoReceberPitchBend(valor, canal);
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



  //MIDI LEARN
  iniciarMidiLearn(sf: MotorSoundFont): void {
    if (!this.pronto) {
      this.erro = 'Inicialize o áudio antes de configurar o MIDI Learn.';
      return;
    }

    this.midiLearnAlvo = sf;
    this.erro = '';

    console.log(
      `MIDI Learn ativo para: ${sf.nome}`
    );
  }

  cancelarMidiLearn(): void {
    this.midiLearnAlvo = null;
  }

  ccAssociado(sf: MotorSoundFont): number | null {
    const cc = this.midiCCPorSoundFont[sf.nome];

    return cc === undefined ? null : cc;
  }

  removerAssociacaoMidi(sf: MotorSoundFont): void {
    delete this.midiCCPorSoundFont[sf.nome];
    this.salvarAssociacoesNaCena();

    if (this.midiLearnAlvo === sf) {
      this.midiLearnAlvo = null;
    }
  }


  private aoReceberControlChange(
    controle: number,
    valor: number,
    canal: number
  ): void {
    // CC 1: Modulation
    if (controle === 1) {
      const timbresComModulacao = this.soundfonts.filter(
        sf =>
          sf.ativo &&
          sf.synth &&
          sf.soundFontId != null &&
          sf.modulacaoAtivada
      );

      // Se houver timbres com modulação ativada,
      // encaminha o CC 1 para eles.
      if (timbresComModulacao.length > 0) {
        for (const sf of timbresComModulacao) {
          sf.synth.midiControl(sf.canal, 1, valor);
        }

        // Se o MIDI Learn estiver ativo para um timbre
        // com modulação desativada, ainda permite aprender o CC.
        if (
          !this.midiLearnAlvo ||
          this.midiLearnAlvo.modulacaoAtivada
        ) {
          return;
        }
      }
    }

    // MIDI Learn: associa o CC ao timbre selecionado.
    if (this.midiLearnAlvo) {
      const sf = this.midiLearnAlvo;

      this.midiCCPorSoundFont = {
        ...this.midiCCPorSoundFont,
        [sf.nome]: controle
      };

      this.midiLearnAlvo = null;
      this.salvarAssociacoesNaCena();

      console.log(
        `MIDI Learn: ${sf.nome} associado ao CC ${controle}, canal MIDI ${canal + 1}`
      );

      this.alterarVolume(sf, Math.round(valor * 100 / 127));
      return;
    }

    // Controla o volume dos timbres associados ao CC recebido.
    for (const sf of this.soundfonts) {
      if (this.midiCCPorSoundFont[sf.nome] === controle) {
        this.alterarVolume(sf, Math.round(valor * 100 / 127));
      }
    }
  }


  private salvarAssociacoesMidi(): void {
    try {
      localStorage.setItem(
        'sf2Player.midiLearn.volume',
        JSON.stringify(this.midiCCPorSoundFont)
      );
    } catch (e) {
      console.warn(
        'Não foi possível salvar as associações MIDI.',
        e
      );
    }
  }

  private carregarAssociacoesMidi(): void {
    try {
      const dados = localStorage.getItem(
        'sf2Player.midiLearn.volume'
      );

      if (!dados) {
        return;
      }

      const associacoes = JSON.parse(dados);

      if (
        associacoes &&
        typeof associacoes === 'object' &&
        !Array.isArray(associacoes)
      ) {
        this.midiCCPorSoundFont = associacoes;
      }
    } catch (e) {
      console.warn(
        'Não foi possível carregar as associações MIDI.',
        e
      );
    }
  }

  // CENAS


  salvarCena(): void {
    const nome = this.nomeNovaCena.trim();

    if (!nome) {
      this.erro = 'Informe um nome para a cena.';
      return;
    }

    const cena: Cena = {
      nome,
      soundfonts: this.soundfonts.map(sf => ({
        arquivo: sf.arquivo,
        banco: sf.banco,
        programa: sf.programa,
        volume: sf.volume,
        ativo: sf.ativo,
        brilho: sf.brilho,
        reverb: sf.reverb,
        chorus: sf.chorus,
        cuttof: sf.cutoff,
        ressonancia: sf.ressonancia,
        pitchBendAtivado: sf.pitchBendAtivado,
        modulacaoAtivada: sf.modulacaoAtivada
      })),
      associacoesMidiVolume: {
        ...this.midiCCPorSoundFont
      }
    };

    // Se já existir uma cena com esse nome, atualiza.
    const indice = this.cenas.findIndex(
      c => c.nome.toLowerCase() === nome.toLowerCase()
    );

    if (indice >= 0) {
      this.cenas[indice] = cena;
    } else {
      this.cenas.push(cena);
    }

    this.salvarCenasNoNavegador();
    this.cenaSelecionada = nome;
    this.nomeNovaCena = '';
    this.erro = '';

    console.log(`Cena "${nome}" salva.`);
  }

  private salvarCenasNoNavegador(): void {
    try {
      localStorage.setItem(
        this.chaveCenas,
        JSON.stringify(this.cenas)
      );
    } catch (e) {
      console.error('Erro ao salvar cenas:', e);
      this.erro = 'Não foi possível salvar as cenas.';
    }
  }

  private carregarCenasSalvas(): void {
    try {
      const dados = localStorage.getItem(this.chaveCenas);

      if (!dados) {
        this.cenas = [];
        return;
      }

      const cenasSalvas = JSON.parse(dados);

      if (!Array.isArray(cenasSalvas)) {
        this.cenas = [];
        return;
      }

      this.cenas = cenasSalvas
        .filter(
          (cena: any) =>
            cena &&
            typeof cena.nome === 'string' &&
            Array.isArray(cena.soundfonts)
        )
        .map((cena: any): Cena => {
          const associacoes: { [nome: string]: number } = {};

          const originais = cena.associacoesMidiVolume;

          if (
            originais &&
            typeof originais === 'object' &&
            !Array.isArray(originais)
          ) {
            for (const nome of Object.keys(originais)) {
              const cc = originais[nome];

              if (
                Number.isInteger(cc) &&
                cc >= 0 &&
                cc <= 127
              ) {
                associacoes[nome] = cc;
              }
            }
          }

          return {
            nome: cena.nome,
            soundfonts: cena.soundfonts,
            associacoesMidiVolume: associacoes
          };
        });

    } catch (e) {
      console.error('Erro ao carregar cenas:', e);
      this.cenas = [];
    }
  }

  async carregarCena(): Promise<void> {
    const cena = this.cenas.find(
      c => c.nome === this.cenaSelecionada
    );

    if (!cena) {
      this.erro = 'Selecione uma cena válida.';
      return;
    }

    if (cena.soundfonts.length !== this.soundfonts.length) {
      this.erro =
        'Esta cena não corresponde à quantidade atual de timbres.';
      return;
    }

    this.erro = '';

    try {
      for (let i = 0; i < this.soundfonts.length; i++) {
        const sf = this.soundfonts[i];
        const configuracao = cena.soundfonts[i];

        if (
          configuracao.arquivo &&
          sf.arquivo !== configuracao.arquivo
        ) {
          await this.trocarSoundFont(
            sf,
            configuracao.arquivo
          );

          if (sf.arquivo !== configuracao.arquivo) {
            throw new Error(
              `Não foi possível carregar o timbre ${sf.nome}.`
            );
          }
        }

        sf.banco = configuracao.banco;
        sf.programa = configuracao.programa;
        sf.volume = configuracao.volume;
        sf.ativo = configuracao.ativo;
        sf.brilho = configuracao.brilho ?? 100;
        sf.reverb = configuracao.reverb ?? 0;
        sf.chorus = configuracao.chorus ?? 0;
        sf.pitchBendAtivado = configuracao.pitchBendAtivado ?? true;
        sf.modulacaoAtivada = configuracao.modulacaoAtivada ?? true;

        this.aplicarEfeitos(sf);

        this.selecionarPreset(sf);
        this.aplicarVolume(sf);
      }

      // IMPORTANTE:
      // Substitui as associações anteriores pelas desta cena.
      // Uma cena sem associações deve permanecer sem associações.
      this.midiCCPorSoundFont = {
        ...(cena.associacoesMidiVolume || {})
      };

      // Atualiza o cache local com a cena recém-carregada.
      this.salvarAssociacoesMidi();

      for (const sf of this.soundfonts) {
        if (sf.synth) {
          sf.synth.midiControl(sf.canal, 64, 0);
          sf.synth.midiAllNotesOff(sf.canal);
        }
      }

      this.motoresPorNota.clear();
      this.atualizarSustain();

      this.atualizarModulacao();

      this.erro = '';

      console.log(
        `Cena "${cena.nome}" carregada.`,
        'Associações MIDI:',
        this.midiCCPorSoundFont
      );

    } catch (e) {
      console.error('Erro ao carregar cena:', e);

      this.erro = e instanceof Error
        ? e.message
        : 'Não foi possível carregar a cena.';
    }
  }

  excluirCena(): void {
    if (!this.cenaSelecionada) {
      this.erro = 'Selecione uma cena para excluir.';
      return;
    }

    this.cenas = this.cenas.filter(
      c => c.nome !== this.cenaSelecionada
    );

    this.salvarCenasNoNavegador();
    this.cenaSelecionada = '';
    this.erro = '';
  }


  exportarCenas(): void {
    if (this.cenas.length === 0) {
      this.erro = 'Não há cenas para exportar.';
      return;
    }

    const backup = {
      aplicativo: 'sf2Player',
      versao: 1,
      dataExportacao: new Date().toISOString(),
      cenas: this.cenas,
      associacoesMidiVolume: this.midiCCPorSoundFont
    };

    const conteudo = JSON.stringify(backup, null, 2);
    const arquivo = new Blob(
      [conteudo],
      { type: 'application/json;charset=utf-8' }
    );

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement('a');

    link.href = url;
    link.download = `sf2Player-cenas-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    this.erro = '';
  }


  importarCenas(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files && input.files[0];

    if (!arquivo) {
      return;
    }

    const leitor = new FileReader();

    leitor.onload = () => {
      try {
        const conteudo = JSON.parse(
          String(leitor.result || '')
        );

        // Valida o formato do backup.
        if (
          !conteudo ||
          conteudo.aplicativo !== 'sf2Player' ||
          !Array.isArray(conteudo.cenas)
        ) {
          throw new Error(
            'O arquivo não é um backup válido do sf2Player.'
          );
        }

        // Valida associações MIDI legadas, presentes em backups antigos.
        const associacoesLegadas: { [nome: string]: number } = {};
        const associacoesAntigas = conteudo.associacoesMidiVolume;

        if (
          associacoesAntigas &&
          typeof associacoesAntigas === 'object' &&
          !Array.isArray(associacoesAntigas)
        ) {
          for (const nome of Object.keys(associacoesAntigas)) {
            const cc = associacoesAntigas[nome];

            if (
              Number.isInteger(cc) &&
              cc >= 0 &&
              cc <= 127
            ) {
              associacoesLegadas[nome] = cc;
            }
          }
        }

        // Valida e normaliza cada cena, preservando as associações individuais.
        const cenasImportadas: Cena[] = conteudo.cenas
          .filter((cena: any) =>
            cena &&
            typeof cena.nome === 'string' &&
            cena.nome.trim().length > 0 &&
            Array.isArray(cena.soundfonts) &&
            cena.soundfonts.length === this.soundfonts.length &&
            cena.soundfonts.every((sf: any) =>
              sf &&
              typeof sf.arquivo === 'string' &&
              Number.isFinite(sf.banco) &&
              Number.isFinite(sf.programa) &&
              Number.isFinite(sf.volume) &&
              typeof sf.ativo === 'boolean'
            )
          )
          .map((cena: any): Cena => {
            const associacoesCena: { [nome: string]: number } = {};
            const associacoesOriginais = cena.associacoesMidiVolume;

            if (
              associacoesOriginais &&
              typeof associacoesOriginais === 'object' &&
              !Array.isArray(associacoesOriginais)
            ) {
              for (const nome of Object.keys(associacoesOriginais)) {
                const cc = associacoesOriginais[nome];

                if (
                  Number.isInteger(cc) &&
                  cc >= 0 &&
                  cc <= 127
                ) {
                  associacoesCena[nome] = cc;
                }
              }
            } else {
              // Compatibilidade com backups antigos:
              // usa as associações globais antigas como ponto de partida.
              Object.assign(
                associacoesCena,
                associacoesLegadas
              );
            }

            return {
              nome: cena.nome.trim(),
              soundfonts: cena.soundfonts.map((sf: any) => ({
                arquivo: sf.arquivo,
                banco: sf.banco,
                programa: sf.programa,
                volume: Math.max(0, Math.min(100, sf.volume)),
                ativo: sf.ativo,
                brilho: Math.max(0, Math.min(100, sf.brilho ?? 100)),
                reverb: Math.max(0, Math.min(100, sf.reverb ?? 0)),
                chorus: Math.max(0, Math.min(100, sf.chorus ?? 0)),
                pitchBendAtivado: sf.pitchBendAtivado ?? true,
                modulacaoAtivada: sf.modulacaoAtivada ?? true
              })),
              associacoesMidiVolume: associacoesCena
            };
          });

        if (cenasImportadas.length === 0) {
          throw new Error(
            'O backup não contém cenas válidas compatíveis com os slots atuais.'
          );
        }

        // Mescla por nome: cenas com o mesmo nome são atualizadas.
        const mapa = new Map<string, Cena>();

        for (const cena of this.cenas) {
          mapa.set(cena.nome.toLowerCase(), cena);
        }

        for (const cena of cenasImportadas) {
          mapa.set(cena.nome.toLowerCase(), cena);
        }

        this.cenas = Array.from(mapa.values());

        // Persiste todas as cenas importadas.
        this.salvarCenasNoNavegador();

        // Se a cena atualmente selecionada existir, mantém as
        // associações correspondentes à configuração ativa.
        const cenaAtual = this.cenas.find(
          c => c.nome === this.cenaSelecionada
        );

        if (cenaAtual) {
          this.midiCCPorSoundFont = {
            ...cenaAtual.associacoesMidiVolume
          };

          this.salvarAssociacoesMidi();
        }

        this.erro = '';

        console.log(
          `${cenasImportadas.length} cena(s) importada(s).`
        );

      } catch (e) {
        console.error('Erro ao importar cenas:', e);

        this.erro = e instanceof Error
          ? e.message
          : 'Não foi possível importar as cenas.';
      } finally {
        // Permite importar novamente o mesmo arquivo.
        input.value = '';
      }
    };

    leitor.onerror = () => {
      this.erro = 'Não foi possível ler o arquivo selecionado.';
      input.value = '';
    };

    leitor.readAsText(arquivo);
  }

  private salvarAssociacoesNaCena(): void {
    if (!this.cenaSelecionada) {
      this.salvarAssociacoesMidi();
      return;
    }

    const indice = this.cenas.findIndex(
      c => c.nome === this.cenaSelecionada
    );

    if (indice < 0) {
      this.salvarAssociacoesMidi();
      return;
    }

    this.cenas[indice] = {
      ...this.cenas[indice],
      associacoesMidiVolume: {
        ...this.midiCCPorSoundFont
      }
    };

    this.salvarCenasNoNavegador();
    this.salvarAssociacoesMidi();
  }

  get cenasRapidas(): (Cena | null)[] {
    return Array.from(
      { length: 10 },
      (_, indice) => this.cenas[indice] || null
    );
  }

  carregarCenaRapida(cena: Cena | null): void {
    if (!cena) {
      return;
    }

    this.cenaSelecionada = cena.nome;
    this.carregarCena();
  }

  get nomeControladorMIDI(): string | null {
    return this.controladorMidi.nomeControladorConectado;
  }


  private criarEfeitosDoSlot(sf: MotorSoundFont): void {
    if (!this.context || !sf.audioNode) {
      return;
    }

    const ctx = this.context;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'allpass';
    filtro.frequency.value = sf.cutoff;
    filtro.Q.value = sf.ressonancia;

    const ganhoSeco = ctx.createGain();
    const ganhoReverb = ctx.createGain();
    const convolver = ctx.createConvolver();

    const ganhoChorus = ctx.createGain();
    const atrasoChorus = ctx.createDelay(0.05);
    const osciladorChorus = ctx.createOscillator();
    const profundidadeChorus = ctx.createGain();

    // Impulso de reverberação gerado localmente.
    // Não depende de arquivos externos.
    const duracao = 2.5;
    const tamanho = Math.floor(ctx.sampleRate * duracao);
    const impulso = ctx.createBuffer(2, tamanho, ctx.sampleRate);

    for (let canal = 0; canal < 2; canal++) {
      const dados = impulso.getChannelData(canal);

      for (let i = 0; i < tamanho; i++) {
        const decaimento = Math.pow(1 - i / tamanho, 3);
        dados[i] = (Math.random() * 2 - 1) * decaimento;
      }
    }

    convolver.buffer = impulso;

    ganhoSeco.gain.value = 1;
    ganhoReverb.gain.value = 0;
    ganhoChorus.gain.value = 0;

    atrasoChorus.delayTime.value = 0.018;
    osciladorChorus.frequency.value = 0.8;
    profundidadeChorus.gain.value = 0.003;

    // Caminho seco.
    sf.audioNode.connect(filtro);
    filtro.connect(ganhoSeco);
    ganhoSeco.connect(ctx.destination);

    // Caminho reverberado.
    filtro.connect(convolver);
    convolver.connect(ganhoReverb);
    ganhoReverb.connect(ctx.destination);

    // Chorus: sinal atrasado com atraso modulado por LFO.
    filtro.connect(atrasoChorus);
    atrasoChorus.connect(ganhoChorus);
    ganhoChorus.connect(ctx.destination);

    osciladorChorus.connect(profundidadeChorus);
    profundidadeChorus.connect(atrasoChorus.delayTime);
    osciladorChorus.start();

    sf.efeitos = {
      filtro,
      ganhoSeco,
      ganhoReverb,
      convolver,
      ganhoChorus,
      atrasoChorus,
      osciladorChorus,
      profundidadeChorus
    };

    this.aplicarEfeitos(sf);
  }

  private aplicarFiltro(sf: MotorSoundFont): void {
    const filtro = sf.efeitos.filtro;

    if (!filtro) {
      return;
    }

    const cutoff = Math.max(
      100,
      Math.min(20000, Number(sf.cutoff) || 12000)
    );

    const ressonancia = Math.max(
      0.1,
      Math.min(10, Number(sf.ressonancia) || 0.7)
    );

    filtro.frequency.setTargetAtTime(
      cutoff,
      this.context?.currentTime || 0,
      0.02
    );

    filtro.Q.setTargetAtTime(
      ressonancia,
      this.context?.currentTime || 0,
      0.02
    );
  }

  alterarCutoff(
    sf: MotorSoundFont,
    valor: number | string
  ): void {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return;
    }

    sf.cutoff = Math.max(100, Math.min(20000, numero));
    this.aplicarFiltro(sf);
  }

  alterarRessonancia(
    sf: MotorSoundFont,
    valor: number | string
  ): void {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return;
    }

    sf.ressonancia = Math.max(0.1, Math.min(10, numero));
    this.aplicarFiltro(sf);
  }


  aplicarEfeitos(sf: MotorSoundFont): void {
    const efeitos = sf.efeitos;

    if (!efeitos.filtro) {
      return;
    }

    this.aplicarFiltro(sf);

    // Reverb: -100 a +100.
    // Valores negativos reduzem o reverb externo.
    // Valores positivos aumentam o reverb externo.
    const valorReverb = Math.max(
      -100,
      Math.min(100, Number(sf.reverb) || 0)
    );

    const reverbPositivo = Math.max(0, valorReverb) / 100;
    const reverbNegativo = Math.max(0, -valorReverb) / 100;

    // Mantém o sinal direto sem atenuação.
    if (efeitos.ganhoSeco) {
      efeitos.ganhoSeco.gain.value = 1;
    }

    // Reverb externo gerado pela aplicação.
    if (efeitos.ganhoReverb) {
      efeitos.ganhoReverb.gain.value =
        reverbPositivo * 0.65;
    }

    // Chorus continua independente do reverb.
    const chorus = Math.max(
      0,
      Math.min(100, Number(sf.chorus) || 0)
    ) / 100;

    if (efeitos.ganhoChorus) {
      efeitos.ganhoChorus.gain.value = chorus * 0.35;
    }

    if (efeitos.profundidadeChorus) {
      efeitos.profundidadeChorus.gain.value = chorus * 0.006;
    }

    // Reservado para a etapa seguinte:
    // aplicar uma compensação real do reverb interno,
    // caso a API do sintetizador permita controlar seu envio.
    void reverbNegativo;
  }


  alterarBrilho(sf: MotorSoundFont, valor: number | string): void {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return;
    }

    sf.brilho = Math.max(0, Math.min(100, numero));
    this.aplicarEfeitos(sf);
  }


  alterarReverb(sf: MotorSoundFont, valor: number): void {
    sf.reverb = Math.max(-100, Math.min(100, Number(valor) || 0));
    this.aplicarEfeitos(sf);
  }


  alterarChorus(sf: MotorSoundFont, valor: number | string): void {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return;
    }

    sf.chorus = Math.max(0, Math.min(100, numero));
    this.aplicarEfeitos(sf);
  }

  private agruparSoundFonts(): void {
    const grupos = new Map<string, SoundFontOpcao[]>();

    SOUNDFONT_CATALOGO.forEach(sf => {
      if (!grupos.has(sf.categoria)) {
        grupos.set(sf.categoria, []);
      }

      grupos.get(sf.categoria)!.push(sf);
    });

    this.soundfontGrupos = Array.from(
      grupos.entries()
    ).map(([categoria, opcoes]) => ({
      categoria,
      opcoes
    }));
  }


  async alterarBuffer(bufferSize: number): Promise<void> {
    this.BUFFER_SIZE = Number(bufferSize);

    // Evita reinicializar durante outra inicialização.
    if (this.inicializando) {
      return;
    }

    // Se o áudio ainda não foi iniciado, apenas guarda o valor.
    if (!this.pronto) {
      return;
    }

    this.inicializando = true;
    this.pronto = false;

    try {
      // Encerra os sintetizadores e o AudioContext atuais.
      await this.fecharRecursos();

      // Inicializa novamente usando o buffer selecionado.
      await this.iniciarAudio(this.BUFFER_SIZE);
      console.log("Buffer atual: " + this.BUFFER_SIZE);

    } catch (e) {
      console.error('Erro ao alterar buffer:', e);
      this.erro = 'Não foi possível alterar o buffer de áudio.';
    } finally {
      this.inicializando = false;
    }
  }

  async listarControladoresMidi(): Promise<void> {
    try {
      if (!navigator.requestMIDIAccess) {
        throw new Error(
          'Seu navegador não suporta Web MIDI API.'
        );
      }

      const acessoMidi = await navigator.requestMIDIAccess();

      this.controladoresMidi = Array.from(
        acessoMidi.inputs.values()
      );

      if (this.controladoresMidi.length > 0) {
        this.controladorSelecionadoId =
          this.controladoresMidi[0].id;
      }

      this.erro = '';
    } catch (e) {
      this.erro = e instanceof Error
        ? e.message
        : 'Não foi possível listar os controladores MIDI.';
    }
  }

  anguloKnob(valor: number, minimo: number, maximo: number): string {
    const percentual = (valor - minimo) / (maximo - minimo);
    const angulo = -135 + percentual * 270;

    return `rotate(${angulo}deg)`;
  }

  private obterCacheSoundFonts(
    synth: object
  ): Map<string, number> {
    let cache = this.soundFontCache.get(synth);

    if (!cache) {
      cache = new Map<string, number>();
      this.soundFontCache.set(synth, cache);
    }

    return cache;
  }


  private aoReceberPitchBend(
    valor: number,
    canalMIDI: number
  ): void {
    if (!this.pronto) return;

    for (const sf of this.soundfonts) {
      if (
        !sf.ativo ||
        !sf.synth ||
        sf.soundFontId == null ||
        !sf.pitchBendAtivado
      ) {
        continue;
      }

      // O pitch bend usa o canal configurado para cada slot.
      // O valor MIDI recebido vai de 0 a 16383.
      sf.synth.midiPitchBend(sf.canal, valor);
    }
  }

  obterNomeSoundFont(arquivo: string): string {
    this.nomeArquivo = arquivo.split('/').pop()?.replace(/\.sf2$/i, '') ?? 'SoundFont';

    return this.nomeArquivo
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, letra => letra.toUpperCase());
  }


}
