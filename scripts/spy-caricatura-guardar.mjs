#!/usr/bin/env node
// =============================================================================
// spy-caricatura-guardar.mjs — el Runner guarda la caricatura que hizo con Canva, o anota que no pudo (4/11/2026)
// =============================================================================
// Uso:
//   node --env-file=<clon>/.env.local --import tsx scripts/spy-caricatura-guardar.mjs <ws> <id> <archivo>
//   node --env-file=<clon>/.env.local --import tsx scripts/spy-caricatura-guardar.mjs <ws> <id> --fallo "<motivo>"
//
// Con el archivo (JPG, PNG o WebP, cuadrado, de 128 px o más, hasta 2 MB): lo sube a NUESTRO Storage, por su cuenta
// (`spy/caricatura/instagram-…`), y la marca lista en ese competidor y en la misma persona (misma red y mismo usuario)
// de cualquier otro negocio: no se genera otra. El tamaño se LEE del archivo (Canva entrega 200 × 200): no hace falta
// decirlo. La tarjeta la usa en la próxima carga.
//
// Con `--fallo`: anota que Canva NO PUDO hacerla (no que no había Canva: sin Canva no se anota nada). No se reintenta en cadena: la lista de pendientes no la vuelve a traer hasta
// el día siguiente, y a los 3 fallos queda «rendida» (visible para el super admin en la misma lista).
//
// Sale con 0 si quedó hecho, 1 si no (y dice por qué).
// =============================================================================
import { readFileSync } from 'node:fs';
import { anotarFallo, guardarCaricatura } from '../lib/spy-caricatura-cola.ts';
import { depsDeLaBase } from './spy-caricatura-base.mjs';

const [wsTxt, idTxt, tercero, ...resto] = process.argv.slice(2);
const ws = Number(wsTxt);
const id = Number(idTxt);
if (!Number.isInteger(ws) || ws <= 0 || !Number.isInteger(id) || id <= 0 || !tercero) {
  console.error('Uso: spy-caricatura-guardar.mjs <ws> <id> <archivo>  |  <ws> <id> --fallo "<motivo>"');
  process.exit(2);
}
const deps = depsDeLaBase();

if (tercero === '--fallo') {
  const r = await anotarFallo(deps, ws, id, resto.join(' '));
  if (!r.ok) { console.error(r.error); process.exit(1); }
  console.log(r.rendida ? `Anotado (${r.fallos} fallos): queda rendida, ya no se intenta.` : `Anotado (${r.fallos} de 3): vuelve a la lista mañana.`);
  process.exit(0);
}

let bytes;
try { bytes = new Uint8Array(readFileSync(tercero)); } catch (e) { console.error(`No pude leer ${tercero}: ${e.message}`); process.exit(1); }
const r = await guardarCaricatura(deps, ws, id, bytes);
if (!r.ok) { console.error(r.error); process.exit(1); }
console.log(`Lista (${r.lado} × ${r.lado}): ${r.url}`);
console.log(`Marcada en ${r.marcadas.length} competidor(es): ${r.marcadas.map((m) => `ws${m.ws}#${m.id}`).join(', ')}`);
