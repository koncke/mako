// =============================================================================
// El puente de leads de Meta por Zapier o Make: el lector, el id, la tarjeta y el cableado
// =============================================================================
// 23/10/2026, el Cerebro (pedido de Martín: «armame el puente de leads por Zapier»). La app de MaKo todavía no tiene
// `leads_retrieval`, así que el negocio manda sus leads de formularios de Meta desde un Zap a /api/webhooks/zapier. Lo que
// se fija acá, y por qué:
//   1. EL LECTOR, ejecutándolo con cuerpos de varias formas: la forma real del Zap NO está medida (la decide quien lo
//      arma), así que lo que se prueba es que sea tolerante sin tragar basura ni ruido técnico como si fuera una respuesta.
//   2. EL ID: con el leadgen_id real un lead que entra después por Meta NO se duplica; sin él, el id propio es determinista
//      (un reintento de Zapier cae en la misma fila) y lleva el workspace (el índice de `meta_lead_id` es global).
//   3. LA TARJETA: ámbar sólo si ya entró un lead y pasaron 72 h; un puente que nunca recibió nada «espera», no «cayó».
//   4. EL CABLEADO, leyendo fuente: el secreto va en un header y por hash, la lectura es estricta, y el lead entra por
//      `upsertLeadFromMeta` (la puerta de Meta) y dispara lo inmediato (`alNacerLeadDeMeta`), no por una puerta propia.
//
// PROBADO ROMPIÉNDOLO el 23/10/2026, una rotura por vez y restaurando DE MEMORIA (los números, al pie del archivo).
//
// Correr: npx tsx --test tests/zapier-leads.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLeadFields } from '../lib/meta-leads-campos';
import { idDeLeadParaElUpsert, leerLeadDeZapier, type LeadDeZapier } from '../lib/zapier-lead';
import {
  ESTADO_VACIO, HORAS_SIN_LEADS, estadoDespuesDe, haceCuanto, parsearEstadoZapier, tarjetaDelPuente,
} from '../lib/zapier-estado';
import { RUTEO_POR_HASH } from '../lib/ruteo-hash';
import { esFuenteQueAvisa, esIntegracionDeLeads } from '../lib/fuentes-leads-catalogo';
import { DEFS_TEST } from '../lib/integraciones-catalogo';
import { SLIDES } from '../lib/servicio-slides';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LEADGEN = '123456789012345'; // 15 dígitos: la forma de un leadgen_id
const ok = (c: unknown): LeadDeZapier => {
  const l = leerLeadDeZapier(c);
  assert.ok(!('ignorado' in l), `se ignoró un cuerpo válido: ${'ignorado' in l ? l.ignorado : ''}`);
  return l as LeadDeZapier;
};

// ── 1. El lector ─────────────────────────────────────────────────────────────

test('lo que manda el Zap con «Data» vacío: los campos del trigger, planos', () => {
  const l = ok({
    id: LEADGEN, created_time: '2026-10-23T18:00:00+0000', ad_id: '111', ad_name: 'Video 1', adset_id: '222', adset_name: 'Frío',
    campaign_id: '333', campaign_name: 'Leads octubre', form_id: '444', page_id: '555', platform: 'fb', is_organic: 'false',
    full_name: 'Ana Pérez', email: 'ANA@Correo.com', phone_number: '+54 9 11 5555-1234', company_name: 'Pérez SA',
    '¿en_qué_plazo_querés_vender?': 'menos_de_3_meses',
  });
  assert.equal(l.leadgenId, LEADGEN);
  assert.equal(l.creadoEn, '2026-10-23T18:00:00.000Z');
  assert.equal(l.email, 'ana@correo.com');
  assert.equal(l.nombre, 'Ana Pérez');
  assert.equal(l.telefono, '+54 9 11 5555-1234');
  assert.equal(l.empresa, 'Pérez SA');
  assert.deepEqual([l.anuncioId, l.anuncioNombre, l.conjuntoId, l.conjuntoNombre, l.campanaId, l.campanaNombre],
    ['111', 'Video 1', '222', 'Frío', '333', 'Leads octubre']);
  // Lo técnico no es una respuesta, y se DECLARA lo que se tiró.
  assert.deepEqual(l.sinUsar.sort(), ['form_id', 'is_organic', 'page_id', 'platform']);
  // La única respuesta propia es la pregunta del formulario: las del anuncio no la ensucian.
  assert.deepEqual(l.noReconocidos, ['¿en_qué_plazo_querés_vender?']);
});

test('el nombre del anuncio, la campaña y el formulario NO se leen como el nombre de la persona', () => {
  // `ad_name`, `campaign_name`… contienen «name»: si llegaran al parser de Meta, el primero ganaría como nombre.
  const l = ok({ ad_name: 'Video 1', campaign_name: 'Leads', adset_name: 'Frío', form_name: 'Formulario', email: 'a@b.co', full_name: 'Bea' });
  assert.equal(l.nombre, 'Bea');
  assert.ok(!l.fieldData.some((f) => /ad_name|campaign_name|adset_name|form_name/.test(f.name ?? '')));
});

test('nombre y apellido por separado se juntan; con nombre completo, no', () => {
  assert.equal(ok({ first_name: 'Ana', last_name: 'Pérez', email: 'a@b.co' }).nombre, 'Ana Pérez');
  assert.equal(ok({ Nombre: 'Luis', Apellido: 'Gómez', email: 'a@b.co' }).nombre, 'Luis Gómez');
  // Con el completo ya viene entero: no se inventa «Ana Ana Pérez».
  assert.equal(ok({ first_name: 'Ana', last_name: 'Pérez', full_name: 'Ana Pérez', email: 'a@b.co' }).nombre, 'Ana Pérez');
});

test('whatsapp, mobile y mail entran como teléfono y email', () => {
  const l = ok({ full_name: 'Ana', WhatsApp: '5491155551234', 'E-mail': 'ana@b.co' });
  assert.equal(l.telefono, '5491155551234');
  assert.equal(l.email, 'ana@b.co');
  assert.equal(ok({ nombre: 'X', Mobile: '+52 55 1234 5678' }).telefono, '+52 55 1234 5678');
});

test('el formato de Meta (field_data) y lo anidado en data/lead se leen igual', () => {
  const meta = ok({
    leadgen_id: LEADGEN,
    field_data: [{ name: 'full_name', values: ['Ana'] }, { name: 'email', values: ['ana@b.co'] }, { name: 'ciudad', values: ['Rosario'] }],
  });
  assert.equal(meta.email, 'ana@b.co');
  assert.deepEqual(meta.noReconocidos, ['ciudad']);
  const anidado = ok({ lead: { email: 'ana@b.co', full_name: 'Ana' }, data: { phone: '+5491155551234' } });
  assert.equal(anidado.nombre, 'Ana');
  assert.equal(anidado.telefono, '+5491155551234');
  // Zapier aplana lo anidado con «__».
  assert.equal(ok({ lead__email: 'ana@b.co', lead__full_name: 'Ana' }).nombre, 'Ana');
});

test('un cuerpo en un arreglo de un elemento se lee (el «Wrap Request In Array» de Zapier)', () => {
  assert.equal(ok([{ email: 'ana@b.co', full_name: 'Ana' }]).email, 'ana@b.co');
});

test('el `id` suelto sólo cuenta si tiene forma de leadgen_id', () => {
  assert.equal(ok({ id: LEADGEN, email: 'a@b.co' }).leadgenId, LEADGEN);
  assert.equal(ok({ id: 'abc-123', email: 'a@b.co' }).leadgenId, null, 'un id cualquiera no es un leadgen_id');
  assert.equal(ok({ id: '42', email: 'a@b.co' }).leadgenId, null);
  // Un id de 17 dígitos que viaja como NÚMERO JSON ya se redondeó al parsear: no es el id.
  assert.equal(ok(JSON.parse('{"id": 12345678901234567, "email": "a@b.co"}')).leadgenId, null);
  // Y el descartado no se vuelve una «pregunta propia».
  assert.deepEqual(ok({ id: 'abc', email: 'a@b.co' }).noReconocidos, []);
});

test('la fecha: ISO, segundos de Meta, o ausente', () => {
  assert.equal(ok({ email: 'a@b.co', created_time: 1761242400 }).creadoEn, new Date(1761242400 * 1000).toISOString());
  assert.equal(ok({ email: 'a@b.co', created_time: '1761242400' }).creadoEn, new Date(1761242400 * 1000).toISOString());
  assert.equal(ok({ email: 'a@b.co' }).creadoEn, null);
  assert.equal(ok({ email: 'a@b.co', created_time: 'ayer' }).creadoEn, null);
});

test('sin email ni teléfono válidos no hay a quién reconocer; un cuerpo que no es un objeto, tampoco', () => {
  const sin = leerLeadDeZapier({ full_name: 'Ana', email: 'no-es-un-email', phone: '12' });
  assert.ok('ignorado' in sin && sin.porque === 'contacto');
  const nada = leerLeadDeZapier('hola');
  assert.ok('ignorado' in nada && nada.porque === 'cuerpo');
  assert.ok('ignorado' in leerLeadDeZapier(null));
  assert.ok('ignorado' in leerLeadDeZapier([1, 2]));
  // Con uno de los dos alcanza (el teléfono solo es una llave válida, como en Meta).
  assert.equal(ok({ full_name: 'Ana', phone: '+5491155551234' }).email, null);
});

test('un cuerpo grande no se convierte en una ficha enorme', () => {
  const muchos = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`pregunta_${i}`, 'x'.repeat(5000)]));
  const l = ok({ email: 'a@b.co', ...muchos });
  assert.ok(l.fieldData.length <= 61, `quedaron ${l.fieldData.length} campos`);
  assert.ok(l.fieldData.every((f) => (f.values?.[0] ?? '').length <= 1000));
  assert.ok(l.sinUsar.length >= 140, 'lo que se recortó tiene que quedar declarado');
});

test('el lector y Meta leen igual a la misma persona (mismo parser)', () => {
  const porMeta = parseLeadFields([
    { name: 'full_name', values: ['Ana Pérez'] }, { name: 'email', values: ['ana@b.co'] },
    { name: 'phone_number', values: ['+5491155551234'] }, { name: 'company_name', values: ['Pérez SA'] },
  ]);
  const porZap = ok({ full_name: 'Ana Pérez', email: 'ana@b.co', phone_number: '+5491155551234', company_name: 'Pérez SA' });
  assert.deepEqual([porZap.nombre, porZap.email, porZap.telefono, porZap.empresa], [porMeta.nombre, porMeta.email, porMeta.telefono, porMeta.empresa]);
});

// ── 2. El id ─────────────────────────────────────────────────────────────────

test('con el leadgen_id real, el id es ESE: un lead que entra después por Meta no se duplica', () => {
  const l = ok({ id: LEADGEN, email: 'a@b.co' });
  assert.equal(idDeLeadParaElUpsert(9, l, new Date('2026-10-23T12:00:00Z')), LEADGEN);
});

test('sin leadgen_id, el id propio es determinista y lleva el workspace', () => {
  const ahora = new Date('2026-10-23T12:00:00Z');
  const l = ok({ email: 'a@b.co', phone: '+5491155551234', created_time: '2026-10-23T11:59:00Z' });
  const id = idDeLeadParaElUpsert(9, l, ahora);
  assert.match(id, /^zap:9:[0-9a-f]{20}$/);
  assert.equal(idDeLeadParaElUpsert(9, l, new Date('2026-11-01T00:00:00Z')), id, 'un reintento de Zapier cae en la misma fila');
  assert.notEqual(idDeLeadParaElUpsert(10, l, ahora), id, 'el índice de meta_lead_id es global: dos negocios no pueden chocar');
  const otro = ok({ email: 'a@b.co', phone: '+5491155551234', created_time: '2026-10-24T09:00:00Z' });
  assert.notEqual(idDeLeadParaElUpsert(9, otro, ahora), id, 'otro envío de la misma persona es otro lead');
  // Sin fecha del formulario manda el día: el mismo día es el mismo lead, mañana otro.
  const sinFecha = ok({ email: 'a@b.co' });
  assert.equal(idDeLeadParaElUpsert(9, sinFecha, new Date('2026-10-23T01:00:00Z')), idDeLeadParaElUpsert(9, sinFecha, new Date('2026-10-23T23:00:00Z')));
  assert.notEqual(idDeLeadParaElUpsert(9, sinFecha, new Date('2026-10-23T01:00:00Z')), idDeLeadParaElUpsert(9, sinFecha, new Date('2026-10-24T01:00:00Z')));
  // El id propio NO se parece a un leadgen_id: nunca viaja a Meta como lead_id.
  assert.ok(!/^\d{15,17}$/.test(id));
});

// ── 3. La tarjeta ────────────────────────────────────────────────────────────

const H = 3_600_000;
const T0 = Date.parse('2026-10-23T12:00:00Z');

test('la tarjeta: espera, último lead, y ámbar a las 72 h', () => {
  assert.deepEqual(tarjetaDelPuente(ESTADO_VACIO, T0), { estado: 'conectada', detalle: 'Esperando tu primer lead. Prueba tu Zap.' });
  const hace = (h: number) => ({ entrega: new Date(T0 - h * H).toISOString(), lead: new Date(T0 - h * H).toISOString(), motivo: null });
  assert.deepEqual(tarjetaDelPuente(hace(5), T0), { estado: 'conectada', detalle: 'Último lead hace 5 h.' });
  assert.equal(tarjetaDelPuente(hace(HORAS_SIN_LEADS), T0).estado, 'conectada', 'justo en el límite todavía no');
  const callado = tarjetaDelPuente(hace(HORAS_SIN_LEADS + 1), T0);
  assert.equal(callado.estado, 'falta');
  assert.equal(callado.detalle, 'Sin leads hace 3 días. Revisa tu Zap.');
  // Un puente que nunca recibió un lead no se pone ámbar por el tiempo: «espera», no «cayó».
  assert.equal(tarjetaDelPuente({ entrega: new Date(T0 - 500 * H).toISOString(), lead: null, motivo: 'x' }, T0).estado, 'conectada');
});

test('lo anotado: un lead pone su fecha; un aviso sin contacto la deja como estaba', () => {
  const a = estadoDespuesDe(ESTADO_VACIO, { lead: true }, new Date(T0));
  assert.deepEqual(a, { entrega: new Date(T0).toISOString(), lead: new Date(T0).toISOString(), motivo: null });
  const b = estadoDespuesDe(a, { lead: false, motivo: 'sin email ni teléfono' }, new Date(T0 + H));
  assert.equal(b.lead, a.lead, 'un aviso que no fue un lead no cuenta como que el puente siga trayendo gente');
  assert.equal(b.entrega, new Date(T0 + H).toISOString());
  assert.equal(b.motivo, 'sin email ni teléfono');
  assert.equal(estadoDespuesDe(b, { lead: true }, new Date(T0 + 2 * H)).motivo, null, 'el próximo lead borra el motivo');
});

test('lo guardado se sanea: basura no tira', () => {
  for (const crudo of [null, undefined, '', 'no es json', '[]', '"x"', '{"lead":"ayer"}']) assert.deepEqual(parsearEstadoZapier(crudo as string), ESTADO_VACIO);
  assert.deepEqual(parsearEstadoZapier(JSON.stringify({ entrega: '2026-10-23T12:00:00Z', lead: null, motivo: '  ' })), { entrega: '2026-10-23T12:00:00Z', lead: null, motivo: null });
  assert.equal(haceCuanto(new Date(T0 - 10 * 60_000).toISOString(), T0), 'menos de 1 h');
  assert.equal(haceCuanto(new Date(T0 - 47 * H).toISOString(), T0), '47 h');
  assert.equal(haceCuanto(new Date(T0 - 49 * H).toISOString(), T0), '2 días');
});

// ── 4. El cableado ───────────────────────────────────────────────────────────

const RUTA = sinComentarios(leer('../app/api/webhooks/zapier/route.ts'));
const PUERTA = sinComentarios(leer('../lib/zapier-leads.ts'));

test('la ruta: la clave va en el header, se rutea por su hash y se prueba en tiempo constante', () => {
  assert.match(RUTA, /secretoDelHeader\(req\.headers\.get\('x-mako-clave'\)\)/);
  assert.match(RUTA, /wsPorIdentificadorEstricto\('zapier', hashDeRuteo\(/);
  assert.match(RUTA, /credWsEstricta\('ZAPIER_LEADS_CLAVE', ws\)/);
  assert.match(RUTA, /igualesSeguro\(guardada, clave\)/);
  assert.equal((RUTA.match(/responderFalloDeRuteo\('zapier'/g) ?? []).length, 1);
  // El mismo 401 para «no te conozco» y «no coincide»: una sola condición los junta.
  assert.match(RUTA, /if \(ws == null \|\| !igualesSeguro\(/);
  assert.ok(!/searchParams\.get\(/.test(RUTA), 'la clave va en un header, nunca en la URL');
});

test('la ruta: el lead entra adentro de su workspace y el error no viaja en el cuerpo', () => {
  assert.match(RUTA, /runWithWorkspace\(wsFinal, \(\) => ingresarLeadDeZapier\(wsFinal, lead\)\)/);
  assert.ok(!/\.from\(['"]leads['"]\)/.test(RUTA), 'la ruta escribe leads por su cuenta');
  assert.ok(!/createLead\(|updateLead\(|upsertLeadFromMeta\(/.test(RUTA), 'la ruta da de alta por fuera de la puerta');
  assert.ok(!/reintentar: false, motivo/.test(RUTA), 'el motivo de un error de base puede traer el email: va al log, no al cuerpo');
  // Un aviso sin contacto se ve en Zapier (422), no se pierde en un 200.
  assert.match(RUTA, /status: lead\.porque === 'contacto' \? 422 : 400/);
});

test('la puerta: el lead entra por upsertLeadFromMeta y dispara lo inmediato, sólo si es nuevo y reciente', () => {
  assert.match(PUERTA, /await upsertLeadFromMeta\(\{/);
  assert.ok(!/\.from\(['"]leads['"]\)/.test(PUERTA), 'la puerta no escribe `leads` con un .from propio');
  assert.ok(!/createLead\(/.test(PUERTA), 'una segunda puerta de leads');
  assert.match(PUERTA, /meta_lead_id: metaLeadId,/);
  assert.match(PUERTA, /created && esNuevoParaElNegocio\(l\.creadoEn \?\? ahora\.toISOString\(\), ahora\.getTime\(\)\)/);
  assert.match(PUERTA, /await alNacerLeadDeMeta\(ws, /);
  // La conversión usa el MISMO event_id que el webhook de Meta, y el id propio nunca viaja como lead_id.
  assert.match(PUERTA, /eventId: eventIdLeadCrudo\(metaLeadId\)/);
  assert.match(PUERTA, /metaLeadId: l\.leadgenId,/);
  // Y lo inmediato va DESPUÉS de crear: un lead que no se creó no se anuncia.
  assert.ok(PUERTA.indexOf('alNacerLeadDeMeta(ws') > PUERTA.indexOf('upsertLeadFromMeta({'));
});

test('el servicio está en todos los registros que lo hacen andar', () => {
  assert.ok(RUTEO_POR_HASH.has('ZAPIER_LEADS_CLAVE'), 'sin esto la fila de ruteo guarda la clave EN CLARO');
  assert.match(leer('../lib/webhook-routing.ts'), /\bZAPIER_LEADS_CLAVE: 'zapier'/);
  assert.match(leer('../lib/webhook-ruteo-huella.ts'), /\| 'zapier';/);
  assert.match(leer('../lib/webhook-ruteo-huella.ts'), /'skool', 'zapier'\]\)/);
  assert.ok(DEFS_TEST.some((d) => d.key === 'zapier' && d.envs.join() === 'ZAPIER_LEADS_CLAVE'), 'falta la tarjeta');
  assert.equal(esIntegracionDeLeads('zapier'), true, 'sin configurar no puede bajar el N/M de nadie');
  // Y NO es una «fuente que avisa»: esas entran por `ingresarDeFuente`, que no dispara nada. Un lead de Meta sí dispara.
  assert.equal(esFuenteQueAvisa('zapier'), false, 'zapier entraría por la puerta que no dispara el aviso ni las automatizaciones');
  assert.ok((SLIDES.zapier ?? []).length >= 3, 'faltan las slides');
  assert.match(leer('../lib/metodo-verificar.ts'), /async zapier\(v\)/);
  assert.match(leer('../app/_components/ServicioVisual.tsx'), /^ {2}zapier: \{ letter: 'Z', bg: '#FF4F00' \},$/m);
  // La tarjeta lee lo que llegó, no la clave; y la grilla no esconde de «Requiere tu atención» al puente que se calló.
  assert.match(sinComentarios(leer('../lib/integraciones.ts')), /d\.key === 'zapier' && !faltan\.length/);
  assert.match(sinComentarios(leer('../app/integraciones/IntegracionesBoard.tsx')), /&& !i\.callada\)/);
});

test('el negocio sabe qué cuesta: Zapier de pago y Make con plan gratis, en la tarjeta, y en la guía con fecha y links', () => {
  // Zapier, leído en sus páginas oficiales el 23/10/2026: Facebook Lead Ads es una app premium (Professional, Team y Enterprise)
  // y «Webhooks by Zapier» tampoco está en Free. Make, leído por el Cerebro en un navegador el mismo día: tiene plan Free y
  // Facebook Lead Ads no es una «Enterprise app». Prometer el puente sin decirlo es prometerlo gratis (Zapier) o de pago (Make).
  const catalogo = sinComentarios(leer('../lib/metodo-catalogo.ts'));
  const bloque = catalogo.slice(catalogo.indexOf("key: 'zapier'"), catalogo.indexOf("key: 'apify'"));
  assert.match(bloque, /Zapier pide plan de pago \(Professional\); Make tiene plan gratis/, 'la tarjeta no dice qué cuesta cada camino');
  assert.match(bloque, /en Make, «Make»/, 'en Make se asigna la app «Make» como CRM, no «Zapier»');
  const guia = leer('../docs/guia-leads-por-zapier.md');
  assert.match(guia, /Cuánto cuesta \(leído el 23\/10\/2026\)/, 'el precio sin fecha envejece sin que nadie lo vea');
  assert.match(guia, /Plan mínimo: Professional, desde US\$19,99/, 'la guía perdió el plan mínimo de Zapier');
  assert.ok(guia.includes('https://help.zapier.com/hc/en-us/articles/8496061306253'), 'falta el link a la ayuda oficial de Facebook Lead Ads');
  assert.ok(guia.includes('https://zapier.com/pricing'), 'falta el link a los precios oficiales de Zapier');
  assert.ok(guia.includes('https://www.make.com/pricing'), 'falta el link a los precios de Make');
  assert.match(guia, /Free: US\$0, 1\.000 créditos al mes/, 'la guía perdió el plan gratis de Make');
  // Y lo que NO está medido sigue marcado como tal: «gratis» en Make es «gratis para probar» hasta medirlo con una cuenta.
  assert.match(guia, /Sin medir \(1\)[\s\S]*Sin medir \(2\)/, 'se borró lo que falta medir del plan gratis de Make');
});

test('la ruta es pública por el prefijo de webhooks, y sólo acepta POST con cuerpo', () => {
  assert.match(sinComentarios(leer('../lib/rutas-publicas.ts')), /'\/api\/webhooks'/);
  assert.match(RUTA, /export async function POST\(/);
  assert.match(RUTA, /TOPE_CUERPO = 64 \* 1024/);
  assert.match(RUTA, /status: 413/);
});

// ── PROBADO ROMPIÉNDOLO el 23/10/2026 ──────────────────────────────────────────────────────────────────────────────────
// Una rotura por vez, restaurada DE MEMORIA (nunca con git checkout). Base: 21 pasan / 0 fallan. Las 28 dieron 1 fallo
// (la primera, 2) en el test que corresponde; restaurado: 21 / 0.
//   · EL LECTOR: el nombre del anuncio vuelve a leerse como el de la persona (2 fallos) · el nombre completo sin ir adelante ·
//     nombre y apellido sin juntarse · un `id` cualquiera como leadgen_id · `whatsapp` sin ser un teléfono · sin tope de campos.
//   · EL ID: sin el workspace adentro · ignorando el leadgen real · cambiando con cada reintento.
//   · LA TARJETA: ámbar para un puente que nunca recibió nada · el límite de 72 h inclusivo · un aviso sin contacto contado
//     como lead.
//   · LA RUTA: ruteando con la lectura que traga el error · la clave comparada con === · la clave en la URL · el 422 vuelto un
//     200 · el lead entrando fuera de `runWithWorkspace`.
//   · LA PUERTA: crear con `createLead` · anunciar aunque no sea nuevo · sin `alNacerLeadDeMeta` · el id propio mandado a Meta
//     como lead_id.
//   · LOS REGISTROS: la clave sin ir por hash · sin su fila de ruteo · sin logo · sin ping · sin la exención del medidor ·
//     la grilla escondiendo al puente caído · la tarjeta leyendo la clave y no lo que llegó.
//   · EL PLAN DE PAGO (mismo día, después del pedido del Cerebro): la tarjeta sin su primer paso «Zapier pide plan de pago…» · la
//     guía sin el plan mínimo · sin la fecha · sin el link a la ayuda oficial · sin el link a los precios: 5 de 5 (base 30 / 0).
//   · MAKE GRATIS (mismo día, después de la lectura del Cerebro): la tarjeta sin «Make tiene plan gratis» · sin la app «Make»
//     como CRM · la guía sin la fecha · sin el plan mínimo · sin el link de Make · sin su plan Free · sin lo que falta medir:
//     7 de 7 (base 30 / 0).
// Y de punta a punta contra el ws3 (scripts/tmp-e2e-zapier.ts, no se commitea): docs/hallazgos-integraciones.md.
