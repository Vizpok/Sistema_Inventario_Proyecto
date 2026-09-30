#!/usr/bin/env node
/**
 * Ejecuta database/06_evidencias.sql iniciando sesión en Neon con el
 * usuario que indica cada bloque (-- @como ...) y guarda la salida real en:
 *   docs/evidencias/evidencias.json   (datos para el reporte PDF)
 *   docs/evidencias/EVIDENCIAS.md     (legible en GitHub)
 *
 * Requiere en .env: DATABASE_URL_OWNER, DATABASE_URL y las contraseñas PWD_*.
 * Uso: npm run evidencias
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const RAIZ = path.join(__dirname, '..');
const ARCHIVO = path.join(RAIZ, 'database', '06_evidencias.sql');
const SALIDA = path.join(RAIZ, 'docs', 'evidencias');

/** Cadena de conexión para cada usuario a partir de la del propietario */
function urlPara(usuario) {
  if (usuario === 'owner') return process.env.DATABASE_URL_OWNER;
  if (usuario === 'app_nexo' && process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const pwd = process.env[`PWD_${usuario.toUpperCase()}`];
  if (!pwd) throw new Error(`Falta PWD_${usuario.toUpperCase()} en .env`);
  const u = new URL(process.env.DATABASE_URL_OWNER);
  u.username = usuario;
  u.password = pwd;
  return u.toString();
}

/** Lee el archivo y lo organiza en evidencias → secciones → sentencias */
function leerBloques(texto) {
  const evidencias = [];
  let ev = null;
  let sec = null;
  let como = 'owner';
  let esperaError = false;
  let buffer = [];
  const cerrarSentencia = () => {
    const sql = buffer.join('\n').trim();
    if (sql) sec.sentencias.push({ sql, esperaError });
    buffer = [];
    esperaError = false;
  };
  for (const linea of texto.split(/\r?\n/)) {
    const d = linea.match(/^--\s*@(\w+)\s*(.*)$/);
    if (d) {
      const [, clave, valor] = d;
      if (clave === 'evidencia') {
        const [, num, titulo] = valor.match(/^(\d+)\s+(.*)$/);
        ev = { numero: Number(num), titulo, secciones: [] };
        evidencias.push(ev);
      } else if (clave === 'como') como = valor.trim();
      else if (clave === 'titulo') { sec = { titulo: valor.trim(), como, sentencias: [] }; ev.secciones.push(sec); }
      else if (clave === 'espera_error') esperaError = true;
      continue;
    }
    if (!sec || /^\s*--/.test(linea) || (!buffer.length && !linea.trim())) continue;
    buffer.push(linea);
    if (/;\s*$/.test(linea)) cerrarSentencia();
  }
  return evidencias;
}

/** Da formato de tabla estilo psql a un resultado */
function formatear(fields, rows) {
  const val = (v) => {
    if (v === null || v === undefined) return '';
    if (v === true) return 't';
    if (v === false) return 'f';
    if (v instanceof Date) {
      return v.toISOString().endsWith('T00:00:00.000Z') ? v.toISOString().slice(0, 10) : v.toISOString().replace('T', ' ').slice(0, 19) + '+00';
    }
    if (Array.isArray(v)) return `{${v.join(',')}}`;
    return String(v).replace(/\n/g, ' ');
  };
  const cols = fields.map((f) => f.name);
  const datos = rows.map((r) => cols.map((c) => val(r[c])));
  const anchos = cols.map((c, i) => Math.max(c.length, ...datos.map((d) => d[i].length)));
  const num = fields.map((f) => [20, 21, 23, 700, 701, 1700].includes(f.dataTypeID));
  const linea = (celdas, alinear) => ' ' + celdas.map((c, i) => (alinear && num[i] ? c.padStart(anchos[i]) : c.padEnd(anchos[i]))).join(' | ');
  return [
    linea(cols.map((c, i) => c.padStart(Math.floor((anchos[i] + c.length) / 2)).padEnd(anchos[i])), false),
    anchos.map((a) => '-'.repeat(a + 2)).join('+').slice(0, -0 || undefined),
    ...datos.map((d) => linea(d, true)),
    `(${rows.length} ${rows.length === 1 ? 'fila' : 'filas'})`,
  ].join('\n');
}

/** Texto de estado como el de psql: CREATE TABLE, DROP TABLE, INSERT 0 1... */
function etiquetaComando(sql, r) {
  const m = sql.match(/^\s*(CREATE|DROP|ALTER)\s+(?:OR\s+REPLACE\s+)?(?:TEMP(?:ORARY)?\s+)?(\w+)/i);
  if (m) return `${m[1]} ${m[2]}`.toUpperCase();
  if (r.command === 'INSERT') return `INSERT 0 ${r.rowCount}`;
  return r.rowCount !== null && r.rowCount !== undefined ? `${r.command} ${r.rowCount}` : r.command;
}

async function main() {
  const evidencias = leerBloques(fs.readFileSync(ARCHIVO, 'utf8'));
  const clientes = {};
  let fallos = 0;
  for (const ev of evidencias) {
    console.log(`Evidencia ${ev.numero}: ${ev.titulo}`);
    for (const sec of ev.secciones) {
      clientes[sec.como] ||= neon(urlPara(sec.como), { fullResults: true });
      const sql = clientes[sec.como];
      for (const s of sec.sentencias) {
        try {
          const r = await sql.query(s.sql);
          s.comando = r.command;
          s.salida = r.fields.length ? formatear(r.fields, r.rows) : etiquetaComando(s.sql, r);
          s.filas = r.rows.length;
          s.ok = !s.esperaError;
        } catch (err) {
          s.error = { codigo: err.code, mensaje: err.message };
          s.salida = `ERROR:  ${err.message}${err.code ? `\nSQLSTATE: ${err.code}` : ''}`;
          s.ok = s.esperaError;
        }
        if (!s.ok) { fallos++; console.log(`  ✗ [${sec.como}] ${s.sql.split('\n')[0]} → ${s.salida.split('\n')[0]}`); }
      }
      console.log(`  ✓ ${sec.titulo} (${sec.como})`);
    }
  }

  // Diccionario de datos (para el reporte): columnas, tipos, nulos, valores por defecto y llaves
  const diccionario = await neon(urlPara('owner')).query(`
    SELECT c.relname AS tabla, obj_description(c.oid, 'pg_class') AS descripcion_tabla,
           a.attname AS columna, format_type(a.atttypid, a.atttypmod) AS tipo, a.attnotnull AS obligatorio,
           CASE WHEN a.attidentity <> '' THEN 'IDENTITY'
                WHEN a.attgenerated <> '' THEN 'GENERADA'
                ELSE pg_get_expr(d.adbin, d.adrelid) END AS por_defecto,
           (SELECT string_agg(CASE con.contype WHEN 'p' THEN 'PK' WHEN 'u' THEN 'UK'
                                   ELSE 'FK → ' || con.confrelid::regclass::text END, ', ' ORDER BY con.contype DESC)
            FROM pg_constraint con
            WHERE con.conrelid = c.oid AND a.attnum = ANY (con.conkey) AND con.contype IN ('p', 'u', 'f')) AS llaves
    FROM pg_class c
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
    ORDER BY array_position(ARRAY['usuarios','categorias','proveedores','almacenes','tipos_movimiento',
                                  'productos','producto_proveedor','inventario','movimientos','bitacora'], c.relname::text),
             a.attnum`);

  fs.mkdirSync(SALIDA, { recursive: true });
  const generado = new Date().toISOString();
  fs.writeFileSync(path.join(SALIDA, 'evidencias.json'), JSON.stringify({ generado, evidencias, diccionario }, null, 2));

  const md = [
    '# Evidencias 1–7 · Proyecto Unidad 1',
    '',
    `Salida real obtenida al ejecutar \`database/06_evidencias.sql\` contra Neon PostgreSQL (${generado.slice(0, 16).replace('T', ' ')} UTC).`,
    'Cada bloque se ejecutó iniciando sesión con el usuario indicado. Regenerar con `npm run evidencias`.',
    '',
  ];
  for (const ev of evidencias) {
    md.push(`## Evidencia ${ev.numero}. ${ev.titulo}`, '');
    ev.secciones.forEach((sec, i) => {
      md.push(`### ${ev.numero}.${i + 1} ${sec.titulo}`, '', `Usuario de conexión: \`${sec.como === 'owner' ? 'nexo_inventario_owner' : sec.como}\``, '');
      for (const s of sec.sentencias) {
        md.push('```sql', s.sql, '```');
        md.push('```text', s.salida + (s.esperaError && s.error ? '\n-- ✔ error esperado: el permiso/validación funciona' : ''), '```', '');
      }
    });
  }
  fs.writeFileSync(path.join(SALIDA, 'EVIDENCIAS.md'), md.join('\n'));
  console.log(`\nGuardado en ${path.relative(RAIZ, SALIDA)}/ ${fallos ? `· ${fallos} resultado(s) inesperado(s)` : '· todo como se esperaba'}`);
  if (fallos) process.exitCode = 1;
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { leerBloques };
