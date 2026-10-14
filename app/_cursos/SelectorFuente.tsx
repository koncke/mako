'use client';

/**
 * La FUENTE del curso en el navegador: cargar la hoja de una familia cuando hace falta, y el
 * DESPLEGABLE que va en el menú de la marca, debajo del color (item 3 del 08/10/2026). El catálogo y
 * las reglas (qué se guarda, qué variables se pintan, con qué palabras se busca) son puros y viven en
 * ./fuentes.ts.
 *
 * ⚠️ CADA FAMILIA ENTRA UNA SOLA VEZ, con un `<link>` de id propio en el `<head>`, como la hoja del
 *    curso (`useCssUgc`, ./CursoUgc.tsx). Nunca se arma una hoja «sólo con las letras de la muestra»
 *    (el `text=` de Google, que pesa menos): declara la MISMA familia con menos glifos, y si llega
 *    después de la completa le gana —el curso dibujaría con la de respaldo todas las letras que no
 *    estaban en la muestra, sin un error—.
 *
 * ── Un desplegable como cualquier otro, copiado del de Google Docs (14/10/2026) ──────────────
 * Martín, mirando la biblioteca de 24 que salió el 13/10: «Mejora el desplegable de las tipografías,
 * que sea uno como cualquier otro, copialo de como lo tiene google docs... Pero no inventes cosas».
 * Lo que se copió de Docs: un BOTÓN con la fuente elegida, y al abrirlo la lista con CADA NOMBRE
 * ESCRITO CON SU PROPIA LETRA, en orden alfabético. Lo que NO se copió porque acá no existe: «Más
 * fuentes» (el diálogo de Docs para sumar familias) y el submenú de pesos de cada una. Y lo que se
 * SACÓ por inventado: la palabra de al lado de cada fuente («Neutra», «Clara»…) y los cuatro cajones.
 * Es el `Dropdown` de la casa (app/components/Dropdown.tsx), con su buscador (más de 7 opciones) y su
 * marca de lo elegido; lo único que se le sumó es `fuente` en cada opción.
 *
 * ⚠️ LA LISTA SE MONTA ADENTRO DEL MENÚ DE LA MARCA (`portalTo`), no en el `body`. Ese menú se cierra con
 *    cualquier `mousedown` fuera de su caja y cuando el foco se va (`MenuMarca`, ./CursoUgc.tsx): con la
 *    lista en el `body`, el primer clic en una fuente cerraba el menú entero antes de elegirla.
 *
 * ── Por qué la hoja de cada fuente se pide AL VERSE (13/10/2026) ──────────────────────────────
 * Cada renglón se dibuja CON SU PROPIA LETRA —que es lo que lo vuelve elegible de un vistazo—, así que
 * cada renglón visible baja su `.woff2`. Con 24 eso es bajar las 24 al abrir un menú donde se va a
 * elegir una: medido en el catálogo viejo, el latino normal pesa entre 6 KB (Poppins) y 92 KB (Inter).
 * Por eso la hoja de un renglón se pide cuando ese renglón ENTRA EN PANTALLA.
 *
 * ⚠️ Y SI NO HAY `IntersectionObserver`, SE PIDEN TODAS. Un renglón cuya hoja no llegó se dibuja con
 *    la de respaldo, o sea con la letra de otra: la muestra MIENTE, que es peor que tardar. La
 *    degradación va hacia lo correcto y lento, nunca hacia lo rápido y falso.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dropdown, type DropdownOption } from '@/app/components/Dropdown';
import { FUENTES, FUENTE_DEFAULT, fuenteDe, palabrasDeBusqueda, type FuenteCurso } from './fuentes';

/** El id del `<link>` de una familia. Uno por familia: lo buscan las dos puntas antes de crear otro. */
const idHoja = (f: FuenteCurso) => `ugc-fuente-${f.id}`;

/** Mete la hoja de Google de una familia si todavía no está. Sin hoja (la de siempre), nada. */
export function cargarHojaDeFuente(f: FuenteCurso): void {
  if (!f.hoja || typeof document === 'undefined') return;
  if (document.getElementById(idHoja(f))) return;
  const l = document.createElement('link');
  l.id = idHoja(f);
  l.rel = 'stylesheet';
  l.href = f.hoja;
  document.head.appendChild(l);
}

/**
 * Carga la hoja de cada fuente pedida (ids del catálogo; uno desconocido es la de siempre, que no carga
 * nada). En un efecto: el `<head>` no se toca al dibujar en el server.
 *
 * ⚠️ Esto pide TODAS las que le pasen, de una. Es lo correcto para una lista corta y conocida (el
 *    panel de estilo del Dashboard le pasa su propio catálogo); el desplegable de acá abajo NO lo usa,
 *    porque con 24 familias sería bajarlas todas para elegir una.
 */
export function useHojasDeFuentes(ids: ReadonlyArray<string | null | undefined>): void {
  const firma = ids.map((i) => i ?? '').join('|');
  useEffect(() => {
    for (const id of firma.split('|')) if (id) cargarHojaDeFuente(fuenteDe(id));
  }, [firma]);
}

/**
 * Pide la hoja de cada renglón `[data-fuente]` cuando ENTRA EN PANTALLA, adentro de `caja` (el menú de la
 * marca, donde se monta la lista del desplegable).
 *
 * ⚠️ LOS RENGLONES APARECEN Y DESAPARECEN SOLOS: la lista existe sólo abierta, y el buscador la cambia.
 *    Por eso un `MutationObserver` mira la caja y cada renglón nuevo se suma al observer de pantalla. Sin
 *    eso, un renglón que aparece al buscar se queda sin su hoja y la muestra queda en la letra de respaldo
 *    — que es exactamente la mentira que esta pantalla no puede permitirse.
 */
function useHojasAlVerse(caja: HTMLElement | null): void {
  useEffect(() => {
    if (!caja) return;
    const pedir = (el: Element) => {
      const id = el.getAttribute('data-fuente');
      if (id) cargarHojaDeFuente(fuenteDe(id));
    };
    // Sin el observer no hay forma de saber qué se ve: se piden todas. Lento y honesto.
    const enPantalla = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        pedir(e.target);
        enPantalla?.unobserve(e.target);   // una vez pedida, deja de mirarse
      }
    }, { rootMargin: '120px' });
    const mirados = new WeakSet<Element>();
    const mirar = () => {
      for (const el of Array.from(caja.querySelectorAll('[data-fuente]'))) {
        if (mirados.has(el)) continue;
        mirados.add(el);
        if (enPantalla) enPantalla.observe(el); else pedir(el);
      }
    };
    mirar();
    const cambios = new MutationObserver(mirar);
    cambios.observe(caja, { childList: true, subtree: true });
    return () => { cambios.disconnect(); enPantalla?.disconnect(); };
  }, [caja]);
}

/** Las 24, en orden alfabético como en Docs, cada una escrita con ella misma. */
const OPCIONES: DropdownOption[] = [...FUENTES]
  .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  .map((f) => ({ value: f.id, label: f.nombre, fuente: f.pila, buscar: palabrasDeBusqueda(f) }));

/**
 * El DESPLEGABLE de la fuente del curso, en el menú de la marca.
 *
 * `onElegir` recibe el id; elegir la de siempre manda `null` (borra la fila, como el color).
 *
 * ⚠️ EL `null` SALE DE `FUENTE_DEFAULT`, NO DE LA POSICIÓN EN LA LISTA. Una versión anterior comparaba
 *    contra el primero del array: con una familia nueva arriba, elegir «la de siempre» habría guardado su
 *    id en vez de borrar la fila, y «nadie la eligió» y «eligió la de siempre» volvían a ser el mismo valor.
 */
export function SelectorFuente({ actual, onElegir, disabled }: {
  actual: string | null | undefined;
  onElegir: (id: string | null) => void;
  disabled?: boolean;
}) {
  const elegida = fuenteDe(actual).id;
  // Dónde se monta la lista: el menú de la marca que contiene al desplegable (ver la cabecera).
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const anclar = useCallback((el: HTMLDivElement | null) => setMenu(el?.closest<HTMLElement>('.ugc-menu') ?? null), []);
  useHojasAlVerse(menu);
  const opciones = useMemo(() => OPCIONES, []);

  return (
    <div ref={anclar} className="ugc-fuentes">
      <Dropdown value={elegida} options={opciones} width="100%" ariaLabel="Fuente del curso" disabled={disabled}
        portalTo={menu}
        onChange={(id) => { if (id !== elegida) onElegir(id === FUENTE_DEFAULT ? null : id); }} />
    </div>
  );
}

/** Cuántas familias tiene la biblioteca. Lo usa el test para que el menú y el catálogo no se separen. */
export const CUANTAS_FUENTES = FUENTES.length;
