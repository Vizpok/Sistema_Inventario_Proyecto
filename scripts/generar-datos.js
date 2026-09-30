#!/usr/bin/env node
/**
 * Genera database/05_datos_prueba.sql con datos ficticios de
 * Distribuidora Nexo S.A. de C.V.
 *
 * Los ~60 días de historial se registran llamando a la función
 * fn_registrar_movimiento(), así el inventario queda consistente con el
 * kardex. Las fechas son relativas a now(): al cargar el script el
 * dashboard siempre muestra actividad reciente.
 *
 * Uso: npm run db:datos   (sólo regenera el archivo .sql; no toca la BD)
 */
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// PRNG determinista para que el archivo generado sea reproducible
let semilla = 20260930;
function rnd() {
  semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const elegir = (arr) => arr[Math.floor(rnd() * arr.length)];
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

// ---------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------
const usuarios = [
  // nombre, apellidos, correo, rol, puesto, contraseña
  ['Mariana', 'Treviño Garza', 'admin@nexo.mx', 'admin', 'Gerente de Operaciones', 'Admin2026!'],
  ['Jorge', 'Salinas Pérez', 'jorge.salinas@nexo.mx', 'usuario', 'Jefe de Almacén Central', 'Nexo2026!'],
  ['Daniela', 'Cantú Ríos', 'daniela.cantu@nexo.mx', 'usuario', 'Almacenista Saltillo', 'Nexo2026!'],
  ['Ricardo', 'Hernández Luna', 'ricardo.hernandez@nexo.mx', 'usuario', 'Almacenista Guadalajara', 'Nexo2026!'],
  ['Sofía', 'Villarreal Ortiz', 'sofia.villarreal@nexo.mx', 'usuario', 'Auxiliar de Compras', 'Nexo2026!'],
];

const categorias = [
  ['Cómputo', 'Laptops, equipos de escritorio y tabletas', '#4F46E5'],
  ['Periféricos', 'Teclados, ratones, monitores y accesorios', '#0EA5E9'],
  ['Redes', 'Equipo de conectividad y cableado estructurado', '#10B981'],
  ['Almacenamiento', 'Discos, memorias y unidades externas', '#F59E0B'],
  ['Impresión', 'Impresoras, tóner y consumibles', '#EF4444'],
  ['Papelería', 'Artículos de oficina y consumibles de papel', '#8B5CF6'],
  ['Mobiliario', 'Sillas, escritorios y archiveros', '#EC4899'],
  ['Energía', 'No-breaks, reguladores y multicontactos', '#64748B'],
];

const proveedores = [
  // razón social, RFC, contacto, teléfono, correo, ciudad, dirección
  ['Tecnología Integral del Norte S.A. de C.V.', 'TIN150312AB4', 'Luis Garza', '81 8340 1122', 'ventas@tinorte.mx', 'Monterrey', 'Av. Constitución 1450, Centro'],
  ['Mayoreo Digital de México S.A. de C.V.', 'MDM180725K91', 'Paola Méndez', '55 5520 7788', 'pedidos@mayoreodigital.mx', 'Ciudad de México', 'Insurgentes Sur 2100, Coyoacán'],
  ['Conectividad Total S. de R.L. de C.V.', 'CTO190904QX2', 'Arturo Reyes', '33 3615 4400', 'contacto@conectotal.mx', 'Guadalajara', 'Av. Vallarta 3050, Vallarta Poniente'],
  ['Suministros de Oficina Regio S.A. de C.V.', 'SOR120118HT7', 'Claudia Leal', '81 8123 9090', 'ventas@soregio.mx', 'San Nicolás de los Garza', 'Av. Universidad 870'],
  ['Impresión y Consumibles del Bajío S.A. de C.V.', 'ICB170630LM5', 'Héctor Aguilar', '477 712 3344', 'atencion@icbajio.mx', 'León', 'Blvd. López Mateos 1802'],
  ['Mobiliario Ejecutivo Moderno S.A. de C.V.', 'MEM140221RS3', 'Gabriela Soto', '81 8356 2200', 'proyectos@memoderno.mx', 'Apodaca', 'Parque Industrial Kalos, Nave 12'],
  ['Energía Confiable S.A. de C.V.', 'ECO200515PZ8', 'Fernando Ibarra', '844 415 6677', 'ventas@energiaconfiable.mx', 'Saltillo', 'Blvd. Venustiano Carranza 4120'],
  ['Distribuidora Global de Cómputo S.A. de C.V.', 'DGC110809JW6', 'Iván Castillo', '55 5089 3300', 'mayoreo@dgcomputo.mx', 'Ciudad de México', 'Av. Río Churubusco 601'],
];

const almacenes = [
  ['Almacén Central Monterrey', 'Av. Ruiz Cortines 2500, Monterrey, N.L.', 'jorge.salinas@nexo.mx'],
  ['Sucursal Saltillo', 'Blvd. Nazario Ortiz 1400, Saltillo, Coah.', 'daniela.cantu@nexo.mx'],
  ['Sucursal Guadalajara', 'Av. López Mateos Sur 5100, Zapopan, Jal.', 'ricardo.hernandez@nexo.mx'],
];

const tipos = [
  // nombre, naturaleza, requiere proveedor, descripción
  ['Inventario inicial', 'ENTRADA', false, 'Carga inicial de existencias'],
  ['Compra a proveedor', 'ENTRADA', true, 'Recepción de mercancía comprada'],
  ['Devolución de cliente', 'ENTRADA', false, 'Mercancía devuelta por un cliente'],
  ['Ajuste positivo', 'ENTRADA', false, 'Corrección por conteo físico (sobrante)'],
  ['Venta', 'SALIDA', false, 'Salida por venta a cliente'],
  ['Devolución a proveedor', 'SALIDA', true, 'Mercancía regresada al proveedor'],
  ['Merma / daño', 'SALIDA', false, 'Producto dañado, caducado o extraviado'],
  ['Ajuste negativo', 'SALIDA', false, 'Corrección por conteo físico (faltante)'],
  ['Consumo interno', 'SALIDA', false, 'Uso de la propia empresa'],
];

// sku, nombre, categoría, unidad, compra, venta, mínimo, máximo, proveedores (rfc; el 1.º es principal), descripción
const productos = [
  ['COM-LAP-001', 'Laptop Lenovo IdeaPad 5 14" Ryzen 7 16GB 512GB', 'Cómputo', 'pieza', 13200, 16499, 5, 25, ['DGC110809JW6', 'MDM180725K91'], 'Laptop ultradelgada para oficina y estudiantes'],
  ['COM-LAP-002', 'Laptop HP ProBook 450 G10 i5 16GB 512GB', 'Cómputo', 'pieza', 15800, 19999, 4, 20, ['MDM180725K91', 'TIN150312AB4'], 'Equipo empresarial con lector de huella'],
  ['COM-LAP-003', 'MacBook Air 13" M3 8GB 256GB', 'Cómputo', 'pieza', 19500, 23999, 2, 10, ['DGC110809JW6'], 'Chip Apple M3, pantalla Liquid Retina'],
  ['COM-DES-001', 'Desktop Dell OptiPlex 7010 i5 16GB 512GB', 'Cómputo', 'pieza', 12100, 15299, 3, 15, ['TIN150312AB4', 'DGC110809JW6'], 'Formato torre compacta para oficina'],
  ['COM-TAB-001', 'Tablet Samsung Galaxy Tab A9+ 11" 128GB', 'Cómputo', 'pieza', 3900, 5199, 6, 30, ['MDM180725K91'], 'Tablet para punto de venta y consulta'],
  ['PER-MON-001', 'Monitor LG 24" IPS Full HD 75Hz', 'Periféricos', 'pieza', 2150, 2899, 8, 40, ['DGC110809JW6', 'MDM180725K91'], 'Monitor con bordes delgados y modo lectura'],
  ['PER-MON-002', 'Monitor Samsung 27" Curvo QHD', 'Periféricos', 'pieza', 4300, 5699, 4, 20, ['MDM180725K91'], 'Curvatura 1800R, 75Hz'],
  ['PER-TEC-001', 'Teclado Logitech K120 USB español', 'Periféricos', 'pieza', 165, 259, 30, 150, ['TIN150312AB4', 'SOR120118HT7'], 'Teclado alámbrico resistente a salpicaduras'],
  ['PER-TEC-002', 'Teclado mecánico Redragon Kumara K552', 'Periféricos', 'pieza', 690, 999, 10, 50, ['TIN150312AB4'], 'Switches rojos, retroiluminado'],
  ['PER-MOU-001', 'Mouse inalámbrico Logitech M170', 'Periféricos', 'pieza', 170, 279, 30, 150, ['TIN150312AB4', 'SOR120118HT7'], 'Receptor nano USB, 12 meses de batería'],
  ['PER-MOU-002', 'Mouse ergonómico vertical Logitech Lift', 'Periféricos', 'pieza', 980, 1349, 6, 30, ['TIN150312AB4'], 'Diseño vertical para reducir tensión'],
  ['PER-DIA-001', 'Diadema Jabra Evolve2 30 USB-C', 'Periféricos', 'pieza', 1150, 1599, 10, 40, ['MDM180725K91'], 'Diadema para call center con cancelación de ruido'],
  ['PER-CAM-001', 'Cámara web Logitech C920 Full HD', 'Periféricos', 'pieza', 1080, 1499, 8, 35, ['TIN150312AB4', 'MDM180725K91'], 'Videollamadas 1080p con micrófono estéreo'],
  ['RED-ROU-001', 'Router TP-Link Archer AX55 Wi-Fi 6', 'Redes', 'pieza', 1350, 1899, 6, 30, ['CTO190904QX2'], 'Doble banda AX3000'],
  ['RED-SW-001', 'Switch TP-Link 24 puertos Gigabit', 'Redes', 'pieza', 2250, 3099, 3, 15, ['CTO190904QX2', 'TIN150312AB4'], 'Switch no administrable para rack'],
  ['RED-AP-001', 'Access Point Ubiquiti UniFi U6 Lite', 'Redes', 'pieza', 2450, 3299, 4, 20, ['CTO190904QX2'], 'Wi-Fi 6 para techo, PoE'],
  ['RED-CAB-001', 'Bobina cable UTP Cat6 305 m', 'Redes', 'bobina', 2100, 2890, 4, 20, ['CTO190904QX2'], 'Cable sólido 23 AWG para interiores'],
  ['RED-PAT-001', 'Patch cord Cat6 2 m', 'Redes', 'pieza', 38, 69, 60, 300, ['CTO190904QX2', 'TIN150312AB4'], 'Cable de parcheo moldeado'],
  ['ALM-SSD-001', 'SSD Kingston NV2 1TB NVMe', 'Almacenamiento', 'pieza', 950, 1349, 12, 60, ['DGC110809JW6', 'TIN150312AB4'], 'Lectura hasta 3500 MB/s'],
  ['ALM-SSD-002', 'SSD Crucial BX500 480GB SATA', 'Almacenamiento', 'pieza', 520, 749, 12, 60, ['DGC110809JW6'], 'Actualización para equipos antiguos'],
  ['ALM-USB-001', 'Memoria USB Kingston 64GB 3.2', 'Almacenamiento', 'pieza', 95, 159, 40, 200, ['TIN150312AB4', 'SOR120118HT7'], 'Memoria compacta con llavero'],
  ['ALM-HDD-001', 'Disco externo Seagate 2TB USB 3.0', 'Almacenamiento', 'pieza', 1250, 1699, 8, 35, ['DGC110809JW6'], 'Respaldo portátil'],
  ['IMP-LAS-001', 'Impresora HP LaserJet Pro M404dn', 'Impresión', 'pieza', 5600, 7299, 2, 10, ['ICB170630LM5', 'MDM180725K91'], 'Monocromática dúplex con red'],
  ['IMP-MUL-001', 'Multifuncional Epson EcoTank L3250', 'Impresión', 'pieza', 3350, 4399, 4, 20, ['ICB170630LM5'], 'Tanque de tinta con Wi-Fi'],
  ['IMP-TON-001', 'Tóner HP 58A negro', 'Impresión', 'pieza', 1650, 2190, 10, 50, ['ICB170630LM5'], 'Rendimiento de 3,000 páginas'],
  ['IMP-TIN-001', 'Botella de tinta Epson T544 negra', 'Impresión', 'pieza', 165, 239, 30, 120, ['ICB170630LM5', 'SOR120118HT7'], 'Tinta original 65 ml'],
  ['PAP-HOJ-001', 'Papel bond carta 75 g (caja 5,000 hojas)', 'Papelería', 'caja', 520, 699, 25, 120, ['SOR120118HT7'], 'Blancura 97%'],
  ['PAP-FOL-001', 'Folder tamaño carta color crema (100 pzas)', 'Papelería', 'paquete', 105, 159, 20, 100, ['SOR120118HT7'], 'Folder con pestaña'],
  ['PAP-BOL-001', 'Bolígrafo BIC Cristal azul (caja 12)', 'Papelería', 'caja', 48, 79, 40, 200, ['SOR120118HT7'], 'Punto mediano 1.0 mm'],
  ['PAP-NOT-001', 'Notas adhesivas Post-it 3x3 (12 blocks)', 'Papelería', 'paquete', 145, 219, 20, 100, ['SOR120118HT7'], 'Colores neón'],
  ['PAP-ENG-001', 'Engrapadora Pilot metálica', 'Papelería', 'pieza', 115, 179, 15, 60, ['SOR120118HT7'], 'Capacidad 25 hojas'],
  ['MOB-SIL-001', 'Silla ejecutiva ergonómica malla', 'Mobiliario', 'pieza', 2350, 3499, 4, 20, ['MEM140221RS3'], 'Soporte lumbar y brazos ajustables'],
  ['MOB-ESC-001', 'Escritorio en L 150 cm', 'Mobiliario', 'pieza', 3100, 4499, 2, 10, ['MEM140221RS3'], 'Cubierta melamina, estructura metálica'],
  ['MOB-ARC-001', 'Archivero metálico 4 gavetas', 'Mobiliario', 'pieza', 2800, 3899, 2, 8, ['MEM140221RS3'], 'Tamaño oficio con chapa'],
  ['ENE-NOB-001', 'No-break APC Back-UPS 1500VA', 'Energía', 'pieza', 3150, 4199, 4, 20, ['ECO200515PZ8', 'TIN150312AB4'], 'Respaldo para estaciones de trabajo'],
  ['ENE-REG-001', 'Regulador Koblenz 1300VA 8 contactos', 'Energía', 'pieza', 520, 749, 10, 50, ['ECO200515PZ8'], 'Protección contra variaciones de voltaje'],
  ['ENE-MUL-001', 'Multicontacto con supresor 6 salidas', 'Energía', 'pieza', 210, 329, 20, 100, ['ECO200515PZ8', 'SOR120118HT7'], 'Cable de 1.8 m'],
];

// ---------------------------------------------------------------------
// Generación del script
// ---------------------------------------------------------------------
const out = [];
const w = (s = '') => out.push(s);

w('-- =====================================================================');
w('-- Script 05 · Datos de prueba (Distribuidora Nexo S.A. de C.V. — ficticia)');
w('-- ARCHIVO GENERADO por scripts/generar-datos.js — no editar a mano.');
w('-- Ejecutar como: propietario de la BD, después de los scripts 01 a 04.');
w('-- Usuarios de la aplicación web:');
w('--   admin@nexo.mx / Admin2026!        (rol admin)');
w('--   jorge.salinas@nexo.mx / Nexo2026!  (rol usuario; igual para los demás)');
w('-- =====================================================================');
w();

w('-- Usuarios de la aplicación (contraseñas con hash bcrypt)');
w('INSERT INTO usuarios (nombre, apellidos, correo, password_hash, rol, puesto) VALUES');
w(usuarios.map(([n, a, c, r, p, pwd]) =>
  `    (${q(n)}, ${q(a)}, ${q(c)}, ${q(bcrypt.hashSync(pwd, 10))}, ${q(r)}, ${q(p)})`).join(',\n') + ';');
w();

w('INSERT INTO categorias (nombre, descripcion, color) VALUES');
w(categorias.map(([n, d, c]) => `    (${q(n)}, ${q(d)}, ${q(c)})`).join(',\n') + ';');
w();

w('INSERT INTO proveedores (razon_social, rfc, contacto, telefono, correo, ciudad, direccion) VALUES');
w(proveedores.map((p) => `    (${p.map(q).join(', ')})`).join(',\n') + ';');
w();

w('INSERT INTO almacenes (nombre, ubicacion, id_responsable)');
w('SELECT v.nombre, v.ubicacion, u.id_usuario');
w('FROM (VALUES');
w(almacenes.map(([n, ub, c]) => `    (${q(n)}, ${q(ub)}, ${q(c)})`).join(',\n'));
w(') AS v(nombre, ubicacion, correo)');
w('JOIN usuarios u ON u.correo = v.correo;');
w();

w('INSERT INTO tipos_movimiento (nombre, naturaleza, requiere_proveedor, descripcion) VALUES');
w(tipos.map(([n, nat, r, d]) => `    (${q(n)}, ${q(nat)}, ${r}, ${q(d)})`).join(',\n') + ';');
w();

w('INSERT INTO productos (sku, nombre, descripcion, id_categoria, unidad, precio_compra, precio_venta, stock_minimo, stock_maximo)');
w('SELECT v.sku, v.nombre, v.descripcion, c.id_categoria, v.unidad, v.pc, v.pv, v.smin, v.smax');
w('FROM (VALUES');
w(productos.map(([sku, n, cat, u, pc, pv, mn, mx, , d]) =>
  `    (${q(sku)}, ${q(n)}, ${q(d)}, ${q(cat)}, ${q(u)}, ${pc.toFixed(2)}, ${pv.toFixed(2)}, ${mn}, ${mx})`).join(',\n'));
w(') AS v(sku, nombre, descripcion, categoria, unidad, pc, pv, smin, smax)');
w('JOIN categorias c ON c.nombre = v.categoria;');
w();

// Relación N:M producto-proveedor
const ppFilas = [];
for (const [sku, , , , pc, , , , provs] of productos) {
  provs.forEach((rfc, i) => {
    const costo = i === 0 ? pc : Math.round(pc * (1 + entre(2, 9) / 100));
    ppFilas.push(`    (${q(sku)}, ${q(rfc)}, ${costo.toFixed(2)}, ${entre(1, i === 0 ? 4 : 10)}, ${i === 0})`);
  });
}
w('INSERT INTO producto_proveedor (id_producto, id_proveedor, costo, dias_entrega, es_principal)');
w('SELECT p.id_producto, pr.id_proveedor, v.costo, v.dias, v.principal');
w('FROM (VALUES');
w(ppFilas.join(',\n'));
w(') AS v(sku, rfc, costo, dias, principal)');
w('JOIN productos p    ON p.sku  = v.sku');
w('JOIN proveedores pr ON pr.rfc = v.rfc;');
w();

// Ubicaciones físicas dentro del almacén central
w('-- Historial de movimientos: cada renglón usa la función de inserción');
w('-- fn_registrar_movimiento(producto, almacén, tipo, cantidad, usuario, costo, proveedor, referencia, observaciones, fecha)');

const stock = new Map(); // `${sku}|${almacen}` -> existencia
const k = (sku, alm) => `${sku}|${alm}`;
const get = (sku, alm) => stock.get(k(sku, alm)) || 0;
const usuariosPorAlmacen = {
  'Almacén Central Monterrey': ['jorge.salinas@nexo.mx', 'sofia.villarreal@nexo.mx', 'admin@nexo.mx'],
  'Sucursal Saltillo': ['daniela.cantu@nexo.mx'],
  'Sucursal Guadalajara': ['ricardo.hernandez@nexo.mx'],
};
const almNombres = almacenes.map((a) => a[0]);
let totalMov = 0;
let folioFactura = 18230;
let folioVenta = 50112;

function mov(minutosAtras, sku, alm, tipo, cantidad, correo, { costo = null, rfc = null, ref = null, obs = null } = {}) {
  const t = tipos.find((x) => x[0] === tipo);
  const delta = t[1] === 'ENTRADA' ? cantidad : -cantidad;
  stock.set(k(sku, alm), get(sku, alm) + delta);
  totalMov++;
  const dias = Math.floor(minutosAtras / 1440);
  const mins = minutosAtras % 1440;
  w('SELECT fn_registrar_movimiento(' + [
    `(SELECT id_producto FROM productos WHERE sku = ${q(sku)})`,
    `(SELECT id_almacen FROM almacenes WHERE nombre = ${q(alm)})`,
    `(SELECT id_tipo FROM tipos_movimiento WHERE nombre = ${q(tipo)})`,
    cantidad,
    `(SELECT id_usuario FROM usuarios WHERE correo = ${q(correo)})`,
    costo === null ? 'NULL' : costo.toFixed(2),
    rfc ? `(SELECT id_proveedor FROM proveedores WHERE rfc = ${q(rfc)})` : 'NULL',
    q(ref), q(obs),
    `now() - INTERVAL '${dias} days ${mins} minutes'`,
  ].join(', ') + ');');
}

// 1) Inventario inicial hace 60 días
let minutos = 60 * 1440 + 600;
for (const [sku, , , , pc, , mn, mx] of productos) {
  for (const alm of almNombres) {
    const esCentral = alm === almNombres[0];
    if (!esCentral && rnd() < 0.35) continue;
    const cant = esCentral ? entre(Math.max(mn + 1, 2), Math.max(Math.floor(mx * 0.6), mn + 2)) : entre(1, Math.max(2, Math.floor(mx / 6)));
    mov(minutos, sku, alm, 'Inventario inicial', cant, usuariosPorAlmacen[alm][0], { costo: pc, ref: 'CONTEO-INICIAL', obs: 'Carga inicial al implementar el sistema' });
    minutos -= entre(1, 3);
  }
}

// 2) Operación diaria durante ~60 días
const productosPorSku = Object.fromEntries(productos.map((p) => [p[0], p]));
const skus = productos.map((p) => p[0]);
minutos = 59 * 1440 + 500;
while (minutos > 90) {
  const alm = rnd() < 0.6 ? almNombres[0] : elegir(almNombres.slice(1));
  const correo = elegir(usuariosPorAlmacen[alm]);
  const dado = rnd();
  const [sku, , , , pc, , mn, mx, provs] = productosPorSku[elegir(skus)];
  const exist = get(sku, alm);
  const minLocal = alm === almNombres[0] ? Math.ceil(mn * 0.7) : Math.max(1, Math.floor(mn / 4));
  const maxLocal = alm === almNombres[0] ? Math.floor(mx * 0.65) : Math.max(2, Math.floor(mx / 6));

  if (dado < 0.58) {
    if (exist > 0) {
      const cant = Math.min(exist, entre(1, Math.max(1, Math.ceil(mx / 8))));
      mov(minutos, sku, alm, 'Venta', cant, correo, { ref: `FAC-${folioVenta++}` });
    }
  } else if (dado < 0.84) {
    if (exist <= minLocal * 1.6) {
      const cant = Math.max(1, maxLocal - exist - entre(0, 2));
      const rfc = provs[0];
      mov(minutos, sku, alm, 'Compra a proveedor', cant, correo, { costo: pc, rfc, ref: `OC-${folioFactura++}`, obs: 'Reabastecimiento por punto de reorden' });
    }
  } else if (dado < 0.89) {
    mov(minutos, sku, alm, 'Devolución de cliente', entre(1, 2), correo, { ref: `NC-${entre(1000, 1999)}`, obs: 'Cliente cambió de modelo' });
  } else if (dado < 0.93) {
    if (exist > 0) mov(minutos, sku, alm, 'Merma / daño', 1, correo, { obs: elegir(['Empaque dañado en maniobra', 'Equipo con falla de fábrica', 'Producto extraviado en conteo']) });
  } else if (dado < 0.96) {
    if (rnd() < 0.5) mov(minutos, sku, alm, 'Ajuste positivo', entre(1, 2), correo, { ref: 'CONTEO-CICLICO', obs: 'Sobrante en conteo cíclico' });
    else if (exist > 0) mov(minutos, sku, alm, 'Ajuste negativo', 1, correo, { ref: 'CONTEO-CICLICO', obs: 'Faltante en conteo cíclico' });
  } else if (dado < 0.985) {
    if (exist > 0) mov(minutos, sku, alm, 'Consumo interno', 1, correo, { obs: 'Asignado a personal de la empresa' });
  } else if (exist > 1) {
    mov(minutos, sku, alm, 'Devolución a proveedor', 1, correo, { costo: pc, rfc: provs[0], ref: `DEV-${entre(300, 399)}`, obs: 'Garantía por defecto de fábrica' });
  }
  minutos -= entre(70, 260);
}

// 3) Situaciones para el semáforo del dashboard (últimas horas)
const central = almNombres[0];
for (const sku of ['COM-LAP-003', 'MOB-ARC-001']) { // agotar
  for (const alm of almNombres) {
    const e = get(sku, alm);
    if (e > 0) { mov(minutos, sku, alm, 'Venta', e, usuariosPorAlmacen[alm][0], { ref: `FAC-${folioVenta++}`, obs: 'Venta de mayoreo' }); minutos -= 7; }
  }
}
for (const sku of ['PER-DIA-001', 'IMP-TON-001', 'RED-AP-001', 'ALM-SSD-001']) { // dejar en nivel bajo
  const mn = productosPorSku[sku][6];
  const total = almNombres.reduce((s, a) => s + get(sku, a), 0);
  const e = get(sku, central);
  const vender = Math.min(e, total - Math.max(1, mn - 2));
  if (vender > 0) { mov(minutos, sku, central, 'Venta', vender, 'jorge.salinas@nexo.mx', { ref: `FAC-${folioVenta++}`, obs: 'Pedido corporativo' }); minutos -= 9; }
}
for (const sku of ['PAP-BOL-001', 'PER-TEC-001']) { // exceso
  const mx = productosPorSku[sku][7];
  const total = almNombres.reduce((s, a) => s + get(sku, a), 0);
  const [, , , , pc, , , , provs] = productosPorSku[sku];
  mov(minutos, sku, central, 'Compra a proveedor', mx - total + entre(15, 40), 'sofia.villarreal@nexo.mx', { costo: pc, rfc: provs[0], ref: `OC-${folioFactura++}`, obs: 'Compra de oportunidad por descuento' });
  minutos -= 11;
}

// Ubicaciones de anaquel en el almacén central
w();
w('-- Ubicación física de los productos en el almacén central');
w(`UPDATE inventario i SET ubicacion = 'P' || lpad(p.id_categoria::text, 2, '0') || '-A' || lpad((p.id_producto % 6 + 1)::text, 2, '0')`);
w('FROM productos p, almacenes a');
w(`WHERE p.id_producto = i.id_producto AND a.id_almacen = i.id_almacen AND a.nombre = ${q(central)};`);
w();

w('-- Bitácora inicial');
w('INSERT INTO bitacora (id_usuario, accion, modulo, descripcion, fecha)');
w(`SELECT id_usuario, 'CARGA', 'Sistema', 'Carga inicial de catálogos e inventario', now() - INTERVAL '60 days' FROM usuarios WHERE correo = 'admin@nexo.mx';`);

const destino = path.join(__dirname, '..', 'database', '05_datos_prueba.sql');
fs.writeFileSync(destino, out.join('\n') + '\n');
console.log(`Generado ${path.relative(process.cwd(), destino)} con ${productos.length} productos y ${totalMov} movimientos.`);
