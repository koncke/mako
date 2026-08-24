// =============================================================================
// integraciones — estado de conexión de todos los servicios externos
// =============================================================================
// Chequeo liviano por presencia de env (no hace pings que puedan colgar la
// página). El detalle "en vivo" de Meta (severidad, entrega, recos) viene aparte
// de getMetaHealth y se muestra expandido en /integraciones.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';
import { landingRecibioEventos, LANDING_VENTANA_DIAS } from './landing-token';
import { googleCalendarConectado, googleCalendarDueno } from './google-calendar';
import { capaDef } from './capas';
import { getCapaActual, getWorkspaceActual, wsSuperAdmin } from './workspace';
import { getAgenteToken } from './agente-token';

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
};

// El catálogo y la regla de visibilidad viven aparte, sin `server-only`, para poder
// testearlos. Se re-exportan para no romper a quien los importaba desde acá.
import { DEFS, defsVisibles, type Def } from './integraciones-catalogo';
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
        detalle: `Sin eventos en los últimos ${LANDING_VENTANA_DIAS} días. Si ya pegaste el código, revisá que el snippet siga apuntando acá.`,
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
  return { estado: 'falta', detalle: 'Entrá con Google para conectar tu agenda.' };
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
    if (ws != null && (await getAgenteToken(ws))) {
      return { estado: 'conectada', detalle: 'Token generado — Claude ya puede leer tu negocio y tu plan, y proponerte tareas.' };
    }
  } catch (e) {
    console.error(`[integraciones] chequeo del agente falló: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { estado: 'falta', detalle: 'Generá tu token e instalá la skill en Claude.' };
}

export async function getIntegraciones(): Promise<Integracion[]> {
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

  const defs = defsVisibles(DEFS, { cats, ocultas, esSuper });
  return Promise.all(defs.map(async (d) => {
    if (d.key === 'landing') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoLanding()) };
    }
    if (d.key === 'google') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoGoogleCalendar()) };
    }
    if (d.key === 'agente') {
      return { key: d.key, nombre: d.nombre, categoria: d.categoria, descripcion: d.descripcion, ...(await estadoAgente()) };
    }
    // Servicios de plataforma: se evalúan contra el env global (agencia).
    // Per-cliente: contra las credenciales del workspace actual.
    const faltan: string[] = [];
    for (const k of d.envs) {
      const ok = d.global ? envGlobalReal(k) : Boolean(await credWs(k));
      if (!ok) faltan.push(k);
    }
    return {
      key: d.key,
      nombre: d.nombre,
      categoria: d.categoria,
      descripcion: d.descripcion,
      estado: (faltan.length ? 'falta' : 'conectada') as EstadoIntegracion,
      detalle: faltan.length ? `Falta configurar: ${faltan.join(', ')}` : 'Conectada y operativa.',
      tieneDetalle: d.tieneDetalle,
    };
  }));
}
