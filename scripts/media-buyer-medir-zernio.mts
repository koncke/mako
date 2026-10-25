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
//
// ⚠️ MEDIDO EL 25/10/2026: la cuenta de MaKo no tiene método de pago y Meta NO deja crear un anuncio, ni en pausa (code 100,
// subcode 1359188, en la etapa `ad`; Zernio borra solo lo que había creado y deja la imagen). Para medir igual lo que el
// Media Buyer escribe, sin anuncio:
//   … campana --si          una campaña VACÍA en pausa, con presupuesto de campaña (US$1/día)
//   … datos                 lo que ve el Media Buyer de la cuenta (la fuente, la campaña, su interruptor y su presupuesto)
//   … editar-campana --si   presupuesto 1 → 2 y vuelta, prender y pausar la campaña (sin conjuntos no entrega nada)
//   … analizar              una corrida entera del agente, sólo proponiendo
//   … decision --si         el Media Buyer del negocio de MaKo en «propone»: una decisión real (subir el presupuesto) se
//                           guarda, se LANZA con los topes y la lectura en vivo, y se DESHACE; cada paso, leído en Meta
// El estado (los ids que creó) queda en C:/dev/cerebro-herramientas/media-buyer-prueba[-<cuenta>].json.
//
// ⚠️ OTRA CUENTA (25/10/2026, Martín: «Para probar el Media Buyer, hazlo en la cuenta de Mauricio, que si tiene metodo de
// pago»): `--cuenta=act_…`, y SÓLO una de CUENTAS_PERMITIDAS. Todo con el nombre «[PRUEBA MaKo] …», el presupuesto mínimo
// de la cuenta y EN PAUSA de punta a punta (la campaña y el conjunto nunca se prenden: no entrega ni gasta). Nunca toca
// una campaña que no creó este script (cada paso trabaja con los ids de su archivo de estado).
//   … decisiones-anuncio --si   en el anuncio de `crear`: el Media Buyer de la plataforma (en «propone») lanza y deshace
//                               «prender el anuncio» y una variación de texto; deja su cuenta como estaba
//   … foto / comparar           el interruptor y el presupuesto de TODAS las campañas y conjuntos de la cuenta, leídos en
//                               vivo, antes de empezar y al final: lo que no es de la prueba tiene que estar igual
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/** Las ÚNICAS cuentas donde este script escribe. La de un cliente entra sólo con el permiso de Martín, por escrito. */
const CUENTAS_PERMITIDAS: Record<string, string> = {
  act_1426493815659364: 'MaKo (la de la plataforma)',
  // La «Cuenta 1» de Elévate (Mauricio) estuvo acá SÓLO para la prueba del 25/10/2026, con el permiso de Martín escrito en
  // el chat, y se sacó al terminar (docs/hallazgos-ads.md → «La medición que escribe»). Una cuenta de cliente no queda
  // habilitada: se vuelve a sumar con un permiso nuevo.
};
const CUENTA_MAKO = 'act_1426493815659364';
const pedida = process.argv.find((a) => a.startsWith('--cuenta='))?.slice('--cuenta='.length) ?? CUENTA_MAKO;
if (!CUENTAS_PERMITIDAS[pedida]) { console.error(`La cuenta ${pedida} no está en CUENTAS_PERMITIDAS.`); process.exit(5); }
const CUENTA = pedida;
const ESTADO = CUENTA === CUENTA_MAKO ? 'C:/dev/cerebro-herramientas/media-buyer-prueba.json' : `C:/dev/cerebro-herramientas/media-buyer-prueba-${CUENTA}.json`;
const NOMBRE = '[PRUEBA MaKo] Media Buyer · no activar';
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

/** El presupuesto diario mínimo de la cuenta, en su moneda (Zernio, `/ads/accounts` → `minimumDailyBudget`). */
async function minimoDe(c: { accountId: string; adAccountId: string }): Promise<number> {
  const clave = await z.claveZernioAnuncios(ws);
  const q = new URLSearchParams({ accountId: c.accountId, adAccountId: c.adAccountId });
  const r = await fetch(`https://zernio.com/api/v1/ads/accounts?${q.toString()}`, { headers: { Authorization: `Bearer ${clave}` } });
  const j = await r.json().catch(() => null) as { accounts?: Array<{ id?: string; minimumDailyBudget?: number; currency?: string; billingStatus?: string }> } | null;
  const a = j?.accounts?.find((x) => x.id === c.adAccountId);
  linea('la cuenta', { moneda: a?.currency, minimoDiario: a?.minimumDailyBudget, pago: a?.billingStatus });
  return Math.max(1, Math.ceil(a?.minimumDailyBudget ?? 1));
}

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
  const minimo = await minimoDe(c);
  const r = await z.crearCampanaPorZernio(ws, {
    accountId: c.accountId, adAccountId: c.adAccountId, name: NOMBRE, goal: 'traffic', budgetAmount: minimo, budgetType: 'daily', status: 'PAUSED',
    countries: ['AR'], body: 'Prueba interna de MaKo. No se publica.', headline: 'Prueba MaKo', callToAction: 'LEARN_MORE',
    linkUrl: 'https://hola-mako.com/', imageUrl: 'https://hola-mako.com/og-mako.jpg',
  }, `mb-prueba:${CUENTA}:crear`);
  linea('creado', r);
  guardar({ ...r, pasos: [`crear ${new Date().toISOString()}`] });
} else if (paso === 'campana') {
  exigirSi();
  const c = await conexion();
  const r = await z.crearCampanaVaciaPorZernio(ws, { accountId: c.accountId, adAccountId: c.adAccountId, nombre: NOMBRE, presupuestoDia: 1 }, `mb-prueba:${CUENTA}:campana`);
  linea('campaña vacía creada (en pausa, US$1/día)', r);
  guardar({ campaignId: r.campaignId, adSetId: null, adId: '', pasos: [`campana ${new Date().toISOString()}`] });
} else if (paso === 'datos') {
  const { leerDatosCuenta } = await import('../lib/media-buyer/datos');
  const d = await leerDatosCuenta(ws);
  const e = existsSync(ESTADO) ? leer() : null;
  linea('fuente', d.fuente);
  linea('moneda', d.moneda);
  linea('avisos', d.avisos);
  linea('nodos', d.arbol.length);
  if (e?.campaignId) linea('la campaña de prueba', d.arbol.find((n) => n.id === e.campaignId) ?? 'NO ESTÁ en el árbol');
} else if (paso === 'editar-campana') {
  exigirSi();
  const e = leer();
  const c = await conexion();
  const id = e.campaignId!;
  const vivo = async () => (await z.enVivoPorZernio(ws, c)).campanas.find((x) => x.id === id) ?? null;
  linea('antes', await vivo());
  linea('presupuesto 1 → 2', await z.cambiarPresupuestoPorZernio(ws, 'campaign', id, 2, c.accountId));
  linea('leído en vivo', await vivo());
  linea('presupuesto 2 → 1', await z.cambiarPresupuestoPorZernio(ws, 'campaign', id, 1, c.accountId));
  // El estado de una campaña VACÍA no se puede cambiar por Zernio (404: la busca en su copia, que sale de los anuncios).
  try { linea('prender', await z.cambiarEstadoPorZernio(ws, 'campaign', id, 'ACTIVE')); linea('leído en vivo', await vivo()); }
  catch (err) { linea('prender falló (esperado en una campaña vacía)', String(err).slice(0, 300)); }
  linea('leído en vivo', await vivo());
  guardar({ ...e, pasos: [...e.pasos, `editar-campana ${new Date().toISOString()}`] });
} else if (paso === 'decision') {
  exigirSi();
  const e = leer();
  const c = await conexion();
  const id = e.campaignId!;
  const store = await import('../lib/media-buyer/store');
  const { lanzar, deshacer } = await import('../lib/media-buyer/ejecutar');
  const vivo = async () => (await z.enVivoPorZernio(ws, c)).campanas.find((x) => x.id === id) ?? null;
  // El negocio de MaKo, en «propone» (nunca piloto) y con su cuenta: es la única que este script toca.
  const cfg = await store.guardarConfig(ws, { encendido: true, modo: 'propone', cuentaPublicitaria: CUENTA }, 'Prueba del Media Buyer (claude5)');
  linea('config', { encendido: cfg.encendido, modo: cfg.modo, cuenta: cfg.cuentaPublicitaria });
  const antes = (await vivo())?.presupuestoDia ?? 1;
  const hoy = new Date().toISOString().slice(0, 10);
  const [d] = await store.guardarPropuestas(ws, [{
    clave: `manual:campaign:${id}:${hoy}:prueba`, tipo: 'subir_presupuesto', tactica: 'manual', nivel: 'campaign',
    entidadId: id, entidadNombre: NOMBRE, campanaNombre: null,
    titulo: `Prueba: subir el presupuesto de «${NOMBRE}»`, titular: 'Prueba del Media Buyer en la cuenta de MaKo (no entrega: sin conjuntos)',
    porque: ['Medición del 25/10/2026: lanzar y deshacer una decisión real por Zernio.'],
    numeros: [{ condicion: 'Presupuesto diario', valor: `US$ ${antes}`, porQue: 'El de la campaña de prueba' }],
    antes: { presupuesto: antes }, despues: { presupuesto: antes + 1 },
  }], 'USD');
  if (!d) { console.error('No se guardó la decisión (¿ya existía la clave?).'); process.exit(4); }
  linea('decisión guardada (abierta)', { id: d.id, antes: d.antes, despues: d.despues });
  const l = await lanzar(ws, d.id, { nombre: 'Prueba del Media Buyer (claude5)', origen: 'persona' });
  linea('lanzar', l.ok ? { ok: true, despues: l.decision.despues, canal: l.decision.canal, ajuste: l.ajuste } : l);
  linea('leído en vivo después de lanzar', await vivo());
  const u = await deshacer(ws, d.id, 'Prueba del Media Buyer (claude5)');
  linea('deshacer', u.ok ? { ok: true, estado: u.decision.estado } : u);
  linea('leído en vivo después de deshacer', await vivo());
  guardar({ ...e, pasos: [...e.pasos, `decision ${d.id} ${new Date().toISOString()}`] });
} else if (paso === 'decisiones-anuncio') {
  exigirSi();
  const e = leer();
  if (!e.adId) { console.error('Primero `crear --si`: hace falta el anuncio de prueba.'); process.exit(4); }
  await conexion();
  const store = await import('../lib/media-buyer/store');
  const { lanzar, deshacer } = await import('../lib/media-buyer/ejecutar');
  const { leerDatosCuenta } = await import('../lib/media-buyer/datos');
  const quien = { nombre: 'Prueba del Media Buyer (claude5)', origen: 'persona' as const };
  const nodo = async (id: string) => { const d = await leerDatosCuenta(ws); const n = d.arbol.find((x) => x.id === id); return n ? { id: n.id, nivel: n.nivel, configurado: n.configurado, entrega: n.entrega } : 'NO ESTÁ'; };
  // El Media Buyer de la PLATAFORMA mira esta cuenta mientras dura el paso, en «propone»; al final vuelve a la suya.
  const previa = await store.leerConfig(ws);
  await store.guardarConfig(ws, { encendido: true, modo: 'propone', cuentaPublicitaria: CUENTA }, quien.nombre);
  try {
    linea('la campaña de prueba', await nodo(e.campaignId!));
    linea('el conjunto de prueba', await nodo(e.adSetId!));
    linea('el anuncio, antes', await nodo(e.adId));
    const hoy = new Date().toISOString().slice(0, 10);
    const [prender] = await store.guardarPropuestas(ws, [{
      clave: `manual:ad:${e.adId}:${hoy}:prueba-prender`, tipo: 'activar', tactica: 'manual', nivel: 'ad', entidadId: e.adId, entidadNombre: NOMBRE, campanaNombre: NOMBRE,
      titulo: `Prueba: prender el anuncio «${NOMBRE}»`, titular: 'Prueba del Media Buyer: la campaña y el conjunto siguen en pausa (no entrega)',
      porque: ['Medición del 25/10/2026: prender y pausar un anuncio por Zernio, con su deshacer.'], numeros: [],
      antes: { estado: 'PAUSED' }, despues: { estado: 'ACTIVE' },
    }], null);
    if (!prender) { console.error('No se guardó la decisión de prender (¿ya existía la clave?).'); process.exit(4); }
    const l1 = await lanzar(ws, prender.id, quien);
    linea('lanzar «prender el anuncio»', l1.ok ? { ok: true, canal: l1.decision.canal, ajuste: l1.ajuste } : l1);
    linea('el anuncio, después de lanzar', await nodo(e.adId));
    const u1 = await deshacer(ws, prender.id, quien.nombre);
    linea('deshacer', u1.ok ? { ok: true, estado: u1.decision.estado } : u1);
    linea('el anuncio, después de deshacer', await nodo(e.adId));

    // Las variaciones de TEXTO y de HOOK: cada una se lanza con UNA elegida (de dos) y se deshace (borra las copias).
    const ids: string[] = [prender.id];
    for (const tipo of ['variaciones_texto', 'variaciones_hook'] as const) {
      const que = tipo === 'variaciones_texto' ? 'texto' : 'hook';
      const [vars] = await store.guardarPropuestas(ws, [{
        clave: `ganador:ad:${e.adId}:${hoy}:prueba-${que}`, tipo, tactica: 'manual', nivel: 'ad', entidadId: e.adId, entidadNombre: NOMBRE, campanaNombre: NOMBRE,
        titulo: `Prueba: variaciones de ${que} de «${NOMBRE}»`, titular: 'Prueba del Media Buyer: las copias quedan en un conjunto en pausa (no entregan)',
        porque: [`Medición del 25/10/2026: crear una variación de ${que} por Zernio y borrarla con su deshacer.`], numeros: [],
        antes: {}, despues: {}, anuncioBase: { id: e.adId, esVideo: false, miniatura: null },
        variaciones: [
          { id: 'v1', textoPrincipal: `[PRUEBA MaKo] Variación de ${que} 1. No se publica.`, titulo: `Prueba MaKo ${que} v1`, ...(que === 'hook' ? { gancho: '[PRUEBA MaKo] Gancho 1' } : {}), elegida: true },
          { id: 'v2', textoPrincipal: `[PRUEBA MaKo] Variación de ${que} 2. No se publica.`, titulo: `Prueba MaKo ${que} v2`, ...(que === 'hook' ? { gancho: '[PRUEBA MaKo] Gancho 2' } : {}), elegida: false },
        ],
      }], null);
      if (!vars) { console.error(`No se guardó la decisión de variaciones de ${que}.`); process.exit(4); }
      ids.push(vars.id);
      const l2 = await lanzar(ws, vars.id, quien, { elegidas: ['v1'] });
      linea(`lanzar «variaciones de ${que}» (sólo la v1)`, l2.ok ? { ok: true, canal: l2.decision.canal } : l2);
      const creados = (await store.leerDecision(ws, vars.id))?.creados ?? [];
      for (const ad of creados) linea(`la variación ${ad}`, await nodo(ad));
      const u2 = await deshacer(ws, vars.id, quien.nombre);
      linea(`deshacer las de ${que} (borra las copias)`, u2.ok ? { ok: true, estado: u2.decision.estado, ajuste: u2.ajuste } : u2);
      for (const ad of creados) linea(`la variación ${ad}, después de deshacer`, await nodo(ad));
    }
    guardar({ ...e, pasos: [...e.pasos, `decisiones-anuncio ${ids.join(' ')} ${new Date().toISOString()}`] });
  } finally {
    await store.guardarConfig(ws, { encendido: previa.encendido, modo: previa.modo, cuentaPublicitaria: previa.cuentaPublicitaria }, quien.nombre);
    linea('el Media Buyer de la plataforma, de vuelta', { cuenta: previa.cuentaPublicitaria, modo: previa.modo, encendido: previa.encendido });
  }
} else if (paso === 'interruptor-anuncio') {
  // El interruptor del ANUNCIO por el Media Buyer: pausar, prender y deshacer, con la campaña y el conjunto en pausa (no
  // entrega). ⚠️ Medido el 25/10/2026: `POST /ads/create` con `status: PAUSED` pausa sólo la CAMPAÑA; el conjunto y el anuncio
  // nacen prendidos. Por eso acá primero se pausa el conjunto.
  exigirSi();
  const e = leer();
  if (!e.adId || !e.adSetId) { console.error('Primero `crear --si`.'); process.exit(4); }
  await conexion();
  const store = await import('../lib/media-buyer/store');
  const { lanzar, deshacer } = await import('../lib/media-buyer/ejecutar');
  const quien = { nombre: 'Prueba del Media Buyer (claude5)', origen: 'persona' as const };
  const clave = await z.claveZernioAnuncios(ws);
  const vivo = async (id: string) => {
    const j = await (await fetch(`https://zernio.com/api/v1/ads/${id}`, { headers: { Authorization: `Bearer ${clave}` } })).json() as any;
    const a = j?.ad ?? j;
    return { interruptor: a?.configuredStatus ?? a?.platformConfiguredStatus ?? null, entrega: a?.platformStatus ?? a?.effectiveStatus ?? null };
  };
  linea('pausar el conjunto de prueba', await z.cambiarEstadoPorZernio(ws, 'adset', e.adSetId, 'PAUSED'));
  linea('el anuncio, antes (en vivo)', await vivo(e.adId));
  const previa = await store.leerConfig(ws);
  await store.guardarConfig(ws, { encendido: true, modo: 'propone', cuentaPublicitaria: CUENTA }, quien.nombre);
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const decision = async (tipo: 'pausar' | 'activar', antes: 'ACTIVE' | 'PAUSED', despues: 'ACTIVE' | 'PAUSED') => {
      const [d] = await store.guardarPropuestas(ws, [{
        clave: `manual:ad:${e.adId}:${hoy}:prueba-${tipo}-${Date.now()}`, tipo, tactica: 'manual', nivel: 'ad', entidadId: e.adId, entidadNombre: NOMBRE, campanaNombre: NOMBRE,
        titulo: `Prueba: ${tipo === 'pausar' ? 'pausar' : 'prender'} el anuncio «${NOMBRE}»`, titular: 'Prueba del Media Buyer: la campaña y el conjunto siguen en pausa (no entrega)',
        porque: ['Medición del 25/10/2026: el interruptor de un anuncio por Zernio, con su deshacer.'], numeros: [],
        antes: { estado: antes }, despues: { estado: despues },
      }], null);
      if (!d) { console.error(`No se guardó la decisión de ${tipo} (¿ya existía la clave?).`); process.exit(4); }
      return d;
    };
    // Dos cambios seguidos (el segundo es el que el árbol atrasado frenaba) y el deshacer del segundo, desde como esté.
    const s0 = (await vivo(e.adId)).interruptor === 'PAUSED' ? 'PAUSED' as const : 'ACTIVE' as const;
    const s1 = s0 === 'ACTIVE' ? 'PAUSED' as const : 'ACTIVE' as const;
    const tipoDe = (a: 'ACTIVE' | 'PAUSED') => (a === 'PAUSED' ? 'pausar' as const : 'activar' as const);
    const d1 = await decision(tipoDe(s1), s0, s1);
    const l1 = await lanzar(ws, d1.id, quien);
    linea(`lanzar «${d1.tipo}»`, l1.ok ? { ok: true, canal: l1.decision.canal } : l1);
    linea('el anuncio (en vivo)', await vivo(e.adId));
    const d2 = await decision(tipoDe(s0), s1, s0);
    const l2 = await lanzar(ws, d2.id, quien);
    linea(`lanzar «${d2.tipo}» (el árbol de Zernio todavía no lo sabe)`, l2.ok ? { ok: true, canal: l2.decision.canal } : l2);
    linea('el anuncio (en vivo)', await vivo(e.adId));
    const u = await deshacer(ws, d2.id, quien.nombre);
    linea(`deshacer «${d2.tipo}»`, u.ok ? { ok: true, estado: u.decision.estado } : u);
    linea('el anuncio (en vivo)', await vivo(e.adId));
    if ((await vivo(e.adId)).interruptor !== 'PAUSED') linea('el anuncio queda en pausa', await z.cambiarEstadoPorZernio(ws, 'ad', e.adId, 'PAUSED'));
    linea('el anuncio, al final (en vivo)', await vivo(e.adId));
    guardar({ ...e, pasos: [...e.pasos, `interruptor-anuncio ${d1.id} ${d2.id} ${new Date().toISOString()}`] });
  } finally {
    await store.guardarConfig(ws, { encendido: previa.encendido, modo: previa.modo, cuentaPublicitaria: previa.cuentaPublicitaria }, quien.nombre);
    linea('el Media Buyer de la plataforma, de vuelta', { cuenta: previa.cuentaPublicitaria, modo: previa.modo, encendido: previa.encendido });
  }
} else if (paso === 'foto' || paso === 'comparar') {
  const c = await conexion();
  const v = await z.enVivoPorZernio(ws, c);
  const filas = [...v.campanas, ...v.conjuntos].map((x) => ({ id: x.id, nombre: x.nombre, configurado: x.configurado, presupuestoDia: x.presupuestoDia }));
  const FOTO = ESTADO.replace(/\.json$/, '-foto.json');
  if (paso === 'foto') {
    writeFileSync(FOTO, JSON.stringify({ cuando: new Date().toISOString(), completo: v.completo, filas }, null, 2));
    linea('foto de la cuenta', { campanas: v.campanas.length, conjuntos: v.conjuntos.length, completo: v.completo, archivo: FOTO });
  } else {
    const antes = JSON.parse(readFileSync(FOTO, 'utf8')) as { filas: typeof filas };
    const porId = new Map(filas.map((f) => [f.id, f] as const));
    const cambiadas = antes.filas.filter((f) => { const a = porId.get(f.id); return !a || a.configurado !== f.configurado || a.presupuestoDia !== f.presupuestoDia; });
    const nuevas = filas.filter((f) => !antes.filas.some((x) => x.id === f.id));
    linea('lo que había', antes.filas.length);
    linea('cambiado o que ya no está', cambiadas.length ? cambiadas : 'nada');
    linea('lo que no estaba (tendría que ser nada)', nuevas.length ? nuevas : 'nada');
  }
} else if (paso === 'analizar') {
  // Una corrida entera del agente sobre la cuenta de MaKo, SÓLO proponiendo (aunque hubiera piloto, no lanza nada).
  const { analizarCuenta } = await import('../lib/media-buyer/corrida');
  linea('corrida', await analizarCuenta(ws, { quien: 'Prueba del Media Buyer (claude5)', soloProponer: true }));
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
  console.error('Pasos: conectar · estado · foto · crear --si · decisiones-anuncio --si · comparar · editar --si · campana --si · datos · editar-campana --si · decision --si · borrar --si  [--cuenta=act_…]');
  process.exit(1);
}
