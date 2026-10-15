// =============================================================================
// api-mako/runners — los cuerpos de TODAS las operaciones, cruzados por id
// =============================================================================
// Cada área declara sus operaciones en `<area>.def.ts` (sin server-only) y las
// implementa en `<area>.run.ts` (server-only, toca la base y los proveedores).
// Acá se juntan. La paridad def ↔ run la verifica tests/api-mako-registro.test.ts
// leyendo los fuentes; en runtime, una def sin runner contesta su error cuando la
// piden — igual en local y en producción, sin throw en boot.
// =============================================================================

import 'server-only';
import type { Run, Runners } from './tipos';

import { RUNNERS as general } from './areas/general.run';
import { RUNNERS as plan } from './areas/plan.run';
import { RUNNERS as crm } from './areas/crm.run';
import { RUNNERS as ads } from './areas/ads.run';
import { RUNNERS as chats } from './areas/chats.run';
import { RUNNERS as whatsapp } from './areas/whatsapp.run';
import { RUNNERS as email } from './areas/email.run';
import { RUNNERS as chatbot } from './areas/chatbot.run';
import { RUNNERS as metricas } from './areas/metricas.run';
import { RUNNERS as dashboard } from './areas/dashboard.run';
import { RUNNERS as experimentos } from './areas/experimentos.run';
import { RUNNERS as landing } from './areas/landing.run';
import { RUNNERS as closing } from './areas/closing.run';
import { RUNNERS as negocio } from './areas/negocio.run';
import { RUNNERS as contenido } from './areas/contenido.run';
import { RUNNERS as video } from './areas/video.run';
import { RUNNERS as integraciones } from './areas/integraciones.run';
import { RUNNERS as equipo } from './areas/equipo.run';
import { RUNNERS as cs } from './areas/cs.run';
import { RUNNERS as curso } from './areas/curso.run';
import { RUNNERS as creaciones } from './areas/creaciones.run';
import { RUNNERS as cobros } from './areas/cobros.run';
import { RUNNERS as calendario } from './areas/calendario.run';
import { RUNNERS as mako } from './areas/mako.run';

const TODOS: Runners[] = [
  general, plan, crm, ads, chats, whatsapp, email, chatbot, metricas, dashboard, experimentos,
  landing, closing, negocio, contenido, video, integraciones, equipo, cs, curso, creaciones, cobros, calendario, mako,
];

const POR_ID = new Map<string, Run>();
for (const grupo of TODOS) {
  for (const [id, run] of Object.entries(grupo)) {
    if (POR_ID.has(id)) console.error(`[api-mako] el runner «${id}» está definido dos veces`);
    POR_ID.set(id, run);
  }
}

export const runnerDe = (id: string): Run | undefined => POR_ID.get(id);
