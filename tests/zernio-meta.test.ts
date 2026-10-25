// =============================================================================
// Meta por la Zernio del negocio: la vía, las lecturas con la forma de Meta y CAPI (25/10/2026)
// =============================================================================
// Martín, 25/10: «implementa zernio y depreca la conexión con API de Meta... Y también revisa el tema de CAPI y alimentar
// al pixel». Zernio primero; el token de Meta queda de respaldo para los negocios que ya lo tenían. Todo apagado detrás
// de la prueba en la cuenta de MaKo (`ZERNIO_META_PROBADO`).
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ZERNIO_META_PROBADO, ENV_CUENTA_ZERNIO, viaDeMeta, metaConectadaConCampos, queryInsightsZernio, paginaDeInsights,
  paginaDeConjuntos, fuenteZernio, eventoParaZernio, resultadoConversionZernio, esFalloDePermiso, cuentasDeZernio,
  pixelesDeZernio, eleccionInicial, cuentaCrudaDesdeZernio, mediaDeAnuncio,
} from '../lib/zernio-meta-cuerpo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('apagado hasta la prueba en la cuenta de MaKo', () => {
  // Se prende con scripts/prueba-zernio-meta.mts pasada, y con su resultado en docs/hallazgos-integraciones.md.
  assert.equal(ZERNIO_META_PROBADO, false);
  // Y mientras tanto lo nuevo corre SÓLO en el negocio de la plataforma: nunca primero en un cliente.
  const via = leer('../lib/meta-via.ts');
  assert.match(via, /if \(ZERNIO_META_PROBADO\) return true;\n\s*return ws === \(await wsSuperAdmin\(\)/);
});

test('la vía: Zernio primero si está activo y hay conexión, cuenta y clave; si no, el token de siempre', () => {
  const base = { activo: true, cuentaZernio: 'z_meta_1', adAccountId: 'act_1426493815659364', claveZernio: true, token: 'EAAG-token' };
  assert.equal(viaDeMeta(base), 'zernio');
  // Apagado (un cliente antes de la prueba): sigue por su token como hoy.
  assert.equal(viaDeMeta({ ...base, activo: false }), 'token');
  // Sin la clave de Zernio, por el token.
  assert.equal(viaDeMeta({ ...base, claveZernio: false }), 'token');
  // Sin cuenta publicitaria no hay ninguna de las dos.
  assert.equal(viaDeMeta({ ...base, adAccountId: null }), 'ninguna');
  // Sólo Zernio, sin token: el negocio nuevo.
  assert.equal(viaDeMeta({ ...base, token: null }), 'zernio');
  assert.equal(viaDeMeta({ ...base, token: null, cuentaZernio: null }), 'ninguna');
  // Un PENDING no es un valor.
  assert.equal(viaDeMeta({ ...base, activo: false, token: 'PENDING_x' }), 'ninguna');
});

test('Meta conectada: token + cuenta, o la conexión de Zernio + cuenta; una cuenta sola no', () => {
  const con = (envs: string[]) => metaConectadaConCampos((e) => envs.includes(e));
  assert.equal(con(['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID']), true);
  assert.equal(con([ENV_CUENTA_ZERNIO, 'META_AD_ACCOUNT_ID']), true);
  assert.equal(con(['META_AD_ACCOUNT_ID']), false);
  assert.equal(con([ENV_CUENTA_ZERNIO]), false);
  // El token SIGUE obligatorio en el catálogo, y la conexión de Zernio es `derivado` (ningún «guardar» la acepta tipeada).
  // (El catálogo es `server-only`: se lee como texto.)
  const cat = leer('../lib/metodo-catalogo.ts');
  const linea = (env: string) => cat.split('\n').find((l) => l.includes(`{ env: '${env}'`)) ?? '';
  const token = linea('META_ACCESS_TOKEN');
  assert.match(token, /label: 'Access token'/);
  assert.doesNotMatch(token, /opcional: true/);
  const z = linea(ENV_CUENTA_ZERNIO);
  assert.match(z, /opcional: true/);
  assert.match(z, /auto: true/);
  assert.match(z, /derivado: true/);
});

test('los tres lectores de «conectada» usan la misma regla', () => {
  assert.match(leer('../lib/credenciales.ts'), /servicioKey === 'meta' && !principal[\s\S]{0,300}metaConectadaConCampos/);
  assert.match(leer('../app/api/metodo/route.ts'), /s\.key === 'meta' && metaConectadaConCampos/);
  // El tilde de /integraciones no pide el token a un negocio conectado por Zernio.
  assert.match(leer('../lib/metodo-verificar.ts'), /servicio\.key === 'meta' && !!valores\.META_ZERNIO_CUENTA && !valores\.META_ACCESS_TOKEN/);
});

test('insights: la query de Zernio con los valores de Meta tal cual', () => {
  const q = new URLSearchParams(queryInsightsZernio({
    accountId: 'z1', objectId: 'act_1', level: 'ad', fields: ['spend', 'actions'], desde: '2026-10-24', hasta: '2026-10-24', actionBreakdowns: ['action_type'],
  }));
  assert.equal(q.get('accountId'), 'z1');
  assert.equal(q.get('objectId'), 'act_1');
  assert.equal(q.get('level'), 'ad');
  assert.equal(q.get('fields'), 'spend,actions');
  assert.equal(q.get('fromDate'), '2026-10-24');
  assert.equal(q.get('toDate'), '2026-10-24');
  assert.equal(q.get('actionBreakdowns'), 'action_type');
  assert.equal(q.get('limit'), '500');
  assert.equal(q.get('after'), null);
  const q2 = new URLSearchParams(queryInsightsZernio({ accountId: 'z1', objectId: 'act_1', fields: [], datePreset: 'last_7d', limit: 9999, after: 'CUR', breakdowns: ['age', 'gender'], timeIncrement: 1 }));
  assert.equal(q2.get('datePreset'), 'last_7d');
  assert.equal(q2.get('limit'), '500');
  assert.equal(q2.get('after'), 'CUR');
  assert.equal(q2.get('breakdowns'), 'age,gender');
  assert.equal(q2.get('timeIncrement'), '1');
});

test('una página de insights sin `data` NO es «sin entrega»: es null (el cron borraría el día)', () => {
  assert.deepEqual(paginaDeInsights({ data: [], paging: {} }), { filas: [], after: null });
  const p = paginaDeInsights({ data: [{ ad_id: '1', spend: '3.5' }, null, 'x'], paging: { after: 'AB' } })!;
  assert.equal(p.filas.length, 1);
  assert.equal(p.after, 'AB');
  assert.equal(paginaDeInsights({ rows: [] }), null);
  assert.equal(paginaDeInsights(null), null);
});

test('conjuntos en vivo: el presupuesto de Zernio YA viene en unidades (no se divide por 100)', () => {
  const p = paginaDeConjuntos({
    currency: 'MXN',
    adSets: [
      { platformAdSetId: '11', adSetName: 'A', dailyBudget: 400, platformAdSetStatus: 'ACTIVE', configuredStatus: 'ACTIVE' },
      { platformAdSetId: 12, adSetName: null, dailyBudget: null, configuredStatus: 'PAUSED' },
      { adSetName: 'sin id' },
    ],
    paging: { adSets: { after: 'NEXT' } },
  })!;
  assert.equal(p.moneda, 'MXN');
  assert.equal(p.after, 'NEXT');
  assert.deepEqual(p.filas[0], { adset_id: '11', adset_name: 'A', presupuesto_diario: 400, status: 'ACTIVE' });
  // Bajo CBO no hay presupuesto propio: null, como con Meta.
  assert.deepEqual(p.filas[1], { adset_id: '12', adset_name: null, presupuesto_diario: null, status: 'PAUSED' });
  assert.equal(p.filas.length, 2);
  assert.equal(paginaDeConjuntos({ campaigns: [] }), null);
  // Y el cron no lo pasa por `desdeUnidadMeta` en la rama de Zernio.
  const ads = leer('../lib/meta-ads.ts');
  const rama = ads.slice(ads.indexOf('export async function fetchAdsetBudgets'), ads.indexOf("const adAccountId = await getEnv('META_AD_ACCOUNT_ID');", ads.indexOf('export async function fetchAdsetBudgets')));
  assert.match(rama, /daily_budget_mxn: a\.presupuesto_diario/);
  assert.doesNotMatch(rama, /desdeUnidadMeta\(/);
});

test('CAPI por Zernio: la identidad va EN CLARO (Zernio la hashea) y el eventId nunca falta', () => {
  const ev = eventoParaZernio({
    eventName: 'Lead', segundos: 1761350400, eventId: 'lead:123456789012345', actionSource: undefined,
    email: '  Ana@Ejemplo.com ', phone: '+52 (664) 123-4567', leadId: '123456789012345', externalId: ' UID-9 ', customData: { event_source: 'crm', lead_event_source: 'MaKo' },
  });
  assert.equal(ev.eventId, 'lead:123456789012345');
  assert.equal(ev.eventTime, 1761350400);
  assert.equal(ev.actionSource, 'system_generated');
  assert.deepEqual(ev.user, { email: 'ana@ejemplo.com', phone: '+526641234567', leadId: '123456789012345', externalId: 'uid-9' });
  // Nada hasheado: un sha256 adentro se hashearía dos veces y no cruzaría con nada.
  assert.doesNotMatch(JSON.stringify(ev.user), /[0-9a-f]{64}/);
  // Los campos de CRM viajan por `platformData` (Zernio los mezcla en `custom_data`).
  assert.deepEqual(ev.platformData, { event_source: 'crm', lead_event_source: 'MaKo' });
  // Sin id del llamador, uno ESTABLE: el mismo hecho repite el mismo id.
  const a = eventoParaZernio({ eventName: 'SubmitApplication', segundos: 100, email: 'a@b.co', phone: null, leadId: null });
  const b = eventoParaZernio({ eventName: 'SubmitApplication', segundos: 100, email: 'A@B.co', phone: null, leadId: null });
  assert.equal(a.eventId, b.eventId);
  assert.ok(a.eventId.length > 0);
  assert.equal(a.platformData, undefined);
  // Un email sin @ no se manda.
  assert.deepEqual(eventoParaZernio({ eventName: 'Lead', segundos: 1, email: 'nada', phone: '', leadId: null }).user, {});
});

test('CAPI por Zernio: el actionSource de Meta, en el idioma de Zernio', () => {
  assert.equal(fuenteZernio('website'), 'web');
  assert.equal(fuenteZernio('app'), 'app');
  assert.equal(fuenteZernio('system_generated'), 'system_generated');
  assert.equal(fuenteZernio('email'), 'system_generated');
  assert.equal(fuenteZernio(undefined), 'system_generated');
});

test('CAPI por Zernio: un rechazo de Meta viene en un 200 con eventsFailed, y un 200 sin eventos tampoco es éxito', () => {
  assert.deepEqual(resultadoConversionZernio({ platform: 'metaads', eventsReceived: 1, eventsFailed: 0, failures: [] }), { ok: true, recibidos: 1 });
  const r = resultadoConversionZernio({ eventsReceived: 0, eventsFailed: 1, failures: [{ eventIndex: 0, message: 'Invalid event_time', code: 100 }], traceId: 'AbC' });
  assert.equal(r.ok, false);
  assert.match((r as { detalle: string }).detalle, /Invalid event_time \(código 100\) · fbtrace AbC/);
  assert.equal(resultadoConversionZernio({ eventsReceived: 0, eventsFailed: 0 }).ok, false);
  assert.equal(resultadoConversionZernio(null).ok, false);
});

test('CAPI: sólo un fallo de PERMISO sobre el píxel prueba el token del píxel', () => {
  assert.equal(esFalloDePermiso(403, 'Zernio 403: forbidden'), true);
  assert.equal(esFalloDePermiso(409, 'connection required'), true);
  assert.equal(esFalloDePermiso(200, '(#200) Permissions error (código 200)'), true);
  assert.equal(esFalloDePermiso(200, 'Invalid event_time (código 100)'), false);
  assert.equal(esFalloDePermiso(500, 'Zernio 500: upstream failure'), false);
});

test('CAPI sale primero por Zernio, después por el token del píxel; nunca por un token que no está', () => {
  const capi = leer('../lib/meta-capi.ts');
  const envio = capi.slice(capi.indexOf('export async function sendMetaCAPIEvent'));
  const zernio = envio.indexOf("if (canal.via === 'zernio')");
  const graph = envio.indexOf('graph.facebook.com');
  assert.ok(zernio > 0 && graph > zernio, 'Zernio va antes que la Graph API');
  // Con Zernio sin permiso y SIN token, se devuelve el fallo (no se intenta con nada).
  assert.match(envio, /if \(!r\.permiso \|\| !hayToken\) return/);
  // La ficha («¿Era calificado?») ya no dice «sin token» a un negocio conectado por Zernio.
  assert.match(capi, /adondeDe\(destino, canal\.via === 'zernio' \? 'zernio' : accessToken\)/);
});

test('cuentas y píxeles de la conexión: sólo ids con forma, y se elige solo lo inequívoco', () => {
  const cuentas = cuentasDeZernio({ accounts: [
    { id: 'act_1426493815659364', name: 'MaKo', currency: 'USD', accountStatus: 1, timezoneName: 'America/Tijuana' },
    { id: '999', name: 'sin act_' },
    { id: 'act_1357728489423123', accountStatus: 3, disableReason: 0 },
  ] })!;
  assert.deepEqual(cuentas.map((c) => c.id), ['act_1426493815659364', 'act_1357728489423123']);
  assert.equal(cuentas[0].zonaHoraria, 'America/Tijuana');
  assert.equal(cuentas[1].estado, 3);
  assert.equal(cuentasDeZernio({ data: [] }), null);
  const pix = pixelesDeZernio({ destinations: [{ id: '1729525464415281', name: 'Website pixel', status: 'active' }, { id: 'abc' }, { id: 1234567, status: 'inactive' }] })!;
  assert.deepEqual(pix, [{ id: '1729525464415281', nombre: 'Website pixel', activo: true }, { id: '1234567', nombre: null, activo: false }]);
  // Una cuenta y un píxel activo: se eligen solos. Con dos cuentas, la persona (salvo que la ya elegida siga en la lista).
  assert.deepEqual(eleccionInicial({ cuentas: cuentas.slice(0, 1), pixeles: pix, cuentaActual: null, pixelActual: null }), { cuenta: 'act_1426493815659364', pixel: '1729525464415281' });
  assert.deepEqual(eleccionInicial({ cuentas, pixeles: [], cuentaActual: null, pixelActual: null }), { cuenta: null, pixel: null });
  assert.equal(eleccionInicial({ cuentas, pixeles: [], cuentaActual: 'act_1357728489423123', pixelActual: null }).cuenta, 'act_1357728489423123');
  assert.equal(eleccionInicial({ cuentas, pixeles: [], cuentaActual: 'act_5555555555', pixelActual: null }).cuenta, null);
});

test('la salud de la cuenta: Zernio da UNIDADES y la cuenta cruda vuelve a la unidad MÍNIMA de Meta', () => {
  const aMinima = (m: number, moneda: string | null) => Math.round(m * (moneda === 'COP' ? 1 : 100));
  const raw = cuentaCrudaDesdeZernio(
    { id: 'act_1', nombre: 'Cuenta 2', moneda: 'MXN', estado: 3, motivo: null, zonaHoraria: 'America/Tijuana' },
    { balance: 8743.59, amountSpent: 120000, spendCap: null, currency: 'MXN', fundingSource: { displayString: 'Mastercard *4985' } },
    aMinima,
  );
  assert.equal(raw.account_status, 3);
  assert.equal(raw.disable_reason, 0);
  assert.equal(raw.balance, 874359);
  assert.equal(raw.amount_spent, 12000000);
  assert.equal('spend_cap' in raw, false);
  assert.deepEqual(raw.funding_source_details, { display_string: 'Mastercard *4985' });
  assert.equal(raw.timezone_name, 'America/Tijuana');
  // Sin finanzas (la conexión sin permiso de facturación): el estado sale igual, sin montos.
  const sin = cuentaCrudaDesdeZernio({ id: 'act_1', nombre: null, moneda: 'COP', estado: 1, motivo: null }, null, aMinima);
  assert.equal(sin.account_status, 1);
  assert.equal('balance' in sin, false);
  assert.equal(sin.currency, 'COP');
});

test('el video de un anuncio por Zernio: el primer video con su link directo; sin video, la imagen', () => {
  const m = mediaDeAnuncio({ adId: '1', media: [
    { type: 'image', url: 'https://scontent.example/img.jpg' },
    { type: 'video', url: 'https://video.example/v.mp4?oe=AB', thumbnailUrl: 'https://scontent.example/poster.jpg', videoId: '9001', length: 31.5 },
    { type: 'video', url: 'https://video.example/otro.mp4' },
  ] })!;
  assert.deepEqual(m.video, { url: 'https://video.example/v.mp4?oe=AB', videoId: '9001', segundos: 31.5 });
  assert.equal(m.imagen, 'https://scontent.example/img.jpg');
  assert.deepEqual(mediaDeAnuncio({ media: [{ type: 'image', url: 'https://x.example/a.png' }] }), { video: null, imagen: 'https://x.example/a.png' });
  // Un link que no es https no va a un fetch del server.
  assert.deepEqual(mediaDeAnuncio({ media: [{ type: 'video', url: 'file:///etc/passwd' }] }), { video: null, imagen: null });
  assert.equal(mediaDeAnuncio({ items: [] }), null);
});

test('transcribir: con la clave de Zernio y sin token NUNCA cae al token del entorno, y los llamadores piden el acceso', () => {
  const t = leer('../lib/transcribe.ts');
  // Si Zernio falla y no hay token, tira (el resultado queda en `error`): no sigue con `env('META_ACCESS_TOKEN')`.
  assert.match(t, /if \(!opts\.metaToken\) throw e;/);
  assert.match(t, /const token = porZernio \? null : \(opts\?\.metaToken \?\? env\('META_ACCESS_TOKEN'\)\);/);
  for (const f of ['../app/api/cron/transcribe-ads/route.ts', '../app/api/regenerate-transcript/route.ts', '../lib/onboarding-extract.ts']) {
    const src = leer(f);
    assert.match(src, /const acceso = await accesoDeMeta\(\);\s*if \(!acceso\)/, `${f}: sin acceso tiene que cortar`);
    assert.match(src, /transcribeAd\(adId, \{[^}]*\.\.\.acceso \}\)/, `${f}: transcribeAd sin el acceso del negocio`);
  }
});
