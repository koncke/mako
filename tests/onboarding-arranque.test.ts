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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  etapaDeArranque, mensajesDeArranque, leerRespuesta, tiposOfrecidos, tipoRecomendado, pareceNegocio,
  primerNombre, sinMarca, briefDesdeArranque, fundirBrief, siguientePreguntaFase,
  AHORA_NO, CAMBIAR_NUMERO, VER_OTROS_TIPOS, OBJETIVOS_SUGERIDOS,
  type EstadoArranque, type HechosArranque,
} from '../lib/onboarding-arranque';
import { mandaElArranque, ladoDeLaPregunta, SESION_VACIA, aMensajeOffer } from '../app/onboarding/arranque-ui';
import { PREGUNTAS, CANALES } from '../lib/fase-diagnostico';
import { TIPOS_CRM } from '../lib/pipeline';
import { AREAS } from '../lib/cerebro-modelo';

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
  canalNegocio: null, puedeConcluir: false, ofertaLista: false, conCrm: true, conTelefono: true, terminado: false,
};
const PLAN: HechosArranque = { ...H, modo: 'plan', conCrm: false, conTelefono: false };
const QUIEN: EstadoArranque = { nombre: 'Martín', negocio: 'Negocio que Escala', objetivo: 'Vender más cada mes' };

// ── La etapa ────────────────────────────────────────────────────────────────
test('modo oferta: quién es → la oferta → el CRM → el teléfono → espera la oferta → cierra', () => {
  assert.equal(etapaDeArranque({}, H), 'nombre');
  assert.equal(etapaDeArranque({ nombre: 'M' }, H), 'negocio');
  assert.equal(etapaDeArranque({ nombre: 'M', negocio: 'N' }, H), 'objetivo');
  assert.equal(etapaDeArranque(QUIEN, H), 'oferta');
  // Las piezas solas no alcanzan: falta el diagnóstico (lo pregunta el chat de Offer).
  assert.equal(etapaDeArranque(QUIEN, { ...H, puedeConcluir: true }), 'oferta');
  const conOferta = { ...H, puedeConcluir: true, faseGuardada: true };
  assert.equal(etapaDeArranque(QUIEN, conOferta), 'crm');
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada' }, conOferta), 'telefono');
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada', telefono: 'codigo' }, conOferta), 'codigo');
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada', telefono: 'postergado' }, conOferta), 'armando');
  assert.equal(etapaDeArranque({ ...QUIEN, crmTipo: 'llamada', telefono: 'verificado' }, { ...conOferta, ofertaLista: true }), 'cierre');
  assert.equal(etapaDeArranque({}, { ...H, terminado: true }), 'listo');
});

test('modo plan (Project Manager, sin Offer ni CRM): quién es → a qué se dedica → diagnóstico → cierra', () => {
  assert.equal(etapaDeArranque(QUIEN, PLAN), 'que_hace');
  assert.equal(etapaDeArranque({ ...QUIEN, queHace: 'Consultoría' }, PLAN), 'fase');
  assert.equal(etapaDeArranque({ ...QUIEN, queHace: 'Consultoría' }, { ...PLAN, faseGuardada: true }), 'cierre');
});

// ── Lo que dice MaKo ────────────────────────────────────────────────────────
test('cada etapa termina en SU pregunta, con sus opciones; lo contestado se ve como respuesta', () => {
  const { antes: a0 } = mensajesDeArranque({}, H);
  assert.equal(a0.length, 1);
  assert.deepEqual(a0[0].opciones, ['Martín'], 'ofrece el primer nombre de la cuenta');
  const { antes } = mensajesDeArranque({ nombre: 'Martín' }, H);
  assert.deepEqual(antes.map((m) => m.de), ['mako', 'yo', 'mako']);
  assert.equal(antes[1].texto, 'Martín');
  assert.equal(antes[0].opciones, undefined, 'una pregunta ya contestada no vuelve a ofrecer opciones');
  assert.match(antes[2].texto, /Un gusto, Martín/);
  assert.deepEqual(antes[2].opciones, ['Negocio que Escala']);
  const { antes: aObj } = mensajesDeArranque({ nombre: 'M', negocio: 'N' }, H);
  assert.deepEqual(aObj[aObj.length - 1].opciones, [...OBJETIVOS_SUGERIDOS]);
  // En la oferta, los mensajes del arranque terminan en el pase (lo demás lo dice Offer).
  const { antes: aOf, despues } = mensajesDeArranque(QUIEN, H);
  assert.equal(aOf[aOf.length - 1].id, 'arr-oferta');
  assert.deepEqual(despues, []);
});

test('el nombre del workspace no se ofrece como «tu negocio» si es un email o el nombre de la persona', () => {
  assert.equal(pareceNegocio('martin@x.com', 'Martín'), false);
  assert.equal(pareceNegocio('Martín Koncke', 'Martin Koncke'), false, 'el mismo nombre, con o sin acento');
  assert.equal(pareceNegocio('Negocio que Escala', 'Martín'), true);
  assert.equal(primerNombre('  Martín  Koncke '), 'Martín');
});

test('el CRM: la tarjeta va con la pregunta, y propone el tipo de su canal primero', () => {
  const h = { ...H, puedeConcluir: true, faseGuardada: true, canalNegocio: 'conversaciones' as const };
  const { despues } = mensajesDeArranque(QUIEN, h);
  const crm = despues.find((m) => m.id === 'arr-crm');
  assert.ok(crm && crm.tarjeta === 'crm');
  assert.equal(crm.opciones?.[0], 'Conversaciones por chat');
  assert.ok(crm.opciones?.includes(VER_OTROS_TIPOS));
  assert.equal(tipoRecomendado(null).id, 'llamada', 'sin canal manda la llamada de venta (el marco es de alto ticket)');
  assert.equal(tiposOfrecidos('carrito', false).tipos[0].id, 'carrito');
  assert.equal(tiposOfrecidos('llamadas', true).tipos.length, TIPOS_CRM.length);
  assert.equal(tiposOfrecidos('llamadas', true).hayMas, false);
});

// ── Las respuestas ──────────────────────────────────────────────────────────
test('las respuestas: texto libre, una opción, el código y «ahora no»', () => {
  assert.deepEqual(leerRespuesta({}, H, { texto: '  Martín  ' }), { ok: true, patch: { nombre: 'Martín' } });
  assert.deepEqual(leerRespuesta({}, H, { opcion: 0 }), { ok: true, patch: { nombre: 'Martín' } });
  assert.equal(leerRespuesta({}, H, { texto: '   ' }).ok, false);
  const h = { ...H, puedeConcluir: true, faseGuardada: true };
  assert.deepEqual(leerRespuesta(QUIEN, h, { opcion: 0 }), { ok: true, patch: { crmTipo: 'llamada' } });
  const verOtros = mensajesDeArranque(QUIEN, h).despues[0].opciones!.indexOf(VER_OTROS_TIPOS);
  assert.deepEqual(leerRespuesta(QUIEN, h, { opcion: verOtros }), { ok: true, patch: { crmVerTodos: true } });
  assert.equal(leerRespuesta(QUIEN, h, { texto: 'cualquier cosa' }).ok, false, 'el CRM se elige, no se escribe');
  const tel = { ...QUIEN, crmTipo: 'llamada' as const };
  assert.deepEqual(leerRespuesta(tel, h, { opcion: 0 }), { ok: true, patch: { telefono: 'postergado' } });
  assert.equal(mensajesDeArranque(tel, h).despues.find((m) => m.id === 'arr-telefono')?.opciones?.[0], AHORA_NO);
  const cod = { ...tel, telefono: 'codigo' as const, telefonoNumero: '+5215512345678' };
  assert.deepEqual(leerRespuesta(cod, h, { opcion: 0 }), { ok: true, patch: { telefono: undefined, telefonoNumero: undefined } });
  assert.equal(mensajesDeArranque(cod, h).despues.find((m) => m.id === 'arr-codigo')?.opciones?.[0], CAMBIAR_NUMERO);
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

test('armó la oferta antes de terminar el diagnóstico: lo que falta lo pregunta el arranque, sin repetir lo de Offer', () => {
  // Medido en el recorrido del ws3 (16/10): «Armar mi oferta» antes de contestar «¿Dónde cierras la venta?»
  // dejaba la etapa en 'oferta' para siempre, sin la pregunta en pantalla y sin forma de seguir.
  const armada: HechosArranque = { ...H, puedeConcluir: true, ofertaLista: true, faseGuardada: false };
  assert.equal(etapaDeArranque(QUIEN, { ...H, puedeConcluir: true }), 'oferta', 'sin armar, el diagnóstico sigue en la conversación de Offer');
  assert.equal(etapaDeArranque(QUIEN, armada), 'fase');
  assert.equal(etapaDeArranque(QUIEN, { ...armada, faseGuardada: true }), 'crm');

  // En Offer contestó el canal y la primera pregunta: el arranque no las repite.
  const q0 = PREGUNTAS[0].id;
  const conOffer: HechosArranque = { ...armada, faseOffer: { respuestas: { [q0]: 2 }, canal: CANALES[1].id } };
  const { despues } = mensajesDeArranque(QUIEN, conOffer);
  const ultima = despues[despues.length - 1];
  assert.equal(despues[0].id, 'arr-fase');
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
  const brief = briefDesdeArranque({
    estado: QUIEN,
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
  const h = { ...H, puedeConcluir: true, faseGuardada: true };
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
  const tel = bloque(ruta, "case 'telefono':", "case 'preparar':");
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
  assert.match(chat, /<BotonIntegracion servicio="gemini"/, 'si la IA no contesta, no hay salida adentro del chat');
  const server = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(server, /leerSesion\(e\.sesionId\)\.catch\(\(\) => \{ sesionCaida = true; return null; \}\)/);
  assert.match(sinComentarios(leer('app/offer/OfferApp.tsx')), /label: 'Reintentar', onClick: \(\) => \{ setErrorSelector\(null\); void nuevaSesion\(funnelArranque, null\); \}/);
});

// ── La pantalla: el chat del arranque sobre el motor de Offer ───────────────
test('qué contesta el composer en cada etapa, y dónde va la respuesta optimista', () => {
  assert.equal(mandaElArranque('nombre'), true);
  assert.equal(mandaElArranque('oferta'), false, 'en la oferta contesta Offer');
  assert.equal(mandaElArranque('armando'), false);
  assert.equal(mandaElArranque('listo'), true, 'después de «¡Listo!» un turno de Offer quedaría arriba de la tarjeta final');
  assert.equal(ladoDeLaPregunta('objetivo'), 'antes');
  assert.equal(ladoDeLaPregunta('crm'), 'despues');
  // El diagnóstico: antes en modo plan, después de la oferta en modo oferta (lo que faltó tras armarla).
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
  // En el arranque, «Probarlo» (que sale a Experiments) no se ofrece: esa pantalla rebota al onboarding.
  assert.match(app, /conProbar=\{!arranque\}/);
});

test('la animación: los nombres reales del cerebro, salteable, sin movimiento si se pide, y aterriza en la foto del chat', () => {
  const intro = leer('app/onboarding/IntroMako.tsx');
  const sin = sinComentarios(intro);
  assert.match(sin, /import \{ AREAS \} from '@\/lib\/cerebro-modelo'/, 'el grafo dejó de usar los nombres reales de las áreas');
  assert.ok(AREAS.length >= 10);
  assert.doesNotMatch(sin, /fetch\(|getSetting|await /, 'la animación es ficción: no lee datos');
  assert.match(sin, /prefers-reduced-motion: reduce\)'\)\.matches\) \{ onFinRef\.current\(\); return; \}/, 'con movimiento reducido no corre');
  assert.match(sin, /addEventListener\('keydown', saltar\)/, 'una tecla no la saltea');
  assert.match(sin, /onClick=\{\(\) => terminarRef\.current\(\)\}/, 'un clic no la saltea');
  assert.match(sin, /querySelector<HTMLElement>\('\[data-mako-foto\]'\)/);
  assert.match(sinComentarios(leer('app/onboarding/ChatArranque.tsx')), /data-mako-foto/, 'el chat no tiene dónde aterrizar a MaKo');
  // La leyenda entra con una ANIMACIÓN (`both`), que le gana a un opacity estático: su salida tiene que ser
  // otra animación, o queda opaca encima del chat durante todo el vuelo (recorrido en el ws3, 16/10).
  assert.match(sin, /\.im-capa--sale \.im-leyenda \{ animation: im-baja [^}]*forwards; \}/, 'la leyenda no se va con el grafo');
  assert.match(sin, /@keyframes im-baja \{ from \{[^}]*\} to \{[^}]*opacity: 0/);
  // El CSS vive en un template literal: una comilla invertida adentro lo corta y rompe el build entero.
  for (const [archivo, constante] of [['app/onboarding/IntroMako.tsx', 'const CSS_INTRO = '], ['app/onboarding/ChatArranque.tsx', 'const CSS_ARRANQUE = ']]) {
    const src = leer(archivo);
    const i = src.indexOf(constante);
    assert.ok(i > 0, `no encuentro ${constante}`);
    assert.equal((src.slice(i).match(/`/g) ?? []).length, 2, `${archivo}: comillas invertidas DENTRO del CSS`);
  }
  // La salida del modo agencia (el aviso de arriba, z 300) no queda tapada por el onboarding.
  const banner = leer('app/_components/ImpersonationBanner.tsx');
  const zBanner = Number(/zIndex: (\d+)/.exec(banner)?.[1]);
  for (const archivo of ['app/onboarding/IntroMako.tsx', 'app/onboarding/ChatArranque.tsx']) {
    for (const m of leer(archivo).matchAll(/z-index: (\d+)/g)) {
      assert.ok(Number(m[1]) < zBanner, `${archivo} tapa la salida del modo agencia (z ${m[1]} ≥ ${zBanner})`);
    }
  }
});

test('el taller de temas no se monta para un cliente (lo cuidaba el test de la bienvenida de antes)', () => {
  const layout = leer('app/layout.tsx');
  assert.ok(/\{esAdmin && <TemaCandidato \/>\}/.test(layout), 'el taller de temas volvió a montarse para cualquiera');
  assert.ok(/getSesionAdmin/.test(layout), 'el guard del taller dejó de mirar la sesión');
  assert.doesNotMatch(leer('app/onboarding/IntroMako.tsx'), /\[data-chip-tema\][^\n]*display:\s*none/, 'el onboarding esconde la salida del taller');
});
