/**
 * Función de arranque que se despliega en Neon Functions (slug "nexo").
 *
 * Es deliberadamente pequeña: en el primer request (arranque en frío) descarga
 * del repositorio público de GitHub el código fijado a un commit
 * (NEXO_TARBALL_URL), extrae sólo lo necesario (src/, public/, deploy/neon/) y
 * carga la aplicación ya empaquetada en deploy/neon/dist/servidor.mjs.
 *
 * Variables de entorno de la función:
 *   NEXO_TARBALL_URL  https://codeload.github.com/<owner>/<repo>/tar.gz/<commit>
 *   DATABASE_URL      conexión como app_nexo (rol "user"); reemplaza la que inyecta Neon
 *   SESSION_SECRET    secreto para firmar la cookie de sesión
 */
import { gunzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname, normalize, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const NECESARIO = /^[^/]+\/(src|public|deploy\/neon)\//;

/** Extrae un .tar (formato ustar/pax de GitHub) y devuelve la carpeta raíz */
function extraer(tar, destino) {
  let pos = 0;
  let rutaPax = null;
  let raiz = null;
  while (pos + 512 <= tar.length) {
    const cabecera = tar.subarray(pos, pos + 512);
    if (cabecera.every((b) => b === 0)) break;
    const texto = (ini, fin) => cabecera.subarray(ini, fin).toString('utf8').replace(/\0.*$/s, '');
    const tamano = parseInt(texto(124, 136).trim() || '0', 8);
    const tipo = String.fromCharCode(cabecera[156] || 48);
    const prefijo = texto(345, 500);
    let nombre = prefijo ? `${prefijo}/${texto(0, 100)}` : texto(0, 100);
    const datos = tar.subarray(pos + 512, pos + 512 + tamano);
    pos += 512 + Math.ceil(tamano / 512) * 512;

    if (tipo === 'x') { // cabecera pax: puede traer la ruta larga del siguiente archivo
      const m = datos.toString('utf8').match(/\d+ path=([^\n]*)\n/);
      rutaPax = m ? m[1] : null;
      continue;
    }
    if (tipo === 'g') continue; // cabecera pax global (comentario con el commit)
    if (rutaPax) { nombre = rutaPax; rutaPax = null; }
    raiz ??= nombre.split('/')[0];
    if ((tipo !== '0' && tipo !== '\0') || !NECESARIO.test(nombre)) continue;

    const ruta = normalize(join(destino, nombre));
    if (!ruta.startsWith(destino + sep)) continue; // evita rutas fuera del destino
    mkdirSync(dirname(ruta), { recursive: true });
    writeFileSync(ruta, datos);
  }
  return join(destino, raiz);
}

async function cargarAplicacion() {
  const url = process.env.NEXO_TARBALL_URL;
  if (!url) throw new Error('Falta la variable NEXO_TARBALL_URL');
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`No se pudo descargar el código (${respuesta.status})`);
  const tar = gunzipSync(Buffer.from(await respuesta.arrayBuffer()));
  const raiz = extraer(tar, join(tmpdir(), `nexo-${Date.now()}`));
  process.env.APP_ROOT = raiz;
  process.env.CHARTJS_DIR = join(raiz, 'deploy', 'neon', 'vendor');
  const modulo = await import(pathToFileURL(join(raiz, 'deploy', 'neon', 'dist', 'servidor.mjs')).href);
  return modulo.default;
}

let aplicacion = null;

export default {
  async fetch(request) {
    aplicacion ??= cargarAplicacion().catch((err) => { aplicacion = null; throw err; });
    try {
      return (await aplicacion).fetch(request);
    } catch (err) {
      console.error(err);
      return new Response(`La aplicación no pudo iniciar: ${err.message}`, { status: 503 });
    }
  },
};
