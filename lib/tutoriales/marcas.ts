// =============================================================================
// Las MARCAS de los tutoriales de cada pestaña (`data-recorrido`), en UN lugar (18/11/2026)
// =============================================================================
// El tutorial de una pestaña (lib/tutoriales) señala cada paso con un selector. Donde el control no tiene
// un atributo propio y estable (un `aria-label`, un `href`), se le pone `data-recorrido="tour-<pestaña>-<cosa>"`.
// La MISMA marca va en la computadora y en el teléfono (MaKo Mobile, /m), así el mismo paso anda en los dos.
//
// Los nombres viven ACÁ y no escritos a mano en cada componente: el componente y el tutorial importan la
// misma constante, y tests/tutoriales-pestanas.test.ts comprueba que cada marca que pide un tutorial se
// ponga en algún componente. Una marca que se escribe distinta en dos lados no da error: el paso se saltea.
// =============================================================================

/** Las marcas fijas, por pestaña. */
export const MARCA = {
  opsCenterQueHagoHoy: 'tour-ops-center-que-hago-hoy',
  crmVerInfo: 'tour-crm-ver-info',
  crmReuniones: 'tour-crm-reuniones',
  /** «Mostrar más integraciones»: la grilla de la computadora muestra doce sin conectar (app/integraciones/IntegracionesBoard.tsx). */
  integracionesMas: 'tour-int-mas',
  avatarAntes: 'tour-avatar-antes',
  avatarGenerar: 'tour-avatar-generar',
  copywritingPegar: 'tour-copywriting-pegar',
  /** «Mis landings» en la computadora (app/web-generator/OutliersLandings.tsx); en el teléfono es el link «Tus landings» (`?ver=lista`). */
  webMisLandings: 'tour-web-mis-landings',
  /** Prioridades · Tareas · Proyectos · Recurrentes del Plan de la computadora (en el teléfono: `.m-seg[aria-label="Vista"]`). */
  planVistas: 'tour-plan-vistas',
} as const;

/** Una sección de Settings (lib/ajustes-secciones.ts: `info`, `seguridad`, `instalar`, `equipo`, `integraciones`…). */
export const marcaSettings = (clave: string) => `tour-settings-${clave}`;

/** Una integración de /integraciones (su `key` de lib/integraciones-catalogo.ts: `whatsapp`, `meta`, `calendly`…). */
export const marcaIntegracion = (clave: string) => `tour-int-${clave}`;

/** El nombre de una tab en una marca: «AI Avatar» → `ai-avatar`, «Offer» → `offer`. */
export const slugTab = (tab: string) => tab.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Lo de una pantalla de crear (app/_crear/PantallaCrear.tsx, y su par del teléfono): `charla` (el chat con MaKo) y
 * `proyectos` (la flecha que abre la lista de proyectos). Offer → `tour-offer-charla`, `tour-offer-proyectos`.
 */
export const marcaCrear = (tab: string, cosa: 'charla' | 'proyectos') => `tour-${slugTab(tab)}-${cosa}`;

/** El selector de una marca, para los pasos de los tutoriales. */
export const conMarca = (marca: string) => `[data-recorrido="${marca}"]`;
