import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const items = [
  'diagonal', 'zigzag', 'arrows', 'checker', 'bricks', 'bars',
  'waves', 'hexagons', 'diamonds', 'dots', 'links', 'zebra',
];
let css = '/* Kenney Pattern Pack, CC0. https://kenney.nl */\n';
css += '.fpb-pattern-swatch{background-repeat:repeat;background-position:center;background-color:#e7eee7}\n';
css += '.fpb-section-wallpaper.fpb-pattern{background-repeat:repeat;background-position:center;background-color:transparent}\n';
css += '.fpb-section-wallpaper.fpb-pattern img{display:none}\n';
for (const id of items) {
  const b64 = fs.readFileSync(path.join(dir, id + '.png')).toString('base64');
  css += '.fpb-pattern-swatches button.fpb-pattern-' + id + ',.fpb-section-wallpaper.fpb-pattern-' + id + '{background-image:url("data:image/png;base64,' + b64 + '");background-size:128px}\n';
}
fs.writeFileSync(path.join(dir, '..', 'patterns.css'), css);
console.log(css.length);
