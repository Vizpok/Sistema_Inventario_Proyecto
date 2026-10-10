const express = require('express');
const { query, uno, transaccion, mensajeError } = require('../db');
const { requiereAdmin, registrarBitacora } = require('../middleware');

const router = express.Router();

router.get('/', async (req, res) => {
  const filtros = { q: req.query.q || '', categoria: req.query.categoria || '', inactivos: req.query.inactivos || '' };
  const cond = [];
  const params = [];
  if (filtros.q) { params.push(`%${filtros.q}%`); cond.push(`(p.nombre ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR p.descripcion ILIKE $${params.length})`); }
  if (filtros.categoria) { params.push(Number(filtros.categoria)); cond.push(`p.id_categoria = $${params.length}`); }
  if (!(res.locals.esAdmin && filtros.inactivos)) cond.push('p.activo');

  const [productos, categorias] = await Promise.all([
    query(
      `SELECT p.id_producto, p.sku, p.nombre, p.descripcion, p.unidad, p.precio_venta, p.precio_compra, p.activo,
              c.nombre AS categoria, c.color,
              COALESCE(v.existencia_total, 0) AS existencia_total, COALESCE(v.estado, 'INACTIVO') AS estado,
              (SELECT pr.razon_social FROM producto_proveedor pp JOIN proveedores pr ON pr.id_proveedor = pp.id_proveedor
               WHERE pp.id_producto = p.id_producto AND pp.es_principal) AS proveedor_principal
       FROM productos p
       JOIN categorias c ON c.id_categoria = p.id_categoria
       LEFT JOIN vw_estado_inventario v ON v.id_producto = p.id_producto
       ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
       ORDER BY c.nombre, p.nombre`, params,
    ),
    query(`SELECT c.id_categoria, c.nombre, c.color, COUNT(p.id_producto)::int AS total
           FROM categorias c LEFT JOIN productos p ON p.id_categoria = c.id_categoria AND p.activo
           WHERE c.activo GROUP BY c.id_categoria ORDER BY c.nombre`),
  ]);
  res.render('catalogo/index', { titulo: 'Catálogo', productos, categorias, filtros });
});

async function datosFormulario(idProducto = null) {
  const [categorias, proveedores] = await Promise.all([
    query('SELECT id_categoria, nombre FROM categorias WHERE activo ORDER BY nombre'),
    query(
      `SELECT pr.id_proveedor, pr.razon_social, pr.ciudad,
              pp.costo, pp.dias_entrega, COALESCE(pp.es_principal, FALSE) AS es_principal,
              (pp.id_proveedor IS NOT NULL) AS seleccionado
       FROM proveedores pr
       LEFT JOIN producto_proveedor pp ON pp.id_proveedor = pr.id_proveedor AND pp.id_producto = $1
       WHERE pr.activo OR pp.id_proveedor IS NOT NULL
       ORDER BY pr.razon_social`, [idProducto],
    ),
  ]);
  return { categorias, proveedores };
}

/** Lee y valida el formulario de producto */
function leerFormulario(body) {
  const p = {
    sku: String(body.sku || '').trim().toUpperCase(),
    nombre: String(body.nombre || '').trim(),
    descripcion: String(body.descripcion || '').trim() || null,
    id_categoria: Number(body.id_categoria) || null,
    unidad: String(body.unidad || 'pieza').trim(),
    precio_compra: Number(body.precio_compra),
    precio_venta: Number(body.precio_venta),
    stock_minimo: parseInt(body.stock_minimo, 10) || 0,
    stock_maximo: parseInt(body.stock_maximo, 10) || 0,
  };
  // Proveedores seleccionados (relación N:M). Las llaves llegan como "p<id>":
  // con llaves numéricas el parser de formularios las convertiría en un arreglo.
  const provs = Object.entries(body.prov || {})
    .filter(([, v]) => v && v.sel)
    .map(([llave, v]) => ({
      id: Number(String(llave).replace(/^p/, '')),
      costo: Number(v.costo) || p.precio_compra || 0,
      dias: parseInt(v.dias, 10) || 0,
      principal: String(body.principal) === String(llave).replace(/^p/, ''),
    }))
    .filter((x) => Number.isInteger(x.id) && x.id > 0);
  if (provs.length && !provs.some((x) => x.principal)) provs[0].principal = true;

  const errores = [];
  if (!p.sku) errores.push('El SKU es obligatorio.');
  if (!p.nombre) errores.push('El nombre es obligatorio.');
  if (!p.id_categoria) errores.push('Selecciona una categoría.');
  if (!(p.precio_compra >= 0) || !(p.precio_venta >= 0)) errores.push('Los precios deben ser números positivos.');
  if (p.precio_venta < p.precio_compra) errores.push('El precio de venta no debería ser menor al de compra.');
  if (p.stock_maximo && p.stock_maximo < p.stock_minimo) errores.push('El stock máximo debe ser mayor o igual al mínimo.');
  return { p, provs, errores };
}

const arreglosProv = (provs) => [
  provs.map((x) => x.id), provs.map((x) => x.costo), provs.map((x) => x.dias), provs.map((x) => x.principal),
];

router.get('/nuevo', requiereAdmin, async (req, res) => {
  res.render('catalogo/form', { titulo: 'Nuevo producto', producto: { unidad: 'pieza' }, ...(await datosFormulario()) });
});

router.post('/', requiereAdmin, async (req, res) => {
  const { p, provs, errores } = leerFormulario(req.body);
  const volver = async (msgs) => res.status(400).render('catalogo/form', {
    titulo: 'Nuevo producto', producto: p, errores: msgs, ...(await datosFormulario()),
  });
  if (errores.length) return volver(errores);
  try {
    // Transacción: inserta el producto y sus proveedores (N:M). currval() devuelve
    // el id recién generado por la columna IDENTITY dentro de la misma sesión.
    const idNuevo = "currval(pg_get_serial_sequence('productos', 'id_producto'))";
    const resultados = await transaccion([
      [`INSERT INTO productos (sku, nombre, descripcion, id_categoria, unidad, precio_compra, precio_venta, stock_minimo, stock_maximo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [p.sku, p.nombre, p.descripcion, p.id_categoria, p.unidad, p.precio_compra, p.precio_venta, p.stock_minimo, p.stock_maximo]],
      [`INSERT INTO producto_proveedor (id_producto, id_proveedor, costo, dias_entrega, es_principal)
        SELECT ${idNuevo}, u.id, u.costo, u.dias, u.principal
        FROM unnest($1::int[], $2::numeric[], $3::int[], $4::boolean[]) AS u(id, costo, dias, principal)`,
      arreglosProv(provs)],
      [`SELECT ${idNuevo} AS id_producto`],
    ]);
    const fila = resultados[2][0];
    await registrarBitacora(req, 'CREAR', 'Catálogo', `Producto ${p.sku} — ${p.nombre}`);
    req.flash('exito', `Producto ${p.sku} creado. Registra una entrada para darle existencia.`);
    res.redirect(`/catalogo/${fila.id_producto}`);
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    return volver([msg]);
  }
});

router.get('/:id', async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return next();
  const producto = await uno(
    `SELECT p.*, c.nombre AS categoria, c.color, v.existencia_total, v.valor_inventario, v.estado,
            v.salidas_30d, v.dias_cobertura, v.ultimo_movimiento
     FROM productos p JOIN categorias c ON c.id_categoria = p.id_categoria
     LEFT JOIN vw_estado_inventario v ON v.id_producto = p.id_producto
     WHERE p.id_producto = $1`, [id],
  );
  if (!producto) return next();
  const [existencias, proveedores, kardex] = await Promise.all([
    query(`SELECT a.nombre AS almacen, i.existencia, i.ubicacion, i.actualizado_en
           FROM inventario i JOIN almacenes a ON a.id_almacen = i.id_almacen
           WHERE i.id_producto = $1 ORDER BY a.id_almacen`, [id]),
    query(`SELECT pr.id_proveedor, pr.razon_social, pr.telefono, pp.costo, pp.dias_entrega, pp.es_principal
           FROM producto_proveedor pp JOIN proveedores pr ON pr.id_proveedor = pp.id_proveedor
           WHERE pp.id_producto = $1 ORDER BY pp.es_principal DESC, pp.costo`, [id]),
    query(`SELECT m.id_movimiento, m.folio, m.fecha, t.nombre AS tipo, t.naturaleza, a.nombre AS almacen,
                  m.cantidad, m.costo_unitario, m.existencia_resultante, m.referencia,
                  u.nombre || ' ' || u.apellidos AS usuario
           FROM movimientos m
           JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
           JOIN almacenes a ON a.id_almacen = m.id_almacen
           JOIN usuarios u ON u.id_usuario = m.id_usuario
           WHERE m.id_producto = $1 ORDER BY m.fecha DESC LIMIT 40`, [id]),
  ]);
  res.render('catalogo/detalle', { titulo: producto.nombre, producto, existencias, proveedores, kardex });
});

router.get('/:id/editar', requiereAdmin, async (req, res, next) => {
  const producto = await uno('SELECT * FROM productos WHERE id_producto = $1', [Number(req.params.id)]);
  if (!producto) return next();
  res.render('catalogo/form', { titulo: `Editar ${producto.sku}`, producto, ...(await datosFormulario(producto.id_producto)) });
});

router.post('/:id', requiereAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { p, provs, errores } = leerFormulario(req.body);
  const volver = async (msgs) => res.status(400).render('catalogo/form', {
    titulo: `Editar ${p.sku}`, producto: { ...p, id_producto: id }, errores: msgs, ...(await datosFormulario(id)),
  });
  if (errores.length) return volver(errores);
  try {
    await transaccion([
      [`UPDATE productos SET sku = $1, nombre = $2, descripcion = $3, id_categoria = $4, unidad = $5,
               precio_compra = $6, precio_venta = $7, stock_minimo = $8, stock_maximo = $9, actualizado_en = now()
        WHERE id_producto = $10`,
      [p.sku, p.nombre, p.descripcion, p.id_categoria, p.unidad, p.precio_compra, p.precio_venta, p.stock_minimo, p.stock_maximo, id]],
      ['DELETE FROM producto_proveedor WHERE id_producto = $1', [id]],
      [`INSERT INTO producto_proveedor (id_producto, id_proveedor, costo, dias_entrega, es_principal)
        SELECT $1, u.id, u.costo, u.dias, u.principal
        FROM unnest($2::int[], $3::numeric[], $4::int[], $5::boolean[]) AS u(id, costo, dias, principal)`,
      [id, ...arreglosProv(provs)]],
    ]);
    await registrarBitacora(req, 'EDITAR', 'Catálogo', `Producto ${p.sku} — ${p.nombre}`);
    req.flash('exito', 'Producto actualizado.');
    res.redirect(`/catalogo/${id}`);
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    return volver([msg]);
  }
});

router.post('/:id/estado', requiereAdmin, async (req, res) => {
  const fila = await uno(
    'UPDATE productos SET activo = NOT activo, actualizado_en = now() WHERE id_producto = $1 RETURNING sku, activo',
    [Number(req.params.id)],
  );
  if (fila) {
    await registrarBitacora(req, fila.activo ? 'ACTIVAR' : 'DESACTIVAR', 'Catálogo', `Producto ${fila.sku}`);
    req.flash('exito', `Producto ${fila.sku} ${fila.activo ? 'reactivado' : 'desactivado'}.`);
  }
  res.redirect(`/catalogo/${req.params.id}`);
});

module.exports = router;
