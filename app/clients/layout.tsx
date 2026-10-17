// =============================================================================
// /clients — la tab Clients: la cabecera (el programa y las sub-tabs) arriba de cada sub-tab
// =============================================================================
// Martín, 17/10/2026: «Quiero unificar completamente la tab de "Cursos" con "Comunidad" y con "Clientes" y que la
// tab en la sidebar se llame "Clients" y que esté dentro de la sección "Operate"... Como lo tiene Skool». El diseño,
// en docs/diseno-clients.md.
//
// El layout se queda puesto al cambiar de sub-tab (sólo cambia la página de abajo), así que la cabecera no se
// re-dibuja ni vuelve a pedir nada. Lo que lee —los programas, con el nombre de su curso y su estilo— es lo mismo
// que lee cada pantalla, y NO TIRA: sin programas la cabecera dice «Clients» y las sub-tabs siguen ahí. El guard
// de cada pantalla (requireCapa) lo hace su página: un layout no protege nada.

import type { ReactNode } from 'react';
import { productosDeLaEntrega } from '@/app/customer-success/entrega';
import { nombresDeCursos } from '@/lib/curso-nombre-datos';
import { SIN_NOMBRE_EQUIPO } from '@/lib/curso-nombre';
import { estilosLeidos } from '@/lib/curso-estilo-datos';
import { adminDeWorkspaceActual } from '@/lib/workspace';
import { ClientsShell, type ProgramaClients } from './ClientsShell';

async function programasDeClients(): Promise<ProgramaClients[]> {
  try {
    // La MISMA lista y el MISMO orden que el kanban, el Classroom y la comunidad: el primero es el que abren
    // las tres sin `?producto=`, así que es también el que dice la cabecera.
    const lista = await productosDeLaEntrega();
    if (!lista.length) return [];
    const ids = lista.map((p) => p.id);
    const [nombres, estilos] = await Promise.all([
      nombresDeCursos(ids, { conTitulo: true }).catch(() => new Map<number, string>()),
      estilosLeidos(ids).then((r) => r.estilos).catch(() => new Map()),
    ]);
    return lista.map((p) => {
      const e = estilos.get(p.id);
      return { id: p.id, nombre: nombres.get(p.id) ?? SIN_NOMBRE_EQUIPO, acento: e?.acento ?? null, fuente: e?.fuente ?? null, portada: e?.portada ?? null };
    });
  } catch (e) {
    console.warn('[clients] no pude leer los programas para la cabecera:', e instanceof Error ? e.message : e);
    return [];
  }
}

export default async function ClientsLayout({ children }: { children: ReactNode }) {
  const [programas, admin] = await Promise.all([
    programasDeClients(),
    adminDeWorkspaceActual().catch(() => null),
  ]);
  return <ClientsShell programas={programas} puedePersonalizar={admin != null}>{children}</ClientsShell>;
}
