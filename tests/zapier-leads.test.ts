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
  assert.deepEqual(tarjetaDelPuente(ESTADO_VACIO, T0), { estado: 'conectada', detalle: 'Esperando tu primer lead. Prueba tu escenario de Make o tu Zap.' });
  const hace = (h: number) => ({ entrega: new Date(T0 - h * H).toISOString(), lead: new Date(T0 - h * H).toISOString(), motivo: null });
  assert.deepEqual(tarjetaDelPuente(hace(5), T0), { estado: 'conectada', detalle: 'Último lead hace 5 h.' });
  assert.equal(tarjetaDelPuente(hace(HORAS_SIN_LEADS), T0).estado, 'conectada', 'justo en el límite todavía no');
  const callado = tarjetaDelPuente(hace(HORAS_SIN_LEADS + 1), T0);
  assert.equal(callado.estado, 'falta');
  assert.equal(callado.detalle, 'Sin leads hace 3 días. Revisa tu escenario de Make o tu Zap.');
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

// El bloque del servicio en el catálogo de /metodo, sin comentarios: lo que la persona lee en la tarjeta.
const catalogoZapier = (): string => {
  const catalogo = sinComentarios(leer('../lib/metodo-catalogo.ts'));
  return catalogo.slice(catalogo.indexOf("key: 'zapier'"), catalogo.indexOf("key: 'apify'"));
};

test('MAKE es el camino principal; Zapier, una línea de pago; y cada negocio usa SU cuenta', () => {
  // Decisión de Martín (23/10/2026): «Obvio que es mejor Make si tiene plan gratis… Y que los usuarios traigan su propia API
  // como siempre». La key del servicio sigue siendo 'zapier' (está en la base, el ruteo y la ruta); lo que cambia es lo que se lee.
  const bloque = catalogoZapier();
  assert.match(bloque, /nombre: 'Leads de Meta por Make o Zapier'/);
  assert.match(leer('../lib/integraciones-catalogo.ts'), /nombre: 'Leads de Meta por Make o Zapier'/, 'la grilla y el formulario tienen que llamarse igual');
  assert.match(bloque, /Usas tu propia cuenta de Make o de Zapier, de pago/, 'la tarjeta no dice que MaKo no paga ni comparte ninguna cuenta, y que son de pago');
  // Los pasos son los de Make; Zapier es el ÚLTIMO y de pago.
  const tutorial = bloque.slice(bloque.indexOf('pasos: ['));
  const pasos = [...tutorial.slice(0, tutorial.indexOf('],')).matchAll(/^\s+'((?:[^'\\]|\\.)+)',$/gm)].map((m) => m[1]);
  assert.equal(pasos.length, 5, 'el tutorial son 5 pasos');
  assert.match(pasos[1], /app «Make»/, 'en Leads Access se asigna la app «Make»');
  assert.match(pasos[2], /plan Core, US\$9 al mes/, 'el paso de Make no dice su plan mínimo ni su precio');
  assert.match(pasos[2], /«Watch Leads»[\s\S]*«Make a request»/, 'el paso 3 es el escenario de Make: Watch Leads y el módulo HTTP');
  assert.match(pasos[3], /X-MaKo-Clave/);
  assert.match(pasos[4], /^Con Zapier \(plan Professional, desde US\$20 al mes\)/, 'Zapier queda como alternativa de pago, con su plan mínimo, en una línea');
  assert.ok(!pasos.slice(0, 4).some((p) => /Zapier/.test(p) && !/app «Make»/.test(p)), 'Zapier se coló en los pasos de Make');
  // La guía arranca por Make: sus pasos van ANTES que los de Zapier y que el precio.
  const guia = leer('../docs/guia-leads-por-zapier.md');
  const iMake = guia.indexOf('## Los pasos con Make');
  assert.ok(iMake > 0 && iMake < guia.indexOf('## Con Zapier (alternativa, de pago)') && iMake < guia.indexOf('## Cuánto cuesta'), 'la guía tiene que arrancar por Make');
  assert.match(guia, /Cada negocio usa SU PROPIA cuenta/);
});

test('NADA de lo que lee el negocio promete «al instante», cuántos leads aguanta un plan, ni dice «gratis»', () => {
  // Sin medir con una cuenta de Make: si «Watch Leads» es instantáneo (en Free corre cada 15 minutos como mínimo) y si una
  // corrida vacía gasta crédito. Prometer lo uno o lo otro es prometer algo que nadie probó. El texto que explica que NO se
  // promete (la guía) puede nombrarlo; la tarjeta, las slides y el aviso de la API, no.
  // «gratis» y «sin costo»: Martín (23/10/2026) corrigió que el plan Free de Make no sirve; los dos caminos son de pago.
  const que = /al instante|instant[áa]ne|en el momento|inmediat|en segundos|\b500\b|2\.900|ilimitad|gratis|sin costo|sin cargo/i;
  const textos: Array<[string, string]> = [
    ['la tarjeta', catalogoZapier()],
    ['las slides', JSON.stringify(SLIDES.zapier)],
    ['el estado de la tarjeta', sinComentarios(leer('../lib/zapier-estado.ts'))],
    ['el aviso de la API', (leer('../lib/api-mako/areas/integraciones.run.ts').match(/'Leads de Meta por Make o Zapier[^\n]*/) ?? [''])[0]],
  ];
  for (const [donde, t] of textos) assert.ok(t.length > 20 && !que.test(t), `${donde} promete lo que no se midió: «${(que.exec(t) ?? [''])[0]}»`);
  // Y la guía deja escrito, sin poder borrarse, que no se promete.
  const guia = leer('../docs/guia-leads-por-zapier.md');
  assert.match(guia, /La pantalla no promete «al instante» ni cuántos leads aguanta cada plan, y no dice «gratis»/);
  assert.ok(!/gratis/i.test(guia.replace(/y no dice «gratis»/, '')), 'la guía dice «gratis» en algún lado');
});

test('el negocio sabe qué cuesta: Make desde Core y Zapier desde Professional, en la guía con fecha y links', () => {
  // Zapier, leído en sus páginas oficiales el 23/10/2026: Facebook Lead Ads es una app premium (Professional, Team y Enterprise)
  // y «Webhooks by Zapier» tampoco está en Free. Make, leído por el Cerebro en un navegador el mismo día: tiene plan Free y
  // Facebook Lead Ads no es una «Enterprise app». Prometer el puente sin decirlo es prometerlo gratis (Zapier) o de pago (Make).
  const guia = leer('../docs/guia-leads-por-zapier.md');
  assert.match(guia, /Cuánto cuesta \(leído el 23\/10\/2026\)/, 'el precio sin fecha envejece sin que nadie lo vea');
  assert.match(guia, /Plan mínimo: Professional, desde US\$19,99/, 'la guía perdió el plan mínimo de Zapier');
  assert.ok(guia.includes('https://help.zapier.com/hc/en-us/articles/8496061306253'), 'falta el link a la ayuda oficial de Facebook Lead Ads');
  assert.ok(guia.includes('https://zapier.com/pricing'), 'falta el link a los precios oficiales de Zapier');
  assert.ok(guia.includes('https://www.make.com/pricing'), 'falta el link a los precios de Make');
  assert.match(guia, /Core: US\$9 al mes/, 'la guía perdió el plan mínimo de Make');
  assert.match(guia, /El plan Free de Make no se ofrece/, 'la guía dejó de decir que el plan Free de Make no se ofrece');
  assert.ok(guia.includes('https://developers.make.com/api-documentation'), 'falta el link de lo que dice Make de su API');
  // Y lo que NO está medido sigue marcado como tal (el intervalo del disparador y si una corrida vacía gasta crédito).
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
//   · LOS PRECIOS Y LAS PROMESAS, en tres vueltas el mismo día (cada una contra la versión del momento):
//       · «Zapier de pago» (base 30 / 0): la tarjeta sin su aviso · la guía sin el plan mínimo · sin la fecha · sin el link a la ayuda
//         oficial · sin el link a los precios: 5 de 5.
//       · «Make principal y sin promesas» (base 32 / 0): la tarjeta llamada sólo por Zapier · la grilla y el formulario con nombres
//         distintos · en Leads Access «Zapier» en vez de «Make» · el paso 3 sin «Watch Leads» · Zapier sin ser la línea de pago · la
//         guía sin arrancar por Make · sin «cada negocio usa su propia cuenta» · la tarjeta prometiendo «al instante» · una slide con
//         «500 leads» · el estado de la tarjeta con «inmediato» · el aviso de la API con «en segundos» · la guía sin la frase de que
//         no se promete: 13 de 13.
//       · «De pago, sin gratis» (la versión final, base 32 / 0; Martín: el plan gratis de Make no sirve): el paso de Make sin su
//         plan y su precio · el de Zapier sin los suyos · la tarjeta sin «de pago» · la tarjeta con «gratis» (2 fallos) · una slide
//         con «gratis» · el aviso de la API con «sin costo» · la guía con «gratis» · la guía sin «el plan Free de Make no se
//         ofrece» · sin el precio de Core · sin el link de lo que dice Make de su API: 10 de 10.
// Y de punta a punta contra el ws3 (scripts/tmp-e2e-zapier.ts, no se commitea): docs/hallazgos-integraciones.md.
