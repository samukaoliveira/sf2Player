# 12. Diagnóstico de áudio, MIDI, vídeo e entrada

Um sistema completo tem muitas camadas. O diagnóstico eficiente começa no primeiro ponto que deveria funcionar, coleta evidência e só então atravessa a próxima fronteira. Não mude simultaneamente driver, mixer, biblioteca e interface: assim se perde a informação sobre qual alteração resolveu ou piorou o problema.

## 12.1 Árvore geral

~~~text
O app aparece?
 ├─ não → boot, sessão, Qode, plugin Qt, permissões, log
 └─ sim
     ├─ vê saídas? → enumeração ALSA/PulseAudio/PipeWire
     ├─ tom 440 Hz funciona? → PCM, dispositivo, mixer, saída física
     ├─ FluidSynth fica ready? → processo, driver, protocolo shell
     ├─ SF2 aparece como loaded? → caminho, parser, presets
     ├─ note-dispatched aparece? → MIDI/teclado, canal, roteamento
     └─ há som? → ganho, mixer, notas, canal e PCM do motor
~~~

Cada sucesso reduz a área da busca; não garante as etapas posteriores.

## 12.2 Nenhuma interface gráfica

1. Leia a última mensagem do boot e determine se o kernel chegou ao init.
2. Confirme que a partição root indicada pelo GRUB foi encontrada.
3. Inspecione tty1 e tente tty2 para manutenção.
4. Leia log de samnat-session, log do app e dmesg.
5. Confirme QT_QPA_PLATFORM=linuxfb e existência do plugin LinuxFB.
6. Inspecione /dev/fb0 e /dev/dri, mas não trate a ausência de um único nó como diagnóstico completo.
7. Confirme driver de vídeo vinculado ao hardware e firmware carregado.
8. Se aparecer Xorg, localize o script que o inicia: a imagem esperada remove S40xorg.

“no screens found” é erro do Xorg. A solução no projeto é não iniciar Xorg e usar LinuxFB; repetir a tentativa de Xorg não testa esse caminho.

## 12.3 Caracteres quadrados

Verifique fonte disponível, codificação e caminho Qt. A sessão exporta QT_QPA_FONTDIR e o Buildroot inclui DejaVu. Se faltam símbolos, determine se:

- a fonte contém o glifo;
- Qt carregou essa fonte;
- o texto chegou em UTF-8;
- o plugin de imagem SVG está disponível para ícones;
- o arquivo de ícone existe no AppDir.

Um glifo quadrado é diferente de um widget com fundo e texto invisíveis por stylesheet.

## 12.4 Mouse e touchpad

O serviço samnat-pointer usa libinput/udev e expõe um ponteiro via uinput. Investigue:

1. serviço ativo e log do sistema;
2. presença de /dev/uinput;
3. dispositivos em /dev/input;
4. caminho virtual publicado em /run/samnat-pointer/mouse-event;
5. variáveis Qt evdev da sessão;
6. se movimento relativo e clique chegam ao widget.

Para mouse USB conectado após boot, acompanhe eventos udev e verifique se o serviço continua vivo. Para touchpad com clique central ausente, separe clique mecânico de tap-to-click. A região central pode não ser um botão físico no hardware; libinput pode oferecer toque como clique, mas esse comportamento precisa estar configurado.

O ponteiro virtual reduz inconsistências entre dispositivos, mas se a calibragem/resolução ou evento relativo estiver incorreto, pode haver escala errada. Colete deltas e eventos antes de alterar coeficientes.

## 12.5 MIDI não aparece

Confirme primeiro:

~~~sh
cat /proc/asound/cards
ls -l /dev/snd
aplay -l
~~~

Para MIDI, o dispositivo decisivo é o sequenciador ALSA e as portas reportadas pelo módulo nativo. A ausência de /dev/snd/seq costuma indicar kernel sem sequenciador ALSA, dispositivo não inicializado ou node de dispositivo ausente.

Se o controlador aparece no sistema mas não no app:

- confirme MIDI package e addon nativo foram empacotados;
- consulte log de abertura da porta;
- verifique permissões de /dev/snd/seq;
- atualize a lista ou aguarde o próximo ciclo de hotplug;
- teste com um monitor MIDI externo para confirmar que a porta transmite.

Se MIDI chega mas não toca, registre bytes, canal, nota e velocity e acompanhe o roteamento por slot.

## 12.6 Teste de tom sem som

O teste direto gera PCM e o envia a uma saída. Se falha:

1. copie toda a mensagem e stderr;
2. veja se foi aplay ou paplay;
3. verifique se dispositivo/sink ainda existe;
4. confira busy, permissões, formato e taxa;
5. teste os controles físicos de mute e volume;
6. teste saída analógica e HDMI separadamente;
7. identifique quais dispositivos estão realmente presentes em aplay -l e pactl.

Um erro EPIPE é uma falha de pipe/processo ou escrita; não demonstra sozinho que o alto-falante está quebrado. Device or resource busy aponta abertura ocupada/indisponível. No teste direto, o app pausa FluidSynth para que ele libere o PCM antes de usar aplay.

## 12.7 Tom funciona, SF2 fica mudo

Esse resultado separa uma rota PCM básica funcional do caminho de síntese. Confirme:

1. worker online;
2. FluidSynth pronto e sem erro de driver;
3. arquivo SF2 existe e é legível;
4. worker emite loaded com banco/programa correto;
5. slot mostra ativo e volume diferente de zero;
6. note-on enviado no canal carregado;
7. não há sustain preso ou note-off ausente;
8. processo não encerrou e stderr não contém erro.

O teste do sininho/440 Hz e o SF2 podem usar processos e rotas diferentes. Somente o primeiro não valida a carga do banco.

## 12.8 Distorção ou corte de notas

Para distorção:

- reduza ganho mestre e volumes de partes;
- teste uma parte, depois layers;
- mantenha headroom antes da saída;
- compare gravação loopback, se disponível, com o som analógico;
- verifique volume do mixer e saturação do amplificador.

Para corte:

- verifique limite real de polifonia usado pelo worker;
- veja se a nota é encerrada por MIDI;
- desative sustain e efeitos para reduzir variáveis;
- teste SF2 pequeno e preset simples;
- monitore CPU, RAM e mensagens de underrun;
- repita com uma parte e depois várias.

O valor atual do código fonte é 256 vozes globais. O README do protótipo menciona 512; até reconciliar essa divergência, confie nos argumentos de execução e descreva a discrepância nos registros.

## 12.9 Bateria e brilho

A interface lê a bateria exposta pelo subsistema power_supply. Se não há bateria detectada, o estado pode ficar indisponível; isso não é equivalente a 0%. A atualização é periódica, então não deve ser interpretada como telemetria instantânea.

Atalhos de volume/brilho dependem de foco e mapeamento do teclado. Fn muitas vezes é tratado no firmware do laptop e nem sempre gera evento Linux. Verifique primeiro se a tecla aparece em evtest/libinput; então mapeie uma tecla ou atalho recebido para a ferramenta ALSA/sysfs adequada.

## 12.10 Como coletar um relatório útil

Um relatório mínimo deve incluir:

- modelo e revisão do computador;
- versão/checksum da imagem;
- modo de boot (UEFI ou BIOS);
- última mensagem de boot;
- estado de /dev/snd, /dev/fb0 e /dev/dri;
- saída de aplay -l e, se houver, pactl;
- logs do worker e stderr do utilitário;
- versão/nome do SF2, banco, programa e volume;
- passo exato que reproduz o erro.

Evite fotografias cortadas de mensagens: uma linha anterior costuma revelar qual processo iniciou a falha.

## Exercícios

1. Resolva um cenário por vez usando a árvore geral e anote o que cada sucesso comprova.
2. Produza um relatório de hardware de uma máquina x86_64 e outro de uma placa ARM.
3. Compare o log de um erro de biblioteca ausente com o de driver sem dispositivo.
4. Simule “tom funciona, SF2 não” e escreva uma sequência de coleta que isole o worker.
5. Liste os testes físicos necessários antes de publicar uma imagem para outro usuário.
