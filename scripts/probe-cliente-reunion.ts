// =============================================================================
// probe-cliente-reunion — la reunión SIN email de invitado, ¿a quién reconoce?
// =============================================================================
// SOLO LEE. Dos cosas contra los datos reales del workspace:
//   1. el fallback por TÍTULO (Fathom devuelve como participante solo al que grabó
//      en media agenda: sin esto, esas reuniones quedaban sin cliente);
//   2. las OPCIONES de la pregunta que se hace cuando no hay certeza.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-cliente-reunion.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { resolverClienteDeReunion, opcionesDeCliente } from '../lib/reunion-cliente';

const WS = 1;

/** [título de la reunión, a quién DEBERÍA reconocer ('' = a nadie → que pregunte)] */
const CASOS: Array<[string, string]> = [
  ['Grupo Esquer - Seguimiento semanal', 'Esquer'],
  ['Vertice Industrial | Revisión de campañas', 'Vertice'],
  ['Reunión de equipo', ''],
  ['Planeación Q3', ''],
];

async function main() {
  await runWithWorkspace(WS, async () => {
    let bien = 0;
    for (const [titulo, esperado] of CASOS) {
      // Sin participantes A PROPÓSITO: es el caso que antes se perdía entero.
      const c = await resolverClienteDeReunion({ titulo, participantes: [] });
      const dio = c ? (c.empresa || c.nombre) : '';
      const ok = esperado ? dio.toLowerCase().includes(esperado.toLowerCase()) : !dio;
      if (ok) bien++;
      console.log(`${ok ? '✓' : '✗'} «${titulo}»  →  ${dio || '(nadie: pregunta)'}`);
    }
    console.log(`\n${bien}/${CASOS.length} correctos\n`);

    const ops = await opcionesDeCliente({ participantes: [] });
    console.log(`Opciones de la pregunta (${ops.length}):`);
    for (const o of ops) console.log(`   · ${o.nombre.padEnd(34).slice(0, 34)} ${o.sub}`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
