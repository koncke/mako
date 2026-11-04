// =============================================================================
// Lo que le llega a un TERCERO se confirma por WhatsApp con un «sí» y nada más (21/10/2026)
// =============================================================================
// El Cerebro, revisando la 2.1 de CRM: la regex CONFIRMACION (lib/mako-intencion.ts) arranca con `^` y no termina con `$`, así que
// «ok, esperá que lo reviso», «perfecto, después lo veo», «sí pero cambiale la hora» y «dale que lo pienso» llegan como una confirmación
// de la pendiente. Ejecutar de más suele costar poco, pero hay acciones con confirmación por chat que LE LLEGAN A OTRA PERSONA (un email
// y un WhatsApp al alumno, el aviso de Calendly o la invitación de Google al lead, el link de pago): eso no se deshace.
//
// La red es una puerta de código en `confirmarPendiente`, no otra ronda de palabras en el clasificador (docs/hallazgos-ia.md,
// «la red es la tarjeta, no la regla»): las acciones marcadas `aTerceros` se confirman sólo con un mensaje que es SÓLO una confirmación;
// con cualquier otra cosa la pendiente sigue viva y MaKo repregunta mostrando qué va a salir.
//
// Medido por SHA contra producción (21/10/2026, 60 días): ver docs/hallazgos-comunicacion.md.
// Probado rompiéndolo: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { confirmacionPura, conQuienPidio, elSiEsDeQuienPidio, PIDE_EL_SI_A_MAKO, PIDIO, quienEnElGrupo, rechazoSiNoEsConfirmacionPura, sinQuienPidio } from '../lib/confirmacion-pura';
import { REGISTRO, porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

// --- 1. Qué es una confirmación pura ---------------------------------------------------------------------------------------------

test('«sí», «dale», «mandalo», «confirmo» (con cortesías) son una confirmación pura', () => {
  for (const m of [
    'sí', 'Sí', 'si', 'SI', '¡Sí!', 'dale', 'Dale.', 'sí dale', 'sí, dale', 'dale, mandalo', 'mandalo', 'mandala ya', 'envialo', 'confirmo', 'Confirmado 👍', 'sí, hacelo por favor',
    'hacela', 'de una', 'sí gracias', 'ok dale', 'listo, dale', 'adelante', 'sí sí', 'agendalo', 'sí, agendala', 'dale mako', 'confirmalo', 'sí, confirmá', 'ejecutalo',
  ]) assert.equal(confirmacionPura(m), true, `«${m}» no se reconoció como una confirmación`);
  // Un lote de mensajes seguidos lleva un encabezado nuestro y numeración: no son palabras de la persona.
  assert.equal(confirmacionPura('[Te mandó 2 mensajes seguidos. Cargá todo junto.]\n(1) sí\n(2) dale'), true);
});

test('con un «pero», un «esperá», un cambio, un dato o una pregunta NO es una confirmación', () => {
  for (const m of [
    // las que pidió el Cerebro
    'ok, espera que lo reviso', 'perfecto, después lo veo', 'sí pero cambiale la hora', 'dale que lo pienso',
    // acuses solos: reciben, no mandan
    'ok', 'perfecto', 'listo', 'genial', 'vale', 'bueno', 'claro', 'así es', 'correcto',
    // mensajes reales de los grupos (60 días) que el clasificador manda a `confirmar`
    'Si 18 de noviembre', 'Si, anota; “Closing, España y webinar”', 'Ok, decime que reuniónes tengo hoy', 'Dale mato que tenemos que hacer millones, vamos arriba MaKo',
    'así es pero su cuota en comercial sigue vigente como vencida', 'Si está vinculado, pero no aparece', 'no', 'No tengo closer',
    // cambios, preguntas y dudas
    'sí, pero a las 5', 'dale, mejor mañana', 'sí ¿a qué hora?', 'esperá', 'sí, la 2', 'sí mandalo a Juan', 'sí, cambiale el título', 'dale dale dale dale dale dale dale',
    // un NÚMERO es un dato de más (22/10/2026, la revisión adversarial de Ops Center 1.2): otra hora, otro día, otro monto
    'sí 17', 'dale 18/11', 'sí 2', 'sí 1000', 'dale, $500',
    '', '   ', '👍',
  ]) assert.equal(confirmacionPura(m), false, `«${m}» se tomó como una confirmación`);
});

// --- 2. La puerta ------------------------------------------------------------------------------------------------------------------

test('una acción que le llega a un tercero, por WhatsApp, sólo pasa con una confirmación pura; lo demás repregunta mostrando qué va a salir', () => {
  const base = { aTerceros: true, titulo: 'Invitar a un cliente a un curso', resumen: 'Invitar a Ana a «Curso 1» con el email ana@x.com' };
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, canal: 'whatsapp', mensaje: 'sí' }), null);
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, canal: 'whatsapp', mensaje: 'Dale, mandalo' }), null);
  for (const m of ['ok, espera que lo reviso', 'sí pero cambiale el curso', 'perfecto, después lo veo', undefined, '']) {
    const r = rechazoSiNoEsConfirmacionPura({ ...base, canal: 'whatsapp', mensaje: m });
    assert.ok(r, `«${m}» pasó la puerta`);
    assert.match(r!, /Invitar a un cliente a un curso/, 'el rechazo no dice qué acción es');
    assert.match(r!, /Invitar a Ana a «Curso 1»/, 'el rechazo no trae lo que va a salir');
    assert.match(r!, /NO la confirmes/);
    assert.match(r!, /sigue viva/);
  }
});

test('la puerta es sólo de WhatsApp y sólo de lo que le llega a un tercero', () => {
  const x = { titulo: 'T', resumen: 'R', mensaje: 'ok, esperá' };
  // Una acción interna (cambiar una etapa, crear una tarea) sigue como estaba: ejecutar de más cuesta poco y se deshace.
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...x, canal: 'whatsapp', aTerceros: false }), null);
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...x, canal: 'whatsapp', aTerceros: undefined }), null);
  // En la app la persona toca la tarjeta y por HTTP firma el token: no hay un mensaje que interpretar.
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...x, canal: 'app', aTerceros: true }), null);
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...x, canal: 'http', aTerceros: true }), null);
});

// --- 3. Qué acciones le llegan a un tercero --------------------------------------------------------------------------------------

/** Las que mandan un email, un WhatsApp, un aviso, una invitación o un link a OTRA persona al confirmarse. */
const A_TERCEROS = [
  'proponer_agendar_reunion', 'cancelar_reunion_calendly', 'proponer_agendar_agenda', 'proponer_mover_reunion', 'proponer_cambiar_reunion', 'proponer_cancelar_reunion',
  'invitar_cliente_curso_cs', 'reenviar_invitacion', 'crear_link_pago', 'crear_link_cuota', 'llevar_a_partners', 'mover_lead_en_producto',
  // Los tres envíos de Chats 2.1 (22/10/2026, al traer main): sólo por la app hoy, pero le llegan al contacto.
  'enviar_borrador_whatsapp', 'contestar_dm', 'contestar_email_chat',
  // La revisión adversarial (22/10/2026): activar una secuencia manda pasos a todo su público; inscribir a un lead le dispara el
  // primer envío; cambiar de etapa lo mete en la automatización de esa etapa (y Ganado lo invita al curso); una etiqueta dispara
  // las automatizaciones que arrancan con ella.
  'proponer_toggle_nutricion', 'inscribir_lead_secuencia', 'proponer_cambio_etapa', 'poner_etiqueta_lead',
  // Y sacarla: dispara las de «Se elimina etiqueta a un lead» (la regex ampliada la encontró).
  'sacar_etiqueta_lead',
  // Empezar de nuevo una secuencia (23/10/2026): le vuelve a disparar el primer envío, como inscribir.
  'empezar_de_nuevo_lead_secuencia',
  // La difusión desde el CRM (28/10/2026): le escribe a muchos leads a la vez.
  'difundir_a_leads',
  // Dar acceso a un curso por la API (23/10/2026): le manda la invitación al alumno, como invitar_cliente_curso_cs.
  'dar_acceso_curso',
];

/** Las que MUEVEN PLATA (D2): activar en Meta enciende el gasto, y los montos de una venta o de una cuota. */
// El cobro de Ganado (23/10/2026): decide si un pago gana el trato y arma su plan de pagos.
const A_PLATA = ['proponer_estado_campana', 'proponer_estado_conjunto', 'proponer_estado_anuncio', 'editar_cuota', 'editar_venta_lead',
  'vincular_cobro_etapa', 'cuentas_cobro_etapa', 'desvincular_cobro_etapa'];

test('lo que mueve plata está marcado `plata` y, por WhatsApp, pasa por la misma puerta: un «sí» y nada más', () => {
  for (const id of A_PLATA) {
    const d = porId(id);
    assert.ok(d && esAccion(d), `«${id}» no existe o no es una acción`);
    assert.equal(d.plata, true, `«${id}» mueve plata y no está marcada`);
    assert.equal(d.confirmacion, 'chat', `«${id}» está marcada plata y no se confirma por chat: la marca no hace nada`);
  }
  const base = { aTerceros: undefined, plata: true, titulo: 'Prender la campaña', resumen: 'Activar «Black Friday» (USD 50 por día)' };
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, canal: 'whatsapp', mensaje: 'sí' }), null);
  for (const m of ['perfecto, después lo veo', 'ok, esperá que lo reviso', 'sí 30']) {
    const r = rechazoSiNoEsConfirmacionPura({ ...base, canal: 'whatsapp', mensaje: m });
    assert.ok(r, `«${m}» prendió el gasto`);
    assert.match(r!, /mueve plata/);
    assert.match(r!, /Activar «Black Friday»/, 'el rechazo no trae lo que va a pasar');
  }
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, canal: 'app', mensaje: 'ok' }), null, 'en la app es la tarjeta');
});

test('las acciones que le mandan algo a otra persona están marcadas `aTerceros`, y la marca sólo tiene sentido en una acción de chat', () => {
  for (const id of A_TERCEROS) {
    const d = porId(id);
    assert.ok(d && esAccion(d), `«${id}» no existe o no es una acción`);
    assert.equal(d.aTerceros, true, `«${id}» le llega a un tercero y no está marcada aTerceros`);
    assert.equal(d.confirmacion, 'chat', `«${id}» está marcada aTerceros y no se confirma por chat: la marca no hace nada`);
  }
  for (const d of REGISTRO) if (esAccion(d) && d.aTerceros) assert.equal(d.confirmacion, 'chat', `«${d.id}» tiene aTerceros y se confirma en pantalla`);
});

/** Lo que una descripción dice cuando la acción le escribe o le manda algo a alguien. */
// + «dispara el primer envío», «le repite los mensajes», «mandar pasos», «dispara las automatizaciones» e «invita al curso»
// (22/10/2026, la revisión adversarial: cuatro acciones que le escriben a leads lo decían así y la regex no las veía).
const LE_LLEGA = /\bdispara(?:r)?\s+(?:el\s+primer\s+env[ií]o|las\s+automatizaciones)|\brepite\s+los\s+mensajes|\bmandar\s+pasos|\binvita(?:r)?\s+al\s+curso|\b(?:le|les)\s+(?:llega|llegan|manda|mandan|avisa|avisan|escribe|escriben|envía|envia|envían)\b|\binvit(?:a|aci|ad|ar)|\bmanda(?:r)?\s+(?:un|una|el|la|los|las)\s+(?:email|correo|mail|whatsapp|mensaje|aviso|recordatorio|invitaci)|\benv[ií]a(?:r)?\s+(?:un|una|el|la|los|las)\s+(?:email|correo|mail|whatsapp|mensaje|aviso)|google le manda|aviso al lead/i;
/** Las que lo dicen y NO le llegan a nadie al confirmarse, con la razón. Una acción nueva que lo diga y no esté marcada frena el push. */
const NO_LLEGAN: Record<string, string> = {
  cerrar_chat: '«No le manda nada al contacto»', reabrir_chat: '«No le manda nada al contacto»', posponer_chat: '«No le manda nada al contacto»',
  crear_automatizacion_con_ia: 'nace PAUSADA: no le escribe a nadie hasta que alguien la active',
  asignar_audio_paso: 'a los leads que todavía no son clientes queda como borrador para que alguien lo mande',
  avisar_al_equipo: 'es un aviso al grupo del negocio (el equipo), no al lead',
  marcar_visto_operaciones: '«No le manda nada al chat»: sólo pone el ✓ de «Ya lo vi» en el Ops Center de la plataforma',
  configurar_horario_envio: 'cambia el horario de oficina de las automatizaciones: a qué hora PUEDEN escribir, no manda nada al confirmarse',
  volver_a_probar_lead_secuencia: '«No le manda nada ahora»: marca la inscripción terminada; le escribe recién lo próximo que la arranca (un comentario, un mensaje suyo)',
};

test('una acción de chat que dice que le escribe, le avisa o le manda algo a alguien está marcada, o su excepción dice por qué no', () => {
  const sinMarcar: string[] = [];
  const vistas = new Set<string>();
  for (const d of REGISTRO) {
    if (!esAccion(d) || d.confirmacion !== 'chat' || (d.canales && !d.canales.includes('whatsapp'))) continue;
    if (!LE_LLEGA.test(`${d.escribe} ${d.descripcion}`)) continue;
    vistas.add(d.id);
    if (!d.aTerceros && !(d.id in NO_LLEGAN)) sinMarcar.push(d.id);
  }
  assert.deepEqual(sinMarcar, [], 'estas acciones dicen que le llegan a alguien y no están marcadas aTerceros (ni son una excepción con su razón)');
  for (const id of Object.keys(NO_LLEGAN)) assert.ok(vistas.has(id), `la excepción «${id}» ya no dice que le llega a alguien: sacala de la lista`);
});

// --- 4. La puerta está donde se confirma -------------------------------------------------------------------------------------------

test('confirmarPendiente (y su camino viejo) piden la confirmación pura ANTES de reclamar la pendiente', () => {
  const nuevo = leer('lib/api-mako/acciones.ts');
  const iConfirmar = nuevo.indexOf('export async function confirmarPendiente');
  assert.ok(iConfirmar > 0);
  const cuerpo = nuevo.slice(iConfirmar);
  const iPuerta = cuerpo.indexOf('rechazoSiNoEsConfirmacionPura(');
  const iReclamo = cuerpo.indexOf('reclamarPendiente(ctx.ws');
  assert.ok(iPuerta > 0, 'confirmarPendiente no llama a rechazoSiNoEsConfirmacionPura');
  assert.ok(iPuerta < iReclamo, 'la puerta va DESPUÉS de reclamar la pendiente: un rechazo la dejaría quemada');
  assert.match(cuerpo.slice(iPuerta, iPuerta + 400), /mensaje: ctx\.mensajeUsuario/, 'la puerta no mira el mensaje de la persona (ctx.mensajeUsuario)');
  // (600: la llamada lleva también quién pidió y quién confirma en el grupo, test de la sección 5.)
  assert.match(cuerpo.slice(iPuerta, iPuerta + 600), /return \{ error: rechazoATercero \}|if \(rechazoATercero\) return \{ error/, 'el rechazo no vuelve como el error de confirmar_accion');

  const viejo = leer('lib/mako-doer-acciones.ts');
  const iV = viejo.indexOf("case 'confirmar_accion':");
  const cuerpoV = viejo.slice(iV);
  const pV = cuerpoV.indexOf('rechazoSiNoEsConfirmacionPura(');
  assert.ok(pV > 0 && pV < cuerpoV.indexOf('reclamarPendiente(ws, target.id)'), 'el camino viejo de confirmar_accion no pide la confirmación pura antes de reclamar');
  assert.match(cuerpoV.slice(pV, pV + 400), /mensaje: mensajeUsuario/);
});

test('el doer de WhatsApp le pasa al contexto el mensaje de la persona (sin él la puerta rechazaría todo)', () => {
  assert.match(leer('lib/mako-doer-in.ts'), /canal: 'whatsapp', canalKey: jid, alcance: 'ejecutar'[^\n]*mensajeUsuario: texto/);
});

// Probado rompiéndolo (21/10/2026), una rotura por vez, con todo en verde antes:
//   · sacar `aTerceros` de una de las doce (invitar_cliente_curso_cs) · la puerta que ignora el canal (rechaza también la app) ·
//     la puerta que no mira `aTerceros` (rechaza lo interno) · FUERTES con «ok» (un acuse confirma) · el tope de palabras · la puerta
//     después de reclamar · sacar la llamada de confirmarPendiente · sacarla del camino viejo · sacar el mensaje del contexto de WhatsApp.

// PROBADO ROMPIÉNDOLO, la revisión adversarial de Ops Center 1.2 (22/10/2026, base 9/0): un número sin contar como palabra → 7/2
// (2 y 5) · la puerta sin mirar `plata` → 8/1 (5) · `proponer_cambio_etapa` sin `aTerceros` → 8/1 (6) · `proponer_estado_campana`
// sin `plata` → 8/1 (5). La regex ampliada encontró sola a `sacar_etiqueta_lead`.

// --- 5. El «sí» de PLATA en un grupo (28/10/2026) ----------------------------------------------------------------------------------

test('en un grupo, la pendiente de plata la confirma quien la pidió o un «sí» a MaKo; otro «sí» pide «sí, MaKo» y la deja viva', () => {
  // La verificación de 8cb034a18: el lote junta 8 s, y el «sí» de Pedro a «@Pedro ¿lo confirmo?» de Ana que llega después, solo y
  // puro, ejecutaba la pendiente de plata. Lo decidió el Cerebro el 28/10.
  const base = { canal: 'whatsapp', aTerceros: false, plata: true, titulo: 'Editar cuota', resumen: 'la cuota 3 de Nadia a USD 423' };
  const ANA = '5491111111111@s.whatsapp.net';
  const PEDRO = '5492222222222@s.whatsapp.net';
  // Quien la pidió, con un «sí» solo: pasa.
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí', enElGrupo: { pidio: ANA, confirma: ANA, aMaKo: false } }), null);
  // Otra persona, con un «sí» solo: no pasa, y MaKo pide «sí, MaKo».
  const otro = rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí', enElGrupo: { pidio: ANA, confirma: PEDRO, aMaKo: false } });
  assert.ok(otro && otro.includes(PIDE_EL_SI_A_MAKO) && /La pendiente sigue viva/.test(otro), String(otro));
  assert.equal(PIDE_EL_SI_A_MAKO, '¿Lo confirmo? Respóndeme «sí, MaKo» y lo hago.');
  // Un «sí» que le habla a MaKo, de cualquiera: pasa («sí, MaKo» es una confirmación pura).
  assert.ok(confirmacionPura('sí, MaKo') && confirmacionPura('sí mako'));
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí, MaKo', enElGrupo: { pidio: ANA, confirma: PEDRO, aMaKo: true } }), null);
  // Sin saber quién la pidió (una pendiente de antes) o quién confirma (un lote de varios): pide «sí, MaKo».
  for (const g of [{ pidio: null, confirma: ANA, aMaKo: false }, { pidio: ANA, confirma: null, aMaKo: false }, { pidio: null, confirma: null, aMaKo: false }])
    assert.ok(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí', enElGrupo: g })?.includes(PIDE_EL_SI_A_MAKO), JSON.stringify(g));
  assert.ok(elSiEsDeQuienPidio({ pidio: null, confirma: null, aMaKo: true }));
  // Lo que no es puro sigue con su rechazo de siempre, antes que el del grupo.
  assert.match(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí pero esperá', enElGrupo: { pidio: ANA, confirma: ANA, aMaKo: false } }) ?? '', /mueve plata \(un gasto, un monto\)/);
  // Fuera de un grupo (sin `enElGrupo`) y lo que le llega a un tercero sin mover plata: como antes (aTerceros queda afuera).
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, mensaje: 'sí' }), null);
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, plata: false, aTerceros: true, mensaje: 'sí', enElGrupo: { pidio: ANA, confirma: PEDRO, aMaKo: false } }), null);
  // La app no pasa por acá.
  assert.equal(rechazoSiNoEsConfirmacionPura({ ...base, canal: 'app', mensaje: 'sí', enElGrupo: { pidio: ANA, confirma: PEDRO, aMaKo: false } }), null);
});

test('quién la pidió va en el payload y sale al leerla: ni la bandeja lo muestra ni la acción lo recibe', () => {
  assert.equal(quienEnElGrupo('5491111111111:12@s.whatsapp.net'), '5491111111111@s.whatsapp.net');
  assert.equal(quienEnElGrupo('70781665022126@lid'), '70781665022126@lid');
  assert.equal(quienEnElGrupo(''), null);
  const con = conQuienPidio({ cuota_id: 3, monto: 423 }, '5491111111111@s.whatsapp.net');
  assert.deepEqual(con, { cuota_id: 3, monto: 423, [PIDIO]: '5491111111111@s.whatsapp.net' });
  assert.deepEqual(sinQuienPidio(con), { payload: { cuota_id: 3, monto: 423 }, pidio: '5491111111111@s.whatsapp.net' });
  assert.deepEqual(conQuienPidio({ a: 1 }, null), { a: 1 });
  assert.deepEqual(sinQuienPidio({ a: 1 }), { payload: { a: 1 }, pidio: null });
  // El cableado: la pendiente lo guarda al crearse y lo saca al leerse; los dos caminos que proponen lo pasan, y las dos puertas
  // lo comparan con quien confirma.
  const pend = leer('lib/mako-pendientes.ts');
  assert.match(pend, /const payloadCrudo = conQuienPidio\(dataCruda\.payload \?\? \{\}, dataCruda\.pidio, salidaDelGrupo\(\)\?\.soloApp\);/);
  assert.match(pend, /const \{ payload, pidio, soloApp \} = sinQuienPidio\(/);
  const api = leer('lib/api-mako/acciones.ts');
  assert.match(api, /pidio: ctx\.enElGrupo\?\.quien,/);
  assert.match(api, /enElGrupo: ctx\.enElGrupo \? \{ pidio: p\.pidio \?\? null, confirma: ctx\.enElGrupo\.quien, aMaKo: ctx\.enElGrupo\.aMaKo \} : undefined,/);
  const viejo = leer('lib/mako-doer-acciones.ts');
  assert.match(viejo, /mismoTurnoDesde: turnStart, pidio: enElGrupo\?\.quien \}\);/);
  assert.match(viejo, /enElGrupo: enElGrupo \? \{ pidio: target\.pidio \?\? null, confirma: enElGrupo\.quien, aMaKo: enElGrupo\.aMaKo \} : undefined,/);
  // El doer: quién escribe (nadie en un lote de varios) y si le habla a MaKo, al contexto y al runner.
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /quien: data\.loteDeVarios \? null : quienEnElGrupo\(key\?\.participant\) \?\? \(key\?\.fromMe \? 'fromMe' : null\),/);
  // «Le habla a MaKo»: en un lote, el último de lo que queda (un audio no cuenta); suelto, el nombre, la @ (salvo en la línea del
  // dueño, donde la @ es él) o la cita a un mensaje de MaKo por su id (la verificación de 9cef25dba).
  assert.match(doer, /aMaKo: data\.paraQuien \? !!data\.paraQuien\.leHabla\n\s*: \(quien\.aMaKo && !lineaDelDueno\) \|\| nombraAMaKo\(textoDirecto\) \|\| nombraAMaKo\(texto\) \|\| \(await citaAMaKo\(data\)\),/);
  assert.equal((doer.match(/leHabla: await leHablaAMaKo\(/g) ?? []).length, 2, 'un lote no dice si su último le habla a MaKo');
  assert.match(doer, /async function citaAMaKo\(data: MsgIn\): Promise<boolean> \{\n\s*const \{ id \} = citaDe\([^\n]*\n[\s\S]{0,400}?return !!id && \(await idsEnviados\(/);
  assert.match(doer, /if \(await esEcoDeMaKoAhora\(instance, jid, key\)\) return \{ engaged: false, skip: 'eco de mi propia respuesta' \};\n[^\n]*\n\s*await anotarLineaDelDueno\(instance\);/);
  assert.match(doer, /sinElLlamadoAMaKo\(textoDirecto, lineaDelDueno \? null : await numeroDeLaLinea\(instance\)\)/);
  assert.match(doer, /mensajeUsuario: texto, enElGrupo,/);
  assert.match(doer, /crearRunnerAcciones\(wsData, jid, Date\.now\(\), texto, enElGrupo\)/);
});
