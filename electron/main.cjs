const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const DIRETORIO_CACHE = () => path.join(app.getPath('userData'), 'soundfonts');

function ehSoundFontValido(dados) {
  return Buffer.isBuffer(dados) && dados.length >= 12 &&
    dados.toString('ascii', 0, 4) === 'RIFF' &&
    dados.toString('ascii', 8, 12) === 'sfbk' &&
    dados.readUInt32LE(4) + 8 <= dados.length;
}

function caminhoSoundFont(url) {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
    throw new Error('URL de SoundFont inválida.');
  }
  const hash = crypto.createHash('sha256').update(url).digest('hex');
  return path.join(DIRETORIO_CACHE(), `${hash}.sf2`);
}

ipcMain.handle('soundfont-cache:ler', async (_event, url) => {
  const arquivo = caminhoSoundFont(url);
  try {
    const dados = await fs.readFile(arquivo);
    if (ehSoundFontValido(dados)) return new Uint8Array(dados);
    await fs.unlink(arquivo).catch(() => undefined);
  } catch (erro) {
    if (erro.code !== 'ENOENT') console.warn('Falha lendo cache SF2:', erro);
  }
  return null;
});

ipcMain.handle('soundfont-cache:gravar', async (_event, url, bytes) => {
  try {
    const dados = Buffer.from(bytes);
    if (!ehSoundFontValido(dados)) return false;
    const arquivo = caminhoSoundFont(url);
    await fs.mkdir(DIRETORIO_CACHE(), { recursive: true });
    const temporario = `${arquivo}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    try {
      await fs.writeFile(temporario, dados);
      await fs.rename(temporario, arquivo);
    } finally {
      await fs.unlink(temporario).catch(() => undefined);
    }
    return true;
  } catch (erro) {
    console.warn('Falha gravando cache SF2:', erro);
    return false;
  }
});

function criarJanela() {
  const janela = new BrowserWindow({
    width: 1400,
    height: 900,
    icon: path.join(__dirname, '../build/icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const indexPath = path.join(
    __dirname,
    '../dist/sf2player/index.html'
  );

  janela.webContents.on('did-fail-load', (event, code, description, url) => {
    console.error('Falha ao carregar:', {
      code,
      description,
      url
    });
  });

  janela.webContents.on('console-message', (event, level, message) => {
    console.log('[Angular/Electron]', message);
  });

  janela.loadFile(indexPath);

  // Temporariamente, para diagnosticar a tela branca.
  janela.webContents.openDevTools();
}

app.whenReady().then(criarJanela);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
