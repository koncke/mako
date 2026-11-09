// Montaje v2 del reel «mentores high ticket» con la GRAMÁTICA MEDIDA del reel de Josep
// (josep/analisis/ritmo-josep.json y josep/ritmo-habla.json, 9/11/2026):
//  - Mientras habla NO hay música (Josep la apaga del todo, no la baja).
//  - Cada inserto blanco trae un GOLPE de la canción («WE ON GO», BIA) que arranca en el «1» (808 + hats);
//    el corte de imagen cae en el golpe o un cuadro antes; la palabra roja aparece en ese mismo cuadro.
//  - Inserto corto ≈ 0,6 s (1,3 beats); el largo (PISTACHOS → GURÚS) ≈ 1,0 s.
//  - Tramos hablados de ~3 s; la voz vuelve 2-4 cuadros después del inserto y se apaga ~0,25 s antes del siguiente.
//  - Cierre mudo: la canción desde su 0:00, continua; los cortes siguen la acción.
//  - Martín (9/11): sin silencios muertos; las animaciones se cortan o se aceleran; la voz se acelera SIN ardilla
//    (atempo conserva el tono: medido 130,6 → 130,6 Hz; con asetrate sube 9,7 %).
//   node montar-v2.mjs [nombre]   → REEL-<nombre>.mp4 y REEL-<nombre>-SIN-MUSICA.mp4
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const R = 'C:/dev/reel-mentores';
const M = `${R}/montaje`, C = `${R}/clips-espanol`, B = `${R}/blancas`;
const NOMBRE = process.argv[2] || 'v2';

const VEL = 1.10;        // habla: Josep 3,54 pal/s, Martín 3,25 → +9 %
const VEL_ANIM = 2.0;    // transformación y humo: sólo imagen, sin voz
const PRE = 0.10, POST = 0.25;
const VOZ_DB = -3;       // Josep: la música suena ~4,5 LU por encima de la voz
const JOSEP = `${R}/josep/josep-audio.wav`;
// El «1» de frase que Josep pega en cada inserto (ataque en 28,0023). Desde 27,985 + fundido de 3 ms: arrancar 30 ms
// antes metía la cola del compás anterior y un «tic» (verificación de audio del v2). El golpe cae ~17 ms después del corte.
const GOLPE = 27.985;
const CIERRE = 20.633;         // donde arranca su cierre mudo (la canción en 0:00 a los 20,65)
const CIERRE_DB = -1;          // el cierre sonaba 1 LU más fuerte que en Josep respecto de la voz
const CORTO = 0.625;           // inserto corto: 15 cuadros; con 14 el golpe salía 1,22 beats después del ataque (Josep 1,32)

// Las tres de la noche, cada una con su curva, para que el sujeto quede como el abanico nuevo y como Josep
// (medido por la verificación de imagen del v2: con una curva para las tres, BRAZOS y DEDO quedaban ~6 de luma más oscuros).
const LUZ_BD = "curves=all='0/0.035 0.15/0.28 0.5/0.66 1/1',eq=saturation=1.08";
const LUZ_PERFIL = "curves=all='0/0.015 0.2/0.26 0.5/0.58 1/1',eq=saturation=1.08";
const blanca = (video, imagen, luz) => (existsSync(`${B}/${video}`) ? { src: `${B}/${video}`, luz } : { img: `${B}/${imagen}`, luz });
const ABANICO = blanca('VIDEO-abanico.mp4', 'abanico-5-contraluz.jpg');
const CELULAR = blanca('VIDEO-celular.mp4', 'celular-contraluz.jpg');
const BRAZOS = { src: `${B}/CLIP-brazos-cruzados-v2.mp4`, luz: LUZ_BD };
const DEDO = { src: `${B}/CLIP-dedo-arriba.mp4`, luz: LUZ_BD };
// El perfil se rehízo el 9/11 desde SU personaje (la de la noche no se le parecía), de tres cuartos y con la luz del
// abanico: ya trae la luz buena, sin curva. El viejo quedó como CLIP-perfil-manos-NOCHE-viejo.mp4. Dura 4 s.
const PERFIL = { src: `${B}/CLIP-perfil-manos.mp4` };

const CLIP = { 1: `${C}/CLIP1-ESPANOL-CON-TU-VOZ.mp4`, 2: `${C}/CLIP2-VARIACION-V2-CON-TU-VOZ.mp4`, 3: `${C}/CLIP3-CRM-CON-TU-VOZ.mp4`, 4: `${C}/CLIP4-CON-TU-VOZ.mp4`, 5: `${C}/CLIP5-CON-TU-VOZ.mp4` };
const PAL = {}; for (const n of [1, 2, 3, 4, 5]) PAL[n] = JSON.parse(readFileSync(`${M}/palabras-${n}.json`, 'utf8')).palabras;

// voz(n, primera, última, carteles, {a, b}): recorta a PRE antes de la primera palabra y POST después de la última
const voz = (n, i, u, subs, o = {}) => ({ tipo: 'voz', n, a: o.a ?? +(PAL[n][i].a - PRE).toFixed(3), b: o.b ?? +(PAL[n][u].b + POST).toFixed(3), subs, zoom: o.zoom, id: o.id, subY: o.subY ?? SUB_Y[n] });
// Altura de los subtítulos, JUSTO DEBAJO DEL MENTÓN de cada clip (Martín, 9/11: «que no me tapen justo la cara… un poco más
// abajo en el mentón o un poquito más abajo»). Medido sobre 1280: el mentón está en ~615-630 en los clips 1-3, ~645 en el 5
// antes del humo y ~765 en el 4 y en el 5 después del humo (más lejos de cámara; la barba de Hormozi llega a ~795).
// En 610, la altura de Josep, le tapaban la boca y el mentón.
const SUB_Y = { 1: 685, 2: 700, 3: 685, 4: 850, 5: 715 };
// Zoom «punch-in» (Martín, 9/11: «cuando me esté transformando en Hormozi, con un zoom»): z en función del tiempo t del
// corte, con una curva suave (smoothstep) entre t0 y t1. Se centra un poco arriba, donde está la cara.
const suave = (t0, t1) => `if(lt(t,${t0}),0,if(gt(t,${t1}),1,((t-${t0})/${t1 - t0})*((t-${t0})/${t1 - t0})*(3-2*((t-${t0})/${t1 - t0}))))`;
const ZOOM = 0.2;
// anim(n, a, b, vel, golpe): sólo imagen, sin voz. Con `golpe` (un nombre de grupo) lleva debajo la canción desde el
// «1», continua a lo largo de las piezas del mismo grupo: así el humo funciona como un inserto (verificación v2: 2,1 s
// de silencio digital ahí, cuando Josep nunca deja más de 0,52 s sin voz ni música).
const anim = (n, a, b, vel = VEL_ANIM, golpe = null, soplido = null) => ({ tipo: 'anim', n, a, b, vel, golpe, soplido });
// `bajar`: corre la toma Δ px hacia abajo (se pierde el pie del cuadro) y rellena arriba con su mismo blanco, para que
// el cartel rojo quede LIBRE por encima de la cabeza o del celular, como los carteles de cierre de Josep. Con la máscara,
// la cabeza tapaba «GRATIS» y el celular «"APP"». Achicar la toma en vez de correrla dejaba costuras duras a los costados
// (el brazo cortado contra el relleno): se corre, sin escalar.
const bajar = (px, color) => ({ px, color });
const ins = (fuente, desde, dur, rojo, o = {}) => ({ tipo: 'ins', fuente, desde, dur, rojo, bajar: o.bajar });
const cierre = (fuente, desde, dur, rojo, parpadeo, o = {}) => ({ tipo: 'cierre', fuente, desde, dur, rojo, parpadeo, bajar: o.bajar });

const T = [
  voz(1, 0, 9, [['Este es', 0], ['un mensaje', 2], ['para todos', 4], ['los mentores', 6], ['high ticket', 8]]),
  ins(PERFIL, 1.0, CORTO, 'HIGH\\NTICKET', { bajar: bajar(160, '0xFEFFFE') }),
  voz(2, 0, 2, [['Me llamo Martín,', 0]]),
  ins(BRAZOS, 2.0, CORTO, 'MARTÍN'),
  voz(2, 3, 14, [['tengo 25 años', 3], ['y me estudié', 6], ['a todos', 9], ['los gurús', 11], ['que conocés', 13]]),
  ins(ABANICO, 0.9, 1.0, 'GURÚS', { bajar: bajar(90, '0xFFFFFE') }),
  // Martín (9/11, sobre el v3): «pusiste demasiadas partes de música… fíjate de replicar» los momentos de Josep.
  // Josep pone 5 golpes en lo hablado, uno al CERRAR cada bloque del guion (disparo, nombre, credencial, producto,
  // beneficio) y ninguno adentro de un bloque ni en el remate. Acá igual: el bloque del producto (clip 3) y el del
  // beneficio (clip 4) van enteros, y el humo del remate va sin golpe.
  voz(3, 0, 15, [['Por eso creé', 0], ['una app', 3], ['para que no', 5], ['tengas que', 8], ['gastarte miles', 10], ['de dólares', 12], ['en vendehumos', 14]]),
  ins(CELULAR, 0.0, CORTO),
  // clip 4: la transformación de ida pasa bajo «y editar videos» (1,67–2,83 de fuente), a 1,10 con voz. Después de 2,62
  // es Hormozi quieto hasta que vuelve a hablar: pasa a 5× (0,4 s), sin inserto en el medio.
  // Sin zoom ni efecto en la transformación: Martín (9/11) probó el zoom «punch-in» con whoosh y no le gustó
  // («no seas exagerado con los efectos»). La opción `zoom` de voz/anim queda por si otra edición la pide.
  voz(4, 0, 6, [['Vas a poder', 0], ['crear y editar', 3], ['videos', 6]], { b: 2.62 }),
  anim(4, 2.62, 4.58, 5.0),
  // b 6,30: desde 6,33 la fuente trae un sollozo a -8 dBFS que sólo dejaba afuera el redondeo de cuadros
  voz(4, 7, 14, [['como el que', 7], ['estás viendo', 10], ['en este momento', 12]], { a: 4.58, b: 6.30 }),
  ins(DEDO, 1.0, CORTO),
  // clip 5: el humo SIN golpe (Josep no pone música en el remate) y con un soplido suave para que no quede mudo.
  // 6,30 → 7,15: a 6,30 el humo ya se asentó. Rampas de 1,5× en las puntas: pasar de 1,10 a 4× en un cuadro daba un tirón.
  voz(5, 0, 11, [['Dejá de', 0], ['comentarle a', 2], ['los vendehumos', 4], ['que solo', 6], ['te dan', 8], ['un PDF', 10]], { b: 4.05 }),
  // el sonido del humo son dos efectos (SFX, abajo): «se va» y «vuelve»
  Object.assign(anim(5, 4.05, 4.45, 1.5), { id: 'humo-se-va' }),
  anim(5, 4.45, 6.30, 4.0),
  Object.assign(anim(5, 7.15, 8.70, 4.0), { id: 'humo-vuelve' }),
  anim(5, 8.70, 9.06, 1.5),
  voz(5, 12, 21, [['Mejor comentá', 12], ['"APP"', 14], ['y te regalo', 15], ['1 semana', 18], ['de prueba', 20]], { a: 9.06, subY: 835 }),
  // ── Cierre mudo: la canción desde el 0:00
  cierre(BRAZOS, 3.0, 3.1),
  cierre(CELULAR, 0.6, 1.5, 'COMENTÁ\\N"APP"', true, { bajar: bajar(240, '0xFDFBF6') }),
  cierre(DEDO, 3.0, 1.4, '1 SEMANA\\NGRATIS', false, { bajar: bajar(170, '0xFBFEFB') }),
  cierre(ABANICO, 1.0, 2.4),
  cierre(PERFIL, 2.2, 1.6),
];

function tamRojo(texto) {
  const py = spawnSync('python', ['-I', '-c', `from PIL import ImageFont\nimport sys\nf=ImageFont.truetype('C:/Windows/Fonts/timesbd.ttf',100)\nprint(max(f.getlength(l) for l in sys.argv[1:]))`, ...texto.split('\\N')], { encoding: 'utf8' });
  return Math.round(Math.min(175, (0.84 * 720 * 100) / parseFloat(py.stdout)));
}
// ASS va en centésimas: se redondea SIEMPRE hacia abajo. Redondeando al más cercano, 2,708 → 2,71 dejaba el
// subtítulo un cuadro de más sobre el inserto y la palabra roja entraba un cuadro tarde (medido cuadro a cuadro).
const ts = (s) => { const c = Math.floor(s * 100 + 1e-6); const h = Math.floor(c / 360000), m = Math.floor((c % 360000) / 6000), x = ((c % 6000) / 100).toFixed(2).padStart(5, '0'); return `${h}:${String(m).padStart(2, '0')}:${x}`; };

// ── Línea de tiempo (en cuadros enteros de 24 fps)
let t = 0, tCierre = null, offCierre = 0;
const ev = [], evRojo = [];
const offGolpe = {};
for (const s of T) {
  const crudo = s.tipo === 'voz' ? (s.b - s.a) / VEL : s.tipo === 'anim' ? (s.b - s.a) / s.vel : s.dur;
  s.nf = Math.round(crudo * 24); s.d = s.nf / 24; s.t0 = t;
  if (s.tipo === 'cierre') { if (tCierre == null) tCierre = t; s.off = offCierre; offCierre += s.d; }
  if (s.golpe) { s.goff = offGolpe[s.golpe] ?? 0; offGolpe[s.golpe] = s.goff + s.d; }
  if (s.tipo === 'voz') {
    const p = PAL[s.n];
    s.subs.forEach(([txt, i], k) => {
      const prox = s.subs[k + 1];
      let u = prox ? prox[1] - 1 : i;
      if (!prox) while (u + 1 < p.length && p[u + 1].a < s.b) u++;
      const ini = Math.max(0, (p[i].a - s.a) / VEL);
      const sig = prox ? (p[prox[1]].a - s.a) / VEL : null;
      let fin = Math.min(sig ?? s.d, (p[u].b - s.a) / VEL + 0.3, s.d);
      fin = Math.max(fin, ini + 0.25);
      ev.push(`Dialogue: 0,${ts(t + ini)},${ts(t + Math.min(fin, s.d))},Sub,,0,0,0,,{\\an5\\pos(360,${s.subY})}${txt}`);
    });
  }
  if (s.rojo) {
    // 130: a 70 quedaba en la franja que tapa la interfaz de Reels y más arriba que en Josep
    const tag = `{\\an8\\pos(360,130)\\fs${tamRojo(s.rojo)}}${s.rojo}`;
    if (s.parpadeo) {
      // como «tachocream.com»: 2 cuadros sí / 2 no durante ~0,93 s, después fijo
      const fr = 1 / 24; let k = 0;
      for (; k * 4 * fr < 0.93; k++) evRojo.push(`Dialogue: 1,${ts(t + k * 4 * fr)},${ts(t + k * 4 * fr + 2 * fr)},Rojo,,0,0,0,,${tag}`);
      evRojo.push(`Dialogue: 1,${ts(t + k * 4 * fr)},${ts(t + s.d)},Rojo,,0,0,0,,${tag}`);
    } else evRojo.push(`Dialogue: 1,${ts(t)},${ts(t + s.d)},Rojo,,0,0,0,,${tag}`);
  }
  t += s.d;
}
const TOTAL = t;

// Las palabras rojas van en su propio .ass: se componen sólo donde el fondo es blanco, así el sujeto queda DELANTE
// del texto, como en Josep (su cabeza tapa la «S» de JOSEP). Pintadas encima, «GURÚS» y «GRATIS» caían sobre el pelo.
const cabecera = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI,70,&H00FFFFFF,&H00FFFFFF,&H50000000,&H70000000,-1,0,0,0,100,100,0,0,1,2.2,3,5,40,40,0,1
Style: Rojo,Times New Roman,140,&H001B14E1,&H001B14E1,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,20,20,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;
writeFileSync(`${M}/rojo-${NOMBRE}.ass`, cabecera + evRojo.join('\n') + '\n');

writeFileSync(`${M}/subs-${NOMBRE}.ass`, `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Segoe UI,70,&H00FFFFFF,&H00FFFFFF,&H50000000,&H70000000,-1,0,0,0,100,100,0,0,1,2.2,3,5,40,40,0,1
Style: Rojo,Times New Roman,140,&H001B14E1,&H001B14E1,&H00000000,&H00000000,-1,0,0,0,100,100,0,0,1,0,0,8,20,20,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${ev.join('\n')}
`);

// ── ffmpeg: por corte, una imagen [v], una voz [a] y una música [m]
const args = ['-v', 'error', '-y'];
const fc = [];
let nIn = 0;
const entrada = (...a) => { args.push(...a); return nIn++; };
const silencio = (d) => `aevalsrc=0:s=48000:c=stereo:d=${d.toFixed(4)}`;
T.forEach((s, i) => {
  const dd = s.d.toFixed(4);
  if (s.tipo === 'voz' || s.tipo === 'anim') {
    const k = entrada('-i', CLIP[s.n]);
    const vel = s.tipo === 'voz' ? VEL : s.vel;
    const zoom = s.zoom ? `,scale=w='trunc(720*(${s.zoom})/2)*2':h='trunc(1280*(${s.zoom})/2)*2':eval=frame,crop=720:1280:(iw-720)/2:(ih-1280)*0.4` : '';
    fc.push(`[${k}:v]trim=${s.a}:${s.b},setpts=(PTS-STARTPTS)/${vel},fps=24,scale=720:1280${zoom},setsar=1,format=yuv420p,trim=end_frame=${s.nf}[v${i}]`);
    // fundido de salida de 30 ms: sin él, el ruido de fondo se cortaba en seco contra el silencio de una animación
    if (s.tipo === 'voz') fc.push(`[${k}:a]atrim=${s.a}:${s.b},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,atempo=${VEL},volume=${VOZ_DB}dB,afade=t=in:d=0.01,apad,atrim=0:${dd},afade=t=out:st=${(s.d - 0.03).toFixed(4)}:d=0.03[a${i}]`);
    else if (s.soplido) {
      // un soplido de ruido rosa filtrado, continuo a lo largo del grupo: no es música, y el voice-to-voice volvía el
      // soplido propio del clip un zumbido con tono (sonaba a risa)
      const grupo = T.filter((x) => x.soplido === s.soplido);
      const ini = s === grupo[0] ? ',afade=t=in:d=0.2' : '';
      const fin = s === grupo.at(-1) ? `,afade=t=out:st=${Math.max(0, s.d - 0.25).toFixed(4)}:d=0.25` : '';
      fc.push(`anoisesrc=d=${dd}:c=pink:a=0.5:r=48000,highpass=f=250,lowpass=f=2500,volume=-14dB${ini}${fin},aformat=channel_layouts=stereo[a${i}]`);
    } else fc.push(`${silencio(s.d)}[a${i}]`);
    if (s.golpe) {
      // el golpe sigue continuo a lo largo del grupo (el humo): primera pieza con su ataque, última cortada en seco
      const grupo = T.filter((x) => x.golpe === s.golpe);
      const ini = s === grupo[0] ? ',afade=t=in:d=0.003' : '';
      const fin = s === grupo.at(-1) ? `,afade=t=out:st=${(s.d - 0.008).toFixed(4)}:d=0.008` : '';
      const kj = entrada('-i', JOSEP);
      const desde = GOLPE + s.goff;
      fc.push(`[${kj}:a]atrim=${desde.toFixed(4)}:${(desde + s.d).toFixed(4)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo${ini},apad,atrim=0:${dd}${fin}[m${i}]`);
    } else fc.push(`${silencio(s.d)}[m${i}]`);
  } else {
    const f = s.fuente;
    const baja = s.bajar ? `,crop=720:${1280 - s.bajar.px}:0:0,pad=720:1280:0:${s.bajar.px}:color=${s.bajar.color},setsar=1` : '';
    if (f.src) { const k = entrada('-i', f.src); fc.push(`[${k}:v]trim=${s.desde}:${s.desde + s.d + 0.1},setpts=PTS-STARTPTS,fps=24,scale=720:1280,setsar=1${f.luz ? ',' + f.luz : ''}${baja},format=yuv420p,trim=end_frame=${s.nf}[v${i}]`); }
    else { const k = entrada('-loop', '1', '-framerate', '24', '-t', String(s.d + 0.1), '-i', f.img); fc.push(`[${k}:v]scale=1440:2580,zoompan=z='1+0.04*on/${s.nf}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=720x1280:fps=24,setsar=1${baja},format=yuv420p,trim=end_frame=${s.nf}[v${i}]`); }
    fc.push(`${silencio(s.d)}[a${i}]`);
    const desdeMus = s.tipo === 'ins' ? GOLPE : CIERRE + s.off;
    const kj = entrada('-i', JOSEP);
    const corte = s.tipo === 'ins' ? `,afade=t=in:d=0.003,apad,atrim=0:${dd},afade=t=out:st=${(s.d - 0.008).toFixed(4)}:d=0.008` : `,volume=${CIERRE_DB}dB,apad,atrim=0:${dd}`;
    fc.push(`[${kj}:a]atrim=${desdeMus.toFixed(4)}:${(desdeMus + s.d).toFixed(4)},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo${corte}[m${i}]`);
  }
});
fc.push(`${T.map((_, i) => `[v${i}][a${i}][m${i}]`).join('')}concat=n=${T.length}:v=1:a=2[vc][voz][mus]`);
// Rojo detrás del sujeto: la máscara es «donde el cuadro es blanco» (luma > 200), suavizada 1 px
const esc = (p) => p.replace(':', '\\:');
fc.push(`[vc]split=3[base][paraRojo][paraMascara]`);
fc.push(`[paraRojo]ass='${esc(M)}/rojo-${NOMBRE}.ass',format=gbrp[conRojo]`);
fc.push(`[paraMascara]format=gray,lut=y='if(gt(val,200),255,0)',gblur=sigma=1,format=gbrp[mascara]`);
fc.push(`[base]format=gbrp[baseRGB]`);
fc.push(`[baseRGB][conRojo][mascara]maskedmerge,format=yuv420p[conRojoDetras]`);
fc.push(`[conRojoDetras]ass='${esc(M)}/subs-${NOMBRE}.ass'[v]`);
// Josep termina con la canción cortada a nivel pleno: sin el fundido de 1,2 s del v2
fc.push(`[mus]afade=t=out:st=${(TOTAL - 0.05).toFixed(3)}:d=0.05[musf]`);
// ── Efectos de sonido (ElevenLabs Sound Effects, `sfx/`): van con la voz, así quedan también en la versión SIN música.
// Niveles medidos: la voz queda en ~-17 LUFS; un efecto debajo de una frase va ~-24, uno en un hueco, ~-19.
const R_SFX = `${R}/sfx`;
const enCorte = (id, dt) => { const s = T.find((x) => x.id === id); return s.t0 + dt; };
// Martín (9/11): «No seas exagerado con los efectos de sonido… el de humo sí me gusta, el del inicio, pero listo».
// UNO solo: el humo cuando se va. Sin el de la vuelta, ni el de la transformación.
const SFX = [
  { f: 'humo-se-va-2.mp3', t: enCorte('humo-se-va', -0.08), db: -8 },
];
const etiquetas = SFX.map((x, k) => {
  const kk = entrada('-i', `${R_SFX}/${x.f}`);
  const ms = Math.round(x.t * 1000);
  fc.push(`[${kk}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${x.db}dB,adelay=${ms}|${ms},apad,atrim=0:${TOTAL.toFixed(4)}[sfx${k}]`);
  return `[sfx${k}]`;
});
fc.push(`[voz]${etiquetas.join('')}amix=inputs=${SFX.length + 1}:normalize=0:duration=first[vozsfx]`);
fc.push(`[vozsfx]asplit=2[voz1][voz2]`);
fc.push(`[voz1][musf]amix=inputs=2:normalize=0:duration=first[mix]`);
const CRUDO = `${M}/crudo-${NOMBRE}.mkv`;
args.push('-filter_complex', fc.join(';'), '-map', '[v]', '-map', '[mix]', '-map', '[voz2]', '-c:v', 'libx264', '-crf', '16', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-c:a', 'pcm_s24le', CRUDO);
console.log(`montando ${T.length} cortes · ${TOTAL.toFixed(2)} s · cierre desde ${tCierre.toFixed(2)} s`);
for (const s of T) console.log(`  ${s.t0.toFixed(2).padStart(6)} → ${(s.t0 + s.d).toFixed(2).padStart(6)}  ${s.tipo.padEnd(6)} ${s.tipo === 'voz' || s.tipo === 'anim' ? `clip ${s.n} [${s.a}–${s.b}]` : ''}${s.rojo ? ' «' + s.rojo.replace('\\N', ' ') + '»' : ''}`);
const r = spawnSync('ffmpeg', args, { encoding: 'utf8', maxBuffer: 1e8 });
if (r.status) { console.log(r.stderr.slice(-3000)); process.exit(1); }

function normalizar(mapa, salida) {
  const m = spawnSync('ffmpeg', ['-hide_banner', '-i', CRUDO, '-map', mapa, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const j = JSON.parse(m.stderr.match(/{[^{}]*}/g).at(-1));
  const af = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true`;
  const o = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', CRUDO, '-map', '0:v', '-map', mapa, '-c:v', 'copy', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', salida], { encoding: 'utf8' });
  if (o.status) { console.log(o.stderr.slice(-2000)); process.exit(1); }
  console.log('listo', salida.split('/').pop(), '· medido antes', j.input_i, 'LUFS');
}
normalizar('0:a:0', `${M}/REEL-${NOMBRE}.mp4`);
normalizar('0:a:1', `${M}/REEL-${NOMBRE}-SIN-MUSICA.mp4`);
