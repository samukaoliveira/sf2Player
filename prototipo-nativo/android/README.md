# SamNat Synth Android

APK nativo para Moto G52 XT2221-2 (`arm64-v8a`, Android 13). A interface usa views Android, o sintetizador é FluidSynth 2.6.0 via JNI e a saída de áudio usa AAudio. Não há Chromium, WebView ou Linux emulado.

## Compilar

Requisitos: JDK 17+, Android SDK Platform 35, Android NDK 30.0.16248370 e CMake 3.31.1. Na primeira compilação o CMake baixa o código upstream do FluidSynth e GCEM.

```bash
cd prototipo-nativo/android
./gradlew assembleDebug
```

O APK fica em `app/build/outputs/apk/debug/app-debug.apk`.

## Instalar no Moto G52

Ative Depuração USB e conecte o aparelho:

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Abra **SamNat Synth**. Para iniciar como launcher, escolha SamNat Synth quando o Android perguntar qual app deve abrir a tela inicial. O modo Device Owner/Lock Task é opcional e exige provisionar o aparelho como dedicado; não é necessário para instalar e experimentar o APK.

## Perfil enxuto para o Moto G52

O script `debloat-moto-g52.sh` desativa, para o usuário principal, os apps opcionais listados em `moto-g52-background-packages.txt`. Ele confirma que o aparelho conectado é um Moto G52 e guarda os pacotes que alterou em `~/.local/state/samnat-moto-g52/`. A operação não remove APKs nem dados e pode ser revertida:

```bash
./debloat-moto-g52.sh
./restore-moto-g52-apps.sh
```

O perfil mantém os serviços centrais do Android, tela, áudio, Bluetooth/MIDI, arquivos e entrada. Apps já desativados antes da execução não entram na lista de restauração.

Use **Baixar do catálogo** para acessar os 165 timbres da interface Angular e os quatro SF2 adicionais da cena padrão, ou **Importar arquivo SF2** para escolher um arquivo local. Em cada parte, escolha um timbre, selecione banco/programa e ajuste volume/efeitos. A cena inicial é criada com oito partes e os nomes/programas usados na versão Linux.

## Licença

FluidSynth é distribuído sob LGPL-2.1-or-later. O APK inclui a licença em `app/src/main/assets/licenses/LGPL-2.1.txt`. A versão upstream é fixada em `v2.6.0` em `app/src/main/cpp/CMakeLists.txt`.
