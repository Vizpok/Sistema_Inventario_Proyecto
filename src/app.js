require('dotenv').config({ quiet: true });
const path = require('path');
const express = require('express');
const session = require('express-session');
const formato = require('./utils/formato');
const iconos = require('./utils/iconos');
const { flash, csrf, requiereSesion, requiereAdmin } = require('./middleware');

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/vendor/chart.js', express.static(path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  name: 'nexo.sid',
  secret: process.env.SESSION_SECRET || 'cambia-este-secreto-en-produccion',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 },
}));
// Variables disponibles en todas las vistas
Object.assign(app.locals, formato, { icono: iconos.icono, empresa: 'Distribuidora Nexo' });
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.esAdmin = req.session.usuario?.rol === 'admin';
  res.locals.ruta = req.path;
  res.locals.flash = null;
  res.locals.csrfToken = '';
  next();
});
app.use(flash);
app.use(csrf);

// Rutas
app.use('/', require('./routes/auth'));
app.use(requiereSesion);
app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/inventario', require('./routes/inventario'));
app.use('/catalogo', require('./routes/catalogo'));
app.use('/categorias', require('./routes/categorias'));
app.use('/proveedores', require('./routes/proveedores'));
app.use('/movimientos', require('./routes/movimientos'));
app.use('/mi-cuenta', require('./routes/cuenta'));
app.use('/admin', requiereAdmin, require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).render('error', { titulo: 'No encontrado', codigo: 404, mensaje: 'La página que buscas no existe.' });
});

// Errores
app.use((err, req, res, _next) => {
  const codigo = err.status || 500;
  if (codigo >= 500) console.error(err);
  res.status(codigo).render('error', {
    titulo: 'Error',
    codigo,
    mensaje: codigo >= 500 ? 'Ocurrió un error inesperado. Revisa la consola del servidor.' : err.message,
  });
});

const puerto = Number(process.env.PORT) || 3000;
if (require.main === module) {
  app.listen(puerto, () => console.log(`Nexo Inventario escuchando en http://localhost:${puerto}`));
}

module.exports = app;
