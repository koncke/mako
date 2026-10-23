// =============================================================================
// Arnés: ¿«Contestó» CORTA la secuencia si el lead responde durante una espera? (23/10/2026, P0 de #289, punto B)
// =============================================================================
// Martín, en la llamada (min 49): ¿«Contestó» corta de verdad? La forma de #289, con textos neutros:
//   entrada → M1 → condición «Contestó» (sí → M-sí) / no → espera → M2 → espera → condición «No contestó» → M3
// El lead contesta DURANTE la primera espera. Se mide qué le sale después. En el ws3, todo SIMULADO (el ws3 no tiene número
// vinculado y el envío de WhatsApp queda apagado): no sale nada a nadie. La respuesta se simula como la marca el motor
// (`pausarPorRespuesta`: la inscripción pasa a 'respondio'), sin correr sus avisos. Las esperas se adelantan a mano.
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

const WS = 3, CRM = 43, ETAPA = 'conversando';
const marca = new Date().toISOString().slice(5, 16).replace('T', ' ');
const wa = (id: string, texto: string, siguiente: string | null) => ({ id, canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: texto, siguiente, delay_horas: 0 });

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
      { id: 'c1', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r1', modo: 'todas', filas: [{ campo: 'contesto' }], siguiente: 'msi' }], si_no: 'e1' },
      wa('msi', 'M-SI: gracias por contestar', null),
      { id: 'e1', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 1440 }, siguiente: 'm2' },
      wa('m2', 'M2: segundo mensaje (no debería salirle a quien contestó)', 'e2'),
      { id: 'e2', nodo: 'esperar', canal: 'whatsapp', cuerpo: '', espera: { modo: 'tiempo', minutos: 2880 }, siguiente: 'c2' },
      { id: 'c2', nodo: 'condicion', canal: 'whatsapp', cuerpo: '', ramas: [{ id: 'r2', modo: 'todas', filas: [{ no: true, campo: 'contesto' }], siguiente: 'm3' }], si_no: null },
      wa('m3', 'M3: tercer mensaje', null),
    ]);
    await guardarDisparadores(sec.id, [{ trigger_tipo: 'etapa_actual', etapa: ETAPA, funnel_id: CRM }]);
    // «Misma persona» en 0 (como #289): sin esto el anti-ban de 20 h del negocio frena el mensaje que sigue a M1.
    const g = await guardarConfigAutomatizacion(sec.id, { personaHoras: { whatsapp: 0, email: 0 } });
    if (!g.ok) throw new Error(g.error);
    await db.from('nutricion_secuencias').update({ activa: true, updated_at: new Date().toISOString() }).eq('id', sec.id);
    const lead = await createLead({ nombre: `🧪 Martín arnés contestó ${marca}`, telefono: '+000000000303', permitirDuplicado: true });
    await db.from('leads').update({ created_at: new Date(Date.now() - 3 * 86400_000).toISOString() }).eq('id', lead.id);
    await agregarAProducto(lead.id, CRM, { autor: 'Arnés contestó' });
    await moverEtapaEnProducto(lead.id, CRM, ETAPA, { autor: 'Arnés contestó' });
    const correr = () => nut.procesarEnvios({ soloLeadId: lead.id, ignorarVentana: true, simularApagados: true });
    const fila = async () => (await db.from('nutricion_inscripciones').select('id, estado, paso_actual, nodo_actual, proximo_envio_at').eq('secuencia_id', sec.id).eq('lead_id', lead.id).maybeSingle()).data;
    const salidos = async () => ((await db.from('nutricion_envios').select('nodo_id, estado').eq('secuencia_id', sec.id).eq('lead_id', lead.id).order('id')).data ?? []).map((e: { nodo_id: string; estado: string }) => `${e.nodo_id}:${e.estado}`);
    // El envío del ws3 está apagado: la vía rápida dejó M1 para dentro de 24 h. Sale ahora, simulado, ANTES de que conteste.
    { const f0 = await fila(); await db.from('nutricion_inscripciones').update({ proximo_envio_at: new Date().toISOString() }).eq('id', f0.id); }
    await correr();
    console.log('después de entrar:', JSON.stringify(await fila()), '· salió:', (await salidos()).join(' '));
    // El lead CONTESTA durante la espera de 1 día (como lo marca `pausarPorRespuesta`).
    const f1 = await fila();
    await db.from('nutricion_inscripciones').update({ estado: 'respondio', updated_at: new Date().toISOString() }).eq('id', f1.id);
    // Pasa el día: la espera vence.
    await db.from('nutricion_inscripciones').update({ proximo_envio_at: new Date().toISOString() }).eq('id', f1.id);
    await correr();
    console.log('después de la espera (contestó):', JSON.stringify(await fila()), '· salió:', (await salidos()).join(' '));
    const f2 = await fila();
    if (f2?.proximo_envio_at) { await db.from('nutricion_inscripciones').update({ proximo_envio_at: new Date().toISOString() }).eq('id', f2.id); await correr(); }
    const fin = await salidos();
    console.log('al final:', JSON.stringify(await fila()), '· salió:', fin.join(' '));
    console.log(fin.some((x: string) => x.startsWith('m2:')) ? '✖ A QUIEN CONTESTÓ LE SALIÓ M2' : '✔ a quien contestó no le salió M2');
    console.log(fin.some((x: string) => x.startsWith('msi:')) ? '✔ salió lo de «Contestó»' : '✖ lo de «Contestó» no salió nunca');
  } finally {
    if (secId != null) await db.from('nutricion_secuencias').update({ activa: false, archivada_at: new Date().toISOString() }).eq('id', secId);
    console.log(`automatización #${secId} pausada y archivada · envío de WhatsApp ${await envioWhatsappHabilitado()}`);
  }
});
