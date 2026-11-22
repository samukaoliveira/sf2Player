# 8. Motor de áudio e comunicação com FluidSynth

O worker de áudio concentra o controle do FluidSynth para que a interface possa continuar atendendo eventos. Este capítulo acompanha o caminho do processo, abertura do dispositivo, carregamento de bancos, notas, testes e fechamento.

## 8.1 Por que um processo separado para FluidSynth

O código usa um worker_threads para separar a coordenação de áudio da interface. Dentro dele, child_process.spawn cria o executável fluidsynth com entrada, saída e erro padrão conectados por pipes.

Essa estrutura oferece:

- o loop Qt/Node principal continua atendendo janela e controles;
- mensagens de áudio não são misturadas ao estado visual;
- encerramento e reinício do motor podem ser centralizados;
- stdout e stderr podem ser examinados e apresentados;
- uma falha no processo externo não precisa congelar a janela.

Há três contextos distintos: thread principal, worker e processo filho. process.chdir não é permitido no worker_threads do Node, o que já foi uma falha real no empacotamento quando o preload do Qode herdava para o worker. O código evita herdar NODE_OPTIONS e executa o worker com execArgv vazio.

## 8.2 Fila serial de comandos

Uma conversa de shell é um protocolo: enviar comando, receber saída até o prompt e então prosseguir. Se dois comandos forem escritos simultaneamente, suas respostas podem se misturar. O worker mantém messageQueue como uma cadeia de Promises; cada mensagem é atendida depois da anterior.

~~~text
mensagem A → comando SF2 → espera prompt → resposta A
mensagem B → só começa após A → comando volume → resposta B
~~~

Essa ordem evita que o worker selecione um preset antes de terminar a carga do arquivo. A fila também cria um limite de throughput: operações longas, como listar presets de um SF2 grande, atrasam comandos posteriores. O progresso deve ser exposto e tarefas não relacionadas precisam evitar dependências desnecessárias.

## 8.3 Reconhecimento do prompt e timeout

O processo comunica-se pela saída padrão. O worker reconhece o prompt da shell para resolver o comando pendente. O timeout de cada operação gera erro com o comando, saída capturada e stderr recente.

Timeout é uma proteção contra espera infinita; não corrige a causa. Diagnóstico deve distinguir:

- processo não iniciou;
- shell não apresentou prompt;
- dispositivo falhou ao abrir;
- comando aceito, mas operação demorada;
- saída foi truncada ou formato do prompt mudou;
- processo terminou antes de responder.

Ao atualizar FluidSynth, valide prompt, argumentos, comandos shell e texto dos erros. Um parser baseado em saída humana pode quebrar entre versões; a API C ou um protocolo estruturado seria alternativa se essa fragilidade se tornar um problema real.

## 8.4 Abrir o motor

O worker monta argumentos a partir da saída:

- ALSA: driver alsa e dispositivo selecionado;
- PulseAudio/PipeWire: driver pulseaudio e sink escolhido;
- taxa configurada: 44.100 Hz;
- ganho mestre atual: 1.5;
- efeitos globais iniciam desabilitados;
- limite de vozes atual no código: 256.

O flag sem driver MIDI externo deixa a aplicação enviar comandos pelo protocolo controlado, em vez de criar outra rota de entrada que duplica eventos. A shell inicia o processo e o worker espera o prompt, verifica mensagens de falha e só então envia ready.

Pronto significa que o worker concluiu a fase de abertura. Não significa que um SoundFont está carregado ou que um preset produz som. A UI pede um SF2 após a saída estar pronta.

## 8.5 Selecionar uma nova saída

Trocar dispositivo requer interromper o FluidSynth que mantém a saída aberta. O worker salva as atribuições de canal, encerra o processo, limpa caches de IDs que pertenciam a essa instância, abre a nova saída e recarrega os bancos e programas.

Os IDs de SoundFont são locais ao processo atual. Guardar um ID entre reinícios é incorreto; por isso o app mantém também o caminho, banco e programa necessários para reconstruir o estado.

Se abertura da nova saída falha, o worker devolve erro. O estado desejado e o estado realmente ativo podem divergir. A interface deve mostrar qual saída está aberta e qual solicitação falhou.

## 8.6 Carregar um SoundFont

Para cada caminho SF2:

1. resolver caminho absoluto;
2. procurar o banco no cache do worker;
3. se novo, carregar no FluidSynth;
4. extrair ID de runtime;
5. listar instrumentos/presets;
6. interpretar banco, programa e nome;
7. escolher programa solicitado ou fallback;
8. enviar seleção ao canal;
9. restaurar volume e modulação daquele canal;
10. emitir loaded com dados e fallback.

O cache por caminho reduz carga duplicada quando o mesmo SF2 é usado em várias partes. Isso é diferente de um SoundFont por canal: um único banco pode atender vários canais, cada qual com preset próprio.

Uma falha de arquivo deve gerar resposta error. O botão de nota de teste do slot deve permanecer desabilitado até o motor confirmar carga.

## 8.7 Notas e roteamento

Para note-on, o worker calcula a lista de canais a partir da origem e do roteamento explícito. Teclado virtual e MIDI em modo layer podem disparar todas as partes carregadas; rota específica envia para canais escolhidos. O worker registra em que canais cada nota começou.

Para note-off, o worker consulta essa associação e solta os mesmos canais. Assim, mudar o roteamento enquanto uma nota está sustentada não deixa a voz presa.

O evento note-dispatched confirma que comandos MIDI foram enviados à shell. Ele ainda não mede o sinal de saída analógico. Para certeza maior, pode-se acrescentar medição de amplitude do PCM ou loopback de captura, mas isso aumenta dependências e complexidade.

## 8.8 Controles e efeitos

O worker envia CC7 para volume, CC1 para modulação e CC64 para sustain. Reverb e chorus são enviados tanto como controles por canal quanto nos toggles globais do FluidSynth. A política atual começa com efeitos desativados e permite habilitar valores por parte.

Pitch bend é limitado ao intervalo 0–16383 antes de enviado. O valor central é 8192. O controlador pode ter resolução e curva particulares; ao depurar direção, verifique montagem dos dois bytes e o sentido informado pelo dispositivo.

## 8.9 Teste de áudio sem FluidSynth

O teste direto gera um buffer PCM senoidal de 440 Hz, com fades curtos e taxa 44.100 Hz, e o envia para aplay ou paplay. Isso isola o caminho de saída de SF2 e MIDI.

Se FluidSynth estiver rodando, o teste pede ao worker que o pare para liberar o dispositivo exclusivo. Quando o tom termina, o app inicia FluidSynth novamente e recarrega os SoundFonts e programas. Por isso um teste pode demorar mais que a duração do tom: há a fase de restauração.

Esse desenho evita duas aplicações disputarem um PCM ALSA direto. Em áudio servido por PipeWire/PulseAudio, múltiplos clientes podem coexistir, mas o ciclo de pausar/restaurar mantém comportamento uniforme e evita inconsistências em saídas diretas.

## 8.10 Encerramento e limpeza

Ao sair, o processo principal pede close, cancela timers e desconecta portas MIDI. O worker pede quit à shell, espera o processo terminar, e força encerramento se ele não responder. Toda saída anormal precisa limpar estado para que a próxima partida não reutilize handles inválidos.

Ao limpar uma cena, o worker manda controles de reset, desativa efeitos, lista SoundFonts e descarrega seus IDs. Em seguida esvazia mapas e confirma cleared. A UI só reconstrói a cena depois dessa confirmação. Isso evita sobreposição de timbres de cenas anteriores.

## 8.11 Melhorias para uma versão de produto

Estas são opções de engenharia, não requisitos do protótipo atual:

- protocolo estruturado entre app e motor em vez de parser de prompt;
- telemetria de underrun e uso de vozes;
- teste de loopback para verificar áudio realmente produzido;
- limites de tamanho e validação de arquivos SF2;
- gravação atômica de cenas;
- contador de timeout por operação, com política de cancelamento;
- escolha de sample rate e buffer testada por hardware;
- ensaio de carga com oito partes, sustain e notas longas.

## 8.12 Exercícios

1. Acompanhe no log cada etapa da abertura de FluidSynth e marque onde ready é emitido.
2. Inicie um SF2 inválido e liste a diferença entre erro de processo, erro de saída e erro de carregamento.
3. Carregue o mesmo arquivo em dois canais e descubra se o worker mantém uma ou duas cargas.
4. Troque saída de áudio e explique por que o motor precisa ser reiniciado.
5. Compare o teste PCM direto com a confirmação note-dispatched. O que cada um prova e deixa sem provar?

## Referências

- [FluidSynth: documentação](https://www.fluidsynth.org/documentation/)
- [FluidSynth: API do sintetizador](https://www.fluidsynth.org/wiki/api/synth/)
- [ALSA: documentação de kernel](https://docs.kernel.org/6.1/sound/alsa-configuration.html)
