// SOLO LECTURA. La lista de los leads del ws13 que se quedaron sin aviso al grupo (del 12/10 21:23 al 22/10 23:09 ART),
// armada por CÓDIGO desde la base: nombre y teléfono salen del select de `leads`, nunca de una lista copiada.
// Escribe los textos candidatos en --salida=<carpeta> (no manda nada) y los valida con las reglas del aviso de arreglo.
import { writeFileSync, mkdirSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { textoDelAviso, TOPE_TEXTO_AVISO } from '../../lib/aviso-arreglo-reglas';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const SALIDA = arg('salida');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
/** El último aviso que salió bien antes de la racha (env 25, lead 2647): lo que llegó antes no entra. */
const DESDE = '2026-10-12T13:19:57.942Z';
const WS = 13;

const falla = (que: string, e: { message: string } | null) => { if (e) { console.error(`NO SE PUDO LEER ${que}: ${e.message}`); process.exit(2); } };

const { data: env, error: e1 } = await db.from('nutricion_envios').select('id, lead_id, estado, created_at')
  .eq('workspace_id', WS).eq('asunto', 'avisar_al_equipo');
falla('nutricion_envios', e1);
const conOk = new Set((env ?? []).filter((r) => r.estado === 'accion').map((r) => Number(r.lead_id)));
const fallidos = new Set((env ?? []).filter((r) => r.estado === 'fallo' && !conOk.has(Number(r.lead_id))).map((r) => Number(r.lead_id)));

const { data: pend, error: e2 } = await db.from('mako_acciones_pendientes').select('payload').eq('tipo', 'avisar_al_equipo');
falla('mako_acciones_pendientes', e2);
for (const p of pend ?? []) {
  const id = Number((p.payload as { leadId?: unknown } | null)?.leadId);
  if (Number.isFinite(id)) fallidos.delete(id);
}

const { data: leads, error: e3 } = await db.from('leads').select('id, nombre, telefono, created_at, estado_lead, workspace_id')
  .eq('workspace_id', WS).in('id', [...fallidos]).gt('created_at', DESDE).order('created_at', { ascending: true });
falla('leads', e3);
const L = (leads ?? []) as Array<{ id: number; nombre: string | null; telefono: string | null; created_at: string; estado_lead: string | null }>;

const art = (iso: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const dia = (iso: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit' }).format(new Date(iso));
console.log(`Leads del ws${WS} sin aviso (fallo sin 'accion' ni pendiente, llegados después de ${DESDE}): ${L.length}`);
const sinDato = L.filter((l) => !(l.nombre ?? '').trim() || !(l.telefono ?? '').trim());
for (const [i, l] of L.entries()) console.log(`${String(i + 1).padStart(2)}. #${l.id} ${art(l.created_at)} ART · ${l.nombre} · ${l.telefono} · ${l.estado_lead}`);
if (sinDato.length) { console.error(`HAY ${sinDato.length} SIN NOMBRE O TELÉFONO: ${sinDato.map((l) => l.id).join(', ')} — no se arma nada`); process.exit(3); }

const porEstado = new Map<string, number>();
for (const l of L) porEstado.set(l.estado_lead ?? '(sin estado)', (porEstado.get(l.estado_lead ?? '(sin estado)') ?? 0) + 1);
console.log(`por estado hoy: ${[...porEstado].map(([k, v]) => `${k}=${v}`).join(' · ')}`);

const linea = (l: (typeof L)[number]) => `• ${(l.nombre ?? '').trim()} — ${(l.telefono ?? '').trim()}`;
const lineaConDia = (l: (typeof L)[number]) => `• ${dia(l.created_at)} ${(l.nombre ?? '').trim()} — ${(l.telefono ?? '').trim()}`;
const abiertos = L.filter((l) => l.estado_lead === 'abierto');
const cerrados = L.length - abiertos.length;

const candidatos: Record<string, string> = {
  // Todos, en orden de llegada. Con 19 no entra en un aviso: se parte en dos (a y b), cada uno con su clave.
  'todos': `Estos son los ${L.length} leads que agendaron entre el ${dia(L[0].created_at)} y el ${dia(L[L.length - 1].created_at)} y de los que no te llegó el aviso, en orden de llegada:\n${L.map(linea).join('\n')}`,
  'abiertos': `De los ${L.length} leads que agendaron entre el ${dia(L[0].created_at)} y el ${dia(L[L.length - 1].created_at)} sin que te llegara el aviso, ${cerrados} ya están cerrados en tu CRM. Estos ${abiertos.length} siguen abiertos, en orden de llegada:\n${abiertos.map(lineaConDia).join('\n')}`,
};
const mitad = Math.ceil(L.length / 2);
candidatos['todos-a'] = `Los ${L.length} leads que agendaron entre el ${dia(L[0].created_at)} y el ${dia(L[L.length - 1].created_at)} sin que te llegara el aviso, en orden de llegada (1 de 2):\n${L.slice(0, mitad).map(linea).join('\n')}`;
candidatos['todos-b'] = `(2 de 2)\n${L.slice(mitad).map(linea).join('\n')}`;

for (const [k, t] of Object.entries(candidatos)) {
  const v = textoDelAviso(t);
  console.log(`\n── ${k}: ${t.length} caracteres (tope ${TOPE_TEXTO_AVISO}) → ${v.ok ? 'PASA' : `NO PASA: ${v.error}`}\n${t}`);
  if (SALIDA) { mkdirSync(SALIDA, { recursive: true }); writeFileSync(`${SALIDA}/ws13-lista-${k}.txt`, t, 'utf8'); }
}
// Cada teléfono del texto, contra la base otra vez (lo que se escribió es lo que hay).
for (const l of L) {
  const { data: r } = await db.from('leads').select('telefono, nombre').eq('id', l.id).maybeSingle();
  if (r?.telefono !== l.telefono || r?.nombre !== l.nombre) { console.error(`CAMBIÓ #${l.id} entre lecturas`); process.exit(4); }
}
console.log(`\nreleídos ${L.length} de ${L.length}: nombre y teléfono iguales a la base.`);
