// =============================================================================
// vigia-paneles — lo que dicen los paneles que no tienen API, guardado para el vigía (5/11/2026)
// =============================================================================
// Martín, 5/11/2026: «todo deberías poder revisarlo tú, no hay nada que debería hacerlo yo a mano». Cinco aprobaciones no
// tienen API: la cuenta de Play Console, las verificaciones de Meta, la app de Google, Creem y el certificado de Windows
// (SSL.com). Las lee una TAREA PROGRAMADA DEL CEREBRO, en la PC, con el navegador y la sesión de Martín: abre cada página,
// mira lo que dice y lo guarda con este script. El vigía (el cron de cada hora) lo toma en su próxima vuelta, lo muestra en
// Approvals y avisa si cambió. Una lectura vale un día: sin otra, la fila dice «no pude leerlo» y el vigía avisa una vez.
//
//   npx tsx --conditions=react-server scripts/vigia-paneles.mts --lista
//       qué abrir, qué mirar y cómo traducirlo, panel por panel (lo que lee la tarea; no toca la base)
//   npx tsx --conditions=react-server scripts/vigia-paneles.mts --guardar <id> <estado> <nota…>
//       guarda lo leído. <estado>: aprobado, en_revision, rechazado, piden_algo, sin_enviar o sin_publicar; o `auto`, y la
//       nota es el texto del panel: el script lo traduce con la tabla y, si no dice nada conocido, lo guarda como «no pude»
//   npx tsx --conditions=react-server scripts/vigia-paneles.mts --no-pude <id> <motivo…>
//       no se pudo leer (sin sesión, la página cambió): queda dicho, y el estado guardado no se toca
//   npx tsx --conditions=react-server scripts/vigia-paneles.mts --ver
//       lo guardado de cada panel y cuándo se leyó
//
// Lee la base de producción del `.env.local` del clon (como scripts/vigia-aprobaciones.mts). No lee ninguna clave y no
// avisa a nadie: sólo escribe `vigia.paneles` en el workspace de la plataforma (lib/vigia-aprobaciones.ts → CLAVE_PANELES).
// La misma escritura la hace la operación `anotar_lectura_de_panel` de la API de MaKo.
// =============================================================================

import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = process.cwd();
const imp = (rel: string) => import(pathToFileURL(path.join(REPO, rel)).href);
const args = process.argv.slice(2);
const despues = (flag: string) => args.slice(args.indexOf(flag) + 1);

const { instruccionesDePaneles, estadoDeTextoDePanel, itemPorId, leerPaneles, CLAVE_PANELES } = await imp('lib/vigia-aprobaciones.ts');

if (args.includes('--lista')) {
  console.log(instruccionesDePaneles());
  console.log('Guardar:  npx tsx --conditions=react-server scripts/vigia-paneles.mts --guardar <id> <estado|auto> <nota o texto del panel>');
  console.log('Si no se pudo leer:  … --no-pude <id> <motivo>');
  process.exit(0);
}

const dotenv = await import(pathToFileURL(path.join(REPO, 'node_modules', 'dotenv', 'lib', 'main.js')).href);
(dotenv.default ?? dotenv).config({ path: path.join(REPO, '.env.local'), quiet: true });
const { anotarLecturaDePanel } = await imp('lib/vigia-aprobaciones-server.ts');

if (args.includes('--ver')) {
  const { wsSuperAdmin, runWithWorkspace } = await imp('lib/workspace.ts');
  const { getSettingEstricto } = await imp('lib/settings.ts');
  const ws = await wsSuperAdmin();
  const p = leerPaneles(await runWithWorkspace(ws, () => getSettingEstricto(CLAVE_PANELES)));
  const ids = Object.keys(p.items);
  if (!ids.length) console.log('Todavía no se guardó ningún panel.');
  for (const id of ids) {
    const l = p.items[id];
    console.log(`• ${itemPorId(id)?.nombre ?? id}: ${'noPude' in l ? `no pude (${l.noPude})` : `${l.estado}${l.nota ? ` — ${l.nota}` : ''}`} · ${l.leidoAt}`);
  }
  process.exit(0);
}

let r: { ok: true } | { ok: false; error: string };
if (args.includes('--no-pude')) {
  const [id, ...motivo] = despues('--no-pude');
  r = await anotarLecturaDePanel(id ?? '', { noPude: motivo.join(' ') });
  if (r.ok) console.log(`✓ ${itemPorId(id)?.nombre ?? id}: anotado que no se pudo leer.`);
} else if (args.includes('--guardar')) {
  const [id, estado, ...resto] = despues('--guardar');
  const nota = resto.join(' ').trim();
  if (estado === 'auto') {
    const traducido = estadoDeTextoDePanel(id ?? '', nota);
    r = traducido
      ? await anotarLecturaDePanel(id ?? '', { estado: traducido, nota })
      : await anotarLecturaDePanel(id ?? '', { noPude: `dice algo que no está en la tabla: «${nota}»` });
    if (r.ok) console.log(traducido ? `✓ ${itemPorId(id)?.nombre ?? id}: ${traducido}.` : `⚠ ${itemPorId(id)?.nombre ?? id}: el texto no está en la tabla; quedó como «no pude leerlo», con el texto.`);
  } else {
    r = await anotarLecturaDePanel(id ?? '', { estado: estado ?? '', nota });
    if (r.ok) console.log(`✓ ${itemPorId(id)?.nombre ?? id}: ${estado}.`);
  }
} else {
  console.log('Uso: --lista · --ver · --guardar <id> <estado|auto> <nota…> · --no-pude <id> <motivo…>');
  process.exit(1);
}
if (!r.ok) { console.error(`✗ ${r.error}`); process.exit(1); }
process.exit(0);
