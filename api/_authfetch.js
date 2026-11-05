// fetch con la clave en Authorization que sobrevive a una redirección a otro dominio. fetch la sigue
// solo pero borra Authorization al cambiar de origen (por seguridad), y la app responde 401: pasa con
// habitaia.vercel.app → www.habitaia.app. Acá se sigue a mano (hasta 3 saltos, solo https).
module.exports = async function authFetch(url, opts = {}) {
  let target = url;
  for (let hop = 0; hop < 4; hop++) {
    const r = await fetch(target, { ...opts, redirect: 'manual' });
    const loc = r.status >= 300 && r.status < 400 && r.headers.get('location');
    if (!loc) return r;
    const next = new URL(loc, target);
    if (next.protocol !== 'https:') return r;
    target = next.toString();
  }
  throw new Error('Demasiadas redirecciones.');
};
