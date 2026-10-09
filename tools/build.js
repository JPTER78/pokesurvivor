/* Empaqueta el juego para publicarlo: un solo JS minificado en vez de ~60.
 *   node tools/build.js
 *
 * - dev.html es la página "fuente": carga cada script por separado (para
 *   programar y depurar cómodamente). SE EDITA dev.html, no index.html.
 * - index.html se genera a partir de dev.html, cambiando el bloque de scripts
 *   por js/app.min.js (con la huella en la URL para que no se quede en caché).
 * - node tools/build.js --sin-seo  ->  sin lo de SEO (hasta tener pokesurvivor.com).
 * - Después hay que regenerar en/index.html: python tools/make_seo_pages.py
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const DEV = path.join(ROOT, 'dev.html'), OUT = path.join(ROOT, 'index.html');
const BEGIN = '<!-- scripts:begin -->', END = '<!-- scripts:end -->';

const dev = fs.readFileSync(DEV, 'utf8');
const i = dev.indexOf(BEGIN), j = dev.indexOf(END);
if (i < 0 || j < 0) throw new Error('dev.html no tiene las marcas ' + BEGIN + ' / ' + END);
const block = dev.slice(i, j + END.length);
const files = [...block.matchAll(/<script[^>]*src="(js\/[^"]+\.js)"/g)].map(m => m[1]);

// Une los archivos en orden; cada uno separado por ';' por si alguno no acaba en punto y coma.
const joined = files.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
const tmp = path.join(ROOT, 'tools', 'cache', 'app.js');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, joined);
const outJs = path.join(ROOT, 'js', 'app.min.js');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(npx, ['--yes', 'terser@5', tmp, '--compress', 'passes=1', '--mangle', '--comments', 'false', '--ecma', '2020', '-o', outJs],
  { stdio: 'inherit', shell: process.platform === 'win32' });
const min = fs.readFileSync(outJs);
const hash = crypto.createHash('sha1').update(min).digest('hex').slice(0, 10);

let html = dev.slice(0, i) + `<script defer src="js/app.min.js?v=${hash}"></script>` + dev.slice(j + END.length);
html = html.replace(/<meta name="robots" content="noindex">\s*/, '');
// --sin-seo: sin canonical/redes/datos estructurados ni enlaces a las páginas
// (para publicar antes de tener el dominio pokesurvivor.com).
const SIN_SEO = process.argv.includes('--sin-seo');
html = SIN_SEO ? html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->\n?/g, '') : html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
html = html.replace(/<!-- dev.html: página fuente[^>]*-->/, '<!-- GENERADO desde dev.html por tools/build.js: no editar a mano (se edita dev.html). -->');
fs.writeFileSync(OUT, html);
console.log(`${SIN_SEO ? '[sin SEO] ' : ''}ok: ${files.length} scripts · ${(joined.length / 1024).toFixed(0)} KB -> ${(min.length / 1024).toFixed(0)} KB (app.min.js?v=${hash})`);
