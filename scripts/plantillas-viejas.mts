// =============================================================================
// plantillas-viejas — lo GUARDADO que quedó viejo con la sexta tanda (09/10/2026, General 15)
// =============================================================================
// Pedido de Martín: «Hay plantillas que quedaron viejas con todos los cambios, incluso que no tienen
// sentido porque quedaron con configuraciones viejas obsoletas... Cuando termines de implementar
// todo, revisalas». Lo de la PLATAFORMA (el catálogo, las semillas, Crear con IA) se arregló en el
// código; esto mira lo que ya está guardado en la base de cada negocio:
//
//   · el store de los mensajes de MaKo en WhatsApp (`app_settings`, clave `mako.plantillas.store`);
//   · las automatizaciones vivas (`nutricion_secuencias` no archivadas).
//
//   npx tsx scripts/plantillas-viejas.mts                  → SIMULACRO (default): sólo lee e imprime
//   npx tsx scripts/plantillas-viejas.mts --simular        → lo mismo, dicho explícito
//   npx tsx scripts/plantillas-viejas.mts --aplicar        → escribe lo IDÉNTICO (NO se corrió: lo decide Martín)
//   opciones: --env=<ruta del .env.local> (default ./.env.local) · --ws=<id>
//             --con-textos-del-codigo  → con --aplicar, borra también los textos guardados que no salen
//
// QUÉ ESCRIBE --aplicar, y por qué es idéntico (lo que el motor manda no cambia en NADA):
//   [S1] un paso «⚡ Acción» VIEJO (sin `operacion`, sólo el `accion` de antes) → se saca. No corre
//        (`operacionDelPaso`, lib/flujos-tipos.ts) y el lienzo lo dibuja «Elige una acción».
//   [S2] un flujo VACÍO (sin pasos, disparador manual) de un mensaje que no trae cadencia de fábrica
//        → se saca la clave `flujo`. No corre nada con él ni sin él, y el lienzo dibuja lo mismo. (En
//        un mensaje CON cadencia de fábrica —la cobranza— un flujo vacío guardado APAGA esa cadencia:
//        sacarlo la prendería. Ése no se toca: se lista.)
//   [S3] el texto y el borrador guardados de un mensaje cuyo texto arma el código (`textoDelCodigo`):
//        no salen nunca. Sólo con --con-textos-del-codigo, porque es texto que alguien escribió.
//   [S6] la entrada de un mensaje que ya no existe en el catálogo (y no es propio del negocio): no la
//        lee nadie.
// Lo demás se LISTA con su motivo, sin escribir: son decisiones o tienen su propio script.
//
// QUÉ SE LISTA de las automatizaciones (ninguna se escribe acá):
//   [Q1] un «Ir a» (GO TO, que la sexta tanda sacó) → lo convierte scripts/quitar-ir-a.mts.
//   [Q2] la post-agenda VIEJA (`agendado_sin_confirmar`) viva: si convive con la familia nueva
//        (`agendado_ya_contactado` / `agendado_primer_contacto`) y se activa, el lead recibe los dos audios.
//   [Q3] una lista de antes (sin tarjetas): el lienzo la convierte al abrirla.
//   [Q4] un mensaje con relleno «[…]»: no sale nunca (`RX_RELLENO`).
//   [Q5] `{{negocio}}` («Tu negocio», que salió de todos los «{ }»): sin el nombre del negocio cargado
//        le llega CRUDO al lead.
//   [Q6] una automatización manual: no inscribe a nadie, no la puede arrancar ningún CRON.
//   [Q7] la estrategia de una lista (modo asistido, fallo por silencio, «sigue con») sobre un flujo de
//        tarjetas: el motor viejo hace por su lado lo que ya hacen las tarjetas.
//   [Q8] un texto que vosea, en un mensaje al lead.
//   Y las dos post-agenda EN VIVO del ws1 (#212 y #213, de un cliente) se nombran siempre como «no se
//   tocan»: lo que sale de ellas no cambia sin que lo decida Martín.
//
// ⚠️ ESCRIBE CON LA SERVICE ROLE: cada lectura y escritura filtra `workspace_id` a mano. Y la
// escritura es compare-and-set sobre `updated_at`: si alguien guardó mientras tanto, no se pisa. El
// valor se escribe como lo escribe `setSetting` (lib/settings.ts): el JSON como TEXTO. Y se relee y se
// verifica que las claves sigan siendo ids de mensajes (AGENTS.md: un respaldo que guardó el JSON con
// una capa de más dejaba «0», «1», «2» como claves y la relectura propia no lo veía).
// =============================================================================

import { config } from 'dotenv';

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
if (aplicar && process.argv.includes('--simular')) throw new Error('--aplicar y --simular a la vez: elige uno');
const conTextos = process.argv.includes('--con-textos-del-codigo');
config({ path: arg('env') ?? '.env.local' });
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;
if (soloWs != null && !Number.isInteger(soloWs)) throw new Error('--ws tiene que ser un número');

const { CATALOGO_AVISOS, textoLoArmaElCodigo } = await import('../lib/avisos-catalogo');
const { operacionDelPaso, EVENTOS_SIN_EMISOR } = await import('../lib/flujos-tipos');
const { esFlujoExplicito, tieneLegado } = await import('../lib/flujo-legado');
const { claseDe } = await import('../lib/flujo-grafo');
const { marcasDeVoseo } = await import('../lib/puestas-data');
const { createClient } = await import('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (pasa --env=<ruta del .env.local>)');
const db = createClient(url, key, { auth: { persistSession: false } });

const KEY_STORE = 'mako.plantillas.store';
/** Las post-agenda en vivo del ws1 (un cliente): se nombran, nunca se escriben. */
const EN_VIVO_NO_SE_TOCAN = new Set([212, 213]);
/** El mismo patrón que el motor (lib/nutricion.ts): un `[…]` en el cuerpo y el paso no sale. */
const RX_RELLENO = /\[(?!tu link)[^\]\n]{2,80}\]/i;
const corto = (x: unknown, n = 160): string => { const s = JSON.stringify(x) ?? 'null'; return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

type Paso = { tipo?: string; operacion?: string; accion?: unknown; [k: string]: unknown };
type Flujo = { version?: number; activo?: boolean; disparador?: { tipo?: string; evento?: string }; pasos?: Paso[] };
type Entrada = { texto?: string; borrador?: string; custom?: unknown; flujo?: Flujo; [k: string]: unknown };
type Cambio = { codigo: string; id: string; motivo: string; idem: boolean; antes: unknown; despues: unknown };

// ── El store de los mensajes ────────────────────────────────────────────────────────────────────
function revisarStore(store: Record<string, Entrada>): { nuevo: Record<string, Entrada>; cambios: Cambio[]; avisos: Cambio[] } {
  const nuevo: Record<string, Entrada> = JSON.parse(JSON.stringify(store));
  const cambios: Cambio[] = [];
  const avisos: Cambio[] = [];
  for (const [id, e0] of Object.entries(store)) {
    const e = nuevo[id];
    const cat = CATALOGO_AVISOS.find((c) => c.id === id);
    if (!cat && !e0.custom) {
      cambios.push({ codigo: 'S6', id, motivo: 'el mensaje ya no existe en el catálogo: nadie lee esta entrada', idem: true, antes: e0, despues: null });
      delete nuevo[id];
      continue;
    }
    const f = e.flujo;
    if (f && Array.isArray(f.pasos)) {
      const viejos = f.pasos.filter((p) => p?.tipo === 'accion' && operacionDelPaso(p as { operacion?: string }) == null);
      if (viejos.length) {
        const antes = f.pasos;
        f.pasos = f.pasos.filter((p) => !viejos.includes(p));
        cambios.push({ codigo: 'S1', id, motivo: `${viejos.length} paso(s) «⚡ Acción» de antes, sin acción elegida: no corren`, idem: true, antes, despues: f.pasos });
      }
      if (f.disparador?.tipo === 'evento' && EVENTOS_SIN_EMISOR.some((x) => x.key === f.disparador?.evento)) {
        avisos.push({ codigo: 'S4', id, motivo: `su CRON es «${f.disparador.evento}», que ya no lo emite nada: el mensaje no sale por ahí`, idem: false, antes: f.disparador, despues: f.disparador });
      }
      if (e0.custom && f.disparador?.tipo === 'evento') {
        avisos.push({ codigo: 'S5', id, motivo: 'mensaje PROPIO con un evento: el motor corre sus pasos y NO manda el mensaje (lib/flujos.ts, `dispararEvento`). Lo decide Martín', idem: false, antes: { enabled: e0.enabled, pasos: f.pasos?.length ?? 0 }, despues: null });
      }
      const vacio = f.pasos.length === 0 && (f.disparador?.tipo ?? 'manual') === 'manual';
      if (vacio && cat?.flujoPorDefecto) {
        avisos.push({ codigo: 'S2', id, motivo: 'flujo vacío guardado: APAGA la cadencia de fábrica de este mensaje. Sacarlo la prendería: lo decide Martín', idem: false, antes: f, despues: null });
      } else if (vacio) {
        cambios.push({ codigo: 'S2', id, motivo: 'flujo vacío (sin pasos, manual): no corre nada con él ni sin él', idem: true, antes: f, despues: null });
        delete e.flujo;
      }
    }
    if (cat && textoLoArmaElCodigo(id) && (typeof e.texto === 'string' || typeof e.borrador === 'string')) {
      const c: Cambio = { codigo: 'S3', id, motivo: 'texto/borrador guardado de un mensaje que arma el código: no sale nunca (sólo con --con-textos-del-codigo)', idem: true, antes: { texto: e.texto, borrador: e.borrador }, despues: null };
      if (conTextos) { cambios.push(c); delete e.texto; delete e.borrador; } else avisos.push({ ...c, idem: false });
    }
    // Una entrada que quedó sin nada propio es una que dice «este negocio tocó esto» sin haberlo tocado.
    if (nuevo[id] && Object.keys(nuevo[id]).length === 0) delete nuevo[id];
  }
  return { nuevo, cambios, avisos };
}

type FilaSetting = { workspace_id: number; key: string; value: string; updated_at: string };
let qs = db.from('app_settings').select('workspace_id, key, value, updated_at').eq('key', KEY_STORE).order('workspace_id', { ascending: true });
if (soloWs != null) qs = qs.eq('workspace_id', soloWs);
const { data: stores, error: errS } = await qs;
if (errS) throw new Error(`app_settings: ${errS.message}`);

let escritos = 0, fallidos = 0;
console.log(`\n══ MENSAJES DE MaKo EN WHATSAPP (${KEY_STORE}) — ${aplicar ? 'APLICANDO' : 'SIMULACRO'} ══`);
for (const fila of (stores ?? []) as FilaSetting[]) {
  let store: Record<string, Entrada>;
  try { store = JSON.parse(fila.value) as Record<string, Entrada>; } catch { console.log(`ws${fila.workspace_id}: el store no es JSON: no se toca`); continue; }
  if (!store || typeof store !== 'object' || Array.isArray(store) || Object.keys(store)[0] === '0') {
    console.log(`ws${fila.workspace_id}: el store no es un objeto de mensajes (¿una capa de más?): no se toca. Ver scripts/reparar-store-plantillas.ts`);
    continue;
  }
  const { nuevo, cambios, avisos } = revisarStore(store);
  if (!cambios.length && !avisos.length) { console.log(`ws${fila.workspace_id}: nada viejo (${Object.keys(store).length} entradas)`); continue; }
  console.log(`\nws${fila.workspace_id} (guardado ${fila.updated_at}):`);
  for (const c of cambios) console.log(`  [${c.codigo}] ${c.id}: ${c.motivo}\n        antes:   ${corto(c.antes)}\n        después: ${corto(c.despues)}`);
  for (const a of avisos) console.log(`  [${a.codigo}] ${a.id}: ${a.motivo} — NO se escribe\n        hoy:     ${corto(a.antes)}`);
  if (!aplicar || !cambios.length) continue;
  // ⚠️ COMPARE-AND-SET sobre `updated_at`, con el workspace explícito: si alguien guardó en el medio,
  // la fila no calza y no se pisa.
  const ahora = new Date().toISOString();
  const { data: upd, error: errU } = await db.from('app_settings')
    .update({ value: JSON.stringify(nuevo), updated_at: ahora })
    .eq('workspace_id', fila.workspace_id).eq('key', KEY_STORE).eq('updated_at', fila.updated_at)
    .select('workspace_id');
  if (errU) { fallidos++; console.log(`  ✗ no se pudo escribir: ${errU.message}`); continue; }
  if (!upd?.length) { fallidos++; console.log('  ✗ alguien guardó mientras tanto (updated_at cambió): no se pisó. Vuelve a correr el simulacro.'); continue; }
  // Se relee como lo lee el producto (`getSetting` + JSON.parse) y se mira la FORMA: claves que son
  // ids de mensajes, no «0», «1», «2».
  const { data: rel } = await db.from('app_settings').select('value').eq('workspace_id', fila.workspace_id).eq('key', KEY_STORE).maybeSingle();
  let ok = false;
  try {
    const leido = JSON.parse(String((rel as { value?: unknown } | null)?.value ?? '')) as Record<string, unknown>;
    const ks = Object.keys(leido);
    ok = ks.length === Object.keys(nuevo).length && ks.every((k) => k in nuevo) && ks[0] !== '0';
  } catch { ok = false; }
  if (ok) { escritos++; console.log(`  ✓ escrito y releído (${Object.keys(nuevo).length} entradas)`); }
  else { fallidos++; console.log('  ✗ ESCRITO PERO LA RELECTURA NO CALZA: revisar a mano YA (el valor de antes está arriba, en «antes»)'); }
}

// ── Las automatizaciones ────────────────────────────────────────────────────────────────────────
type Sec = {
  id: number; workspace_id: number; nombre: string; clave: string; trigger_tipo: string; activa: boolean;
  archivada_at: string | null; updated_at: string | null; pasos: unknown; estrategia: unknown;
};
let qa = db.from('nutricion_secuencias')
  .select('id, workspace_id, nombre, clave, trigger_tipo, activa, archivada_at, updated_at, pasos, estrategia')
  .is('archivada_at', null)
  .order('workspace_id', { ascending: true }).order('id', { ascending: true });
if (soloWs != null) qa = qa.eq('workspace_id', soloWs);
const { data: secs, error: errA } = await qa;
if (errA) throw new Error(`nutricion_secuencias: ${errA.message}`);
const vivas = (secs ?? []) as Sec[];

console.log(`\n══ AUTOMATIZACIONES (no archivadas: ${vivas.length}) — se LISTAN, no se escriben ══`);
const FAMILIA_NUEVA = new Set(['agendado_ya_contactado', 'agendado_primer_contacto']);
let conHallazgos = 0;
for (const s of vivas) {
  const pasos = (Array.isArray(s.pasos) ? s.pasos : []) as Array<Record<string, unknown>>;
  const est = (s.estrategia ?? null) as { modo?: string; desenlace?: { falloHoras?: number; logradoSecuencia?: string | null } } | null;
  const flujo = esFlujoExplicito(pasos as never);
  const notas: string[] = [];
  const irA = pasos.filter((p) => claseDe(p as never) === 'ir_a').length;
  if (irA) notas.push(`[Q1] ${irA} «Ir a» (GO TO): los convierte scripts/quitar-ir-a.mts`);
  // «Agendó pero no confirmó» sigue siendo un CRON de hoy: el problema es CONVIVIR con la familia nueva
  // (la post-agenda partida en dos), que ya le escribe a ese mismo lead.
  if (s.trigger_tipo === 'agendado_sin_confirmar') {
    const conFamilia = vivas.some((o) => o.workspace_id === s.workspace_id && o.id !== s.id && FAMILIA_NUEVA.has(o.trigger_tipo));
    if (conFamilia) notas.push(`[Q2] CRON «Agendó pero no confirmó» y en este negocio YA corre la post-agenda nueva (las dos mitades): ${s.activa ? '⚠️ ESTÁ ACTIVA y' : 'si se activa,'} el lead recibe los mensajes de las dos. Lo decide Martín`);
    if (s.clave === 'chat-agent-post-agenda') notas.push('[Q2] es la post-agenda VIEJA del onboarding (una sola, antes de partirse en dos): el armado la archiva cuando nacen las dos nuevas');
  }
  if (!flujo && tieneLegado(pasos as never, est as never)) notas.push('[Q3] lista de antes: el lienzo la convierte al abrirla (o scripts/migrar-secuencias-a-grafo.mts)');
  const mensajes = pasos.filter((p) => claseDe(p as never) === 'mensaje');
  const conRelleno = mensajes.filter((p) => RX_RELLENO.test(String(p.cuerpo ?? '')) || RX_RELLENO.test(String(p.asunto ?? ''))).length;
  if (conRelleno) notas.push(`[Q4] ${conRelleno} mensaje(s) con relleno «[…]»: no salen nunca`);
  const textos = mensajes.flatMap((p) => [p.cuerpo, p.asunto, ...((p.variantes as unknown[] | undefined) ?? [])].map((t) => String(t ?? '')));
  if (textos.some((t) => /\{\{\s*negocio\s*\}\}/.test(t))) notas.push('[Q5] usa {{negocio}} («Tu negocio»): sin el nombre del negocio cargado le llega crudo al lead');
  if (s.trigger_tipo === 'manual') notas.push(`[Q6] CRON manual: no inscribe a nadie${s.activa ? '' : ' y está pausada'}`);
  if (flujo && est && (est.modo === 'asistido' || Number(est.desenlace?.falloHoras) > 0 || est.desenlace?.logradoSecuencia)) {
    notas.push(`[Q7] estrategia de lista sobre tarjetas (modo ${est.modo ?? '—'}, fallo ${est.desenlace?.falloHoras ?? 0} h, sigue con ${est.desenlace?.logradoSecuencia ?? '—'}): el motor viejo repite lo que hacen las tarjetas. Lo decide Martín`);
  }
  const voseo = [...new Set(mensajes
    .flatMap((p) => [p.cuerpo, ...((p.variantes as unknown[] | undefined) ?? [])].flatMap((t) => marcasDeVoseo(String(t ?? '')))))];
  if (voseo.length) notas.push(`[Q8] vosea: ${voseo.join(', ')}`);
  const vivo = EN_VIVO_NO_SE_TOCAN.has(s.id) && s.workspace_id === 1;
  if (!notas.length && !vivo) continue;
  conHallazgos++;
  console.log(`\nws${s.workspace_id} #${s.id} «${s.nombre}» [${s.trigger_tipo}] ${s.activa ? 'ACTIVA' : 'pausada'} · ${flujo ? 'tarjetas' : 'lista'} · ${pasos.length} pasos${vivo ? ' — EN VIVO (un cliente): no se toca' : ''}`);
  for (const n of notas) console.log(`  ${n}`);
  if (vivo && !notas.length) console.log('  (nada viejo)');
}
if (!conHallazgos) console.log('  ninguna con algo viejo');

console.log(`\n${aplicar ? `Escritos: ${escritos} · sin escribir por un problema: ${fallidos}` : 'SIMULACRO: no se escribió nada. Con --aplicar se escribe sólo lo marcado como idéntico (S1, S2, S6; S3 con --con-textos-del-codigo).'}`);
