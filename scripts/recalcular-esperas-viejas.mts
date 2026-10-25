// =============================================================================
// recalcular-esperas-viejas — lo que quedó agendado con el reloj VIEJO, a «último mensaje + la espera» (24/10/2026)
// =============================================================================
// cdadbc30f (en producción desde ~18:06 ART del 24/10) hace que una espera «de tiempo» cuente desde que salió el mensaje
// de antes (Martín: «el goteo debe comenzar a contar desde que se envía el primer mensaje»). Pero sólo vale para las
// esperas que se resuelven DESPUÉS del deploy: lo que ya estaba agendado no se recalcula, y en la #289 de Mauricio eso
// eran 20 personas con su segundo mensaje entre 12 minutos y casi 15 horas tarde (medido con
// scripts/medir-goteo-tras-deploy.mts). Esto lo pone donde lo habría puesto el motor nuevo.
//
// Qué toca, y nada más: inscripciones 'activa' de UNA automatización, paradas en la tarjeta que sigue a una espera «de
// tiempo», con el vencimiento en el futuro y agendadas ANTES del deploy. El vencimiento nuevo es `ultimo_paso_at` + los
// minutos de esa espera, y sólo si queda ANTES que el viejo (nunca atrasa a nadie). El horario y el goteo los sigue
// poniendo el motor al mandar. Cada escritura es un compare-and-set (estado, tarjeta y vencimiento leídos): si el lead
// contestó o el motor la movió en el medio, no se toca. Lo viejo queda impreso para volver atrás.
//
// Uso (el .env.local del clon es PRODUCCIÓN). Sin --aplicar sólo dice lo que haría:
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/recalcular-esperas-viejas.mts \
//     --ws=1 --sec=289 [--deploy=2026-10-24T21:06:00Z] [--aplicar]
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');

const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const WS = Number(arg('ws')), SEC = Number(arg('sec'));
const DEPLOY = arg('deploy') ?? '2026-10-24T21:06:00Z';
const APLICAR = process.argv.includes('--aplicar');
if (!WS || !SEC) throw new Error('falta --ws o --sec');
const ART = (iso: string | null) => (iso ? new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(5, 16).replace('T', ' ') : '—');

type Paso = { id: string; nodo?: string; siguiente?: string | null; espera?: { modo?: string; minutos?: number } };
await runWithWorkspace(WS, async () => {
  const db = await getTenantDb();
  const s = await db.from('nutricion_secuencias').select('id, nombre, pasos').eq('id', SEC).maybeSingle();
  if (s.error || !s.data) throw new Error(`no encuentro la #${SEC} en el ws${WS}: ${s.error?.message ?? 'no está'}`);
  const pasos = (s.data.pasos ?? []) as Paso[];
  // La tarjeta que sigue a cada espera «de tiempo», con sus minutos.
  const trasEspera = new Map<string, number>();
  for (const p of pasos) if (p.nodo === 'esperar' && p.espera?.modo === 'tiempo' && p.siguiente && p.espera.minutos) trasEspera.set(p.siguiente, p.espera.minutos);
  console.log(`#${SEC} «${s.data.nombre}» (ws${WS}). Tras una espera: ${[...trasEspera].map(([n, m]) => `${n} (${m / 60} h)`).join(' · ')}. ${APLICAR ? 'APLICANDO' : 'Simulado (sin --aplicar)'}`);
  const r = await db.from('nutricion_inscripciones').select('id, lead_id, estado, nodo_actual, proximo_envio_at, ultimo_paso_at, updated_at')
    .eq('secuencia_id', SEC).eq('estado', 'activa').gt('proximo_envio_at', new Date().toISOString()).lt('updated_at', DEPLOY);
  if (r.error) throw new Error(r.error.message);
  let cambiadas = 0, iguales = 0, perdidas = 0;
  for (const i of r.data as Array<{ id: number; lead_id: number; estado: string; nodo_actual: string | null; proximo_envio_at: string; ultimo_paso_at: string | null; updated_at: string }>) {
    const min = i.nodo_actual ? trasEspera.get(i.nodo_actual) : undefined;
    if (!min || !i.ultimo_paso_at) continue;
    const nuevo = new Date(Date.parse(i.ultimo_paso_at) + min * 60_000).toISOString();
    const adelanta = (Date.parse(i.proximo_envio_at) - Date.parse(nuevo)) / 60_000;
    if (adelanta < 1) { iguales += 1; continue; }
    console.log(`  insc ${i.id} (lead ${i.lead_id}) nodo ${i.nodo_actual}: último ${ART(i.ultimo_paso_at)} · ${ART(i.proximo_envio_at)} → ${ART(nuevo)} (${(adelanta / 60).toFixed(2)} h antes) · viejo=${i.proximo_envio_at}`);
    if (!APLICAR) { cambiadas += 1; continue; }
    const w = await db.from('nutricion_inscripciones').update({ proximo_envio_at: nuevo, updated_at: new Date().toISOString() })
      .eq('id', i.id).eq('estado', 'activa').eq('nodo_actual', i.nodo_actual!).eq('proximo_envio_at', i.proximo_envio_at).select('id');
    if (w.error) throw new Error(`insc ${i.id}: ${w.error.message}`);
    if (w.data?.length) cambiadas += 1; else { perdidas += 1; console.log(`    ↳ no la toqué: cambió mientras tanto`); }
  }
  console.log(`${APLICAR ? 'Cambiadas' : 'Se cambiarían'}: ${cambiadas}. Ya estaban bien: ${iguales}.${perdidas ? ` Cambiaron en el medio (no tocadas): ${perdidas}.` : ''}`);
});
