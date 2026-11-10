// =============================================================================
// motion/panel — lo que el panel del Video Editor valida al CONFIRMAR un campo de un motion graphic
// =============================================================================
// Dos preguntas, en orden:
//   1. ¿El valor vale? `validarCampoMotion` (./plantillas.ts): la misma `normalizarMotion` del chat y la API, sin lo
//      estricto (un texto largo no se rechaza por largo hasta el tope duro; un número se lleva al paso).
//   2. ¿Entra en el cuadro? Un texto escrito a mano puede ser tan largo que, con la letra en su mínimo y las cajas
//      crecidas a sus líneas, la pila se sale del cuadro (un descuento de 200 letras hace un sello más alto que el
//      video). Se arma la escena con lo que hay y el valor nuevo, en la proporción del proyecto, y si el cambio la saca
//      del cuadro (o la saca más), no se guarda.
// Puro: lo usan la pestaña «Motion» (app/video-editor/_opencut/motion/components/pestana-motion.tsx) y los tests.
// =============================================================================

import { armarEscena, desbordeDelCuadro } from './escena';
import { camposDe, validarCampoMotion } from './plantillas';
import type { IdPlantilla, ValorCampo, ValoresMotion } from './tipos';

export type ResultadoCampo = { ok: true; valor: ValorCampo } | { ok: false; motivo: string };

export function validarCampoDelPanel(
  plantilla: IdPlantilla,
  clave: string,
  valor: unknown,
  { valores, aspecto }: { valores: ValoresMotion; aspecto?: number },
): ResultadoCampo {
  const r = validarCampoMotion(plantilla, clave, valor);
  if (!r.ok || typeof r.valor !== 'string' || !aspecto) return r;
  const desborde = (v: ValoresMotion) => desbordeDelCuadro(armarEscena({ plantilla, valores: v }, { aspecto, video: true }));
  const nuevo = desborde({ ...valores, [clave]: r.valor });
  if (nuevo > 1e-3 && nuevo > desborde(valores) + 1e-6) {
    const rotulo = (camposDe(plantilla).find((c) => c.clave === clave)?.rotulo ?? clave).replace(/ \(.*$/, '');
    return { ok: false, motivo: `${rotulo}: es muy largo para el cuadro aun con la letra más chica; acórtalo (tiene ${r.valor.length} caracteres)` };
  }
  return r;
}
