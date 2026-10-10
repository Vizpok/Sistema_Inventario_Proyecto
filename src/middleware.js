const crypto = require('crypto');
const { query } = require('./db');

/** Mensajes flash de una sola lectura guardados en la sesión */
function flash(req, res, next) {
  req.flash = (tipo, mensaje) => { req.session.flash = { tipo, mensaje }; };
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
}

/** Protección CSRF sencilla: token por sesión en todos los formularios POST */
function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrfToken = req.session.csrf;
  if (req.method === 'POST') {
    const enviado = req.body?._csrf || req.get('x-csrf-token');
    if (!enviado || enviado !== req.session.csrf) {
      const err = new Error('El formulario expiró. Recarga la página e inténtalo de nuevo.');
      err.status = 403;
      return next(err);
    }
  }
  next();
}

function requiereSesion(req, res, next) {
  if (!req.session.usuario) {
    if (req.method === 'GET') req.session.volverA = req.originalUrl;
    return res.redirect('/login');
  }
  next();
}

function requiereAdmin(req, res, next) {
  if (req.session.usuario?.rol !== 'admin') {
    const err = new Error('Esta sección es exclusiva para administradores.');
    err.status = 403;
    return next(err);
  }
  next();
}

/** Registra una acción en la tabla bitacora (no interrumpe si falla) */
async function registrarBitacora(req, accion, modulo, descripcion) {
  try {
    await query(
      'INSERT INTO bitacora (id_usuario, accion, modulo, descripcion) VALUES ($1, $2, $3, $4)',
      [req.session.usuario?.id ?? null, accion, modulo, String(descripcion).slice(0, 255)],
    );
  } catch (e) {
    console.error('No se pudo registrar en bitácora:', e.message);
  }
}

module.exports = { flash, csrf, requiereSesion, requiereAdmin, registrarBitacora };
