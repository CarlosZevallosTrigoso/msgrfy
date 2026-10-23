// Guardado automático en el navegador. IndexedDB (sin límite práctico para imágenes);
// si no está disponible, localStorage como recurso de emergencia.
const DB = 'museodraft', STORE = 'proyectos', CLAVE = 'actual', LS = 'museodraft:proyecto';

const abrir = () => new Promise((res, rej) => {
  if (typeof indexedDB === 'undefined') return rej(new Error('sin IndexedDB'));
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => { r.result.createObjectStore(STORE); };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error || new Error('No se pudo abrir el almacén'));
  r.onblocked = () => rej(new Error('Almacén bloqueado por otra pestaña'));
});
const tx = (db, modo, fn) => new Promise((res, rej) => {
  const t = db.transaction(STORE, modo); const st = t.objectStore(STORE); const q = fn(st);
  t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('Transacción abortada'));
});

// Devuelve el objeto guardado o null. Nunca lanza: si algo falla, devuelve null y lo anota en consola.
export async function cargar() {
  try { const db = await abrir(); const r = await tx(db, 'readonly', (st) => st.get(CLAVE)); db.close(); if (r) return r; }
  catch (e) { console.warn('almacén:', e.message); }
  try { const s = localStorage.getItem(LS); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
// Lanza si no se pudo guardar en ningún sitio (para avisar al usuario).
export async function guardar(proyecto) {
  try { const db = await abrir(); await tx(db, 'readwrite', (st) => st.put(proyecto, CLAVE)); db.close(); return 'idb'; }
  catch (e) { console.warn('almacén:', e.message); }
  localStorage.setItem(LS, JSON.stringify(proyecto)); return 'ls';
}
export async function borrar() {
  try { const db = await abrir(); await tx(db, 'readwrite', (st) => st.delete(CLAVE)); db.close(); } catch (e) {}
  try { localStorage.removeItem(LS); } catch (e) {}
}
