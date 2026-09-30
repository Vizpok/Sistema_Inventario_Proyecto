-- =====================================================================
-- Paso 11 · Evidencia 6: Funciones
-- Ejecutar con: DBeaver con la conexión "Neon · usr_carlos" (rol "user")
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev6-11-usr_carlos.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 6.2 fn_valor_inventario · cálculo total, por almacén y por categoría
SELECT 'Toda la empresa' AS alcance, fn_valor_inventario() AS valor
UNION ALL
SELECT 'Almacén: ' || nombre, fn_valor_inventario(NULL, id_almacen) FROM almacenes
UNION ALL
SELECT 'Categoría: ' || nombre, fn_valor_inventario(id_categoria) FROM categorias
ORDER BY valor DESC;

-- 6.3 fn_registrar_movimiento · compra a proveedor (entrada)
SELECT existencia AS existencia_antes FROM inventario
WHERE id_producto = (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001')
  AND id_almacen  = (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey');

SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         20,
         (SELECT id_usuario FROM usuarios WHERE correo = 'sofia.villarreal@nexo.mx'),
         1150.00,
         (SELECT id_proveedor FROM proveedores WHERE rfc = 'MDM180725K91'),
         'OC-EVIDENCIA-01',
         'Evidencia 6: entrada registrada con la función') AS id_movimiento;

SELECT folio, cantidad, costo_unitario, existencia_resultante, referencia
FROM movimientos ORDER BY id_movimiento DESC LIMIT 1;

-- 6.4 fn_registrar_movimiento · venta (salida)
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Venta'),
         3,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'),
         p_referencia => 'FAC-EVIDENCIA-01') AS id_movimiento;

SELECT folio, cantidad, existencia_resultante, referencia
FROM movimientos ORDER BY id_movimiento DESC LIMIT 1;

-- 6.5 fn_registrar_movimiento · validaciones (deben fallar)
-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'MOB-ARC-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Venta'),
         5,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'));

-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         5,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'));

-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
SELECT fn_registrar_movimiento(1, 1, 5, 0, 1);
