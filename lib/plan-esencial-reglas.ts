// =============================================================================
// plan-esencial-reglas — las tabs SÓLO de MaKo Pro y quién es «Esencial por la pasarela» (23/10/2026)
// =============================================================================
// Las ofertas del 23/10 (docs/ofertas-mako.md, lib/topes-plan.ts → TABS_SOLO_PRO): el Esencial ve esas tabs con un candado y
// «Pasar a Pro» (la barra, el teléfono y la pantalla de la tab: lib/tab-access.ts → requireCapa). Lo demás del Esencial son
// TOPES, no tabs escondidas.
//
// ⚠️ SÓLO A QUIEN MaKo LE COBRA EL ESENCIAL POR LA PASARELA. Lo que decide es el PLAN QUE SE VENDIÓ (`alta_capa` del cobro de
//    su suscripción, lib/cobros.ts → suscripcionDeMakoDe), no la capa del workspace: el ws1, los acuerdos a mano y todo
//    negocio de antes también tienen capa `completo` y no pagan un Esencial. Y la capa tiene que seguir siendo `completo`: un
//    negocio que Martín pasó a mano a otra capa no pierde nada por una suscripción vieja.
// ⚠️ NUNCA SACA UNA TAB A QUIEN PAGA PRO, sea cual sea el orden en que se despliegue la rama de los planes: un Pro se vende con
//    `alta_capa = 'agencia'`, y la suscripción más reciente pagada es la que vale (un upgrade gana).
// ⚠️ PURO: lo leen el servidor, la barra (vía /api/auth/me) y los tests.

/** Las claves de la barra (app/_components/nav.ts) de las tabs de Pro. AI Avatar salió el 29/10/2026: es de los tres planes. */
// 25/10/2026: el Media Buyer (/ads-manager) ya NO es sólo de Pro: Esencial lo tiene en «propone», 2 recomendaciones por día y sin
// piloto automático (decisión del Cerebro con la investigación de venta; memoria decisiones-venta-25-10). El cupo lo cumple lib/media-buyer.
export const NAV_SOLO_PRO: ReadonlySet<string> = new Set([
  'image-editor', 'video-editor',
]);
/**
 * Las de `TABS_SOLO_PRO` que NO son una tab de la barra: Closing Analyst es desde el 11/10 la hoja «Closing» del Dashboard
 * (app/closing/page.tsx), y su candado va en el Dashboard (de su chat), no acá.
 */
export const SOLO_PRO_FUERA_DE_LA_BARRA: ReadonlySet<string> = new Set(['closing-analyst']);

export const esNavSoloPro = (key: string | null | undefined): boolean => !!key && NAV_SOLO_PRO.has(key);

// =============================================================================
// LAS CUENTAS DE AGENCIA DE ANTES (29/10/2026, la verificación independiente de la rama de Thiago, hallazgo H1)
// =============================================================================
// Desde el 29/10 el plan de una cuenta de agencia ES su capa (Esencial = `completo`, Pro = `agencia`) y sus topes y candados
// corren. Pero las cuentas que ya existían se abrieron con la capa por defecto, `completo`, y usaban todo lo de Pro: al
// desplegar habrían quedado en Esencial de golpe (en producción, 6 de la agencia ws13). Lo decide Martín; mientras tanto,
// SIGUEN COMO PRO hasta que su agencia les elija el plan («Elegir Esencial» / «Elegir Pro» en su ficha). Una cuenta tiene
// el plan ELEGIDO si tiene la marca `agency.plan_cambiado` (la escriben abrir la cuenta y cambiar el plan).
// ⚠️ SI MARTÍN DICE QUE PASEN A ESENCIAL: es esta línea, `false`. Sin migración: la marca no cambia nada más.
export const CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO = true;

/** La marca del plan elegido de una cuenta de agencia (en la cuenta del CLIENTE): {at, plan, pendiente}. */
export const KEY_PLAN_CAMBIADO = 'agency.plan_cambiado';

/** ¿Corren el plan, los topes y los candados de una cuenta de agencia? Con el plan elegido, sí; sin elegir, según la línea de arriba. */
export const rigeElPlanDeAgencia = (elegido: boolean): boolean => elegido || !CUENTAS_DE_AGENCIA_SIN_ELEGIR_SON_PRO;

/** Los que nunca tienen el candado: el ws1 (de Mauricio, acuerdo a mano) y la plataforma (el ws de MaKo). */
export const WS_SIN_PLAN_DE_PASARELA: ReadonlySet<number> = new Set([1]);

export function esEsencialPorPasarela(e: {
  ws: number | null;
  /** El workspace de la plataforma (wsSuperAdmin: el ws9). */
  wsPlataforma: number | null;
  /** La capa que tiene HOY el workspace. */
  capa: string | null;
  /** `alta_capa` de su suscripción de MaKo pagada más reciente (null = no paga por la pasarela). */
  capaVendida: string | null;
}): boolean {
  if (e.ws == null || WS_SIN_PLAN_DE_PASARELA.has(e.ws) || e.ws === e.wsPlataforma) return false;
  return e.capaVendida === 'completo' && e.capa === 'completo';
}

export const ROTULO_PASAR_A_PRO = 'Pasar a Pro';
// Adónde lleva «Pasar a Pro»: la ruta de UN lugar, `RUTA_CAMBIAR_PLAN` (lib/topes-plan.ts), no una propia.

/**
 * LO QUE VE EL CLIENTE DE UNA AGENCIA DONDE IRÍA «Pasar a Pro» (6/11/2026, #494; Thiago el 29/10: «yo no me meto con ese
 * cliente»). Su plan lo paga y lo cambia su agencia: el link le vendía un SEGUNDO plan del mismo negocio. Va sin link, a
 * propósito — no hay nada que toque él—, y el texto del tope de al lado no cambia: llegar al tope es verdad para él igual.
 * Lo pone `CtaPasarAPro` (app/_components/CtaPasarAPro.tsx), el único lugar que decide esto en los carteles.
 * El mismo tono que «Tu plan» ya usa para él (app/configuraciones/plan/PlanPanel.tsx: «Lo maneja tu agencia»).
 */
export const TEXTO_PEDIR_PRO_A_LA_AGENCIA = 'Pídele a tu agencia que te pase a Pro.';

/**
 * Lo que tiene que leer QUIEN DA DE ALTA A MANO (24/10/2026, el Cerebro: «dejalo donde lo lea quien da de alta a mano»). El
 * candado de las tabs de Pro (arriba) y los topes del plan (lib/topes-plan.ts) se hacen cumplir SÓLO a quien MaKo le cobra
 * por la pasarela. Sin pasarela, las primeras ventas del lanzamiento son por llamada y se dan de alta a mano: ese negocio
 * recibe MÁS de lo que dice la tabla de /planes (sin topes y con las tabs de Pro), nunca menos. Lo muestra el alta del super
 * admin (app/admin/AdminView.tsx, «Nuevo cliente») para Esencial y Pro, las capas con topes.
 */
export function avisoAltaAMano(capa: string): string | null {
  return capa === 'completo' || capa === 'agencia'
    ? 'Dado de alta a mano no tiene los topes de su plan (ni el candado de las tabs de Pro): se aplican sólo a quien paga en línea.'
    : null;
}
