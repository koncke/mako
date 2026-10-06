// =============================================================================
// Las líneas de WhatsApp (no oficial) de un negocio: de quién es cada una y cuál manda
// =============================================================================
// Pedido de Martín (06/10/2026): «haz que los usuarios puedan escanear varios QR, tener
// varios WhatsApp… un desplegable que cambiaría el chat. Y dentro del chatbot una opción
// para seleccionar de qué número sale esa automatización».
//
// Hasta acá el nombre de la instancia SE DERIVABA del workspace (`mako_ws<id>`), así que
// «qué línea» y «qué negocio» eran la misma pregunta. Con varias líneas son dos, y la que
// cuesta cara es la segunda: mandar por una línea que no es del negocio es mandar desde el
// WhatsApp de OTRO cliente — exactamente el cruce que el 06/10 se cerró en los avisos.
//
// ⚠️ POR ESO LA ELECCIÓN ES DE ESTE MÓDULO Y DE NINGÚN OTRO, y cada camino que manda pasa
// por `elegirLinea`. Las reglas, en positivo:
//  · Una línea PEDIDA se usa sólo si está en la lista del negocio (la lista sale de una
//    lectura con el scope del workspace) Y su nombre es de ese workspace. Si no, NO se
//    manda: no hay «la de por default» de respaldo, porque elegir otra línea que la que se
//    pidió es mandar desde el número equivocado sin que nadie lo vea.
//  · Sin pedido, sale la de por default; con varias marcadas (la base lo impide con un
//    índice parcial, mig 0198) gana la de id más bajo, que es estable.
//  · Sin ninguna fila, el nombre de siempre (`mako_ws<id>`): es lo que hace que conectar la
//    PRIMERA línea y cada camino viejo sigan igual.
//
// SIN `server-only` a propósito: lo importan lib/evolution.ts (server), la pantalla (el
// rótulo de cada línea) y el test que lo ejecuta.

/** El nombre de la primera línea de un workspace. Era `instanceNameDeWs` en lib/evolution.ts. */
export function instanceNameDeWs(ws: number): string {
  return `mako_ws${ws}`;
}

const NOMBRE = /^mako_ws(\d+)(?:_([a-z0-9]+))?$/;

/**
 * ¿Este nombre de instancia es de ESTE workspace? `mako_ws13` y `mako_ws13_2` sí;
 * `mako_ws1_3` no es del 13 (es la tercera del 1) y `mako_ws13x` no es de nadie.
 */
export function esLineaDelWorkspace(nombre: string | null | undefined, ws: number): boolean {
  const m = NOMBRE.exec(String(nombre ?? ''));
  return !!m && Number(m[1]) === ws;
}

/**
 * El nombre para una línea NUEVA. La primera del negocio es la de siempre (`mako_ws<id>`); las
 * siguientes llevan un sufijo AL AZAR (`mako_ws<id>_k3x9qa`).
 *
 * ⚠️ NUNCA «el primer número libre». Era `_2`, `_3`… y la revisión del 06/10 lo tumbó: al
 * desvincular una línea se borra su FILA pero no su espejo (`wa_mensajes` conserva su
 * `instance_name`), así que la próxima «Agregar otro número» volvía a recibir `mako_ws13_2` y la
 * bandeja del número NUEVO mostraba —y contestaba— los chats del número VIEJO. Un nombre que
 * no se repite no hereda nada. Sin filas todavía no hay espejo de nadie, y la de siempre es
 * segura.
 */
export function nombreLineaNueva(
  ws: number,
  existentes: ReadonlyArray<string>,
  sufijo: () => string = () => Math.random().toString(36).slice(2, 8),
): string {
  const base = instanceNameDeWs(ws);
  if (!existentes.length) return base;
  const usados = new Set(existentes);
  for (let i = 0; i < 20; i += 1) {
    const s = sufijo().toLowerCase().replace(/[^a-z0-9]/g, '');
    const nombre = `${base}_${s}`;
    if (s && !usados.has(nombre)) return nombre;
  }
  throw new Error('No pude elegir un nombre libre para la línea nueva.');
}

export type LineaMin = {
  id?: number;
  instance_name: string;
  es_default?: boolean | null;
  etiqueta?: string | null;
  numero?: string | null;
};

/** La línea por la que sale lo que no nombra ninguna. */
export function lineaPorDefault<T extends LineaMin>(lineas: ReadonlyArray<T>): T | null {
  if (!lineas.length) return null;
  const porId = [...lineas].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  return porId.find((l) => l.es_default) ?? porId[0];
}

export type Eleccion = { ok: true; instance: string } | { ok: false; motivo: string };

/**
 * Por qué línea sale un mensaje. `lineas` son las del workspace (leídas con su scope);
 * `pedida` es la que nombró quien manda (la secuencia, la bandeja, un borrador), o nada.
 */
export function elegirLinea(lineas: ReadonlyArray<LineaMin>, pedida: string | null | undefined, ws: number): Eleccion {
  const p = (pedida ?? '').trim();
  if (p) {
    if (!esLineaDelWorkspace(p, ws)) return { ok: false, motivo: 'Esa línea de WhatsApp no es de este negocio.' };
    if (lineas.some((l) => l.instance_name === p)) return { ok: true, instance: p };
    // Sin ninguna fila todavía, la única línea posible es la de siempre: pedirla por su
    // nombre es lo mismo que no pedir nada.
    if (!lineas.length && p === instanceNameDeWs(ws)) return { ok: true, instance: p };
    return { ok: false, motivo: 'La línea de WhatsApp elegida ya no está vinculada.' };
  }
  const d = lineaPorDefault(lineas);
  if (!d) return { ok: true, instance: instanceNameDeWs(ws) };
  // Defensa en profundidad: una fila del workspace con un nombre ajeno no se usa nunca.
  if (!esLineaDelWorkspace(d.instance_name, ws)) return { ok: false, motivo: 'La línea de WhatsApp de este negocio está mal registrada.' };
  return { ok: true, instance: d.instance_name };
}

/** Los dígitos de un número, con el + adelante. Sin formato por país: no sabemos de dónde es. */
function numeroLegible(n: string | null | undefined): string | null {
  const d = String(n ?? '').replace(/\D/g, '');
  return d ? `+${d}` : null;
}

/**
 * Cómo se llama una línea en pantalla: el nombre que le puso la persona, si no el número,
 * si no «Línea N». Nunca el `instance_name` (`mako_ws13_2`), que es un nombre NUESTRO.
 */
export function rotuloLinea(l: LineaMin, posicion: number): string {
  return (l.etiqueta ?? '').trim() || numeroLegible(l.numero) || `Línea ${posicion + 1}`;
}

/** La etiqueta que se guarda: recortada, sin saltos, y vacía = sin etiqueta. */
export function sanearEtiqueta(v: unknown): string | null {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
  return s || null;
}
