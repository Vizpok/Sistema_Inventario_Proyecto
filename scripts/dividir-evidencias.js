#!/usr/bin/env node
/**
 * Divide database/06_evidencias.sql en archivos pequeños para ejecutarlos a
 * mano en DBeaver o en el SQL Editor de Neon: uno por cada cambio de usuario,
 * numerados en el orden en que deben ejecutarse.
 *
 * Salida: database/evidencias_manual/NN_evX_<usuario>.sql
 * Uso: npm run evidencias:dividir
 */
const fs = require('fs');
const path = require('path');
const { leerBloques } = require('./evidencias');

const RAIZ = path.join(__dirname, '..');
const DESTINO = path.join(RAIZ, 'database', 'evidencias_manual');
const evidencias = leerBloques(fs.readFileSync(path.join(RAIZ, 'database', '06_evidencias.sql'), 'utf8'));

const CONEXION = {
  owner: 'SQL Editor de Neon (rol propietario) o DBeaver con la conexión "Neon · owner"',
  dev_ana: 'DBeaver con la conexión "Neon · dev_ana" (rol developer)',
  usr_carlos: 'DBeaver con la conexión "Neon · usr_carlos" (rol "user")',
  app_nexo: 'DBeaver con la conexión "Neon · app_nexo" (rol "user", cuenta de la aplicación)',
};

// Agrupa secciones consecutivas del mismo usuario dentro de cada evidencia
const archivos = [];
for (const ev of evidencias) {
  ev.secciones.forEach((sec, i) => {
    const ultimo = archivos[archivos.length - 1];
    if (ultimo && ultimo.ev === ev.numero && ultimo.como === sec.como) ultimo.secciones.push({ ...sec, n: i + 1 });
    else archivos.push({ ev: ev.numero, titulo: ev.titulo, como: sec.como, secciones: [{ ...sec, n: i + 1 }] });
  });
}

fs.mkdirSync(DESTINO, { recursive: true });
for (const f of fs.readdirSync(DESTINO)) if (f.endsWith('.sql')) fs.unlinkSync(path.join(DESTINO, f));

archivos.forEach((a, i) => {
  const num = String(i + 1).padStart(2, '0');
  const nombre = `${num}_ev${a.ev}_${a.como}.sql`;
  const captura = `ev${a.ev}-${num}-${a.como}.png`;
  const lineas = [
    '-- =====================================================================',
    `-- Paso ${num} · Evidencia ${a.ev}: ${a.titulo}`,
    `-- Ejecutar con: ${CONEXION[a.como] || a.como}`,
    '-- En DBeaver: abre este archivo, elige la conexión indicada y pulsa',
    '--             Alt+X (Ejecutar script): cada resultado sale en su pestaña.',
    `-- Captura sugerida: docs/capturas/manual/${captura}`,
    '--   (que se vea el nombre de la conexión, la consulta y el resultado)',
    '-- Archivo generado desde database/06_evidencias.sql — no editar a mano.',
    '-- =====================================================================',
    '',
  ];
  for (const sec of a.secciones) {
    lineas.push(`-- ${a.ev}.${sec.n} ${sec.titulo}`);
    for (const s of sec.sentencias) {
      if (s.esperaError) lineas.push('-- ⚠ ESTA SENTENCIA DEBE FALLAR (demuestra que el permiso o la validación funciona)');
      lineas.push(s.sql, '');
    }
  }
  fs.writeFileSync(path.join(DESTINO, nombre), lineas.join('\n'));
  console.log(`${nombre}  →  ${CONEXION[a.como] ? a.como : '?'}`);
});
