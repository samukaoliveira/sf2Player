# SamNat Synth no Raspberry Pi 3B+

Esta pasta reúne a adaptação do alvo Raspberry, separada da imagem x86_64. A
branch deve partir de `prototipo_nativo` (`linux-1.0PRO`), e o Buildroot do PC
continua independente.

## Hardware identificado

- Computador: Raspberry Pi 3B+ (BCM2837, Cortex-A53, 1 GB RAM).
- Tela: placa MPI3501, 3,5", 320 x 480 pixels na orientação nativa, ligada por
  SPI. Em paisagem, a área lógica fica em 480 x 320.
- Controlador do LCD: ILI9486.
- Toque: resistivo de quatro fios, controlador XPT2046.
- Ligação desta placa: LCD em SPI0 CE0; toque em SPI0 CE1; `DC` em GPIO24,
  `RESET` em GPIO25 e interrupção do toque em GPIO17. O toque e o LCD
  compartilham SCLK/MOSI; o toque também usa MISO.

## Interface 480 x 320

O app detecta automaticamente telas pequenas (até 600 x 600) e usa um perfil
compacto: os oito slots ficam em linhas com nome, volume, MIDI Learn e
engrenagem. A engrenagem abre as opções do timbre. Cenas e pads MIDI ficam em
uma janela própria; outra janela reúne saída de áudio, buffer e conexão MIDI.
O teclado virtual fica oculto inicialmente para liberar espaço e pode ser
aberto pelo botão `Teclas` (duas oitavas nesse perfil).

Se o backend de vídeo não informar a geometria correta, defina
`SAMNAT_DISPLAY_PROFILE=mpi3501` no ambiente que inicia o app. A escolha do
buffer é salva nas configurações do usuário. Ao alterá-la com áudio ativo, o
FluidSynth reinicia a saída e restaura os timbres carregados.

O PDF `Datasheet XPT2046.pdf` descreve somente o conversor/controlador do
touchscreen. Ele confirma a interface serial SPI e a conversão ADC de 12 bits;
não descreve a inicialização do painel LCD. O ILI9486 foi identificado pelo
modelo MPI3501 e pela documentação correspondente da placa.

## Drivers Linux

O perfil de kernel está em `mpi3501-linux.fragment`. Ele habilita o SPI do
BCM2835, o driver DRM pequeno do ILI9486, a emulação de framebuffer para
aplicações LinuxFB e o driver `ads7846`, compatível com o XPT2046.

Para um primeiro teste em Raspberry Pi OS, a configuração de boot inicial está
em `mpi3501-config.txt`. A linha `dtoverlay=piscreen,drm` seleciona o painel e
o toque; `rotate=90` solicita a orientação paisagem. A orientação e os eixos do
toque devem ser confirmados na tela física, porque a rotação pode exigir
calibração ou troca dos eixos.

Depois do boot, conferir no Pi:

```sh
dmesg | grep -Ei 'ili9486|ads7846|spi'
ls -l /dev/dri /dev/fb* /dev/input/event* 2>/dev/null
cat /proc/bus/input/devices
```

Com DRM, a tela pode não aparecer como `/dev/fb1`; não se deve fixar esse nome
antes de verificar o dispositivo criado pelo kernel.

## Imagem appliance Buildroot ARM64

O alvo final é um Linux Buildroot próprio: inicia o kernel, firmware e serviços
mínimos, configura o painel MPI3501, e abre SamNat Synth direto no framebuffer
LinuxFB. Não inclui Raspberry Pi OS, Chromium, Xorg ou desktop. A imagem tem
partição FAT de boot e uma raiz ext4 gravável com o app e os SF2 do repositório.
O perfil usa o kernel/DTB oficial de 64 bits do Pi 3, áudio ALSA, MIDI USB,
touchscreen ADS7846/XPT2046 e o app ARM64.

O AppDir x86_64 não pode ser reaproveitado no Pi. **Não é necessário compilar
nem preparar nada no Raspberry Pi.** O Ubuntu monta o runtime ARM64 dentro de um
container Debian ARM64 executado via QEMU/binfmt e, em seguida, o Buildroot
cross-compila o kernel e o sistema de arquivos para o Pi. A imagem final não
inclui Docker, QEMU, Raspberry Pi OS, Chromium, Xorg ou desktop.

O runtime do app precisa de Qode, NodeGui e do módulo MIDI compilados para
ARM64. A versão fixada do Qode não oferece um alvo documentado de
cross-compilação Linux ARM64; por isso, essa etapa compila dentro do userspace
ARM64 emulado no Ubuntu. A saída é um AppDir ARM64 real, e o Raspberry não
participa da compilação.

### 1. Preparar o Ubuntu uma vez

Instale e inicie o Docker Engine. O usuário precisa ter acesso ao daemon (por
exemplo, estar no grupo `docker` e abrir uma nova sessão). Registre o emulador
ARM64 no `binfmt` uma vez:

```sh
sudo docker run --privileged --rm tonistiigi/binfmt --install arm64
```

Se o usuário ainda não puder executar `docker` sem `sudo`, entre no grupo Docker
ou use `DOCKER_COMMAND='sudo docker'` nos comandos de build abaixo.

### 2. Gerar app ARM64 e imagem Buildroot no Ubuntu

Na raiz do repositório:

```sh
cd /home/samuka/workspace/sf2Player/prototipo-nativo
JOBS=4 ./embedded/build-image-rpi3.sh
```

O script primeiro executa `raspberry/build-appdir-rpi3.sh`, que compila e
empacota o app ARM64 no Ubuntu sem instalar ou alterar o Ubuntu hospedeiro. O
AppDir fica em `raspberry/build/SamNatSynthARM64.AppDir`. Em seguida, o mesmo
comando configura e compila o Buildroot para gerar o Linux appliance.

Se o Docker só estiver acessível por `sudo`, use:

```sh
DOCKER_COMMAND='sudo docker' JOBS=4 ./embedded/build-image-rpi3.sh
```

Para gerar/regerar somente o AppDir, sem compilar a imagem do sistema:

```sh
./raspberry/build-appdir-rpi3.sh
```

As fontes, dependências npm, cache APT e saída intermediária ficam preservados
em `/tmp/samnat-rpi3-arm64-work`. O
Buildroot mantém uma árvore separada do alvo x86, em
`/tmp/samnat-rpi3-buildroot-source` e
`/tmp/samnat-rpi3-buildroot-output`, com cache de downloads persistente em
`/tmp/samnat-buildroot-dl`. Os scripts não apagam essas pastas. A saída será
`prototipo-nativo/raspberry/release-raspberry/SamNatSynthPi3BPlus-arm64.img.gz`,
com SHA-256 ao lado. A imagem bruta tem raiz ext4 de 6 GB e inclui atualmente
cerca de 2,9 GB de SF2; use um pendrive de pelo menos 16 GB.

### 3. Gravar e iniciar o appliance

Confirme o dispositivo inteiro com `lsblk` e substitua `/dev/sdX` pelo pendrive
correto. A gravação sobrescreve o dispositivo selecionado:

```sh
gzip -dc prototipo-nativo/raspberry/release-raspberry/SamNatSynthPi3BPlus-arm64.img.gz | sudo dd of=/dev/sdX bs=4M conv=fsync status=progress
```

Conecte o pendrive ao Pi 3B+ e ligue-o. A imagem inicia o app em tela cheia;
`Ctrl+Alt+F2` abre o console de manutenção. O instalador não grava nem altera
microSD.
