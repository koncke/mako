// =============================================================================
// Los tipos del panel de admin
// =============================================================================
// Lo que devuelven /api/admin/workspaces y /api/admin/usuarios, que es de donde
// sale todo lo que esta pantalla dibuja. Viven aparte desde el 27/09/2026 porque
// ahora los leen tres archivos: la vista, la ficha de un cliente y la seccion de
// super admins.

import type { CapaId } from '@/lib/capas';

export type Workspace = {
  id: number; nombre: string; slug: string | null;
  estado: 'activo' | 'pausado'; capa: CapaId;
  created_at: string;
  /** Cuantas personas tiene adentro. Lo cuenta el endpoint, no el navegador. */
  usuarios: number;
};

/** Quien esta mirando. `legacy` = entro con la cookie compartida vieja. */
export type Sesion = { email: string; legacy: boolean };
