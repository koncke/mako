// =============================================================================
// buscar-texto — buscar como busca una persona: sin acentos, por palabras y por #ID
// =============================================================================
// El buscador del CRM hacía `nombre.toLowerCase().includes(q)` sobre tres campos.
// Eso falla en los tres casos que uno más usa:
//
//   · POR NÚMERO DE LEAD — «#412» o «412» no encontraba nada, porque el id nunca
//     entraba a la comparación. Y el id es justamente cómo se llama a un lead
//     cuando no te acordás el nombre (el link, el ticket, lo que dijo el closer).
//   · CON ACENTOS — «Martin» no encontraba a «Martín», y «MARTÍN» tampoco a
//     «martin». El que escribe rápido no pone tildes; el que cargó el lead, sí.
//   · CON DOS PALABRAS EN OTRO ORDEN — «bustos martin» devolvía cero contra
//     «Martín Bustos», porque `includes` compara la FRASE entera.
//
// El board del plan ya había resuelto esto (ver `lib/buscar-tareas.ts`, que es la
// versión especializada del tablero: campos elegibles + búsqueda con IA). Este
// módulo es la parte genérica de esa misma idea, para cualquier lista con id.
//
// NO lleva `server-only` a propósito: lo importan componentes de cliente (la
// toolbar y el board del CRM). Ver «Una cosa, un lugar» en AGENTS.md — la regla
// del `#número` tiene que ser UNA, no una copia por pantalla.
// =============================================================================

/**
 * Deja un texto listo para comparar: minúsculas, sin acentos y con los espacios
 * colapsados. «Añadí  MARTÍN » y «anadi martin» terminan siendo lo mismo.
 *
 * La puntuación se CONSERVA (a diferencia de `paraBuscar` en buscar-tareas): en el
 * CRM los campos son emails y teléfonos, y romper «mbustos@elevate.com» en palabras
 * haría que buscar «@elevate.com» no encuentre nada.
 */
export function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')                     // separa la letra de su tilde…
    .replace(/[\u0300-\u036f]/g, '')      // …y la tilde se va (también la ñ → n, a propósito)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * ¿Este registro coincide con lo que se escribió en el buscador?
 *
 * `campos` es todo por lo que se puede encontrar al registro. Los que se pasan
 * como `number` (el id del lead, el #número de la tarea) son IDENTIDAD y se
 * comparan ENTEROS: el id 4 no puede matchear al lead 412 por ser un pedazo suyo.
 *
 * Reglas, en orden:
 *   1. La query se parte en términos y TODOS tienen que dar en algún campo (AND).
 *      Así «bustos martin» encuentra «Martín Bustos» y agregar una palabra siempre
 *      achica el resultado, que es lo que uno espera al refinar.
 *   2. Un término «#412» es pedir UN registro: matchea solo contra los ids, exacto,
 *      y no cae al texto. Sin esto, «#412» buscaría el literal «#412» y no daría nada.
 *   3. Un término de puros dígitos «412» prueba PRIMERO como id y, si no da, sigue
 *      como texto — así el mismo campo sirve para el id y para buscar un teléfono.
 *
 * Una query vacía devuelve `true`: "no filtrar" es la respuesta correcta cuando no
 * se buscó nada (quien llama no tiene que acordarse de chequearlo antes).
 */
export function coincideBusqueda(campos: Array<string | number | null | undefined>, query: string): boolean {
  const terminos = normalizar(query).split(' ').filter(Boolean);
  if (terminos.length === 0) return true;

  const ids = new Set<number>();
  const textos: string[] = [];
  for (const c of campos) {
    if (c === null || c === undefined) continue;
    if (typeof c === 'number') {
      if (Number.isFinite(c)) ids.add(c);
      continue;
    }
    const t = normalizar(c);
    if (t) textos.push(t);
  }
  // El separador con salto de línea evita el falso positivo de campos pegados: sin
  // él, "Ana" + "López" concatenados hacen que «analopez» coincida con nada real.
  const heno = textos.join(' \n ');

  return terminos.every((t) => {
    const conNumeral = /^#(\d+)$/.exec(t);
    if (conNumeral) return ids.has(Number(conNumeral[1]));
    if (/^\d+$/.test(t) && ids.has(Number(t))) return true;
    return heno.includes(t);
  });
}
