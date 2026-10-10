-- =====================================================================
-- Paso 06 · Evidencia 4: Usuarios y asignación de roles
-- Ejecutar con: DBeaver con la conexión "Neon · usr_carlos" (rol "user")
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev4-06-usr_carlos.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 4.3 usr_carlos ("user") hace CRUD en la tabla FUTURA gracias a los permisos por defecto
SELECT session_user AS sesion, current_user AS actua_como;

INSERT INTO evidencia_developer (nota) VALUES ('Insertado por usr_carlos') RETURNING *;

UPDATE evidencia_developer SET nota = nota || ' (editado)' WHERE nota LIKE '%usr_carlos%' RETURNING *;

SELECT * FROM evidencia_developer ORDER BY id;

DELETE FROM evidencia_developer WHERE nota LIKE '%usr_carlos%' RETURNING id;

-- 4.4 usr_carlos ("user") NO puede crear objetos
-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
CREATE TABLE intento_usuario (id INTEGER);

-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
CREATE VIEW vw_intento AS SELECT 1 AS x;

-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
CREATE TEMP TABLE intento_temporal (id INTEGER);

-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)
DROP TABLE evidencia_developer;

-- 4.5 usr_carlos ("user") hace CRUD en una tabla existente
INSERT INTO categorias (nombre, descripcion, color) VALUES ('Evidencia CRUD', 'Registro temporal', '#123456') RETURNING id_categoria, nombre;

UPDATE categorias SET descripcion = 'Registro temporal (actualizado)' WHERE nombre = 'Evidencia CRUD' RETURNING id_categoria, descripcion;

SELECT id_categoria, nombre, descripcion FROM categorias WHERE nombre = 'Evidencia CRUD';

DELETE FROM categorias WHERE nombre = 'Evidencia CRUD' RETURNING id_categoria;
