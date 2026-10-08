// =============================================================================
// migrar-secuencias-a-grafo — las secuencias VIGENTES, de lista a flujo de tarjetas (08/10/2026)
// =============================================================================
// Pedido de Martín (08/10/2026): «Las tarjetas de condicional y Delay ya no existen... Elimina lo
// de "Termina si agenda"... Elimina completamente lo de arriba ese form». El modelo nuevo vive en
// lib/flujo-grafo.ts y la conversión en lib/flujo-legado.ts (`legadoAGrafo`): la espera de cada
// paso pasa a una tarjeta «Esperar», «Solo a leads recientes» y «Termina si agenda» a condiciones,
// los casos del modo asistido y el hand-off a «Si responde». Este script la corre sobre la base.
//
//   npx tsx scripts/migrar-secuencias-a-grafo.mts                     → DRY-RUN: sólo lee e imprime
//   npx tsx scripts/migrar-secuencias-a-grafo.mts --aplicar           → escribe
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id> (un solo negocio)
//
// Sólo las VIGENTES (`archivada_at` NULL): una archivada no corre, y si alguien la desarchiva, el
// lienzo la convierte al abrirla con la MISMA función.
//
// Con --aplicar, por cada secuencia que tenía algo que convertir:
//   · `pasos` ← la salida de `legadoAGrafo` (normalizada: ids y `siguiente` explícitos), validada
//     con `validarGrafo`: una que no valida NO se escribe y se dice por qué;
//   · `estrategia` ← la estrategia PARSEADA con la LIMPIEZA encima, y el objeto ENTERO (AGENTS.md:
//     «un campo nuevo en un objeto que se guarda ENTERO»): sin la limpieza, el motor viejo volvería
//     a hacer por su lado lo que ahora hacen las tarjetas (el desenlace global, el asistido);
//   · el HAND-OFF VIVO de esa secuencia se resuelve (`resuelto_at`: el banner que lo resolvía se
//     fue) y su inscripción congelada en 'handoff' pasa a 'respondio' con la CHARLA CERRADA por el
//     hand-off (`conversacion_cerrada_at` sin `conversacion_cierre`, lib/setter-conversacion.ts →
//     `cerradaPorUnaPersona`). ⚠️ NO a 'completada' a secas (revisión del 08/10/2026): ese lead
//     estaba esperando a una PERSONA, y como 'completada' sin desenlace su próximo mensaje entraba
//     por las «tardías» a «Si responde» y MaKo le contestaba solo. Con la charla cerrada, MaKo no
//     le contesta y le avisa al dueño que la sigue él; el desenlace la cierra como lograda, como a
//     cualquiera que contestó;
//   · las inscripciones vivas (activa / respondio) que NUNCA escribieron `nodo_actual` quedan en
//     el MISMO paso de antes por su id (`o<índice>`): con la conversión, el array cambia de orden y
//     el índice de antes apuntaría a otra tarjeta. La espera de ese paso ya está en su
//     `proximo_envio_at`, por eso se las deja en el mensaje y no en la espera de delante.
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE: cada lectura y cada escritura filtra `workspace_id` a mano.
// ⚠️ Y VA DESPUÉS DE LA 0223 (lee y escribe `nodo_actual`).
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
config({ path: arg('env') ?? '.env.local' });
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;

const { legadoAGrafo, tieneLegado, limpiezaPara } = await import('../lib/flujo-legado');
const { validarGrafo, claseDe, idDe, siguienteDe, textoRama, textoEspera, indicePorId } = await import('../lib/flujo-grafo');
const { parseEstrategia } = await import('../lib/setting-estrategia');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasá --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

type Paso = Record<string, unknown> & { orden?: number; canal?: string; tipo?: string; cuerpo?: string; delay_horas?: number };
type Fila = { id: number; workspace_id: number; clave: string; nombre: string; trigger_tipo: string; activa: boolean; pasos: unknown; estrategia: unknown };

let q = db.from('nutricion_secuencias')
  .select('id, workspace_id, clave, nombre, trigger_tipo, activa, pasos, estrategia')
  .is('archivada_at', null)
  .order('workspace_id', { ascending: true })
  .order('id', { ascending: true });
if (soloWs != null) q = q.eq('workspace_id', soloWs);
const { data: filas, error } = await q;
if (error) throw new Error(`nutricion_secuencias: ${error.message}`);
const secuencias = (filas ?? []) as Fila[];

// ¿Ya está la 0223? Sin `nodo_actual`, PostgREST rechaza la consulta entera. En dry-run se lee
// sin esa columna (toda inscripción cuenta como «sin nodo», que es lo que tendrá recién aplicada);
// con --aplicar no se sigue: reubicar escribe esa columna.
const { error: eProbe } = await db.from('nutricion_inscripciones').select('nodo_actual').limit(1);
const hay0223 = !eProbe;
if (!hay0223 && !/nodo_actual/.test(eProbe?.message ?? '')) throw new Error(`nutricion_inscripciones: ${eProbe?.message}`);
if (!hay0223 && aplicar) throw new Error('falta la migración 0223 (nutricion_inscripciones.nodo_actual): aplicala antes de --aplicar');

const corto = (t: unknown, n = 60): string => {
  const s = String(t ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** Un paso de ANTES, en una línea. */
function lineaAntes(p: Paso, i: number): string {
  const que = p.accion ? `acción ${String((p.accion as { operacion?: unknown }).operacion ?? '')}` : `${p.canal ?? '?'} ${p.tipo ?? 'texto'}${p.audio_id ? ` #${String(p.audio_id)}` : ''}`;
  const extra = [
    Number(p.delay_horas) > 0 ? `${Number(p.delay_horas)} h` : null,
    p.ancla === 'reunion' ? 'antes de la reunión' : null,
    p.requiere ? `requiere ${String(p.requiere)}` : null,
  ].filter(Boolean).join(' · ');
  return `    ${i + 1}. ${que}${extra ? ` · ${extra}` : ''}${p.cuerpo ? ` · «${corto(p.cuerpo)}»` : ''}`;
}

/** Un nodo de DESPUÉS, en una línea, con a dónde sigue. */
function lineaDespues(pasos: Paso[], i: number): string {
  const p = pasos[i];
  const id = idDe(p, i);
  const c = claseDe(p);
  const sig = (d: string | null | undefined) => d ?? 'termina';
  switch (c) {
    case 'esperar': return `    ${id}  ⏳ ${textoEspera(p.espera as never)} → ${sig(siguienteDe(pasos, i))}`;
    case 'condicion': {
      const ramas = ((p.ramas ?? []) as Array<{ siguiente: string | null }>).map((r) => `[${textoRama(r as never)}] → ${sig(r.siguiente)}`).join(' · ');
      return `    ${id}  ◇ condición: ${ramas} · si no → ${sig(p.si_no as string | null)}`;
    }
    case 'respuesta': {
      const casos = ((p.casos ?? []) as Array<{ titulo: string; siguiente: string | null }>).map((x) => `«${corto(x.titulo, 40)}» → ${sig(x.siguiente)}`).join(' · ');
      return `    ${id}  💬 si responde: ${casos || '(sin casos)'} · otra cosa → ${sig(p.si_no as string | null)}`;
    }
    case 'ir_a': {
      const d = p.destino as { secuencia_id?: number; nodo?: string } | null;
      return `    ${id}  ↪ ir a ${d?.secuencia_id != null ? `la automatización #${d.secuencia_id}` : `la tarjeta ${d?.nodo ?? '?'}`}`;
    }
    case 'accion': return `    ${id}  ⚡ ${String((p.accion as { operacion?: unknown }).operacion ?? '')} ${JSON.stringify((p.accion as { params?: unknown }).params ?? {})} → ${sig(siguienteDe(pasos, i))}`;
    default: {
      const revisa = p.revisar === true ? ' (borrador)' : p.revisar === false ? ' (sale sola)' : '';
      return `    ${id}  ✉ ${p.tipo ?? 'texto'}${p.audio_id ? ` #${String(p.audio_id)}` : ''}${revisa} · «${corto(p.cuerpo)}» → ${sig(siguienteDe(pasos, i))}`;
    }
  }
}

const porWs = new Map<number, Fila[]>();
for (const s of secuencias) porWs.set(s.workspace_id, [...(porWs.get(s.workspace_id) ?? []), s]);

let convertidas = 0; let sinCambios = 0; let invalidas = 0; let escritas = 0;
console.log(`${aplicar ? 'APLICAR' : 'DRY-RUN (no escribe nada)'} · ${secuencias.length} secuencias vigentes${soloWs != null ? ` del ws${soloWs}` : ''}${hay0223 ? '' : ' · la 0223 todavía NO está aplicada: las inscripciones se leen sin nodo'}\n`);

for (const [ws, delWs] of porWs) {
  // «Sigue con» apunta por CLAVE a otra secuencia del MISMO negocio: el id sale de acá.
  const idDeClave = (clave: string): number | null => delWs.find((x) => x.clave === clave)?.id ?? null;
  for (const s of delWs) {
    const pasos = (Array.isArray(s.pasos) ? s.pasos : []) as Paso[];
    // La estrategia PARSEADA, que es la que lee el motor: una cruda sin `objetivo` el motor la ve
    // como null (sin modo asistido, sin desenlace), así que convertirla desde la cruda inventaría
    // casos y desenlaces que hoy no corren.
    const est = parseEstrategia(s.estrategia);
    const estRaw = est as unknown as Parameters<typeof legadoAGrafo>[1];
    const cab = `── ws${ws} · #${s.id} «${s.nombre}» (${s.activa ? 'activa' : 'pausada'}, ${s.trigger_tipo})`;
    if (!tieneLegado(pasos as never, estRaw)) {
      sinCambios += 1;
      console.log(`${cab}\n  ya es un flujo de tarjetas: no hay nada que convertir\n`);
      continue;
    }
    convertidas += 1;
    const r = legadoAGrafo(pasos as never, estRaw, { idDeClave });
    const nuevos = r.pasos as unknown as Paso[];
    const errores = validarGrafo(nuevos as never);
    const d = est?.desenlace;
    console.log(cab);
    console.log(`  ANTES (${pasos.length} pasos · modo ${est?.modo ?? '—'} · sale sola ${est?.envio_automatico ? 'sí' : 'no'} · casos ${est?.escenarios.length ?? 0}`
      + `${est?.antiguedad_max_horas ? ` · sólo leads de menos de ${est.antiguedad_max_horas} h` : ''}`
      + `${d && d.logrado !== 'ninguno' ? ` · termina si ${d.logrado}${d.logradoSecuencia ? ` → ${d.logradoSecuencia}` : ''}` : ''}`
      + `${d && d.falloHoras > 0 ? ` · perdida a las ${d.falloHoras} h${d.falloSecuencia ? ` → ${d.falloSecuencia}` : ''}` : ''})`);
    pasos.forEach((p, i) => console.log(lineaAntes(p, i)));
    console.log(`  DESPUÉS (${nuevos.length} tarjetas)`);
    nuevos.forEach((_, i) => console.log(lineaDespues(nuevos, i)));
    if (r.notas.length) console.log(`  NOTAS:\n${r.notas.map((n) => `    · ${n}`).join('\n')}`);
    if (errores.length) {
      invalidas += 1;
      console.log(`  ✖ NO VALIDA: ${errores.join(' · ')}\n`);
      continue;
    }

    // Lo que hay que mover además de la fila: el hand-off vivo y las inscripciones sin nodo.
    const { data: hs, error: eH } = await db.from('chat_agent_handoffs').select('id, lead_id')
      .eq('workspace_id', ws).eq('secuencia_id', s.id).is('resuelto_at', null);
    if (eH) throw new Error(`chat_agent_handoffs #${s.id}: ${eH.message}`);
    const handoffs = (hs ?? []) as Array<{ id: number; lead_id: number | null }>;
    const { data: ins, error: eI } = await db.from('nutricion_inscripciones').select(hay0223 ? 'id, lead_id, estado, paso_actual, nodo_actual' : 'id, lead_id, estado, paso_actual')
      .eq('workspace_id', ws).eq('secuencia_id', s.id).in('estado', ['activa', 'respondio', 'handoff']);
    if (eI) throw new Error(`nutricion_inscripciones #${s.id}: ${eI.message}`);
    const vivas = ((ins ?? []) as unknown as Array<{ id: number; lead_id: number; estado: string; paso_actual: number; nodo_actual?: string | null }>)
      .map((v) => ({ ...v, nodo_actual: v.nodo_actual ?? null }));
    const aReubicar = vivas.filter((v) => v.estado !== 'handoff' && v.nodo_actual == null && indicePorId(nuevos as never, `o${v.paso_actual}`) >= 0);
    console.log(`  hand-offs sin resolver: ${handoffs.length}${handoffs.length ? ` (${handoffs.map((h) => `#${h.id}`).join(', ')}) → se resuelven` : ''}`);
    console.log(`  inscripciones vivas: ${vivas.length} (${vivas.map((v) => `${v.id}:${v.estado}`).join(', ') || '—'}) · a reubicar por id: ${aReubicar.length}`);

    if (!aplicar) { console.log(''); continue; }

    // ── Escribir ────────────────────────────────────────────────────────────────────
    const estrategiaNueva = est ? { ...est, ...limpiezaPara(est) } : null;
    const { error: eU } = await db.from('nutricion_secuencias')
      .update({ pasos: nuevos, ...(estrategiaNueva ? { estrategia: estrategiaNueva } : {}), updated_at: new Date().toISOString() })
      .eq('id', s.id).eq('workspace_id', ws);
    if (eU) throw new Error(`escribir #${s.id}: ${eU.message}`);
    escritas += 1;
    const ahora = new Date().toISOString();
    if (handoffs.length) {
      const { error: e1 } = await db.from('chat_agent_handoffs').update({ resuelto_at: ahora, escenario: '(pasó a «Si responde» del flujo)' })
        .eq('workspace_id', ws).in('id', handoffs.map((h) => h.id)).is('resuelto_at', null);
      if (e1) throw new Error(`resolver hand-offs #${s.id}: ${e1.message}`);
      const leads = handoffs.map((h) => h.lead_id).filter((x): x is number => x != null);
      if (leads.length) {
        // La charla la sigue una PERSONA: cerrada por el hand-off (fecha, sin motivo), no completada.
        const { error: e2 } = await db.from('nutricion_inscripciones')
          .update({ estado: 'respondio', proximo_envio_at: null, conversacion_cerrada_at: ahora, conversacion_cierre: null, updated_at: ahora })
          .eq('workspace_id', ws).eq('secuencia_id', s.id).eq('estado', 'handoff').in('lead_id', leads);
        if (e2) throw new Error(`inscripciones en hand-off #${s.id}: ${e2.message}`);
      }
    }
    for (const v of aReubicar) {
      const id = `o${v.paso_actual}`;
      const { error: e3 } = await db.from('nutricion_inscripciones')
        .update({ nodo_actual: id, paso_actual: indicePorId(nuevos as never, id), updated_at: ahora })
        .eq('id', v.id).eq('workspace_id', ws).is('nodo_actual', null).eq('paso_actual', v.paso_actual);
      if (e3) throw new Error(`reubicar la inscripción ${v.id}: ${e3.message}`);
    }
    console.log('  ✓ escrita\n');
  }
}

console.log(`Resumen: ${convertidas} para convertir · ${sinCambios} sin cambios · ${invalidas} que no validan${aplicar ? ` · ${escritas} escritas` : ' · nada escrito (dry-run)'}`);
