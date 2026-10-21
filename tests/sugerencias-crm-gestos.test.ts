// =============================================================================
// Sugerencias de MaKo en el CRM: «repites un gesto» (clase 2) y «llega algo nuevo» (clase 4) (20/10/2026)
// =============================================================================
// Martín, 13/10 pts 2 y 3: sugerencias «inteligentes y personalizadas». El mapa (docs/sugerencias-mako-crm.md) tiene
// cuatro clases; el motor cubría la 1 y la 3 (docs/pedidos-crm.md, D4). Ahora:
//   · clase 2: mover a mano 5 o más leads de A a B en 14 días → «¿Lo hago solo?» (por el chat); marcar 3 No show a mano →
//     la plantilla de reagendar, con el porqué («marcaste 3 No show»);
//   · clase 4: el primer DM de Instagram o Messenger → que MaKo los conteste (las plantillas que ya existen);
//   · (20/10, noche) el mismo mensaje a 3 leads de una etapa, la landing o campaña sin CRM y el lead que volvió;
//   · el server cuenta SÓLO los gestos de una persona (autor con email) y lo que no puede leer se abstiene.
//
// PROBADO ROMPIÉNDOLO (20/10/2026), con el archivo en 4 / 0, de a una rotura y restaurada:
//   · el umbral de movimientos en 1 (cualquier movimiento sugería)                 → 3 / 1
//   · la clase 2 DESPUÉS de la 1 (el No show perdía su porqué)                     → 3 / 1
//   · el server contando también lo que hizo MaKo (sin el filtro del email)        → 3 / 1
// Y Fathom pegado a mano (20/10, después), con el archivo en 5 / 0: sin mirar si Fathom ya está conectado → 4 / 1.
// Y los tres que faltaban (20/10, noche), con el archivo en 8 / 0, de a una rotura y restaurada:
//   · el mismo mensaje contado por ENVÍO y no por lead (tres al mismo lead sugerían)   → 7 / 1
//   · sin el mínimo de letras («ok, gracias» a tres leads era una secuencia)          → 7 / 1
//   · el texto comparado CON el nombre del lead («Hola Ana» ≠ «Hola Juan»)            → 7 / 1
//   · el lead que volvió con `/crm?lead=` (/crm no lee ese parámetro: no abría nada)   → 7 / 1
//   · el email contado sin `autor` (los de una automatización también)               → 7 / 1
//   · `landing.config` leído con `getSetting` (caído = TODA landing «sin CRM»)         → 7 / 1
//   · la visita del MISMO día que entró contada como «volvió»                         → 7 / 1
// Y lo que encontró la revisión del 21/10/2026 (archivo en 10 / 0, una rotura por vez):
//   · el id de «mover a mano» con «>» (la ruta lo rechazaba: «Ahora no» no callaba)                  → 9 / 1
//   · la ruta con su propia regex en vez de `ID_SUGERENCIA`                                           → 9 / 1
//   · un play del VSL el MISMO día del alta contado como volver                                      → 9 / 1
//   · las visitas de prueba (`?mko_test`) contadas                                                    → 9 / 1
//   · el lead PRUEBA de la prueba del Pixel contado                                                   → 9 / 1
// Correr: node --import tsx --test tests/sugerencias-crm-gestos.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sugerenciasDelCrm, textoComparable, idGestoMover, idSinCrm, ID_SUGERENCIA, conCallada, parsearCalladas, estaCallada, claveCallada,
  type EntradaSugerencias,
} from '../lib/sugerencias-crm';
import { generateFunnel, DEFAULT_PIPELINE } from '../lib/pipeline';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const { stages, transitions } = generateFunnel(DEFAULT_PIPELINE);
const HOY = '2026-10-20';
const base = (o: Partial<EntradaSugerencias> = {}): EntradaSugerencias => ({
  funnel: { id: 7, canal: 'llamadas', entradas: ['landing'], productoId: 3, etapasEntrega: ['onboarding'] },
  etapas: stages, transiciones: transitions, plazos: {},
  automatizaciones: [], leads: [], cuotas: { vencidas: 0, pendientes: 0 },
  conectado: { whatsapp: true, fathom: true }, hoy: HOY, ahora: Date.parse(`${HOY}T15:00:00Z`), ...o,
});
const mov = (desde: string, hacia: string, n: number) => Array.from({ length: n }, () => ({ desde, hacia }));

test('clase 2: mover a mano 5 leads de A a B lo ofrece por el chat; 4 no, y ganar o perder no es rutina', () => {
  const s = sugerenciasDelCrm(base({ gestos: { movimientos: [...mov('lead', 'agenda', 5), ...mov('agenda', 'ganado', 9), ...mov('lead', 'perdido', 9)], noShowsAMano: 0 } }), 100);
  const g = s.find((x) => x.id === idGestoMover('lead', 'agenda'));
  assert.ok(g, 'cinco movimientos de A a B ofrecen hacerlo solo');
  assert.equal(g.clase, 2);
  assert.equal(g.accion.tipo, 'chat');
  assert.match(g.texto, /Hace 5 veces que mueves de «.+» a «.+»\. ¿Lo hago solo\?/);
  assert.ok(!s.some((x) => x.id === idGestoMover('agenda', 'ganado') || x.id === idGestoMover('lead', 'perdido')), 'ganar o perder son decisiones');
  const cuatro = sugerenciasDelCrm(base({ gestos: { movimientos: mov('lead', 'agenda', 4), noShowsAMano: 0 } }), 100);
  assert.ok(!cuatro.some((x) => x.clase === 2), 'con 4 no es un gesto repetido');
  assert.ok(!sugerenciasDelCrm(base(), 100).some((x) => x.clase === 2), 'sin historial leído, la clase 2 se calla');
});

test('clase 2: tres No show a mano ofrecen reagendar, con su porqué (gana a la de la clase 1)', () => {
  const s = sugerenciasDelCrm(base({ gestos: { movimientos: [], noShowsAMano: 3 } }), 100);
  const ns = s.filter((x) => x.id === 'lead-no-asistio:noshow_r1');
  assert.equal(ns.length, 1, 'una sola, sin repetir');
  assert.equal(ns[0].clase, 2);
  assert.match(ns[0].texto, /Marcaste 3 No show a mano/);
  const dos = sugerenciasDelCrm(base({ gestos: { movimientos: [], noShowsAMano: 2 } }), 100).find((x) => x.id === 'lead-no-asistio:noshow_r1');
  assert.equal(dos?.clase, 1, 'con 2, la de siempre del CRM armado');
});

test('clase 2: pegar el link de Fathom a mano 3 veces ofrece conectarlo (si no está conectado)', () => {
  const s = sugerenciasDelCrm(base({ conectado: { whatsapp: true, fathom: false }, gestos: { movimientos: [], noShowsAMano: 0, fathomAMano: 3 } }), 100);
  const f = s.find((x) => x.id === 'conectar-fathom');
  assert.ok(f && f.clase === 2 && /Pegaste 3 veces el link de Fathom/.test(f.texto));
  const conectado = sugerenciasDelCrm(base({ gestos: { movimientos: [], noShowsAMano: 0, fathomAMano: 9 } }), 100);
  assert.ok(!conectado.some((x) => x.id === 'conectar-fathom'), 'con Fathom conectado no hay nada que ofrecer');
});

test('clase 4: el primer DM de Instagram o Messenger, salvo que ya haya quien los reciba', () => {
  const s = sugerenciasDelCrm(base({ nuevos: { dmInstagram: 2, dmMessenger: 1 } }), 100);
  const ig = s.find((x) => x.id === 'instagram-te-escribieron');
  assert.ok(ig && ig.clase === 4 && ig.accion.tipo === 'plantilla');
  assert.match(ig.texto, /Te escribieron 2 personas por Instagram/);
  assert.ok(s.some((x) => x.id === 'messenger-te-escribieron' && x.texto.includes('Te escribió 1 persona por Messenger')));
  const yaHay = sugerenciasDelCrm(base({
    nuevos: { dmInstagram: 2, dmMessenger: 0 },
    automatizaciones: [{ id: 1, clave: null, trigger_tipo: 'instagram', disparadores: [{ trigger_tipo: 'instagram', subtipo: 'dm' }] } as never],
  }), 100);
  assert.ok(!yaHay.some((x) => x.id === 'instagram-te-escribieron'), 'ya hay una automatización que recibe los DM');
  assert.ok(!sugerenciasDelCrm(base({ nuevos: { dmInstagram: 0, dmMessenger: 0 } }), 100).some((x) => x.clase === 4));
});

test('el server cuenta sólo los gestos de una persona, y lo que no lee se calla', () => {
  const sv = leer('lib/sugerencias-crm-server.ts');
  const g = sv.slice(sv.indexOf('async function gestosAMano'), sv.indexOf('async function dmsNuevos'));
  assert.match(g, /!String\(f\.autor \?\? ''\)\.includes\('@'\)/, 'lo que hizo MaKo o una automatización no es un gesto de la persona');
  assert.match(g, /\.in\('campo', \[CAMPO_ETAPA, 'Asistió R1', 'Links de Fathom'\]\)/);
  assert.match(g, /maxPaginas: 10/, 'con tope: no se lee el historial entero');
  assert.match(sv, /gestosAMano\(idsCasa, ahora\)\.catch\(avisar\('gestos'\)\)/);
  assert.match(sv, /dmsNuevos\(ahora\)\.catch\(avisar\('conversaciones nuevas'\)\)/);
  assert.match(sv, /gestos, nuevos,\n\s+\};/);
});

// ── D4, los tres que faltaban (20/10/2026, noche) ────────────────────────────

test('clase 2: el mismo mensaje a 3 leads de una etapa ofrece dejarlo como secuencia (con el nombre fuera)', () => {
  assert.equal(textoComparable('Hola Ana, ¿pudiste ver el video que te mandé?', 'Ana María'),
    textoComparable('hola JUAN ¿pudiste ver el vídeo que te mandé?!', 'Juan'), 'el saludo con el nombre no lo hace otro mensaje');
  const msj = (lead: number, nombre: string, etapa = 'agenda') => ({
    texto: textoComparable(`Hola ${nombre}, ¿pudiste ver el video que te mandé ayer?`, nombre), muestra: `Hola ${nombre}, ¿pudiste ver el video que te mandé ayer?`, lead, etapa,
  });
  const gestos = (mensajes: ReturnType<typeof msj>[]) => ({ movimientos: [], noShowsAMano: 0, mensajes });
  const s = sugerenciasDelCrm(base({ gestos: gestos([msj(1, 'Ana'), msj(2, 'Juan'), msj(3, 'Leila')]) }), 100);
  const g = s.find((x) => x.id === 'gesto-mensaje:agenda');
  assert.ok(g && g.clase === 2 && g.accion.tipo === 'chat');
  assert.match(g.texto, /Mandaste el mismo mensaje a 3 leads de «.+»\. ¿Lo dejo como secuencia de esa etapa\?/);
  assert.match(g.accion.tipo === 'chat' ? g.accion.pedido : '', /«Hola Ana, ¿pudiste ver el video/, 'MaKo recibe el texto para armarla');
  assert.ok(!sugerenciasDelCrm(base({ gestos: gestos([msj(1, 'Ana'), msj(1, 'Ana'), msj(1, 'Ana')]) }), 100).some((x) => x.id.startsWith('gesto-mensaje')),
    'tres veces al MISMO lead es insistir, no repetir');
  assert.ok(!sugerenciasDelCrm(base({ gestos: gestos([msj(1, 'Ana'), msj(2, 'Juan'), msj(3, 'Leila', 'lead')]) }), 100).some((x) => x.id.startsWith('gesto-mensaje')),
    'dos en una etapa y uno en otra no son «de una etapa»');
  const corto = (lead: number) => ({ texto: textoComparable('ok, gracias'), muestra: 'ok, gracias', lead, etapa: 'agenda' });
  assert.ok(!sugerenciasDelCrm(base({ gestos: { movimientos: [], noShowsAMano: 0, mensajes: [corto(1), corto(2), corto(3)] } }), 100).some((x) => x.id.startsWith('gesto-mensaje')),
    'una respuesta corta no es una secuencia');
});

test('clase 4: el lead de un formulario sin CRM ofrece conectarlo; el que vuelve al VSL, su ficha o la lista', () => {
  const s = sugerenciasDelCrm(base({ nuevos: { dmInstagram: 0, dmMessenger: 0, sinCrm: [{ tipo: 'landing', nombre: 'hola-mako.site/otono', leads: 1 }] } }), 100);
  const f = s.find((x) => x.id === idSinCrm('landing', 'hola-mako.site/otono'));
  assert.ok(f && f.clase === 4 && f.soloAdmin, 'conectar un formulario es del admin');
  assert.match(f.texto, /Llegó 1 lead de la landing «hola-mako\.site\/otono», que no está en ningún CRM\. ¿La conecto\?/);
  const uno = sugerenciasDelCrm(base({ nuevos: { dmInstagram: 0, dmMessenger: 0, volvieron: [{ lead: 42, nombre: 'Ana', etapa: 'agenda' }] } }), 100)
    .find((x) => x.id === 'volvieron');
  assert.ok(uno && uno.clase === 4);
  assert.deepEqual(uno.accion, { tipo: 'link', href: '/crm/42' });
  const varios = sugerenciasDelCrm(base({ nuevos: { dmInstagram: 0, dmMessenger: 0, volvieron: [{ lead: 1, nombre: 'Ana', etapa: 'agenda' }, { lead: 2, nombre: 'Juan', etapa: 'lead' }] } }), 100)
    .find((x) => x.id === 'volvieron');
  assert.ok(varios && varios.accion.tipo === 'chat' && /Ana \(.+\), Juan \(.+\)/.test(varios.accion.pedido));
  assert.ok(!sugerenciasDelCrm(base({ nuevos: { dmInstagram: 0, dmMessenger: 0, volvieron: [], sinCrm: [] } }), 100).some((x) => x.clase === 4));
});

test('el server: los mensajes de una PERSONA (sin WhatsApp), la asignación de HOY leída estricta, y la vuelta un día DESPUÉS', () => {
  const sv = leer('lib/sugerencias-crm-server.ts');
  const m = sv.slice(sv.indexOf('async function mensajesAMano'), sv.indexOf('const nombreDePagina'));
  // Instagram y Messenger por el canal (lib/canal-zernio.ts, tests/sin-instagram.test.ts), con su saliente a mano.
  assert.match(m, /salientesSocialesDesde\(desde\)/);
  assert.match(leer('lib/canal-zernio.ts'), /from\('ig_mensajes'\)\.select\('conversacion_id, texto'\)\.eq\('direccion', 'saliente'\)/);
  assert.match(m, /from\('email_mensajes'\)[^\n]*\.not\('autor', 'is', null\)/, 'un email cuenta sólo si lo mandó una persona desde Chats');
  assert.doesNotMatch(m, /wa_mensajes/, 'WhatsApp no sabe quién escribió: contaría las secuencias como gestos');
  const f = sv.slice(sv.indexOf('async function fuentesSinCrm'), sv.indexOf('async function leadsQueVolvieron'));
  assert.match(f, /if \(!funnels\.some\(\(f\) => !f\.esDefault\)\) return \[\];/, 'con un solo CRM no hay a dónde conectarla');
  assert.match(f, /getSettingEstricto\(CLAVE_LANDINGS\)/, 'un setting caído no puede leerse como «nada asignado»');
  assert.match(f, /leerCampanasAsignadasEstricto\(\)/);
  assert.match(f, /q\.is\('funnel_id', null\)/);
  const v = sv.slice(sv.indexOf('async function leadsQueVolvieron'), sv.indexOf('const aLeadSug'));
  assert.match(v, /diaDe\(v\.created_at\) > diaDe\(l\.creado\)/, 'la visita del día que entró no es volver');
  assert.match(v, /if \(p\.auto === true \|\| esPreviewDeEditor\(p\.landing_url/, 'el autoplay no es mirar el VSL');
  assert.match(sv, /leadsQueVolvieron\(deCasa, enRecorrido, tz, ahora\)\.catch\(avisar\('los que volvieron'\)\)/);
});

test('«Ahora no» calla CADA familia de sugerencia: el id pasa la ruta y vuelve igual del guardado (revisión 21/10)', () => {
  const s = sugerenciasDelCrm(base({
    gestos: {
      movimientos: Array.from({ length: 5 }, () => ({ desde: 'lead', hacia: 'agenda' })), noShowsAMano: 3, fathomAMano: 0,
      mensajes: [1, 2, 3].map((lead) => ({ texto: textoComparable('Hola, ¿pudiste ver el video que te mandé ayer?'), muestra: 'Hola', lead, etapa: 'agenda' })),
    },
    nuevos: {
      dmInstagram: 1, dmMessenger: 1,
      sinCrm: [{ tipo: 'landing', nombre: 'hola-mako.site/oferta?x=1', leads: 2 }, { tipo: 'campaña', nombre: 'Campaña Otoño — Señal', leads: 1 }],
      volvieron: [{ lead: 1, nombre: 'Ana', etapa: 'agenda' }],
    },
  }), 100);
  const familias = new Set(s.map((x) => x.id.split(':')[0]));
  for (const f of ['gesto-mover', 'gesto-mensaje', 'sin-crm', 'volvieron', 'instagram-te-escribieron']) assert.ok(familias.has(f), `falta la familia ${f}: el test ya no la mira`);
  const ruta = leer('app/api/crm/mako/route.ts');
  assert.match(ruta, /ID_SUGERENCIA\.test\(v\)/, 'la ruta usa la MISMA regla que el motor');
  const ahora = Date.parse('2026-10-21T12:00:00Z');
  for (const x of s) {
    assert.ok(ID_SUGERENCIA.test(x.id), `«${x.id}» no pasa la ruta: «Ahora no» devolvería 400`);
    const guardado = JSON.stringify(conCallada({}, claveCallada(7, x.id), 30, ahora));
    assert.ok(estaCallada(parsearCalladas(guardado), claveCallada(7, x.id), ahora), `«${x.id}» no vuelve callada del guardado`);
  }
});

test('«volvió»: los plays por DÍA y sin pruebas (revisión 21/10)', () => {
  const sv = leer('lib/sugerencias-crm-server.ts');
  const v = sv.slice(sv.indexOf('async function leadsQueVolvieron'), sv.indexOf('const aLeadSug'));
  assert.match(v, /const despuesDelAlta = alta != null && ultimoDia > alta;/, 'un play el día del alta no es volver');
  assert.match(v, /const dosDias = orden\.length >= 2/, 'dos plays el mismo día (el snippet v16/v17 manda dos por clic) no son dos veces');
  assert.equal((v.match(/\.is\('prueba', null\)/g) ?? []).length, 2, 'ni visitas ni plays de prueba');
  assert.match(v, /esPreviewDeEditor\(v\.landing_url/, 'ni la vista previa del editor');
  assert.match(v, /!l\.prueba && enRecorrido/, 'ni el lead PRUEBA');
  assert.match(sv, /prueba: l\.origen_lead === 'prueba',/);
});
