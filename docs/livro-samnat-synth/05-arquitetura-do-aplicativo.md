# 5. Arquitetura do SamNat Synth

Agora podemos descrever o programa como um conjunto de responsabilidades. A regra principal é manter a interface responsiva sem esconder falhas do motor de áudio. A janela apresenta e recolhe intenção do usuário; o worker coordena FluidSynth; o sistema operacional e o servidor/driver de áudio entregam PCM ao hardware.

## 5.1 Três produtos relacionados

O repositório contém uma aplicação Angular e dois alvos nativos. Não são três nomes para a mesma implementação:

| Caminho | Interface | Runtime | Destino |
| --- | --- | --- | --- |
| Raiz do repositório | Angular | navegador ou Electron, conforme execução | desktop/web de desenvolvimento |
| prototipo-nativo | Qt Widgets via NodeGui | Node.js + Qode | desktop Linux x86_64 e AppImage |
| prototipo-nativo/embedded | mesma aplicação NodeGui empacotada | Buildroot Linux + Qt LinuxFB | PC x86_64 com boot direto |

A interface Angular é uma fonte para comportamento, organização visual e conceitos do domínio. O código não é convertido automaticamente para Qt. Templates, serviços Angular, CSS, APIs de navegador e áudio web precisam de implementação correspondente no alvo nativo.

## 5.2 Diagrama de componentes

~~~text
┌────────────────────────── Processo principal ──────────────────────────┐
│ Node.js + Qode                                                        │
│  ├─ QApplication / QMainWindow / widgets Qt                           │
│  ├─ estado de slots, cenas, MIDI e preferências                       │
│  ├─ enumeração de saídas ALSA e sinks PulseAudio/PipeWire              │
│  └─ Worker.postMessage() ──────────────────────────────────┐            │
└────────────────────────────────────────────────────────────┼────────────┘
                                                             ↓
┌──────────────────────────── Worker thread ────────────────────────────┐
│ audio-worker.cjs                                                      │
│  ├─ fila serializada de mensagens                                      │
│  ├─ estado dos SoundFonts, presets e notas ativas                      │
│  └─ stdin/stdout/stderr ───────────────────────────────────┐            │
└────────────────────────────────────────────────────────────┼────────────┘
                                                             ↓
                                                   FluidSynth (processo)
                                                             ↓ PCM
                         ALSA direto ou PulseAudio/PipeWire → driver → DAC
~~~

O sistema embarcado acrescenta outra corrente de inicialização: firmware → GRUB → kernel → Buildroot init → montagem de /data → script de sessão → AppRun → Qode.

## 5.3 Fronteiras e contratos

Uma fronteira útil tem entradas e saídas explícitas. No app, o contrato do worker é composto por objetos JavaScript com um campo type e dados específicos. Exemplos de pedido:

~~~js
{ type: 'note-on', source: 'keyboard', note: 60, velocity: 100 }
{ type: 'load-soundfont', channel: 0, file: '/data/.../piano.sf2', bank: 0, program: 0 }
{ type: 'volume', channel: 0, value: 75 }
~~~

Respostas importantes incluem ready, loaded, soundfont-progress, note-dispatched, audio-output-error, audio-stage e error. A UI precisa distinguir “pedido enviado” de “operação confirmada”. Um postMessage bem-sucedido significa que a mensagem foi posta na fila; não significa que FluidSynth aceitou a nota.

O estado tem dois tempos:

- **estado desejado da UI**: seleção, volume, banco e programa que o usuário quer;
- **estado confirmado do motor**: recurso que foi aberto, banco carregado, preset escolhido e saída realmente pronta.

Atualizar o rótulo antes da resposta pode deixar a interface otimista. Isso pode ser apropriado, desde que erros revertam ou expliquem a diferença.

## 5.4 Modelo de domínio

O protótipo define até oito canais/partes. Cada slot contém dados como índice de canal, arquivo SF2, banco e programa, rótulo do preset, volume e efeitos, estado de modulação, roteamento a controlador MIDI, associação MIDI Learn e indicadores de carga e disponibilidade.

Uma cena serializa uma lista ordenada desses slots. A ordem importa porque canal 1, 2 etc. é musicalmente significativa. Uma cena salva também o número de slots; isso evita que ao trocar uma cena de oito partes por outra de duas partes sobrem linhas antigas.

O modelo não deve guardar widgets Qt. Widgets são objetos nativos vinculados à janela e não são dados de domínio. Guardar somente valores simples permite escrever JSON, reconstruir UI e enviar os dados ao worker.

## 5.5 Armazenamento

No desktop, DATA_DIR deriva da pasta inicial do usuário e guarda cenas e cópias/importações de SoundFonts. No embarcado, samnat-session define HOME em /data/home; assim o mesmo caminho lógico ~/.samnat-synth persiste na partição de dados.

scenes.json é um arquivo de estado. Uma escrita direta por writeFileSync é simples, mas uma queda no meio pode deixar JSON incompleto. Em sistemas críticos, prefira gravar arquivo temporário, sincronizar e renomear atomicamente; ao evoluir o formato, inclua campo de versão e migrações.

Um caminho de SF2 salvo pode ficar inválido se o arquivo for movido. Ao carregar a cena, o app precisa validar existência, mostrar arquivo ausente e continuar sem travar. Distribuir SF2 com a imagem reduz esse problema, mas traz responsabilidade de licença e capacidade de armazenamento.

## 5.6 Separação de responsabilidades por arquivo

- src/index.js compõe janela, widgets, eventos, slots, cenas, MIDI, dispositivos e mensagens para o worker.
- src/audio-worker.cjs encapsula sessão do FluidSynth, cache dos bancos, programas, volumes, efeitos, notas, saída e recuperação após teste direto.
- src/soundfont-catalog.json e a configuração de catálogo descrevem fontes disponíveis/importáveis.
- src/icons contém ícones da aplicação.
- scripts/prepare-linux.cjs seleciona e copia runtime e fontes para staging.
- scripts/pack-linux.cjs monta AppDir e AppImage com dependências necessárias.
- embedded/ contém Buildroot external tree, kernel config, overlay, instalador e composição de imagem.

Este arranjo é um protótipo compacto: index.js ainda concentra muita lógica. Ao crescer, pode ser dividido em módulos de UI, domínio, MIDI, cenas e áudio. Faça isso preservando os contratos e escreva documentação junto com a mudança.

## 5.7 Sequência de partida

~~~text
1. criar diretórios persistentes
2. construir QApplication e janela
3. iniciar Worker de áudio
4. listar saídas de áudio
5. worker sinaliza online
6. escolher saída e solicitar abertura do FluidSynth
7. worker confirma ready ou informa erro
8. carregar cena inicial ou SF2 de fallback
9. habilitar controles dependentes de áudio pronto
~~~

Essa sequência precisa ter estados visíveis. “Inicializando áudio” sem expor etapa, timeout e detalhe do erro transforma um problema diagnosticável em espera sem informação.

## 5.8 Propriedades de uma arquitetura confiável

1. Toda mensagem assíncrona importante tem identificador quando pode haver várias operações em voo.
2. Toda operação tem resposta de sucesso ou falha.
3. O worker serializa operações que dependem umas das outras.
4. Desligar ou fechar limpa timers, portas MIDI, processos e notas ativas.
5. A interface não bloqueia enquanto espera a carga de um SF2.
6. A escolha de saída não é confundida com teste PCM direto.
7. O erro mostra a camada e o comando que falhou, sem esconder stderr útil.
8. Cenas antigas podem ser migradas para o formato atual.

## 5.9 A divergência de polifonia como estudo de manutenção

README nativo fala em 512 vozes; o arquivo de worker consultado define 256 e passa esse limite ao FluidSynth. Isso pode ter uma explicação histórica: mudança do parâmetro sem atualização do README, ou documentação feita para outra versão. A forma correta de resolver é rastrear histórico de alterações e estado produzido, decidir o valor desejado, atualizar código e documentação juntos e medir a carga musical. Até então, para descrever o estado atual, vale o argumento executado.

Uma configuração duplicada em comentário, README e código é um ponto de dívida técnica. Sempre que um valor operacional aparecer em mais de um lugar, procure centralizá-lo ou adicione uma checagem que detecte desvio.

## Exercícios

1. Desenhe uma sequência de mensagens desde um clique no botão “Carregar SF2” até a confirmação loaded.
2. Liste quais dados de um slot pertencem ao domínio e quais pertencem ao widget.
3. Explique por que o worker usa uma fila, e o que aconteceria se vários comandos FluidSynth fossem enviados sem aguardar resposta.
4. Encontre uma divergência entre documentação e código. Proponha um plano de correção verificável.
5. Simule mentalmente: saída abriu, SF2 não existe. Quais mensagens devem aparecer e quais controles devem continuar disponíveis?
