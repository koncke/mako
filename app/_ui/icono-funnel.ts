// =============================================================================
// El ícono de un FUNNEL (un CRM), en un solo lugar
// =============================================================================
// Martín, 12/10/2026 (punto 24 del CRM): «Que el desplegable de FUNNELS… siempre tenga el ícono del cubo». Y el
// 17/10/2026, viendo «De qué funnels» con el ícono de las etapas en cada renglón: «Los íconos del CRM no son esos... Es
// el cubo que tenemos en el CRM... Hay que unificar los íconos».
//
// LA REGLA: un funnel se dibuja con el CUBO (`producto` del set de app/_ui/iconos-menu.tsx), y va en el CONTROL que
// elige funnels (el `icono` del desplegable, el de la sección de un árbol, el de la píldora del teléfono), no repetido
// en cada renglón: cada funnel lo nombra el negocio, y el mismo dibujo en cada opción no distingue a ninguno.
// ⚠️ El EMBUDO (`Icon name="funnel"`) NO es un funnel del CRM: es el ícono de FILTRAR, y así se queda.
//
// Puro y sin JSX: lo puede pedir una lista armada en un `.ts`. El dibujo, `IconoFunnel` (./iconos-menu.tsx).
// tests/icono-funnel.test.ts fija que cada selector de funnels lo use.

import type { NombreIconoMenu } from './iconos-menu';

export const ICONO_FUNNEL = 'producto' as const satisfies NombreIconoMenu;
