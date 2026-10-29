// =============================================================================
// documento-vivo — «Tu oferta» que se ARMA AL COSTADO mientras se le contesta a MaKo (29/10/2026), PURO
// =============================================================================
// Martín, 29/10/2026: «que al ir respondiendo las preguntas que te va haciendo MaKo que tu "offer" se arme al costado». Y el
// Cerebro, con él: «un documento que se va completando sección por sección... Lo que falta, sin el cartel "falta":
// simplemente todavía no aparece» (memoria «Sin "falta"»).
// Reemplaza al riel de las piezas en la tab (PiezasRail.tsx, que sigue en el onboarding): en vez de una lista de casillas
// con su «8/20», el documento con lo que ya se sabe, en el orden de los grupos de siempre (GRUPOS_PIEZAS). Una pieza vacía
// no se dibuja; un grupo sin ninguna, tampoco. Sin React: lo usan la computadora (DocumentoVivo.tsx) y el teléfono.
// =============================================================================

import { PIEZAS, type PiezaKey, type PiezasSabidas } from '@/lib/offer-marco';
import { estadoDePieza, piezasAgrupadas, type EstadoPieza } from './ayudas';

export type PiezaDelDocumento = { key: PiezaKey; titulo: string; valor: string; estado: Exclude<EstadoPieza, 'vacia'> };
export type SeccionDelDocumento = { titulo: string; piezas: PiezaDelDocumento[] };

/** Las secciones con lo que MaKo ya sabe. Vacío = todavía no se contestó nada. */
export function documentoDeOferta(piezas: PiezasSabidas): SeccionDelDocumento[] {
  return piezasAgrupadas(PIEZAS).flatMap((g) => {
    const llenas = g.piezas.flatMap((p): PiezaDelDocumento[] => {
      const estado = estadoDePieza(piezas, p.key);
      if (estado === 'vacia') return [];
      return [{ key: p.key, titulo: p.label, valor: (piezas[p.key]?.valor ?? '').trim(), estado }];
    });
    return llenas.length ? [{ titulo: g.titulo, piezas: llenas }] : [];
  });
}

/** La pieza que llegó última (la recién contestada): se resalta un momento para que se vea dónde cayó. */
export function piezaMasNueva(piezas: PiezasSabidas): PiezaKey | null {
  let mejor: { k: PiezaKey; t: number } | null = null;
  for (const p of PIEZAS) {
    const s = piezas[p.key];
    if (!s?.valor?.trim()) continue;
    const t = Date.parse(s.at);
    if (Number.isFinite(t) && (!mejor || t > mejor.t)) mejor = { k: p.key, t };
  }
  return mejor?.k ?? null;
}
