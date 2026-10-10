/** Sección de usuario: perfil, cambio de contraseña y actividad propia */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, uno } = require('../db');
const { registrarBitacora } = require('../middleware');
const { listar } = require('./movimientos');

const router = express.Router();

router.get('/', async (req, res) => {
  const id = req.session.usuario.id;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const [perfil, resumen, movs, actividad] = await Promise.all([
    uno(`SELECT u.*, (SELECT string_agg(a.nombre, ', ') FROM almacenes a WHERE a.id_responsable = u.id_usuario) AS almacenes
         FROM usuarios u WHERE u.id_usuario = $1`, [id]),
    uno(`SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE t.naturaleza = 'ENTRADA')::int AS entradas,
                COUNT(*) FILTER (WHERE t.naturaleza = 'SALIDA')::int AS salidas,
                COUNT(*) FILTER (WHERE m.fecha >= now() - INTERVAL '30 days')::int AS ultimos_30
         FROM movimientos m JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
         WHERE m.id_usuario = $1`, [id]),
    listar({ usuario: id }, pagina),
    query(`SELECT accion, modulo, descripcion, fecha FROM bitacora
           WHERE id_usuario = $1 ORDER BY fecha DESC LIMIT 8`, [id]),
  ]);
  res.render('cuenta/index', { titulo: 'Mi cuenta', perfil, resumen, movs, pagina, actividad });
});

router.post('/perfil', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const apellidos = String(req.body.apellidos || '').trim();
  if (!nombre || !apellidos) {
    req.flash('error', 'Nombre y apellidos son obligatorios.');
    return res.redirect('/mi-cuenta');
  }
  await query('UPDATE usuarios SET nombre = $1, apellidos = $2 WHERE id_usuario = $3', [nombre, apellidos, req.session.usuario.id]);
  Object.assign(req.session.usuario, { nombre, apellidos });
  await registrarBitacora(req, 'EDITAR', 'Mi cuenta', 'Actualizó sus datos personales');
  req.flash('exito', 'Datos actualizados.');
  res.redirect('/mi-cuenta');
});

router.post('/password', async (req, res) => {
  const { actual, nueva, confirmar } = req.body;
  const u = await uno('SELECT password_hash FROM usuarios WHERE id_usuario = $1', [req.session.usuario.id]);
  if (!(await bcrypt.compare(String(actual || ''), u.password_hash))) {
    req.flash('error', 'La contraseña actual no es correcta.');
  } else if (String(nueva || '').length < 8) {
    req.flash('error', 'La nueva contraseña debe tener al menos 8 caracteres.');
  } else if (nueva !== confirmar) {
    req.flash('error', 'La confirmación no coincide.');
  } else {
    await query('UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2', [await bcrypt.hash(nueva, 10), req.session.usuario.id]);
    await registrarBitacora(req, 'PASSWORD', 'Mi cuenta', 'Cambió su contraseña');
    req.flash('exito', 'Contraseña actualizada.');
  }
  res.redirect('/mi-cuenta#seguridad');
});

module.exports = router;
