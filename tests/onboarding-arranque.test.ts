// =============================================================================
// El chat de arranque: el onboarding de MaKo es una conversación (16/10/2026)
// =============================================================================
// Pedido de Martín: «Quiero que elimines todo lo que hay hoy en onboarding tal como está y que lo
// reemplaces por el chat de "Offer"… NO quiero que sea un onboarding eterno». Y de la llamada con Leila
// (12/10): «yo de hecho quisiera que jamás se salga el recuadro del chat».
//
// Lo PURO (en qué etapa está, qué dice MaKo, qué se acepta como respuesta, qué CRM propone, el brief) se
// prueba EJECUTÁNDOLO: lib/onboarding-arranque.ts y app/onboarding/arranque-ui.ts no llevan `server-only`
// para esto. El cableado que sólo se ve leyendo el fuente (la ruta, el cierre por la puerta única, el chat
// que no desaparece, la animación) se fija leyendo, sin comentarios y con LF.
// (Lo de postergar en el chat vive en tests/onboarding-postergar.test.ts; lo de la IA, en
// tests/onboarding-sin-api.test.ts. La regla de la bienvenida de antes —el grafo es ficción con la paleta y
// los nombres reales, el CSS sin comillas invertidas, la salida del modo agencia— se mudó acá.)
//
// PROBADO ROMPIÉNDOLO (16/10/2026, arnés romper-arranque.mjs en el scratchpad, restaura de memoria). Base:
// 18 pasan, 0 fallan. Cada rotura, «1 fallo, 17 pases»: la oferta cierra sin el diagnóstico · un email se
// ofrece como negocio · el brief pisa lo que había · el canal no va antes del volumen · la elección del CRM
// se guarda antes de sembrar · se siembra sin mirar si está intacto · el login vuelve a pisar el nombre · la
// oferta deja de abrirse encima del chat · la animación corre con movimiento reducido · la acción 'paso' deja
// la puerta única.
// Segunda vuelta, tras la revisión (arnés romper-revision.mjs). Base: 22 pasan, 0 fallan. Cada rotura, «1
// fallo, 21 pases»: una lectura caída abre otra conversación · la oferta no se guarda en el cierre · los
// reportes van al que mira y no al negocio · una opción vieja contesta la pregunta de hoy · «[completar]»
// entra al brief · el nombre provisorio (un email) ya no se reemplaza · el plan queda «armando» para siempre
// · se ofrece un email como nombre · el producto lleva un precio inventado. Y tras el merge con main: la
// puerta del cierre vuelve a leer tolerante, «1 fallo, 21 pases».
// Tercera vuelta, tras el recorrido en el ws3 (arnés romper-fase.mjs). Base: 23 pasan, 0 fallan. Cada rotura,
// «1 fallo, 22 pases»: la etapa vuelve a quedarse en 'oferta' con la oferta armada · repite lo que contestó
// en Offer · guarda lo de Offer como propio · la ruta pierde el canal de Offer · la respuesta optimista va
// del lado equivocado · los hechos no miden lo de Offer · la leyenda sale con un opacity estático.
//
// 17/10/2026: EL ONBOARDING SIN EL ANÁLISIS DE OFFER. Martín: «Sería bueno que la funcionalidad de "OFFER" no esté
// en el onboarding... Pero simular "Offer" en el onboarding simplemente para organizar en un PDF lo que vende el
// usuario». La conversación pregunta sólo lo que vende (`PIEZAS_DEL_ARRANQUE`), deja el PDF y no arma la oferta;
// el diagnóstico de fase lo pregunta el arranque después, con sus opciones. Cuarta vuelta (arnés
// romper-lo-que-vende.mjs): ver la cabecera de tests/onboarding-lo-que-vende.test.ts.
// Quinta vuelta (17/10/2026, arnés romper-entrada.mjs): la entrada de MaKo sin el grafo, el modo claro sin recuadro y
// las reacciones. Base 25/0; cada rotura, 24/1: avanza sola · corre con movimiento reducido · no se puede tocar ·
// vuelve el grafo · la entrada tapa la barra · vuelve el oscuro · vuelve el recuadro · sin medidas de celular · MaKo no
// reacciona · el muñeco dibujado directo (sin el adaptador de la estrella).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  etapaDeArranque, mensajesDeArranque, leerRespuesta, tiposOfrecidos, tipoRecomendado,
  primerNombre, sinMarca, briefDesdeArranque, fundirBrief, siguientePreguntaFase,
  AHORA_NO, CAMBIAR_NUMERO, VER_OTROS_TIPOS, ORIGENES, SALUDO_ARRANQUE, CRM_SI, PREGUNTA_ENTRADA,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { mandaElArranque, ladoDeLaPregunta, SESION_VACIA, aMensajeOffer, linkPdfLoQueVende } from '../app/onboarding/arranque-ui';
import { PREGUNTAS, CANALES } from '../lib/fase-diagnostico';
import { TIPOS_CRM } from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, desde: string, hasta: string) => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encuentro «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j < 0 ? undefined : j);
};

const H: HechosArranque = {
  modo: 'oferta', nombreCuenta: 'Martín Koncke', nombreWorkspace: 'Negocio que Escala', faseGuardada: false,
  canalNegocio: null, loQueVende: false, conCrm: true, conTelefono: false, terminado: false,
};
const PLAN: HechosArranque = { ...H, modo: 'plan', conCrm: false, conTelefono: false };
// Con las dos del final ya contestadas (desde el 18/10 van antes del teléfono): así las etapas de en medio se ven solas.
// Con el PDF confirmado (18/10/2026, `pdfOk`): las etapas de en medio se ven solas; la del PDF tiene su test.
const QUIEN: EstadoArranque = { nombre: 'Martín', negocio: 'Negocio que Escala', origen: 'Instagram', interes: 'ventas', pdfOk: 'si' };

// ── La etapa ────────────────────────────────────────────────────────────────
test('modo oferta: quién es → lo que vende → la fase → el CRM → cierra, sin esperar ninguna oferta (el WhatsApp, antes de todo: tests/onboarding-whatsapp-primero.test.ts)', () => {
  assert.equal(etapaDeArranque({}, H), 'nombre');
  assert.equal(etapaDeArranque({ nombre: 'M' }, H), 'negocio');
  // Del negocio, directo a lo que vende: sin el objetivo a 90 días (18/10/2026). Las dos del 17/10 van AL FINAL.
  assert.equal(etapaDeArranque({ nombre: 'M', negocio: 'N' }, H), 'oferta');
  assert.equal(etapaDeArranque(QUIEN, H), 'oferta');
  // Con lo que vende, primero «¿está correcto el PDF?» (18/10/2026).
  assert.equal(etapaDeArranque({ ...QUIEN, pdfOk: undefined }, { ...H, loQueVende: true }), 'pdf');
  // Con lo que vende, el diagnóstico de fase lo pregunta el arranque (la conversación ya no lo hace).
  assert.equal(etapaDeArranque(QUIEN, { ...H, loQueVende: true }), 'fase');
  const vende = { ...H, loQueVende: true, faseGuardada: true };
  assert.equal(etapaDeArranque(QUIEN, vende), 'crm');
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada' }, vende), 'cierre');
  // «¿Cómo llegaste?» y «¿Qué resolver primero?»: después del CRM.
  assert.equal(etapaDeArranque({ nombre: 'M', negocio: 'N', crmTipo: 'llamada' }, vende), 'origen');
  assert.equal(etapaDeArranque({ nombre: 'M', negocio: 'N', crmTipo: 'llamada', origen: 'Instagram' }, vende), 'interes');
  const conTel = { ...vende, conTelefono: true };
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada', telefono: 'codigo' }, conTel), 'codigo');
  // Ya no hay una etapa que espere la oferta armada: el análisis es de la tab Offer.
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada', telefono: 'postergado' }, conTel), 'cierre');
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada', telefono: 'verificado' }, conTel), 'cierre');
  assert.equal(etapaDeArranque({}, { ...H, terminado: true }), 'listo');
});

test('lo que vende queda en un PDF: el mensaje con su tarjeta va justo después de la conversación', () => {
  const { despues } = mensajesDeArranque(QUIEN, { ...H, loQueVende: true });
  assert.equal(despues[0].id, 'arr-pdf');
  assert.equal(despues[0].tarjeta, 'pdf');
  assert.match(despues[0].texto, /PDF/);
  // Mientras conversa, todavía no.
  assert.deepEqual(mensajesDeArranque(QUIEN, H).despues, []);
  assert.equal(linkPdfLoQueVende(42), '/api/offer/pdf?id=42&tipo=lo-que-vendes');
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(chat, /if \(t === 'pdf'\) return vista\.sesion \? <TarjetaPdf sesionId=\{vista\.sesion\.id\} \/> : null;/);
  // Desde el 18/10/2026 se mira EN el chat (tests/onboarding-pdf-en-el-chat.test.ts); la descarga lleva el ?ws=.
  assert.match(chat, /url=\{conWs\(linkPdfLoQueVende\(sesionId\), ws\)\}/);
});

test('modo plan (Project Manager, sin Offer ni CRM): quién es → a qué se dedica → diagnóstico → cierra', () => {
  assert.equal(etapaDeArranque(QUIEN, PLAN), 'que_hace');
  assert.equal(etapaDeArranque({ ...QUIEN, queHace: 'Consultoría' }, PLAN), 'fase');
  assert.equal(etapaDeArranque({ ...QUIEN, queHace: 'Consultoría' }, { ...PLAN, faseGuardada: true }), 'cierre');
  // Al final, cómo llegó (en el modo plan no se pregunta qué resolver primero: no hay pestañas de ventas).
  assert.equal(etapaDeArranque({ nombre: 'M', negocio: 'N', queHace: 'Consultoría' }, { ...PLAN, faseGuardada: true }), 'origen');
});

// ── Lo que dice MaKo ────────────────────────────────────────────────────────
test('cada etapa termina en SU pregunta, con sus opciones; lo contestado se ve como respuesta', () => {
  const { antes: a0 } = mensajesDeArranque({}, H);
  assert.equal(a0.length, 1);
  // Explica antes de preguntar (18/10/2026): para qué y cuánto tarda.
  assert.equal(a0[0].texto, SALUDO_ARRANQUE);
  assert.match(SALUDO_ARRANQUE, /conocer tu negocio[\s\S]*menos de 5 minutos[\s\S]*¿cómo te llamas\?$/);
  // Sin respuestas rápidas en el nombre ni en el negocio (18/10/2026, 14:00, Martín): ofrecían restos de otra prueba.
  assert.equal(a0[0].opciones, undefined, 'el nombre volvió a ofrecer el de la cuenta');
  const { antes } = mensajesDeArranque({ nombre: 'Martín' }, H);
  assert.deepEqual(antes.map((m) => m.de), ['mako', 'yo', 'mako']);
  assert.equal(antes[1].texto, 'Martín');
  assert.equal(antes[0].opciones, undefined, 'una pregunta ya contestada no vuelve a ofrecer opciones');
  assert.match(antes[2].texto, /Un gusto, Martín/);
  // Tampoco el nombre del alta, aunque parezca un negocio (volvió el 20/10 y el Cerebro lo retiró esa noche).
  assert.equal(antes[2].opciones, undefined, 'el negocio volvió a ofrecer el nombre del alta');
  // Ya no se pregunta el objetivo a 90 días, ni con una conversación que lo había contestado.
  assert.ok(!mensajesDeArranque({ ...QUIEN, objetivo: 'Vender más' }, H).antes.some((m) => m.id === 'arr-objetivo'));
  const fin = mensajesDeArranque({ nombre: 'M', negocio: 'N', crmTipo: 'llamada' }, { ...H, loQueVende: true, faseGuardada: true }).despues;
  assert.deepEqual(fin[fin.length - 1].opciones, [...ORIGENES], 'la pregunta del final, de un toque');
  // En la oferta, los mensajes del arranque terminan en el pase (lo demás lo dice Offer).
  const { antes: aOf, despues } = mensajesDeArranque(QUIEN, H);
  assert.equal(aOf[aOf.length - 1].id, 'arr-oferta');
  assert.deepEqual(despues, []);
});

test('el nombre del workspace no se ofrece como «tu negocio», sea lo que sea (Martín, 18/10: sin respuestas rápidas)', () => {
  for (const nombreWorkspace of ['martin@x.com', 'Martín Koncke', 'Negocio que Escala']) {
    const { antes } = mensajesDeArranque({ nombre: 'Martín' }, { ...H, nombreWorkspace });
    assert.equal(antes[antes.length - 1].opciones, undefined, `«${nombreWorkspace}»`);
  }
  assert.equal(primerNombre('  Martín  Koncke '), 'Martín');
});

test('el CRM: primero cómo le llegan (por chat), después el funnel que le recomienda, con la tarjeta', () => {
  const h = { ...H, loQueVende: true, faseGuardada: true, canalNegocio: 'conversaciones' as const };
  // Desde el 5/11/2026 (plan.md §3.1, pasos 9 y 10): «¿Cómo te llegan hoy los clientes?» reemplaza a «¿Te sirven?», que
  // preguntaba una acción, y la recomendación la escribe `recomendarFunnel` (tests/onboarding-funnel-recomendado.test.ts).
  const pide = mensajesDeArranque(QUIEN, h).despues.at(-1)!;
  assert.equal(pide.texto, PREGUNTA_ENTRADA);
  assert.deepEqual(leerRespuesta(QUIEN, h, { opcion: 0, opcionTexto: 'Te escriben' }), { ok: true, patch: { entrada: 'chat_entrante' } });
  const e = { ...QUIEN, entrada: 'chat_entrante' as const };
  const crm = mensajesDeArranque(e, h).despues.find((m) => m.id === 'arr-crm');
  assert.ok(crm && crm.tarjeta === 'crm');
  // «Sí, ese» acepta el recomendado (en la tarjeta), y «Ver los 12» abre la lista.
  assert.equal(crm.opciones?.[0], CRM_SI);
  assert.ok(crm.opciones?.includes(VER_OTROS_TIPOS));
  assert.match(crm.texto, /^Hay 12 funnels en MaKo\. Para ti: «Instagram orgánico»\./);
  assert.deepEqual(leerRespuesta(e, h, { opcion: 0, opcionTexto: CRM_SI }), { ok: true, patch: { crmTipo: 'instagram' } });
  const todos = mensajesDeArranque({ ...e, crmVerTodos: true }, h).despues.find((m) => m.id === 'arr-crm');
  assert.equal(todos?.opciones?.[0], 'Instagram orgánico', 'con la lista abierta, primero el recomendado');
  assert.equal(tipoRecomendado(null).id, 'llamada', 'sin canal manda la llamada de venta (el marco es de alto ticket)');
  assert.equal(tiposOfrecidos('carrito', false).tipos[0].id, 'carrito');
  assert.equal(tiposOfrecidos('llamadas', true).tipos.length, TIPOS_CRM.length);
  assert.equal(tiposOfrecidos('llamadas', true).hayMas, false);
});

// ── Las respuestas ──────────────────────────────────────────────────────────
test('las respuestas: texto libre, una opción, el código y «ahora no»', () => {
  assert.deepEqual(leerRespuesta({}, H, { texto: '  Martín  ' }), { ok: true, patch: { nombre: 'Martín' } });
  assert.equal(leerRespuesta({}, H, { opcion: 0 }).ok, false, 'el nombre no tiene opciones: se escribe');
  assert.equal(leerRespuesta({}, H, { texto: '   ' }).ok, false);
  const h = { ...H, loQueVende: true, faseGuardada: true };
  assert.deepEqual(leerRespuesta(QUIEN, h, { opcion: 0 }), { ok: true, patch: { crmTipo: 'llamada' } });
  const verOtros = mensajesDeArranque(QUIEN, h).despues.find((m) => m.id === 'arr-crm')!.opciones!.indexOf(VER_OTROS_TIPOS);
  assert.deepEqual(leerRespuesta(QUIEN, h, { opcion: verOtros }), { ok: true, patch: { crmVerTodos: true } });
  assert.equal(leerRespuesta(QUIEN, h, { texto: 'cualquier cosa' }).ok, false, 'el CRM se elige, no se escribe');
  const conTel = { ...h, conTelefono: true };
  const tel = { ...QUIEN, crmTipo: 'llamada' as const };
  assert.deepEqual(leerRespuesta(tel, conTel, { opcion: 0 }), { ok: true, patch: { telefono: 'postergado' } });
  assert.equal(mensajesDeArranque(tel, conTel).antes.find((m) => m.id === 'arr-telefono')?.opciones?.[0], AHORA_NO);
  const cod = { ...tel, telefono: 'codigo' as const, telefonoNumero: '+5215512345678' };
  // Cambiar el número también olvida que se pidió por mensaje entrante: el número nuevo se vuelve a pedir de cero.
  assert.deepEqual(leerRespuesta(cod, conTel, { opcion: 0 }), { ok: true, patch: { telefono: undefined, telefonoNumero: undefined, telefonoEntrante: undefined } });
  const entrante = { ...cod, telefonoEntrante: true };
  assert.deepEqual(leerRespuesta(entrante, conTel, { opcion: 0 }), { ok: true, patch: { telefono: undefined, telefonoNumero: undefined, telefonoEntrante: undefined } });
  const tipeado = leerRespuesta(entrante, conTel, { texto: 'ABC123' });
  assert.equal(tipeado.ok, false, 'con el mensaje entrante el código no se tipea en la app');
  assert.equal(mensajesDeArranque(cod, conTel).antes.find((m) => m.id === 'arr-codigo')?.opciones?.[0], CAMBIAR_NUMERO);
});

test('el diagnóstico del modo plan: el canal va antes del volumen, y al completarlo devuelve las respuestas', () => {
  let e: EstadoArranque = { ...QUIEN, queHace: 'Consultoría' };
  const iVol = PREGUNTAS.findIndex((q) => q.id === 'volumen');
  let completo: number[] | undefined;
  for (let paso = 0; paso < PREGUNTAS.length + 1; paso++) {
    const p = siguientePreguntaFase(e);
    assert.ok(p, `se cortó en el paso ${paso}`);
    if (p.tipo === 'canal') assert.equal((e.faseResp ?? []).filter((x) => x >= 0).length, iVol, 'el canal va justo antes del volumen');
    const r = leerRespuesta(e, PLAN, { opcion: 1 });
    assert.ok(r.ok, `paso ${paso}: ${!r.ok ? r.error : ''}`);
    e = { ...e, ...r.patch };
    if (r.fase) completo = r.fase;
  }
  assert.equal(e.canal, CANALES[1].id);
  assert.deepEqual(completo, PREGUNTAS.map(() => 1));
  assert.equal(siguientePreguntaFase(e), null);
  // Una respuesta libre que no es una opción no se acepta: el diagnóstico se CALCULA.
  assert.equal(leerRespuesta({ ...QUIEN, queHace: 'x' }, PLAN, { texto: 'mucho' }).ok, false);
});

test('después de lo que vende, el diagnóstico de fase lo pregunta el arranque, sin repetir lo que ya contestó en Offer', () => {
  // Desde el 17/10 la conversación del onboarding no pregunta la fase: la pregunta el arranque con sus opciones.
  // Una conversación que venía de antes puede traer respuestas (la de Offer las hacía adentro): no se repiten.
  const vende: HechosArranque = { ...H, loQueVende: true, faseGuardada: false };
  assert.equal(etapaDeArranque(QUIEN, vende), 'fase');
  assert.equal(etapaDeArranque(QUIEN, { ...vende, faseGuardada: true }), 'crm');

  // En Offer contestó el canal y la primera pregunta: el arranque no las repite.
  const q0 = PREGUNTAS[0].id;
  const conOffer: HechosArranque = { ...vende, faseOffer: { respuestas: { [q0]: 2 }, canal: CANALES[1].id } };
  const { despues } = mensajesDeArranque(QUIEN, conOffer);
  const ultima = despues[despues.length - 1];
  assert.equal(despues[0].id, 'arr-pdf');
  // La confirmación del PDF (18/10/2026) va contestada antes de la fase.
  assert.equal(despues[1].id, 'arr-pdf-r');
  assert.equal(despues[2].id, 'arr-fase');
  assert.ok(!despues.some((m) => m.id === 'arr-fase-canal' || m.id === 'arr-fase-0'), 'repitió lo que ya contestó en Offer');
  assert.equal(ultima.id, 'arr-fase-1');
  assert.ok(ultima.opciones?.length, 'la pregunta va con sus opciones');

  // Contesta lo que falta: se guarda el diagnóstico con lo de Offer adentro y el canal de Offer.
  let e: EstadoArranque = { ...QUIEN };
  let r = leerRespuesta(e, conOffer, { opcion: 0 });
  for (let paso = 0; r.ok && !r.fase && paso < PREGUNTAS.length; paso++) {
    e = { ...e, ...r.patch };
    r = leerRespuesta(e, conOffer, { opcion: 0 });
  }
  assert.ok(r.ok && r.fase, 'no completó el diagnóstico');
  if (!r.ok) return;
  assert.equal(r.fase![0], 2, 'perdió la respuesta que dio en Offer');
  assert.deepEqual(r.fase!.slice(1), PREGUNTAS.slice(1).map(() => 0));
  assert.equal(r.faseCanal, CANALES[1].id);
  // En el estado queda sólo lo que contestó ACÁ.
  assert.equal(r.patch.faseResp?.[0], -1);
  // La ruta guarda con ese canal.
  assert.match(sinComentarios(leer('app/api/onboarding/arranque/route.ts')), /setDiagnosticoFase\(lectura\.fase, lectura\.faseCanal \?\? /);
  assert.match(sinComentarios(leer('lib/onboarding-arranque-server.ts')), /faseOffer: sesion \? .*estadoDiagnostico\(sesion\.mensajes/);
});

// ── El perfil del negocio que queda escrito ─────────────────────────────────
test('el brief sale de la conversación y NUNCA pisa lo que el negocio ya tenía', () => {
  const v = (valor: string) => ({ valor, fuente: 'chat' as const, at: '2026-10-16' });
  // El objetivo ya no se pregunta (18/10/2026), pero el de una conversación de antes sigue llegando al brief.
  const brief = briefDesdeArranque({
    estado: { ...QUIEN, objetivo: 'Vender más cada mes' },
    piezas: { cliente: v('Dueños de pyme'), problema: v('Todo pasa por ellos'), resultado: v('Delegar en 90 días'), precio: v('USD 1.500'), entregables: v('Mentoría') },
    propuesta: { nombre: 'Programa Dueño Libre', frase: 'Delegar en 90 días sin perder clientes' } as never,
    cuello: 'Consigo pocos clientes potenciales',
  });
  assert.equal(brief.negocio_objetivo, 'Vender más cada mes');
  assert.equal(brief.negocio_que_hace, 'Delegar en 90 días sin perder clientes');
  assert.equal(brief.negocio_freno, 'Consigo pocos clientes potenciales');
  assert.equal(brief.oferta_nombre, 'Programa Dueño Libre');
  // El precio NO se pasa a número (lib/ofertas.ts: «EL PRECIO DEL BRIEF NO SE PARSEA A NÚMERO»): «$3k» daba 3.
  assert.equal(brief.oferta_ticket, undefined, 'el precio dicho como texto se convirtió en un número de dólares');
  assert.equal(brief.avatar_quien, 'Dueños de pyme');
  assert.equal(brief.oferta_garantia, undefined, 'lo que no se sabe no se escribe vacío');
  const fundido = fundirBrief({ avatar_quien: 'Lo que escribió el dueño', negocio_objetivo: '' }, brief);
  assert.equal(fundido.avatar_quien, 'Lo que escribió el dueño', 'pisó una respuesta del negocio');
  assert.equal(fundido.negocio_objetivo, 'Vender más cada mes', 'una respuesta vacía sí se llena');
});

test('lo que lleva «[completar]» no se escribe: los prompts lo leerían como un dato', () => {
  assert.equal(sinMarca('Factura [completar] al mes'), '');
  assert.equal(sinMarca('  Delegar en 90 días '), 'Delegar en 90 días');
  const v = (valor: string) => ({ valor, fuente: 'chat' as const, at: '2026-10-16' });
  const brief = briefDesdeArranque({
    estado: { ...QUIEN, objetivo: 'Llegar a [completar] clientes' },
    piezas: { resultado: v('Facturar [completar] en 90 días'), cliente: v('Dueños de pyme') },
    propuesta: { nombre: 'Programa [completar]', frase: 'Factura [completar] al mes' } as never,
  });
  assert.deepEqual(Object.keys(brief).sort(), ['avatar_quien'], 'entró al brief un texto con la marca');
});

test('el producto que deja el cierre no lleva un precio inventado, y la oferta no se duplica', () => {
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const cerrar = bloque(server, 'export async function cerrarArranque', 'export function tipoValido');
  assert.match(cerrar, /monto_usd: null/, 'el monto del producto (el del link de cobro) volvió a salir de un texto');
  assert.doesNotMatch(cerrar, /precioDesdeTexto|parseFloat|Number\(/);
  // guardarComoOferta siembra la principal DESDE EL BRIEF: con el nombre ya escrito, dos ofertas iguales.
  assert.ok(cerrar.indexOf('await guardarComoOferta(') > 0 && cerrar.indexOf('await guardarComoOferta(') < cerrar.indexOf('await saveAnswers('),
    'el brief se escribe antes de guardar la oferta: cada cliente nuevo queda con dos ofertas iguales');
});

test('una opción de una pregunta vieja no contesta la de hoy', () => {
  const h = { ...H, loQueVende: true, faseGuardada: true, conTelefono: true };
  const tel = { ...QUIEN, crmTipo: 'llamada' as const };
  // La pestaña vieja muestra el CRM («Llamada de venta» es la 0) y el server ya está en el teléfono.
  const r = leerRespuesta(tel, h, { opcion: 0, opcionTexto: 'Llamada de venta' });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.cambio, 'se anotó «Ahora no» por un clic en otra pregunta');
  // Con el texto que coincide, se anota.
  assert.deepEqual(leerRespuesta(tel, h, { opcion: 0, opcionTexto: AHORA_NO }), { ok: true, patch: { telefono: 'postergado' } });
  // Y la ruta devuelve la conversación de hoy, sin anotar.
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  assert.match(ruta, /lectura\.cambio\) return NextResponse\.json\(\{ ok: false, error: lectura\.error, vista: await vistaArranque\(\) \}, \{ status: 409 \}\)/);
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /opcionTexto: texto/, 'la pantalla dejó de mandar el texto de la opción');
});

test('un email no se ofrece como nombre, y los reportes van al contacto del negocio, no al que mira', () => {
  const { antes } = mensajesDeArranque({}, { ...H, nombreCuenta: 'cliente@negocio.com' });
  assert.equal(antes[0].opciones, undefined, 'ofreció un email como «¿Cómo te llamo?»');
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  const tel = bloque(ruta, 'const pedirCodigo = async', "case 'responder':");
  assert.doesNotMatch(tel, /getUsuarioActual/, 'el email de los reportes volvió a ser el de quien está logueado');
  assert.match(tel, /email: previo\?\.email \|\| perfil\?\.email/);
});

test('un fallo pasajero no encierra: «no pude leer» no abre otra conversación, y todo se reintenta sin recargar', () => {
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(chat, /abrirEnFunnel: vista\.modo === 'oferta' && vista\.etapa === 'oferta' && !vista\.tieneSesion && !vista\.sesionCaida/,
    'una lectura caída vuelve a abrir una conversación nueva (rehacer la oferta)');
  assert.match(chat, /if \(!aplicar\(r\)\) ligando\.current = null;/, 'si anotar la conversación falla, nunca se reintenta');
  assert.match(chat, /setIntentoCierre\(/, 'el cierre que falla no tiene reintento');
  assert.match(chat, /action: 'preparar'/, 'sin funnel principal, nada lo vuelve a intentar');
  assert.match(chat, /: 'sin'\)/, 'sin link del plan, la tarjeta queda «armando» para siempre');
  // NUNCA «Conectar mi propia IA» en el onboarding (18/10/2026, Martín): usa el crédito de la plataforma. Roturas
  // (romper-propia-ia.js; base 26/0): vuelve el botón → 25/1 · vuelve la frase en el archivero → 25/1.
  assert.doesNotMatch(chat, /Conectar mi propia IA|BotonIntegracion|errorExtra/, 'el onboarding vuelve a ofrecer conectar la propia IA');
  assert.doesNotMatch(leer('app/api/onboarding/archivero/route.ts'), /propia IA/, 'el error del archivero del onboarding ofrece conectar la propia IA');
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(server, /leerSesion\(e\.sesionId\)\.catch\(\(\) => \{ sesionCaida = true; return null; \}\)/);
  assert.match(sinComentarios(leer('app/offer/OfferApp.tsx')), /label: 'Reintentar', onClick: \(\) => \{ setErrorSelector\(null\); void nuevaSesion\(funnelArranque, null\); \}/);
});

// ── La pantalla: el chat del arranque sobre el motor de Offer ───────────────
test('qué contesta el composer en cada etapa, y dónde va la respuesta optimista', () => {
  assert.equal(mandaElArranque('nombre'), true);
  assert.equal(mandaElArranque('oferta'), false, 'en lo que vende contesta Offer');
  assert.equal(mandaElArranque('fase'), true);
  assert.equal(mandaElArranque('listo'), true, 'después de «¡Listo!» un turno de Offer quedaría arriba de la tarjeta final');
  assert.equal(ladoDeLaPregunta('objetivo'), 'antes');
  assert.equal(ladoDeLaPregunta('crm'), 'despues');
  // El diagnóstico: antes en modo plan, después de lo que vende en modo oferta.
  assert.equal(ladoDeLaPregunta('fase', 'plan'), 'antes');
  assert.equal(ladoDeLaPregunta('fase', 'oferta'), 'despues');
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /ladoDeLaPregunta\(vista\.etapa, vista\.modo\)/);
  assert.equal(SESION_VACIA.id, 0);
  assert.deepEqual(aMensajeOffer({ id: 'arr-x', de: 'mako', texto: 'Hola', opciones: ['A'] }), { id: 'arr-x', de: 'mako', texto: 'Hola', at: '', opciones: ['A'] });
});

// ── El cableado ─────────────────────────────────────────────────────────────
test('la página /onboarding dibuja el chat de arranque, y el wizard ya no existe', () => {
  const page = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(page, /<ChatArranque inicial=\{vista\}/);
  for (const viejo of ['OnboardingWizard.tsx', 'Bienvenida.tsx', 'Listo.tsx']) {
    assert.ok(!existsSync(join(RAIZ, 'app/onboarding', viejo)), `volvió ${viejo}`);
  }
});

test('el onboarding se cierra por UNA puerta: la del wizard y la del chat son la misma regla', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/route.ts'));
  const paso = bloque(ruta, "case 'paso':", "case 'simular':");
  assert.match(paso, /await cerrarPasosOnboarding\(/);
  assert.doesNotMatch(paso, /onboardingCompleto\(|s\.status = 'done'/, 'la acción paso volvió a decidir el cierre por su cuenta');
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const cerrar = bloque(server, 'export async function cerrarArranque', 'export function tipoValido');
  assert.match(cerrar, /cierreDePasos\(h\.pasosCapa/);
  assert.match(cerrar, /await cerrarPasosOnboarding\(cambios, quien\)/);
  const estado = sinComentarios(leer('lib/onboarding-state.ts'));
  assert.match(estado, /aplicarCambiosDePaso\(s, cambios, pasos/);
  // Lee ESTRICTO: con la base caída, la lectura tolerante da el estado inicial y cerrar un paso encima
  // guardaba un onboarding a medio hacer sobre uno terminado.
  const puerta = bloque(estado, 'export async function cerrarPasosOnboarding', 'export async function pasosDeCapaActual');
  assert.match(puerta, /await getEstadoOnboardingEstricto\(\)/);
  assert.doesNotMatch(puerta, /patchEstadoOnboarding|getEstadoOnboarding\(\)/, 'la puerta del cierre volvió a leer tolerante');
});

test('la ruta del arranque: la puerta primero, el CRM ANTES de guardar la elección, lo guardado leído estricto', () => {
  const ruta = sinComentarios(leer('app/api/onboarding/arranque/route.ts'));
  for (const fn of ['export async function GET()', 'export async function POST(']) {
    const cuerpo = bloque(ruta, fn, '\n}\n');
    assert.match(cuerpo.slice(0, 160), /await wsDelOnboarding\(\)/, `${fn} no pregunta primero quién es`);
  }
  const responder = bloque(ruta, "case 'responder':", "case 'sesion':");
  assert.ok(responder.indexOf('sembrarCrmPrincipal(') < responder.indexOf('guardarEstadoArranque(patch)'), 'la elección del CRM se guarda aunque la siembra falle');
  assert.match(ruta, /getSettingEstricto\('onboarding\.arranque'\)/);
  const sesion = bloque(ruta, "case 'sesion':", "case 'telefono':");
  assert.match(sesion, /s\.funnelId !== funnelDefault/, 'la conversación de la oferta tiene que ser la del funnel principal');
});

test('el CRM principal se siembra sólo si está intacto, y nunca con la lectura caída', () => {
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  const sembrar = bloque(server, 'export async function sembrarCrmPrincipal', 'export async function asegurarFunnelPrincipal');
  const iError = sembrar.indexOf("actual.origen === 'error'");
  const iIntacto = sembrar.indexOf('mismoPipeline(actual.pipeline, DEFAULT_PIPELINE)');
  const iGuardar = sembrar.indexOf('await saveFunnelDefault(');
  assert.ok(iError > 0 && iIntacto > iError && iGuardar > iIntacto, 'la siembra no mira la lectura y el «intacto» antes de escribir');
  assert.doesNotMatch(sembrar, /crearCrm\(|crearFunnel\(/, 'el primer CRM es el principal: un CRM nuevo arrancaría vacío');
  // El brief se funde leyendo ESTRICTO (con la base caída, saveAnswers sobre {} borraría el brief).
  const cerrar = bloque(server, 'export async function cerrarArranque', 'export function tipoValido');
  assert.match(cerrar, /await mapaParaEscribir\(ANSWERS_KEY\)/);
  assert.match(cerrar, /fundirBrief\(previas,/);
});

test('el login de Google llena el nombre SÓLO si está vacío: el que eligió la persona no se pisa', () => {
  const src = sinComentarios(leer('lib/usuarios.ts'));
  const reg = bloque(src, 'export async function registrarLogin', 'export async function contarUsuarios');
  assert.doesNotMatch(reg, /patch\.nombre\s*=/, 'el nombre volvió al update de todos los logins');
  // Vacío, null, o PROVISORIO (un email: las altas sin nombre lo guardan así y el primer login lo cambiaba).
  assert.match(reg, /\.update\(\{ nombre \}\)[\s\S]*\.or\('nombre\.is\.null,nombre\.eq\.,nombre\.ilike\.\*@\*'\)/);
});

test('el chat no desaparece nunca: armar es un mensaje del hilo y la oferta se ve en una ventana encima', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.doesNotMatch(app, /setVista\(|<Generando\b/, 'volvió una vista que reemplaza al chat');
  assert.match(app, /<Modal titulo="Tu oferta"[\s\S]*<Conclusion/, 'la oferta dejó de abrirse en una ventana encima del chat');
  assert.match(app, /armando=\{armandoEnChat\}/);
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(chat, /<GenerandoEnChat /);
  // En el arranque, «Probarlo» (que sale al Dashboard) no se ofrece: esa pantalla rebota al onboarding.
  assert.match(app, /conProbar=\{!arranque\}/);
});

test('la entrada: sin el grafo, ESPERA EL CLIC (o Enter), sin anillos, sin movimiento si se pide, y aterriza en la foto', () => {
  // 17/10/2026, Martín: «haz una buena entrada de la criatura de MaKo tipo motion graphics, y que al clickearla recién
  // pase al siguiente mensaje». El 18/10 a la mañana pidió que avanzara sola; a las 14:00 lo revirtió: vuelve a pedir el
  // clic, y la animación queda igual («sin el círculo azul alrededor»). Roturas (18/10, romper-clic.js; base 26/0): vuelve
  // el avance solo → 25/1 · sin «Tócame para empezar» → 25/1.
  assert.ok(!existsSync(join(RAIZ, 'app/onboarding/IntroMako.tsx')), 'volvió la animación del grafo');
  const sin = sinComentarios(leer('app/onboarding/EntradaMako.tsx'));
  assert.doesNotMatch(sin, /cerebro-modelo|<svg/, 'volvió el grafo');
  assert.doesNotMatch(sin, /fetch\(|getSetting|await /, 'la entrada no lee datos');
  // No avanza sola: el único temporizador es el que le da el foco al botón.
  assert.equal((sin.match(/setTimeout\(/g) ?? []).length, 1);
  assert.match(sin, /setTimeout\(\(\) => boton\.current\?\.focus\(/, 'la entrada volvió a avanzar sola');
  assert.match(sin, /<button ref=\{boton\} type="button" className="en-boton" onClick=\{empezar\} aria-label="Empezar con MaKo">/, 'no se puede tocar (ni con el teclado)');
  assert.doesNotMatch(sin, /className="en-anillo/, 'volvió el círculo azul alrededor');
  assert.match(sin, /Tócame para empezar/, 'sin la invitación a tocarla, no se sabe que espera el clic');
  // 18/10/2026 (punto 1): tocar CUALQUIER lado empieza, y sin el anillo azul del foco. Roturas (romper-capa.js; base 26/0):
  // sin el clic en la capa → 25/1 · vuelve el anillo → 25/1.
  assert.match(sin, /role="presentation" onClick=\{empezar\}>/, 'sólo se puede empezar tocando la estrella');
  assert.match(sin, /\.en-boton:focus, \.en-boton:focus-visible \{ outline: none; \}/, 'volvió el círculo azul del foco');
  assert.doesNotMatch(sin, /\.en-boton:focus-visible \{ outline: 3px solid var\(--primary\)/);
  assert.match(sin, /if \(!el \|\| !caja \|\| caja\.width === 0 \|\| reduce\) \{ alFin\.current\(\); return; \}/, 'con movimiento reducido no corre');
  // Desde el 21/10/2026 el destino es una prop (el teléfono la manda a la barra), y el del onboarding sigue siendo la foto del chat.
  assert.match(sin, /destino = '\[data-mako-foto\]'/);
  assert.match(sin, /querySelector<HTMLElement>\(destino\)/);
  assert.match(sin, /top: var\(--barra-agencia, 0px\)/, 'la entrada queda debajo de la barra de «Inspeccionar»');
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(chat, /data-mako-foto/, 'el chat no tiene dónde aterrizar a MaKo');
  assert.match(chat, /\{intro && <EntradaMako onFin=/);
  // El CSS vive en template literals: una comilla invertida adentro lo corta y rompe el build entero.
  for (const [archivo, constante] of [['app/onboarding/EntradaMako.tsx', 'const CSS_ENTRADA = '], ['app/onboarding/ChatArranque.tsx', 'const CSS_ARRANQUE = ']]) {
    const src = leer(archivo);
    const i = src.indexOf(constante);
    assert.ok(i > 0, `no encuentro ${constante}`);
    assert.equal((src.slice(i).match(/`/g) ?? []).length, 2, `${archivo}: comillas invertidas DENTRO del CSS`);
  }
  // La salida del modo agencia (el aviso de arriba, z 300) no queda tapada por el onboarding.
  const banner = leer('app/_components/ImpersonationBanner.tsx');
  const zBanner = Number(/zIndex: (\d+)/.exec(banner)?.[1]);
  for (const archivo of ['app/onboarding/EntradaMako.tsx', 'app/onboarding/ChatArranque.tsx', 'app/onboarding/CriaturaMako.tsx']) {
    for (const m of leer(archivo).matchAll(/z-index: (\d+)/g)) {
      assert.ok(Number(m[1]) < zBanner, `${archivo} tapa la salida del modo agencia (z ${m[1]} ≥ ${zBanner})`);
    }
  }
});

test('modo claro, sin recuadro, como la referencia, y MaKo reacciona a lo que contestan', () => {
  // «El onboarding, que sea white mode, como todo» y «sin recuadro de chat, sin el bloque» (Martín, 17/10/2026).
  const page = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.doesNotMatch(page, /TemaOscuro/, 'el onboarding vuelve a forzar el oscuro');
  const chat = leer('app/onboarding/ChatArranque.tsx');
  assert.match(chat, /\.arr-capa \.of-hilo \{ background: transparent !important; border: 0 !important; border-radius: 0 !important; \}/, 'volvió el recuadro del chat');
  assert.match(chat, /<span className="arr-sub">Tu onboarding<\/span>/);
  assert.match(chat, /@media \(max-width: 640px\)/, 'sin medidas para el celular');
  const sin = sinComentarios(chat);
  assert.match(sin, /reaccionar\(salio \? 'contenta' : 'duda'/, 'MaKo no reacciona a la respuesta');
  assert.match(sin, /reaccion=\{ocupado \? 'piensa' : gesto \?\? 'escucha'\}/);
  // La cara pasa por el ADAPTADOR: nada dibuja una criatura directo.
  assert.doesNotMatch(sin, /<MunecoMako |<Muneco /);
});

test('la cara de MaKo es la ESTRELLA del Ops Center, no un dibujo propio ni el círculo', () => {
  // 18/10/2026, Martín (por el Cerebro): «la estrella NO es "del próximo Ops Center". Ya existe: la usan la sidebar y el
  // Ops Center... Reusá ese componente en la entrada del onboarding en lugar del círculo, sin crear una nueva».
  // Roturas (18/10, arnés romper-estrella.js; base 26/0): el adaptador sin ASPECTO_MAKO → 25/1 · vuelve el muñeco
  // redondo → 25/1 · la entrada dibuja otra cosa → 25/1.
  const cria = sinComentarios(leer('app/onboarding/CriaturaMako.tsx'));
  assert.match(cria, /import \{ Criatura \} from '@\/app\/admin\/operaciones\/Criatura';/);
  assert.match(cria, /<Criatura aspecto=\{ASPECTO_MAKO\} titulo="MaKo" size=\{size\} reaccion=\{reaccion\}/, 'la cara no es la estrella del Centro');
  assert.doesNotMatch(cria, /<svg|<style>|<Muneco /, 'el onboarding volvió a dibujar su propia criatura');
  assert.ok(!existsSync(join(RAIZ, 'app/onboarding/MunecoMako.tsx')), 'volvió el muñeco redondo');
  // La entrada y la cabecera usan el adaptador.
  assert.match(sinComentarios(leer('app/onboarding/EntradaMako.tsx')), /<CriaturaMako size=\{120\} reaccion="escucha" \/>/);
});

test('el taller de temas no se monta para un cliente (lo cuidaba el test de la bienvenida de antes)', () => {
  const layout = leer('app/layout.tsx');
  assert.ok(/\{esAdmin && <TemaCandidato \/>\}/.test(layout), 'el taller de temas volvió a montarse para cualquiera');
  assert.ok(/getSesionAdmin/.test(layout), 'el guard del taller dejó de mirar la sesión');
  assert.doesNotMatch(leer('app/onboarding/EntradaMako.tsx'), /\[data-chip-tema\][^\n]*display:\s*none/, 'el onboarding esconde la salida del taller');
});
