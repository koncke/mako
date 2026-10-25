// =============================================================================
// medir-goteo-tras-deploy — ¿el goteo, el reloj de las esperas y «Contestó» hacen lo que dicen, en producción? (SÓLO LECTURA)
// =============================================================================
// Lo que se subió el 24/10/2026 (tren 43c343ebd, deploy Ready ~18:06 ART = 2026-10-24T21:06Z):
//   · 629500245 — el goteo espacia sólo MENSAJES: una condición o una espera ya no toma un turno de goteo.
//   · cdadbc30f — una espera «de tiempo» cuenta desde que la inscripción quedó lista (salió el mensaje de antes), no desde
//     que el motor la procesó (`relojDeLasEsperas`, lib/nutricion-grafo-motor.ts).
// Martín: «el goteo debe comenzar a contar desde que se envía el primer mensaje», y que «Contestó» corte la secuencia.
// ⚠️ SÓLO CUENTA LO QUE SE AGENDÓ DESPUÉS DEL DEPLOY: lo agendado antes no se recalculó (en la #289, los M2 que salen desde
// las 21:33 ART del 24/10 a cada 12 min son del horario VIEJO: su ritmo no prueba nada).
// ⚠️ CADA NEGOCIO EN SU BASE (24/10, noche): la primera versión leía todo con el cliente de la base PRINCIPAL y daba «nada
// tocado desde el deploy» para la #289. El ws1 tiene base propia (otros ids, docs/hallazgos-chatbot.md, trampa «k»): las
// inscripciones y los envíos se leen con `runWithWorkspace(ws)` + `getTenantDb()`.
//
// Uso (desde un worktree con node_modules; el .env.local del clon es PRODUCCIÓN, sólo se lee):
//   node --env-file=C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local \
//     --conditions=react-server --import tsx scripts/medir-goteo-tras-deploy.mts [--desde=2026-10-24T21:06:00Z]
//
// Qué dice, por cada automatización CON goteo (`automatizacion.config:<id>` con `goteo`):
//   1. EL RITMO DE M1 (lo que salió en el paso 1 desde el deploy): los intervalos y su MEDIANA. Esperado: ~el goteo (11 min
//      en la #289), no el doble. ⚠️ Lo que delató el defecto fue la MEDIANA (22), no el mínimo: ninguno salía por debajo.
//   2. LA CONDICIÓN NO TOMA TURNO: para cada inscripción con un M1 después del deploy, cuánto tardó en quedar agendada la
//      espera que sigue (`updated_at` − su M1). Esperado: segundos o un minuto, no 11 ni 22.
//   3. LAS ESPERAS CUENTAN DESDE EL MENSAJE: para cada inscripción activa, `proximo_envio_at` − `ultimo_paso_at` (el último
//      mensaje). Esperado: la espera exacta (24,00 h después de M1, 48,00 h después de M2 en la #289). Antes del arreglo
//      daba 24 h + lo que el goteo y el horario demoraban la condición (hasta +14 h 43 min).
//   4. «CONTESTÓ» CORTA: para cada inscripción a la que le salió algo y cuyo lead escribió después (un entrante de WhatsApp
//      que no es la bienvenida automática de los 15 s), ningún MENSAJE más de esa automatización después de la respuesta, y
//      la inscripción fuera de 'activa'. Lo que no cumpla sale con ✖.
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');
const { createClient } = await import('@supabase/supabase-js');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DESDE = (process.argv.find((a) => a.startsWith('--desde=')) ?? '--desde=2026-10-24T21:06:00Z').slice(8);
const ART = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : '—');
const horas = (a: string, b: string) => ((Date.parse(a) - Date.parse(b)) / 3600_000).toFixed(2);
const chk = <T,>(r: { data: T | null; error: { message: string } | null }, q: string): T => { if (r.error) throw new Error(`${q}: ${r.error.message}`); return r.data as T; };
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
// La bienvenida automática de su WhatsApp Business no cuenta como respuesta (lib/respuesta-automatica.ts).
const UMBRAL_AUTOMATICA_MS = 15_000;
// Las partes de un mensaje salen antes de su fila en `nutricion_envios` (~20 s): un envío con `created_at` hasta acá
// después de la respuesta es el MISMO mensaje que se estaba mandando, no uno nuevo.
const COLA_DE_PARTES_MS = 60_000;

type Cfg = { workspace_id: number; key: string; value: string };
const cfg = chk(await db.from('app_settings').select('workspace_id, key, value').like('key', 'automatizacion.config:%'), 'configs') as Cfg[];
const conGoteo = cfg.flatMap((c) => { try { const v = JSON.parse(c.value); return v?.goteo ? [{ ws: c.workspace_id, sec: Number(c.key.split(':')[1]), goteo: v.goteo }] : []; } catch { return []; } });
console.log(`Ahora ${ART(new Date().toISOString())} ART. Desde ${ART(DESDE)} ART (${DESDE}). Con goteo: ${conGoteo.map((g) => `#${g.sec} (ws${g.ws}, ${JSON.stringify(g.goteo)})`).join(' · ') || 'ninguna'}`);

let malos = 0;
for (const g of conGoteo) {
  await runWithWorkspace(g.ws, async () => {
    const tdb = await getTenantDb();
    const sec = chk(await tdb.from('nutricion_secuencias').select('id, nombre, activa').eq('id', g.sec).maybeSingle(), 'sec') as { id: number; nombre: string; activa: boolean } | null;
    if (!sec) { console.log(`\n#${g.sec} (ws${g.ws}): no está en la base del negocio`); return; }
    console.log(`\n#${sec.id} «${sec.nombre}» (ws${g.ws}, ${sec.activa ? 'prendida' : 'APAGADA'})`);
    const env = chk(await tdb.from('nutricion_envios').select('inscripcion_id, lead_id, paso, canal, estado, created_at').eq('secuencia_id', g.sec).eq('canal', 'whatsapp').order('created_at').limit(5000), 'envíos') as Array<{ inscripcion_id: number; lead_id: number; paso: number; estado: string; created_at: string }>;
    const enviados = env.filter((e) => e.estado === 'enviado');
    const porPaso = new Map<number, number>();
    for (const e of enviados) porPaso.set(e.paso, (porPaso.get(e.paso) ?? 0) + 1);
    console.log(`  Enviados en total: ${enviados.length} (${[...porPaso].sort((a, b) => a[0] - b[0]).map(([p, n]) => `M${p}: ${n}`).join(' · ')}). Último: ${ART(enviados.at(-1)?.created_at ?? null)}`);
    // 1. El ritmo de M1.
    const m1 = enviados.filter((e) => e.paso === 1 && e.created_at >= DESDE);
    const iv = m1.slice(1).map((e, k) => (Date.parse(e.created_at) - Date.parse(m1[k].created_at)) / 60_000);
    console.log(`  1. M1 desde el deploy: ${m1.length}. Intervalos (min): ${iv.map((x) => x.toFixed(1)).join(', ') || '—'}. Mediana: ${mediana(iv)?.toFixed(1) ?? '—'} (esperado ≈ ${g.goteo.minutos ?? '—'}).`);
    const ins = chk(await tdb.from('nutricion_inscripciones').select('id, lead_id, estado, nodo_actual, proximo_envio_at, ultimo_paso_at, inscripto_at, updated_at, desenlace').eq('secuencia_id', g.sec).limit(5000), 'inscripciones') as Array<{ id: number; lead_id: number; estado: string; nodo_actual: string | null; proximo_envio_at: string | null; ultimo_paso_at: string | null; inscripto_at: string; updated_at: string; desenlace: string | null }>;
    const porEstado = new Map<string, number>();
    for (const i of ins) porEstado.set(i.estado, (porEstado.get(i.estado) ?? 0) + 1);
    console.log(`  Inscripciones: ${ins.length} (${[...porEstado].map(([e, n]) => `${e}: ${n}`).join(' · ')})`);
    // 2. La condición no toma turno.
    const m1Por = new Map(m1.map((e) => [e.inscripcion_id, e.created_at]));
    console.log(`  2. Condición sin turno (lo que tardó en quedar agendada la espera tras su M1 nuevo):`);
    const tocadas = ins.filter((x) => m1Por.has(x.id));
    for (const i of tocadas) console.log(`     insc ${i.id}: M1 ${ART(m1Por.get(i.id)!)} · agendada ${ART(i.updated_at)} · ${((Date.parse(i.updated_at) - Date.parse(m1Por.get(i.id)!)) / 60_000).toFixed(1)} min (esperado ≤ 1-2)`);
    if (!tocadas.length) console.log('     (ningún M1 nuevo desde el deploy)');
    // 3. Las esperas, de las activas: agendada − último mensaje, y si se agendó antes o después del deploy.
    console.log(`  3. Esperas de las activas (agendada − último mensaje):`);
    const activas = ins.filter((i) => i.estado === 'activa' && i.proximo_envio_at && i.ultimo_paso_at).sort((a, b) => a.proximo_envio_at!.localeCompare(b.proximo_envio_at!));
    for (const i of activas) {
      const h = Number(horas(i.proximo_envio_at!, i.ultimo_paso_at!));
      const nuevo = i.updated_at >= DESDE;
      const exacta = Math.abs(h - Math.round(h)) < 0.05 && Math.round(h) % 24 === 0;
      if (nuevo && !exacta) malos += 1;
      console.log(`     ${nuevo ? (exacta ? '✔' : '✖') : '·'} insc ${i.id} nodo ${i.nodo_actual}: último ${ART(i.ultimo_paso_at)} · agendada ${ART(i.proximo_envio_at)} · ${h.toFixed(2)} h${nuevo ? ' (agendada tras el deploy)' : ' (de antes del deploy)'}`);
    }
    // 4. «Contestó» corta.
    console.log(`  4. «Contestó» corta (a quien escribió después de su primer mensaje no le sale ninguno más):`);
    const primeroPor = new Map<number, string>();
    for (const e of enviados) if (!primeroPor.has(e.inscripcion_id)) primeroPor.set(e.inscripcion_id, e.created_at);
    const leadIds = [...new Set(ins.filter((i) => primeroPor.has(i.id)).map((i) => i.lead_id))];
    const entrantes: Array<{ lead_id: number; wa_timestamp: string; texto: string | null; tipo: string | null }> = [];
    for (let k = 0; k < leadIds.length; k += 200) {
      const lote = chk(await tdb.from('wa_mensajes').select('lead_id, wa_timestamp, texto, tipo').in('lead_id', leadIds.slice(k, k + 200)).eq('from_me', false).order('wa_timestamp').limit(5000), 'entrantes') as typeof entrantes;
      entrantes.push(...lote.filter((m) => m.tipo !== 'evento' && m.tipo !== 'otro'));
    }
    let contestaron = 0;
    for (const i of ins) {
      const primero = primeroPor.get(i.id);
      if (!primero) continue;
      // La primera parte sale ~20 s antes de la fila: lo que llega hasta 15 s después de la primera parte es la automática.
      const desdeParte = Date.parse(primero) - 25_000;
      const resp = entrantes.find((m) => m.lead_id === i.lead_id && Date.parse(m.wa_timestamp) > desdeParte + UMBRAL_AUTOMATICA_MS);
      if (!resp) continue;
      contestaron += 1;
      const despues = enviados.filter((e) => e.inscripcion_id === i.id && Date.parse(e.created_at) > Date.parse(resp.wa_timestamp) + COLA_DE_PARTES_MS);
      const ok = despues.length === 0 && i.estado !== 'activa';
      if (!ok) malos += 1;
      console.log(`     ${ok ? '✔' : '✖'} insc ${i.id} (${i.estado}${i.desenlace ? `, ${i.desenlace}` : ''}): contestó ${ART(resp.wa_timestamp)} «${(resp.texto ?? '').slice(0, 40).replace(/\s+/g, ' ')}» · mensajes después: ${despues.map((e) => `M${e.paso} ${ART(e.created_at)}`).join(', ') || 'ninguno'}`);
    }
    if (!contestaron) console.log('     (nadie contestó todavía)');
  });
}
console.log(`\n${malos ? `✖ ${malos} cosa(s) no cumplen` : '✔ nada de lo medido falla'}`);
