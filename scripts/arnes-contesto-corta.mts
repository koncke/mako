// =============================================================================
// Arnés: «Contestó» CORTA (23/10/2026, P0 de #289; Martín en la llamada, min 49: «¿Contestó corta de verdad?»)
// =============================================================================
// La forma de #289, con textos neutros:
//   entrada → M1 → «Contestó?» (sí → AVISO) / no → esperar 1 día → M2 → esperar 2 días → «No contestó?» → M3
// El AVISO es «poner una etiqueta» (en el ws3, «avisar al equipo» saldría por la línea de MaKo al grupo: un WhatsApp de
// verdad). Tres leads de prueba, uno por momento en que contesta:
//   A. ANTES de que le salga M1 (le escribió al negocio por otra cosa): M1 le sale igual, y enseguida «Contestó»;
//   B. DURANTE la espera de 1 día (ya le salió M1);
//   C. DURANTE la espera de 2 días (ya le salieron M1 y M2);
// y D, que no contesta (el control: le sale todo). En B y C la rama «Contestó» corre EN EL ACTO (la etiqueta) y después
// no le sale ningún mensaje más, aunque venzan las esperas. La respuesta se marca como la marca el motor
// (`pausarPorRespuesta`: la inscripción pasa a 'respondio') y se llama a `alContestar` (lo que corre después), sin el
// resto de sus avisos. Todo SIMULADO: el ws3 no tiene número vinculado y su envío de WhatsApp queda apagado.
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/arnes-contesto-corta.mts
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb, getWorkspaceActual } = await imp('lib/workspace.ts');
const nut = await imp('lib/nutricion.ts');
const { crearSecuenciaVacia } = await imp('lib/setting-secuencias.ts');
const { guardarDisparadores } = await imp('lib/disparadores-guardar.ts');
const { listarLineas } = await imp('lib/evolution.ts');
const { envioWhatsappHabilitado } = await imp('lib/envio-flags.ts');
const { createLead } = await imp('lib/leads.ts');
const { agregarAProducto, moverEtapaEnProducto } = await imp('lib/lead-funnel.ts');
const { guardarConfigAutomatizacion } = await imp('lib/config-automatizacion-db.ts');

const WS = 3, CRM = 43, ETAPA = 'conversando', ETIQUETA = 8;
const marca = new Date().toISOString().slice(5, 16).replace('T', ' ');
const wa = (id: string, texto: string, siguiente: string | null) => ({ id, canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: texto, siguiente, delay_horas: 0 });
let fallos = 0;
const ver = (ok: boolean, que: string, dato?: unknown) => { if (!ok) fallos += 1; console.log(`${ok ? '✔' : '✖'} ${que}${dato === undefined ? '' : ` → ${typeof dato === 'string' ? dato : JSON.stringify(dato)}`}`); };

await runWithWorkspace(WS, async () => {
  if ((await getWorkspaceActual()) !== WS) throw new Error('no es el ws3');
  const db = await getTenantDb();
  if ((await listarLineas()).some((l: { estado: string; numero: string | null }) => l.estado === 'conectado' || l.numero)) throw new Error('el ws3 tiene línea: no sigo');
  if (await envioWhatsappHabilitado()) throw new Error('el envío de WhatsApp del ws3 está prendido: no sigo');
  let secId: number | null = null;
  try {
    const sec = await crearSecuenciaVacia(`🧪 Arnés contestó ${marca}`);
    secId = sec.id;
    await nut.setSecuenciaPasos(sec.id, [
      { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
      wa('m1', 'M1: primer mensaje', 'c1'),
      { id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'aviso' }], si_no: 'e1' },
      { id: 'aviso', canal: 'whatsapp', cuerpo: '', accion: { operacion: 'poner_etiqueta_lead', params: { leadId: 'evento', etiquetaId: ETIQUETA } }, siguiente: null },
      { id: 'e1', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' },
      wa('m2', 'M2: segundo mensaje', 'e2'),
      { id: 'e2', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 2880 }, siguiente: 'c2' },
      { id: 'c2', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r2', modo: 'todas', filas: [{ no: true, campo: 'contesto' }], siguiente: 'm3' }], si_no: null },
      wa('m3', 'M3: tercer mensaje', null),
    ]);
    await guardarDisparadores(sec.id, [{ trigger_tipo: 'etapa_actual', etapa: ETAPA, funnel_id: CRM }]);
    // «Misma persona» en 0 (como #289): sin esto el anti-ban de 20 h del negocio frena el mensaje que sigue a M1.
    const g = await guardarConfigAutomatizacion(sec.id, { personaHoras: { whatsapp: 0, email: 0 } });
    if (!g.ok) throw new Error(g.error);
    // Activa con la misma escritura de `setSecuenciaActiva`, sin la guarda de la línea (el ws3 no tiene número).
    await db.from('nutricion_secuencias').update({ activa: true, updated_at: new Date().toISOString() }).eq('id', sec.id);
    console.log(`automatización #${sec.id}`);

    const nuevoLead = async (cual: string, tel: string): Promise<number> => {
      const lead = await createLead({ nombre: `🧪 Martín arnés contestó ${cual} ${marca}`, telefono: tel, permitirDuplicado: true });
      await db.from('leads').update({ created_at: new Date(Date.now() - 3 * 86400_000).toISOString() }).eq('id', lead.id);
      await agregarAProducto(lead.id, CRM, { autor: 'Arnés contestó' });
      await moverEtapaEnProducto(lead.id, CRM, ETAPA, { autor: 'Arnés contestó' });
      return lead.id;
    };
    const fila = async (lead: number) => (await db.from('nutricion_inscripciones').select('id, estado, paso_actual, nodo_actual, proximo_envio_at').eq('secuencia_id', sec.id).eq('lead_id', lead).maybeSingle()).data;
    const salidos = async (lead: number): Promise<string[]> => ((await db.from('nutricion_envios').select('nodo_id, estado').eq('secuencia_id', sec.id).eq('lead_id', lead).order('id')).data ?? [])
      .filter((e: { estado: string }) => e.estado === 'simulado' || e.estado === 'enviado').map((e: { nodo_id: string }) => e.nodo_id);
    const etiquetado = async (lead: number) => ((await db.from('crm_lead_etiquetas').select('lead_id').eq('lead_id', lead).eq('etiqueta_id', ETIQUETA)).data ?? []).length > 0;
    const vence = async (lead: number) => { const f = await fila(lead); if (f?.proximo_envio_at) await db.from('nutricion_inscripciones').update({ proximo_envio_at: new Date().toISOString() }).eq('id', f.id); };
    const correr = (lead: number) => nut.procesarEnvios({ soloLeadId: lead, ignorarVentana: true, simularApagados: true });
    /** Contesta: como `pausarPorRespuesta` (la fila a 'respondio') y lo que corre después (`alContestar`). */
    const contesta = async (lead: number) => {
      const f = await fila(lead);
      await db.from('nutricion_inscripciones').update({ estado: 'respondio', updated_at: new Date().toISOString() }).eq('id', f.id).eq('estado', 'activa');
      return nut.alContestar(lead, [{ id: f.id, secuencia_id: sec.id }]);
    };
    /** Que pase el tiempo: vencen las esperas y corre el motor (simulado), varias vueltas. */
    const pasaElTiempo = async (lead: number) => { for (let i = 0; i < 4; i++) { await vence(lead); await correr(lead); } };
    const lista = (xs: string[]) => JSON.stringify(xs);

    // A. Contesta ANTES de que le salga M1 (le escribió al negocio por otra cosa): no se corta nada todavía; M1 le sale,
    // la condición ya ve que contestó y corre lo de «Contestó». Ningún mensaje más.
    const a = await nuevoLead('A', '+000000000311');
    ver((await salidos(a)).length === 0, 'A: todavía no le salió nada', await fila(a));
    await contesta(a);
    await pasaElTiempo(a);
    ver(lista(await salidos(a)) === '["m1"]', 'A: le salió M1 (contestó antes: no se le corta el primero)', await salidos(a));
    ver(await etiquetado(a), 'A: y corrió la rama «Contestó» (la etiqueta)', await fila(a));

    // B. Contesta DURANTE la espera de 1 día (ya le salió M1).
    const b = await nuevoLead('B', '+000000000312');
    await vence(b); await correr(b);
    ver(lista(await salidos(b)) === '["m1"]', 'B: le salió M1 y espera', { salio: await salidos(b), fila: await fila(b) });
    await contesta(b);
    await correr(b);
    ver(await etiquetado(b), 'B: la rama «Contestó» corrió', await fila(b));
    await pasaElTiempo(b);
    ver(lista(await salidos(b)) === '["m1"]', 'B: no le salió M2 ni M3', await salidos(b));

    // C. Contesta DURANTE la espera de 2 días (ya le salieron M1 y M2).
    const c = await nuevoLead('C', '+000000000313');
    await vence(c); await correr(c); await vence(c); await correr(c);
    ver(lista(await salidos(c)) === '["m1","m2"]', 'C: le salieron M1 y M2 y espera', { salio: await salidos(c), fila: await fila(c) });
    await contesta(c);
    await correr(c);
    ver(await etiquetado(c), 'C: la rama «Contestó» corrió', await fila(c));
    await pasaElTiempo(c);
    ver(lista(await salidos(c)) === '["m1","m2"]', 'C: no le salió M3', await salidos(c));

    // D. No contesta: le sale todo (el corte no rompe el flujo).
    const d = await nuevoLead('D', '+000000000314');
    await pasaElTiempo(d);
    ver(lista(await salidos(d)) === '["m1","m2","m3"]', 'D (no contesta): le salen M1, M2 y M3', await salidos(d));
    ver(!(await etiquetado(d)), 'D: la rama «Contestó» no corrió');
  } finally {
    if (secId != null) await db.from('nutricion_secuencias').update({ activa: false, archivada_at: new Date().toISOString() }).eq('id', secId);
    console.log(`automatización #${secId} pausada y archivada · envío de WhatsApp ${await envioWhatsappHabilitado()}`);
  }
});
console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO VERDE');
process.exit(fallos ? 1 : 0);
