// =============================================================================
// recorrido-automations — el recorrido guiado de la tab Automations (décima tanda, GENERAL 8)
// =============================================================================
// Pedido de Martín (11/10/2026), textual: «Haz el tutorial de como utilizar esta tab de "Automations"
// tal como lo tenemos en el tutorial de "CURSO", que sea como un recorrido.»
//
// EL MISMO MECANISMO QUE CURSO (app/customer-success/curso/recorridos-curso.ts): los pasos son DATOS
// PUROS, los monta app/_ui/Recorrido.tsx (`useRecorrido` + `<Recorrido>` + el «?» de `BotonRecorrido`),
// se abre SOLO la primera vez (por persona, `/api/recorridos`) y se vuelve a ver con el «?». Un paso
// cuyo objetivo no está EN PANTALLA se saltea solo (lib/recorridos.ts): se escribe UNA vez para la
// pantalla llena y se adapta a la que hay (sin CONDITION en el flujo, no hay paso de CONDITION; sin
// automatizaciones, sólo «＋ Nueva», Configuraciones y el «?»).
//
// LA DIFERENCIA CON CURSO ES QUIÉN PONE EL `data-recorrido`. Allá cada control lo trae escrito. Acá los
// controles viven en archivos que en esta tanda tocan otras pistas (la lista, el lienzo, el CRON,
// Probar, Publicar), así que los pone `marcar` (abajo) MIENTRAS EL RECORRIDO ESTÁ ABIERTO, buscándolos
// por lo que esas pantallas YA dibujan: un `data-*`, un `aria-label`, el título de una tarjeta. Lo monta
// ./RecorridoAutomations.tsx. Tres reglas:
//   · UN `data-recorrido` ESCRITO A MANO GANA: si una pantalla pone el suyo, `marcar` deja ese objetivo
//     quieto. Es el camino para mudar cada objetivo a su pantalla sin tocar este archivo.
//   · `marcar` nunca pisa el `data-recorrido` de otro, y al cerrar saca sólo los que puso él (`soltar`).
//   · Si nada lo encuentra, el paso se saltea y nada se rompe. Por eso tests/automations-recorrido.test.ts
//     comprueba que cada cosa que se busca exista en el FUENTE del archivo que la dibuja: un `data-*`
//     renombrado en otra pista acortaría el recorrido en silencio.
//
// ⚠️ TEXTOS CORTOS (una o dos frases) y de TÚ: es texto de pantalla (AGENTS.md). El porqué va acá.
// ⚠️ EL ID ES LA CLAVE DE «YA LO VIO», por persona: no se cambia. Los objetivos llevan `au-` adelante:
//    el «?» de CURSO es `ayuda`, y tests/curso-recorridos.test.ts exige que lo ponga sólo CursoApp.

import type { PasoRecorrido } from '@/lib/recorridos';
import { selectorDe } from '@/lib/recorridos';
import { ID_ENTRADA, TITULO } from '@/lib/flujo-conversacion';

export const RECORRIDO_AUTOMATIONS = 'automations';

/** El «?»: lo marca `BotonRecorrido` (su prop `objetivo`), no `marcar`. */
export const OBJETIVO_AYUDA = 'au-ayuda';

/**
 * Los pasos, en el orden en que se recorre la pantalla: la lista flotante de la izquierda (de arriba
 * abajo), el lienzo (el CRON, el ＋ y las tarjetas que haya), «Probar» arriba a la derecha, «Publicar» y
 * «Activar» abajo a la derecha, y el «?» al final: cómo volver a verla es lo que queda al cerrarla.
 */
export const PASOS_AUTOMATIONS: PasoRecorrido[] = [
  { objetivo: 'au-lista', titulo: 'Tus automatizaciones', texto: 'Elige una para abrir su lienzo.', lado: 'derecha' },
  // La galería (décima tanda, NUEVA AUTOMATIZACIÓN 3): la primera opción es siempre el lienzo en blanco.
  { objetivo: 'au-nueva', titulo: 'Nueva automatización', texto: 'Empieza en blanco o desde una plantilla.', lado: 'derecha' },
  // Desde el 11/10/2026 son automatizaciones con el CRON «Evento de MaKo» (docs/diseno-mako-en-whatsapp-
  // unificado.md): «se arman como las demás» es la regla de Martín (un mensaje de MaKo es IDÉNTICO).
  { objetivo: 'au-mako', titulo: 'MaKo en WhatsApp', texto: 'Los avisos de MaKo a tu grupo de WhatsApp. Se arman como las demás.', lado: 'derecha' },
  // GENERAL 4 (docs/diseno-automations-configuraciones.md): «Configuraciones» REEMPLAZÓ al botón del
  // horario, en el mismo lugar (app/automations/ConfiguracionesBoton.tsx, 11/10/2026).
  { objetivo: 'au-configuraciones', titulo: 'Configuraciones', texto: 'El horario de envío y los límites de mensajes.', lado: 'derecha' },
  { objetivo: 'au-cron', titulo: 'El CRON', texto: 'Lo que la dispara. Haz clic para elegirlo.' },
  // El círculo de cada salida (Lienzo.tsx: «Clic: agregar · Arrastrar: conectar»). Nombra CONDITION,
  // DELAY y AI Step porque sus pasos propios sólo aparecen si el flujo ya tiene esas tarjetas: en uno
  // en blanco, éste es el único que dice que existen.
  { objetivo: 'au-mas', titulo: 'Agrega con el ＋', texto: 'Mensajes, CONDITION, DELAY o un AI Step. Arrástralo para conectar.', lado: 'derecha' },
  { objetivo: 'au-condicion', titulo: 'CONDITION', texto: 'Elige el camino según el lead o lo que conteste.' },
  { objetivo: 'au-delay', titulo: 'DELAY', texto: 'Espera un tiempo antes de seguir.' },
  // AI Step v2 (docs/diseno-ai-step-v2.md): un caso por tarjeta, y lo primero es su OBJETIVO.
  { objetivo: 'au-ai-step', titulo: 'AI Step', texto: 'MaKo contesta cuando el lead escribe, con el objetivo que le des.' },
  { objetivo: 'au-probar', titulo: 'Probar', texto: 'Simúlala como el lead o envíate una prueba real.', lado: 'abajo' },
  // «Volver a lo publicado» se va en esta tanda (GENERAL 5: «para eso ya tenemos el CTRL Z»).
  { objetivo: 'au-publicar', titulo: 'Publicar', texto: 'Lo que cambies sale recién al publicar. Ctrl+Z deshace.', lado: 'arriba' },
  { objetivo: 'au-activar', titulo: 'Activar', texto: 'Prende o pausa sus envíos.', lado: 'arriba' },
  { objetivo: OBJETIVO_AYUDA, titulo: 'Vuelve a verla', texto: 'Esta guía está siempre en el ?.', lado: 'derecha' },
];

// ── Dónde está cada objetivo ─────────────────────────────────────────────────

/**
 * Una forma de encontrar un objetivo en la pantalla.
 *
 *   css    los candidatos, en el orden del DOM. Un selector que el navegador no entiende (`:has` en uno
 *          viejo) no rompe nada: ese renglón no encuentra.
 *   texto  si está, el candidato —o algo adentro— tiene que decir EXACTAMENTE esto (sin espacios de
 *          más). Es lo único que distingue una tarjeta de otra: todas son `[data-nodo]`.
 *   vive   dónde lo dibuja la pantalla. No lo usa `marcar`: lo lee el test, que comprueba que lo que se
 *          busca siga existiendo en esos archivos.
 *   futuro lo que todavía no existe en el fuente (el botón de Configuraciones, que arma otra pista): el
 *          test no lo exige, pero exige que el objetivo tenga además un renglón que SÍ existe.
 */
export type Buscar = { css: string; texto?: string; vive: readonly string[]; futuro?: true };

const LISTA = 'app/automations/SimuladorWhatsApp.tsx';
const TAB = 'app/automations/ChatAgentApp.tsx';
const LIENZO = 'app/_components/Lienzo.tsx';
const PERFIL = 'app/automations/SecuenciaPerfil.tsx';
const TITULOS = 'lib/flujo-conversacion.ts';
const CONFIG = 'app/automations/ConfiguracionesBoton.tsx';

/**
 * Para cada objetivo, sus formas de encontrarlo EN ORDEN: gana la primera que encuentre algo visible.
 * Las tarjetas del lienzo se reconocen por su título, que sale de `TITULO` (lib/flujo-conversacion.ts):
 * si se renombran allá, esto las sigue.
 */
export const DONDE: Readonly<Record<string, readonly Buscar[]>> = {
  'au-lista': [{ css: 'aside[aria-label="Tus automatizaciones"]', vive: [LISTA] }],
  'au-nueva': [
    { css: 'button.chb-nueva:not([data-nuevo-mensaje])', vive: [LISTA] },
    // Sin ninguna automatización la lista no se dibuja: el «＋ Nueva» del cartel vacío.
    { css: 'button', texto: '＋ Nueva', vive: [TAB] },
  ],
  'au-mako': [
    { css: 'button[data-nuevo-mensaje]', vive: [LISTA] },
    // Quien no es admin no tiene «＋ Nuevo mensaje»: el rótulo de la sección.
    { css: '[data-grupo-mensajes-mako]', vive: [LISTA] },
  ],
  'au-configuraciones': [
    { css: '[data-configuraciones]', vive: [CONFIG] },
    { css: 'button[title="Configuraciones"]', vive: [CONFIG] },
    { css: 'button', texto: 'Configuraciones', vive: [CONFIG] },
  ],
  'au-cron': [{ css: `[data-nodo="${ID_ENTRADA}"]`, vive: [LIENZO, 'lib/flujo-grafo.ts'] }],
  'au-mas': [
    // El ＋ del CRON primero (el que hay en un flujo en blanco); si no, el primero que haya.
    { css: `button[data-mas-puerto^="${ID_ENTRADA}:"]`, texto: '＋', vive: [LIENZO] },
    { css: 'button[data-mas-puerto]', texto: '＋', vive: [LIENZO] },
  ],
  'au-condicion': [{ css: '[data-nodo]', texto: TITULO.condicion, vive: [LIENZO, TITULOS] }],
  'au-delay': [
    // La píldora de una espera lleva su título en `title`; una espera EN una flecha es su pastilla.
    { css: `[data-nodo][title="${TITULO.esperar}"]`, vive: [LIENZO, TITULOS] },
    { css: 'button[data-pildora]', vive: [LIENZO] },
  ],
  'au-ai-step': [{ css: '[data-nodo]', texto: TITULO.paso_ia, vive: [LIENZO, TITULOS] }],
  'au-probar': [{ css: 'button[aria-label="Probar esta automatización"], button[title="Probar esta automatización"]', vive: [PERFIL] }],
  'au-publicar': [
    { css: 'button', texto: 'Publicar', vive: [PERFIL] },
    { css: 'button', texto: 'Publicando…', vive: [PERFIL] },
  ],
  'au-activar': [
    // La caja con el rótulo «Activar» y el interruptor; sin `:has`, el interruptor solo.
    { css: 'div:has(> button[aria-pressed][title="Activar"]), div:has(> button[aria-pressed][title="Pausar"])', vive: [PERFIL] },
    { css: 'button[aria-pressed][title="Activar"], button[aria-pressed][title="Pausar"]', vive: [PERFIL] },
  ],
};

// ── marcar: pone los `data-recorrido` sobre lo que la pantalla ya dibuja ─────

/** Lo mínimo que `marcar` le pide a un elemento: el DOM lo cumple, y el test lo finge sin un navegador. */
export interface ElementoMarcable {
  getAttribute(nombre: string): string | null;
  setAttribute(nombre: string, valor: string): void;
  removeAttribute(nombre: string): void;
  getClientRects(): { length: number };
  readonly textContent: string | null;
  querySelectorAll(css: string): ArrayLike<ElementoMarcable>;
}
export interface RaizMarcable {
  querySelectorAll(css: string): ArrayLike<ElementoMarcable>;
}

const ATRIBUTO = 'data-recorrido';

/** Visible = tiene cajas, el mismo criterio que el recorrido (`objetivoEnDom` en app/_ui/Recorrido.tsx). */
const visible = (el: ElementoMarcable) => el.getClientRects().length > 0;
const limpio = (s: string | null) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Un selector que el navegador no entiende contesta «nada», como `objetivoEnDom`. */
function todos(raiz: RaizMarcable | ElementoMarcable, css: string): ElementoMarcable[] {
  try { return Array.from(raiz.querySelectorAll(css)); } catch { return []; }
}

function diceExacto(el: ElementoMarcable, texto: string): boolean {
  return limpio(el.textContent) === texto || todos(el, '*').some((x) => limpio(x.textContent) === texto);
}

/**
 * Pone `data-recorrido` sobre el primer candidato visible de cada objetivo de `donde`, y lo saca de lo
 * que ya no corresponde. `puestas` es la memoria de lo que puso ÉL (entre una corrida y la siguiente):
 * todo lo demás que tenga un `data-recorrido` es ajeno y no se toca.
 *
 * Primero DECIDE con la foto entera y después escribe: decidiendo y escribiendo de a uno, un objetivo
 * que se muda dejaba su marca vieja tapando al siguiente hasta la próxima corrida.
 */
export function marcar(raiz: RaizMarcable, puestas: Map<string, ElementoMarcable>, donde: Readonly<Record<string, readonly Buscar[]>> = DONDE): void {
  const nuestros = new Set(puestas.values());
  const tomados = new Set<ElementoMarcable>();
  const elegidos = new Map<string, ElementoMarcable>();
  for (const [objetivo, formas] of Object.entries(donde)) {
    // Uno escrito a mano (y a la vista) gana: éste no se marca.
    if (todos(raiz, selectorDe(objetivo)).some((x) => !nuestros.has(x) && visible(x))) continue;
    let elegido: ElementoMarcable | null = null;
    for (const f of formas) {
      elegido = todos(raiz, f.css).find((x) => {
        if (tomados.has(x) || !visible(x)) return false;
        // El de OTRO objetivo escrito a mano no se pisa; uno nuestro se puede mudar.
        if (x.getAttribute(ATRIBUTO) && !nuestros.has(x)) return false;
        return f.texto == null || diceExacto(x, f.texto);
      }) ?? null;
      if (elegido) break;
    }
    if (elegido) { elegidos.set(objetivo, elegido); tomados.add(elegido); }
  }
  for (const [objetivo, el] of puestas) {
    if (elegidos.get(objetivo) === el) continue;
    if (!tomados.has(el) && el.getAttribute(ATRIBUTO) === objetivo) el.removeAttribute(ATRIBUTO);
    puestas.delete(objetivo);
  }
  for (const [objetivo, el] of elegidos) {
    if (el.getAttribute(ATRIBUTO) !== objetivo) el.setAttribute(ATRIBUTO, objetivo);
    puestas.set(objetivo, el);
  }
}

/** Al cerrar: saca lo que puso `marcar` (si nadie lo cambió en el medio) y olvida. */
export function soltar(puestas: Map<string, ElementoMarcable>): void {
  for (const [objetivo, el] of puestas) if (el.getAttribute(ATRIBUTO) === objetivo) el.removeAttribute(ATRIBUTO);
  puestas.clear();
}
