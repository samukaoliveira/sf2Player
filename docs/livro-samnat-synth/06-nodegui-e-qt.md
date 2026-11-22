# 6. De JavaScript a Qt: NodeGui e Qode

NodeGui permite construir aplicações de desktop usando JavaScript e widgets Qt. Ele não renderiza uma página HTML em Chromium. O código JavaScript chama wrappers nativos; estes chamam Qt; Qt conversa com a plataforma gráfica disponível.

## 6.1 Angular, Electron e NodeGui são modelos diferentes

Na aplicação Angular, o navegador cria DOM e calcula CSS. Angular transforma templates e estado em elementos. Em Electron, Chromium pode ser empacotado para oferecer esse ambiente de navegador no desktop.

No NodeGui, um QLabel é um widget Qt; um QPushButton é um botão Qt; um QBoxLayout organiza widgets segundo as regras Qt. Os objetos JavaScript são wrappers com ligação ao runtime nativo. O desenho é feito por Qt e pelo plugin de plataforma.

~~~text
Angular → template → DOM → CSS/layout do navegador → Chromium
NodeGui → objeto JS → binding nativo → QWidget/Qt → plugin de plataforma
~~~

Qode inicia Node.js com suporte ao loop de eventos Qt. A aplicação não chama outro app.exec() de forma indiscriminada: criar dois loops de evento concorrentes bloqueia a entrega normal de callbacks, timers e eventos de janela.

## 6.2 Criar a aplicação e a janela

O ponto de entrada nativo importa QApplication, QMainWindow, QWidget e classes de controles:

~~~js
const { QApplication, QMainWindow, QWidget, QBoxLayout, Direction,
  QLabel, QPushButton } = require('@nodegui/nodegui');

const app = new QApplication();
const window = new QMainWindow();
window.setWindowTitle('SamNat Synth');
const central = new QWidget();
const layout = new QBoxLayout(Direction.TopToBottom);
central.setLayout(layout);
window.setCentralWidget(central);
window.show();
~~~

O exemplo é um esqueleto conceitual. A execução real usa o comando qode configurado no package.json e inicialização adicional de worker, áudio, controles e eventos.

QApplication representa a aplicação Qt. QMainWindow fornece janela principal e áreas típicas. QWidget é o bloco visual base; a maioria dos controles deriva dele. Layouts cuidam do posicionamento conforme tamanho disponível.

## 6.3 Mapeamento prático de classes

| Classe | Papel no app | Analogia aproximada em HTML |
| --- | --- | --- |
| QApplication | contexto e ciclo de eventos Qt | não há elemento DOM equivalente |
| QMainWindow | janela principal | janela do navegador |
| QWidget | contêiner base | div |
| QBoxLayout | fila horizontal ou vertical | flexbox em uma direção |
| QGridLayout | grade de posições | grid |
| QLabel | texto ou imagem | label / img |
| QPushButton | ação clicável | button |
| QSlider | faixa de valor | input range |
| QCheckBox | opção booleana | input checkbox |
| QComboBox | seleção compacta | select |
| QLineEdit | entrada de uma linha | input text |
| QScrollArea | área rolável para widget | contêiner com overflow |
| QDialog | janela modal ou não modal | dialog/modal |
| QFileDialog | seletor de arquivos nativo | file picker |
| QProgressBar | progresso ou estado de carga | progress |
| QShortcut | atalho de teclado | listener global/contextual |
| QIcon / QSize | ícone e dimensão | imagem e tamanho |

As analogias ajudam na leitura, mas APIs e regras diferem. Um QLineEdit não dispara eventos Angular; um stylesheet Qt não entende automaticamente todos os seletores CSS de navegador.

## 6.4 Layouts e geometria

No Qt, widgets normalmente vivem dentro de layouts. Um QBoxLayout orienta os elementos horizontalmente ou verticalmente. Um QGridLayout organiza linhas e colunas. Margens e espaçamento controlam a respiração visual.

Uma sequência típica:

~~~js
const row = new QWidget();
const rowLayout = new QBoxLayout(Direction.LeftToRight);
row.setLayout(rowLayout);
rowLayout.setContentsMargins(0, 0, 0, 0);
rowLayout.setSpacing(8);
rowLayout.addWidget(label('Volume'));
rowLayout.addWidget(volumeSlider, 1);
~~~

O fator opcional de expansão dá mais espaço a um widget, mas não determina sozinho sua proporção final. Stretch factors do layout pai, tamanho mínimo, política de tamanho e conteúdo influenciam a geometria.

Uma situação especial é o teclado virtual. O teclado tem geometria sobreposta: teclas brancas ocupam a altura toda; pretas ficam acima delas. Um grid simples pode posicionar as teclas, mas redimensionar manualmente exige calcular limites e chamar setGeometry. Com resize event, a largura precisa ser recalculada quando a janela muda de tamanho.

## 6.5 Stylesheets Qt

setInlineStyle recebe uma stylesheet Qt. A sintaxe se parece com CSS, mas os widgets e seletores são os de Qt. O estilo QPushButton pode definir padding, borda, fundo e estados hover/pressed. Não existe cascata DOM, pseudo-elemento HTML ou fluxo de página igual ao navegador.

As cores de tecla, o realce de nota e os estados desabilitados devem ser aplicados sobre o widget. Se várias fontes MIDI podem manter a mesma nota pressionada, o estado visual é um conjunto de origens por nota. Só quando esse conjunto fica vazio a tecla volta ao estilo ocioso.

## 6.6 Eventos, sinais e slots

Qt usa sinais e slots para comunicar eventos. Um botão pode emitir clicked; um slider pode emitir valueChanged. NodeGui expõe esses eventos por listeners JavaScript:

~~~js
button.addEventListener('clicked', () => {
  status.setText('Ação solicitada');
});
slider.addEventListener('valueChanged', value => {
  volumeLabel.setText('Volume ' + value + '%');
});
~~~

O valor e o nome do evento dependem da API NodeGui. Consulte os tipos e a documentação da versão instalada. Como o valor vem de uma fronteira nativa, valide intervalo e tipo antes de convertê-lo em comando para o worker.

Um callback de evento roda no loop da interface. Se nele houver uma operação síncrona lenta, a janela para de responder. Para I/O, subprocessos e cargas longas, use APIs assíncronas ou worker.

## 6.7 Diálogos

QFileDialog encapsula o seletor nativo de arquivos. QDialog pode criar uma janela de opções de áudio. O método exec geralmente mostra a caixa em modo modal e espera enquanto Qt continua processando o ciclo de eventos modal. Não use essa semântica como desculpa para bloquear trabalho externo em callbacks.

Para um teste de áudio numa janelinha:

1. a janela modal mostra dispositivo, botão de teste, estado e fechar;
2. ao iniciar, o botão fica desabilitado para evitar testes concorrentes;
3. o teste é subprocesso assíncrono;
4. resultado e stderr são exibidos;
5. se FluidSynth foi pausado para liberar ALSA, é reiniciado e seus timbres são restaurados.

## 6.8 Resize, DPI e framebuffer

Qt escolhe um plugin de plataforma. No desktop Linux, normalmente é xcb ou outro plugin de janela. Na imagem embarcada, QT_QPA_PLATFORM=linuxfb direciona a renderização ao framebuffer. Se o framebuffer reporta resolução, escala ou formato de cor inesperados, a janela pode ficar cortada, deformada ou ilegível.

O framebuffer não é “um monitor sem driver”; é uma interface concreta que depende do kernel e do hardware. Em máquinas modernas AMD, DRM/KMS e firmware da GPU podem ser necessários mesmo sem usar um desktop X11. Uma tela EFI genérica pode mostrar mensagens de boot, mas isso não prova que Qt tenha uma superfície LinuxFB utilizável.

O escalonamento Qt também precisa ser controlado. Variáveis de alta densidade podem multiplicar dimensões ou causar layout apertado. No sistema da imagem, samnat-session define variáveis explicitamente e fontes DejaVu são instaladas para evitar glifos ausentes.

## 6.9 Fontes, símbolos e idiomas

Caracteres quadrados normalmente indicam ausência de glifos, fonte errada, codificação ou fallback inadequado. Inclua uma fonte que cubra português e os símbolos necessários. Se o Qt busca fontes em diretório específico, a variável QT_QPA_FONTDIR precisa apontar para a pasta presente na imagem.

Ícones SVG exigem plugin Qt SVG compatível. Um SVG disponível no repositório não garante que o plugin de imagem esteja no AppDir. Para depurar, verifique existência do arquivo, plugin, dependências compartilhadas e log Qt.

## 6.10 Relação com Angular

Portar uma feature visual pede mais que copiar o texto:

| Angular | NodeGui/Qt |
| --- | --- |
| componente com template e estilos | função/fábrica que cria widgets e layouts |
| binding de template | atualizar widget a partir do estado |
| serviço injetado | módulo ou objeto de domínio passado explicitamente |
| observable/event stream | callback, EventEmitter ou fila de mensagens |
| CSS responsivo | layouts Qt, size policies e cálculo de geometria |
| Web MIDI | módulo nativo MIDI e sequenciador ALSA |
| Web Audio | FluidSynth e API de áudio do sistema |
| localStorage | JSON persistido na pasta do usuário |

A lógica musical pode ser conceitualmente compartilhada, mas o ambiente de execução não é. Prefira definir formatos de mensagem e estrutura de cena independente da UI; isso facilita manter Angular e Qt em paridade.

## 6.11 Exercícios

1. Crie uma janela com QLabel, QPushButton e QSlider e descreva o caminho do clique até a atualização do texto.
2. Monte uma linha horizontal e uma pilha vertical; redimensione a janela para observar stretch e tamanho mínimo.
3. Liste todos os widgets do painel de uma parte e classifique cada um como exibição, entrada ou ação.
4. Troque o plugin de plataforma no ambiente de desenvolvimento e explique quais dependências aparecem.
5. Compare uma implementação Angular e uma Qt da mesma operação; identifique o estado que precisa ser comum.

## Fontes técnicas

- [NodeGui: introdução e execução com Qode](https://docs.nodegui.org/docs/development/getting-started/)
- [NodeGui: QWidget](https://docs.nodegui.org/docs/api/generated/classes/qwidget/)
- [Qt: layouts](https://doc.qt.io/qt-6/layout.html)
- [Qt: sinais e slots](https://doc.qt.io/qt-6/signalsandslots.html)
- [Qt: QDialog](https://doc.qt.io/qt-6/qdialog.html)
