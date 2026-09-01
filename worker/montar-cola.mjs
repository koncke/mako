// =============================================================================
// El bucle del worker de montaje
// =============================================================================
// Pide trabajo, lo monta con el pipeline de `scripts/`, sube el resultado y
// reporta. Corre en el contenedor de `worker/Dockerfile`.
//
// ── Lo que este bucle NO hace, y es a propósito ────────────────────────────
// No decide nada del anuncio: no elige tomas, no arma prompts, no toca el guion.
// Recibe urls, segundos y el texto contra el que verificar. Toda la lógica de
// producto vive en MaKo — cuanto menos sepa el worker, menos veces hay que
// redeployarlo.
//
// ── Las lecciones de la cola de Flow, ya aplicadas ─────────────────────────
// · UN VIAJE, NO DOS. El mismo POST reporta lo hecho y se lleva lo próximo.
//   Parquear el resultado para el ciclo siguiente le agregaba un viaje entero a
//   cada trabajo, y eso costó la mitad del reloj de la otra cola.
// · CUANDO HAY TRABAJO NO SE DUERME. El sondeo lento es para cuando no hay nada.
// · Y EL PISO ENTRE LLAMADAS SE MIDE CONTRA LA ÚLTIMA, no con un sleep al final
//   del bucle: un sleep al final no separa nada si el ciclo siguiente arranca
//   por otro camino.

import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, writeFile, readFile, stat } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const MAKO = process.env.MAKO_URL || 'https://hola-mako.com';
const TOKEN = process.env.MONTAJE_WORKER_TOKEN || '';
/** Cada cuánto se pregunta cuando la cola está VACÍA. */
const DORMIR_MS = Number(process.env.MONTAJE_POLL_MS || 15_000);
/** El tope de un montaje. Más que esto es un cuelgue, no un anuncio largo. */
const TOPE_MS = Number(process.env.MONTAJE_TOPE_MS || 15 * 60_000);

if (!TOKEN) {
  console.error('FALTA MONTAJE_WORKER_TOKEN: sin eso la puerta contesta 404 y el worker gira en vano.');
  process.exit(1);
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Corre un comando y devuelve su salida. Rechaza con el stderr ENTERO. */
function correr(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    // ⚠️ EL STDERR ENTERO, no las últimas líneas. Recortarlo sirve para que una
    // persona lo lea y ROMPE la clasificación: con ffmpeg sobre un video
    // corrupto, las últimas cuatro dicen «Task finished with error code -22»
    // —que no distingue material roto de argumento mal puesto— y la causa real
    // («Invalid data found when processing input») sale al PRINCIPIO, sepultada.
    p.stderr.on('data', (d) => { err += d; });
    const reloj = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`timeout: ${cmd}`)); }, TOPE_MS);
    p.on('error', (e) => { clearTimeout(reloj); reject(e); });
    p.on('close', (code) => {
      clearTimeout(reloj);
      if (code === 0) return resolve({ out, err });
      const e = new Error(`${cmd} salió ${code}`);
      e.stderr = err;
      reject(e);
    });
  });
}

async function bajar(url, destino) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`no se pudo bajar (${r.status}) ${url.slice(0, 90)}`);
  await pipeline(r.body, createWriteStream(destino));
  const s = await stat(destino);
  // ⚠️ Que el archivo EXISTA no dice nada de si sirve. Un 0 bytes es un clip que
  // el pipeline daría por bueno y que ffmpeg rechazaría cinco pasos después, con
  // un error que no nombra el archivo.
  if (s.size < 1024) throw new Error(`el clip llegó vacío (${s.size} bytes)`);
}

/**
 * Clasifica la falla. Decide si se reintenta, así que no es texto libre.
 *
 * `material` y `verificacion` son DEFINITIVOS: reintentar un clip corrupto da el
 * mismo clip corrupto, y un montaje que perdió texto no mejora por repetirlo.
 */
function clasificar(e) {
  const t = `${e?.message || ''} ${e?.stderr || ''}`;
  if (/Invalid data found|moov atom not found|llegó vacío|does not contain any stream/i.test(t)) return 'material';
  if (/VERIFICACION|palabras perdidas|texto no coincide/i.test(t)) return 'verificacion';
  if (/timeout|ECONNRESET|ETIMEDOUT|fetch failed|50[0-9]\b/i.test(t)) return 'transitorio';
  return 'interno';
}

async function montar(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'montaje-'));
  try {
    const clips = path.join(dir, 'clips');
    await mkdir(clips, { recursive: true });

    // Los clips, con el nombre que el montaje espera: «<prefijo> - toma N.mp4».
    const prefijo = 'toma';
    for (const [i, url] of t.clips.entries()) {
      await bajar(url, path.join(clips, `${prefijo} - toma ${i + 1}.mp4`));
    }

    // El guion, para que el verificador compare contra el texto y no contra un
    // conteo: comerse el ataque de una palabra no cambia el conteo.
    await writeFile(path.join(dir, 'guion.txt'), t.guion || '', 'utf8');

    // ⚠️ EL PLAN EDITADO, SI VIENE. El montaje mira si `plan.json` ya existe y en
    // ese caso no recalcula: es todo el mecanismo del editor. El detector de
    // energia es un buen default, no la ultima palabra — una pausa retorica se le
    // parece a una muerta, y quien sabe cual es cual es el dueño del anuncio
    // mirandolo.
    if (t.plan && Array.isArray(t.plan.segs) && t.plan.segs.length) {
      await writeFile(path.join(dir, 'plan.json'), JSON.stringify(t.plan), 'utf8');
      console.log(`    plan editado: ${t.plan.segs.length} tramos, ${t.plan.total}s`);
    }

    // La música de fondo, si el anuncio eligió una. La url la resolvió MaKo
    // desde su catálogo: acá se baja y ya.
    let musica = '';
    if (t.musica) {
      musica = path.join(dir, 'musica.mp3');
      await bajar(t.musica, musica);
    }

    const seg = t.segundosPorToma || [];
    const env = {
      ...process.env,
      NTOMAS: String(t.clips.length),
      // Todas las tomas de un anuncio duran lo mismo hoy. Si dejan de durarlo,
      // esto pasa a ser una lista y el montaje tiene que leerla.
      DURVID: String(seg[0] ?? 10.005),
      CLIPS: clips,
      // Sin música, el paso NO se saltea: hace loudnorm sobre la voz sola. El
      // env queda como escape para probar una pista en el contenedor sin pasar
      // por el catálogo.
      MUSICA: musica || process.env.MONTAJE_MUSICA || '',
    };

    const salida = `${t.nombreArchivo || 'anuncio.mp4'}`;
    const { out } = await correr('bash', [
      '/app/scripts/montar-anuncio-sin-silencios.sh', prefijo, dir, salida, dir,
    ], { env, cwd: dir });
    console.log(out.trim().split('\n').map((l) => `    ${l}`).join('\n'));

    const mp4 = path.join(dir, salida);
    const s = await stat(mp4).catch(() => null);
    if (!s || s.size < 10_000) throw new Error(`el montaje no dejó archivo utilizable (${s?.size ?? 0} bytes)`);

    // Subir con la url firmada. `x-upsert` porque un reintento del mismo trabajo
    // escribe en la misma ruta.
    const bytes = await readFile(mp4);
    const r = await fetch(t.subida.url, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4', 'x-upsert': 'true' },
      body: bytes,
    });
    if (!r.ok) throw new Error(`la subida falló (${r.status}) ${(await r.text()).slice(0, 200)}`);

    // Los dos números que ve la persona. Salen del log del montaje, que ya los
    // imprime; si no se pudieron leer, se devuelven ausentes y la pantalla no
    // inventa ninguno.
    const antes = (t.clips.length * (seg[0] ?? 10.005));
    const mDur = /duration=?\s*([\d.]+)/i.exec(out);

    // ⚠️ EL PLAN VUELVE CON EL RESULTADO, y sin esto el editor no tendria que
    // editar. El detector corre en el contenedor y su salida se moria ahi: la
    // pantalla veia un video terminado y ninguna de las decisiones que lo
    // produjeron. Un montaje que no devuelve sus cortes es una caja negra.
    let plan = null;
    try { plan = JSON.parse(await readFile(path.join(dir, 'plan.json'), 'utf8')); } catch { /* sin plan, la pantalla lo dice */ }

    return {
      ruta: t.subida.ruta,
      url: t.publica,
      segundosAntes: Math.round(antes * 100) / 100,
      segundosDespues: mDur ? Math.round(Number(mDur[1]) * 100) / 100 : undefined,
      bytes: s.size,
      plan,
    };
  } finally {
    // Un contenedor que no limpia se queda sin disco a las pocas decenas de
    // anuncios, y el síntoma es un ffmpeg que falla por algo que no tiene nada
    // que ver.
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

async function ciclo(resultados) {
  const r = await fetch(`${MAKO}/api/montaje/worker`, {
    method: 'POST',
    headers: { authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ resultados, cuantos: 1 }),
  });
  if (!r.ok) throw new Error(`MaKo contestó ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const { trabajos } = await r.json();
  return trabajos || [];
}

async function main() {
  console.log(`[montaje] worker vivo · ${MAKO} · sondeo ${DORMIR_MS} ms`);
  let pendientes = [];
  for (;;) {
    let trabajos = [];
    try {
      trabajos = await ciclo(pendientes);
      pendientes = [];
    } catch (e) {
      // ⚠️ LOS RESULTADOS NO SE TIRAN SI EL REPORTE FALLA. Perder uno deja al
      // cliente mirando «montando…» sobre algo que ya terminó, y el trabajo
      // vuelve a la cola por colgado: se renderiza dos veces.
      console.error('[montaje] fallo el ciclo:', e.message);
      await dormir(DORMIR_MS);
      continue;
    }

    if (!trabajos.length) { await dormir(DORMIR_MS); continue; }

    for (const t of trabajos) {
      const t0 = Date.now();
      console.log(`[montaje] #${t.id} · ${t.clips.length} tomas · "${t.titulo}"`);
      try {
        const salida = await montar(t);
        pendientes.push({ id: t.id, ok: true, salida });
        console.log(`[montaje] #${t.id} listo en ${Math.round((Date.now() - t0) / 1000)}s`);
      } catch (e) {
        const motivo = clasificar(e);
        pendientes.push({ id: t.id, ok: false, motivo, error: `${e.message}\n${(e.stderr || '').slice(0, 1500)}` });
        console.error(`[montaje] #${t.id} FALLO (${motivo}): ${e.message}`);
      }
    }
    // Sin dormir: hay resultados que reportar y probablemente más trabajo.
  }
}

main().catch((e) => { console.error('[montaje] murió:', e); process.exit(1); });
