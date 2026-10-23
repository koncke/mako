// =============================================================================
// Arnés de PUNTA A PUNTA de una automatización por etapa, en el ws3 (23/10/2026, P0 de #289)
// =============================================================================
// Martín, por el Cerebro: «probamos en vivo la automatización de Mauricio y no funcionó». Medido: se inscribieron por
// evento en 8 s y el motor cortó por el horario de oficina sin decirlo. Este arnés recorre el camino entero con las
// funciones de la app, en el ws3 (el negocio de prueba), y compara lo que la pantalla DICE con lo que el motor HACE:
//   1. una automatización «🧪 Arnés P0» con CRON en «Contactado» del CRM 43 y un WhatsApp, activada (sin la guarda de la
//      línea conectada: el ws3 no tiene línea, a propósito);
//   2. dos leads de prueba de Martín (teléfono falso): uno AGREGADO al CRM 43 (como los 300 del Sprint, cargado días
//      antes) y otro con su casa ahí (como la prueba de Martín), movidos a «Contactado» con las funciones del tablero;
//   3. horario CERRADO: se inscriben en el acto; el lead, su historial y la tarjeta dicen «No salió: fuera del horario…»,
//      y el motor (la misma corrida que la vía rápida) corta por el horario;
//   4. horario abierto: el motor lo intenta y FALLA porque la línea del ws3 no está vinculada (no sale nada: no hay
//      número), y el lead dice ese fallo con el error del proveedor;
//   5. «en la cola, enviado»: el motor lo manda en modo simulado y la inscripción avanza;
//   6. el envío de WhatsApp del negocio apagado: el lead dice eso, y el motor hace eso.
// Al final: la automatización queda PAUSADA, el envío de WhatsApp APAGADO y el horario como estaba.
//
// ⚠️ NO MANDA NADA A NADIE. El ws3 no tiene número vinculado (corta si tiene una línea conectada o con número, y si el
// envío de WhatsApp estaba prendido: entonces no es el ws3 que conocemos), los leads tienen teléfonos que no existen, y
// el envío de WhatsApp se prende SÓLO durante los pasos 3 y 4. Nunca toca otro negocio (`runWithWorkspace(3)`, y se
// comprueba). Correr:
//   node --env-file=.env.local --conditions=react-server --import tsx scripts/arnes-automatizacion-punta-a-punta.mts
// =============================================================================
export {};   // un .mts sin import ni export es un script GLOBAL para tsc (guardas-push.sh)
const base = process.cwd().split(String.fromCharCode(92)).join('/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { runWithWorkspace, getTenantDb, getWorkspaceActual } = await imp('lib/workspace.ts');
const nut = await imp('lib/nutricion.ts');
const { crearSecuenciaVacia } = await imp('lib/setting-secuencias.ts');
const { guardarDisparadores } = await imp('lib/disparadores-guardar.ts');
const { listarLineas } = await imp('lib/evolution.ts');
const { envioWhatsappHabilitado, setEnvioWhatsapp } = await imp('lib/envio-flags.ts');
const { getSettingEstricto, setSetting } = await imp('lib/settings.ts');
const { KEY_HORARIO_ENVIO, horarioParaGuardar, relojEnZona } = await imp('lib/horario-envio.ts');
const { zonaDelNegocioEstricta } = await imp('lib/timezone.ts');
const { createLead, setPipelineStage } = await imp('lib/leads.ts');
const { agregarAProducto, moverEtapaEnProducto } = await imp('lib/lead-funnel.ts');
const { enAutomatizaciones } = await imp('lib/automatizaciones-del-lead.ts');
const { frenosDelNegocio } = await imp('lib/por-que-no-sale-db.ts');
const { enColaPorPaso } = await imp('lib/en-cola-por-paso.ts');

const WS = 3, CRM = 43, ETAPA = 'st1', AUTOR = 'Arnés P0';
const marca = new Date().toISOString().slice(5, 16).replace('T', ' ');
let fallos = 0;
const ver = (ok: boolean, que: string, dato?: unknown) => { if (!ok) fallos += 1; console.log(`${ok ? '✔' : '✖'} ${que}${dato === undefined ? '' : ` → ${typeof dato === 'string' ? dato : JSON.stringify(dato)}`}`); };
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

await runWithWorkspace(WS, async () => {
  if ((await getWorkspaceActual()) !== WS) throw new Error('no es el ws3: no sigo');
  const db = await getTenantDb();
  // La guarda: en el ws3 no puede salir nada a nadie.
  const lineas = await listarLineas();
  if (lineas.some((l: { estado: string; numero: string | null }) => l.estado === 'conectado' || l.numero)) throw new Error('el ws3 tiene una línea conectada: no sigo');
  if (await envioWhatsappHabilitado()) throw new Error('el ws3 tiene el envío de WhatsApp prendido: no sigo');
  const horarioAntes = await getSettingEstricto(KEY_HORARIO_ENVIO);
  const tz = await zonaDelNegocioEstricta(WS);
  const horario = async (h: unknown) => { const g = horarioParaGuardar(h); if (!g.ok) throw new Error(g.error); await setSetting(KEY_HORARIO_ENVIO, g.valor); };
  const fichaDe = async (leadId: number, secId: number) => ((await enAutomatizaciones([leadId])).get(leadId) ?? []).find((x: { secuenciaId: number }) => x.secuenciaId === secId);
  let secId: number | null = null;
  try {
    // 1. La automatización, como el lienzo: vacía, sus tarjetas, su CRON, activa.
    const sec = await crearSecuenciaVacia(`🧪 Arnés P0 · Contactado ${marca}`);
    secId = sec.id;
    await nut.setSecuenciaPasos(sec.id, [
      { id: 'entrada', nodo: 'inicio', canal: 'whatsapp', cuerpo: '', siguiente: 'm1' },
      { id: 'm1', canal: 'whatsapp', proveedor: 'no_oficial', cuerpo: 'Hola {{nombre}}, esto es una prueba del arnés de MaKo.', siguiente: null, delay_horas: 0 },
    ]);
    await guardarDisparadores(sec.id, [{ trigger_tipo: 'etapa_actual', etapa: ETAPA, funnel_id: CRM }]);
    // «Activar» exige un WhatsApp conectado («Conecta tu WhatsApp», `validarActivacion`), y el ws3 no tiene línea A
    // PROPÓSITO. Se activa con la MISMA escritura que `setSecuenciaActiva`, sin esa guarda. La #289 de Mauricio se activó
    // por el camino de siempre.
    const { error: eAct } = await db.from('nutricion_secuencias').update({ activa: true, updated_at: new Date().toISOString() }).eq('id', sec.id);
    if (eAct) throw new Error(eAct.message);
    console.log(`automatización #${sec.id} «${sec.nombre}»`);

    // 2. Los dos leads de prueba de Martín. El agregado, cargado «días antes» como los 300 del Sprint: una fila creada a
    // menos de 10 min del alta es parte del alta y la saluda la casa (`filaNacidaConElLead`, lib/nutricion-ambito.ts).
    const agregado = await createLead({ nombre: `🧪 Martín arnés agregado ${marca}`, telefono: '+000000000301', permitirDuplicado: true });
    await db.from('leads').update({ created_at: new Date(Date.now() - 3 * 86400_000).toISOString() }).eq('id', agregado.id);
    await agregarAProducto(agregado.id, CRM, { autor: AUTOR });
    const casa = await createLead({ nombre: `🧪 Martín arnés casa ${marca}`, telefono: '+000000000302', funnel_id: CRM, permitirDuplicado: true });
    console.log(`leads #${agregado.id} (agregado al CRM ${CRM}) y #${casa.id} (casa en el CRM ${CRM})`);

    // 3. Horario CERRADO (una hora que no es ésta) y el envío prendido: moverlos como el tablero.
    const h = relojEnZona(Date.now(), tz).hora;
    await horario(h === 1 ? { activo: true, desde: 5, hasta: 6, dias: [0, 1, 2, 3, 4, 5, 6] } : { activo: true, desde: 1, hasta: 2, dias: [0, 1, 2, 3, 4, 5, 6] });
    await setEnvioWhatsapp(true);
    const t0 = Date.now();
    await moverEtapaEnProducto(agregado.id, CRM, ETAPA, { autor: AUTOR });
    await setPipelineStage(casa.id, ETAPA, { autor: AUTOR });
    await esperar(1500);
    const { data: insc } = await db.from('nutricion_inscripciones').select('id, lead_id, estado, paso_actual, inscripto_at').eq('secuencia_id', sec.id);
    for (const l of [agregado, casa]) {
      const i = (insc ?? []).find((x: { lead_id: number }) => x.lead_id === l.id);
      ver(!!i && i.estado === 'activa' && Date.parse(i.inscripto_at) - t0 < 60_000, `#${l.id} se inscribió por evento, en el acto`, i ? `${Math.round((Date.parse(i.inscripto_at) - t0) / 1000)} s` : 'sin inscripción');
    }
    const { data: env0 } = await db.from('nutricion_envios').select('id').eq('secuencia_id', sec.id);
    ver((env0 ?? []).length === 0, 'fuera del horario no salió nada');
    const HORARIO = /^No salió: fuera del horario de oficina \(\d+(:30)? a \d+(:30)?, hora de .+\)\. Sale .+\.$/;
    for (const l of [agregado, casa]) {
      const a = await fichaDe(l.id, sec.id);
      ver(HORARIO.test(a?.frenado?.texto ?? ''), `la ficha de #${l.id} dice por qué`, a?.frenado?.texto ?? 'nada');
    }
    const { data: hist } = await db.from('lead_audit').select('lead_id, valor_nuevo').in('lead_id', [agregado.id, casa.id]).eq('campo', 'Automatización');
    for (const l of [agregado, casa]) {
      const e = (hist ?? []).find((x: { lead_id: number; valor_nuevo: string }) => x.lead_id === l.id && x.valor_nuevo.includes(sec.nombre));
      ver(!!e && /^Entró a «.+»\. No salió: fuera del horario/.test(e.valor_nuevo), `el historial de #${l.id} lo dice`, e?.valor_nuevo ?? 'nada');
    }
    const cola = async () => {
      const { data: filas } = await db.from('nutricion_inscripciones').select('id, lead_id, secuencia_id, estado, paso_actual, nodo_actual, proximo_envio_at').eq('secuencia_id', sec.id).eq('estado', 'activa');
      const { data: fila } = await db.from('nutricion_secuencias').select('id, nombre, activa, archivada_at, pasos, instance_name').eq('id', sec.id).maybeSingle();
      return enColaPorPaso(filas ?? [], fila, await frenosDelNegocio(filas ?? [], [fila]));
    };
    const c1 = await cola();
    ver(/^2 esperando · Abre /.test(c1.m1?.chip ?? ''), 'la tarjeta del lienzo dice quién espera', c1.m1?.chip ?? 'nada');
    // Lo que DICE contra lo que HACE: la misma corrida que la vía rápida.
    const r1 = await nut.procesarEnvios({ soloLeadId: casa.id });
    ver(r1.saltado === 'fuera-de-horario', 'el motor corta por el horario (lo mismo que dice)', r1.saltado ?? r1.detalle);

    // 4. Horario abierto: el motor lo intenta y la línea sin vincular lo hace fallar. El lead dice el fallo.
    await horario({ activo: false });
    const r2 = await nut.procesarEnvios({ soloLeadId: casa.id });
    const { data: env1 } = await db.from('nutricion_envios').select('estado, error').eq('secuencia_id', sec.id).eq('lead_id', casa.id);
    const fallo = (env1 ?? []).find((e: { estado: string }) => e.estado === 'fallo');
    ver(!!fallo && !(env1 ?? []).some((e: { estado: string }) => e.estado === 'enviado'), 'el motor lo intentó y falló (sin línea no sale nada)', fallo?.error ?? r2.detalle);
    const a4 = await fichaDe(casa.id, sec.id);
    ver(!!fallo && a4?.frenado?.texto?.startsWith('No salió: ') === true && a4.frenado.texto.includes(String(fallo.error).slice(0, 30)), `la ficha de #${casa.id} dice el fallo`, a4?.frenado?.texto ?? 'nada');

    // 5. «En la cola, enviado»: el envío apagado y el motor en modo simulado. La inscripción avanza.
    await setEnvioWhatsapp(false);
    const r3 = await nut.procesarEnvios({ soloLeadId: agregado.id, ignorarVentana: true, simularApagados: true });
    const { data: env2 } = await db.from('nutricion_envios').select('estado').eq('secuencia_id', sec.id).eq('lead_id', agregado.id);
    ver((env2 ?? []).some((e: { estado: string }) => e.estado === 'simulado'), 'el mensaje salió de la cola (simulado)', r3.detalle);
    const { data: despues } = await db.from('nutricion_inscripciones').select('estado, paso_actual').eq('secuencia_id', sec.id).eq('lead_id', agregado.id).maybeSingle();
    ver(!!despues && (despues.estado !== 'activa' || (despues.paso_actual ?? 0) > 0), 'la inscripción avanzó', despues);
    ver(!(await fichaDe(agregado.id, sec.id))?.frenado, `la ficha de #${agregado.id} ya no dice que está frenada`);

    // 6. El envío de WhatsApp del negocio apagado: el lead dice eso, y el motor hace eso.
    const a6 = await fichaDe(casa.id, sec.id);
    ver(a6?.frenado?.texto === 'No sale: el envío de WhatsApp del negocio está apagado.', `la ficha de #${casa.id} dice que el envío está apagado`, a6?.frenado?.texto ?? 'nada');
    const { error: eVence } = await db.from('nutricion_inscripciones').update({ proximo_envio_at: new Date().toISOString() }).eq('secuencia_id', sec.id).eq('lead_id', casa.id);
    if (eVence) throw new Error(eVence.message);
    const r4 = await nut.procesarEnvios({ soloLeadId: casa.id });
    ver((r4.detalle ?? []).some((d: { nota?: string }) => d.nota === 'canal whatsapp apagado'), 'el motor no lo manda porque el envío está apagado (lo mismo que dice)', r4.detalle);
  } finally {
    await setEnvioWhatsapp(false);
    if (secId != null) await nut.setSecuenciaActiva(secId, false).catch((e: unknown) => console.error('no pude pausar la del arnés', e));
    // ARCHIVADA, no sólo pausada (23/10/2026): pausada quedaba viva en la lista del ws3, una por corrida (370 en dos
    // días, que se sumaban a «cuántas automatizaciones hay»). tests/automatizaciones-solo-plantillas.test.ts, test 3.
    if (secId != null) {
      const { error: eArch } = await db.from('nutricion_secuencias').update({ archivada_at: new Date().toISOString() }).eq('id', secId);
      if (eArch) console.error('no pude archivar la del arnés', eArch.message);
    }
    if (horarioAntes != null) await setSetting(KEY_HORARIO_ENVIO, horarioAntes);
    else await horario({ activo: false });
    console.log(`al final: automatización #${secId} pausada · envío de WhatsApp ${await envioWhatsappHabilitado()} · horario ${await getSettingEstricto(KEY_HORARIO_ENVIO)}`);
  }
});
console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO VERDE');
process.exit(fallos ? 1 : 0);
