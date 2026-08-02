// =============================================================================
// probe-cliente-en-texto — ¿a quién reconoce MaKo en el texto de una tarea?
// =============================================================================
// SOLO LEE. Corre clienteEnTexto() contra los leads reales del workspace, con
// casos que TIENEN que dar y casos que NO tienen que dar.
//
//   NODE_OPTIONS="--conditions=react-server" npx tsx scripts/probe-cliente-en-texto.ts
// =============================================================================

import { config } from 'dotenv';
import { resolve } from 'node:path';
config({ path: resolve(process.cwd(), '.env.local') });

import { runWithWorkspace } from '../lib/workspace';
import { proyectoParaTarea } from '../lib/reunion-cliente';

const WS = 1;

/** [texto, a quién DEBERÍA reconocer ('' = a nadie, tiene que preguntar)] */
const CASOS: Array<[string, string]> = [
  ['Enviar el reporte semanal a Grupo Esquer', 'Grupo Esquer'],
  ['Corregir el formulario de temperaturas de Baja Teriyaki', 'Baja Teriyaki'],
  ['Preparar la propuesta para Congelados HMO', 'HMO'],
  ['Revisar el contrato de Vertice Industrial', 'Vertice'],
  // La trampa: un nombre de pila suelto matchea varios leads que no tienen nada
  // que ver. Tiene que devolver nadie, no elegir uno.
  ['Llamar a Adriana por el tema del tablero', ''],
  ['Actualizar el dashboard de analítica', ''],
  ['Comprar un soporte con ventilador para la laptop', ''],
];

async function main() {
  await runWithWorkspace(WS, async () => {
    let bien = 0;
    for (const [texto, esperado] of CASOS) {
      const r = await proyectoParaTarea({ titulo: texto });
      const dio = r.nombre ?? '';
      const ok = esperado ? dio.toLowerCase().includes(esperado.toLowerCase()) : !dio;
      if (ok) bien++;
      const via = r.cliente ? `CRM (${r.cliente.via})` : r.porProyecto ? 'proyecto que ya existe' : '—';
      console.log(`${ok ? '✓' : '✗'} «${texto.slice(0, 52)}»`);
      console.log(`     esperado: ${esperado || '(nadie — que pregunte)'}  ·  dio: ${dio || '(nadie)'}  ·  por: ${via}`);
    }
    console.log(`\n${bien}/${CASOS.length} correctos`);
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
