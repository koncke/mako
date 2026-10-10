// =============================================================================
// El ícono de cada CATEGORÍA de mensaje de MaKo, en la pantalla
// =============================================================================
// Sexta tanda, general 10 (09/10/2026): «En los desplegables, también siempre con ÍCONO». Y la regla
// de la casa desde el 06/10: «No pongas emoji, siempre iconos». La lista de mensajes, su detalle y los
// dos desplegables de categoría pintaban `EMOJI_CATEGORIA` (📊 🔔 ⚡ ❓); ahora pintan esto.
//
// ⚠️ `EMOJI_CATEGORIA` (lib/avisos-catalogo.ts) SE QUEDA: es la primera línea del WhatsApp que manda
//    MaKo, y un mensaje de WhatsApp no puede llevar un SVG. Son dos superficies y dos marcas para la
//    misma categoría; lo que no cambia es el ORDEN ni el nombre (`CATEGORIAS_AVISO`).
// =============================================================================

import type { CategoriaAviso } from '@/lib/avisos-catalogo';
import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export const ICONO_CATEGORIA: Readonly<Record<CategoriaAviso, NombreIconoMenu>> = {
  reporte: 'grafico',
  aviso: 'avisar',
  accion: 'accion',
  pregunta: 'pregunta',
};
