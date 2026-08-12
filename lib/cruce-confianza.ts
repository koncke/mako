// =============================================================================
// cruce-confianza — «alta» exige DOS señales, porque sola esconde trabajo
// =============================================================================
// El cruce anti-duplicados le pregunta al modelo si una candidata de una reunión ya está
// en el tablero, y cuando contesta con confianza «alta» la tarea llega DESTILDADA: el
// dueño no la carga salvo que la busque entre veinte. Esa decisión se toma sola, así que
// un falso positivo no molesta: **esconde un pedido real de una reunión, en silencio.**
//
// LO QUE SE MIDIÓ, 12/8/2026, sobre «Mau <> Martin: CUSTOMER SUCCESS». De las 11 tareas
// propias, 8 llegaron destildadas con «alta». Las OCHO son falsas, y no por poco —
// midiendo el Jaccard de palabras clave contra la tarjeta con la que las cruzó:
//
//     Conectar el Second Brain con el Cloud Code   → «Tab SuperAdmin: modelo de IA…»  0.00
//     Agregar infinitos guiones en el Ads Writer   → «Escritor de VSL + DMs…»         0.00
//     Desactivar el bot de ManyChat de Instagram   → «Cerrar el canal no oficial…»    0.00
//     Editar/crear avatares en Ads Writer          → «Escritor de VSL + DMs…»         0.00
//     Actualizar el plan del curso de CS           → «Configurar Fathom e IA…»        0.09
//     …y tres más entre 0.09 y 0.10
//
// Cinco de ocho comparten **cero** palabras con la tarjeta. Y dos tarjetas absorbieron
// DOS candidatas cada una. El botón terminó diciendo «Agregar 3 al plan» sobre una
// reunión de la que salían once cosas suyas.
//
// LA REGLA: «alta» es una afirmación cara y tiene que ser rara. El modelo puede seguir
// diciéndola; lo que ya no puede es ESCONDER trabajo él solo. Degradar a «media» no apaga
// el cruce — la tarea sigue marcada, con el cartel verde y la razón — solo la deja
// TILDADA para que la decisión sea del dueño. La asimetría es toda: un «media» de más
// cuesta un click, un «alta» de más cuesta una tarea perdida.
//
// ⚠️ Ninguna de las tres degradaciones mira un umbral fino, a propósito. AGENTS.md →
// «un umbral es un proxy y hay que medirlo»: acá los cortes son estructurales (dos cosas
// distintas no son la misma cosa; cero palabras en común no es «la misma dicha de otro
// modo») y no números calibrados contra estos ocho casos, que envejecerían solos.
//
// SIN 'server-only': lo importa el test y `mako-guardian` no se puede importar desde uno.
// =============================================================================

import { palabrasClave } from './tareas-dedup';

/** Lo mínimo que necesita la regla. Genérico a propósito: el caller conserva su tipo
 *  entero (`CruceItem` trae además `accion`) y acá solo se toca `confianza`. */
export type CruceCrudo = { i: number; idExistente: string | null; confianza: 'alta' | 'media' };

/** ¿Comparten aunque sea UNA palabra con contenido? */
export const compartenAlgo = (a: string, b: string): boolean => {
  const A = palabrasClave(a), B = palabrasClave(b);
  if (!A.size || !B.size) return false;
  for (const w of A) if (B.has(w)) return true;
  return false;
};

/**
 * Baja a «media» las confianzas que no se sostienen. Devuelve los cruces con el mismo
 * orden y la misma cantidad: **nunca descarta un cruce**, solo le quita el poder de
 * destildar. Que la tarea siga avisando es la mitad del valor del cruce.
 *
 * Las tres razones, de más segura a menos:
 *
 * 1. **Dos candidatas no pueden ser la misma tarjeta.** Si el modelo mandó dos (o más)
 *    candidatas al mismo `idExistente` con «alta», a lo sumo una tiene razón y no sabemos
 *    cuál. Es lógica, no heurística: bajan todas. Cazó 4 de los 8 del caso real.
 *
 * 2. **Cero palabras en común no es «la misma dicha de otro modo».** No es un umbral
 *    calibrado: es el piso de lo que significa hablar de lo mismo. Deja pasar el caso que
 *    justifica el cruce con IA —«Mensaje de WhatsApp después de agendar» contra
 *    «follow-up post-agendamiento» comparten ~15% y ahí el léxico solo no alcanza— y
 *    frena al modelo asociando libre. Cazó 5 de los 8.
 *
 * 3. **Si CASI TODO el lote es «alta», el modelo no discriminó.** Medido: 16 de 16. Un
 *    lote donde todo es duplicado es un lote donde no se comparó nada. Solo aplica con
 *    lotes de 4 o más, y solo a los cruces contra el TABLERO: cuando la misma llamada se
 *    graba dos veces, que todo matchee contra el borrador hermano es lo correcto y
 *    esperable.
 */
export function degradarConfianza<T extends CruceCrudo>(
  cruces: T[],
  candidatas: Array<{ titulo: string }>,
  existentes: Array<{ id: string; titulo: string }>,
): { cruces: T[]; degradados: Array<{ i: number; porQue: string }> } {
  const tituloDe = new Map(existentes.map((e) => [e.id, e.titulo]));
  const degradados: Array<{ i: number; porQue: string }> = [];

  // 1. Una tarjeta, una candidata.
  const cuenta = new Map<string, number>();
  for (const c of cruces) if (c.confianza === 'alta' && c.idExistente) cuenta.set(c.idExistente, (cuenta.get(c.idExistente) ?? 0) + 1);

  // 3. El lote entero. Los cruces contra otro borrador (`borrador:`) no cuentan.
  const contraTablero = cruces.filter((c) => c.idExistente && !c.idExistente.startsWith('borrador:'));
  const altasTablero = contraTablero.filter((c) => c.confianza === 'alta').length;
  const loteSospechoso = contraTablero.length >= 4 && altasTablero / contraTablero.length >= 0.7;

  const salida = cruces.map((c) => {
    if (c.confianza !== 'alta' || !c.idExistente) return c;
    const destino = tituloDe.get(c.idExistente) ?? '';
    const cand = candidatas[c.i]?.titulo ?? '';
    const porQue = (cuenta.get(c.idExistente) ?? 0) > 1
      ? `esa tarjeta se lleva ${cuenta.get(c.idExistente)} candidatas: a lo sumo una es la misma`
      : !compartenAlgo(cand, destino)
        ? 'no comparte NINGUNA palabra con la tarjeta: no es la misma dicha de otro modo'
        : loteSospechoso && !c.idExistente.startsWith('borrador:')
          ? `${altasTablero} de ${contraTablero.length} del lote vinieron «alta»: el modelo no discriminó`
          : '';
    if (!porQue) return c;
    degradados.push({ i: c.i, porQue });
    return { ...c, confianza: 'media' as const };
  });
  return { cruces: salida, degradados };
}
