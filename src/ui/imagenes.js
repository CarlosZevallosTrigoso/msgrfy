// Lectura y reducción de imágenes a dataURL. Solo navegador.
export const leerImagen = (file, maxLado = 1200) => new Promise((res, rej) => {
  if (!file || !/^image\//.test(file.type)) return rej(new Error('El archivo no es una imagen'));
  const url = URL.createObjectURL(file), img = new Image();
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Formato de imagen no soportado por el navegador')); };
  img.onload = () => {
    URL.revokeObjectURL(url);
    const w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!(w0 > 0 && h0 > 0)) return rej(new Error('Imagen vacía'));
    const k = Math.min(1, maxLado / Math.max(w0, h0));
    const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'), alfa = /png|gif|webp|svg/.test(file.type);
    if (!alfa) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); }
    g.drawImage(img, 0, 0, w, h);
    try { res({ dataURL: c.toDataURL(alfa ? 'image/png' : 'image/jpeg', 0.88), w: w0, h: h0, ratio: w0 / h0 }); }
    catch (e) { rej(new Error('No se pudo procesar la imagen')); }
  };
  img.src = url;
});
