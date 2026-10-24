// Descarta los 4 borradores pendientes de la #241 (ws13, archivada el 20/10) de los leads que salieron de la #264, con
// el motivo en el historial de cada lead (decisión del Cerebro, 24/10/2026). Por la función de la app
// (`descartarBorrador`: sólo si sigue pendiente). Estado 'descartado', nunca borrados. Sin --aplicar sólo muestra.
export {};
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb } = await imp('lib/workspace.ts');
const { descartarBorrador } = await imp('lib/evolution-envio.ts');
const { logLeadEvent } = await imp('lib/leads.ts');

const APLICAR = process.argv.includes('--aplicar');
const WS = 13, SEC = 241;
/** Lo medido el 24/10: borrador → lead. Si alguno no está así, no se toca nada. */
const ESPERADOS: Record<number, number> = { 14: 2738, 15: 2741, 17: 2747, 18: 2755 };

await runWithWorkspace(WS, async () => {
  const db = await getTenantDb();
  const { data: sec } = await db.from('nutricion_secuencias').select('id, nombre, archivada_at').eq('id', SEC).maybeSingle();
  const nombre = (sec as { nombre?: string } | null)?.nombre?.trim() || `#${SEC}`;
  const foto = async (titulo: string) => {
    const { data, error } = await db.from('wa_borradores').select('id, lead_id, secuencia_id, paso, estado, created_at, texto')
      .in('id', Object.keys(ESPERADOS).map(Number)).order('id');
    if (error) throw new Error(error.message);
    console.log(`\n${titulo}`);
    for (const b of data ?? []) console.log(`  borrador ${b.id} · lead ${b.lead_id} · #${b.secuencia_id} paso ${b.paso} · ${b.estado} · creado ${b.created_at} · «${String(b.texto).slice(0, 60).replace(/\n/g, ' ')}…»`);
    return (data ?? []) as Array<{ id: number; lead_id: number; secuencia_id: number; estado: string }>;
  };
  console.log(`#${SEC} «${nombre}» archivada: ${(sec as { archivada_at?: string } | null)?.archivada_at ?? 'NO'}`);
  const antes = await foto('ANTES');
  const malos = antes.filter((b) => ESPERADOS[b.id] !== b.lead_id || b.secuencia_id !== SEC || b.estado !== 'pendiente');
  if (antes.length !== 4 || malos.length || !(sec as { archivada_at?: string } | null)?.archivada_at) {
    console.error(`\nNo están como se midieron (${antes.length} filas; distintos: ${malos.map((b) => b.id).join(', ') || '—'}). No toco nada.`); process.exit(2);
  }
  const motivo = `Borrador descartado al cerrar la #${SEC} «${nombre}», archivada el 20/10: su mensaje ya no corresponde. No se le mandó nada.`;
  for (const b of antes) {
    if (!APLICAR) { console.log(`  descartaría ${b.id} (lead ${b.lead_id}) y anotaría: ${motivo}`); continue; }
    const ok = await descartarBorrador(b.id);
    if (ok) await logLeadEvent(b.lead_id, 'Automatización', motivo, 'Desarrollador de MaKo');
    console.log(`  borrador ${b.id} (lead ${b.lead_id}): ${ok ? 'descartado y anotado' : 'NO (ya no estaba pendiente)'}`);
  }
  if (APLICAR) {
    await foto('DESPUÉS');
    const { data: au } = await db.from('lead_audit').select('lead_id, campo, valor_nuevo, autor, created_at').in('lead_id', Object.values(ESPERADOS)).eq('valor_nuevo', motivo);
    console.log(`\nhistorial: ${(au ?? []).length} líneas escritas`);
  } else console.log('\n(sin --aplicar: no se escribió nada)');
});
