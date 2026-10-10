# Evidencias 1–7 · Proyecto Unidad 1

Salida real obtenida al ejecutar `database/06_evidencias.sql` contra Neon PostgreSQL (2026-09-30 20:55 UTC).
Cada bloque se ejecutó iniciando sesión con el usuario indicado. Regenerar con `npm run evidencias`.

## Evidencia 1. Base de datos creada en Neon

### 1.1 Conexión a la base de datos en la nube

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT current_database() AS base_de_datos,
       current_user       AS usuario,
       split_part(version(), ' on ', 1) AS motor,
       inet_server_port() AS puerto,
       pg_size_pretty(pg_database_size(current_database())) AS tamano,
       to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha_hora_mx;
```
```text
  base_de_datos  |        usuario        |           motor           | puerto | tamano  |  fecha_hora_mx  
-----------------+-----------------------+---------------------------+--------+---------+------------------
 nexo_inventario | nexo_inventario_owner | PostgreSQL 18.6 (6569466) |   5432 | 8712 kB | 2026-09-30 14:55
(1 fila)
```

### 1.2 Esquemas y extensiones disponibles

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT n.nspname AS esquema, pg_get_userbyid(n.nspowner) AS propietario
FROM pg_namespace n
WHERE n.nspname NOT LIKE 'pg\_%' AND n.nspname <> 'information_schema'
ORDER BY 1;
```
```text
 esquema |    propietario   
---------+-------------------
 public  | pg_database_owner
(1 fila)
```

## Evidencia 2. Diseño e implementación de las tablas

### 2.1 Tablas creadas, número de columnas y registros

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT c.relname AS tabla,
       (SELECT count(*) FROM information_schema.columns col
         WHERE col.table_schema = 'public' AND col.table_name = c.relname) AS columnas,
       (xpath('/row/n/text()', query_to_xml(format('SELECT count(*) AS n FROM %I', c.relname), false, true, '')))[1]::text::int AS registros,
       obj_description(c.oid, 'pg_class') AS descripcion
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname;
```
```text
       tabla        | columnas | registros |                          descripcion                         
--------------------+----------+-----------+---------------------------------------------------------------
 almacenes          |        5 |         3 | Almacenes / sucursales físicas                               
 bitacora           |        6 |         1 | Auditoría de acciones de los usuarios                        
 categorias         |        6 |         8 | Categorías del catálogo de productos                         
 inventario         |        5 |        99 | Existencias por producto y almacén (N:M)                     
 movimientos        |       13 |       503 | Kardex: historial de entradas y salidas                      
 producto_proveedor |        5 |        52 | Relación N:M producto-proveedor con costo y tiempo de entrega
 productos          |       13 |        37 | Catálogo de productos                                        
 proveedores        |       10 |         8 | Proveedores de mercancía                                     
 tipos_movimiento   |        5 |         9 | Motivos de entrada y salida de mercancía                     
 usuarios           |       10 |         5 | Usuarios del sistema web (rol de aplicación admin/usuario)   
(10 filas)
```

### 2.2 Llaves primarias

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT tc.table_name AS tabla, tc.constraint_name AS restriccion,
       string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columnas
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'PRIMARY KEY'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name;
```
```text
       tabla        |      restriccion      |         columnas         
--------------------+-----------------------+---------------------------
 almacenes          | almacenes_pkey        | id_almacen               
 bitacora           | bitacora_pkey         | id_bitacora              
 categorias         | categorias_pkey       | id_categoria             
 inventario         | pk_inventario         | id_producto, id_almacen  
 movimientos        | movimientos_pkey      | id_movimiento            
 producto_proveedor | pk_producto_proveedor | id_producto, id_proveedor
 productos          | productos_pkey        | id_producto              
 proveedores        | proveedores_pkey      | id_proveedor             
 tipos_movimiento   | tipos_movimiento_pkey | id_tipo                  
 usuarios           | usuarios_pkey         | id_usuario               
(10 filas)
```

### 2.3 Llaves foráneas (relaciones 1:N y N:M)

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT conrelid::regclass  AS tabla_hija,
       conname             AS restriccion,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, conname;
```
```text
     tabla_hija     |       restriccion        |                                             definicion                                             
--------------------+--------------------------+-----------------------------------------------------------------------------------------------------
 almacenes          | fk_almacenes_responsable | FOREIGN KEY (id_responsable) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL  
 bitacora           | fk_bitacora_usuario      | FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON UPDATE CASCADE ON DELETE SET NULL      
 inventario         | fk_inventario_almacen    | FOREIGN KEY (id_almacen) REFERENCES almacenes(id_almacen) ON UPDATE CASCADE ON DELETE RESTRICT     
 inventario         | fk_inventario_producto   | FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT   
 movimientos        | fk_mov_almacen           | FOREIGN KEY (id_almacen) REFERENCES almacenes(id_almacen)                                          
 movimientos        | fk_mov_producto          | FOREIGN KEY (id_producto) REFERENCES productos(id_producto)                                        
 movimientos        | fk_mov_proveedor         | FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor)                                    
 movimientos        | fk_mov_tipo              | FOREIGN KEY (id_tipo) REFERENCES tipos_movimiento(id_tipo)                                         
 movimientos        | fk_mov_usuario           | FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)                                           
 producto_proveedor | fk_pp_producto           | FOREIGN KEY (id_producto) REFERENCES productos(id_producto) ON UPDATE CASCADE ON DELETE CASCADE    
 producto_proveedor | fk_pp_proveedor          | FOREIGN KEY (id_proveedor) REFERENCES proveedores(id_proveedor) ON UPDATE CASCADE ON DELETE CASCADE
 productos          | fk_productos_categoria   | FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON UPDATE CASCADE ON DELETE RESTRICT
(12 filas)
```

### 2.4 Restricciones CHECK y UNIQUE

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT conrelid::regclass AS tabla, conname AS restriccion,
       CASE contype WHEN 'c' THEN 'CHECK' ELSE 'UNIQUE' END AS tipo,
       pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE contype IN ('c', 'u') AND connamespace = 'public'::regnamespace
ORDER BY conrelid::regclass::text, contype, conname;
```
```text
       tabla        |         restriccion         |  tipo  |                                                   definicion                                                   
--------------------+-----------------------------+--------+-----------------------------------------------------------------------------------------------------------------
 almacenes          | almacenes_nombre_key        | UNIQUE | UNIQUE (nombre)                                                                                                
 categorias         | ck_categorias_color         | CHECK  | CHECK ((color ~ '^#[0-9A-Fa-f]{6}$'::text))                                                                    
 categorias         | categorias_nombre_key       | UNIQUE | UNIQUE (nombre)                                                                                                
 inventario         | ck_inventario_existencia    | CHECK  | CHECK ((existencia >= 0))                                                                                      
 movimientos        | ck_mov_cantidad             | CHECK  | CHECK ((cantidad > 0))                                                                                         
 movimientos        | ck_mov_costo                | CHECK  | CHECK ((costo_unitario >= (0)::numeric))                                                                       
 movimientos        | ck_mov_resultante           | CHECK  | CHECK ((existencia_resultante >= 0))                                                                           
 movimientos        | uq_movimientos_folio        | UNIQUE | UNIQUE (folio)                                                                                                 
 producto_proveedor | ck_pp_costo                 | CHECK  | CHECK ((costo >= (0)::numeric))                                                                                
 producto_proveedor | ck_pp_dias                  | CHECK  | CHECK ((dias_entrega >= 0))                                                                                    
 productos          | ck_productos_pcompra        | CHECK  | CHECK ((precio_compra >= (0)::numeric))                                                                        
 productos          | ck_productos_pventa         | CHECK  | CHECK ((precio_venta >= (0)::numeric))                                                                         
 productos          | ck_productos_rango_stock    | CHECK  | CHECK (((stock_maximo = 0) OR (stock_maximo >= stock_minimo)))                                                 
 productos          | ck_productos_smax           | CHECK  | CHECK ((stock_maximo >= 0))                                                                                    
 productos          | ck_productos_smin           | CHECK  | CHECK ((stock_minimo >= 0))                                                                                    
 productos          | productos_sku_key           | UNIQUE | UNIQUE (sku)                                                                                                   
 proveedores        | ck_proveedores_rfc          | CHECK  | CHECK ((char_length((rfc)::text) = ANY (ARRAY[12, 13])))                                                       
 proveedores        | proveedores_rfc_key         | UNIQUE | UNIQUE (rfc)                                                                                                   
 tipos_movimiento   | ck_tipos_naturaleza         | CHECK  | CHECK (((naturaleza)::text = ANY ((ARRAY['ENTRADA'::character varying, 'SALIDA'::character varying])::text[])))
 tipos_movimiento   | tipos_movimiento_nombre_key | UNIQUE | UNIQUE (nombre)                                                                                                
 usuarios           | ck_usuarios_rol             | CHECK  | CHECK (((rol)::text = ANY ((ARRAY['admin'::character varying, 'usuario'::character varying])::text[])))        
 usuarios           | usuarios_correo_key         | UNIQUE | UNIQUE (correo)                                                                                                
(22 filas)
```

### 2.5 Tipos de datos de la tabla movimientos

Usuario de conexión: `nexo_inventario_owner`

```sql
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
```
```text
        columna        |           tipo           | nulo |                           valor_por_defecto                          
-----------------------+--------------------------+------+-----------------------------------------------------------------------
 id_movimiento         | integer                  | NO   | IDENTITY                                                             
 folio                 | varchar(12)              | YES  | GENERADA: ('MOV-'::text || lpad((id_movimiento)::text, 6, '0'::text))
 id_tipo               | smallint                 | NO   |                                                                      
 id_producto           | integer                  | NO   |                                                                      
 id_almacen            | smallint                 | NO   |                                                                      
 id_proveedor          | integer                  | YES  |                                                                      
 id_usuario            | integer                  | NO   |                                                                      
 cantidad              | integer                  | NO   |                                                                      
 costo_unitario        | numeric(12,2)            | NO   | 0                                                                    
 existencia_resultante | integer                  | NO   |                                                                      
 referencia            | varchar(60)              | YES  |                                                                      
 observaciones         | varchar(255)             | YES  |                                                                      
 fecha                 | timestamp with time zone | NO   | now()                                                                
(13 filas)
```

## Evidencia 3. Roles developer y "user"

### 3.1 Atributos de los roles

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT rolname AS rol, rolcanlogin AS login, rolinherit AS hereda,
       rolcreatedb AS crea_bd, rolcreaterole AS crea_roles, rolsuper AS superusuario,
       shobj_description(oid, 'pg_authid') AS descripcion
FROM pg_roles
WHERE rolname IN ('developer', 'user')
ORDER BY rolname;
```
```text
    rol    | login | hereda | crea_bd | crea_roles | superusuario |                        descripcion                        
-----------+-------+--------+---------+------------+--------------+------------------------------------------------------------
 developer | t     | t      | f       | f          | f            | Equipo de desarrollo: CRUD + creación de objetos en public
 user      | t     | t      | f       | f          | f            | Usuarios operativos: CRUD sin creación de objetos         
(2 filas)
```

### 3.2 Permisos sobre la base de datos y el esquema public

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT r AS rol,
       has_database_privilege(r, current_database(), 'CONNECT')   AS conectar,
       has_database_privilege(r, current_database(), 'TEMPORARY') AS temporales,
       has_database_privilege(r, current_database(), 'CREATE')    AS crear_esquemas,
       has_schema_privilege(r, 'public', 'USAGE')  AS usar_public,
       has_schema_privilege(r, 'public', 'CREATE') AS crear_en_public
FROM unnest(ARRAY['developer', 'user']) AS r;
```
```text
    rol    | conectar | temporales | crear_esquemas | usar_public | crear_en_public
-----------+----------+------------+----------------+-------------+-----------------
 developer | t        | t          | f              | t           | t              
 user      | t        | f          | f              | t           | f              
(2 filas)
```

### 3.3 Permisos CRUD en tablas existentes

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT grantee AS rol,
       table_name AS tabla,
       string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privilegios
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND grantee IN ('developer', 'user')
GROUP BY grantee, table_name
ORDER BY grantee, table_name;
```
```text
    rol    |         tabla          |          privilegios          
-----------+------------------------+--------------------------------
 developer | almacenes              | DELETE, INSERT, SELECT, UPDATE
 developer | bitacora               | DELETE, INSERT, SELECT, UPDATE
 developer | categorias             | DELETE, INSERT, SELECT, UPDATE
 developer | inventario             | DELETE, INSERT, SELECT, UPDATE
 developer | movimientos            | DELETE, INSERT, SELECT, UPDATE
 developer | producto_proveedor     | DELETE, INSERT, SELECT, UPDATE
 developer | productos              | DELETE, INSERT, SELECT, UPDATE
 developer | proveedores            | DELETE, INSERT, SELECT, UPDATE
 developer | tipos_movimiento       | DELETE, INSERT, SELECT, UPDATE
 developer | usuarios               | DELETE, INSERT, SELECT, UPDATE
 developer | vw_estado_inventario   | DELETE, INSERT, SELECT, UPDATE
 developer | vw_movimientos_diarios | DELETE, INSERT, SELECT, UPDATE
 user      | almacenes              | DELETE, INSERT, SELECT, UPDATE
 user      | bitacora               | DELETE, INSERT, SELECT, UPDATE
 user      | categorias             | DELETE, INSERT, SELECT, UPDATE
 user      | inventario             | DELETE, INSERT, SELECT, UPDATE
 user      | movimientos            | DELETE, INSERT, SELECT, UPDATE
 user      | producto_proveedor     | DELETE, INSERT, SELECT, UPDATE
 user      | productos              | DELETE, INSERT, SELECT, UPDATE
 user      | proveedores            | DELETE, INSERT, SELECT, UPDATE
 user      | tipos_movimiento       | DELETE, INSERT, SELECT, UPDATE
 user      | usuarios               | DELETE, INSERT, SELECT, UPDATE
 user      | vw_estado_inventario   | DELETE, INSERT, SELECT, UPDATE
 user      | vw_movimientos_diarios | DELETE, INSERT, SELECT, UPDATE
(24 filas)
```

### 3.4 Permisos por defecto para tablas, secuencias y funciones FUTURAS

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT pg_get_userbyid(d.defaclrole) AS cuando_crea,
       CASE d.defaclobjtype WHEN 'r' THEN 'tablas' WHEN 'S' THEN 'secuencias' WHEN 'f' THEN 'funciones' END AS objetos,
       a.grantee::regrole AS se_otorga_a,
       string_agg(a.privilege_type, ', ' ORDER BY a.privilege_type) AS privilegios
FROM pg_default_acl d
CROSS JOIN LATERAL aclexplode(d.defaclacl) a
WHERE pg_get_userbyid(d.defaclrole) IN ('nexo_inventario_owner', 'developer')
GROUP BY 1, 2, 3
ORDER BY 1, 2, 3;
```
```text
      cuando_crea      |  objetos   | se_otorga_a |          privilegios          
-----------------------+------------+-------------+--------------------------------
 developer             | funciones  | developer   | EXECUTE                       
 developer             | funciones  | "user"      | EXECUTE                       
 developer             | secuencias | developer   | SELECT, UPDATE, USAGE         
 developer             | secuencias | "user"      | SELECT, USAGE                 
 developer             | tablas     | developer   | DELETE, INSERT, SELECT, UPDATE
 developer             | tablas     | "user"      | DELETE, INSERT, SELECT, UPDATE
 nexo_inventario_owner | funciones  | developer   | EXECUTE                       
 nexo_inventario_owner | funciones  | "user"      | EXECUTE                       
 nexo_inventario_owner | secuencias | developer   | SELECT, UPDATE, USAGE         
 nexo_inventario_owner | secuencias | "user"      | SELECT, USAGE                 
 nexo_inventario_owner | tablas     | developer   | DELETE, INSERT, SELECT, UPDATE
 nexo_inventario_owner | tablas     | "user"      | DELETE, INSERT, SELECT, UPDATE
(12 filas)
```

## Evidencia 4. Usuarios y asignación de roles

### 4.1 Usuarios creados y rol asignado

Usuario de conexión: `nexo_inventario_owner`

```sql
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
```
```text
  usuario   | login | rol_asignado | hereda_permisos | puede_set_role | configuracion  |                        descripcion                       
------------+-------+--------------+-----------------+----------------+----------------+-----------------------------------------------------------
 dev_ana    | t     | developer    | t               | t              | role=developer | Desarrolladora (miembro de developer)                    
 dev_luis   | t     | developer    | t               | t              | role=developer | Desarrollador (miembro de developer)                     
 app_nexo   | t     | user         | t               | t              |                | Cuenta de servicio de la aplicación web (miembro de user)
 usr_carlos | t     | user         | t               | t              |                | Analista de inventario (miembro de user)                 
(4 filas)
```

### 4.2 dev_ana (developer) inicia sesión y crea una tabla nueva

Usuario de conexión: `dev_ana`

```sql
SELECT session_user AS sesion, current_user AS actua_como;
```
```text
 sesion  | actua_como
---------+------------
 dev_ana | developer 
(1 fila)
```

```sql
CREATE TABLE evidencia_developer (id SERIAL PRIMARY KEY, nota VARCHAR(60), creado_en TIMESTAMPTZ DEFAULT now());
```
```text
CREATE TABLE
```

```sql
INSERT INTO evidencia_developer (nota) VALUES ('Tabla creada por un desarrollador') RETURNING *;
```
```text
 id |               nota                |       creado_en       
----+-----------------------------------+------------------------
  1 | Tabla creada por un desarrollador | 2026-09-30 20:55:16+00
(1 fila)
```

### 4.3 usr_carlos ("user") hace CRUD en la tabla FUTURA gracias a los permisos por defecto

Usuario de conexión: `usr_carlos`

```sql
SELECT session_user AS sesion, current_user AS actua_como;
```
```text
   sesion   | actua_como
------------+------------
 usr_carlos | usr_carlos
(1 fila)
```

```sql
INSERT INTO evidencia_developer (nota) VALUES ('Insertado por usr_carlos') RETURNING *;
```
```text
 id |           nota           |       creado_en       
----+--------------------------+------------------------
  2 | Insertado por usr_carlos | 2026-09-30 20:55:16+00
(1 fila)
```

```sql
UPDATE evidencia_developer SET nota = nota || ' (editado)' WHERE nota LIKE '%usr_carlos%' RETURNING *;
```
```text
 id |                nota                |       creado_en       
----+------------------------------------+------------------------
  2 | Insertado por usr_carlos (editado) | 2026-09-30 20:55:16+00
(1 fila)
```

```sql
SELECT * FROM evidencia_developer ORDER BY id;
```
```text
 id |                nota                |       creado_en       
----+------------------------------------+------------------------
  1 | Tabla creada por un desarrollador  | 2026-09-30 20:55:16+00
  2 | Insertado por usr_carlos (editado) | 2026-09-30 20:55:16+00
(2 filas)
```

```sql
DELETE FROM evidencia_developer WHERE nota LIKE '%usr_carlos%' RETURNING id;
```
```text
 id
----
  2
(1 fila)
```

### 4.4 usr_carlos ("user") NO puede crear objetos

Usuario de conexión: `usr_carlos`

```sql
CREATE TABLE intento_usuario (id INTEGER);
```
```text
ERROR:  permission denied for schema public
SQLSTATE: 42501
-- ✔ error esperado: el permiso/validación funciona
```

```sql
CREATE VIEW vw_intento AS SELECT 1 AS x;
```
```text
ERROR:  permission denied for schema public
SQLSTATE: 42501
-- ✔ error esperado: el permiso/validación funciona
```

```sql
CREATE TEMP TABLE intento_temporal (id INTEGER);
```
```text
ERROR:  permission denied to create temporary tables in database "nexo_inventario"
SQLSTATE: 42501
-- ✔ error esperado: el permiso/validación funciona
```

```sql
DROP TABLE evidencia_developer;
```
```text
ERROR:  must be owner of table evidencia_developer
SQLSTATE: 42501
-- ✔ error esperado: el permiso/validación funciona
```

### 4.5 usr_carlos ("user") hace CRUD en una tabla existente

Usuario de conexión: `usr_carlos`

```sql
INSERT INTO categorias (nombre, descripcion, color) VALUES ('Evidencia CRUD', 'Registro temporal', '#123456') RETURNING id_categoria, nombre;
```
```text
 id_categoria |     nombre    
--------------+----------------
            9 | Evidencia CRUD
(1 fila)
```

```sql
UPDATE categorias SET descripcion = 'Registro temporal (actualizado)' WHERE nombre = 'Evidencia CRUD' RETURNING id_categoria, descripcion;
```
```text
 id_categoria |           descripcion          
--------------+---------------------------------
            9 | Registro temporal (actualizado)
(1 fila)
```

```sql
SELECT id_categoria, nombre, descripcion FROM categorias WHERE nombre = 'Evidencia CRUD';
```
```text
 id_categoria |     nombre     |           descripcion          
--------------+----------------+---------------------------------
            9 | Evidencia CRUD | Registro temporal (actualizado)
(1 fila)
```

```sql
DELETE FROM categorias WHERE nombre = 'Evidencia CRUD' RETURNING id_categoria;
```
```text
 id_categoria
--------------
            9
(1 fila)
```

### 4.6 dev_ana elimina su tabla de prueba

Usuario de conexión: `dev_ana`

```sql
DROP TABLE evidencia_developer;
```
```text
DROP TABLE
```

## Evidencia 5. Vistas con CTEs

### 5.1 Vistas creadas

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT viewname AS vista, viewowner AS propietario,
       obj_description(format('%I', viewname)::regclass, 'pg_class') AS descripcion
FROM pg_views WHERE schemaname = 'public' ORDER BY viewname;
```
```text
         vista          |      propietario      |                                     descripcion                                    
------------------------+-----------------------+-------------------------------------------------------------------------------------
 vw_estado_inventario   | nexo_inventario_owner | Existencia total, valor, rotación 30 días, cobertura y semáforo por producto (CTEs)
 vw_movimientos_diarios | nexo_inventario_owner | Entradas y salidas por día de los últimos 30 días, con días vacíos en cero (CTEs)  
(2 filas)
```

### 5.2 vw_estado_inventario · productos que requieren atención

Usuario de conexión: `usr_carlos`

```sql
SELECT sku, nombre, categoria, existencia_total AS existencia, stock_minimo AS minimo,
       valor_inventario AS valor, salidas_30d, dias_cobertura AS cobertura_dias, estado
FROM vw_estado_inventario
WHERE estado <> 'NORMAL'
ORDER BY CASE estado WHEN 'SIN STOCK' THEN 0 WHEN 'BAJO' THEN 1 ELSE 2 END, nombre;
```
```text
     sku     |                 nombre                  |   categoria    | existencia | minimo |  valor   | salidas_30d | cobertura_dias |  estado  
-------------+-----------------------------------------+----------------+------------+--------+----------+-------------+----------------+-----------
 MOB-ARC-001 | Archivero metálico 4 gavetas            | Mobiliario     |          0 |      2 |     0.00 |          13 |            0.0 | SIN STOCK
 COM-LAP-002 | Laptop HP ProBook 450 G10 i5 16GB 512GB | Cómputo        |          0 |      4 |     0.00 |           6 |            0.0 | SIN STOCK
 COM-LAP-003 | MacBook Air 13" M3 8GB 256GB            | Cómputo        |          0 |      2 |     0.00 |          10 |            0.0 | SIN STOCK
 RED-AP-001  | Access Point Ubiquiti UniFi U6 Lite     | Redes          |          4 |      4 |  9800.00 |          11 |           10.9 | BAJO     
 PER-DIA-001 | Diadema Jabra Evolve2 30 USB-C          | Periféricos    |          8 |     10 |  9200.00 |          19 |           12.6 | BAJO     
 ALM-HDD-001 | Disco externo Seagate 2TB USB 3.0       | Almacenamiento |          4 |      8 |  5000.00 |          22 |            5.5 | BAJO     
 PAP-ENG-001 | Engrapadora Pilot metálica              | Papelería      |          5 |     15 |   575.00 |           8 |           18.7 | BAJO     
 MOB-ESC-001 | Escritorio en L 150 cm                  | Mobiliario     |          1 |      2 |  3100.00 |           6 |            5.0 | BAJO     
 ENE-MUL-001 | Multicontacto con supresor 6 salidas    | Energía        |          2 |     20 |   420.00 |          20 |            3.0 | BAJO     
 ALM-SSD-001 | SSD Kingston NV2 1TB NVMe               | Almacenamiento |         10 |     12 |  9500.00 |          42 |            7.1 | BAJO     
 IMP-TON-001 | Tóner HP 58A negro                      | Impresión      |          8 |     10 | 13200.00 |          17 |           14.1 | BAJO     
 PAP-BOL-001 | Bolígrafo BIC Cristal azul (caja 12)    | Papelería      |        236 |     40 | 11328.00 |          87 |           81.4 | EXCESO   
 PER-TEC-001 | Teclado Logitech K120 USB español       | Periféricos    |        166 |     30 | 27390.00 |          46 |          108.3 | EXCESO   
(13 filas)
```

### 5.3 vw_movimientos_diarios · últimos 10 días

Usuario de conexión: `usr_carlos`

```sql
SELECT dia, movimientos, unidades_entrada, unidades_salida, importe_entrada, importe_salida
FROM vw_movimientos_diarios
ORDER BY dia DESC
LIMIT 10;
```
```text
    dia     | movimientos | unidades_entrada | unidades_salida | importe_entrada | importe_salida
------------+-------------+------------------+-----------------+-----------------+----------------
 2026-09-30 |          14 |              318 |              80 |        43046.00 |      216190.00
 2026-09-29 |           9 |               33 |              22 |        42520.00 |       17473.00
 2026-09-28 |          10 |               15 |               4 |       136566.00 |        4270.00
 2026-09-27 |           4 |                4 |               9 |        11200.00 |       38650.00
 2026-09-26 |           4 |               18 |               4 |        70200.00 |       45000.00
 2026-09-25 |           5 |               52 |               8 |        56200.00 |       33700.00
 2026-09-24 |           7 |                5 |              24 |        11250.00 |       48710.00
 2026-09-23 |           8 |               21 |              16 |        42850.00 |        8035.00
 2026-09-22 |           5 |               16 |               7 |         2320.00 |        8485.00
 2026-09-21 |           9 |               75 |              27 |        24680.00 |       35820.00
(10 filas)
```

## Evidencia 6. Funciones

### 6.1 Funciones creadas

Usuario de conexión: `nexo_inventario_owner`

```sql
SELECT p.proname AS funcion,
       p.pronargs AS parametros,
       p.pronargdefaults AS con_valor_por_defecto,
       pg_get_function_result(p.oid) AS retorna,
       l.lanname AS lenguaje,
       CASE p.provolatile WHEN 's' THEN 'STABLE' WHEN 'i' THEN 'IMMUTABLE' ELSE 'VOLATILE' END AS volatilidad
FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname;
```
```text
         funcion         | parametros | con_valor_por_defecto | retorna | lenguaje | volatilidad
-------------------------+------------+-----------------------+---------+----------+-------------
 fn_registrar_movimiento |         10 |                     5 | integer | plpgsql  | VOLATILE   
 fn_valor_inventario     |          2 |                     2 | numeric | sql      | STABLE     
(2 filas)
```

```sql
SELECT p.proname AS funcion, a.n, a.parametro, format_type(a.tipo, NULL) AS tipo
FROM pg_proc p
CROSS JOIN LATERAL unnest(p.proargnames, p.proargtypes::oid[]) WITH ORDINALITY AS a(parametro, tipo, n)
WHERE p.pronamespace = 'public'::regnamespace
ORDER BY p.proname, a.n;
```
```text
         funcion         | n  |    parametro     |           tipo          
-------------------------+----+------------------+--------------------------
 fn_registrar_movimiento |  1 | p_id_producto    | integer                 
 fn_registrar_movimiento |  2 | p_id_almacen     | integer                 
 fn_registrar_movimiento |  3 | p_id_tipo        | integer                 
 fn_registrar_movimiento |  4 | p_cantidad       | integer                 
 fn_registrar_movimiento |  5 | p_id_usuario     | integer                 
 fn_registrar_movimiento |  6 | p_costo_unitario | numeric                 
 fn_registrar_movimiento |  7 | p_id_proveedor   | integer                 
 fn_registrar_movimiento |  8 | p_referencia     | character varying       
 fn_registrar_movimiento |  9 | p_observaciones  | character varying       
 fn_registrar_movimiento | 10 | p_fecha          | timestamp with time zone
 fn_valor_inventario     |  1 | p_id_categoria   | integer                 
 fn_valor_inventario     |  2 | p_id_almacen     | integer                 
(12 filas)
```

### 6.2 fn_valor_inventario · cálculo total, por almacén y por categoría

Usuario de conexión: `usr_carlos`

```sql
SELECT 'Toda la empresa' AS alcance, fn_valor_inventario() AS valor
UNION ALL
SELECT 'Almacén: ' || nombre, fn_valor_inventario(NULL, id_almacen) FROM almacenes
UNION ALL
SELECT 'Categoría: ' || nombre, fn_valor_inventario(id_categoria) FROM categorias
ORDER BY valor DESC;
```
```text
              alcance               |   valor  
------------------------------------+-----------
 Toda la empresa                    | 893088.00
 Almacén: Almacén Central Monterrey | 650270.00
 Categoría: Cómputo                 | 348600.00
 Categoría: Periféricos             | 206760.00
 Almacén: Sucursal Guadalajara      | 140280.00
 Almacén: Sucursal Saltillo         | 102538.00
 Categoría: Impresión               |  84650.00
 Categoría: Redes                   |  83640.00
 Categoría: Papelería               |  53858.00
 Categoría: Energía                 |  44830.00
 Categoría: Almacenamiento          |  39450.00
 Categoría: Mobiliario              |  31300.00
(12 filas)
```

### 6.3 fn_registrar_movimiento · compra a proveedor (entrada)

Usuario de conexión: `usr_carlos`

```sql
SELECT existencia AS existencia_antes FROM inventario
WHERE id_producto = (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001')
  AND id_almacen  = (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey');
```
```text
 existencia_antes
------------------
                0
(1 fila)
```

```sql
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         20,
         (SELECT id_usuario FROM usuarios WHERE correo = 'sofia.villarreal@nexo.mx'),
         1150.00,
         (SELECT id_proveedor FROM proveedores WHERE rfc = 'MDM180725K91'),
         'OC-EVIDENCIA-01',
         'Evidencia 6: entrada registrada con la función') AS id_movimiento;
```
```text
 id_movimiento
---------------
           504
(1 fila)
```

```sql
SELECT folio, cantidad, costo_unitario, existencia_resultante, referencia
FROM movimientos ORDER BY id_movimiento DESC LIMIT 1;
```
```text
   folio    | cantidad | costo_unitario | existencia_resultante |   referencia   
------------+----------+----------------+-----------------------+-----------------
 MOV-000504 |       20 |        1150.00 |                    20 | OC-EVIDENCIA-01
(1 fila)
```

### 6.4 fn_registrar_movimiento · venta (salida)

Usuario de conexión: `usr_carlos`

```sql
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Venta'),
         3,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'),
         p_referencia => 'FAC-EVIDENCIA-01') AS id_movimiento;
```
```text
 id_movimiento
---------------
           505
(1 fila)
```

```sql
SELECT folio, cantidad, existencia_resultante, referencia
FROM movimientos ORDER BY id_movimiento DESC LIMIT 1;
```
```text
   folio    | cantidad | existencia_resultante |    referencia   
------------+----------+-----------------------+------------------
 MOV-000505 |        3 |                    17 | FAC-EVIDENCIA-01
(1 fila)
```

### 6.5 fn_registrar_movimiento · validaciones (deben fallar)

Usuario de conexión: `usr_carlos`

```sql
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'MOB-ARC-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Venta'),
         5,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'));
```
```text
ERROR:  Existencia insuficiente: hay 0 y se solicitan 5
SQLSTATE: P0001
-- ✔ error esperado: el permiso/validación funciona
```

```sql
SELECT fn_registrar_movimiento(
         (SELECT id_producto FROM productos WHERE sku = 'PER-DIA-001'),
         (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
         (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
         5,
         (SELECT id_usuario FROM usuarios WHERE correo = 'jorge.salinas@nexo.mx'));
```
```text
ERROR:  Este tipo de movimiento requiere indicar un proveedor
SQLSTATE: P0001
-- ✔ error esperado: el permiso/validación funciona
```

```sql
SELECT fn_registrar_movimiento(1, 1, 5, 0, 1);
```
```text
ERROR:  La cantidad debe ser mayor a cero (recibido: 0)
SQLSTATE: P0001
-- ✔ error esperado: el permiso/validación funciona
```

## Evidencia 7. Uso de vistas y funciones

### 7.1 Indicadores del dashboard (vista + función), como los consulta la aplicación

Usuario de conexión: `app_nexo`

```sql
SELECT fn_valor_inventario()                                   AS valor_total,
       COUNT(*)                                                AS productos_activos,
       SUM(existencia_total)                                   AS unidades,
       COUNT(*) FILTER (WHERE estado IN ('BAJO', 'SIN STOCK')) AS alertas
FROM vw_estado_inventario;
```
```text
 valor_total | productos_activos | unidades | alertas
-------------+-------------------+----------+---------
   912638.00 |                37 |     1276 |      10
(1 fila)
```

### 7.2 Valor por categoría: la vista contra la función (deben coincidir)

Usuario de conexión: `app_nexo`

```sql
SELECT v.categoria,
       SUM(v.valor_inventario)                AS valor_desde_vista,
       fn_valor_inventario(v.id_categoria)    AS valor_desde_funcion,
       SUM(v.valor_inventario) = fn_valor_inventario(v.id_categoria) AS coinciden
FROM vw_estado_inventario v
GROUP BY v.categoria, v.id_categoria
ORDER BY valor_desde_vista DESC;
```
```text
   categoria    | valor_desde_vista | valor_desde_funcion | coinciden
----------------+-------------------+---------------------+-----------
 Cómputo        |         348600.00 |           348600.00 | t        
 Periféricos    |         226310.00 |           226310.00 | t        
 Impresión      |          84650.00 |            84650.00 | t        
 Redes          |          83640.00 |            83640.00 | t        
 Papelería      |          53858.00 |            53858.00 | t        
 Energía        |          44830.00 |            44830.00 | t        
 Almacenamiento |          39450.00 |            39450.00 | t        
 Mobiliario     |          31300.00 |            31300.00 | t        
(8 filas)
```

### 7.3 Reabastecimiento automático: registrar compras para todo lo agotado

Usuario de conexión: `app_nexo`

```sql
SELECT v.sku, v.nombre, v.existencia_total AS antes,
       fn_registrar_movimiento(
           v.id_producto,
           (SELECT id_almacen FROM almacenes WHERE nombre = 'Almacén Central Monterrey'),
           (SELECT id_tipo FROM tipos_movimiento WHERE nombre = 'Compra a proveedor'),
           GREATEST(v.stock_minimo * 2, 1),
           (SELECT id_usuario FROM usuarios WHERE correo = 'sofia.villarreal@nexo.mx'),
           NULL,
           (SELECT pp.id_proveedor FROM producto_proveedor pp WHERE pp.id_producto = v.id_producto AND pp.es_principal),
           'OC-REABASTO-AUTO') AS id_movimiento
FROM vw_estado_inventario v
WHERE v.estado = 'SIN STOCK';
```
```text
     sku     |                 nombre                  | antes | id_movimiento
-------------+-----------------------------------------+-------+---------------
 COM-LAP-003 | MacBook Air 13" M3 8GB 256GB            |     0 |           506
 COM-LAP-002 | Laptop HP ProBook 450 G10 i5 16GB 512GB |     0 |           507
 MOB-ARC-001 | Archivero metálico 4 gavetas            |     0 |           508
(3 filas)
```

### 7.4 Estado después del reabastecimiento

Usuario de conexión: `app_nexo`

```sql
SELECT estado, COUNT(*) AS productos, SUM(valor_inventario) AS valor
FROM vw_estado_inventario
GROUP BY estado
ORDER BY productos DESC;
```
```text
 estado | productos |   valor   
--------+-----------+------------
 NORMAL |        28 | 1047925.00
 BAJO   |         7 |   41595.00
 EXCESO |         2 |   38718.00
(3 filas)
```

### 7.5 Kardex del producto reabastecido (tabla movimientos + vista)

Usuario de conexión: `app_nexo`

```sql
SELECT m.folio, t.nombre AS tipo, m.cantidad, m.existencia_resultante,
       to_char(m.fecha AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha,
       v.estado AS estado_actual
FROM movimientos m
JOIN tipos_movimiento t ON t.id_tipo = m.id_tipo
JOIN vw_estado_inventario v ON v.id_producto = m.id_producto
WHERE v.sku = 'COM-LAP-003'
ORDER BY m.id_movimiento DESC
LIMIT 6;
```
```text
   folio    |        tipo        | cantidad | existencia_resultante |      fecha       | estado_actual
------------+--------------------+----------+-----------------------+------------------+---------------
 MOV-000506 | Compra a proveedor |        4 |                     4 | 2026-09-30 14:55 | NORMAL       
 MOV-000495 | Venta              |        1 |                     0 | 2026-09-30 11:02 | NORMAL       
 MOV-000494 | Venta              |        5 |                     0 | 2026-09-30 10:55 | NORMAL       
 MOV-000471 | Compra a proveedor |        5 |                     5 | 2026-09-28 00:18 | NORMAL       
 MOV-000437 | Venta              |        1 |                     0 | 2026-09-21 23:18 | NORMAL       
 MOV-000421 | Merma / daño       |        1 |                     1 | 2026-09-19 20:59 | NORMAL       
(6 filas)
```
