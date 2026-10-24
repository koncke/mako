// =============================================================================
// crm-auto-a-automatizaciones — el CRM automático de cada negocio, a automatizaciones VISIBLES (b5)
// =============================================================================
// Regla de Martín (14/10/2026): «MaKo no decide nada que no esté en el flujo». El motor del CRM automático
// (lib/crm-auto.ts, cron /api/cron/crm-automatico) movía leads por detrás con cuatro reglas: T1 (reunión pasada sin
// marcar), T2 (lead sin agendar), T3 (nutrición manual vencida) y T6 (No responde / Perdido 30 días). Este script crea
// en cada negocio donde el motor está PRENDIDO las plantillas que lo reemplazan, con las etapas de su CRM. Lo que se
// crea, y por qué así, lo decide `planDelNegocio` (lib/crm-auto-migracion.ts, puro y con tests): «Un Lead No Agendó»,
// una «Una Reunión Sin Marcar» por reunión y «Venció la Nutrición Manual». T6 no (ver ahí).
//
// Tres pasos, cada uno con su bandera (nunca dos juntas):
//   (sin bandera)  SIMULACRO: lee e imprime el antes (lo que el motor hizo en 30 días y haría hoy), lo que se crearía,
//                  a quién toma cada una al prenderla, quién avisa enseguida y las confirmaciones pendientes. No escribe.
//   --aplicar      crea las que faltan, PAUSADAS (no le escriben ni mueven a nadie). Cada una se relee, y el respaldo
//                  se escribe después de cada creación.
//   --activar      TODO O NADA, en este orden: prende las del plan, las relee, apaga el motor del negocio con
//                  compare-and-set, vuelve a leer las confirmaciones pendientes, archiva las que quedan cubiertas y deja
//                  su línea en el historial de cada lead. Si algo falla, deshace lo de esta corrida al revés. SÓLO con el
//                  OK de Martín: son clientes reales y cambia qué pasa con sus leads.
//   opciones: --ws=<id> · --respaldo=<carpeta> (default: la carpeta actual) · --aunque-duplique (activar aunque otra
//             activa le escriba lo mismo a la misma gente: sólo si Martín lo dijo, después de ver el aviso)
//
// Correr (desde la raíz del repo):
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/crm-auto-a-automatizaciones.mts
//
// ⚠️ QUÉ NEGOCIOS: los que tienen el motor PRENDIDO de verdad, con la MISMA regla que el motor (`flag`, lib/envio-flags.ts):
// el setting `crm_auto_enabled` lo dice; sin setting, el dueño (ws1) hereda el env CRM_AUTO_ENABLED de VERCEL, que este
// script no ve, y un cliente queda apagado. Para el dueño sin setting cuenta la evidencia: líneas que escribió el MOTOR en
// los últimos 14 días (`logRegla`: «T2: …»), no las de una persona que resolvió una confirmación («MaKo (T1): …»).
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);

const arg = (n: string): string | null => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : null;
};
const aplicar = process.argv.includes('--aplicar');
const activar = process.argv.includes('--activar');
const aunqueDuplique = process.argv.includes('--aunque-duplique');
const soloWs = arg('ws') != null ? Number(arg('ws')) : null;
const carpetaRespaldo = arg('respaldo') ?? '.';
// Juntas, --activar apagaba el motor con lo que --aplicar acababa de crear sin que nadie lo mirara (S2): son dos pasos.
if (aplicar && activar) throw new Error('--aplicar y --activar van en dos corridas: primero se crean pausadas y se miran, después se prenden');

const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');
const { OWNER_WS } = await imp('lib/auth-session.ts');
const { getFunnelDefault, leerFunnels } = await imp('lib/funnels.ts');
const { productosConEtapas } = await imp('lib/setting-secuencias.ts');
const { setSecuenciaPasos, setSecuenciaActiva, DuplicadaError } = await imp('lib/nutricion.ts');
const { guardarDisparadores } = await imp('lib/disparadores-guardar.ts');
const { crearDesdePlantilla } = await imp('lib/plantilla-crear.ts');
const { plantillaPorId } = await imp('lib/plantillas-automatizaciones.ts');
const { problemasDeForma } = await imp('lib/flujo-forma.ts');
const { validarGrafo } = await imp('lib/flujo-grafo.ts');
const { planLeadAuto, AUTO_UMBRALES } = await imp('lib/crm-auto-plan.ts');
const { crmAutoHabilitado, KEY_CRM_AUTO } = await imp('lib/envio-flags.ts');
const { cambiarSettingSi, borrarSettingSi, getSettingEstricto } = await imp('lib/settings.ts');
const { hoyEnTijuana, hoyEnTz } = await imp('lib/date-utils.ts');
const { tzActual } = await imp('lib/timezone.ts');
const {
  planDelNegocio, alPlan, clasificarVivas, diferenciaConElPlan, tomaAlPrender, claveAntiLoop, claveDelPlan, confirmacionesAArchivar, etapaDeValor,
} = await imp('lib/crm-auto-migracion.ts');
const { createClient } = await import('@supabase/supabase-js');
const { writeFileSync, readFileSync, existsSync } = await import('node:fs');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
if (!url || !key) throw new Error('faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
const db = createClient(url, key, { auth: { persistSession: false } });

type Stage = { key: string; label?: string; kind?: string };
type Plan = { plantilla: string; regla: 'T1' | 'T2' | 'T3'; cron: string; etapas: string[]; destinos?: Record<string, string>; ancla?: 'reunion_1' | 'reunion_2'; reunion?: string };
type Fila = { id: number; clave: string | null; nombre: string; activa: boolean; trigger_tipo: string | null; disparadores: unknown; pasos: unknown };
type Conf = { id: number; lead_id: number; lead_nombre: string | null; regla: string; clave: string; aplicado: boolean | null; motivo?: string; porque?: string };
type Toma = { ids: number[]; sinFecha: number[]; delGrupo: number[]; fueraDeVentana: number[]; avisaEnseguida: number[] };

const AUTO_COLS = 'id, nombre, funnel_id, estado_lead, pipeline_stage, fecha_agenda, fecha_junta_1, fecha_junta_2, junta_1_at, junta_2_at, asistio_j1, asistio_j2, nutricion_manual_deadline, nutricion_realizada, created_at, updated_at, origen_lead';
const COLS_VIVA = 'id, clave, nombre, activa, trigger_tipo, disparadores, pasos';
const COLS_CONF = 'id, lead_id, lead_nombre, regla, clave, aplicado';
const AUTOR = 'CRM automático → automatizaciones (b5)';
/** Las líneas que escribe el MOTOR (`logRegla`, lib/crm-auto.ts: «T2: …»). Las de una persona empiezan con «MaKo (T1)». */
const DEL_MOTOR = 'T_:%';
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function leadsDe(ws: number): Promise<Array<Record<string, unknown>>> {
  const out: Array<Record<string, unknown>> = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('leads').select(AUTO_COLS).eq('workspace_id', ws).order('id').range(desde, desde + 999);
    if (error) throw new Error(`ws${ws} leads: ${error.message}`);
    out.push(...(data ?? []));
    if ((data ?? []).length < 1000) return out;
  }
}

async function vivasDe(ws: number): Promise<Fila[]> {
  const { data, error } = await db.from('nutricion_secuencias').select(COLS_VIVA).eq('workspace_id', ws).is('archivada_at', null);
  if (error) throw new Error(`ws${ws} secuencias: ${error.message}`);
  return (data ?? []) as Fila[];
}

/** Quién ya tiene una inscripción en esa automatización (una por lead y automatización: no vuelve a entrar). */
async function yaPasaronPor(ws: number, secuenciaId: number): Promise<Set<number>> {
  const out = new Set<number>();
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await db.from('nutricion_inscripciones').select('lead_id').eq('workspace_id', ws).eq('secuencia_id', secuenciaId).order('id').range(desde, desde + 999);
    if (error) throw new Error(`ws${ws} inscripciones de #${secuenciaId}: ${error.message}`);
    for (const r of (data ?? []) as Array<{ lead_id: number }>) out.add(Number(r.lead_id));
    if ((data ?? []).length < 1000) return out;
  }
}

async function pendientesDe(ws: number): Promise<Conf[]> {
  const { data, error } = await db.from('mako_confirmaciones').select(COLS_CONF).eq('workspace_id', ws).eq('estado', 'pendiente');
  if (error) throw new Error(`ws${ws} confirmaciones: ${error.message}`);
  return (data ?? []) as Conf[];
}

/**
 * EL RESPALDO, uno por negocio y ACUMULADO: cada corrida se suma a las anteriores y se escribe después de CADA escritura
 * (S3), así un corte a mitad no pierde los ids. Con él se deshace a mano lo que el script hizo.
 */
function respaldoDe(ws: number) {
  const ruta = `${carpetaRespaldo}/crm-auto-respaldo-ws${ws}.json`;
  let previo: { ws: number; corridas: unknown[] } = { ws, corridas: [] };
  if (existsSync(ruta)) {
    const viejo = JSON.parse(readFileSync(ruta, 'utf8'));
    previo = Array.isArray(viejo?.corridas) ? viejo : { ws, corridas: [viejo] };
  }
  const corrida = {
    cuando: new Date().toISOString(), modo: activar ? 'activar' : 'aplicar', creadas: [] as unknown[], activadas: [] as number[],
    archivadas: [] as number[], lineas: [] as number[], setting: null as unknown, deshecho: null as unknown,
  };
  previo.corridas.push(corrida);
  const guardar = () => {
    writeFileSync(ruta, JSON.stringify(previo, null, 2));
    const releido = JSON.parse(readFileSync(ruta, 'utf8'));
    if (releido.corridas.length !== previo.corridas.length) throw new Error(`ws${ws}: el respaldo no se releyó igual`);
  };
  return { ruta, corrida, guardar };
}

// ── Qué negocios ─────────────────────────────────────────────────────────────────────────────
let qw = db.from('workspaces').select('id, nombre, estado').eq('estado', 'activo').order('id', { ascending: true });
if (soloWs != null) qw = qw.eq('id', soloWs);
const { data: wss, error: ew } = await qw;
if (ew) throw new Error(`workspaces: ${ew.message}`);
const { data: flags, error: ef } = await db.from('app_settings').select('workspace_id, value').eq('key', 'crm_auto_enabled');
if (ef) throw new Error(`crm_auto_enabled: ${ef.message}`);
// El valor CRUDO, para el compare-and-set; el limpio, para decidir.
const flagCrudo = new Map((flags ?? []).map((f: { workspace_id: number; value: unknown }) => [f.workspace_id, String(f.value)]));
const hace14 = new Date(Date.now() - 14 * 86_400_000).toISOString();

console.log(`\n══ CRM AUTOMÁTICO → AUTOMATIZACIONES — ${activar ? 'ACTIVANDO' : aplicar ? 'CREANDO (pausadas)' : 'SIMULACRO'} ══`);
for (const w of (wss ?? []) as Array<{ id: number; nombre: string | null }>) {
  const crudo = flagCrudo.get(w.id) ?? null;
  const flag = crudo == null ? null : crudo.replace(/"/g, '');
  let prendido = flag === 'true';
  let evidencia = flag != null ? `setting = ${flag}` : '';
  if (flag == null && w.id !== OWNER_WS) {
    // Un cliente sin la fila tiene el motor APAGADO (`flag`): una línea vieja en su historial no lo prende.
    evidencia = 'sin setting: en un cliente, el motor está apagado';
  } else if (flag == null) {
    const { count, error } = await db.from('lead_audit').select('id', { count: 'exact', head: true })
      .eq('workspace_id', w.id).eq('campo', 'CRM automático').like('valor_nuevo', DEL_MOTOR).gt('created_at', hace14);
    if (error) throw new Error(`ws${w.id} lead_audit: ${error.message}`);
    prendido = (count ?? 0) > 0;
    evidencia = `sin setting; ${count ?? 0} movimientos del motor en 14 días`;
  }
  if (!prendido) { if (soloWs != null) console.log(`ws${w.id}: el motor está apagado (${evidencia}): nada`); continue; }

  console.log(`\n── ws${w.id} «${w.nombre ?? ''}» — motor PRENDIDO (${evidencia})`);
  await runWithWorkspace(w.id, async () => {
    // EL FUNNEL Y LOS PRODUCTOS, o nada (S9): con la lectura caída, `getFunnelDefault` devuelve las etapas de FÁBRICA y el
    // plan saldría con etapas que el negocio quizá no tiene. Lo mismo `listarFunnels` con `[]`.
    const funnel = await getFunnelDefault();
    if (funnel.origen === 'error') { console.log('   ✗ no pude leer el funnel del negocio: no se toca nada'); return; }
    if ((await leerFunnels()) == null) { console.log('   ✗ no pude leer los productos del negocio: no se toca nada'); return; }
    const stages = funnel.stages as Stage[];
    const vendibles = new Set<string>(((await productosConEtapas()) as Array<{ etapas: Array<{ value: string }> }>).flatMap((p) => p.etapas.map((e) => e.value)));
    const { planes, faltan, bloqueos } = planDelNegocio(stages, vendibles, funnel.id ?? null) as { planes: Plan[]; faltan: string[]; bloqueos: string[] };
    const nombreEtapa = (k: string) => stages.find((s) => s.key === k)?.label ?? k;

    // EL ANTES: lo que hizo en 30 días y lo que haría hoy de VERDAD (S7): sin lo que ya tiene confirmación, como el motor
    // (`yaConf`, lib/crm-auto.ts). Con los umbrales de fábrica: si el negocio declaró otros, el motor los lee de su funnel.
    const { data: mov, error: em } = await db.from('lead_audit').select('valor_nuevo')
      .eq('workspace_id', w.id).eq('campo', 'CRM automático').like('valor_nuevo', DEL_MOTOR).gt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString());
    if (em) throw new Error(`ws${w.id} lead_audit: ${em.message}`);
    const hizo: Record<string, number> = {};
    for (const m of (mov ?? []) as Array<{ valor_nuevo: string | null }>) { const r = /^(T\d)/.exec(m.valor_nuevo ?? '')?.[1] ?? '?'; hizo[r] = (hizo[r] ?? 0) + 1; }
    const { data: confs, error: ec } = await db.from('mako_confirmaciones').select('id, lead_id, clave, estado').eq('workspace_id', w.id);
    if (ec) throw new Error(`ws${w.id} mako_confirmaciones: ${ec.message}`);
    const todas = (confs ?? []) as Array<{ id: number; lead_id: number; clave: string; estado: string }>;
    const yaConf = new Set(todas.map((c) => `${c.lead_id}|${c.clave}`));
    const pendientes = await pendientesDe(w.id);
    const leads = await leadsDe(w.id);
    const hoy = hoyEnTijuana();
    // El día y la zona del NEGOCIO, los de «Venció su nutrición manual» y del ancla de la espera (lib/nutricion.ts): no Tijuana.
    const zona = await tzActual();
    const hoyDelNegocio = hoyEnTz(zona);
    const haria: Record<string, number[]> = {};
    for (const l of leads) for (const a of planLeadAuto(l as never, hoy, Date.now(), AUTO_UMBRALES) as Array<{ regla: string; which?: string; move?: unknown; leadId: number }>) {
      const clave = claveAntiLoop(a);
      if (clave && yaConf.has(`${a.leadId}|${clave}`)) continue;
      (haria[a.regla] ??= []).push(a.leadId);
    }
    console.log(`   antes · 30 días: ${JSON.stringify(hizo)} · haría hoy: ${Object.entries(haria).map(([r, ids]) => `${r} ${ids.length} (${ids.join(', ')})`).join(' · ') || 'nada'}`);
    console.log(`   confirmaciones del motor: ${todas.length} en total, ${pendientes.length} pendientes${pendientes.length ? `: ${pendientes.map((c) => `#${c.id} ${c.clave} lead ${c.lead_id}${c.aplicado ? '' : ' (pide decisión)'}`).join(' · ')}` : ''}`);
    for (const f of faltan) console.log(`   ⚠ ${f}`);
    if (bloqueos.length) {
      for (const b of bloqueos) console.log(`   ✗ ${b}`);
      console.log('   ✗ con esto no se crea ni se prende nada en este negocio');
      return;
    }

    // LAS VIVAS CONTRA EL PLAN (S3): «ya existe» es la que ES el plan; una con su clave pero distinta frena al negocio.
    const { deCada, ajenas } = clasificarVivas(await vivasDe(w.id), planes) as { deCada: Array<Fila | null>; ajenas: Array<{ fila: Fila; motivo: string }> };
    // Una adoptada que ya corrió no vuelve a inscribir a quien ya pasó por ella (2ª revisión).
    const yaPasaron = await Promise.all(deCada.map((f) => (f ? yaPasaronPor(w.id, f.id) : Promise.resolve(new Set<number>()))));
    const tomas: Toma[] = planes.map((plan, i) => tomaAlPrender(leads as never, plan, Date.now(), { hoy: hoyDelNegocio, zona, yaPasaron: yaPasaron[i] }) as Toma);
    for (const [i, plan] of planes.entries()) {
      const pl = plantillaPorId(plan.plantilla);
      const destinos = plan.destinos ? Object.entries(plan.destinos).map(([k, v]) => `${k} → «${nombreEtapa(etapaDeValor(v))}»`).join(' · ') : '';
      const ya = deCada[i];
      const t = tomas[i];
      console.log(`   ${plan.regla} «${pl?.nombre}» · CRON: ${plan.etapas.map(nombreEtapa).join(' + ')}${plan.ancla ? ` · pregunta por ${plan.ancla === 'reunion_1' ? 'la 1ª' : 'la 2ª'} reunión` : ''}${destinos ? ` · ${destinos}` : ''}${ya ? ` · YA EXISTE #${ya.id}${ya.activa ? ' (activa)' : ' (pausada)'}` : ''}`);
      console.log(`      al prenderla toma ${t.ids.length}${t.ids.length ? `: ${t.ids.join(', ')}` : ''}${t.sinFecha.length ? ` · sin la fecha de su espera (se cierran a las 24 h): ${t.sinFecha.join(', ')}` : ''}${t.delGrupo.length ? ` · traídos de un grupo (quedan quietos): ${t.delGrupo.join(', ')}` : ''}${t.fueraDeVentana.length ? ` · fuera de los 90 días (no los toma nunca): ${t.fueraDeVentana.join(', ')}` : ''}${yaPasaron[i].size ? ` · ya pasaron por ella (no vuelven a entrar): ${yaPasaron[i].size}` : ''}${t.avisaEnseguida.length ? ` · AVISA ENSEGUIDA en el grupo: ${t.avisaEnseguida.join(', ')}` : ''}`);
    }
    if (ajenas.length) {
      for (const a of ajenas) console.log(`   ✗ #${a.fila.id} «${a.fila.nombre}» tiene la clave de una plantilla del plan pero ${a.motivo}`);
      console.log('   ✗ no se crea ni se prende nada en este negocio hasta que una persona decida qué hacer con ésas');
      return;
    }
    if (!aplicar && !activar) return;
    const respaldo = respaldoDe(w.id);

    // ── --aplicar: crear las que faltan, pausadas ─────────────────────────────────────────────
    if (aplicar) {
      for (const [i, plan] of planes.entries()) {
        if (deCada[i]) continue;
        // Sin `motivoDeCron`: si el CRON no se puede poner, `crearDesdePlantilla` BORRA la fila que acaba de crear y tira
        // (S1). Con él, la dejaba viva y pausada sin CRON, y la corrida siguiente la tomaba por hecha.
        const r = await crearDesdePlantilla(plan.plantilla, {
          db: (await getTenantDb()) as never,
          setPasos: (id: number, pasos: never[]) => setSecuenciaPasos(id, alPlan(pasos, plan)),
          setDisparadores: guardarDisparadores,
        }, { disparador: plan.cron, destinos: plan.destinos });
        (respaldo.corrida.creadas as unknown[]).push({ id: r.id, plantilla: plan.plantilla, cron: plan.cron, destinos: plan.destinos ?? null, ancla: plan.ancla ?? null, reunion: plan.reunion ?? null });
        respaldo.guardar();
        // Lo que quedó escrito se RELEE: es el plan (el grafo entero), con pasos válidos y con la forma de hoy, pausada.
        const { data: fila, error: er } = await db.from('nutricion_secuencias').select(COLS_VIVA).eq('id', r.id).eq('workspace_id', w.id).single();
        if (er || !fila) throw new Error(`ws${w.id} #${r.id}: no la pude releer (${er?.message})`);
        const f = fila as Fila;
        const errores = validarGrafo(f.pasos as never) as unknown[];
        const forma = problemasDeForma(f.pasos as never) as unknown[];
        const dif = diferenciaConElPlan(f, plan);
        if (f.activa || errores.length || forma.length || dif) throw new Error(`ws${w.id} #${r.id}: quedó mal (activa=${f.activa}, errores=${JSON.stringify(errores)}, forma=${JSON.stringify(forma)}, plan=${dif ?? 'igual'})`);
        console.log(`     ✓ creada #${r.id} «${r.nombre}», pausada, releída`);
      }
      if ((respaldo.corrida.creadas as unknown[]).length) console.log(`   respaldo: ${respaldo.ruta}`);
      else console.log('   nada que crear: ya están todas');
      return;
    }

    // ── --activar: todo o nada ─────────────────────────────────────────────────────────────
    // Cada plan tiene que tener SU automatización (S2): sin la que lo reemplaza, apagar el motor deja la regla sin cubrir.
    const faltanFilas = planes.filter((_, i) => !deCada[i]);
    if (faltanFilas.length) {
      console.log(`   ✗ faltan ${faltanFilas.map((p) => `${p.regla} (${p.etapas.join(' + ')})`).join(', ')}: primero --aplicar. No se prende nada ni se apaga el motor`);
      return;
    }
    const filas = deCada as Fila[];
    // Por CLAVE (2ª revisión): T1:j1 la cubre la de la 1ª reunión, T1:j2 la de la 2ª, T3 la suya. Quien pide una decisión se
    // archiva sólo si la automatización se la vuelve a pedir a ese lead: los de su toma, con la fecha de su espera.
    const cubiertas = new Set<string>(planes.map((p) => claveDelPlan(p)).filter((c): c is string => !!c));
    const vuelveAPreguntar = new Map<string, Set<number>>();
    for (const [i, p] of planes.entries()) {
      const clave = claveDelPlan(p);
      if (!clave) continue;
      const set = vuelveAPreguntar.get(clave) ?? new Set<number>();
      for (const id of tomas[i].ids) if (!tomas[i].sinFecha.includes(id)) set.add(id);
      vuelveAPreguntar.set(clave, set);
    }
    // Lo de ESTA corrida, anotado ANTES de cada escritura: si la respuesta se pierde, igual se deshace (deshacer lo que no
    // llegó a escribirse no daña: pausar una pausada, desarchivar con el motivo de esta corrida).
    const activadas: number[] = [];
    const archivadas: Array<{ id: number; motivo: string }> = [];
    const lineas: number[] = [];
    let intentoSetting = false;
    let archivar: Conf[] = [];
    let quedan: Conf[] = [];
    const guardarSiSePuede = (): string | null => { try { respaldo.guardar(); return null; } catch (e) { return msg(e); } };
    respaldo.corrida.setting = { antes: crudo };
    respaldo.guardar();
    try {
      // 1) Prender (la puerta de siempre: tope del plan, validación y la pregunta por la duplicada).
      for (const f of filas) {
        if (f.activa) continue;
        activadas.push(f.id);
        respaldo.corrida.activadas = [...activadas];
        respaldo.guardar();
        await setSecuenciaActiva(f.id, true, { aunqueDuplique, ws: w.id });
      }
      // 2) Releer: cada una prendida y siendo el plan.
      const relectura = new Map((await vivasDe(w.id)).map((f) => [f.id, f]));
      for (const [i, f] of filas.entries()) {
        const r = relectura.get(f.id);
        const dif = r ? diferenciaConElPlan(r, planes[i]) : 'ya no está';
        if (!r?.activa || dif) throw new Error(`#${f.id} no quedó prendida como el plan (${dif ?? 'pausada'})`);
      }
      // 3) Apagar el motor con compare-and-set de verdad (S2). Se anota que se intentó ANTES: si la escritura llegó y la
      //    respuesta se perdió, el deshacer igual corre el compare-and-set inverso.
      intentoSetting = true;
      respaldo.corrida.setting = { antes: crudo, intento: 'false' };
      respaldo.guardar();
      if (!(await cambiarSettingSi(KEY_CRM_AUTO, crudo, 'false'))) throw new Error('el setting del motor cambió mientras corría');
      if (await crmAutoHabilitado()) throw new Error('el motor sigue prendido después de apagarlo');
      // 4) Con el motor ya apagado, las pendientes se leen DE NUEVO: una corrida suya en curso pudo crear más.
      ({ archivar, quedan } = confirmacionesAArchivar(await pendientesDe(w.id), cubiertas, vuelveAPreguntar) as { archivar: Conf[]; quedan: Conf[] });
      // 5) Archivar, comparando antes de escribir (otra persona pudo resolverla).
      for (const c of archivar) {
        archivadas.push({ id: c.id, motivo: c.motivo! });
        respaldo.corrida.archivadas = archivadas.map((a) => a.id);
        respaldo.guardar();
        const { data, error } = await db.from('mako_confirmaciones')
          .update({ estado: 'archivado', resolved_at: new Date().toISOString(), resolved_by: c.motivo })
          .eq('id', c.id).eq('workspace_id', w.id).eq('estado', 'pendiente').select('id');
        if (error) throw new Error(`#${c.id}: ${error.message}`);
        if (!data?.length) { archivadas.pop(); console.log(`     · #${c.id} ya no estaba pendiente: la resolvió alguien`); }
      }
      // 6) La línea en el historial de cada lead, DENTRO del movimiento y mirando el error (`logLeadEvent` se lo traga).
      for (const c of archivar.filter((x) => archivadas.some((a) => a.id === x.id))) {
        const { data, error } = await db.from('lead_audit')
          .insert({ lead_id: c.lead_id, workspace_id: w.id, campo: 'Confirmación del CRM automático', valor_anterior: null, valor_nuevo: `#${c.id} (${c.clave}): ${c.motivo}`, autor: AUTOR })
          .select('id').single();
        if (error || !data) throw new Error(`la línea del historial de #${c.id}: ${error?.message ?? 'no volvió'}`);
        lineas.push(Number((data as { id: number }).id));
        respaldo.corrida.lineas = [...lineas];
        respaldo.guardar();
      }
    } catch (e) {
      // DESHACER lo de ESTA corrida, al revés. Cada paso por separado: que uno falle no deja los otros sin deshacer.
      const deshecho: string[] = [];
      if (lineas.length) {
        const { error } = await db.from('lead_audit').delete().in('id', lineas).eq('workspace_id', w.id);
        deshecho.push(error ? `⚠ las ${lineas.length} líneas del historial NO se pudieron sacar (${error.message})` : `${lineas.length} líneas del historial sacadas`);
      }
      let volvieron = 0;
      for (const a of archivadas) {
        const { data, error } = await db.from('mako_confirmaciones').update({ estado: 'pendiente', resolved_at: null, resolved_by: null })
          .eq('id', a.id).eq('workspace_id', w.id).eq('estado', 'archivado').eq('resolved_by', a.motivo).select('id');
        if (!error && data?.length) volvieron++;
      }
      if (archivadas.length) deshecho.push(volvieron === archivadas.length ? `${volvieron} confirmaciones vueltas a pendientes` : `⚠ confirmaciones: volvieron ${volvieron} de ${archivadas.length}: revisar a mano`);
      // El setting: si se intentó, el compare-and-set inverso siempre; después se mira cómo quedó de verdad.
      let motorComoAntes = true;
      if (intentoSetting) {
        await (crudo == null ? borrarSettingSi(KEY_CRM_AUTO, 'false') : cambiarSettingSi(KEY_CRM_AUTO, 'false', crudo)).catch(() => false);
        const ahora = await getSettingEstricto(KEY_CRM_AUTO).catch(() => '«no se pudo leer»');
        motorComoAntes = ahora === crudo;
        deshecho.push(motorComoAntes ? 'setting del motor como estaba' : `⚠ el setting del motor quedó en ${String(ahora)} (era ${String(crudo)}): revisarlo a mano`);
      }
      // Si el motor NO volvió, el reemplazo se queda PRENDIDO: motor apagado y automatizaciones pausadas es T1/T2/T3 sin nadie.
      if (motorComoAntes) {
        for (const id of [...activadas].reverse()) {
          await setSecuenciaActiva(id, false).then(() => deshecho.push(`#${id} pausada`)).catch((x: unknown) => deshecho.push(`⚠ #${id} NO se pudo pausar (${msg(x)})`));
        }
      } else if (activadas.length) {
        deshecho.push(`⚠ ${activadas.map((id) => `#${id}`).join(', ')} quedan PRENDIDAS a propósito: el motor no volvió, y sin ellas nadie cubre T1/T2/T3`);
      }
      // Primero se dice, después se intenta guardar: un respaldo que no se puede escribir no tapa lo que pasó.
      const duplicada = e instanceof DuplicadaError ? ' · Si Martín lo ve y dice que sí, se corre con --aunque-duplique.' : '';
      console.log(`   ✗ ${msg(e)}${duplicada}`);
      for (const d of deshecho) console.log(`     ↩ ${d}`);
      respaldo.corrida.deshecho = { error: msg(e), pasos: deshecho };
      const noGuardo = guardarSiSePuede();
      if (noGuardo) console.log(`     ⚠ el respaldo no se pudo guardar (${noGuardo}): esto que está arriba es lo único escrito`);
      throw new Error(`ws${w.id}: --activar no se completó y se deshizo lo de esta corrida (respaldo: ${respaldo.ruta})`);
    }
    console.log(`   ✓ prendidas: ${filas.map((f) => `#${f.id}`).join(', ')} (${activadas.length} en esta corrida) · releídas`);
    console.log('   ✓ motor del CRM automático APAGADO en este negocio (compare-and-set, releído)');
    console.log(`   ✓ confirmaciones archivadas, con su línea en el historial: ${archivadas.length ? archivadas.map((a) => `#${a.id}`).join(', ') : 'ninguna'}`);
    for (const c of quedan) console.log(`   ⚠ queda viva #${c.id} (${c.clave}, lead ${c.lead_id}): ${c.porque}. Avisarle al Cerebro`);
    console.log(`   respaldo: ${respaldo.ruta}`);
  });
}
console.log('');
