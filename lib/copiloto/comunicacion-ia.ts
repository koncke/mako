// =============================================================================
// Marketing CoPilot — MaKo lee tus ÁNGULOS y tu VOZ, y les pone nota (12/11/2026)
// =============================================================================
// Una sola llamada por parte: lo que encontró de cada cosa (con de dónde lo sacó) y la nota criterio por criterio. Lee lo que el
// negocio YA tiene en MaKo, sin gastar en leer redes (eso es de Apify y se decide aparte: docs/relevo/marketing-copilot-rediseno.md):
//   · el negocio (lib/offer-contexto.ts → contextoOffer: el perfil, el Archivero, los avatares, las razones, su voz);
//   · la conversación de Offer elegida: sus piezas y sus documentos (el PDF, la web);
//   · sus anuncios de los últimos 60 días, con agendas, ventas, costo y frecuencia (lo que decide un ganador o un quemado);
//   · las objeciones y lo que funcionó en sus llamadas analizadas (Closing Analyst);
//   · su voz en los chats de venta (lib/chat-agent-voz.ts, lo deducido con citas).
// La IA es la de Offer (lib/offer-ia.ts → pedirParaCopiloto): las keys del negocio y después la red de plataforma. No cobra.
// ⚠️ NUNCA INVENTA: lo que no está en el material no se completa (queda «Falta» y MaKo lo pregunta en el chat). Lo leído entra como
//    «por confirmar» y nunca pisa lo que la persona confirmó (./comunicacion.ts → fundirLecturaOC).
// ⚠️ El total de la nota lo calcula el código (promedio × 10), no la IA.
// =============================================================================

import 'server-only';
import { runWithWorkspace, getTenantDb } from '@/lib/workspace';
import { contextoOffer } from '@/lib/offer-contexto';
import { leerFila } from '@/lib/offer-sesiones';
import { piezaLabel, type PiezaKey } from '@/lib/offer-marco';
import { pedirParaCopiloto } from '@/lib/offer-ia';
import { getSenalesRecon } from '@/lib/queries';
import { getEvidencia } from '@/lib/chat-agent-voz';
import { getRazones } from '@/lib/razones';
import { hoyEnTijuana } from '@/lib/date-utils';
import { diasAntes } from '@/lib/media-buyer/senales';
import { contenidoNoConfiable } from '@/lib/prompt-render-pure';
import { fundirLecturaOC, totalNotaOC, type GuardadoOC } from './comunicacion';
import { parseLecturaOC, promptOC } from './comunicacion-lectura';
import { cambiarOC, type ParteGuardadaOC } from './comunicacion-store';

const callar = <T,>(p: Promise<T>, def: T): Promise<T> => p.catch((e) => { console.warn('[copiloto/comunicacion]', e instanceof Error ? e.message : String(e)); return def; });
const corta = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** El material, por bloque y con su etiqueta: la IA tiene que poder decir de dónde sacó cada cosa. */
export async function materialOC(ws: number, sesion: number | null): Promise<{ texto: string; bloques: string[] }> {
  return runWithWorkspace(ws, async () => {
    const hoy = hoyEnTijuana();
    const [ctx, fila, senales, evid, razones, llamadas] = await Promise.all([
      callar(contextoOffer({}), null),
      sesion != null ? callar(leerFila(sesion), null) : Promise.resolve(null),
      callar(getSenalesRecon(diasAntes(hoy, 60), diasAntes(hoy, 1)), []),
      callar(getEvidencia(), null),
      callar(getRazones(), []),
      callar(leerLlamadas(), []),
    ]);
    const bloques: Array<[string, string]> = [];
    if (ctx?.texto?.trim()) bloques.push(['EL NEGOCIO (lo que cargó en MaKo)', corta(ctx.texto, 7_000)]);
    if (ctx?.voz?.trim()) bloques.push(['SU GUÍA DE VOZ (la que escribió)', corta(ctx.voz, 2_000)]);
    const piezas = Object.entries(fila?.piezas ?? {}).filter(([, v]) => v?.valor?.trim()).map(([k, v]) => `- ${piezaLabel(k as PiezaKey)}: ${v!.valor.trim()}`);
    if (piezas.length) bloques.push(['SU OFERTA (las piezas de Offer)', piezas.join('\n')]);
    for (const d of (fila?.documentos ?? []).slice(0, 3)) {
      const t = typeof d?.texto === 'string' ? d.texto.trim() : '';
      if (t) bloques.push([`${(d as { via?: string }).via === 'web' ? 'SU WEB' : 'SU DOCUMENTO'} «${String(d.nombre ?? '').slice(0, 80)}»`, corta(t, 5_000)]);
    }
    const anuncios = [...senales].filter((s) => s.spend_usd > 0)
      .sort((a, b) => b.agendas - a.agendas || b.cierres - a.cierres || b.leads_crm - a.leads_crm || b.spend_usd - a.spend_usd).slice(0, 10)
      .map((s) => `- «${s.ad_name || s.ad_id}»${s.campana ? ` (campaña «${s.campana}»)` : ''}: gasto US$ ${Math.round(s.spend_usd)}, ${s.leads_crm} leads en el CRM, ${s.agendas} agendas, ${s.cierres} ventas${s.cpl_usd != null ? `, costo por lead US$ ${s.cpl_usd.toFixed(2)}` : ''}${s.frequency != null ? `, frecuencia ${s.frequency.toFixed(1)}` : ''}, ${s.dias_corriendo} días corriendo`);
    if (anuncios.length) bloques.push(['SUS ANUNCIOS (últimos 60 días, del que más agendas trajo al que menos)', anuncios.join('\n')]);
    if (llamadas.length) bloques.push([`SUS LLAMADAS DE VENTA (${llamadas.length} analizadas: objeciones y lo que funcionó)`, corta(llamadas.join('\n'), 5_000)]);
    if (evid) {
      const vs = Object.entries(evid.bloques).filter(([, b]) => b.estado === 'deducido' && b.texto.trim())
        .map(([k, b]) => `- ${k}: ${b.texto.trim()}${b.citas.length ? ` (citas: ${b.citas.slice(0, 3).map((c) => `«${corta(c, 120)}»`).join(' ')})` : ''}`);
      if (vs.length) bloques.push([`SU VOZ EN LOS CHATS DE VENTA (${evid.convsElegidas} conversaciones)`, vs.join('\n')]);
    }
    const rz = razones.slice(0, 12).map((r) => `- ${r.nombre}${r.descripcion ? `: ${corta(r.descripcion, 200)}` : ''}`);
    if (rz.length) bloques.push(['SUS RAZONES DE COMPRA (las que armó en Copywriting)', rz.join('\n')]);
    const texto = bloques.map(([t, x]) => `### ${t}\n${contenidoNoConfiable(x, 'material')}`).join('\n\n');
    return { texto, bloques: bloques.map(([t]) => t) };
  });
}

/** Las objeciones y lo que funcionó en las llamadas analizadas (Closing Analyst), las más nuevas primero. */
async function leerLlamadas(): Promise<string[]> {
  const db = await getTenantDb();
  const { data, error } = await db.from('closing_analyses').select('title, call_date, objections, strengths')
    .eq('status', 'analizada').order('call_date', { ascending: false }).limit(25);
  if (error) throw new Error(`no pude leer las llamadas: ${error.message}`);
  const out: string[] = [];
  for (const f of (data ?? []) as Array<{ title: string | null; call_date: string | null; objections: unknown; strengths: unknown }>) {
    const objs = Array.isArray(f.objections) ? f.objections.map((o) => (o && typeof o === 'object' ? String((o as { quote?: unknown }).quote ?? '') : '')).filter(Boolean) : [];
    const fuertes = Array.isArray(f.strengths) ? f.strengths.map((s) => (s && typeof s === 'object' ? [String((s as { title?: unknown }).title ?? ''), String((s as { quote?: unknown }).quote ?? '')].filter(Boolean).join(': «') + ((s as { quote?: unknown }).quote ? '»' : '') : '')).filter(Boolean) : [];
    if (!objs.length && !fuertes.length) continue;
    out.push(`- Llamada${f.call_date ? ` del ${String(f.call_date).slice(0, 10)}` : ''}: ${objs.length ? `dijo «${objs.slice(0, 3).map((o) => corta(o, 140)).join('», «')}»` : ''}${fuertes.length ? `${objs.length ? '; ' : ''}funcionó: ${fuertes.slice(0, 2).map((s) => corta(s, 140)).join('; ')}` : ''}`);
  }
  return out;
}

/**
 * Leer y calificar una parte (Ángulos o Tu voz): una llamada, y lo leído se funde con lo guardado sin pisar lo confirmado.
 * `inicio` = cuándo arrancó el pedido HTTP (los plazos de la cascada salen de ahí).
 */
export async function leerYCalificarOC(ws: number, p: ParteGuardadaOC, sesion: number | null, inicio = Date.now()): Promise<{ ok: true; guardado: GuardadoOC } | { ok: false; error: string }> {
  const { texto } = await materialOC(ws, sesion);
  const { system, user } = promptOC(p, texto);
  const r = await runWithWorkspace(ws, () => pedirParaCopiloto({ system, user, inicio, motivo: p === 'angulos' ? 'leer tus ángulos' : 'leer tu voz', parse: (raw) => parseLecturaOC(p, raw) }));
  if (!r.ok) return { ok: false, error: r.error };
  const ahora = new Date().toISOString();
  const guardado = await cambiarOC(ws, p, sesion, (g) => ({
    ...fundirLecturaOC(g, r.valor.cosas, ahora),
    nota: { total: totalNotaOC(r.valor.criterios), criterios: r.valor.criterios, lei: r.valor.lei, at: ahora, modelo: r.modelo },
  }));
  return { ok: true, guardado };
}
