/**
 * Acceso a datos: Neon PostgreSQL mediante el driver HTTP oficial.
 * La aplicación se conecta con el usuario app_nexo (rol "user"): puede
 * leer y escribir datos, pero no crear ni alterar objetos de la BD.
 */
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
  throw new Error('Falta DATABASE_URL en el archivo .env (consulta el README).');
}

const sql = neon(process.env.DATABASE_URL);

/** Ejecuta una consulta parametrizada ($1, $2, ...) y devuelve las filas. */
function query(texto, params = []) {
  return sql.query(texto, params);
}

/** Devuelve la primera fila o null. */
async function uno(texto, params = []) {
  const filas = await query(texto, params);
  return filas[0] || null;
}

/** Ejecuta varias consultas en una sola transacción: [[texto, params], ...] */
function transaccion(consultas) {
  return sql.transaction(consultas.map(([texto, params = []]) => sql.query(texto, params)));
}

/** Traduce errores de PostgreSQL a mensajes entendibles para el usuario. */
function mensajeError(err) {
  switch (err.code) {
    case '23505':
      return `Ya existe un registro con ese valor${err.constraint ? ` (${err.constraint})` : ''}.`;
    case '23503': // foreign_key_violation
    case '23001': // restrict_violation (ON DELETE RESTRICT)
      return 'La operación no es posible porque el registro está relacionado con otros datos (integridad referencial).';
    case '23514':
      return `Algún valor no cumple las reglas de la base de datos${err.constraint ? ` (${err.constraint})` : ''}.`;
    case '23502':
      return 'Falta un dato obligatorio.';
    case '22P02':
    case '22003':
      return 'Algún valor numérico no es válido.';
    case '42501':
      return 'Permiso denegado por la base de datos.';
    case 'P0001': // RAISE EXCEPTION dentro de una función
      return err.message;
    default:
      return null;
  }
}

module.exports = { sql, query, uno, transaccion, mensajeError };
