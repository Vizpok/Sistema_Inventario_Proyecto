const express = require('express');
const { query } = require('../db');

const router = express.Router();
const ESTADOS = ['SIN STOCK', 'BAJO', 'NORMAL', 'EXCESO'];

/** Construye el WHERE de los filtros sobre vw_estado_inventario */
function filtrosConsolidado(q) {
  const cond = [];
  const params = [];
  if (q.q) { params.push(`%${q.q}%`); cond.push(`(v.nombre ILIKE $${params.length} OR v.sku ILIKE $${params.length})`); }
  if (q.categoria) { params.push(Number(q.categoria)); cond.push(`v.id_categoria = $${params.length}`); }
  if (ESTADOS.includes(q.estado)) { params.push(q.estado); cond.push(`v.estado = $${params.length}`); }
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

async function datosInventario(q) {
  if (q.almacen) {
    // Existencias de un almacén específico (tabla inventario N:M)
    const { where, params } = filtrosConsolidado(q);
    params.push(Number(q.almacen));
    const filtroAlm = `i.id_almacen = $${params.length}`;
    return query(
      `SELECT v.id_producto, v.sku, v.nombre, v.categoria, v.color_categoria, v.unidad, v.precio_compra,
              v.stock_minimo, v.stock_maximo, v.estado AS estado_global,
              i.existencia, i.ubicacion, i.actualizado_en,
              ROUND(i.existencia * v.precio_compra, 2) AS valor
       FROM vw_estado_inventario v
       JOIN inventario i ON i.id_producto = v.id_producto
       ${where ? `${where} AND ${filtroAlm}` : `WHERE ${filtroAlm}`}
       ORDER BY v.categoria, v.nombre`, params,
    );
  }
  const { where, params } = filtrosConsolidado(q);
  return query(
    `SELECT v.* FROM vw_estado_inventario v ${where}
     ORDER BY CASE v.estado WHEN 'SIN STOCK' THEN 0 WHEN 'BAJO' THEN 1 WHEN 'EXCESO' THEN 2 ELSE 3 END, v.nombre`,
    params,
  );
}

router.get('/', async (req, res) => {
  const filtros = {
    q: req.query.q || '', categoria: req.query.categoria || '', estado: req.query.estado || '', almacen: req.query.almacen || '',
  };
  const [filas, categorias, almacenes, resumen] = await Promise.all([
    datosInventario(filtros),
    query('SELECT id_categoria, nombre FROM categorias WHERE activo ORDER BY nombre'),
    query('SELECT id_almacen, nombre FROM almacenes WHERE activo ORDER BY id_almacen'),
    query('SELECT estado, COUNT(*)::int AS total FROM vw_estado_inventario GROUP BY estado'),
  ]);
  const conteo = Object.fromEntries(resumen.map((r) => [r.estado, r.total]));
  const totalValor = filas.reduce((s, f) => s + Number(f.valor ?? f.valor_inventario), 0);
  const totalUnidades = filas.reduce((s, f) => s + Number(f.existencia ?? f.existencia_total), 0);
  res.render('inventario/index', {
    titulo: 'Inventario', filas, categorias, almacenes, filtros, conteo, ESTADOS, totalValor, totalUnidades,
    almacenSel: almacenes.find((a) => String(a.id_almacen) === filtros.almacen),
  });
});

router.get('/exportar.csv', async (req, res) => {
  const filas = await datosInventario(req.query);
  const cols = req.query.almacen
    ? ['sku', 'nombre', 'categoria', 'unidad', 'ubicacion', 'existencia', 'stock_minimo', 'precio_compra', 'valor', 'estado_global']
    : ['sku', 'nombre', 'categoria', 'unidad', 'existencia_total', 'stock_minimo', 'stock_maximo', 'precio_compra', 'valor_inventario', 'salidas_30d', 'dias_cobertura', 'estado'];
  const esc = (v) => (v === null || v === undefined ? '' : `"${String(v).replace(/"/g, '""')}"`);
  const csv = [cols.join(','), ...filas.map((f) => cols.map((c) => esc(f[c])).join(','))].join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="inventario-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(`﻿${csv}`);
});

module.exports = router;
