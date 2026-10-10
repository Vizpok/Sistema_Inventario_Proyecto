-- =====================================================================
-- Paso 12 · Evidencia 7: Uso de vistas y funciones
-- Ejecutar con: DBeaver con la conexión "Neon · app_nexo" (rol "user", cuenta de la aplicación)
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev7-12-app_nexo.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 7.1 Indicadores del dashboard (vista + función), como los consulta la aplicación
SELECT fn_valor_inventario()                                   AS valor_total,
       COUNT(*)                                                AS productos_activos,
       SUM(existencia_total)                                   AS unidades,
       COUNT(*) FILTER (WHERE estado IN ('BAJO', 'SIN STOCK')) AS alertas
FROM vw_estado_inventario;

-- 7.2 Valor por categoría: la vista contra la función (deben coincidir)
SELECT v.categoria,
       SUM(v.valor_inventario)                AS valor_desde_vista,
       fn_valor_inventario(v.id_categoria)    AS valor_desde_funcion,
       SUM(v.valor_inventario) = fn_valor_inventario(v.id_categoria) AS coinciden
FROM vw_estado_inventario v
GROUP BY v.categoria, v.id_categoria
ORDER BY valor_desde_vista DESC;

-- 7.3 Reabastecimiento automático: registrar compras para todo lo agotado
SELECT v.sku, v.nombre, v.existencia_total AS antes,
       fn_registrar_movimiento(
           v.id_producto,
           (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
           (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
           GREATEST(v.stock_minimo * 2, 1),
           (SELECT id_usuario FROM usuarios WHERE correo = 'sofia.villarreal@nexo.mx'),
           NULL,
           (SELECT pp.id_proveedor FROM producto_proveedor pp WHERE pp.id_producto = v.id_producto AND pp.es_principal),
           'OC-REABASTO-AUTO') AS id_movimiento
FROM vw_estado_inventario v
WHERE v.estado = 'SIN STOCK';

-- 7.4 Estado después del reabastecimiento
SELECT estado, COUNT(*) AS productos, SUM(valor_inventario) AS valor
FROM vw_estado_inventario
GROUP BY estado
ORDER BY productos DESC;

-- 7.5 Kardex del producto reabastecido (tabla movimientos + vista)
SELECT m.folio, t.nombre AS tipo, m.cantidad, m.existencia_resultante,
       to_char(m.fecha AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha,
       v.estado AS estado_actual
FROM movimientos m
JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
JOIN vw_estado_inventario v ON v.id_producto = m.id_producto
WHERE v.sku = 'COM-LAP-003'
ORDER BY m.id_movimiento DESC
LIMIT 6;
