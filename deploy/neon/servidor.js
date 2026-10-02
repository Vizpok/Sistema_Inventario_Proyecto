/**
 * Adaptador para Neon Functions.
 *
 * Neon Functions espera un módulo cuyo export por defecto tenga
 * `fetch(request) → Response`. La aplicación es Express, así que aquí se
 * levanta en un puerto interno (127.0.0.1) y cada petición se reenvía tal cual.
 *
 * Se empaqueta con `npm run build:neon` en deploy/neon/dist/servidor.mjs.
 */
const http = require('http');
const app = require('../../src/app');

// Encabezados de conexión que no deben reenviarse entre saltos HTTP
const SALTO = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host', 'content-length'];

let base = null;
const listo = new Promise((resolve, reject) => {
  const servidor = http.createServer(app);
  servidor.on('error', reject);
  servidor.listen(0, '127.0.0.1', () => {
    base = `http://127.0.0.1:${servidor.address().port}`;
    resolve();
  });
});

async function manejar(request) {
  await listo;
  const url = new URL(request.url);
  const headers = new Headers(request.headers);
  for (const h of SALTO) headers.delete(h);
  headers.set('x-forwarded-proto', url.protocol.replace(':', ''));
  headers.set('x-forwarded-host', url.host);

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') init.body = await request.arrayBuffer();

  const respuesta = await fetch(base + url.pathname + url.search, init);
  const salida = new Headers(respuesta.headers);
  for (const h of SALTO) salida.delete(h);
  return new Response(respuesta.body, { status: respuesta.status, statusText: respuesta.statusText, headers: salida });
}

module.exports = { fetch: manejar };
