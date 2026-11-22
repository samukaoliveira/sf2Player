# 9. Linux mínimo com Buildroot

Buildroot automatiza a construção de toolchain, kernel, bibliotecas, ferramentas e root filesystem para sistemas Linux embarcados. Ele não é uma distribuição pronta instalada em um PC; é um sistema de construção que combina configuração e fontes para produzir artefatos de uma plataforma definida.

## 9.1 O que o Buildroot constrói

~~~text
configuração do alvo
  ├─ toolchain e bibliotecas
  ├─ kernel Linux
  ├─ pacotes de usuário
  ├─ root filesystem
  ├─ bootloader
  └─ scripts post-build/post-image
         ↓
      imagem de disco
~~~

O Buildroot trabalha com configuração de arquitetura, toolchain, pacotes e filesystem. O arquivo samnat_x86_64_defconfig seleciona x86_64, toolchain externa glibc Bootlin, headers e kernel, pacotes de áudio/entrada, GRUB e ferramentas de imagem.

## 9.2 Buildroot externo

O diretório embedded é um **external tree** Buildroot. Ele contém:

- external.desc e external.mk para registrar a árvore;
- configs com o defconfig do SamNat;
- board/samnat com configurações, scripts e arquivos de boot;
- package/samnat-pointer com o pacote de ponteiro unificado;
- rootfs-overlay com arquivos que serão copiados para a raiz embarcada.

Essa separação mantém personalizações do produto fora da árvore upstream do Buildroot. O projeto chama o Buildroot oficial com BR2_EXTERNAL apontando para embedded. O manual oficial descreve external trees, rootfs overlay, post-build e post-image.

## 9.3 Defconfig, fragments e overlay

O defconfig grava escolhas como CPU, toolchain e pacotes. A configuração do kernel também tem base e fragmentos. O resultado efetivo deve ser conferido após gerar a configuração, porque opções dependem umas das outras e o Kconfig pode remover combinações inválidas.

Um rootfs overlay injeta arquivos mantidos pelo projeto em caminhos absolutos da imagem. Exemplos:

- /etc/inittab e fstab;
- scripts init em /etc/init.d;
- executáveis da sessão e controle de áudio;
- instalador;
- regras e configuração de tela.

Overlay não é um serviço mágico: o arquivo só funciona se o pacote e as dependências esperadas existirem e as permissões executáveis forem preservadas. O script post-build verifica AppRun, Qode, plugin Qt LinuxFB e bibliotecas runtime antes de aceitar o alvo.

## 9.4 Kernel para o instrumento

O kernel selecionado é Linux 6.12.47 x86_64 na configuração atual. A configuração inclui drivers e subsistemas para:

- HDA, codec Realtek, HDMI/DisplayPort e áudio USB;
- ALSA PCM, mixer, MIDI sequencer e USB MIDI;
- USB HID, teclado, mouse, touchscreen, I2C HID e uinput;
- vídeo AMDGPU/DRM e firmware AMD;
- armazenamento USB, SATA/NVMe e sistemas de arquivos;
- rede cabeada e descoberta do hardware.

Configurar um driver como módulo ou embutido muda quando ele pode ser carregado. Um dispositivo de raiz precisa ser reconhecido antes da montagem da raiz; o suporte do filesystem que contém a raiz precisa estar embutido ou disponível no initramfs. Um driver de mouse USB pode ser módulo, desde que o sistema o carregue e acompanhe hotplug.

## 9.5 Firmware e drivers não são a mesma coisa

O driver é código do kernel ou do usuário que controla o dispositivo. Firmware é dado executável/configuração que o driver pode carregar no hardware. O pacote linux-firmware fornece arquivos específicos; não substitui o driver.

Uma linha de dmesg dizendo que AMDGPU solicitou firmware, mas não conseguiu carregá-lo, sugere investigar caminho e pacote de firmware. O kernel pode então usar outro modo de vídeo ou não inicializar aceleração. Uma tela de boot desenhada pelo framebuffer EFI não confirma que o driver AMDGPU esteja funcionando.

Para depurar, relacione:

1. ID PCI/USB do dispositivo;
2. driver vinculado em sysfs;
3. mensagem de carregamento do firmware;
4. nós criados em /dev;
5. backend gráfico escolhido pelo Qt.

## 9.6 Por que evitar Xorg nesta imagem

O sistema inicializa diretamente para o app pelo plugin Qt LinuxFB. Isso remove desktop e servidor X da cadeia de execução. Um log de Xorg dizendo “no screens found” indica que algum script ou imagem ainda está tentando iniciar Xorg; não descreve o caminho LinuxFB esperado.

O post-build remove o serviço S40xorg. A sessão exporta QT_QPA_PLATFORM=linuxfb e inicia AppRun. Se Xorg reaparece:

- confira se iniciou a imagem recém-construída;
- confira o GRUB e o rootfs montado;
- confirme se S40xorg está presente;
- procure execuções de samnat-start-x e scripts de boot antigos;
- verifique logs da sessão e plugin Qt selecionado.

## 9.7 init, inittab e serviços

Buildroot usa BusyBox init nesta imagem. O arquivo inittab monta procfs, prepara diretórios, monta volumes, inicia rcS, executa samnat-session em tty1 e mantém getty de manutenção em tty2.

O serviço de rede inicia DHCP em segundo plano. Isso impede que uma rede lenta atrase a abertura do instrumento. A interface online ainda pode levar tempo; o app precisa distinguir “aplicação pronta” de “catálogo remoto acessível”.

Serviços em /etc/init.d recebem ações como start e stop. O prefixo numérico determina a ordem dentro do rcS. Um serviço que depende de /data precisa iniciar depois da montagem da partição.

## 9.8 Ponteiro unificado

O pacote samnat-pointer é um programa C que usa libinput e udev para descobrir dispositivos apontadores, lê movimento/toques e os publica em um dispositivo virtual criado por uinput. A sessão Qt usa o caminho event criado pelo serviço.

O propósito é consolidar touchpad e mouse e permitir hotplug. A lógica de movimento precisa respeitar semântica relativa; aplicar escala inadequada desloca o ponteiro em excesso. Botões físicos em touchpads podem depender do protocolo/driver do fabricante, enquanto toque para clicar é uma função da libinput.

O teclado físico segue caminho separado. samnat-session tenta selecionar um nó evdev de teclado para não deixar o Qt descobrir múltiplos nós que representem o mesmo teclado e duplique cada tecla.

## 9.9 Tamanho mínimo e custo de manutenção

O sistema é magro em relação a uma distribuição desktop, mas não deve remover bibliotecas apenas por tamanho. Cada remoção precisa ser validada contra dependências:

- módulo NodeGui nativo e Qt;
- plugin de plataforma LinuxFB;
- codecs de imagem e SVG necessários;
- fontes;
- FluidSynth e bibliotecas;
- ALSA, ferramentas e plugin PulseAudio para teste;
- módulo Node MIDI e ALSA sequencer.

AppImage e Buildroot dividem o runtime. O AppDir carrega Qode, Qt, FluidSynth, utilitários de áudio e algumas bibliotecas; Buildroot fornece kernel, init, libc de base, fontes selecionadas e drivers. Se uma biblioteca nova é adicionada à aplicação, os scripts de empacotamento e verificações post-build precisam ser atualizados.

## 9.10 Exercícios

1. Localize no defconfig as opções de CPU, kernel, armazenamento raiz e imagem.
2. Trace a origem de um arquivo do overlay até seu caminho dentro do rootfs.
3. Explique a diferença entre kernel driver, firmware e biblioteca cliente.
4. Desenhe a ordem de inicialização a partir do inittab.
5. Descubra quais arquivos e bibliotecas são fornecidos pelo AppDir e quais pelo rootfs.

## Leituras

- [Manual oficial do Buildroot](https://buildroot.org/downloads/manual/manual.html)
- [Linux Kernel: ALSA](https://docs.kernel.org/6.1/sound/alsa-configuration.html)
- [Linux Kernel: interface de entrada](https://docs.kernel.org/input/input.html)
