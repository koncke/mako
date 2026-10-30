// =============================================================================
// integraciones — estado de conexión de todos los servicios externos
// =============================================================================
// Chequeo liviano por presencia de env (no hace pings que puedan colgar la
// página). El detalle "en vivo" de Meta (severidad, entrega, recos) viene aparte
// de getMetaHealth y se muestra expandido en /integraciones.
// =============================================================================

import 'server-only';
import { credDelCliente, credWs, credWsEstricta, esNegocioDelEntorno, wsDelEntorno } from './credenciales';
import { POR_QUE_IA_DE_MAKO, POR_QUE_LA_CONFIGURA_MAKO, veredictoDeIA } from './ia-keys';
import type { ProvName } from './ai-cheap';
import { emailConectado } from './resend';
import { POR_QUE_SIN_EMAIL } from './email-remitente';
import { metaConectadaConCampos } from './zernio-meta-cuerpo';
import { landingRecibioEventos, LANDING_VENTANA_DIAS } from './landing-token';
import { googleCalendarConectado, googleCalendarDueno } from './google-calendar';
import { capaDef } from './capas';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { tokenAgenteVisible } from './agente-token';
import { esGrabador } from './grabadores/reunion';
import { CATALOGO_GRABADORES } from './grabadores/catalogo';

export type EstadoIntegracion = 'conectada' | 'falta';

export type Integracion = {
  key: string;
  nombre: string;
  categoria: string;
  descripcion: string;
  estado: EstadoIntegracion;
  detalle: string;
  /** true si tiene una vista de detalle propia (hoy: Meta) */
  tieneDetalle?: boolean;
  /**
   * Lo ÚNICO que la grilla necesitaba del catálogo de /metodo, resuelto acá.
   *
   * ⚠️ Antes el componente hacía `servicioMetodo(i.key)` del lado del CLIENTE, y
   * eso arrastraba `lib/metodo-catalogo.ts` ENTERO al bundle: 145 KB con los
   * tutoriales de las 20 integraciones, los nombres de todas las envs y el copy
   * interno de la agencia — incluida la entrada de GitHub, que es una credencial
   * de plataforma que ningún cliente tiene por qué ver.
   *
   * De ese catálogo la grilla usaba DOS campos. Se resuelven en el server, viajan
   * como dos strings, y el catálogo se queda del lado del server.
   */
  soloServidor?: boolean;
  paraQue?: string;
  /**
   * Un grabador que HOY no se conecta (Loom no tiene API; Read AI y Google Meet piden un inicio de sesión que todavía no
   * está: lib/grabadores/catalogo.ts, `conectable: false`). La tarjeta dice por qué en vez de pedir claves que no existen,
   * y no cuenta como un pendiente del negocio.
   */
  sinConexion?: { texto: string; chip: string };
};

// El catálogo y la regla de visibilidad viven aparte, sin `server-only`, para poder
// testearlos. Se re-exportan para no romper a quien los importaba desde acá.
import { DEFS, defsVisibles, META_SE_CONECTA_EN_ZERNIO, type Def } from './integraciones-catalogo';
import { estadoDeRed, REDES, redDeTarjeta, SIN_USO_TODAVIA, type ConexionZernio, type RedConTarjeta } from './zernio-redes';
import { servicioMetodo } from './metodo-catalogo';
export { DEFS_TEST, defsVisibles } from './integraciones-catalogo';
export type { Def } from './integraciones-catalogo';

const envGlobalReal = (k: string) => Boolean(process.env[k] && String(process.env[k]).trim());

// Landing: no hay env que chequear. La señal HONESTA de "conectada" es que hayan
// llegado eventos RECIENTES: el token se autogenera para todos al abrir
// /integraciones, así que "tiene token" no probaría nada, y "alguna vez llegó algo"
// tampoco — el snippet vive en una propiedad de un tercero (Lovable) y puede dejar
// de mandar sin que nadie se entere. Por eso la ventana de LANDING_VENTANA_DIAS.
async function estadoLanding(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  const activa = await landingRecibioEventos();
  return activa
    ? { estado: 'conectada', detalle: 'Recibiendo eventos de tu landing.' }
    : {
        estado: 'falta',
        // El copy distingue los dos casos, porque la acción es distinta: si nunca
        // llegó nada hay que pegar el código; si dejó de llegar, hay que ir a ver
        // qué se rompió (típico: el snippet quedó con una URL vieja al mudar el
        // dominio — se copia congelado y no se entera de nada).
        detalle: `Sin eventos en los últimos ${LANDING_VENTANA_DIAS} días. Si ya pegaste el código, revisa que el snippet siga apuntando aquí.`,
      };
}

// Google Calendar: tampoco hay env que chequear (la app OAuth es de la agencia y
// está siempre configurada). La señal HONESTA de "conectada" es que exista el
// refresh token de ESTE workspace: prueba que alguien entró con Google y
// autorizó su agenda. Nunca lanza: es una tarjeta, no puede tumbar la página.
// Decimos DE QUIÉN es la agenda porque el workspace puede tener varias cuentas y
// el token es uno solo: sin el email, nadie podría saber cuál quedó conectada.
async function estadoGoogleCalendar(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  try {
    if (await googleCalendarConectado()) {
      const dueno = await googleCalendarDueno();
      return { estado: 'conectada', detalle: dueno ? `Cruzando las reuniones de ${dueno}.` : 'Conectada — cruzando tus reuniones.' };
    }
  } catch (e) {
    console.error(`[integraciones] chequeo de Google Calendar falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { estado: 'falta', detalle: 'Entra con Google para conectar tu agenda.' };
}

// Agente (Claude Code): no hay env ni credencial cifrada que chequear (la skill
// vive en la máquina del usuario). La señal HONESTA de "conectada" es que ya haya
// acuñado su token — el paso que enlaza su agente con este workspace. Sin token
// todavía no se conectó: queda "por configurar" (ámbar, nunca rojo), como la
// landing antes del primer evento. Nunca lanza: es una tarjeta, no puede tumbar la
// página.
async function estadoAgente(): Promise<Pick<Integracion, 'estado' | 'detalle'>> {
  try {
    const ws = await getWorkspaceActual();
    if (ws != null && (await tokenAgenteVisible(ws))) {
      return { estado: 'conectada', detalle: 'Token generado — Claude ya puede leer tu negocio y tu plan, y proponerte tareas.' };
    }
  } catch (e) {
    console.error(`[integraciones] chequeo del agente falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { estado: 'falta', detalle: 'Genera tu token e instala la skill en Claude.' };
}

/**
 * Los dos campos del catálogo de /metodo que la grilla necesita.
 *
 * Se importa acá —que es `server-only`— y no en el componente: es lo que mantiene
 * el catálogo fuera del bundle del navegador. Si alguna vez hace falta un tercer
 * campo, se suma a esta función; el día que se importe el catálogo desde un
 * `'use client'`, vuelven los 145 KB.
 */
function delMetodo(key: string): { soloServidor?: boolean; paraQue?: string } {
  const s = servicioMetodo(key);
  return s ? { soloServidor: !!s.soloServidor, paraQue: s.paraQue } : {};
}

/**
 * Las integraciones que ve este negocio. `conOcultas`: también las que no son tarjetas de la grilla porque se conectan dentro de
 * otra (las cuatro IA, en «Tus cuentas de IA», 25/10/2026). La API las pide (ver_integraciones: leer su estado sigue siendo
 * leer una integración); la grilla y el teléfono no.
 */
export async function getIntegraciones(opts: { conOcultas?: boolean } = {}): Promise<Integracion[]> {
  // La CAPA decide qué categorías ve este workspace: al super-admin no le sirve
  // Publicidad/Mensajería/Datos (no corre ads ni mide su propio VSL) y mostrárselas
  // es una lista de rojos de un negocio que no tiene. null = ve todas.
  const cap = capaDef(await getCapaActual());
  const cats = cap.categoriasIntegraciones;
  const ocultas = new Set(cap.integracionesOcultas ?? []);
  // Y el SUPER-ADMIN decide qué se ve de la plataforma. Una credencial como el token
  // del repo no es del negocio de nadie: mostrársela a un cliente es pedirle que
  // administre algo que no es suyo, y encima un campo secreto que no puede llenar.
  //
  // ⚠️⚠️ LA PREGUNTA ES POR EL WORKSPACE, NO POR EL USUARIO. Esto era
  // `!!(await getSesionAdmin())`, que contesta «¿quien mira es admin?» — y el
  // super admin SIGUE siendo admin cuando entra al workspace de un cliente con
  // `?ws=N`. Resultado, medido el 24/08/2026 pidiendo el HTML servido:
  //
  //     ws=13 (Codigo Inmobiliario) → «GitHub» ×12, `svc-github`, y el nombre
  //                                    GITHUB_TOKEN ×2 en el HTML del cliente
  //     ws=1  (Mauricio)            → lo mismo
  //     ws=9  (la plataforma)       → correcto, ahi SÍ va
  //
  // O sea que la tarjeta del token del repo se dibujaba adentro del panel de dos
  // clientes. Y no es solo cosmetico: ese modal GUARDA con `ctx.ws`, o sea en el
  // workspace que se este mirando, mientras `lib/github-commits.ts` lo LEE con
  // `credWs(..., await wsSuperAdmin())`. Cargarlo desde ahi habria dejado el token
  // del repo de la agencia adentro de las credenciales de un cliente Y sin que la
  // feature funcione, porque el que lo lee mira otro lado. (Verificado en prod: hoy
  // GITHUB_TOKEN y GITHUB_REPO existen solo en el ws 9. No llegó a pasar.)
  //
  // ⚠️ Es el error que AGENTS.md ya tiene escrito con todas las letras —«OWNER_WS
  // NO es la plataforma: es un cliente; lo de MaKo va en wsSuperAdmin()»— aplicado
  // a la otra mitad: tampoco alcanza con «el que mira es admin».
  //
  // Fail-closed: sin workspace resuelto no se muestra. Esconder de mas es un
  // renglon que falta; mostrar de mas es la credencial de la plataforma adentro
  // del panel de un cliente.
  const wsActual = await getWorkspaceActual().catch(() => null);
  const esSuper = wsActual != null && wsActual === (await wsSuperAdmin().catch(() => -1));

  const defs = defsVisibles(opts.conOcultas ? DEFS.map((d) => ({ ...d, oculto: false })) : DEFS, { cats, ocultas, esSuper });
  // ⛔ El WhatsApp OFICIAL (Cloud API de Meta, vía Chatwoot) salió del producto en dos pasos:
  // el 05/10/2026 se escondió la tarjeta (Martín: «ahora Meta te cobra por la app de
  // oficial… directamente voy a sacar el tema de oficial»), salvo para quien ya lo tenía, y
  // el 09/10/2026 se borró la integración entera («que no exista más»): la tarjeta ya no está
  // en lib/integraciones-catalogo.ts. Ver tests/sin-chatwoot.test.ts.
  return Promise.all(defs.map(integracionDeDef));
}

/**
 * UNA integración, con LA MISMA cuenta que la grilla (`integracionDeDef`), para abrir SU modal desde otra pestaña
 * (decimotercera tanda, punto 5: «No crees un nuevo modal de conectar la API, reutiliza exactamente el mismo que ya
 * tenemos en integraciones»; Automations conecta Zernio con el `ServicioModal` de /integraciones). Respeta la regla
 * de la PLATAFORMA (una tarjeta `soloSuper` no se le abre a un cliente); la capa decide qué se LISTA, no qué se puede
 * configurar cuando una automatización lo necesita. null = no existe o no es para este workspace.
 */
export async function getIntegracion(key: string): Promise<Integracion | null> {
  const d = DEFS.find((x) => x.key === key);
  if (!d) return null;
  const wsActual = await getWorkspaceActual().catch(() => null);
  const esSuper = wsActual != null && wsActual === (await wsSuperAdmin().catch(() => -1));
  // `oculto` no la esconde ACÁ: es «no es una tarjeta de la grilla», no «no se configura» (las IA abren este modal desde
  // «Tus cuentas de IA», 25/10/2026). Lo único que corta es la regla de la plataforma.
  if (!defsVisibles([{ ...d, oculto: false }], { cats: null, ocultas: new Set(), esSuper }).length) return null;
  return integracionDeDef(d);
}

/** El estado de UNA tarjeta del catálogo (la grilla y `getIntegracion`). */
async function integracionDeDef(d: Def): Promise<Integracion> {
  if (d.key === 'landing') {
    return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoLanding()) };
  }
  if (d.key === 'google') {
    return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoGoogleCalendar()) };
  }
  if (d.key === 'agente') {
    return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoAgente()) };
  }
  // Un grabador que no se conecta: la tarjeta lo dice (no pide claves que no existen) y no es un pendiente.
  const grabador = esGrabador(d.key) ? CATALOGO_GRABADORES[d.key] : null;
  if (grabador && !grabador.conectable) {
    const texto = grabador.aviso ?? `${grabador.nombre} todavía no se puede conectar.`;
    return {
      key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion,
      estado: 'falta', detalle: texto, soloServidor: true, sinConexion: { texto, chip: grabador.chip ?? 'Próximamente' },
    };
  }
  // WhatsApp por QR (29/10/2026): conectada si alguna línea del negocio lo está (la de MaKo no cuenta).
  if (d.key === 'whatsapp') return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoWhatsApp()) };
  // Una red social (29/10/2026): conectada o no según sus cuentas en Zernio.
  const red = redDeTarjeta(d.key);
  if (red) return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoDeRedZernio(red)) };
  // Servicios de plataforma: se evalúan contra el env global (agencia).
  // Per-cliente: contra las credenciales del workspace actual.
  const faltan: string[] = [];
  for (const k of d.envs) {
    const ok = d.global ? envGlobalReal(k) : Boolean(await credWs(k));
    if (!ok) faltan.push(k);
  }
  // ⚠️ META SE CONECTA POR ZERNIO (29/10/2026, ticket #28): la tarjeta la medía con sus `envs` (el token y la cuenta), así que un
  // negocio conectado SÓLO por Zernio quedaba «Sin conectar» y lo que faltaba era el token. La misma regla que los otros tres
  // lectores (`metaConectadaConCampos`), y lo que falta se dice en palabras: se conecta en Zernio, nunca «el token».
  if (d.key === 'meta' && faltan.length) {
    const tiene = new Map(await Promise.all(['META_AD_ACCOUNT_ID', 'META_ACCESS_TOKEN', 'META_ZERNIO_CUENTA'].map(async (e) => [e, Boolean(await credWs(e))] as const)));
    const conectada = metaConectadaConCampos((e) => tiene.get(e) === true);
    return {
      key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion,
      estado: (conectada ? 'conectada' : 'falta') as EstadoIntegracion,
      detalle: conectada ? 'Conectada y operativa.' : META_SE_CONECTA_EN_ZERNIO,
      tieneDetalle: d.tieneDetalle,
      ...delMetodo(d.key),
    };
  }
  // ⚠️ EMAIL CON LA KEY Y SIN REMITENTE PROPIO NO ESTÁ CONECTADO, aunque la key sea lo único que pide
  // para abrir /email (por eso el remitente sigue `opcional` en el catálogo, ver `sinEsto`). La tarjeta
  // decía «Conectada» al lado de un campo vacío (Customer Success, audio del 08/10/2026, punto 15: el ws4
  // tiene su key y ningún remitente), y después con el email de MaKo como remitente de un cliente (el ws1).
  // UNA rama, POSITIVA (undécima tanda): `emailConectado` (lib/resend.ts) = key Y un remitente que pasa
  // `remitenteDelNegocio`; lo que no pasa —sin remitente, el sandbox, el de MaKo, otro dominio— dice lo mismo.
  // Es una lectura para DIBUJAR: si no se pudo leer, dice «falta», que se corrige solo en la próxima carga;
  // no decide ningún envío.
  if (d.key === 'email' && !faltan.length && !(await emailConectado().catch(() => false))) {
    return {
      key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion,
      estado: 'falta' as EstadoIntegracion,
      detalle: POR_QUE_SIN_EMAIL,
      tieneDetalle: d.tieneDetalle,
      ...delMetodo(d.key),
    };
  }
  // ⚠️ UNA IA ESTÁ CONECTADA SI MaKo LA PUEDE USAR COMO DEL NEGOCIO (tickets #5 y #6, lib/ia-keys.ts → `veredictoDeIA`):
  // en el ws1 decía «Conectada y operativa» en las siete, con copias de la plataforma, y MaKo no tenía con qué contestar.
  const ia = await iaDelNegocio(d.key, d.envs[0]).catch(() => null);
  if (ia) {
    const v = veredictoDeIA(ia);
    return {
      key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion,
      estado: (v === 'conectada' ? 'conectada' : 'falta') as EstadoIntegracion,
      detalle: v === 'conectada' ? 'Conectada y operativa.' : v === 'copia' ? POR_QUE_IA_DE_MAKO
        : v === 'equipo' ? POR_QUE_LA_CONFIGURA_MAKO : `Falta configurar: ${d.envs.join(', ')}`,
      tieneDetalle: d.tieneDetalle,
      ...delMetodo(d.key),
      // El workspace del entorno no pega ninguna key de IA: sin el formulario del modal (`mostrarForm`).
      ...(v === 'equipo' ? { soloServidor: true } : {}),
    };
  }
  return {
    key: d.key,
    nombre: d.nombre,
    categoria: d.categoria,
    descripcion: d.descripcion,
    estado: (faltan.length ? 'falta' : 'conectada') as EstadoIntegracion,
    detalle: faltan.length ? `Falta configurar: ${faltan.join(', ')}` : 'Conectada y operativa.',
    tieneDetalle: d.tieneDetalle,
    ...delMetodo(d.key),
  };
}

/**
 * El estado de la tarjeta de WhatsApp (29/10/2026): las líneas del negocio por QR (`evolution_instancias`, `listarLineas`), SIN la línea
 * de MaKo (`esLineaDeMaKo`: la del grupo no es una línea del negocio). Lo que dice la FILA, para la tarjeta; el modal mide cada línea
 * (app/integraciones/LineasWhatsApp.tsx). `soloServidor: false`: se gestiona en su modal, aunque no tenga campos que pegar.
 */
async function estadoWhatsApp(): Promise<Pick<Integracion, 'estado' | 'detalle' | 'soloServidor'>> {
  try {
    const { listarLineas } = await import('./evolution');
    const { esLineaDeMaKo } = await import('./linea-plataforma');
    const lineas = (await listarLineas()).filter((l) => !esLineaDeMaKo(l.instance_name));
    const conectadas = lineas.filter((l) => l.estado === 'conectado').length;
    if (!conectadas) {
      return { estado: 'falta', detalle: lineas.length ? 'Ninguna línea conectada: escanea su QR.' : 'Conecta tu WhatsApp con un QR: una línea o varias.', soloServidor: false };
    }
    return { estado: 'conectada', detalle: conectadas === 1 ? '1 línea conectada.' : `${conectadas} líneas conectadas.`, soloServidor: false };
  } catch (e) {
    console.error('[integraciones] whatsapp:', e instanceof Error ? e.message : e);
    return { estado: 'falta', detalle: 'No pude leer tus líneas de WhatsApp.', soloServidor: false };
  }
}

/**
 * Las cuentas de Zernio del negocio, UNA lectura por carga de la grilla (las tarjetas de red se arman en paralelo y cada una
 * preguntaría). Con tope de tiempo: Zernio lento no frena /integraciones. `sin-clave` = no hay clave; null = no se pudo leer.
 */
const redesCache = new Map<number, { p: Promise<ConexionZernio[] | 'sin-clave' | null>; vence: number }>();
const TOPE_REDES_MS = 5_000;
async function redesDelNegocio(): Promise<ConexionZernio[] | 'sin-clave' | null> {
  const ws = await getWorkspaceActual().catch(() => null);
  if (ws == null) return null;
  const hit = redesCache.get(ws);
  if (hit && hit.vence > Date.now()) return hit.p;
  const p = (async () => {
    const { conexionesViaZernio } = await import('./zernio-conectar');
    let tope: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        conexionesViaZernio(ws),
        new Promise<null>((ok) => { tope = setTimeout(() => ok(null), TOPE_REDES_MS); }),
      ]);
    } catch (e) {
      return (e as { motivo?: string }).motivo === 'sin-clave' ? 'sin-clave' : null;
    } finally {
      clearTimeout(tope);
    }
  })();
  redesCache.set(ws, { p, vence: Date.now() + 15_000 });
  return p;
}

/**
 * El estado de la tarjeta de una red (29/10/2026): conectada si tiene una cuenta activa en Zernio. Sin clave, lo que falta se dice
 * en orden (primero la clave, después el login); una que todavía no se usa en MaKo lo dice y no es un pendiente (`sinConexion`).
 */
async function estadoDeRedZernio(red: RedConTarjeta): Promise<Pick<Integracion, 'estado' | 'detalle' | 'soloServidor' | 'sinConexion'>> {
  const sinUso = SIN_USO_TODAVIA[red];
  if (sinUso) return { estado: 'falta', detalle: sinUso, soloServidor: true, sinConexion: { texto: sinUso, chip: 'Próximamente' } };
  const nombre = REDES[red].etiqueta;
  const lista = await redesDelNegocio();
  if (lista === 'sin-clave') return { estado: 'falta', detalle: `Se conecta con tu cuenta de Zernio: primero tu API key, después el login de ${nombre}.`, soloServidor: true };
  if (lista == null) return { estado: 'falta', detalle: 'No pude leer tus redes en Zernio. Prueba de nuevo en un rato.', soloServidor: true };
  const e = estadoDeRed(red, lista);
  if (e.estado === 'conectada') return { estado: 'conectada', detalle: 'Conectada y operativa.', soloServidor: true };
  if (e.estado === 'vencida') return { estado: 'falta', detalle: `Zernio pide volver a conectar tu ${nombre}.`, soloServidor: true };
  return { estado: 'falta', detalle: `Se conecta en la tarjeta de Zernio, con el login de ${nombre}.`, soloServidor: true };
}

/** Las IA de la cascada barata: las que MaKo usa con las keys del negocio (`provsDe`, lib/ai-cheap.ts). */
const IA_DE_LA_CASCADA: ReadonlySet<string> = new Set<ProvName>(['gemini', 'groq', 'openai']);

/**
 * ¿Qué tiene de SUYO el negocio en esta IA? Con las MISMAS lecturas que la usan, para que la tarjeta no pueda decir
 * «Conectada» donde MaKo no encuentra nada:
 *   · las baratas, con `provsDe` (sus filas, sin las copias de la plataforma);
 *   · la de Anthropic, con la frontera de `conClaveDelNegocio` (lib/anthropic.ts): su fila, distinta de la del entorno
 *     y de la fila de la que sale el entorno (`wsDelEntorno`: la plataforma desde el 18/10, antes el ws1).
 * `null` = no es una IA, o es la plataforma (usa las suyas): manda lo de siempre.
 * ⚠️ El workspace del ENTORNO va primero y sin leer nada (`esNegocioDelEntorno`): su fila es la de la plataforma, y la
 * tarjeta no le ofrece pegar una key aunque falle cualquier lectura de abajo.
 */
async function iaDelNegocio(key: string, envBase: string | undefined): Promise<{ fila: boolean; propia: boolean; delEntorno?: boolean } | null> {
  if (!envBase || (!IA_DE_LA_CASCADA.has(key) && key !== 'anthropic')) return null;
  const ws = await getWorkspaceActual().catch(() => null);
  if (await esNegocioDelEntorno(ws)) return { fila: false, propia: false, delEntorno: true };
  const wsSA = await wsSuperAdmin().catch(() => null);
  if (ws == null || wsSA == null || ws === wsSA) return null;
  // Con el crédito de Claude que le asignó Martín, prendido (lib/credito-negocio.ts; el ws1, 22/10/2026): su Claude anda, y la
  // tarjeta no dice «la de MaKo» por la copia que quedó en su fila.
  if (key === 'anthropic' && (await (await import('./credito-negocio')).claveDelCreditoAsignado(ws))) return { fila: true, propia: true };
  const fila = (await credDelCliente(envBase, ws))?.trim() ?? '';
  if (key === 'anthropic') {
    if (!fila) return { fila: false, propia: false };
    const plataforma = [process.env[envBase], await credWsEstricta(envBase, await wsDelEntorno(envBase)), await credWsEstricta(envBase, wsSA)];
    return { fila: true, propia: !plataforma.some((x) => typeof x === 'string' && x.trim() === fila) };
  }
  const { provsDe } = await import('./ai-cheap');
  // Fuera de D6b: «¿es suya?» no es «¿la usa con su IA?». Con su Gemini y su Groq, D6b no le da Groq a `provsDe`, y la
  // tarjeta decía «Esa key es la de MaKo» (la revisión de IA16). Lee sus filas; no sale a ningún proveedor.
  const { conSoloSuIA } = await import('./solo-su-ia');
  return { fila: !!fila, propia: (await conSoloSuIA(false, () => provsDe(key as ProvName))).length > 0 };
}
