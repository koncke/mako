// =============================================================================
// quitar-ir-a — los «Ir a» de las automatizaciones de /chatbot, a flecha o afuera (sexta tanda)
// =============================================================================
// Pedido de Martín (09/10/2026, punto 12 de «General»): «"Go to" desaparece directamente... Porque
// justamente existen las etiquetas y/o los cambios de etapa en el CRM con una acción... Y si eso
// pasa, y tengo otra automatización que el CRON inicia con esa etiqueta o etapa del kanban, ya solo
// se dispara, no necesito "Go to"».
//
// La conversión es `quitarIrA` (lib/flujo-legado.ts), la MISMA que corre el lienzo al abrir
// (`abrirFlujo`): un «Ir a» a una tarjeta de la misma automatización pasa a ser una FLECHA (desde la
// sexta tanda una tarjeta puede tener varios padres), uno a OTRA automatización se SACA (esa arranca
// por su propio CRON) y uno de «Si responde» que retoma la salida QUEDA (el motor lo sigue
// corriendo). El motor sigue sabiendo ejecutar los «Ir a» que queden: este script no es obligatorio
// para que nada siga andando — sólo deja el dato como lo dibuja la pantalla.
//
//   npx tsx scripts/quitar-ir-a.mts                    → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/quitar-ir-a.mts --simular          → lo mismo, dicho explícito
//   npx tsx scripts/quitar-ir-a.mts --aplicar          → escribe (NO se corrió: lo decide Martín)
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id> · --con-archivadas
//
// Por cada automatización con algún «Ir a» imprime: qué pasa con cada uno, los errores de PUBLICAR
// que la conversión traería y no estaban (una así NO se escribe), y —para los que saltaban a OTRA
// automatización— si a esa la dispara su propio CRON o si sacarlo es un RIESGO (manual: el «Ir a»
// era la única puerta; pausada o archivada: tampoco entraba nadie por el «Ir a», el motor no inscribe
// en una pausada — `decidirInscripcionManual`). Y las inscripciones vivas paradas en un «Ir a» (el
// motor resuelve el salto en la misma corrida, así que lo normal es cero): con alguna, esa
// automatización NO se escribe.
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE: cada lectura y escritura filtra `workspace_id` a mano. Y la
// escritura es compare-and-set sobre `updated_at`: si alguien publicó mientras tanto, no se pisa.
// ⚠️ NO TOCA `estrategia` NI `posiciones`: sacar un salto no cambia ninguna de las dos (una posición
// guardada de un «Ir a» que ya no está la poda el lienzo al soltar).
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elegí uno');
const conArchivadas = process.argv.includes('--con-archivadas');
config({ path: arg('env') ?? '.env.local' });
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;

const { quitarIrA } = await import('../lib/flujo-legado');
const { claseDe, idDe, normalizar } = await import('../lib/flujo-grafo');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasá --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

type Paso = Parameters<typeof quitarIrA>[0][number];
type Fila = {
  id: number; workspace_id: number; nombre: string; trigger_tipo: string; activa: boolean;
  archivada_at: string | null; updated_at: string | null; pasos: unknown;
};

let q = db.from('nutricion_secuencias')
  .select('id, workspace_id, nombre, trigger_tipo, activa, archivada_at, updated_at, pasos')
  .order('workspace_id', { ascending: true })
  .order('id', { ascending: true });
if (soloWs != null) q = q.eq('workspace_id', soloWs);
const { data: filas, error } = await q;
if (error) throw new Error(`nutricion_secuencias: ${error.message}`);
const todas = (filas ?? []) as Fila[];
const porId = new Map(todas.map((s) => [s.id, s]));

// El CRON por su valor (`trigger_tipo`): el catálogo de rótulos (`TRIGGERS`, lib/email-marketing.ts) vive
// en un módulo con `server-only` adentro, que un script no puede importar, y copiarlo es crear otro.
const rotulo = (t: string): string => t || '(sin CRON)';

/** ¿A esa automatización la agarra su propio CRON? El veredicto que lee Martín, en una línea. */
function destinoDe(origenWs: number, secId: number): { riesgo: boolean; texto: string } {
  const s = porId.get(secId);
  if (!s || s.workspace_id !== origenWs) return { riesgo: true, texto: `#${secId} no existe en este negocio: el «Ir a» ya no llevaba a ningún lado` };
  const nom = `«${s.nombre}» (#${s.id})`;
  if (s.archivada_at) return { riesgo: false, texto: `${nom} está ARCHIVADA: por el «Ir a» tampoco entraba nadie (el motor no inscribe en una archivada)` };
  if (!s.activa) return { riesgo: false, texto: `${nom} está PAUSADA: por el «Ir a» tampoco entraba nadie hasta prenderla; al prenderla, la dispara su CRON (${rotulo(s.trigger_tipo)})` };
  if (s.trigger_tipo === 'manual') return { riesgo: true, texto: `${nom} es MANUAL: no se dispara sola, y el «Ir a» era su única puerta. RIESGO: hace falta un CRON (una etiqueta o una etapa) que la arranque` };
  return { riesgo: false, texto: `${nom} la dispara su CRON: ${rotulo(s.trigger_tipo)}` };
}

const corto = (t: unknown, n = 56): string => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** Quién apunta a un «Ir a», en palabras (la tarjeta de antes y por cuál salida). */
function padresTexto(pasos: Paso[], id: string): string {
  const out: string[] = [];
  pasos.forEach((p, i) => {
    const pid = idDe(p, i);
    const c = claseDe(p);
    if (p.siguiente === id) out.push(`${pid} (${c})`);
    if (p.si_no === id) out.push(`${pid} · «Si no»`);
    for (const r of p.ramas ?? []) if (r.siguiente === id) out.push(`${pid} · rama`);
    for (const x of p.casos ?? []) if (x.siguiente === id) out.push(`${pid} · caso «${corto(x.titulo, 30)}»`);
    if ((p.paralelos ?? []).includes(id)) out.push(`${pid} · en paralelo`);
  });
  return out.join(', ') || 'nadie';
}

let conIrA = 0; let escribibles = 0; let escritas = 0; let riesgos = 0;
console.log(`${aplicar ? 'APLICAR' : 'SIMULACRO (no escribe nada)'} · ${todas.length} automatizaciones leídas${soloWs != null ? ` del ws${soloWs}` : ''}${conArchivadas ? ' · con archivadas' : ' · sólo vigentes'}\n`);

for (const s of todas) {
  if (s.archivada_at && !conArchivadas) continue;
  const pasos = normalizar((Array.isArray(s.pasos) ? s.pasos : []) as Paso[]);
  const saltos = pasos.filter((p) => claseDe(p) === 'ir_a');
  if (!saltos.length) continue;
  conIrA += 1;
  const cab = `── ws${s.workspace_id} · #${s.id} «${s.nombre}» (${s.archivada_at ? 'ARCHIVADA' : s.activa ? 'activa' : 'pausada'} · CRON: ${rotulo(s.trigger_tipo)})`;
  console.log(cab);
  for (const j of saltos) {
    const d = j.destino;
    const a = !d ? 'a ningún lado' : 'nodo' in d ? `a la tarjeta ${d.nodo}` : `a la automatización #${d.secuencia_id}`;
    console.log(`  ↪ ${j.id}: va ${a} · lo apunta ${padresTexto(pasos, j.id!)}`);
  }
  const r = quitarIrA(pasos, { nombreDeSecuencia: (id) => porId.get(id)?.nombre ?? null });
  for (const c of r.cambios) {
    const como = c.como === 'flecha' ? 'PASA A FLECHA' : c.como === 'quitado' ? 'SE SACA' : 'QUEDA';
    console.log(`  · ${c.id}: ${como} — ${c.nota}`);
    if (c.destino && 'secuencia_id' in c.destino) {
      const v = destinoDe(s.workspace_id, Number(c.destino.secuencia_id));
      if (v.riesgo) riesgos += 1;
      console.log(`      ${v.riesgo ? '⚠️ ' : ''}${v.texto}`);
    }
  }
  console.log(`  tarjetas: ${pasos.length} → ${r.pasos.length}`);
  if (r.erroresNuevos.length) {
    console.log(`  ✖ NO SE ESCRIBE: la conversión trae errores de publicar que no estaban: ${r.erroresNuevos.join(' · ')}\n`);
    continue;
  }
  if (!r.convertida) { console.log('  (nada que escribir)\n'); continue; }

  // Las inscripciones vivas paradas en un «Ir a» (por `nodo_actual` o adentro de un hilo).
  const ids = saltos.map((p) => p.id!);
  const { data: ins, error: eI } = await db.from('nutricion_inscripciones').select('id, estado, nodo_actual, hilos')
    .eq('workspace_id', s.workspace_id).eq('secuencia_id', s.id).in('estado', ['activa', 'respondio', 'pendiente', 'pausada']);
  if (eI) throw new Error(`nutricion_inscripciones #${s.id}: ${eI.message}`);
  const vivas = (ins ?? []) as Array<{ id: number; estado: string; nodo_actual: string | null; hilos: unknown }>;
  const paradas = vivas.filter((v) => (v.nodo_actual && ids.includes(v.nodo_actual))
    || (Array.isArray(v.hilos) && (v.hilos as Array<{ nodo?: unknown }>).some((h) => typeof h?.nodo === 'string' && ids.includes(h.nodo))));
  console.log(`  inscripciones vivas: ${vivas.length} · paradas en un «Ir a»: ${paradas.length}${paradas.length ? ` (${paradas.map((v) => `#${v.id}`).join(', ')})` : ''}`);
  if (paradas.length) { console.log('  ✖ NO SE ESCRIBE: hay inscripciones paradas en un «Ir a» que se saca\n'); continue; }
  escribibles += 1;
  if (!aplicar) { console.log(''); continue; }

  // ── Escribir (compare-and-set: si alguien publicó mientras tanto, no se pisa) ─────────────────
  const nuevos = r.pasos.map((p, i) => ({ ...p, orden: i + 1 }));
  let upd = db.from('nutricion_secuencias').update({ pasos: nuevos, updated_at: new Date().toISOString() })
    .eq('id', s.id).eq('workspace_id', s.workspace_id);
  upd = s.updated_at ? upd.eq('updated_at', s.updated_at) : upd.is('updated_at', null);
  const { data: hecho, error: eU } = await upd.select('id');
  if (eU) throw new Error(`escribir #${s.id}: ${eU.message}`);
  if (!hecho?.length) { console.log('  ✖ NO SE ESCRIBIÓ: la automatización cambió mientras tanto (volvé a correr el simulacro)\n'); continue; }
  // Releer con el lector de la pantalla: ningún «Ir a» que se haya sacado sigue ahí.
  const { data: re, error: eR } = await db.from('nutricion_secuencias').select('pasos').eq('id', s.id).eq('workspace_id', s.workspace_id).maybeSingle();
  if (eR) throw new Error(`releer #${s.id}: ${eR.message}`);
  const quedan = (((re as { pasos?: unknown } | null)?.pasos ?? []) as Paso[]).filter((p) => claseDe(p) === 'ir_a' && r.cambios.some((c) => c.id === p.id && c.como !== 'queda'));
  if (quedan.length) throw new Error(`#${s.id}: después de escribir siguen ${quedan.length} «Ir a» que se sacaban`);
  escritas += 1;
  console.log('  ✓ escrita\n');
}

console.log(`Resumen: ${conIrA} con «Ir a» · ${escribibles} se pueden escribir · ${riesgos} riesgo(s)${aplicar ? ` · ${escritas} escritas` : ' · (simulacro: no se escribió nada)'}`);
