# 3. Como um sintetizador digital produz música

Um sintetizador transforma controles musicais em som. A palavra “sintetizador” cobre instrumentos com princípios muito diferentes: circuitos analógicos, modelos digitais de osciladores, reprodução de amostras, modelagem física e sistemas híbridos. Antes de comparar fabricantes, é útil decompor o instrumento em blocos.

## 3.1 A voz, a parte e a cena

Uma **voz** é uma instância sonora em andamento. Ao pressionar uma tecla, o instrumento pode iniciar uma ou mais vozes. Uma nota de piano pode acionar diversas camadas por faixa de velocity; um preset de pad pode sobrepor osciladores; uma corda pode ter várias vozes no uníssono. Soltar a tecla inicia a fase de liberação, que pode continuar audível depois do note-off.

Uma **parte** ou *part* é uma configuração tocável com um canal MIDI, programa, volume, efeitos e roteamento. Uma parte pode disparar muitas vozes. Oito partes com polifonia global de 256 vozes não significam 256 vozes reservadas para cada parte; todas compartilham o limite do motor.

Uma **cena** ou performance combina partes e controles para um estado musical completo. Um teclado pode dividir a extensão em zonas, sobrepor timbres e atribuir cada parte a um canal MIDI. No SamNat, a cena salva uma lista de slots e configurações. A cena não é uma forma de onda; é uma receita para reconstruir o arranjo.

## 3.2 Cadeia básica de síntese

Uma voz digital pode ser modelada em blocos:

~~~text
evento Note On
   ↓
seleção de zona / programa / amostra ou algoritmo
   ↓
oscilador ou reprodução da amostra
   ↓
envelope de amplitude e filtros
   ↓
modulação por velocity, roda, pedal e controles
   ↓
efeitos e panorâmica
   ↓
mistura das vozes
   ↓
buffer de áudio PCM
~~~

O motor precisa manter o estado de muitas vozes ao mesmo tempo, atualizar seus parâmetros e misturar seus resultados em uma taxa de amostragem definida. A amostragem de saída representa a onda em instantes discretos; por exemplo, 44.100 quadros por segundo. Em áudio estéreo cada quadro costuma conter amostras para dois canais.

## 3.3 Amostragem, síntese e modelos híbridos

### Reprodução de amostras

Um sampler reproduz gravações ou amostras digitais. Para uma nota, pode escolher uma região adequada, alterar velocidade de reprodução para ajustar altura, aplicar envelopes e filtros, e combinar múltiplas amostras. O resultado depende da qualidade, do mapeamento de teclado, da velocidade, dos loops e dos efeitos.

Vantagem: um instrumento acústico pode soar convincente porque parte do som real foi gravada. Limite: memória e armazenamento crescem; notas e dinâmicas não gravadas precisam ser aproximadas.

### Síntese subtrativa

Na síntese subtrativa, uma fonte rica em harmônicos passa por filtros que removem energia espectral; envelopes e moduladores alteram o resultado no tempo. É comum em sintetizadores analógicos e em modelos digitais dessa tradição.

### Síntese FM

Na modulação de frequência, um oscilador modula a frequência de outro. A razão e a intensidade de modulação criam espectros complexos. Pequenas mudanças de parâmetros podem mudar muito o timbre, permitindo sons metálicos, sinos e ataques brilhantes.

### Modelagem física

Um modelo físico aproxima o comportamento de uma corda, tubo, palheta ou outro sistema acústico. Em vez de reproduzir uma gravação específica, calcula como o modelo reage a excitação, geometria e controles.

### Arquiteturas híbridas

Instrumentos reais combinam métodos: amostra para o ataque, modelo para a sustentação; amostras de piano mais processamento; PCM com filtros e envelopes; FM somada a amostras. O rótulo comercial não basta para prever o fluxo de sinal.

## 3.4 História técnica: marcos, não uma linha única

A história dos sintetizadores não é uma sucessão em que cada aparelho substitui o anterior. Equipamentos analógicos, digitais, samplers e workstations coexistiram, com objetivos diferentes: performance, estúdio, portabilidade, preço e facilidade de edição.

### Yamaha: DX7, AWM2 e FM-X

O Yamaha DX7 popularizou a síntese FM digital no mercado de instrumentos nos anos 1980. A própria Yamaha registra a importância dessa tecnologia em sua história corporativa. O DX7 tornou possível acessar timbres complexos e estáveis em um instrumento polifônico, mas a programação por algoritmos e operadores exigia outra maneira de pensar em relação aos controles de um sintetizador subtrativo.

Em gerações mais recentes, a família MONTAGE combina motores diferentes. A documentação do MONTAGE M descreve AWM2, baseado em ondas/amostras, FM-X com oito operadores e AN-X, modelagem de síntese analógica. Isso exemplifica uma arquitetura híbrida dentro de uma mesma workstation; não descreve todos os produtos Yamaha.

### Roland: D-50 e arquitetura de zonas

O Roland D-50 é um exemplo histórico de síntese digital híbrida conhecida como Linear Arithmetic. Sua combinação de ataques amostrados com componentes sintetizados contribuiu para sons marcantes de final dos anos 1980. A referência oficial do produto legado ajuda a situar a proposta, mas não substitui um diagrama técnico completo do circuito.

Em produtos mais novos, como a família FANTOM, a documentação de suporte organiza performances em zonas e explica relações entre zonas, tons e parciais. Esse vocabulário ajuda a compreender a composição de uma performance: a camada de execução seleciona timbres, zonas definem faixa e roteamento, e os motores produzem as vozes.

### Korg: M1, workstation e múltiplos motores

O Korg M1, lançado em 1988, consolidou o conceito de workstation que reunia PCM, efeitos e sequenciador em um instrumento. O catálogo oficial atual do software M1 descreve a recriação dos programas e combinações do teclado original. O sucesso da workstation veio da integração do instrumento com ferramentas de composição e não apenas de uma técnica de oscilador.

A família KRONOS demonstra outro aspecto: uma workstation pode reunir múltiplos motores especializados, como SGX para piano, EP-1 para piano elétrico, CX-3 para órgão, HD-1 para reprodução de amostras, AL-1 para síntese analógica, MOD-7 para modulação, STR-1 para cordas modeladas e engines de piano/strings. A documentação oficial enumera nove engines. A lição arquitetural é que uma única interface de performance pode coordenar tecnologias sonoras distintas.

### Kurzweil: amostras e V.A.S.T.

Kurzweil combina uma longa tradição de amostragem e processamento programável. A história oficial da empresa destaca o K250 e a pesquisa ligada a instrumentos digitais de alta fidelidade. A plataforma V.A.S.T. (Variable Architecture Synthesis Technology), descrita nos materiais da série PC, organiza blocos de DSP em cadeias programáveis e oferece caminhos de síntese além de simplesmente tocar uma amostra.

A palavra “VAST” não significa um único preset de som. Ela descreve uma arquitetura de processamento cujo resultado depende dos blocos, das modulações e da organização do programa. Modelos e gerações diferem; para uma implementação específica, consulte o manual daquela unidade.

## 3.5 Comparação de arquiteturas

| Exemplo documentado | Fonte sonora predominante | Ideia arquitetural | O que ensina ao projetar SamNat |
| --- | --- | --- | --- |
| Yamaha DX7 | FM digital | operadores e algoritmos geram espectros complexos | separar programa musical do controle físico do instrumento |
| Yamaha MONTAGE M | AWM2, FM-X e AN-X | motores distintos coexistem em uma performance | não presumir que “um timbre” usa um único gerador |
| Roland D-50 | híbrida, ataque amostrado e síntese | combinar realismo do transiente com sustentação sintetizada | a origem do som pode variar ao longo da nota |
| Roland FANTOM | zonas e engines/timbres | performance como roteamento e composição de partes | modelo de cena deve guardar roteamento, faixa e parâmetros |
| Korg M1 | PCM, efeitos e sequenciador | workstation integra som e composição | efeitos e sequência fazem parte da experiência, não só do oscilador |
| Korg KRONOS | nove engines especializados | motor adequado a cada família sonora | uma interface pode abstrair motores diferentes |
| Kurzweil PC/V.A.S.T. | amostras e DSP configurável | processamento organizado em estruturas programáveis | preset pode ser uma rede de fontes e processadores |

A tabela compara exemplos, não marcas inteiras. Um instrumento de entrada de uma marca pode usar arquitetura bem diferente de uma workstation topo de linha da mesma empresa.

## 3.6 Por que usar FluidSynth

FluidSynth é um sintetizador por software baseado em SoundFonts. Ele recebe eventos MIDI e produz áudio PCM. Isso permite construir um instrumento musical em um computador Linux sem implementar um sampler completo do zero.

FluidSynth oferece uma biblioteca C e um executável de linha de comando, carga de SoundFonts e seleção de banco/programa, geração e saída de áudio por drivers suportados, controle MIDI e parâmetros de síntese, e síntese de várias vozes dentro do limite configurado.

O SamNat escolhe a interface por executável controlado pelo worker. Essa decisão favorece observabilidade e isolamento: o worker pode iniciar/parar o motor, enviar comandos, ler respostas e transformar falhas em mensagens para a interface. Uma aplicação pode escolher a API C diretamente, mas isso altera a fronteira de falhas e a necessidade de integração nativa.

FluidSynth não é o SoundFont, e o SoundFont não é o aplicativo. O motor é o mecanismo de síntese; o banco é o conjunto de amostras e regras; o app escolhe dispositivo, preset, volume, roteamento e controles.

## 3.7 Amostragem PCM e áudio digital

PCM representa áudio por valores numéricos em instantes sucessivos. A taxa de amostragem diz quantos quadros são produzidos por segundo; a profundidade de bits afeta a resolução numérica; o número de canais descreve a configuração espacial.

Exemplo de taxa de dados sem compressão para 44,1 kHz, estéreo, 16 bits:

~~~text
44.100 quadros/s × 2 canais × 2 bytes = 176.400 bytes/s
~~~

Esse é o fluxo teórico de dados PCM; protocolos e drivers também têm buffers, cabeçalhos e temporização. Uma interface pode aceitar formatos diferentes e converter internamente. A taxa de saída não é o número de vozes do sintetizador: cada quadro é a mistura de todas as vozes ativas.

## 3.8 Envelope, velocity e controle

O envelope descreve como um parâmetro muda em resposta a eventos. ADSR é uma simplificação conhecida: attack, decay, sustain e release. Em um sampler, as amostras já possuem dinâmica natural; ainda assim o motor pode aplicar envelope, filtro, modulação e volume.

Velocity MIDI é um valor associado ao acionamento da nota. Muitos instrumentos usam velocity para escolher amostras diferentes ou alterar brilho e amplitude. Não é necessariamente “força física em newtons”; é um número interpretado pelo instrumento.

Control Change (CC) envia valores de controle, como sustain (CC64) ou modulação (comumente CC1). Pitch bend é uma mensagem separada, com resolução superior a um valor de 7 bits quando enviado em MIDI 1.0 convencional. O intervalo musical do bend depende da configuração do receptor.

## 3.9 Polifonia e roubo de vozes

A polifonia é o número de vozes simultâneas permitido pelo motor. Um acorde de seis notas pode gerar mais de seis vozes se cada nota tiver camadas. Uma nota sustentada ainda pode ocupar voz durante a fase de release. Efeitos e elementos de um programa podem exigir recursos adicionais.

Quando o limite é atingido, o motor pode não iniciar uma nova voz ou pode interromper uma voz existente segundo sua política. O ouvinte percebe isso como corte de notas, mas o diagnóstico depende de confirmar:

1. se a mensagem note-on chegou;
2. se o preset tem regiões para a nota/velocity;
3. se o limite de vozes foi alcançado;
4. se há note-off, pedal sustain ou vozes em release;
5. se a saída de áudio continua gerando buffers.

No repositório consultado, SYNTH_POLYPHONY está definido em 256 no worker, enquanto README descreve 512. A diferença precisa ser resolvida como trabalho editorial/código antes de publicar uma edição definitiva. Este livro registra o estado observado e ensina a verificar a linha de comando do FluidSynth, em vez de perpetuar o valor desatualizado.

## 3.10 Exercícios

1. Escolha um preset de piano e outro de pad. Compare ataque, sustentação e liberação.
2. Faça o diagrama de uma nota com sustain ativado e depois desativado.
3. Explique por que um preset multicamada pode usar várias vozes para uma nota.
4. Pesquise um manual oficial de um sintetizador que você conhece e identifique suas partes, zonas, motores e efeitos.
5. Para um arranjo de oito partes, desenhe uma cena e identifique quais dados devem ser salvos para reproduzi-la.

## 3.11 Da tensão analógica ao algoritmo

Um sintetizador subtrativo clássico pode ser entendido como oscilador, filtro e amplificador controlados por envelopes e modulações. O oscilador produz uma forma de onda; o filtro altera o espectro; o amplificador controla amplitude; LFOs e envelopes movem parâmetros no tempo.

Uma polifonia analógica pode exigir um conjunto de circuitos por voz. A memória de parâmetros e a quantidade de componentes limitavam o número de vozes. Com circuitos digitais, parte do estado passou a ser calculada por processadores, o que permitiu armazenar presets e controlar muitas vozes de forma repetível.

A passagem de analógico para digital não foi apenas trocar componentes. Ela mudou:

- como o timbre era representado e copiado;
- como parâmetros eram salvos e recuperados;
- quais sons podiam ser gerados;
- como teclado, sequenciador e efeitos se integravam;
- qual era o custo de adicionar mais vozes ou camadas.

## 3.12 Operadores FM em termos simples

Um operador FM tem uma frequência base e pode modular outro operador. Um operador que alimenta a saída audível costuma ser chamado carrier; um que modula outro é modulator. Um algoritmo define a topologia de conexões entre eles.

No DX7, seis operadores podiam ser conectados segundo 32 algoritmos. Essa organização dá origem a uma diferença importante em relação a uma cadeia subtrativa: o músico escolhe uma rede de osciladores e ajusta frequência, nível e envelope de cada operador. A Yamaha descreve essa estrutura nos materiais oficiais do DX7 e em manuais posteriores sobre síntese FM.

~~~text
modulator → carrier → saída
      ↘ outro modulator → carrier → saída
~~~

Quando um operador modula outro, a quantidade de modulação altera o número de harmônicos e a distribuição de energia. Envelopes individuais permitem que o espectro mude no ataque e na sustentação. É por isso que um timbre FM pode ter um ataque de sino e uma cauda mais simples, mesmo sem reproduzir uma gravação.

FM não é sinônimo de “som de DX7”; é uma técnica. O mesmo princípio, com diferentes operadores, algoritmos, envelopes, feedback e controles, pode produzir uma variedade ampla de timbres.

## 3.13 O híbrido LA: ataque e sustentação

O Roland D-50 ilustra uma decisão perceptiva: o ataque de um instrumento carrega muita informação de identidade. Linear Arithmetic combinou ataques amostrados com ondas sintetizadas para a sustentação. O resultado não precisava armazenar uma amostra longa de cada nota para sugerir timbres reconhecíveis.

O princípio geral é separar fases da nota:

~~~text
Note On → transient/sample de ataque → crossfade ou continuação → camada sustentada
Note Off → envelope de release
~~~

Esse exemplo ajuda a pensar em consumo de memória. Uma amostra curta de ataque pode contribuir mais para reconhecimento do que uma gravação longa. SoundFonts e samplers também usam camadas e loops, embora os formatos e motores sejam diferentes do D-50.

## 3.14 A workstation como computador musical

Uma workstation junta geradores de som, partes, efeitos, sequenciador, armazenamento de projetos e controles de performance. A vantagem é que o músico compõe e toca sem montar uma cadeia externa de equipamentos. O custo é coordenar mais estados e recursos.

No Korg M1, a combinação documentada de PCM, efeitos digitais e sequenciador de oito pistas tornou o instrumento uma estação integrada. Nos instrumentos atuais, uma performance pode conter uma estrutura ainda mais ampla de zonas e motores.

Um software que imita a organização de workstation precisa decidir quais responsabilidades pertencem à cena:

- lista e ordem das partes;
- faixa de teclado e faixa de velocity;
- canal MIDI e origem do controlador;
- preset, volume, panorama e efeitos;
- estados de sustain e modulação;
- associações de pads e controles;
- estado de transposição ou divisão, se existir.

Uma cena do SamNat atual armazena subset desse domínio. A lista acima mostra possibilidades arquiteturais, não recursos já implementados.

## 3.15 Leituras de painéis e manuais

Manual de sintetizador é também documentação de arquitetura. Ao ler um manual, procure:

1. quais entidades existem: voice, part, tone, zone, program, combination ou scene;
2. que motor gera cada entidade;
3. quais parâmetros são locais e quais são globais;
4. como o teclado e os canais MIDI selecionam partes;
5. como efeitos e saídas são compartilhados;
6. que parâmetros são salvos numa performance;
7. quantas vozes e partes o modelo suporta.

Fabricantes usam palavras diferentes para conceitos parecidos. Não converta automaticamente “part” de uma marca em “zone” de outra; consulte a definição do manual.

## 3.16 Exercícios de arquitetura musical

1. Desenhe a topologia de seis operadores do algoritmo de sua escolha no manual Yamaha e identifique carriers e modulators.
2. Compare a camada de ataque e sustentação do D-50 com uma amostra de piano SF2.
3. Modele uma cena com divisão: graves à esquerda, piano à direita e pad em layer. Liste os dados novos que seriam necessários no SamNat.
4. Escolha um instrumento com vários engines e trace qual motor atende a cada categoria de timbre.
5. Diferencie número de partes, número de notas pressionadas e polifonia de vozes.

## 3.17 Uma performance é uma rede de roteamento

Um instrumento multitimbral pode ser representado como um grafo. Entradas MIDI entram em zonas; zonas escolhem partes; cada parte seleciona um preset e um motor; saídas de motores podem passar por efeitos compartilhados; por fim, buses chegam a uma ou mais saídas.

~~~text
teclado dividido / controlador
       ├── faixa grave → parte de baixo → engine → efeito → saída
       ├── faixa aguda → parte de piano → engine ────────→ saída
       └── canal MIDI 3 → pad em layer → engine → reverb → saída
~~~

O diagrama mostra por que uma cena precisa guardar mais que o nome dos timbres. Se ela não guardar ranges e canais, o usuário pode recuperar a lista de presets, mas não o comportamento de performance. Se efeitos forem compartilhados, salvar valores por parte pode não reproduzir o mix original.

O SamNat atual implementa partes com roteamento a controladores, programas e volumes; não implementa todas as possibilidades de uma workstation, como split de faixa, sequenciador ou múltiplos buses editáveis. O modelo dos fabricantes serve como referência conceitual para evolução, não como lista de funções já presentes.

## 3.18 Como comparar engines sem cair em slogans

Para comparar dois motores, pergunte:

1. A fonte é sample, oscilador, modelo físico ou híbrido?
2. Como é selecionada a região por nota e velocity?
3. Como modulação, filtro e envelope são representados?
4. Onde acontecem efeitos: por voz, por parte ou master?
5. A engine é independente ou compartilha recursos com outras?
6. Como se roteiam partes e zonas?
7. O que é salvo no preset e o que é salvo na performance?

Yamaha MONTAGE M é um exemplo atual de múltiplos motores na mesma performance; Korg KRONOS documenta nove engines; Kurzweil V.A.S.T. apresenta processamento programável; Roland FANTOM organiza timbres e zonas. Essas descrições vêm dos fabricantes e não significam que os motores sejam intercambiáveis.

## 3.19 Relação com o catálogo de SoundFonts

No SamNat, todos os presets carregados são sintetizados pelo mesmo motor FluidSynth, embora cada SF2 possa oferecer materiais e regras distintas. Isso difere de workstations com engines especializadas. O formato SF2 fornece flexibilidade suficiente para pianos, pads, metais e efeitos amostrados, mas não torna FluidSynth equivalente a um modelador físico ou engine FM de hardware.

Uma biblioteca de timbres adequada ao app precisa equilibrar:

- variedade musical;
- memória ocupada em armazenamento e RAM;
- qualidade de amostras e mapeamento;
- tempo de leitura e seleção;
- licença de redistribuição;
- volume relativo e headroom;
- clareza de nome e categoria.

A expansão da pasta soundfonts também muda o tamanho de /data e tempo de indexação. A lista de arquivos deve ser um inventário reproduzível, não uma cópia casual de bancos encontrados.

## Leituras e fontes oficiais

- [Yamaha: história do DX7 e síntese FM](https://www.yamaha.com/en/about/history/innovation/episode-15/index.html)
- [Yamaha: evolução dos geradores FM e seis operadores do DX7](https://europe.yamaha.com/en/musical-instruments/keyboards/explore/synth-50th/history/chapter002.html)
- [Yamaha: manual técnico educacional sobre operadores e algoritmos FM](https://kr.yamaha.com/files/download/other_assets/1/320951/PLG100DXE.pdf)
- [Yamaha MONTAGE M: motores AWM2, FM-X e AN-X](https://manual.yamaha.com/mi/synth/montage_m/en/om01basicoperation0350.html)
- [Roland D-50](https://www.roland.com/us/products/rc_d-50/)
- [Roland FANTOM: zonas](https://support.roland.com/hc/en-us/articles/12869134186523-FANTOM-6-FANTOM-7-FANTOM-8-What-Is-a-Zone)
- [Korg M1](https://www.korg.com/us/products/software/kc_m1/index.php)
- [Korg M1: workstation, PCM, efeitos e sequenciador](https://www.korg.com/uk/products/software/kc_m1/index.php)
- [Korg KRONOS: nove motores](https://www.korg.com/us/products/synthesizers/kronos3/nine_engines.php)
- [Kurzweil: história da empresa](https://kurzweil.com/about/)
- [Kurzweil PC4 e V.A.S.T.](https://kurzweil.com/pc4/)
