// =============================================================================
// El texto del bloque de preguntas: con su formato y sus links clickeables (22/10/2026)
// =============================================================================
// Martín, usando el bloque: «me escribió el link de google ai, pero no es clickeable». También los que vienen sin https
// («aistudio.google.com/apikey»: lib/links-texto.ts → conDominiosComoLinks). Lo usan los cuerpos del bloque (PreguntasDelChat.tsx
// y Pregunta.tsx), por eso vive aparte: así ninguno importa al otro para esto.

import type { ReactNode } from 'react';
import { conFormato } from '@/app/_components/Markdown';
import { conDominiosComoLinks } from '@/lib/links-texto';

/** Un texto del bloque con su formato y sus links clickeables, también los que vienen sin https. */
export const conLinks = (texto: string, k: string): ReactNode => conFormato(conDominiosComoLinks(texto), k);
