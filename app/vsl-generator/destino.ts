// =============================================================================
// vsl-generator/destino — a dónde lleva la ruta del VSL Generator (PURO, 18/11/2026)
// =============================================================================
// El VSL Generator NO tiene un motor propio, y no se le escribe uno. Desde el 28-29/10/2026 un VSL se escribe en el
// Copywriter, con las estructuras de lib/vsl-estructuras.ts:
//   · las plantillas de «Nueva» del grupo VSL (lib/copywriter/plantillas.ts → `vsls`): cada página nace con una sección por
//     etiqueta (`attrs.seccion` = la etiqueta EXACTA, lib/copywriter/doc.ts → `tituloDeSeccion`), que es el contrato con el
//     VSL Analyst;
//   · MaKo la escribe desde el chat de la página («Editar», lib/copywriter/ia.ts), con la voz del negocio, el largo de su
//     duración y sus avisos (cifras sin fuente, voseo, inglés);
//   · y la API ya lo hace (`listar_plantillas_copywriter`, `crear_documento_copywriter` con `plantillaId`,
//     `editar_documento_copywriter`, `replicar_link_o_texto_copywriter` con tipo `vsl`).
// El plan de agosto (app/admin/dev/vsl-generator/bitacora.ts: lib/vsl-writer.ts, /api/vsl-generator y una tabla de
// borradores) es de antes del Copywriter: escribirlo hoy sería una SEGUNDA implementación de «escribir un VSL», con su
// propio guardado, sin ninguna de esas guardas (AGENTS.md: «lo que se agrega va al MÓDULO QUE YA EXISTE, no al lado»).
//
// Por eso la ruta hace lo que /youtube-writer desde el 28/10/2026 (1d5bc178c): quien puede usar el Copywriter va derecho a
// sus plantillas, con las de VSL primero (`?nuevo=vsl`: app/copywriter/page.tsx → `tipoInicial`; nada se crea por abrir un
// link). Los demás siguen viendo el «Coming soon».
//
// SIN 'server-only': lo leen las dos páginas (/vsl-generator y la vieja /vsl-writer) y su test.
// =============================================================================

import type { TipoGuion } from '@/lib/copywriter/tipos';

/** El tipo de página del Copywriter que es un VSL. */
export const TIPO_DEL_VSL: TipoGuion = 'vsl';

/** Las plantillas del Copywriter, con las de VSL primero. */
export const DESTINO_VSL = `/copywriter?nuevo=${TIPO_DEL_VSL}`;

/** A dónde va quien abre /vsl-generator: al Copywriter si lo puede usar; null = se queda en el «Coming soon». */
export function destinoDelVslGenerator(puedeUsarCopywriter: boolean): string | null {
  return puedeUsarCopywriter ? DESTINO_VSL : null;
}
