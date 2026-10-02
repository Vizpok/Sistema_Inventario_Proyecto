/** Funciones de formato disponibles en todas las vistas EJS. */
const ZONA = 'America/Mexico_City';

const fmtMoneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });
const fmtNumero = new Intl.NumberFormat('es-MX');
const fmtFecha = new Intl.DateTimeFormat('es-MX', { timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric' });
const fmtFechaHora = new Intl.DateTimeFormat('es-MX', {
  timeZone: ZONA, day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

const moneda = (v) => fmtMoneda.format(Number(v || 0));
const numero = (v) => fmtNumero.format(Number(v || 0));
const fecha = (d) => (d ? fmtFecha.format(new Date(d)) : '—');
const fechaHora = (d) => (d ? fmtFechaHora.format(new Date(d)) : '—');

/** "hace 3 h", "hace 2 d" */
function relativo(d) {
  if (!d) return '—';
  const seg = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  if (seg < 3600) return `hace ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `hace ${Math.floor(seg / 3600)} h`;
  if (seg < 86400 * 30) return `hace ${Math.floor(seg / 86400)} d`;
  return fecha(d);
}

const CLASE_ESTADO = { 'SIN STOCK': 'rojo', BAJO: 'ambar', NORMAL: 'verde', EXCESO: 'azul' };
const claseEstado = (estado) => CLASE_ESTADO[estado] || 'gris';

/** Iniciales para avatares */
const iniciales = (nombre = '', apellidos = '') =>
  `${nombre.trim()[0] || ''}${apellidos.trim()[0] || ''}`.toUpperCase();

/** Construye una URL conservando los filtros actuales (para paginación) */
function urlCon(base, filtros, cambios = {}) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...filtros, ...cambios })) {
    if (v !== undefined && v !== null && v !== '') p.set(k, v);
  }
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}

module.exports = { moneda, numero, fecha, fechaHora, relativo, claseEstado, iniciales, urlCon, ZONA };
