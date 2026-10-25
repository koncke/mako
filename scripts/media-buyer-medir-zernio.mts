// =============================================================================
// MEDIR el Media Buyer por Zernio, de punta a punta, en la cuenta publicitaria de MaKo (25/10/2026)
// =============================================================================
// Lo que el pedido de Martín llama «Zernio publica y edita de punta a punta en la cuenta de prueba (medido)». Corre SÓLO
// sobre la cuenta de MaKo (`act_1426493815659364`, el negocio de la plataforma): nunca sobre la de un cliente. Usa las
// MISMAS funciones que el Media Buyer (lib/zernio-ads.ts), con la clave de Zernio de la plataforma (la de ese negocio).
//
// Antes hace falta que Martín conecte la cuenta a Zernio (un clic de permisos en Facebook): `conectar` imprime el link.
// La cuenta no tiene medio de pago: todo se crea EN PAUSA y no entrega. Cada paso que escribe exige `--si`.
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/media-buyer-medir-zernio.mts conectar
//   … estado
//   … crear --si        campaña + conjunto + anuncio EN PAUSA (US$1/día), con la imagen OG de MaKo
//   … editar --si       presupuesto 1 → 2, el anuncio pausado y prendido (la campaña sigue en pausa), una variación de texto
//   … borrar --si       borra la variación y la campaña entera
// El estado (los ids que creó) queda en C:/dev/cerebro-herramientas/media-buyer-prueba.json.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const CUENTA = 'act_1426493815659364';
const ESTADO = 'C:/dev/cerebro-herramientas/media-buyer-prueba.json';
const NOMBRE = 'PRUEBA MaKo · Media Buyer · no activar';
const paso = process.argv[2];
const si = process.argv.includes('--si');

const { wsSuperAdmin } = await import('../lib/workspace');
const z = await import('../lib/zernio-ads');
const ws = await wsSuperAdmin();
type Estado = { campaignId: string | null; adSetId: string | null; adId: string; variacion?: string | null; pasos: string[] };
const leer = (): Estado => JSON.parse(readFileSync(ESTADO, 'utf8')) as Estado;
const guardar = (e: Estado) => writeFileSync(ESTADO, JSON.stringify(e, null, 2));
const linea = (t: string, x?: unknown) => console.log(`· ${t}${x === undefined ? '' : ` ${JSON.stringify(x)}`}`);
const exigirSi = () => { if (!si) { console.error('Este paso ESCRIBE en Meta: repetilo con --si.'); process.exit(2); } };

async function conexion() {
  const c = await z.conexionAnunciosZernio(ws, CUENTA);
  if (!c) { console.error(`La cuenta ${CUENTA} no está conectada a la Zernio de la plataforma. Paso «conectar».`); process.exit(3); }
  return c;
}

if (paso === 'conectar') {
  const r = await z.urlConectarAnunciosZernio(ws, 'https://hola-mako.com/ads-manager?zernio=metaads', CUENTA);
  if ('yaConectado' in r) linea('ya está conectada');
  else console.log(`Abrí este link y aceptá los permisos (Facebook → la cuenta «MaKo»):\n${r.url}`);
} else if (paso === 'estado') {
  const c = await conexion();
  linea('conexión', c);
  const hoy = new Date().toISOString().slice(0, 10);
  const a = await z.arbolPorZernio(ws, c, '2026-10-01', hoy);
  linea('moneda', a.moneda);
  for (const camp of a.campanas) linea(`campaña ${camp.platformCampaignId} «${camp.campaignName}»`, { estado: camp.platformCampaignStatus, presupuesto: camp.budgetLevel, conjuntos: camp.adSets?.length ?? 0 });
  if (existsSync(ESTADO)) linea('lo creado por esta prueba', leer());
} else if (paso === 'crear') {
  exigirSi();
  const c = await conexion();
  const r = await z.crearCampanaPorZernio(ws, {
    accountId: c.accountId, adAccountId: c.adAccountId, name: NOMBRE, goal: 'traffic', budgetAmount: 1, budgetType: 'daily', status: 'PAUSED',
    countries: ['AR'], body: 'Prueba interna de MaKo. No se publica.', headline: 'Prueba MaKo', callToAction: 'LEARN_MORE',
    linkUrl: 'https://hola-mako.com/', imageUrl: 'https://hola-mako.com/og-mako.jpg',
  }, `mb-prueba:${CUENTA}:crear`);
  linea('creado', r);
  guardar({ ...r, pasos: [`crear ${new Date().toISOString()}`] });
} else if (paso === 'editar') {
  exigirSi();
  const e = leer();
  await conexion();
  const nivel = e.adSetId ? 'adset' as const : 'campaign' as const;
  const id = e.adSetId ?? e.campaignId!;
  try { linea('presupuesto 1 → 2', await z.cambiarPresupuestoPorZernio(ws, nivel, id, 2)); }
  catch (err) { linea('presupuesto del conjunto falló; pruebo en la campaña (CBO)', String(err)); linea('presupuesto campaña', await z.cambiarPresupuestoPorZernio(ws, 'campaign', e.campaignId!, 2)); }
  linea('anuncio → pausado', await z.cambiarEstadoPorZernio(ws, 'ad', e.adId, 'PAUSED'));
  linea('anuncio → prendido (la campaña sigue en pausa)', await z.cambiarEstadoPorZernio(ws, 'ad', e.adId, 'ACTIVE'));
  const v = await z.variacionPorZernio(ws, e.adId, { primary_text: 'Variación de prueba de MaKo. No se publica.', headline: 'Prueba MaKo v2' }, { nombre: 'MaKo v1', idempotencia: `mb-prueba:${CUENTA}:variacion` });
  linea('variación creada', v);
  guardar({ ...e, variacion: v.adId, pasos: [...e.pasos, `editar ${new Date().toISOString()}`] });
} else if (paso === 'borrar') {
  exigirSi();
  const e = leer();
  const c = await conexion();
  if (e.variacion) { await z.borrarAnuncioPorZernio(ws, e.variacion).catch((err) => linea('borrar variación', String(err))); linea('variación borrada'); }
  if (e.campaignId) { await z.borrarCampanaPorZernio(ws, e.campaignId, c.accountId); linea('campaña borrada', e.campaignId); }
  guardar({ ...e, pasos: [...e.pasos, `borrar ${new Date().toISOString()}`] });
} else {
  console.error('Pasos: conectar · estado · crear --si · editar --si · borrar --si');
  process.exit(1);
}
