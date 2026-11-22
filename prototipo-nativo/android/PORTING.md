# SamNat Synth para Android

## Alvo

Primeiro alvo: Motorola Moto G52, modelo XT2221-2, codinome de desenvolvimento `rhode`. O aplicativo deve abrir em tela cheia e operar como appliance/kiosk, preservando o conjunto de recursos do SamNat Synth Linux. A interface e o áudio ficam em processo Android; não se inicializa um Linux Buildroot dentro do telefone.

O modelo XT2221-2 e o build Android atualmente instalado foram confirmados pelo inventário abaixo. Qualquer pacote de firmware precisa corresponder à variante regional e a esse aparelho. A imagem do G52 não deve ser trocada por uma imagem de G9 ou de outro modelo. O projeto LineageOS identifica o G52 como `rhode` e lista XT2221-1 e XT2221-2 como variantes suportadas; isso é uma referência técnica, não uma decisão de trocar a ROM Motorola.

### Inventário recebido do aparelho

- Modelo/dispositivo: `moto g52` / `rhode` / `rhode_g`.
- Android 13, API 33; build `T2SRS33.72-22-4-11`, fingerprint `motorola/rhode_g/rhode:13/T2SRS33.72-22-4-11/aeff8f-599c0:user/release-keys`.
- ABI disponível: `arm64-v8a` (também anuncia compatibilidade ARM de 32 bits).
- Bootloader reporta bloqueado (`ro.boot.flash.locked=1`) e Verified Boot verde. Portanto, a primeira entrega deve ser um APK sobre a ROM Motorola; não se deve planejar escrita em `/system`/`vendor` nem imagem customizada neste estágio.
- `/data` tem cerca de 101 GB livres no momento do inventário. SF2 e cenas devem ficar em armazenamento de dados, não nas partições do sistema.
- `/` e `/vendor` aparecem sem espaço livre na saída de `df`; isso não é espaço para o app instalar arquivos. Os SoundFonts não devem ser copiados para essas partições.

O inventário lista 22 apps de usuário (`pm list packages -3`), incluindo Shopee, Amazon Music, Kwai, TikTok, Facebook, apps de jogos/leitura e alguns apps Google. São candidatos a remoção do perfil dedicado sem tocar nas partições da ROM. A lista completa permanece na saída local do coletor; nenhum pacote foi desinstalado.

Não vou desativar pacotes de sistema apenas pelo nome. A lista inclui componentes de setup/operadora e vários serviços Motorola/Qualcomm; mesmo que alguns não apareçam na interface, podem estar ligados a áudio, USB, entrada, energia ou provisionamento. Para o primeiro APK, mantemos os serviços do fabricante e apenas tiramos apps opcionais do usuário da experiência do SamNat.

Entre os pacotes que ficam preservados no perfil inicial estão `com.android.bluetoothmidiservice` (MIDI Bluetooth), `com.google.android.documentsui` (seletor de SF2/SAF), `com.android.providers.media`, `com.android.providers.downloads`, `com.android.inputdevices`, `com.motorola.systemserver`, `com.dolby.daxservice` e `com.motorola.dolby.dolbyui`. O inventário por si só não prova que qualquer pacote é removível; a avaliação dos serviços do fabricante exige teste funcional no aparelho.

## Arquitetura proposta

- **Aplicativo:** Activity Android nativa, tela imersiva e modo kiosk administrado por Device Policy Controller quando o aparelho for provisionado como dedicado. A imagem original do fabricante continua responsável pelo kernel, drivers, HALs, áudio, energia e inicialização.
- **Interface:** Java com views Android nativas e uma view Canvas para o piano. A Activity recalcula a disposição em retrato/paisagem. Não usa NodeGui, Chromium, WebView ou Compose.
- **Motor de áudio:** `libfluidsynth` 2.6.0 compilada para `arm64-v8a` e chamada por JNI. O app envia os blocos renderizados pelo FluidSynth ao callback AAudio em 48 kHz; não compila drivers ALSA, PulseAudio ou JACK.
- **MIDI:** adaptador com `android.media.midi`, notificações de conexão/desconexão e seleção de dispositivo por parte. O módulo npm `midi` não será usado no Android.
- **Arquivos:** cenas e preferências no diretório privado do aplicativo; importação de SF2 pelo seletor de documentos Android. O motor recebe um caminho local temporário ou usa uma camada de leitura compatível com URI.
- **Distribuição:** primeiro um APK para instalação e validação kiosk sobre o Android Motorola original. A configuração de quiosque deve manter o framework, kernel, HALs e serviços de áudio do fabricante. Uma imagem customizada/debloat só será preparada depois de registrar o build original e identificar os pacotes que podem ser desativados sem quebrar atualizações, recuperação, áudio, toque ou boot.

## Paridade funcional a portar

1. Oito partes independentes, quantidade de slots dinâmica, SF2 por parte, banco/programa e volume independente.
2. Teclado virtual de cinco oitavas, toque de notas e notas de teste por parte.
3. Cenas salvas, cena inicial com oito timbres, nova cena, carregar/remover cena e pads de cena acionados por MIDI Learn.
4. Vários controladores MIDI simultâneos, conexão automática de dispositivos novos, roteamento por parte e seleção de controlador em cada parte.
5. Sustain, pitch bend positivo/negativo, CC de volume e modulação opcional por parte, além de reverb/chorus.
6. Teste de áudio independente do SoundFont, seleção/roteamento de saída compatível com Android e mensagens de estado.
7. Biblioteca e importação de SoundFonts, ícones de categoria e indicador de progresso de carregamento.
8. Indicador de bateria/carregamento/aviso de carga baixa, monitor básico de CPU/RAM e ajustes de brilho/volume adaptados às APIs Android.
9. Inicialização em tela cheia, manutenção da tela ativa durante uso e fluxo de saída/desligamento compatível com as permissões Android.

## Perfil appliance enxuto para o Moto G52

A meta é deixar o SamNat como única interface visível e reduzir processos e aplicativos opcionais, mantendo a ROM Motorola do XT2221-2 como base inicial. Isso não significa remover o Android até sobrar só o kernel: no telefone, o kernel não fornece sozinho a tela, o áudio ou o USB MIDI. O app depende do framework, dos serviços Android e dos componentes de hardware do fabricante.

**Manter:** bootloader e firmware do aparelho; kernel e módulos de toque, USB, áudio e energia; partições `vendor`/`odm` e HALs; SELinux; Binder; `system_server`; ART; SurfaceFlinger; AudioFlinger e política de áudio; serviços de entrada e USB/MIDI; serviços de bateria/energia; gerenciador de pacotes e seletor de arquivos (SAF). Manter rede se o app precisar baixar SoundFonts. Bluetooth fica habilitado para controladores BLE, se usados.

**Tirar da experiência do instrumento:** launcher e tela inicial comuns, configuração de contas, notificações, navegação para outros apps e aplicativos opcionais que forem confirmados como dispensáveis. O SamNat inicia como launcher dedicado e entra em Lock Task como Device Owner. A lista de pacotes a desativar só será fechada após coletar o inventário da ROM e testar áudio, touchscreen, USB MIDI, importação, bateria e atualização. Não apagar arquivos de `/system` ou `/vendor` manualmente.

Na primeira etapa, “mais magro” significa **menos apps e tarefas em segundo plano**, não uma partição Android minúscula. Para reduzir também o tamanho da ROM seria preciso criar uma imagem de sistema customizada para `rhode`, usando os binários proprietários de hardware; isso deixa de ser a imagem Motorola original e exige desbloqueio/flash. Não será tratado como equivalente ao Buildroot x86_64.

## Diferenças de plataforma que não podem ser copiadas literalmente

- `spawn('fluidsynth')`, o protocolo de shell, ALSA, `aplay`, `pactl`, `amixer` e caminhos `/proc` do Linux não são contratos disponíveis para um APK comum. Audio, MIDI, armazenamento, bateria e brilho precisam usar APIs Android.
- Um APK comum não tem permissão para desligar o aparelho. Para manter um botão de desligamento dentro do SamNat, será necessário incluir o app como componente privilegiado de uma imagem customizada. Na ROM Motorola sem privilégios de sistema, o app pode encerrar o modo appliance; o desligamento continua pelo botão físico/ações globais do Android.
- A ROM customizada não deve remover serviços Android essenciais. SurfaceFlinger, AudioFlinger/política de áudio, `system_server`, framework, HALs do fabricante, módulos de kernel, SELinux e gerenciamento de energia continuam necessários para a interface e o áudio funcionarem.
- Remover aplicativos pré-instalados é uma etapa de produto, não do APK. A lista só pode ser definida depois de identificar a variante e validar o firmware original; remover um pacote de sistema necessário pode quebrar boot, áudio, toque, atualizações ou recuperação.

## Estado do port

O módulo Android já gera um APK debug `arm64-v8a`. A base contém tela responsiva a retrato/paisagem, teclado multitoque de cinco oitavas, cenas persistidas, oito partes, importação local de SF2, seleção de presets, volume/reverb/chorus/modulação por parte, seleção de dispositivo MIDI por parte, hotplug de controladores, MIDI Learn para pads de cena e CC de volume, teste de áudio, seleção de saída AAudio, indicador de bateria/aviso abaixo de 20%, monitor CPU/RAM a cada cinco segundos, brilho F5/F6, volume inicial 30% e saída do app.

O APK não inclui os SoundFonts. A cena inicial reproduz os nomes/programas da versão Linux; o usuário pode baixar os 165 timbres do catálogo Angular, os quatro SF2 adicionais usados pela cena padrão, ou importar SF2 pelo seletor Android. Os arquivos ficam no armazenamento privado, sem incluir os 2,9 GB de SoundFonts no instalador. A porcentagem mostrada após o carregamento é uma estimativa baseada na memória do processo, não um contador interno exato do FluidSynth.

O build do APK foi feito neste ambiente; ainda é necessária validação física no XT2221-2 para áudio, MIDI USB/Bluetooth e a rotação real do painel. Um APK comum não consegue desligar o telefone; o botão fecha o instrumento. O modo de quiosque gerenciado depende de provisionar o app como Device Owner, enquanto selecionar SamNat como launcher padrão basta para o primeiro teste.

O script `collect-device-info.sh` coleta, sem alterar o telefone, o build instalado, ABI, estado do boot e lista de pacotes. O resultado recebido foi registrado em `moto-g52-xt2221-2.json`; ele serve como perfil da primeira instalação e separa pacotes opcionais observados de serviços que devem ficar preservados até a validação no aparelho.

## Referências do alvo

- Motorola identifica o modelo XT2221-2 como Moto G52: <https://es-latam.support.motorola.com/ci/fattach/get/79310321/1664839020/redirect/1/filename/XT2221-2%2BMoto%2BG52%2BM82DB%2BRED%2BDoC.pdf>.
- A página de instalação do LineageOS para `rhode` lista XT2221-1 e XT2221-2: <https://wiki.lineageos.org/devices/rhode/install/>.
- A documentação Android de Lock Task descreve o modo quiosque gerenciado: <https://developer.android.com/work/dpc/dedicated-devices/lock-task-mode>.
- A arquitetura oficial Android lista framework, serviços de sistema, HALs, bibliotecas nativas e kernel como camadas diferentes da plataforma: <https://source.android.com/docs/core/architecture>.
