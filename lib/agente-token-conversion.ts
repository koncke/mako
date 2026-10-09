// =============================================================================
// agente-token-conversion — pasar a hash los tokens principales que quedaron en claro
// =============================================================================
// Una sola vez, DESPUÉS del deploy que deja de guardarlos en claro (lib/agente-token-nucleo.ts).
// El deploy va primero porque el código nuevo entiende las DOS formas y el viejo sólo una:
// convertir antes dejaría a las skills instaladas recibiendo 401 hasta que salga el deploy.
//
// Qué hace, por cada setting `agente_token` en claro:
//   1. reclama la fila del índice por HASH (si no queda de ese workspace, no sigue: sin
//      ella, el setting en hash dejaría la skill sin autenticar);
//   2. cambia el setting a `{hash, pista}` con compare-and-set contra lo que leyó (si la
//      persona rotó en el medio, no lo pisa);
// y al final borra del índice las filas EN CLARO que ya no autentican nada: las de los
// settings convertidos y las de tokens rotados hace tiempo (el índice es append-only, así
// que guardaba en claro TODOS los tokens que cada workspace tuvo). La única que se queda es
// la de un setting que sigue en claro porque su conversión falló.
//
// ⚠️ NUNCA IMPRIME UN VALOR: ni el token, ni el hash, ni la pista. Sólo cuenta y nombra
// workspaces. La salida de un script queda en una terminal, en un log o en un chat.
//
// SIN `server-only`: puro, con test (tests/agente-token-hash.test.ts). La base entra por
// `IoConversion`; scripts/agente-token-a-hash.ts arma la de verdad.
// =============================================================================

import { hashDeToken } from './api-mako/tokens-lista';
import { esIndiceEnClaro, guardadoDeToken, leerGuardado } from './agente-token-nucleo';

export type FilaSetting = { ws: number; value: string | null };
export type FilaIndice = { ws: number; identificador: string };

export type IoConversion = {
  /** Todas las filas `agente_token` de app_settings. */
  leerSettings(): Promise<FilaSetting[]>;
  /** Todas las filas del servicio 'agente' de webhook_routing. */
  leerIndice(): Promise<FilaIndice[]>;
  /** Reclama (servicio 'agente', identificador) → ws. true = quedó de ese ws. */
  indexar(identificador: string, ws: number): Promise<boolean>;
  /** Compare-and-set del setting. true = ganó. */
  cambiarSettingSi(ws: number, esperado: string, nuevo: string): Promise<boolean>;
  /** Borra UNA fila del índice de ese ws. */
  borrarIndice(ws: number, identificador: string): Promise<void>;
};

export type ResumenConversion = {
  settings: { enClaro: number[]; enHash: number[]; vacios: number[]; ilegibles: number[] };
  indice: { enClaro: number; enClaroVigentes: number; porHash: number };
  aplicado: boolean;
  convertidos: number[];
  fallidos: { ws: number; motivo: string }[];
  indicesEnClaroBorrados: number;
};

const lista = (xs: number[]) => (xs.length ? xs.map((w) => `ws${w}`).join(', ') : '—');

/**
 * Por defecto SÓLO CUENTA (no escribe nada). Con `aplicar: true` convierte. Lo que imprime
 * pasa por `log`, y no lleva ningún valor del token.
 */
export async function convertirAgenteTokens(
  io: IoConversion,
  { aplicar, log }: { aplicar: boolean; log: (linea: string) => void },
): Promise<ResumenConversion> {
  const filas = await io.leerSettings();
  const indice = await io.leerIndice();

  const r: ResumenConversion = {
    settings: { enClaro: [], enHash: [], vacios: [], ilegibles: [] },
    indice: { enClaro: 0, enClaroVigentes: 0, porHash: 0 },
    aplicado: aplicar, convertidos: [], fallidos: [], indicesEnClaroBorrados: 0,
  };

  // El valor de cada setting DESPUÉS de esta corrida (para decidir qué fila en claro sobra).
  const final = new Map<number, string | null>();
  for (const f of filas) {
    final.set(f.ws, f.value);
    const g = leerGuardado(f.value);
    if (!g) ((f.value ?? '').trim() ? r.settings.ilegibles : r.settings.vacios).push(f.ws);
    else (g.forma === 'claro' ? r.settings.enClaro : r.settings.enHash).push(f.ws);
  }
  const vigenteEnClaro = (ws: number, identificador: string) => {
    const g = leerGuardado(final.get(ws) ?? null);
    return g?.forma === 'claro' && g.token === identificador.trim();
  };
  for (const i of indice) {
    if (esIndiceEnClaro(i.identificador)) {
      r.indice.enClaro++;
      if (vigenteEnClaro(i.ws, i.identificador)) r.indice.enClaroVigentes++;
    } else r.indice.porHash++;
  }

  log(`Settings agente_token: ${filas.length}`);
  log(`  en claro (a convertir): ${r.settings.enClaro.length} · ${lista(r.settings.enClaro)}`);
  log(`  ya en hash:             ${r.settings.enHash.length} · ${lista(r.settings.enHash)}`);
  log(`  vacíos (revocados):     ${r.settings.vacios.length}`);
  log(`  ilegibles:              ${r.settings.ilegibles.length} · ${lista(r.settings.ilegibles)}`);
  log(`Índice 'agente': ${indice.length} filas · en claro ${r.indice.enClaro} (vigentes ${r.indice.enClaroVigentes}) · por hash ${r.indice.porHash}`);

  if (!aplicar) {
    log('Sólo conté: no se escribió nada. Para convertir, --aplicar.');
    return r;
  }

  for (const f of filas) {
    const g = leerGuardado(f.value);
    if (g?.forma !== 'claro' || f.value == null) continue;
    if (!(await io.indexar(hashDeToken(g.token), f.ws))) {
      r.fallidos.push({ ws: f.ws, motivo: 'no pude reclamar la fila del índice por hash' });
      continue;
    }
    if (!(await io.cambiarSettingSi(f.ws, f.value, guardadoDeToken(g.token)))) {
      r.fallidos.push({ ws: f.ws, motivo: 'el setting cambió mientras corría (¿alguien lo rotó?): no lo piso' });
      continue;
    }
    final.set(f.ws, guardadoDeToken(g.token));
    r.convertidos.push(f.ws);
  }

  for (const i of indice) {
    if (!esIndiceEnClaro(i.identificador) || vigenteEnClaro(i.ws, i.identificador)) continue;
    await io.borrarIndice(i.ws, i.identificador);
    r.indicesEnClaroBorrados++;
  }

  log(`Convertidos: ${r.convertidos.length} · ${lista(r.convertidos)}`);
  for (const x of r.fallidos) log(`  ⛔ ws${x.ws}: ${x.motivo}`);
  log(`Filas en claro borradas del índice: ${r.indicesEnClaroBorrados}`);
  return r;
}
