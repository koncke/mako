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
//
// Y DOS MÁS (24/10/2026, la #289 del ws1: el #2502 contestó MIENTRAS le salía M1 y lo que contestó era la bienvenida
// automática de su WhatsApp Business):
//   E. contesta MIENTRAS sale M1, a los 20 s de la primera parte (una persona): corta y avisa. En una corrida simulada M1
//      no dura nada, así que «mientras sale» es el `durante` de `procesarEnvios` (con el mensaje ya mandado, antes de su
//      fila). Y E2, la simétrica: con la fila del envío ya escrita y antes del avance;
//   F. la respuesta automática a los 5 s de la primera parte: no corta, M2 sale, y la ficha lo dice.
// Y TRES MÁS (la revisión del mismo día):
//   F2. la bienvenida llega mientras salen las partes, ANTES de la fila del envío: el motor reclamó la inscripción y el
//       lector espera su fila (en paralelo con el motor);
//   G. contesta entre la lectura del lote y el mensaje que sigue: el reclamo ve que cambió y M2 no sale;
//   H. el lead ya había escrito: a los 5 s cuenta (sin actividad no hay bienvenida, pero con actividad, sí hay charla).
// La primera parte es una fila de `wa_mensajes` saliente de prueba (en simulado no sale nada, y es lo que lee
// `esRespuestaAutomaticaDelEntrante`, lib/evolution-mensajes.ts), con la hora relativa a la de la BASE (la fila del envío)
// para no medir el reloj de esta máquina contra el de Supabase.
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
const { esRespuestaAutomaticaDelEntrante } = await imp('lib/evolution-mensajes.ts');
const { conTurnoDelMotor } = await imp('lib/motor-turno.ts');

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
    // (Hasta el 23/10 se ponía «Misma persona» en 0; se fue entera y `guardarConfigAutomatizacion` rechaza el campo. El
    // motor ya no la aplica: no hace falta.)
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
    // ⚠️ CON EL TURNO DEL MOTOR DEL ws3 (revisión del 24/10/2026). El tick de producción corre cada minuto también acá, SIN
    // simular: si agarraba la fila entre `vence` y la corrida del arnés, la mandaba 24 h para adelante («canal apagado») y
    // el caso salía rojo por azar (medido: E, una vez de tres). Antes no se veía porque la corrida del arnés mandaba igual
    // con la fila vieja; con el reclamo antes de mandar, pierde, como tiene que ser. Adentro del turno, la vía rápida de
    // `alContestar` no corre ('ocupado'): la rama «Contestó» la corre la misma corrida, como en producción cuando el lead
    // contesta mientras el motor manda.
    const conTurno = async <T,>(fn: () => Promise<T>): Promise<T> => {
      const r = await conTurnoDelMotor(WS, fn, { esperarMs: 120_000 });
      if (!r.corrio) throw new Error(`no conseguí el turno del motor del ws3 (${r.porque})`);
      return r.resultado;
    };
    const simulada = (lead: number) => ({ soloLeadId: lead, ignorarVentana: true, simularApagados: true });
    const correr = (lead: number) => conTurno(() => nut.procesarEnvios(simulada(lead)));
    /** Vence la fila y corre el motor SIN soltar el turno (ver arriba); `durante`, el del arnés. */
    const venceYCorre = (lead: number, durante?: unknown) =>
      conTurno(async () => { await vence(lead); return nut.procesarEnvios({ ...simulada(lead), ...(durante ? { durante } : {}) }); });
    /** Contesta: como `pausarPorRespuesta` (la fila a 'respondio') y lo que corre después (`alContestar`). */
    const contesta = async (lead: number) => {
      const f = await fila(lead);
      await db.from('nutricion_inscripciones').update({ estado: 'respondio', updated_at: new Date().toISOString() }).eq('id', f.id).eq('estado', 'activa');
      return nut.alContestar(lead, [{ id: f.id, secuencia_id: sec.id }]);
    };
    /** Que pase el tiempo: vencen las esperas y corre el motor (simulado), varias vueltas. */
    const pasaElTiempo = async (lead: number) => { for (let i = 0; i < 4; i++) await venceYCorre(lead); };
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
    await venceYCorre(b);
    ver(lista(await salidos(b)) === '["m1"]', 'B: le salió M1 y espera', { salio: await salidos(b), fila: await fila(b) });
    await contesta(b);
    await correr(b);
    ver(await etiquetado(b), 'B: la rama «Contestó» corrió', await fila(b));
    await pasaElTiempo(b);
    ver(lista(await salidos(b)) === '["m1"]', 'B: no le salió M2 ni M3', await salidos(b));

    // C. Contesta DURANTE la espera de 2 días (ya le salieron M1 y M2).
    const c = await nuevoLead('C', '+000000000313');
    await venceYCorre(c); await venceYCorre(c);
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

    // ── E, E2 y F (24/10/2026, el #2502) ────────────────────────────────────────────────────────────────────────────
    const isoMs = (ms: number) => new Date(ms).toISOString();
    /** La PRIMERA PARTE de M1, como la deja `enviarYEspejar` en el espejo (en simulado no sale nada). */
    const primeraParte = async (lead: number, tel: string, alMs: number) => {
      const num = tel.replace(/\D/g, '');
      const { error } = await db.from('wa_mensajes').insert({
        instance_name: 'arnes-contesto', chat_jid: `${num}@s.whatsapp.net`, telefono: num, wa_message_id: `arnes-contesto-${lead}-${alMs}`,
        from_me: true, tipo: 'text', texto: 'M1: primer mensaje (parte 1, de prueba)', lead_id: lead, wa_timestamp: isoMs(alMs), raw: { arnes: 'contesto-corta' },
      });
      if (error) throw new Error(`la primera parte de prueba: ${error.message}`);
    };
    /** La hora de la fila del envío de M1, en el reloj de la BASE (se escribe después de la última parte). */
    const filaDelEnvio = async (inscId: number): Promise<number> =>
      Date.parse(((await db.from('nutricion_envios').select('created_at').eq('inscripcion_id', inscId).order('id', { ascending: false }).limit(1)).data ?? [])[0]?.created_at ?? '');
    /** Que entró hace una hora (no en el medio de la ráfaga): el lead recién creado se inscribe segundos antes. */
    const entroHaceUnaHora = async (lead: number) => { const f = await fila(lead); await db.from('nutricion_inscripciones').update({ inscripto_at: isoMs(Date.now() - 3600_000) }).eq('id', f.id); };
    const enLaFicha = async (lead: number, empieza: string): Promise<string | null> =>
      (((await db.from('lead_audit').select('valor_nuevo').eq('lead_id', lead).order('id', { ascending: false }).limit(30)).data ?? []) as Array<{ valor_nuevo: string | null }>)
        .map((x) => x.valor_nuevo ?? '').find((v) => v.startsWith(empieza)) ?? null;

    // E. Contesta MIENTRAS sale M1 (con las partes afuera, antes de su fila), a los 20 s de la primera parte: es una
    // persona. Lo que hace el webhook: no es automática → `pausarPorRespuesta` (la fila a 'respondio' y `alContestar`, que
    // no la toca: todavía no le salió nada). Antes del arreglo, el avance la volvía a 'activa' y le salía M2.
    const e = await nuevoLead('E', '+000000000315');
    await entroHaceUnaHora(e);
    let autoE: boolean | null = null;
    await venceYCorre(e, async (momento: string, insc: { lead_id: number }) => {
      if (momento !== 'partes' || insc.lead_id !== e || autoE !== null) return;
      const ahora = Date.now();
      await primeraParte(e, '+000000000315', ahora - 20_000);
      autoE = await esRespuestaAutomaticaDelEntrante(e, isoMs(ahora));
      if (!autoE) await contesta(e);
    });
    ver(autoE === false, 'E: a los 20 s de la primera parte, cuenta como respuesta', autoE);
    ver(lista(await salidos(e)) === '["m1"]', 'E: le salió M1', await salidos(e));
    ver(await etiquetado(e), 'E: la rama «Contestó» corrió en el acto (el avance conservó «respondio» y corrió `alContestar`)', await fila(e));
    ver((await fila(e))?.estado === 'respondio', 'E: la fila sigue en «respondio»', await fila(e));
    ver(!!(await enLaFicha(e, 'Contestó en «')), 'E: la ficha dice que contestó', await enLaFicha(e, 'Contestó en «'));
    await pasaElTiempo(e);
    ver(lista(await salidos(e)) === '["m1"]', 'E: no le salió M2 ni M3', await salidos(e));

    // E2. La simétrica: contesta con la fila del envío de M1 ya escrita y ANTES del avance. `alContestar` la lleva a la
    // rama «Contestó» (ya le salió algo) y el avance no la pisa. Antes, el avance la devolvía a la condición, 'activa'.
    const e2 = await nuevoLead('E2', '+000000000316');
    await entroHaceUnaHora(e2);
    let autoE2: boolean | null = null;
    await venceYCorre(e2, async (momento: string, insc: { id: number; lead_id: number }) => {
      if (momento !== 'fila' || insc.lead_id !== e2 || autoE2 !== null) return;
      const t1 = (await filaDelEnvio(insc.id)) - 18_000; // la primera parte, 18 s antes de la fila
      await primeraParte(e2, '+000000000316', t1);
      autoE2 = await esRespuestaAutomaticaDelEntrante(e2, isoMs(t1 + 20_000));
      if (!autoE2) await contesta(e2);
    });
    ver(autoE2 === false, 'E2: a los 20 s de la primera parte, cuenta como respuesta', autoE2);
    // (La posición y el estado eran lo que el avance pisaba: la volvía a la condición, 'activa', y le salía M2. Medido con
    // el avance en 'fila': rojo. Con el turno tomado la rama la corre esta corrida: el avance no entra y la fila vuelve a
    // la cola.)
    ver(await etiquetado(e2), 'E2: la rama «Contestó» corrió', await fila(e2));
    ver((await fila(e2))?.estado === 'respondio', 'E2: el avance no la pisó (sigue en «respondio»)', await fila(e2));
    await pasaElTiempo(e2);
    ver(lista(await salidos(e2)) === '["m1"]', 'E2: no le salió M2 ni M3', await salidos(e2));

    // F. La RESPUESTA AUTOMÁTICA de su WhatsApp a los 5 s de la primera parte (el #2502): no cuenta. El webhook no llama a
    // `pausarPorRespuesta` (acá no se «contesta»), M2 sale y la ficha lo dice.
    const f = await nuevoLead('F', '+000000000317');
    await entroHaceUnaHora(f); await venceYCorre(f);
    ver(lista(await salidos(f)) === '["m1"]', 'F: le salió M1 y espera', await salidos(f));
    const t1F = (await filaDelEnvio((await fila(f)).id)) - 3_000; // la primera parte, 3 s antes de la fila
    await primeraParte(f, '+000000000317', t1F);
    const autoF = await esRespuestaAutomaticaDelEntrante(f, isoMs(t1F + 5_000));
    ver(autoF === true, 'F: la bienvenida a los 5 s de la primera parte es automática', autoF);
    const lineaF = await enLaFicha(f, 'Su mensaje llegó a los 5 s del primer mensaje de «');
    ver(!!lineaF, 'F: la ficha lo dice (como una lectura por la hora)', lineaF);
    ver((await fila(f))?.estado === 'activa', 'F: la fila sigue «activa» (no contestó)', await fila(f));
    await pasaElTiempo(f);
    ver(lista(await salidos(f)) === '["m1","m2","m3"]', 'F: no cortó: le salen M2 y M3', await salidos(f));
    ver(!(await etiquetado(f)), 'F: la rama «Contestó» no corrió');

    // ── F2, G y H (revisión del 24/10/2026) ─────────────────────────────────────────────────────────────────────────────
    const actualizada = async (lead: number): Promise<number> =>
      Date.parse(((await db.from('nutricion_inscripciones').select('updated_at').eq('secuencia_id', sec.id).eq('lead_id', lead).maybeSingle()).data as { updated_at?: string } | null)?.updated_at ?? '');

    // F2. La bienvenida llega MIENTRAS salen las partes (lo del #2502 de verdad: a los 4,4 s, la fila del envío a los 19):
    // todavía no hay fila, el motor la RECLAMÓ antes de mandar, y quien lee ESPERA la fila de esa inscripción. Por eso el
    // entrante se lee EN PARALELO con el motor (el `durante` no puede esperarlo: la fila se escribe cuando vuelve).
    const f2 = await nuevoLead('F2', '+000000000318');
    await entroHaceUnaHora(f2);
    let autoF2: Promise<boolean> | null = null;
    let relojes: Record<string, number> = {};
    let esperoF2 = 0;
    await venceYCorre(f2, async (momento: string, insc: { lead_id: number }) => {
      if (momento !== 'partes' || insc.lead_id !== f2 || autoF2) return;
      const reclamo = await actualizada(f2);
      const t1 = Date.now();
      await primeraParte(f2, '+000000000318', t1);
      // (El reclamo y el espejo son de esta máquina; la fila del envío, de la base: el desfase, para leer un rojo.)
      const { data: p } = await db.from('wa_mensajes').select('created_at').eq('wa_message_id', `arnes-contesto-${f2}-${t1}`).maybeSingle();
      relojes = { reclamoAntesDeLaPrimera_ms: t1 - reclamo, baseMenosMaquina_ms: Date.parse((p as { created_at?: string } | null)?.created_at ?? '') - t1 };
      const t0 = Date.now();
      autoF2 = esRespuestaAutomaticaDelEntrante(f2, isoMs(t1 + 4_400)).then((x: boolean) => { esperoF2 = Date.now() - t0; return x; });
      // Las otras partes: en el #2502 la fila del envío llegó 15 s después de la bienvenida. Sin esta pausa la corrida
      // simulada escribe la fila antes de que el lector la busque, y el caso no pasa por la espera (medido: verde roto).
      await new Promise((listo) => setTimeout(listo, 8_000));
    });
    ver(autoF2 != null && (await autoF2) === true, 'F2: la bienvenida a los 4,4 s, antes de la fila del envío, es automática', { auto: autoF2 && await autoF2, relojes });
    ver(esperoF2 >= 7_000, 'F2: y lo supo ESPERANDO la fila de la reclamada (no estaba cuando llegó)', { esperoF2 });
    ver(lista(await salidos(f2)) === '["m1"]', 'F2: le salió M1', await salidos(f2));
    ver((await fila(f2))?.estado === 'activa', 'F2: la fila sigue «activa»', await fila(f2));
    ver(!!(await enLaFicha(f2, 'Su mensaje llegó a los 4 s del primer mensaje de «')), 'F2: la ficha lo dice', await enLaFicha(f2, 'Su mensaje llegó'));

    // G. Contesta ENTRE LA LECTURA DEL LOTE Y EL MENSAJE (preexistente, la tercera revisión): ya le salió M1, el lote lo
    // trae en M2, y antes de que M2 salga contesta (`pausarPorRespuesta` + `alContestar`, que lo lleva a la rama «Contestó»).
    // Sin el reclamo, M2 salía igual con la fila del lote.
    const g = await nuevoLead('G', '+000000000319');
    await venceYCorre(g);
    ver(lista(await salidos(g)) === '["m1"]', 'G: le salió M1 y espera', await salidos(g));
    let contestoG = false;
    await venceYCorre(g, async (momento: string, insc: { lead_id: number; nodo_actual?: string | null }) => {
      if (momento !== 'antes' || insc.lead_id !== g || insc.nodo_actual !== 'm2' || contestoG) return;
      contestoG = true;
      await contesta(g);
    });
    ver(contestoG, 'G: el lote lo trajo en M2 y contestó antes de que saliera');
    ver(lista(await salidos(g)) === '["m1"]', 'G: M2 no salió (el reclamo vio que cambió)', await salidos(g));
    ver(await etiquetado(g), 'G: la rama «Contestó» corrió', await fila(g));
    await pasaElTiempo(g);
    ver(lista(await salidos(g)) === '["m1"]', 'G: no le salió nada más', await salidos(g));

    // H. El lead YA VENÍA HABLANDO (le escribió hace 10 minutos) y contesta a los 5 s de su primer mensaje: con actividad en
    // el chat no hay bienvenida de WhatsApp Business, así que cuenta (antes se la daba por automática por la hora).
    const h = await nuevoLead('H', '+000000000320');
    await entroHaceUnaHora(h);
    {
      const num = '000000000320';
      const { error } = await db.from('wa_mensajes').insert({
        instance_name: 'arnes-contesto', chat_jid: `${num}@s.whatsapp.net`, telefono: num, wa_message_id: `arnes-contesto-${h}-entrante`,
        from_me: false, tipo: 'text', texto: 'hola, llené el formulario (de prueba)', lead_id: h, wa_timestamp: isoMs(Date.now() - 600_000), raw: { arnes: 'contesto-corta' },
      });
      if (error) throw new Error(`el entrante de prueba: ${error.message}`);
    }
    await venceYCorre(h);
    ver(lista(await salidos(h)) === '["m1"]', 'H: le salió M1', await salidos(h));
    const t1H = (await filaDelEnvio((await fila(h)).id)) - 3_000;
    await primeraParte(h, '+000000000320', t1H);
    const autoH = await esRespuestaAutomaticaDelEntrante(h, isoMs(t1H + 5_000));
    ver(autoH === false, 'H: ya hablaban: a los 5 s cuenta como respuesta', autoH);
  } finally {
    if (secId != null) await db.from('nutricion_secuencias').update({ activa: false, archivada_at: new Date().toISOString() }).eq('id', secId);
    console.log(`automatización #${secId} pausada y archivada · envío de WhatsApp ${await envioWhatsappHabilitado()}`);
  }
});
console.log(fallos ? `\n${fallos} FALLAS` : '\nTODO VERDE');
process.exit(fallos ? 1 : 0);
