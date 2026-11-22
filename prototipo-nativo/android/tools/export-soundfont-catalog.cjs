const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../../../src/app/components/keyboard/soundfont-catalog.config.ts');
const output = path.resolve(__dirname, '../app/src/main/assets/soundfont-catalog.json');
const text = fs.readFileSync(source, 'utf8');
const entry = /nome:\s*"([^"]+)"\s*,\s*arquivo:\s*soundfontUrl\("([^"]+)"\)\s*,\s*categoria:\s*"([^"]+)"/g;
const catalog = [...text.matchAll(entry)].map((match) => ({
  name: match[1],
  file: match[2],
  category: match[3]
}));
const defaults = [
  { name: 'Yamaha Montage - Warm Pad', file: 'General_Montage_Pads_Warm.sf2', category: 'Pads' },
  { name: 'Yamaha Montage - Strings Section', file: 'General_Montage_Strings_Section.sf2', category: 'Strings' },
  { name: 'Yamaha Montage - Drawbar Organ', file: 'General_Montage_Organs_Drawbar.sf2', category: 'Organs' },
  { name: 'Yamaha Montage - DX7', file: 'General_Montage_DX7.sf2', category: 'Pianos' }
];
for (const item of defaults) if (!catalog.some((existing) => existing.file === item.file)) catalog.push(item);

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(catalog, null, 2)}\n`);
process.stdout.write(`Catálogo Android atualizado: ${catalog.length} SoundFonts\n`);
