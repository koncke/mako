// pausa-cerebro.mjs — la PAUSA del Cerebro hecha red, no pedido: mientras exista el archivo de pausa, lo pesado de los chats
// (tests-afectados y tsc-acotado) espera antes de arrancar.
// ⚠️ 28/10/2026: con la pausa pedida por MENSAJE («nada de tests hasta mi seguí»), tres chats lanzaron pruebas igual durante la
// subida de tren-v: el mensaje llega recién cuando termina el turno del chat, y un subagente no lo ve nunca. tests-afectados sólo
// espera ~1,3 GB libres y el chequeo de tipos del push pide 4,8: las pruebas arrancaban, el push caía «sin RAM» y hubo que
// cortarlas a mano tres veces. docs/hallazgos-infra.md, «La pausa del Cerebro, por archivo».
// El Cerebro la prende con `node scripts/pausa-cerebro.mjs prender "<motivo>"` y la apaga con `node scripts/pausa-cerebro.mjs apagar`.
// Una pausa de más de 90 minutos se da por olvidada y no frena a nadie; esperando, nadie espera más de 60 (después corre igual
// y lo dice). En Actions (CI=true) no existe: el runner es nuestro. `MAKO_IGNORAR_PAUSA=1` es para el chequeo del propio Cerebro.
import { existsSync, readFileSync, statSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Dónde vive la pausa. Se lee en cada consulta (no al importar): `MAKO_PAUSA_ARCHIVO` la mueve, para los tests. */
export const archivoPausa = () => process.env.MAKO_PAUSA_ARCHIVO || join(homedir(), '.claude', 'operaciones', 'pausa-pesados.txt');
export const PAUSA_OLVIDADA_MS = 90 * 60 * 1000;
export const ESPERA_PAUSA_MAX_MS = 60 * 60 * 1000;

/** El motivo de la pausa si está prendida y no es vieja; null si no hay pausa. */
export function pausaVigente(archivo = archivoPausa(), ahora = Date.now()) {
  if (process.env.CI || process.env.MAKO_IGNORAR_PAUSA === '1' || !existsSync(archivo)) return null;
  let edad;
  try { edad = ahora - statSync(archivo).mtimeMs; } catch { return null; }
  if (edad > PAUSA_OLVIDADA_MS) return null;
  try { return readFileSync(archivo, 'utf8').trim() || 'pausa del Cerebro'; } catch { return 'pausa del Cerebro'; }
}

/** Espera a que el Cerebro levante la pausa. Nunca bloquea para siempre: pasado `esperaMaxMs`, sigue y lo avisa. */
export async function esperarSinPausa({ quien = 'chequeo', archivo = archivoPausa(), esperaMaxMs = ESPERA_PAUSA_MAX_MS, dormir = (ms) => new Promise((r) => setTimeout(r, ms)), ahora = Date.now, out = (t) => process.stderr.write(t) } = {}) {
  const hasta = ahora() + esperaMaxMs;
  let avisado = false;
  for (;;) {
    const motivo = pausaVigente(archivo, ahora());
    if (!motivo) {
      if (avisado) out(`  [${quien}] el Cerebro levantó la pausa: sigo.\n`);
      return true;
    }
    if (ahora() >= hasta) { out(`  [${quien}] la pausa sigue después de ${Math.round(esperaMaxMs / 60000)} min: corro igual.\n`); return false; }
    if (!avisado) { out(`  [${quien}] el Cerebro pidió PAUSA («${motivo}»): espero a que la levante (hasta ${Math.round(esperaMaxMs / 60000)} min)…\n`); avisado = true; }
    await dormir(5000);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [accion, ...resto] = process.argv.slice(2);
  if (accion === 'prender') {
    mkdirSync(dirname(archivoPausa()), { recursive: true });
    writeFileSync(archivoPausa(), resto.join(' ') || 'pausa del Cerebro');
    console.log(`pausa prendida (${archivoPausa()})`);
  } else if (accion === 'apagar') {
    rmSync(archivoPausa(), { force: true });
    console.log('pausa apagada');
  } else {
    const motivo = pausaVigente();
    console.log(motivo ? `PAUSA: ${motivo}` : 'sin pausa');
  }
}
