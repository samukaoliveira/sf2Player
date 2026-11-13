const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'build-linux');
const source = path.join(root, 'src');
const modules = path.join(root, 'node_modules');
const packerQt = path.join(modules, '@nodegui', 'packer', 'deps', 'linuxdeployqt');
const deployQtDir = path.join(root, 'build-linuxdeployqt');

if (!fs.existsSync(path.join(modules, '@nodegui', 'nodegui', 'build', 'Release', 'nodegui_core.node'))) {
  throw new Error('NodeGui addon is missing. Run npm install before packaging.');
}
for (const required of [
  path.join(modules, 'midi', 'build', 'Release', 'midi.node'),
  path.join(modules, 'file-uri-to-path', 'index.js')
]) {
  if (!fs.existsSync(required)) throw new Error(`Required MIDI runtime dependency is missing: ${required}. Install ALSA development headers and run npm install.`);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const filename of ['index.js', 'audio-worker.cjs', 'soundfont-catalog.json']) {
  fs.copyFileSync(path.join(source, filename), path.join(output, filename));
}

// Packer deploys Qt libraries by scanning native addons at the dist root.
fs.copyFileSync(
  path.join(modules, '@nodegui', 'nodegui', 'build', 'Release', 'nodegui_core.node'),
  path.join(output, 'nodegui_core.node')
);
function includeRuntimePath(sourcePath) {
  const relative = path.relative(modules, sourcePath).split(path.sep);
  if (relative.some(part => part === '.cache' || part === '.git')) return false;
  if (relative[0] === '@nodegui' && relative[1] === 'packer') return false;
  if (relative[0] === '@nodegui' && relative[1] === 'qode') return false;
  if (relative[0] === '@nodegui' && relative[1] === 'nodegui' && relative.length > 2 &&
      !['dist', 'build', 'miniqt', 'package.json'].includes(relative[2])) return false;
  if (relative.includes('examples') || relative.includes('sqldrivers')) return false;
  if (relative.includes('miniqt')) {
    const file = relative[relative.length - 1];
    const pluginsIndex = relative.indexOf('plugins');
    if (pluginsIndex >= 0) {
      if (relative.length <= pluginsIndex + 1) return true;
      const pluginGroup = relative[pluginsIndex + 1];
      if (pluginGroup !== 'platforms') return false;
      if (fs.statSync(sourcePath).isDirectory()) return true;
      if (file !== 'libqxcb.so' && file !== 'libqoffscreen.so') return false;
    }
    if (relative.includes('include') || relative.includes('doc') || relative.includes('mkspecs') ||
        relative.includes('libexec') || relative.includes('translations')) return false;
    if (relative.includes('bin') && file !== 'qmake' && !fs.statSync(sourcePath).isDirectory()) return false;
    if (relative.includes('lib') && /\.(a|prl)$/.test(file)) return false;
    if (relative.includes('lib') && ['cmake', 'pkgconfig'].includes(file)) return false;
  }
  return true;
}
fs.cpSync(modules, path.join(output, 'node_modules'), {
  recursive: true,
  dereference: true,
  filter: includeRuntimePath
});

// Extract AppImage tooling without requiring FUSE on the build host.
fs.mkdirSync(deployQtDir, { recursive: true });
const originalPackerQt = `${packerQt}.appimage`;
if (fs.existsSync(originalPackerQt)) fs.copyFileSync(originalPackerQt, packerQt);
if (!fs.existsSync(path.join(deployQtDir, 'squashfs-root', 'usr', 'bin', 'appimagetool'))) {
  const { spawnSync } = require('child_process');
  fs.rmSync(path.join(deployQtDir, 'squashfs-root'), { recursive: true, force: true });
  const extraction = spawnSync(packerQt, ['--appimage-extract'], { cwd: deployQtDir, stdio: 'inherit' });
  if (extraction.status !== 0) throw new Error('Could not extract Packer AppImage tools for a FUSE-free build.');
}

console.log(`Linux bundle staging ready at ${output}`);
