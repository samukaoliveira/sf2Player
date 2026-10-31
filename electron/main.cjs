const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const DIRETORIO_SOUNDFONTS = () => process.platform === 'win32'
  ? 'C:\\Samnat-Synth\\soundfonts'
  : path.join(app.getPath('userData'), 'soundfonts');
const ARQUIVO_CATALOGO_LOCAL = () => path.join(DIRETORIO_SOUNDFONTS(), 'catalogo-local.json');
const DIRETORIO_CENAS = () => process.platform === 'win32'
  ? 'C:\\Samnat-Synth\\cenas'
  : path.join(app.getPath('userData'), 'cenas');
const ARQUIVO_CENAS = () => path.join(DIRETORIO_CENAS(), 'cenas.json');
let filaSalvarCenas = Promise.resolve();

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
  const nome = path.basename(new URL(url).pathname);
  if (!nome || !/^[-\w.()\[\] %'\u0080-\uFFFF]+\.sf2$/i.test(nome)) {
    throw new Error('Nome de SoundFont inválido.');
  }
  return path.join(DIRETORIO_SOUNDFONTS(), decodeURIComponent(nome));
}

function nomeSoundFontSeguro(nome) {
  const base = path.basename(String(nome || '').replace(/\\/g, '/'));
  if (!/^[-\w.()\[\] %'\u0080-\uFFFF]+\.sf2$/i.test(base)) {
    throw new Error('Selecione um arquivo SF2 com nome válido.');
  }
  return base;
}

async function lerCategoriasLocais() {
  try {
    const dados = JSON.parse(await fs.readFile(ARQUIVO_CATALOGO_LOCAL(), 'utf8'));
    return dados && typeof dados === 'object' ? dados : {};
  } catch (_erro) {
    return {};
  }
}

ipcMain.handle('soundfont-local:listar', async () => {
  await fs.mkdir(DIRETORIO_SOUNDFONTS(), { recursive: true });
  const categorias = await lerCategoriasLocais();
  const arquivos = await fs.readdir(DIRETORIO_SOUNDFONTS(), { withFileTypes: true });
  const resultado = [];
  for (const item of arquivos) {
    if (!item.isFile() || !/\.sf2$/i.test(item.name)) continue;
    try {
      const dados = await fs.readFile(path.join(DIRETORIO_SOUNDFONTS(), item.name));
      if (!ehSoundFontValido(dados)) continue;
      resultado.push({ nome: item.name, categoria: categorias[item.name] || '' });
    } catch (_erro) {
      // Arquivos ainda sendo copiados ou sem permissão não entram no catálogo.
    }
  }
  return resultado;
});

ipcMain.handle('soundfont-local:ler', async (_event, nome) => {
  try {
    const arquivo = path.join(DIRETORIO_SOUNDFONTS(), nomeSoundFontSeguro(nome));
    const dados = await fs.readFile(arquivo);
    return ehSoundFontValido(dados) ? new Uint8Array(dados) : null;
  } catch (_erro) {
    return null;
  }
});

ipcMain.handle('soundfont-local:importar', async (_event, nome, categoria, bytes) => {
  try {
    const nomeSeguro = nomeSoundFontSeguro(nome);
    if (typeof categoria !== 'string' || !categoria.trim()) {
      return { sucesso: false, erro: 'Escolha uma categoria para o SoundFont.' };
    }
    const arquivo = path.join(DIRETORIO_SOUNDFONTS(), nomeSeguro);
    await fs.mkdir(DIRETORIO_SOUNDFONTS(), { recursive: true });
    try {
      await fs.access(arquivo);
      return { sucesso: false, erro: `Já existe um arquivo chamado ${nomeSeguro}.` };
    } catch (_erro) {
      // O caminho ainda está livre.
    }
    const dados = Buffer.from(bytes);
    if (!ehSoundFontValido(dados)) {
      return { sucesso: false, erro: 'O arquivo escolhido não é um SoundFont SF2 válido.' };
    }
    await fs.writeFile(arquivo, dados, { flag: 'wx' });
    const categorias = await lerCategoriasLocais();
    categorias[nomeSeguro] = categoria.trim();
    await fs.writeFile(ARQUIVO_CATALOGO_LOCAL(), JSON.stringify(categorias, null, 2), 'utf8');
    return { sucesso: true };
  } catch (erro) {
    return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao importar SoundFont.' };
  }
});

ipcMain.handle('cenas-local:ler', async () => {
  try {
    return await fs.readFile(ARQUIVO_CENAS(), 'utf8');
  } catch (erro) {
    if (erro.code !== 'ENOENT') console.warn('Falha lendo cenas locais:', erro);
    return null;
  }
});

ipcMain.handle('cenas-local:gravar', (_event, conteudo) => {
  const gravar = async () => {
    try {
      const cenas = JSON.parse(conteudo);
      if (!Array.isArray(cenas)) return false;
      await fs.mkdir(DIRETORIO_CENAS(), { recursive: true });
      const temporario = `${ARQUIVO_CENAS()}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
      try {
        await fs.writeFile(temporario, JSON.stringify(cenas, null, 2), 'utf8');
        await fs.rename(temporario, ARQUIVO_CENAS());
      } finally {
        await fs.unlink(temporario).catch(() => undefined);
      }
      return true;
    } catch (erro) {
      console.warn('Falha gravando cenas locais:', erro);
      return false;
    }
  };
  filaSalvarCenas = filaSalvarCenas.then(gravar, gravar);
  return filaSalvarCenas;
});

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
    await fs.mkdir(DIRETORIO_SOUNDFONTS(), { recursive: true });
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
