-- =====================================================================
-- Script 03 · Vistas construidas con CTEs (Common Table Expressions)
-- Ejecutar como: propietario de la BD (nexo_inventario_owner)
-- Los permisos llegan solos gracias a ALTER DEFAULT PRIVILEGES (script 02).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vista 1 · vw_estado_inventario
-- Estado consolidado de cada producto activo: existencia total en todos
-- los almacenes, valor del inventario, rotación de los últimos 30 días,
-- días de cobertura y semáforo (SIN STOCK / BAJO / NORMAL / EXCESO).
-- La usan: Dashboard, Inventario y Catálogo.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_estado_inventario AS
WITH existencias AS (          -- CTE 1: existencia total por producto
    SELECT i.id_producto,
           SUM(i.existencia)::INTEGER                     AS existencia_total,
           COUNT(*) FILTER (WHERE i.existencia > 0)::INTEGER AS almacenes_con_stock
    FROM inventario i
    GROUP BY i.id_producto
),
actividad AS (                 -- CTE 2: rotación reciente por producto
    SELECT m.id_producto,
           MAX(m.fecha) AS ultimo_movimiento,
           COALESCE(SUM(m.cantidad) FILTER (
               WHERE t.naturaleza = 'SALIDA'
                 AND m.fecha >= now() - INTERVAL '30 days'), 0)::INTEGER AS salidas_30d
    FROM movimientos m
    JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
    GROUP BY m.id_producto
),
consolidado AS (               -- CTE 3: une catálogo + existencias + actividad
    SELECT p.id_producto, p.sku, p.nombre, p.unidad,
           c.id_categoria, c.nombre AS categoria, c.color AS color_categoria,
           p.precio_compra, p.precio_venta, p.stock_minimo, p.stock_maximo,
           COALESCE(e.existencia_total, 0)    AS existencia_total,
           COALESCE(e.almacenes_con_stock, 0) AS almacenes_con_stock,
           COALESCE(a.salidas_30d, 0)         AS salidas_30d,
           a.ultimo_movimiento
    FROM productos p
    JOIN categorias c       ON c.id_categoria = p.id_categoria
    LEFT JOIN existencias e ON e.id_producto  = p.id_producto
    LEFT JOIN actividad a   ON a.id_producto  = p.id_producto
    WHERE p.activo
)
SELECT id_producto, sku, nombre, unidad,
       id_categoria, categoria, color_categoria,
       precio_compra, precio_venta, stock_minimo, stock_maximo,
       existencia_total, almacenes_con_stock,
       ROUND(existencia_total * precio_compra, 2) AS valor_inventario,
       salidas_30d,
       CASE WHEN salidas_30d > 0
            THEN ROUND(existencia_total / (salidas_30d / 30.0), 1)
       END AS dias_cobertura,
       ultimo_movimiento,
       CASE
           WHEN existencia_total = 0                                THEN 'SIN STOCK'
           WHEN existencia_total <= stock_minimo                    THEN 'BAJO'
           WHEN stock_maximo > 0 AND existencia_total > stock_maximo THEN 'EXCESO'
           ELSE 'NORMAL'
       END AS estado
FROM consolidado;

COMMENT ON VIEW vw_estado_inventario IS
    'Existencia total, valor, rotación 30 días, cobertura y semáforo por producto (CTEs)';

-- ---------------------------------------------------------------------
-- Vista 2 · vw_movimientos_diarios
-- Serie diaria de los últimos 30 días (hora de Ciudad de México) con
-- entradas, salidas, importes y número de movimientos. Los días sin
-- actividad aparecen en cero gracias al calendario generado en la CTE.
-- La usa: gráfica del Dashboard.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_movimientos_diarios AS
WITH calendario AS (           -- CTE 1: los últimos 30 días, aunque no haya movimientos
    SELECT generate_series(
               (now() AT TIME ZONE 'America/Mexico_City')::DATE - 29,
               (now() AT TIME ZONE 'America/Mexico_City')::DATE,
               INTERVAL '1 day')::DATE AS dia
),
detalle AS (                   -- CTE 2: movimientos del periodo con su naturaleza
    SELECT (m.fecha AT TIME ZONE 'America/Mexico_City')::DATE AS dia,
           t.naturaleza,
           m.cantidad,
           m.cantidad * m.costo_unitario AS importe
    FROM movimientos m
    JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
    WHERE m.fecha >= now() - INTERVAL '31 days'
),
agregado AS (                  -- CTE 3: totales por día y naturaleza
    SELECT dia,
           COUNT(*)                                                AS movimientos,
           SUM(cantidad) FILTER (WHERE naturaleza = 'ENTRADA')     AS unidades_entrada,
           SUM(cantidad) FILTER (WHERE naturaleza = 'SALIDA')      AS unidades_salida,
           SUM(importe)  FILTER (WHERE naturaleza = 'ENTRADA')     AS importe_entrada,
           SUM(importe)  FILTER (WHERE naturaleza = 'SALIDA')      AS importe_salida
    FROM detalle
    GROUP BY dia
)
SELECT c.dia,
       COALESCE(a.movimientos, 0)::INTEGER      AS movimientos,
       COALESCE(a.unidades_entrada, 0)::INTEGER AS unidades_entrada,
       COALESCE(a.unidades_salida, 0)::INTEGER  AS unidades_salida,
       COALESCE(a.importe_entrada, 0)::NUMERIC(14,2) AS importe_entrada,
       COALESCE(a.importe_salida, 0)::NUMERIC(14,2)  AS importe_salida
FROM calendario c
LEFT JOIN agregado a ON a.dia = c.dia
ORDER BY c.dia;

COMMENT ON VIEW vw_movimientos_diarios IS
    'Entradas y salidas por día de los últimos 30 días, con días vacíos en cero (CTEs)';
