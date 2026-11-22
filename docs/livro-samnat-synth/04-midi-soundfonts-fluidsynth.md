# 4. MIDI, SoundFonts e FluidSynth

MIDI descreve eventos e controles musicais. Normalmente não transporta a gravação do som que ouvimos. Um SoundFont contém amostras e regras para que um sintetizador as use; FluidSynth interpreta o banco e converte eventos em PCM.

## 4.1 MIDI é uma linguagem de eventos

Pense no MIDI como uma partitura operacional: “pressione esta nota com esta velocidade”, “solte aquela nota”, “mude o programa”, “mova a roda de modulação”. O protocolo identifica o que aconteceu, mas o receptor escolhe o som.

É por isso que uma mesma mensagem toca piano em um instrumento, cordas em outro, e talvez silêncio em um receptor sem programa carregado. Para ouvir um timbre específico é necessário que o receptor tenha uma fonte sonora e que a mensagem seja roteada ao canal certo.

## 4.2 Mensagens essenciais

MIDI 1.0 usa mensagens de canal. O status identifica o tipo e o canal; bytes de dados carregam valores. Muitos valores convencionais têm sete bits, indo de 0 a 127.

- **Note On**: inicia uma nota, com número da nota e velocity.
- **Note Off**: termina a nota.
- **Program Change**: escolhe um programa no canal.
- **Control Change**: altera um controle identificado por número e valor.
- **Pitch Bend**: envia uma posição de bend.
- **Channel Pressure / Polyphonic Pressure**: expressa pressão após o ataque.

Uma convenção amplamente suportada representa Note Off por Note On com velocity zero. O receptor deve lidar com ambos os formatos para encerrar a nota corretamente. A especificação MIDI é a referência normativa; implementações também têm peculiaridades históricas.

### Canais e numeração

O protocolo tradicional tem 16 canais em cada porta MIDI. Documentação e telas podem mostrar canais de 1 a 16, enquanto APIs frequentemente armazenam índices de 0 a 15. O código nativo mapeia o canal recebido para slots e converte valores conforme as APIs utilizadas. Um erro de uma unidade pode mandar todos os eventos ao canal errado.

### Nota MIDI e nome da nota

Uma nota é transmitida por número inteiro. O nome “C4” ou “Dó central” depende da convenção de oitava adotada pelo aplicativo ou fabricante. Diferentes ferramentas podem dar nomes de oitava diferentes ao mesmo número MIDI. Portanto, ao depurar, compare primeiro o número da nota.

## 4.3 Conexões MIDI no Linux

No Linux, ALSA oferece portas e conexões MIDI. O sequenciador ALSA permite que aplicações criem portas e roteiem eventos. O pacote Node midi do protótipo nativo depende do backend ALSA no Linux; a presença de uma porta na interface depende de o kernel e o sistema exporem sequenciador e permissões.

O fluxo externo é:

~~~text
controlador USB
  → USB MIDI class driver
  → ALSA sequencer
  → módulo Node MIDI
  → handleMidiMessage()
  → roteamento aos slots
  → worker
  → FluidSynth
~~~

O teclado virtual evita a dependência do dispositivo USB, mas converge no mesmo tipo de comando de nota do worker. Isso permite testar síntese e interface separadamente do hardware externo.

## 4.4 Note On, Note Off e fontes simultâneas

Uma nota pressionada deve ter uma nota liberada. Se o aplicativo envia Note On e perde Note Off, a voz pode permanecer sustentada ou continuar até expirar. Pedal sustain prolonga notas que já receberam Note Off, então a lógica precisa tratar o pedal e também enviar All Sounds Off ou All Notes Off em fluxos de reset cuidadosamente.

Uma interface pode receber a mesma nota de fontes diferentes: controlador A, controlador B e teclado virtual. A representação visual da tecla precisa manter um conjunto de fontes ativas. Ao liberar uma fonte, não deve apagar o destaque se outra fonte ainda sustenta a mesma nota. Essa é uma regra de estado compartilhado, não de desenho.

## 4.5 Control Change, MIDI Learn e cena

MIDI Learn associa um controle físico a um destino da interface. Um fluxo robusto:

1. usuário ativa Learn no destino;
2. o app guarda o tipo de mensagem esperado;
3. controlador envia CC, nota ou outro evento;
4. o app registra tipo, canal e número/valor relevante;
5. a associação é persistida junto à cena;
6. eventos futuros acionam o destino.

Para evitar associação ambígua, a identidade do dispositivo também pode fazer parte da regra. Um pad pode enviar uma nota igual em dois controladores. Se a cena deve responder a qualquer porta, a origem pode ser ignorada; se há várias superfícies, guardar a origem evita disparos cruzados.

No SamNat, cenas podem ser acionadas por pads e controladores associados. Uma cena e uma parte têm conceitos diferentes: o controlador pode disparar uma cena inteira ou tocar uma parte. O roteamento deve distinguir esses caminhos e evitar que um pad usado para trocar cena também soe como nota quando isso não for desejado.

## 4.6 SoundFont 2

SoundFont 2 (SF2) é um formato de banco de instrumentos para síntese baseada em amostras. O arquivo combina dados de sample com tabelas que descrevem presets, instrumentos, zonas, faixas de nota e velocity, envelopes, filtros e moduladores.

Um banco pode incluir vários bancos e programas, presets visíveis ao músico, instrumentos internos que compõem presets, uma ou várias regiões por instrumento, limites de tecla e velocity, parâmetros de amplitude, filtro, envelope e panorâmica, e dados de amostra e loops.

Um preset não é necessariamente uma única amostra. Uma nota pode corresponder a uma região, a camadas por velocity ou a uma composição de várias regiões. Isso afeta o som, a memória e a polifonia.

## 4.7 Banco e programa

General MIDI define uma organização convencional de programas, mas SF2 pode ter mapeamentos e bancos próprios. O par banco/programa identifica a seleção no receptor. O nome mostrado no app vem da lista de presets extraída do SF2, não do nome do arquivo.

Um carregamento típico:

1. FluidSynth abre o arquivo SF2;
2. o worker consulta presets/bancos;
3. a interface popula a lista;
4. usuário escolhe banco e programa;
5. worker envia a seleção para o canal;
6. note-on usa o preset selecionado.

Se a seleção visual muda mas o worker não recebe o comando, a interface mostra um estado que diverge do motor. É importante manter uma única fonte de verdade, ou sincronizar explicitamente o estado otimista da UI com confirmação do worker.

## 4.8 FluidSynth: responsabilidades do motor

FluidSynth é uma biblioteca e aplicação de software para síntese de áudio a partir de SoundFonts. Em termos arquiteturais:

- o synth mantém estado, parâmetros e vozes;
- o SoundFont loader interpreta SF2;
- o sequencer/MIDI input pode receber eventos, conforme integração;
- o audio driver envia PCM a uma API/dispositivo;
- a shell oferece comandos interativos quando se usa o executável.

O SamNat usa a shell de FluidSynth como protocolo de controle. O worker inicia o processo, aguarda o prompt, escreve comandos e interpreta respostas. Esse protocolo é baseado em texto e requer escaping correto de caminhos com espaços e caracteres especiais. Um timeout não deve ser usado como substituto para reconhecer prompt, saída de erro e encerramento do processo.

## 4.9 Dois caminhos de áudio e o que cada teste comprova

### Teste PCM direto

O app sintetiza ou fornece um sinal simples de 440 Hz e o envia com aplay ou paplay. Se o teste funciona, há evidência de que:

- o programa conseguiu abrir a rota selecionada;
- algum processo conseguiu escrever PCM;
- a saída produziu som audível.

Isso não prova que FluidSynth abriu o mesmo dispositivo nem que qualquer SF2 está correto.

### Teste pelo FluidSynth

Este caminho exige:

~~~text
abrir driver
  → iniciar FluidSynth
  → carregar SoundFont
  → listar/selecionar preset
  → enviar Note On
  → gerar e enviar PCM
~~~

Quando o teste PCM funciona e o SF2 não, a investigação deve começar na fronteira FluidSynth: processo ativo, erro de carga do banco, preset selecionado, canal, ganho, note-on/off e driver aberto. Quando ambos falham, investigue dispositivo, formato, permissões, mixer e kernel.

## 4.10 Ganho, clipping e distorção

O ganho escala a amplitude digital. Se o sinal ultrapassa a faixa representável, ocorre clipping, percebido como distorção. Várias partes somadas também podem elevar o pico, mesmo que cada uma individualmente pareça aceitável. O ganho do synth e o volume de saída do sistema são controles em pontos diferentes da cadeia.

Um princípio de mixagem seguro:

1. comece com o ganho de cada parte moderado;
2. teste com várias notas e timbres simultâneos;
3. observe se a mistura clipa antes do mixer de saída;
4. aumente o volume de monitoração depois de preservar headroom;
5. compare em saída diferente para separar clipping digital de problema analógico.

O worker atual usa ganho mestre 1.5. Esse número é um multiplicador definido pelo motor, não um volume audível universal. A percepção depende do SoundFont, dos samples e do controle do mixer.

## 4.11 Latência e tamanho de buffer

Latência é o atraso entre gesto e som percebido. Ela inclui entrada, aplicação, fila do motor, buffer de áudio, driver, conversão e propagação. Buffers menores reduzem o atraso, mas deixam menos tempo para completar cada bloco; se o sistema atrasa, pode ocorrer underrun. Buffers maiores toleram mais variação, mas aumentam latência.

O projeto deve avaliar latência média, jitter (variação), taxa de underruns, tempo de inicialização do motor e resposta com vários slots e efeitos.

“O sistema usa pouca CPU” é uma observação insuficiente para concluir que o áudio está estável. Medidas precisam considerar a carga de áudio e a qualidade percebida.

## 4.12 Exercícios

1. Conecte um controlador e identifique em log o número da nota, canal e velocity.
2. Compare Note Off normal com Note On de velocity zero.
3. Carregue um SF2 com vários presets e registre o banco/programa de cada um.
4. Execute o teste direto de tom e o teste de nota FluidSynth; liste o que cada teste valida.
5. Toque oito partes simultâneas e experimente reduzir volumes individuais mantendo o volume mestre. Observe clipping e clareza.

## 4.13 Bytes de uma mensagem MIDI

Em MIDI 1.0 convencional, uma mensagem de canal começa com status. Os quatro bits altos identificam o comando; os quatro baixos identificam o canal de zero a quinze. Por exemplo, o status 0x90 representa Note On no canal de índice zero; 0x91 representa Note On no canal seguinte.

Uma nota típica tem status, número de nota e velocity:

~~~text
0x90  0x3C  0x64
Note On canal 1, nota 60, velocity 100
~~~

O número 60 é frequentemente chamado de C4 em algumas ferramentas, mas a designação da oitava varia. A mensagem representa o número, não o nome textual.

Pitch bend convencional usa dois bytes de dados de sete bits. O LSB contém os sete bits baixos e o MSB os sete altos:

~~~text
valor 14-bit = LSB + (MSB × 128)
centro = 8192
~~~

Ao interpretar bytes, é fácil inverter LSB/MSB e gerar uma curva que salta ou parece funcionar só para um lado. Compare o valor combinado com 8192 antes de mapear para semitons.

## 4.14 MIDI em tempo real e arquivos MIDI

Uma porta MIDI em tempo real transporta eventos enquanto o músico toca. Um arquivo Standard MIDI File armazena eventos com temporização, trilhas e metadados. O arquivo não contém necessariamente o som; ele contém instruções que um sintetizador pode tocar.

Essas duas situações compartilham mensagens musicais, mas diferem no transporte e no tempo:

- entrada ao vivo depende de chegada e resposta imediata;
- arquivo MIDI pode ser processado, reposicionado e reproduzido novamente;
- relógio MIDI e mensagens de sistema podem sincronizar equipamento;
- um arquivo pode usar nomes de instrumentos sugeridos, mas o resultado depende do banco receptor.

Um controlador conectado ao SamNat é entrada ao vivo. O app atual não é um sequenciador de arquivos MIDI; a presença da infraestrutura de MIDI não implica reprodução de .mid.

## 4.15 SF2 por dentro: preset, instrumento e zona

O SF2 é um container RIFF. A especificação organiza informação em listas de metadados, dados de amostras e tabelas de preset/instrumento. A parte de dados contém amostras; a parte de preset liga cabeçalho, zonas, generators e modulators; a parte de instrumento faz relação semelhante até as amostras.

Fluxo lógico:

~~~text
program change → preset
                 ↓ zona que combina nota/velocity
              instrumento
                 ↓ zona e generators
                sample
~~~

Uma zona pode restringir faixa de notas e velocities e ajustar parâmetros. Uma nota MIDI pode coincidir com mais de uma zona; por exemplo, duas camadas podem tocar juntas. Isso explica por que uma nota pode usar múltiplas vozes e por que o mesmo preset responde de forma diferente a velocidades distintas.

A estrutura inclui headers, bags/zonas, generators, modulators e sample headers. O motor valida relações entre essas tabelas ao carregar o banco. Um arquivo malformado pode falhar mesmo que sua extensão seja .sf2.

## 4.16 Sample, root key e loop

Uma amostra é gravada em uma altura e taxa específicas. O sample header pode definir altura original, ponto inicial/final, loop e tipo. Ao tocar outra nota, o motor altera a taxa de leitura para transpor. Transpor muito longe pode deixar o timbre artificial; por isso bancos bons usam multisamples em diferentes regiões.

Loops permitem sustentar sons usando trecho repetitivo. Um loop mal definido pode produzir clique ou pulsação. Um envelope pode reduzir a repetição perceptível. No release, o motor encerra a voz segundo parâmetros do preset.

Esses efeitos não são bugs da saída: um clique que acompanha sempre a mesma nota e preset pode vir do loop/amostra; distorção que cresce com vários canais aponta para ganho/mixagem; estalos aleatórios alinhados a carga do sistema podem indicar underrun.

## 4.17 Da velocity ao som

O motor compara velocity com zonas disponíveis. Uma região pode tocar de velocity 1 a 60, outra de 61 a 127. A passagem entre camadas pode ser abrupta ou suavizada por moduladores. Alguns SF2 também usam velocity para modificar amplitude, filtro ou envelope.

O teclado virtual envia velocity fixa para facilitar teste. Um controlador real pode variar velocity e revelar camadas que o teclado virtual não alcança. Ao comparar sons, envie uma faixa de velocity.

## 4.18 Ferramentas para inspecionar o banco

Para entender um SF2 sem alterar o código:

1. liste arquivos e tamanhos;
2. carregue-o no FluidSynth;
3. peça a lista de fontes carregadas;
4. liste presets e bancos;
5. escolha explicitamente um banco/programa;
6. toque nota baixa, média e alta em várias velocities;
7. compare RAM e volume com outro banco.

Não confie apenas no nome do arquivo. Um arquivo chamado piano pode conter um banco GM completo ou apenas presets especiais. A enumeração feita pelo worker é a lista usada pelo app; inspecionar essa saída revela o que o usuário realmente pode escolher.

## 4.19 Limites de SoundFont e licença

SF2 descreve conteúdo e regras; não determina a licença de uso do áudio. Bancos encontrados na internet podem ter restrições de redistribuição. Incluir um arquivo numa imagem USB para terceiros continua sendo distribuição.

Para cada SF2, registre autor, origem, licença, permissão de modificação/redistribuição e atribuição necessária. Se a licença não está clara, não o inclua num release público. O livro ensina a construir o sistema, mas não substitui licença de cada banco.

## 4.20 Exercícios adicionais

1. Decodifique a mensagem 0x92 0x3C 0x40 e identifique comando, canal, nota e velocity.
2. Decodifique pitch bend nos valores mínimo, central e máximo.
3. Escolha um SF2 multicamada e compare velocity 20, 60, 100 e 127.
4. Desenhe uma nota que ativa duas zonas e explique seu custo de vozes.
5. Faça uma ficha de licença para cada SF2 do seu pacote.

## 4.21 Altura musical e taxa de reprodução

Ao reproduzir a mesma amostra numa nota mais alta, o sampler aumenta sua taxa de leitura. Em temperamento igual, um semitom corresponde a uma razão de frequência de aproximadamente 2 elevado a 1/12; doze semitons dobram a frequência.

~~~text
razão para n semitons = 2^(n / 12)
uma oitava acima = 2
uma oitava abaixo = 1/2
~~~

Alterar velocidade altera duração aparente da amostra e sua envoltória espectral. Isso explica por que tocar uma amostra de piano muito longe da nota original pode mudar ataque e caráter. Multisamples distribuem amostras originais por regiões para reduzir a transposição.

## 4.22 Nyquist, aliasing e interpolação

Uma representação digital só consegue representar frequências abaixo de metade da taxa de amostragem, chamada frequência de Nyquist. Conteúdo acima desse limite pode refletir para frequências falsas, fenômeno chamado aliasing. Sistemas de gravação usam filtros; samplers precisam escolher amostras e interpolação apropriadas ao reproduzir em outras alturas.

A interpolação estima valores entre pontos amostrados. Interpolação simples custa pouco, mas pode soar áspera; métodos mais elaborados reduzem artefatos e usam mais CPU. A qualidade final depende também do sample original, taxa do motor e filtragem.

Para um sampler, a taxa de saída permanece fixa, mas a taxa efetiva de leitura da amostra varia conforme a altura. O processamento por voz pode incluir interpolação, envelope, filtro, modulação e mistura. Um limite baixo de CPU em silêncio não mede o custo de várias notas agudas simultâneas.

## 4.23 Headroom e decibéis

Amplitude digital é linear; percepção e níveis de áudio são frequentemente expressos em decibéis. Para amplitude relativa A:

~~~text
nivel_dB = 20 × log10(A)
~~~

Um multiplicador de 1,5 equivale aproximadamente a +3,52 dB antes de considerar clipping. Isso não significa que qualquer preset ficará mais alto na mesma proporção percebida: samples têm níveis e envelopes diferentes.

Se oito partes tocam ao mesmo tempo, picos podem se somar. Sinais perfeitamente correlacionados podem somar mais que sinais sem correlação. A proteção é preservar headroom por canal e monitorar o pico do master. Diminuir cada slider pode limpar a distorção sem alterar o volume físico do amplificador.

## 4.24 Dois sentidos de “carregar memória”

Na interface, um indicador percentual de carga do timbre pode referir-se ao progresso da operação de abertura ou a uma estimativa de memória residente. São medições diferentes:

- progresso de carga descreve quanto da operação foi concluído;
- uso de memória descreve páginas atribuídas/residentes;
- bytes do SF2 descrevem tamanho em disco;
- número de vozes descreve instâncias de reprodução ativas.

Um indicador de progresso não deve ser rotulado “percentual de RAM” sem medir memória disponível e atribuível. Para mostrar consumo de memória real, o app precisa estimar RSS/PSS do processo e definir o denominador, por exemplo RAM total ou limite de memória do sistema.

## 4.25 Tabelas de instrumentos e General MIDI

General MIDI define uma convenção de programas e bateria para interoperabilidade. A mensagem Program Change contém um número, mas o banco do receptor decide que som esse número identifica. Um SF2 pode ter nomes e presets fora do mapa GM, ou posicionar sons em bancos adicionais.

Por isso o SamNat lê presets do arquivo e apresenta banco/programa reais. Usar apenas um catálogo textual “piano = program 0” falha em bancos não-GM. O usuário pode comparar nome do preset, banco, programa e canal MIDI para identificar seleção.

## 4.26 Exercícios adicionais

1. Calcule a razão de reprodução para 7 semitons acima e 5 abaixo.
2. Estime a frequência de Nyquist de um motor a 44,1 kHz e explique por que ela não é a taxa de áudio completa.
3. Calcule o ganho em dB para multiplicadores 0,5, 1 e 1,5.
4. Compare tamanho em disco de um SF2, RSS do processo e número de vozes.
5. Teste um banco GM e um banco não-GM; compare a lista de programas.

## Leituras oficiais

- [MIDI Association: especificações MIDI](https://midi.org/specs)
- [FluidSynth: documentação](https://www.fluidsynth.org/documentation/)
- [FluidSynth: API do sintetizador](https://www.fluidsynth.org/wiki/api/synth/)
- [FluidSynth: manual de comandos](https://www.fluidsynth.org/api/group__shell__commands.html)
- [SoundFont 2.04: especificação técnica](https://www.synthfont.com/sfspec24.pdf)
