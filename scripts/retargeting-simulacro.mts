// =============================================================================
// El simulacro del retargeting en UN negocio de verdad (13/11/2026): lee la base de producción y usa la IA del negocio, y NO
// ESCRIBE NADA. Ni etiquetas, ni historial, ni el estado, ni Meta: cada escritura queda anotada en lo que imprime.
// =============================================================================
// Es la prueba en seco antes de prender nada (el Cerebro, 13/11): el motor REAL (lib/retargeting-motor.ts) con los puertos de
// lectura reales (lib/retargeting.ts) y los de escritura cambiados por un registro.
//
//   node --conditions=react-server --env-file=<.env.local> --import tsx scripts/retargeting-simulacro.mts --ws 9 [--meta] [--sin-ia]
//     --meta     como si el negocio tuviera los públicos prendidos (dice qué subiría; igual no llama a Meta)
//     --sin-ia   no llama a la IA del negocio (los dudosos quedan sin revisar)
// =============================================================================

import { runWithWorkspace } from '../lib/workspace';
import { puertosDelNegocio } from '../lib/retargeting';
import { revisarCon, type PuertosRT } from '../lib/retargeting-motor';
import { ETIQUETAS } from '../lib/retargeting-reglas';

const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const ws = Number(arg('--ws'));
if (!Number.isSafeInteger(ws) || ws <= 0) { console.error('Falta --ws N'); process.exit(1); }
const conMeta = process.argv.includes('--meta');
const sinIA = process.argv.includes('--sin-ia');

const anotado = { etiquetas: [] as string[], historial: [] as string[], meta: [] as string[], ia: 0 };
const salida = await runWithWorkspace(ws, async () => {
  const real = await puertosDelNegocio(ws);
  const t0 = Date.now();
  const p: PuertosRT = {
    ...real,
    config: async () => ({ publicosMeta: conMeta }),
    guardarEstado: async () => {},
    ia: async (s, u) => { anotado.ia++; if (sinIA) throw new Error('simulacro sin IA'); return real.ia(s, u); },
    etiquetas: {
      asegurar: async (s) => 900_000 + Object.keys(ETIQUETAS).indexOf(s),
      poner: async (ids, e) => { anotado.etiquetas.push(`poner ${Object.values(ETIQUETAS)[e - 900_000].nombre} → ${ids.length}`); },
      sacar: async (ids, e) => { anotado.etiquetas.push(`sacar ${Object.values(ETIQUETAS)[e - 900_000].nombre} → ${ids.length}`); },
    },
    historial: async (f) => { anotado.historial.push(...f.map((x) => `#${x.leadId} ${x.texto}`)); },
    meta: {
      ...real.meta,
      crear: async (cual) => { anotado.meta.push(`crear ${cual}`); return { metaId: `simulado-${cual}`, zernioId: null }; },
      agregar: async (pub, ps) => { anotado.meta.push(`agregar a ${pub.metaId}: ${ps.length}`); },
      sacar: async (pub, ps) => { anotado.meta.push(`sacar de ${pub.metaId}: ${ps.length}`); },
    },
  };
  // En seco: el motor no llama a Meta. Con --meta, cuenta lo que subiría.
  const r = await revisarCon(p, { enSeco: true });
  return { ...r, ms: Date.now() - t0 };
});
console.log(JSON.stringify({ ws, ...salida, anotado: { ...anotado, historial: anotado.historial.slice(0, 25), historialTotal: anotado.historial.length } }, null, 1));
process.exit(0);
