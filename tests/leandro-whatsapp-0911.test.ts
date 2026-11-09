// =============================================================================
// Leandro (ws 10), 9/11/2026: «Leandro le está escribiendo a MaKo en WhatsApp y no responde... Y no está solucionando su problema
// con Automations hace días» (Martín). Medido en producción: MaKo le contestaba cada mensaje, pero sus tickets NUNCA llegaban al
// arreglo — quedaban `esperando_decision` aunque Martín le dio la vía libre (`APROBADOS_POR_REGLA`). Tres causas, las tres acá:
//   1. «tarjeta» (un paso del lienzo de Automations) se leía como tarjeta de crédito → «cobros» → esperaba a Martín (#62, #63, #67);
//   2. el dueño escribiendo en SU grupo no era nadie: su teléfono no estaba en su perfil, aunque era el número del dueño (#65);
//   3. lo que la persona reportaba se SUMABA a un ticket que había abierto MaKo solo, y ése no entra por la regla (#67).
// Los textos son los de los tickets reales, recortados.
//
// PROBADO ROMPIÉNDOLO (9/11/2026): el registro, al final.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { clasificar, emailDelTelefono, estadoInicial, sanearContexto, triageAlSumarLaPersona, zonaSensible, type EntradaTriage } from '../lib/tickets-reglas';
import { partesParaEnviar } from '../lib/mensaje-partes';
import { botonesParaGuardar } from '../lib/botones-api';
import { porId } from '../lib/api-mako/registro';

const leer = (rel: string) => readFileSync(join(import.meta.dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const e =(titulo: string, descripcion = ''): EntradaTriage => ({ tipoDeclarado: null, declaradoPor: 'persona', titulo, descripcion, contexto: sanearContexto({}) });

// Del #63 (lo levantó Leandro desde el chat de la app, 8/11) y del #67 (lo que escribió en el grupo, 9/11).
const TICKET_63 = [
  'Otro problema con los flujos de comentarios, distinto del del 30-oct. Ahora pasa con gente que comentó una sola vez.',
  'Tocan «Obtener recurso», MaKo avanza, pero no sale ningún mensaje y la inscripción se cancela.',
  '- Lead 5938, secuencia 708: inscripto 05:02:39, ultimo_envio 05:02:43, pasos_avanzados 3, tarjeta nem81on, cancelada a las 06:00:25.',
  'Pasa en las dos ramas: los que siguen a la cuenta quedan en n4wu86y («¡Acá está!», que es la tarjeta final y tendría que dar completada).',
].join('\n');
const PREGUNTA_67 = 'Probé lo que me dijiste y no funciona así. En la tarjeta de Instagram con «Responder en público» tildado, el botón «{ }» solo abre la lista de datos del lead. ¿Dónde se cargan exactamente las variantes de una tarjeta, paso a paso?';

test('1. una TARJETA del lienzo no es una tarjeta de pago: el reporte de Automations de Leandro va al arreglo', () => {
  for (const [titulo, desc] of [['Otro problema con los flujos de comentarios, distinto del del 30-oct', TICKET_63], ['MaKo no pudo hacer lo que le pidieron, en WhatsApp', PREGUNTA_67]]) {
    assert.equal(zonaSensible(e(titulo, desc)), null, `${titulo}: «tarjeta» del lienzo leída como cobro`);
    const t = clasificar(e(titulo, desc), { aprobadoPorRegla: 'Leandro' });
    assert.equal(t.autoArreglo, true, `${titulo}: esperó a Martín (${t.porque.join(' | ')})`);
    assert.equal(t.regla, 'Leandro');
    assert.equal(estadoInicial(t), 'en_curso');
  }
  // La de PAGO sigue esperando a Martín, nombrada de cualquiera de las formas en que se escribe.
  for (const frase of ['No me deja pagar con tarjeta', 'Me rechaza la tarjeta de crédito', 'Cargué los datos de la tarjeta y no anda', 'La tarjeta rechazada otra vez', 'Pide el CVV y no lo acepta', 'Quiero suscribirme con mi tarjeta']) {
    assert.ok(zonaSensible(e(frase)), `${frase}: una tarjeta de pago dejó de ser delicada`);
    assert.equal(clasificar(e(frase), { aprobadoPorRegla: 'Leandro' }).autoArreglo, false, `${frase}: salió sin Martín`);
  }
});

test('2. el número del dueño es el dueño: el primer admin del negocio, aunque su perfil no tenga teléfono', () => {
  // Como el ws 10 el 9/11 (datos inventados): dos admins, ninguno con el teléfono en el perfil; el número del dueño es el del fundador.
  const ws10 = [
    { id: 24, email: 'equipo.fiesta@example.com', rol_ws: 'admin', created_at: '2026-10-25T01:00:31Z', perfil: {} },
    { id: 8, email: 'fundador.fiesta@example.com', rol_ws: 'admin', created_at: '2026-07-29T00:54:51Z', perfil: { telefono: '' } },
  ];
  assert.equal(emailDelTelefono(ws10, '5491155550123', '5491155550123'), 'fundador.fiesta@example.com', 'el dueño en su grupo no es nadie');
  // El 9 de Argentina que agrega WhatsApp no cambia nada (se compara por los últimos 8).
  assert.equal(emailDelTelefono(ws10, '541155550123', '5491155550123'), 'fundador.fiesta@example.com');
  // Otro teléfono sigue sin ser nadie, y sin número del dueño también.
  assert.equal(emailDelTelefono(ws10, '5491199998888', '5491155550123'), null, 'cualquiera del grupo pasó a ser el dueño');
  assert.equal(emailDelTelefono(ws10, '5491155550123', null), null);
  // El de un perfil gana; dos perfiles con el mismo teléfono no son nadie (no se elige uno al azar).
  const conPerfil = [...ws10, { id: 30, email: 'closer.fiesta@example.com', rol_ws: 'closer', created_at: '2026-11-01T00:00:00Z', perfil: { telefono: '+54 9 11 5555-0123' } }];
  assert.equal(emailDelTelefono(conPerfil, '5491155550123', '5491155550123'), 'closer.fiesta@example.com');
  const dos = [...conPerfil, { id: 31, email: 'otro.fiesta@example.com', rol_ws: 'admin', created_at: '2026-11-02T00:00:00Z', perfil: { telefono: '1155550123' } }];
  assert.equal(emailDelTelefono(dos, '5491155550123', '5491155550123'), null);
  // Un closer nunca es «el dueño» por el número: el dueño es un admin (`rol_ws` nulo también es admin).
  const sinAdmin = [{ id: 40, email: 'setter@x.com', rol_ws: 'setter', created_at: '2026-07-01T00:00:00Z', perfil: {} }, { id: 41, email: 'dueno@x.com', rol_ws: null, created_at: '2026-08-01T00:00:00Z', perfil: {} }];
  assert.equal(emailDelTelefono(sinAdmin, '5491155550123', '5491155550123'), 'dueno@x.com');
});

test('3. lo que la persona suma a un ticket que abrió MaKo solo lo hace suyo: con la regla, va al arreglo', () => {
  const t67 = {
    ref: 'np:10:whatsapp:1spzxuk:texto:2mn7g6', estado: 'esperando_decision', titulo: 'MaKo no pudo hacer lo que le pidieron, en WhatsApp',
    descripcion: 'Lo que MaKo dijo que no pudo: «enviar el recurso a dos contactos específicos por MaKo»', contexto: sanearContexto({ causa: 'texto', superficie: 'whatsapp' }),
  };
  const nuevo = triageAlSumarLaPersona(t67, PREGUNTA_67, { aprobadoPorRegla: 'Leandro' });
  assert.ok(nuevo, 'el reporte de la persona dejó el ticket esperando a Martín');
  assert.equal(nuevo!.autoArreglo, true);
  assert.equal(nuevo!.regla, 'Leandro', 'sin la marca, el Runner no lo lleva con la regla');
  assert.equal(estadoInicial(nuevo!), 'en_curso');
  // Sin la regla, con algo delicado, con el interruptor apagado o si no es un automático que espera: queda como estaba.
  assert.equal(triageAlSumarLaPersona(t67, PREGUNTA_67, { aprobadoPorRegla: null }), null, 'otro negocio salió sin Martín');
  assert.equal(triageAlSumarLaPersona(t67, 'Me cobraron dos veces la suscripción', { aprobadoPorRegla: 'Leandro' }), null, 'un cobro salió sin Martín');
  assert.equal(triageAlSumarLaPersona(t67, PREGUNTA_67, { aprobadoPorRegla: 'Leandro', apagado: true }), null, 'con el arreglo automático apagado');
  assert.equal(triageAlSumarLaPersona({ ...t67, ref: 'wa:10:376a2fc02b7dc254' }, PREGUNTA_67, { aprobadoPorRegla: 'Leandro' }), null, 'reclasificó un ticket de la persona');
  assert.equal(triageAlSumarLaPersona({ ...t67, estado: 'en_curso' }, PREGUNTA_67, { aprobadoPorRegla: 'Leandro' }), null, 'reclasificó uno que ya estaba en curso');
});

// ── El ticket #67: que la respuesta pública de una tarjeta de Instagram «rote» entre varios textos ──────────────────────────────
// Leandro, 9/11: «¿Puedo cargarle variantes a esa tarjeta?» — y después: «la ficha muestra la cantidad de variantes de cada
// tarjeta (todas en 0), pero no hay ninguna operación para cargarlas. Y la Prueba A/B termina mandando a todos a la rama A».
const PUBLICA = { id: 'pub', canal: 'instagram', en_comentario: true, cuerpo: '¡Enviado! Revisá tus DMs ✨', siguiente: 'm1' };
const OTRAS = ['¡Listo! Te lo mandé por privado 🎵', '¡Ahí va! Fijate en tus mensajes 📩'];

test('4. el motor sortea una forma de decirlo por persona en Instagram, también en la respuesta pública', () => {
  // Con un sorteo fijo se ve qué sale: el texto o una de las otras (el mismo `textoDelPaso` del WhatsApp por QR).
  const salen = new Set<string>();
  for (let i = 0; i < 3; i++) {
    const partes = partesParaEnviar({ ...PUBLICA, variantes: OTRAS }, (p) => [p.cuerpo, ...(p.variantes ?? [])][i]);
    assert.equal(partes.length, 1);
    assert.equal(partes[0].tipo, 'texto');
    salen.add((partes[0] as { cuerpo: string }).cuerpo);
  }
  assert.deepEqual([...salen].sort(), [PUBLICA.cuerpo, ...OTRAS].sort(), 'la respuesta pública salía siempre igual');
  // El sorteo de verdad elige entre esas tres, y nada más.
  for (let i = 0; i < 40; i++) assert.ok([PUBLICA.cuerpo, ...OTRAS].includes((partesParaEnviar({ ...PUBLICA, variantes: OTRAS })[0] as { cuerpo: string }).cuerpo));
  // Sin otras formas, o con varios mensajes seguidos, salen tal cual.
  assert.deepEqual(partesParaEnviar(PUBLICA), [{ tipo: 'texto', cuerpo: PUBLICA.cuerpo }]);
  const dos = { ...PUBLICA, cuerpo: 'uno', partes: [{ tipo: 'texto', cuerpo: 'uno' }, { tipo: 'texto', cuerpo: 'dos' }], variantes: OTRAS };
  assert.deepEqual(partesParaEnviar(dos).map((p) => (p as { cuerpo: string }).cuerpo), ['uno', 'dos']);
  // Los dos lugares del motor que mandan por Instagram o Messenger pasan por acá (el CRON y «Si responde»).
  const motor = leer('lib/nutricion.ts');
  assert.equal(motor.match(/partesConDatos\(partesParaEnviar\((paso|p)\), varsSocial\)/g)?.length, 2, 'un envío social no sortea');
  assert.doesNotMatch(motor, /partesConDatos\(partesDe\(/, 'quedó un envío social que no sortea');
});

test('5. la API carga las formas de decirlo de un DM o de la respuesta pública; [] las saca', () => {
  const pasos = [{ id: 'cron', nodo: 'inicio', canal: 'instagram', siguiente: 'pub' }, PUBLICA, { id: 'm1', canal: 'instagram', cuerpo: 'Te dejo el recurso', siguiente: null }] as never[];
  const r = botonesParaGuardar(pasos, 'pub', null, 'IG - GUIA', undefined, undefined, [...OTRAS, '  ', PUBLICA.cuerpo].filter((x) => x.trim()));
  assert.ok(r.ok, r.ok ? '' : r.error);
  const guardado = (r as { pasos: Array<{ id: string; variantes?: string[] }> }).pasos.find((p) => p.id === 'pub')!;
  assert.deepEqual(guardado.variantes, OTRAS, 'no quedaron las otras formas, o quedó repetido el texto');
  assert.match((r as { resumen: string }).resumen, /rota entre 3 formas de decirlo/);
  const sin = botonesParaGuardar((r as unknown as { pasos: never[] }).pasos, 'pub', null, 'IG - GUIA', undefined, undefined, []);
  assert.deepEqual((sin as { pasos: Array<{ id: string; variantes?: string[] }> }).pasos.find((p) => p.id === 'pub')!.variantes, [], '[] no las sacó');
  const err = (vs: unknown[]) => { const x = botonesParaGuardar(pasos, 'pub', null, 'IG - GUIA', undefined, undefined, vs); return x.ok ? '' : x.error; };
  assert.match(err(['']), /necesita su texto/);
  assert.match(err(Array.from({ length: 9 }, (_, i) => `v${i}`)), /Hasta 8/);
  // Declarada en el registro: por HTTP (la usa su Claude) y con [] como valor.
  const d = porId('cambiar_botones_mensaje')!;
  const p = d.parametros.find((x) => x.nombre === 'variantes');
  assert.ok(p, 'la operación no recibe las variantes');
  assert.equal(p!.vaciaEsValor, true, '[] no llega: no se pueden sacar');
  assert.ok(d.canales.includes('http'));
});

test('6. el editor de Instagram y Messenger tiene el «↻» del WhatsApp, con la MISMA pieza', () => {
  const social = leer('app/automations/EditorMensajeSocial.tsx');
  assert.match(social, /<OtrasFormasDeDecirlo variantes=\{variantes\}/, 'el editor de Instagram no deja cargarlas');
  assert.match(social, /title="Otras formas de decirlo"/);
  assert.match(leer('app/automations/EditorMensajeWhatsApp.tsx'), /<OtrasFormasDeDecirlo variantes=\{variantes\}/, 'el WhatsApp dejó de usar la pieza común');
});

// PROBADO ROMPIÉNDOLO (9/11/2026, con `node --import tsx --test tests/leandro-whatsapp-0911.test.ts`):
//   R1 volver a poner `tarjeta` suelta en ZONA_SENSIBLE_TEXTO                    → fallan el 1 y el 3 («tarjeta» del lienzo leída como cobro)
//   R2 sacar TARJETA_DE_PAGO de ZONA_SENSIBLE_TEXTO                              → falla el 1 (una tarjeta de pago dejó de ser delicada)
//   R3 en `emailDelTelefono`, sin el número del dueño (return null al no haber perfil) → falla el 2 (el dueño en su grupo no es nadie)
//   R4 sin el filtro de admin del fundador                                       → falla el 2 (un setter es el dueño)
//   R5 `triageAlSumarLaPersona` sin la guarda `esRefDelSistema`                   → falla el 3 (reclasificó un ticket de la persona)
//   R6 clasificar con `automatico: true` (como antes)                            → falla el 3 (dejó el ticket esperando a Martín)
//   V1 `partesParaEnviar` sin sorteo                                            → falla el 4
//   V2 el envío del CRON con `partesDe(paso)` (como antes)                       → falla el 4
//   V3 `conVariantes` que no guarda                                              → falla el 5
//   V4 la def sin `vaciaEsValor`                                                → falla el 5
//   V5 el editor social sin `OtrasFormasDeDecirlo`                               → falla el 6
//   Un cambio sin efecto (renombrar `antes` por `primero` en emailDelTelefono)   → verde.
