// =============================================================================
// /integraciones — estado de todas las integraciones (antes "Estado de Meta")
// =============================================================================
// Overview de conexión de cada servicio + el detalle en vivo de Meta + el
// historial de estados negativos + el Saldo de IA.

import { getMetaHealth, type MetaHealth } from '@/lib/meta-health';
import { getIntegraciones } from '@/lib/integraciones';
import { reconciliarIncidentes, problemaMeta, getIncidentes, type ProblemaActual, type Incidente } from '@/lib/meta-health-history';
import { integracionConectada } from '@/lib/credenciales';
import { getOrCreateLandingToken, landingSnippet } from '@/lib/landing-token';
import { lineaCargador } from '@/lib/pixel-cargador';
import { estadoPixel } from '@/lib/pixel-estado';
import { tokenAgenteVisible } from '@/lib/agente-token';
import { getWorkspaceActual } from '@/lib/workspace';
import { cuotasProveedores } from '@/lib/ia-cuotas';
import { landingsDelWorkspace } from '@/lib/landing-config-leer';
import { productosAsignables } from '@/lib/landing-funnel';
import { rechazosDeGracias } from '@/lib/landing-gracias';
import { IntegracionesBoard } from './IntegracionesBoard';
import { requireRolWs } from '@/lib/tab-access';
import { APP_BASE_URL as APP_URL } from '@/lib/app-url';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
// ⚠️ 300 y no el default: guardar una página nueva en el Pixel la analiza POR
// DETRÁS con `after()`, y el `after()` de una server action vive dentro del
// maxDuration de la PÁGINA que la llama (docs/hallazgos-infra.md). Con el
// default, el análisis de Landing Analyst moría a mitad de camino.
export const maxDuration = 300;

export default async function IntegracionesPage() {
  await requireRolWs([], { nav: 'integraciones' });
  const integraciones = await getIntegraciones();
  let health: MetaHealth | null = null;
  let metaError: string | null = null;
  try {
    // No pegarle a Meta en vivo si el workspace no tiene Meta conectado: para un
    // cliente sin Meta tiraría "META_ACCESS_TOKEN no definida" y para un admin sin
    // impersonar mostraría el Meta del dueño. health=null → estado "sin conexión".
    const metaConectado = await integracionConectada('meta');
    health = metaConectado ? await getMetaHealth() : null;
  } catch (err) {
    metaError = err instanceof Error ? err.message : String(err);
  }

  // Reconciliar los incidentes (con inicio/fin) contra el estado actual. Un
  // incidente es un PROBLEMA REAL (hoy: la salud de Meta — rojo/ámbar/frenada o
  // error de lectura). Un servicio "por configurar" (falta) NO es un incidente:
  // eso vive en "Requiere tu atención", no en el historial de problemas.
  // El scope cubre todos los servicios para CERRAR los que ya no tienen problema.
  const problemas: ProblemaActual[] = [];
  const pMeta = problemaMeta(health?.account ?? null, metaError);
  if (pMeta) problemas.push(pMeta);
  const scope = ['meta', ...integraciones.map((i) => i.key)];
  await reconciliarIncidentes(problemas, scope);
  const incidentes: Incidente[] = await getIncidentes(30);

  // Código copiable de la landing. El token NO es secreto (va en el HTML de una
  // página pública, como cualquier pixel): solo identifica al workspace, así que
  // se resuelve acá y baja como prop. Idempotente: se genera la primera vez.
  // Sin workspace (admin de agencia sin impersonar) no hay landing que medir.
  const ws = await getWorkspaceActual();
  const tokenLanding = ws == null ? null : await getOrCreateLandingToken(ws);
  const snippetLanding = tokenLanding == null ? null : landingSnippet(tokenLanding);
  // La línea del cargador (09/10/2026): lo PRIMERO que se ofrece. Sirve siempre el Pixel
  // del día, así que quien la pega no vuelve a pegar nada (lib/pixel-cargador.ts).
  const cargadorLanding = tokenLanding == null ? null : lineaCargador(tokenLanding, APP_URL);

  // ¿El código pegado en su página se quedó atrás? El dato ya existía (lo anota el
  // beacon) pero solo lo leía el cron: el aviso salía por WhatsApp y la pantalla
  // seguía diciendo «Conectada», que es la mitad que la persona mira. Un semáforo
  // que no puede expresar «anda, pero hay algo que hacer» obliga a que el aviso
  // sea el único canal, y un aviso se archiva.
  //
  // ⚠️ Y ES EL MISMO VEREDICTO QUE EL AVISO FIJO DE LA ESQUINA (`estadoPixel`). Con dos
  // lecturas distintas, la pastilla decía «Actualiza el Pixel» y el modal al que lleva
  // decía otra cosa — o al revés, que es peor.
  const landingVieja = ws == null ? false : (await estadoPixel().catch(() => ({ viejo: false }))).viejo;

  // Cuota GRATIS consumida hoy por cada IA barata (para el gauge "cuánto queda"
  // de cada proveedor y para el aviso proactivo de rotación). Nunca rompe la página.
  const cuotas = await cuotasProveedores().catch(() => []);

  // Token del agente externo (Claude Code). Se LEE, no se acuña: es una credencial
  // real (da lectura del plan del workspace), así que solo nace cuando el humano
  // aprieta el botón. null = todavía no generó ninguno. Baja SÓLO la pista y el alcance:
  // desde el 09/10/2026 el token no está guardado (se muestra una vez, al acuñarlo).
  const agenteActual = ws == null ? null : await tokenAgenteVisible(ws).catch(() => null);

  // ── LO QUE EL PIXEL NECESITA PARA PINTARSE, EN EL PRIMER FRAME ─────────────
  // Las páginas del workspace (paso 1) y los productos que se les pueden asignar
  // (paso 2). Antes los pedían los dos pasos con server actions al montarse, y
  // como Next las despacha DE A UNA eran tres viajes en serie antes de la primera
  // casilla — medido el 06/10/2026, 11 a 13 idas y vueltas a la base para traer dos
  // filas. El dueño lo vio: «tardó mucho en encontrar mis productos».
  //
  // Van en PARALELO entre sí: acá sí son dos promesas de verdad, no dos actions.
  //
  // ⚠️ `null` NO ES `[]`. Un workspace siempre tiene su embudo del negocio (índice
  // único en `funnels`), así que una lista de productos VACÍA es una lectura que
  // falló —`productosAsignables` se traga el error y devuelve `[]`—, y dibujar
  // sobre eso «no tenés productos» sería afirmar algo falso con la pantalla. Se
  // baja `null` y el paso dice que no pudo leer.
  // Y las visitas a una página de GRACIAS que no se pudieron unir a un lead: sin esto, «no pasa
  // nada» y «llega gente que nunca dejó sus datos» se ven igual (lib/landing-gracias.ts).
  const [landingsPixel, productosPixel, graciasPixel] = ws == null ? [null, null, null] : await Promise.all([
    landingsDelWorkspace().catch(() => null),
    productosAsignables().then((l) => (l.length ? l : null)).catch(() => null),
    rechazosDeGracias(),
  ]);

  return (
    <IntegracionesBoard
      integraciones={integraciones}
      health={health}
      metaError={metaError}
      incidentes={incidentes}
      snippetLanding={snippetLanding}
      cargadorLanding={cargadorLanding}
      landingVieja={landingVieja}
      cuotas={cuotas}
      agenteActual={agenteActual}
      appUrl={APP_URL}
      pixel={{ landings: landingsPixel, productos: productosPixel, gracias: graciasPixel }}
    />
  );
}
