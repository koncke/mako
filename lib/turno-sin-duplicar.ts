// =============================================================================
// Un turno del doer no repite una acción cuando rota de proveedor.
//
// El doer de WhatsApp (lib/mako-doer-in.ts) vuelve a correr el turno ENTERO —desde
// el mensaje original, con las mismas herramientas— cuando un proveedor falla o su
// respuesta se descarta: la siguiente cuenta del cliente, el reintento con la
// herramienta forzada, la red de plataforma, el escalado a Claude. Para una lectura
// eso sólo cuesta; para una ACCIÓN es repetirla: una segunda pendiente igual («Hay 2
// acciones pendientes, aclara cuál», y si se confirman las dos, dos invitaciones), un
// segundo borrador del plan, un «sí» que se vuelve a ejecutar. `chatCheapToolsCascade`
// (lib/ai-cheap.ts) ya tenía su guarda; los cinco caminos del doer, no.
//
// Lo que hace esto: una acción que ya corrió en un intento ANTERIOR del mismo turno no
// vuelve a correr; el intento nuevo recibe el resultado que dejó la primera vez (la
// pendiente, el link) y sigue desde ahí. Dentro de UN intento se puede llamar varias
// veces —mover dos leads distintos es legítimo—, así que se cuenta por orden: la
// segunda llamada del intento nuevo recibe la segunda del anterior.
//
// No se corta la rotación: cortarla dejaría sin respuesta a la persona cuando el
// primer proveedor se cae después de proponer, y la rotación es lo que mantiene a
// MaKo andando con una sola key (af3530c2).
//
// Y `pendienteRepetida` es la red de los datos: la misma pendiente (grupo, tipo y
// contenido) no se guarda dos veces en un mismo turno, venga de donde venga.
//
// SIN `server-only`: lo importan el doer, lib/mako-pendientes.ts y el test.
// =============================================================================

/** Lo que devuelve un runner de herramientas: texto, o texto con `isError`. */
type Salida = unknown;

/** Una salida que dice que NO hizo nada (un error, un `ok:false`) no se guarda: el
 *  intento siguiente puede intentarlo de verdad. */
function hizoAlgo(out: Salida): boolean {
  if (out && typeof out === 'object' && (out as { isError?: unknown }).isError) return false;
  if (typeof out !== 'string') return true;
  try {
    const j = JSON.parse(out) as { ok?: unknown };
    return !(j && typeof j === 'object' && j.ok === false);
  } catch { return true; }
}

export type MemoDeAcciones = {
  /** Lo llama el doer ANTES de cada corrida del turno (cada proveedor, cada reintento). */
  nuevoIntento(): void;
  /** El resultado de esta acción en un intento ANTERIOR, si lo hubo. Cuenta la llamada. */
  previo(nombre: string): { out: Salida } | null;
  /** Guarda lo que hizo una acción que sí corrió. */
  anotar(nombre: string, out: Salida): void;
};

/**
 * El k-ésimo llamado a una acción en un intento recibe lo que dejó el k-ésimo que corrió
 * en el turno. Dentro del MISMO intento eso nunca está todavía —la k-ésima llamada
 * consulta antes de anotar—, así que ahí corre siempre; lo que ataja es el intento
 * siguiente. Sólo se anotan acciones que hicieron algo (`esAccion` y `hizoAlgo`): una
 * lectura nunca se guarda, así que consultarla nunca devuelve nada.
 */
export function crearMemoDeAcciones(esAccion: (nombre: string) => boolean): MemoDeAcciones {
  let usos = new Map<string, number>();
  const hechos = new Map<string, Salida[]>();
  return {
    nuevoIntento() { usos = new Map(); },
    previo(nombre) {
      const k = usos.get(nombre) ?? 0;
      usos.set(nombre, k + 1);
      const h = hechos.get(nombre);
      return h && k < h.length ? { out: h[k] } : null;
    },
    anotar(nombre, out) {
      if (!esAccion(nombre) || !hizoAlgo(out)) return;
      hechos.set(nombre, [...(hechos.get(nombre) ?? []), out]);
    },
  };
}

/** El JSON de un valor con las claves ordenadas: dos payloads iguales dan lo mismo
 *  aunque se hayan armado en otro orden. */
export function firma(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(firma).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as Record<string, unknown>).sort().map((k) => `${JSON.stringify(k)}:${firma((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** El margen de reloj entre la app y la base: el mismo que usa el candado contra el
 *  auto-confirm (lib/api-mako/acciones.ts). */
export const MARGEN_RELOJ_MS = 1500;

/**
 * Si entre las pendientes vigentes del grupo y el tipo hay una IGUAL creada en este
 * turno (desde `desde`), su id; si no, null. Sólo en el turno: dos pedidos iguales en
 * mensajes distintos son dos decisiones, y reusar una vieja le saltearía el candado
 * de «no se confirma en el mismo turno en que se propuso».
 */
export function pendienteRepetida(
  filas: ReadonlyArray<{ id: number; payload: unknown; created_at: string }>,
  payload: Record<string, unknown>,
  desde: number,
): number | null {
  const buscada = firma(payload);
  const iguales = filas
    .filter((f) => Date.parse(f.created_at) >= desde - MARGEN_RELOJ_MS && firma(f.payload ?? {}) === buscada)
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return iguales[0]?.id ?? null;
}
