// =============================================================================
// medir-goteo-tras-deploy — ¿el goteo y el reloj de las esperas hacen lo que dicen, en producción? (SÓLO LECTURA)
// =============================================================================
// Lo que se subió el 24/10/2026 (tren 43c343ebd, deploy Ready ~18:06 ART = 2026-10-24T21:06Z):
//   · 629500245 — el goteo espacia sólo MENSAJES: una condición o una espera ya no toma un turno de goteo.
//   · cdadbc30f — una espera «de tiempo» cuenta desde que la inscripción quedó lista (salió el mensaje de antes), no desde
//     que el motor la procesó (`relojDeLasEsperas`, lib/nutricion-grafo-motor.ts).
// ⚠️ SÓLO CUENTA LO QUE SE AGENDÓ DESPUÉS DEL DEPLOY: lo agendado antes no se recalculó (en la #289, los M2 que salen desde
// las 21:33 ART del 24/10 a cada 12 min son del horario VIEJO: su ritmo no prueba nada).
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
//   3. LAS ESPERAS CUENTAN DESDE EL MENSAJE: para cada inscripción tocada después del deploy, `proximo_envio_at` −
//      `ultimo_paso_at` (el último mensaje). Esperado: la espera exacta (24,00 h después de M1, 48,00 h después de M2 en la
//      #289). Antes del arreglo daba 24 h + lo que el goteo y el horario demoraban la condición (hasta +14 h 43 min).
// =============================================================================
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const DESDE = (process.argv.find((a) => a.startsWith('--desde=')) ?? '--desde=2026-10-24T21:06:00Z').slice(8);
const ART = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : '—');
const horas = (a: string, b: string) => ((Date.parse(a) - Date.parse(b)) / 3600_000).toFixed(2);
const chk = <T,>(r: { data: T | null; error: { message: string } | null }, q: string): T => { if (r.error) throw new Error(`${q}: ${r.error.message}`); return r.data as T; };
const mediana = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };

const cfg = chk(await db.from('app_settings').select('workspace_id, key, value').like('key', 'automatizacion.config:%'), 'configs') as Array<{ workspace_id: number; key: string; value: string }>;
const conGoteo = cfg.flatMap((c) => { try { const v = JSON.parse(c.value); return v?.goteo ? [{ ws: c.workspace_id, sec: Number(c.key.split(':')[1]), goteo: v.goteo }] : []; } catch { return []; } });
console.log(`Desde ${ART(DESDE)} ART (${DESDE}). Con goteo: ${conGoteo.map((g) => `#${g.sec} (ws${g.ws}, ${JSON.stringify(g.goteo)})`).join(' · ') || 'ninguna'}`);

for (const g of conGoteo) {
  const sec = chk(await db.from('nutricion_secuencias').select('id, nombre, activa').eq('id', g.sec).maybeSingle(), 'sec') as { id: number; nombre: string; activa: boolean } | null;
  if (!sec) continue;
  console.log(`\n#${sec.id} «${sec.nombre}» (${sec.activa ? 'prendida' : 'APAGADA'})`);
  const env = chk(await db.from('nutricion_envios').select('inscripcion_id, lead_id, paso, canal, estado, created_at').eq('secuencia_id', g.sec).eq('canal', 'whatsapp').gte('created_at', DESDE).order('created_at'), 'envíos') as Array<{ inscripcion_id: number; lead_id: number; paso: number; estado: string; created_at: string }>;
  // 1. El ritmo de M1.
  const m1 = env.filter((e) => e.paso === 1 && e.estado === 'enviado');
  const iv = m1.slice(1).map((e, k) => (Date.parse(e.created_at) - Date.parse(m1[k].created_at)) / 60_000);
  console.log(`  1. M1 desde el deploy: ${m1.length}. Intervalos (min): ${iv.map((x) => x.toFixed(1)).join(', ') || '—'}. Mediana: ${mediana(iv)?.toFixed(1) ?? '—'} (esperado ≈ ${g.goteo.minutos ?? '—'}).`);
  // 2 y 3. Las inscripciones tocadas desde el deploy.
  const ins = chk(await db.from('nutricion_inscripciones').select('id, lead_id, estado, nodo_actual, proximo_envio_at, ultimo_paso_at, updated_at').eq('secuencia_id', g.sec).gte('updated_at', DESDE), 'inscripciones') as Array<{ id: number; lead_id: number; estado: string; nodo_actual: string | null; proximo_envio_at: string | null; ultimo_paso_at: string | null; updated_at: string }>;
  const m1Por = new Map(m1.map((e) => [e.inscripcion_id, e.created_at]));
  console.log(`  2. Condición sin turno (lo que tardó en quedar agendada la espera tras su M1):`);
  for (const i of ins.filter((x) => m1Por.has(x.id))) console.log(`     insc ${i.id} lead ${i.lead_id}: M1 ${ART(m1Por.get(i.id)!)} · agendada a las ${ART(i.updated_at)} · ${((Date.parse(i.updated_at) - Date.parse(m1Por.get(i.id)!)) / 60_000).toFixed(1)} min (esperado ≤ 1-2)`);
  console.log(`  3. Esperas (agendada − último mensaje), de lo tocado desde el deploy:`);
  for (const i of ins) {
    if (!i.proximo_envio_at || !i.ultimo_paso_at) continue;
    console.log(`     insc ${i.id} lead ${i.lead_id} ${i.estado} nodo ${i.nodo_actual}: último mensaje ${ART(i.ultimo_paso_at)} · agendada ${ART(i.proximo_envio_at)} · ${horas(i.proximo_envio_at, i.ultimo_paso_at)} h`);
  }
  if (!ins.length) console.log('     (nada tocado desde el deploy todavía)');
}
