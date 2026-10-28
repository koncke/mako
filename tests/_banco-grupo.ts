// =============================================================================
// El banco de casos del grupo, nivel 1 (sin modelo y sin base) — NO es un test (no termina en .test.ts)
// =============================================================================
// Los textos REALES del diagnóstico del Cerebro (C:/dev/revisiones/2810-diagnostico-mako-whatsapp.md, §5 y la crítica §3, G1),
// pasados por lo que el turno del grupo decide ANTES del modelo, en el orden del doer (lib/mako-doer-in.ts): si lleva sólo el
// 👍 sin turno (`esAcusePuro`, sin nada pendiente), la intención (`clasificarIntencion`, sin `canal`: WhatsApp, y el default del
// grupo, `enElGrupoSinSenal`), la ruta (`rutearDoer`), si va por el camino barato (el `chatCheap` sin historial, G2: se lee en
// la fuente del doer) y qué herramientas viajan (`herramientasDelTurno`, con las de siempre). Lo usa tests/banco-grupo.test.ts
// y sirve para la tabla ANTES/DESPUÉS:
//   node --import tsx --conditions=react-server tests/_banco-grupo.ts
// =============================================================================

import { readFileSync } from 'node:fs';
import { clasificarIntencion, type VeredictoIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { enElGrupoSinSenal } from '../lib/doer-hilo';
import { esAcusePuro } from '../lib/doer-para-quien';
import { rutearDoer } from '../lib/mako-router';
import type { Vista } from '../lib/api-mako/registro';

export type CasoBanco = { n: string; origen: string; texto: string; makoPregunto?: boolean; hayPendientes?: boolean };

export const BANCO: CasoBanco[] = [
  { n: '1', origen: 'Leandro 28/10 10:21', texto: 'Tal cual como lo hace manychat' },
  { n: '2', origen: 'Leandro 28/10 10:24', texto: 'que cuando comenten fiesta o guía responda el comentario en público y mande el recurso por DM, como ManyChat' },
  { n: '4', origen: 'Patricia 21/10 03:56', texto: 'bien' },
  { n: '5', origen: 'Código Inmobiliario 27/10 06:19', texto: 'Como tengo que hacer para generar el access token y eso sigue siendo el mismo?' },
  { n: '6', origen: 'Brigitte 22/10 05:19', texto: 'Si' },
  { n: '7', origen: 'Brigitte 23/10 10:27', texto: 'Ya conteste' },
  { n: '8', origen: 'Brigitte 23/10 11:04', texto: 'Si contacte Eli' },
  { n: '9', origen: 'Brigitte 23/10 07:19', texto: 'Si ya es la tercera vez q se contacta' },
  { n: '10', origen: 'Código Inmobiliario 26/10 08:22', texto: '¿Qué reuniones tengo hoy?' },
  { n: '11', origen: 'Código Inmobiliario 26/10 16:15', texto: 'cuantos no shows tuvimos del 19/09 al 26/10?' },
  { n: '12', origen: 'Código Inmobiliario 26/10 16:29', texto: 'Pasame el nombre y apellido de cada uno de los que quedaron sin marcar' },
  { n: '13', origen: 'Leila 26/10 17:08', texto: 'no puede analizar la llamada de fathom tras 4 intentos' },
  { n: '14', origen: 'Leila 26/10 17:57', texto: 'y tú eres el servicio técnico' },
  { n: '15', origen: 'Florencia 22/10 06:35', texto: 'Estas analizando mis fathom?' },
  { n: '16', origen: 'Sergio 22/10 10:13', texto: '¿listos los guiones?' },
  { n: '17a', origen: 'Natalia', texto: 'Bien' },
  { n: '17b', origen: 'Natalia', texto: 'Excelente' },
  { n: '17c', origen: 'Brigitte (Joan)', texto: 'Buen día! Geniall' },
  { n: '17d', origen: 'Brigitte', texto: 'Vamos que arranca la semana!' },
  { n: '17e', origen: 'Brigitte (Joan)', texto: 'Buendiaa' },
  { n: '17f', origen: 'Natalia', texto: 'Okk perfe' },
  { n: 'G1a', origen: 'Brigitte 23/10 20:02', texto: 'ya lo contacte' },
  { n: 'G1b', origen: 'Leandro 28/10', texto: 'yo lo que quería era que se puedan responder los comentarios de Instagram' },
  { n: 'G1c', origen: 'Leila 26/10', texto: 'Fabi Pedraza no aparece en el SRM' },
  // El «sí» a una PENDIENTE viva (la pregunta del Cerebro sobre 43ac63cc3): entra por la confirmación, antes del default.
  { n: 'P1', origen: 'una pendiente de plata viva', texto: 'Si', hayPendientes: true },
  { n: 'P2', origen: 'una pendiente viva', texto: 'dale', hayPendientes: true },
];

/** Las herramientas del plan: si un turno lleva SÓLO éstas, el modelo no puede mirar ni reportar nada (G1). */
export const SOLO_PLAN = new Set(['ver_plan', 'listar_pendientes', 'proponer_tareas_plan']);

export type FilaBanco = {
  n: string; origen: string; texto: string; pulgar: boolean; intencion: string; dudosa: boolean; porque: string; tier: string;
  barato: boolean; tools: string[]; soloPlan: boolean;
};

/** ¿El doer todavía tiene el camino barato? Se lee en su fuente: es la condición que lo abría. */
const DOER = readFileSync(new URL('../lib/mako-doer-in.ts', import.meta.url), 'utf8');
export const HAY_CAMINO_BARATO = /if \(ruta\.tier === 'cheap' && !mediaBlocks && !pideHerramientas\)/.test(DOER);

export function correrBanco(deSiempre: Array<{ name: string }>, clasificar: (t: string, ctx: Parameters<typeof clasificarIntencion>[1]) => VeredictoIntencion = clasificarIntencion): FilaBanco[] {
  const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
  return BANCO.map((c) => {
    const v = enElGrupoSinSenal(clasificar(c.texto, { makoPregunto: !!c.makoPregunto, hayPendientes: !!c.hayPendientes }), c.texto);
    const ruta = rutearDoer(c.texto, {});
    const t = herramientasDelTurno({ veredicto: v, texto: c.texto, agendaAbierta: false, deSiempre, vista, hayPendientes: !!c.hayPendientes, contextoDelSi: null });
    const tools = t.tools.map((x) => x.name);
    // La condición del doer (lib/mako-doer-in.ts, `pideHerramientas`): lo barato va con charla o con una duda.
    const barato = HAY_CAMINO_BARATO && ruta.tier === 'cheap' && !(v.intencion !== 'charlar' && !v.dudosa);
    return {
      // Con algo pendiente o una pregunta de MaKo, el acuse llega al turno (lib/doer-para-quien.ts, `noEsParaMaKo`).
      n: c.n, origen: c.origen, texto: c.texto, pulgar: !c.makoPregunto && !c.hayPendientes && esAcusePuro(c.texto), intencion: v.intencion, dudosa: !!v.dudosa, porque: v.porque, tier: ruta.tier,
      barato, tools, soloPlan: tools.length > 0 && tools.every((x) => SOLO_PLAN.has(x)),
    };
  });
}

/** Las del registro que van con las de siempre del doer (lib/mako-doer-in.ts): `TICKET_TOOLS` y `CAPACIDADES_TOOLS`. */
export async function ticketTools(): Promise<Array<{ name: string }>> {
  const { porId, aToolDef } = await import('../lib/api-mako/registro');
  return ['levantar_ticket', 'listar_capacidades_mako'].flatMap((id) => { const d = porId(id); return d ? [aToolDef(d)] : []; });
}

// Corrido directo: la tabla.
if (process.argv[1] && /_banco-grupo\.ts$/.test(process.argv[1])) {
  (async () => {
    const { MAKO_TOOLS } = await import('../lib/mako-tools');
    const { MAKO_ACCION_TOOLS } = await import('../lib/mako-doer-acciones');
    const filas = correrBanco([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS, ...(await ticketTools())]);
    process.stdout.write('| # | Texto | Sólo 👍 | Intención | Ruta | Barato | Herramientas |\n|---|---|---|---|---|---|---|\n');
    for (const f of filas) {
      const tools = f.tools.length > 6 ? `${f.tools.length}: ${f.tools.slice(0, 5).join(', ')}…` : `${f.tools.length}: ${f.tools.join(', ') || '—'}`;
      process.stdout.write(`| ${f.n} | ${f.texto.slice(0, 48)} | ${f.pulgar ? 'SÍ' : 'no'} | ${f.pulgar ? '—' : `${f.intencion}${f.dudosa ? ' (dudosa)' : ''}`} | ${f.tier} | ${f.pulgar ? '—' : f.barato ? 'SÍ' : 'no'} | ${f.pulgar ? '—' : `${f.soloPlan ? '⚠ sólo plan · ' : ''}${tools}`} |\n`);
    }
    process.exit(0);
  })().catch((e) => { console.error(e); process.exit(1); });
}
