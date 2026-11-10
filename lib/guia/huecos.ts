// =============================================================================
// La guía: los huecos del velo y dónde va la frase (PURO; 29/10/2026)
// =============================================================================
// docs/mako-iniciativa/guia.md §2.3 y §2.4. El velo nuevo es «un poco opaco» (el `--scrim` de la casa, 40%) con HUECOS: el
// ancla que se señala y cada chat de MaKo a la vista (`[data-mako-chat]`), así se puede usar la tab y escribirle a MaKo con la
// guía puesta. El de los recorridos (`box-shadow 200vmax`) daba UN hueco solo y tapaba el chat.
// La geometría reusa la de los recorridos (lib/recorridos.ts): el recorte, el scroll y dónde va la tarjeta.
// =============================================================================

import { posicionTarjeta, recorteDe, type Caja, type LadoRecorrido, type Medida } from '@/lib/recorridos';

export type Hueco = Caja & { ancla?: true };

const seTocan = (a: Caja, b: Caja) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
const union = (a: Caja, b: Caja): Caja => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, ancho: Math.max(a.x + a.ancho, b.x + b.ancho) - x, alto: Math.max(a.y + a.alto, b.y + b.alto) - y };
};

/**
 * Los huecos del velo: el ancla (recortada con su aire, como el recorrido) y los chats, sin repetirse. Un ancla ADENTRO de un
 * chat no suma hueco (el chat ya está claro): queda sólo su aro. Dos chats que se pisan se juntan en uno.
 */
export function huecosDelVelo(ancla: Caja | null, chats: readonly Caja[], ventana: Medida): Hueco[] {
  const claros: Caja[] = [];
  for (const c of chats) {
    if (c.ancho <= 0 || c.alto <= 0) continue;
    let actual = c;
    for (let i = claros.length - 1; i >= 0; i--) {
      if (seTocan(claros[i], actual)) { actual = union(claros[i], actual); claros.splice(i, 1); }
    }
    claros.push(actual);
  }
  const out: Hueco[] = claros.map((c) => ({ ...c }));
  if (ancla && ancla.ancho > 0 && ancla.alto > 0) {
    const r = recorteDe(ancla, ventana);
    const adentro = claros.some((c) => r.x >= c.x && r.y >= c.y && r.x + r.ancho <= c.x + c.ancho && r.y + r.alto <= c.y + c.alto);
    if (!adentro) out.push({ ...r, ancla: true });
  }
  return out;
}

/**
 * Dónde va la frase: al lado del ancla, NUNCA encima de un chat (se lo taparía a quien le está escribiendo). Prueba los cuatro
 * lados con la geometría de los recorridos y se queda con el primero que no pisa ningún chat; si todos pisan, el de los
 * recorridos (encajado en la ventana).
 */
export function posicionFrase(o: { ancla: Caja; frase: Medida; ventana: Medida; chats: readonly Caja[] }): { x: number; y: number; lado: LadoRecorrido } {
  const hueco = recorteDe(o.ancla, o.ventana);
  const lados: LadoRecorrido[] = ['abajo', 'arriba', 'derecha', 'izquierda'];
  for (const lado of lados) {
    const p = posicionTarjeta({ objetivo: hueco, tarjeta: o.frase, ventana: o.ventana, lado });
    if (p.lado !== lado) continue;
    const caja = { x: p.x, y: p.y, ancho: o.frase.ancho, alto: o.frase.alto };
    if (!o.chats.some((c) => seTocan(c, caja)) && !seTocan(caja, hueco)) return { x: p.x, y: p.y, lado };
  }
  const p = posicionTarjeta({ objetivo: hueco, tarjeta: o.frase, ventana: o.ventana });
  return { x: p.x, y: p.y, lado: p.lado };
}

/** ¿La ventana es angosta? Ahí el chat y la tab no conviven: al señalar algo de la tab, el chat se aparta. */
export const esAngosta = (ancho: number, tope = 760): boolean => ancho <= tope;

/**
 * El velo de una PREGUNTA de MaKo (9/11/2026, la tab Video: «se opaca todo el resto de la pantalla y se marca el mensaje con la
 * pregunta de MaKo»). Sin un objetivo de la guía: los huecos son los chats a la vista y el aro va en el mensaje marcado. Nunca se
 * oscurece para marcar algo que no está ADENTRO de un chat (la pregunta de MaKo vive en su chat; afuera sería otra cosa) ni algo
 * que no se ve: null y no hay velo.
 */
export function dibujoDestacado(marca: Caja | null, chats: readonly Caja[], ventana: Medida): { huecos: Hueco[]; aro: Caja } | null {
  if (!marca || marca.ancho <= 0 || marca.alto <= 0) return null;
  const visibles = chats.filter((c) => c.ancho > 0 && c.alto > 0);
  const adentro = visibles.some((c) => marca.x >= c.x && marca.y >= c.y && marca.x + marca.ancho <= c.x + c.ancho && marca.y + marca.alto <= c.y + c.alto);
  if (!adentro) return null;
  return { huecos: huecosDelVelo(marca, visibles, ventana), aro: marca };
}
