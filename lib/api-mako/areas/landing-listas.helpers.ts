// =============================================================================
// api-mako/areas/landing-listas.helpers — las listas cerradas de las operaciones del editor (tanda 7)
// =============================================================================
// Las que declaran los `enum` de landing-editor.def.ts y validan los planes de landing-contenido.helpers.ts:
// UNA lista para las dos. Aparte y livianas a propósito: la def no carga el editor (ProseMirror, el saneo)
// sólo para saber qué acciones existen. SIN server-only (lo importan la def, los helpers y el test).
// =============================================================================

import { OBJETIVOS_LANDING, type ObjetivoLanding } from '@/lib/landing-spec';
// Puro (sin 'use client' ni server-only): el catálogo de animaciones, el CONTRATO del panel «Animar».
import { IDS_EFECTO, SIN_ANIMACION } from '@/lib/editor-landing/animaciones';

/** acomodar_seccion_landing. */
export const ACCIONES_SECCION = ['mover', 'duplicar', 'ocultar', 'mostrar', 'borrar'] as const;
/** acomodar_bloque_landing. */
export const ACCIONES_BLOQUE = ['mover', 'duplicar', 'borrar'] as const;
/** acomodar_pagina_landing (el panel «Páginas»). */
export const ACCIONES_PAGINA = ['agregar', 'renombrar', 'mover', 'duplicar', 'borrar', 'inicio'] as const;
/**
 * agregar_bloque_landing. Los de texto llevan su texto; los de MaKo (agenda, video, pago, formulario) entran
 * como los inserta el menú «/». Lo demás del catálogo se arma en el editor o con editar_landing_con_ia.
 */
export const BLOQUES_API = ['titulo', 'subtitulo', 'texto', 'vinetas', 'numerada', 'cita', 'boton', 'pago', 'formulario', 'agenda', 'video', 'imagen', 'separador'] as const;

/** generar_landing_con_ia y configurar_landing: lo que la persona llama al documento. */
export const FORMATOS_IA = ['landing', 'presentacion'] as const;
/** Cómo se usa un texto largo (la opción «Tu texto» del cuadro, ex «Pegar texto»). */
export const MODOS_TEXTO_API = ['generar', 'condensar', 'conservar'] as const;
/** Los objetivos de «Crear con IA» (lib/landing-spec.ts), no los del alta desde un diseño. */
export const OBJETIVOS_GENERAR: readonly ObjetivoLanding[] = OBJETIVOS_LANDING.map((o) => o.value);
export const TEXTOS_POR_SECCION_API = ['breve', 'medio', 'detallado', 'extenso'] as const;
export const IMAGENES_API = ['stock', 'marcadores', 'ninguna'] as const;

/** cambiar_animacion_landing: «heredar» = la sección vuelve a usar el estilo de la landing (null en `animacion`). */
export const HEREDAR_ANIMACION = 'heredar';
/** El `efecto` de cambiar_animacion_landing: los 17 del catálogo, «ninguna» (quieta) y «heredar». */
export const EFECTOS_API: readonly string[] = [...IDS_EFECTO, SIN_ANIMACION, HEREDAR_ANIMACION];
