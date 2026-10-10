# Despliegue en Neon Functions

La aplicación está publicada como la función **`nexo`** en la rama `main` del proyecto de Neon
`nexo-inventario-u1`, junto a la base de datos:

**https://br-broad-wildflower-b59kivdz-nexo.compute.c-7.us-east-2.aws.neon.tech/**

## Cómo funciona

```
Navegador ──HTTPS──► Neon Function "nexo" (Node.js 24)
                       │ 1er request: descarga el código de GitHub (commit fijo)
                       │ arranque.mjs ─► dist/servidor.mjs ─► Express (127.0.0.1)
                       └──SQL──► Postgres nexo_inventario  (usuario app_nexo, rol "user")
```

| Archivo | Qué es |
|---|---|
| `arranque.mjs` | La función que se sube a Neon (2 KB). En el arranque en frío descarga `NEXO_TARBALL_URL`, extrae `src/`, `public/` y `deploy/neon/`, y carga el bundle. |
| `servidor.js` | Adaptador: Neon llama `fetch(request)`; aquí se levanta Express en un puerto interno y se le reenvía la petición. |
| `dist/servidor.mjs` | App + dependencias empaquetadas con esbuild (no hay `node_modules` en Neon). |
| `vendor/chart.umd.min.js` | Chart.js para las gráficas del dashboard. |

La sesión vive en **una sola cookie firmada** (`src/sesion.js`) porque Neon conserva un solo
encabezado `Set-Cookie` por respuesta y porque las instancias se reciclan.

### Variables de entorno de la función

| Variable | Valor |
|---|---|
| `NEXO_TARBALL_URL` | `https://codeload.github.com/Vizpok/Sistema_Inventario_Proyecto/tar.gz/<commit>` |
| `DATABASE_URL` | Conexión como **`app_nexo`** (reemplaza la del propietario que Neon inyectaría) |
| `SESSION_SECRET` | Secreto para firmar la cookie de sesión |

## Publicar una nueva versión

1. Haz los cambios y ejecuta `npm run build:neon` (regenera `dist/servidor.mjs` y `arranque.zip`).
2. Haz commit y push; copia el hash del commit (`git rev-parse HEAD`).
3. Cambia `NEXO_TARBALL_URL` al nuevo commit. Con el CLI de Neon:

   ```bash
   npx neon functions deploy nexo --src deploy/neon/arranque.mjs --no-bundle \
     --env NEXO_TARBALL_URL=https://codeload.github.com/Vizpok/Sistema_Inventario_Proyecto/tar.gz/<commit>
   ```

   (`--no-bundle` requiere que el archivo se llame `index.mjs`: copia `arranque.mjs` como
   `index.mjs` en una carpeta y apunta `--src` a ella.)

La primera visita después de un despliegue o de un rato sin uso tarda ~2 s (arranque en frío);
las siguientes, unos 300 ms.
