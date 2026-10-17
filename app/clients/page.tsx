// =============================================================================
// /clients — Clients › Clients: el kanban de la entrega, la tabla y el avance (la sub-tab que abre)
// =============================================================================
// Martín, 17/10/2026: «Quiero unificar completamente la tab de "Cursos" con "Comunidad" y con "Clientes" y que la
// tab en la sidebar se llame "Clients"». La pantalla vive en app/customer-success/pantalla.tsx (D2 de
// docs/diseno-clients.md: el código no se mudó de carpeta) y la cabecera con las sub-tabs, en ./layout.tsx.

import { PantallaClientes } from '@/app/customer-success/pantalla';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clients' };

export default PantallaClientes;
