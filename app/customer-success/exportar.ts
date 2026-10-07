// =============================================================================
// exportar — lo que se ve, a un CSV (el texto; la descarga la hace ClientesApp)
// =============================================================================
// Sin `'use client'` ni `server-only`, A PROPÓSITO: es lo que un test puede EJECUTAR.
// ClientesApp no se puede importar desde un test —arrastra las server actions, y con ellas
// módulos `server-only`—, así que lo que decide QUÉ columnas salen vive acá y la pantalla
// sólo arma el Blob.
//
// ⚠️ EMAIL Y TELÉFONO VAN EN EL MISMO CSV (06/10/2026, opción A de «copiar contactos en
// lote»): la pregunta era si sumar un botón «Copiar contactos» a la barra de lote o dos
// columnas al «Exportar» que ya existe, y se eligió lo segundo — minimalismo duro en esta
// pantalla. Exportar ya respeta la selección del lote y el filtro de la barra, así que
// «los contactos de estos cinco» sale con el mismo gesto, sin un botón más. Los datos ya
// están en el navegador (`c.email` del cruce y `c.ficha.contacto.telefono` de la ficha):
// no hay lectura nueva.

import type { ClienteCruce } from './cruce';
import type { ResumenTrabajo } from './trabajo';

/**
 * Los rótulos de las columnas. Los mismos que la tarjeta y la tabla: un CSV que nombra
 * distinto las mismas columnas obliga a cruzarlo a mano con la pantalla de la que salió.
 */
export const CABECERA_CSV = ['Cliente', 'Nombre', 'Empresa', 'Email', 'Teléfono', 'Proyectos', 'Tareas', 'Recurrentes'] as const;

/** Un lead ganado puede tener el nombre vacío: el archivo necesita algo que decir. */
const nombreDe = (c: ClienteCruce): string => c.nombre.trim() || 'Sin nombre';

/**
 * Las filas del CSV (cabecera incluida), como celdas sin escapar.
 *
 * ⚠️ UN CONTACTO QUE NO SE PUDO LEER SALE VACÍO, igual que uno que no hay. En la pantalla
 * son dos cosas distintas (la ficha lo dice), pero una celda no tiene cómo decirlo, y un
 * texto como «no se pudo leer» en la columna del teléfono rompe al que la pegue en otra
 * herramienta. El caso es raro: la lectura de contactos es una sola para toda la cartera.
 */
export function filasCSV(
  filas: readonly ClienteCruce[],
  numeroDe: ReadonlyMap<number, number>,
  resumenDe: (leadId: number) => ResumenTrabajo | null,
): Array<Array<string | number>> {
  const cuerpo = filas.map((c) => {
    const r = resumenDe(c.leadId);
    return [
      numeroDe.get(c.leadId) ?? 0,
      nombreDe(c),
      c.empresa ?? '',
      c.email?.trim() ?? '',
      c.ficha?.contacto?.telefono?.trim() ?? '',
      r?.proyectos ?? 0,
      r?.abiertas ?? 0,
      r?.recurrentes ?? 0,
    ];
  });
  return [[...CABECERA_CSV], ...cuerpo];
}

/**
 * Lo que una planilla lee como el ARRANQUE DE UNA FÓRMULA (OWASP, «CSV Injection»): `=`, `+`,
 * `-`, `@`, y un tab adelante. Se mira con los saltos de línea ya aplanados (un `\r` adelante
 * queda como espacio) y aceptando espacios antes del signo: « =1+1» se neutraliza igual, porque
 * cualquier lector que recorte los espacios la ejecutaría, y el apóstrofo no le cuesta nada a un
 * nombre que de verdad empiece así.
 */
const ARRANCA_FORMULA = /^(?:\s*[=+\-@]|\t)/;

/**
 * Lo que Excel vuelve NÚMERO al abrir el archivo: dígitos con la puntuación de un teléfono o de
 * una cifra. Con el teléfono crudo (como salía hasta el 06/10/2026), `5215512345678` se abre como
 * `5,21552E+12`, `+5215512345678` pierde el `+`, `0221 456` pierde el cero, y `+52 55 1234 5678`
 * arranca como fórmula. Comillas, letras y saltos de línea quedan AFUERA a propósito:
 * esto va adentro de un literal de fórmula y lo único que podría escaparse de él es una comilla.
 * El tope de 100 queda lejos de los 255 caracteres que Excel acepta en un literal.
 */
const PARECE_NUMERO = /^(?=.*\d)[0-9+\-().,/ ]{1,100}$/;

/**
 * Una celda, como la va a leer Excel.
 *
 * ⚠️ UN `number` LLEGA COMO NÚMERO Y UN `string` COMO TEXTO: el tipo de JS es el contrato, y por
 * eso esto vive acá y no en `filasCSV` (que devuelve las celdas sin escapar). Tres ramas, y el
 * ORDEN importa:
 *   1. Lo que Excel volvería número (el teléfono, un nombre que es un teléfono, «007») va como
 *      `="…"`: Excel lo evalúa y lo que queda es el texto tal cual, con su `+` y sus ceros. Va
 *      PRIMERO porque un `+52…` también arranca como fórmula, y la rama 2 le dejaría el apóstrofo
 *      a la vista en una columna que alguien va a copiar a otra herramienta.
 *   2. Lo que arranca como fórmula lleva un apóstrofo adelante. Nombre, empresa, email y teléfono
 *      vienen de leads que pueden entrar por un opt-in público, y un «=HYPERLINK(…)» se
 *      ejecutaría en el Excel de quien exporta.
 *   3. El resto, tal cual.
 * En las tres, una comilla adentro se duplica (como la escapa el formato) y los saltos de línea
 * se aplanan, o parten la fila en dos.
 *
 * ⚠️ Lo que Excel hace con cada forma NO se comprobó en un Excel: la máquina donde se escribió no
 * tiene ni Excel ni LibreOffice. Lo que se fija con test es el TEXTO del archivo, que es lo único
 * que decide este código; la lectura de Excel es la receta de OWASP y la de `="…"`.
 */
function celda(v: string | number | null | undefined): string {
  const encomillar = (s: string) => `"${s.replace(/"/g, '""')}"`;
  if (typeof v === 'number') return encomillar(String(v));
  const s = String(v ?? '').replace(/[\r\n]+/g, ' ');
  if (PARECE_NUMERO.test(s)) return encomillar(`="${s}"`);
  if (ARRANCA_FORMULA.test(s)) return encomillar(`'${s}`);
  return encomillar(s);
}

/**
 * El texto del archivo: separador `;`, filas con `\r\n` y BOM adelante. Sin el `;` y el BOM,
 * Excel en español abre el archivo con todo en una columna y se come los acentos. Cada celda
 * pasa por `celda`: ahí está lo que impide que Excel ejecute o redondee lo que trae.
 */
export function textoCSV(filas: ReadonlyArray<ReadonlyArray<string | number>>): string {
  return '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
}
