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
  /**
   * Cuántos CLIENTES tiene en su propio CRM (sus leads en `ganado`). Lo cuenta el
   * endpoint, por el mismo motivo que `usuarios`: es una consulta agrupada y no 10.
   *
   * ⚠️ NO es su cartera de agencia. Son dos números distintos y en el ws13 valen 2 y 1:
   * sus clientes son los que él atiende, su cartera son los que además tienen cuenta de
   * MaKo abierta por él. El de la tarjeta es el primero, que es el que esa agencia ve en
   * su propia tab de Clientes.
   */
  clientes: number;
  /** Su cara (mig 0179). Mismo formato y mismos dibujantes que la de un proyecto. */
  portada: string | null;
  portada_y: number | null;
  icono: string | null;
  avatar_y: number | null;
};

/** Quien esta mirando. `legacy` = entro con la cookie compartida vieja. */
export type Sesion = { email: string; legacy: boolean };

/**
 * Un usuario tal como lo devuelve /api/admin/usuarios: la fila de la base MAS el
 * Gravatar, que el endpoint calcula.
 *
 * ⚠️ NO ES UNA COLUMNA. Se deriva del email con un hash y existe por una sola
 * razón: antes del primer login no hay NINGUNA foto de nadie —`foto_url` la llena
 * Google al entrar— así que es lo único que puede poner una cara en la tarjeta de
 * un cliente recién dado de alta. Y falla suave: se pide con `d=404` y `Marca`
 * cae a las iniciales, porque la mayoría de la gente no tiene uno.
 */
/**
 * Un usuario con su CARA ya resuelta por el server.
 *
 * `cara` es lo que se dibuja (su foto elegida, o la de su Gravatar, o nada) y sale de
 * `caraDeUsuario` (lib/gravatar.ts). ⚠️ No se recalcula acá: el orden de precedencia
 * vive en un lugar, o dos pantallas terminan mostrando caras distintas de la misma
 * persona. `gravatar` viaja aparte para poder distinguir «eligió esta foto» de «es la
 * de su email».
 */
export type UsuarioConCara = import('@/lib/usuarios').Usuario & {
  gravatar?: string;
  cara?: string | null;
};
