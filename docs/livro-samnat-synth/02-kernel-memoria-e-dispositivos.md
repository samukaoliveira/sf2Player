# 2. Kernel, memória e dispositivos

Este capítulo aprofunda quatro ideias que aparecem continuamente ao empacotar um aplicativo musical: processo, thread, memória virtual e driver. Não é necessário escrever um kernel para montar o SamNat, mas é necessário entender o que o kernel promete a cada camada e o que ele não promete.

## 2.1 Processo: um programa em execução

Um arquivo executável no disco não é, por si só, um processo. O kernel cria um processo quando carrega o código, prepara o espaço de endereçamento e inicia sua execução. O processo recebe identificador (PID), credenciais, descritores de arquivos e outros atributos.

No modo nativo, o processo principal contém Node.js, Qode, NodeGui e o código de interface. O FluidSynth é iniciado como processo filho. Um worker JavaScript separado mantém a lógica de áudio e controla esse processo filho. Portanto, “o app” é um conjunto de processos e threads cooperantes, e não uma única função.

~~~text
processo samnat (Qode + Node.js + Qt)
  ├── thread principal de eventos
  ├── worker_threads: áudio e protocolo do FluidSynth
  └── processo filho: fluidsynth
~~~

O modelo não representa todas as threads internas de Qt, Node.js ou FluidSynth. Ele mostra as fronteiras explícitas criadas pelo aplicativo.

## 2.2 Threads e concorrência

Uma thread é uma sequência de execução dentro de um processo. Threads do mesmo processo compartilham boa parte da memória, mas possuem estado de execução próprio, como pilha e registradores. Compartilhar memória facilita comunicação e também cria riscos de concorrência.

Qt depende de um loop de eventos para entregar cliques, timers, sinais e respostas de widgets. Node.js também depende de um loop de eventos para callbacks e I/O. O Qode coordena a integração do Node com Qt; chamar diretamente um loop de aplicação incompatível pode impedir que eventos de uma das partes sejam processados.

Por que há um worker de áudio? Ler saída de processo, serializar comandos, aguardar FluidSynth iniciar e reagir a mensagens são operações que não devem congelar o loop que precisa redesenhar a interface. A separação melhora a capacidade de resposta. Ela não cria uma placa de áudio nova nem garante baixa latência por si só.

No worker, as mensagens são tratadas por parentPort. O processo principal usa worker.postMessage(...); o worker devolve eventos como ready, audio-stage, soundfont-progress, note-dispatched e error. Essa é uma fila de mensagens. Objetos são clonados na fronteira, então é mais seguro enviar dados simples do que widgets ou objetos nativos Qt.

## 2.3 Escalonamento: quem recebe CPU

O escalonador do kernel decide qual thread executa em cada CPU lógica. Ele considera prioridade, estado de bloqueio, afinidade e política. Uma thread que aguarda dados do FluidSynth pode dormir sem ocupar CPU; uma thread em loop pode consumir um núcleo inteiro.

O uso baixo de CPU observado não prova que a síntese está corretamente roteada, nem que um equipamento mais lento terá desempenho suficiente. A medição depende de:

- quantas notas e vozes estão realmente ativas;
- frequência e tamanho do buffer de áudio;
- qualidade/interpolação configurada no FluidSynth;
- número de SoundFonts e camadas de amostra acionadas;
- custo de efeitos;
- arquitetura e frequência efetiva da CPU;
- servidor de áudio, driver e carga do restante do sistema.

Uma medição útil compara a mesma passagem, mesma taxa de amostragem, mesmos parâmetros e mesmo hardware. Uma única leitura do monitor não caracteriza uma carga musical.

## 2.4 Memória virtual

Cada processo vê um espaço de endereçamento virtual. O kernel mantém tabelas de páginas que relacionam endereços virtuais a páginas físicas, arquivo mapeado ou páginas ainda não residentes. O processo acredita trabalhar em endereços contínuos; fisicamente, os dados podem estar distribuídos.

Há pelo menos três grandezas importantes:

- **VSZ/VIRT**: espaço virtual reservado ou mapeado; pode incluir regiões que não ocupam RAM física.
- **RSS/RES**: páginas residentes na RAM neste momento.
- **PSS**: estimativa proporcional da memória compartilhada entre processos, útil para atribuir custo compartilhado.

Por isso um SF2 de 500 MB no disco não implica automaticamente 500 MB imediatamente residentes. O carregador pode ler e mapear dados sob demanda, manter estruturas auxiliares, compartilhar páginas ou carregar amostras conforme necessário. O uso real depende do modo de leitura do FluidSynth e dos bancos.

### Capacidade das amostras

Uma estimativa grosseira de PCM não comprimido é:

~~~text
bytes = segundos × amostras por segundo × canais × bytes por amostra
~~~

Exemplo: 30 segundos mono, 44.100 amostras/s e amostras de 16 bits:

~~~text
30 × 44.100 × 1 × 2 = 2.646.000 bytes
~~~

Um SoundFont usa amostras e metadados organizados em regiões e presets, não uma faixa PCM única. O cálculo apenas ensina por que bancos e vozes podem consumir memória significativa.

## 2.5 Pressão de memória e swap

Quando a RAM fica disputada, o kernel pode descartar páginas de cache, gravar páginas anônimas em swap ou ativar mecanismos de recuperação de memória. Em áudio ao vivo, paginação intensa pode aumentar variação de tempo e falhas audíveis. Porém, estalos não são sinônimo automático de pouca RAM: underrun também pode vir de buffer pequeno, thread bloqueada, prioridade inadequada ou dispositivo ocupado.

A configuração do sistema deve ser medida em condições reais. Diminuir a polifonia reduz o número máximo de vozes e pode reduzir CPU e memória; também pode cortar notas. A polifonia é um limite global do FluidSynth, não uma promessa de que cada parte tem essa quantidade. Na versão atual consultada, o worker define 256 vozes globais, ainda que um texto README do protótipo descreva 512. Ao reproduzir, confira o valor synth.polyphony usado no comando do FluidSynth.

## 2.6 Dispositivos e /dev

Em Linux, vários dispositivos são apresentados como arquivos especiais em /dev. Um dispositivo de caractere transfere fluxos de dados por operações apropriadas ao driver. O diretório /dev/snd contém nós de áudio e MIDI criados conforme o kernel detecta hardware.

O sistema pode ter dispositivos PCM de reprodução (sufixo p) e captura (sufixo c), controles de mixer, o sequenciador ALSA em /dev/snd/seq e aliases em /dev/snd/by-path.

O nome card0 não é uma identidade estável para todos os boots; a ordem pode mudar conforme o hardware aparece. Um app pode listar o que aplay -l encontrou, mas a saída precisa ainda estar aberta e utilizável pelo driver no momento da reprodução.

/dev/dri e /dev/fb0 são caminhos distintos. DRM/KMS normalmente expõe nós em /dev/dri; framebuffer clássico pode expor /dev/fb0. A ausência de um desses caminhos não prova sozinha que o vídeo esteja ausente. Inspecione boot log, sysfs, configuração do kernel e plugin Qt usado.

## 2.7 Descoberta e hotplug

USB pode ser conectado depois do boot. O controlador USB e o kernel detectam a conexão, leem descritores e carregam o driver adequado. Eventos de dispositivo podem ser anunciados a udev ou sistema equivalente. Uma aplicação que enumera dispositivos apenas uma vez ao iniciar não percebe o novo dispositivo até atualizar a lista.

Existem estratégias de descoberta:

1. **Polling**: consultar periodicamente a lista. Simples e robusto; consome algum trabalho e pode demorar até um intervalo para reagir.
2. **Eventos do sistema**: observar eventos udev ou APIs específicas. Resposta rápida, exige integração e tratamento de eventos perdidos.
3. **Reenumeração sob demanda**: atualizar quando o usuário pede. Adequado como recurso de manutenção, não como hotplug automático.

O SamNat nativo busca entradas MIDI periodicamente e reconecta quando uma porta aparece. O ponteiro embarcado usa ferramentas C, libinput e udev para incorporar mouse e touchpad presentes ou conectados posteriormente. São dois caminhos diferentes: MIDI aparece pelo sequenciador ALSA; mouse aparece no subsistema de entrada.

## 2.8 Driver de áudio e dispositivo ocupado

Uma mensagem como “Device or resource busy” indica que a tentativa de abrir determinado dispositivo falhou porque ele está ocupado ou não aceita aquele modo de acesso. Isso não significa necessariamente que toda saída de áudio está globalmente bloqueada.

Possíveis causas:

- outro processo abriu diretamente o PCM;
- a saída está sendo administrada por PulseAudio/PipeWire, e uma abertura ALSA direta usa o dispositivo errado;
- o nome ALSA aponta para um dispositivo inexistente ou um alias;
- formato, canais ou taxa não suportados;
- permissão, mixer mutado ou perfil de áudio incorreto;
- o teste e o worker tentam usar o mesmo hardware ao mesmo tempo.

É por isso que o teste direto e o teste via FluidSynth são separados. O tom PCM direto testa uma rota simples. FluidSynth requer adicionalmente iniciar o motor, carregar SF2, selecionar banco/programa, receber nota e gerar PCM.

## 2.9 Comandos de observação

Comandos de leitura úteis em um Linux convencional:

~~~sh
uname -a
cat /proc/cmdline
lsblk -f
findmnt
free -h
ps -eo pid,tid,comm,%cpu,%mem,rss,vsz
cat /proc/asound/cards
aplay -l
ls -l /dev/snd
dmesg | tail -n 100
~~~

Em uma imagem mínima alguns desses utilitários podem não estar instalados. Isso é uma escolha de tamanho e manutenção, não uma propriedade do kernel. Uma imagem de desenvolvimento costuma incluir mais ferramentas que uma imagem final.

## 2.10 Exercícios

1. Encontre o processo do aplicativo, o worker e o FluidSynth. Diferencie PID de thread ID.
2. Compare VIRT e RES enquanto abre um SF2. Explique por que os valores não precisam ser iguais ao tamanho do arquivo.
3. Desconecte e reconecte um dispositivo USB MIDI; registre em que etapa ele reaparece.
4. Compare saída ALSA direta com saída via servidor de áudio e descreva quem possui o PCM.
5. Leia a documentação de memória virtual do kernel e explique o que uma page fault significa. Uma page fault não é necessariamente um erro fatal.

## 2.11 Memória virtual, página por página

Um processo usa endereços virtuais. Em sistemas x86_64, esses endereços são traduzidos por hardware usando tabelas mantidas pelo kernel. A unidade básica comum é uma página, geralmente de alguns quilobytes. O tamanho exato pode variar por arquitetura e configuração.

O espaço virtual pode conter páginas privadas com heap e pilha; segmento de código e dados do executável; regiões de bibliotecas compartilhadas; arquivos mapeados em memória; regiões reservadas sem página física associada ainda; e memória compartilhada entre processos.

Uma page fault ocorre quando o acesso não pode ser resolvido diretamente pela tabela atual. Pode ser normal: o kernel carrega do arquivo a página que faltava, aloca memória sob demanda ou faz copy-on-write. É fatal quando o endereço ou permissão é inválido e o processo não consegue tratar a falha.

### Alocação sob demanda

Pedir memória com malloc ou criar um objeto JavaScript nem sempre implica que todas as páginas físicas sejam tocadas no mesmo instante. O runtime pode reservar um intervalo e o kernel entregar páginas conforme o programa escreve nelas.

Um SF2 também pode ser lido ou mapeado de modo que algumas páginas sejam carregadas quando usadas. Portanto, há três números diferentes:

1. tamanho do arquivo no disco;
2. quantidade de memória virtual atribuída ao processo;
3. quantidade residente e efetivamente acessada na RAM.

Ferramentas como du, ls -l, pmap, /proc/PID/status e smaps_rollup observam aspectos diferentes. Para estimar impacto, compare RES/PSS antes e depois, espere o carregamento concluir, toque o preset e repita a medição.

### Heap, stack e buffers

O heap contém objetos e alocações dinâmicas. JavaScript cria objetos para mensagens, listas de portas, cenas e widgets. A stack contém chamadas ativas e variáveis locais. Um buffer de áudio é uma região de memória com amostras já calculadas ou a calcular.

As regras de lifetime são importantes:

- objeto JavaScript pode ser coletado pelo garbage collector quando não há referências;
- widget Qt tem ciclo de vida nativo e relação pai/filho;
- Buffer enviado a subprocesso permanece relevante até a escrita terminar;
- ponteiro C tem propriedade e validade definidas pelo código C/C++.

Misturar esses modelos pode causar vazamentos, uso após liberação ou atualização de widget já destruído. A API NodeGui faz wrappers, mas não elimina a necessidade de compreender ownership.

## 2.12 Cache de CPU e memória compartilhada

O processador possui caches que reduzem o custo de acessar RAM. A localidade espacial e temporal favorece dados próximos ou reutilizados. Um algoritmo DSP com buffers contíguos pode usar cache melhor que uma estrutura espalhada por muitos objetos.

Memória compartilhada pode ser mapeada por mais de um processo; cada um vê seus próprios endereços virtuais. Páginas compartilhadas devem ser contadas proporcionalmente ao comparar uso por processo. Somar RSS de todos pode contar a mesma biblioteca Qt repetidamente.

O FluidSynth e a aplicação compartilham bibliotecas carregadas em cada processo; o sistema também mantém páginas de arquivos em cache. A leitura de um SF2 pode preencher page cache, que não é uma perda permanente de RAM: o kernel pode descartá-lo quando a memória for necessária.

## 2.13 OOM e política de memória

Se o sistema não consegue obter memória, o kernel pode invocar o OOM killer e encerrar um processo para recuperar recursos. Antes disso, aplicações podem alocar lentamente, travar ou fazer swap. Em uma imagem mínima, a política de swap depende da configuração; armazenamento USB é lento e não deve ser tratado como expansão equivalente à RAM.

Como projetar para este caso:

- limitar quantidade de SF2 simultâneos se hardware for pequeno;
- liberar bancos não usados;
- evitar duplicar buffers grandes;
- usar leitura progressiva quando o motor permitir;
- oferecer mensagem clara se a carga falhar;
- medir com o maior banco e a maior cena previstos.

O limite de oito partes é um limite de organização, não garantia de que qualquer combinação de oito SF2 caiba em toda máquina.

## 2.14 Escalonamento e latência

O escalonador escolhe uma thread executável para ocupar cada CPU. Uma thread pode estar executável e esperando CPU, executando, bloqueada esperando I/O ou sincronização, parada ou terminada.

A interface pode responder rapidamente mesmo quando o motor está bloqueado, porque está em outro fluxo. Porém, se a fila serial do worker aguarda uma operação de carga longa, comandos de nota enviados atrás dela esperam. A ordem de mensagens, tamanho da fila e duração de comandos fazem parte da experiência de toque.

### Prioridade e inversão

Prioridade alta não é um botão mágico. Se uma thread prioritária espera um mutex mantido por uma thread de baixa prioridade, pode haver inversão de prioridade. Uma aplicação pode ainda disputar CPU com kernel, rede, UI e serviços. Ajustar prioridade exige medir e entender a política em uso.

Em sistemas Linux preparados para baixa latência, configurações de kernel, permissões de realtime, limites de memória e prioridade de áudio podem ser necessários. A imagem atual usa kernel preemptivo dinâmico, mas isso não deve ser descrito como certificação de áudio realtime.

## 2.15 Buffers, deadlines e underrun

O motor calcula blocos de amostras. Se a saída consome os blocos mais rápido do que o processo os produz, ocorre underrun: o hardware não tem amostras novas a tempo. Um buffer pequeno diminui latência mas deixa um prazo curto; um buffer grande tolera pausas mais longas mas aumenta atraso.

Exemplo conceitual: a 44.100 quadros/s, um bloco de 256 quadros dura aproximadamente:

~~~text
256 / 44.100 ≈ 0,0058 s = 5,8 ms
~~~

Isso não é a latência total do sistema. É apenas a duração de um bloco. Podem existir vários buffers em fila, além do atraso de dispositivo, aplicação e conversão.

Estalos podem significar underrun, mas uma distorção contínua e áspera pode ser clipping digital ou saturação analógica. Diagnóstico deve observar mensagem do backend, forma de onda e comportamento ao reduzir ganho.

## 2.16 Kernel, driver e dispositivo de áudio

Um driver de áudio registra interfaces no kernel. ALSA expõe PCM playback/capture, controles e MIDI. A biblioteca libasound permite a programas abrir esses dispositivos e negociar taxa, canais, formato e buffers.

Quando o app seleciona plughw, a camada plug pode converter formato, taxa ou canais para o hardware. Um endpoint hw direto tenta abrir o dispositivo sem essa camada. O alias default pode passar por configuração ALSA, PulseAudio ou PipeWire e seu significado varia por sistema.

PulseAudio e PipeWire são servidores de áudio em espaço de usuário. Eles apresentam sinks e sources, podem misturar clientes e aplicar roteamento. Um cliente ALSA via plugin Pulse pode falar com esse servidor. Uma abertura ALSA direta pode contornar o servidor e disputar o dispositivo com ele.

O seletor do SamNat lista dispositivos ALSA detectados por aplay e sinks Pulse/PipeWire por pactl. Uma lista representa os endpoints descobertos no momento; não prova que o caminho abra, que o mixer tenha volume ou que o cabo/alto-falante esteja ativo.

## 2.17 Ciclo do PCM

O caminho de saída típico:

~~~text
FluidSynth gera float ou PCM interno
 → cliente converte para formato negociado
 → ALSA/Pulse recebe buffers
 → driver agenda transferências
 → controlador/DMA alimenta codec
 → DAC converte para tensão
 → amplificador conduz fone ou alto-falante
~~~

Cada etapa pode mudar amplitude, taxa, canais ou temporização. Um dispositivo HDMI pode abrir e enviar áudio ao monitor, enquanto os alto-falantes internos continuam silenciosos. Um mixer ALSA pode mutar alto-falantes mesmo quando o app reporta sucesso.

## 2.18 Sistemas de entrada em Linux

MIDI e mouse não compartilham a mesma API final:

- MIDI usa portas ALSA raw/sequencer e eventos musicais;
- mouse e touchpad usam Linux input event, evdev e libinput;
- Qt LinuxFB pode consumir eventos evdev de teclado e ponteiro;
- samnat-pointer pode criar um dispositivo virtual via uinput.

Hotplug também tem camadas. Kernel reconhece USB; udev mantém nomes e regras; libinput descobre hardware de apontamento; o app recebe movimento do dispositivo virtual. Se o mouse aparece depois no kernel mas o ponteiro para, a falha está depois da enumeração USB.

## 2.19 File descriptors e pipes

Um file descriptor é um número local ao processo que referencia arquivo, socket, pipe ou dispositivo. O worker conecta stdin/stdout/stderr do FluidSynth por pipes. Cada pipe tem buffer limitado. Se o processo escreve mais rápido do que o worker lê, pode bloquear; se o leitor morre, o escritor pode receber EPIPE.

O teste direto cria aplay ou paplay com stdin ligado ao pipe e envia bytes PCM. O handler de erro no stream evita que EPIPE encerre o processo da UI; o código ainda precisa capturar stderr e terminar o teste com estado claro.

## 2.20 Exercícios de aprofundamento

1. Leia /proc/PID/status antes e depois de carregar um SF2 e explique VmSize, VmRSS e Threads.
2. Calcule duração de buffers de 128, 256 e 1024 quadros a 44,1 kHz. Explique a troca entre latência e tolerância a atraso.
3. Desenhe o caminho de um PCM ALSA direto e o de um sink PipeWire.
4. Simule uma falha de processo filho que fecha stdin e relacione o evento a EPIPE.
5. Diferencie page cache, heap e buffer de áudio.
6. Explique por que RSS de processos diferentes pode contar as mesmas páginas.
7. Identifique os nós de dispositivo de saída, captura, controle e sequencer numa listagem real de /dev/snd.

## 2.21 Modo usuário, modo kernel e interrupções

Processadores oferecem níveis de privilégio. O kernel executa com permissões que permitem configurar memória e dispositivos; um processo comum não. Para pedir uma operação privilegiada, a biblioteca faz uma chamada de sistema que muda o contexto de execução. O kernel verifica argumentos, credenciais e estado do dispositivo, executa ou agenda trabalho, e devolve código de retorno.

Dispositivos podem interromper a CPU quando uma transferência termina ou um evento chega. O trabalho dentro da interrupção deve ser curto; processamento mais longo pode ser adiado. Drivers modernos coordenam interrupções, filas e DMA. A aplicação normalmente não recebe a interrupção bruta: recebe bytes já interpretados pelo driver.

No MIDI USB, o driver transforma transferências USB em eventos ALSA. A biblioteca MIDI lê a porta. O app recebe os bytes e interpreta status/canal/nota. Cada camada pode informar um problema distinto: falha USB, driver sem dispositivo, porta ALSA fechada, parse inválido ou roteamento sem slot.

## 2.22 Módulo ou built-in

Um driver pode ser compilado dentro do kernel ou como módulo carregável. Built-in está disponível desde o início do kernel, mas aumenta o kernel e não pode ser removido em runtime. Módulo reduz a imagem-base e pode ser carregado quando necessário, mas precisa estar no rootfs e a ferramenta de carregamento precisa encontrá-lo.

A escolha depende de dependências de boot:

- suporte necessário para ler o rootfs precisa estar pronto antes de montar a raiz;
- driver de USB MIDI pode carregar depois do boot;
- GPU pode depender de firmware em arquivo;
- suporte a uinput precisa existir antes de samnat-pointer criar o dispositivo virtual.

Uma configuração Kconfig é uma rede de dependências. Marcar uma opção manualmente pode habilitar outras, ou ser invalidado na próxima resolução do menuconfig. Registre a configuração final usada na imagem, não apenas o fragmento solicitado.

## 2.23 Áudio como produtor e consumidor periódico

FluidSynth produz quadros PCM; o dispositivo consome quadros no ritmo do relógio de áudio. O produtor precisa manter uma fila suficiente, mas não tão grande que torne a resposta musical lenta.

Se o intervalo de callback é T e o áudio continua consumindo durante T, o app precisa entregar dados antes que a fila esvazie. Scheduler delays, page faults, contenção de mutex e operações de I/O no caminho podem consumir esse prazo. Por isso operações de disco e leitura de banco não devem bloquear a rotina de geração de amostras.

O protótipo mantém o motor num processo separado e carrega SoundFonts por comandos de controle. A geração PCM do FluidSynth é interna ao motor, não ao callback de pintura da UI. Essa separação ajuda, mas não substitui medir a latência real.

## 2.24 Quantização de volume

Um controle de mixer em porcentagem pode mapear de maneira linear ou não linear para amplitude. Se o controle for linear em amplitude, a relação com decibéis é:

~~~text
dB = 20 × log10(amplitude)
~~~

Metade da amplitude corresponde a aproximadamente -6 dB; o silêncio não tem valor finito em dB. Um rótulo “30%” sozinho não permite concluir o nível em dB, pois o mixer pode usar escala perceptiva ou faixas de hardware.

O volume mestre e o ganho do sintetizador também se somam em dB se cada etapa for linear. Aumentar várias partes cria uma soma que depende da fase e do conteúdo; não se pode somar os percentuais dos sliders para prever pico.

## 2.25 Efeitos e consumo de recursos

Reverb e chorus mantêm estado e processam buffers. Um efeito de reverb pode manter cauda depois do note-off, portanto silenciar a nota não zera imediatamente o consumo ou a saída. Chorus pode misturar versões moduladas do sinal e ampliar a imagem estéreo.

No SamNat atual, chorus e reverb começam desligados; controles por parte e configuração global devem ser interpretados junto com a versão do FluidSynth. A decisão reduz processamento inicial e elimina um fator durante diagnóstico. Não implica que todos os SoundFonts tenham o mesmo volume ou o mesmo pico.

## 2.26 Exercícios adicionais

1. Pesquise o driver vinculado ao controlador MIDI USB em sysfs e compare com o nome da porta ALSA.
2. Identifique no kernel config uma opção built-in e uma opção de módulo e explique a ordem necessária.
3. Calcule o nível em dB para amplitude 1, 0,5 e 0,1.
4. Desenhe uma fila PCM com três blocos e explique quando ocorre underrun.
5. Toque uma nota com reverb e observe quanto a cauda continua depois do note-off.

## Leituras

- [Linux Kernel: conceitos de memória virtual](https://docs.kernel.org/admin-guide/mm/concepts.html)
- [Linux Kernel: ALSA](https://docs.kernel.org/6.1/sound/alsa-configuration.html)
- [Linux Kernel: subsistema de entrada](https://docs.kernel.org/input/input.html)
