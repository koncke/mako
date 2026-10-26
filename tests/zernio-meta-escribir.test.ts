// =============================================================================
// Un negocio SIN token administra sus campañas por la conexión de Facebook (Zernio) (26/10/2026)
// =============================================================================
// Martín, 26/10: «¿Los usuarios pueden leer, crear, editar y eliminar sus campañas?». Antes de este día, un negocio que conectó
// Meta sólo por Zernio tenía el árbol de la salud VACÍO (las edges pedían el token) y ninguna escritura: la API de MaKo no
// encontraba ninguna campaña para pausar, presupuestar o borrar. Acá: el árbol con la forma de la Graph API y las escrituras
// por Zernio, con la misma regla de siempre (antes de escribir, se lee de qué cuenta es el id).
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { arbolDesdeZernio, paginaDeAnuncios, entidadDeZernio, falloDeEscrituraZernio, siYaEstaBorrada, formulariosDeZernio, cuerpoFormularioZernio, publicosDeZernio, identidadesDeZernio, lugarCrudoDeZernio, interesDeZernio } from '../lib/zernio-meta-cuerpo';
import { lugarDesdeBusqueda } from '../lib/meta-geo';
import { paramsFormulario } from '../lib/meta-formularios';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('las identidades por Zernio: las páginas de la conexión pueden anunciar; la página usada como Instagram NO es una cuenta', () => {
  // La forma medida el 26/10/2026 en la conexión de MaKo, más una página con Instagram de empresa.
  const i = identidadesDeZernio({
    accounts: [
      { igUserId: '17841442463694004', username: '', isPageBacked: true, source: 'page_backed' },
      { igUserId: '1784100000000001', username: 'holamako', isPageBacked: false, source: 'ad_account' },
    ],
    pages: [
      { pageId: '1315098941694049', name: 'Hola MaKo' },
      { pageId: '222', name: 'Otra', instagramBusinessAccount: { igUserId: '1784100000000002', username: 'otra' } },
    ],
    resolved: { pageId: '1315098941694049', igUserId: null, source: null },
  });
  assert.deepEqual(i, {
    paginas: [
      { id: '1315098941694049', nombre: 'Hola MaKo', puedeAnunciar: true, instagram: null },
      { id: '222', nombre: 'Otra', puedeAnunciar: true, instagram: { id: '1784100000000002', username: 'otra' } },
    ],
    instagramCuenta: [{ id: '1784100000000001', username: 'holamako' }],
  });
  assert.equal(identidadesDeZernio({ pages: [] }), null);
});

test('buscar lugares e intereses por Zernio: los ids de Meta, leídos por el MISMO lector de lugares', () => {
  // Las formas medidas el 26/10/2026 con la conexión de MaKo («Córdoba» en AR, «marketing digital»).
  assert.deepEqual(lugarDesdeBusqueda(lugarCrudoDeZernio({ id: '84740', name: 'Ciudad de Córdoba', type: 'city', countryCode: 'AR', path: ['Córdoba', 'Argentina'] })),
    { tipo: 'city', key: '84740', nombre: 'Ciudad de Córdoba', pais: 'AR', region: 'Córdoba', regionId: null, ciudad: null, ciudadId: null });
  assert.deepEqual(lugarDesdeBusqueda(lugarCrudoDeZernio({ id: '101', name: 'Provincia de Córdoba', type: 'region', countryCode: 'AR', path: ['Argentina'] })),
    { tipo: 'region', key: '101', nombre: 'Provincia de Córdoba', pais: 'AR', region: null, regionId: null, ciudad: null, ciudadId: null });
  // Un país va por su código ISO (lo que Meta acepta en geo_locations.countries).
  assert.equal(lugarDesdeBusqueda(lugarCrudoDeZernio({ id: 'AR', name: 'Argentina', type: 'country', countryCode: 'AR', path: [] }))?.key, 'AR');
  // Un tipo que la búsqueda de MaKo no maneja no entra.
  assert.equal(lugarDesdeBusqueda(lugarCrudoDeZernio({ id: '9', name: 'X', type: 'metro', countryCode: 'US' })), null);
  assert.deepEqual(interesDeZernio({ id: '6003127206524', name: 'Marketing digital (marketing)', type: 'interest', path: ['Intereses', 'online (computación)', 'Marketing digital (marketing)'], audienceSize: 149444939 }),
    { id: '6003127206524', name: 'Marketing digital (marketing)', audience: 149444939, topic: 'online (computación)' });
  assert.equal(interesDeZernio({ name: 'sin id' }), null);
});

test('los públicos por Zernio: el id de META (el de una segmentación), sin las segmentaciones guardadas de Zernio', () => {
  assert.deepEqual(publicosDeZernio({ audiences: [
    { id: null, platformAudienceId: '238', name: 'Visitas 30 días', type: 'website', size: 1200 },
    { id: 'z1', platformAudienceId: '239', name: 'Clientes', type: 'customer_list' },
    { id: 'z2', accountId: 'a', name: 'Mi segmentación', type: 'saved_targeting', spec: {} },
    { id: 'z3', name: 'Sin id de Meta', type: 'lookalike' },
  ] }), [
    { id: '238', name: 'Visitas 30 días', subtype: 'WEBSITE', count: 1200 },
    { id: '239', name: 'Clientes', subtype: 'CUSTOM', count: null },
  ]);
  assert.equal(publicosDeZernio({ data: [] }), null);
});

test('crear un formulario por Zernio: las MISMAS preguntas, privacidad y pantalla final que por la Graph API', () => {
  const f = { nombre: ' Diagnóstico ', estandar: ['EMAIL', 'FULL_NAME'] as Array<'FULL_NAME' | 'EMAIL' | 'PHONE'>, propias: ['¿Qué vendes?'], mayorIntencion: true, privacidadUrl: 'https://hola-mako.com/privacidad', sitioUrl: 'https://hola-mako.com/' };
  const p = paramsFormulario(f);
  const c = cuerpoFormularioZernio('z_meta_1', p) as { accountId: string; name: string; privacyPolicyUrl: string; platformSpecificData: Record<string, unknown> };
  assert.equal(c.accountId, 'z_meta_1');
  assert.equal(c.name, 'Diagnóstico');
  assert.equal(c.privacyPolicyUrl, 'https://hola-mako.com/privacidad');
  // El orden de las preguntas sale de paramsFormulario (los datos del perfil primero), no de una segunda copia de la regla.
  assert.deepEqual(c.platformSpecificData.questions, JSON.parse(p.questions));
  assert.equal(c.platformSpecificData.isOptimizedForQuality, true);
  assert.equal(c.platformSpecificData.thankYouWebsiteUrl, 'https://hola-mako.com/');
  assert.equal(c.platformSpecificData.thankYouButtonType, 'VIEW_WEBSITE');
  assert.equal(c.platformSpecificData.locale, 'es_LA');
  // Zernio rechaza lo que no conoce (strict): nada de los nombres de la Graph API adentro.
  assert.ok(!('privacy_policy' in c.platformSpecificData) && !('thank_you_page' in c.platformSpecificData));
});

test('los formularios por Zernio: sólo los que se pueden usar en un anuncio, y la página siguiente sólo si hay más', () => {
  const r = formulariosDeZernio({
    forms: [
      { id: '111', name: 'Diagnóstico', status: 'ACTIVE' },
      { formId: '222', name: 'Viejo', status: 'ARCHIVED' },
      { platformFormId: '333', status: 'active' },
      { id: 'no-numerico', name: 'x' },
      null,
    ],
    pagination: { hasMore: true, cursor: 'c2' },
  });
  assert.deepEqual(r, { formularios: [{ id: '111', name: 'Diagnóstico', status: 'ACTIVE' }, { id: '333', name: '333', status: 'ACTIVE' }], cursor: 'c2' });
  assert.equal(formulariosDeZernio({ forms: [], pagination: { hasMore: false, cursor: 'c3' } })!.cursor, null);
  // Sin lista no es «no tienes formularios» (el error de siempre: el modal decía eso sobre una página con cuatro).
  assert.equal(formulariosDeZernio({ data: [] }), null);
});
// La de Meta (lib/presupuesto-cambio.ts → aUnidadMeta): centavos, salvo las monedas sin centavos.
const aMinima = (monto: number, moneda: string) => (moneda === 'COP' || moneda === 'CLP' ? Math.round(monto) : Math.round(monto * 100));

const LIVE = {
  currency: 'USD',
  campaigns: [
    { platformCampaignId: '111', campaignName: 'Campaña CBO', platformCampaignStatus: 'ACTIVE', configuredStatus: 'ACTIVE', dailyBudget: 12.5, budgetRemaining: 3 },
    { platformCampaignId: '222', campaignName: 'Campaña ABO', platformCampaignStatus: 'PAUSED', configuredStatus: 'PAUSED', dailyBudget: null },
  ],
  adSets: [
    { platformAdSetId: '1110', adSetName: 'Conjunto CBO', platformCampaignId: '111', platformAdSetStatus: 'ACTIVE', configuredStatus: 'ACTIVE', dailyBudget: null },
    { platformAdSetId: '2220', adSetName: 'Conjunto ABO', platformCampaignId: '222', platformAdSetStatus: 'CAMPAIGN_PAUSED', configuredStatus: 'ACTIVE', dailyBudget: 7 },
  ],
};
const ANUNCIOS = [
  { platformAdId: '9001', name: 'Prendido', platformAdSetId: '1110', platformCampaignId: '111', platformStatus: 'ACTIVE', configuredStatus: 'ACTIVE', status: 'active', platformObjective: 'OUTCOME_LEADS', platformCreatedAt: '2026-10-20T10:00:00Z' },
  { platformAdId: '9002', name: 'Rechazado', platformAdSetId: '2220', platformCampaignId: '222', platformStatus: 'DISAPPROVED', configuredStatus: 'ACTIVE', status: 'rejected', reviewStatus: 'rejected', rejectionReason: 'Texto engañoso' },
  // Lo que Zernio guarda y Meta ya no muestra: no entra al árbol.
  { platformAdId: '9003', name: 'Borrado', platformAdSetId: '1110', platformCampaignId: '111', platformStatus: 'DELETED', configuredStatus: 'DELETED', status: 'cancelled' },
  { platformAdId: '9004', name: 'Borrado con interruptor prendido', platformAdSetId: '1110', platformCampaignId: '111', configuredStatus: 'ACTIVE', status: 'cancelled' },
  // De un conjunto que ya no está vivo (la campaña se borró en Meta, Zernio todavía no sincronizó).
  { platformAdId: '9005', name: 'Fantasma', platformAdSetId: '3330', platformCampaignId: '333', platformStatus: 'ACTIVE', configuredStatus: 'ACTIVE', status: 'active' },
  // Repetido en dos páginas: una sola vez.
  { platformAdId: '9001', name: 'Prendido', platformAdSetId: '1110', platformCampaignId: '111', platformStatus: 'ACTIVE', configuredStatus: 'ACTIVE', status: 'active' },
];

test('el árbol por Zernio: la forma de la Graph API, con los presupuestos en la unidad MÍNIMA (toNodo los divide)', () => {
  const a = arbolDesdeZernio({ live: LIVE, anuncios: ANUNCIOS, aMinima, aprendizaje: new Map([['1110', { status: 'LEARNING' }]]) });
  assert.ok(a);
  assert.equal(a.moneda, 'USD');
  const cbo = a.campaigns.find((c) => c.id === '111')!;
  // 12,50 USD de Zernio son 1250 centavos para la Graph API; sin pasar por aMinima, toNodo pintaría 0,125.
  assert.equal(cbo.daily_budget, 1250);
  assert.equal(cbo.budget_remaining, 300);
  assert.equal(cbo.effective_status, 'ACTIVE');
  assert.equal(cbo.configured_status, 'ACTIVE');
  // El objetivo sólo viene en los anuncios.
  assert.equal(cbo.objective, 'OUTCOME_LEADS');
  assert.equal(a.campaigns.find((c) => c.id === '222')!.daily_budget, null);
  const abo = a.adsets.find((s) => s.id === '2220')!;
  assert.equal(abo.daily_budget, 700);
  assert.equal(abo.campaign_id, '222');
  // La entrega del conjunto (`CAMPAIGN_PAUSED`) y su interruptor propio, separados.
  assert.equal(abo.effective_status, 'CAMPAIGN_PAUSED');
  assert.equal(abo.configured_status, 'ACTIVE');
  assert.deepEqual(a.adsets.find((s) => s.id === '1110')!.learning_stage_info, { status: 'LEARNING' });
  // Un presupuesto en una moneda sin centavos no se multiplica.
  const cop = arbolDesdeZernio({ live: { ...LIVE, currency: 'COP', campaigns: [{ platformCampaignId: '1', dailyBudget: 50000 }], adSets: [] }, anuncios: [], aMinima });
  assert.equal(cop!.campaigns[0].daily_budget, 50000);
});

test('el árbol por Zernio: sólo los anuncios que Meta todavía muestra, y el rechazo con la forma de issues_info', () => {
  const a = arbolDesdeZernio({ live: LIVE, anuncios: ANUNCIOS, aMinima })!;
  assert.deepEqual(a.ads.map((x) => x.id), ['9001', '9002']);
  const rech = a.ads.find((x) => x.id === '9002')!;
  assert.equal(rech.effective_status, 'DISAPPROVED');
  assert.deepEqual(rech.issues_info, [{ error_summary: 'Anuncio rechazado', error_message: 'Texto engañoso' }]);
  const ok = a.ads.find((x) => x.id === '9001')!;
  assert.equal(ok.adset_id, '1110');
  assert.equal(ok.created_time, '2026-10-20T10:00:00Z');
  assert.equal(ok.issues_info, undefined);
  // Un anuncio viejo sin `platformStatus`: el estado de Zernio, en el idioma de Meta.
  const viejo = arbolDesdeZernio({ live: LIVE, anuncios: [{ platformAdId: '7', platformAdSetId: '1110', status: 'paused' }], aMinima })!;
  assert.equal(viejo.ads[0].effective_status, 'PAUSED');
});

test('el árbol por Zernio: una lectura sin moneda o sin listas es null (un árbol a medias diría «no tienes campañas»)', () => {
  assert.equal(arbolDesdeZernio({ live: { campaigns: [], adSets: [] }, anuncios: [], aMinima }), null);
  assert.equal(arbolDesdeZernio({ live: { currency: 'USD', campaigns: [] }, anuncios: [], aMinima }), null);
  assert.equal(arbolDesdeZernio({ live: null, anuncios: [], aMinima }), null);
  // Vacía pero bien formada: la cuenta no tiene campañas, y eso sí se dice.
  assert.deepEqual(arbolDesdeZernio({ live: { currency: 'USD', campaigns: [], adSets: [] }, anuncios: [], aMinima })?.campaigns, []);
});

test('la lista de anuncios pagina por número: sigue mientras page < pages', () => {
  assert.deepEqual(paginaDeAnuncios({ ads: [1, 2], pagination: { page: 1, pages: 3 } }), { anuncios: [1, 2], hayMas: true });
  assert.equal(paginaDeAnuncios({ ads: [], pagination: { page: 3, pages: 3 } })!.hayMas, false);
  assert.equal(paginaDeAnuncios({ ads: [] })!.hayMas, false);
  assert.equal(paginaDeAnuncios({ data: [] }), null);
});

test('de quién es y cómo está: campaña y conjunto del paso directo de Meta, el anuncio guardado por Zernio', () => {
  assert.deepEqual(entidadDeZernio('campaign', { campaign: { id: '111', account_id: '1426493815659364', configured_status: 'PAUSED', effective_status: 'PAUSED' } }),
    { cuenta: '1426493815659364', configurado: 'PAUSED', efectivo: 'PAUSED' });
  assert.deepEqual(entidadDeZernio('adset', { adSet: { account_id: '42', configured_status: 'ACTIVE', effective_status: 'CAMPAIGN_PAUSED' } }),
    { cuenta: '42', configurado: 'ACTIVE', efectivo: 'CAMPAIGN_PAUSED' });
  assert.deepEqual(entidadDeZernio('ad', { ad: { platformAdAccountId: 'act_42', configuredStatus: 'paused', platformStatus: 'PAUSED' } }),
    { cuenta: 'act_42', configurado: 'PAUSED', efectivo: 'PAUSED' });
  // ⚠️ Un anuncio BORRADO vuelve con `configuredStatus: ACTIVE`: no puede pasar por «prendido» (ni por «pausado» para borrarlo).
  assert.deepEqual(entidadDeZernio('ad', { ad: { platformAdAccountId: 'act_42', configuredStatus: 'ACTIVE', status: 'cancelled' } }),
    { cuenta: 'act_42', configurado: 'DELETED', efectivo: 'DELETED' });
  // Lo que no trae la entidad: null (quien llama no escribe).
  assert.equal(entidadDeZernio('campaign', { adSet: {} }), null);
  assert.equal(entidadDeZernio('ad', { ad: null }), null);
});

test('lo que Meta ya borró: pausarlo no es un éxito (Zernio contesta 200), y borrarlo otra vez ya está hecho', () => {
  const borrado = { cuenta: 'act_42', configurado: 'DELETED', efectivo: 'DELETED' };
  assert.equal(siYaEstaBorrada(borrado, 'status'), 'no_existe');
  assert.equal(siYaEstaBorrada(borrado, 'name'), 'no_existe');
  assert.equal(siYaEstaBorrada(borrado, 'delete'), 'hecho');
  // La entrega sola alcanza (una campaña borrada puede volver con su interruptor de antes).
  assert.equal(siYaEstaBorrada({ cuenta: 'act_42', configurado: 'PAUSED', efectivo: 'DELETED' }, 'budget'), 'no_existe');
  assert.equal(siYaEstaBorrada({ cuenta: 'act_42', configurado: 'PAUSED', efectivo: 'PAUSED' }, 'status'), null);
  // Y se mira ANTES de escribir.
  const z = leer('../lib/meta-escribir-zernio.ts');
  const cuerpo = z.slice(z.indexOf('export async function escribirPorZernio('));
  assert.ok(cuerpo.indexOf('siYaEstaBorrada(') > 0 && cuerpo.indexOf('siYaEstaBorrada(') < cuerpo.indexOf('cambiarEstadoPorZernio'));
  assert.match(cuerpo, /borrada === 'no_existe'\) return \{ ok: false/, 'escribirle a lo borrado tiene que rebotar');
});

test('un fallo de Zernio al escribir, dicho para la persona y con dónde se arregla', () => {
  const tope = falloDeEscrituraZernio(403, { code: 'ads_allowance_exceeded', error: 'Payment method required' }, 'Zernio 403');
  assert.equal(tope.status, 409);
  assert.match(tope.message, /medio de pago en Zernio/);
  assert.match(falloDeEscrituraZernio(403, { code: 'ad_account_not_selected' }, 'x').message, /Integraciones → Zernio/);
  assert.match(falloDeEscrituraZernio(409, { error: 'Account needs reconnection' }, 'x').message, /reconectarse/);
  assert.equal(falloDeEscrituraZernio(404, { error: 'Ad not found' }, 'x').status, 404);
  // El permiso de Meta (subcode 4841013 adentro de un 400 de Zernio) es un 403, con el mensaje de Meta.
  const perm = falloDeEscrituraZernio(400, { error: 'Meta error', platformError: { code: 100, error_subcode: 4841013, message: 'Permissions error' } }, 'x');
  assert.equal(perm.status, 403);
  assert.equal(perm.error_subcode, 4841013);
  assert.equal(perm.message, 'Permissions error');
  // El mensaje para el usuario de Meta le gana al técnico.
  assert.equal(falloDeEscrituraZernio(400, { platformError: { code: 100, message: 'Invalid parameter', error_user_msg: 'El presupuesto es muy bajo' } }, 'x').message, 'El presupuesto es muy bajo');
  assert.equal(falloDeEscrituraZernio(500, null, 'Zernio 500: boom').status, 502);
});

test('escribirEnMeta: valida, y un negocio por Zernio escribe por Zernio ANTES de pedir el token; nunca por el de respaldo', () => {
  const w = leer('../lib/meta-write.ts');
  const cuerpo = w.slice(w.indexOf('async function escribirEnMeta('));
  const iValidar = cuerpo.indexOf('validar(body)');
  const iZernio = cuerpo.indexOf("canal.via === 'zernio'");
  const iToken = cuerpo.indexOf("credWs('META_ACCESS_TOKEN', ws)");
  assert.ok(iValidar > 0 && iZernio > iValidar && iToken > iZernio, 'el orden es: validar, Zernio, y recién después el token');
  assert.ok(!/respaldo/.test(cuerpo.slice(iZernio, iToken)), 'la rama de Zernio no escribe con el token de respaldo');
  // El rename se propaga a NUESTROS datos también por Zernio.
  assert.match(cuerpo.slice(iZernio, iToken), /propagarRename\(ws, body\.level, body\.id/);
});

test('escribir por Zernio: primero de quién es el id, después la escritura; y las trampas con su texto', () => {
  const z = leer('../lib/meta-escribir-zernio.ts');
  const cuerpo = z.slice(z.indexOf('export async function escribirPorZernio('));
  const iCuenta = cuerpo.indexOf('fueraDeLaCuenta(c, body.level, body.id)');
  const iPrimera = Math.min(...['borrarCampanaPorZernio', 'cambiarEstadoPorZernio', 'cambiarPresupuestoPorZernio', 'renombrar('].map((x) => cuerpo.indexOf(x)));
  assert.ok(iCuenta > 0 && iPrimera > iCuenta, 'se escribía antes de saber si el id es de la cuenta del negocio');
  // La verificación compara con la cuenta del negocio, no con lo que diga el pedido.
  assert.match(z, /esDeLaCuenta\(e\.cuenta, c\.adAccountId\)/);
  assert.match(z, /sin anuncios/);
});

test('lib/meta-ads-create.ts: un negocio por Zernio lee por SU Zernio y crea el anuncio por ahí, comprobando la cuenta primero', () => {
  const m = leer('../lib/meta-ads-create.ts');
  const fn = (nombre: string) => { const i = m.indexOf(`export async function ${nombre}(`); assert.ok(i > 0, nombre); return m.slice(i, m.indexOf('\n}\n', i)); };
  // Las lecturas por id pasan por la puerta que elige la vía (Zernio, con el token de respaldo).
  for (const f of ['getAdsetTargeting', 'getAdsetForAdd', 'getCampaignBasics']) assert.match(fn(f), /leerObjetoMeta\(/, `${f} no pasa por leerObjetoMeta`);
  for (const f of [
    'getAdForEdit', 'cuentaMeta', 'listPixels', 'crearAnuncioEnConjunto', 'listLeadForms', 'crearFormularioInstantaneo',
    'listCustomAudiences', 'identidadesMeta', 'searchInterests', 'searchLugares',
  ]) assert.match(fn(f), /canalZernio\(\)/, `${f} no mira si el negocio va por Zernio`);
  // La puerta: Zernio primero; el token SÓLO si Zernio falla y el negocio lo conserva.
  const puerta = m.slice(m.indexOf('async function leerObjetoMeta('), m.indexOf('async function leerObjetoMeta(') + 900);
  assert.match(puerta, /if \(!z\.respaldo\) throw/);
  // Crear por Zernio: la cuenta del conjunto se comprueba ANTES de crear, y la clave sale del cuerpo (no del nombre).
  const crear = m.slice(m.indexOf('async function anuncioPorZernioDelNegocio('), m.indexOf('export async function crearAnuncioEnConjunto('));
  assert.ok(crear.indexOf("cuentaDelObjeto(adsetId, 'adset')") > 0 && crear.indexOf("cuentaDelObjeto(adsetId, 'adset')") < crear.indexOf('crearAnuncioPorZernio('));
  assert.match(crear, /const firma = createHash\('sha256'\)\.update\(JSON\.stringify\(cuerpo\)\)/);
  assert.match(crear, /crearAnuncioPorZernio\(z\.ws, cuerpo, `mako:\$\{adsetId\}:\$\{firma\}:/, 'la clave de idempotencia por nombre devuelve el anuncio borrado o choca con otro cuerpo');
  // Sin token y por Zernio, el error no manda a configurar el token deprecado.
  assert.match(m, /name === 'META_ACCESS_TOKEN' && \(await canalZernio\(\)\)/);
  // La biblioteca de imágenes: Zernio corta en 100 por página.
  assert.match(leer('../lib/meta-via.ts'), /fields: 'hash,url', limit: '100'/);
});

test('el árbol de la salud y el estado en vivo leen por Zernio cuando el negocio conectó por ahí', () => {
  const h = leer('../lib/meta-health.ts');
  assert.match(h, /\(await edgesPorZernio\(\)\) \?\? await Promise\.allSettled/);
  // Sin token de respaldo, una lectura fallida deja el árbol `parcial`, no vacío.
  assert.match(h, /if \(canal\.respaldo\) return null;\n\s*return \[\{ status: 'rejected'/);
  assert.match(h, /campanasYConjuntosCrudos\(\)/);
  const help = leer('../lib/api-mako/areas/ads.helpers.ts');
  assert.match(help, /canal\.via === 'zernio'[\s\S]{0,200}entidadPorZernio/);
  // Quien decide un borrado le pasa el nivel (cada nivel tiene su endpoint en Zernio).
  assert.match(leer('../lib/api-mako/areas/ads.run.ts'), /estadoVivoMeta\(String\(p\.id\), ctx\.ws, level\)/);
});
