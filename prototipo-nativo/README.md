# Protótipo nativo do SamNat Synth

Este protótipo abre uma janela Qt nativa pelo NodeGui, sem navegador/Chromium. Ele usa um único `js-synthesizer`/FluidSynth executado no Node em uma thread de áudio, com quatro canais MIDI, seleção independente de SoundFont e CC 7 (volume) por canal.

## Rodar no Windows

Requer Node.js 22 ou superior e ferramentas de compilação C++ do Visual Studio para os módulos nativos.

```powershell
npm install
npm start
```

Escolha um arquivo SF2 para cada canal e clique em **Tocar nota**. Os quatro canais usam a mesma nota de teste (C4), mas cada slider controla somente o seu canal.

## Empacotar

O NodeGui Packer produz no Windows uma pasta distribuível com o executável e as DLLs necessárias, não um único `.exe` independente:

```powershell
npm run pack:init
npm run pack
```

É um protótipo de interface e áudio. Cenas, MIDI de entrada, efeitos e catálogo online ainda não foram migrados.
