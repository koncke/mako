// =============================================================================
// instagram-perfil-server — LA función que lee un perfil de Instagram por su @ (la red; lo puro, en instagram-perfil.ts)
// =============================================================================
// Una sola, para todos: el buscador del alta de un lead (app/api/crm/instagram-buscar), el onboarding y Offer (leer-link de
// app/api/offer/route.ts) y, después, el Ops Center. Pedido de Martín (22/10/2026): «no estaba buscando bien a los @».
//
// Las fuentes, en orden (medido el 22/10/2026, ver la cabecera de lib/instagram-perfil.ts):
//   1. Business Discovery con la conexión de Meta del NEGOCIO (`META_ACCESS_TOKEN` + `META_PAGE_ID` → su Instagram
//      profesional). Gratis, sólo cuentas de empresa o creador, y sólo si su token tiene permisos de Instagram (hoy, 1 de 11).
//   2. Business Discovery con la conexión de la PLATAFORMA. Hoy no: la página de MaKo no tiene un Instagram vinculado.
//   3. Apify (`apify/instagram-profile-scraper`): cualquier perfil público, también personal; se paga por resultado.
//      QUIÉN PAGA: la plataforma, con su `APIFY_TOKEN` (un perfil por @ exacto cuesta centésimos de centavo y es lo que
//      hace andar el producto, como la IA de la plataforma); si la plataforma no tiene, el negocio con la suya (la misma
//      que usa su Leads Scraper). Cada corrida, topeada; y un tope por negocio y por día (el alta pregunta mientras se
//      escribe). El tope vive en memoria de la instancia: es un freno, no una cuenta exacta.
//   4. `apify-spy` (1/11/2026): la clave del propio negocio para Competitors Spy (`APIFY_CLAVE_DE_SPY`). Sólo si quien llama la pide por
//      nombre, y hoy la pide sólo lib/spy.ts: no es la fuente 3, y no despierta nada del Leads Scraper retirado.
//      Con VARIAS claves de Spy (5/11/2026) Spy pide además `variasClaves`: si la 1 se queda sin crédito, pasa a la siguiente
//      (`clavesApifyDeSpy`, abajo). El alta del CRM no lo pide: con ella, la 1 sola, como siempre.
// Sin ninguna fuente que conteste, `ok: false` con el motivo: quien llama lo DICE (nunca inventa un perfil).
// NUNCA TIRA.
// =============================================================================

import 'server-only';
import { createHash } from 'node:crypto';
import { clavesGuardadasConBase, credDelCliente, credWs, credWsEstricta } from './credenciales';
import { wsSuperAdmin } from './workspace';
import { motivoDeErrorGraph, usuarioDeTexto } from './instagram-buscar';
import {
  APIFY_ACTOR_PERFIL, APIFY_CLAVE_DE_SPY, APIFY_MIN_LETRAS, APIFY_TOPE_POR_DIA, APIFY_TOPE_USD, campoDesconocido, CAMPOS_PERFIL, CAMPOS_PERFIL_PIEZAS,
  CLAVES_APIFY_DE_SPY, nombreDeClaveApify, slotDeClaveApify,
  TOPE_BUSQUEDAS_SPY_POR_DIA, TOPE_LECTURAS_SPY_POR_DIA,
  leerPerfilDeApify, leerPerfilDeMeta,
  type LecturaInstagram, type MotivoInstagram,
} from './instagram-perfil';
import { conLaPrimeraConCredito, rotuloDeClave, type ClaveApify } from './spy-claves';

const GRAPH = 'https://graph.facebook.com';
const ver = () => process.env.META_API_VERSION || 'v24.0';
const TOPE_META_MS = 12_000;
const TOPE_APIFY_MS = 60_000;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type FuenteInstagram = 'meta-negocio' | 'meta-plataforma' | 'apify' | 'apify-spy';
export type LecturaConFuente = (LecturaInstagram & { ok: true; fuente: FuenteInstagram }) | Extract<LecturaInstagram, { ok: false }>;

// ── Caché por negocio y por @ (24 h lo que se sabe; 10 min un error) y el tope de Apify por día ──
// ⚠️ LA CLAVE LLEVA EL NEGOCIO (revisión adversarial del 22/10/2026, M1): sin él, un negocio sin ninguna fuente recibía el
// perfil que otro leyó con SU token de Meta (y servía de oráculo de qué @ miró otro), y el fallo de uno le tapaba 10 min el
// @ a otro cuya Meta anda. Es el mismo bug que se corrigió en el buscador del alta el 12/10. Vive en `globalThis` (una
// copia por instancia aunque el módulo se cargue dos veces) y con tope, como la caché de esa ruta.
const TOPE_CACHE = 500;
type Entrada = { hasta: number; lectura: LecturaConFuente };
const g = globalThis as unknown as { __igPerfilCache?: Map<string, Entrada>; __igApifyHoy?: Map<string, number> };
const cache = (g.__igPerfilCache ??= new Map<string, Entrada>());
const apifyHoy = (g.__igApifyHoy ??= new Map<string, number>());
const hoy = () => new Date().toISOString().slice(0, 10);
const guardarEnCache = (clave: string, e: Entrada) => {
  cache.delete(clave);
  cache.set(clave, e);
  while (cache.size > TOPE_CACHE) cache.delete(cache.keys().next().value as string);
};

/** Business Discovery con una conexión de Meta. 'sin-cuenta' si la página no tiene un Instagram (o el token, el permiso). */
async function porMeta(usuario: string, token: string, pagina: string, campos: string = CAMPOS_PERFIL): Promise<LecturaInstagram> {
  const p = new URL(`${GRAPH}/${ver()}/${pagina}`);
  p.searchParams.set('fields', 'instagram_business_account{id}');
  p.searchParams.set('access_token', token);
  const rp = await fetch(p, { signal: AbortSignal.timeout(TOPE_META_MS), cache: 'no-store' });
  const jp = (await rp.json().catch(() => null)) as { error?: unknown; instagram_business_account?: { id?: string } } | null;
  if (!rp.ok || !jp || jp.error) {
    const motivo = motivoDeErrorGraph(jp?.error);
    return { ok: false, motivo: motivo === 'error' ? 'error' : motivo, detalle: `la página: HTTP ${rp.status}` };
  }
  // Meta NO da error si falta el permiso o no hay una cuenta vinculada: omite el campo.
  const ig = jp.instagram_business_account?.id;
  if (!ig) return { ok: false, motivo: 'sin-cuenta', detalle: 'la página no tiene un Instagram vinculado (o el token no tiene instagram_basic)' };
  const pedir = async (fields: string): Promise<{ status: number; cuerpo: unknown }> => {
    const u = new URL(`${GRAPH}/${ver()}/${ig}`);
    // `usuario` pasó por la regla de usuario (letras, números, punto y guion bajo): no cierra la expansión de campos.
    u.searchParams.set('fields', `business_discovery.username(${usuario}){${fields}}`);
    u.searchParams.set('access_token', token);
    const r = await fetch(u, { signal: AbortSignal.timeout(TOPE_META_MS), cache: 'no-store' });
    return { status: r.status, cuerpo: await r.json().catch(() => null) };
  };
  let res = await pedir(campos);
  // ⚠️ UN SOLO CAMPO QUE META NO RECONOZCA HACE FALLAR LA CONSULTA ENTERA, con un 400 que dice
  // «Tried accessing nonexisting field». Quien pide el juego ancho de Competitors Spy se banca ese
  // fallo y cae al juego que ya está en producción: así la ficha del competidor degrada a «sin
  // números» en vez de quedarse sin perfil. Un reintento y no más: si el angosto también falla, el
  // problema es otro y el motivo que vuelve es el de verdad.
  if (campos !== CAMPOS_PERFIL && res.status >= 400 && campoDesconocido(res.cuerpo)) {
    console.warn(`[instagram] Meta rechazó un campo del juego ancho para @${usuario}: se reintenta con los campos de siempre`);
    res = await pedir(CAMPOS_PERFIL);
  }
  return leerPerfilDeMeta(res.status, res.cuerpo);
}

// ── Las claves de Spy del negocio (5/11/2026, varias claves de Apify) ──────────────────────────────────────────────
// Martín: «Dame la opción de tener varias claves de apify». LA función que las lee: Spy, su traída larga, su guion, su búsqueda
// y la biblioteca de carruseles piden las claves acá, y el orden y el salto por crédito los hace lib/spy-claves.ts.
// La 1 se lee SIEMPRE (la clave de siempre sigue andando sin que nadie haga nada); las extra, con UNA lectura de nombres y una
// caché de un minuto, como `clavesZernio` (lib/zernio.ts). ⚠️ `clavesGuardadasConBase` se llama con los nombres EXACTOS de las
// extra: corta en `__`, y con la base devolvía sólo la 1 (el bug de Zernio del 29/10).

/** La huella de una clave (sha256 corto): con ella se sabe con qué clave se pidió algo sin guardar la clave. */
export const huellaApify = (token: string): string => createHash('sha256').update(token).digest('hex').slice(0, 16);

const TTL_EXTRAS_MS = 60_000;
const ge = globalThis as unknown as { __apifyExtras?: Map<number, { vence: number; extras: ClaveApify[] }> };
const extrasCache = (ge.__apifyExtras ??= new Map<number, { vence: number; extras: ClaveApify[] }>());

/**
 * Las claves de Spy del negocio, en orden (la 1 y las que se agregaron). Nunca tira: lo que no se pudo leer no está.
 * `soloLaPrimera`: la clave de siempre y nada más (el alta del CRM, que no rota). `conNombres`: con el nombre que la persona le
 * puso a cada una (la tarjeta de Integraciones y el script de la biblioteca; Spy no lo necesita para pedir).
 */
export async function clavesApifyDeSpy(ws: number, opc: { soloLaPrimera?: boolean; conNombres?: boolean; fresca?: boolean } = {}): Promise<ClaveApify[]> {
  const nombreDe = async (env: string) => (opc.conNombres ? ((await credDelCliente(nombreDeClaveApify(env), ws).catch(() => null))?.trim() || null) : null);
  const [token, nombre] = await Promise.all([credDelCliente(APIFY_CLAVE_DE_SPY, ws).catch(() => null), nombreDe(APIFY_CLAVE_DE_SPY)]);
  const claves: ClaveApify[] = token ? [{ token, slot: 1, nombre, huella: huellaApify(token) }] : [];
  if (opc.soloLaPrimera) return claves;
  const hit = opc.fresca || opc.conNombres ? undefined : extrasCache.get(ws);
  let extras = hit && hit.vence > Date.now() ? hit.extras : null;
  if (!extras) {
    extras = [];
    const guardadas = await clavesGuardadasConBase(ws, CLAVES_APIFY_DE_SPY.slice(1)).catch(() => null);
    for (const env of CLAVES_APIFY_DE_SPY.slice(1).filter((n) => guardadas?.includes(n))) {
      const [k, n] = await Promise.all([credDelCliente(env, ws).catch(() => null), nombreDe(env)]);
      if (k) extras.push({ token: k, slot: slotDeClaveApify(env) ?? 0, nombre: n, huella: huellaApify(k) });
    }
    // Un «no pude leer los nombres» no se recuerda: la próxima vuelve a preguntar.
    if (guardadas && !opc.conNombres) extrasCache.set(ws, { vence: Date.now() + TTL_EXTRAS_MS, extras });
  }
  // La misma clave pegada dos veces es UNA cuenta: probarla dos veces no suma crédito.
  for (const k of extras) if (!claves.some((x) => x.huella === k.huella)) claves.push(k);
  return claves;
}

/** Una clave sola como lista (la de la plataforma, dormida): el mismo camino de pedir, sin otra a la que pasar. */
const comoClave = (token: string): ClaveApify[] => [{ token, slot: 1, nombre: null, huella: huellaApify(token) }];

/**
 * Apify, con las claves en orden: la primera con crédito (lib/spy-claves.ts). 401/403 → sin permiso; 402/429 → límite (sin
 * saldo o frenado). Con varias claves, un «sin crédito» pasa a la siguiente; un 401 NO pasa: se dice cuál clave no entra.
 */
async function porApify(usuario: string, claves: readonly ClaveApify[], conPiezas = false): Promise<LecturaInstagram> {
  const q = new URLSearchParams({ maxItems: '1', maxTotalChargeUsd: String(APIFY_TOPE_USD) });
  const r = await conLaPrimeraConCredito(claves, async ({ token }) => {
    const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_PERFIL}/run-sync-get-dataset-items?${q}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [usuario] }), signal: AbortSignal.timeout(TOPE_APIFY_MS), cache: 'no-store',
    });
    return { status: res.status, cuerpo: await res.json().catch(() => null) };
  });
  if (!r) return { ok: false, motivo: 'sin-conexion', detalle: 'sin la clave de Apify' };
  const cual = claves.length > 1 ? ` (${rotuloDeClave(r.clave)})` : '';
  if (r.status === 401 || r.status === 403) return { ok: false, motivo: 'sin-permiso', detalle: `Apify: HTTP ${r.status}${cual}` };
  if (r.status === 402 || r.status === 429) return { ok: false, motivo: 'limite', detalle: `Apify: HTTP ${r.status}${cual}` };
  if (r.status < 200 || r.status >= 300) return { ok: false, motivo: 'error', detalle: `Apify: HTTP ${r.status}${cual}` };
  return leerPerfilDeApify(usuario, r.cuerpo, conPiezas);
}

/**
 * Anota UNA búsqueda por nombre en el tope de hoy de la clave de Spy del negocio. false = ya no queda.
 *
 * ⚠️ LA CABECERA DE lib/instagram-buscar-apify.ts DECÍA QUE EL TOPE LA CUBRÍA Y NO ERA CIERTO: `leerPerfilInstagram` contaba sus
 * lecturas y la búsqueda corría sin contar nada, así que escribir nombres no tenía techo.
 */
export function gastarBusquedaDeSpy(ws: number): boolean {
  // ⚠️ DESDE EL 4/11/2026 LAS BÚSQUEDAS TIENEN SU PROPIO CUPO (`b<ws>`), separado de las lecturas por @ (`s<ws>`):
  // compartiéndolo, buscar nombres dejaba al negocio sin poder agregar a nadie el resto del día.
  const cuenta = `b${ws}|${hoy()}`;
  const usadas = apifyHoy.get(cuenta) ?? 0;
  if (usadas >= TOPE_BUSQUEDAS_SPY_POR_DIA) return false;
  apifyHoy.set(cuenta, usadas + 1);
  return true;
}

/** ¿Este negocio ya gastó las búsquedas de hoy con su clave de Spy? Para que la pantalla no diga «no hay nadie» cuando es esto. */
export const topeDeSpyAgotado = (ws: number): boolean => (apifyHoy.get(`b${ws}|${hoy()}`) ?? 0) >= TOPE_BUSQUEDAS_SPY_POR_DIA;

/** Cuánto «dice» un fallo: el mejor gana para contarle al dueño qué pasó. */
const PESO: Record<MotivoInstagram, number> = { 'no-esta': 5, 'sin-permiso': 4, limite: 3, 'sin-cuenta': 2, error: 1, 'sin-conexion': 0 };

/**
 * El perfil de `usuario` (ya normalizado: sin @, en minúscula). `ws` = el negocio que pregunta (su Meta y, si la
 * plataforma no tiene, su Apify). `fuentes` = cuáles probar (el alta ya preguntó a Meta con sus candidatos: sólo Apify).
 */
export async function leerPerfilInstagram(
  usuario: string, opts: {
    ws?: number | null; fuentes?: readonly FuenteInstagram[]; conPiezas?: boolean;
    /** Cuántas lecturas del tope diario NO puede tocar esta llamada. Lo que nadie pidió con un clic deja margen. */
    reservaApify?: number;
    /**
     * Con la fuente `apify-spy`, ¿puede pasar a la 2.ª clave de Spy cuando la 1 se queda sin crédito? Sólo lo pide Spy
     * (5/11/2026, varias claves de Apify: son de Spy y de la biblioteca). Sin esto, la clave 1 sola, como siempre: el alta del
     * CRM no lo pide, así que las claves extra no le gastan nada.
     */
    variasClaves?: boolean;
  } = {},
): Promise<LecturaConFuente> {
  // El @ se valida ACÁ también (B3): entra a la expansión de campos de Graph, con el token de la plataforma.
  if (usuarioDeTexto(usuario) !== usuario) return { ok: false, motivo: 'no-esta', detalle: 'no es un usuario de Instagram' };
  const fuentes = opts.fuentes ?? ['meta-negocio', 'meta-plataforma', 'apify'];
  const ws = opts.ws ?? null;
  // `conPiezas` ENTRA EN LA CLAVE DE LA CACHÉ: sin eso, una lectura angosta de hace un rato le
  // contesta a Competitors Spy sin los números, y la ficha diría «no publica sus me gusta» sobre
  // una cuenta que sí los publica — un dato inventado por una caché.
  const campos = opts.conPiezas ? CAMPOS_PERFIL_PIEZAS : CAMPOS_PERFIL;
  // ⚠️ SI TIENE LA CLAVE DE SPY TAMBIÉN ENTRA EN LA CLAVE DE LA CACHÉ: un fallo se recuerda 10 minutos, y sin esto, pegar la clave y tocar «Revisar
  // ahora» seguía contestando «no pude» aunque ya hubiera con qué.
  const clavesDeSpy = fuentes.includes('apify-spy') && ws != null ? await clavesApifyDeSpy(ws, { soloLaPrimera: !opts.variasClaves }) : [];
  const claveDeSpy = clavesDeSpy.length ? clavesDeSpy : null;
  // ⚠️ CON RESERVA ES OTRA CLAVE: un «tope» de quien tiene reserva no puede tapar 10 minutos a quien sí puede leer. Sin esto, la fila
  // que no se completó le contestaba «no pude» a la vista previa que la persona pidió con un clic.
  const reserva = opts.reservaApify ?? 0;
  const clave = `${ws ?? '-'}|${usuario}|${fuentes.join(',')}|${opts.conPiezas ? 'anchas' : 'angostas'}|${reserva}|${claveDeSpy ? 'spy' : ''}`;
  // ⚠️ LO LEÍDO BIEN SE COMPARTE ENTRE QUIENES LLAMAN, sea cual sea su lista de fuentes (3/11/2026). La clave de arriba lleva la lista,
  // así que el buscador (`meta-plataforma,apify,apify-spy`) y la vista previa (`meta-negocio,…`) pagaban DOS veces a la misma persona:
  // escribir su @ gastaba una lectura y confirmarla, otra. Un perfil leído es el mismo perfil venga de la fuente que venga.
  const claveLeido = `${ws ?? '-'}|${usuario}|leido|${opts.conPiezas ? 'anchas' : 'angostas'}`;
  const leido = cache.get(claveLeido);
  if (leido && leido.hasta > Date.now()) return leido.lectura;
  const ya = cache.get(clave);
  if (ya && ya.hasta > Date.now()) return ya.lectura;
  let peor: Extract<LecturaInstagram, { ok: false }> = { ok: false, motivo: 'sin-conexion', detalle: 'ninguna fuente para leer Instagram' };
  // ¿El «no está» lo dijo Apify? Es la única fuente que ve cuentas personales: Business Discovery dice «no está» de toda
  // cuenta personal, y eso no puede quedar 24 h tapando un fallo pasajero de Apify (B1).
  let noEstaDeApify = false;
  const anotar = (l: Extract<LecturaInstagram, { ok: false }>, deApify = false) => {
    const confirma = deApify && l.motivo === 'no-esta';
    if (PESO[l.motivo] > PESO[peor.motivo] || confirma) { peor = l; noEstaDeApify = confirma; }
  };
  const guardar = (l: LecturaConFuente): LecturaConFuente => {
    const sabe = l.ok || (l.motivo === 'no-esta' && noEstaDeApify);
    guardarEnCache(clave, { hasta: Date.now() + (sabe ? 24 * 3600_000 : 10 * 60_000), lectura: l });
    if (l.ok) guardarEnCache(claveLeido, { hasta: Date.now() + 24 * 3600_000, lectura: l });
    return l;
  };
  // Meta leyó el perfil pero sin las publicaciones: sirve, pero si otra fuente las trae, gana ella.
  let sinPiezas: LecturaConFuente | null = null;
  try {
    const plataforma = await wsSuperAdmin();
    for (const f of fuentes) {
      if (f === 'apify-spy') {
        if (!claveDeSpy) continue;
        const cuenta = `s${ws}|${hoy()}`;
        const usadas = apifyHoy.get(cuenta) ?? 0;
        if (usadas >= TOPE_LECTURAS_SPY_POR_DIA - reserva) { anotar({ ok: false, motivo: 'limite', detalle: `tope de ${TOPE_LECTURAS_SPY_POR_DIA} lecturas por día` }); continue; }
        apifyHoy.set(cuenta, usadas + 1);
        const l = await porApify(usuario, claveDeSpy, opts.conPiezas).catch((e): LecturaInstagram => ({ ok: false, motivo: 'error', detalle: msg(e) }));
        if (l.ok) return guardar({ ...l, fuente: 'apify-spy' });
        anotar(l, true);
        continue;
      }
      if (f === 'meta-negocio' || f === 'meta-plataforma') {
        const w = f === 'meta-negocio' ? ws : plataforma;
        if (w == null || (f === 'meta-plataforma' && w === ws)) continue;
        const [token, pagina] = await Promise.all([credWs('META_ACCESS_TOKEN', w), credWs('META_PAGE_ID', w)]);
        if (!token || !pagina) continue;
        const l = await porMeta(usuario, token, pagina, campos).catch((e): LecturaInstagram => ({ ok: false, motivo: 'error', detalle: msg(e) }));
        if (l.ok && opts.conPiezas && !l.perfil.piezas && claveDeSpy) { sinPiezas = { ...l, fuente: f }; continue; }
        if (l.ok) return guardar({ ...l, fuente: f });
        anotar(l);
        continue;
      }
      // Apify: la plataforma paga; si no tiene key, el negocio. Un @ corto no se pregunta, y hay tope por día.
      if (usuario.length < APIFY_MIN_LETRAS) continue;
      // La de la plataforma se lee ESTRICTA (B2): si la base no contesta, no se sabe si la plataforma tiene key, y caer a
      // la del negocio sería hacerle pagar algo que no eligió.
      let deLaPlataforma: string | null;
      try { deLaPlataforma = await credWsEstricta('APIFY_TOKEN', plataforma); } catch (e) {
        anotar({ ok: false, motivo: 'error', detalle: `la key de Apify de la plataforma: ${msg(e)}` });
        continue;
      }
      const token = deLaPlataforma ?? (ws != null ? await credDelCliente('APIFY_TOKEN', ws) : null);
      if (!token) continue;
      const cuenta = `${deLaPlataforma ? `p${plataforma}` : `n${ws}`}|${hoy()}`;
      const usadas = apifyHoy.get(cuenta) ?? 0;
      if (usadas >= APIFY_TOPE_POR_DIA - reserva) { anotar({ ok: false, motivo: 'limite', detalle: `tope de ${APIFY_TOPE_POR_DIA} lecturas por día` }); continue; }
      apifyHoy.set(cuenta, usadas + 1);
      const l = await porApify(usuario, comoClave(token)).catch((e): LecturaInstagram => ({ ok: false, motivo: 'error', detalle: msg(e) }));
      if (l.ok) return guardar({ ...l, fuente: 'apify' });
      anotar(l, true);
    }
  } catch (e) {
    anotar({ ok: false, motivo: 'error', detalle: msg(e) });
  }
  if (sinPiezas) return guardar(sinPiezas);
  if (peor.motivo !== 'no-esta' && peor.motivo !== 'sin-conexion') console.warn(`[instagram] no pude leer @${usuario}: ${peor.motivo} (${peor.detalle})`);
  return guardar(peor);
}

/**
 * Varios perfiles en UNA corrida de Apify, con la clave de Spy del negocio (4/11/2026). Es lo que completa las
 * primeras filas del buscador con su foto y sus seguidores para poder ordenarlas.
 *
 * ⚠️ ANTES ERAN CINCO CORRIDAS, UNA POR FILA (`/api/competitor-spy/perfil`): cinco arranques del actor, cinco
 * esperas, y cinco lecturas del cupo. El actor acepta una lista de usuarios y cobra por perfil, así que una corrida
 * con cinco cuesta lo mismo y arranca una sola vez.
 *
 * Comparte la caché de `leerPerfilInstagram` (la clave `leido` angosta): lo que se completó acá, la confirmación lo
 * encuentra sin volver a pagarlo. Cada perfil cuenta una lectura del cupo, y con `reserva` nunca agota el día.
 * NUNCA TIRA: lo que no se pudo leer vuelve como `ok: false`.
 */
export async function leerPerfilesEnLote(
  usuarios: readonly string[], opts: { ws: number; reserva?: number },
): Promise<Map<string, LecturaConFuente>> {
  const out = new Map<string, LecturaConFuente>();
  const pedir: string[] = [];
  for (const crudo of usuarios) {
    const u = usuarioDeTexto(crudo);
    if (!u || u !== crudo || out.has(u) || pedir.includes(u)) continue;
    const leido = cache.get(`${opts.ws}|${u}|leido|angostas`);
    if (leido && leido.hasta > Date.now()) out.set(u, leido.lectura);
    else pedir.push(u);
  }
  if (!pedir.length) return out;
  // Es de Spy (el buscador y sus otras redes): con todas sus claves, la primera con crédito.
  const claves = await clavesApifyDeSpy(opts.ws);
  const sinLeer = (motivo: MotivoInstagram, detalle: string) => { for (const u of pedir) out.set(u, { ok: false, motivo, detalle }); return out; };
  if (!claves.length) return sinLeer('sin-conexion', 'sin la clave de Spy');
  const cuenta = `s${opts.ws}|${hoy()}`;
  const usadas = apifyHoy.get(cuenta) ?? 0;
  const quedan = TOPE_LECTURAS_SPY_POR_DIA - (opts.reserva ?? 0) - usadas;
  if (quedan <= 0) return sinLeer('limite', `tope de ${TOPE_LECTURAS_SPY_POR_DIA} lecturas por día`);
  const lote = pedir.slice(0, quedan);
  apifyHoy.set(cuenta, usadas + lote.length);
  try {
    const q = new URLSearchParams({ maxItems: String(lote.length), maxTotalChargeUsd: String(Math.max(APIFY_TOPE_USD, APIFY_TOPE_USD * lote.length)) });
    const r = await conLaPrimeraConCredito(claves, async ({ token }) => {
      const res = await fetch(`https://api.apify.com/v2/acts/${APIFY_ACTOR_PERFIL}/run-sync-get-dataset-items?${q}`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernames: lote }), signal: AbortSignal.timeout(TOPE_APIFY_MS), cache: 'no-store',
      });
      return { status: res.status, cuerpo: await res.json().catch(() => null) };
    });
    const cuerpo = r?.cuerpo ?? null;
    if (!r || r.status < 200 || r.status >= 300) {
      const status = r?.status ?? 0;
      const motivo: MotivoInstagram = status === 401 || status === 403 ? 'sin-permiso' : status === 402 || status === 429 ? 'limite' : 'error';
      const cual = r && claves.length > 1 ? ` (${rotuloDeClave(r.clave)})` : '';
      for (const u of lote) out.set(u, { ok: false, motivo, detalle: `Apify: HTTP ${status}${cual}` });
    } else {
      for (const u of lote) {
        const l = leerPerfilDeApify(u, cuerpo);
        if (l.ok) {
          const conFuente: LecturaConFuente = { ...l, fuente: 'apify-spy' };
          guardarEnCache(`${opts.ws}|${u}|leido|angostas`, { hasta: Date.now() + 24 * 3600_000, lectura: conFuente });
          out.set(u, conFuente);
        } else out.set(u, l);
      }
    }
  } catch (e) {
    for (const u of lote) out.set(u, { ok: false, motivo: 'error', detalle: msg(e) });
  }
  for (const u of pedir.slice(lote.length)) out.set(u, { ok: false, motivo: 'limite', detalle: `tope de ${TOPE_LECTURAS_SPY_POR_DIA} lecturas por día` });
  return out;
}
