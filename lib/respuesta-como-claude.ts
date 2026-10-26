// =============================================================================
// Las respuestas de los chats, como una respuesta de Claude (26/10/2026)
// =============================================================================
// Martín, desde el Centro, con captura de un cierre en el teléfono («Comprobado · 00:43»: un muro de «1) … 2) … 3) …»
// corrido y una tabla Decidido/Comprobado/Sigue con la columna de la derecha angostísima): «Mira que feo el formato de las
// respuestas, mejora eso... Que se parezca a Claude las respuestas». Lo que dicen los chats (cierres, avances, el «Ya
// está») se dibuja como Markdown de verdad, con párrafos y listas con un ítem por renglón (app/_components/Markdown.tsx,
// `aire`). Esto es lo que lo arregla ANTES de dibujar, y lo usa también la API: el mismo texto en las dos.
// ⚠️ PURO y sin nada del navegador: lo usan el hilo (Hilo.tsx, Avance.tsx) y la API (lib/api-mako/areas/operaciones.run.ts).

/** Un «N)» que empieza un ítem: al principio, o después de un espacio o un «:». */
const MARCA = /(^|[\s:])(\d{1,2})\)\s+/g;

/**
 * Un renglón con un «1) … 2) … 3) …» corrido pasa a ser una lista numerada, un ítem por renglón, con lo de antes del «1)»
 * como su párrafo. Sólo si los números van SEGUIDOS desde el 1 y son dos o más: «(ver 2) otra cosa» o un «3)» suelto no
 * son una lista. Lo que va entre ``` no se toca. Lo que ya viene en renglones queda igual.
 */
export function listasEnRenglones(texto: string): string {
  if (!/\d\)\s/.test(texto)) return texto;
  let enCodigo = false;
  return texto.split('\n').map((renglon) => {
    if (/^\s*(```|~~~)/.test(renglon)) { enCodigo = !enCodigo; return renglon; }
    if (enCodigo) return renglon;
    const marcas: { desde: number; hasta: number }[] = [];
    for (const m of renglon.matchAll(MARCA)) {
      if (Number(m[2]) !== marcas.length + 1) continue;
      const desde = (m.index ?? 0) + m[1].length;
      marcas.push({ desde, hasta: desde + m[0].length - m[1].length });
    }
    if (marcas.length < 2) return renglon;
    const intro = renglon.slice(0, marcas[0].desde).trim();
    const items = marcas.map((k, i) => `${i + 1}. ${renglon.slice(k.hasta, marcas[i + 1]?.desde ?? renglon.length).trim()}`);
    return [...(intro ? [intro, ''] : []), ...items].join('\n');
  }).join('\n');
}

/** Lo que dice el cierre de un chat, para la API: cada parte como se dibuja (`listasEnRenglones`). */
export function cierreComoClaude<C extends { decidido: string; hecho: string; comprobado: string; sigue: string }>(c: C): C {
  return { ...c, decidido: listasEnRenglones(c.decidido), hecho: listasEnRenglones(c.hecho), comprobado: listasEnRenglones(c.comprobado), sigue: listasEnRenglones(c.sigue) };
}
