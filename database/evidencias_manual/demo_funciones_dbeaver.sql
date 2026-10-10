-- =====================================================================
-- DEMOSTRACIÓN EN DBEAVER · Evidencia 6: Funciones
--   fn_valor_inventario      → función de CÁLCULO
--   fn_registrar_movimiento  → función de INSERCIÓN
--
-- Conexión sugerida: "Neon · usr_carlos" (rol "user"). Así se demuestra que un
-- usuario sin permisos para crear objetos SÍ puede usar las funciones.
--
-- Cómo ejecutarlo:
--   · Paso a paso: pon el cursor en cada consulta y pulsa Ctrl+Enter.
--   · Todo junto:  Alt+X (cada resultado sale en su propia pestaña).
-- Las consultas del PASO 5 DEBEN FALLAR: si DBeaver muestra el diálogo de
-- error, elige "Ignorar" y toma la captura del mensaje.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASO 1 · ¿Qué funciones existen en la base de datos?
-- ---------------------------------------------------------------------
SELECT p.proname                                   AS funcion,
       CASE p.proname
            WHEN 'fn_valor_inventario'     THEN 'Cálculo'
            WHEN 'fn_registrar_movimiento' THEN 'Inserción'
       END                                         AS tipo,
       pg_get_function_arguments(p.oid)            AS parametros,
       pg_get_function_result(p.oid)               AS retorna,
       l.lanname                                   AS lenguaje,
       obj_description(p.oid, 'pg_proc')           AS descripcion
FROM pg_proc p
JOIN pg_language l ON l.oid = p.prolang
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY tipo;


-- ---------------------------------------------------------------------
-- PASO 2 · Código fuente de cada función (doble clic en la celda
--          "codigo" para verlo completo en el visor de valores)
-- ---------------------------------------------------------------------
SELECT p.proname                    AS funcion,
       pg_get_functiondef(p.oid)    AS codigo
FROM pg_proc p
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;


-- ---------------------------------------------------------------------
-- PASO 3 · Función de CÁLCULO: fn_valor_inventario(categoria, almacen)
-- ---------------------------------------------------------------------
-- 3a. Valor de todo el inventario (sin filtros)
SELECT fn_valor_inventario() AS valor_total_inventario;

-- 3b. Valor por almacén (segundo parámetro)
SELECT a.nombre                                 AS almacen,
       fn_valor_inventario(NULL, a.id_almacen)  AS valor
FROM almacenes a
ORDER BY valor DESC;

-- 3c. Valor por categoría (primer parámetro)
SELECT c.nombre                         AS categoria,
       fn_valor_inventario(c.id_categoria) AS valor
FROM categorias c
ORDER BY valor DESC;

-- 3d. Comprobación: el total coincide con la suma de los almacenes
SELECT fn_valor_inventario()                                   AS total_funcion,
       (SELECT SUM(fn_valor_inventario(NULL, id_almacen)) FROM almacenes) AS suma_almacenes,
       fn_valor_inventario() =
       (SELECT SUM(fn_valor_inventario(NULL, id_almacen)) FROM almacenes) AS coinciden;


-- ---------------------------------------------------------------------
-- PASO 4 · Función de INSERCIÓN: fn_registrar_movimiento(...)
--          Producto de ejemplo: Mouse inalámbrico Logitech M170 (PER-MOU-001)
--          en el Almacén Central Monterrey
-- ---------------------------------------------------------------------
-- 4a. Existencia ANTES
SELECT p.sku, p.nombre, a.nombre AS almacen, i.existencia AS existencia_antes
FROM inventario i
JOIN productos p ON p.id_producto = i.id_producto
JOIN almacenes a ON a.id_almacen  = i.id_almacen
WHERE p.sku = 'PER-MOU-001' AND a.nombre = 'Almacén Central Monterrey';

-- 4b. ENTRADA: compra de 25 piezas al proveedor (la función devuelve el id del movimiento)
SELECT fn_registrar_movimiento(
         (SELECT id_producto  FROM productos        WHERE sku    = 'PER-MOU-001'),
         (SELECT id_almacen   FROM almacenes        WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo      FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         25,                                                                      -- cantidad
         (SELECT id_usuario   FROM usuarios         WHERE correo = 'sofia.villarreal@nexo.mx'),
         170.00,                                                                  -- costo unitario
         (SELECT id_proveedor FROM proveedores      WHERE rfc    = 'TIN150312AB4'),
         'OC-DBEAVER-01',                                                         -- referencia
         'Demostración en DBeaver: entrada con la función de inserción'
       ) AS id_movimiento_entrada;

-- 4c. SALIDA: venta de 4 piezas (parámetros con nombre para omitir los opcionales)
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos        WHERE sku    = 'PER-MOU-001'),
         (SELECT id_almacen  FROM almacenes        WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo     FROM tipos_movimiento WHERE nombre = 'Venta'),
         4,
         (SELECT id_usuario  FROM usuarios         WHERE correo = 'jorge.salinas@nexo.mx'),
         p_referencia => 'FAC-DBEAVER-01'
       ) AS id_movimiento_salida;

-- 4d. Los dos movimientos que insertó la función (kardex con existencia resultante)
SELECT m.folio, t.nombre AS tipo, t.naturaleza, m.cantidad, m.costo_unitario,
       m.existencia_resultante, m.referencia,
       u.nombre || ' ' || u.apellidos AS registrado_por,
       to_char(m.fecha AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha
FROM movimientos m
JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
JOIN usuarios u ON u.id_usuario = m.id_usuario
WHERE m.referencia IN ('OC-DBEAVER-01', 'FAC-DBEAVER-01')
ORDER BY m.id_movimiento;

-- 4e. Existencia DESPUÉS (antes + 25 − 4), actualizada por la misma función
SELECT p.sku, p.nombre, a.nombre AS almacen, i.existencia AS existencia_despues
FROM inventario i
JOIN productos p ON p.id_producto = i.id_producto
JOIN almacenes a ON a.id_almacen  = i.id_almacen
WHERE p.sku = 'PER-MOU-001' AND a.nombre = 'Almacén Central Monterrey';


-- ---------------------------------------------------------------------
-- PASO 5 · Validaciones de la función (ESTAS CONSULTAS DEBEN FALLAR)
-- ---------------------------------------------------------------------
-- 5a. Vender más de lo que hay en existencia
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos        WHERE sku    = 'PER-MOU-001'),
         (SELECT id_almacen  FROM almacenes        WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo     FROM tipos_movimiento WHERE nombre = 'Venta'),
         99999,
         (SELECT id_usuario  FROM usuarios         WHERE correo = 'jorge.salinas@nexo.mx'));
-- Esperado: ERROR: Existencia insuficiente: hay N y se solicitan 99999

-- 5b. Compra sin indicar proveedor
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos        WHERE sku    = 'PER-MOU-001'),
         (SELECT id_almacen  FROM almacenes        WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo     FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         5,
         (SELECT id_usuario  FROM usuarios         WHERE correo = 'jorge.salinas@nexo.mx'));
-- Esperado: ERROR: Este tipo de movimiento requiere indicar un proveedor

-- 5c. Cantidad cero
SELECT fn_registrar_movimiento(1, 1, 5, 0, 1);
-- Esperado: ERROR: La cantidad debe ser mayor a cero (recibido: 0)


-- ---------------------------------------------------------------------
-- PASO 6 · Las dos funciones juntas: el valor del inventario cambió
--          por los movimientos que registró la función de inserción
-- ---------------------------------------------------------------------
SELECT fn_valor_inventario()                                             AS valor_total_actual,
       fn_valor_inventario((SELECT id_categoria FROM categorias WHERE nombre = 'Periféricos'))
                                                                          AS valor_perifericos;
