# Apêndice D — Referência das classes e APIs NodeGui/Qt

Este apêndice é um mapa de leitura do index.js, não uma cópia integral da documentação da biblioteca. As assinaturas exatas devem ser confirmadas na versão fixada pelo projeto: @nodegui/nodegui 0.58.0. NodeGui expõe wrappers nativos; chamadas de métodos normalmente atravessam o binding até objetos Qt.

## D.1 Ciclo de aplicação e janela

| Tipo | Conceito Qt | Uso no SamNat |
| --- | --- | --- |
| QApplication | contexto da aplicação e eventos | criado no início do processo para configurar Qt |
| QMainWindow | janela principal | recebe título, dimensões, widget central e eventos de fechamento |
| QWidget | elemento/contêiner visual | compõe cabeçalho, painéis, linhas, teclado e diálogos |
| WidgetEventTypes | enum de eventos de widget | trata resize do keybed para recalcular geometrias |
| AlignmentFlag | alinhamento de conteúdo | centraliza a mensagem de estado |

O widget central é instalado com setCentralWidget. Widgets filhos e layouts formam uma árvore. A relação de pai ajuda Qt a destruir objetos filhos junto ao contêiner. Em NodeGui, descarte de widget deve seguir a API e não ser feito enquanto callbacks ainda guardam referências.

O aplicativo não chama manualmente QApplication.exec no fluxo Qode. Qode integra o runtime Node e Qt. O event loop entrega clique, repaint e timer; bloqueá-lo congela a tela mesmo que o worker de áudio continue vivo.

## D.2 Layouts e enums

| Tipo | Papel |
| --- | --- |
| QBoxLayout | organiza widgets em linha ou coluna |
| QGridLayout | organiza teclas em células de grade |
| Direction | define TopToBottom ou LeftToRight |
| Orientation | define Horizontal ou Vertical |

Métodos que aparecem com frequência:

- setLayout associa layout a um widget;
- addWidget insere widget, eventualmente com stretch;
- addLayout insere um layout filho;
- addStretch reserva espaço expansível;
- setContentsMargins define margens externas;
- setSpacing define distância entre itens;
- setStretch controla a divisão proporcional;
- setGeometry define retângulo manual;
- setFixedHeight e setMinimumSize restringem tamanho.

Prefira layouts para painéis comuns. Geometria manual é apropriada para a sobreposição de teclas do piano, desde que resize refaça o cálculo. Não aplique stretch a centenas de colunas esperando que ele dê precisão de pixel; a política de tamanho do widget participa do resultado.

## D.3 Texto, botões e seleção

| Tipo | Conceito | Métodos/eventos típicos usados |
| --- | --- | --- |
| QLabel | texto/imagem não editável | setText, setPixmap, setToolTip, setAlignment, setWordWrap |
| QPushButton | ação clicável e tecla visual | setText, setEnabled, setIcon, setIconSize, setGeometry, raise, pressed/released/clicked |
| QComboBox | seleção de item | addItem, clear, currentIndex, setCurrentIndex, currentIndexChanged |
| QLineEdit | entrada curta | text, setText, textChanged |
| QCheckBox | booleano | setChecked, isChecked, setEnabled, toggled |

Um evento clicked representa ação; pressed e released são úteis para nota sustentada, pois a duração do botão corresponde à duração da nota. Um clique simples no Qt pode ser emitido depois que o botão é solto; escolha o evento conforme a semântica musical.

## D.4 Controles de valor e progresso

| Tipo | Uso | Nota de implementação |
| --- | --- | --- |
| QSlider | volume, chorus, reverb | defina intervalo e valor antes de ligar callback, ou use flags de sincronização |
| QProgressBar | progresso do SoundFont | distingue operação em andamento de arquivo carregado |
| QCheckBox | habilitar modulação | sincronize estado visual e estado confirmado pelo worker |

No callback de slider, converta o número para unidade do domínio. Um controle 0–100 pode converter para CC MIDI 0–127; arredondamento e limites devem ser explícitos. Ao restaurar uma cena, alterar o slider pode disparar callback; as flags syncingControls/syncingPreset evitam enviar comandos duplicados durante reconstrução.

## D.5 Arquivos, diálogos e atalhos

| Tipo | Papel | Valores relacionados |
| --- | --- | --- |
| QFileDialog | selecionar SF2 | FileMode.ExistingFile |
| QDialog | modal de seleção/áudio | exec, accept, reject |
| DialogCode | resultado de diálogo | Accepted permite aplicar escolha |
| QShortcut | atalho de teclado | associado a QKeySequence e contexto |
| QKeySequence | representação de atalho | F11, F12 e combinações Ctrl |
| ShortcutContext | escopo do atalho | janela ou widget conforme foco |

Diálogos devem devolver resultado, não alterar estado do motor durante a montagem do formulário. Construa as opções, espere aceitação e só então aplique. Para operações longas, o diálogo apresenta progresso e continua assíncrono.

Atalhos podem deixar de funcionar se o widget em foco captura a tecla ou se o teclado envia um código diferente. Em laptop, Fn pode ser tratado no firmware e não produzir key event Linux. A primeira etapa é observar a tecla no sistema.

## D.6 Ícones e recursos

| Tipo | Papel |
| --- | --- |
| QIcon | carrega ícone SVG/bitmap |
| QSize | define dimensões do ícone |

O app consulta a pasta icons em runtime e define ícones por categoria ou ação. A existência de um SVG não garante que Qt saiba renderizar SVG: o plugin de imagem deve estar no AppDir. A alternativa para firmware mínimo é rasterizar para PNG, que aumenta o conjunto de bitmaps, mas reduz dependências SVG.

Recursos externos devem ser localizados a partir do diretório do módulo JavaScript atual ou de uma pasta da instalação, não do diretório de trabalho atual. O usuário pode iniciar AppRun de qualquer diretório.

## D.7 Classes de runtime que não são widgets

| Classe/API Node | Papel no aplicativo |
| --- | --- |
| Worker de worker_threads | executa coordenação do FluidSynth fora da UI |
| child_process.spawn | cria FluidSynth, aplay ou paplay como subprocesso |
| Buffer | guarda amostras PCM do tom de teste |
| EventEmitter/EventTarget do Node | entrega evento de saída, erro e encerramento de subprocesso |
| Promise | representa operação assíncrona e ordena respostas |
| Map e Set | cacheia bancos, conexões MIDI e origens de notas pressionadas |
| fs | lê catálogo/cenas, verifica e grava arquivos |
| path | compõe caminhos conforme sistema |
| os | localiza diretório do usuário e informações da máquina |
| setTimeout/setInterval | watchdog de áudio e atualização de CPU/bateria |

Essas APIs seguem o runtime Node e não o Qt. Um callback de subprocesso no worker não pode acessar widget diretamente; envie uma mensagem ao processo principal, que atualiza a UI no loop Qt.

## D.8 Equivalências para quem vem de Angular

| Angular/browser | NodeGui/Qt | Cuidado de portabilidade |
| --- | --- | --- |
| Component class | função/fábrica que cria widget e estado | não há ciclo Angular automático |
| Template | árvore de widgets criada em JavaScript | ordem e ownership ficam explícitos |
| @Input | argumento de fábrica ou método de atualização | normalize antes de montar widget |
| @Output/EventEmitter | sinal Qt exposto por listener ou callback JS | remova listeners ao destruir objeto |
| Change detection | setText/setValue/setChecked no widget | mudança de objeto não redesenha sozinha |
| CSS | stylesheet Qt e layouts | seletores/medidas não são equivalentes |
| RxJS observable | Promise, EventEmitter, timer ou Worker message | escolha conforme fluxo e cancelamento |
| localStorage | fs + JSON sob HOME | trate falha de escrita e migração |
| Web MIDI | módulo MIDI nativo + ALSA | exige backend e permissões do sistema |
| Web Audio | FluidSynth + dispositivo ALSA/Pulse | saída pode estar ocupada ou ausente |

## D.9 Método de leitura do código

Para entender uma classe, procure quatro pontos:

1. criação do objeto;
2. inserção em layout e definição de pai;
3. conexão dos eventos;
4. sincronização com estado e worker.

Em seguida, encontre onde o objeto é atualizado ao carregar uma cena e onde é desabilitado ao ocorrer erro. Uma classe aparentemente simples, como QPushButton, pode ter semântica de nota sustentada, acionamento de cena, abrir diálogo ou desligamento, conforme listeners e estado ao redor.

## D.10 Referências da API

- [NodeGui: documentação de desenvolvimento](https://docs.nodegui.org/docs/development/getting-started/)
- [NodeGui: QWidget](https://docs.nodegui.org/docs/api/generated/classes/qwidget/)
- [Qt 6: QWidget](https://doc.qt.io/qt-6/qwidget.html)
- [Qt 6: QMainWindow](https://doc.qt.io/qt-6/qmainwindow.html)
- [Qt 6: layouts](https://doc.qt.io/qt-6/layout.html)
- [Qt 6: sinais e slots](https://doc.qt.io/qt-6/signalsandslots.html)
- [Qt 6: QDialog](https://doc.qt.io/qt-6/qdialog.html)
