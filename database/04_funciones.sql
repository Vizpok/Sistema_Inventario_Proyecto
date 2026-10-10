-- =====================================================================
-- Script 04 · Funciones
--   1) fn_valor_inventario      → función de CÁLCULO
--   2) fn_registrar_movimiento  → función de INSERCIÓN
-- Ejecutar como: propietario de la BD (nexo_inventario_owner)
-- =====================================================================

-- ---------------------------------------------------------------------
-- Función 1 (cálculo) · fn_valor_inventario
-- Calcula el valor monetario del inventario (existencia × precio de
-- compra). Ambos filtros son opcionales: NULL = todos.
--   SELECT fn_valor_inventario();            -- toda la empresa
--   SELECT fn_valor_inventario(NULL, 2);     -- sólo el almacén 2
--   SELECT fn_valor_inventario(3);           -- sólo la categoría 3
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_valor_inventario(
    p_id_categoria INTEGER DEFAULT NULL,
    p_id_almacen   INTEGER DEFAULT NULL
)
RETURNS NUMERIC(14,2)
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(SUM(i.existencia * p.precio_compra), 0)::NUMERIC(14,2)
    FROM inventario i
    JOIN productos  p ON p.id_producto = i.id_producto
    WHERE p.activo
      AND (p_id_categoria IS NULL OR p.id_categoria = p_id_categoria)
      AND (p_id_almacen   IS NULL OR i.id_almacen   = p_id_almacen);
$$;

COMMENT ON FUNCTION fn_valor_inventario(INTEGER, INTEGER) IS
    'Cálculo: valor del inventario (existencia × precio de compra), filtrable por categoría y almacén';

-- ---------------------------------------------------------------------
-- Función 2 (inserción) · fn_registrar_movimiento
-- Registra una entrada o salida de mercancía de forma atómica:
--   1. Valida cantidad, tipo, proveedor, producto y almacén.
--   2. Bloquea la fila de inventario (FOR UPDATE) para evitar carreras.
--   3. En salidas verifica que haya existencia suficiente.
--   4. INSERTA el movimiento (kardex) con la existencia resultante.
--   5. Actualiza (o crea) la existencia en la tabla inventario.
-- Devuelve el id del movimiento creado. Si algo falla, no se guarda nada.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_registrar_movimiento(
    p_id_producto    INTEGER,
    p_id_almacen     INTEGER,
    p_id_tipo        INTEGER,
    p_cantidad       INTEGER,
    p_id_usuario     INTEGER,
    p_costo_unitario NUMERIC     DEFAULT NULL,
    p_id_proveedor   INTEGER     DEFAULT NULL,
    p_referencia     VARCHAR     DEFAULT NULL,
    p_observaciones  VARCHAR     DEFAULT NULL,
    p_fecha          TIMESTAMPTZ DEFAULT now()
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_naturaleza   VARCHAR(7);
    v_req_prov     BOOLEAN;
    v_precio       NUMERIC(12,2);
    v_existencia   INTEGER;
    v_nueva        INTEGER;
    v_id           INTEGER;
BEGIN
    IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
        RAISE EXCEPTION 'La cantidad debe ser mayor a cero (recibido: %)', p_cantidad;
    END IF;

    SELECT naturaleza, requiere_proveedor INTO v_naturaleza, v_req_prov
    FROM tipos_movimiento WHERE id_tipo = p_id_tipo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El tipo de movimiento % no existe', p_id_tipo;
    END IF;
    IF v_req_prov AND p_id_proveedor IS NULL THEN
        RAISE EXCEPTION 'Este tipo de movimiento requiere indicar un proveedor';
    END IF;

    SELECT precio_compra INTO v_precio
    FROM productos WHERE id_producto = p_id_producto AND activo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no existe o está inactivo', p_id_producto;
    END IF;

    PERFORM 1 FROM almacenes WHERE id_almacen = p_id_almacen AND activo;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'El almacén % no existe o está inactivo', p_id_almacen;
    END IF;

    -- Garantiza que exista la fila de inventario y la bloquea
    INSERT INTO inventario (id_producto, id_almacen, existencia)
    VALUES (p_id_producto, p_id_almacen, 0)
    ON CONFLICT (id_producto, id_almacen) DO NOTHING;

    SELECT existencia INTO v_existencia
    FROM inventario
    WHERE id_producto = p_id_producto AND id_almacen = p_id_almacen
    FOR UPDATE;

    IF v_naturaleza = 'ENTRADA' THEN
        v_nueva := v_existencia + p_cantidad;
    ELSE
        IF v_existencia < p_cantidad THEN
            RAISE EXCEPTION 'Existencia insuficiente: hay % y se solicitan %', v_existencia, p_cantidad;
        END IF;
        v_nueva := v_existencia - p_cantidad;
    END IF;

    INSERT INTO movimientos (id_tipo, id_producto, id_almacen, id_proveedor, id_usuario,
                             cantidad, costo_unitario, existencia_resultante,
                             referencia, observaciones, fecha)
    VALUES (p_id_tipo, p_id_producto, p_id_almacen, p_id_proveedor, p_id_usuario,
            p_cantidad, COALESCE(p_costo_unitario, v_precio), v_nueva,
            NULLIF(trim(p_referencia), ''), NULLIF(trim(p_observaciones), ''), p_fecha)
    RETURNING id_movimiento INTO v_id;

    UPDATE inventario
    SET existencia = v_nueva, actualizado_en = now()
    WHERE id_producto = p_id_producto AND id_almacen = p_id_almacen;

    RETURN v_id;
END;
$$;

COMMENT ON FUNCTION fn_registrar_movimiento(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER,
                                            NUMERIC, INTEGER, VARCHAR, VARCHAR, TIMESTAMPTZ) IS
    'Inserción: registra una entrada/salida validando existencias y actualiza el inventario';
