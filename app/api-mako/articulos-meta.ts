// =============================================================================
// /api-mako › Documentación — QUÉ artículos hay (sin el contenido)
// =============================================================================
// Aparte de Articulos.tsx a propósito: ése es un componente cliente, y una función de un
// módulo 'use client' no se puede LLAMAR desde el server (page.tsx necesita `esArticulo`
// para leer `?art=`; Next tira «Attempted to call esArticulo() from the server»).
// =============================================================================

export const ARTICULOS = {
  'inicio-rapido': { titulo: 'Inicio rápido para la API REST de MaKo', corto: 'Inicio rápido', lead: 'Aprende a hacer tu primer pedido a la API REST de MaKo.' },
  'primeros-pasos': { titulo: 'Primeros pasos con la API REST', corto: 'Primeros pasos', lead: 'Aprende a usar la API REST de MaKo: los pedidos, las respuestas y el catálogo.' },
  autenticacion: { titulo: 'Autenticarse en la API REST', corto: 'Autenticación', lead: 'Para usar la API necesitas un token de acceso personal.' },
  permisos: { titulo: 'Permisos que necesitan los tokens detallados', corto: 'Permisos para tokens detallados', lead: 'Para cada permiso, los endpoints que lo piden.' },
  limites: { titulo: 'Límites de uso de la API REST', corto: 'Límites de uso', lead: 'Cuántos pedidos puedes hacer y qué pasa si te pasas.' },
  versiones: { titulo: 'Versiones de la API', corto: 'Versiones de la API', lead: 'Cómo se versiona la API y cómo eliges la versión de un pedido.' },
  openapi: { titulo: 'Descripción OpenAPI', corto: 'Descripción OpenAPI', lead: 'La API entera descrita en OpenAPI 3.1, para importarla en n8n, Postman o un generador de SDK.' },
  'buenas-practicas': { titulo: 'Buenas prácticas para usar la API REST', corto: 'Buenas prácticas', lead: 'Cómo integrarte con la API de MaKo sin sorpresas.' },
  problemas: { titulo: 'Solución de problemas de la API REST', corto: 'Solución de problemas', lead: 'Qué significa cada error y cómo arreglarlo.' },
} as const;

export type SlugArticulo = keyof typeof ARTICULOS;
export const esArticulo = (s: string | null | undefined): s is SlugArticulo => !!s && s in ARTICULOS;

/** Los grupos de la barra lateral, en el orden de GitHub. */
export const GRUPOS_ARTICULOS: { titulo: string; articulos: SlugArticulo[] }[] = [
  { titulo: 'Acerca de la API', articulos: ['versiones', 'openapi'] },
  { titulo: 'Uso de la API', articulos: ['primeros-pasos', 'limites', 'buenas-practicas', 'problemas'] },
  { titulo: 'Autenticación', articulos: ['autenticacion', 'permisos'] },
];

