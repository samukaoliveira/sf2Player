# SamNat Synth nativo

Aplicativo desktop em Node.js + NodeGui/Qt. A interface não carrega Chromium. O app usa o executável nativo FluidSynth em um worker Node, com saída direta para ALSA ou PulseAudio/PipeWire; o worker encaminha notas MIDI, presets e controles pelo shell do FluidSynth.

O Qode integra os loops de eventos do Node e do Qt. O app não deve chamar `app.exec()` diretamente: essa chamada bloqueia as mensagens do worker, os timers e os eventos dos processos de áudio.

## Recursos implementados

- Oito partes MIDI independentes, cada uma com arquivo SF2, banco, preset e volume por canal FluidSynth.
- Teclado gráfico de duas oitavas e notas de teste por parte.
- Detecção de saídas ALSA presentes por `aplay -l` e de sinks ativos PulseAudio/PipeWire por `pactl`; não mostra aliases ALSA sem dispositivo presente.
- Teste direto de saída com onda senoidal de 440 Hz e duração fixa: envia PCM por `paplay` no PulseAudio/PipeWire ou `aplay` no ALSA, isolado do FluidSynth, SoundFont e MIDI.
- Entrada MIDI selecionável, notas, sustain, modulação, pitch bend e MIDI Learn para associar CC ao volume de uma parte. O controlador toca todas as partes carregadas por padrão; o seletor MIDI permite usar apenas a parte correspondente ao canal transmitido.
- Biblioteca local de SoundFonts, importação de SF2 e catálogo online inicial com nove instrumentos.
- Cenas salvas em `~/.samnat-synth/scenes.json` (no Windows, na pasta de usuário correspondente).
- Motor de áudio em thread separada, com uma instância nativa do FluidSynth compartilhada pelos oito canais e abertura direta do driver de áudio escolhido.

## Executar

Para desenvolver/empacotar, requer Node.js 18+, Python, toolchain C/C++ compatível, Qt 6, FluidSynth (`fluidsynth` e `libfluidsynth`), `aplay`, `paplay` (pulseaudio-utils) e `libasound2-dev` para compilar o módulo MIDI nativo obrigatório. O AppImage inclui FluidSynth e suas dependências, `aplay`, `paplay`, configuração e plugins ALSA, o módulo MIDI e a biblioteca ALSA; para detectar controladores, o sistema Linux ainda precisa expor o sequenciador ALSA (`/dev/snd/seq`). NodeGui/MIDI compilam código nativo; no Windows instale Visual Studio Build Tools com C++ Desktop, e no Linux as dependências de desenvolvimento Qt indicadas pelo NodeGui.

```sh
cd prototipo-nativo
npm install
npm start
```

Na primeira execução, o app carrega automaticamente `FluidR3_GM.sf2` se estiver instalado em um caminho padrão. Caso contrário, baixe/import um SF2 e selecione-o em uma parte; toque no teclado virtual de duas oitavas. O MIDI é procurado ao iniciar; conecte o controlador e use “Atualizar MIDI” para atualizar a lista.

## Empacotar no Linux x86_64

O script monta um AppDir com Qode, Qt, o app, FluidSynth e suas bibliotecas, o módulo MIDI compilado, a biblioteca/configuração ALSA e os utilitários de diagnóstico `aplay` e `paplay`, e gera um AppImage em `release-linux/`. O AppImage não depende da montagem FUSE durante a criação:

```sh
npm run pack:linux
```

O AppImage é específico para Linux x86_64 e precisa de FUSE para abrir diretamente. Se o sistema não tiver FUSE, extraia com `./SamnatSynthNative-x86_64.AppImage --appimage-extract` e execute `./squashfs-root/AppRun`.

## Escopo ainda pendente

O catálogo local embarcado é uma seleção inicial, não todo o catálogo Angular. Também faltam login/cadastro e integração com API, presets enumerados por nome (o protótipo usa número de banco/preset), equalizador e filtros por parte, exportação/importação de cenas e polimento de estados de erro/instalação. O catálogo remoto depende do endpoint público já usado pelo app e requer conexão com a internet.
