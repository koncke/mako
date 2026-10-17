// =============================================================================
// /clients/classroom — Clients › Classroom: el curso de cada programa, con el diseño de CURSO
// =============================================================================
// La pantalla vive en app/customer-success/curso/pantalla.tsx (docs/diseno-clients.md, D2). La ruta vieja
// (/customer-success/curso) redirige acá.

import { PantallaClassroom } from '@/app/customer-success/curso/pantalla';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Classroom · Clients' };

export default PantallaClassroom;
