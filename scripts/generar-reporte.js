#!/usr/bin/env node
/**
 * Genera el producto final del proyecto:
 *   docs/reporte/Reporte_Proyecto_U1.html  (se puede abrir e imprimir a PDF desde el navegador)
 *   docs/reporte/Reporte_Proyecto_U1.pdf   (si hay un navegador Chromium/Edge/Chrome disponible)
 *
 * Fuentes: docs/reporte/datos.json (portada), docs/evidencias/evidencias.json
 * (salida real de `npm run evidencias`), los scripts de database/ y las
 * capturas de docs/capturas/.
 *
 * Uso: npm run reporte
 *   Variable opcional CHROME_PATH=/ruta/al/navegador para forzar el ejecutable.
 */
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'docs', 'reporte');
const leer = (...p) => fs.readFileSync(path.join(RAIZ, ...p), 'utf8');
const datos = JSON.parse(leer('docs', 'reporte', 'datos.json'));
const { evidencias, diccionario, generado } = JSON.parse(leer('docs', 'evidencias', 'evidencias.json'));

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PALABRAS = 'SELECT|FROM|WHERE|AND|OR|NOT|IN|IS|NULL|AS|ON|JOIN|LEFT|INNER|CROSS|LATERAL|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|CASE|WHEN|THEN|ELSE|END|WITH|INSERT|INTO|VALUES|UPDATE|SET|DELETE|RETURNING|CREATE|OR|REPLACE|TABLE|VIEW|FUNCTION|RETURNS|LANGUAGE|STABLE|BEGIN|DECLARE|IF|ELSIF|RAISE|EXCEPTION|RETURN|PERFORM|FOUND|FOR|CONFLICT|DO|NOTHING|GRANT|REVOKE|TO|ROLE|WITH|LOGIN|PASSWORD|INHERIT|NOSUPERUSER|NOCREATEDB|NOCREATEROLE|ALTER|DEFAULT|PRIVILEGES|SCHEMA|DATABASE|CONNECT|TEMPORARY|USAGE|EXECUTE|SEQUENCES|FUNCTIONS|TABLES|PRIMARY|KEY|FOREIGN|REFERENCES|CONSTRAINT|CHECK|UNIQUE|INDEX|GENERATED|ALWAYS|IDENTITY|STORED|CASCADE|RESTRICT|COMMENT|TRUE|FALSE|DROP|TEMP|FILTER|INTERVAL|COALESCE|GREATEST|COUNT|SUM|MAX|ROUND|TRUNCATE|RESTART';
const RE_SQL = new RegExp(`(--[^\\n]*)|('(?:''|[^'])*')|(\\$\\$)|\\b(${PALABRAS})\\b`, 'gi');
function resaltar(sql) {
  let out = '';
  let ultimo = 0;
  sql.replace(RE_SQL, (m, comentario, cadena, dolar, palabra, idx) => {
    out += esc(sql.slice(ultimo, idx));
    if (comentario) out += `<span class="c">${esc(m)}</span>`;
    else if (cadena) out += `<span class="s">${esc(m)}</span>`;
    else if (dolar) out += `<span class="k">${esc(m)}</span>`;
    else out += `<span class="k">${esc(m)}</span>`;
    ultimo = idx + m.length;
    return m;
  });
  return out + esc(sql.slice(ultimo));
}

/** Bloque de salida de consola; reduce la fuente si las líneas son largas */
function consola(texto, clase = '') {
  const max = Math.max(...texto.split('\n').map((l) => l.length));
  const ideal = 470 / (max * 0.6);
  const tam = Math.max(5.2, Math.min(8, ideal));
  // Si ni con la fuente mínima cabe, se permite el salto de línea para no cortar datos
  return `<pre class="consola ${clase}${ideal < 5.2 ? ' ajustar' : ''}" style="font-size:${tam.toFixed(2)}pt">${esc(texto)}</pre>`;
}
const codigo = (sql) => {
  const max = Math.max(...sql.split('\n').map((l) => l.length));
  const tam = Math.max(6, Math.min(8, 470 / (max * 0.6)));
  return `<pre class="sql" style="font-size:${tam.toFixed(2)}pt">${resaltar(sql)}</pre>`;
};
const img = (archivo, pie, clase = '') =>
  `<figure class="${clase}"><img src="${archivo}" alt="${esc(pie)}"><figcaption>${esc(pie)}</figcaption></figure>`;
const cap = (n) => `../capturas/${n}.png`;

// Capturas tomadas a mano en DBeaver / consola de Neon (docs/capturas/manual/)
const DIR_MANUAL = path.join(RAIZ, 'docs', 'capturas', 'manual');
const manuales = fs.existsSync(DIR_MANUAL)
  ? fs.readdirSync(DIR_MANUAL).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
  : [];
const pies = fs.existsSync(path.join(DIR_MANUAL, 'pies.json'))
  ? JSON.parse(fs.readFileSync(path.join(DIR_MANUAL, 'pies.json'), 'utf8'))
  : {};
function pieManual(archivo) {
  if (pies[archivo]) return pies[archivo];
  const m = archivo.match(/^ev(\d+)-(\d+)-([a-z_]+?)(?:-([a-z0-9]+))?\.\w+$/i);
  if (m) return `Evidencia ${m[1]} · paso ${m[2]}${m[4] ? ` (${m[4]})` : ''} ejecutado con la conexión ${m[3]} (DBeaver / Neon).`;
  return archivo.replace(/\.\w+$/, '').replace(/[-_]/g, ' ');
}
function capturasManuales(filtro, titulo) {
  const lista = manuales.filter(filtro);
  if (!lista.length) return '';
  return `<h4 class="manual-titulo">${titulo}</h4>` +
    lista.map((f) => img(`../capturas/manual/${f}`, pieManual(f), 'manual')).join('');
}

// Oculta contraseñas del script de roles
const sqlRoles = leer('database', '02_roles_usuarios.sql');
const sqlVistas = leer('database', '03_vistas.sql');
const sqlFunciones = leer('database', '04_funciones.sql');

// ---------------------------------------------------------------------
// Secciones
// ---------------------------------------------------------------------
const p = datos.portada;
const campo = (etq, val) => `<tr><th>${etq}</th><td>${val ? esc(val) : '<span class="linea"></span>'}</td></tr>`;

const portada = `
<section class="portada">
  <div class="portada-banda"></div>
  <p class="portada-inst">${esc(p.institucion || '')}${p.carrera ? `<br>${esc(p.carrera)}` : ''}</p>
  <p class="portada-materia">${esc(p.materia)} · ${esc(p.unidad)}</p>
  <h1>${esc(p.titulo)}</h1>
  <p class="portada-sub">${esc(p.subtitulo)}</p>
  <img class="portada-logo" src="../../public/img/logo.svg" alt="">
  <table class="portada-datos">
    ${campo('Alumno(a)', p.alumno)}
    ${campo('Matrícula', p.matricula)}
    ${campo('Grupo', p.grupo)}
    ${campo('Docente', p.docente)}
    ${campo('Fecha de entrega', p.fecha)}
    ${campo('Repositorio', p.repositorio)}
  </table>
</section>`;

const indice = `
<section class="indice">
  <h2 class="sin-numero">Contenido</h2>
  <ol>
    <li>Introducción</li>
    <li>Diseño de la base de datos (diagrama y tablas)</li>
    <li>Scripts de roles y usuarios</li>
    <li>Scripts de vistas y funciones</li>
    <li>Evidencias 1–7</li>
    <li>Aplicación web: uso de las vistas y funciones</li>
    <li>Reflexión final</li>
  </ol>
  <p class="nota">Todas las salidas de consola de este documento son resultados reales obtenidos al ejecutar
  <code>database/06_evidencias.sql</code> contra Neon el ${esc(generado.slice(0, 10))} (hora UTC ${esc(generado.slice(11, 16))}),
  iniciando sesión con el usuario indicado en cada bloque. Las capturas son de la aplicación conectada a la misma base de datos.</p>
</section>`;

const introduccion = `
<section>
  <h2>1. Introducción</h2>
  <p><strong>Distribuidora Nexo S.A. de C.V.</strong> es una empresa ficticia de Monterrey, N.L., que comercializa equipo de cómputo,
  periféricos, redes, consumibles de impresión, papelería, mobiliario de oficina y equipo de energía. Opera un almacén central
  y dos sucursales (Saltillo y Guadalajara). Hasta ahora controlaba sus existencias en hojas de cálculo, lo que provocaba
  diferencias entre lo registrado y lo físico, ventas de productos agotados y nula trazabilidad de quién movía la mercancía.</p>
  <p>El objetivo de este proyecto es <strong>diseñar, implementar y explotar una base de datos relacional en la nube</strong>
  con <strong>Neon (PostgreSQL 18 serverless)</strong> que sirva como núcleo de un sistema de inventario, cumpliendo con:</p>
  <ul>
    <li>Un diseño normalizado con <strong>10 tablas</strong> relacionadas (1:N y N:M), llaves primarias, foráneas, restricciones y tipos de datos adecuados.</li>
    <li>Dos roles con permisos diferenciados, <code>developer</code> y <code>"user"</code>, incluyendo permisos por defecto para tablas futuras, y cuatro usuarios asignados a ellos.</li>
    <li>Dos vistas construidas con <strong>CTEs</strong> y dos funciones: una de <strong>cálculo</strong> y una de <strong>inserción</strong>.</li>
    <li>El uso real de esas vistas y funciones, tanto desde SQL como desde una <strong>aplicación web</strong> (Node.js + Express) con dashboard, inventario, catálogo, proveedores, categorías, registro de movimientos, sección de administración y sección de usuario.</li>
  </ul>
  <h3>Arquitectura</h3>
  <div class="arquitectura">
    <div class="caja"><strong>Navegador</strong><span>Administradores y usuarios de Nexo</span></div>
    <div class="flecha">HTTPS →</div>
    <div class="caja"><strong>Aplicación web</strong><span>Node.js · Express · EJS<br>sesión + rol de aplicación (admin / usuario)</span></div>
    <div class="flecha">SQL sobre HTTPS →<br><code>app_nexo</code> (rol "user")</div>
    <div class="caja caja-bd"><strong>Neon · PostgreSQL 18</strong><span>BD <code>nexo_inventario</code><br>tablas · vistas CTE · funciones</span></div>
  </div>
  <p>La aplicación <strong>no</strong> se conecta con el propietario de la base de datos, sino con <code>app_nexo</code>, miembro del rol
  <code>"user"</code>: puede leer y escribir datos, pero cualquier intento de crear o borrar objetos es rechazado por PostgreSQL.
  Los desarrolladores (<code>dev_ana</code>, <code>dev_luis</code>) usan el rol <code>developer</code> para evolucionar el esquema.
  Toda la lógica crítica (validar existencias y actualizar el inventario) vive en la base de datos, dentro de
  <code>fn_registrar_movimiento</code>, por lo que se cumple sin importar qué cliente la invoque.</p>
  <h3>Tecnologías</h3>
  <table class="tabla">
    <tr><th>Componente</th><th>Tecnología</th></tr>
    <tr><td>Base de datos</td><td>Neon serverless PostgreSQL 18 (${esc(datos.neon.proveedor_region)})</td></tr>
    <tr><td>Lenguajes de BD</td><td>SQL (DDL, DCL, DML), PL/pgSQL, CTEs</td></tr>
    <tr><td>Aplicación</td><td>Node.js ≥ 18, Express 5, EJS, bcryptjs, Chart.js</td></tr>
    <tr><td>Conexión</td><td>Driver oficial <code>@neondatabase/serverless</code> (consultas SQL sobre HTTPS, sin puerto 5432)</td></tr>
    <tr><td>Control de versiones</td><td>Git / GitHub — todos los scripts SQL están versionados en <code>database/</code></td></tr>
  </table>
</section>`;

// Diccionario de datos agrupado por tabla
const porTabla = {};
for (const c of diccionario) (porTabla[c.tabla] ||= { desc: c.descripcion_tabla, cols: [] }).cols.push(c);
const sinCast = (v) => String(v || '').replace(/::[a-z ]+(\(\d+(,\d+)?\))?/g, '');
const tipoCorto = (t) => t.replace('character varying', 'varchar').replace('timestamp with time zone', 'timestamptz').replace('character', 'char');
const diccionarioHtml = Object.entries(porTabla).map(([t, info]) => `
  <div class="tabla-dic">
    <h4>${esc(t)} <span>${esc(info.desc || '')}</span></h4>
    <table class="tabla tabla-mini">
      <tr><th>Columna</th><th>Tipo</th><th>Nulo</th><th>Llaves</th><th>Por defecto</th></tr>
      ${info.cols.map((c) => `<tr><td class="mono">${esc(c.columna)}</td><td class="mono">${esc(tipoCorto(c.tipo))}</td><td>${c.obligatorio ? 'NO' : 'sí'}</td><td>${esc(c.llaves || '')}</td><td class="mono">${esc(sinCast(c.por_defecto))}</td></tr>`).join('')}
    </table>
  </div>`).join('');

const diseno = `
<section>
  <h2>2. Diseño de la base de datos</h2>
  <h3>2.1 Diagrama entidad-relación</h3>
  <p>La figura 1 (página completa, en horizontal, después de la sección 2.3) muestra las 10 entidades, sus atributos con tipo de dato y las llaves
  (PK = primaria, FK = foránea, UK = única). Las líneas usan notación <em>pata de gallo</em>: <code>||</code> exactamente uno,
  <code>o|</code> cero o uno y <code>o{</code> cero o muchos.</p>

  <h3>2.2 Relaciones</h3>
  <table class="tabla">
    <tr><th>Relación</th><th>Tipo</th><th>Implementación</th><th>Regla al borrar</th></tr>
    <tr><td>categorias → productos</td><td>1:N</td><td><code>productos.id_categoria</code></td><td>RESTRICT</td></tr>
    <tr><td>productos ↔ proveedores</td><td><strong>N:M</strong></td><td>tabla puente <code>producto_proveedor</code> (PK compuesta) con costo, días de entrega y proveedor principal</td><td>CASCADE</td></tr>
    <tr><td>productos ↔ almacenes</td><td><strong>N:M</strong></td><td>tabla <code>inventario</code> (PK compuesta) con la existencia y la ubicación física</td><td>RESTRICT</td></tr>
    <tr><td>usuarios → almacenes</td><td>1:N (opcional)</td><td><code>almacenes.id_responsable</code></td><td>SET NULL</td></tr>
    <tr><td>tipos_movimiento → movimientos</td><td>1:N</td><td><code>movimientos.id_tipo</code></td><td>NO ACTION</td></tr>
    <tr><td>productos / almacenes → movimientos</td><td>1:N</td><td><code>movimientos.id_producto</code>, <code>id_almacen</code></td><td>NO ACTION</td></tr>
    <tr><td>proveedores → movimientos</td><td>1:N (opcional)</td><td><code>movimientos.id_proveedor</code> (sólo compras/devoluciones)</td><td>NO ACTION</td></tr>
    <tr><td>usuarios → movimientos / bitácora</td><td>1:N</td><td><code>movimientos.id_usuario</code>, <code>bitacora.id_usuario</code></td><td>NO ACTION / SET NULL</td></tr>
  </table>

  <h3>2.3 Decisiones de diseño</h3>
  <ul>
    <li><strong>Normalización (3FN):</strong> cada hecho se guarda una sola vez. Categorías, proveedores, almacenes y tipos de movimiento son catálogos independientes; la existencia se guarda por producto y almacén en <code>inventario</code> y no en <code>productos</code>, porque depende de ambos.</li>
    <li><strong>Llaves primarias</strong> con <code>GENERATED ALWAYS AS IDENTITY</code> (estándar SQL) y llaves compuestas en las tablas puente.</li>
    <li><strong>Tipos de datos:</strong> <code>NUMERIC(12,2)</code> para dinero (sin errores de redondeo de <code>float</code>), <code>TIMESTAMPTZ</code> para fechas (Neon corre en UTC y la app muestra hora de Ciudad de México), <code>SMALLINT</code> en catálogos pequeños, <code>VARCHAR(n)</code> con longitudes realistas y <code>TEXT</code> para descripciones.</li>
    <li><strong>Integridad:</strong> restricciones <code>CHECK</code> (precios ≥ 0, existencia ≥ 0, cantidad &gt; 0, RFC de 12 o 13 caracteres, color hexadecimal, rango mínimo/máximo), <code>UNIQUE</code> (SKU, correo, RFC, nombres) y un <strong>índice único parcial</strong> que garantiza un solo proveedor principal por producto.</li>
    <li><strong>Columna generada</strong> <code>movimientos.folio</code> (<code>'MOV-' || lpad(id, 6, '0')</code>): siempre consistente con el id.</li>
    <li><code>movimientos.existencia_resultante</code> guarda una <em>foto</em> de la existencia al momento del movimiento (kardex histórico); no es redundancia porque ese valor no puede recalcularse de forma barata ni cambia después.</li>
    <li><strong>Índices</strong> sobre las llaves foráneas y sobre <code>movimientos(fecha)</code> para acelerar el kardex y las vistas.</li>
  </ul>

  <figure class="diagrama"><div class="rotado"><img src="../diagrama_er.svg" alt="Diagrama entidad-relación"></div><figcaption>Figura 1. Modelo entidad-relación de <code>nexo_inventario</code>. Fuente: <code>docs/diagrama_er.mmd</code>.</figcaption></figure>

  ${capturasManuales((f) => f.startsWith('er-'), 'Diagrama generado por DBeaver a partir de la base de datos en Neon')}
  <h3>2.4 Tablas (diccionario de datos)</h3>
  <p>Generado desde el catálogo de PostgreSQL (<code>pg_attribute</code>, <code>pg_constraint</code>).</p>
  <div class="diccionario">${diccionarioHtml}</div>
  <p>El script completo de creación está en <code>database/01_esquema.sql</code>.</p>
</section>`;

const roles = `
<section>
  <h2>3. Scripts de roles y usuarios</h2>
  <p>Matriz de permisos implementada:</p>
  <table class="tabla matriz">
    <tr><th>Permiso</th><th><code>developer</code></th><th><code>"user"</code></th></tr>
    <tr><td>Iniciar sesión (LOGIN)</td><td>✔</td><td>✔</td></tr>
    <tr><td>Conectarse a la BD (CONNECT)</td><td>✔</td><td>✔</td></tr>
    <tr><td>Crear objetos en <code>public</code> (CREATE)</td><td>✔</td><td>✘</td></tr>
    <tr><td>Tablas temporales (TEMPORARY)</td><td>✔</td><td>✘</td></tr>
    <tr><td>CRUD en tablas existentes</td><td>✔</td><td>✔</td></tr>
    <tr><td>CRUD por defecto en tablas futuras</td><td>✔</td><td>✔</td></tr>
    <tr><td>Ejecutar funciones</td><td>✔</td><td>✔</td></tr>
  </table>
  <p>Usuarios: <code>dev_ana</code> y <code>dev_luis</code> → <code>developer</code>; <code>app_nexo</code> (cuenta de servicio de la aplicación) y
  <code>usr_carlos</code> → <code>"user"</code>. Puntos clave del script:</p>
  <ul>
    <li><code>USER</code> es palabra reservada en PostgreSQL, por eso el rol se escribe entre comillas: <code>"user"</code>.</li>
    <li>Los permisos por defecto (<code>ALTER DEFAULT PRIVILEGES</code>) se declaran para los dos roles que pueden crear objetos: el propietario y <code>developer</code>.</li>
    <li><code>ALTER ROLE dev_ana SET role = 'developer'</code> hace que los desarrolladores creen objetos <em>como</em> <code>developer</code>, de modo que las tablas nuevas son del equipo y reciben automáticamente los permisos por defecto.</li>
    <li>Las contraseñas no se guardan en el repositorio: el script usa marcadores <code>{{PWD_...}}</code> que se sustituyen desde <code>.env</code>.</li>
  </ul>
  <h4>database/02_roles_usuarios.sql</h4>
  ${codigo(sqlRoles)}
</section>`;

const vistasFunciones = `
<section>
  <h2>4. Scripts de vistas y funciones</h2>
  <h3>4.1 Vistas con CTEs</h3>
  <table class="tabla">
    <tr><th>Vista</th><th>CTEs</th><th>Propósito</th></tr>
    <tr><td><code>vw_estado_inventario</code></td><td><code>existencias</code>, <code>actividad</code>, <code>consolidado</code></td><td>Existencia total por producto, valor, salidas de 30 días, días de cobertura y semáforo (SIN STOCK / BAJO / NORMAL / EXCESO). Alimenta dashboard, inventario y catálogo.</td></tr>
    <tr><td><code>vw_movimientos_diarios</code></td><td><code>calendario</code>, <code>detalle</code>, <code>agregado</code></td><td>Serie diaria de los últimos 30 días con entradas, salidas e importes; el calendario generado con <code>generate_series</code> hace que los días sin movimientos aparezcan en cero. Alimenta la gráfica del dashboard.</td></tr>
  </table>
  <h4>database/03_vistas.sql</h4>
  ${codigo(sqlVistas)}
  <h3>4.2 Funciones</h3>
  <table class="tabla">
    <tr><th>Función</th><th>Tipo</th><th>Descripción</th></tr>
    <tr><td><code>fn_valor_inventario(p_id_categoria, p_id_almacen)</code></td><td>Cálculo (SQL, STABLE)</td><td>Valor del inventario = Σ existencia × precio de compra; ambos filtros opcionales.</td></tr>
    <tr><td><code>fn_registrar_movimiento(...)</code></td><td>Inserción (PL/pgSQL)</td><td>Valida datos, bloquea la fila de inventario con <code>FOR UPDATE</code>, rechaza salidas sin existencia, inserta el movimiento con su existencia resultante y actualiza <code>inventario</code>. Todo o nada.</td></tr>
  </table>
  <h4>database/04_funciones.sql</h4>
  ${codigo(sqlFunciones)}
</section>`;

// Evidencias: capturas extra por número
const extras = {
  1: `<table class="tabla"><tr><th colspan="2">Proyecto en Neon</th></tr>
      ${Object.entries({ Proyecto: datos.neon.proyecto, 'ID del proyecto': datos.neon.id_proyecto, 'Proveedor y región': datos.neon.proveedor_region,
        Versión: datos.neon.version, Rama: datos.neon.rama, 'Base de datos': datos.neon.base_de_datos, Propietario: datos.neon.propietario,
        Conexión: datos.neon.conexion, Creado: datos.neon.creado }).map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`,
  4: `${img(cap('15-admin-base-datos'), 'Figura. Página "Base de datos" de la aplicación: roles, permisos por tabla, privilegios por defecto y la prueba en vivo de CREATE TABLE con la conexión de la app (rechazada con SQLSTATE 42501).', 'alta')}
      ${img(cap('18-usuario-sin-acceso'), 'Figura. Además de los roles de BD, la aplicación tiene su propio rol: un usuario operativo no puede entrar a la sección de administración.')}`,
  7: `<h3>Uso desde la aplicación web</h3>
      ${img(cap('02-dashboard'), 'Figura. Dashboard: KPI con fn_valor_inventario(), gráfica con vw_movimientos_diarios, valor por categoría y alertas con vw_estado_inventario, valor por almacén con fn_valor_inventario(NULL, id_almacen).', 'alta')}
      ${img(cap('09-movimiento-formulario'), 'Figura. Registro de una venta desde la aplicación; la vista previa consulta la existencia actual.')}
      ${img(cap('10-movimiento-registrado'), 'Figura. El formulario llama a fn_registrar_movimiento(): se generó el folio y se actualizó la existencia.')}
      ${img(cap('11-movimiento-rechazado'), 'Figura. La misma función rechaza una salida mayor a la existencia; la app sólo muestra el mensaje de PostgreSQL.')}
      ${img(cap('03-inventario'), 'Figura. Inventario consolidado leído de vw_estado_inventario con semáforo por producto.')}`,
};

const evidenciasHtml = `
<section>
  <h2>5. Evidencias</h2>
  <p>Cada bloque muestra el usuario con el que se inició sesión, la sentencia ejecutada y la salida real de PostgreSQL.
  Las sentencias marcadas como <span class="esperado">error esperado</span> debían fallar para demostrar que un permiso o una validación funciona.</p>
  ${evidencias.map((ev) => `
  <div class="evidencia">
    <h3 class="evidencia-titulo"><span>Evidencia ${ev.numero}</span> ${esc(ev.titulo)}</h3>
    ${ev.numero === 1 ? extras[1] : ''}
    ${capturasManuales((f) => f.startsWith(`ev${ev.numero}-`), 'Capturas en DBeaver y en la consola de Neon')}
    ${ev.secciones.map((sec, i) => `
      <div class="bloque">
        <h4>${ev.numero}.${i + 1} ${esc(sec.titulo)} <span class="usuario">${esc(sec.como === 'owner' ? 'nexo_inventario_owner' : sec.como)}</span></h4>
        ${sec.sentencias.map((s) => `${codigo(s.sql)}${consola(s.salida, s.error ? (s.esperaError ? 'esperado' : 'fallo') : '')}${s.error && s.esperaError ? '<p class="esperado">✔ Error esperado: el permiso / la validación funciona.</p>' : ''}`).join('')}
      </div>`).join('')}
    ${ev.numero !== 1 && extras[ev.numero] ? extras[ev.numero] : ''}
  </div>`).join('')}
</section>`;

const aplicacion = `
<section>
  <h2>6. Aplicación web: uso de las vistas y funciones</h2>
  <p>La aplicación organiza el sistema en las secciones solicitadas. En cada pantalla se indica qué objeto de la base de datos la alimenta:</p>
  <table class="tabla">
    <tr><th>Sección</th><th>Rol de la app</th><th>Objetos de BD que utiliza</th></tr>
    <tr><td>Dashboard</td><td>admin, usuario</td><td><code>fn_valor_inventario()</code>, <code>vw_estado_inventario</code>, <code>vw_movimientos_diarios</code></td></tr>
    <tr><td>Inventario</td><td>admin, usuario</td><td><code>vw_estado_inventario</code>, <code>inventario</code> (exportación CSV)</td></tr>
    <tr><td>Catálogo</td><td>admin (CRUD), usuario (consulta)</td><td><code>productos</code>, <code>producto_proveedor</code> (N:M), kardex de <code>movimientos</code></td></tr>
    <tr><td>Categorías</td><td>admin (CRUD), usuario (consulta)</td><td><code>categorias</code>, <code>fn_valor_inventario(id_categoria)</code></td></tr>
    <tr><td>Proveedores</td><td>admin (CRUD), usuario (consulta)</td><td><code>proveedores</code>, <code>producto_proveedor</code>, <code>movimientos</code></td></tr>
    <tr><td>Registro de movimientos</td><td>admin, usuario</td><td><code>fn_registrar_movimiento()</code>, <code>movimientos</code></td></tr>
    <tr><td>Administración</td><td>sólo admin</td><td><code>usuarios</code>, <code>almacenes</code> + <code>fn_valor_inventario(NULL, id)</code>, <code>tipos_movimiento</code>, <code>bitacora</code>, catálogo de PostgreSQL</td></tr>
    <tr><td>Mi cuenta (usuario)</td><td>admin, usuario</td><td><code>usuarios</code>, <code>movimientos</code> propios, <code>bitacora</code></td></tr>
  </table>
  <div class="galeria">
    ${img(cap('01-login'), 'Inicio de sesión')}
    ${img(cap('04-catalogo'), 'Catálogo de productos')}
    ${img(cap('05-producto-detalle'), 'Detalle de producto: existencias por almacén, proveedores (N:M) y kardex')}
    ${img(cap('07-proveedores'), 'Proveedores')}
    ${img(cap('06-categorias'), 'Categorías con valor calculado por la función')}
    ${img(cap('08-movimientos'), 'Registro (kardex) de movimientos con filtros')}
    ${img(cap('12-admin-usuarios'), 'Administración: usuarios del sistema')}
    ${img(cap('13-admin-almacenes'), 'Administración: almacenes y su valor')}
    ${img(cap('14-admin-bitacora'), 'Administración: bitácora de auditoría')}
    ${img(cap('17-usuario-mi-cuenta'), 'Sección de usuario: mi cuenta y mis movimientos')}
  </div>
</section>`;

const reflexion = `
<section>
  <h2>7. Reflexión final</h2>
  <p class="pregunta">¿Qué ventajas ofrece la gestión de roles y funciones en bases de datos en la nube para proyectos reales?</p>
  <p>La principal ventaja es que la seguridad deja de depender de que cada programa “se porte bien” y pasa a estar garantizada
  por el motor de base de datos. En este proyecto la aplicación web se conecta con <code>app_nexo</code>, un usuario del rol
  <code>"user"</code>: aunque alguien encontrara una falla en la aplicación o robara su cadena de conexión, no podría crear, alterar ni
  borrar tablas, porque PostgreSQL responde <em>permission denied</em>. Esto es el <strong>principio de mínimo privilegio</strong>, y en la
  nube es todavía más importante, ya que la base de datos es accesible desde Internet y no está protegida sólo por la red de la empresa.</p>
  <p>Los roles también <strong>separan responsabilidades</strong> y simplifican la administración del personal. El rol <code>developer</code> agrupa lo que
  necesita el equipo de desarrollo y el rol <code>"user"</code> lo que necesita la operación diaria; dar de alta a un nuevo integrante es
  un solo <code>GRANT</code>, y darlo de baja no afecta a nadie más. Con los <strong>privilegios por defecto</strong> comprobamos que una
  tabla creada después por un desarrollador quedó disponible de inmediato para los usuarios operativos sin volver a otorgar permisos, lo
  que evita errores humanos cuando el esquema crece. Además, al tener un usuario por persona o servicio, cada acción queda atribuida a
  alguien, lo que facilita auditorías.</p>
  <p>Las <strong>funciones</strong> centralizan las reglas del negocio junto a los datos. <code>fn_registrar_movimiento</code> valida la existencia,
  bloquea la fila para evitar que dos ventas simultáneas dejen el inventario en negativo e inserta el movimiento y la nueva existencia
  en una sola operación atómica. Da igual si el movimiento llega desde la aplicación web, desde un script o desde una futura app
  móvil: la regla se cumple siempre y existe en un solo lugar. En la nube esto además <strong>reduce la latencia y el costo</strong>, porque una
  sola llamada sustituye varias idas y vueltas por la red. Las funciones de cálculo, como <code>fn_valor_inventario</code>, y las vistas con
  CTEs permiten que distintos reportes obtengan exactamente el mismo resultado (lo verificamos comparando la vista contra la función en
  la evidencia 7) y ocultan la complejidad de las consultas a quien sólo necesita leer datos.</p>
  <p>Por último, un servicio administrado como Neon añade ventajas propias: no hay servidor que instalar ni parchar, las conexiones
  van cifradas con SSL, la base de datos escala y se suspende sola según la carga, y las ramas (<em>branches</em>) permiten probar cambios
  de roles o de funciones en una copia antes de aplicarlos en producción. La contraparte es que la lógica en la base de datos también es
  código: debe versionarse y probarse, razón por la cual todos los scripts de este proyecto están en el repositorio y las evidencias se
  pueden regenerar con un solo comando.</p>
</section>`;

// ---------------------------------------------------------------------
// Documento
// ---------------------------------------------------------------------
const css = `
@page { size: A4; margin: 18mm 16mm 18mm 16mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 10pt; line-height: 1.5; color: #1f2937; margin: 0; }
h1, h2, h3, h4 { color: #111827; line-height: 1.25; break-after: avoid; }
h2 { font-size: 17pt; border-bottom: 2px solid #4f46e5; padding-bottom: 4px; margin: 0 0 12px; }
h3 { font-size: 12.5pt; margin: 18px 0 8px; color: #312e81; }
h4 { font-size: 10pt; margin: 14px 0 6px; }
section { break-before: page; }
p { margin: 0 0 8px; text-align: justify; }
ul { margin: 0 0 10px; padding-left: 18px; }
li { margin-bottom: 3px; }
code, .mono { font-family: "Cascadia Code", Consolas, "DejaVu Sans Mono", monospace; font-size: 8.5pt; }
p code, li code, td code { background: #eef2ff; color: #3730a3; padding: 0 3px; border-radius: 3px; }
.tabla { width: 100%; border-collapse: collapse; margin: 6px 0 12px; font-size: 8.8pt; }
.tabla th, .tabla td { border: 1px solid #d1d5db; padding: 4px 6px; text-align: left; vertical-align: top; }
.tabla th { background: #f3f4f6; font-weight: 600; }
.tabla-mini { font-size: 7.6pt; margin: 0; }
.tabla-mini td, .tabla-mini th { padding: 2px 5px; }
.matriz td:nth-child(n+2) { text-align: center; font-weight: 700; }
pre { margin: 0 0 6px; padding: 8px 10px; border-radius: 6px; white-space: pre-wrap; word-break: break-word; line-height: 1.35; }
pre.sql { background: #f8fafc; border: 1px solid #e2e8f0; color: #0f172a; }
pre.sql .k { color: #4338ca; font-weight: 700; }
pre.sql .s { color: #047857; }
pre.sql .c { color: #6b7280; font-style: italic; }
pre.consola { background: #0f172a; color: #e2e8f0; white-space: pre; overflow: hidden; margin-bottom: 10px; }
pre.consola.ajustar { white-space: pre-wrap; word-break: break-all; }
pre.consola.esperado { background: #3b0d0d; color: #fecaca; }
pre.consola.fallo { background: #7f1d1d; color: #fff; }
p.esperado, span.esperado { color: #b91c1c; font-weight: 600; font-size: 8.5pt; margin-top: -4px; }
span.esperado { background: #fee2e2; padding: 0 4px; border-radius: 3px; }
figure { margin: 10px 0 14px; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 118mm; border: 1px solid #d1d5db; border-radius: 6px; }
figure.alta img { max-height: 235mm; }
figure.diagrama { break-before: page; break-after: page; margin: 0; }
.rotado { position: relative; height: 238mm; overflow: visible; }
.rotado img { position: absolute; width: 236mm; max-width: none; max-height: none; border: 0; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-90deg); }
figure.manual img { max-height: 150mm; }
.manual-titulo { color: #312e81; }
figcaption { font-size: 8pt; color: #6b7280; margin-top: 4px; }
.galeria { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
.galeria figure { margin: 4px 0; }
.galeria img { max-height: 60mm; }
.nota { font-size: 8.5pt; color: #4b5563; background: #f9fafb; border-left: 3px solid #4f46e5; padding: 8px 10px; margin-top: 18px; }
.portada { break-before: auto; height: 255mm; display: flex; flex-direction: column; justify-content: center; position: relative; padding: 0 6mm; }
.portada-banda { position: absolute; top: 0; left: -16mm; right: -16mm; height: 14mm; background: linear-gradient(90deg, #4f46e5, #0ea5e9); }
.portada-inst { font-size: 12pt; font-weight: 600; color: #374151; margin-bottom: 26px; text-align: left; }
.portada-materia { color: #4f46e5; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; font-size: 10pt; }
.portada h1 { font-size: 25pt; margin: 6px 0 10px; }
.portada-sub { font-size: 13pt; color: #4b5563; text-align: left; }
.portada-logo { width: 26mm; margin: 22px 0; }
.portada-datos { border-collapse: collapse; width: 100%; max-width: 150mm; font-size: 10.5pt; }
.portada-datos th { text-align: left; width: 42mm; padding: 5px 0; color: #6b7280; font-weight: 600; }
.portada-datos td { padding: 5px 0; }
.linea { display: inline-block; width: 90mm; border-bottom: 1px solid #9ca3af; height: 1em; }
.indice ol { font-size: 12pt; line-height: 2; }
.arquitectura { display: flex; align-items: center; gap: 6px; margin: 10px 0 12px; }
.arquitectura .caja { flex: 1; border: 1.5px solid #4f46e5; border-radius: 8px; padding: 8px; text-align: center; background: #eef2ff; font-size: 8.5pt; }
.arquitectura .caja strong { display: block; font-size: 9.5pt; }
.arquitectura .caja-bd { border-color: #059669; background: #ecfdf5; }
.arquitectura .flecha { font-size: 7.5pt; color: #4b5563; text-align: center; }
.diccionario { }
.tabla-dic { break-inside: avoid; margin-bottom: 10px; }
.tabla-dic h4 { margin: 0 0 3px; font-family: Consolas, monospace; font-size: 9pt; color: #312e81; }
.tabla-dic h4 span { font-family: "Segoe UI", Arial, sans-serif; font-weight: 400; color: #6b7280; font-size: 7.5pt; }
.evidencia { break-before: page; }
.evidencia:first-of-type { break-before: auto; }
.evidencia-titulo { font-size: 14pt; color: #111827; background: #eef2ff; border-left: 5px solid #4f46e5; padding: 6px 10px; margin-top: 0; }
.evidencia-titulo span { color: #4f46e5; }
.bloque h4 { display: flex; justify-content: space-between; gap: 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
.usuario { font-family: Consolas, monospace; font-size: 7.5pt; font-weight: 600; background: #111827; color: #a5b4fc; padding: 1px 6px; border-radius: 3px; white-space: nowrap; }
.pregunta { font-size: 11pt; font-weight: 600; font-style: italic; color: #312e81; background: #eef2ff; padding: 8px 12px; border-radius: 6px; }
`;

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Proyecto U1 · Base de datos en la nube (Neon + PostgreSQL) · Sistema de inventario Nexo</title>
<style>${css}</style>
</head>
<body>
${portada}
${indice}
${introduccion}
${diseno}
${roles}
${vistasFunciones}
${evidenciasHtml}
${aplicacion}
${reflexion}
</body>
</html>`;

fs.mkdirSync(DIR, { recursive: true });
const archivoHtml = path.join(DIR, 'Reporte_Proyecto_U1.html');
fs.writeFileSync(archivoHtml, html);
console.log(`HTML: ${path.relative(RAIZ, archivoHtml)}`);

// ---------------------------------------------------------------------
// PDF con un navegador Chromium (Chrome, Edge o el indicado en CHROME_PATH)
// ---------------------------------------------------------------------
(async () => {
  let chromium;
  try { ({ chromium } = require('playwright-core')); } catch {
    console.log('playwright-core no está instalado: abre el HTML en tu navegador y usa Imprimir → Guardar como PDF.');
    return;
  }
  const intentos = [
    process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH },
    { channel: 'msedge' }, { channel: 'chrome' }, {},
  ].filter(Boolean);
  let navegador;
  for (const op of intentos) {
    try { navegador = await chromium.launch(op); break; } catch { /* siguiente */ }
  }
  if (!navegador) {
    console.log('No se encontró Chrome/Edge: abre el HTML en tu navegador y usa Imprimir → Guardar como PDF.');
    return;
  }
  const pagina = await navegador.newPage();
  await pagina.goto('file://' + archivoHtml.replace(/\\/g, '/'), { waitUntil: 'load' });
  const archivoPdf = path.join(DIR, 'Reporte_Proyecto_U1.pdf');
  await pagina.pdf({
    path: archivoPdf,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div style="font-size:7px;color:#9ca3af;width:100%;padding:0 16mm;text-align:right;font-family:Arial">Proyecto U1 · Neon + PostgreSQL · Sistema de inventario Nexo</div>',
    footerTemplate: '<div style="font-size:8px;color:#6b7280;width:100%;text-align:center;font-family:Arial"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '18mm', bottom: '18mm', left: '16mm', right: '16mm' },
  });
  await navegador.close();
  console.log(`PDF:  ${path.relative(RAIZ, archivoPdf)}`);
})().catch((e) => { console.error('No se pudo generar el PDF:', e.message); process.exitCode = 1; });
