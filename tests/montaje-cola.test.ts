// =============================================================================
// La cola de montaje tiene quien la atienda, y nada espera en ella para siempre
// =============================================================================
// El 20/10/2026 (llamada con Leila del 19/10) la pantalla del Video Generator
// decía «Lleva 68.646 minutos esperando turno». Era un trabajo real del 01/09: la
// cola `montaje_trabajos` se llenaba, pero el proceso que la ejecutaba —un worker
// en contenedor (worker/)— nunca se desplegó. Y aunque se hubiera desplegado, no
// habría montado nada: el bash que llamaba lee la voz de cada toma de
// `sts-N.mp3`, y esos archivos no los creaba nadie.
//
// Lo que fija este archivo:
//   · la cola la atiende un cron de Vercel (app/api/cron/montaje), agendado, con
//     todo lo que ejecuta trazado dentro de la función;
//   · antes de tomar, da de baja lo vencido, y no toma nada si le falta ffmpeg o
//     la clave de la transcripción (tomar quema un intento);
//   · el montaje en Node corre de verdad: saca la voz de cada toma, calcula los
//     cortes SIN ffprobe, y pasa los filtros en línea;
//   · la pantalla dice «vencido» como lo que es, y la espera en horas.
//
// La corrida real del pipeline necesita un ffmpeg: `FFMPEG_PATH`, o el de
// `ffmpeg-static` en node_modules (el CI lo instala). Sin ninguno, se saltea.
//
// PROBADO ROMPIÉNDOLO (20/10/2026, con el ffmpeg 6.1.1 de ffmpeg-static para
// Windows; base 12 / 0). Pasan / fallan:
//   R1  el vencimiento también da de baja los `tomado`                 → 11 / 1
//   R2  VENCE_HORAS = 1 (menos que el peor reintento vivo)              → 11 / 1
//   R3  un 404 al bajar la toma deja de ser «material»                  → 10 / 2
//   R4  la espera vuelve a decirse siempre en minutos                   → 11 / 1
//   R5  el cron toma aunque falte ffmpeg o la clave de Groq             → 11 / 1
//   R6  toda falla cierra el trabajo (nada vuelve a la fila)            → 11 / 1
//   R7  el cron sale de vercel.json                                     → 11 / 1
//   R8  loudnorm-json.mjs sale del trazado de la función                → 11 / 1
//   R9  se borra el paso que saca la voz de cada toma (sts-N.mp3)       → 10 / 2
//   R10 la duración vuelve a salir sólo de ffprobe                      → 11 / 1
//   R11 el pipeline no borra su carpeta al fallar                       → 10 / 2
//   R12 vuelven los «${estado.esperando} minutos» en la pantalla        → 11 / 1
//   R13 los filtros por archivo (`-/filter_complex`, sólo ffmpeg 7)     → 10 / 2
//   R14 el plan recibe sólo la duración de la primera toma              → 11 / 1
// Y después de la revisión adversarial del 20/10 (noche; base 14 / 0 sin FFMPEG_PATH, el real se saltea):
//   N1  vence ANTES de preguntar si puede montar                      → 13 / 1
//   N2  con algo que falta, no avisa al equipo                        → 13 / 1
//   N3  vuelve el stderr crudo a la columna que lee el cliente        → 13 / 1
//   N4  el vencido vuelve a prometer «arranca en el momento»          → 13 / 1
//   N5  la pantalla vuelve a mostrar `${estado.error}`                → 13 / 1
//   N6  ffmpeg-static vuelve a ser dependencia obligatoria            → 13 / 1
//   N7  el lock no la marca opcional                                  → 13 / 1
//   N8  la frase para el cliente deja ver lo técnico                  → 13 / 1
// Y después de la segunda revisión (21/10; base 17 / 0):
//   P1  la clave de Groq vuelve a leerse de process.env               → 16 / 1
//   P2  con una toma rota se re-monta con los cortes viejos           → 16 / 1
//   P3  «Montar de nuevo» no usa los cortes del montaje que falló     → 16 / 1
//   P4  los usa sin validarlos contra las tomas de ahora              → 16 / 1
//   P5  el teléfono dice «No se pudo montar» de un vencido            → 16 / 1
//   P6  el teléfono no recibe el motivo                               → 16 / 1
// La primera pasada destapó una trampa del propio test: R11 dejó carpetas en
// /tmp y la base siguiente dio 10 / 2. Por eso cada corrida usa ids propios.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { clasificar, corteDeVencimiento, ERROR_VENCIDO, errorParaLaPersona, esDefinitiva, MOTIVO_VENCIDO, planParaRemontar, textoEspera, VENCE_HORAS } from '../lib/montaje/cola';
import { pieDelEditor, resumenDeAnuncio, type TomaM } from '../app/m/video/modelo';
import { montarAnuncio } from '../lib/montaje/pipeline';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

// ── Las reglas ───────────────────────────────────────────────────────────────

test('el trabajo del 01/09 está vencido el 20/10; uno de hace media hora, no', () => {
  const ahora = Date.parse('2026-10-20T15:00:00Z');
  const corte = corteDeVencimiento(ahora);
  // `.lt('created_at', corte)`: vence lo que es ANTERIOR al corte.
  assert.ok('2026-09-01T18:00:00.000Z' < corte, 'el de la llamada con Leila seguiría esperando');
  assert.ok(new Date(ahora - 30 * 60_000).toISOString() > corte, 'daría de baja uno que acaba de entrar');
});

test('el vencimiento no corta a un trabajo que todavía está en sus reintentos', () => {
  // El peor caso vivo: tres tomas colgadas, cada una rescatada a los N minutos.
  const sql = leer('supabase/migrations/0151_montaje_cola.sql');
  const rescate = Number(/tomado_at < now\(\) - interval '(\d+) minutes'/.exec(sql)?.[1]);
  const tope = Number(/intentos >= (\d+)/.exec(sql)?.[1]);
  assert.ok(rescate > 0 && tope > 0, 'no encontré el rescate o el tope en la migración 0151');
  assert.ok(VENCE_HORAS * 60 > rescate * tope * 2,
    `vence a las ${VENCE_HORAS} h y un trabajo vivo puede tardar ${rescate * tope} min en sus reintentos`);
});

test('las fallas: una toma rota o que ya no está no se reintenta; la red y el tope de Groq sí', () => {
  const casos: Array<[unknown, string]> = [
    [{ message: 'ffmpeg salió 1', stderr: 'moov atom not found' }, 'material'],
    [{ message: 'el clip llegó vacío (0 bytes)' }, 'material'],
    [{ message: 'no se pudo bajar (404) https://x/toma.mp4' }, 'material'],
    [{ message: 'no se pudo bajar (503) https://x/toma.mp4' }, 'transitorio'],
    [{ message: 'node salió 1', stderr: 'GROQ 429: rate limit' }, 'transitorio'],
    [{ message: 'fetch failed' }, 'transitorio'],
    [{ message: 'timeout: ffmpeg' }, 'transitorio'],
    [{ message: 'VERIFICACION: palabras perdidas' }, 'verificacion'],
    [{ message: 'node salió 1', stderr: 'FALTA GROQ_API_KEY' }, 'interno'],
    [null, 'interno'],
  ];
  for (const [e, motivo] of casos) assert.equal(clasificar(e), motivo, JSON.stringify(e));
  assert.equal(esDefinitiva('material'), true);
  assert.equal(esDefinitiva('verificacion'), true);
  for (const m of ['transitorio', 'interno', '']) assert.equal(esDefinitiva(m), false, m);
});

test('al cliente le llega una frase, nunca el error técnico, y el vencido no promete cuándo arranca', () => {
  for (const m of ['material', 'verificacion', 'transitorio', 'interno', 'cualquiera']) {
    const f = errorParaLaPersona(m);
    assert.ok(f.length > 10 && f.length < 80, `«${m}»: «${f}»`);
    assert.doesNotMatch(f, /ffmpeg|groq|stderr|salió|\d{3}|org_/i, `«${m}» deja ver lo técnico: «${f}»`);
  }
  // «Arranca ahora» era falso justo en la caída que el vencimiento cubre (revisión del 20/10).
  assert.doesNotMatch(ERROR_VENCIDO, /ahora|en el momento|enseguida|ya mismo/i);
});

test('la espera se dice en horas: nunca «68.646 minutos»', () => {
  assert.equal(textoEspera(12), 'Lleva 12 minutos esperando turno. Escríbenos si sigue así.');
  assert.equal(textoEspera(60), 'Lleva una hora esperando turno. Escríbenos si sigue así.');
  assert.equal(textoEspera(68646), 'Lleva 1144 horas esperando turno. Escríbenos si sigue así.');
  for (const m of [60, 61, 359, 68646]) assert.doesNotMatch(textoEspera(m), /minutos/, `${m}`);
});

// ── El cron ─────────────────────────────────────────────────────────────────

const RUTA = sinComentarios(leer('app/api/cron/montaje/route.ts'));

test('el cron vence ANTES de tomar, y sólo lo pendiente y anterior al corte', () => {
  const vence = RUTA.indexOf("estado: 'fallido', motivo: MOTIVO_VENCIDO");
  const toma = RUTA.indexOf("rpc('montaje_tomar'");
  assert.ok(vence > 0 && toma > 0, 'no encontré el vencimiento o la toma');
  assert.ok(vence < toma, 'toma antes de vencer: el primero que agarra es el más viejo, el que ya nadie espera');
  const bloque = RUTA.slice(vence, toma);
  assert.match(bloque, /\.eq\('estado', 'pendiente'\)/, 'vencería trabajos tomados o listos');
  assert.match(bloque, /\.lt\('created_at', corteDeVencimiento\(\)\)/);
  assert.match(bloque, /estado: 'fallido'/);
});

test('sin ffmpeg o sin la clave de Groq, el cron no vence ni toma nada, y avisa al equipo', () => {
  const falta = RUTA.indexOf('if (falta)');
  const vence = RUTA.indexOf("estado: 'fallido', motivo: MOTIVO_VENCIDO");
  const toma = RUTA.indexOf("rpc('montaje_tomar'");
  assert.ok(falta > 0 && falta < toma, 'pregunta por las herramientas DESPUÉS de tomar: tomar quema un intento');
  assert.ok(falta < vence, 'vence en una corrida que no puede montar: el cliente lo monta de nuevo y tampoco lo toma nadie');
  assert.match(RUTA, /!h\.groqKey/);
  assert.match(RUTA, /ffmpegEjecutable\(h\.ffmpeg\)/);
  const bloque = RUTA.slice(falta, vence);
  assert.match(bloque, /await avisarAlEquipo\(/, 'el cron caído sólo se vería en un log');
  assert.match(bloque, /return Response\.json/);
  assert.match(RUTA, /registrarError\(\{ origen: 'servidor', nombre: 'MontajeCron'/);
});

test('el error que se guarda en el trabajo es la frase para el cliente; el detalle va al log', () => {
  assert.match(RUTA, /error: errorParaLaPersona\(motivo\),/);
  assert.doesNotMatch(RUTA, /error: detalle/, 'volvió el stderr crudo a la columna que lee el cliente');
  assert.match(RUTA, /console\.error\(`\[montaje\] #\$\{id\} falló \(\$\{motivo\}\):`, detalle\)/);
});

test('una falla definitiva cierra el trabajo; las otras lo devuelven a la fila', () => {
  assert.match(RUTA, /estado: definitiva \? 'fallido' : 'pendiente'/);
  assert.match(RUTA, /tomado_at: null/);
  assert.match(RUTA, /const definitiva = esDefinitiva\(motivo\)/);
});

test('el cron está agendado, con techo de función larga, y lleva adentro todo lo que ejecuta', () => {
  const crons = (JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string; schedule: string }> }).crons;
  assert.ok(crons.some((c) => c.path === '/api/cron/montaje'), 'sin entrada en vercel.json el cron no corre nunca');
  assert.match(RUTA, /export const maxDuration = 800;/);
  assert.match(RUTA, /export const runtime = 'nodejs';/);

  const conf = leer('next.config.ts');
  const entrada = /'\/api\/cron\/montaje': \[([\s\S]*?)\]/.exec(conf)?.[1] ?? '';
  assert.ok(entrada, 'falta la entrada del cron en outputFileTracingIncludes');
  assert.match(entrada, /'\.\/node_modules\/ffmpeg-static\/ffmpeg'/, 'la función llegaría sin ffmpeg');
  assert.match(entrada, /'\.\/worker\/fuentes\/\*\.ttf'/, 'sin la Anton, libass pone otra fuente sin avisar');
  // Cada script que el pipeline llama tiene que viajar con la función: nadie los
  // importa, así que el trazado no los ve solo.
  const llamados = [...leer('lib/montaje/pipeline.ts').matchAll(/script\('([\w-]+\.mjs)'/g)].map((m) => m[1]);
  assert.ok(llamados.length >= 4, `encontré ${llamados.length} scripts llamados`);
  for (const s of new Set(llamados)) {
    assert.ok(existsSync(join(RAIZ, 'scripts', s)), `el pipeline llama a scripts/${s}, que no existe`);
    assert.ok(entrada.includes(`'./scripts/${s}'`), `scripts/${s} no viaja con la función del cron`);
  }
  // ffmpeg-static fija el binario: un salto de versión cambia el ffmpeg sin avisar.
  assert.match(leer('package.json'), /"ffmpeg-static": "\d+\.\d+\.\d+"/);
});

test('ffmpeg-static es OPCIONAL: si su descarga de GitHub falla, npm ci y el build siguen', () => {
  // Medido el 20/10 en una carpeta aparte con FFMPEG_BINARIES_URL cortada: como dependencia común, `npm ci` sale 1
  // (install.js hace process.exit(1)); como opcional, sale 0 y no queda el binario. Sin el binario, el cron no corre
  // (`falta`, arriba) y el include del trazado no encuentra nada, que Next acepta sin error.
  const pkg = JSON.parse(leer('package.json')) as { dependencies?: Record<string, string>; optionalDependencies?: Record<string, string> };
  assert.equal(pkg.dependencies?.['ffmpeg-static'], undefined, 'como dependencia común, una caída de GitHub tumba npm ci y todos los deploys');
  assert.match(pkg.optionalDependencies?.['ffmpeg-static'] ?? '', /^\d+\.\d+\.\d+$/);
  const lock = JSON.parse(leer('package-lock.json')) as { packages: Record<string, { optional?: boolean }> };
  assert.equal(lock.packages['node_modules/ffmpeg-static']?.optional, true, 'el lock no la marca opcional: npm ci la trataría como obligatoria');
});

// ── El pipeline ─────────────────────────────────────────────────────────────

test('el pipeline saca la voz de cada toma ANTES del plan, y pasa los filtros en línea', () => {
  const p = sinComentarios(leer('lib/montaje/pipeline.ts'));
  const voz = p.indexOf('`sts-${i + 1}.mp3`');
  const plan = p.indexOf("'plan-cortes-anuncio.mjs'");
  assert.ok(voz > 0 && voz < plan, 'el plan de cortes lee sts-N.mp3: sin este paso no hay montaje');
  // `-/filter_complex archivo` es de ffmpeg 7: el de Windows de ffmpeg-static es 6.1.
  assert.doesNotMatch(p, /-\/filter_complex/);
});

function ffmpegDePrueba(): string {
  const candidatos = [
    process.env.FFMPEG_PATH,
    join(RAIZ, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  ];
  return candidatos.find((c) => c && existsSync(c)) ?? '';
}

/** Un servidor local con las tomas: el pipeline las baja por http, como en producción. */
async function servir(archivos: Record<string, string>): Promise<{ url: (n: string) => string; cerrar: () => void }> {
  const srv = http.createServer((req, res) => {
    const f = archivos[String(req.url).slice(1)];
    if (f === undefined) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'video/mp4' });
    res.end(f === '' ? '' : readFileSync(f));
  });
  await new Promise<void>((ok) => srv.listen(0, '127.0.0.1', ok));
  const { port } = srv.address() as { port: number };
  return { url: (n) => `http://127.0.0.1:${port}/${n}`, cerrar: () => srv.close() };
}

const carpetasDe = (id: number) => readdirSync(tmpdir()).filter((d) => d.startsWith(`montaje-${id}-`));
// Ids propios de ESTA corrida: una corrida anterior que dejó carpetas (justo lo
// que estos tests buscan) no puede hacer fallar a la siguiente.
let proximoId = 7_000_000 + (process.pid % 100_000) * 10;
const idNuevo = () => proximoId++;

test('una toma que ya no está falla como «material», y la carpeta de trabajo no queda', async () => {
  const s = await servir({ 'vacia.mp4': '' });
  const herr = { ffmpeg: 'ffmpeg', node: process.execPath, scripts: join(RAIZ, 'scripts'), fuentes: join(RAIZ, 'worker', 'fuentes'), groqKey: '' };
  try {
    for (const [id, toma] of [[idNuevo(), 'no-existe.mp4'], [idNuevo(), 'vacia.mp4']] as const) {
      const e = await montarAnuncio({ id, clips: [s.url(toma)], guion: '', segundosPorToma: [3], plan: null, musica: '' }, herr)
        .then(() => null, (x: unknown) => x);
      assert.ok(e, `${toma}: montó algo que no existe`);
      assert.equal(clasificar(e), 'material', `${toma}: ${(e as Error).message}`);
      assert.deepEqual(carpetasDe(id), [], `${toma}: dejó la carpeta en /tmp`);
    }
  } finally { s.cerrar(); }
});

test('el montaje corre de verdad hasta los subtítulos: voz de cada toma, cortes SIN ffprobe, mezcla', async (t) => {
  const ffmpeg = ffmpegDePrueba();
  if (!ffmpeg) { t.skip('sin ffmpeg (FFMPEG_PATH o node_modules/ffmpeg-static)'); return; }

  // Tres tomas con un tono de 1,2 s: lo de antes y después es silencio, y el plan
  // tiene que cortarlo. ⚠️ LA DEL MEDIO DURA MÁS (4,5 s) y su tono va AL FINAL
  // (de 3 a 4,2 s): con la duración de la primera toma para todas, quedaba afuera.
  const dir = mkdtempSync(join(tmpdir(), 'tomas-prueba-'));
  const tomas: Record<string, string> = {};
  const DUR = [3, 4.5, 3];
  for (const n of [1, 2, 3]) {
    const f = join(dir, `t${n}.mp4`);
    const d = DUR[n - 1];
    const desde = n === 2 ? 3000 : 900;
    const r = spawnSync(ffmpeg, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=180x320:rate=24:duration=${d}`,
      '-f', 'lavfi', '-i', `sine=frequency=${300 + n * 100}:duration=1.2`,
      '-filter_complex', `[1:a]adelay=${desde}|${desde},apad=whole_dur=${d}[a]`, '-map', '0:v', '-map', '[a]', '-t', String(d),
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', f]);
    assert.equal(r.status, 0, `no se pudo armar la toma ${n}: ${r.stderr}`);
    tomas[`t${n}.mp4`] = f;
  }
  const s = await servir(tomas);
  // ⚠️ SIN ffprobe, como en la función: ffmpeg-static no lo trae. Antes de
  // 20/10 el plan leía la duración sólo de ffprobe y, sin él, daba 0 sin error.
  const ffprobeAntes = process.env.FFPROBE;
  process.env.FFPROBE = join(dir, 'no-hay-ffprobe');
  const id = idNuevo();
  type Visto = { archivos: string[]; plan: { total: number; segs: Array<{ toma: number; ini: number; fin: number }> } };
  // `as` y no una anotación: con `: Visto | null = null` TypeScript lo da por null
  // para siempre (la asignación pasa adentro de un callback y no la sigue).
  let visto = null as Visto | null;
  try {
    const e = await montarAnuncio({ id, clips: [1, 2, 3].map((n) => s.url(`t${n}.mp4`)), guion: '', segundosPorToma: DUR, plan: null, musica: '' }, {
      ffmpeg, node: process.execPath, scripts: join(RAIZ, 'scripts'), fuentes: join(RAIZ, 'worker', 'fuentes'), groqKey: '',
      // Al llegar a los subtítulos (que piden Groq) se mira la carpeta y se corta.
      log: (l) => {
        if (!l.startsWith('5/6')) return;
        const [T] = carpetasDe(id).map((d) => join(tmpdir(), d));
        visto = { archivos: readdirSync(T), plan: JSON.parse(readFileSync(join(T, 'plan.json'), 'utf8')) };
        for (const a of ['audio.wav', 'voz-proc.wav']) assert.ok(statSync(join(T, a)).size > 10_000, `${a} vacío`);
        throw new Error('PARADA_DE_PRUEBA');
      },
    }).then(() => null, (x: unknown) => x);
    assert.equal((e as Error)?.message, 'PARADA_DE_PRUEBA', `el pipeline falló antes de los subtítulos: ${(e as Error)?.message}\n${String((e as { stderr?: string })?.stderr ?? '').slice(0, 800)}`);
  } finally {
    s.cerrar();
    if (ffprobeAntes === undefined) delete process.env.FFPROBE; else process.env.FFPROBE = ffprobeAntes;
    rmSync(dir, { recursive: true, force: true });
  }
  assert.ok(visto, 'el pipeline no llegó a los subtítulos');
  const v = visto;
  for (const n of [1, 2, 3]) assert.ok(v.archivos.includes(`sts-${n}.mp3`), `falta sts-${n}.mp3: la voz de la toma ${n}`);
  assert.deepEqual([...new Set(v.plan.segs.map((x) => x.toma))].sort(), [1, 2, 3], 'alguna toma quedó afuera del plan');
  const finToma2 = Math.max(...v.plan.segs.filter((x) => x.toma === 2).map((x) => x.fin));
  assert.ok(finToma2 > 3.9, `la toma 2 se corta en ${finToma2} s: lo dicho después del largo de la PRIMERA toma se pierde`);
  // El tono dura 1,2 s por toma: el plan corta el silencio (menos de 9 s) y no
  // se come el tono (más de 3 s). Con la duración en 0, el total sería 0.
  assert.ok(v.plan.total > 3 && v.plan.total < 6, `total ${v.plan.total}`);
  assert.deepEqual(carpetasDe(id), [], 'la carpeta de trabajo quedó en /tmp después de la falla');
});

// ── La pantalla ─────────────────────────────────────────────────────────────

test('la pantalla dice «vencido» como lo que es, y la espera con textoEspera', () => {
  const src = leer('app/video-generator/PasoMontaje.tsx');
  assert.match(src, /estado\.motivo === MOTIVO_VENCIDO/);
  assert.match(src, /textoEspera\(estado\.esperando\)/);
  assert.doesNotMatch(src, /\$\{estado\.esperando\} minutos/, 'volvió el «68.646 minutos»');
  assert.equal(MOTIVO_VENCIDO, 'vencido');
  // Ni el error crudo de un trabajo viejo, ni la promesa de que arranca ya.
  assert.doesNotMatch(sinComentarios(src), /\$\{estado\.error\}/, 'la pantalla vuelve a mostrar el error técnico');
  assert.doesNotMatch(src, /arranca ahora/);
});

// ── Lo que encontró la segunda revisión (21/10) ────────────────────────────────────────────────────────

test('la clave de Groq se lee con envCred: en frío, process.env todavía no la tiene', () => {
  // instrumentation.ts copia las claves de la base a process.env y Next 16 no lo espera: leída a secas, cada
  // arranque en frío daba «falta GROQ_API_KEY», un ticket falso y la corrida perdida.
  assert.match(RUTA, /herramientas\(\(await envCred\('GROQ_API_KEY'\)\.catch\(\(\) => null\)\) \?\? ''\)/);
  assert.doesNotMatch(RUTA, /process\.env\.GROQ_API_KEY/, 'volvió la clave de IA leída de process.env a secas');
  assert.match(RUTA, /import \{ envCred \} from '@\/lib\/credenciales';/);
});

test('«Montar de nuevo» usa los cortes del montaje que falló, salvo una toma rota', () => {
  const plan = { total: 4, segs: [{ toma: 1, ini: 0.5, fin: 2.5 }, { toma: 2, ini: 0, fin: 2 }] };
  assert.deepEqual(planParaRemontar({ motivo: 'transitorio', pedido: { plan } }), plan);
  assert.deepEqual(planParaRemontar({ motivo: 'vencido', pedido: { plan } }), plan);
  // Con una toma rota hay que re-filmarla: las duraciones cambian y los cortes viejos no sirven.
  assert.equal(planParaRemontar({ motivo: 'material', pedido: { plan } }), null);
  for (const previo of [null, undefined, {}, { motivo: 'interno', pedido: { plan: null } }, { motivo: 'interno', pedido: { plan: { segs: [] } } }]) {
    assert.equal(planParaRemontar(previo as never), null, JSON.stringify(previo));
  }
  // La action los busca en el último FALLIDO de este anuncio y los vuelve a validar contra las tomas de ahora.
  const accion = sinComentarios(leer('app/video-generator/video-action.ts'));
  const bloque = accion.slice(accion.indexOf('if (!plan) {'), accion.indexOf("const { data, error } = await db\n    .from('montaje_trabajos')\n    .insert("));
  assert.match(bloque, /\.eq\('estado', 'fallido'\)/);
  assert.match(bloque, /const anterior = leerPlan\(planParaRemontar\(previo\)\);/);
  assert.match(bloque, /if \(anterior && !porQueNoSirveElPlan\(anterior, /, 'usa cortes viejos sin validarlos contra las tomas de ahora');
});

test('en el teléfono, un vencido no dice «No se pudo montar»', () => {
  const tomas: TomaM[] = [{ n: 1, estado: 'filmada', segundos: 8 }, { n: 2, estado: 'filmada', segundos: 8 }];
  assert.deepEqual(resumenDeAnuncio(tomas, { fase: 'error', motivo: MOTIVO_VENCIDO }), { texto: 'Se dio de baja', tono: 'warn' });
  assert.equal(pieDelEditor(tomas, { fase: 'error', motivo: MOTIVO_VENCIDO }, false).consecuencia, 'Se dio de baja: móntalo de nuevo en la computadora.');
  // Una falla de verdad sigue diciéndose así.
  assert.deepEqual(resumenDeAnuncio(tomas, { fase: 'error', motivo: 'interno' }), { texto: 'No se pudo montar', tono: 'bad' });
  assert.match(sinComentarios(leer('app/m/video/datos.ts')), /if \(e\.fase === 'error'\) return \{ fase: 'error', motivo: e\.motivo \};/, 'el teléfono no recibe el motivo');
});
