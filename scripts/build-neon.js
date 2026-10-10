#!/usr/bin/env node
/**
 * Empaqueta la aplicación para Neon Functions (npm run build:neon):
 *   deploy/neon/dist/servidor.mjs   app Express + dependencias en un solo archivo ESM
 *   deploy/neon/vendor/             Chart.js (en Neon no hay node_modules)
 *   deploy/neon/arranque.zip        función de arranque lista para subir
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const esbuild = require('esbuild');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'deploy', 'neon');

// require/__filename/__dirname para dependencias CommonJS dentro de un bundle ESM
const BANNER = "import{createRequire as ___cr}from'module';import{fileURLToPath as ___f}from'url';"
  + "import{dirname as ___d}from'path';const require=___cr(import.meta.url);"
  + 'const __filename=___f(import.meta.url);const __dirname=___d(__filename);';

esbuild.buildSync({
  entryPoints: [path.join(DIR, 'servidor.js')],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'esm',
  minify: true,
  legalComments: 'none',
  banner: { js: BANNER },
  outfile: path.join(DIR, 'dist', 'servidor.mjs'),
  logLevel: 'warning',
});

const vendor = path.join(DIR, 'vendor');
fs.mkdirSync(vendor, { recursive: true });
fs.copyFileSync(path.join(RAIZ, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js'), path.join(vendor, 'chart.umd.min.js'));

// Zip de la función de arranque (su archivo de entrada debe llamarse index.mjs)
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'nexo-arranque-'));
fs.copyFileSync(path.join(DIR, 'arranque.mjs'), path.join(tmp, 'index.mjs'));
const zip = path.join(DIR, 'arranque.zip');
fs.rmSync(zip, { force: true });
execFileSync('zip', ['-j', '-q', zip, path.join(tmp, 'index.mjs')]);

const kb = (f) => `${(fs.statSync(f).size / 1024).toFixed(0)} KB`;
console.log(`servidor.mjs ${kb(path.join(DIR, 'dist', 'servidor.mjs'))} · arranque.zip ${kb(zip)}`);
