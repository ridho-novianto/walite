const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src-tauri', 'wa-privacy-panel.js');
let code = fs.readFileSync(filePath, 'utf8');

// Minify CSS_RULES safely without stripping space before pseudo-classes like :is
code = code.replace(/const CSS_RULES = `([\s\S]*?)`;/, (match, css) => {
  const minifiedCss = css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([;{},>])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/\s+:/g, ' :')
    .trim();
  return 'const CSS_RULES = `' + minifiedCss + '`;';
});

fs.writeFileSync(filePath, code);
console.log('Optimized wa-privacy-panel.js size in bytes:', Buffer.byteLength(code));

