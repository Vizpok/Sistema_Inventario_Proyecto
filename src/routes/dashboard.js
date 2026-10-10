const express = require('express');
const { query, uno } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  const [kpi, serie, porCategoria, porAlmacen, alertas, recientes, top] = await Promise.all([
    // Función de cálculo + vista con CTE
    uno(`SELECT fn_valor_inventario()                                        AS valor_total,
                COUNT(*)                                                     AS productos,
                COALESCE(SUM(existencia_total), 0)                           AS unidades,
                COUNT(*) FILTER (WHERE estado IN ('BAJO', 'SIN STOCK'))      AS alertas,
                COUNT(*) FILTER (WHERE estado = 'SIN STOCK')                 AS agotados
         FROM vw_estado_inventario`),
    // Vista con CTE: serie de 30 días
    query(`SELECT dia::text AS dia, movimientos, unidades_entrada, unidades_salida,
                  importe_entrada, importe_salida
           FROM vw_movimientos_diarios`),
    query(`SELECT categoria, color_categoria AS color, SUM(valor_inventario) AS valor
           FROM vw_estado_inventario GROUP BY categoria, color_categoria ORDER BY valor DESC`),
    // Función de cálculo por almacén
    query(`SELECT a.id_almacen, a.nombre, fn_valor_inventario(NULL, a.id_almacen) AS valor,
                  COALESCE(SUM(i.existencia), 0) AS unidades
           FROM almacenes a LEFT JOIN inventario i ON i.id_almacen = a.id_almacen
           WHERE a.activo GROUP BY a.id_almacen, a.nombre ORDER BY valor DESC`),
    query(`SELECT id_producto, sku, nombre, existencia_total, stock_minimo, estado, dias_cobertura
           FROM vw_estado_inventario WHERE estado IN ('SIN STOCK', 'BAJO')
           ORDER BY existencia_total, nombre LIMIT 8`),
    query(`SELECT m.id_movimiento, m.folio, m.fecha, m.cantidad, t.nombre AS tipo, t.naturaleza,
                  p.nombre AS producto, a.nombre AS almacen, u.nombre || ' ' || u.apellidos AS usuario
           FROM movimientos m
           JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
           JOIN productos p ON p.id_producto = m.id_producto
           JOIN almacenes a ON a.id_almacen = m.id_almacen
           JOIN usuarios u ON u.id_usuario = m.id_usuario
           ORDER BY m.fecha DESC LIMIT 8`),
    query(`SELECT id_producto, nombre, categoria, salidas_30d, existencia_total
           FROM vw_estado_inventario WHERE salidas_30d > 0
           ORDER BY salidas_30d DESC LIMIT 5`),
  ]);

  const hoy = serie[serie.length - 1] || {};
  const ultimos7 = serie.slice(-7);
  res.render('dashboard', {
    titulo: 'Dashboard',
    kpi,
    hoy,
    semana: {
      entradas: ultimos7.reduce((s, d) => s + Number(d.unidades_entrada), 0),
      salidas: ultimos7.reduce((s, d) => s + Number(d.unidades_salida), 0),
    },
    serie,
    porCategoria,
    porAlmacen,
    alertas,
    recientes,
    top,
  });
});

module.exports = router;
