// =============================================================================
// /clients/classroom/preview — el curso como lo ve el alumno (sin cabecera de Clients: tiene su propia barra)
// =============================================================================
// La pantalla vive en app/customer-success/curso/vista/pantalla.tsx (docs/diseno-clients.md, D2). La ruta vieja
// (/customer-success/curso/vista) redirige acá.

import { PantallaVistaAlumno } from '@/app/customer-success/curso/vista/pantalla';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Vista del alumno · Classroom' };

export default PantallaVistaAlumno;
