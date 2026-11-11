// =============================================================================
// El estudio de AI Avatar: lo que comparten la computadora y el teléfono (módulo PURO, sin React)
// =============================================================================
// 29/10/2026, Martín: «replica a higgsfield tal cual». Las piezas de Higgsfield se VEN todas, en su lugar (la barra de
// prompt con Modelo · Formato · Cantidad · Personaje · Preset · Generar; el «Motion»; el constructor de personaje), y
// la que no tiene motor en MaKo lo dice en UNA línea, con la misma frase en las dos pantallas. Lo que sí tiene motor:
// el look (imagen de Flow con la cara de la foto, gratis) y el video (el plan del Video Generator, con créditos).
//
// SIN `server-only` y sin 'use client': lo importan app/ai-avatar/Estudio.tsx y app/m/ai-avatar (AGENTS.md: lo que el
// teléfono reusa de escritorio no puede vivir en un módulo 'use client').

import type { Categoria } from './plantillas';

/** Cada pieza de Higgsfield que MaKo todavía no genera, con la línea que la persona lee al tocarla. */
export const SIN_MOTOR = Object.freeze({
  modelo: 'Otros modelos: no disponible todavía.',
  formato: '3:4 y 16:9: no disponible todavía. Tu avatar se anima en vertical.',
  cantidad: 'Más de una imagen por vez: no disponible todavía.',
  calidad: '2K y 4K: no disponible todavía.',
  voz: 'Tu voz clonada: no disponible todavía. Tu avatar habla con la voz de Flow.',
  movimiento: 'Copiar el movimiento de un video: no disponible todavía.',
  personaje: 'Diseñar un personaje sin foto: no disponible todavía. MaKo usa tu cara.',
});

export type PiezaSinMotor = keyof typeof SIN_MOTOR;

/**
 * Qué foto sirve, dicho donde se sube (11/11/2026). El lugar del personaje era un «+» solo: la persona no sabía que la cara
 * tiene que verse entera y de frente, que es lo que decide si el avatar se le parece (HeyGen lo dice en el mismo paso).
 */
export const CONSEJO_FOTO = 'Una foto tuya de frente, sola y con buena luz.';

/** El modelo que genera hoy: el único de la lista. */
export const MODELO = Object.freeze({ nombre: 'Nano Banana', de: 'Google Flow' });

/** Los dos degradados de la baldosa de un preset que todavía no tiene su imagen de ejemplo, por categoría. */
export const TONO_CATEGORIA: Readonly<Record<Categoria, readonly [string, string]>> = Object.freeze({
  'UGC y TikTok': ['#5E81AC', '#88C0D0'],
  Instagram: ['#B48EAD', '#D08770'],
  'Cámara': ['#4C566A', '#81A1C1'],
  Negocio: ['#2F6FED', '#8FBCBB'],
  Producto: ['#A3BE8C', '#EBCB8B'],
  'Clima y luz': ['#D08770', '#EBCB8B'],
});
