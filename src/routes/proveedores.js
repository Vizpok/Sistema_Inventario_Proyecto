const express = require('express');
const { query, uno, mensajeError } = require('../db');
const { requiereAdmin, registrarBitacora } = require('../middleware');

const router = express.Router();
const CAMPOS = ['razon_social', 'rfc', 'contacto', 'telefono', 'correo', 'ciudad', 'direccion'];

function leer(body) {
  const p = {};
  for (const c of CAMPOS) p[c] = String(body[c] || '').trim() || null;
  if (p.rfc) p.rfc = p.rfc.toUpperCase();
  return p;
}

router.get('/', async (req, res) => {
  const q = req.query.q || '';
  const proveedores = await query(
    `SELECT pr.*,
            (SELECT COUNT(*)::int FROM producto_proveedor pp WHERE pp.id_proveedor = pr.id_proveedor) AS productos,
            c.ultima_compra, COALESCE(c.compras_30d, 0) AS compras_30d
     FROM proveedores pr
     LEFT JOIN LATERAL (
         SELECT MAX(m.fecha) AS ultima_compra,
                SUM(m.cantidad * m.costo_unitario) FILTER (WHERE m.fecha >= now() - INTERVAL '30 days') AS compras_30d
         FROM movimientos m JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
         WHERE m.id_proveedor = pr.id_proveedor AND t.naturaleza = 'ENTRADA'
     ) c ON TRUE
     WHERE ($1 = '' OR pr.razon_social ILIKE '%' || $1 || '%' OR pr.rfc ILIKE '%' || $1 || '%' OR pr.ciudad ILIKE '%' || $1 || '%')
     ORDER BY pr.activo DESC, pr.razon_social`, [q],
  );
  res.render('proveedores/index', { titulo: 'Proveedores', proveedores, q });
});

router.get('/nuevo', requiereAdmin, (req, res) => {
  res.render('proveedores/form', { titulo: 'Nuevo proveedor', proveedor: {} });
});

router.post('/', requiereAdmin, async (req, res) => {
  const p = leer(req.body);
  try {
    const fila = await uno(
      `INSERT INTO proveedores (${CAMPOS.join(', ')}) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_proveedor`,
      CAMPOS.map((c) => p[c]),
    );
    await registrarBitacora(req, 'CREAR', 'Proveedores', `${p.razon_social} (${p.rfc})`);
    req.flash('exito', 'Proveedor registrado.');
    res.redirect(`/proveedores/${fila.id_proveedor}`);
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('proveedores/form', { titulo: 'Nuevo proveedor', proveedor: p, error: msg });
  }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return next();
  const proveedor = await uno('SELECT * FROM proveedores WHERE id_proveedor = $1', [id]);
  if (!proveedor) return next();
  const [productos, compras] = await Promise.all([
    query(`SELECT p.id_producto, p.sku, p.nombre, pp.costo, pp.dias_entrega, pp.es_principal,
                  v.existencia_total, v.estado
           FROM producto_proveedor pp
           JOIN productos p ON p.id_producto = pp.id_producto
           LEFT JOIN vw_estado_inventario v ON v.id_producto = p.id_producto
           WHERE pp.id_proveedor = $1 ORDER BY p.nombre`, [id]),
    query(`SELECT m.id_movimiento, m.folio, m.fecha, t.nombre AS tipo, t.naturaleza, p.nombre AS producto,
                  m.cantidad, m.costo_unitario, m.referencia
           FROM movimientos m
           JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
           JOIN productos p ON p.id_producto = m.id_producto
           WHERE m.id_proveedor = $1 ORDER BY m.fecha DESC LIMIT 25`, [id]),
  ]);
  res.render('proveedores/detalle', { titulo: proveedor.razon_social, proveedor, productos, compras });
});

router.get('/:id/editar', requiereAdmin, async (req, res, next) => {
  const proveedor = await uno('SELECT * FROM proveedores WHERE id_proveedor = $1', [Number(req.params.id)]);
  if (!proveedor) return next();
  res.render('proveedores/form', { titulo: 'Editar proveedor', proveedor });
});

router.post('/:id', requiereAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const p = leer(req.body);
  try {
    await query(
      `UPDATE proveedores SET ${CAMPOS.map((c, i) => `${c} = $${i + 1}`).join(', ')} WHERE id_proveedor = $${CAMPOS.length + 1}`,
      [...CAMPOS.map((c) => p[c]), id],
    );
    await registrarBitacora(req, 'EDITAR', 'Proveedores', `${p.razon_social} (${p.rfc})`);
    req.flash('exito', 'Proveedor actualizado.');
    res.redirect(`/proveedores/${id}`);
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('proveedores/form', { titulo: 'Editar proveedor', proveedor: { ...p, id_proveedor: id }, error: msg });
  }
});

router.post('/:id/estado', requiereAdmin, async (req, res) => {
  const fila = await uno('UPDATE proveedores SET activo = NOT activo WHERE id_proveedor = $1 RETURNING razon_social, activo', [Number(req.params.id)]);
  if (fila) {
    await registrarBitacora(req, fila.activo ? 'ACTIVAR' : 'DESACTIVAR', 'Proveedores', fila.razon_social);
    req.flash('exito', `Proveedor ${fila.activo ? 'activado' : 'desactivado'}.`);
  }
  res.redirect(`/proveedores/${req.params.id}`);
});

module.exports = router;
