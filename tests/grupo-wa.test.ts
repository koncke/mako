// =============================================================================
// Traer los contactos de un grupo de WhatsApp al CRM (23/10/2026)
// =============================================================================
// Martín, en la llamada del 23/10 (min 37:27): «una automatización que te agrega de un grupo de WhatsApp, te pone todos los
// números y los contactos en tu CRM de manera automática». Esto prueba lo puro (lib/grupo-wa-reglas.ts) con la FORMA de las
// respuestas medidas en Evolution v2.3.7 el 23/10/2026 (números y nombres inventados), y el resto del camino más abajo.
//
// PROBADO ROMPIÉNDOLO (23/10/2026, arnés `romper-grupo.mjs` del scratchpad de la sesión de Offer, con api-mako-registro,
// confirmacion-terceros y crm-vincular-22-10; base 48/0, 21 de 21 cazadas): el teléfono del @lid y no de phoneNumber · traer
// a la línea misma · listar las comunidades · el id del grupo sin validar · ignorar las automatizaciones de todos los funnels ·
// ignorar las etiquetas vinculadas a la etapa · la etiqueta de más de 40 · crear con un número de dos leads · aceptar una etapa
// que manda · usar una línea que no es del negocio · importar sin ser admin · sin Prospección por defecto · un Tibio que manda
// por defecto · listar la línea de MaKo · aceptar un funnel ajeno · no etiquetar al que ya estaba · usar una etiqueta con
// automatización · no nombrar al que quedó en la entrada · la pantalla sin tope · no reencolar lo que cortó por tiempo · la API
// por WhatsApp. Cada una, 1 fallo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  esJidDeGrupo, etapaPorDefecto, etiquetaDeGrupo, funnelPorDefecto, gruposDeChats, gruposDeFetchAll, participantesDe, telefonoDeJid,
} from '../lib/grupo-wa-reglas';

test('1. los grupos de fetchAllGroups: nombre, tamaño, sin comunidades, ordenados', () => {
  const grupos = gruposDeFetchAll([
    { id: '120363000000000001@g.us', subject: 'Emprendedores', size: 900, isCommunity: false },
    { id: '120363000000000002@g.us', subject: 'Comunidad X', size: 3, isCommunity: true },
    { id: '120363000000000003@g.us', subject: '  ', size: 2 },
    { id: 'no-es-un-grupo', subject: 'Raro', size: 1 },
    { id: '5491100000000-1600000000@g.us', subject: 'agenda vieja' },
  ]);
  assert.deepEqual(grupos, [
    { jid: '5491100000000-1600000000@g.us', nombre: 'agenda vieja', tamano: null },
    { jid: '120363000000000001@g.us', nombre: 'Emprendedores', tamano: 900 },
    { jid: '120363000000000003@g.us', nombre: 'Grupo sin nombre', tamano: 2 },
  ]);
  assert.deepEqual(gruposDeFetchAll({ error: 'Connection Closed' }), [], 'un error no es una lista');
});

test('2. el respaldo: los grupos de la base de Evolution (findChats), sin repetidos y sin los chats de personas', () => {
  const grupos = gruposDeChats([
    { remoteJid: '120363000000000001@g.us', pushName: 'Emprendedores' },
    { remoteJid: '5491100000001@s.whatsapp.net', pushName: 'Ana' },
    { id: 'x', remoteJid: '120363000000000001@g.us', pushName: 'Emprendedores' },
    { remoteJid: '120363000000000004@g.us', name: 'Clientes' },
  ]);
  assert.deepEqual(grupos, [
    { jid: '120363000000000004@g.us', nombre: 'Clientes', tamano: null },
    { jid: '120363000000000001@g.us', nombre: 'Emprendedores', tamano: null },
  ]);
});

test('3. los participantes: el teléfono sale de phoneNumber (el id es un @lid), sin la línea misma y sin repetidos', () => {
  const r = participantesDe({ participants: [
    { id: '11111111111111@lid', phoneNumber: '5491100000001@s.whatsapp.net', name: 'Ana', admin: null },
    { id: '22222222222222@lid', phoneNumber: '5491100000002@s.whatsapp.net', admin: 'admin' },
    { id: '33333333333333@lid', admin: null },
    { id: '5491100000003@s.whatsapp.net', notify: 'Beto' },
    { id: '44444444444444@lid', phoneNumber: '5491100000001@s.whatsapp.net', name: 'Ana otra vez' },
    { id: '55555555555555@lid', phoneNumber: '5491199999999@s.whatsapp.net', name: 'La línea' },
  ] }, '+54 9 11 9999-9999');
  assert.deepEqual(r.participantes, [
    { telefono: '5491100000001', nombre: 'Ana' },
    { telefono: '5491100000002', nombre: null },
    { telefono: '5491100000003', nombre: 'Beto' },
  ]);
  assert.equal(r.sinNumero, 1, 'el que sólo trae un @lid no se trae: se cuenta');
  assert.equal(telefonoDeJid('11111111111111@lid'), null, 'un @lid no es un teléfono');
  assert.equal(telefonoDeJid('5491100000001:12@s.whatsapp.net'), '5491100000001', 'el sufijo de dispositivo no es parte del número');
});

test('4. lo que llega del navegador se valida, y la etiqueta de origen viene con el nombre del grupo', () => {
  assert.equal(esJidDeGrupo('120363000000000001@g.us'), true);
  assert.equal(esJidDeGrupo('5491100000000-1600000000@g.us'), true);
  for (const malo of ['120363@g.us/../x', 'x@g.us', '5491100000001@s.whatsapp.net', '', null, 3]) assert.equal(esJidDeGrupo(malo), false, String(malo));
  // La elige la persona («Formación de Jan», «Evento Cancún»); viene con el nombre del grupo, limpio.
  assert.equal(etiquetaDeGrupo('  Formación de   Jan '), 'Formación de Jan');
  assert.equal(etiquetaDeGrupo(''), 'Grupo de WhatsApp');
  // Entra en el tope de una etiqueta del CRM (40, `TOPE_NOMBRE_ETIQUETA`): más largo, se cortaba sin decirlo.
  assert.equal(etiquetaDeGrupo('x'.repeat(100)).length, 40);
});

test('4b. por defecto: el CRM «Prospección» si existe, y ahí «Tibio» si no manda nada', () => {
  const funnels = [{ id: 1, nombre: 'Funnel principal' }, { id: 5, nombre: 'CRM Prospección' }, { id: 9, nombre: 'Clientes' }];
  assert.equal(funnelPorDefecto(funnels, 9), 5);
  assert.equal(funnelPorDefecto([{ id: 5, nombre: 'prospeccion' }], 1), 5, 'sin tilde también');
  assert.equal(funnelPorDefecto(funnels.filter((f) => f.id !== 5), 9), 9, 'sin Prospección, el que se mira');
  const etapas = [
    { key: 'lead', label: 'Lead', manda: true }, { key: 'frio', label: 'Frío', manda: false },
    { key: 'tibio', label: 'Tibio', manda: false }, { key: 'caliente', label: 'Caliente', manda: false },
  ];
  assert.equal(etapaPorDefecto(etapas, 'frio'), 'tibio');
  assert.equal(etapaPorDefecto(etapas.map((e) => (e.key === 'tibio' ? { ...e, manda: true } : e)), 'frio'), 'frio', 'un Tibio que manda no se elige');
  assert.equal(etapaPorDefecto([], null), '');
});

test('5. qué etapas no se ofrecen: las que mandan algo solas (automatización de la etapa o etiqueta vinculada)', async () => {
  const { etapasQueDisparan } = await import('../lib/grupo-wa-reglas');
  const destino = { id: 7, esDefault: false };
  const defaults = new Map<number, boolean>([[7, false], [8, false], [1, true]]);
  const esDefaultDe = (id: number) => defaults.get(id) ?? null;
  const vistas = [
    { trigger_tipo: 'etapa_actual', etapa: 'lead', etapas: [], funnel_id: 7 },          // de este funnel: bloquea
    { trigger_tipo: 'etapa_actual', etapa: 'r1', etapas: ['r1', 'r2'], funnel_id: null }, // de todos: bloquea las dos
    { trigger_tipo: 'etapa_actual', etapa: 'nutri', etapas: [], funnel_id: 8 },         // de OTRO funnel: no
    { trigger_tipo: 'etiqueta_puesta', etapa: 'ganado', etapas: [], funnel_id: 7 },     // no cuelga de una etapa: no
    { trigger_tipo: 'etapa_actual', etapa: 'perdido', etapas: [], funnel_id: 99 },      // de un funnel que no se sabe: bloquea (de más, nunca de menos)
  ];
  const etiquetas = [
    { etapa_key: 'facturando', funnel_id: 7, archivada_at: null },   // vinculada a una etapa de este funnel: bloquea
    { etapa_key: 'cerrado', funnel_id: 8, archivada_at: null },      // de otro funnel: no
    { etapa_key: 'pausa', funnel_id: 7, archivada_at: '2026-10-01' }, // archivada: no
  ];
  assert.deepEqual([...etapasQueDisparan(vistas, etiquetas, destino, esDefaultDe)].sort(), ['facturando', 'lead', 'perdido', 'r1', 'r2']);
  // En el funnel del NEGOCIO, el lead nuevo vive con `funnel_id` NULL: lo alcanza la automatización del funnel default.
  const delNegocio = etapasQueDisparan([{ trigger_tipo: 'etapa_actual', etapa: 'lead', etapas: [], funnel_id: 1 }], [{ etapa_key: 'r1', funnel_id: null }], { id: 1, esDefault: true }, esDefaultDe);
  assert.deepEqual([...delNegocio].sort(), ['lead', 'r1']);
});

test('6. el camino: sólo el admin, la línea y el funnel del negocio, nada que mande, nunca duplicar, de a tandas', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
  const acciones = leer('app/crm/grupo-wa-actions.ts');
  const exportadas = [...acciones.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
  assert.equal(exportadas.length, 5);
  for (const f of exportadas) {
    const cuerpo = acciones.slice(acciones.indexOf(`export async function ${f}`));
    assert.match(cuerpo.slice(0, 600), /await exigirSesion\(\);\n {2}if \(\(await getRolWsEfectivo\(\)\) !== 'admin'\) return \{ ok: false, error: SOLO_ADMIN \};/, `${f}: sin la puerta del admin`);
  }
  const server = leer('app/crm/grupo-wa-server.ts');
  assert.doesNotMatch(server, /\/message\/|sendText|sendMedia|enrolarPorEvento|inscribirEnSecuencia/, 'el importador habla con algo que manda');
  // La revisión de privacidad (23/10/2026): la línea de MaKo está en el grupo de MaKo de cada cliente; un funnel ajeno no se usa.
  assert.match(server, /const lineas = await listarLineas\(\);/, 'las líneas, sólo las del negocio');
  assert.doesNotMatch(server, /lineasParaMandar\(/, 'lineasParaMandar suma la línea de MaKo');
  assert.match(server, /if \(!\(await listarFunnels\(\)\)\.some\(\(f\) => f\.id === funnelId\)\) throw new Error/, 'un funnel que no es del negocio');
  assert.match(server, /return lineas\.find\(\(l\) => l\.linea === linea\) \?\? null;/, 'una línea pedida que no es del negocio no se usa');
  assert.match(server, /const leidos = await participantesDelGrupo\(p\.linea, p\.jid\);[\s\S]{0,400}leidos\.participantes\.filter\(\(x\) => pedidos\.has\(x\.telefono\)\)/, 'lo del navegador sólo ELIGE entre los participantes leídos de nuevo');
  assert.match(server, /if \(destino\.manda\) return \{ ok: false, error:/, 'el server acepta una etapa que manda');
  assert.match(server, /if \(existente === null\) \{ salteados\+\+; continue; \}/, 'un número compartido por dos leads se saltea');
  assert.match(server, /await agregarAProducto\(existente, p\.funnelId, \{ autor: p\.autor, etapa: p\.etapa \}\);[\s\S]{0,400}traidos\.push\(existente\);/, 'el que ya es lead se SUMA (y se etiqueta: dos grupos, dos etiquetas)');
  assert.match(server, /origen_lead: ORIGEN_LEAD\.grupo_whatsapp\.id/, 'nace con su origen: es lo que lo deja quieto (test 7)');
  assert.match(server, /const r = await ponerEtiquetaLote\(ids, id, \{ autor \}\);/, 'la etiqueta en LOTE (no dispara)');
  assert.match(server, /const origen = await etiquetaDeOrigen\([^\n]*\);\n {2}if \(!origen\.ok\) return origen;[\s\S]{0,1200}for \(const \[i, x\] of quienes\.entries\(\)\)/, 'la etiqueta se mira ANTES de traer a nadie');
  assert.match(server, /if \(secuenciasDeEtiqueta\(vistas, e\.id\)\.length\) return \{ ok: false,/, 'una etiqueta con automatización: el barrido inscribe al grupo');
  assert.match(acciones, /hasta: Date\.now\(\) \+ 45_000,/, 'con tope también desde la pantalla');
  const pantalla = leer('app/crm/TraerDeGrupoWA.tsx');
  assert.match(pantalla, /const tanda = cola\.splice\(0, TANDA_GRUPO\);/, 'de a tandas');
  assert.match(pantalla, /if \(r\.pendientes\.length >= tanda\.length\) \{[^}]*break; \}\n {6}cola\.unshift\(\.\.\.r\.pendientes\);/, 'lo que cortó por tiempo vuelve a la cola (y sin avance, para)');
  assert.match(pantalla, /const usables = etapas\.filter\(\(e\) => !e\.manda\);/, 'las etapas que mandan no se ofrecen');
  assert.match(pantalla, /\{!!gente\?\.length && \(\n\s*<span[^\n]*>\n\s*\{\[\n\s*'No les manda nada\.',/, 'la pantalla lo dice, siempre');
  assert.match(leer('app/crm/CrmBoard.tsx'), /\.\.\.\(puedeCrearCrm \? \{ onTraerGrupo: \(\) => setNuevoLead\(\{ \.\.\.nuevoLead, traer: 'grupo' \}\) \} : \{\}\),/, 'sólo el admin ve la opción');
  // La API de MaKo: admin, SÓLO en la app (por WhatsApp el rol es siempre 'admin'), por chat, y corta a tiempo.
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const ops = def.slice(def.indexOf("id: 'grupos_whatsapp'"), def.indexOf("id: 'ver_cobro_etapa'"));
  assert.ok(ops.includes("id: 'traer_contactos_de_grupo'"), 'las dos, antes de los cobros');
  assert.match(ops.slice(ops.indexOf("id: 'traer_contactos_de_grupo'")), /confirmacion: 'chat'/);
  assert.equal([...ops.matchAll(/canales: \['app'\], costo: 'gratis', gating: TAB_ADMIN,/g)].length, 2, 'las dos, sólo en la app');
  const run = leer('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /telefonos: 'todos', autor: autorDe\(ctx\), hasta: Date\.now\(\) \+ 45_000,\n {8}etiqueta:/);
  assert.match(run, /if \(!funnels\.some\(\(f\) => f\.id === funnelId\)\) return \{ error:/, 'la API, tampoco un funnel ajeno');
});

test('7. el traído de un grupo QUEDA DONDE LO PUSIERON: ni el CRM automático ni los barridos que mandan solos', async () => {
  // El Cerebro, 23/10/2026, con la regla de Martín «nada por detrás»: no entra a nutri ni a reactivación por su cuenta.
  // PROBADO ROMPIÉNDOLO (arnés `romper-grupo2.mjs`, con crm-auto-plan y crm-origen-lead; base 33/0, 10 de 10): nadie queda
  // quieto · nace como importado de un archivo · T2 lo manda a nutri · T6 a reactivación · T1 también lo deja (de más) · el
  // CRM automático no lee el origen · la reactivación lo toma · el último intento lo toma · la pantalla no lo dice · la ficha
  // dice «Sin dato de origen». Cada una, en rojo.
  const { planLeadAuto } = await import('../lib/crm-auto-plan');
  const { quedaDondeLoPusieron, origenLista } = await import('../app/crm/origen-lead');
  const { canalDeEntrada } = await import('../app/crm/lead-view/ficha/resumen/logica');
  const HOY = '2026-07-05';
  const NOW = Date.parse('2026-07-05T20:00:00Z');
  const haceDias = (n: number) => new Date(Date.UTC(2026, 6, 5) - n * 86400000).toISOString();
  const lead = (p: Record<string, unknown>) => ({
    id: 1, nombre: 'Ana', estado_lead: 'abierto' as const, pipeline_stage: null, fecha_agenda: null, fecha_junta_1: null,
    fecha_junta_2: null, junta_1_at: null, junta_2_at: null, asistio_j1: null, asistio_j2: null, nutricion_realizada: false,
    nutricion_manual_deadline: null, created_at: haceDias(3), updated_at: null, ...p,
  });
  const reglas = (l: ReturnType<typeof lead>) => planLeadAuto(l as never, HOY, NOW).map((a) => `${a.regla}:${a.move?.to ?? ''}`);
  // T2: tres días sin agendar → a nutri; frío → a reactivación. Al importado de un ARCHIVO, sí; al del grupo, no.
  assert.deepEqual(reglas(lead({ origen_lead: 'importacion' })), ['T2:nutri']);
  assert.deepEqual(reglas(lead({ origen_lead: 'grupo_whatsapp' })), []);
  assert.deepEqual(reglas(lead({ origen_lead: 'grupo_whatsapp', created_at: haceDias(40) })), []);
  // T6: «No responde» hace 60 días → a reactivación. Al del grupo, no.
  const frio = { estado_lead: 'no_responde' as const, pipeline_stage: 'noresp', updated_at: haceDias(60) };
  assert.deepEqual(reglas(lead({ ...frio, origen_lead: null })), ['T6:reactivacion']);
  assert.deepEqual(reglas(lead({ ...frio, origen_lead: 'grupo_whatsapp' })), []);
  // T1 sí: mira una reunión que ÉL agendó (no lo mueve a una etapa que le escribe).
  const conReunion = { fecha_agenda: '2026-07-01', fecha_junta_1: '2026-07-01', junta_1_at: '2026-07-01T15:00:00Z' };
  assert.deepEqual(reglas(lead({ ...conReunion, origen_lead: 'grupo_whatsapp' })), ['T1:']);
  assert.equal(quedaDondeLoPusieron('grupo_whatsapp'), true);
  for (const otro of ['importacion', 'chat_whatsapp', null, undefined, '']) assert.equal(quedaDondeLoPusieron(otro), false, String(otro));
  assert.equal(origenLista('grupo_whatsapp'), 'Grupo de WhatsApp');
  assert.equal(canalDeEntrada('grupo_whatsapp').texto, 'Traído de un grupo de WhatsApp');

  // El CRM automático LEE el origen (sin la columna, `origen_lead` llega undefined y lo movía igual), y los dos barridos
  // que no cuelgan de una etapa ni de una etiqueta lo filtran.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
  assert.match(leer('lib/crm-auto.ts'), /const AUTO_COLS =\n\s*'[^']*\borigen_lead\b[^']*';/);
  const nutri = leer('lib/nutricion.ts');
  for (const trigger of ['reactivacion_viejo', 'ultimo_intento_antes_noresp']) {
    const rama = nutri.slice(nutri.indexOf(`if (triggerTipo === '${trigger}')`), nutri.indexOf(`if (triggerTipo === '${trigger}')`) + 700);
    assert.match(rama, /'id, origen_lead'[\s\S]*\.filter\(\(r\) => !quedaDondeLoPusieron\(r\.origen_lead\)\)\.map\(\(r\) => r\.id\);/, `${trigger}: toma a los del grupo`);
  }
});

test('8. la revisión de privacidad del 23/10: nace en su etapa, sin terminales, y sin su foto en el bucket público', async () => {
  // PROBADO ROMPIÉNDOLO (arnés `romper-grupo3.mjs`; base 9/0, 8 de 8): nace en la entrada · createLead ignora la etapa · vuelve
  // a moverlo después · el texto de la base a la pantalla · la pantalla no los nombra · ofrece Ganado y las terminales · la foto
  // de los traídos al bucket público · el cron de fotos no lee el origen. Cada una, en rojo.
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
  const server = leer('app/crm/grupo-wa-server.ts');
  // H1: el lead NACE en la etapa elegida. Nacer en la entrada y moverlo después dejaba una ventana para «Un Lead Entró».
  assert.match(server, /const lead = await createLead\(\{\n[^\n]*origen_lead: ORIGEN_LEAD\.grupo_whatsapp\.id,\n {8}pipeline_stage: p\.etapa,\n {6}\}\);/);
  assert.doesNotMatch(server, /setPipelineStage/, 'nada de moverlo después');
  assert.match(leer('lib/leads.ts'), /\.\.\.\(input\.pipeline_stage\?\.trim\(\) \? \{ pipeline_stage: input\.pipeline_stage\.trim\(\) \} : \{\}\),/, 'createLead escribe la etapa que le piden');
  assert.match(server, /errores\.push\(x\.nombre \?\? \x60\+\$\{x\.telefono\}\x60\);/, 'el que falló, por su nombre (sin el texto de la base)');
  assert.match(leer('app/crm/TraerDeGrupoWA.tsx'), /const fallidos = errores\.length \? \x60 No se pudieron: \$\{errores\.slice\(0, 5\)\.join\(', '\)\}/, 'la pantalla los nombra');
  // H2: las terminales (Ganado, Perdido, Descalificado, No responde) no se ofrecen ni se aceptan.
  assert.match(server, /manda: manda\.has\(e\.key\) \|\| terminalEstadoFor\(e\.key\) !== 'abierto' \}\)\);/);
  const { terminalEstadoFor } = await import('../lib/pipeline');
  for (const k of ['ganado', 'perdido', 'descal', 'noresp']) assert.notEqual(terminalEstadoFor(k), 'abierto', k);
  assert.equal(terminalEstadoFor('tibio'), 'abierto');
  // H3: el cron de fotos no copia al bucket público la foto de quien nunca le habló al negocio.
  const fotos = leer('lib/fotos-contacto.ts');
  assert.match(fotos, /'id, telefono, foto_auto_at, foto_auto_url, origen_lead'/);
  assert.match(fotos, /leadsParaGuardarFoto\(leads\.filter\(\(l\) => !quedaDondeLoPusieron\(l\.origen_lead\)\), fotos, ahora\)/);
});
