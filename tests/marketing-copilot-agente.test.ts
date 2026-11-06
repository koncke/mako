// =============================================================================
// Marketing CoPilot — lo que el agente sabe y las reglas con las que habla (6/11/2026)
// =============================================================================
// Fija lib/media-buyer/copiloto-contexto.ts y copiloto-conocimiento.ts, y las seis conversaciones de docs/marketing-copilot/conversaciones.md:
// para cada una, el contexto del turno trae lo que hace falta para contestar bien (el modelo no se corre acá). Lo que se decide con
// reglas (qué funnel conviene) llega ya decidido al system.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONOCIMIENTO_ANUNCIOS } from '../lib/media-buyer/copiloto-conocimiento';
import { REGLAS_DEL_COPILOTO, contextoDelCopiloto, fichasDelCopiloto, negocioDelCopiloto, HERRAMIENTAS_DEL_COPILOTO, ORIGEN_COPILOTO } from '../lib/media-buyer/copiloto-contexto';
import type { PerfilCopiloto } from '../lib/media-buyer/copiloto';
import { REGISTRO } from '../lib/api-mako/registro';

const RAIZ = join(import.meta.dirname, '..');
const doc = readFileSync(join(RAIZ, 'docs/conocimiento/anuncios-high-ticket.md'), 'utf8').replace(/\r\n/g, '\n');
const chat = readFileSync(join(RAIZ, 'app/api/mako/chat/route.ts'), 'utf8').replace(/\r\n/g, '\n');

/** Las personas y fuentes del documento: internas, nunca al cliente. */
const FUENTES = ['Haynes', 'Gump', 'Heath', 'Charley', 'Feres', 'Detrey', 'Fernandes', 'Sherrard', 'Nievas', 'BlueHacker', 'Megalodon', 'Brice', 'Jeremy', 'Mariano Porter', 'Sell Your Knowledge', 'Growing AMG', 'GoFor', 'Facebook Ads MBA', 'Andromeda'];

test('el conocimiento no nombra a ninguna fuente del documento (y la lista de fuentes no quedó vieja)', () => {
  for (const n of FUENTES) assert.ok(doc.includes(n), `«${n}» ya no está en el documento: la lista de este test quedó vieja`);
  const nombradas = FUENTES.filter((n) => CONOCIMIENTO_ANUNCIOS.includes(n) || REGLAS_DEL_COPILOTO.includes(n));
  assert.deepEqual(nombradas, [], 'el agente habla con esos principios en sus palabras, sin nombrar');
  assert.ok(!/youtube\.com\/watch|https?:\/\//.test(CONOCIMIENTO_ANUNCIOS), 'sin links a los videos');
});

test('lo destilado dice lo mismo que el documento en sus cifras clave', () => {
  // Cada par: lo que dice el documento y cómo lo dice el agente. Si el documento cambia una cifra, esto avisa.
  const pares: Array<[RegExp, RegExp]> = [
    [/US\$100–300 por agenda/, /US\$100 a 300 como expectativa conservadora/],
    [/Cierre en una llamada \| 20–25%/, /20 a 25%/],
    [/Separadas se pierde 50% de los calificados; integradas, 16%/, /pierden 50% de los calificados, integradas 16%/],
    [/Ticket desde unos US\$3\.000/, /Ticket desde unos US\$3\.000/],
    [/piso de US\$50\/día/, /piso de unos US\$50 por día/],
    [/Sumar uno tarda 4–6 semanas/, /Sumar un closer tarda 4 a 6 semanas/],
    [/Hasta 72 horas/, /hasta 72 horas/],
    [/Recordatorios a 24 h, 1 h y 10 min/, /24 h, 1 h y 10 min/],
    [/Impuestos:\*\* una cuenta argentina con 74%/, /74% en 2023/],
    [/CPM \| US\$30–80/, /CPM US\$30 a 80/],
  ];
  for (const [enDoc, enAgente] of pares) {
    assert.match(doc, enDoc, `el documento ya no dice ${enDoc}`);
    assert.match(CONOCIMIENTO_ANUNCIOS, enAgente, `el agente no dice ${enAgente}`);
  }
  // Las secciones que importan para administrar están.
  for (const s of ['QUÉ FUNNEL CONVIENE', 'PRESUPUESTO DE ARRANQUE', 'NÚMEROS DE REFERENCIA', 'CUÁNDO ESCALAR', 'CUÁNDO APAGAR', 'ERRORES TÍPICOS', 'LATAM Y ESPAÑA', 'DONDE LAS FUENTES NO COINCIDEN', 'LO QUE NO ACONSEJAS']) {
    assert.ok(CONOCIMIENTO_ANUNCIOS.includes(s), s);
  }
});

test('las reglas de Martín están, una por una', () => {
  const R = REGLAS_DEL_COPILOTO;
  assert.match(R, /COSTO POR LLAMADA CALIFICADA/);
  assert.match(R, /CADA CIFRA LLEVA SU CONTEXTO/);
  assert.match(R, /no se promete/);
  assert.match(R, /gana la más parecida a ESTE negocio/);
  assert.match(R, /NO NOMBRAS A LAS FUENTES/);
  assert.match(R, /NUNCA DICES SER UN REFERENTE/);
  assert.match(R, /le inventas una cita/);
  assert.match(R, /NADA ENGAÑOSO/);
  assert.match(R, /NO LE SIRVE A ESE NEGOCIO O A ESE PRESUPUESTO, SE LO DICES/);
  assert.match(R, /esperas el sí en la pantalla de revisión/);
  assert.match(R, /salen en pausa/);
  assert.match(R, /no hay Campañas/);
  assert.match(R, /Instagram \(Reels, Stories, Carruseles\)/);
});

const PERFIL_VSL: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 200, presupuestoMes: 3000, llamadas: 'yo' };

test('conversación 1: pide un funnel que no le sirve → el contexto ya trae el veredicto y la alternativa', () => {
  const n = negocioDelCopiloto(PERFIL_VSL);
  assert.match(n, /EL FUNNEL ELEGIDO NO LE SIRVE/);
  assert.match(n, /3,000/);
  assert.match(n, /«carrito»/);
  assert.match(n, /Debes decírselo y proponer/);
  // Si ya se lo dijo y siguió, no insiste.
  assert.match(negocioDelCopiloto({ ...PERFIL_VSL, ajuste: 'sigo' }), /no insistas/);
});

test('conversación 2: leads baratos → el número que manda y el funnel que corresponde a US$1.500 al mes', () => {
  const p: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 1500, llamadas: 'yo' };
  const c = contextoDelCopiloto(p);
  assert.match(c, /EL NÚMERO QUE MANDA ES EL COSTO POR LLAMADA CALIFICADA/);
  assert.match(c, /abaratar el lead suele traer a los peores/);
  assert.match(negocioDelCopiloto({ ...p, presupuestoMes: 1000 }), /conviene «formulario»/);
  assert.match(negocioDelCopiloto({ ...p, presupuestoMes: 1000 }), /EL FUNNEL ELEGIDO NO LE SIRVE/);
});

test('conversación 3: una cifra con su contexto, sin nombrar a nadie, con las advertencias de LATAM y España', () => {
  const c = contextoDelCopiloto({ entrada: 'funnel', funnel: 'formulario', ticket: 3000, presupuestoMes: 2000, llamadas: 'equipo' });
  assert.match(c, /como referencia conservadora, de un practicante de EE\. UU\., 2026/);
  assert.match(c, /no es un promedio medido/);
  assert.match(c, /US\$3 a 5 por agenda es un extremo de un solo participante: no lo uses como vara/);
  assert.match(c, /la evidencia es flaca/);
  assert.match(c, /ver_media_buyer/);
  assert.ok(HERRAMIENTAS_DEL_COPILOTO.includes('ver_media_buyer') && HERRAMIENTAS_DEL_COPILOTO.includes('calcular_presupuesto_anuncios'));
});

test('conversación 4: orgánico sin plata → sin Campañas, viralidad o ventas, Calendario', () => {
  const p: PerfilCopiloto = { entrada: 'funnel', funnel: 'organico', ticket: 3000, presupuestoMes: 0, llamadas: 'yo', ritmo: 4 };
  const n = negocioDelCopiloto(p);
  assert.match(n, /No tiene presupuesto para anuncios por ahora/);
  assert.match(n, /No tiene Campañas/);
  assert.match(n, /no le propongas lanzar ni optimizar campañas/);
  assert.ok(!/campanas/.test(n.split('SU PANTALLA muestra:')[1].split('.')[0]), 'su pantalla no lista campañas');
  assert.match(contextoDelCopiloto(p), /viralidad o ventas/);
  assert.deepEqual(fichasDelCopiloto(p), ['julian-otalora']);
});

test('conversación 5: pide trampa → las reglas la niegan por nombre', () => {
  const c = contextoDelCopiloto({ entrada: 'funnel', funnel: 'webinar', ticket: 1500, presupuestoMes: 1000, llamadas: 'equipo' });
  assert.match(c, /sin escasez o cupos inventados, sin testimonios ni reseñas falsos/);
  assert.match(c, /LO QUE NO ACONSEJAS/);
  assert.match(c, /urgencia que no sea por razones reales/);
});

test('conversación 6: un referente se nombra «inspirado en», no es él, y lanzar pide el sí', () => {
  const p: PerfilCopiloto = { entrada: 'referente', referente: 'francisco-doglio', ticket: 3000, presupuestoMes: 2000, llamadas: 'equipo' };
  const c = contextoDelCopiloto(p);
  assert.match(c, /inspirada en Francisco Doglio/);
  assert.match(c, /no eres Francisco Doglio, no hablas en su nombre y no participa ni respalda este producto/);
  assert.match(c, /Nunca le inventes una cita/);
  assert.match(c, /LANZAR ANUNCIOS, CAMBIAR UN PRESUPUESTO O PRENDER UN PILOTO mueve plata/);
  assert.deepEqual(fichasDelCopiloto(p), ['francisco-doglio']);
  // Ni con un referente la parte de anuncios nombra a las fuentes: se mira sin la ficha, que sí es de un referente de lib/asesores.
  assert.deepEqual(FUENTES.filter((n) => [REGLAS_DEL_COPILOTO, negocioDelCopiloto(p), CONOCIMIENTO_ANUNCIOS].join('\n').includes(n)), []);
});

test('qué fichas viajan: sólo las que vienen al caso (lo que cada referente enseña, medido en su curso)', () => {
  const f = (funnel: PerfilCopiloto['funnel'], extra: Partial<PerfilCopiloto> = {}) => fichasDelCopiloto({ entrada: 'funnel', funnel, ...extra });
  // Sin referente: la de quien mejor cubre el funnel para un servicio (YouTube de marca personal, no canales que viven del CPM).
  assert.deepEqual(f('youtube'), ['sergio-begueria']);
  assert.deepEqual(f('lead-magnet'), ['sofia-contreras']);
  assert.deepEqual(f('vsl-llamada'), ['marcos-razzetti'], 'Juan ADS enseña la campaña, no el VSL: el VSL con su sesión está en la ficha de Marcos');
  assert.deepEqual(f('formulario'), ['marcos-razzetti'], 'el formulario con su filtro, también');
  // Un referente que enseña ese funnel alcanza solo: una segunda ficha sobre lo mismo son 5.000 caracteres más en cada mensaje.
  assert.deepEqual(f('organico', { entrada: 'referente', referente: 'guille-collado' }), ['guille-collado']);
  assert.deepEqual(f('organico', { entrada: 'referente', referente: 'julian-otalora' }), ['julian-otalora']);
  // Un referente que NO enseña el funnel no viaja (aceptó el que propuso MaKo, o lo cambió el agente).
  assert.deepEqual(f('carrito', { entrada: 'referente', referente: 'francisco-doglio' }), ['juan-ads']);
  // Uno que enseña otra parte de la venta (la oferta, la llamada) viaja para esa parte, con la del funnel.
  assert.deepEqual(f('formulario', { entrada: 'referente', referente: 'hormozi' }), ['hormozi', 'marcos-razzetti']);
  assert.deepEqual(fichasDelCopiloto({}), ['juan-ads'], 'sin funnel, el de anuncios');
  for (const id of ['derek-chamizo', 'julian-otalora', 'guille-collado', 'francisco-doglio', 'sofia-contreras', 'juan-ads']) {
    assert.ok(contextoDelCopiloto({ entrada: 'referente', referente: id as never }).length > 3000, id);
  }
});

test('sin primera entrada: no inventa un perfil y manda a hacerla', () => {
  const n = negocioDelCopiloto({});
  assert.match(n, /todavía no hizo la primera entrada/);
  assert.match(n, /estrategia=1/);
});

// ── Ocho conversaciones más (revisión crítica del 6/11/2026; docs/marketing-copilot/conversaciones.md, 7 a 14) ──
test('conversación 7 (inmobiliaria con US$20 por día): la cuenta chica achica la ficha y no se vende un VSL', () => {
  const p: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 4000, presupuestoMes: 600, llamadas: 'yo' };
  const n = negocioDelCopiloto(p);
  assert.match(n, /EL FUNNEL ELEGIDO NO LE SIRVE/);
  assert.match(n, /«formulario»/);
  assert.match(n, /TAMAÑO DE LA CUENTA: con \$20 por día caben como mucho 2 conjuntos/);
  assert.match(n, /casos reales de clientes/);
  assert.match(REGLAS_DEL_COPILOTO, /mandan los números/);
});

test('conversación 8 (coach sin casos): pregunta lo que falta de a una y no inventa casos', () => {
  const n = negocioDelCopiloto({ entrada: 'funnel', funnel: 'vsl-llamada', ticket: 3000 });
  assert.match(n, /TODAVÍA NO SABES: cuánto puede poner por mes, quién toma las llamadas\. Pregunta una sola por vez/);
  assert.match(n, /nunca se inventan/);
  assert.match(n, /no trae el país/);
});

test('conversación 9 (lead barato, pocos cierres, «súbele el presupuesto»): diagnosticar antes de escalar, con la cuenta leída', () => {
  assert.match(REGLAS_DEL_COPILOTO, /lees la cuenta \(ver_media_buyer\)/);
  assert.match(REGLAS_DEL_COPILOTO, /costo por lead bajo con pocos cierres no es algo que escalar/);
  assert.match(REGLAS_DEL_COPILOTO, /Sin el dato, no hay recomendación de mover plata/);
});

test('conversación 10 (seguir al referente que no le sirve): el funnel lo avisa, la ficha se achica y, si insiste, se mide', () => {
  const p: PerfilCopiloto = { entrada: 'referente', referente: 'francisco-doglio', funnel: 'webinar', ticket: 1500, presupuestoMes: 400, llamadas: 'equipo' };
  assert.match(negocioDelCopiloto(p), /EL FUNNEL ELEGIDO NO LE SIRVE: .*no se llena/);
  assert.match(negocioDelCopiloto({ ...p, ajuste: 'sigo' }), /no insistas/);
});

test('conversación 11 (orgánico: viralidad o ventas, cuánto): el reparto llega calculado, y si falta el objetivo se pregunta', () => {
  const sin = negocioDelCopiloto({ entrada: 'funnel', funnel: 'organico', ticket: 3000, presupuestoMes: 0, llamadas: 'yo', ritmo: 4 });
  assert.match(sin, /REPARTO que calcula MaKo para 4 por semana .*supone mixto: pregúntaselo/);
  assert.match(sin, /2 reels y 2 carruseles/);
  const ven = negocioDelCopiloto({ entrada: 'funnel', funnel: 'organico', ticket: 3000, presupuestoMes: 0, llamadas: 'yo', ritmo: 4, objetivo: 'ventas' });
  assert.match(ven, /con objetivo ventas: 4 piezas por semana: 1 reel y 3 carruseles/);
  assert.match(REGLAS_DEL_COPILOTO, /nunca más piezas de las que la persona dijo/);
});

test('conversación 12 (YouTube sin audiencia, 3 horas): la ficha de canales automatizados no manda', () => {
  const n = negocioDelCopiloto({ entrada: 'funnel', funnel: 'youtube', ticket: 1000, presupuestoMes: 0, llamadas: 'yo', ritmo: 1 });
  assert.match(n, /YOUTUBE PARA ESTE NEGOCIO/);
  // Sin referente viaja la de marca personal (Sergio Begueria); el aviso del CPM, sólo si eligió a Derek Chamizo.
  assert.doesNotMatch(n, /nichos por CPM/);
  assert.match(negocioDelCopiloto({ entrada: 'referente', referente: 'derek-chamizo', ticket: 1000, presupuestoMes: 0, llamadas: 'yo', ritmo: 1 }), /ignora lo de nichos por CPM/);
  assert.match(n, /un video bueno por semana/);
  assert.match(n, /tarda meses/);
  assert.doesNotMatch(n, /TAMAÑO DE LA CUENTA/);
});

test('conversación 13 (garantía de resultados): la de devolución sí, la de resultados no', () => {
  assert.match(REGLAS_DEL_COPILOTO, /garantía de DEVOLUCIÓN o de servicio .* sí se puede/);
  assert.match(REGLAS_DEL_COPILOTO, /garantía de RESULTADOS o de ingresos/);
});

test('conversación 14 (Google o LinkedIn): criterio sin cifras inventadas, y Meta primero', () => {
  const R = REGLAS_DEL_COPILOTO;
  assert.match(R, /NO tienes cifras ni fuentes de Google Ads ni de LinkedIn Ads/);
  assert.match(R, /Google en búsqueda capta a quien YA busca/);
  assert.match(R, /probar Meta primero/);
  assert.match(R, /no los lanzas ni los lees/);
});

test('el peso: lo destilado y el contexto entero caben (cada mensaje lo paga)', () => {
  assert.ok(CONOCIMIENTO_ANUNCIOS.length < 15000, `lo destilado pesa ${CONOCIMIENTO_ANUNCIOS.length}`);
  const peor = Math.max(...['derek-chamizo', 'julian-otalora', 'francisco-doglio', 'sofia-contreras', 'guille-collado', 'juan-ads'].map((id) =>
    contextoDelCopiloto({ entrada: 'referente', referente: id as never, ticket: 3000, presupuestoMes: 2000, llamadas: 'equipo' }).length));
  assert.ok(peor < 30000, `el contexto más grande pesa ${peor}`);
});

test('está conectado: el chat de la tab usa este contexto y sus herramientas existen en la API', () => {
  assert.match(chat, /desde\?\.tab === ORIGEN_COPILOTO/);
  assert.match(chat, /contextoDelCopiloto\(perfil\)/);
  assert.match(chat, /propias: HERRAMIENTAS_DEL_COPILOTO/);
  assert.equal(ORIGEN_COPILOTO, 'Marketing CoPilot');
  const ids = new Set(REGISTRO.map((d) => d.id));
  for (const h of HERRAMIENTAS_DEL_COPILOTO) assert.ok(ids.has(h), `${h} no está en la API de MaKo`);
  // La tab declara el mismo origen (si no, el chat caería al contexto del Ops Center).
  assert.match(readFileSync(join(RAIZ, 'app/ads-manager/MediaBuyer.tsx'), 'utf8'), /<MakoEnLaTab tab="Marketing CoPilot"/);
  // La primera entrada contesta EN EL MEDIO, con el mismo origen: un solo chat, nunca el panel al costado (Martín, 6/11/2026).
  const pe = readFileSync(join(RAIZ, 'app/ads-manager/PrimeraEntrada.tsx'), 'utf8').replace(/^[ \t]*\/\/.*$/gm, '');
  assert.doesNotMatch(pe, /<MakoEnLaTab|from '@\/app\/_chat\/MakoEnLaTab'/, 'la primera entrada no abre el chat al costado');
  assert.match(pe, /desdeDelCopiloto\(pantalla\)/, 'lo que se escribe va al CoPilot');
  assert.match(pe, /useChatCliente\(\{[^}]*entrarAlCerebro: true[^}]*desde,/, 'con el Cerebro, como la estrella');
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. «de un practicante de EE. UU., 2026» → «de Haynes, 2026» en el conocimiento   → rojo «no nombra a ninguna fuente» y la 6.
//   2. regla 7 «SE LO DICES» → «LO CALLAS»                                          → rojo «las reglas de Martín».
//   3. el chat sin `desde?.tab === ORIGEN_COPILOTO`                                  → rojo «está conectado».
//   4. `negocioDelCopiloto` sin el veredicto de las reglas puras                     → rojo las conversaciones 1 y 2.
