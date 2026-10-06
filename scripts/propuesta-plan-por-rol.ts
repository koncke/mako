// =============================================================================
// propuesta-plan-por-rol — lo ÚNICO nuevo del documento de arquitectura
// =============================================================================
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/propuesta-plan-por-rol.ts --apply
//
// Todo lo demás del documento «Arquitectura de Información + App Shell» AMPLIÓ tareas
// que ya estaban (scripts/arreglar-ronda-agosto.ts). Esto es lo que no tenía dónde
// entrar: la corrección de Martín sobre los roles.
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { getSupabaseServer } from '../lib/supabase';
import { crearPropuesta } from '../lib/plan-propuesta';
import { delCatalogo } from '../lib/plan-proyectos-catalogo';
import { APP_BASE_URL } from '../lib/app-url';

const APLICAR = process.argv.includes('--apply');

const PROYECTO = 'Plan';

const DETALLE = `Sale del documento «Arquitectura de Información + App Shell» (Fase 1, v1) y sobre todo de la corrección que dejó Martín al final, textual: «Un Media Buyer no debería tener acceso al PLAN del dueño, de hecho, todos los roles deberían tener su propio PLAN».

Hoy el Plan es UNO por workspace: el setter, el closer y el media buyer entran a /plan y ven el mismo tablero que el dueño — sus proyectos, sus prioridades y sus tareas. El documento ya lo pedía por el otro lado (la tabla de roles pone «CRM + Plan» en Operate para setter y closer, y «Ads Manager + Plan» para el media buyer), pero sin decir que ese Plan tiene que ser SUYO.

Qué significa en concreto: cada persona del equipo tiene su propio tablero, con sus propias tareas y su propio Perro puntuando contra SU realidad. El dueño sigue viendo el suyo, y además tiene que poder ver en qué anda cada uno — pero no al revés. Lo que ya funciona y hay que respetar: el reparto de una reunión ya deja un BORRADOR pendiente en el plan de la otra persona (lib/reunion-destinatarios.ts), que ella confirma en su propio workspace. O sea, la pieza de "mandarle una tarea a alguien" ya está: falta que esa persona tenga un tablero propio donde recibirla en vez de compartir el del dueño.

Ojo con dos cosas al diseñarlo: (1) el aislamiento — el plan de un rol no puede filtrar tareas del dueño ni de otro rol, y el guard hoy es por PÁGINA, no por fila; (2) la vista del dueño — necesita un lugar donde ver los planes del equipo sin tener que impersonar a cada uno.

Está listo cuando un media buyer entra a /plan y ve SUS tareas, el dueño ve las suyas, y el dueño puede mirar las del equipo desde un solo lado.`;

const PREGUNTAS = [
  {
    pregunta: '¿Hay hoy alguien del equipo (setter, closer o media buyer) entrando a MaKo, o son todos usuarios de un solo dueño?',
    tipo: 'opcion',
    opciones: ['Todavía nadie: cada workspace es una sola persona', 'Sí, en el equipo de Mauricio', 'Sí, en el nuestro', 'Está por pasar en las próximas semanas'],
  },
  {
    pregunta: 'El dueño mirando los planes del equipo: ¿alcanza con impersonar como ahora, o necesita una vista propia?',
    tipo: 'comparacion',
    opciones: ['Alcanza con impersonar (ya funciona)', 'Necesita una vista donde vea a todos juntos'],
  },
];

async function main() {
  if (!delCatalogo(PROYECTO)) throw new Error(`«${PROYECTO}» no está en el catálogo`);
  console.log(APLICAR ? '=== CREANDO ===' : '=== SIMULACIÓN ===');
  console.log(`1 tarea · ${PREGUNTAS.length} preguntas · proyecto «${PROYECTO}» · detalle ${DETALLE.length} caracteres`);
  if (!APLICAR) { console.log('(sin --apply no escribe)'); return; }

  const svc = getSupabaseServer();
  const { data: wss } = await svc.from('workspaces').select('id, capa').eq('capa', 'superadmin');
  const ws = (wss ?? [])[0] as { id: number };
  const id = await runWithWorkspace(ws.id, () => crearPropuesta({
    tareas: [{ titulo: 'Cada rol con su propio Plan (el del dueño deja de ser el de todos)', proyecto: PROYECTO, detalle: DETALLE }],
    // `preguntas: PREGUNTAS` ya no viaja: el alta dejó de preguntar (05/10/2026).
    resumen: 'Lo único NUEVO del documento de arquitectura: el resto amplió tareas que ya estaban.',
    origen: 'claude-code',
    fuenteTitulo: 'Arquitectura de Información + App Shell (Fase 1, v1)',
    ws: ws.id,
  }));
  console.log(`\n${APP_BASE_URL}/plan/revisar/${id}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
