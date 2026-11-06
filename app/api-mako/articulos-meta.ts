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
  'migrar-curso': { titulo: 'Migrar un curso a MaKo con Claude', corto: 'Migrar un curso con Claude', lead: 'Pasa un curso entero (módulos, clases, videos, descripciones y tareas) pidiéndoselo a Claude, sin cargarlo a mano.' },
  // Ticket #29 de Leandro (29/10/2026): «que /docs explique las palabras clave del disparador y el "Contiene / Es exactamente"».
  'instagram-palabras-botones': { titulo: 'Palabras clave y botones en las automatizaciones de Instagram', corto: 'Palabras clave y botones de Instagram', lead: 'Qué comentario arranca una automatización, y cómo andan los botones de un DM.' },
  // La campaña de email de Mauricio (4/11/2026): todo por la API, desde su Claude.
  'campana-email': { titulo: 'Una campaña de email con Claude', corto: 'Campaña de email con Claude', lead: 'Del dominio a la campaña activa, pidiéndoselo a Claude: el CRM que sigue a cada email, la secuencia, la prueba y el ritmo.' },
  // La llamada con Thiago (29/10/2026, docs/promesas/2910-llamada-thiago.md): una agencia con 27 clientes que migra desde su CRM.
  'migrar-crm': { titulo: 'Migrar tu CRM con Claude', corto: 'Migrar tu CRM con Claude', lead: 'Pasa los contactos de tu CRM anterior a MaKo pidiéndoselo a Claude: en su etapa, con su fecha y sus UTM, sin repetir a nadie y sin escribirle a ninguno.' },
} as const;

export type SlugArticulo = keyof typeof ARTICULOS;
export const esArticulo = (s: string | null | undefined): s is SlugArticulo => !!s && s in ARTICULOS;

/** Los grupos de la barra lateral, en el orden de GitHub. */
export const GRUPOS_ARTICULOS: { titulo: string; articulos: SlugArticulo[] }[] = [
  { titulo: 'Acerca de la API', articulos: ['versiones', 'openapi'] },
  { titulo: 'Uso de la API', articulos: ['primeros-pasos', 'limites', 'buenas-practicas', 'problemas'] },
  { titulo: 'Autenticación', articulos: ['autenticacion', 'permisos'] },
  { titulo: 'Guías', articulos: ['migrar-crm', 'migrar-curso', 'campana-email', 'instagram-palabras-botones'] },
];

/**
 * EL EJEMPLO DE UN LOTE, tal como lo manda Claude. tests/api-mako-migrar-crm-guia.test.ts lo pasa por el validador REAL de
 * `migrar_contactos` (lib/api-mako/validar.ts): si un campo cambia de nombre, la guía deja de pasar.
 */
export const EJEMPLO_LOTE_MIGRACION = {
  crmAnterior: 'GoHighLevel',
  contactos: [
    { idExterno: 'c_8fK2', nombre: 'Lucía Fernández', email: 'lucia@ejemplo.com', telefono: '+34 600 000 000', etapa: 'lead', fechaOriginal: '2025-03-14', utm_source: 'facebook', utm_campaign: 'primavera' },
  ],
};
