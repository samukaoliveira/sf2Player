# Apêndice A — Mapa do código

Os caminhos são relativos à raiz do repositório.

| Arquivo/pasta | Papel |
| --- | --- |
| [src/app](../../src/app) | aplicação Angular original |
| [componente Angular do teclado](../../src/app/components/keyboard) | interface Angular do teclado, cenas, slots e MIDI |
| [package.json nativo](../../prototipo-nativo/package.json) | dependências e scripts NodeGui |
| [index.js](../../prototipo-nativo/src/index.js) | janela Qt, estado de UI, MIDI, cenas, áudio e comunicação com worker |
| [audio-worker.cjs](../../prototipo-nativo/src/audio-worker.cjs) | processo FluidSynth, drivers, notas, presets, efeitos e restauração |
| [catálogo SoundFont](../../prototipo-nativo/src/soundfont-catalog.json) | catálogo local/online usado pelo protótipo |
| [ícones nativos](../../prototipo-nativo/src/icons) | SVGs da aplicação nativa |
| [prepare-linux.cjs](../../prototipo-nativo/scripts/prepare-linux.cjs) | staging do runtime NodeGui/Qt e arquivos da aplicação |
| [pack-linux.cjs](../../prototipo-nativo/scripts/pack-linux.cjs) | construção do AppDir/AppImage e cópia de dependências |
| [defconfig Buildroot](../../prototipo-nativo/embedded/configs/samnat_x86_64_defconfig) | configuração Buildroot do sistema |
| [linux.config](../../prototipo-nativo/embedded/board/samnat/linux.config) | configuração-base do kernel |
| [linux.fragment](../../prototipo-nativo/embedded/board/samnat/linux.fragment) | opções adicionais do kernel |
| [rootfs-overlay](../../prototipo-nativo/embedded/board/samnat/rootfs-overlay) | arquivos adicionados ao root filesystem |
| [scripts post-build](../../prototipo-nativo/embedded/board/samnat) | ajustes e verificações do rootfs |
| [post-image-dual.sh](../../prototipo-nativo/embedded/board/samnat/post-image-dual.sh) | SF2, dimensão de /data e imagem bootável |
| [genimage-dual.cfg](../../prototipo-nativo/embedded/board/samnat/genimage-dual.cfg) | partições BIOS, EFI, raiz e dados |
| [samnat-pointer](../../prototipo-nativo/embedded/package/samnat-pointer) | ponteiro C com libinput, udev e uinput |
| [build-image.sh](../../prototipo-nativo/embedded/build-image.sh) | orquestra Buildroot e publica imagem compactada |
| [instalador](../../prototipo-nativo/embedded/board/samnat/rootfs-overlay/usr/local/sbin/samnat-install) | instalador para SSD |
| [SoundFonts](../../prototipo-nativo/soundfonts) | bancos incluídos na imagem |
| prototipo-nativo/release-linux | saídas de distribuição, não fontes |

## Navegar pelo fluxo de uma ação

Para investigar uma nota do teclado virtual, comece na criação dos QPushButton no index.js, encontre o listener pressed/released, localize a chamada worker.postMessage, siga o tipo note-on/note-off no audio-worker.cjs e termine na chamada de comando FluidSynth.

Para investigar uma cena, comece em saveScene, leia o JSON, siga loadSceneByName → beginSceneOperation → clear-all no worker → applyScene → load-soundfont/program/volume.

Para investigar boot, comece em genimage-dual.cfg, veja as entradas GRUB copiadas pelo post-image-dual.sh, siga a linha de kernel até root PARTUUID, depois inittab → rcS → S99samnat-data → samnat-session → AppRun.

Para investigar uma biblioteca ausente, comece pelo binário que falha, examine ldd, localize o script que o copia e confirme o caminho LD_LIBRARY_PATH da sessão. A verificação deve ocorrer na arquitetura x86_64 alvo, pois o host e o Buildroot podem fornecer ABIs diferentes.
