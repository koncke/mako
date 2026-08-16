// =============================================================================
// Microsoft Clarity — mapas de calor y grabaciones, atados al lead del CRM
// =============================================================================
// Clarity es gratis y sin límite de tráfico ni de sitios (verificado en la
// documentación de Microsoft, 2026-06-30). Lo que NO se puede es traer sus
// heatmaps ni sus grabaciones a nuestra pantalla: su Data Export API permite
// **10 requests por proyecto por día**, devuelve solo promedios de los últimos
// 1-3 días y no tiene endpoint de grabaciones.
//
// Por eso este módulo hace DOS cosas y ninguna más:
//
//   1. ARMA EL LINK a las grabaciones de UNA persona. El snippet le pasa a
//      Clarity nuestro `visitor_id` con `clarity("identify", …)`, y acá se
//      construye la URL del panel de Microsoft ya filtrada por ese id. Es un
//      link, no un iframe — Clarity no permite embeber el reproductor, y un
//      botón honesto que abre su panel es mejor que un marco vacío.
//
//   2. TRAE EL RESUMEN de la Data Export API para pintarlo en /marketing:
//      sesiones, rage clicks, dead clicks, scroll promedio. Con una cuota de 10
//      por día, esto NO se consulta desde una pantalla: lo cachea un cron.
//
// ⚠️ BYOK, y por dos razones distintas. El PROJECT_ID no es secreto (viaja en el
// HTML de la página, como cualquier pixel) pero es de la cuenta del cliente; el
// TOKEN de la Data Export API sí lo es, porque da lectura a las métricas de ese
// proyecto. Los dos van por `credWs`, cifrados y por workspace: si vivieran en
// una env de la plataforma, todos los clientes escribirían en el proyecto de
// Clarity del dueño y nadie podría ver el suyo.
// =============================================================================

import 'server-only';
import { credWs } from './credenciales';

const PANEL = 'https://clarity.microsoft.com/projects/view';
const API = 'https://www.clarity.ms/export-data/api/v1/project-live-insights';


/**
 * Saca el ID del proyecto de lo que sea que la persona haya pegado.
 *
 * ⚠️ EL ID NO SE PUEDE DEDUCIR DEL TOKEN, y se verificó: el `sub` del JWT es
 * 3460892749304374 y el proyecto es `y2vjnv3kr3`, que en base36 da
 * 3461152837449423. Están en el mismo espacio de numeración —los dos empiezan con
 * «y2»— pero NO son el mismo identificador: el `sub` es de la cuenta, no del
 * proyecto. Y la Data Export API tiene un solo endpoint, que no lista proyectos.
 *
 * Así que el id hay que pedirlo. Lo que SÍ se puede es dejar de pedirlo mal: el
 * lugar donde todo el mundo lo tiene a mano es la barra de direcciones del panel
 * de Clarity, no Settings → Overview. Antes eso rebotaba con «eso no parece un
 * ID»; ahora se acepta la URL entera y se extrae el id.
 *
 * Es la diferencia entre un formulario que exige el formato correcto y uno que
 * entiende lo que la persona tenía a mano.
 */
export function normalizarProjectId(crudo: string | null | undefined): string | null {
  const s = (crudo ?? '').trim();
  if (!s) return null;
  // Una URL de Clarity: .../projects/view/<id>/... — el id es el segmento que
  // sigue a «view». Se acepta con o sin esquema, con o sin cola.
  const m = /clarity\.microsoft\.com\/projects\/view\/([a-z0-9]+)/i.exec(s);
  if (m) return m[1].toLowerCase();
  // Pegado pelado. Se acepta tal cual si tiene forma de id.
  return /^[a-z0-9]{6,20}$/i.test(s) ? s.toLowerCase() : null;
}

/** El id del proyecto de Clarity de ESTE workspace, o null si no lo conectó. */
export async function clarityProjectId(ws?: number): Promise<string | null> {
  const v = (await credWs('CLARITY_PROJECT_ID', ws))?.trim();
  // `PENDING` es el centinela que deja el alta de credenciales cuando el campo
  // se creó pero todavía no se completó. Tratarlo como un id daría un link roto.
  if (!v || v.startsWith('PENDING')) return null;
  // Se normaliza también al LEER, no solo al guardar: puede haber valores
  // cargados antes de que existiera la normalización, o pegados a mano en la
  // base. Un id con forma de URL acá rompe el snippet Y el link del lead.
  return normalizarProjectId(v);
}

async function token(ws?: number): Promise<string | null> {
  const v = (await credWs('CLARITY_API_TOKEN', ws))?.trim();
  return v && !v.startsWith('PENDING') ? v : null;
}

/**
 * Cuántos días guarda Clarity una grabación antes de borrarla.
 *
 * No es un número elegido: es el que Microsoft documenta. Vale también para el
 * cron que avisa antes de que se venzan (`clarity-vigilante`).
 */
export const DIAS_RETENCION = 30;

/**
 * ¿Puede existir todavía la grabación de esta persona?
 *
 * ⚠️ LA PREGUNTA NO ES «¿tiene identificador?» SINO «¿sigue viva su grabación?».
 * Ofrecer el link a un lead cuya sesión fue hace tres meses es prometer algo que
 * Clarity ya borró: se abre su panel, no hay nada, y la conclusión razonable es
 * que la medición no funciona. Medido el 2026-08-16 en el workspace 1: de 36
 * leads con seguimiento, **12 eran más viejos que la retención** —el más antiguo
 * del 31/3— y a los 12 se les mostraba el botón.
 *
 * Se mira la ÚLTIMA actividad y no la fecha de alta: alguien que entró en marzo
 * y volvió ayer tiene grabación de ayer.
 */
export function grabacionVigente(ultimaActividad: string | Date | null | undefined): boolean {
  if (!ultimaActividad) return false;
  const t = new Date(ultimaActividad).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < DIAS_RETENCION * 86_400_000;
}

/**
 * El link a las grabaciones de UNA persona, ya filtrado por nuestro id.
 *
 * ⚠️ Es lo único que ata Clarity al CRM, y es la mitad del valor de todo esto:
 * sin el filtro, el botón lleva a una lista de miles de sesiones anónimas y no
 * sirve para nada. Con él, lleva a lo que hizo Marina Olvera.
 *
 * El `visitor_id` es el mismo que el Pixel guarda en la cookie `nqe_visitor_id` y
 * que se une al lead cuando la persona deja sus datos — o sea que el puente ya
 * existía; lo único que faltaba era decírselo a Clarity.
 *
 * Devuelve null si falta cualquiera de las dos piezas. Un botón que no puede
 * abrir nada es peor que ninguno: promete y falla.
 */
export async function urlSesionesDeLead(visitorId: string | null | undefined, ws?: number): Promise<string | null> {
  const vid = visitorId?.trim();
  if (!vid) return null;
  const pid = await clarityProjectId(ws);
  if (!pid) return null;
  // ⚠️ EL FORMATO ES `campo=<operador>;<valor>`, Y EL VALOR VA ENCODEADO DOS
  // VECES. Sin el operador, Clarity DESCARTA el parámetro entero y muestra la
  // lista completa del proyecto — que es exactamente lo que pasó: se abría el
  // panel con 35 sesiones de gente cualquiera y la URL volvía reescrita como
  // `?date=Last 3 days`, sin rastro del filtro. Un link que no filtra es peor
  // que ninguno: promete «lo que hizo ÉL» y entrega «lo que hizo todo el mundo».
  //
  // La forma salió de copiar una URL con el filtro ya aplicado a mano:
  //   ?date=Last%203%20days&CustomUserId=is%3B%25231895
  //   …que decodificado una vez es  CustomUserId=is;%231895
  // O sea: el valor se encodea, se le pega `is;` adelante, y el conjunto se
  // encodea de nuevo al meterlo en la URL.
  //
  // Y la ventana de fechas va EXPLÍCITA en 30 días: el default del panel son 3, y
  // una grabación de hace tres semanas —que todavía existe, porque Clarity las
  // guarda 30— quedaba fuera del filtro y se veía igual que si no existiera.
  const filtro = `is;${encodeURIComponent(vid)}`;
  return `${PANEL}/${encodeURIComponent(pid)}/impressions?date=Last%20${DIAS_RETENCION}%20days&CustomUserId=${encodeURIComponent(filtro)}`;
}

/**
 * El link a las grabaciones de UNA PRUEBA.
 *
 * El snippet ya le manda a Clarity el marcador con `clarity("set","mko_prueba",…)`,
 * así que su panel puede filtrar por él igual que por el visitor_id. Sin esto,
 * después de una prueba había que buscar la propia sesión entre las de todo el
 * mundo — y a los 40 minutos, que es lo que Clarity tarda en procesarla, ya nadie
 * se acuerda de cuál era.
 */
export async function urlSesionesDePrueba(prueba: string | null | undefined, ws?: number): Promise<string | null> {
  const p = prueba?.trim();
  if (!p) return null;
  const pid = await clarityProjectId(ws);
  if (!pid) return null;
  // Mismo contrato que el filtro de usuario: `<operador>;<valor>` y el valor
  // encodeado dos veces. `mko_prueba` es un custom tag (`clarity("set", …)`).
  const filtro = `is;${encodeURIComponent(p)}`;
  return `${PANEL}/${encodeURIComponent(pid)}/impressions?date=Last%203%20days&mko_prueba=${encodeURIComponent(filtro)}`;
}

/** El link al panel del proyecto, sin filtrar. Para el botón «ver los mapas». */
export async function urlPanel(ws?: number, seccion: 'dashboard' | 'heatmaps' | 'impressions' = 'dashboard'): Promise<string | null> {
  const pid = await clarityProjectId(ws);
  return pid ? `${PANEL}/${encodeURIComponent(pid)}/${seccion}` : null;
}

export type ResumenClarity = {
  sesiones: number | null;
  bots: number | null;
  rageClicks: number | null;
  deadClicks: number | null;
  scrollPromedio: number | null;
  /** Qué días cubre. La API solo acepta 1, 2 o 3 días hacia atrás. */
  dias: number;
  ok: boolean;
  error: string | null;
};

const VACIO: ResumenClarity = { sesiones: null, bots: null, rageClicks: null, deadClicks: null, scrollPromedio: null, dias: 0, ok: false, error: null };

/**
 * El resumen de los últimos N días desde la Data Export API.
 *
 * ⚠️ NO LO LLAMES DESDE UNA PANTALLA. La cuota es de **10 requests por proyecto
 * por día** (documentación de Microsoft): tres personas abriendo la tab dos veces
 * cada una la agotan antes del mediodía, y a partir de ahí la pantalla queda en
 * blanco sin que nada explique por qué. Lo consulta el cron y lo cachea.
 *
 * `dias` solo puede ser 1, 2 o 3: la API rechaza cualquier otra cosa.
 */
export async function resumenClarity(dias: 1 | 2 | 3 = 3, ws?: number): Promise<ResumenClarity> {
  const t = await token(ws);
  if (!t) return { ...VACIO, error: 'Sin token de Clarity' };
  try {
    const r = await fetch(`${API}?numOfDays=${dias}`, {
      headers: { Authorization: `Bearer ${t}` },
      cache: 'no-store',
    });
    if (!r.ok) {
      // El 402 es el de la cuota agotada, y merece un mensaje propio: «falló» a
      // secas manda a revisar el token, que es justo lo que no está mal.
      const porQue = r.status === 402
        ? 'Se agotaron las 10 consultas diarias que permite Clarity. Vuelve mañana.'
        : r.status === 401 ? 'El token de Clarity no es válido o venció.'
        : `Clarity respondió ${r.status}.`;
      return { ...VACIO, error: porQue };
    }
    const filas = (await r.json()) as Array<{ metricName?: string; information?: Array<Record<string, unknown>> }>;
    const num = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const metrica = (nombre: string, campo: string): number | null => {
      const f = filas.find((x) => x.metricName === nombre);
      return f?.information?.[0] ? num(f.information[0][campo]) : null;
    };
    return {
      sesiones: metrica('Traffic', 'totalSessionCount'),
      bots: metrica('Traffic', 'totalBotSessionCount'),
      rageClicks: metrica('RageClickCount', 'sessionsWithMetricPercentage'),
      deadClicks: metrica('DeadClickCount', 'sessionsWithMetricPercentage'),
      scrollPromedio: metrica('ScrollDepth', 'averageScrollDepth'),
      dias, ok: true, error: null,
    };
  } catch (e) {
    return { ...VACIO, error: e instanceof Error ? e.message : 'No se pudo consultar Clarity' };
  }
}

/**
 * El bloque de Clarity que se INYECTA en el snippet del Pixel.
 *
 * Va dentro del mismo `<script>` y no como una etiqueta aparte, por la razón que
 * gobierna todo este producto: el cliente pega UNA cosa. Pedirle que pegue un
 * segundo script es garantizar que la mitad no lo haga y que después nadie sepa
 * cuál de los dos falta.
 *
 * Devuelve '' si el workspace no conectó Clarity — y eso es importante: el Pixel
 * tiene que seguir funcionando igual sin él. Clarity es opcional; la medición
 * propia no.
 */
export function bloqueClarity(projectId: string | null): string {
  if (!projectId) return '';
  const pid = projectId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
  if (!pid) return '';
  return `
  // ── Microsoft Clarity (opcional, con la cuenta del cliente) ───────────────
  // Se carga después del Pixel y NUNCA lo bloquea: si Clarity está caído o el id
  // es inválido, la medición propia sigue andando igual.
  try {
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "${pid}");
    // ⚠️ ESTO ES LO QUE ATA LA GRABACIÓN AL LEAD. Sin el identify, el panel de
    // Clarity muestra miles de sesiones anónimas y no hay forma de encontrar la
    // de una persona. Con él, la ficha del lead puede linkear directo a la suya.
    window.clarity("identify", visitorId);
    // Etiquetas para poder segmentar en Clarity sin salir de su panel.
    window.clarity("set", "mko_pixel", String(SV));
    if (prueba) window.clarity("set", "mko_prueba", prueba);
  } catch (e) {}
`;
}
