-- =====================================================================
-- Paso 09 · Evidencia 5: Vistas con CTEs
-- Ejecutar con: DBeaver con la conexión "Neon · usr_carlos" (rol "user")
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev5-09-usr_carlos.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 5.2 vw_estado_inventario · productos que requieren atención
SELECT sku, nombre, categoria, existencia_total AS existencia, stock_minimo AS minimo,
       valor_inventario AS valor, salidas_30d, dias_cobertura AS cobertura_dias, estado
FROM vw_estado_inventario
WHERE estado <> 'NORMAL'
ORDER BY CASE estado WHEN 'SIN STOCK' THEN 0 WHEN 'BAJO' THEN 1 ELSE 2 END, nombre;

-- 5.3 vw_movimientos_diarios · últimos 10 días
SELECT dia, movimientos, unidades_entrada, unidades_salida, importe_entrada, importe_salida
FROM vw_movimientos_diarios
ORDER BY dia DESC
LIMIT 10;
