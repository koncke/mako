// SOLO LECTURA. Lo que el bloque «Automatizaciones» de la ficha DIRÍA hoy para unos leads del negocio de Mauricio: la
// vista (`vistaDeDetalle`) y las líneas que dibuja la tarjeta, con los mismos helpers que la pantalla.
export {};
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace } = await imp('lib/workspace.ts');
const { detalleDelLead } = await imp('lib/automatizaciones-del-lead.ts');
const al = await imp('app/crm/automatizacion-lead.ts');
const leads = process.argv.slice(2).map(Number).filter(Boolean);
const tz = 'America/Tijuana';
const f = new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
const fecha = (iso: string) => f.format(new Date(iso)).replace(/\./g, '');
await runWithWorkspace(1, async () => {
  for (const id of leads) {
    const d = await detalleDelLead(id);
    const v = al.vistaDeDetalle(d);
    console.log(`\n══ lead ${id}: ${v.vivas.length} vivas · ${v.terminadas.length} terminadas · ${v.noEntro.length} no entró`);
    console.log(`  línea del bloque: ${al.lineaDelBloque(v)}`);
    for (const n of v.noEntro) console.log(`  ⚠ no entró: ${n.texto} · ${n.at ? fecha(n.at) : ''}`);
    for (const a of [...v.vivas, ...v.terminadas]) {
      const c = al.chipDeInscripcion(a);
      console.log(`  ▸ «${a.nombre}» [${c.texto} · ${c.tono}] estado=${a.estado} activaAut=${a.automatizacionActiva}`);
      console.log(`     paso: ${al.lineaDelPaso(a) ?? '—'}`);
      console.log(`     próximo: ${al.lineaDelProximo(a, fecha)}`);
      if (a.termino) console.log(`     terminó: ${a.termino.texto} · ${fecha(a.termino.at)}`);
      console.log(`     enviados (${a.enviados.length}): ${a.enviados.slice(0, 4).map((e: { at: string }) => al.lineaDelEnvio(e, fecha).texto).join(' | ')}`);
      console.log(`     puede: ${JSON.stringify(a.puede)} · reentrada ${a.reentrada}`);
    }
  }
});
