import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('app.html: el bundle compila, no quedan rutas src/ y la copia del documento se toma al final del body', () => {
  execFileSync(process.execPath, [path.join(raiz, 'build/concatenar.js')], { stdio: 'pipe' });
  const html = fs.readFileSync(path.join(raiz, 'app.html'), 'utf8');
  assert.ok(!html.includes('src="src/'));
  const iBundle = html.indexOf('<script>\n(() => {'), iCopia = html.indexOf('window.__ORIGEN_HTML'), iBody = html.lastIndexOf('</body>');
  assert.ok(iBundle > 0 && iCopia > iBundle && iCopia < iBody, 'la copia va después del bundle y antes de </body>');
  const bundle = html.slice(iBundle + '<script>'.length, html.indexOf('</script>', iBundle));
  assert.doesNotThrow(() => new Function(bundle), 'el bundle es JavaScript válido');
  const fuentes = fs.readdirSync(path.join(raiz, 'src/vistas')).concat(fs.readdirSync(path.join(raiz, 'src/ui')).map((f) => '../ui/' + f)).filter((f) => f.endsWith('.js'));
  const n = fuentes.reduce((k, f) => k + (fs.readFileSync(path.join(raiz, 'src/vistas', f), 'utf8').match(/\$\$\(/g) || []).length, 0);
  assert.equal((bundle.match(/\$\$\(/g) || []).length, n, 'los «$$» del código llegan intactos (sin colapsar a «$»)');
});
