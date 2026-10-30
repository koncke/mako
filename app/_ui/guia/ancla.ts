// La marca de un ancla de la guía (lib/guia/): `<button {...ancla('sb-nuevo')}>` pone el `data-recorrido` de siempre. Con el id
// tipado (`IdAncla`, de los catálogos): uno mal escrito no compila, y la guía nunca busca algo que no está marcado.
// Una marca por control o por bloque, nunca un `aria-label` como ancla (se cambia por un texto y se rompe en silencio).

import type { IdAncla } from '@/lib/guia/catalogo';

export const ancla = (id: IdAncla): { 'data-recorrido': IdAncla } => ({ 'data-recorrido': id });
