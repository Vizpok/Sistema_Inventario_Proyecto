-- =====================================================================
-- Paso 05 · Evidencia 4: Usuarios y asignación de roles
-- Ejecutar con: DBeaver con la conexión "Neon · dev_ana" (rol developer)
-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa
--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.
-- Captura sugerida: docs/capturas/manual/ev4-05-dev_ana.png
--   (que se vea el nombre de la conexión, la consulta y el resultado)
-- Archivo generado desde database/06_evidencias.sql — no editar a mano.
-- =====================================================================

-- 4.2 dev_ana (developer) inicia sesión y crea una tabla nueva
SELECT session_user AS sesion, current_user AS actua_como;

CREATE TABLE evidencia_developer (id SERIAL PRIMARY KEY, nota VARCHAR(60), creado_en TIMESTAMPTZ DEFAULT now());

INSERT INTO evidencia_developer (nota) VALUES ('Tabla creada por un desarrollador') RETURNING *;
