-- =====================================================================
-- Paso 01 · Evidencia 1: Base de datos creada en Neon
-- Ejecutar con: SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev1-01-owner.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 1.1 Conexión a la base de datos en la nube
SELECT current_database() AS base_de_datos,
       current_user       AS usuario,
       split_part(version(), ' on ', 1) AS motor,
       inet_server_port() AS puerto,
       pg_size_pretty(pg_database_size(current_database())) AS tamano,
       to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha_hora_mx;

-- 1.2 Esquemas y extensiones disponibles
SELECT n.nspname AS esquema, pg_get_userbyid(n.nspowner) AS propietario
FROM pg_namespace n
WHERE n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
ORDER BY 1;
