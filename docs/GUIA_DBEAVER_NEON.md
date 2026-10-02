# Guía: evidencias con DBeaver y la consola de Neon

Esta guía sirve para tomar las capturas de las evidencias 1–7 ejecutando las consultas en
**DBeaver** y en el **SQL Editor de Neon**. Las capturas que guardes en `docs/capturas/manual/` se
insertan solas en el PDF al ejecutar `npm run reporte`.

Tiempo estimado: 20–30 minutos.

---

## 1. Consola de Neon

Entra a <https://console.neon.tech> → proyecto **nexo-inventario-u1**.

### Capturas de la consola

| Captura | Dónde | Guardar como |
|---|---|---|
| Proyecto (versión, región, rama `main`) | *Dashboard* del proyecto | `ev1-neon-proyecto.png` |
| Base de datos y propietario | *Branches → main → Databases* | `ev1-neon-base-datos.png` |
| Las 10 tablas | *Tables* (esquema `public`) | `ev2-neon-tablas.png` |
| Usuarios de BD | *Branches → main → Roles* | `ev4-neon-roles.png` |

### SQL Editor de Neon

Por defecto el SQL Editor usa el **rol propietario** (`nexo_inventario_owner`; si ves un selector de rol, elige ese). Úsalo para los pasos marcados como `owner`
(tabla de la sección 3). Elige rama **main** y base de datos **nexo_inventario**, pega el contenido del
archivo y pulsa **Run**. Neon muestra el resultado de cada sentencia.

### Datos de conexión para DBeaver

Botón **Connect** → base de datos `nexo_inventario` → **desactiva “Connection pooling”** (DBeaver
funciona mejor con el host directo, el que **no** termina en `-pooler`). Anota el **host**.

---

## 2. DBeaver

### 2.1 Crear la conexión del propietario

1. **Base de datos → Nueva conexión → PostgreSQL**.
2. Pestaña **Main**:
   - **Host:** el host directo de Neon (`ep-…​.us-east-2.aws.neon.tech`)
   - **Port:** `5432`
   - **Database:** `nexo_inventario`
   - **Authentication:** Database Native
   - **Username:** `nexo_inventario_owner` · **Password:** la de Neon (botón *Connect*)
3. Pestaña **SSL**: marca **Use SSL** y en **SSL mode** elige **require**.
4. **Test Connection** (la primera vez descarga el driver) → **Finish**.
5. Clic derecho en la conexión → **Rename** → `Neon · owner`.

### 2.2 Una conexión por usuario

Copia la conexión (**Ctrl+C / Ctrl+V** en el navegador de bases de datos), abre sus propiedades
(**F4**) y cambia sólo usuario, contraseña y nombre:

| Nombre de la conexión | Username | Rol |
|---|---|---|
| `Neon · owner` | `nexo_inventario_owner` | propietario |
| `Neon · dev_ana` | `dev_ana` | `developer` |
| `Neon · usr_carlos` | `usr_carlos` | `"user"` |
| `Neon · app_nexo` | `app_nexo` | `"user"` (cuenta de la app) |

Las contraseñas de `dev_ana`, `usr_carlos` y `app_nexo` son las de tu archivo `.env`
(`PWD_DEV_ANA`, `PWD_USR_CARLOS`, `PWD_APP_NEXO`).

📸 Captura opcional del panel con las 4 conexiones → `ev1-dbeaver-conexiones.png`.

### 2.3 Ajustes importantes

- **Auto-commit activado** (ícono de la barra de herramientas). Si está en modo manual, después de un
  error esperado las siguientes sentencias fallarían con *current transaction is aborted*.
- Algunas sentencias **deben fallar** (están marcadas con `⚠ ESTA SENTENCIA DEBE FALLAR`). Cuando
  DBeaver muestre el diálogo de error, elige **Ignorar / Skip** para que siga con el resto.
  También puedes dejarlo fijo en *Ventana → Preferencias → Editores → Editor SQL → Procesamiento SQL →
  Manejo de errores: Ignorar*.

### 2.4 Diagrama ER con DBeaver (opcional)

En el navegador: `nexo_inventario → Schemas → public` → clic derecho → **Ver diagrama**. Acomoda las
tablas, clic derecho en el lienzo → **Exportar diagrama → PNG** → guárdalo como
`docs/capturas/manual/er-dbeaver.png`. Aparece en la sección 2 del PDF.

---

## 3. Ejecutar las evidencias (en este orden)

Los archivos están en [`database/evidencias_manual/`](../database/evidencias_manual). Ábrelos en DBeaver
con **Archivo → Abrir archivo**, elige la conexión activa en la barra de herramientas (**Ctrl+9**) y
pulsa **Alt+X** (*Ejecutar script*): cada resultado aparece en su propia pestaña.

| Paso | Archivo | Conexión | Captura |
|---|---|---|---|
| 01 | `01_ev1_owner.sql` | SQL Editor de Neon o `Neon · owner` | `ev1-01-owner.png` |
| 02 | `02_ev2_owner.sql` | SQL Editor de Neon o `Neon · owner` | `ev2-02-owner.png` |
| 03 | `03_ev3_owner.sql` | SQL Editor de Neon o `Neon · owner` | `ev3-03-owner.png` |
| 04 | `04_ev4_owner.sql` | SQL Editor de Neon o `Neon · owner` | `ev4-04-owner.png` |
| 05 | `05_ev4_dev_ana.sql` | `Neon · dev_ana` | `ev4-05-dev_ana.png` |
| 06 | `06_ev4_usr_carlos.sql` | `Neon · usr_carlos` | `ev4-06-usr_carlos.png` (incluye los errores de permiso) |
| 07 | `07_ev4_dev_ana.sql` | `Neon · dev_ana` | `ev4-07-dev_ana.png` |
| 08 | `08_ev5_owner.sql` | SQL Editor de Neon o `Neon · owner` | `ev5-08-owner.png` |
| 09 | `09_ev5_usr_carlos.sql` | `Neon · usr_carlos` | `ev5-09-usr_carlos.png` |
| 10 | `10_ev6_owner.sql` | SQL Editor de Neon o `Neon · owner` | `ev6-10-owner.png` |
| 11 | `11_ev6_usr_carlos.sql` | `Neon · usr_carlos` | `ev6-11-usr_carlos.png` |
| 12 | `12_ev7_app_nexo.sql` | `Neon · app_nexo` | `ev7-12-app_nexo.png` |

- Si un paso tiene varios resultados importantes, toma varias capturas con sufijo:
  `ev4-06-usr_carlos-a.png`, `ev4-06-usr_carlos-b.png`, …
- En cada captura procura que se vea **el nombre de la conexión**, **la consulta** y **el resultado**.
- El paso 05 crea la tabla `evidencia_developer` y el 07 la borra: ejecútalos en orden. Si repites
  el 05 sin haber hecho el 07, fallará porque la tabla ya existe.

### ¿Los números no coinciden con el PDF?

Es normal. Los pasos 11 y 12 **registran movimientos reales** con `fn_registrar_movimiento`, así que
cada ejecución crea folios nuevos y cambia existencias. Si quieres empezar desde los datos
originales antes de tomar las capturas:

```bash
npm run sql -- database/00_reiniciar_datos.sql database/05_datos_prueba.sql
```

---

## Demostración de funciones en DBeaver (Evidencia 6)

Para mostrar las funciones en vivo, abre
[`database/evidencias_manual/demo_funciones_dbeaver.sql`](../database/evidencias_manual/demo_funciones_dbeaver.sql)
con la conexión **`Neon · usr_carlos`** y ejecuta paso a paso con **Ctrl+Enter**:

| Paso | Qué muestra | Captura sugerida |
|---|---|---|
| 1 | Las 2 funciones: tipo (cálculo / inserción), parámetros, retorno y lenguaje | `ev6-dbeaver-1-funciones.png` |
| 2 | El código fuente de cada una (`pg_get_functiondef`; doble clic en la celda para verlo completo) | `ev6-dbeaver-2-codigo.png` |
| 3 | `fn_valor_inventario`: total, por almacén, por categoría y comprobación de que cuadra | `ev6-dbeaver-3-calculo.png` |
| 4 | `fn_registrar_movimiento`: existencia antes → entrada de 25 → salida de 4 → kardex → existencia después | `ev6-dbeaver-4-insercion.png` |
| 5 | Validaciones que **deben fallar** (sin existencia, sin proveedor, cantidad 0) | `ev6-dbeaver-5-validaciones.png` |
| 6 | Las dos funciones juntas: el valor del inventario ya refleja los movimientos | `ev6-dbeaver-6-resultado.png` |

**En el navegador de DBeaver** también se ven las funciones como objetos de la base:
`Neon · usr_carlos → nexo_inventario → Esquemas → public → Funciones`. Doble clic en
`fn_registrar_movimiento` → pestaña **Código fuente** (*Source*) muestra el PL/pgSQL, y la pestaña
**Propiedades** los parámetros. Captura: `ev6-dbeaver-navegador.png`.

Guarda las capturas en `docs/capturas/manual/`; las que empiezan con `ev6-` aparecen solas en la
Evidencia 6 del PDF al ejecutar `npm run reporte`.

---

## 4. Regenerar el PDF con tus capturas

1. Guarda las imágenes (PNG o JPG) en `docs/capturas/manual/` con los nombres de las tablas.
2. (Opcional) Llena alumno, matrícula, grupo y docente en `docs/reporte/datos.json`.
3. Ejecuta:

   ```bash
   npm run reporte
   ```

   En Windows usa Microsoft Edge o Chrome para crear el PDF. Si no encuentra ninguno, abre
   `docs/reporte/Reporte_Proyecto_U1.html` en el navegador → **Imprimir → Guardar como PDF**.

Cada captura aparece en su evidencia bajo “Capturas en DBeaver y en la consola de Neon”. Para cambiar
el texto de una figura, agrégalo en `docs/capturas/manual/pies.json` (`"archivo.png": "texto"`).

---

## Problemas frecuentes

| Mensaje | Solución |
|---|---|
| `Endpoint ID is not specified` | Actualiza el driver de PostgreSQL en DBeaver, o en *Driver properties* agrega `options` = `endpoint=<id del endpoint>` (la primera parte del host, `ep-…`). |
| `password authentication failed` | Revisa usuario y contraseña; las de los usuarios creados por script están en `.env`. |
| `SSL off` / `no pg_hba.conf entry` | En la pestaña SSL elige **require**. |
| La conexión tarda la primera vez | Neon suspende el cómputo sin uso; el primer intento lo despierta. Reintenta. |
| `current transaction is aborted` | Activa auto-commit (sección 2.3). |
| `permission denied for schema public` con `usr_carlos` | ¡Es lo esperado! Demuestra que el rol `"user"` no puede crear objetos. |
