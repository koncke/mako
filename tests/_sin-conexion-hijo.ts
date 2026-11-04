// =============================================================================
// Hijo de tests/sin-conexion.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// lib/sin-conexion/llave-server.ts lleva `server-only`: este archivo corre en un node aparte con `--conditions=react-server`,
// deriva las llaves que le pide el test (un JSON por argv) y le contesta con otro JSON (cada llave en base64url, o null).
// =============================================================================

import { llaveDeLaComputadora } from '../lib/sin-conexion/llave-server';

const pedidos = JSON.parse(process.argv[2] ?? '[]') as Array<{ usuario: number; dispositivo: string; secreto?: string | null }>;
process.stdout.write(JSON.stringify(pedidos.map((p) => {
  const k = llaveDeLaComputadora(p.usuario, p.dispositivo, p.secreto === null ? undefined : p.secreto ?? 'secreto-de-prueba');
  return k ? Buffer.from(k).toString('base64url') : null;
})));
