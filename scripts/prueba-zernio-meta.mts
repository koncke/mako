// =============================================================================
// LA PRUEBA de «Meta por Zernio», en la cuenta publicitaria de MaKo (25/10/2026)
// =============================================================================
// Lo que decide prender `ZERNIO_META_PROBADO` (lib/zernio-meta-cuerpo.ts). Corre SÓLO sobre el negocio de la plataforma
// (`wsSuperAdmin`, el de MaKo) y su cuenta `act_1426493815659364`: nunca sobre la de un cliente. Usa las MISMAS funciones que
// la app (lib/meta-via.ts, lib/meta-conexion-zernio.ts, lib/meta-capi.ts), con la clave de Zernio de la plataforma (la de ese
// negocio, `claveZernioAnuncios`).
//
// ⚠️ ESCRIBE EN PRODUCCIÓN con `--si` (las credenciales del negocio de MaKo). Lo de Meta es sólo LECTURA, salvo `capi`, que
// manda UN evento con `testCode`: va a la pestaña «Probar eventos» del Administrador de eventos y no toca los datos del píxel.
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/prueba-zernio-meta.mts conectar
//      → el link de Facebook (permiso «Control total»: lo pide el píxel). Lo abre MARTÍN y acepta. Vence a los 30 min.
//   … estado           las conexiones `metaads` de la Zernio de la plataforma, sus cuentas publicitarias y sus píxeles
//   … guardar --si     guarda la conexión en el negocio de MaKo (META_ZERNIO_CUENTA, la cuenta y el píxel si hay uno)
//   … leer [AAAA-MM-DD] los insights del día por Zernio (las filas de Meta), los conjuntos en vivo y la salud de la cuenta
//   … capi --si --codigo=TEST12345   un Lead de prueba por Zernio al píxel, con el código de «Probar eventos»
// =============================================================================

// Un módulo, no un script global: sólo usa `import()` dinámicos (scripts/modulos-ts.mjs).
export {};

const CUENTA = 'act_1426493815659364';
const paso = process.argv[2];
const si = process.argv.includes('--si');
const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? null;
const linea = (t: string, x?: unknown) => console.log(`· ${t}${x === undefined ? '' : ` ${JSON.stringify(x)}`}`);
const exigirSi = () => { if (!si) { console.error('Este paso ESCRIBE: repetilo con --si.'); process.exit(2); } };

const { wsSuperAdmin, runWithWorkspace } = await import('../lib/workspace');
const { claveZernioAnuncios } = await import('../lib/zernio-ads');
const { zFetch } = await import('../lib/zernio');
const via = await import('../lib/meta-via');
const cx = await import('../lib/meta-conexion-zernio');
const ws = await wsSuperAdmin();
const clave = await claveZernioAnuncios(ws);
if (!clave) { console.error(`El negocio de la plataforma (ws${ws}) no tiene clave de Zernio.`); process.exit(3); }

/** Las conexiones `metaads` de la clave que ven la cuenta de MaKo. */
async function conexionesDeMaKo(): Promise<string[]> {
  const r = await zFetch<{ accounts?: Array<{ _id?: string; platform?: string }> }>(clave!, '/accounts?platform=metaads');
  const out: string[] = [];
  for (const a of (r.accounts ?? []).filter((x) => x.platform === 'metaads' && x._id)) {
    const cuentas = await cx.cuentasPorZernio(clave!, a._id!).catch(() => []);
    if (cuentas.some((c) => c.id === CUENTA)) out.push(a._id!);
  }
  return out;
}

if (paso === 'conectar') {
  const p = await zFetch<{ profiles?: Array<{ _id: string; isDefault?: boolean }> }>(clave, '/profiles');
  const perfil = (p.profiles ?? []).find((x) => x.isDefault) ?? p.profiles?.[0];
  if (!perfil) { console.error('La cuenta de Zernio no tiene ningún profile.'); process.exit(3); }
  // `full` («Control total»): Zernio lo pide para CREAR píxeles, y para MANDARLES eventos no dice; con `full` se prueba todo
  // de una vez (también lo del Media Buyer, que pide `advertise`, que está incluido).
  const q = new URLSearchParams({
    profileId: perfil._id, loginMode: 'business', permissionLevel: 'full', adAccountId: CUENTA,
    redirect_url: 'https://hola-mako.com/integraciones?abrir=meta',
  });
  const r = await zFetch<{ authUrl?: string; alreadyConnected?: boolean }>(clave, `/connect/facebook/ads?${q.toString()}`);
  if (r.alreadyConnected) linea('ya está conectada');
  else console.log(`Abrí este link y aceptá los permisos (Facebook → el negocio de MaKo → la cuenta ${CUENTA}):\n${r.authUrl}`);
} else if (paso === 'estado') {
  const ids = await conexionesDeMaKo();
  linea(`conexiones metaads que ven ${CUENTA}`, ids);
  for (const id of ids) {
    linea(`cuentas de ${id}`, await cx.cuentasPorZernio(clave, id));
    linea(`píxeles de ${id}`, await cx.pixelesPorZernio(clave, id).catch((e) => `ERROR ${String(e)}`));
  }
  linea('lo guardado en el negocio de MaKo', await runWithWorkspace(ws, () => cx.estadoMetaZernio(ws)));
} else if (paso === 'guardar') {
  exigirSi();
  const ids = await conexionesDeMaKo();
  if (ids.length !== 1) { console.error(`Hay ${ids.length} conexiones que ven la cuenta: con ninguna, «conectar»; con varias, decidir cuál a mano.`); process.exit(4); }
  const r = await runWithWorkspace(ws, () => cx.guardarConexionMetaPorZernio(ws, ids[0], 'prueba-zernio-meta'));
  linea('guardadas', r.guardadas);
  if (r.conflictos.length) linea('conflictos', r.conflictos);
  linea('estado', r.estado);
} else if (paso === 'leer') {
  const fecha = process.argv[3] && /^\d{4}-\d{2}-\d{2}$/.test(process.argv[3]) ? process.argv[3] : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  await runWithWorkspace(ws, async () => {
    const canal = await via.canalMeta(ws);
    linea('canal', canal.via === 'zernio' ? { via: canal.via, accountId: canal.accountId, adAccountId: canal.adAccountId, respaldo: !!canal.respaldo } : canal);
    if (canal.via !== 'zernio') { console.error('El negocio de MaKo no habla con Meta por Zernio: paso «guardar».'); process.exit(5); }
    const { fetchMetaInsights, parseInsightsToMetrics } = await import('../lib/meta-ads');
    const filas = await fetchMetaInsights(fecha);
    linea(`insights del ${fecha}: filas`, filas.length);
    if (filas[0]) linea('campos de la primera fila', Object.keys(filas[0]).sort());
    const m = parseInsightsToMetrics(filas, fecha);
    linea('filas para marketing_metrics_daily (NO se escriben)', m.length);
    const conj = await via.conjuntosVivosPorZernio(canal);
    linea('conjuntos en vivo', { cuantos: conj.filas.length, moneda: conj.moneda, primeros: conj.filas.slice(0, 3) });
    const { getMetaAccountHealth } = await import('../lib/meta-health');
    linea('salud de la cuenta', await getMetaAccountHealth());
  });
} else if (paso === 'capi') {
  exigirSi();
  const codigo = arg('codigo');
  if (!codigo) { console.error('Falta --codigo=TEST… (Administrador de eventos → tu píxel → «Probar eventos»).'); process.exit(2); }
  await runWithWorkspace(ws, async () => {
    const canal = await via.canalMeta(ws);
    if (canal.via !== 'zernio') { console.error('El negocio de MaKo no habla con Meta por Zernio: paso «guardar».'); process.exit(5); }
    const est = await cx.estadoMetaZernio(ws);
    if (!est.pixel) { console.error('El negocio de MaKo no tiene píxel elegido.'); process.exit(6); }
    const { eventoParaZernio, resultadoConversionZernio } = await import('../lib/zernio-meta-cuerpo');
    const ev = eventoParaZernio({ eventName: 'Lead', segundos: Math.floor(Date.now() / 1000), eventId: `prueba-zernio:${Date.now()}`, email: 'prueba@hola-mako.com', phone: null, leadId: null });
    const body = await zFetch<unknown>(canal.clave, '/ads/conversions', {
      method: 'POST', body: JSON.stringify({ accountId: canal.accountId, destinationId: est.pixel, testCode: codigo, events: [ev] }),
    }, 30_000).catch((e) => ({ error: String(e) }));
    linea('respuesta de Zernio', body);
    linea('veredicto', resultadoConversionZernio(body));
  });
} else {
  console.error('Pasos: conectar · estado · guardar --si · leer [AAAA-MM-DD] · capi --si --codigo=TEST…');
  process.exit(1);
}
process.exit(0);
