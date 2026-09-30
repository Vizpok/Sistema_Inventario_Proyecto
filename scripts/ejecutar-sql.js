#!/usr/bin/env node
/**
 * Ejecuta uno o varios archivos .sql contra Neon usando el driver HTTP
 * (@neondatabase/serverless). Funciona aunque la red bloquee el puerto 5432.
 *
 * Cada archivo se ejecuta en UNA transacción: si una sentencia falla,
 * no se aplica nada de ese archivo.
 *
 * Uso:
 *   node scripts/ejecutar-sql.js database/01_esquema.sql [otro.sql ...]
 *   node scripts/ejecutar-sql.js --url-env DATABASE_URL archivo.sql
 *
 * Por defecto usa la variable DATABASE_URL_OWNER (propietario de la BD).
 * También puedes pegar los scripts directamente en el SQL Editor de Neon.
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

/** Divide un script en sentencias respetando comentarios, cadenas y $$...$$ */
function dividirSentencias(texto) {
  const sentencias = [];
  let actual = '';
  let i = 0;
  while (i < texto.length) {
    const c = texto[i];
    const sig = texto[i + 1];
    if (c === '-' && sig === '-') { // comentario de línea
      const fin = texto.indexOf('\n', i);
      i = fin === -1 ? texto.length : fin + 1;
      actual += '\n';
      continue;
    }
    if (c === '/' && sig === '*') { // comentario de bloque
      const fin = texto.indexOf('*/', i + 2);
      i = fin === -1 ? texto.length : fin + 2;
      continue;
    }
    if (c === "'" || c === '"') { // cadena o identificador entre comillas
      let j = i + 1;
      while (j < texto.length) {
        if (texto[j] === c && texto[j + 1] === c) { j += 2; continue; }
        if (texto[j] === c) break;
        j++;
      }
      actual += texto.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (c === '$') { // cuerpo con dollar-quoting: $$ ... $$ o $tag$ ... $tag$
      const m = /^\$[A-Za-z_]*\$/.exec(texto.slice(i));
      if (m) {
        const fin = texto.indexOf(m[0], i + m[0].length);
        const hasta = fin === -1 ? texto.length : fin + m[0].length;
        actual += texto.slice(i, hasta);
        i = hasta;
        continue;
      }
    }
    if (c === ';') {
      if (actual.trim()) sentencias.push(actual.trim());
      actual = '';
      i++;
      continue;
    }
    actual += c;
    i++;
  }
  if (actual.trim()) sentencias.push(actual.trim());
  return sentencias;
}

async function main() {
  const args = process.argv.slice(2);
  let urlEnv = 'DATABASE_URL_OWNER';
  const idx = args.indexOf('--url-env');
  if (idx !== -1) { urlEnv = args[idx + 1]; args.splice(idx, 2); }
  const url = process.env[urlEnv];
  if (!url) {
    console.error(`Falta la variable ${urlEnv} (revisa tu archivo .env)`);
    process.exit(1);
  }
  if (!args.length) {
    console.error('Indica al menos un archivo .sql');
    process.exit(1);
  }
  const sql = neon(url);
  for (const archivo of args) {
    // Sustituye marcadores {{VARIABLE}} por valores del .env (p. ej. contraseñas)
    const texto = fs.readFileSync(archivo, 'utf8').replace(/\{\{(\w+)\}\}/g, (_, nombre) => {
      if (!process.env[nombre]) throw new Error(`Falta la variable ${nombre} en .env (usada en ${archivo})`);
      return process.env[nombre].replace(/'/g, "''");
    });
    const sentencias = dividirSentencias(texto);
    process.stdout.write(`→ ${path.basename(archivo)}: ${sentencias.length} sentencias... `);
    const inicio = Date.now();
    await sql.transaction(sentencias.map((s) => sql.query(s)));
    console.log(`OK (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\nERROR:', err.message);
    if (err.detail) console.error('Detalle:', err.detail);
    process.exit(1);
  });
}

module.exports = { dividirSentencias };
