// =============================================================================
// vigia-aprobaciones — las aprobaciones de las apps de MaKo, desde la consola de la PC (4/11/2026)
// =============================================================================
// El vigía corre SOLO, cada hora, en el servidor (/api/cron/vigia-aprobaciones): esto no hace falta para que avise. Sirve
// para mirar sin esperar a la hora siguiente:
//
//   npx tsx --conditions=react-server scripts/vigia-aprobaciones.mts            la lista de lo que espera (lo guardado; no lee nada afuera)
//   npx tsx --conditions=react-server scripts/vigia-aprobaciones.mts --probar   lee cada fuente AHORA y muestra qué dice, sin guardar ni avisar
//   npx tsx --conditions=react-server scripts/vigia-aprobaciones.mts --correr   una vuelta entera, igual que el cron: guarda y, si algo cambió, avisa
//
// Lee la base de producción del `.env.local` del clon (como scripts/tiendas-cuenta-revision.mts). Ninguna clave sale por la
// consola: cada línea es el estado, la fuente y, si no se pudo leer, el motivo.
// ⚠️ `--correr` es una vuelta de verdad: si algo cambió, Martín recibe el aviso, y la hora siguiente ya no lo repite.
// =============================================================================

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });

const { correrVigiaAprobaciones, leerAhora, listaGuardadaDeAprobaciones, resumenDeLectura } = await imp('lib/vigia-aprobaciones-server.ts');
const { textoDeLaLista, itemPorId } = await imp('lib/vigia-aprobaciones.ts');
const { wsSuperAdmin, runWithWorkspace } = await imp('lib/workspace.ts');

if (process.argv.includes('--probar')) {
  const ws = await wsSuperAdmin();
  const lecturas = await runWithWorkspace(ws, () => leerAhora(ws));
  for (const [id, l] of Object.entries(lecturas as Record<string, unknown>)) {
    console.log(`• ${itemPorId(id)?.nombre ?? id}: ${resumenDeLectura(l)}`);
  }
  console.log('\n(No se guardó ni se avisó nada.)');
} else if (process.argv.includes('--correr')) {
  const r = await correrVigiaAprobaciones();
  if (r.otraVuelta) console.log('Otra vuelta escribió primero: ésta no avisó nada.');
  for (const [id, v] of Object.entries(r.lecturas as Record<string, string>)) console.log(`• ${itemPorId(id)?.nombre ?? id}: ${v}`);
  console.log(r.avisos.length ? `\n${r.avisos.length} novedades; el aviso ${r.avisado ? 'salió' : 'NO salió'}.` : '\nSin novedades: no se avisó nada.');
} else {
  const { ultimaVuelta, filas } = await listaGuardadaDeAprobaciones();
  console.log(textoDeLaLista(filas, ultimaVuelta));
}
process.exit(0);
