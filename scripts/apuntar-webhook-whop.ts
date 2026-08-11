// =============================================================================
// apuntar-webhook-whop — que el webhook de Whop pegue donde tiene que pegar
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/apuntar-webhook-whop.ts
//   …--aplicar  → escribe. Sin el flag solo dice qué haría.
//
// El webhook creado a mano en el panel quedó apuntando a la RAÍZ del dominio.
// Ahí Whop entrega, la landing devuelve 200 y el evento se pierde: el peor de
// los mundos, porque el panel de Whop lo marca como entregado con éxito.
//
// No toca los EVENTOS suscritos a propósito. La ruta ignora con 200 todo lo que
// no sea el del curso, así que sobrar eventos no rompe nada — y sacarlos sería
// tocar la configuración del negocio de Mauricio más de lo necesario.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { whopCompanyId } from '../lib/whop';
import { credWs } from '../lib/credenciales';
import { runWithWorkspace } from '../lib/workspace';
import { APP_BASE_URL } from '../lib/app-url';

const APLICAR = process.argv.includes('--aplicar');
const WS = 1;
const DESTINO = `${APP_BASE_URL}/api/webhooks/whop`;
const EVENTO = 'course_lesson_interaction.completed';
const BASE = 'https://api.whop.com/api/v1';

type Hook = { id: string; url: string; enabled: boolean; events?: string[] };

async function main() {
  const token = await credWs('WHOP_API_KEY', WS);
  if (!token) { console.error('falta WHOP_API_KEY'); process.exit(1); }
  const H = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

  const biz = await whopCompanyId(WS);
  if (!biz.ok) { console.error(biz.error); process.exit(1); }

  const r = await fetch(`${BASE}/webhooks?company_id=${biz.data}`, { headers: H });
  const hooks = ((await r.json())?.data ?? []) as Hook[];
  if (!hooks.length) { console.error('no hay ningún webhook creado en Whop.'); process.exit(1); }

  console.log(`\nDestino correcto: ${DESTINO}\n`);
  for (const h of hooks) {
    const escucha = (h.events ?? []).includes(EVENTO);
    console.log(`${h.id}  ${h.url}`);
    console.log(`   enabled=${h.enabled}  escucha «${EVENTO}»: ${escucha ? 'sí' : 'NO'}  eventos=${h.events?.length ?? 0}`);

    if (h.url === DESTINO) { console.log('   → ya apunta bien\n'); continue; }
    if (!APLICAR) { console.log('   → se reapuntaría (agregá --aplicar)\n'); continue; }

    const up = await fetch(`${BASE}/webhooks/${h.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ url: DESTINO }),
    });
    const txt = await up.text();
    if (!up.ok) { console.error(`   ✖ ${up.status}: ${txt.slice(0, 200)}\n`); continue; }
    console.log(`   ✓ reapuntado a ${DESTINO}\n`);
  }
}

runWithWorkspace(WS, main).catch((e) => { console.error(e); process.exit(1); });
