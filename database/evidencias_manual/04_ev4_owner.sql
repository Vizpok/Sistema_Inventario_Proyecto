-- =====================================================================
-- Paso 04 · Evidencia 4: Usuarios y asignación de roles
-- Ejecutar con: SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev4-04-owner.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 4.1 Usuarios creados y rol asignado
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
