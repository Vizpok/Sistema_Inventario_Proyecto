-- =====================================================================
-- Paso 03 · Evidencia 3: Roles developer y "user"
-- Ejecutar con: SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev3-03-owner.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 3.1 Atributos de los roles
SELECT rolname AS rol, rolcanlogin AS login, rolinherit AS hereda,
       rolcreatedb AS crea_bd, rolcreaterole AS crea_roles, rolsuper AS superusuario,
       shobj_description(oid, 'pg_authid') AS descripcion
FROM pg_roles
WHERE rolname IN ('developer', 'user')
ORDER BY rolname;

-- 3.2 Permisos sobre la base de datos y el esquema public
SELECT r AS rol,
       has_database_privilege(r, current_database(), 'CONNECT')   AS conectar,
       has_database_privilege(r, current_database(), 'TEMPORARY') AS temporales,
       has_database_privilege(r, current_database(), 'CREATE')    AS crear_esquemas,
       has_schema_privilege(r, 'public', 'USAGE')  AS usar_public,
       has_schema_privilege(r, 'public', 'CREATE') AS crear_en_public
FROM unnest(ARRAY['developer', 'user']) AS r;

-- 3.3 Permisos CRUD en tablas existentes
SELECT grantee AS rol,
       table_name AS tabla,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('developer', 'user')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;

-- 3.4 Permisos por defecto para tablas, secuencias y funciones FUTURAS
SELECT pg_get_userbyid(d.defaclrole) AS cuando_crea,
       CASE d.defaclobjtype WHEN 'r' THEN 'tablas' WHEN 'S' THEN 'secuencias' WHEN 'f' THEN 'funciones' END AS objetos,
       a.grantee::regrole AS se_otorga_a,
       string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privilegios
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE pg_get_userbyid(d.defaclrole) IN ('nexo_inventario_owner', 'developer')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
