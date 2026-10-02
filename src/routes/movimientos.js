const express = require('express');
const { query, uno, mensajeError } = require('../db');
const { registrarBitacora } = require('../middleware');

const router = express.Router();
const POR_PAGINA = 25;

/** Filtros compartidos por el listado y la sección "Mis movimientos" */
function construirFiltros(f) {
  const cond = [];
  const params = [];
  const add = (sqlCond, valor) => { params.push(valor); cond.push(sqlCond.replace('?', `$${params.length}`)); };
  if (f.q) {
    params.push(`%${f.q}%`);
    const n = params.length;
    cond.push(`(p.nombre ILIKE $${n} OR p.sku ILIKE $${n} OR m.folio ILIKE $${n} OR m.referencia ILIKE $${n})`);
  }
  if (f.tipo) add('m.id_tipo = ?', Number(f.tipo));
  if (f.naturaleza === 'ENTRADA' || f.naturaleza === 'SALIDA') add('t.naturaleza = ?', f.naturaleza);
  if (f.almacen) add('m.id_almacen = ?', Number(f.almacen));
  if (f.usuario) add('m.id_usuario = ?', Number(f.usuario));
  if (f.desde) add(`m.fecha >= (?::date)::timestamp AT TIME ZONE 'America/Mexico_City'`, f.desde);
  if (f.hasta) add(`m.fecha < ((?::date + 1)::timestamp AT TIME ZONE 'America/Mexico_City')`, f.hasta);
  return { where: cond.length ? `WHERE ${cond.join(' AND ')}` : '', params };
}

const FROM_MOV = `
  FROM movimientos m
  JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
  JOIN productos p ON p.id_producto = m.id_producto
  JOIN almacenes a ON a.id_almacen = m.id_almacen
  JOIN usuarios u ON u.id_usuario = m.id_usuario
  LEFT JOIN proveedores pr ON pr.id_proveedor = m.id_proveedor`;

async function listar(filtros, pagina) {
  const { where, params } = construirFiltros(filtros);
  const [filas, totales] = await Promise.all([
    query(
      `SELECT m.id_movimiento, m.folio, m.fecha, m.cantidad, m.costo_unitario, m.existencia_resultante, m.referencia,
              t.nombre AS tipo, t.naturaleza, p.id_producto, p.sku, p.nombre AS producto, a.nombre AS almacen,
              u.nombre || ' ' || u.apellidos AS usuario, pr.razon_social AS proveedor
       ${FROM_MOV} ${where}
       ORDER BY m.fecha DESC, m.id_movimiento DESC
       LIMIT ${POR_PAGINA} OFFSET ${(pagina - 1) * POR_PAGINA}`, params,
    ),
    uno(
      `SELECT COUNT(*)::int AS registros,
              COALESCE(SUM(m.cantidad) FILTER (WHERE t.naturaleza = 'ENTRADA'), 0) AS unidades_entrada,
              COALESCE(SUM(m.cantidad) FILTER (WHERE t.naturaleza = 'SALIDA'), 0)  AS unidades_salida,
              COALESCE(SUM(m.cantidad * m.costo_unitario) FILTER (WHERE t.naturaleza = 'ENTRADA'), 0) AS importe_entrada,
              COALESCE(SUM(m.cantidad * m.costo_unitario) FILTER (WHERE t.naturaleza = 'SALIDA'), 0)  AS importe_salida
       ${FROM_MOV} ${where}`, params,
    ),
  ]);
  return { filas, totales, paginas: Math.max(1, Math.ceil(totales.registros / POR_PAGINA)) };
}

const catalogosFiltro = () => Promise.all([
  query('SELECT id_tipo, nombre, naturaleza, requiere_proveedor FROM tipos_movimiento ORDER BY naturaleza, nombre'),
  query('SELECT id_almacen, nombre FROM almacenes WHERE activo ORDER BY id_almacen'),
]);

router.get('/', async (req, res) => {
  const filtros = {};
  for (const k of ['q', 'tipo', 'naturaleza', 'almacen', 'desde', 'hasta']) filtros[k] = req.query[k] || '';
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const [{ filas, totales, paginas }, [tipos, almacenes]] = await Promise.all([listar(filtros, pagina), catalogosFiltro()]);
  res.render('movimientos/index', {
    titulo: 'Movimientos', filas, totales, paginas, pagina, filtros, tipos, almacenes,
  });
});

// Datos para el formulario: existencia actual del producto en el almacén elegido
router.get('/existencia', async (req, res) => {
  const fila = await uno(
    `SELECT p.precio_compra, p.unidad, COALESCE(i.existencia, 0) AS existencia,
            (SELECT pp.id_proveedor FROM producto_proveedor pp WHERE pp.id_producto = p.id_producto AND pp.es_principal) AS proveedor_principal
     FROM productos p
     LEFT JOIN inventario i ON i.id_producto = p.id_producto AND i.id_almacen = $2
     WHERE p.id_producto = $1`, [Number(req.query.producto) || 0, Number(req.query.almacen) || 0],
  );
  res.json(fila || {});
});

async function datosFormulario() {
  const [tipos, almacenes] = await catalogosFiltro();
  const [productos, proveedores] = await Promise.all([
    query(`SELECT p.id_producto, p.sku, p.nombre, p.unidad, p.precio_compra, c.nombre AS categoria
           FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria
           WHERE p.activo ORDER BY p.nombre`),
    query('SELECT id_proveedor, razon_social FROM proveedores WHERE activo ORDER BY razon_social'),
  ]);
  return { tipos, almacenes, productos, proveedores };
}

router.get('/nuevo', async (req, res) => {
  const mov = {
    id_producto: req.query.producto || '', id_almacen: req.query.almacen || '', id_tipo: req.query.tipo || '', cantidad: 1,
  };
  res.render('movimientos/nuevo', { titulo: 'Registrar movimiento', mov, ...(await datosFormulario()) });
});

router.post('/', async (req, res) => {
  const b = req.body;
  const mov = {
    id_producto: Number(b.id_producto) || null,
    id_almacen: Number(b.id_almacen) || null,
    id_tipo: Number(b.id_tipo) || null,
    cantidad: parseInt(b.cantidad, 10),
    costo_unitario: b.costo_unitario === '' || b.costo_unitario === undefined ? null : Number(b.costo_unitario),
    id_proveedor: Number(b.id_proveedor) || null,
    referencia: String(b.referencia || '').trim() || null,
    observaciones: String(b.observaciones || '').trim() || null,
  };
  try {
    if (!mov.id_producto || !mov.id_almacen || !mov.id_tipo) {
      throw Object.assign(new Error('Selecciona tipo, producto y almacén.'), { code: 'P0001' });
    }
    // Función de inserción: valida existencias, inserta el movimiento y actualiza el inventario
    const { id } = await uno(
      'SELECT fn_registrar_movimiento($1, $2, $3, $4, $5, $6, $7, $8, $9) AS id',
      [mov.id_producto, mov.id_almacen, mov.id_tipo, mov.cantidad, req.session.usuario.id,
        mov.costo_unitario, mov.id_proveedor, mov.referencia, mov.observaciones],
    );
    const creado = await uno(
      `SELECT m.folio, t.nombre AS tipo, p.sku FROM movimientos m
       JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo JOIN productos p ON p.id_producto = m.id_producto
       WHERE m.id_movimiento = $1`, [id],
    );
    await registrarBitacora(req, 'REGISTRAR', 'Movimientos', `${creado.folio} · ${creado.tipo} · ${creado.sku} × ${mov.cantidad}`);
    req.flash('exito', `Movimiento ${creado.folio} registrado correctamente.`);
    res.redirect(`/movimientos/${id}`);
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('movimientos/nuevo', {
      titulo: 'Registrar movimiento', mov, error: msg, ...(await datosFormulario()),
    });
  }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return next();
  const mov = await uno(
    `SELECT m.*, t.nombre AS tipo, t.naturaleza, p.sku, p.nombre AS producto, p.unidad,
            a.nombre AS almacen, a.ubicacion AS direccion_almacen,
            u.nombre || ' ' || u.apellidos AS usuario, u.puesto,
            pr.razon_social AS proveedor, pr.rfc
     ${FROM_MOV} WHERE m.id_movimiento = $1`, [id],
  );
  if (!mov) return next();
  res.render('movimientos/detalle', { titulo: mov.folio, mov });
});

// Se exporta listar() para reutilizarlo en la sección "Mi cuenta"
module.exports = Object.assign(router, { listar });
