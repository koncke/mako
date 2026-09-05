// =============================================================================
// Qué sabe el navegador sobre el puente — el dato que hoy no existía
// =============================================================================
// EL PROBLEMA QUE RESUELVE: el 05/09/2026 diagnosticar por qué el puente no
// aprendía costó TRES rondas con el dueño y una auditoría de 191 agentes, sobre
// algo que un solo dato del servidor habría contestado en un minuto.
//
// La causa era estructural: todo lo que el navegador contaba de sí mismo —las
// clases que vio, el espía, el `detalle`— viajaba adentro de un
// `if (estado === 'listo')` que en el Flow nuevo es falso SIEMPRE. Así que del
// lado del servidor no llegaba **nada** con lo que diagnosticar, y no había forma
// de distinguir «el puente no aprendió» de «el puente no pudo contarme nada».
//
// Se razonó a ciegas sobre el navegador de otra persona durante tres rondas.
//
// ⚠️ ESTE PAYLOAD NO LLEVA CUERPOS NI CREDENCIALES, y el saneo es un allowlist
// POSITIVO campo por campo. La razón: acá viaja lo que el navegador vio de una
// sesión autenticada de Google. Un cuerpo de BOQ trae el `at` (el token anti-CSRF)
// y puede traer el token de reCAPTCHA; una url trae el `source-path` con el
// projectId. Nada de eso hace falta para contestar «¿qué sabe hacer este puente y
// desde cuándo?», que es la única pregunta que este dato existe para responder.
//
// SIN `server-only`: lo importa el saneo de una ruta pública y lo importan los tests.

/** Dónde vive, por workspace. */
export const KEY_DIAGNOSTICO = 'flow.diagnostico';

export type Diagnostico = {
  /** Cuándo lo armó el navegador (ms epoch). */
  cuando: number;
  /** La versión del manifest de la extensión instalada. */
  manifest: string;
  /**
   * La versión del espejo que está corriendo EN LA PESTAÑA.
   *
   * ⚠️ Puede ser MÁS VIEJA que el manifest, y ése es justo el dato que faltaba.
   * `injected.js` corre en el mundo de la página y se marca con
   * `window.__makoEspejo`: esa marca sobrevive a que la extensión se actualice y
   * sólo muere con un F5. Una pestaña abierta desde ayer sigue corriendo el espejo
   * viejo, y todo campo nuevo que ese archivo aprenda a mandar no llega nunca.
   *
   * Eso costó un día entero: un arreglo correcto, desplegado, que no se ejecutaba.
   */
  espejo: string;
  /** En qué dominio está la pestaña de Flow: `flow.google.com` o `labs.google`. */
  dominio: string;
  /** Si la pestaña está adentro de un proyecto. */
  enProyecto: boolean;
  /** Las clases de pedido que el navegador tiene guardadas. Sin urls ni cuerpos. */
  clases: string[];
  /** Las operaciones que ya sabe hacer. */
  ops: string[];
  /** Las que todavía no. */
  faltan: string[];
  /** Qué contestó el último latido (`listo`, `sin_sesion`, `sin_token`…). */
  estado: string;
};

/** Un string acotado, o ''. */
function txt(v: unknown, tope: number): string {
  return typeof v === 'string' ? v.slice(0, tope) : '';
}

/** Una lista de strings cortos, acotada y sin vacíos. */
function lista(v: unknown, tope: number, cuantos: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => txt(x, tope)).filter(Boolean).slice(0, cuantos);
}

/**
 * Deja un diagnóstico listo para guardar, o `null`.
 *
 * ⚠️ ALLOWLIST POSITIVO: se nombra campo por campo lo que se guarda. Lo que llegue
 * de más —un cuerpo, una url, un token que una extensión futura decida sumar— se
 * cae por no estar nombrado, y no por estar en una lista de prohibidos que se
 * queda vieja sola.
 */
export function sanearDiagnostico(crudo: unknown): Diagnostico | null {
  if (!crudo || typeof crudo !== 'object' || Array.isArray(crudo)) return null;
  const d = crudo as Record<string, unknown>;

  const cuando = Number(d.cuando) || 0;
  const manifest = txt(d.manifest, 20);
  // Sin al menos la versión no hay diagnóstico: sería una fila vacía que se lee
  // como «el navegador contestó» cuando no contestó nada.
  if (!manifest) return null;

  return {
    cuando,
    manifest,
    espejo: txt(d.espejo, 20),
    // ⚠️ Sólo el HOST, nunca la url: ahí viaja el `source-path` con el projectId.
    dominio: txt(d.dominio, 60).replace(/[^a-z0-9.-]/gi, ''),
    enProyecto: d.enProyecto === true,
    clases: lista(d.clases, 40, 40),
    ops: lista(d.ops, 40, 20),
    faltan: lista(d.faltan, 40, 20),
    estado: txt(d.estado, 40),
  };
}

/**
 * Una línea legible de lo que pasa con el puente, para una pantalla.
 *
 * Se deriva del diagnóstico y no se guarda: si se guardara, sería un segundo lugar
 * donde vive el mismo dato y se quedaría viejo.
 */
export function resumenDiagnostico(d: Diagnostico | null): string {
  if (!d) return 'El navegador todavía no reportó nada.';
  const partes: string[] = [];
  partes.push(`${d.ops.length} operaciones aprendidas`);
  if (d.faltan.length) partes.push(`faltan ${d.faltan.length}`);
  // ⚠️ El desfase del espejo se NOMBRA, porque es invisible de cualquier otra forma
  // y es la causa más cara que tuvo este puente.
  if (d.espejo && d.manifest && d.espejo !== d.manifest) {
    partes.push(`la pestaña corre el espejo ${d.espejo} con la extensión en ${d.manifest} (hace falta F5)`);
  }
  if (d.dominio) partes.push(d.dominio);
  return partes.join(' · ');
}
