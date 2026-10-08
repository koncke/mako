import 'server-only';

// =============================================================================
// puerta-curso — quién puede llamar a las server actions de la tab Curso
// =============================================================================
// Las tres preguntas que abren cada action de ./actions.ts, ./adjuntos-actions.ts y
// ./modulos-actions.ts: ¿puede MIRAR la tab?, ¿puede EDITAR el curso? (admin del workspace) y ¿el
// producto es de ESTE workspace?
//
// ⚠️ UNA REGLA, UN LUGAR (08/10/2026). Hasta acá vivían PRIVADAS en ./actions.ts y COPIADAS en
// ./adjuntos-actions.ts, con un test que comparaba los cuerpos para que no se separaran; la tercera
// copia (los módulos) era la que iba a quedar vieja. Una copia vigilada sigue siendo una copia: la
// cura es que no haya ninguna (tests/curso-adjuntos.test.ts fija que las tres importan de acá).
//
// ⚠️ SIN 'use server', A PROPÓSITO, y con 'server-only': esto no es una action que el navegador
// pueda llamar, es un helper del server. Con 'use server' cada una sería un endpoint más.
//
// ⚠️ CADA ACTION AUTORIZA SOLA, y no por prolijidad: una server action es un POST que se puede
// invocar directo, sin pasar por la página (Next 16,
// node_modules/next/dist/docs/01-app/02-guides/data-security.md). Que el botón sólo se dibuje para
// un admin no protege nada — el guard de la página (`requireCapa`) tampoco corre ahí.

import { getRolWsEfectivo, getCapaActual, adminDeWorkspaceActual, getTenantDb } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';

/** ¿Puede MIRAR la tab? La misma pregunta que `requireCapa('customer-success')`, sin redirect. */
export async function puedeVer(): Promise<string | null> {
  if (!(await getRolWsEfectivo())) return 'Tu sesión venció.';
  if (!tabEnCapa('customer-success', await getCapaActual())) return 'Tu plan no incluye Customer Success.';
  return null;
}

/** ¿Puede EDITAR el curso? Ver la tab, y además ser admin de este workspace. */
export async function puedeEditar(): Promise<string | null> {
  const no = await puedeVer();
  if (no) return no;
  if (!(await adminDeWorkspaceActual())) return 'Solo un administrador edita el curso.';
  return null;
}

/** ¿El producto es de ESTE workspace? `getTenantDb` acota; acá se rebota antes de escribir. */
export async function productoPropio(productoId: number): Promise<string | null> {
  if (!Number.isInteger(productoId) || productoId <= 0) return 'Falta el producto.';
  const db = await getTenantDb();
  const { data, error } = await db.from('productos').select('id').eq('id', productoId).maybeSingle();
  if (error) return error.message;
  return data ? null : 'Ese producto no es tuyo.';
}
