// Los tamaños del Image Editor que la API de MaKo ofrece por nombre (lib/api-mako/areas/imagen.def.ts).
// Archivo propio y sin imports: una `.def.ts` lo lee el generador de la referencia y los tests, y no
// puede arrastrar módulos del server (AGENTS.md, «una .def.ts no importa valores de módulos con server-only»).

/** Los tamaños que la API ofrece por nombre (los de Canva más pedidos; la lista entera vive en el editor). */
export const TAMANOS_API: Readonly<Record<string, { ancho: number; alto: number; nombre: string }>> = {
  publicacion_instagram: { ancho: 1080, alto: 1080, nombre: 'Publicación de Instagram' },
  publicacion_vertical: { ancho: 1080, alto: 1350, nombre: 'Publicación de Instagram (4:5)' },
  historia: { ancho: 1080, alto: 1920, nombre: 'Historia de Instagram' },
  anuncio_facebook: { ancho: 1200, alto: 628, nombre: 'Anuncio de Facebook' },
  miniatura_youtube: { ancho: 1280, alto: 720, nombre: 'Miniatura de YouTube' },
  presentacion: { ancho: 1920, alto: 1080, nombre: 'Presentación (16:9)' },
};
