# 11. Empacotamento e reprodução do build

Este capítulo transforma o mapa da arquitetura em uma sequência reproduzível. Os comandos descrevem a configuração atual do repositório. A imagem é x86_64; não serve como imagem Raspberry Pi nem como imagem genérica de tablet ARM.

## 11.1 Ambiente de compilação

A aplicação nativa requer Node.js 18 ou superior, npm, Python, compilador C/C++, dependências de desenvolvimento Qt/NodeGui, ALSA headers, FluidSynth, aplay, paplay, pactl e ferramentas para criar AppImage. O package.json fixa NodeGui 0.58.0 e declara MIDI como dependência nativa.

O script de empacotamento verifica pré-requisitos ao montar a distribuição. Ele pode falhar por falta de pacote no host mesmo que o código JavaScript esteja correto. Leia a primeira mensagem de erro: ela costuma identificar a biblioteca, plugin ou comando ausente.

Antes de baixar dependências, confirme o host:

~~~sh
uname -m
node --version
npm --version
python3 --version
make --version
qmake6 --version
pkg-config --modversion fluidsynth
aplay --version
command -v paplay pactl fluidsynth qmake6
~~~

O alvo desta cadeia é Linux x86_64. Em uma máquina ARM, a compilação do AppImage bloqueia deliberadamente; para criar uma imagem Raspberry Pi é necessário selecionar outra arquitetura, toolchain, kernel, bootloader, plugin gráfico e validar NodeGui/Qt e FluidSynth para ARM.

## 11.2 Empacotar a aplicação

~~~sh
cd /caminho/para/sf2Player/prototipo-nativo
npm ci
npm run pack:linux
~~~

Se package-lock.json estiver ausente ou tiver sido alterado intencionalmente, use npm install e revise o lockfile antes de publicar. O script prepare-linux.cjs prepara build-linux com index.js, audio-worker.cjs, catálogo, ícones, logo e módulos de runtime filtrados. O script pack-linux.cjs cria AppDir com Qode, Qt, binários de áudio, FluidSynth, plugins ALSA, bibliotecas selecionadas e AppRun, depois produz AppImage.

O empacotador é específico para Linux x86_64. Ele mantém a glibc do host para preservar compatibilidade ABI; não tente copiar arbitrariamente outra glibc para o AppDir. Bibliotecas não-glibc são descobertas por ldd e copiadas segundo a lista configurada.

## 11.3 Construir a imagem embarcada

~~~sh
cd /caminho/para/sf2Player/prototipo-nativo
./embedded/build-image.sh
~~~

O script exige que o AppDir já exista; por isso a ordem normal é empacotar a aplicação e depois construir a imagem. O Buildroot oficial fica, por padrão, em /tmp/samnat-buildroot-source; a saída e cache ficam em /tmp/samnat-buildroot-output. Eles são reutilizados entre execuções.

Para preservar essas pastas em outro volume:

~~~sh
BUILDROOT_SOURCE=/caminho/persistente/buildroot-source \
BUILDROOT_OUTPUT=/caminho/persistente/buildroot-output \
./embedded/build-image.sh
~~~

O número de jobs pode ser ajustado com JOBS. Um valor muito alto pode causar falta de RAM; um valor baixo alonga a compilação. Mantenha BUILDROOT_SOURCE e BUILDROOT_OUTPUT existentes entre builds para reaproveitar fontes e objetos. Não execute make clean nem apague esses diretórios se deseja continuar a compilação incremental.

Para escolher o SF2 inicial:

~~~sh
SAMNAT_DEFAULT_SF2=/caminho/para/timbre.sf2 ./embedded/build-image.sh
~~~

O script baixa Buildroot 2026.08 se a fonte não existir e o Buildroot baixa a toolchain externa selecionada pela configuração. Em uma compilação já configurada, arquivos baixados e objetos permanecem nos diretórios de trabalho. Uma limpeza intencional de Buildroot remove produtos recuperáveis, mas obriga recompilar.

## 11.4 Artefatos gerados

O script publica:

- AppImage Linux x86_64 em prototipo-nativo/release-linux;
- imagem de disco descompactada em /tmp/samnat-buildroot-output/images;
- imagem comprimida SamNatSynthEmbedded-x86_64.img.gz no release-linux;
- checksum SHA-256 ao lado da imagem.

Confirme data, tamanho e checksum antes de gravar. A imagem comprimida é menor que a imagem em disco e precisa ser expandida durante a gravação.

## 11.5 Gravar num USB de teste

Antes de escrever, identifique o USB inteiro com lsblk. Desmonte suas partições e confira novamente o nome. O destino do dd deve ser o disco, por exemplo /dev/sdX, sem número de partição. Um erro no destino apaga outro disco.

~~~sh
lsblk -o NAME,SIZE,MODEL,TRAN,FSTYPE,MOUNTPOINTS
sudo umount /dev/sdX1 /dev/sdX2 /dev/sdX3
gzip -dc release-linux/SamNatSynthEmbedded-x86_64.img.gz \
  | sudo dd of=/dev/sdX bs=4M conv=fsync status=progress
sync
~~~

Depois confira a tabela com lsblk. Remova o USB com segurança e inicialize a máquina escolhendo a mídia no menu UEFI/BIOS. Em muitas máquinas é necessário desativar Secure Boot.

## 11.6 Conferir a imagem sem gravar

Para examinar o conteúdo em ambiente de desenvolvimento, liste as partições com uma ferramenta apropriada de loop/partição, monte-as somente para leitura e inspecione GRUB, rootfs e data. Não faça manutenção diretamente enquanto estão montadas em leitura/escrita pelo sistema.

Antes de distribuir a imagem:

- confira SHA-256;
- confira presença dos SF2 esperados;
- confira que a imagem usa BIOS e UEFI;
- inicialize em pelo menos um sistema alvo;
- teste touchpad, mouse USB hotplug, teclado, MIDI, áudio analógico e HDMI;
- confirme acesso ao console de manutenção;
- teste instalador somente em disco descartável.

Uma compilação bem-sucedida prova que os artefatos foram produzidos. Não prova que o hardware real inicializa nem que áudio, MIDI e vídeo funcionam naquele laptop.

## 11.7 Atualizar somente a aplicação

Uma alteração de JavaScript ou ícones exige reconstruir o AppImage e a imagem embarcada para incluí-la. Uma alteração em kernel config, overlay, package C ou instalador exige a imagem Buildroot. Alterar apenas arquivos no USB pode servir para diagnóstico, mas uma imagem nova precisa incorporar a mesma correção no post-build/overlay para ser reproduzível.

Para instalar um novo SF2 em runtime, copie para /data/home/.samnat-synth/soundfonts, desde que haja espaço e o arquivo seja legalmente redistribuível. Para embutir o SF2 na próxima imagem, coloque-o em prototipo-nativo/soundfonts antes do post-image.

## 11.8 Registro da compilação

Para tornar o resultado auditável, mantenha junto da imagem:

- commit ou hash da árvore de fontes;
- versão de Node.js, npm e sistema host;
- versão do Buildroot e da toolchain;
- configuração final do kernel;
- lista de SF2 e licenças;
- checksum da imagem;
- notas de hardware testado;
- logs de falhas e correções.

Esse registro permite saber se um boot diferente veio de código, toolchain, timbres ou equipamento.

## Exercícios

1. Faça o pack:linux e localize o AppRun e o plugin LinuxFB no AppDir.
2. Rode build-image.sh duas vezes preservando os diretórios de trabalho; observe quais etapas são reaproveitadas.
3. Compare checksum de duas imagens construídas com fontes iguais.
4. Faça um inventário de dependências compartilhadas do FluidSynth e do plugin Qt.
5. Escreva um procedimento de liberação com checksum, verificação de USB e teste em hardware.
