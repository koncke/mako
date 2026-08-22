// =============================================================================
// Recursos de BlueHacker 2.0 — se INYECTAN desde catalogo.ts
// =============================================================================
// ⚠️ NO van dentro de curso-bluehacker.ts, y no es una preferencia de estilo: ese
// archivo lo REESCRIBE ENTERO `scripts/curso-a-portal.mjs` en cada corrida, y el
// generador arma `recursos` mirando la carpeta local `recursos/`/`pdfs/`. Como esos
// archivos no existen en C:\cursos (los 8 PDFs viven solo en Drive), el generador
// emite `recursos: []`.
//
// Eso ya pasó: el 22/08/2026, al migrar el curso de 233 a 404 clases, la regeneración
// borró estos 8 recursos de la ficha publicada. No lo cazó ningún test ni ningún
// chequeo — lo vio el dueño, mirando la pantalla. Es el mismo patrón que RECURSOS_UGC.
//
// ⚠️ Y el `clases: []` de cada recurso está REMAPEADO a la numeración de 404. Los
// números originales eran de la ficha de 233 y el curso se renumeró entero: copiarlos
// tal cual deja cada PDF colgado de clases equivocadas, que se ve bien y está mal. El
// cruce se hizo por `videoId`, que es lo único estable entre las dos numeraciones.

import type { Recurso } from './curso';

export const RECURSOS_BLUEHACKER: Recurso[] = [
  {
    slug: 'bh-1-introduccion-y-estructura-0',
    label: '1. Introducción y estructura',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · Nicho y Oferta High Ticket (NTPV).',
    driveId: '1m5YgRzsuPK1FS2bnI_dWTocA-M0kqUrp',
    clases: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 197, 198, 199, 200, 201, 202, 204, 211, 214, 215, 216, 217, 218, 219, 220, 221, 223, 224, 225],
  },
  {
    slug: 'bh-2-1-definicion-de-nicho-y-cliente-ideal-1',
    label: '2.1. Definición de Nicho y Cliente Ideal',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · Nicho y Oferta High Ticket (NTPV).',
    driveId: '1wA6POgQHtERqg1cQuZEEVwzEVgpPAFbF',
    clases: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 197, 198, 199, 200, 201, 202, 204, 211, 214, 215, 216, 217, 218, 219, 220, 221, 223, 224, 225],
  },
  {
    slug: 'bh-2-2-definicion-de-nicho-y-cliente-ideal-2',
    label: '2.2. Definición de Nicho y Cliente Ideal',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · Nicho y Oferta High Ticket (NTPV).',
    driveId: '12l19G92uHe0wo6Z-anB0sndBsC-ZPCjz',
    clases: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 197, 198, 199, 200, 201, 202, 204, 211, 214, 215, 216, 217, 218, 219, 220, 221, 223, 224, 225],
  },
  {
    slug: 'bh-3-definicion-de-transformacion-high-tick-3',
    label: '3. Definición de Transformación High Ticket',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · Nicho y Oferta High Ticket (NTPV).',
    driveId: '1QHECt0wI7FFZWOKBXWAT5erEANPji3wg',
    clases: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 197, 198, 199, 200, 201, 202, 204, 211, 214, 215, 216, 217, 218, 219, 220, 221, 223, 224, 225],
  },
  {
    slug: 'bh-definicion-de-precio-high-ticket-4',
    label: 'Definición de Precio High Ticket',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · Nicho y Oferta High Ticket (NTPV).',
    driveId: '1wa1ATFt77k5fsKiMSPbc7jScq10MUXL0',
    clases: [183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 197, 198, 199, 200, 201, 202, 204, 211, 214, 215, 216, 217, 218, 219, 220, 221, 223, 224, 225],
  },
  {
    slug: 'bh-5-conversion-de-desconocidos-a-clientes--5',
    label: '5. Conversión de desconocidos a clientes - M3_ Maestría de Ventas',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · Maestría de Ventas High Ticket.',
    driveId: '1FFGsLtKuBLZwtoLznD6VSJm_ChIqgmy-',
    clases: [301, 302, 303, 304, 305, 306, 307, 308, 309],
  },
  {
    slug: 'bh-estructura-de-vsl-funnel-6',
    label: 'Estructura de VSL Funnel',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · VSL Funnel.',
    driveId: '1Xy4xzAVlnwLZKQFJG4te8r7MVcWfF0JY',
    clases: [313, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328],
  },
  {
    slug: 'bh-1-gbh-estrategia-email-marketing-7',
    label: '1. GBH - Estrategia Email Marketing',
    tipo: 'pdf',
    cardDesc: 'Material del módulo · VSL Funnel.',
    driveId: '1HX6FTf05mw4EsFHgYOHfZcqkjRSNRrMG',
    clases: [313, 315, 316, 317, 318, 319, 320, 321, 322, 323, 324, 325, 326, 327, 328],
  },
];
