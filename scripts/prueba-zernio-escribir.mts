// =============================================================================
// PROBAR que un negocio sin token administra sus campañas por la conexión de Facebook (Zernio), en la cuenta de MaKo (26/10/2026)
// =============================================================================
// Martín, 26/10: «¿Los usuarios pueden leer, crear, editar y eliminar sus campañas?». Corre SÓLO sobre la cuenta de MaKo
// (`act_1426493815659364`, el negocio de la plataforma), nunca sobre la de un cliente. Escribe por `metaWrite` (lib/meta-write.ts),
// el MISMO camino que usan la API de MaKo, el doer y el Media Buyer, y lee por `leerArbolMetaEnVivo` (la salud de la cuenta) y
// `estadoVivoMeta` (lo que decide un borrado). Todo EN PAUSA y con el presupuesto mínimo: gasto 0.
//
//   node --env-file=<clon>/.env.local --conditions=react-server --import tsx scripts/prueba-zernio-escribir.mts arbol
//   … crear --si     campaña + conjunto + anuncio por Zernio, y en el acto se pausan el conjunto y el anuncio (nacen prendidos)
//   … arbol          lo que ve la salud de la cuenta (y el selector de campañas) de lo creado
//   … editar --si    renombrar los tres niveles (y volver), presupuesto del conjunto mínimo → +1 → mínimo, prender y pausar la
//                    campaña (con el conjunto y el anuncio en pausa no entrega), cada paso releído en vivo; y un id que no es de la
//                    cuenta, que tiene que rebotar sin escribir
//   … anuncios --si  lib/meta-ads-create.ts por Zernio: la cuenta, los píxeles, los datos de campaña y conjunto, leer y cambiar los
//                    textos del anuncio, y dos anuncios más en el conjunto (con la imagen del primero, y reusando su post), en pausa
//   … formulario --si    crea un formulario por Zernio en la página de MaKo, lo ve en la lista y lo ARCHIVA (no se borran)
//   … borrar --si    borra el anuncio (mide si Zernio se lleva el conjunto y la campaña vacíos) y lo que quede, por `metaWrite`
//   … borrar-niveles --si   (otra vuelta, después de `crear`) borra el conjunto, prueba pausar la campaña vacía y la borra
// El estado (los ids que creó) queda en C:/dev/cerebro-herramientas/zernio-escribir-prueba.json.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

export {};

const CUENTA_MAKO = 'act_1426493815659364';
const ESTADO = 'C:/dev/cerebro-herramientas/zernio-escribir-prueba.json';
const NOMBRE = '[PRUEBA MaKo] Zernio y CAPI · no activar';
const paso = process.argv[2];
const si = process.argv.includes('--si');

const { wsSuperAdmin, runWithWorkspace } = await import('../lib/workspace');
const { canalMeta } = await import('../lib/meta-via');
const { metaWrite } = await import('../lib/meta-write');
const { leerArbolMetaEnVivo, campanasYConjuntos } = await import('../lib/meta-health');
const { estadoVivoMeta } = await import('../lib/api-mako/areas/ads.helpers');
const z = await import('../lib/zernio-ads');
const ws = await wsSuperAdmin();

type Estado = { campaignId: string | null; adSetId: string | null; adId: string; minimo: number; pasos: string[] };
const leer = (): Estado => JSON.parse(readFileSync(ESTADO, 'utf8')) as Estado;
const guardar = (e: Estado) => writeFileSync(ESTADO, JSON.stringify(e, null, 2));
const linea = (t: string, x?: unknown) => console.log(`· ${t}${x === undefined ? '' : ` ${JSON.stringify(x)}`}`);
const exigirSi = () => { if (!si) { console.error('Este paso ESCRIBE en Meta: repetilo con --si.'); process.exit(2); } };
const fallar = (t: string) => { console.error(`✗ ${t}`); process.exitCode = 1; };

const canal = await canalMeta(ws);
if (canal.via !== 'zernio' || canal.adAccountId !== CUENTA_MAKO) {
  console.error(`El negocio de la plataforma no habla con Meta por Zernio en ${CUENTA_MAKO} (vía: ${canal.via}).`);
  process.exit(3);
}

/** El estado de una entidad leído en vivo por el camino que decide un borrado. */
const vivo = (nivel: 'campaign' | 'adset' | 'ad', id: string) => estadoVivoMeta(id, ws, nivel);
/** Escribir por el camino de la API y comprobar que contestó ok. */
async function escribir(t: string, body: Parameters<typeof metaWrite>[0]) {
  const r = await metaWrite(body, ws);
  linea(t, r.ok ? { ok: true, applied: r.applied } : { ok: false, status: r.status, message: r.message });
  if (!r.ok) fallar(`${t}: ${r.message}`);
  return r;
}

if (paso === 'crear') {
  exigirSi();
  if (existsSync(ESTADO) && leer().adId) { console.error(`Ya hay una prueba creada (${ESTADO}): primero «borrar --si».`); process.exit(4); }
  const q = new URLSearchParams({ accountId: canal.accountId, adAccountId: canal.adAccountId });
  const j = await (await fetch(`https://zernio.com/api/v1/ads/accounts?${q.toString()}`, { headers: { Authorization: `Bearer ${canal.clave}` } })).json() as { accounts?: Array<{ id?: string; minimumDailyBudget?: number; currency?: string }> };
  const cuenta = j.accounts?.find((x) => x.id === canal.adAccountId);
  const minimo = Math.max(1, Math.ceil(cuenta?.minimumDailyBudget ?? 1));
  linea('la cuenta', { moneda: cuenta?.currency, minimoDiario: minimo });
  const r = await z.crearCampanaPorZernio(ws, {
    accountId: canal.accountId, adAccountId: canal.adAccountId, name: NOMBRE, goal: 'traffic', budgetAmount: minimo, budgetType: 'daily', status: 'PAUSED',
    countries: ['AR'], body: 'Prueba interna de MaKo. No se publica.', headline: 'Prueba MaKo', callToAction: 'LEARN_MORE',
    linkUrl: 'https://hola-mako.com/', imageUrl: 'https://hola-mako.com/og-mako.jpg',
    // Una clave por corrida: con una por día, la segunda vuelta recibió de Zernio la campaña de la PRIMERA (ya borrada) en vez de
    // crear otra (medido el 26/10/2026). La clave protege el reintento de UNA creación, no dos creaciones a propósito.
  }, `zernio-escribir:${CUENTA_MAKO}:crear:${Date.now()}`);
  linea('creado', r);
  guardar({ ...r, minimo, pasos: [`crear ${new Date().toISOString()}`] });
  // ⚠️ `status: PAUSED` pausa sólo la campaña: el conjunto y el anuncio nacen prendidos. Se pausan YA, por metaWrite.
  if (r.adSetId) await escribir('pausar el conjunto', { level: 'adset', id: r.adSetId, op: 'status', status: 'PAUSED' });
  await escribir('pausar el anuncio', { level: 'ad', id: r.adId, op: 'status', status: 'PAUSED' });
  for (const [n, id] of [['campaign', r.campaignId], ['adset', r.adSetId], ['ad', r.adId]] as const) if (id) linea(`${n} en vivo`, await vivo(n, id));
} else if (paso === 'arbol') {
  const e = existsSync(ESTADO) ? leer() : null;
  const h = await leerArbolMetaEnVivo(ws);
  linea('el árbol', { campañas: h.campaigns.length, conjuntos: h.adsets.length, anuncios: h.ads.length, parcial: h.parcial, moneda: h.account.currency });
  for (const n of [...h.campaigns, ...h.adsets, ...h.ads]) {
    linea(`${n.level} ${n.id} «${n.name}»`, { entrega: n.effectiveStatus, interruptor: n.configuredStatus, padre: n.parentId, presupuestoDia: n.dailyBudgetMxn ?? null, objetivo: n.objective ?? null });
  }
  // Sólo con una prueba viva (después de «borrar», `adId` queda vacío y la campaña ya no tiene que estar).
  if (e?.adId && e.campaignId && !h.campaigns.some((c) => c.id === e.campaignId)) fallar('la campaña de prueba NO está en el árbol');
  if (e?.adId && !h.ads.some((a) => a.id === e.adId)) fallar('el anuncio de prueba NO está en el árbol (Zernio puede tardar en sincronizarlo)');
  const sel = await runWithWorkspace(ws, () => campanasYConjuntos());
  linea('el selector de campañas', { cuenta: sel.cuenta, campañas: sel.campanas.map((c) => `${c.id} ${c.estado}`), conjuntos: sel.conjuntos.map((c) => `${c.id} ${c.estado}`) });
} else if (paso === 'editar') {
  exigirSi();
  const e = leer();
  if (!e.campaignId || !e.adSetId) { console.error('Falta la campaña o el conjunto de la prueba.'); process.exit(4); }
  const h0 = await leerArbolMetaEnVivo(ws);
  const nombreDe = (id: string) => [...h0.campaigns, ...h0.adsets, ...h0.ads].find((n) => n.id === id)?.name ?? null;
  // Renombrar los tres niveles y volver al nombre de antes.
  for (const [nivel, id] of [['campaign', e.campaignId], ['adset', e.adSetId], ['ad', e.adId]] as const) {
    const antes = nombreDe(id) ?? NOMBRE;
    await escribir(`renombrar ${nivel}`, { level: nivel, id, op: 'name', name: `${antes} · renombrado` });
    const h = await leerArbolMetaEnVivo(ws);
    const leido = [...h.campaigns, ...h.adsets, ...h.ads].find((n) => n.id === id)?.name ?? null;
    linea(`  ${nivel} leído`, leido);
    if (nivel !== 'ad' && leido !== `${antes} · renombrado`) fallar(`el nombre de ${nivel} no se leyó cambiado`);
    await escribir(`  ${nivel} de vuelta`, { level: nivel, id, op: 'name', name: antes });
  }
  // Presupuesto del conjunto (la creación lo pone en el conjunto: ABO).
  const presu = async () => (await leerArbolMetaEnVivo(ws)).adsets.find((s) => s.id === e.adSetId)?.dailyBudgetMxn ?? null;
  linea('presupuesto del conjunto, antes', await presu());
  await escribir('presupuesto +1', { level: 'adset', id: e.adSetId, op: 'budget', dailyBudgetMxn: e.minimo + 1 });
  const subido = await presu();
  linea('  leído', subido);
  if (subido !== e.minimo + 1) fallar('el presupuesto no se leyó cambiado');
  await escribir('presupuesto de vuelta', { level: 'adset', id: e.adSetId, op: 'budget', dailyBudgetMxn: e.minimo });
  linea('  leído', await presu());
  // La campaña: prender y pausar, sólo con el conjunto y el anuncio en pausa (no entrega).
  const cj = await vivo('adset', e.adSetId); const an = await vivo('ad', e.adId);
  linea('conjunto y anuncio en vivo', { conjunto: cj, anuncio: an });
  if ('error' in cj || 'error' in an || cj.configurado !== 'PAUSED' || an.configurado !== 'PAUSED') {
    fallar('el conjunto o el anuncio no están en pausa: NO se prende la campaña');
  } else {
    await escribir('prender la campaña', { level: 'campaign', id: e.campaignId, op: 'status', status: 'ACTIVE' });
    linea('  en vivo', await vivo('campaign', e.campaignId));
    await escribir('pausar la campaña', { level: 'campaign', id: e.campaignId, op: 'status', status: 'PAUSED' });
    const c = await vivo('campaign', e.campaignId);
    linea('  en vivo', c);
    if ('error' in c || c.configurado !== 'PAUSED') fallar('la campaña no quedó en pausa');
  }
  // Un id que no es de esta cuenta: tiene que rebotar ANTES de escribir.
  const ajeno = await metaWrite({ level: 'campaign', id: '120200000000000001', op: 'name', name: 'no debería escribirse' }, ws);
  linea('un id ajeno', ajeno.ok ? 'ESCRIBIÓ' : { status: ajeno.status, message: ajeno.message });
  if (ajeno.ok || ajeno.status !== 404) fallar('un id ajeno no rebotó con 404');
  guardar({ ...e, pasos: [...e.pasos, `editar ${new Date().toISOString()}`] });
} else if (paso === 'borrar') {
  exigirSi();
  const e = leer();
  const a = await vivo('ad', e.adId);
  linea('el anuncio en vivo', a);
  if (!('error' in a) && a.configurado !== 'PAUSED' && a.configurado !== 'DELETED') fallar('el anuncio no está en pausa: no se borra');
  else if (!('error' in a) && a.configurado !== 'DELETED') await escribir('borrar el anuncio', { level: 'ad', id: e.adId, op: 'delete' });
  // ¿Zernio se llevó el conjunto y la campaña que él creó? (OpenAPI: DELETE /ads/{adId} borra los padres vacíos que creó).
  for (const [nivel, id] of [['adset', e.adSetId], ['campaign', e.campaignId]] as const) {
    if (!id) continue;
    const v = await vivo(nivel, id);
    linea(`${nivel} después de borrar el anuncio`, v);
    if (!('error' in v) && v.configurado !== 'DELETED' && v.efectivo !== 'DELETED') await escribir(`borrar ${nivel}`, { level: nivel, id, op: 'delete' });
  }
  const live = await (await fetch(`https://zernio.com/api/v1/ads/accounts/live?${new URLSearchParams({ accountId: canal.accountId, adAccountId: canal.adAccountId }).toString()}`, { headers: { Authorization: `Bearer ${canal.clave}` } })).json() as { campaigns?: unknown[]; adSets?: unknown[] };
  linea('la cuenta en vivo al final', { campañas: live.campaigns?.length ?? null, conjuntos: live.adSets?.length ?? null });
  guardar({ ...e, adId: '', pasos: [...e.pasos, `borrar ${new Date().toISOString()}`] });
} else if (paso === 'borrar-niveles') {
  // La segunda vuelta: borrar el CONJUNTO (la campaña queda vacía), probar el interruptor de una campaña vacía (Zernio da 404:
  // tiene que volver el texto propio, no un error crudo) y borrar la campaña VACÍA (con `accountId`).
  exigirSi();
  const e = leer();
  if (!e.campaignId || !e.adSetId) { console.error('Falta la campaña o el conjunto de la prueba.'); process.exit(4); }
  const cj = await vivo('adset', e.adSetId);
  linea('el conjunto en vivo', cj);
  if ('error' in cj || cj.configurado !== 'PAUSED') { fallar('el conjunto no está en pausa: no se borra'); process.exit(1); }
  await escribir('borrar el conjunto', { level: 'adset', id: e.adSetId, op: 'delete' });
  linea('  el conjunto', await vivo('adset', e.adSetId));
  linea('  la campaña (vacía)', await vivo('campaign', e.campaignId));
  const r = await metaWrite({ level: 'campaign', id: e.campaignId, op: 'status', status: 'PAUSED' }, ws);
  linea('pausar una campaña vacía', r.ok ? { ok: true } : { status: r.status, message: r.message });
  await escribir('borrar la campaña vacía', { level: 'campaign', id: e.campaignId, op: 'delete' });
  const c = await vivo('campaign', e.campaignId);
  linea('  la campaña', c);
  if (!('error' in c) && c.configurado !== 'DELETED' && c.efectivo !== 'DELETED') fallar('la campaña no quedó borrada');
  const live = await (await fetch(`https://zernio.com/api/v1/ads/accounts/live?${new URLSearchParams({ accountId: canal.accountId, adAccountId: canal.adAccountId }).toString()}`, { headers: { Authorization: `Bearer ${canal.clave}` } })).json() as { campaigns?: unknown[]; adSets?: unknown[] };
  linea('la cuenta en vivo al final', { campañas: live.campaigns?.length ?? null, conjuntos: live.adSets?.length ?? null });
  guardar({ ...e, adId: '', pasos: [...e.pasos, `borrar-niveles ${new Date().toISOString()}`] });
} else if (paso === 'anuncios') {
  // La tanda B (lib/meta-ads-create.ts por Zernio): la cuenta y los píxeles, los datos de la campaña y del conjunto, leer y cambiar
  // los textos del anuncio, y agregar dos anuncios al conjunto (uno con la imagen del primero, otro reusando su post). Todo en pausa.
  exigirSi();
  const e = leer();
  if (!e.campaignId || !e.adSetId || !e.adId) { console.error('Primero «crear --si».'); process.exit(4); }
  const m = await import('../lib/meta-ads-create');
  await runWithWorkspace(ws, async () => {
    const paso = async <T,>(t: string, f: () => Promise<T>): Promise<T | null> => {
      try { const r = await f(); linea(t, r); return r; } catch (err) { fallar(`${t}: ${err instanceof Error ? err.message : String(err)}`); return null; }
    };
    await paso('cuentaMeta', () => m.cuentaMeta());
    await paso('listPixels', () => m.listPixels());
    await paso('getCampaignBasics', () => m.getCampaignBasics(e.campaignId!));
    await paso('getAdsetForAdd', () => m.getAdsetForAdd(e.adSetId!));
    await paso('getAdsetTargeting (sólo las claves)', async () => Object.keys((await m.getAdsetTargeting(e.adSetId!)).targeting));
    const a = await paso('getAdForEdit', () => m.getAdForEdit(e.adId));
    if (a?.editable && a.creative) {
      await paso('updateAdCopy', () => m.updateAdCopy(e.adId, { primary_text: 'Prueba interna de MaKo. No se publica. (textos cambiados por Zernio)' }));
      const despues = await paso('getAdForEdit después', async () => (await m.getAdForEdit(e.adId)).creative?.primary_text);
      if (despues && !despues.includes('cambiados por Zernio')) fallar('los textos no se leyeron cambiados (Zernio puede tardar en apuntar el creativo nuevo)');
      const nuevos: string[] = [];
      const conImagen = await paso('addAdToAdset con la imagen del primero', () => m.addAdToAdset(e.adSetId!, {
        source: 'upload', media_type: 'image', image_hash: a.creative!.image_hash, video_id: null, thumbnail_url: null,
        primary_text: 'Prueba interna de MaKo. No se publica. (anuncio 2)', headline: 'Prueba MaKo 2', cta_type: 'LEARN_MORE', destination_url: 'https://hola-mako.com/', lead_form_id: null,
      }, `${NOMBRE} · 2`));
      if (conImagen) nuevos.push(conImagen.ad_id);
      const reusado = await paso('addAdToAdset reusando el post del primero', () => m.addAdToAdset(e.adSetId!, { source: 'existing', source_ad_id: e.adId }, `${NOMBRE} · 3`));
      if (reusado) nuevos.push(reusado.ad_id);
      for (const id of nuevos) {
        const v = await vivo('ad', id);
        linea(`  ${id} en vivo`, v);
        if ('error' in v || v.configurado !== 'PAUSED') fallar(`el anuncio ${id} no nació en pausa`);
      }
      guardar({ ...e, pasos: [...e.pasos, `anuncios ${nuevos.join(' ')} ${new Date().toISOString()}`] });
    }
  });
} else if (paso === 'formulario') {
  // Crear un formulario por Zernio en la página de MaKo, verlo en la lista y ARCHIVARLO (Meta no deja borrar formularios: el
  // archivado queda en la biblioteca de la página, con el nombre de prueba).
  exigirSi();
  const m = await import('../lib/meta-ads-create');
  await runWithWorkspace(ws, async () => {
    const f = await m.crearFormularioInstantaneo({
      nombre: `[PRUEBA MaKo] Formulario por Zernio ${new Date().toISOString().slice(0, 16)}`, estandar: ['FULL_NAME', 'EMAIL'], propias: ['¿Qué quieres vender?'],
      mayorIntencion: false, privacidadUrl: 'https://hola-mako.com/privacidad', sitioUrl: 'https://hola-mako.com/',
    }).catch((err) => { fallar(`crear: ${err instanceof Error ? err.message : String(err)}`); return null; });
    linea('creado', f);
    if (!f) return;
    const lista = await m.listLeadForms();
    linea('en la lista', lista.some((x) => x.id === f.id));
    if (!lista.some((x) => x.id === f.id)) fallar('el formulario creado no aparece en la lista');
    const r = await fetch(`https://zernio.com/api/v1/ads/lead-forms/${f.id}?${new URLSearchParams({ accountId: canal.accountId }).toString()}`, { method: 'DELETE', headers: { Authorization: `Bearer ${canal.clave}` } });
    linea('archivado', { status: r.status, cuerpo: (await r.text()).slice(0, 200) });
    const despues = await m.listLeadForms();
    linea('después de archivar, en la lista', despues.some((x) => x.id === f.id));
  });
} else {
  console.error('Pasos: crear --si · arbol · editar --si · anuncios --si · formulario --si · borrar --si · borrar-niveles --si');
  process.exit(2);
}
process.exit(process.exitCode ?? 0);
