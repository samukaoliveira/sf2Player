# Imagem embarcada SamNat Synth (x86_64)

Esta configuração gera um disco GPT inicializável por UEFI para PC x86_64. Ao iniciar, o sistema abre Xorg/Mesa e executa o app em tela cheia sem iniciar um desktop. O app usa FluidSynth, ALSA e o módulo MIDI que já vêm no AppDir. O kernel inclui sequenciador ALSA, áudio HDA/HDMI/USB, vídeo AMD/Intel e rede cabeada Realtek. A partição `/data` mantém cenas e SF2 entre reinicializações.

## Gerar

Requer `make`, `curl`, compilador C/C++, `bison`, `gzip` e ferramentas usuais de compilação. O script baixa o source oficial Buildroot 2026.08 caso ele não esteja em `/tmp/samnat-buildroot-source`; Buildroot compila as dependências que faltam no host.

```sh
cd prototipo-nativo
npm run pack:linux
./embedded/build-image.sh
```

O script usa `/tmp/samnat-buildroot-source` e `/tmp/samnat-buildroot-output` por padrão. Para outros diretórios, exporte `BUILDROOT_SOURCE` e `BUILDROOT_OUTPUT`. O resultado compactado fica em `release-linux/SamNatSynthEmbedded-x86_64.img.gz`.

## Gravar e iniciar

Confirme com `lsblk` qual é o dispositivo USB. A gravação apaga todo o conteúdo do dispositivo selecionado:

```sh
gzip -dc SamNatSynthEmbedded-x86_64.img.gz | sudo dd of=/dev/sdX bs=4M conv=fsync status=progress
```

Troque `/dev/sdX` pelo disco USB inteiro, não por uma partição. No PC, selecione esse USB no menu UEFI. A imagem requer firmware UEFI x86_64; Secure Boot deve estar desativado porque o GRUB não é assinado.

## Uso

- Ligue saída de áudio HDA/HDMI ou uma interface USB. O app lista os dispositivos ALSA físicos detectados.
- Conecte um controlador MIDI USB; o kernel fornece `/dev/snd/seq` para o módulo `midi`.
- Conecte Ethernet para acessar e baixar SoundFonts do catálogo online. O DHCP inicia no boot.
- Cenas e SoundFonts ficam em `/data/home/.samnat-synth` e sobrevivem ao desligamento.
- Se a máquina que compila tiver `~/.samnat-synth/soundfonts/k-pc88.sf2`, esse banco é incluído como timbre inicial; use `SAMNAT_DEFAULT_SF2=/caminho/arquivo.sf2` para escolher outro.
- Um console de manutenção fica disponível em `Ctrl+Alt+F2`; `Ctrl+Alt+F1` retorna ao app.

Esta primeira imagem é destinada a PC/mini-PC x86_64 UEFI. Hardware de vídeo NVIDIA, Wi-Fi e alguns controladores de áudio podem exigir firmware ou opções específicas; o alvo que orientou a configuração tem AMD Radeon integrada, áudio HDA/HDMI e Ethernet Realtek.
