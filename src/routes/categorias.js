const express = require('express');
const { query, uno, mensajeError } = require('../db');
const { requiereAdmin, registrarBitacora } = require('../middleware');

const router = express.Router();

const listar = () => query(
  `SELECT c.*, COUNT(p.id_producto) FILTER (WHERE p.activo)::int AS productos,
          fn_valor_inventario(c.id_categoria) AS valor   -- función de cálculo
   FROM categorias c LEFT JOIN productos p ON p.id_categoria = c.id_categoria
   GROUP BY c.id_categoria ORDER BY c.activo DESC, c.nombre`,
);

function leer(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    descripcion: String(body.descripcion || '').trim() || null,
    color: /^#[0-9A-Fa-f]{6}$/.test(body.color || '') ? body.color.toUpperCase() : '#4F46E5',
  };
}

router.get('/', async (req, res) => {
  res.render('categorias/index', { titulo: 'Categorías', categorias: await listar(), nueva: { color: '#4F46E5' } });
});

router.post('/', requiereAdmin, async (req, res) => {
  const c = leer(req.body);
  try {
    if (!c.nombre) throw Object.assign(new Error('El nombre es obligatorio.'), { code: 'P0001' });
    await query('INSERT INTO categorias (nombre, descripcion, color) VALUES ($1, $2, $3)', [c.nombre, c.descripcion, c.color]);
    await registrarBitacora(req, 'CREAR', 'Categorías', c.nombre);
    req.flash('exito', `Categoría "${c.nombre}" creada.`);
    res.redirect('/categorias');
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('categorias/index', { titulo: 'Categorías', categorias: await listar(), nueva: c, error: msg });
  }
});

router.get('/:id/editar', requiereAdmin, async (req, res, next) => {
  const categoria = await uno('SELECT * FROM categorias WHERE id_categoria = $1', [Number(req.params.id)]);
  if (!categoria) return next();
  res.render('categorias/form', { titulo: `Editar categoría`, categoria });
});

router.post('/:id', requiereAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const c = leer(req.body);
  try {
    await query('UPDATE categorias SET nombre = $1, descripcion = $2, color = $3 WHERE id_categoria = $4', [c.nombre, c.descripcion, c.color, id]);
    await registrarBitacora(req, 'EDITAR', 'Categorías', c.nombre);
    req.flash('exito', 'Categoría actualizada.');
    res.redirect('/categorias');
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('categorias/form', { titulo: 'Editar categoría', categoria: { ...c, id_categoria: id }, error: msg });
  }
});

router.post('/:id/estado', requiereAdmin, async (req, res) => {
  const fila = await uno('UPDATE categorias SET activo = NOT activo WHERE id_categoria = $1 RETURNING nombre, activo', [Number(req.params.id)]);
  if (fila) {
    await registrarBitacora(req, fila.activo ? 'ACTIVAR' : 'DESACTIVAR', 'Categorías', fila.nombre);
    req.flash('exito', `Categoría "${fila.nombre}" ${fila.activo ? 'activada' : 'desactivada'}.`);
  }
  res.redirect('/categorias');
});

// Eliminar: la llave foránea (ON DELETE RESTRICT) impide borrar categorías con productos
router.post('/:id/eliminar', requiereAdmin, async (req, res) => {
  try {
    const fila = await uno('DELETE FROM categorias WHERE id_categoria = $1 RETURNING nombre', [Number(req.params.id)]);
    if (fila) {
      await registrarBitacora(req, 'ELIMINAR', 'Categorías', fila.nombre);
      req.flash('exito', `Categoría "${fila.nombre}" eliminada.`);
    }
  } catch (err) {
    if (err.code !== '23001' && err.code !== '23503') throw err;
    req.flash('error', 'No se puede eliminar: la categoría tiene productos asociados (restricción de llave foránea). Puedes desactivarla.');
  }
  res.redirect('/categorias');
});

module.exports = router;
