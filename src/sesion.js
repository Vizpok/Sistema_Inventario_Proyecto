/**
 * Sesión guardada en UNA cookie firmada con HMAC-SHA256: "<datos base64url>.<firma>".
 *
 * No guarda estado en el servidor, así funciona igual en local y en Neon Functions
 * (donde las instancias se reciclan o se multiplican). Se usa una sola cookie porque
 * el runtime de Neon conserva sólo un encabezado Set-Cookie por respuesta.
 *
 * API compatible con lo que usa la app: req.session es un objeto; asignar
 * req.session = {...} reemplaza la sesión y req.session = null la elimina.
 */
const crypto = require('crypto');

function crearSesion({ nombre = 'nexo.sid', secreto, maxAgeMs = 8 * 60 * 60 * 1000 }) {
  const firmar = (valor) => crypto.createHmac('sha256', secreto).update(valor).digest('base64url');

  function leer(req) {
    const cookies = req.headers.cookie || '';
    const par = cookies.split(/;\s*/).find((c) => c.startsWith(`${nombre}=`));
    if (!par) return null;
    const valor = decodeURIComponent(par.slice(nombre.length + 1));
    const punto = valor.lastIndexOf('.');
    if (punto < 1) return null;
    const datos = valor.slice(0, punto);
    const firma = Buffer.from(valor.slice(punto + 1));
    const esperada = Buffer.from(firmar(datos));
    if (firma.length !== esperada.length || !crypto.timingSafeEqual(firma, esperada)) return null;
    try {
      const sesion = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'));
      return sesion.exp > Date.now() ? sesion : null;
    } catch {
      return null;
    }
  }

  return function sesion(req, res, next) {
    const leida = leer(req);
    const original = leida ? JSON.stringify(leida.d) : null;
    let actual = leida ? leida.d : {};
    Object.defineProperty(req, 'session', {
      configurable: true,
      get: () => actual,
      set: (valor) => { actual = valor; },
    });

    // Antes de enviar los encabezados se escribe (o borra) la cookie si la sesión cambió
    const writeHead = res.writeHead;
    res.writeHead = function (...args) {
      const atributos = `Path=/; HttpOnly; SameSite=Lax${req.secure ? '; Secure' : ''}`;
      if (actual === null) {
        if (leida) res.setHeader('Set-Cookie', `${nombre}=; ${atributos}; Max-Age=0`);
      } else {
        const json = JSON.stringify(actual);
        if (json !== original && !(original === null && json === '{}')) {
          const datos = Buffer.from(JSON.stringify({ d: actual, exp: Date.now() + maxAgeMs })).toString('base64url');
          const valor = encodeURIComponent(`${datos}.${firmar(datos)}`);
          res.setHeader('Set-Cookie', `${nombre}=${valor}; ${atributos}; Max-Age=${Math.floor(maxAgeMs / 1000)}`);
        }
      }
      return writeHead.apply(this, args);
    };
    next();
  };
}

module.exports = crearSesion;
