# SamNat Synth no piCore64 — Raspberry Pi 3B+

Esta adaptação usa o AppDir ARM64 do projeto e empacota o app como uma extensão
`.tcz` do piCore. O roteiro atual mira a imagem local
`piCore64-14.1.0.img`, que suporta Raspberry Pi 3 e vem com kernel 6.1.68. Não
grava nem recompila a imagem original.

O piCore executa extensões a partir de `tce/optional` e mantém a pasta TCE como
área persistente. A extensão inclui Qode, NodeGui/Qt LinuxFB, MIDI nativo,
FluidSynth, ALSA userspace, ferramentas de teste e fontes tipográficas. Os SF2
ficam fora da extensão, em `tce/samnat-synth-data/soundfonts`, para persistirem
sem fazer parte do sistema em RAM.

## 1. Gerar o pacote piCore

No Ubuntu, na pasta `prototipo-nativo`, rode o comando único:

```sh
./raspicore/build-picore-app.sh
```

Se ainda não existir um AppDir, o script compila o app ARM64 com Docker/QEMU;
essa etapa pode demorar porque compila o Qode. Depois, ele monta a extensão
piCore. As fontes e caches permanecem em `.cache/picore-arm64-work`, dentro de
`prototipo-nativo`, e ficam ignorados pelo Git.

O build piCore usa um container, cache e AppDir exclusivos: o container
`samnat-picore-arm64-builder`, o cache `.cache/picore-arm64-work` e o AppDir
`raspicore/build/SamNatSynthARM64.AppDir`. Isso permite executá-lo em paralelo
com o build Buildroot para Raspberry sem compartilhar o estado do APT ou os
arquivos de saída. A extensão final fica em
`raspicore/release-picore/SamNatSynth.tcz`.
Os arquivos `.deb` completos já baixados pelo outro build são copiados para o
cache isolado do piCore para evitar novo download; a instalação no container
piCore ocorre uma vez, pois cada container mantém seu próprio estado do dpkg.

O staging de cada execução fica em `.cache/picore-arm64-work/app-root/`, sem
apagar compilações anteriores. O empacotamento reutiliza o mesmo container
persistente do build ARM64; não reinstala dependências APT a cada execução. O
empacotador não inclui SoundFonts na extensão; ela declara a extensão oficial
`alsa.tcz` como dependência para disponibilizar os módulos de áudio do kernel.
O instalador copia somente cinco bancos de teste: `Pianos/k-pc88.sf2`,
`Pads/General_Montage_Pads_Warm.sf2`,
`Strings e Brass/General_Montage_Strings_Section.sf2`,
`Organs/General_Montage_Organs_Drawbar.sf2` e
`Synths/General_Montage_Leads.sf2`.

## 2. Preparar a imagem que já foi baixada

Grave a imagem piCore em um pendrive e expanda a partição ext4 `p2` para caber a
extensão, esses cinco SF2 e ao menos 512 MB livres. A imagem baixada tem uma
`p2` de 16 MB, insuficiente para o app e os SoundFonts. Depois de montar as
duas partições no Ubuntu, execute:

```sh
sudo ./raspicore/install-picore-usb.sh /ponto/de/montagem/da-p2 /ponto/de/montagem/da-p1
```

O primeiro argumento é a partição ext4 que contém `tce/`; o segundo é a
partição FAT de boot com `config.txt`. O instalador verifica espaço, copia a
extensão e somente os cinco SF2 listados acima sem sobrescrever arquivos
existentes, adiciona a extensão a `onboot.lst` (incluindo a dependência ALSA),
ativa o início automático e configura o overlay MPI3501/XPT2046. O primeiro
boot precisa de rede cabeada para baixar `alsa.tcz` e os módulos de kernel
ALSA, caso eles ainda não estejam em `tce/optional`. Para deixar o Pi sem
dependência de rede, ainda no Ubuntu e com as duas partições montadas, rode:

```sh
./raspicore/install-picore-alsa-usb.sh
```

O script usa por padrão `/media/$USER/piCore64_TCE` e
`/media/$USER/piCore64_14`; também aceita esses dois pontos de montagem como
argumentos. Ele identifica a versão do kernel pelo `config.txt`, baixa as
extensões ALSA correspondentes, confere os checksums antes e depois da cópia e
grava o log em `/tmp/samnat-picore-alsa-AAAAmmdd-HHMMSS.log`. Se ocorrer um
erro, mostra o comando e a linha que falharam, preserva o log e aguarda Enter
quando executado em um terminal interativo. Ele não grava a imagem nem altera
partições.

## 3. Diagnóstico no piCore

Após o primeiro boot, o app abre automaticamente no framebuffer. Os registros
persistem em `tce/samnat-synth-data/logs/startup.log` e os dados do app ficam
em `tce/samnat-synth-data/home/.samnat-synth`. Para inspecionar hardware no
console:

```sh
sudo /usr/local/bin/samnat-picore-check
```

Para desativar a inicialização automática, remova o marcador
`tce/samnat-synth-data/autostart`. O app pode então ser iniciado manualmente
com `sudo /usr/local/bin/samnat-picore-launch`.

O uso do painel depende do overlay `piscreen.dtbo` presente na imagem. O áudio
depende dos módulos ALSA do kernel piCore e de o sequenciador ALSA estar
disponível em `/dev/snd/seq`; o diagnóstico confirma esses dispositivos antes
de investigar MIDI ou FluidSynth.

### LCD MPI3501 e XPT2046 no piCore 14.1

Para a imagem com kernel `6.1.68-piCore-v8`, o script
`install-picore-lcd-usb.sh` instala o overlay `tft35a` do LCD-show e as
extensões gráficas e de toque específicas desse kernel. Elas devem estar no
cache `.cache/picore-lcd`, incluindo seus metadados e checksums. Com as duas
partições montadas no Ubuntu:

```sh
sudo ./raspicore/install-picore-lcd-usb.sh /media/$USER/piCore64_TCE /media/$USER/piCore64_14
```

O overlay SPI pode criar um framebuffer mesmo quando a tela está desconectada;
nesse caso o app pode escolher essa saída em vez do HDMI. Os arquivos
`config.before-samnat-lcd.txt` e `onboot.before-samnat-lcd.lst` preservam a
configuração anterior. O funcionamento e a calibração do toque precisam ser
verificados com a tela conectada e alimentação adequada.
