// =============================================================================
// cargar-criterio — pone el criterio de compromisos de un workspace desde un .md
// =============================================================================
//
// El criterio es lo que decide qué de una reunión es un compromiso y qué es ruido
// (lib/plan-criterio.ts). Desde el 30/09/2026 se edita en /configuraciones →
// «Criterio de reuniones»; este script existe para la CARGA INICIAL, que es un
// documento de 10k caracteres que nadie va a pegar a mano en un textarea.
//
// ⚠️ EL DOCUMENTO NO VIVE EN EL REPO, Y NO DEBE. El criterio de Mauricio es
// material de su negocio (sus reglas, las citas textuales de sus sesiones de
// consultoría, los nombres de sus clientes sustituidos por su rol). Vive en
// `app_settings` del workspace, que es donde el producto guarda lo de cada
// inquilino, y el .md de origen queda del lado de quien lo cargó. Por eso el
// archivo entra por parámetro y no hay un default apuntando a Descargas: un
// default así se rompe en la máquina siguiente y encima sugiere que es del repo.
//
// ⚠️ Y VA ENVUELTO EN `runWithWorkspace`. `guardarCriterio` escribe en el
// workspace del contexto, y en un script no hay contexto de request: sin el
// envoltorio no escribe en ningún lado (tira), que es el comportamiento correcto
// —el módulo se niega a adivinar— y por eso el `--ws` es obligatorio.
//
// ── Uso ─────────────────────────────────────────────────────────────────────
//
//   node --conditions=react-server --import tsx scripts/cargar-criterio.ts --ws=1 --archivo=<ruta.md>
//   ... --apply     ← sin esto NO escribe nada: muestra qué hay y qué quedaría
//
// Siempre imprime el criterio ANTERIOR (o su largo) antes de tocar nada: es el
// respaldo, y va a la consola para que quede en el registro de la sesión.

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { criterioDelWorkspace, guardarCriterio, TOPE_CRITERIO } from '../lib/plan-criterio';

const arg = (n: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3);
const APLICAR = process.argv.includes('--apply');
const WS = Number(arg('ws'));
const ARCHIVO = arg('archivo') ?? '';

if (!Number.isInteger(WS) || WS <= 0 || !ARCHIVO) {
  console.error('uso: --ws=<n> --archivo=<ruta.md> [--apply]');
  process.exit(1);
}

async function main() {
  const nuevo = readFileSync(ARCHIVO, 'utf8').trim();
  if (!nuevo) throw new Error(`${ARCHIVO} está vacío: no se carga un criterio vacío por accidente (para borrarlo, se borra desde la pantalla).`);
  if (nuevo.length > TOPE_CRITERIO) throw new Error(`El criterio mide ${nuevo.length} caracteres y el tope es ${TOPE_CRITERIO}. Recortalo vos: si lo recortara el script, el corte caería en medio de una regla.`);

  await runWithWorkspace(WS, async () => {
    const antes = await criterioDelWorkspace();
    console.log(`ws=${WS}`);
    console.log(`  antes:   ${antes ? `${antes.length} caracteres` : 'SIN criterio'}`);
    console.log(`  archivo: ${ARCHIVO} · ${nuevo.length} caracteres`);
    if (antes === nuevo) { console.log('  → es el mismo texto: no hay nada que hacer.'); return; }
    if (antes) {
      // El respaldo. Un criterio pisado sin dejar el anterior en ningún lado es
      // trabajo de un cliente que no se puede recuperar.
      console.log('  ── criterio ANTERIOR, completo (respaldo) ──');
      console.log(antes);
      console.log('  ── fin del respaldo ──');
    }
    if (!APLICAR) { console.log('  → ensayo. Con --apply se escribe.'); return; }
    await guardarCriterio(nuevo);
    // Se verifica lo que el producto va a LEER, no la fila que se escribió: son dos
    // preguntas y sólo una puede fallar en silencio.
    const despues = await criterioDelWorkspace();
    if (despues !== nuevo) throw new Error(`Se escribió pero se lee distinto (${despues?.length ?? 0} caracteres). NO quedó cargado.`);
    console.log(`  ✔ cargado y releído: ${despues.length} caracteres.`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
