# Imagem embarcada SamNat Synth (x86_64)

Esta configuração gera um disco MBR inicializável por BIOS legado e UEFI para PC x86_64. Ao iniciar, o sistema abre o app em tela cheia diretamente pelo framebuffer LinuxFB, sem Xorg ou desktop. A imagem inclui o plugin Qt LinuxFB e suas bibliotecas OpenGL; o ponteiro usa libinput com suporte a mouse USB conectado depois do boot. O app usa FluidSynth, ALSA e o módulo MIDI que já vêm no AppDir. O kernel inclui sequenciador ALSA, áudio HDA/HDMI/USB, vídeo AMD/Intel e rede cabeada Realtek. A partição `/data` mantém cenas, associações MIDI dos pads e SF2 entre reinicializações, além de incluir os SoundFonts de `prototipo-nativo/soundfonts` na biblioteca do app. Na imagem USB, `/data` é dimensionada pelo conteúdo; a instalação expande a partição para ocupar o SSD.

## Gerar

Requer `make`, `curl`, compilador C/C++, `bison`, `gzip` e ferramentas usuais de compilação. O script baixa o source oficial Buildroot 2026.08 caso ele não esteja em `/tmp/samnat-buildroot-source`. A configuração usa a toolchain x86_64/glibc estável do Bootlin 2025.08-1, que o Buildroot baixa automaticamente, e compila o kernel e as bibliotecas do sistema.

```sh
cd prototipo-nativo
npm run pack:linux
./embedded/build-image.sh
```

O script usa `/tmp/samnat-buildroot-source` e `/tmp/samnat-buildroot-output` por padrão. Para outros diretórios, exporte `BUILDROOT_SOURCE` e `BUILDROOT_OUTPUT`. O resultado compactado fica em `release-linux/SamNatSynthEmbedded-x86_64.img.gz`, acompanhado do SHA-256. A tabela MBR e todas as partições são alinhadas a 1 MiB.

## Gravar e iniciar

Confirme com `lsblk` qual é o dispositivo USB. A gravação apaga todo o conteúdo do dispositivo selecionado:

```sh
gzip -dc SamNatSynthEmbedded-x86_64.img.gz | sudo dd of=/dev/sdX bs=4M conv=fsync status=progress
```

Troque `/dev/sdX` pelo disco USB inteiro, não por uma partição. No PC, selecione esse USB no menu de boot. O GRUB oferece a opção padrão de iniciar o app e `Install SamNat Synth to internal SSD`. O instalador copia a imagem para um disco interno escolhido, atribui identificadores próprios às partições e amplia `/data` até o fim do SSD. Ele apaga todo o disco escolhido e exige digitar `APAGAR` para confirmar. Secure Boot deve estar desativado porque o GRUB não é assinado.

## Uso

- Ligue saída de áudio HDA/HDMI ou uma interface USB. O app lista os dispositivos ALSA físicos detectados.
- Conecte um controlador MIDI USB; o kernel fornece `/dev/snd/seq` para o módulo `midi`.
- Conecte Ethernet para acessar e baixar SoundFonts do catálogo online. O DHCP inicia em segundo plano no boot, sem atrasar a abertura do app.
- Cenas e SoundFonts ficam em `/data/home/.samnat-synth` e sobrevivem ao desligamento.
- Cada cena aparece como um pad de acionamento; `MIDI Learn` associa uma nota ou CC MIDI do controlador à cena.
- O cabeçalho mostra o uso de CPU e memória RAM, atualizado a cada cinco segundos.
- Os SF2 incluídos ficam em `/data/home/.samnat-synth/soundfonts` e aparecem ao abrir `Abrir SF2`.
- Se a máquina que compila tiver `~/.samnat-synth/soundfonts/k-pc88.sf2`, esse banco é incluído como timbre inicial; use `SAMNAT_DEFAULT_SF2=/caminho/arquivo.sf2` para escolher outro.
- Um console de manutenção fica disponível em `Ctrl+Alt+F2`; `Ctrl+Alt+F1` retorna ao app.

Esta imagem é destinada a PC/mini-PC x86_64. Hardware de vídeo NVIDIA, Wi-Fi e alguns controladores de áudio podem exigir firmware ou opções específicas; o alvo que orientou a configuração tem AMD Radeon integrada, áudio HDA/HDMI e Ethernet Realtek.
