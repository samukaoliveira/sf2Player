# SamNat Synth nativo

Aplicativo desktop em Node.js + NodeGui/Qt. A interface não carrega Chromium; o FluidSynth executa em um worker Node e envia áudio PCM ao ALSA (`aplay`).

## Recursos implementados

- Oito partes MIDI independentes, cada uma com arquivo SF2, banco, preset, volume, reverb e chorus.
- Teclado gráfico de duas oitavas e notas de teste por parte.
- Entrada MIDI selecionável, notas, sustain, modulação, pitch bend e MIDI Learn para associar CC ao volume de uma parte.
- Biblioteca local de SoundFonts, importação de SF2 e catálogo online inicial com nove instrumentos.
- Cenas salvas em `~/.samnat-synth/scenes.json` (no Windows, na pasta de usuário correspondente).
- Motor de áudio em thread separada, com uma instância FluidSynth compartilhada pelos oito canais.

## Executar

Requer Node.js 22+, Python, toolchain C/C++ compatível, Qt 5/6 e `alsa-utils` (para o comando `aplay`). NodeGui/MIDI compilam código nativo; no Windows instale Visual Studio Build Tools com C++ Desktop, e no Linux as dependências de desenvolvimento Qt indicadas pelo NodeGui.

```sh
cd prototipo-nativo
npm install
npm start
```

Na primeira execução, selecione um SF2 por parte ou importe arquivos para a biblioteca. Para MIDI, atualize a lista de entradas e conecte o dispositivo.

## Empacotar

O empacotador NodeGui gera uma pasta de distribuição com executável e bibliotecas; deve ser executado na plataforma alvo:

```sh
npm run pack:init
npm run pack
```

## Escopo ainda pendente

O catálogo local embarcado é uma seleção inicial, não todo o catálogo Angular. Também faltam login/cadastro e integração com API, presets enumerados por nome (o protótipo usa número de banco/preset), equalizador e filtros por parte, exportação/importação de cenas e polimento de estados de erro/instalação. O catálogo remoto depende do endpoint público já usado pelo app e requer conexão com a internet.
