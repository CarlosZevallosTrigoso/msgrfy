// Produce app.html: index.html con el CSS y todos los módulos incrustados, en un solo archivo.
// Sin dependencias. Los módulos usan import/export sencillos (sin re-exports ni import dinámico),
// así que basta con envolver cada uno en una función y resolver los nombres.
//   node build/concatenar.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENTRADA = 'src/ui/cascaron.js';
const modulos = new Map(); // ruta → { deps, codigo }
const nombre = (ruta) => '__m_' + ruta.replace(/\.js$/, '').replace(/[^a-z0-9]+/gi, '_');

function cargar(ruta) {
  if (modulos.has(ruta)) return;
  modulos.set(ruta, null); // marca contra ciclos
  let src = fs.readFileSync(path.join(raiz, ruta), 'utf8');
  const deps = [];
  src = src.replace(/^import\s+(.+?)\s+from\s+'([^']+)';?[ \t]*$/gm, (m, que, desde) => {
    const dep = path.posix.normalize(path.posix.join(path.posix.dirname(ruta), desde));
    deps.push(dep);
    const n = nombre(dep);
    if (que.startsWith('* as ')) return `const ${que.slice(5).trim()} = ${n};`;
    const partes = que.replace(/[{}]/g, '').split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [a, b] = s.split(/\s+as\s+/); return b ? `${a}: ${b}` : a; });
    return `const { ${partes.join(', ')} } = ${n};`;
  });
  if (/^import\s/m.test(src)) throw new Error(`Import no soportado en ${ruta}`);
  const exps = [];
  src = src.replace(/^export\s+default\s+(\w+);?[ \t]*$/gm, (m, id) => { exps.push(`default: ${id}`); return ''; });
  src = src.replace(/^export\s+(const|let|var|function|class|async function)\s+(\w+)/gm, (m, tipo, id) => { exps.push(id); return `${tipo} ${id}`; });
  if (/^export\s/m.test(src)) throw new Error(`Export no soportado en ${ruta}`);
  for (const d of deps) cargar(d);
  modulos.set(ruta, { deps, codigo: `// ── ${ruta}\nconst ${nombre(ruta)} = (() => {\n${src.trim()}\nreturn { ${exps.join(', ')} };\n})();` });
}
cargar(ENTRADA);

// orden: dependencias antes que dependientes
const orden = []; const visto = new Set();
const visitar = (r) => { if (visto.has(r)) return; visto.add(r); for (const d of modulos.get(r).deps) visitar(d); orden.push(r); };
visitar(ENTRADA);
const bundle = orden.map((r) => modulos.get(r).codigo).join('\n\n');
if (bundle.includes('</script')) throw new Error('El código contiene "</script": partiría el archivo único');

let html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(raiz, 'src/ui/estilo.css'), 'utf8');
if (css.includes('</style')) throw new Error('El CSS contiene "</style"');
// reemplazos con función: en una cadena de reemplazo, «$$» y «$&» tienen significado especial
html = html.replace('<link rel="stylesheet" href="src/ui/estilo.css">', () => '<style>\n' + css.trim() + '\n</style>');
html = html.replace('<script type="module" src="src/ui/cascaron.js"></script>', () => '<script>\n(() => {\n' + bundle + '\n})();\n</script>');
// copia del documento tal como se sirvió: base de la exportación HTML de lectura.
// Va al final del body (con todo ya leído, incluido el bundle) y antes de que el cascarón monte nada:
// cascaron.js espera a DOMContentLoaded antes de tocar el DOM.
html = html.replace(/<\/body>/, () => "<script>window.__ORIGEN_HTML = '<!DOCTYPE html>\\n' + document.documentElement.outerHTML;</script>\n</body>");
if (html.includes('src="src/')) throw new Error('Quedan referencias a src/ en app.html');
fs.writeFileSync(path.join(raiz, 'app.html'), html);
console.log(`app.html: ${orden.length} módulos, ${(html.length / 1024).toFixed(0)} KB`);
