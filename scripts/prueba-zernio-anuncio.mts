// =============================================================================
// LA PRUEBA QUE DECIDE si se publica por Zernio (23/10/2026)
// =============================================================================
// Pregunta: un anuncio con creativo NUEVO, creado por Zernio, ¿pasa en una cuenta cuyo dueño NO tiene
// rol en la app de Meta de Zernio? Si pasa, la app de Zernio está activa y tiene el acceso a anuncios, y
// el 1885183 de las apps en desarrollo de los clientes se esquiva. Si no, Zernio no sirve para esto.
//
// ⚠️ TIENE QUE SER UN ALTA REAL, EN PAUSA: el `validate_only` de Meta NO ve el 1885183 (medido el 11/09 en
// ws13: «validate_only sobre adcreatives no ve ninguno»), así que una prueba en seco diría «pasa» siempre.
//
// Dónde: la cuenta publicitaria de MaKo (act_1426493815659364, negocio de la plataforma), NUNCA la de un
// cliente (docs/hallazgos-ads.md, «Meta mientras se aprueba la app de MaKo»). Martín no tiene rol en la
// app de Zernio, así que la cuenta sirve. Con la clave de Zernio de la PLATAFORMA (lib/zernio-ads.ts: es
// la del negocio de la plataforma).
//
// NO SE CORRE SIN EL OK DE MARTÍN. Tres pasos:
//
//   1. conectar  → imprime el link de Zernio. Lo abre Martín y acepta BOTÓN POR BOTÓN: portafolio MaKo,
//                  cuenta publicitaria MaKo, página Hola MaKo. La ventana dice «Zernio».
//        NODE_OPTIONS="--conditions=react-server" node --import tsx scripts/prueba-zernio-anuncio.mts conectar
//   2. estado    → dice si la conexión ve la cuenta publicitaria de MaKo. Sólo lectura.
//        NODE_OPTIONS="--conditions=react-server" node --import tsx scripts/prueba-zernio-anuncio.mts estado
//   3. crear --si → crea campaña + conjunto + anuncio, TODO EN PAUSA (US$1 por día, nunca se prende).
//        NODE_OPTIONS="--conditions=react-server" node --import tsx scripts/prueba-zernio-anuncio.mts crear --si
//
// Qué leer: «PASÓ» con el id de Meta del anuncio, o el subcode de Meta. 1885183 = la app de Zernio está en
// desarrollo (no sirve). Al terminar, la campaña se borra a mano en el Administrador de anuncios de MaKo:
// está en pausa y no gasta. El resultado va a docs/hallazgos-ads.md y, si pasó, se prende
// `ZERNIO_ANUNCIOS_PROBADO` (lib/zernio-ads-cuerpo.ts).
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

const CUENTA_MAKO = 'act_1426493815659364';
const PAGINA_HOLA_MAKO = '1315098941694049';

const { wsSuperAdmin } = await import('../lib/workspace');
const { urlConectarAnunciosZernio, conexionAnunciosZernio, claveZernioAnuncios } = await import('../lib/zernio-ads');
const { subcodeDeZernio, idsDelAnuncioCreado } = await import('../lib/zernio-ads-cuerpo');

const paso = process.argv[2];
const ws = await wsSuperAdmin();

if (paso === 'conectar') {
  console.log(await urlConectarAnunciosZernio(ws, 'https://hola-mako.com/ads-manager'));
} else if (paso === 'estado') {
  const c = await conexionAnunciosZernio(ws, CUENTA_MAKO);
  console.log(c ? `Conectada: cuenta de Zernio ${c.accountId} → ${c.adAccountId}` : 'Sin conexión de anuncios que vea la cuenta de MaKo. Corré «conectar» primero.');
} else if (paso === 'crear' && process.argv.includes('--si')) {
  const c = await conexionAnunciosZernio(ws, CUENTA_MAKO);
  if (!c) throw new Error('Sin conexión de anuncios: corré «conectar» y «estado» antes.');
  const clave = await claveZernioAnuncios(ws);
  const res = await fetch('https://zernio.com/api/v1/ads/create', {
    method: 'POST',
    headers: { authorization: `Bearer ${clave}`, 'content-type': 'application/json', 'Idempotency-Key': `mako-prueba-zernio-${new Date().toISOString().slice(0, 10)}` },
    body: JSON.stringify({
      accountId: c.accountId, adAccountId: c.adAccountId,
      name: 'Prueba MaKo por Zernio (borrar)', goal: 'traffic', status: 'PAUSED',
      budgetAmount: 1, budgetType: 'daily', countries: ['AR'],
      headline: 'MaKo', body: 'Prueba de publicación (en pausa, no se entrega).',
      callToAction: 'LEARN_MORE', linkUrl: 'https://hola-mako.com/',
      imageUrl: 'https://hola-mako.com/og-mako.jpg', pageId: PAGINA_HOLA_MAKO,
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const cuerpo: unknown = await res.json().catch(() => null);
  if (res.ok && (cuerpo as { success?: unknown } | null)?.success !== false) {
    const { adId } = idsDelAnuncioCreado(cuerpo);
    console.log(`PASÓ: anuncio ${adId} creado EN PAUSA con creativo nuevo. Borrar la campaña «Prueba MaKo por Zernio (borrar)».`);
  } else {
    const sub = subcodeDeZernio(cuerpo);
    console.log(`NO PASÓ (HTTP ${res.status}, subcode de Meta ${sub ?? '—'}${sub === 1885183 ? ': la app de Zernio está en desarrollo' : ''}).`);
    // El cuerpo de Zernio no trae secretos (error, type, code, platformError, details).
    console.log(JSON.stringify(cuerpo, null, 2).slice(0, 2000));
  }
} else {
  console.log('Uso: conectar | estado | crear --si   (ver la cabecera del archivo)');
}
