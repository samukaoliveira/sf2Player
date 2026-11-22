# 7. Estado, cenas, controladores e teclado virtual

Uma interface musical precisa manter acordo entre o que o músico vê e o que o motor está tocando. Este capítulo percorre os fluxos mais importantes da aplicação nativa: slots, cenas, roteamento MIDI, MIDI Learn e teclado virtual.

## 7.1 O slot como unidade de mixagem

O slot representa uma parte musical carregada. No app atual, o modelo de slot mantém canal, arquivo SF2, banco, programa, nome de preset, volume, chorus, reverb, modulação, roteamento MIDI, estado de carregamento e controles visuais associados.

O estado inicial contém um slot vazio. “Adicionar slot” cria linhas sob demanda, até oito. Isso evita ocupar a tela com canais sem uso. Ao carregar uma cena com tamanho diferente, o app ajusta o número de slots e descarrega instrumentos anteriores; ao iniciar uma cena nova, volta a um slot vazio.

Cada linha combina widgets Qt:

- rótulo e ícone de categoria do instrumento;
- controle para escolher SF2;
- seletores de banco e programa;
- indicador de progresso/carregamento em memória;
- slider de volume;
- controles de efeitos;
- permissão individual de modulação;
- teste de nota;
- seletor de controlador para aquele slot.

O ícone é uma apresentação da categoria inferida pelo nome do preset ou banco. Ele não altera o instrumento nem confirma sua classificação musical.

## 7.2 Volume por parte e volume mestre

Volume de parte e volume mestre atuam em pontos diferentes:

~~~text
vozes da parte → ganho/CC de canal → soma das partes → ganho do motor
              → mixer ALSA/servidor de áudio → saída física
~~~

O slider de cada slot atualiza volume do canal; o volume mestre do sistema controla a saída ALSA escolhida pelos atalhos/utility. Um canal com volume zero pode continuar carregado e usar memória, mas não deve contribuir audivelmente da mesma forma. Na cena padrão, o piano do canal 1 fica em 100% e as outras sete partes iniciam em 0%; isso permite preparar um layer sem tocar imediatamente todas as partes.

## 7.3 A cena como estado serializado

A cena guarda nome, disparador MIDI e slots. Cada slot persiste caminho do SF2, canal, banco, programa, volume, efeitos, modulação, controlador e associação de volume MIDI Learn.

O processo de carregar é ordenado:

1. localizar a cena pelo nome;
2. impedir operações concorrentes de cena;
3. pedir ao worker para limpar SoundFonts, controladores e notas;
4. esperar confirmação de limpeza;
5. ajustar a quantidade exata de linhas;
6. restaurar valores da cena em cada linha;
7. pedir ao worker para carregar os arquivos existentes e selecionar programas;
8. mostrar arquivos ausentes sem abortar a cena inteira.

Esse protocolo resolve um bug clássico de mixer: ocultar a terceira linha sem descarregar o SF2 do canal. A interface pode esconder um widget, mas só o motor sabe se a fonte sonora ainda está carregada.

## 7.4 Cena inicial de oito partes

Na fonte atual, a cena “Cena inicial” inclui os seguintes timbres e programas:

| Canal | SF2 relativo | Programa solicitado | Volume inicial |
| ---: | --- | ---: | ---: |
| 1 | Pianos/k-pc88.sf2 | 0 | 100% |
| 2 | Pads/General_Montage_Pads_Warm.sf2 | 89 | 0% |
| 3 | Strings e Brass/General_Montage_Strings_Section.sf2 | 48 | 0% |
| 4 | Organs/General_Montage_Organs_Drawbar.sf2 | 16 | 0% |
| 5 | Pianos/General_Montage_DX7.sf2 | 5 | 0% |
| 6 | Synths/General_Montage_Leads.sf2 | 81 | 0% |
| 7 | General_Montage_Bells.sf2 | 6 | 0% |
| 8 | Bells e FX/General_Montage_FX.sf2 | 96 | 0% |

O código resolve cada caminho primeiro na biblioteca persistente e depois no diretório de SoundFonts empacotados. Se o arquivo estiver ausente, a cena informa a falta. Assim o JSON não deve pressupor que toda instalação possua exatamente os mesmos bancos.

Programas listados são a solicitação inicial, não garantia de que o preset com aquele banco/programa exista. O worker escolhe o preset solicitado se disponível e pode cair no primeiro preset do arquivo se não encontrar; a resposta loaded informa se houve fallback. Um manual de reprodução deve registrar esse comportamento porque é diferente de uma falha de áudio.

## 7.5 Persistência e versão do formato

JSON é conveniente para cenas por ser legível e editável. Ao salvar, o app converte o estado vivo dos slots para dados simples. Ao ler, valida o formato, limita slots ao máximo, normaliza valores numéricos, verifica arquivos e restaura defaults para campos que faltam.

Para uma versão futura do produto, acrescente uma versão de esquema, por exemplo schemaVersion: 2. Ao iniciar, migre campos antigos para a estrutura nova antes de montar os widgets. Sem versão explícita, o código precisa inferir formato pela presença dos campos, o que fica mais difícil conforme surgem funcionalidades.

## 7.6 Vários controladores

O sistema monitora portas MIDI e abre as que aparecem. Um primeiro controlador conectado pode se tornar padrão; cada slot pode herdar esse padrão ou apontar para uma porta específica. O identificador interno combina nome e ocorrência, pois duas portas podem ter o mesmo nome.

Roteamento precisa definir:

- qual porta está conectada;
- qual porta é padrão;
- se um slot herda o padrão ou escolhe uma porta;
- quais canais MIDI daquela porta são relevantes;
- como agir quando a porta é removida;
- se a associação salva deve ser restaurada quando o dispositivo retornar.

Salvar apenas o índice da porta é frágil: a ordem pode mudar. Guardar nome/identidade mais estado desconectado permite apresentar “controlador salvo, aguardando reconexão”. Dispositivos idênticos ainda podem compartilhar nome; quando necessário, use caminho ALSA/USB estável se a biblioteca expuser essa informação.

## 7.7 Interpretação de mensagens

O handler principal lê o byte de status e separa comando e canal. Para mensagens de canal:

~~~text
comando = status & 0xF0
canal   = status & 0x0F
~~~

O código trata Note On, Note Off, Note On com velocity zero, Control Change e Pitch Bend. Eventos de uma porta são direcionados aos slots associados. Uma nota MIDI pode ser enviada em todas as partes carregadas por padrão ou somente a parte do canal/roteamento selecionado, conforme a configuração do app.

Pitch bend tradicional junta dois valores de 7 bits. O valor central é 8192; valores menores e maiores representam direções opostas. O receptor e o programa definem alcance musical, por isso um deslocamento de 1 semitom não é codificado universalmente na mensagem.

## 7.8 MIDI Learn sem ambiguidades

Para controlar volume por CC:

1. clique no botão Learn do slider;
2. envie um controle físico;
3. o app armazena o número do CC na parte;
4. mensagens futuras daquele controlador atualizam slider, rótulo e worker;
5. salvar a cena persiste a associação.

A associação é específica do slot e pode ser filtrada por controlador. Um evento de modulação CC1 não deve alterar volume se o destino estiver associado ao mesmo CC sem uma regra clara. Por isso o código primeiro trata controles musicais relevantes e depois verifica aprendizagem; ao ampliar o mapa de destinos, defina precedência e feedback visual.

Pads de cena podem aprender Note On ou CC, dependendo do controlador. Um acionamento de cena deve ser consumido antes de encaminhar nota para o motor quando o mesmo evento foi reconhecido como disparador.

## 7.9 Teclado virtual de cinco oitavas

O teclado atual gera notas MIDI 36 a 95, 60 teclas cromáticas, que o código nomeia de C2 a B6. Teclas brancas são botões de altura completa; pretas são sobrepostas, mais estreitas e menores. O resize calcula posições proporcionais à largura atual do widget, então o teclado se ajusta ao tamanho da janela.

Ao pressionar:

1. a interface registra a origem visual “teclado virtual” para aquela nota;
2. envia note-on com velocity de teste;
3. o worker distribui a nota às partes roteadas;
4. quando liberada, a interface remove apenas a origem visual correspondente;
5. envia note-off aos mesmos canais em que o note-on foi iniciado.

Guardar os canais do note-on é essencial. Se roteamento mudar entre pressionar e soltar, enviar o note-off para a lista atual pode deixar uma voz presa no canal antigo.

## 7.10 Realce de notas tocadas

O teclado realça notas de mouse e MIDI. O app mantém, para cada número de nota, um conjunto de fontes ativas. A tela pinta a tecla ativa enquanto o conjunto não está vazio.

Exemplo:

~~~text
nota 60 → { teclado virtual, controlador A}
soltar teclado virtual → { controlador A } → continua destacada
soltar controlador A → conjunto vazio → volta à cor normal
~~~

Quando uma porta MIDI é removida ou uma cena é limpa, o app remove as origens daquela porta ou todas as origens. Sem limpeza, uma nota visual poderia ficar presa mesmo depois de o motor ter encerrado a voz.

## 7.11 Exercícios

1. Salve uma cena com dois slots e carregue depois a cena padrão de oito. Conte operações de UI e worker.
2. Carregue uma cena cujo SF2 foi movido. Descreva a recuperação sem perder as outras partes.
3. Use dois controladores que enviam a mesma nota e verifique se a tecla visual só apaga depois de ambas soltarem.
4. Associe um pad a uma cena e um slider a um CC. Registre canal, tipo, número e origem.
5. Troque o volume de uma parte e o volume mestre. Identifique onde cada um atua.
