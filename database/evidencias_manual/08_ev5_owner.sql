-- =====================================================================
-- Paso 08 · Evidencia 5: Vistas con CTEs
-- Ejecutar con: SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev5-08-owner.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 5.1 Vistas creadas
SELECT viewname AS vista, viewowner AS propietario,
       obj_description(format('%I', viewname)::regclass, 'pg_class') AS descripcion
FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
