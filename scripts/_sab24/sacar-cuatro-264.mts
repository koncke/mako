// Saca de la #264 (ws13) las 4 inscripciones en 'respondio' frenadas por borradores viejos de la #241, para que un
// borrador que alguien mande o descarte no dispare un «Nuevo agendado» tardío (decisión del Cerebro, 24/10/2026).
// Por la función de la app (`sacarDeSecuencia`: compare-and-set sobre el estado leído, próximo envío en null).
// Sin --aplicar sólo muestra (soloVer). Imprime el antes y el después.
export {};
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');
const { sacarDeSecuencia } = await imp('lib/nutricion-salida-manual.ts');

const APLICAR = process.argv.includes('--aplicar');
const WS = 13, SEC = 264;
/** Lo medido el 24/10 00:30 ART: inscripción → lead. Si alguna no está así, no se toca nada. */
const ESPERADAS: Record<number, number> = { 240: 2738, 241: 2741, 242: 2747, 243: 2755 };

await runWithWorkspace(WS, async () => {
  const db = await getTenantDb();
  const foto = async (titulo: string) => {
    const { data, error } = await db.from('nutricion_inscripciones')
      .select('id, lead_id, estado, paso_actual, proximo_envio_at, updated_at').eq('secuencia_id', SEC).in('id', Object.keys(ESPERADAS).map(Number)).order('id');
    if (error) throw new Error(error.message);
    console.log(`\n${titulo}`);
    for (const i of data ?? []) {
      const { data: b } = await db.from('wa_borradores').select('id, secuencia_id, estado').eq('lead_id', i.lead_id).eq('estado', 'pendiente');
      console.log(`  insc ${i.id} lead ${i.lead_id}: ${i.estado} · paso ${i.paso_actual} · próximo ${i.proximo_envio_at ?? '—'} · borradores pendientes ${(b ?? []).map((x: { id: number; secuencia_id: number }) => `${x.id} (#${x.secuencia_id})`).join(', ') || 'ninguno'}`);
    }
    return (data ?? []) as Array<{ id: number; lead_id: number; estado: string; paso_actual: number }>;
  };
  const antes = await foto('ANTES');
  const malas = antes.filter((i) => ESPERADAS[i.id] !== i.lead_id || i.estado !== 'respondio' || i.paso_actual !== 0);
  if (antes.length !== 4 || malas.length) { console.error(`\nNo están como se midieron (${antes.length} filas; distintas: ${malas.map((i) => i.id).join(', ') || '—'}). No toco nada.`); process.exit(2); }
  for (const i of antes) {
    const r = await sacarDeSecuencia(i.lead_id, SEC, { soloVer: !APLICAR });
    console.log(`  ${APLICAR ? 'sacar' : 'vería'} lead ${i.lead_id} «${r.lead?.nombre ?? '?'}»: ${r.sale ? `sale (${r.estadoAntes} → cancelada)` : `NO sale: ${r.porque}`}`);
  }
  if (APLICAR) await foto('DESPUÉS');
  else console.log('\n(sin --aplicar: no se escribió nada)');
});
