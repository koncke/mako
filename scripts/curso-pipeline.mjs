// Corre la cola audio -> transcripción hasta terminar el curso, mientras la
// descarga sigue en vuelo.
//
// Existe porque «ir transcribiendo a medida que bajan» a mano son N idas y vueltas,
// y las dos etapas ya son idempotentes y reanudables: correrlas en loop es todo lo
// que hace falta. El filtro de curso-audio.mjs es lo que hace esto seguro — no
// toca un video a medio bajar (ver docs/hallazgos-conocimiento.md).
//
// Termina cuando todas las clases del plan tienen su .md, o cuando pasa el tope de
// horas, o cuando se queda sin progreso N rondas seguidas (la descarga murió).
//
//   node <abs>\scripts\curso-pipeline.mjs --plan C:\cursos\<slug>\plan.json
//   node <abs>\scripts\curso-pipeline.mjs --plan … --paralelo 4 --tope-horas 14

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { esIntermedio } from './curso-comun.mjs';

const arg = (n, d) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};

const PLAN = arg('plan', '');
const PARALELO = arg('paralelo', '3');
const TOPE_H = Number(arg('tope-horas', 12));
const PAUSA_S = Number(arg('pausa', 90));
const SIN_PROGRESO_MAX = Number(arg('rondas-secas', 8)); // 8 × 90s = 12 min quieto
const DRIVE = process.argv.includes('--drive');           // copiar a Drive cada ronda

if (!PLAN || !existsSync(PLAN)) { console.error('\n  ✖ Falta --plan <plan.json>\n'); process.exit(1); }
const base = dirname(PLAN);
// Ver la nota del BOM en curso-bajar.mjs: PowerShell 5.1 lo mete y JSON.parse muere.
const plan = JSON.parse(readFileSync(PLAN, 'utf8').replace(/^﻿/, ''));
const SCRIPTS = dirname(new URL(import.meta.url).pathname.replace(/^\//, ''));

/**
 * ⚠️ EL OBJETIVO SON LAS CLASES ALCANZABLES, no las filas del plan.
 *
 * Una clase sin `videoId` —o marcada `sinFuente`— no tiene video del otro lado: no se
 * puede bajar, no se puede transcribir, y contarla en el objetivo lo vuelve inalcanzable.
 * El curso no dice «completo» jamás, quema el tope de rondas secas en CADA rebobinado de
 * la cola, y nunca se publica. «Creativos Animados» lleva así desde que entró: 1 de 2, con
 * la otra sin ningún video que bajar.
 *
 * Es la misma correccion que la de las clases MUDAS, un escalon antes: alla el material
 * existe y no tiene voz, aca no existe. En los dos casos «no hay nada que hacer» no puede
 * leerse como «falta trabajo».
 *
 * Medido antes de cambiarlo: 1 clase de 5.007 en los 77 cursos, y NINGUNA de las excluidas
 * tiene texto —si alguna lo tuviera, sacarla del total estaria escondiendo trabajo hecho—.
 */
const alcanzables = plan.clases.filter((c) => c.videoId && !c.sinFuente);
const total = alcanzables.length;
if (alcanzables.length !== plan.clases.length) {
  const n = plan.clases.length - alcanzables.length;
  console.log(`  (${n} clase(s) del plan no tienen video en el origen: no cuentan para el objetivo)`);
}
const cuenta = (sub, filtro) => {
  const d = join(base, sub);
  if (!existsSync(d)) return 0;
  return readdirSync(d).filter(filtro).length;
};
// ⚠️ QUÉ ES UN INTERMEDIO LO DECIDE `esIntermedio`, NO UN REGEX PROPIO.
// Acá había una copia (`!/\.f[^.]*\.mp4$/`) que no conocía el `.temp.mp4` —el archivo
// donde yt-dlp UNE video y audio cuando la calidad alta viene en pistas separadas—, así
// que el temporal del merge se contaba como clase lista. Medido en «Trilogía de BRIAN
// TRACY»: la clase 11 son 4,6 GB + 955 MB, y mientras ffmpeg los unía el contador dio
// 11/11 → el pipeline anunció «la descarga ya terminó» y se fue, dejando esa clase sin
// audio y sin transcribir, con el merge escribiendo a 253 MB cada 15 s.
// Es la MISMA trampa que la nota de abajo, en la otra punta: allá un contador quieto se
// leyó como «el descargador murió»; acá uno de más se leyó como «ya terminó».
const bajados = () => cuenta('video', (f) => /\.mp4$/i.test(f) && !esIntermedio(f));
// ⚠️ Los BYTES de video/, intermedios incluidos. Es la única señal honesta de que el
// descargador sigue vivo: contar archivos TERMINADOS no sirve porque una sola clase
// grande puede tardar más que toda la ventana de vigilancia. Pasó con «100M money
// Models»: la clase 34 son 2429 fragmentos, el contador no se movió en 16 rondas y el
// pipeline se cortó solo anunciando «probablemente el descargador murió» — con el
// descargador escribiendo a pleno. Un `.part` que engorda es un proceso sano.
const bytesVideo = () => {
  const d = join(base, 'video');
  if (!existsSync(d)) return 0;
  let t = 0;
  for (const f of readdirSync(d)) { try { t += statSync(join(d, f)).size; } catch { /* se lo llevaron entre el listado y el stat */ } }
  return t;
};
/**
 * ⚠️ SI LA SEÑAL DE VIDA LA PUEDE BORRAR EL QUE LA MIRA, NO ES UNA SEÑAL DE VIDA.
 *
 * `bytesVideo()` mide la carpeta `video/`, que NO crece de forma monótona: la libera
 * `curso-a-drive --liberar` en cuanto Drive confirma. Con eso `bytesVideo() >
 * bytesPrevios` puede dar false mientras el descargador sigue bajando a pleno, porque lo
 * borrado le gana a lo bajado. El pipeline concluye «no hay descarga viva», mide
 * `alcanzable = bajados()` sobre una foto parcial, y PUBLICA con lo que había.
 *
 * ⚠️ CORRECCION DEL 26/08/2026: cuando esto se escribio, esa liberacion NO ocurria —
 * el bucle llamaba a `curso-a-drive` SIN `--liberar`, asi que `video/` solo crecia. O
 * sea que el arreglo era correcto y la causa que se dio, no. Lo que de verdad apagaba
 * la senal era otra cosa (un `.part` que se borra, un merge que falla), y por eso la
 * regla que queda vale igual: **una senal de liveness tiene que ser MONOTONA**, no
 * depender de que nadie reste. Ahora la bandera SI se pasa, asi que la causa descrita
 * arriba pasa a ser real ademas de posible.
 *
 * Pasó el 26/08/2026 con «Seminarios Alejandro Cardona»: el descargador estaba en la
 * clase 11 de 17 y la ficha salió declarando «10 clases, 3 módulos». No falló nada —
 * salió con código 0 y el mensaje «✓ COMPLETO: bajado, transcripto y PUBLICADO».
 *
 * Las dos señales de acá abajo son MONÓTONAS o INSTANTÁNEAS, así que nada las puede
 * deshacer:
 *   · `bajados.txt` lo escribe `curso-bajar.mjs` de a una línea por descarga terminada,
 *     y nunca borra. Si creció, hubo una descarga nueva.
 *   · un `.part` es una descarga EN VUELO ahora mismo. Cubre el hueco de una descarga
 *     larga que todavía no terminó y por eso no escribió su línea.
 */
const lineasBajados = () => {
  try { return readFileSync(join(base, 'bajados.txt'), 'utf8').split('\n').filter((l) => l.trim()).length; }
  catch { return 0; }
};
// Un `.part` prueba que hay una descarga viva SOLO si ademas esta CRECIENDO. Un `.part`
// huerfano —el que deja un yt-dlp que murio— se queda ahi para siempre, y sin esta edad
// maxima el pipeline lo lee como «descargador vivo» y espera eternamente.
//
// No es teorico: el 27/08/2026 tres `.part` de una clase que habia fallado 16 HORAS antes
// tuvieron al pipeline dando 155 rondas en falso durante 5,5 h —«nada nuevo para
// transcribir», una y otra vez— con el curso entero transcripto y sin publicar. Lo unico
// que lo iba a cortar era el tope de 12 h.
//
// La version anterior de este chequeo miraba si `video/` CRECIA, y fallaba al reves (daba
// muerto un descargador vivo). Las dos formas ingenuas fallan, cada una para su lado: la
// senal correcta no es «existe» ni «crecio», es SE TOCO RECIEN.
const PARTE_FRESCA_MIN = 10;
const hayParte = () => {
  const d = join(base, 'video');
  if (!existsSync(d)) return false;
  try {
    const limite = Date.now() - PARTE_FRESCA_MIN * 60_000;
    return readdirSync(d)
      .filter((f) => /\.(part|ytdl)$/i.test(f))
      .some((f) => {
        try { return statSync(join(d, f)).mtimeMs > limite; } catch { return false; }
      });
  } catch { return false; }
};

const audios = () => cuenta('audio', (f) => /\.m4a$/i.test(f));
/**
 * ⚠️ UNA CLASE MUDA CUENTA COMO RESUELTA. `curso-audio.mjs` deja un `.mudo` al lado del
 *    audio cuando el video no tiene pista de sonido —una placa, un separador, una
 *    bienvenida sin voz—. Esas clases no van a tener .md nunca, y sin contarlas el
 *    objetivo es inalcanzable: el curso no dice «completo» jamás, quema el tope de rondas
 *    secas en cada pasada, y figura incompleto para siempre.
 *
 *    «Resuelta» y «transcripta» no son lo mismo, y la diferencia es justo la que hay entre
 *    «falta trabajo» y «no hay nada que hacer».
 */
const textos = () => cuenta('texto', (f) => f.endsWith('.md') && f !== '_indice.md');
const mudos = () => cuenta('audio', (f) => f.endsWith('.mudo'));
const resueltas = () => textos() + mudos();

// `tsx` para los `.ts`: node solo no los sabe correr, y sin el flag el fallo es un
// SyntaxError críptico en vez de «falta el loader».
const correr = (script, args, ts = false) => {
  const argv = ts ? ['--import', 'tsx', join(SCRIPTS, script), ...args] : [join(SCRIPTS, script), ...args];
  const p = spawnSync(process.execPath, argv, { encoding: 'utf8' });
  const out = `${p.stdout ?? ''}${p.stderr ?? ''}`;
  // Solo la última línea útil: el log de una corrida de 12 h tiene que ser legible.
  const resumen = out.split('\n').map((l) => l.trim()).filter((l) => /convertido|transcripta|fallad|✖/.test(l)).slice(-2);

  // ⚠️ UNA ETAPA QUE REVIENTA TIENE QUE GRITAR. El filtro de arriba busca palabras que
  // sólo aparecen cuando el script TERMINA bien; un stack trace no dice «convertido» ni
  // «fallado», así que el resumen salía VACÍO y la ronda se imprimía como si no hubiera
  // habido nada que hacer. El `code` se devolvía y no lo miraba nadie.
  //
  // Costó una noche entera: la transcripción moría con `401 Authentication error` de
  // ScreenApp en las 135 rondas, el log decía `texto 0/453` ronda tras ronda, y eso se
  // lee igual que «todavía no hay audio listo». 452 videos bajados y cero texto.
  //
  // Es la regla de siempre —un aviso que no llega adonde alguien mira no existe— pero en
  // su forma más cara: acá el aviso EXISTÍA, en el stderr del hijo, y el padre lo filtró.
  if (p.status !== 0) {
    const causa = out.split('\n').map((l) => l.trim())
      .filter((l) => /error|Error|✖|401|403|429|ENOENT|no autenticado/i.test(l)).slice(0, 2);
    resumen.push(`✖ ${script} salió con código ${p.status}${p.error ? ` (${p.error.message})` : ''}`);
    for (const c of causa) resumen.push(`   ${c.slice(0, 150)}`);
  }
  return { code: p.status, resumen };
};

const hasta = Date.now() + TOPE_H * 3600000;
let secas = 0, ronda = 0, bytesPrevios = 0, bajadosPrevios = lineasBajados();
// Hora LOCAL, no UTC. Con toISOString() el log marcaba 3 h menos que todo lo demás
// que se mira (procesos, archivos), y un hueco por la máquina dormida se leyó como
// «la descarga se colgó». Ver docs/hallazgos-conocimiento.md.
const hora = () => new Date(Date.now()).toLocaleTimeString('es-AR', { hour12: false });

console.log(`\n  Curso : ${plan.curso}`);
console.log(`  Clases: ${total} · paralelo ${PARALELO} · tope ${TOPE_H} h\n`);

while (Date.now() < hasta) {
  ronda++;
  // ⚠️ LA MISMA MEDIDA QUE `ahora`, o el contador de rondas secas no sube NUNCA.
  //    Con `antes = textos()` y `ahora = resueltas()`, una sola clase muda hace que
  //    `ahora > antes` sea verdadero en TODAS las rondas: el pipeline se lee a si mismo
  //    progresando sin fin y gira hasta el tope de 12 horas. Comparar dos cosas distintas
  //    es peor que no comparar.
  const antes = resueltas();

  const a = correr('curso-audio.mjs', ['--plan', PLAN, '--de', join(base, 'video'), '--a', join(base, 'audio')]);
  // Se anota ANTES de correr: despues de transcribir, audios()>textos() ya no dice si habia trabajo.
  const habiaQueTranscribir = audios() > textos();
  // ScreenApp primero —es gratis y sus `segments[]` dan párrafos de la fuente en vez de
  // una heurística—, y si revienta, el RESPALDO que su propia cabecera nombra.
  //
  // ⚠️ El respaldo se anuncia, no se toma en silencio. Es la regla de «un fallback que no
  // cobra es una degradación silenciosa»: los dos caminos producen un .md que se ve igual,
  // así que si nadie lo dice, el curso queda transcripto por el camino B y el próximo que
  // mire los timestamps no entiende por qué son distintos a los del curso de al lado.
  //
  // Y existía de nombre nomás: al morir ScreenApp con 401, el circuito no probaba el
  // respaldo — hacía 135 rondas anunciando `texto 0/453`.
  let t = habiaQueTranscribir
    ? correr('curso-transcribir-sa.mjs', ['--plan', PLAN, '--paralelo', PARALELO])
    : { code: 0, resumen: ['(nada nuevo para transcribir)'] };
  if (habiaQueTranscribir && t.code !== 0) {
    const b = correr('curso-transcribir.ts', ['--de', join(base, 'audio'), '--a', join(base, 'texto')], true);
    t = { code: b.code, resumen: [...t.resumen, '↳ ScreenApp falló: sigo por el respaldo (cascada barata)', ...b.resumen] };
  }
  // --drive: ir copiando a Drive en cada ronda, sin esperar los ids. Aprovecha que
  // subida y descarga usan capacidades distintas en una conexión asimétrica, así
  // que no se pelean. Los ids se resuelven al final, en una sola pasada.
  // ⚠️ `--liberar` VA SIEMPRE, y es lo que le faltaba a este bucle. Sin el, el pipeline
  //    COPIA a Drive y no borra nada local: un curso grande se baja entero contra el
  //    disco y no lo suelta nunca. El 26/08/2026 eso llevo la maquina a 0 GB libres con
  //    Cardona ocupando 35,5 GB ya subidos y confirmados — 21,8 GB se recuperaron a mano
  //    corriendo este mismo script con la bandera.
  //
  //    Pasarla siempre es seguro porque el que decide NO es esta linea: `curso-a-drive`
  //    solo borra si quedan menos de `--min-libre-gb` (25 por defecto) Y el archivo cumple
  //    las CINCO condiciones —esta en video/, tiene id de Drive, la copia en G: coincide
  //    byte a byte, el propio Drive reporta ese tamano, y YA se le extrajo el audio—.
  //    Con espacio de sobra no toca nada. El guard no se ablanda: se ENCIENDE.
  const g = DRIVE
    ? correr('curso-a-drive.mjs', ['--plan', PLAN, '--solo-copiar', '--liberar'])
    : { code: 0, resumen: [] };

  const ahora = resueltas();
  console.log(`  [${hora()}] ronda ${ronda}: video ${bajados()}/${total} · audio ${audios()} · texto ${ahora}/${total}`);
  for (const l of [...a.resumen, ...t.resumen, ...g.resumen]) if (l) console.log(`             ${l}`);

  // ⚠️ SE TERMINA CUANDO ESTÁ TODO LO QUE SE PUEDE, NO TODO EL PLAN.
  //
  // `ahora >= total` no se cumple nunca si una clase del origen no se puede bajar, y
  // entonces este bucle gira hasta el tope de horas SIN PUBLICAR — con el curso entero
  // bajado y transcripto al lado. Pasó con «NUEVO Organic Ecom 3.0»: la clase 240 apunta
  // a un video de Vimeo que devuelve 500 (tres veces, y su vecino 200), o sea que la
  // plataforma tampoco lo puede servir. 452 de 453, y la condición pedía 453.
  //
  // El alcanzable es lo BAJADO. Y no se declara victoria en silencio sobre el hueco: se
  // nombran las clases que faltan, para que el que lea sepa que el curso sale con 452 y
  // por qué. Un total que se alcanza escondiendo lo que falta es peor que uno que no se
  // alcanza.
  const alcanzable = bajados();
  // Las tres señales en OR, y no en AND: cualquiera que diga «todavía estoy bajando»
  // alcanza para no publicar. Una condición que exige que las tres lo digan es una
  // condición que se apaga con que una se rompa — y la de los bytes ya se rompió.
  const bajadosAhora = lineasBajados();
  const descargaViva = bytesVideo() > bytesPrevios || bajadosAhora > bajadosPrevios || hayParte();
  if (ahora < total && ahora >= alcanzable && !descargaViva && secas >= 2) {
    const sinVideo = plan.clases.filter((c) => !existsSync(join(base, 'video', `${c.archivo}.mp4`)));
    console.log(`\n  ⚠ ${total - alcanzable} clase(s) del plan NO se pudieron bajar del origen:`);
    for (const c of sinVideo.slice(0, 10)) console.log(`      n=${c.n}  ${c.titulo}`);
    console.log(`    Todo lo demás (${ahora}/${alcanzable}) está transcripto: sigo y publico con eso.\n`);
  }

  if (ahora >= total || (ahora >= alcanzable && ahora < total && !descargaViva && secas >= 2)) {
    console.log(`\n  ✓ ${ahora}/${total} clases transcriptas.`);
    // ⚠️ «TRANSCRIPTO» NO ES «PUBLICADO», Y ACÁ SE LLAMABA «COMPLETO». La cadena termina
    // en el portal, no en `texto/`: faltan resolver los ids de Drive y emitir la ficha.
    // Sin esos dos pasos, `public/cono-tx/<videoId>.json` y `curso-<slug>.ts` se quedan
    // con lo de la corrida anterior — y como nada falla, el curso se ve publicado.
    //
    // No es teórico: el arreglo de los 51 audios cortados de «Creator Club» rehizo los
    // .md y el portal siguió sirviendo 49 transcripciones de media clase. Eran ~976.000
    // caracteres que existían en disco y no estaban publicados, y la única razón fue que
    // este script decía COMPLETO y se iba.
    if (!DRIVE) {
      console.log(`\n  ⚠ FALTA PUBLICAR, y no lo puedo hacer desde acá: corriste sin --drive.`);
      console.log(`    Los videos no están en Drive, así que no hay id que resolver. Seguí con:`);
      console.log(`      node scripts/curso-a-drive.mjs  --plan ${PLAN}`);
      console.log(`      node scripts/curso-a-portal.mjs --plan ${PLAN}\n`);
      process.exit(0);
    }
    console.log(`\n  → resolviendo ids de Drive…`);
    const ids = correr('curso-a-drive.mjs', ['--plan', PLAN, '--solo-ids']);
    for (const l of ids.resumen) if (l) console.log(`             ${l}`);
    console.log(`  → publicando la ficha…`);
    const pub = correr('curso-a-portal.mjs', ['--plan', PLAN]);
    for (const l of pub.resumen) if (l) console.log(`             ${l}`);
    if (pub.code !== 0) {
      console.log(`\n  ⚠ La ficha NO se publicó (código ${pub.code}). Lo de arriba dice por qué.`);
      console.log(`    Las clases están bajadas y transcriptas: lo que falta es este último paso.\n`);
      process.exit(pub.code);
    }
    console.log(`\n  ✓ COMPLETO: bajado, transcripto y PUBLICADO.\n`);
    process.exit(0);
  }

  secas = ahora > antes ? 0 : secas + 1;

  // ⚠️ HABÍA TRABAJO Y NO SALIÓ NADA: eso es una etapa rota, no una espera.
  //
  // El guard de abajo exige `bajados() >= total`, así que mientras la descarga sigue —y
  // en un curso de 453 clases eso es toda la noche— NUNCA se dispara. Con la
  // transcripción muerta, el circuito hizo 135 rondas escribiendo `texto 0/453`, que se
  // lee exactamente igual que «todavía no hay audio listo».
  //
  // La distinción que faltaba: `audios() > textos()` dice que HABÍA material esperando.
  // Si con material esperando el contador no se movió en N rondas, el problema no es el
  // ritmo — es que la etapa no funciona, y hay que decirlo aunque la descarga siga.
  if (habiaQueTranscribir && secas === SIN_PROGRESO_MAX) {
    console.log(`\n  ⚠ ${secas} rondas con audio esperando y CERO transcripciones nuevas.`);
    console.log(`    Eso no es lentitud: la etapa de transcripción no está funcionando.`);
    console.log(`    Probala sola para ver el error entero:`);
    console.log(`      node scripts/curso-transcribir-sa.mjs --plan ${PLAN} --paralelo 1\n`);
  }

  if (secas >= SIN_PROGRESO_MAX && bajados() >= total) {
    console.log(`\n  ⚠ Sin progreso ${secas} rondas y la descarga ya terminó (${bajados()}/${total}).`);
    console.log(`    Quedan ${total - ahora} clase(s) sin transcribir. Mirá los errores de arriba.\n`);
    process.exit(3);
  }
  if (secas >= SIN_PROGRESO_MAX * 2) {
    // Antes de declararlo muerto: ¿engordó video/ desde la ronda anterior? Si sí,
    // está bajando una clase larga y hay que esperarla, no cortar.
    const bytesAhora = bytesVideo();
    const bajAhora = lineasBajados();
    if (bytesAhora > bytesPrevios || bajAhora > bajadosPrevios || hayParte()) {
      const porque = bajAhora > bajadosPrevios ? `bajados.txt pasó de ${bajadosPrevios} a ${bajAhora}`
        : hayParte() ? 'hay un .part en vuelo'
          : `video/ creció ${((bytesAhora - bytesPrevios) / 1048576).toFixed(0)} MB`;
      console.log(`             (descargador VIVO: ${porque} — sigo esperando)`);
      bytesPrevios = bytesAhora;
      bajadosPrevios = bajAhora;
      secas = SIN_PROGRESO_MAX; // se le devuelve margen, no se reinicia del todo
    } else {
      console.log(`\n  ⚠ Sin progreso ${secas} rondas, la descarga sigue en ${bajados()}/${total}`);
      console.log(`    y video/ no creció ni un byte. Ahí sí el descargador murió.`);
      console.log(`    Reanudalo con curso-bajar.mjs (el registro es reanudable).\n`);
      process.exit(3);
    }
  }
  bytesPrevios = bytesVideo();
  bajadosPrevios = lineasBajados();

  await new Promise((r) => setTimeout(r, PAUSA_S * 1000));
}

console.log(`\n  ⏱ Tope de ${TOPE_H} h alcanzado. Texto ${textos()}/${total}. Volvé a correr para seguir.\n`);
process.exit(2);
