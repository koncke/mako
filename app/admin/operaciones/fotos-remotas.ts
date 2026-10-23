// =============================================================================
// Las fotos enviadas que están en el servidor, pedidas de a muchas (23/10/2026)
// =============================================================================
// Una foto mandada por la caja se ve ahora en cualquier dispositivo: su miniatura queda en el storage y la ruta del Ops
// Center da una URL firmada de 10 minutos (lib/operaciones-adjuntos.ts → «Las fotos enviadas»). Cada burbuja con fotos la
// pide; esto junta los pedidos que llegan en el mismo momento en UNA ida al servidor (una conversación abre con varias
// burbujas a la vez) y guarda lo que volvió mientras la URL sirve.
//
// ⚠️ SIN 'use client' y sin nada del navegador: el `traer` se inyecta, así lo prueba un test en node
//    (tests/centro-fotos-enviadas.test.ts). Lo usa fotos-enviadas.ts.
// ⚠️ LO INCOMPLETO SE GUARDA POCO (`vacioMs`): las miniaturas las sube el navegador que las mandó DESPUÉS de mandar, y de a
//    una, así que otro dispositivo que refrescó en ese segundo pregunta cuando subió 1 de 2 (o ninguna). Sólo lo que trae
//    TODAS las fotos que el trabajo dice tener se guarda mientras sirve la URL. Un fallo de red no se guarda nunca.

export type FotoRemota = { url: string; nombre: string };
/** Lo que contesta el servidor por cada trabajo pedido (null = no se pudo preguntar). */
export type TraerFotos = (ids: string[]) => Promise<Record<string, FotoRemota[]> | null>;

export type OpcionesPedidor = {
  /** Cuánto espera a que lleguen otros pedidos antes de ir al servidor. */
  esperaMs?: number;
  /** Cuánto sirve lo que volvió completo: menos que los 10 minutos de la URL firmada. */
  vigenciaMs?: number;
  /** Cuánto se cree un resultado incompleto (ver arriba). */
  vacioMs?: number;
  ahora?: () => number;
};

/** Los ids que entran en una ida al servidor (los mismos que acepta la ruta). */
export const POR_PEDIDO = 100;

export function crearPedidorDeFotos(traer: TraerFotos, o: OpcionesPedidor = {}) {
  const esperaMs = o.esperaMs ?? 40;
  const vigenciaMs = o.vigenciaMs ?? 8 * 60 * 1000;
  const vacioMs = o.vacioMs ?? 10 * 1000;
  const ahora = o.ahora ?? (() => Date.now());
  const guardadas = new Map<string, { fotos: FotoRemota[]; hasta: number }>();
  const esperando = new Map<string, { esperadas: number; avisar: Array<(f: FotoRemota[]) => void> }>();
  let reloj: ReturnType<typeof setTimeout> | null = null;

  async function ir() {
    reloj = null;
    const lote = [...esperando.entries()];
    esperando.clear();
    for (let i = 0; i < lote.length; i += POR_PEDIDO) {
      const tramo = lote.slice(i, i + POR_PEDIDO);
      const r = await traer(tramo.map(([id]) => id)).catch(() => null);
      for (const [id, { esperadas, avisar }] of tramo) {
        const fotos = r?.[id] ?? [];
        const completas = fotos.length > 0 && fotos.length >= esperadas;
        if (r) guardadas.set(id, { fotos, hasta: ahora() + (completas ? vigenciaMs : vacioMs) });
        for (const a of avisar) a(fotos);
      }
    }
  }

  /** Lo que ya se sabe de un trabajo y todavía sirve (null = hay que preguntar). */
  function yaSabidas(id: string): FotoRemota[] | null {
    const g = guardadas.get(id);
    return g && g.hasta > ahora() ? g.fotos : null;
  }

  /** Las fotos de un trabajo en el servidor ([] si no tiene, o si no se pudo preguntar). `esperadas`: cuántas dice tener. */
  function pedir(id: string, esperadas = 0): Promise<FotoRemota[]> {
    const ya = yaSabidas(id);
    if (ya) return Promise.resolve(ya);
    return new Promise((ok) => {
      const e = esperando.get(id);
      esperando.set(id, { esperadas: Math.max(esperadas, e?.esperadas ?? 0), avisar: [...(e?.avisar ?? []), ok] });
      if (!reloj) reloj = setTimeout(() => { void ir(); }, esperaMs);
    });
  }

  return { pedir, yaSabidas };
}
