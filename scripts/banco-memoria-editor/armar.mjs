// Arma banco.js con el código REAL del editor (ver medir.mjs).
import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = dirname(fileURLToPath(import.meta.url));
try {
  const r = await build({
    entryPoints: [`${aqui}/entrada.mjs`], bundle: true, format: 'esm', target: 'chrome120',
    outfile: `${aqui}/banco.js`, tsconfig: resolve(aqui, '../../tsconfig.json'),
    define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.wasm': 'file' },
    logLevel: 'silent', metafile: true,
  });
  console.log('ok', Object.keys(r.metafile.inputs).length, 'módulos', r.warnings.length, 'avisos');
} catch (e) {
  for (const er of e.errors ?? [e]) console.log('ERROR', er.text ?? String(er), er.location?.file ?? '', er.location?.line ?? '');
  process.exit(1);
}
