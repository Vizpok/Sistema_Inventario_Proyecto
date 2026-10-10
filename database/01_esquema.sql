-- =====================================================================
-- Proyecto Unidad 1 · Bases de Datos Relacionales
-- Sistema de Inventario "Nexo" — Distribuidora Nexo S.A. de C.V. (ficticia)
--
-- Script 01 · Esquema: tablas, llaves primarias, llaves foráneas,
--             restricciones CHECK / UNIQUE e índices.
-- Motor: PostgreSQL 18 (Neon) · Base de datos: nexo_inventario
-- Ejecutar como: propietario de la BD (nexo_inventario_owner)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. usuarios: personas que usan el sistema web (rol de aplicación)
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
    id_usuario      INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          VARCHAR(80)  NOT NULL,
    apellidos       VARCHAR(100) NOT NULL,
    correo          VARCHAR(120) NOT NULL UNIQUE,
    password_hash   VARCHAR(100) NOT NULL,
    rol             VARCHAR(10)  NOT NULL DEFAULT 'usuario'
                    CONSTRAINT ck_usuarios_rol CHECK (rol IN ('admin', 'usuario')),
    puesto          VARCHAR(80),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_acceso   TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 2. categorias: clasificación de los productos del catálogo
-- ---------------------------------------------------------------------
CREATE TABLE categorias (
    id_categoria    SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          VARCHAR(60)  NOT NULL UNIQUE,
    descripcion     VARCHAR(255),
    color           CHAR(7)      NOT NULL DEFAULT '#4F46E5'
                    CONSTRAINT ck_categorias_color CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. proveedores: empresas que surten mercancía
-- ---------------------------------------------------------------------
CREATE TABLE proveedores (
    id_proveedor    INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    razon_social    VARCHAR(150) NOT NULL,
    rfc             VARCHAR(13)  NOT NULL UNIQUE
                    CONSTRAINT ck_proveedores_rfc CHECK (char_length(rfc) IN (12, 13)),
    contacto        VARCHAR(100),
    telefono        VARCHAR(20),
    correo          VARCHAR(120),
    ciudad          VARCHAR(80),
    direccion       VARCHAR(200),
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 4. almacenes: ubicaciones físicas donde se guarda la mercancía
--    (1:N usuarios -> almacenes como responsable)
-- ---------------------------------------------------------------------
CREATE TABLE almacenes (
    id_almacen      SMALLINT     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre          VARCHAR(80)  NOT NULL UNIQUE,
    ubicacion       VARCHAR(200),
    id_responsable  INTEGER
                    CONSTRAINT fk_almacenes_responsable REFERENCES usuarios (id_usuario)
                    ON UPDATE CASCADE ON DELETE SET NULL,
    activo          BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ---------------------------------------------------------------------
-- 5. tipos_movimiento: catálogo de motivos (compra, venta, merma, ...)
-- ---------------------------------------------------------------------
CREATE TABLE tipos_movimiento (
    id_tipo             SMALLINT    GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre              VARCHAR(40) NOT NULL UNIQUE,
    naturaleza          VARCHAR(7)  NOT NULL
                        CONSTRAINT ck_tipos_naturaleza CHECK (naturaleza IN ('ENTRADA', 'SALIDA')),
    requiere_proveedor  BOOLEAN     NOT NULL DEFAULT FALSE,
    descripcion         VARCHAR(255)
);

-- ---------------------------------------------------------------------
-- 6. productos: catálogo de artículos (1:N categorias -> productos)
-- ---------------------------------------------------------------------
CREATE TABLE productos (
    id_producto     INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sku             VARCHAR(20)   NOT NULL UNIQUE,
    nombre          VARCHAR(150)  NOT NULL,
    descripcion     TEXT,
    id_categoria    SMALLINT      NOT NULL
                    CONSTRAINT fk_productos_categoria REFERENCES categorias (id_categoria)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    unidad          VARCHAR(20)   NOT NULL DEFAULT 'pieza',
    precio_compra   NUMERIC(12,2) NOT NULL CONSTRAINT ck_productos_pcompra CHECK (precio_compra >= 0),
    precio_venta    NUMERIC(12,2) NOT NULL CONSTRAINT ck_productos_pventa  CHECK (precio_venta  >= 0),
    stock_minimo    INTEGER       NOT NULL DEFAULT 0 CONSTRAINT ck_productos_smin CHECK (stock_minimo >= 0),
    stock_maximo    INTEGER       NOT NULL DEFAULT 0 CONSTRAINT ck_productos_smax CHECK (stock_maximo >= 0),
    activo          BOOLEAN       NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ   NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT ck_productos_rango_stock CHECK (stock_maximo = 0 OR stock_maximo >= stock_minimo)
);

-- ---------------------------------------------------------------------
-- 7. producto_proveedor: relación N:M productos <-> proveedores
-- ---------------------------------------------------------------------
CREATE TABLE producto_proveedor (
    id_producto     INTEGER       NOT NULL
                    CONSTRAINT fk_pp_producto REFERENCES productos (id_producto)
                    ON UPDATE CASCADE ON DELETE CASCADE,
    id_proveedor    INTEGER       NOT NULL
                    CONSTRAINT fk_pp_proveedor REFERENCES proveedores (id_proveedor)
                    ON UPDATE CASCADE ON DELETE CASCADE,
    costo           NUMERIC(12,2) NOT NULL CONSTRAINT ck_pp_costo CHECK (costo >= 0),
    dias_entrega    SMALLINT      NOT NULL DEFAULT 3 CONSTRAINT ck_pp_dias CHECK (dias_entrega >= 0),
    es_principal    BOOLEAN       NOT NULL DEFAULT FALSE,
    CONSTRAINT pk_producto_proveedor PRIMARY KEY (id_producto, id_proveedor)
);
-- Un producto sólo puede tener un proveedor principal
CREATE UNIQUE INDEX ux_pp_un_principal ON producto_proveedor (id_producto) WHERE es_principal;

-- ---------------------------------------------------------------------
-- 8. inventario: existencias por producto y almacén
--    (relación N:M productos <-> almacenes con atributos propios)
-- ---------------------------------------------------------------------
CREATE TABLE inventario (
    id_producto     INTEGER      NOT NULL
                    CONSTRAINT fk_inventario_producto REFERENCES productos (id_producto)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    id_almacen      SMALLINT     NOT NULL
                    CONSTRAINT fk_inventario_almacen REFERENCES almacenes (id_almacen)
                    ON UPDATE CASCADE ON DELETE RESTRICT,
    existencia      INTEGER      NOT NULL DEFAULT 0
                    CONSTRAINT ck_inventario_existencia CHECK (existencia >= 0),
    ubicacion       VARCHAR(30),
    actualizado_en  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT pk_inventario PRIMARY KEY (id_producto, id_almacen)
);

-- ---------------------------------------------------------------------
-- 9. movimientos: registro (kardex) de entradas y salidas
--    1:N con tipos_movimiento, productos, almacenes, proveedores y usuarios
-- ---------------------------------------------------------------------
CREATE TABLE movimientos (
    id_movimiento         INTEGER       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio                 VARCHAR(12)   GENERATED ALWAYS AS ('MOV-' || lpad(id_movimiento::text, 6, '0')) STORED,
    id_tipo               SMALLINT      NOT NULL
                          CONSTRAINT fk_mov_tipo REFERENCES tipos_movimiento (id_tipo),
    id_producto           INTEGER       NOT NULL
                          CONSTRAINT fk_mov_producto REFERENCES productos (id_producto),
    id_almacen            SMALLINT      NOT NULL
                          CONSTRAINT fk_mov_almacen REFERENCES almacenes (id_almacen),
    id_proveedor          INTEGER
                          CONSTRAINT fk_mov_proveedor REFERENCES proveedores (id_proveedor),
    id_usuario            INTEGER       NOT NULL
                          CONSTRAINT fk_mov_usuario REFERENCES usuarios (id_usuario),
    cantidad              INTEGER       NOT NULL CONSTRAINT ck_mov_cantidad CHECK (cantidad > 0),
    costo_unitario        NUMERIC(12,2) NOT NULL DEFAULT 0 CONSTRAINT ck_mov_costo CHECK (costo_unitario >= 0),
    existencia_resultante INTEGER       NOT NULL CONSTRAINT ck_mov_resultante CHECK (existencia_resultante >= 0),
    referencia            VARCHAR(60),
    observaciones         VARCHAR(255),
    fecha                 TIMESTAMPTZ   NOT NULL DEFAULT now(),
    CONSTRAINT uq_movimientos_folio UNIQUE (folio)
);

-- ---------------------------------------------------------------------
-- 10. bitacora: auditoría de acciones realizadas en el sistema
-- ---------------------------------------------------------------------
CREATE TABLE bitacora (
    id_bitacora     BIGINT       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_usuario      INTEGER
                    CONSTRAINT fk_bitacora_usuario REFERENCES usuarios (id_usuario)
                    ON UPDATE CASCADE ON DELETE SET NULL,
    accion          VARCHAR(30)  NOT NULL,
    modulo          VARCHAR(30)  NOT NULL,
    descripcion     VARCHAR(255),
    fecha           TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- Índices de apoyo para llaves foráneas y consultas frecuentes
-- ---------------------------------------------------------------------
CREATE INDEX ix_productos_categoria   ON productos (id_categoria);
CREATE INDEX ix_pp_proveedor          ON producto_proveedor (id_proveedor);
CREATE INDEX ix_inventario_almacen    ON inventario (id_almacen);
CREATE INDEX ix_movimientos_fecha     ON movimientos (fecha DESC);
CREATE INDEX ix_movimientos_producto  ON movimientos (id_producto, fecha DESC);
CREATE INDEX ix_movimientos_usuario   ON movimientos (id_usuario);
CREATE INDEX ix_movimientos_tipo      ON movimientos (id_tipo);
CREATE INDEX ix_bitacora_fecha        ON bitacora (fecha DESC);

COMMENT ON TABLE usuarios           IS 'Usuarios del sistema web (rol de aplicación admin/usuario)';
COMMENT ON TABLE categorias         IS 'Categorías del catálogo de productos';
COMMENT ON TABLE proveedores        IS 'Proveedores de mercancía';
COMMENT ON TABLE almacenes          IS 'Almacenes / sucursales físicas';
COMMENT ON TABLE tipos_movimiento   IS 'Motivos de entrada y salida de mercancía';
COMMENT ON TABLE productos          IS 'Catálogo de productos';
COMMENT ON TABLE producto_proveedor IS 'Relación N:M producto-proveedor con costo y tiempo de entrega';
COMMENT ON TABLE inventario         IS 'Existencias por producto y almacén (N:M)';
COMMENT ON TABLE movimientos        IS 'Kardex: historial de entradas y salidas';
COMMENT ON TABLE bitacora           IS 'Auditoría de acciones de los usuarios';
