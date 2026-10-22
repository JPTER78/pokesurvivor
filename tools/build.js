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
let joined = files.map(f => `/* ${f} */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
// Anti-trampas: en la versión publicada el juego va ENCERRADO en una función:
// G deja de existir en la consola del navegador (F12), y con él los atajos para
// hacerse invencible, saltar el reloj, etc. (dev.html sigue igual, para programar).
//   --expose   sin encerrar ni ofuscar (para las pruebas automáticas)
const EXPOSE = process.argv.includes('--expose');
if (!EXPOSE) {
  const WIN_G = 'window.G = window.G || {};';
  if (!joined.includes(WIN_G)) throw new Error('util.js ya no crea G como se esperaba: revisa build.js');
  joined = '(() => {\n' + joined.replace(WIN_G, 'var G = {};') + '\n})();\n';
}
const tmp = path.join(ROOT, 'tools', 'cache', 'app.js');
fs.mkdirSync(path.dirname(tmp), { recursive: true });
fs.writeFileSync(tmp, joined);
const outJs = path.join(ROOT, 'js', 'app.min.js');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const shell = process.platform === 'win32';
const relTmp = path.relative(ROOT, tmp);
const relOut = path.relative(ROOT, outJs);
execFileSync(npx, ['--yes', 'terser@5', relTmp, '--compress', 'passes=1', '--mangle', '--comments', 'false', '--ecma', '2020', '-o', relOut],
  { cwd: ROOT, stdio: 'inherit', shell });
// Y ofuscado: el código queda ilegible y se rompe solo si lo reformatean para
// tocarlo. Las cadenas, en una tabla codificada (sólo una parte, para no frenar
// el juego). Semilla fija: el mismo código da siempre el mismo archivo.
if (!EXPOSE) {
  execFileSync(npx, ['--yes', 'javascript-obfuscator@4.1.1', relOut, '--output', relOut,
    '--compact', 'true', '--self-defending', 'true', '--seed', '7',
    '--string-array', 'true', '--string-array-encoding', 'base64', '--string-array-threshold', '0.1',
    '--identifier-names-generator', 'hexadecimal', '--rename-globals', 'false', '--transform-object-keys', 'false',
    '--split-strings', 'false', '--control-flow-flattening', 'false', '--dead-code-injection', 'false',
    '--unicode-escape-sequence', 'false', '--target', 'browser'], { cwd: ROOT, stdio: 'inherit', shell });
}
const min = fs.readFileSync(outJs);
// La huella cuenta también el CSS: un cambio sólo de estilos es versión nueva (version.json).
const hash = crypto.createHash('sha1').update(min).update(fs.readFileSync(path.join(ROOT, 'css', 'style.css'))).digest('hex').slice(0, 10);

// Diccionarios de francés, italiano, portugués y chino (js/lang/), uno por idioma: los pide
// locales.js con su misma huella ?v=, para que al cambiar no se queden en caché.
const { build: buildLangs } = require('./build_langs');
const langSizes = buildLangs();
const LOC = '<script src="js/core/locales.js"></script>';
const locHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'js', 'core', 'locales.js')));
for (const f of fs.readdirSync(path.join(ROOT, 'js', 'lang')).sort()) locHash.update(fs.readFileSync(path.join(ROOT, 'js', 'lang', f)));
if (!dev.includes(LOC)) throw new Error('dev.html no carga ' + LOC + ' como se esperaba: revisa build.js');

let html = dev.slice(0, i) + `<script defer src="js/app.min.js?v=${hash}"></script>` + dev.slice(j + END.length);
html = html.replace(LOC, `<script src="js/core/locales.js?v=${locHash.digest('hex').slice(0, 10)}"></script>`);
// La hoja de estilos también con huella: si no, el navegador puede juntar la página nueva
// con el style.css viejo que tiene guardado.
const CSS = '<link rel="stylesheet" href="css/style.css">';
if (!dev.includes(CSS)) throw new Error('dev.html no carga ' + CSS + ' como se esperaba: revisa build.js');
const cssHash = crypto.createHash('sha1').update(fs.readFileSync(path.join(ROOT, 'css', 'style.css'))).digest('hex').slice(0, 10);
html = html.replace(CSS, `<link rel="stylesheet" href="css/style.css?v=${cssHash}">`);
html = html.replace(/<meta name="robots" content="noindex">\s*/, '');
// --sin-seo: sin canonical/redes/datos estructurados ni enlaces a las páginas
// (para publicar antes de tener el dominio pokesurvivor.com).
const SIN_SEO = process.argv.includes('--sin-seo');
html = SIN_SEO ? html.replace(/<!-- seo:begin -->[\s\S]*?<!-- seo:end -->\n?/g, '') : html.replace(/<!-- seo:(begin|end) -->\n?/g, '');
html = html.replace(/<!-- dev.html: página fuente[^>]*-->/, '<!-- GENERADO desde dev.html por tools/build.js: no editar a mano (se edita dev.html). -->');
fs.writeFileSync(OUT, html);
// Versión publicada: los jugadores la miran cada 5 min y, si cambia, el juego se
// actualiza solo (en el menú, o al acabar la partida). Ver js/core/updater.js.
// --forzar: versión obligatoria, también corta las partidas en curso (guardándolas).
const FORZAR = process.argv.includes('--forzar');
fs.writeFileSync(path.join(ROOT, 'version.json'), JSON.stringify(Object.assign({ v: hash, at: new Date().toISOString() }, FORZAR ? { force: true } : {})) + '\n');
console.log('ok: diccionarios ' + langSizes.join(' · '));
console.log(`${FORZAR ? '[OBLIGATORIA] ' : ''}${SIN_SEO ? '[sin SEO] ' : ''}${EXPOSE ? '[SIN PROTEGER, sólo pruebas] ' : ''}ok: ${files.length} scripts · ${(joined.length / 1024).toFixed(0)} KB -> ${(min.length / 1024).toFixed(0)} KB (app.min.js?v=${hash})`);
