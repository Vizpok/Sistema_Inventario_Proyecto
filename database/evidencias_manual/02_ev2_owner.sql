-- =====================================================================
-- Paso 02 · Evidencia 2: Diseño e implementación de las tablas
-- Ejecutar con: SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev2-02-owner.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 2.1 Tablas creadas, número de columnas y registros
SELECT c.relname AS tabla,
       (SELECT count(*) FROM information_schema.columns col
         WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS columnas,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I', c.relname), false, true, '')))[1]::text::int AS registros,
       obj_description(c.oid, 'pg_class') AS descripcion
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;

-- 2.2 Llaves primarias
SELECT tc.table_name AS tabla, tc.constraint_name AS restriccion,
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columnas
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;

-- 2.3 Llaves foráneas (relaciones 1:N y N:M)
SELECT conrelid::regclass  AS tabla_hija,
       conname             AS restriccion,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;

-- 2.4 Restricciones CHECK y UNIQUE
SELECT conrelid::regclass AS tabla, conname AS restriccion,
       CASE contype WHEN 'c' THEN 'CHECK' ELSE 'UNIQUE' END AS tipo,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype IN ('c', 'u') AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype, conname;

-- 2.5 Tipos de datos de la tabla movimientos
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
