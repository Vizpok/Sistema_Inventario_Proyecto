-- =====================================================================
-- Paso 10 · Evidencia 6: Funciones
-- Ejecutar con: SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev6-10-owner.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 6.1 Funciones creadas
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
