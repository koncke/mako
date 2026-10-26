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
  conNombresConocidos, esJidDeGrupo, esNombreDeRelleno, etapaPorDefecto, etiquetaDeGrupo, funnelPorDefecto, gruposDeChats, gruposDeFetchAll,
  lineaDePerfil, nombreUtil, parcheDePerfil, participantesDe, perfilDeEmpresa, telefonoDeJid,
  SEGUNDOS_POR_PERFIL, TOPE_PERFILES_DIA, TOPE_VISTOS, cuantosEstaCorrida, cupoDeHoy, minutosDePerfiles, quedanHoy,
  vistosConNuevos, vistosDe,
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
  // Con su @lid (24/10/2026): la agenda de la línea guarda a muchos contactos por ahí, y de ahí sale el nombre (test 9).
  assert.deepEqual(r.participantes, [
    { telefono: '5491100000001', nombre: 'Ana', lid: '11111111111111@lid' },
    { telefono: '5491100000002', nombre: null, lid: '22222222222222@lid' },
    { telefono: '5491100000003', nombre: 'Beto', lid: null },
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
  assert.equal(exportadas.length, 8, 'una acción nueva: que tenga la puerta del admin (y sumala acá)');
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
  assert.match(server, /if \(existente === null\) \{ salteados\+\+; return; \}/, 'un número compartido por dos leads se saltea');
  // Desde el 24/10 (Martín: «si ... detecta que esos números ya están, no me debe cargar nuevamente»), el que ya es lead NO SE
  // TOCA: ni se suma a este funnel ni se etiqueta. Reemplaza la regla del 23/10 («dos grupos, dos etiquetas»).
  assert.match(server, /if \(existente !== undefined\) \{ yaEstaban\+\+; return; \}/, 'el que ya es lead se vuelve a cargar');
  const traerSrv = server.slice(server.indexOf('export async function traerDelGrupo('), server.indexOf('export async function etiquetaDeOrigen(')).replace(/^\s*\/\/.*$/gm, ''); // el código, sin los comentarios
  assert.doesNotMatch(traerSrv, /agregarAProducto|traidos\.push\(existente\)/, 'el que ya estaba se suma al funnel o se etiqueta');
  assert.match(server, /origen_lead: ORIGEN_LEAD\.grupo_whatsapp\.id/, 'nace con su origen: es lo que lo deja quieto (test 7)');
  assert.match(server, /const r = await ponerEtiquetaLote\(ids, id, \{ autor \}\);/, 'la etiqueta en LOTE (no dispara)');
  assert.match(server, /const origen = await etiquetaDeOrigen\([^\n]*\);\n {2}if \(!origen\.ok\) return origen;[\s\S]{0,4000}for \(let i = 0; i < quienes\.length; i \+= PARALELO\)/, 'la etiqueta se mira ANTES de traer a nadie');
  // De a cuatro a la vez desde el 25/10/2026 (medido: ~135 ms por lead, uno detrás del otro), con el tope de tiempo entre cada cuatro.
  assert.match(server, /if \(p\.hasta != null && Date\.now\(\) > p\.hasta\) \{ pendientes = quienes\.slice\(i\)\.map\(\(q\) => q\.telefono\); break; \}\n {4}await Promise\.all\(quienes\.slice\(i, i \+ PARALELO\)\.map\(uno\)\);/);
  assert.match(server, /if \(secuenciasDeEtiqueta\(vistas, e\.id\)\.length\) return \{ ok: false,/, 'una etiqueta con automatización: el barrido inscribe al grupo');
  assert.match(acciones, /hasta: Date\.now\(\) \+ 45_000,/, 'con tope también desde la pantalla');
  const pantalla = leer('app/crm/TraerDeGrupoWA.tsx');
  assert.match(pantalla, /const tanda = cola\.splice\(0, TANDA_GRUPO\);/, 'de a tandas');
  assert.match(pantalla, /if \(r\.pendientes\.length >= tanda\.length\) \{[^}]*break; \}\n {6}cola\.unshift\(\.\.\.r\.pendientes\);/, 'lo que cortó por tiempo vuelve a la cola (y sin avance, para)');
  assert.match(pantalla, /const usables = etapas\.filter\(\(e\) => !e\.manda\);/, 'las etapas que mandan no se ofrecen');
  assert.match(pantalla, /\{ texto: 'No les manda nada', tono: 'gris' as const \},/, 'la pantalla lo dice, siempre');
  assert.match(leer('app/crm/CrmBoard.tsx'), /\.\.\.\(puedeCrearCrm \? \{ onTraerGrupo: \(\) => setNuevoLead\(\{ \.\.\.nuevoLead, traer: 'grupo' \}\) \} : \{\}\),/, 'sólo el admin ve la opción');
  // La API de MaKo: admin, SÓLO en la app (por WhatsApp el rol es siempre 'admin'), por chat, y corta a tiempo.
  const def = leer('lib/api-mako/areas/crm.def.ts');
  const ops = def.slice(def.indexOf("id: 'grupos_whatsapp'"), def.indexOf("id: 'ver_cobro_etapa'"));
  assert.ok(ops.includes("id: 'traer_contactos_de_grupo'"), 'las dos, antes de los cobros');
  assert.match(ops.slice(ops.indexOf("id: 'traer_contactos_de_grupo'")), /confirmacion: 'chat'/);
  // 25/10/2026: la cuarta es `ver_completar_desde_whatsapp` (el avance de «Completar desde mi WhatsApp», crm-ext-2510).
  assert.equal([...ops.matchAll(/canales: \['app'\], costo: 'gratis', gating: TAB_ADMIN,/g)].length, 4, 'las cuatro (con completar_nombres_de_grupo y ver_completar_desde_whatsapp), sólo en la app');
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
  // ⚠️ lib/leads IMPORTA LeadDuplicadoError pero no la reexporta: importada de ahí llegaba undefined (sin tsc no se ve), y
  // `e instanceof undefined` tiraba TypeError con cada participante que ya era lead (lo encontró Integración, 4f8b121b1).
  assert.match(server, /^import \{ LeadDuplicadoError \} from '@\/lib\/leads-duplicados';$/m);
  assert.doesNotMatch(server, /^import \{[^}]*LeadDuplicadoError[^}]*\} from '@\/lib\/leads';$/m);
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

// ── 24/10/2026: los nombres. Martín trajo un grupo de 221 y no vino «el nombre de nadie». MEDIDO en su línea: el listado de
// participantes NO trae nombres (sólo `id` @lid, `phoneNumber` y `admin`): no se tiraba nada. El nombre sale de lo que WhatsApp
// YA conoce sin preguntarle a la red, y los que no, se completan después («Completar nombres»).
// Roturas (base 10/0 en este archivo): el nombre de la agenda sin mirar el @lid → cae el 9; «Completar» pisando un nombre de
// verdad (sin `esNombreDeRelleno`) → cae el 10; la escritura sin comparar → cae el 10; la vista sin `VistaConPie` → cae el 10.

test('9. el nombre que WhatsApp ya conoce: el del listado, si no el de la agenda (por teléfono o por @lid), si no el nuestro', () => {
  const ps = [
    { telefono: '5491100000001', nombre: 'Ana', lid: '1@lid' },
    { telefono: '5491100000002', nombre: null, lid: '2@lid' },
    { telefono: '5491100000003', nombre: null, lid: '3@lid' },
    { telefono: '5215500000004', nombre: null, lid: null },
    { telefono: '5491100000005', nombre: null, lid: '5@lid' },
  ];
  const agenda = [
    { remoteJid: '5491100000001@s.whatsapp.net', nombre: 'Ana de la agenda' },
    { remoteJid: '5491100000002@s.whatsapp.net', nombre: 'Beto' },
    { remoteJid: '3@lid', nombre: 'Caro 🌸' },
    { remoteJid: '5@lid', nombre: '.' },
  ];
  const guardados = new Map([['5500000004', 'Dani'], ['1100000005', '+54 9 11 0000 0005']]);
  const r = conNombresConocidos(ps, agenda, guardados);
  assert.deepEqual(r.map((p) => p.nombre), ['Ana', 'Beto', 'Caro 🌸', 'Dani', null]);
  assert.equal(ps[1].nombre, null, 'tocó los participantes que recibió');
  // Un nombre que sirve tiene alguna letra: ni un número, ni un punto, ni el «Você» de la línea misma.
  for (const malo of ['', '   ', '.', '+54 9 11 1234', '🙂', 'Você', null, 7]) assert.equal(nombreUtil(malo), null, String(malo));
  assert.equal(nombreUtil('  María José  '), 'María José');
  assert.equal(nombreUtil('x'.repeat(200))?.length, 80);
  // Lo de relleno (lo único que «Completar nombres» pisa): vacío o sin letras.
  for (const relleno of [null, '', '+5491100000002', '5491100000002', '.', '🙂']) assert.equal(esNombreDeRelleno(relleno), true, String(relleno));
  for (const deVerdad of ['Ana', 'Dr. Pérez', 'Juan 2']) assert.equal(esNombreDeRelleno(deVerdad), false, deVerdad);
});

test('10. «Completar nombres»: a los que YA están, sólo el nombre de relleno, comparando antes de escribir; y el pie no flota', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
  const server = leer('app/crm/grupo-wa-server.ts');
  // Los nombres entran en el MISMO lugar que lee todo el camino (la pantalla, traer y la API), sin tráfico a la red.
  assert.match(server, /const v: Leidos = \{ ok: true, linea: l\.linea, participantes: await nombresConocidos\(l\.linea, participantes\), sinNumero \};/);
  assert.match(server, /fetchContactosEvolution\(linea\)\.catch\(\(\) => \[\]\),\n\s+getNombresContacto\(\)\.catch\(/, 'si una lectura falla, traer no se frena');
  const completar = server.slice(server.indexOf('export async function completarNombresDelGrupo('), server.indexOf('export async function marcarEnElCrm('));
  assert.ok(completar.length > 200, 'no encontré completarNombresDelGrupo');
  assert.doesNotMatch(completar, /createLead|agregarAProducto|ponerEtiquetaLote|setPipelineStage|updateLead|\/message\//, 'completar crea, mueve o manda algo');
  assert.match(completar, /if \(!esNombreDeRelleno\(antes\)\) \{ yaTenian\+\+; continue; \}/, 'pisa un nombre que escribió una persona');
  assert.match(completar, /if \(typeof id === 'number'\) porLead\.set\(id, x\.nombre\); else fuera\+\+;/, 'un número de dos leads: no se adivina');
  assert.match(completar, /await completarNombreDeRelleno\(id, antes, nombre, p\.autor\)/);
  // La escritura: sólo el nombre, comparando con el que había, y queda en el historial como «Nombre» (se deshace desde ahí).
  const leads = leer('lib/leads.ts');
  const esc = leads.slice(leads.indexOf('export async function completarNombreDeRelleno('), leads.indexOf('/** Historial de cambios de un lead'));
  assert.match(esc, /db\.from\('leads'\)\.update\(\{ nombre \}\)/);
  assert.match(esc, /antes == null \? base\.eq\('id', id\)\.is\('nombre', null\) : base\.eq\('id', id\)\.eq\('nombre', antes\)/, 'escribe sin comparar');
  assert.match(esc, /campo: 'Nombre', valor_anterior: antes, valor_nuevo: nombre, autor/);
  // La pantalla: el botón aparece con gente que ya está, y la vista usa la pieza del pie (el que flotaba, 24/10/2026).
  const pantalla = leer('app/crm/TraerDeGrupoWA.tsx');
  // Desde la 0.70 de la extensión, con la extensión el camino es «Completar desde mi WhatsApp» (tests/wa-fichas-extension.test.ts).
  // Sin ella, «Completar nombres» ya NO corre este camino del server (25/10/2026, f12 de la llamada con Leandro: «ese botón te
  // debería decir instala la extensión de Maco y que ahí directamente comience»): lo fija tests/crm-completar-con-extension.test.ts.
  // En el «⋯» del molde desde el 24/10/2026 (sólo con gente que ya está y sin nada corriendo).
  assert.match(pantalla, /\.\.\.\(extWa !== 'si' \? \[\{ id: 'nombres', texto: 'Completar nombres', icono: 'persona' as const, onElegir: completarNombres \}\] : \[\]\),/);
  assert.match(pantalla, /const mas: OpcionMas\[\] = trayendo \|\| !yaEstan \? \[\] : \[/);
  assert.doesNotMatch(pantalla, /completarNombresDeGrupoAction/, 'la pantalla volvió al camino que completaba «algunos o ninguno» sin decir por qué');
  assert.match(pantalla, /<MoldeTraer\b/);
  assert.doesNotMatch(pantalla, /position: 'sticky', bottom: 0/, 'el pie volvió a armarse a mano: flota (ver app/_ui/VistaConPie.tsx)');
  // Una línea sin conectar (una segunda a medio conectar queda «conectando» en la base) se dice, y no se elige si hay otra.
  assert.match(pantalla, /setLinea\(\(r\.lineas\.find\(\(l\) => l\.conectada\) \?\? r\.lineas\[0\]\)\?\.linea \?\? null\);/);
  assert.match(pantalla, /label: l\.conectada \? l\.etiqueta : `\$\{l\.etiqueta\} · sin conectar`/);
  // La API de MaKo, la misma regla: propone con números y no repite lo que ya está.
  const run = leer('lib/api-mako/areas/crm.run.ts');
  assert.match(run, /const c = await completarNombresDelGrupo\(\{ linea: g\.linea, jid: grupo\.jid, autor: '', soloContar: true \}\);/);
  assert.match(run, /if \(!c\.completados\) return \{ error: [^\n]*, yaEstaba: true \};/);
});

// ── 24/10/2026: los datos de EMPRESA. Martín mostró la ficha de un participante: cuenta de empresa con rubro, correo, web y
// dirección. MEDIDO: el perfil (`/chat/fetchBusinessProfile`) trae eso a veces, y nunca el nombre del negocio.
// Roturas (base 12/0): la web que toma el link de Instagram → cae el 11; el parche que pisa un campo lleno → cae el 11; el
// server sin la espera entre consultas → cae el 12; la escritura sin comparar que siga vacío → cae el 12.

test('11. el perfil de empresa: web, Instagram, correo y dirección, sólo si es empresa, y sólo en lo vacío', () => {
  assert.equal(perfilDeEmpresa({ isBusiness: false, website: ['https://x.com'] }), null, 'una cuenta personal no trae nada');
  assert.equal(perfilDeEmpresa(null), null);
  const p = perfilDeEmpresa({
    isBusiness: true, wid: '1@s.whatsapp.net', category: 'Agencia de publicidad', description: 'Diseño y marketing',
    website: ['https://www.instagram.com/booompr', 'https://facebook.com/booom', 'https://www.booompr.com'],
    email: 'roberto@booompr.com', address: 'Calle Isabel #44', business_hours: {},
  })!;
  assert.deepEqual(p, { rubro: 'Agencia de publicidad', descripcion: 'Diseño y marketing', web: 'https://www.booompr.com', instagram: 'booompr', email: 'roberto@booompr.com', direccion: 'Calle Isabel #44' });
  // Sin web propia: ni Instagram ni Facebook pasan por web. El Instagram también sale de la descripción.
  const q = perfilDeEmpresa({ isBusiness: true, category: 'Coach', website: [], description: 'Sígueme en instagram.com/ana.coach', email: 'no es un correo' })!;
  assert.deepEqual([q.web, q.instagram, q.email], [null, 'ana.coach', null]);
  assert.equal(perfilDeEmpresa({ isBusiness: true, website: ['https://instagram.com/p/abc'] })!.instagram, null, 'un posteo no es una cuenta');
  // Sólo lo vacío: un campo que escribió una persona no se pisa.
  assert.deepEqual(parcheDePerfil({ web: 'https://mia.com', instagram: '', email: null }, p), { instagram: 'booompr', email: 'roberto@booompr.com', direccion: 'Calle Isabel #44' });
  assert.equal(lineaDePerfil(p), 'Perfil de empresa en WhatsApp: Agencia de publicidad · Diseño y marketing');
  assert.equal(lineaDePerfil({ rubro: null, descripcion: null, web: null, instagram: null, email: null, direccion: null }), null);
});

test('12. «Datos de empresa»: a los que ya están, de a uno y despacio, comparando antes de escribir; con la cuenta y la pregunta antes', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const leer = (r: string) => readFileSync(join(__dirname, '..', r), 'utf8').replace(/\r\n/g, '\n');
  const server = leer('app/crm/grupo-wa-server.ts');
  // El grupo arma los candidatos (UN lead por teléfono) y delega en el NÚCLEO, el mismo del lote del tablero.
  const g = server.slice(server.indexOf('export async function completarPerfilesDelGrupo('));
  assert.match(g.slice(0, g.indexOf('\n}\n')), /return completarPerfiles\(\{ linea: leidos\.linea, candidatos: conLead, autor: p\.autor, hechas: p\.hechas, saltear: p\.saltear, hasta: p\.hasta, soloContar: p\.soloContar \}\);/, 'el grupo no le pasa al núcleo el tope de la corrida, los salteados o el techo de tiempo');
  assert.match(g.slice(0, g.indexOf('\n}\n')), /typeof id === 'number' \? \[\{ telefono: x\.telefono, id \}\] : \[\]/, 'un número de dos leads: no se adivina');
  const f = server.slice(server.indexOf('export async function completarPerfiles('));
  const cuerpo = f.slice(0, f.indexOf('\n}\n'));
  assert.doesNotMatch(cuerpo, /createLead|agregarAProducto|ponerEtiquetaLote|setPipelineStage|updateLead|\/message\//, 'crea, mueve o manda algo');
  assert.match(cuerpo, /if \(i > 0\) await new Promise\(\(r\) => setTimeout\(r, ESPERA_PERFIL_MS\)\);/, 'sin espera entre consultas: tráfico seguido en la red de la línea');
  assert.match(cuerpo, /if \(p\.hasta != null && Date\.now\(\) \+ ESPERA_PERFIL_MS \+ TOPE_PERFIL_MS > p\.hasta\) \{ sigue = true; break; \}/, 'sin corte por tiempo (con lugar para la peor vuelta)');
  assert.match(cuerpo, /await completarCamposVacios\(id, parcheDePerfil\(/);
  assert.match(cuerpo, /if \(escritos\.length\) \{[\s\S]*?logLeadEvent\(id, 'Perfil de WhatsApp', linea, p\.autor\)/, 'la línea del historial se repite al volver a correr');
  const leads = leer('lib/leads.ts');
  const esc = leads.slice(leads.indexOf('export async function completarCamposVacios('), leads.indexOf('/** Historial de cambios de un lead'));
  assert.match(esc, /\.update\(\{ \[campo\]: valor \}\)\.eq\('id', id\)\.or\(`\$\{campo\}\.is\.null,\$\{campo\}\.eq\.`\)/, 'escribe sin comparar que siga vacío');
  // EL TOPE (el Cerebro, 24/10): por corrida y por DÍA, el del día reservado en el server ANTES de cada consulta; la cuenta sale
  // antes de consultar; el que ya contestó no se repite y el que no contestó no queda como consultado.
  assert.match(cuerpo, /if \(p\.soloContar\) return \{ ok: true, \.\.\.cuenta,/, 'la cuenta de la pregunta consulta perfiles');
  assert.ok(cuerpo.indexOf('if (p.soloContar) return') < cuerpo.indexOf('fetchBusinessProfile'), 'la cuenta tiene que salir antes de cualquier consulta');
  assert.match(cuerpo, /if \(!\(await reservarPerfil\(p\.linea, hoy\)\)\) \{ corte = 'dia'; break; \}\n\s+const \{ telefono, id \} = ahora\[i\];\n\s+revisados\+\+;\n\s+const r = await ev\(`\/chat\/fetchBusinessProfile/, 'consulta sin reservar el cupo del día antes');
  assert.match(cuerpo, /const estaCorrida = cuantosEstaCorrida\(\{ pendientes: ahora\.length, quedanHoy: quedan \}\);/);
  assert.match(cuerpo, /for \(let i = 0; i < estaCorrida; i\+\+\)/, 'el bucle no respeta el tope de la corrida');
  assert.match(cuerpo, /const faltan = conLead\.filter\(\(x\) => !vistos\.has\(x\.telefono\.slice\(-10\)\)\);/, 'vuelve a consultar a los que ya contestaron');
  assert.match(cuerpo, /if \(r == null\) \{ sinRespuesta\.push\(telefono\.slice\(-10\)\); continue; \}\n\s+nuevos\.push\(/, 'lo que no contestó quedó como consultado');
  const reservar = server.slice(server.indexOf('async function reservarPerfil('), server.indexOf('export async function completarPerfilesDelGrupo('));
  assert.match(reservar, /await cambiarSettingSi\(claveCupo\(linea\), raw, JSON\.stringify\(\{ dia: hoy, usadas: c\.usadas \+ 1 \}\)\)/, 'el cupo sin compare-and-set: dos corridas a la vez se pasan del tope');
  assert.match(reservar, /if \(quedanHoy\(c\) <= 0\) return false;/);
  // La pantalla: primero la cuenta, la pregunta con la cuenta y el tiempo, «Parar», y sigue sumando `hechas`.
  const pantalla = leer('app/crm/TraerDeGrupoWA.tsx');
  assert.match(pantalla, /onElegir: \(\) => void contarPerfiles\(\)/);
  assert.match(pantalla, /completarPerfilesDeGrupoAction\(\{ linea, jid, soloContar: true \}\)/);
  assert.match(pantalla, /<Confirm tone="primary" title="¿Traer los datos de empresa\?"/);
  // Cuántos y cuánto tarda, CORTO desde el 25/10/2026 (f13: «el texto muy largo. No me gustan textos largos»): el texto
  // ejecutado está en tests/enriquecer-lote.test.ts (6).
  assert.match(pantalla, /message=\{preguntaDePerfiles\(cuentaPerfiles, minutosDePerfiles\(cuentaPerfiles\.estaCorrida\)\)\}/, 'la pregunta no dice cuántos ni cuánto tarda');
  assert.match(pantalla, /await correrPerfiles\(cuenta, \(hechas, saltear\) => completarPerfilesDeGrupoAction\(\{ linea, jid, hechas, saltear \}\), \{/);
  assert.match(pantalla, /: perfilando \? \{ texto: 'Parar', onClick: \(\) => void contarPerfiles\(\) \} : undefined;/);
});

test('12b. el cupo de los perfiles: por día, por corrida, y los ya consultados no se repiten', () => {
  const hoy = '2026-10-24';
  assert.deepEqual(cupoDeHoy(null, hoy), { dia: hoy, usadas: 0 });
  assert.deepEqual(cupoDeHoy('{"dia":"2026-10-24","usadas":37}', hoy), { dia: hoy, usadas: 37 });
  assert.deepEqual(cupoDeHoy('{"dia":"2026-10-23","usadas":120}', hoy), { dia: hoy, usadas: 0 }, 'el de ayer no cuenta hoy');
  assert.deepEqual(cupoDeHoy('no es json', hoy), { dia: hoy, usadas: 0 });
  assert.deepEqual(cupoDeHoy('{"dia":"2026-10-24","usadas":-3}', hoy), { dia: hoy, usadas: 0 });
  assert.equal(quedanHoy({ dia: hoy, usadas: 100 }), TOPE_PERFILES_DIA - 100);
  assert.equal(quedanHoy({ dia: hoy, usadas: TOPE_PERFILES_DIA + 5 }), 0);
  // Esta corrida: TODO lo que falta, hasta lo que queda hoy. Sin tope por corrida desde el 25/10/2026 (f14 de la llamada con
  // Leandro: «no debería volver a tocar nada»): el de 40 sólo partía el trabajo; lo que cuida la línea es el del día.
  assert.equal(cuantosEstaCorrida({ pendientes: 221, quedanHoy: 120 }), 120);
  assert.equal(cuantosEstaCorrida({ pendientes: 221, quedanHoy: 7 }), 7);
  assert.equal(cuantosEstaCorrida({ pendientes: 3, quedanHoy: 120 }), 3);
  assert.equal(cuantosEstaCorrida({ pendientes: 90, quedanHoy: 120 }), 90, 'volvió el tope por corrida: «vuelve a tocar para seguir»');
  assert.equal(cuantosEstaCorrida({ pendientes: 221, quedanHoy: 0 }), 0);
  assert.equal(TOPE_PERFILES_DIA, 120, 'el tope del día cuida la línea de un baneo: no se mueve sin medir');
  // Los ya consultados: sin repetir, los nuevos al final, recortado a los más recientes.
  assert.deepEqual([...vistosDe('["1155550001","x",7,"1155550002"]')], ['1155550001', '1155550002']);
  assert.deepEqual([...vistosDe('roto')], []);
  assert.deepEqual(JSON.parse(vistosConNuevos('["1155550001","1155550002"]', ['1155550001', '1155550003'])), ['1155550002', '1155550001', '1155550003']);
  const muchos = JSON.stringify(Array.from({ length: TOPE_VISTOS }, (_, i) => String(1100000000 + i)));
  const recortado = JSON.parse(vistosConNuevos(muchos, ['1199999999'])) as string[];
  assert.equal(recortado.length, TOPE_VISTOS);
  assert.equal(recortado.at(-1), '1199999999');
  assert.ok(!recortado.includes('1100000000'), 'se olvida el más viejo, no el nuevo');
  // El tiempo que se dice, para arriba: 40 consultas a 2,6 s son 104 s → 2 min.
  assert.equal(minutosDePerfiles(40), 2);
  assert.equal(minutosDePerfiles(30), 2, '78 s se dicen 2 min, no 1: mejor que sobre a que falte');
  assert.equal(minutosDePerfiles(1), 1);
  assert.equal(minutosDePerfiles(0), 1);
  assert.equal(SEGUNDOS_POR_PERFIL, 2.6);
});
