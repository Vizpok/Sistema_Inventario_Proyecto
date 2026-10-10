# Prompt para completar capturas y documento

Copia el bloque en una conversación con Claude que tenga acceso a tu computadora (Claude Desktop con
uso de la computadora, o Desktop Commander) donde estén instalados **DBeaver**, **Node.js**, **Git** y
un navegador con sesión iniciada en **Neon**.

---

```text
Actúa como asistente de mi proyecto de la Unidad 1 de Bases de Datos Relacionales
("Implementación completa de una base de datos en la nube: Neon + PostgreSQL").
ANTES de hacer cualquier cosa, dime en una lista numerada exactamente qué vas a realizar
(qué programas abrirás, qué archivos ejecutarás, qué capturas tomarás y con qué nombre) y
espera a que yo te diga "adelante". Después ve informándome al terminar cada fase.

IMPORTANTE: el proyecto YA ESTÁ TERMINADO y publicado en mi repositorio de GitHub. La base de
datos ya existe en Neon con sus tablas, roles, usuarios, vistas, funciones y datos; la
aplicación web, los scripts SQL, las evidencias en texto y el PDF ya están en el repositorio.
NO crees ni recrees nada (ni proyectos, ni bases de datos, ni tablas, ni código): tu trabajo es
sólo tomar las capturas en DBeaver y en la consola de Neon, completar la portada y regenerar el
PDF. Si no sabes en qué carpeta de mi computadora está el repositorio, pregúntame antes de clonarlo.

CONTEXTO
- Repositorio: https://github.com/Vizpok/Sistema_Inventario_Proyecto
  (trabaja sobre la rama main; si todavía no se ha fusionado el pull request, usa la rama
  claude/inventory-system-dashboard-872tbe).
- Neon: proyecto "nexo-inventario-u1", rama main, base de datos "nexo_inventario",
  propietario "nexo_inventario_owner". Para DBeaver usa el host directo (sin "-pooler"),
  puerto 5432 y SSL en modo require.
- Usuarios de BD: dev_ana y dev_luis (rol developer); app_nexo y usr_carlos (rol "user").
  Las contraseñas están en el archivo .env del proyecto (PWD_DEV_ANA, PWD_USR_CARLOS,
  PWD_APP_NEXO); la del propietario está en Neon → botón Connect.
- La guía completa está en docs/GUIA_DBEAVER_NEON.md. Léela primero y síguela.

TAREAS
1. Preparar: clonar o actualizar el repositorio (git pull), ejecutar "npm install" y
   verificar que exista .env (si no existe, avísame; NO inventes contraseñas).
2. Consola de Neon: tomar las capturas ev1-neon-proyecto.png, ev1-neon-base-datos.png,
   ev2-neon-tablas.png y ev4-neon-roles.png como indica la guía.
3. DBeaver: crear 4 conexiones ("Neon · owner", "Neon · dev_ana", "Neon · usr_carlos",
   "Neon · app_nexo") con auto-commit activado; capturar el panel de conexiones como
   ev1-dbeaver-conexiones.png.
4. Ejecutar EN ORDEN los 12 archivos de database/evidencias_manual/ con la conexión que
   indica el encabezado de cada uno (Alt+X). Las sentencias marcadas "⚠ ESTA SENTENCIA
   DEBE FALLAR" deben fallar: en el diálogo de error elige "Ignorar" y captura el error,
   porque es la evidencia de que el permiso funciona.
5. Tomar una captura por paso con el nombre sugerido en el encabezado del archivo
   (ej. ev4-06-usr_carlos.png). Si un paso tiene varios resultados, usa sufijos -a, -b.
   En cada captura deben verse el nombre de la conexión, la consulta y el resultado.
6. Exportar el diagrama ER de DBeaver (esquema public → Ver diagrama → Exportar PNG) como
   er-dbeaver.png.
7. Guardar todas las imágenes en docs/capturas/manual/.
8. Preguntarme mis datos para la portada (alumno, matrícula, grupo, docente, institución,
   carrera) y escribirlos en docs/reporte/datos.json.
9. Ejecutar "npm run reporte", abrir docs/reporte/Reporte_Proyecto_U1.pdf y revisar que
   cada captura aparezca en su evidencia, que se lea bien y que no haya páginas vacías.
   Muéstrame un resumen de lo que revisaste.
10. Hacer commit de las capturas, datos.json y el PDF, y hacer push a la misma rama.

REGLAS
- No subas nunca el archivo .env ni escribas contraseñas en archivos del repositorio,
  capturas o mensajes de commit (si una contraseña aparece en pantalla, tápala o recorta).
- No modifiques tablas, roles, vistas ni funciones: sólo ejecuta los scripts de
  evidencias_manual. Si algo falla de forma inesperada, detente y muéstrame el error.
- Si Neon tarda en responder la primera vez, espera y reintenta (el cómputo se suspende).
- Es normal que folios y existencias difieran de los del PDF, porque los pasos 11 y 12
  registran movimientos reales.
```
