// =============================================================================
// El precargador para PROBAR ROMPIÉNDOLO la tabla de planes, sin tocar ni un archivo (15/11/2026)
// =============================================================================
// Para romper un test que lee `FUNCIONES_SOLO_PRO` hay que mover la tabla, y editar lib/topes-plan.ts no sirve: es la fuente
// que tocan varias corridas a la vez, y un archivo editado «para probar» se queda editado. Esto lo hace EN MEMORIA: los dos
// valores son arrays normales (`as const` no congela en runtime; `FUNCIONES_TODAVIA_NO_VENDIDAS` se arma al cargar el módulo),
// así que un `--import` que corre ANTES del test los muta y el test —que importa el mismo módulo— ve la tabla cambiada.
//
// ⚠️ NO HACE FALTA `mock.module` NI `--experimental-test-module-mocks`: no se reemplaza el módulo, se muta lo que exporta.
//    (Si alguna nota del repo dice que esto no se pudo, está mal: se corrió así tres veces.)
//
// Cómo (el orden importa: tsx primero, esto después, el test al final):
//   PRO_SUMA=funcion-nueva   node --import tsx --import ./tests/_mutar-funciones-de-pro.ts --test tests/<x>.test.ts
//     → cierra en Essential una función que no existía: el test TIENE que ponerse rojo.
//   PRO_SACA=chat-referentes node --import tsx --import ./tests/_mutar-funciones-de-pro.ts --test tests/<x>.test.ts
//     → ABRE esa función en Essential: el aviso de la landing desaparece solo y el test se queda VERDE (los dos se mueven juntos).
//   PRO_VENDE=1              node --import tsx --import ./tests/_mutar-funciones-de-pro.ts --test tests/<x>.test.ts
//     → vacía `FUNCIONES_TODAVIA_NO_VENDIDAS`, o sea `AI_AVATAR_SE_VENDE = true`: lo cerrado-y-no-vendido pasa a vendido.
// =============================================================================

import { FUNCIONES_SOLO_PRO } from '../lib/topes-plan';
import { FUNCIONES_TODAVIA_NO_VENDIDAS } from '../lib/planes-comparacion';

const cerradas = FUNCIONES_SOLO_PRO as unknown as string[];

if (process.env.PRO_SUMA) cerradas.push(...process.env.PRO_SUMA.split(',').map((s) => s.trim()).filter(Boolean));
if (process.env.PRO_SACA) {
  for (const f of process.env.PRO_SACA.split(',').map((s) => s.trim())) {
    const i = cerradas.indexOf(f);
    if (i === -1) throw new Error(`PRO_SACA: «${f}» no está en FUNCIONES_SOLO_PRO (mutar algo que no existe no prueba nada)`);
    cerradas.splice(i, 1);
  }
}
if (process.env.PRO_VENDE) (FUNCIONES_TODAVIA_NO_VENDIDAS as unknown as string[]).splice(0);

// Lo que quedó, para que la corrida diga con qué tabla se midió.
console.error(`[_mutar-funciones-de-pro] cerradas=${cerradas.length} [${cerradas.join(' ')}] · sin vender=[${FUNCIONES_TODAVIA_NO_VENDIDAS.join(' ')}]`);
