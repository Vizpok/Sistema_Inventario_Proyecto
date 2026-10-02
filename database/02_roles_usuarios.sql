-- =====================================================================
-- Script 02 · Roles y usuarios con permisos diferenciados
-- Ejecutar como: propietario de la BD (nexo_inventario_owner)
--
-- NOTA sobre contraseñas: los valores {{PWD_...}} se sustituyen desde el
-- archivo .env al ejecutar `npm run sql -- database/02_roles_usuarios.sql`.
-- Si pegas este script en el SQL Editor de Neon, reemplázalos a mano por
-- contraseñas seguras (Neon exige contraseñas con suficiente entropía).
--
-- NOTA sobre el nombre "user": USER es palabra reservada en PostgreSQL
-- (equivale a CURRENT_USER), por eso el rol se escribe entre comillas.
-- =====================================================================

-- Seguridad base: nadie crea objetos por "herencia" del pseudo-rol PUBLIC.
-- (Desde PostgreSQL 15 ya no hay CREATE en public para PUBLIC; lo dejamos explícito.)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE, TEMPORARY ON DATABASE nexo_inventario FROM PUBLIC;

-- =====================================================================
-- 3.1 Rol developer
-- =====================================================================
CREATE ROLE developer WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;

-- Permiso de conexión a la base de datos (+ tablas temporales)
GRANT CONNECT, TEMPORARY ON DATABASE nexo_inventario TO developer;

-- Permiso de creación en el esquema public
GRANT USAGE, CREATE ON SCHEMA public TO developer;

-- CRUD en tablas existentes (+ secuencias y funciones necesarias para operar)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO developer;
GRANT USAGE, SELECT, UPDATE          ON ALL SEQUENCES IN SCHEMA public TO developer;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO developer;

-- =====================================================================
-- 3.2 Rol "user"
-- =====================================================================
CREATE ROLE "user" WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;

-- Permiso de conexión (sin TEMPORARY: no puede crear ni tablas temporales)
GRANT CONNECT ON DATABASE nexo_inventario TO "user";

-- Sólo USAGE en el esquema: puede ver/usar objetos, NO crearlos
GRANT USAGE ON SCHEMA public TO "user";
REVOKE CREATE ON SCHEMA public FROM "user";

-- CRUD en tablas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO "user";
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO "user";
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO "user";

-- =====================================================================
-- 3.3 Permisos por defecto en objetos FUTUROS
--   Se definen para los dos roles que pueden crear objetos:
--   · nexo_inventario_owner (propietario, ejecuta los scripts)
--   · developer (los desarrolladores crean objetos como developer)
-- =====================================================================
-- El propietario necesita ser miembro de developer para fijar sus privilegios por defecto
GRANT developer TO nexo_inventario_owner WITH INHERIT TRUE, SET TRUE;

-- Objetos creados por el propietario
ALTER DEFAULT PRIVILEGES FOR ROLE nexo_inventario_owner IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO developer, "user";
ALTER DEFAULT PRIVILEGES FOR ROLE nexo_inventario_owner IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO developer;
ALTER DEFAULT PRIVILEGES FOR ROLE nexo_inventario_owner IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "user";
ALTER DEFAULT PRIVILEGES FOR ROLE nexo_inventario_owner IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO developer, "user";

-- Objetos creados por developer
ALTER DEFAULT PRIVILEGES FOR ROLE developer IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO developer, "user";
ALTER DEFAULT PRIVILEGES FOR ROLE developer IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO developer;
ALTER DEFAULT PRIVILEGES FOR ROLE developer IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO "user";
ALTER DEFAULT PRIVILEGES FOR ROLE developer IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO developer, "user";

-- =====================================================================
-- 4. Usuarios (roles con contraseña) y asignación de roles
-- =====================================================================
-- Desarrolladores
CREATE ROLE dev_ana  WITH LOGIN PASSWORD '{{PWD_DEV_ANA}}'  IN ROLE developer;
CREATE ROLE dev_luis WITH LOGIN PASSWORD '{{PWD_DEV_LUIS}}' IN ROLE developer;

-- Al iniciar sesión, los desarrolladores actúan como "developer": así los
-- objetos que creen pertenecen al rol del equipo y reciben los permisos por defecto.
ALTER ROLE dev_ana  SET role = 'developer';
ALTER ROLE dev_luis SET role = 'developer';

-- Usuarios operativos
CREATE ROLE app_nexo   WITH LOGIN PASSWORD '{{PWD_APP_NEXO}}'   IN ROLE "user";  -- lo usa la aplicación web
CREATE ROLE usr_carlos WITH LOGIN PASSWORD '{{PWD_USR_CARLOS}}' IN ROLE "user";

COMMENT ON ROLE developer  IS 'Equipo de desarrollo: CRUD + creación de objetos en public';
COMMENT ON ROLE "user"     IS 'Usuarios operativos: CRUD sin creación de objetos';
COMMENT ON ROLE dev_ana    IS 'Desarrolladora (miembro de developer)';
COMMENT ON ROLE dev_luis   IS 'Desarrollador (miembro de developer)';
COMMENT ON ROLE app_nexo   IS 'Cuenta de servicio de la aplicación web (miembro de user)';
COMMENT ON ROLE usr_carlos IS 'Analista de inventario (miembro de user)';
