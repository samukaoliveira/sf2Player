# SamNat Synth por dentro

## Do kernel ao instrumento digital

Este diretório guarda o manuscrito técnico para quem quer compreender, montar e reproduzir o SamNat Synth sem depender de explicações externas. O livro percorre os fundamentos de um computador e de um sistema operacional, a evolução dos sintetizadores, MIDI e SoundFonts, o aplicativo NodeGui/Qt, a geração de áudio com FluidSynth e a imagem Linux embarcada baseada em Buildroot.

O projeto tem três linhas que precisam ser entendidas em conjunto:

1. **Aplicação Angular**: interface web original e referência de comportamento em `src/`.
2. **Aplicação nativa**: interface Qt acessada por JavaScript via NodeGui, com Qode e motor FluidSynth em `prototipo-nativo/`.
3. **Sistema embarcado**: kernel, root filesystem, boot, imagem USB, instalador e partição de dados em `prototipo-nativo/embedded/`.

O manuscrito privilegia a implementação que existe no repositório. Quando um valor muda ou a documentação diverge do código, o capítulo de arquitetura pede ao leitor que confirme a fonte executável e registre a divergência. Por exemplo, o README nativo descreve polifonia de 512 vozes, enquanto `src/audio-worker.cjs` configura atualmente 256. O código em uso é a referência para reproduzir o comportamento presente.

## Estrutura do manuscrito

| Parte | Assunto | Meta editorial |
| --- | --- | ---: |
| I | Computador, sistema operacional, kernel, processos, memória e dispositivos | cerca de 70 páginas |
| II | Sintetizadores, MIDI, amostragem, SoundFonts e FluidSynth | cerca de 55 páginas |
| III | Aplicação: domínio, interface nativa, Qt, NodeGui, estado e persistência | cerca de 95 páginas |
| IV | Áudio em tempo real, roteamento, MIDI, latência e diagnóstico | cerca de 65 páginas |
| V | Linux embarcado: kernel, Buildroot, init, framebuffer, armazenamento e boot | cerca de 70 páginas |
| VI | Empacotamento, reprodução do sistema, manutenção e resolução de falhas | cerca de 45 páginas |

As metas dão uma dimensão de livro técnico, não uma contagem de páginas pronta. Esta versão reúne cerca de 26,7 mil palavras; a introdução concentra aproximadamente 13,6 mil delas. Com diagramas, exemplos e diagramação didática, a Parte I pode chegar perto da meta de 70 páginas, mas isso precisa ser confirmado ao diagramar. O livro completo ainda pode crescer em estudos de código, exercícios práticos e validação em hardware.

## Capítulos

### Parte I — Fundamentos

1. [O computador como camadas](01-computador-e-sistema-operacional.md)
2. [Kernel, processos, memória e dispositivos](02-kernel-memoria-e-dispositivos.md)
3. [Como um sintetizador digital produz música](03-sintetizadores-e-arquiteturas.md)
4. [MIDI, SoundFonts e FluidSynth](04-midi-soundfonts-fluidsynth.md)

### Parte II — O aplicativo

5. [Arquitetura do SamNat Synth](05-arquitetura-do-aplicativo.md)
6. [De JavaScript a Qt: NodeGui e Qode](06-nodegui-e-qt.md)
7. [Estado, cenas, controladores e teclado virtual](07-interface-midi-e-cenas.md)
8. [Motor de áudio e comunicação com FluidSynth](08-motor-de-audio.md)

### Parte III — O sistema embarcado

9. [Linux mínimo com Buildroot](09-linux-embarcado-buildroot.md)
10. [Boot, imagem, instalação e persistência](10-boot-imagem-e-instalador.md)
11. [Empacotamento e reprodução do build](11-reproduzir-o-sistema.md)
12. [Diagnóstico de áudio, MIDI, vídeo e entrada](12-diagnostico.md)

### Apêndices

- [Mapa do código e conceitos](apendice-mapa-do-codigo.md)
- [Referência das classes e APIs NodeGui/Qt](apendice-api-nodegui-qt.md)
- [Glossário](glossario.md)
- [Fontes primárias e leituras](referencias.md)

## Como ler

Quem nunca escreveu um sistema operacional deve começar pela Parte I. Quem já programa pode avançar até o capítulo 5 e usar os fundamentos como consulta. Para reproduzir o sistema, siga os capítulos 9 a 12 na ordem: primeiro prepare o aplicativo; em seguida construa a imagem, inicialize em USB e só então investigue hardware.

Cada capítulo separa **conceito**, **decisão de projeto**, **implementação** e **exercício**. Os exercícios usam arquivos e comandos do repositório; antes de executar um comando que grave disco, confira o dispositivo escolhido. Escrever a imagem em um disco apaga seu conteúdo.

## Fontes e limites

O livro usa documentação oficial de Linux, Buildroot, Qt, NodeGui, FluidSynth, MIDI e fabricantes. A comparação entre Yamaha, Roland, Korg e Kurzweil descreve famílias e modelos documentados. Não presume que todos os instrumentos de uma marca tenham a mesma arquitetura, nem afirma conhecer circuitos proprietários não publicados.

As referências estão reunidas em [referencias.md](referencias.md). O conteúdo técnico pode mudar com a versão de kernel, Qt, Buildroot, NodeGui ou FluidSynth; sempre confira as versões fixadas no repositório antes de aplicar uma instrução a outra versão.
