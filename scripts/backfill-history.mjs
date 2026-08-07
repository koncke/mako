// Reconstruye el historial de los leads a partir de las FECHAS REALES que ya
// tiene cada uno (created_at, fecha_agenda, junta_1_at, junta_2_at, fecha_cierre).
// No inventa nada: cada línea sale de un dato guardado, con SU fecha, y queda
// marcada como reconstruida. Idempotente: no repite una línea que ya exista.
// Uso: node scripts/backfill-history.mjs [--lead=1395] [--apply]
import postgres from 'postgres';
import { resolve } from 'node:path';
import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const sql = postgres(process.env.DATABASE_URL, { ssl: 'require', connect_timeout: 10, max: 1 });
const arg = (k) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1];
const APPLY = process.argv.includes('--apply');
const SOLO = arg('lead');
const AUTOR = 'MaKo · histórico';

const hito = (fecha, campo, valor) => (fecha ? { fecha: new Date(fecha), campo, valor } : null);

// El sub-tab "Status" de la ficha SOLO muestra campo='Etapa'/'Estado' (ver
// STATUS_FIELDS en AuditHistory). Reconstruir hitos informativos no llena esa
// pestaña: hay que reconstruir el RECORRIDO de etapas, transición por transición.
const LABEL = { lead: 'Lead (Instant form)', agenda: 'Agenda R1', agendaj2: 'Agenda R2',
  noshow: 'Nutrición No Show R1', noshow_r2: 'Nutrición No Show R2', ganado: 'Ganado',
  perdido: 'Perdido', descal: 'Descalificado', nutri: 'Nutrición No Agenda' };

/** Secuencia (fecha, etapa) deducida de las fechas reales del lead. */
function recorridoDe(l) {
  const paso = [];
  const add = (f, k) => { if (f && k) paso.push({ fecha: new Date(f), etapa: k }); };
  add(l.created_at, l.fecha_agenda ? 'agenda' : 'lead');
  add(l.fecha_agenda, 'agenda');
  const r1 = l.junta_1_at || l.fecha_junta_1;
  if (r1) {
    if (l.asistio_j1 === false) add(r1, 'noshow');
    else if (l.asistio_j1 === true && (l.junta_2_at || l.fecha_junta_2)) add(r1, 'agendaj2');
  }
  const r2 = l.junta_2_at || l.fecha_junta_2;
  if (r2) { if (l.asistio_j2 === false) add(r2, 'noshow_r2'); else add(r2, 'agendaj2'); }
  if (l.fecha_cierre) {
    const fin = l.estado_lead === 'ganado' ? 'ganado' : l.estado_lead === 'perdido' ? 'perdido'
      : l.estado_lead === 'descalificado' ? 'descal' : null;
    add(l.fecha_cierre, fin);
  }
  paso.sort((a, b) => a.fecha - b.fecha);
  // Solo las TRANSICIONES: si dos hitos seguidos son la misma etapa, no hubo cambio.
  const out = [];
  let previa = null;
  for (const p of paso) {
    if (p.etapa === previa) continue;
    out.push({ fecha: p.fecha, de: previa, a: p.etapa });
    previa = p.etapa;
  }
  return out;
}

function hitosDe(l) {
  const h = [
    hito(l.created_at, 'Lead creado', l.origen_lead || 'manual'),
    hito(l.fecha_agenda, 'Agendó la Reunión 1', new Date(l.fecha_agenda).toISOString().slice(0, 10)),
  ];
  const r1 = l.junta_1_at || l.fecha_junta_1;
  if (r1) {
    h.push(hito(r1, 'Reunión 1', l.asistio_j1 === true ? 'asistió' : l.asistio_j1 === false ? 'no asistió' : 'sin marcar'));
  }
  const r2 = l.junta_2_at || l.fecha_junta_2;
  if (r2) {
    h.push(hito(r2, 'Reunión 2', l.asistio_j2 === true ? 'asistió' : l.asistio_j2 === false ? 'no asistió' : 'sin marcar'));
  }
  if (l.fecha_cierre) h.push(hito(l.fecha_cierre, 'Cierre', l.monto_cierre_usd ? `$${l.monto_cierre_usd}` : (l.estado_lead ?? '')));
  return h.filter(Boolean).sort((a, b) => a.fecha - b.fecha);
}

try {
  const leads = SOLO
    ? await sql`select * from leads where id=${Number(SOLO)}`
    : await sql`select * from leads order by id`;
  const yaHay = await sql`select lead_id, campo, valor_nuevo from lead_audit`;
  const clave = new Set(yaHay.map((r) => `${r.lead_id}|${r.campo}|${r.valor_nuevo ?? ''}`));

  let nuevas = 0, tocados = 0;
  for (const l of leads) {
    const etapas = recorridoDe(l).map((t) => ({
      fecha: t.fecha, campo: 'Etapa',
      valor: LABEL[t.a] ?? t.a, anterior: t.de ? (LABEL[t.de] ?? t.de) : null,
    }));
    const pend = [...hitosDe(l), ...etapas]
      .filter((x) => !clave.has(`${l.id}|${x.campo}|${x.valor}`))
      .sort((a, b) => a.fecha - b.fecha);
    if (!pend.length) continue;
    tocados++; nuevas += pend.length;
    if (SOLO) for (const x of pend) console.log(`  ${x.fecha.toISOString().slice(0,16)} | ${x.campo}: ${x.anterior ? x.anterior + ' → ' : ''}${x.valor}`);
    if (APPLY) {
      await sql`insert into lead_audit ${sql(pend.map((x) => ({
        lead_id: l.id, workspace_id: l.workspace_id, campo: x.campo,
        valor_anterior: x.anterior ?? null, valor_nuevo: x.valor, autor: AUTOR, created_at: x.fecha,
      })))}`;
    }
  }
  console.log(`\n${APPLY ? 'APLICADO' : 'SIMULACIÓN'}: ${nuevas} líneas en ${tocados} leads (de ${leads.length} revisados).`);
} catch (e) { console.log('ERR', e.message); } finally { await sql.end({ timeout: 5 }); }
