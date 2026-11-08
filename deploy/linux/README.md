# Kiosk Linux do Samnat Synth

O projeto gera pacotes Electron separados para x64 e ARM64. A instalação kiosk
usa uma base mínima Debian sem ambiente de desktop, Xorg apenas para a janela
Electron, ALSA do sistema e NetworkManager para obter os timbres pela internet.

## Empacotar o app

Execute em um host Linux com as dependências npm instaladas. Os pacotes usam o
build de produção do Angular:

```sh
npm run build:linux:x64
npm run build:linux:arm64
```

O `electron-builder` gera os diretórios `release/linux-unpacked` e
`release/linux-arm64-unpacked`, respectivamente. O app Angular é compilado uma
vez em cada comando e incluído no pacote. Electron atual publica Linux ARM64 e
x64; Linux ARM de 32 bits não é alvo deste projeto.

## Preparar uma instalação kiosk

- Raspberry Pi: grave uma imagem **Raspberry Pi OS Lite 64-bit** compatível com
  o modelo e inicialize uma vez para atualizar o sistema.
- PC: instale Debian 64-bit sem ambiente gráfico, sem servidor SSH se não for
  necessário e sem a seleção “Debian desktop environment”.
- Copie o diretório `linux-unpacked` da arquitetura correta para a máquina.
- Execute, por exemplo:

```sh
sudo deploy/linux/install-kiosk.sh ./release/linux-arm64-unpacked
```

Use `release/linux-unpacked` no PC x64. O instalador adiciona Xorg, bibliotecas
de runtime do Electron e NetworkManager; cria um usuário dedicado; configura
login automático no TTY1 e inicia o synth em tela cheia. Ele não instala
ambiente de desktop, painel, navegador separado ou terminal gráfico.

Configure Wi-Fi antes de operar o app, usando `nmcli` por SSH ou teclado no TTY
de manutenção. A conexão é necessária para baixar SoundFonts. USB MIDI depende
de o kernel e o dispositivo aparecerem no ALSA; o usuário kiosk é adicionado
ao grupo `audio` quando esse grupo existe.

## Imagens e suporte de hardware

Esta primeira etapa fornece o pacote multi-arquitetura e uma instalação
repetível sobre uma base mínima. Ela ainda não produz um único arquivo `.img`
ou ISO: Raspberry Pi e PC precisam de imagens de boot distintas, com firmware e
kernel próprios. Depois de validar o pacote, o próximo passo é automatizar a
imagem Raspberry e a imagem PC separadamente.

O Raspberry Pi Zero 2 W é ARM64, mas tem 512 MB de RAM. O sistema enxuto reduz
o consumo de fundo, porém não reduz a memória usada pelo Electron, pelo
WebAssembly do synth ou pelos SoundFonts carregados. O perfil de memória e o
áudio precisam ser medidos no hardware antes de declarar esse modelo suportado.
