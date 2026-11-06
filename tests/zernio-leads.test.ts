// =============================================================================
// Los leads de los formularios de Meta que llegan por Zernio (`lead.received`): el lector, la puerta y el cableado
// =============================================================================
// 23/10/2026, el Cerebro (Martín: el puente de Make/Zapier se retiró, «ya resolvimos todo con Zernio»). Lo que se fija acá, y por qué:
//   1. EL LECTOR, ejecutándolo: la forma del cuerpo sale de la TABLA de campos de docs.zernio.com/webhooks/ads (no trae un JSON de
//      ejemplo y ninguna persona recibió todavía un `lead.received` real). Se prueba lo que decide una IDENTIDAD —el leadgenId, que es
//      la llave de la deduplicación con el webhook de Meta— y que una MUESTRA de prueba de Zernio jamás cree un lead.
//   2. LA PUERTA, leyendo fuente: el lead entra por `upsertLeadFromMeta` (la misma que el webhook y el poll de Meta), con el leadgen_id
//      como `meta_lead_id`, la conversión `Lead` con el MISMO event_id que usa el webhook de Meta, y lo inmediato SÓLO con un lead
//      nuevo y reciente. Sin nombres de campaña inventados: el evento trae ids y no nombres.
//   3. EL WEBHOOK, leyendo fuente: el alta va adentro del pedido y la conversión y lo inmediato en `after` (Zernio corta a los 5 s); un lead NO reclama
//      el evento en `zernio_eventos` (su deduplicación es la del leadgen_id), porque un reclamo que no se puede soltar pierde el lead para siempre.
//   4. LA SUSCRIPCIÓN (los leads son un evento del complemento de anuncios de Zernio): se EJECUTA en tests/zernio-webhook-suscripcion.test.ts, con `fetch` falso.
//
// PROBADO ROMPIÉNDOLO el 23/10/2026, una rotura por vez y restaurando DE MEMORIA (los números, al pie del archivo).
//
// ⚠️ La revisión adversarial del 23/10 (cuatro revisores y un escéptico por hallazgo) cazó lo que este test NO veía: el reclamo del evento, la conversión
// atada a «lead creado», el orden de las claves de `fields` y que la suscripción sólo estaba fijada como texto. Cada una tiene su test abajo.
//
// Un test no puede importar un módulo `server-only` tal cual: el lector y las reglas puras (lib/zernio-lead.ts) se ejecutan; la puerta y la ruta se fijan
// sobre el FUENTE sin comentarios.
//
// Correr: npx tsx --test tests/zernio-leads.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { leerLeadDeZernio, queHacerConElLead, type IgnoradoZernio, type LeadDeZernio } from '../lib/zernio-lead';
import { NOMBRE_SIN_NOMBRE, parseLeadFields } from '../lib/meta-leads-campos';

const leer = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (ver AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const LEADGEN = '123456789012345'; // 15 dígitos: la forma de un leadgen_id

/** Un `lead.received` armado CON LA TABLA de la doc de Zernio (no es un cuerpo real). */
const cuerpo = (lead: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) => ({
  id: 'evt_1', event: 'lead.received', timestamp: '2026-10-23T18:00:05.000Z',
  lead: {
    id: 'zl_1', leadgenId: LEADGEN, formId: '444', formName: 'Formulario de ventas', adId: '111', adsetId: '222', campaignId: '333',
    fields: {
      full_name: 'Ana Pérez', email: 'ANA@Correo.com', phone_number: '+54 9 11 5555-1234', company_name: 'Pérez SA',
      '¿en_qué_plazo_querés_vender?': 'menos_de_3_meses',
    },
    isOrganic: false, createdAt: '2026-10-23T18:00:00.000Z', ...lead,
  },
  account: { id: 'acc_fb', accountId: 'acc_fb', platform: 'facebook', profileId: 'prof_1' },
  ...extra,
});

const ok = (c: unknown): LeadDeZernio => {
  const l = leerLeadDeZernio(c);
  assert.ok(!('ignorado' in l), `se ignoró un cuerpo válido: ${'ignorado' in l ? l.ignorado : ''}`);
  return l as LeadDeZernio;
};
const ignorado = (c: unknown): IgnoradoZernio => {
  const l = leerLeadDeZernio(c);
  assert.ok('ignorado' in l, 'se cargó un cuerpo que no es un lead');
  return l as IgnoradoZernio;
};

// ── 1. El lector ─────────────────────────────────────────────────────────────

test('el cuerpo de la tabla de la doc: contacto, ids, fecha y respuestas', () => {
  const l = ok(cuerpo());
  assert.equal(l.leadgenId, LEADGEN);
  assert.equal(l.creadoEn, '2026-10-23T18:00:00.000Z');
  assert.equal(l.email, 'ana@correo.com');
  assert.equal(l.nombre, 'Ana Pérez');
  assert.equal(l.telefono, '+54 9 11 5555-1234');
  assert.equal(l.empresa, 'Pérez SA');
  assert.deepEqual([l.anuncioId, l.conjuntoId, l.campanaId, l.formularioId, l.formularioNombre], ['111', '222', '333', '444', 'Formulario de ventas']);
  assert.equal(l.esOrganico, false);
  // Las respuestas, en la forma de Meta y en el orden en que vinieron; la pregunta propia no se pierde ni se confunde con un campo de contacto.
  assert.deepEqual(l.fieldData.map((f) => f.name), ['full_name', 'email', 'phone_number', 'company_name', '¿en_qué_plazo_querés_vender?']);
  assert.deepEqual(l.noReconocidos, ['¿en_qué_plazo_querés_vender?']);
});

test('el contacto lo saca el MISMO parser que el webhook y el poll de Meta', () => {
  const l = ok(cuerpo());
  const meta = parseLeadFields(l.fieldData);
  assert.deepEqual([l.nombre, l.telefono, l.empresa, l.noReconocidos], [meta.nombre, meta.telefono, meta.empresa, meta.noReconocidos]);
  // Sin nombre en el formulario: el mismo rótulo que Meta, no uno propio.
  assert.equal(ok(cuerpo({ fields: { email: 'a@b.co' } })).nombre, NOMBRE_SIN_NOMBRE);
});

test('el nombre de la PERSONA no depende del orden en que Zernio arme `fields`', () => {
  const nombreDe = (fields: Record<string, unknown>) => ok(cuerpo({ fields })).nombre;
  // El orden es del cuerpo, no medido: alfabético, inverso y el del formulario dan el mismo nombre.
  const base = { full_name: 'Ana Pérez', email: 'a@b.co', phone_number: '+5491155551234', company_name: 'Pérez SA' };
  assert.equal(nombreDe(base), 'Ana Pérez');
  assert.equal(nombreDe({ company_name: 'Pérez SA', email: 'a@b.co', full_name: 'Ana Pérez', phone_number: '1' }), 'Ana Pérez', 'company_name antes de full_name');
  assert.equal(nombreDe(Object.fromEntries(Object.entries(base).reverse())), 'Ana Pérez');
  assert.equal(nombreDe({ '¿cuál_es_el_nombre_de_tu_marca?': 'Acme', 'Full Name': 'Ana Pérez' }), 'Ana Pérez', 'una pregunta propia con «nombre» antes del nombre completo');
  assert.equal(nombreDe({ nombre_completo: 'Luis Gómez', empresa: 'X' }), 'Luis Gómez');
  // Un formulario que no pregunta el nombre completo: el primero y el apellido se juntan (con el parser solo salía «Ana»).
  assert.equal(nombreDe({ first_name: 'Ana', last_name: 'Pérez', email: 'a@b.co' }), 'Ana Pérez');
  assert.equal(nombreDe({ nombre: 'Luis', apellido: 'Gómez' }), 'Luis Gómez');
  assert.equal(nombreDe({ last_name: 'Pérez', first_name: 'Ana' }), 'Ana Pérez', 'el apellido antes del nombre');
  // Sin apellido, el nombre solo; sin nombre, el rótulo de Meta.
  assert.equal(nombreDe({ nombre: 'Luis' }), 'Luis');
  assert.equal(nombreDe({ email: 'a@b.co' }), NOMBRE_SIN_NOMBRE);
});

test('lo GUARDADO conserva el orden crudo, y el apellido que se juntó no se acusa de «sin columna»', () => {
  const l = ok(cuerpo({ fields: { first_name: 'Ana', last_name: 'Pérez', apellido_materno: 'Ruiz', '¿plazo?': 'ya' } }));
  assert.deepEqual(l.fieldData.map((f) => f.name), ['first_name', 'last_name', 'apellido_materno', '¿plazo?'], 'se guarda lo que contestó, sin el full_name armado');
  assert.ok(!l.fieldData.some((f) => f.name === 'full_name'));
  // `last_name` ya lo reconoce el parser de Meta (contiene «name»); la clave que sí se usó y NO contiene «name» es «apellido».
  const solo = ok(cuerpo({ fields: { nombre: 'Luis', apellido: 'Gómez', '¿plazo?': 'ya' } }));
  assert.equal(solo.nombre, 'Luis Gómez');
  assert.deepEqual(solo.noReconocidos, ['¿plazo?'], '«apellido» se usó en el nombre: no es una pregunta sin columna');
});

test('qué se hace con un lead: lo inmediato SÓLO si lo creó esta entrega y es de menos de 24 h; la conversión también con uno que ya existía', () => {
  const AHORA = Date.parse('2026-10-23T18:00:00.000Z');
  const hace = (h: number) => new Date(AHORA - h * 3_600_000).toISOString();
  // Un lead recién creado: las dos cosas.
  assert.deepEqual(queHacerConElLead(true, hace(0.1), AHORA), { nuevo: true, conversion: true });
  // Una reentrega, o un lead que ya entró por Meta o por el poll: NO es un lead nuevo, y la conversión sale (el event_id evita la doble).
  assert.deepEqual(queHacerConElLead(false, hace(0.1), AHORA), { nuevo: false, conversion: true });
  // Una persona que ya era un lead y llena OTRO formulario: created:false, y es una conversión nueva.
  assert.equal(queHacerConElLead(false, hace(1), AHORA).conversion, true);
  // Pasadas las 24 h, ya no es «un lead nuevo» (no manda un primer mensaje), pero la conversión sigue dentro de los 7 días de CAPI.
  assert.deepEqual(queHacerConElLead(true, hace(30), AHORA), { nuevo: false, conversion: true });
  assert.deepEqual(queHacerConElLead(true, hace(24 * 6.9), AHORA), { nuevo: false, conversion: true });
  // Pasados los 7 días, no hay hora buena que mandar.
  assert.deepEqual(queHacerConElLead(true, hace(24 * 7.1), AHORA), { nuevo: false, conversion: false });
  // Sin fecha legible: recién llegado (callarlo dejaría a un lead real sin que nadie le escriba).
  assert.deepEqual(queHacerConElLead(true, null, AHORA), { nuevo: true, conversion: true });
  assert.deepEqual(queHacerConElLead(false, null, AHORA), { nuevo: false, conversion: true });
  // Un reloj desfasado (la fecha en el futuro) tampoco es un lead viejo.
  assert.deepEqual(queHacerConElLead(true, new Date(AHORA + 3_600_000).toISOString(), AHORA), { nuevo: true, conversion: true });
});

test('lo técnico del evento NO se vuelve una respuesta del formulario', () => {
  // El nombre del formulario y los ids no están en `fields`: no tienen que colarse como «preguntas» ni como el nombre de la persona.
  const l = ok(cuerpo({ fields: { email: 'a@b.co' } }));
  assert.deepEqual(l.fieldData, [{ name: 'email', values: ['a@b.co'] }]);
  assert.equal(l.nombre, NOMBRE_SIN_NOMBRE, 'formName no es el nombre de la persona');
});

test('una MUESTRA de prueba de Zernio (`test: true`) no es un lead: jamás se carga', () => {
  assert.equal(ignorado(cuerpo({}, { test: true })).porque, 'prueba');
  // Sólo el `true` de verdad: un `test: "false"` o un `test: 0` de un cuerpo real no apaga un lead.
  assert.equal(ok(cuerpo({}, { test: false })).leadgenId, LEADGEN);
  assert.equal(ok(cuerpo({}, { test: 'false' })).leadgenId, LEADGEN);
});

test('el leadgenId es la llave de la deduplicación: sólo dígitos con forma de id de Meta', () => {
  const sinId = (lead: Record<string, unknown>) => assert.equal(ignorado(cuerpo(lead)).porque, 'sin_id', JSON.stringify(lead));
  for (const malo of [undefined, null, '', '   ', 'abc123456789', '12345', 'l:123456789012345', {}, [], true, 123456789012345678901]) {
    sinId({ leadgenId: malo });
  }
  assert.equal(ignorado(cuerpo({ leadgenId: undefined })).porque, 'sin_id');
  // El `id` de Zernio (`zl_1`) NO es el leadgenId: con él, el lead que también entra por Meta se duplicaba.
  sinId({ leadgenId: undefined, id: '123456789012345' });
  // Un id de 17 dígitos y uno de 15 son leadgen_id; un número seguro también (el redondeo de uno de 17 dígitos, no).
  assert.equal(ok(cuerpo({ leadgenId: '12345678901234567' })).leadgenId, '12345678901234567');
  assert.equal(ok(cuerpo({ leadgenId: 123456789012345 })).leadgenId, '123456789012345');
  assert.equal(ok(cuerpo({ leadgenId: ` ${LEADGEN} ` })).leadgenId, LEADGEN, 'los espacios de alrededor no son parte del id');
});

test('lo que no es un lead: sin cuerpo, sin objeto lead', () => {
  for (const malo of [null, undefined, 'x', 7, [], [cuerpo()]]) assert.equal(ignorado(malo).porque, 'cuerpo');
  assert.equal(ignorado({ id: 'e', event: 'lead.received' }).porque, 'cuerpo');
  assert.equal(ignorado({ id: 'e', lead: 'no soy un objeto' }).porque, 'cuerpo');
});

test('las respuestas: listas, números y vacíos se leen sin inventar nada', () => {
  const l = ok(cuerpo({
    fields: {
      full_name: 'Ana', email: 'a@b.co',
      'pregunta lista': ['k1', 'k2'], 'pregunta número': 3, 'pregunta bool': true,
      vacía: '', 'solo espacios': '   ', nula: null, objeto: { x: 1 }, 'lista vacía': [], '': 'sin nombre',
    },
  }));
  const por = new Map(l.fieldData.map((f) => [f.name, f.values]));
  assert.deepEqual(por.get('pregunta lista'), ['k1', 'k2']);
  assert.deepEqual(por.get('pregunta número'), ['3']);
  assert.deepEqual(por.get('pregunta bool'), ['sí']);
  for (const vacia of ['vacía', 'solo espacios', 'nula', 'objeto', 'lista vacía', '']) assert.equal(por.has(vacia), false, `«${vacia}» no es una respuesta`);
});

test('el tamaño: un cuerpo de 64 KB no es una ficha de 64 KB', () => {
  const muchos: Record<string, unknown> = { email: 'a@b.co' };
  for (let i = 0; i < 100; i++) muchos[`pregunta_${i}`] = `respuesta ${i}`;
  assert.equal(ok(cuerpo({ fields: muchos })).fieldData.length, 60, 'tope de 60 preguntas');
  const largo = ok(cuerpo({ fields: { email: 'a@b.co', texto: 'x'.repeat(5000), lista: Array.from({ length: 30 }, (_, i) => `v${i}`) } })).fieldData;
  assert.equal(largo.find((f) => f.name === 'texto')?.values?.[0].length, 1000, 'tope de 1000 caracteres por respuesta');
  assert.equal(largo.find((f) => f.name === 'lista')?.values?.length, 10, 'tope de 10 valores por pregunta');
});

test('la fecha de Meta: un string ISO; lo ilegible es «llegó ahora», no un Invalid Date', () => {
  assert.equal(ok(cuerpo({ createdAt: '2026-10-23T15:00:00-0300' })).creadoEn, '2026-10-23T18:00:00.000Z');
  // Un número NO se lee: no se sabe si son segundos o milisegundos, y uno en milisegundos da el año 58756 que rompe el insert (y el lead se pierde en los reintentos).
  for (const mala of ['ayer', '', null, undefined, {}, 1_792_000_000, 1_792_000_000_000]) assert.equal(ok(cuerpo({ createdAt: mala })).creadoEn, null, String(mala));
});

test('los ids de anuncio, conjunto y campaña: los que vienen; null si faltan', () => {
  const l = ok(cuerpo({ adId: null, adsetId: undefined, campaignId: 12345678901 }));
  assert.deepEqual([l.anuncioId, l.conjuntoId, l.campanaId], [null, null, '12345678901']);
  assert.equal(ok(cuerpo({ adId: 'con espacios' })).anuncioId, null, 'un id no tiene espacios');
});

test('el `fieldData` del REST NO se lee: la forma de un webhook se mide en el webhook', () => {
  // `GET /v1/ads/leads` trae `fieldData` y la tabla del webhook no lo lista. Leerlo sería el error de AGENTS.md (Cal.com, 06/10/2026).
  const l = ok(cuerpo({ fields: undefined, fieldData: [{ name: 'email', values: ['x@y.co'] }] }));
  assert.equal(l.email, null);
  assert.deepEqual(l.fieldData, []);
});

test('el lector es puro: sin `server-only` ni base', () => {
  const src = sinComentarios(leer('../lib/zernio-lead.ts'));
  assert.doesNotMatch(src, /server-only|supabase|getTenantDb|process\.env/);
  assert.match(src, /import \{ parseLeadFields, fechaDeMeta, type MetaFieldData \} from '\.\/meta-leads-campos';/, 'el contacto se lee con el parser de Meta');
});

// ── 2. La puerta ─────────────────────────────────────────────────────────────

const PUERTA = sinComentarios(leer('../lib/zernio-leads.ts'));
const META = sinComentarios(leer('../app/api/webhooks/meta-leads/route.ts'));

test('el lead entra por `upsertLeadFromMeta`, con el leadgen_id como `meta_lead_id`, y no escribe leads por su cuenta', () => {
  assert.match(PUERTA, /import \{ upsertLeadFromMeta, logLeadEvent \} from '\.\/leads';/);
  assert.match(PUERTA, /await upsertLeadFromMeta\(\{/);
  assert.match(PUERTA, /meta_lead_id: l\.leadgenId,/, 'sin el leadgen_id como llave, el lead que también entra por Meta se duplica');
  assert.doesNotMatch(PUERTA, /\.from\(\s*['"`]leads['"`]\s*\)|getTenantDb|getSupabaseServer/, 'una segunda puerta de leads');
  // Los ids deciden el producto de la campaña; los nombres no viajan en este evento y NO se inventan (ni se rellenan con el id).
  assert.match(PUERTA, /meta_ad_id: l\.anuncioId,\s+meta_campaign_id: l\.campanaId,\s+meta_adset_id: l\.conjuntoId,/);
  assert.doesNotMatch(PUERTA, /meta_(ad|campaign|adset)_name/);
  assert.match(PUERTA, /meta_created_at: l\.creadoEn,/, 'la fecha de Meta, no la de la ingesta');
  assert.match(PUERTA, /meta_campos_no_reconocidos: l\.noReconocidos,/);
});

test('la conversión `Lead` lleva el MISMO event_id y el mismo tipo que la del webhook de Meta', () => {
  assert.match(PUERTA, /eventName: 'Lead',/);
  assert.match(PUERTA, /eventId: eventIdLeadCrudo\(l\.leadgenId\),/);
  assert.match(META, /eventId: eventIdLeadCrudo\(leadgenId\),/, 'el webhook de Meta cambió de event_id: este tiene que cambiar con él');
  assert.match(PUERTA, /metaLeadId: l\.leadgenId,/);
  assert.match(PUERTA, /eventTime: l\.creadoEn,/, 'la hora REAL del formulario, no la de este pedido');
  const tipo = (src: string) => /customData: (\{ lead_type: '[a-z_]+' \})/.exec(src)?.[1];
  assert.equal(tipo(PUERTA), tipo(META), 'el lead_type de Zernio no es el de Meta');
});

test('lo inmediato SÓLO con un lead nuevo; la conversión también con uno que ya existía (como el webhook de Meta)', () => {
  // La decisión vive en una función PURA (probada arriba); la puerta tiene que usarla, y nada más.
  assert.match(PUERTA, /\.\.\.queHacerConElLead\(created, l\.creadoEn, ahora\.getTime\(\)\),/);
  assert.doesNotMatch(PUERTA, /esNuevoParaElNegocio/, 'la puerta decide por su cuenta, aparte de queHacerConElLead');
  const f = PUERTA.slice(PUERTA.indexOf('export async function alNacerLeadDeZernio('), PUERTA.indexOf('async function conversionDelLead('));
  assert.ok(f.indexOf('if (c.conversion) await conversionDelLead(ws, c, l);') >= 0, 'la conversión se manda con un lead que ya existía');
  assert.ok(f.indexOf('if (c.conversion)') < f.indexOf('if (!c.nuevo) return;') && f.indexOf('if (!c.nuevo) return;') < f.indexOf('alNacerLeadDeMeta('), 'lo inmediato sólo con un lead nuevo, después de la conversión');
  assert.match(f, /await alNacerLeadDeMeta\(ws, \{ id: c\.leadId, nombre: c\.nombre, telefono: c\.telefono \}, \{/);
  assert.match(f, /campana: null,/, 'sin nombre de campaña no se inventa uno');
});

test('la conversión y lo inmediato no se tumban entre sí ni tumban el alta', () => {
  const nacer = PUERTA.slice(PUERTA.indexOf('export async function alNacerLeadDeZernio('), PUERTA.indexOf('async function conversionDelLead('));
  const conversion = PUERTA.slice(PUERTA.indexOf('async function conversionDelLead('));
  assert.equal((nacer.match(/\} catch \(e\) \{/g) ?? []).length, 1, 'lo inmediato atrapa SU error');
  assert.equal((conversion.match(/\} catch \(e\) \{/g) ?? []).length, 1, 'la conversión atrapa SU error');
  assert.ok(conversion.indexOf('sendMetaCAPIEvent(') < conversion.indexOf('} catch (e) {'), 'el envío va DENTRO del try');
  // Lo que Meta rechaza va al historial del lead, no sólo al log.
  assert.match(conversion, /capi\.motivo === 'rechazado' \|\| capi\.motivo === 'http' \|\| capi\.motivo === 'red'/);
  assert.match(conversion, /logLeadEvent\(c\.leadId, 'Meta',/);
});

// ── 3. El webhook ────────────────────────────────────────────────────────────

const RUTA = sinComentarios(leer('../app/api/webhooks/zernio/route.ts'));

test('el webhook procesa `lead.received`: lo de la lista que se suscribe, no una lista aparte', () => {
  assert.match(RUTA, /import \{ [^}]*\bEVENTO_LEADS\b[^}]*\bEVENTOS_ESCUCHADOS\b[^}]*\} from '@\/lib\/zernio';/);
  assert.match(RUTA, /const EVENTOS: ReadonlySet<string> = new Set\(EVENTOS_ESCUCHADOS\);/);
  assert.doesNotMatch(RUTA, /\bEVENTOS_WEBHOOK\b/, 'el webhook volvió a la lista que no tiene los leads');
});

test('la rama de leads va DESPUÉS de la firma y del ruteo estricto, y confinada al workspace', () => {
  const i = (s: string) => { const k = RUTA.indexOf(s); assert.ok(k >= 0, `no está «${s}»`); return k; };
  const rama = i('if (evento === EVENTO_LEADS) {');
  assert.ok(i('verificarFirmaZernio(raw') < rama);
  assert.ok(i('wsPorIdentificadorEstricto(RUTEO_PERFIL, perfil)') < rama);
  assert.ok(i('aceptaElWorkspace(w, ws, cuentaPropia)') < rama, 'la firma tiene que ser de ESE negocio antes de cargarle un lead');
  assert.ok(rama < i('eventoSocialDe(body)'), 'la rama social se llevaría el lead');
  assert.ok(rama > i('return await runWithWorkspace(wsFinal'), 'el alta corre confinada al workspace');
});

test('un lead NO reclama el evento en zernio_eventos: su deduplicación es el leadgen_id, y un reclamo que no se suelta lo pierde', () => {
  const i = (s: string) => { const k = RUTA.indexOf(s); assert.ok(k >= 0, `no está «${s}»`); return k; };
  const reclama = i('const reclama = evento !== EVENTO_LEADS;');
  const claim = i(".upsert({ evento_id: eventoId, evento }, { onConflict: 'evento_id', ignoreDuplicates: true })");
  assert.ok(reclama < i('if (reclama) {') && i('if (reclama) {') < claim, 'el reclamo tiene que estar adentro del «si reclama»');
  assert.ok(claim < i('if (!(reclamo ?? []).length) return Response.json({ ok: true, event: evento, dedup: true });'));
  assert.ok(i('if (!(reclamo ?? []).length)') < i('const soltar = async () => {'), 'el dedup termina antes de definir soltar');
  // Soltar sin reclamo no borra nada (borraría el reclamo de OTRO evento con el mismo id), y cuando falla DICE por qué: supabase-js no rechaza, resuelve { error }.
  const soltar = RUTA.slice(i('const soltar = async () => {'), i('webhook_ok: true'));
  assert.match(soltar, /if \(!reclama\) return;/);
  assert.match(soltar, /const \{ error \} = await db\.from\('zernio_eventos'\)\.delete\(\)\.eq\('evento_id', eventoId\);\s+if \(error\) console\.error\(/);
  assert.doesNotMatch(soltar, /\.then\(\(\) => undefined, \(\) => undefined\)/, 'volvió a tragarse el error del DELETE');
});

test('el 500 no devuelve el mensaje de la base: «duplicate key» le confirma a quien firma con su secreto que ese lead existe en OTRO negocio', () => {
  const atrapa = RUTA.slice(RUTA.lastIndexOf('} catch (e) {'));
  assert.match(atrapa, /return Response\.json\(\{ ok: false, error: 'processing', event: evento \}, \{ status: 500 \}\);/);
  assert.doesNotMatch(atrapa, /message: msg\(e\)/);
  assert.match(atrapa, /console\.error\(`\[webhook:zernio\] procesando \$\{evento\} \(\$\{eventoId\}\): \$\{msg\(e\)\}`\);/, 'el mensaje sí va al log');
});

test('el alta va adentro del pedido; la conversión y lo inmediato, después de contestar y sólo con un lead nuevo', () => {
  const rama = RUTA.slice(RUTA.indexOf('if (evento === EVENTO_LEADS) {'), RUTA.indexOf('eventoSocialDe(body)'));
  assert.ok(rama.length < 2_500, `el recorte de la rama mide ${rama.length}: está mirando otra cosa`);
  assert.match(rama, /const l = leerLeadDeZernio\(body\);/);
  assert.match(rama, /const c = await cargarLeadDeZernio\(l\);/);
  const iAfter = rama.indexOf('after(async () => {');
  assert.ok(rama.indexOf('await cargarLeadDeZernio(l)') < iAfter, 'el alta tiene que estar hecha antes de contestar');
  assert.match(rama, /if \(c\.conversion \|\| c\.nuevo\) \{\s+after\(async \(\) => \{/, 'sin el filtro, un lead de hace un mes vuelve a avisar');
  assert.equal(rama.split('alNacerLeadDeZernio(').length - 1, 1);
  assert.ok(rama.indexOf('alNacerLeadDeZernio(') > iAfter, 'la conversión y lo inmediato adentro del pedido pasan los 5 s de Zernio');
  assert.match(rama, /runWithWorkspace\(wsFinal, \(\) => alNacerLeadDeZernio\(wsFinal, c, l\)\)/, '`after` corre FUERA del contexto: el workspace se fija de nuevo');
  // Una muestra se ignora con su motivo; un lead real que no se pudo leer (`cuerpo`, `sin_id`) NO se pierde en silencio: la FORMA que llegó va al log.
  assert.match(rama, /ignored: l\.porque/);
  assert.match(rama, /if \(l\.porque !== 'prueba'\) console\.error\(/);
  const forma = RUTA.slice(RUTA.indexOf('const formaDeLead = (b: unknown): string => {'), RUTA.indexOf('const formaDeLead = (b: unknown): string => {') + 900);
  assert.match(forma, /Object\.keys\(o\)/, 'del cuerpo se loguean las CLAVES');
  assert.doesNotMatch(forma, /JSON\.stringify|Object\.(values|entries)|\.values\b/, 'el log de la forma no puede llevar valores de las respuestas (son el email y el teléfono de la persona)');
  assert.match(forma, /typeof id === 'string' \? `string\/\$\{id\.length\}\/\$\{id\.slice\(0, 3\)\}`/, 'del leadgenId: tipo, largo y tres caracteres (un id, no un dato personal)');
});

// ── 4. La suscripción ────────────────────────────────────────────────────────

const ZERNIO = sinComentarios(leer('../lib/zernio.ts'));

function funcion(src: string, cabecera: string, tope = 3_000): string {
  const i = src.indexOf(cabecera);
  assert.ok(i >= 0, `no encontré «${cabecera}»`);
  const j = src.indexOf('\n}\n', i);
  assert.ok(j > i, `no encontré el cierre de «${cabecera}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${cabecera}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

test('los leads son un evento APARTE de los que ya andan', () => {
  const base = /export const EVENTOS_WEBHOOK = \[([^\]]*)\] as const;/.exec(ZERNIO)?.[1] ?? '';
  assert.ok(base.includes('message.received'), 'no leí la lista de siempre');
  assert.doesNotMatch(base, /lead\./, 'con los leads adentro, un 403 del complemento de anuncios le saca los mensajes al negocio');
  assert.match(ZERNIO, /export const EVENTO_LEADS = 'lead\.received';/);
  assert.match(ZERNIO, /export const EVENTOS_ESCUCHADOS: readonly string\[\] = \[\.\.\.EVENTOS_WEBHOOK, EVENTO_LEADS\];/);
});

test('`asegurarWebhook` pide los leads y, si Zernio los rechaza, registra los de siempre solos', () => {
  // Varias claves (29/10/2026): `asegurarWebhook` registra con la 1 y repite en cada extra; lo de los leads vive en `asegurarWebhookEn`.
  const entrada = funcion(ZERNIO, 'export async function asegurarWebhook(');
  assert.match(entrada, /const r = await asegurarWebhookEn\(ws, principal, maestro\);/, 'la clave 1 pasa por el mismo registro');
  const f = funcion(ZERNIO, 'async function asegurarWebhookEn(');
  const iConLeads = f.indexOf('await guardar([...EVENTOS_ESCUCHADOS]);');
  const iSolos = f.indexOf('await guardar([...EVENTOS_WEBHOOK]);');
  assert.ok(iConLeads > 0 && iSolos > iConLeads, 'primero con los leads, después sin ellos');
  // Sólo un 4xx de «este pedido no» reintenta; una key mala, un pago o una caída suben tal cual.
  assert.match(f, /if \(!\(e instanceof ZernioError\) \|\| !\[400, 403, 422\]\.includes\(e\.status\)\) throw e;/);
  assert.ok(f.indexOf('throw e;') < iSolos, 'el reintento va DESPUÉS de decidir que el error es de los leads');
  // El rechazo deja rastro (el negocio queda sin leads y alguien tiene que poder saber por qué).
  assert.match(f, /console\.warn\(`\[zernio\] ws\$\{ws\}: Zernio no acepta suscribir \$\{EVENTO_LEADS\}/);
  assert.match(f, /return nuestro \? 'actualizado' : 'creado';/);
  // Las dos escrituras: la del webhook que ya existe (PUT, lo reactiva) y la del nuevo (POST), con la lista que se le pase.
  assert.match(f, /method: 'PUT', body: JSON\.stringify\(\{ webhookId: nuestro\._id, secret, events, isActive: true \}\)/);
  assert.match(f, /method: 'POST', body: JSON\.stringify\(\{ name: 'MaKo', url, secret, events \}\)/);
});

// 5/11/2026: la regla salió a lib/zernio-leads-estado.ts (pura) y se EJECUTA acá; lo que queda del fuente es la unión: la URL que
// arma el webhook de la cuenta y el evento de los leads. Ejecutado también con fetch de mentira: tests/zernio-webhook-suscripcion.test.ts.
test('`leadsEnElWebhook` mide lo registrado: nuestra URL exacta, activo y con el evento', async () => {
  const { escuchaDelWebhook, escuchaComoBooleano } = await import('../lib/zernio-leads-estado');
  const url = 'https://hola-mako.com/api/webhooks/zernio?w=13';
  const ev = 'lead.received';
  const de = (ws: Array<{ url?: string; events?: string[]; isActive?: boolean }>) => escuchaComoBooleano(escuchaDelWebhook(ws, url, ev));
  assert.equal(de([{ url, events: [ev] }]), true);
  assert.equal(de([{ url: `${url}&x=1`, events: [ev] }]), null, 'sólo la URL EXACTA, como `asegurarWebhook`');
  assert.equal(de([]), null, 'sin el nuestro: null');
  assert.equal(de([{ url, events: [ev], isActive: false }]), false, 'apagado');
  assert.equal(de([{ url, events: ['message.received'] }]), false, 'sin el evento');
  const f = funcion(ZERNIO, 'export async function webhookDeLeads(');
  assert.match(f, /if \(!maestro\) return \{ hayMaestro: false, escucha: 'no-esta' \};/, 'sin el secreto maestro no se afirma nada');
  assert.match(f, /escuchaDelWebhook\(r\.webhooks \?\? \[\], linkApp\(ruta, null\), EVENTO_LEADS\)/);
  assert.match(funcion(ZERNIO, 'export async function leadsEnElWebhook('), /return w\.hayMaestro \? escuchaComoBooleano\(w\.escucha\) : null;/);
});
