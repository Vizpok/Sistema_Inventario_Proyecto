-- =====================================================================
-- Script 00 · (OPCIONAL) Reiniciar datos
-- ⚠ BORRA TODOS LOS DATOS de las tablas y reinicia los contadores IDENTITY.
-- No toca la estructura, roles, vistas ni funciones.
-- Úsalo sólo para volver a cargar 05_datos_prueba.sql desde cero:
--   npm run sql -- database/00_reiniciar_datos.sql database/05_datos_prueba.sql
-- Ejecutar como: propietario de la BD (nexo_inventario_owner)
-- =====================================================================
TRUNCATE bitacora, movimientos, inventario, producto_proveedor, productos,
         tipos_movimiento, almacenes, proveedores, categorias, usuarios
RESTART IDENTITY CASCADE;
