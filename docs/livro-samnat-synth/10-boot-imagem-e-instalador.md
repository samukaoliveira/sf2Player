# 10. Boot, imagem, instalação e persistência

Uma imagem de disco inicializável precisa conter mais que o executável. Ela precisa de código de boot que o firmware reconheça, kernel, partição raiz, dados e referências coerentes entre essas partes.

## 10.1 BIOS legado e UEFI

BIOS legado e UEFI iniciam o sistema por caminhos diferentes. Em BIOS, o firmware executa código no início do disco e o GRUB encontra seus módulos. Em UEFI, o firmware lê uma partição FAT com um executável EFI, normalmente em EFI/BOOT/BOOTX64.EFI para mídia removível.

A imagem do SamNat inclui suporte a BIOS legado e UEFI x86_64. O GRUB oferece a inicialização do app e a opção de instalação no SSD. Secure Boot precisa estar desativado porque os executáveis distribuídos não estão assinados por uma cadeia confiável.

## 10.2 Partições da imagem

O script genimage compõe uma imagem MBR com:

- áreas de boot BIOS e GRUB, incluindo dados fora da tabela de partições;
- partição EFI FAT, com GRUB e kernel;
- partição raiz ext4;
- partição de dados ext4.

A raiz contém o sistema imutável de produto: binários, bibliotecas e scripts. /data guarda dados que devem sobreviver à substituição do rootfs. A identificação usada no boot inclui o disk signature e PARTUUID da partição raiz. Depois de copiar a imagem para SSD, o instalador gera outro identificador de disco e atualiza referências em arquivos de boot.

## 10.3 Raiz e dados separados

Separar root e data traz duas vantagens:

1. uma atualização pode substituir o sistema sem apagar cenas e conteúdo do usuário;
2. o tamanho da partição de dados pode crescer para aproveitar discos maiores.

Essa separação também exige rotina para montar e validar /data. samnat-session recusa abrir o app se a partição persistente não estiver montada, para não salvar silenciosamente cenas no rootfs temporário e perdê-las depois.

## 10.4 Dimensionar a partição de SoundFonts

O post-image percorre recursivamente a pasta soundfonts e inclui SF2 mantendo subpastas. Calcula o total em MiB e dimensiona a partição de dados com o payload de SF2, pelo menos 1 GiB de espaço disponível planejado, reserva ext4 e margem para metadados.

O tamanho final do arquivo de imagem inclui todas as partições e alinhamentos; não é igual à soma dos SF2. O espaço livre visível pelo usuário também difere do tamanho bruto da partição por causa de metadados e blocos reservados.

Ao adicionar SF2:

1. organize arquivos dentro de prototipo-nativo/soundfonts;
2. valide nomes e licenças;
3. verifique se existe pelo menos um arquivo com extensão .sf2;
4. compile AppImage/imagem conforme os scripts;
5. confira a saída de post-image com contagem e tamanho;
6. inicialize e confirme a árvore em /data/home/.samnat-synth/soundfonts.

Não edite diretamente o filesystem da imagem montada para “aumentar” espaço. A tabela da partição e o filesystem ext4 têm tamanhos próprios e precisam ser redimensionados na ordem certa e sem montagem ativa.

## 10.5 Instalação no SSD

O instalador é um programa shell executado pelo init quando o parâmetro samnat.install=1 aparece na linha de comando do kernel. Ele detecta a mídia USB de origem, lista discos não removíveis, pede uma escolha e exige digitar APAGAR.

Depois da confirmação, ele:

1. calcula o tamanho e início da partição de dados na imagem;
2. garante que o disco destino comporta a imagem;
3. sincroniza e desmonta /data;
4. remonta a raiz como somente leitura;
5. copia os setores da imagem USB para o disco alvo;
6. expande a partição 3 de dados até o fim do disco;
7. gera outro disk signature;
8. relê a tabela de partições;
9. executa e2fsck e resize2fs no filesystem de dados;
10. substitui o ID antigo nos arquivos de boot da raiz do SSD.

A instalação apaga todas as partições e arquivos do disco escolhido. A confirmação digitada é uma proteção contra seleção acidental, não um backup. Nunca escolha a própria mídia USB de origem.

## 10.6 Redimensionar ext4 corretamente

Uma partição pode ser maior que o filesystem que contém. Para usar todo o espaço, é necessário aumentar primeiro a partição e depois o filesystem. Para reduzir, a ordem é inversa e o processo envolve risco maior.

Ferramentas antigas podem não entender recursos ext4 criados por ferramentas mais recentes. Erros de feature não suportada exigem usar e2fsck/resize2fs que compreendam aquelas features. Não force a escrita nem execute correção em filesystem montado.

No instalador, as ferramentas são parte da imagem e devem corresponder ao formato gerado. No computador de manutenção, use as ferramentas host atuais do Buildroot quando disponíveis; faça cópia da mídia antes de reparo. A execução em modo somente leitura pode reportar erros sem repará-los.

## 10.7 Persistência de usuário

samnat-session define HOME para /data/home. O app usa a pasta ~/.samnat-synth para cenas, SF2 importados e logs de áudio. A separação permite atualização da raiz mantendo esse conteúdo.

Dados de usuário ainda precisam de política:

- como migrar formatos antigos de cena;
- se SF2 duplicados devem ser copiados ou referenciados;
- como recuperar JSON truncado;
- como reservar espaço livre;
- como fazer backup antes de instalar uma imagem nova.

Uma edição de produto deve definir exportação e restauração. Persistência não é backup.

## 10.8 Splash e sessão gráfica

O splash aparece enquanto o sistema inicia. Em seguida o console tty1 executa samnat-session. A sessão define HOME, variáveis Qt, caminho de bibliotecas e dispositivos de teclado/mouse, prepara a pasta de SoundFonts, inicializa áudio e executa AppRun.

O console de manutenção permanece no tty2. O app é o processo da tty1. Se um problema gráfico impedir o uso, Ctrl+Alt+F2 dá acesso ao getty quando a combinação de teclado, driver e foco permite alternar. O comando de emergência não pode ser tratado como único meio de recuperação; o instalador e mídia de boot também devem permitir manutenção.

## 10.9 Exercícios

1. Use lsblk e lsblk -f para desenhar partições e filesystems da mídia de teste.
2. Compare tamanho bruto da partição de dados e espaço livre dentro dela.
3. Localize a opção samnat.install=1 nos arquivos GRUB e trace como chega ao instalador.
4. Explique por que alterar tamanho de partição não aumenta sozinho o filesystem.
5. Faça uma cópia de segurança de scenes.json e descreva como restaurá-la numa instalação nova.

## Referências

- [Manual oficial do Buildroot: geração de imagens](https://buildroot.org/downloads/manual/manual.html)
- [Linux ext4: documentação](https://docs.kernel.org/filesystems/ext4/)
- [GRUB: manual GNU](https://www.gnu.org/software/grub/manual/grub/grub.html)
