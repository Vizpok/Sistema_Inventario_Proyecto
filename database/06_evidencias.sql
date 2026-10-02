-- =====================================================================
-- Script 06 · Evidencias 1 a 7
--
-- Cada bloque indica con qué usuario debe ejecutarse:
--   -- @como <usuario>     (owner = nexo_inventario_owner)
-- `npm run evidencias` ejecuta todo automáticamente iniciando sesión con
-- cada usuario y guarda los resultados en docs/evidencias/.
-- A mano: conéctate con el usuario indicado (psql o SQL Editor de Neon
-- eligiendo el rol) y ejecuta las sentencias del bloque.
-- Las líneas "-- @espera_error" marcan sentencias que DEBEN fallar.
-- =====================================================================

-- @evidencia 1 Base de datos creada en Neon
-- @como owner
-- @titulo Conexión a la base de datos en la nube
SELECT current_database() AS base_de_datos,
       current_user       AS usuario,
       split_part(version(), ' on ', 1) AS motor,
       inet_server_port() AS puerto,
       pg_size_pretty(pg_database_size(current_database())) AS tamano,
       to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha_hora_mx;

-- @titulo Esquemas y extensiones disponibles
SELECT n.nspname AS esquema, pg_get_userbyid(n.nspowner) AS propietario
FROM pg_namespace n
WHERE n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
ORDER BY 1;

-- @evidencia 2 Diseño e implementación de las tablas
-- @como owner
-- @titulo Tablas creadas, número de columnas y registros
SELECT c.relname AS tabla,
       (SELECT count(*) FROM information_schema.columns col
         WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS columnas,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I', c.relname), false, true, '')))[1]::text::int AS registros,
       obj_description(c.oid, 'pg_class') AS descripcion
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- @titulo Llaves primarias
SELECT tc.table_name AS tabla, tc.constraint_name AS restriccion,
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columnas
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- @titulo Llaves foráneas (relaciones 1:N y N:M)
SELECT conrelid::regclass  AS tabla_hija,
       conname             AS restriccion,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;

-- @titulo Restricciones CHECK y UNIQUE
SELECT conrelid::regclass AS tabla, conname AS restriccion,
       CASE contype WHEN 'c' THEN 'CHECK' ELSE 'UNIQUE' END AS tipo,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype IN ('c', 'u') AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype, conname;

-- @titulo Tipos de datos de la tabla movimientos
SELECT column_name AS columna,
       CASE WHEN data_type = 'character varying' THEN 'varchar(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' THEN 'numeric(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE data_type END AS tipo,
       is_nullable AS nulo,
       COALESCE(column_default, CASE WHEN is_identity = 'YES' THEN 'IDENTITY' END,
                CASE WHEN is_generated = 'ALWAYS' THEN 'GENERADA: ' || generation_expression END) AS valor_por_defecto
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'movimientos'
ORDER BY ordinal_position;

-- @evidencia 3 Roles developer y "user"
-- @como owner
-- @titulo Atributos de los roles
SELECT rolname AS rol, rolcanlogin AS login, rolinherit AS hereda,
       rolcreatedb AS crea_bd, rolcreaterole AS crea_roles, rolsuper AS superusuario,
       shobj_description(oid, 'pg_authid') AS descripcion
FROM pg_roles
WHERE rolname IN ('developer', 'user')
ORDER BY rolname;

-- @titulo Permisos sobre la base de datos y el esquema public
SELECT r AS rol,
       has_database_privilege(r, current_database(), 'CONNECT')   AS conectar,
       has_database_privilege(r, current_database(), 'TEMPORARY') AS temporales,
       has_database_privilege(r, current_database(), 'CREATE')    AS crear_esquemas,
       has_schema_privilege(r, 'public', 'USAGE')  AS usar_public,
       has_schema_privilege(r, 'public', 'CREATE') AS crear_en_public
FROM unnest(ARRAY['developer', 'user']) AS r;

-- @titulo Permisos CRUD en tablas existentes
SELECT grantee AS rol,
       table_name AS tabla,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('developer', 'user')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;

-- @titulo Permisos por defecto para tablas, secuencias y funciones FUTURAS
SELECT pg_get_userbyid(d.defaclrole) AS cuando_crea,
       CASE d.defaclobjtype WHEN 'r' THEN 'tablas' WHEN 'S' THEN 'secuencias' WHEN 'f' THEN 'funciones' END AS objetos,
       a.grantee::regrole AS se_otorga_a,
       string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privilegios
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE pg_get_userbyid(d.defaclrole) IN ('nexo_inventario_owner', 'developer')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;

-- @evidencia 4 Usuarios y asignación de roles
-- @como owner
-- @titulo Usuarios creados y rol asignado
SELECT u.rolname AS usuario, u.rolcanlogin AS login,
       g.rolname AS rol_asignado,
       m.inherit_option AS hereda_permisos, m.set_option AS puede_set_role,
       (SELECT string_agg(s, ', ') FROM unnest(u.rolconfig) s) AS configuracion,
       shobj_description(u.oid, 'pg_authid') AS descripcion
FROM pg_auth_members m
JOIN pg_roles u ON u.oid = m.member
JOIN pg_roles g ON g.oid = m.roleid
WHERE g.rolname IN ('developer', 'user') AND u.rolname <> 'nexo_inventario_owner'
ORDER BY g.rolname, u.rolname;

-- @como dev_ana
-- @titulo dev_ana (developer) inicia sesión y crea una tabla nueva
SELECT session_user AS sesion, current_user AS actua_como;
CREATE TABLE evidencia_developer (id SERIAL PRIMARY KEY, nota VARCHAR(60), creado_en TIMESTAMPTZ DEFAULT now());
INSERT INTO evidencia_developer (nota) VALUES ('Tabla creada por un desarrollador') RETURNING *;

-- @como usr_carlos
-- @titulo usr_carlos ("user") hace CRUD en la tabla FUTURA gracias a los permisos por defecto
SELECT session_user AS sesion, current_user AS actua_como;
INSERT INTO evidencia_developer (nota) VALUES ('Insertado por usr_carlos') RETURNING *;
UPDATE evidencia_developer SET nota = nota || ' (editado)' WHERE nota LIKE '%usr_carlos%' RETURNING *;
SELECT * FROM evidencia_developer ORDER BY id;
DELETE FROM evidencia_developer WHERE nota LIKE '%usr_carlos%' RETURNING id;

-- @titulo usr_carlos ("user") NO puede crear objetos
-- @espera_error
CREATE TABLE intento_usuario (id INTEGER);
-- @espera_error
CREATE VIEW vw_intento AS SELECT 1 AS x;
-- @espera_error
CREATE TEMP TABLE intento_temporal (id INTEGER);
-- @espera_error
DROP TABLE evidencia_developer;

-- @titulo usr_carlos ("user") hace CRUD en una tabla existente
INSERT INTO categorias (nombre, descripcion, color) VALUES ('Evidencia CRUD', 'Registro temporal', '#123456') RETURNING id_categoria, nombre;
UPDATE categorias SET descripcion = 'Registro temporal (actualizado)' WHERE nombre = 'Evidencia CRUD' RETURNING id_categoria, descripcion;
SELECT id_categoria, nombre, descripcion FROM categorias WHERE nombre = 'Evidencia CRUD';
DELETE FROM categorias WHERE nombre = 'Evidencia CRUD' RETURNING id_categoria;

-- @como dev_ana
-- @titulo dev_ana elimina su tabla de prueba
DROP TABLE evidencia_developer;

-- @evidencia 5 Vistas con CTEs
-- @como owner
-- @titulo Vistas creadas
SELECT viewname AS vista, viewowner AS propietario,
       obj_description(format('%I', viewname)::regclass, 'pg_class') AS descripcion
FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;

-- @como usr_carlos
-- @titulo vw_estado_inventario · productos que requieren atención
SELECT sku, nombre, categoria, existencia_total AS existencia, stock_minimo AS minimo,
       valor_inventario AS valor, salidas_30d, dias_cobertura AS cobertura_dias, estado
FROM vw_estado_inventario
WHERE estado <> 'NORMAL'
ORDER BY CASE estado WHEN 'SIN STOCK' THEN 0 WHEN 'BAJO' THEN 1 ELSE 2 END, nombre;

-- @titulo vw_movimientos_diarios · últimos 10 días
SELECT dia, movimientos, unidades_entrada, unidades_salida, importe_entrada, importe_salida
FROM vw_movimientos_diarios
ORDER BY dia DESC
LIMIT 10;

-- @evidencia 6 Funciones
-- @como owner
-- @titulo Funciones creadas
SELECT p.proname AS funcion,
       p.pronargs AS parametros,
       p.pronargdefaults AS con_valor_por_defecto,
       pg_get_function_result(p.oid) AS retorna,
       l.lanname AS lenguaje,
       CASE p.provolatile WHEN 's' THEN 'STABLE' WHEN 'i' THEN 'IMMUTABLE' ELSE 'VOLATILE' END AS volatilidad
FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;
SELECT p.proname AS funcion, a.n, a.parametro, format_type(a.tipo, NULL) AS tipo
FROM pg_proc p
CROSS JOIN LATERAL unnest(p.proargnames, p.proargtypes::oid[]) WITH ORDINALITY AS a(parametro, tipo, n)
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname, a.n;

-- @como usr_carlos
-- @titulo fn_valor_inventario · cálculo total, por almacén y por categoría
SELECT 'Toda la empresa' AS alcance, fn_valor_inventario() AS valor
UNION ALL
SELECT 'Almacén: ' || nombre, fn_valor_inventario(NULL, id_almacen) FROM almacenes
UNION ALL
SELECT 'Categoría: ' || nombre, fn_valor_inventario(id_categoria) FROM categorias
ORDER BY valor DESC;

-- @titulo fn_registrar_movimiento · compra a proveedor (entrada)
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

-- @titulo fn_registrar_movimiento · venta (salida)
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Venta'),
         3,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'),
         p_referencia => 'FAC-EVIDENCIA-01') AS id_movimiento;
SELECT folio, cantidad, existencia_resultante, referencia
FROM movimientos ORDER BY id_movimiento DESC LIMIT 1;

-- @titulo fn_registrar_movimiento · validaciones (deben fallar)
-- @espera_error
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'MOB-ARC-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Venta'),
         5,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'));
-- @espera_error
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         5,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'));
-- @espera_error
SELECT fn_registrar_movimiento(1, 1, 5, 0, 1);

-- @evidencia 7 Uso de vistas y funciones
-- @como app_nexo
-- @titulo Indicadores del dashboard (vista + función), como los consulta la aplicación
SELECT fn_valor_inventario()                                   AS valor_total,
       COUNT(*)                                                AS productos_activos,
       SUM(existencia_total)                                   AS unidades,
       COUNT(*) FILTER (WHERE estado IN ('BAJO', 'SIN STOCK')) AS alertas
FROM vw_estado_inventario;

-- @titulo Valor por categoría: la vista contra la función (deben coincidir)
SELECT v.categoria,
       SUM(v.valor_inventario)                AS valor_desde_vista,
       fn_valor_inventario(v.id_categoria)    AS valor_desde_funcion,
       SUM(v.valor_inventario) = fn_valor_inventario(v.id_categoria) AS coinciden
FROM vw_estado_inventario v
GROUP BY v.categoria, v.id_categoria
ORDER BY valor_desde_vista DESC;

-- @titulo Reabastecimiento automático: registrar compras para todo lo agotado
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

-- @titulo Estado después del reabastecimiento
SELECT estado, COUNT(*) AS productos, SUM(valor_inventario) AS valor
FROM vw_estado_inventario
GROUP BY estado
ORDER BY productos DESC;

-- @titulo Kardex del producto reabastecido (tabla movimientos + vista)
SELECT m.folio, t.nombre AS tipo, m.cantidad, m.existencia_resultante,
       to_char(m.fecha AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha,
       v.estado AS estado_actual
FROM movimientos m
JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
JOIN vw_estado_inventario v ON v.id_producto = m.id_producto
WHERE v.sku = 'COM-LAP-003'
ORDER BY m.id_movimiento DESC
LIMIT 6;
