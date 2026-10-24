// SOLO LECTURA. Las inscripciones de la #264 del ws13 que pueden disparar un «Nuevo agendado» tardío ahora que la pendiente entra.
import { createClient } from '@supabase/supabase-js';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: ins, error } = await db.from('nutricion_inscripciones')
  .select('id, lead_id, estado, paso_actual, nodo_actual, proximo_envio_at, updated_at')
  .eq('secuencia_id', 264).in('estado', ['activa', 'respondio']);
if (error) throw new Error(error.message);
console.log(`#264 inscripciones vivas (activa/respondio): ${ins?.length ?? 0}`);
for (const i of ins ?? []) {
  const { data: l } = await db.from('leads').select('id, nombre, fecha_primer_pago, estado_lead').eq('id', i.lead_id).maybeSingle();
  const { data: b } = await db.from('wa_borradores').select('id, estado, origen, inscripcion_id, paso, created_at').eq('lead_id', i.lead_id).eq('origen', 'nutricion').eq('estado', 'pendiente');
  console.log(`insc ${i.id} lead ${i.lead_id} «${l?.nombre}» ${i.estado} paso ${i.paso_actual} prox ${i.proximo_envio_at} upd ${i.updated_at} · pagó ${l?.fecha_primer_pago ?? 'no'} · estado_lead ${l?.estado_lead} · borradores nutri pendientes: ${(b ?? []).map((x) => `${x.id}(insc ${x.inscripcion_id} paso ${x.paso})`).join(', ') || 'NINGUNO'}`);
}
const { data: sec } = await db.from('nutricion_secuencias').select('id, activa, archivada, envio_automatico').eq('id', 264).maybeSingle();
console.log('#264:', JSON.stringify(sec));
