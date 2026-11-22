# 1. O computador como camadas

Antes de falar de sintetizador, precisamos saber o que significa “o app está rodando”. Um programa não conversa diretamente com o silício em cada instrução. Entre a intenção do programa e os sinais elétricos existem camadas: componentes físicos, firmware, carregador de boot, kernel, serviços do sistema, bibliotecas e aplicação.

Essa separação não é só acadêmica. Ela explica por que uma nota MIDI pode chegar ao aplicativo e ainda assim não virar som; por que um sistema pode detectar o controlador e não detectar a tela; e por que um programa que funciona no desktop pode falhar quando inicia direto pelo framebuffer.

## 1.1 O instrumento é um computador especializado

Um piano digital, workstation ou sintetizador moderno pode ser entendido como um computador especializado em responder a gestos musicais com áudio previsível. Há entradas — teclas, pads, rodas, pedais e MIDI —, uma lógica que transforma esses eventos em parâmetros musicais, uma fonte sonora e uma saída que converte números em tensão analógica e pressão sonora.

Em um sistema físico, o caminho simplificado é:

~~~text
tecla / MIDI → firmware do instrumento → motor de síntese → conversor D/A → amplificador → alto-falante
~~~

No SamNat Synth, o computador de uso geral fornece parte dessas funções:

~~~text
controlador / teclado na tela
        ↓ eventos MIDI
Node.js + interface Qt
        ↓ mensagens entre threads
FluidSynth + SoundFont
        ↓ amostras PCM
ALSA → driver do kernel → dispositivo de áudio → amplificador → fone/alto-falante
~~~

No sistema embarcado, o próprio Linux também é distribuído com a aplicação. O objetivo é iniciar em um ambiente reduzido, sem um desktop genérico, e manter os componentes necessários ao instrumento.

## 1.2 Hardware: recursos e limites físicos

O hardware fornece recursos finitos:

- **CPU** executa instruções. Uma CPU de propósito geral alterna entre tarefas do sistema e do aplicativo.
- **RAM** guarda código e dados em uso. Amostras de SF2 podem ocupar muita memória, mas a quantidade do arquivo não equivale necessariamente à RAM residente.
- **Armazenamento** mantém kernel, sistema de arquivos, aplicativo, cenas e timbres entre reinicializações.
- **Controladores de barramento** conectam CPU a USB, PCI Express, SATA/NVMe, memória e periféricos.
- **Dispositivos de áudio** recebem PCM e, em seguida, fazem conversão digital-analógica.
- **Dispositivos de entrada** reportam eventos como posição do ponteiro, tecla pressionada ou evento de MIDI.
- **GPU e display** compõem ou exibem uma imagem; no modo LinuxFB usado pela imagem, o Qt apresenta a interface diretamente no framebuffer.

Uma falha em cada nível produz sintomas diferentes. Um controlador MIDI ausente em /dev/snd/seq sugere uma questão de kernel, dispositivo ou permissões. Um FluidSynth que abre mas não toca pode envolver carregamento de preset, roteamento MIDI ou volume. Um programa que abre e não desenha pode envolver plugin de plataforma, framebuffer ou driver gráfico.

## 1.3 O que faz um sistema operacional

O sistema operacional administra recursos compartilhados e oferece uma interface estável aos programas. O aplicativo pede para abrir um arquivo; o sistema traduz o caminho em operações de armazenamento. O aplicativo cria uma thread; o sistema agenda sua execução. O FluidSynth pede uma saída ALSA; a biblioteca e o kernel encaminham as amostras ao dispositivo.

Um modelo didático divide o sistema em:

1. **Kernel**: código privilegiado que controla CPU, memória virtual, interrupções, processos e drivers.
2. **Bibliotecas e runtimes**: implementam interfaces úteis, como libc, Qt, Node.js, ALSA e FluidSynth.
3. **Serviços e programas de sistema**: init, configuração de rede, montagem de volumes, login e ferramentas.
4. **Aplicações**: o SamNat Synth e outros programas de usuário.

As fronteiras variam conforme a arquitetura. ALSA, por exemplo, inclui componentes no kernel e bibliotecas no espaço de usuário. O nome “driver ALSA” pode ser usado informalmente para os dois lados; em diagnóstico é melhor dizer se estamos falando do módulo do kernel, do dispositivo exposto ou da biblioteca cliente.

## 1.4 Kernel e espaço de usuário

O kernel executa em modo privilegiado. Um aplicativo comum executa em espaço de usuário, com acesso controlado. Essa fronteira impede que qualquer programa altere memória do kernel ou configure livremente hardware. Quando é necessário um serviço privilegiado, o processo faz uma chamada ao sistema, por exemplo para abrir um arquivo, mapear memória ou criar um processo.

Uma analogia útil é uma oficina: o programa descreve o serviço que quer; o kernel valida o pedido e coordena o recurso. A analogia não deve ser levada longe demais: sistemas reais usam interfaces assíncronas, interrupções, filas, DMA e drivers que trabalham concorrentemente.

O kernel não interpreta o nome do instrumento escolhido em uma lista do app. Ele sabe sobre dispositivos, buffers e interrupções. A aplicação conhece a noção musical de slot, preset, cena e nota. As bibliotecas conectam os dois mundos.

## 1.5 ABI, API e bibliotecas

Uma **API** é a interface de programação que o desenvolvedor usa. Uma **ABI** define convenções binárias como nomes exportados, layout de estruturas, registradores, tamanho de tipos e forma de chamar funções. Uma biblioteca pode ter API conhecida, mas não estar disponível no sistema de destino; ou estar disponível com ABI incompatível.

Isso explica erros recorrentes em sistemas embarcados:

- `libGLX.so.0: cannot open shared object file`: o carregador dinâmico não encontrou uma biblioteca requerida.
- `libgthread-2.0.so.0`: o executável foi compilado ou empacotado com dependência do GLib que não foi incluída.
- erro de símbolo indefinido: encontrou-se uma biblioteca, mas talvez a versão ou ABI não corresponda.
- `Exec format error`: arquitetura binária diferente, formato inválido ou arquivo sem permissão de execução.

Uma imagem reproduzível precisa incluir o runtime necessário ou construir o aplicativo para as bibliotecas disponíveis no alvo. O AppDir do projeto contém Qode/Qt e bibliotecas selecionadas; a imagem Buildroot fornece kernel e serviços básicos. Essa divisão é deliberada, mas tem de ser conferida sempre que aparece uma nova dependência.

## 1.6 Firmware e sequência de inicialização

Ao apertar o botão de ligar, a CPU começa em um ponto definido pelo hardware e executa o firmware da placa. Em um PC, UEFI inicializa partes da plataforma, procura um caminho de boot e carrega o GRUB. O GRUB carrega o kernel e passa uma linha de comando, incluindo a localização da raiz.

A sequência conceitual do SamNat é:

~~~text
energia
  → firmware UEFI ou BIOS
  → GRUB
  → kernel Linux (bzImage)
  → montagem da partição raiz
  → init do Buildroot
  → scripts de inicialização
  → montagem de /data
  → sessão SamNat
  → Qode + NodeGui + Qt
~~~

Um computador moderno nem sempre segue exatamente o mesmo caminho em UEFI e BIOS legado. A imagem dual inclui entradas para ambos. Uma falha antes do kernel aparecer é diferente de uma falha do Xorg ou do aplicativo: o ponto da última mensagem visível ajuda a localizar a camada.

## 1.7 Sistemas operacionais generalistas e embarcados

Uma distribuição de desktop inclui muitos serviços e escolhas para uma grande variedade de máquinas. Um sistema embarcado escolhe um conjunto menor, orientado a um produto e hardware conhecidos. Menos componentes podem reduzir armazenamento e caminhos de configuração, mas aumentam a responsabilidade de selecionar e manter cada recurso.

“Mínimo” não significa “simples”. O sistema do SamNat precisa incluir o que sustenta a experiência musical:

- kernel e drivers de áudio, USB, tela e armazenamento;
- ALSA e sequenciador MIDI;
- Qt/Qode e plugin LinuxFB;
- FluidSynth, bibliotecas, utilitários e dados de runtime;
- fontes, ícones, SoundFonts, scripts de boot e persistência;
- ferramentas de manutenção para recuperar falhas no dispositivo real.

Remover um gerenciador de janelas pode eliminar serviços, mas não remove a necessidade de uma plataforma de tela. O plugin Qt LinuxFB precisa abrir o framebuffer; o kernel precisa inicializar um dispositivo gráfico compatível; e as permissões precisam permitir o acesso. Se alguma dessas condições falha, o app não tem onde desenhar.

## 1.8 Três conceitos de sistema de arquivos

O sistema de arquivos associa nomes a arquivos, diretórios, permissões e metadados. Em Linux, uma árvore como `/etc`, `/dev`, `/usr` e `/home` aparece sob uma única raiz `/`.

- **Partição** é uma região do dispositivo de armazenamento.
- **Sistema de arquivos** organiza dados dentro de uma partição ou volume.
- **Ponto de montagem** é o diretório onde o conteúdo desse sistema aparece.

O SamNat separa raiz do sistema e dados persistentes. A raiz pode ser substituída por uma imagem nova; `/data` mantém cenas e SoundFonts. A sessão define `HOME` dentro de `/data`, então `~/.samnat-synth` continua disponível após a reinicialização.

O tamanho em bytes de uma partição não é todo espaço livre para o usuário. Metadados, blocos reservados do ext4 e conteúdo incluído ocupam espaço. O script da imagem calcula a partição de dados a partir do tamanho dos SF2 e deixa uma reserva mínima adicional; o instalador expande a partição para ocupar o disco interno. Essa decisão é explicada em detalhe no capítulo 10.

## 1.9 Resumo de fluxo: da tecla ao alto-falante

Uma nota pode atravessar diversos componentes:

1. Um controlador envia uma mensagem MIDI, ou o botão do teclado virtual cria uma mensagem equivalente.
2. O processo principal identifica a nota e determina quais slots recebem o evento.
3. O processo envia uma mensagem ao worker de áudio.
4. O worker escreve comandos no FluidSynth.
5. O FluidSynth seleciona preset, região de amostra e parâmetros de síntese.
6. O motor mistura as vozes ativas em buffers PCM.
7. A biblioteca cliente entrega buffers à saída ALSA ou ao servidor PulseAudio/PipeWire selecionado.
8. O driver do kernel programa o dispositivo; o conversor e o amplificador produzem o sinal.

Uma falha em qualquer etapa pode resultar em silêncio. “MIDI conectado” prova somente algumas das primeiras etapas. “Teste de 440 Hz funcionou” prova que um caminho de saída PCM funciona, mas não confirma que o FluidSynth carregou um banco, selecionou um programa e recebeu note-on.

## 1.10 Exercícios

1. Desenhe a sequência de boot que aparece no seu computador e marque a última camada visível quando há uma falha.
2. No sistema instalado, compare `lsblk -f`, `findmnt` e `df -h`. Identifique dispositivo, partição, sistema de arquivos, ponto de montagem e espaço livre.
3. Faça um diagrama do caminho de uma nota MIDI externa e outro do teste de tom de 440 Hz. Aponte quais componentes são comuns e quais diferem.
4. Explique por que uma biblioteca ausente é diferente de um driver ausente.
5. Liste as responsabilidades que ficam no kernel e as que ficam na aplicação.

## 1.11 Como uma instrução vira trabalho

Um programa é uma sequência de instruções de máquina e dados. O compilador transforma código-fonte em instruções que a arquitetura do processador entende. Em JavaScript, o caminho inclui o runtime V8: ele interpreta ou compila funções, gerencia objetos e eventualmente gera código de máquina. Quando o código chama NodeGui, atravessa um binding nativo até Qt.

~~~text
função JavaScript
  → runtime Node/V8
  → binding NodeGui
  → função C++ da biblioteca
  → Qt
  → operação do sistema ou desenho
~~~

Esse encadeamento explica por que uma exceção JavaScript, falha de addon nativo, incompatibilidade de ABI e erro de driver aparecem com mensagens distintas. Uma stack trace que termina em um arquivo C++ ou num addon .node indica que o problema atravessou a fronteira JavaScript/native.

### Dados, endereços e instruções

O processador busca uma instrução, decodifica sua operação, lê operandos, executa e grava resultado. Isso ocorre em ciclos rápidos, mas o programa não controla diretamente todos os detalhes. O escalonador pode tirar a CPU daquela thread entre instruções; cache pode satisfazer uma leitura sem alcançar RAM; uma falta de página pode pausar a thread enquanto o kernel obtém dados.

Inteiros, strings e buffers têm representações diferentes. MIDI chega como bytes; o worker converte partes desses bytes em nota, velocity e canal. PCM é uma sequência de números, e endianness define a ordem de bytes que representa cada amostra. No teste direto de áudio, o código escreve valores de 16 bits em little-endian porque o aplay foi instruído a interpretar S16_LE.

### Chamadas de sistema

Quando um processo pede uma operação privilegiada, o runtime ou biblioteca faz uma chamada ao sistema. Abrir um arquivo, criar processo filho, escrever em pipe, mapear memória e consultar relógio acabam em interfaces do kernel. O processo não precisa conhecer registradores do controlador de disco: chama a interface definida pelo sistema.

Um erro de chamada ao sistema costuma aparecer como errno, mensagem legível ou rejeição de Promise. A localização da falha ajuda:

- erro ao abrir um caminho pode ser arquivo ausente, permissão ou filesystem não montado;
- erro ao criar processo pode ser executável ausente ou arquitetura incompatível;
- erro ao escrever em pipe pode indicar que o leitor terminou ou que o buffer foi encerrado;
- erro ao abrir ALSA pode vir de dispositivo indisponível, ocupado ou formato inválido.

## 1.12 Barramentos, interrupções e DMA

Dispositivos precisam avisar a CPU quando há trabalho. Uma interrupção é uma notificação assíncrona, geralmente provocada por hardware. O kernel executa uma rotina curta de tratamento, reconhece o evento e agenda trabalho adicional. A aplicação recebe mais tarde o resultado por uma fila, descritor ou callback.

USB é um barramento organizado por controladores host. O sistema descobre dispositivos, lê descritores e escolhe drivers. O periférico pode estar conectado ao controlador por hubs internos e não aparecer como um dispositivo PCI individual.

DMA (Direct Memory Access) permite que um controlador transfira blocos de dados entre dispositivo e memória sem a CPU copiar cada byte. Áudio em tempo real depende de buffers e ciclos previsíveis; a CPU ainda prepara as estruturas, mas o controlador movimenta amostras segundo a interface.

Essa diferença é relevante: ao observar CPU baixa, o hardware pode fazer parte do trabalho de transferência; isso não quer dizer que a aplicação não esteja envolvida. Também não elimina o risco de underrun se o programa não preencher o próximo buffer a tempo.

## 1.13 Inicialização, init e serviço de usuário

Depois de montar a raiz, o kernel inicia um programa em espaço de usuário. Em muitas distribuições é systemd; nesta imagem Buildroot é BusyBox init. O init executa scripts e mantém processos definidos em inittab.

Um serviço não é uma propriedade especial do executável; é um processo gerenciado por uma política de inicialização. O serviço de ponteiro inicia antes da sessão. Montar /data antes de samnat-session é dependência de ordem. Iniciar rede em segundo plano é uma decisão para que DHCP lento não atrase o instrumento.

O primeiro processo de usuário tradicionalmente recebe PID 1. Ele tem responsabilidades especiais ao recolher processos órfãos e responder a sinais de desligamento. Encerrar o app não é o mesmo que desligar o computador: o init precisa desmontar volumes e terminar serviços em ordem.

## 1.14 Desligamento correto

O botão “Desligar” precisa pedir ao sistema que finalize, não simplesmente cortar energia. O fluxo correto é:

~~~text
pedir encerramento
  → parar notas e worker
  → encerrar FluidSynth
  → liberar portas e timers
  → sincronizar dados
  → desmontar filesystems
  → desligar energia
~~~

Dados em cache podem ainda não ter sido gravados no USB/SSD. O comando sync solicita que buffers sejam descarregados; o kernel também sincroniza durante desmontagem. Remover energia enquanto há escrita pode corromper o filesystem, especialmente em mídias removíveis.

## 1.15 O que é “tempo real” em um instrumento

Tempo real não significa apenas “rápido”. Significa que a resposta deve ocorrer dentro de uma janela previsível. Para tocar ao vivo, uma demora ocasional grande pode ser tão ruim quanto uma demora média alta.

O kernel Linux genérico é multitarefa e pode oferecer boa resposta, mas não transforma automaticamente qualquer app em instrumento de baixa latência. É preciso observar prioridade, buffers, bloqueios, carga de CPU, memória e caminho da placa de áudio.

A interface do SamNat não executa DSP no callback de pintura Qt. FluidSynth gera PCM fora da UI e o backend de áudio controla buffers. O toque percebido ainda inclui atraso do controlador, do worker, do motor, do driver, do conversor e do alto-falante.

## 1.16 Exercícios adicionais

1. Desenhe a fronteira entre JavaScript, addon nativo, biblioteca compartilhada e kernel para uma chamada de abertura de áudio.
2. Explique como uma mensagem MIDI USB pode chegar depois de uma interrupção e terminar num callback do app.
3. Diferencie desligar a janela, encerrar o processo e desligar o computador.
4. Descreva o que deve acontecer antes de remover fisicamente a mídia USB.
5. Identifique quais passos da cadeia de nota precisam de tempo previsível e quais podem ser lentos sem afetar uma nota já iniciada.

## 1.17 A hierarquia de armazenamento

O processador acessa dados por uma hierarquia de velocidades e capacidades. Registradores são poucos e muito rápidos; caches ficam próximos aos núcleos; RAM tem mais capacidade; SSD e USB preservam dados sem energia, mas são muito mais lentos que RAM.

~~~text
registrador → cache L1/L2/L3 → RAM → SSD/NVMe → USB/remoto
mais rápido e menor                       mais lento e maior
~~~

Quando o app carrega um SF2, ele lê dados do armazenamento e o sistema pode mantê-los no page cache. FluidSynth usa estruturas em RAM para localizar amostras e produzir vozes. O áudio final é calculado em blocos e enviado para uma fila do dispositivo. Confundir esses níveis leva a conclusões erradas como “meu USB tem espaço, então cabe na memória” ou “o arquivo de 1 GB usa sempre exatamente 1 GB de RAM”.

## 1.18 Linguagens e camadas de execução

O SamNat usa JavaScript para orquestrar a interface, estados e mensagens. O JavaScript não elimina código nativo: NodeGui, Qt, MIDI e FluidSynth incluem componentes C/C++. Essa composição é útil porque o ecossistema nativo já implementa widgets, MIDI e DSP; a aplicação usa JavaScript para ligar os componentes.

Uma chamada cruza camadas com custos e regras:

~~~text
UI JavaScript → binding NodeGui → API Qt → QPA plugin → framebuffer
JavaScript worker → child_process → FluidSynth → ALSA lib → kernel ALSA
~~~

Cada seta é uma fronteira que deve ser investigada separadamente. Um erro que atravessa várias camadas pode ter stack trace parcial: o código precisa registrar também os parâmetros da operação, processo, backend e stderr.

## 1.19 Por que sistemas operacionais escondem detalhes

Sem abstrações, cada aplicação teria que controlar diretamente USB, placas de áudio, filesystem, relógio, memória, GPU e teclado. O kernel e bibliotecas apresentam interfaces comuns. Essa abstração permite que o mesmo FluidSynth rode em máquinas diferentes, mas não apaga diferenças de dispositivos, drivers e roteamento.

O resultado é uma troca:

- abstração reduz código específico de hardware;
- abstração pode esconder detalhes relevantes em falhas;
- camadas precisam concordar em formatos e versões;
- diagnóstico precisa saber qual camada forneceu o erro.

## 1.20 Exercício de rastreamento

Escolha uma ação simples, como apertar uma tecla da UI. Liste os objetos desde o QPushButton até o DAC. Para cada ligação, registre: formato dos dados, processo/thread dono, possível erro e evidência observável. Repita para uma tecla USB MIDI. Compare o que é compartilhado depois do roteamento.

## Leituras

- [Linux Kernel: conceitos de memória virtual](https://docs.kernel.org/admin-guide/mm/concepts.html)
- [Linux Kernel: configuração de som ALSA](https://docs.kernel.org/6.1/sound/alsa-configuration.html)
- [Buildroot: manual oficial](https://buildroot.org/downloads/manual/manual.html)
