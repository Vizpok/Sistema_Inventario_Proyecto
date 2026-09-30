const express = require('express');
const bcrypt = require('bcryptjs');
const { uno, query } = require('../db');
const { registrarBitacora } = require('../middleware');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.usuario) return res.redirect('/dashboard');
  res.render('auth/login', { titulo: 'Iniciar sesión', correo: '' });
});

router.post('/login', async (req, res) => {
  const correo = String(req.body.correo || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const u = await uno(
    `SELECT id_usuario, nombre, apellidos, correo, password_hash, rol, puesto, activo
     FROM usuarios WHERE lower(correo) = $1`, [correo],
  );
  if (!u || !(await bcrypt.compare(password, u.password_hash))) {
    return res.status(401).render('auth/login', { titulo: 'Iniciar sesión', correo, error: 'Correo o contraseña incorrectos.' });
  }
  if (!u.activo) {
    return res.status(403).render('auth/login', { titulo: 'Iniciar sesión', correo, error: 'Tu cuenta está desactivada. Contacta al administrador.' });
  }
  const volverA = req.session.volverA;
  req.session.regenerate(async (err) => {
    if (err) throw err;
    req.session.usuario = {
      id: u.id_usuario, nombre: u.nombre, apellidos: u.apellidos, correo: u.correo, rol: u.rol, puesto: u.puesto,
    };
    await query('UPDATE usuarios SET ultimo_acceso = now() WHERE id_usuario = $1', [u.id_usuario]);
    await registrarBitacora(req, 'LOGIN', 'Sesión', `Inicio de sesión de ${u.correo}`);
    res.redirect(volverA && volverA.startsWith('/') ? volverA : '/dashboard');
  });
});

router.post('/logout', async (req, res) => {
  if (req.session.usuario) await registrarBitacora(req, 'LOGOUT', 'Sesión', `Cierre de sesión de ${req.session.usuario.correo}`);
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
