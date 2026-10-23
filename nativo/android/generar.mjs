// =============================================================================
// El proyecto Android (TWA) de MaKo, generado desde twa-manifest.json con Bubblewrap (23/10/2026)
// =============================================================================
// Lo que se versiona es twa-manifest.json (el id, los colores, el inicio, las huellas); el proyecto de Gradle se GENERA con
// esto, como `bubblewrap update`, pero sin pedir el JDK ni el Android SDK: sólo escribe archivos (los íconos los baja de
// hola-mako.com). Para compilar, ver README.md.
// Uso, desde nativo/android: npm ci && node generar.mjs
// =============================================================================

import { TwaManifest, TwaGenerator, ConsoleLog } from '@bubblewrap/core';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aca = dirname(fileURLToPath(import.meta.url));
const m = await TwaManifest.fromFile(`${aca}/twa-manifest.json`);
const errores = m.validate();
if (errores) { console.error('twa-manifest.json inválido:', errores); process.exit(1); }
await new TwaGenerator().createTwaProject(aca, m, new ConsoleLog('generar'));
console.log('Proyecto generado en', aca);
