// =============================================================================
// bajar-reels — los videos de los reels para clasificarlos por su EDICIÓN de verdad (11/11/2026)
// =============================================================================
// Martín, 11/11/2026 (en el chat del Video): «Sí, gasta lo necesario». La primera pasada miró sólo la PORTADA y se quedó con
// estilos de texto; los cortes, el ritmo y el B-roll (los «más complejos, como el de los pistachos») sólo se ven en el video.
//
// De dónde: las claves de Apify de Spy cargadas en MaKo (`APIFY_INSTAGRAM_TOKEN` y sus extras `_2…_5`) de los negocios que se
// le pasen (por defecto 9 y 11), sin repetir la misma cuenta. NUNCA imprime una clave: su número, su nombre y su huella. Cada
// clave conserva su reserva de Spy (US$2): por debajo, no se usa. Cada corrida lleva su propio techo (`maxTotalChargeUsd`).
// Lo que baja: el video de cada reel (el `videoUrl` que da el actor), se mide (duración, tomas con ffmpeg) y se arma una hoja de
// cuadros; el video se BORRA enseguida (no entran todos en el disco). Todo queda en la carpeta de trabajo que se le pase.
//
// Uso (desde la raíz del clon, con el .env.local de PRODUCCIÓN):
//   node --env-file=<.env.local> --conditions=react-server --import tsx scripts/outliers-criterio/bajar-reels.mts credito [--ws 9,11]
//   … spy <carpeta> [--de-verdad] [--techo-usd 3]         los reels de Spy (la lista `reels.json` de la carpeta, por su link)
//   … cuentas <carpeta> [--de-verdad] [--por-cuenta 12] [--techo-usd 16]   los reels de las cuentas de la biblioteca de carruseles
// EN SECO por defecto: dice cuántos, con qué claves y cuánto puede costar.
// =============================================================================

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const base = process.cwd().replace(/\\/g, '/');
const imp = (p: string) => import(`file:///${base}/${p}`);
const { clavesApifyDeSpy } = await imp('lib/instagram-perfil-server.ts');
const { creditoDeApify } = await imp('lib/spy-todo-reglas.ts');

const API = 'https://api.apify.com/v2';
const RESERVA_USD = 2;
/** Lo medido el 4/11/2026 (docs/hallazgos-carruseles.md): una publicación por su link, ~US$0,0027. */
const USD_POR_REEL = 0.0027;
const usd = (n: number) => `US$${n.toFixed(2)}`;
type Clave = { token: string; slot: number; nombre: string | null; huella: string; ws: number };
type Credito = { usado: number; tope: number };

const args = process.argv.slice(2);
const comando = args[0];
const op = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const deVerdad = args.includes('--de-verdad');
const wss = (op('ws') ?? '9,11').split(',').map(Number).filter((n) => Number.isFinite(n));

async function apify(token: string, ruta: string, cuerpo?: unknown): Promise<{ status: number; cuerpo: unknown }> {
  const r = await fetch(`${API}${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
  });
  let j: unknown = null;
  try { j = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, cuerpo: j };
}
const credito = async (k: Clave): Promise<Credito | null> => {
  const r = await apify(k.token, '/users/me/limits').catch(() => null);
  return r && r.status === 200 ? creditoDeApify(r.cuerpo) : null;
};
const libre = (c: Credito | null) => (c ? Math.max(0, c.tope - c.usado - RESERVA_USD) : 0);
const rotulo = (k: Clave) => `ws ${k.ws} · clave ${k.slot}${k.nombre ? ` («${k.nombre}»)` : ''} · huella ${k.huella}`;

/** Las claves de esos negocios, sin repetir la misma cuenta de Apify (por su huella), con su crédito. */
async function clavesConCredito(): Promise<Array<{ k: Clave; c: Credito | null }>> {
  const vistas = new Set<string>();
  const out: Array<{ k: Clave; c: Credito | null }> = [];
  for (const ws of wss) {
    const ks = ((await clavesApifyDeSpy(ws, { conNombres: true }).catch(() => [])) as Omit<Clave, 'ws'>[]).map((k) => ({ ...k, ws }));
    for (const k of ks) {
      if (vistas.has(k.huella)) continue;
      vistas.add(k.huella);
      out.push({ k, c: await credito(k) });
    }
  }
  return out;
}

function imprimir(cs: Array<{ k: Clave; c: Credito | null }>): number {
  let total = 0;
  for (const { k, c } of cs) {
    total += libre(c);
    console.log(`  · ${rotulo(k)}: ${c ? `usó ${usd(c.usado)} de ${usd(c.tope)} · libre sin la reserva ${usd(libre(c))}` : 'no pude leer su crédito'}`);
  }
  console.log(`  Libre en total (dejando ${usd(RESERVA_USD)} en cada una): ${usd(total)}`);
  return total;
}

/** Corre el actor con la primera clave que tenga crédito libre; si contesta «sin crédito», pasa a la siguiente. */
async function correr(cs: Array<{ k: Clave; c: Credito | null }>, actor: string, entrada: unknown, techo: number, gasto: Map<string, number>) {
  for (const x of cs) {
    const disponible = libre(x.c) - (gasto.get(x.k.huella) ?? 0);
    if (disponible < Math.min(techo, 0.05)) continue;
    const tope = Math.min(techo, disponible);
    const r = await apify(x.k.token, `/acts/${actor}/run-sync-get-dataset-items?maxTotalChargeUsd=${tope.toFixed(2)}&timeout=300`, entrada).catch((e) => ({ status: 0, cuerpo: String(e) }));
    if (r.status === 402 || /credit|usage|limit/i.test(JSON.stringify(r.cuerpo ?? '').slice(0, 300)) && r.status >= 400) continue;
    if (r.status < 200 || r.status >= 300) return { ok: false as const, texto: `${r.status} ${JSON.stringify(r.cuerpo).slice(0, 200)}` };
    gasto.set(x.k.huella, (gasto.get(x.k.huella) ?? 0) + tope);
    return { ok: true as const, items: Array.isArray(r.cuerpo) ? (r.cuerpo as Record<string, unknown>[]) : [], clave: x.k };
  }
  return { ok: false as const, texto: 'ninguna clave con crédito libre' };
}

/** Baja un video, lo mide y arma su hoja de cuadros; el video se borra. */
function medir(carpeta: string, codigo: string, videoUrl: string): Record<string, unknown> | null {
  const tmp = join(carpeta, 'tmp', `${codigo}.mp4`);
  mkdirSync(join(carpeta, 'tmp'), { recursive: true });
  mkdirSync(join(carpeta, 'hojas-video'), { recursive: true });
  const bajada = spawnSync('curl', ['-s', '-L', '--max-time', '120', '-o', tmp, videoUrl]);
  if (bajada.status !== 0 || !existsSync(tmp)) return null;
  try {
    const dur = Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', tmp], { encoding: 'utf8' }).stdout.trim());
    const esc = spawnSync('ffmpeg', ['-hide_banner', '-i', tmp, '-vf', "select='gt(scene,0.28)',showinfo", '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 64e6 });
    const cortes = [...esc.stderr.matchAll(/pts_time:([\d.]+)/g)].map((m) => +(+m[1]).toFixed(2));
    // 12 cuadros repartidos, 160 px de ancho, en 6×2: lo que mira el clasificador.
    const paso = Math.max(0.5, dur / 12);
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmp, '-vf', `fps=1/${paso.toFixed(3)},scale=160:-2,tile=6x2:padding=2`, '-frames:v', '1', '-q:v', '5', join(carpeta, 'hojas-video', `${codigo}.jpg`)]);
    return { codigo, duracion: +dur.toFixed(2), tomas: cortes.length + 1, cortes, tomaMediaS: +(dur / (cortes.length + 1)).toFixed(2) };
  } finally {
    rmSync(tmp, { force: true });
  }
}

const codigoDe = (u: unknown) => /instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(?:reels?|p|tv)\/([A-Za-z0-9_-]{5,40})/.exec(String(u ?? ''))?.[1] ?? null;

if (comando === 'credito') {
  console.log('Claves de Apify cargadas en MaKo (negocios ' + wss.join(', ') + '):');
  imprimir(await clavesConCredito());
} else if (comando === 'spy' || comando === 'cuentas') {
  const carpeta = args[1];
  if (!carpeta) throw new Error('falta la carpeta de trabajo');
  const cs = await clavesConCredito();
  const total = imprimir(cs);
  const techo = Number(op('techo-usd') ?? (comando === 'spy' ? 3 : 16));
  const hechos = new Set<string>(existsSync(join(carpeta, 'medidas.jsonl')) ? readFileSync(join(carpeta, 'medidas.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l).codigo) : []);
  let lotes: Array<{ actor: string; entrada: unknown; cuantos: number }> = [];
  if (comando === 'spy') {
    const reels = (JSON.parse(readFileSync(join(carpeta, 'reels.json'), 'utf8')) as Array<{ url: string }>).filter((r) => !hechos.has(codigoDe(r.url) ?? ''));
    for (let i = 0; i < reels.length; i += 40) {
      const urls = reels.slice(i, i + 40).map((r) => r.url);
      lotes.push({ actor: 'apify~instagram-scraper', entrada: { directUrls: urls, resultsType: 'posts', resultsLimit: urls.length, addParentData: false }, cuantos: urls.length });
    }
  } else {
    const por = Number(op('por-cuenta') ?? 12);
    const cuentas = (JSON.parse(readFileSync(join(carpeta, 'cuentas.json'), 'utf8')) as string[]);
    for (let i = 0; i < cuentas.length; i += 10) {
      const us = cuentas.slice(i, i + 10);
      lotes.push({ actor: 'apify~instagram-reel-scraper', entrada: { username: us, resultsLimit: por }, cuantos: us.length * por });
    }
  }
  const esperado = lotes.reduce((a, l) => a + l.cuantos, 0) * USD_POR_REEL;
  console.log(`  ${lotes.length} corridas, ~${lotes.reduce((a, l) => a + l.cuantos, 0)} reels, ~${usd(esperado)} esperado; techo ${usd(techo)}; libre ${usd(total)}.`);
  if (!deVerdad) { console.log('  EN SECO: no gasté ni bajé nada. Con --de-verdad corre.'); process.exit(0); }
  const gasto = new Map<string, number>();
  let gastado = 0, medidos = 0, sinVideo = 0;
  for (const l of lotes) {
    if (gastado >= techo) { console.log(`  Llegué al techo de ${usd(techo)}.`); break; }
    const r = await correr(cs, l.actor, l.entrada, Math.min(l.cuantos * USD_POR_REEL * 2 + 0.05, techo - gastado), gasto);
    if (!r.ok) { console.log(`  ✖ corrida: ${r.texto}`); if (/ninguna clave/.test(r.texto)) break; continue; }
    gastado = [...gasto.values()].reduce((a, b) => a + b, 0);
    for (const it of r.items) {
      const codigo = (it.shortCode as string) || codigoDe(it.url);
      const video = typeof it.videoUrl === 'string' ? it.videoUrl : null;
      if (!codigo || hechos.has(codigo)) continue;
      if (!video) { sinVideo++; continue; }
      const m = medir(carpeta, codigo, video);
      if (!m) continue;
      hechos.add(codigo);
      medidos++;
      appendFileSync(join(carpeta, 'medidas.jsonl'), JSON.stringify({ ...m, cuenta: it.ownerUsername ?? null, url: it.url ?? null, vistas: it.videoPlayCount ?? it.videoViewCount ?? null, megusta: it.likesCount ?? null, comentarios: it.commentsCount ?? null, fecha: it.timestamp ?? null, texto: String(it.caption ?? '').slice(0, 300), origen: comando, clave: rotulo(r.clave) }) + '\n');
    }
    console.log(`  · corrida con ${rotulo(r.clave)}: ${r.items.length} ítems · medidos en total ${medidos} · sin video ${sinVideo} · techo usado ~${usd(gastado)}`);
  }
  // El gasto REAL, leído de nuevo en cada clave.
  console.log('  Crédito después:');
  const despues = await clavesConCredito();
  for (const { k, c } of despues) {
    const antes = cs.find((x) => x.k.huella === k.huella)?.c;
    console.log(`    · ${rotulo(k)}: gastó ${antes && c ? usd(c.usado - antes.usado) : '?'} (usó ${c ? usd(c.usado) : '?'} de ${c ? usd(c.tope) : '?'})`);
  }
  writeFileSync(join(carpeta, `gasto-${comando}.txt`), despues.map(({ k, c }) => `${rotulo(k)}\t${c ? c.usado : '?'}\t${c ? c.tope : '?'}`).join('\n'));
} else {
  console.log('Comandos: credito | spy <carpeta> | cuentas <carpeta>  (en seco sin --de-verdad)');
}
