// =============================================================================
// El montaje de un anuncio, en Node: las tomas entran, sale el anuncio
// =============================================================================
// Es `scripts/montar-anuncio-sin-silencios.sh` pasado a Node, para correr adentro
// de una función de Vercel (app/api/cron/montaje/route.ts). Mismos pasos, mismos
// filtros y los mismos scripts de ayuda (`plan-cortes`, `gen-filtros`, `subs`,
// `loudnorm-json`), que se llaman tal cual.
//
// ⚠️ EL PASO QUE FALTABA, y por el que el worker no habría montado NUNCA. El bash
// lee `sts-N.mp3` —la voz de cada toma—, y ese archivo lo generaba sólo el script
// manual (`montar-anuncio-vertical.sh`, con ElevenLabs). El worker del contenedor
// bajaba los clips y llamaba al bash sin crearlos: el primer trabajo habría muerto
// en el plan de cortes. Acá la voz sale del audio del propio clip (la que Flow
// generó, en el acento del cliente), que es la que el anuncio lleva hoy.
//
// ⚠️ POR QUÉ NODE Y NO EL BASH. En la función de Vercel no está garantizado bash, y
// ffmpeg no está en el PATH: viene de `ffmpeg-static` (ffmpeg 6.1, sin ffprobe). Y
// ffmpeg 6.1 no entiende `-/filter_complex archivo` (es de la 7): los filtros se
// pasan en línea.
//
// SIN `server-only`: no tiene secretos propios (la clave de Groq la pasa quien
// llama) y así se puede correr desde un script para probarlo de punta a punta.

import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export type TrabajoMontaje = {
  id: number;
  /** Las urls públicas de las tomas, en orden. */
  clips: string[];
  /** El texto del anuncio (para el registro; los subtítulos salen de la voz). */
  guion: string;
  segundosPorToma: number[];
  /** Los cortes editados a mano. Con esto, el detector no corre. */
  plan: unknown;
  /** La url de la pista de fondo, o ''. */
  musica: string;
};

export type Herramientas = {
  ffmpeg: string;
  /** El node que corre los scripts de ayuda (en Vercel, `process.execPath`). */
  node: string;
  /** La carpeta de `scripts/` con los cuatro scripts de ayuda. */
  scripts: string;
  /** La carpeta con la Anton (.ttf). */
  fuentes: string;
  groqKey: string;
  /** Las líneas de avance, para el log de la función. */
  log?: (s: string) => void;
};

export type Montado = {
  dir: string;
  archivo: string;
  bytes: number;
  segundosAntes: number;
  segundosDespues: number | null;
  plan: unknown;
};

/** El tope de UN comando. Más que esto es un cuelgue, no un anuncio largo. */
const TOPE_COMANDO_MS = 8 * 60_000;

type Salida = { out: string; err: string };

/** Corre un comando. Rechaza con el stderr ENTERO: la causa de ffmpeg sale al principio. */
export function correr(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv; entrada?: string } = {}): Promise<Salida> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: [opts.entrada != null ? 'pipe' : 'ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout?.on('data', (d) => { out += d; });
    p.stderr?.on('data', (d) => { err += d; });
    const reloj = setTimeout(() => { p.kill('SIGKILL'); reject(Object.assign(new Error(`timeout: ${path.basename(cmd)}`), { stderr: err })); }, TOPE_COMANDO_MS);
    p.on('error', (e) => { clearTimeout(reloj); reject(e); });
    p.on('close', (code) => {
      clearTimeout(reloj);
      if (code === 0) return resolve({ out, err });
      reject(Object.assign(new Error(`${path.basename(cmd)} salió ${code}`), { stderr: err }));
    });
    if (opts.entrada != null && p.stdin) { p.stdin.end(opts.entrada); }
  });
}

async function bajar(url: string, destino: string): Promise<void> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`no se pudo bajar (${r.status}) ${url.slice(0, 90)}`);
  if (!r.body) throw new Error('el clip llegó vacío (sin cuerpo)');
  await pipeline(Readable.fromWeb(r.body as import('node:stream/web').ReadableStream), createWriteStream(destino));
  const s = await stat(destino);
  // Un 0 bytes es un clip que el pipeline daría por bueno y ffmpeg rechazaría
  // cinco pasos después, con un error que no nombra el archivo.
  if (s.size < 1024) throw new Error(`el clip llegó vacío (${s.size} bytes)`);
}

const num = (s: string) => Number(s.trim());

/**
 * Monta el anuncio. Si sale bien, deja todo en `dir` (quien llama sube el archivo
 * y borra la carpeta con `limpiar`). Si falla, la carpeta se borra acá: quien
 * llama no tiene cómo saber dónde quedó.
 */
export async function montarAnuncio(t: TrabajoMontaje, h: Herramientas): Promise<Montado> {
  const T = await mkdtemp(path.join(tmpdir(), `montaje-${t.id}-`));
  try {
    return await montarEn(T, t, h);
  } catch (e) {
    // ⚠️ /tmp ES COMPARTIDO entre invocaciones de una función caliente: una
    // carpeta de 60 MB que queda por cada falla llena el disco en pocas fallas, y
    // el síntoma es un ffmpeg que muere por algo que no tiene nada que ver.
    await limpiar(T);
    throw e;
  }
}

async function montarEn(T: string, t: TrabajoMontaje, h: Herramientas): Promise<Montado> {
  const log = h.log ?? (() => {});
  const ff = (args: string[], cwd = T) => correr(h.ffmpeg, args, { cwd });
  const script = (nombre: string, args: string[], env: NodeJS.ProcessEnv = {}, entrada?: string) =>
    correr(h.node, [path.join(h.scripts, nombre), ...args], { cwd: T, env: { ...process.env, FFMPEG: h.ffmpeg, GROQ_API_KEY: h.groqKey, ...env }, entrada });

  const N = t.clips.length;
  if (!N) throw new Error('el trabajo no trae tomas');
  // ⚠️ LA DURACIÓN DE CADA TOMA, no la de la primera para todas: las tomas de un
  // anuncio no duran lo mismo (10, 8, 10), y el plan topea cada una en este número.
  // Con el de la primera, lo dicho al final de una toma más larga se perdía.
  const durs = Array.from({ length: N }, (_, i) => {
    const d = Number(t.segundosPorToma?.[i]);
    return Number.isFinite(d) && d > 0 ? d : 10.005;
  });

  // ── 0. Bajar las tomas y sacar la voz de cada una ────────────────────────
  const clips = path.join(T, 'clips');
  await mkdir(clips, { recursive: true });
  for (const [i, url] of t.clips.entries()) {
    const destino = path.join(clips, `toma ${i + 1}.mp4`);
    await bajar(url, destino);
    await ff(['-y', '-v', 'error', '-i', destino, '-vn', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '160k', path.join(T, `sts-${i + 1}.mp3`)]);
  }
  let musica = '';
  if (t.musica) {
    musica = path.join(T, 'musica.mp3');
    await bajar(t.musica, musica);
  }

  // ── 1. El plan de cortes ─────────────────────────────────────────────────
  const planObj = t.plan as { segs?: unknown[] } | null;
  if (planObj && Array.isArray(planObj.segs) && planObj.segs.length) {
    log('1/6 plan de cortes: editado a mano, no se recalcula');
    await writeFile(path.join(T, 'plan.json'), JSON.stringify(t.plan), 'utf8');
  } else {
    log('1/6 plan de cortes');
    const { out } = await script('plan-cortes-anuncio.mjs', [T, String(N), durs.join(',')], { CLAMP: '0.45' });
    await writeFile(path.join(T, 'plan.json'), out, 'utf8');
  }
  const plan = JSON.parse(await readFile(path.join(T, 'plan.json'), 'utf8')) as { total: number; segs: unknown[] };
  const TOTAL = Number(plan.total);
  await script('gen-filtros-anuncio.mjs', [path.join(T, 'plan.json'), T, String(N)]);
  const filtroAudio = await readFile(path.join(T, 'filtro-audio.txt'), 'utf8');
  const filtroVideo = await readFile(path.join(T, 'filtro-video.txt'), 'utf8');

  // ── 2. La voz: cortar los tramos y pegarlos ──────────────────────────────
  log('2/6 voz: cortar los tramos y pegarlos');
  const entradasVoz = Array.from({ length: N }, (_, i) => ['-i', `sts-${i + 1}.mp3`]).flat();
  await ff(['-y', '-v', 'error', ...entradasVoz, '-filter_complex', filtroAudio, '-map', '[a]', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', 'voz-cruda.wav']);

  // ── 3. Cadena tonal + limitador ──────────────────────────────────────────
  log('3/6 voz: cadena tonal + limitador');
  await ff(['-y', '-v', 'error', '-i', 'voz-cruda.wav', '-af',
    'highpass=f=80:poles=2,deesser=i=0.35:m=0.5:f=0.5,acompressor=threshold=-18dB:ratio=3:attack=5:release=180:makeup=2,alimiter=limit=0.7:level=disabled',
    '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', 'voz-proc.wav']);

  // ── 4. Música (si hay) y loudnorm sobre la mezcla ────────────────────────
  if (musica) {
    log('4/6 música + mezcla');
    const med = await ff(['-hide_banner', '-t', String(TOTAL), '-i', musica, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
    const mi = num((await script('loudnorm-json.mjs', ['input_i'], {}, med.err)).out);
    const gan = (-33 - mi).toFixed(2);
    const fout = (TOTAL - 2.5).toFixed(2);
    await ff(['-y', '-v', 'error', '-t', String(TOTAL), '-i', musica, '-af', `volume=${gan}dB,afade=t=in:st=0:d=0.8,afade=t=out:st=${fout}:d=2.5`, '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', 'musica.wav']);
    await ff(['-y', '-v', 'error', '-i', 'voz-proc.wav', '-i', 'musica.wav', '-filter_complex', '[0:a]aformat=channel_layouts=stereo[v];[v][1:a]amix=inputs=2:normalize=0:duration=longest[m]', '-map', '[m]', '-ar', '48000', '-c:a', 'pcm_s16le', 'mezcla.wav']);
  } else {
    log('4/6 sin música');
    await ff(['-y', '-v', 'error', '-i', 'voz-proc.wav', '-af', 'aformat=channel_layouts=stereo', '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', 'mezcla.wav']);
  }
  const med = await ff(['-hide_banner', '-i', 'mezcla.wav', '-af', 'loudnorm=I=-14:TP=-1:LRA=11:print_format=json', '-f', 'null', '-']);
  const [i, tp, lra, umbral] = (await script('loudnorm-json.mjs', ['input_i', 'input_tp', 'input_lra', 'input_thresh'], {}, med.err)).out.trim().split(/\s+/);
  await ff(['-y', '-hide_banner', '-v', 'error', '-i', 'mezcla.wav', '-af',
    `loudnorm=I=-14:TP=-1:LRA=11:measured_I=${i}:measured_TP=${tp}:measured_LRA=${lra}:measured_thresh=${umbral}:linear=true,alimiter=limit=0.891:level=disabled`,
    '-ar', '48000', '-ac', '2', '-c:a', 'pcm_s16le', 'audio.wav']);

  // ── 5. Subtítulos sobre la voz final ─────────────────────────────────────
  log('5/6 subtítulos');
  await ff(['-y', '-v', 'error', '-i', 'voz-proc.wav', '-ac', '1', '-ar', '16000', '-b:a', '64k', 'voz16k.mp3']);
  await script('subs-anuncio.mjs', ['voz16k.mp3', 'subs.ass'], { SUBS_FUENTE: 'Anton' });

  // ── 6. Render: trims + concat + subtítulos, en una pasada ────────────────
  log('6/6 render');
  // ⚠️ LA FUENTE TIENE QUE ESTAR: libass NO falla sin ella, cae a otra en silencio.
  await mkdir(path.join(T, 'fuentes'), { recursive: true });
  const ttf = (await readdir(h.fuentes)).filter((f) => f.toLowerCase().endsWith('.ttf'));
  if (!ttf.length) throw new Error(`no hay ninguna .ttf en ${h.fuentes}: los subtítulos saldrían con otra fuente sin avisar`);
  for (const f of ttf) await copyFile(path.join(h.fuentes, f), path.join(T, 'fuentes', f));
  // Sin un fonts.conf, el fontconfig de un ffmpeg estático busca el del sistema y
  // en la función no hay: se le da uno que apunta a la carpeta de la Anton.
  await writeFile(path.join(T, 'fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${path.join(T, 'fuentes')}</dir><cachedir>${path.join(T, 'fc-cache')}</cachedir></fontconfig>`, 'utf8');
  const entradasVideo = Array.from({ length: N }, (_, k) => ['-i', path.join('clips', `toma ${k + 1}.mp4`)]).flat();
  await correr(h.ffmpeg, ['-y', '-v', 'error', ...entradasVideo, '-i', 'audio.wav',
    '-filter_complex', filtroVideo,
    '-map', '[v]', '-map', `${N}:a`,
    // `medium` y no el `slow` del bash: en una función el reloj es el límite, y a
    // crf 18 la diferencia de calidad no se ve.
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.0', '-r', '24',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', '-shortest', 'final.mp4'],
  { cwd: T, env: { ...process.env, FONTCONFIG_FILE: path.join(T, 'fonts.conf') } });

  const archivo = path.join(T, 'final.mp4');
  const s = await stat(archivo).catch(() => null);
  if (!s || s.size < 10_000) throw new Error(`el montaje no dejó un archivo utilizable (${s?.size ?? 0} bytes)`);
  const dur = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec((await ff(['-hide_banner', '-i', 'final.mp4']).catch((e: { stderr?: string }) => ({ out: '', err: e.stderr ?? '' }))).err);
  return {
    dir: T,
    archivo,
    bytes: s.size,
    segundosAntes: Math.round(durs.reduce((a, b) => a + b, 0) * 100) / 100,
    segundosDespues: dur ? Math.round((+dur[1] * 3600 + +dur[2] * 60 + +dur[3]) * 100) / 100 : null,
    plan,
  };
}

export async function limpiar(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true }).catch(() => {});
}
