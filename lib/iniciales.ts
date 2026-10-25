// =============================================================================
// Las iniciales de un redondel: la primera LETRA de las dos primeras palabras
// =============================================================================
// Ticket #10 (25/10/2026): «La pantalla «CRM» se rompió» en /crm/3445, React #418 («el texto del servidor no coincide
// con el del navegador»). El lead se llama «🧪 Martín arnés…» y la marca de su cabecera tomaba `w[0]` de cada palabra:
// en JavaScript eso es la primera unidad de UTF-16, y la de «🧪» es MEDIO emoji (un surrogate suelto). El servidor lo
// manda en el HTML como «�» (UTF-8 no tiene cómo escribir medio emoji); el navegador, al hidratar, tiene la mitad cruda.
// Son dos textos distintos y React tira la pantalla.
//
// Por eso se cuenta por LETRA ENTERA (`[...w]`, por punto de código) y sólo letras y números: un emoji, un paréntesis o
// un @ no son iniciales («Juan (ventas)» daba «J(»). Lo que sale tiene que volver igual después de pasar por UTF-8.
// Lo fija tests/iniciales-hidratacion.test.ts.

/** «Ana Gómez» → «AG»; «🧪 Martín arnés» → «MA»; «Juan (ventas)» → «JV». Sin ninguna letra, `vacio`. */
export function inicialesPorLetra(nombre: string | null | undefined, vacio = '?'): string {
  const letras = String(nombre ?? '').trim().split(/\s+/)
    .map((w) => [...w.replace(/[^\p{L}\p{N}]/gu, '')][0])
    .filter((c): c is string => Boolean(c));
  return letras.slice(0, 2).join('').toUpperCase() || vacio;
}
