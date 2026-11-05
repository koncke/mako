// =============================================================================
// image-editor/fuente-del-editor — una fuente como la tiene el editor de imágenes, o null si no la tiene (PURO)
// =============================================================================
// Una familia que el editor no tiene cae a la del sistema EN SILENCIO (app/image-editor/mako/fuentes.ts), así que lo que la
// marca del negocio pide (lib/marca/kits.ts) pasa por acá antes de ir a un diseño o a un prompt. Lo usan el chat de Image,
// los carruseles de MaKo y la portada del editor.
// =============================================================================

import { FUENTES } from '@/app/image-editor/mako/fuentes';

const POR_NOMBRE = new Map(FUENTES.map((f) => [f.family.toLowerCase(), f.family] as const));

export const fuenteDelEditorDeImagen = (f: string): string | null => POR_NOMBRE.get(f.trim().toLowerCase()) ?? null;
