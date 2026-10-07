import 'server-only';

// =============================================================================
// puerta — quién puede llamar a las server actions de Customer Success
// =============================================================================
// La MISMA pregunta que la página (`requireCapa('customer-success')` en ./page.tsx), sin el
// redirect: hay una sesión viva y la capa de este workspace incluye Customer Success.
//
// ⚠️ POR QUÉ HACE FALTA SI LA PÁGINA YA LO PREGUNTA. Una server action es un POST que se puede
// mandar directo, sin pasar por la página (Next 16: node_modules/next/dist/docs/01-app/
// 02-guides/data-security.md). Hasta el 06/10/2026 las 16 actions de ./actions.ts preguntaban
// si el lead era de ESTE workspace y nada más: un usuario de un workspace con capa 'pm' —la
// única que no trae esta tab— podía crear clientes, moverlos de etapa, leer sus pagos o correr
// la autoasignación con un POST, aunque la página lo rebotara. Siempre sobre su propio
// workspace (el aislamiento entre inquilinos ya estaba), pero con una tab que no compró.
//
// ⚠️ UNA REGLA, UN LUGAR. La usan ./actions.ts (primera línea de cada export) y la `puerta` de
// ./curso-ficha-actions.ts (que además pregunta si el lead es un cliente ganado). Lo fija
// tests/cs-acciones-puerta.test.ts, que enumera los exports de los dos archivos. La tab Curso
// (./curso/actions.ts) tiene su propia `puedeVer` con la misma pregunta.
//
// ⚠️ SIN 'use server', A PROPÓSITO, y con 'server-only': esto no es una action que el
// navegador pueda llamar, es un helper del server. Con 'use server' sería un endpoint más.
//
// ⚠️ NUNCA TIRA: si la sesión o la capa no se pueden leer, contesta que no (fail-closed). Así
// puede ser la primera línea de una action sin un `try` alrededor.

import { getRolWsEfectivo, getCapaActual } from '@/lib/workspace';
import { tabEnCapa } from '@/lib/capas';

/** `null` = puede usar Customer Success. Si no, el motivo, corto y listo para la pantalla. */
export async function puedeUsarCs(): Promise<string | null> {
  try {
    if ((await getRolWsEfectivo()) == null) return 'Tu sesión venció. Vuelve a entrar.';
    if (!tabEnCapa('customer-success', await getCapaActual())) return 'Esta cuenta no tiene Customer Success.';
    return null;
  } catch {
    return 'No pude verificar tu sesión.';
  }
}
