/** Sección de administración (sólo rol admin) */
const express = require('express');
const bcrypt = require('bcryptjs');
const { query, uno, mensajeError } = require('../db');
const { registrarBitacora } = require('../middleware');

const router = express.Router();

router.get('/', (req, res) => res.redirect('/admin/usuarios'));

// ---------------------------------------------------------------------
// Usuarios de la aplicación
// ---------------------------------------------------------------------
router.get('/usuarios', async (req, res) => {
  const usuarios = await query(
    `SELECT u.*, COUNT(m.id_movimiento)::int AS movimientos,
            (SELECT string_agg(a.nombre, ', ') FROM almacenes a WHERE a.id_responsable = u.id_usuario) AS almacenes
     FROM usuarios u LEFT JOIN movimientos m ON m.id_usuario = u.id_usuario
     GROUP BY u.id_usuario ORDER BY u.activo DESC, u.rol, u.nombre`,
  );
  res.render('admin/usuarios', { titulo: 'Usuarios', usuarios });
});

router.get('/usuarios/nuevo', (req, res) => {
  res.render('admin/usuario_form', { titulo: 'Nuevo usuario', u: { rol: 'usuario', activo: true } });
});

function leerUsuario(body) {
  return {
    nombre: String(body.nombre || '').trim(),
    apellidos: String(body.apellidos || '').trim(),
    correo: String(body.correo || '').trim().toLowerCase(),
    rol: body.rol === 'admin' ? 'admin' : 'usuario',
    puesto: String(body.puesto || '').trim() || null,
    activo: body.activo === 'on' || body.activo === 'true',
    password: String(body.password || ''),
  };
}

router.post('/usuarios', async (req, res) => {
  const u = leerUsuario(req.body);
  try {
    if (!u.nombre || !u.apellidos || !u.correo) throw Object.assign(new Error('Nombre, apellidos y correo son obligatorios.'), { code: 'P0001' });
    if (u.password.length < 8) throw Object.assign(new Error('La contraseña debe tener al menos 8 caracteres.'), { code: 'P0001' });
    await query(
      `INSERT INTO usuarios (nombre, apellidos, correo, password_hash, rol, puesto, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [u.nombre, u.apellidos, u.correo, await bcrypt.hash(u.password, 10), u.rol, u.puesto, u.activo],
    );
    await registrarBitacora(req, 'CREAR', 'Usuarios', `${u.correo} (${u.rol})`);
    req.flash('exito', `Usuario ${u.correo} creado.`);
    res.redirect('/admin/usuarios');
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('admin/usuario_form', { titulo: 'Nuevo usuario', u, error: msg });
  }
});

router.get('/usuarios/:id/editar', async (req, res, next) => {
  const u = await uno('SELECT * FROM usuarios WHERE id_usuario = $1', [Number(req.params.id)]);
  if (!u) return next();
  res.render('admin/usuario_form', { titulo: 'Editar usuario', u });
});

router.post('/usuarios/:id', async (req, res) => {
  const id = Number(req.params.id);
  const u = leerUsuario(req.body);
  const esYo = id === req.session.usuario.id;
  try {
    if (esYo && (!u.activo || u.rol !== 'admin')) {
      throw Object.assign(new Error('No puedes quitarte el rol de administrador ni desactivar tu propia cuenta.'), { code: 'P0001' });
    }
    if (u.password && u.password.length < 8) throw Object.assign(new Error('La nueva contraseña debe tener al menos 8 caracteres.'), { code: 'P0001' });
    await query(
      `UPDATE usuarios SET nombre = $1, apellidos = $2, correo = $3, rol = $4, puesto = $5, activo = $6,
              password_hash = COALESCE($7, password_hash)
       WHERE id_usuario = $8`,
      [u.nombre, u.apellidos, u.correo, u.rol, u.puesto, u.activo, u.password ? await bcrypt.hash(u.password, 10) : null, id],
    );
    await registrarBitacora(req, 'EDITAR', 'Usuarios', `${u.correo} (${u.rol}${u.activo ? '' : ', inactivo'}${u.password ? ', contraseña restablecida' : ''})`);
    req.flash('exito', 'Usuario actualizado.');
    res.redirect('/admin/usuarios');
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    res.status(400).render('admin/usuario_form', { titulo: 'Editar usuario', u: { ...u, id_usuario: id }, error: msg });
  }
});

// ---------------------------------------------------------------------
// Almacenes
// ---------------------------------------------------------------------
router.get('/almacenes', async (req, res) => {
  const [almacenes, usuarios] = await Promise.all([
    query(
      `SELECT a.*, u.nombre || ' ' || u.apellidos AS responsable,
              fn_valor_inventario(NULL, a.id_almacen) AS valor,    -- función de cálculo
              (SELECT COALESCE(SUM(existencia), 0) FROM inventario i WHERE i.id_almacen = a.id_almacen) AS unidades,
              (SELECT COUNT(*) FROM inventario i WHERE i.id_almacen = a.id_almacen AND i.existencia > 0)::int AS productos
       FROM almacenes a LEFT JOIN usuarios u ON u.id_usuario = a.id_responsable
       ORDER BY a.id_almacen`,
    ),
    query('SELECT id_usuario, nombre, apellidos FROM usuarios WHERE activo ORDER BY nombre'),
  ]);
  const editar = req.query.editar ? almacenes.find((a) => String(a.id_almacen) === req.query.editar) : null;
  res.render('admin/almacenes', { titulo: 'Almacenes', almacenes, usuarios, editar });
});

router.post('/almacenes', async (req, res) => {
  const id = Number(req.body.id_almacen) || null;
  const a = {
    nombre: String(req.body.nombre || '').trim(),
    ubicacion: String(req.body.ubicacion || '').trim() || null,
    id_responsable: Number(req.body.id_responsable) || null,
    activo: req.body.activo === 'on',
  };
  try {
    if (!a.nombre) throw Object.assign(new Error('El nombre es obligatorio.'), { code: 'P0001' });
    if (id) {
      await query('UPDATE almacenes SET nombre = $1, ubicacion = $2, id_responsable = $3, activo = $4 WHERE id_almacen = $5',
        [a.nombre, a.ubicacion, a.id_responsable, a.activo, id]);
    } else {
      await query('INSERT INTO almacenes (nombre, ubicacion, id_responsable, activo) VALUES ($1, $2, $3, TRUE)',
        [a.nombre, a.ubicacion, a.id_responsable]);
    }
    await registrarBitacora(req, id ? 'EDITAR' : 'CREAR', 'Almacenes', a.nombre);
    req.flash('exito', id ? 'Almacén actualizado.' : 'Almacén creado.');
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    req.flash('error', msg);
  }
  res.redirect('/admin/almacenes');
});

// ---------------------------------------------------------------------
// Tipos de movimiento
// ---------------------------------------------------------------------
router.get('/tipos', async (req, res) => {
  const tipos = await query(
    `SELECT t.*, COUNT(m.id_movimiento)::int AS usos, MAX(m.fecha) AS ultimo_uso
     FROM tipos_movimiento t LEFT JOIN movimientos m ON m.id_tipo = t.id_tipo
     GROUP BY t.id_tipo ORDER BY t.naturaleza, t.nombre`,
  );
  const editar = req.query.editar ? tipos.find((t) => String(t.id_tipo) === req.query.editar) : null;
  res.render('admin/tipos', { titulo: 'Tipos de movimiento', tipos, editar });
});

router.post('/tipos', async (req, res) => {
  const id = Number(req.body.id_tipo) || null;
  const t = {
    nombre: String(req.body.nombre || '').trim(),
    naturaleza: req.body.naturaleza === 'SALIDA' ? 'SALIDA' : 'ENTRADA',
    requiere_proveedor: req.body.requiere_proveedor === 'on',
    descripcion: String(req.body.descripcion || '').trim() || null,
  };
  try {
    if (!t.nombre) throw Object.assign(new Error('El nombre es obligatorio.'), { code: 'P0001' });
    if (id) {
      // La naturaleza no se modifica en tipos ya usados: alteraría el significado del kardex
      await query(
        `UPDATE tipos_movimiento SET nombre = $1, requiere_proveedor = $2, descripcion = $3,
                naturaleza = CASE WHEN EXISTS (SELECT 1 FROM movimientos WHERE id_tipo = $5) THEN naturaleza ELSE $4 END
         WHERE id_tipo = $5`, [t.nombre, t.requiere_proveedor, t.descripcion, t.naturaleza, id],
      );
    } else {
      await query('INSERT INTO tipos_movimiento (nombre, naturaleza, requiere_proveedor, descripcion) VALUES ($1, $2, $3, $4)',
        [t.nombre, t.naturaleza, t.requiere_proveedor, t.descripcion]);
    }
    await registrarBitacora(req, id ? 'EDITAR' : 'CREAR', 'Tipos de movimiento', `${t.nombre} (${t.naturaleza})`);
    req.flash('exito', id ? 'Tipo actualizado.' : 'Tipo de movimiento creado.');
  } catch (err) {
    const msg = mensajeError(err);
    if (!msg) throw err;
    req.flash('error', msg);
  }
  res.redirect('/admin/tipos');
});

// ---------------------------------------------------------------------
// Bitácora
// ---------------------------------------------------------------------
router.get('/bitacora', async (req, res) => {
  const filtros = { usuario: req.query.usuario || '', modulo: req.query.modulo || '' };
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
  const params = [filtros.usuario ? Number(filtros.usuario) : null, filtros.modulo || null];
  const where = 'WHERE ($1::int IS NULL OR b.id_usuario = $1) AND ($2::text IS NULL OR b.modulo = $2)';
  const [registros, total, usuarios, modulos] = await Promise.all([
    query(`SELECT b.*, u.nombre || ' ' || u.apellidos AS usuario, u.rol
           FROM bitacora b LEFT JOIN usuarios u ON u.id_usuario = b.id_usuario
           ${where} ORDER BY b.fecha DESC LIMIT 30 OFFSET ${(pagina - 1) * 30}`, params),
    uno(`SELECT COUNT(*)::int AS n FROM bitacora b ${where}`, params),
    query('SELECT id_usuario, nombre, apellidos FROM usuarios ORDER BY nombre'),
    query('SELECT DISTINCT modulo FROM bitacora ORDER BY modulo'),
  ]);
  res.render('admin/bitacora', {
    titulo: 'Bitácora', registros, usuarios, modulos, filtros, pagina, paginas: Math.max(1, Math.ceil(total.n / 30)),
  });
});

// ---------------------------------------------------------------------
// Base de datos: roles, permisos, vistas y funciones (evidencia en vivo)
// ---------------------------------------------------------------------
router.get('/base-datos', async (req, res) => {
  const [conexion, roles, privTablas, privEsquema, defaults, vistas, funciones] = await Promise.all([
    uno(`SELECT current_user, session_user, current_database() AS bd,
                split_part(version(), ' on ', 1) AS version,
                (SELECT string_agg(r.rolname, ', ') FROM pg_auth_members am JOIN pg_roles r ON r.oid = am.roleid
                 WHERE am.member = (SELECT oid FROM pg_roles WHERE rolname = current_user)) AS roles_heredados`),
    query(`SELECT r.rolname, r.rolcanlogin, r.rolinherit, r.rolcreaterole, r.rolcreatedb,
                  COALESCE((SELECT string_agg(g.rolname, ', ') FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid
                            WHERE m.member = r.oid), '') AS miembro_de,
                  shobj_description(r.oid, 'pg_authid') AS descripcion
           FROM pg_roles r
           WHERE r.rolname IN ('developer', 'user', 'dev_ana', 'dev_luis', 'app_nexo', 'usr_carlos')
           ORDER BY r.rolcanlogin AND r.rolname NOT IN ('developer', 'user'), r.rolname`),
    query(`SELECT c.relname AS tabla, c.relkind,
                  has_table_privilege('developer', c.oid, 'SELECT') AS dev_s,
                  has_table_privilege('developer', c.oid, 'INSERT') AS dev_i,
                  has_table_privilege('developer', c.oid, 'UPDATE') AS dev_u,
                  has_table_privilege('developer', c.oid, 'DELETE') AS dev_d,
                  has_table_privilege('user', c.oid, 'SELECT') AS usr_s,
                  has_table_privilege('user', c.oid, 'INSERT') AS usr_i,
                  has_table_privilege('user', c.oid, 'UPDATE') AS usr_u,
                  has_table_privilege('user', c.oid, 'DELETE') AS usr_d
           FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'v')
           ORDER BY c.relkind, c.relname`),
    query(`SELECT r AS rol,
                  has_database_privilege(r, current_database(), 'CONNECT') AS conectar,
                  has_database_privilege(r, current_database(), 'TEMP') AS temporales,
                  has_schema_privilege(r, 'public', 'USAGE') AS usar_public,
                  has_schema_privilege(r, 'public', 'CREATE') AS crear_en_public
           FROM unnest(ARRAY['developer', 'user']) AS r`),
    query(`SELECT pg_get_userbyid(d.defaclrole) AS creador,
                  CASE d.defaclobjtype WHEN 'r' THEN 'Tablas' WHEN 'S' THEN 'Secuencias' WHEN 'f' THEN 'Funciones' ELSE d.defaclobjtype::text END AS objetos,
                  array_to_string(d.defaclacl, E'\n') AS permisos
           FROM pg_default_acl d
           WHERE pg_get_userbyid(d.defaclrole) IN ('nexo_inventario_owner', 'developer')
           ORDER BY 1, 2`),
    query(`SELECT viewname AS nombre, obj_description(format('%I', viewname)::regclass, 'pg_class') AS descripcion,
                  pg_get_viewdef(format('%I', viewname)::regclass, true) AS definicion
           FROM pg_views WHERE schemaname = 'public' ORDER BY viewname`),
    query(`SELECT p.proname AS nombre, pg_get_function_identity_arguments(p.oid) AS argumentos,
                  pg_get_function_result(p.oid) AS retorna, l.lanname AS lenguaje,
                  obj_description(p.oid, 'pg_proc') AS descripcion
           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang
           WHERE n.nspname = 'public' ORDER BY p.proname`),
  ]);
  res.render('admin/base_datos', {
    titulo: 'Base de datos', conexion, roles, privTablas, privEsquema, defaults, vistas, funciones,
    prueba: req.session.pruebaPermisos || null,
  });
  delete req.session.pruebaPermisos;
});

// Intenta crear una tabla con la conexión de la app (usuario del rol "user"): debe fallar
router.post('/base-datos/probar', async (req, res) => {
  let resultado;
  try {
    await query('CREATE TABLE prueba_permisos_app (id INTEGER)');
    await query('DROP TABLE prueba_permisos_app');
    resultado = { ok: true, mensaje: 'La tabla se creó: la conexión TIENE permiso de creación (revisa los roles).' };
  } catch (err) {
    resultado = { ok: false, codigo: err.code, mensaje: err.message };
  }
  await registrarBitacora(req, 'PRUEBA', 'Base de datos', `CREATE TABLE con la conexión de la app → ${resultado.ok ? 'permitido' : `${resultado.codigo} ${resultado.mensaje}`}`);
  req.session.pruebaPermisos = resultado;
  res.redirect('/admin/base-datos#prueba');
});

module.exports = router;
