// =============================================================================
// graficos-nombres — lo que la base guarda como CLAVE INTERNA, dicho con el nombre que la app ya le da (11/11/2026)
// =============================================================================
// Mirando producción a 1440 (docs/pruebas/dashboard-10-11.md, «Producción, 11/11»): Comercial listaba «calendly» y
// «carga_manual» en «De dónde vienen los que cierran», y Contenido e IA, «chatbot-crear-ia», «offer» o «mako-pedidos» en
// «Para qué se usa». Son las claves de la columna, no nombres: la fila de un grupo se rotulaba con su clave
// (`etiqueta: x.clave`, lib/graficos-agregar.ts).
//
// NO SE INVENTA UN NOMBRE: cada uno ya existe en la app.
//   · el origen del lead → el rótulo de FILA del CRM (`ORIGEN_LEAD[...].lista`, app/crm/origen-lead.ts: «Calendly»,
//     «Cargado a mano», «Meta · Instant Form»), el mismo que dicen la tarjeta y el filtro «Origen» del tablero;
//   · la función de la IA → el `label` del catálogo de modelos (lib/model-catalogo.ts, «nombre legible»), el que lista
//     /modelos-ia.
// Una clave que el catálogo no conoce queda como está (el origen puede venir del `utm_source`, que es texto libre).
//
// ⚠️ SÓLO LA ETIQUETA: la CLAVE de la fila no cambia, así que un filtro guardado con «instant_form» sigue filtrando
//    (`filtrarFilas` compara claves). Y corre en el server, después de agregar (lib/graficos-datos.ts): el catálogo de
//    modelos pesa 40 KB y lib/graficos-agregar.ts también viaja al navegador.
// Puro y sin `server-only`: lo fija tests/dashboard-nombres.test.ts. Importa lib/model-catalogo.ts directo (como el test de
// lib/model-registry.ts) porque `model-registry` es `server-only`.
// =============================================================================

import { ORIGEN_LEAD, type OrigenLeadDef } from '@/app/crm/origen-lead';
import { CATALOGO_MODELOS } from './model-catalogo';
import { OTROS, SIN_DATO, type Resultado } from './graficos-agregar';

const ORIGENES = ORIGEN_LEAD as Readonly<Record<string, OrigenLeadDef | undefined>>;
const FUNCIONES = new Map(CATALOGO_MODELOS.map((f) => [f.feature, f.label] as const));

/** El nombre de cada clave, por fuente y dimensión. `null` = no hay nombre: queda la clave. */
const NOMBRES: Readonly<Record<string, Readonly<Record<string, (clave: string) => string | null>>>> = {
  leads: { origen: (k) => ORIGENES[k]?.lista ?? null },
  ia: { funcion: (k) => FUNCIONES.get(k) ?? null },
};

/** El nombre de una clave de esa fuente y dimensión, o `null` si no tiene (la pantalla deja la clave). */
export function nombreDeClave(fuente: string, dimension: string | null | undefined, clave: string): string | null {
  const nombrar = dimension ? NOMBRES[fuente]?.[dimension] : undefined;
  return nombrar && clave !== SIN_DATO && clave !== OTROS ? nombrar(clave) : null;
}

/** El resultado con la etiqueta de cada fila nombrada. Sin nada que nombrar, devuelve el MISMO objeto. */
export function nombrarFilas(r: Resultado, fuente: string, dimension: string | null | undefined): Resultado {
  if (!dimension || !NOMBRES[fuente]?.[dimension] || !r.filas.length) return r;
  return { ...r, filas: r.filas.map((f) => { const n = nombreDeClave(fuente, dimension, f.clave); return n ? { ...f, etiqueta: n } : f; }) };
}
