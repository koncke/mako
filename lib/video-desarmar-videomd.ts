// =============================================================================
// El paquete VIDEO.md de un video desarmado (ticket 97; PURO; 14/11/2026)
// =============================================================================
// VIDEO.md es un formato ABIERTO para describir cómo está hecho un video (https://videomd.github.io/videomd, especificación v1,
// CC BY 4.0; lo escribe también rea-video, Apache-2.0). Se guarda así, y no sólo en nuestro JSON, para que el desarme se pueda
// llevar a otra herramienta (o a otro modelo) sin pasar por MaKo.
//
// Lo que pide la especificación (sección 2), y cómo se cumple:
//   · `VIDEO.md` (la ficha): front matter con `videomd: 1`, `name` (minúsculas, dígitos y guiones, sin guiones dobles ni en los
//     bordes, 1–64), `description` (1–1024), `source` (con `duration` y `url` o `file`), `shots` (= las líneas de la línea de
//     tiempo) y `lang`; después el veredicto y un bloque `videomd-map` con CADA archivo de `video/` (`ruta | tokens | de qué es`).
//   · `video/timeline.md`: un bloque `videomd-timeline`, una línea por plano: `#NN inicio-fin | clave valor | …`. Una clave con
//     `~` es inferida (`made~`, con su probabilidad). Un valor no puede llevar `|`.
//   · `video/shots/NN.md`: uno por plano, con `part: shot`, `shot`, `time: [inicio, fin]` (igual a la línea de tiempo, ±0,06 s) y
//     `tokens`; `inferred: {made, p, decided_by: model}` con el método de la taxonomía.
//   · Opcionales: `video/content.md` (estructura y lo que se dice), `video/look.md` (textos y subtítulos), `video/sound.md`,
//     `video/remake.md` (cómo replicarlo) y `video/transcript.vtt`.
// `tokens` es el tamaño aproximado del CUERPO (sin el front matter): caracteres ASCII / 4 + los demás × 0,75, el estimador de la
// propia especificación. El validador oficial es `videomd check <carpeta>` (pip install videomd).
// =============================================================================

import { mezclaDeOrigen, ritmoDe, seDiceEn, type DesarmeGuardado, type OrigenPlano } from './video-desarmar';

/** Los métodos de la taxonomía de VIDEO.md (taxonomy.html) para cada origen. */
const METODO: Record<OrigenPlano, string> = { grabado: 'live_action', ia: 'ai_video', codigo: 'code_render' };

/** El estimador de tokens de la especificación: ASCII / 4 + lo demás × 0,75. */
export function tokensDe(cuerpo: string): number {
  let ascii = 0;
  let otros = 0;
  for (const c of cuerpo) {
    if (c.charCodeAt(0) < 128) ascii += 1;
    else otros += 1;
  }
  return Math.max(1, Math.ceil(ascii / 4 + otros * 0.75));
}

/** Un `name` válido: minúsculas, dígitos y guiones, sin dobles ni en los bordes, 1–64. */
export function nombreVideoMd(x: string): string {
  const s = x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/g, '');
  return s || 'video';
}

/** Un valor de la línea de tiempo: sin `|` ni saltos de renglón (la gramática los prohíbe). */
const valor = (x: string, max = 160) => x.replace(/[|\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
/** Un escalar de YAML entre comillas dobles. */
const yaml = (x: string) => JSON.stringify(x);
const seg = (n: number) => n.toFixed(1);
const dos = (n: number) => String(n).padStart(2, '0');
/** Segundos → `HH:MM:SS.mmm` de WebVTT. */
function vtt(s: number): string {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const ss = Math.floor((ms % 60_000) / 1000);
  return `${dos(h)}:${dos(m)}:${dos(ss)}.${String(ms % 1000).padStart(3, '0')}`;
}

/** Un archivo de `video/`: su front matter (con `tokens` del cuerpo) y el cuerpo. */
function parte(campos: Array<[string, string]>, cuerpo: string): string {
  return ['---', 'videomd: 1', ...campos.map(([k, v]) => `${k}: ${v}`), `tokens: ${tokensDe(cuerpo)}`, '---', cuerpo.trimEnd(), ''].join('\n');
}

/**
 * El paquete entero, ruta → contenido. `VIDEO.md` lleva el mapa con todos los demás; la línea de tiempo y los planos dicen los
 * MISMOS tiempos (los del desarme, que ya vienen pegados de 0 al final).
 */
export function paqueteVideoMd(g: DesarmeGuardado): Record<string, string> {
  const { desarme: d, fuente: f, miro } = g;
  const r = ritmoDe(d);
  const archivos: Record<string, string> = {};
  const acerca: Record<string, string> = {};

  // La línea de tiempo: una línea por plano.
  const lineas = d.planos.map((p) => {
    const textos = d.textos.filter((t) => t.desde < p.hasta && t.hasta > p.desde).map((t) => `«${t.texto}»`).join(' ');
    const partes = [
      `#${dos(p.n)} ${seg(p.desde)}-${seg(p.hasta)}`,
      p.bloque ? `story ${valor(p.bloque, 60)}` : '',
      p.seVe ? `seen ${valor(p.seVe)}` : '',
      p.camara || p.zoom !== 'ninguno' ? `camera ${valor([p.encuadre, p.camara, p.zoom !== 'ninguno' ? `zoom ${p.zoom}` : ''].filter(Boolean).join(', '), 80)}` : '',
      p.transicion ? `transition ${valor(p.transicion, 40)}` : '',
      textos ? `overlay ${valor(textos)}` : '',
      `made~ ${METODO[p.origen]} ${Math.round(p.seguridad * 100)}%`,
      p.paraReplicar ? `remake ${valor(p.paraReplicar)}` : '',
    ].filter(Boolean);
    return partes.join(' | ');
  });
  const cuerpoLinea = ['```videomd-timeline', ...lineas, '```', ''].join('\n');
  archivos['video/timeline.md'] = parte([['part', 'timeline'], ['shots', String(d.planos.length)]], cuerpoLinea);
  acerca['video/timeline.md'] = 'Línea de tiempo: una línea por plano';

  // Un archivo por plano.
  for (const p of d.planos) {
    const dice = seDiceEn(p, d.frases);
    const textos = d.textos.filter((t) => t.desde < p.hasta && t.hasta > p.desde);
    const cuerpo = [
      `# Plano ${p.n}`,
      p.seVe ? `Se ve: ${p.seVe}` : '',
      p.encuadre || p.camara ? `Cámara: ${[p.encuadre, p.camara, p.zoom !== 'ninguno' ? `zoom ${p.zoom}` : ''].filter(Boolean).join(', ')}` : '',
      p.broll ? 'Es B-roll.' : '',
      p.transicion ? `Entra con: ${p.transicion}` : '',
      dice ? `Se dice: «${dice}»` : '',
      ...textos.map((t) => `Texto en pantalla (${seg(t.desde)}–${seg(t.hasta)} s, ${t.posicion}): «${t.texto}»`),
      `Inferido: ${METODO[p.origen]}, ${Math.round(p.seguridad * 100)} %${p.porQueOrigen ? ` (${p.porQueOrigen})` : ''}.`,
      p.paraReplicar ? `Para replicarlo: ${p.paraReplicar}` : '',
    ].filter(Boolean).join('\n\n');
    const campos: Array<[string, string]> = [
      ['part', 'shot'],
      ['shot', String(p.n)],
      ['time', `[${seg(p.desde)}, ${seg(p.hasta)}]`],
      ...(textos.length ? [['overlays', '[styled_text]'] as [string, string]] : []),
      ['inferred', `{made: ${METODO[p.origen]}, p: ${p.seguridad.toFixed(2)}, decided_by: model, real_material: ${p.origen === 'grabado'}}`],
      ...(p.seguridad < 0.6 ? [['flags', '[uncertain]'] as [string, string]] : []),
    ];
    const ruta = `video/shots/${dos(p.n)}.md`;
    archivos[ruta] = parte(campos, cuerpo);
  }

  // Lo que se cuenta y lo que se dice.
  const contenido = [
    '# Contenido',
    d.resumen,
    `## Gancho (0–${seg(d.gancho.hastaS)} s)`,
    [d.gancho.texto ? `«${d.gancho.texto}»` : '', d.gancho.tipo, d.gancho.porQueFunciona].filter(Boolean).join(' — '),
    '## Estructura',
    ...d.estructura.map((b) => `- ${b.nombre} (${seg(b.desde)}–${seg(b.hasta)} s): ${b.que}`),
    ...(d.llamadaALaAccion ? ['## Llamado a la acción', `«${d.llamadaALaAccion.texto}» (desde ${seg(d.llamadaALaAccion.desde)} s)`] : []),
    '## Lo que se dice',
    ...(d.frases.length ? d.frases.map((x) => `- ${seg(x.desde)}–${seg(x.hasta)} s: ${x.texto}`) : ['(No se dice nada: sólo imagen y música.)']),
  ].join('\n\n');
  archivos['video/content.md'] = parte([['part', 'content']], contenido);
  acerca['video/content.md'] = 'Gancho, estructura y lo que se dice';

  const s = d.subtitulos;
  const look = [
    '# Cómo se ve',
    '## Subtítulos',
    s.hay
      ? [s.descripcion, `${s.palabrasPorVez} palabra(s) a la vez, ${s.mayusculas ? 'en mayúsculas' : 'en minúsculas'}, letra ${s.letra}${s.gruesa ? ' gruesa' : ''}${s.color ? ` ${s.color}` : ''}, fondo ${s.fondo}${s.colorFondo ? ` ${s.colorFondo}` : ''}, ${s.posicion}.`, s.resaltado !== 'ninguno' ? `Resaltado: ${s.resaltado}${s.colorResaltado ? ` en ${s.colorResaltado}` : ''}${s.resaltado === 'palabra-clave' ? `, al ${s.tamanoClave} %` : ''}.` : '', s.animacion ? `Animación: ${s.animacion}.` : ''].filter(Boolean).join(' ')
      : 'Sin subtítulos.',
    '## Textos en pantalla',
    ...(d.textos.length
      ? d.textos.map((t) => `- ${seg(t.desde)}–${seg(t.hasta)} s, ${t.posicion}, ${t.tamano}, letra ${t.letra}${t.mayusculas ? ' en mayúsculas' : ''}${t.color ? ` ${t.color}` : ''}${t.fondo !== 'ninguno' ? `, ${t.fondo}${t.colorFondo ? ` ${t.colorFondo}` : ''}` : ''}: «${t.texto}»`)
      : ['(Ninguno.)']),
  ].join('\n\n');
  archivos['video/look.md'] = parte([['part', 'look']], look);
  acerca['video/look.md'] = 'Subtítulos y textos en pantalla';

  const sonido = [
    '# Sonido',
    d.musica.hay ? `Música: ${d.musica.volumen}. ${d.musica.descripcion}` : 'Sin música.',
    ...(d.musica.efectos.length ? [`Efectos: ${d.musica.efectos.join(', ')}.`] : []),
    `Ritmo: ${r.planos} planos, ${r.cortesPorMinuto} cortes por minuto, plano medio de ${r.planoMedioS} s, el más corto de ${r.masCortoS} s.${d.ritmo.pausasRecortadas ? ' Las pausas de la voz están recortadas.' : ''} ${d.ritmo.descripcion}`.trim(),
  ].join('\n\n');
  archivos['video/sound.md'] = parte([['part', 'sound']], sonido);
  acerca['video/sound.md'] = 'Música, efectos y ritmo de cortes';

  const lista = (xs: readonly string[]) => xs.map((x) => `- ${x}`).join('\n');
  const remake = [
    '# Cómo replicarlo',
    '## La edición',
    lista(d.edicion) || '(Sin pasos.)',
    ...(d.grabarConAvatar.length ? ['## Con el avatar de IA', lista(d.grabarConAvatar)] : []),
    ...(d.grabarConPersona.length ? ['## Si lo graba otra persona', lista(d.grabarConPersona)] : []),
    '## Qué va en cada plano',
    ...d.planos.map((p) => `- Plano ${p.n} (${seg(p.desde)}–${seg(p.hasta)} s): ${p.paraReplicar || p.seVe}`),
  ].join('\n\n');
  archivos['video/remake.md'] = parte([['part', 'remake']], remake);
  acerca['video/remake.md'] = 'Cómo replicarlo: edición, grabación y cada plano';

  if (d.frases.length) {
    archivos['video/transcript.vtt'] = ['WEBVTT', '', ...d.frases.flatMap((x) => [`${vtt(x.desde)} --> ${vtt(x.hasta)}`, x.texto, ''])].join('\n');
  }

  // La ficha, con el mapa.
  const mezcla = mezclaDeOrigen(d);
  const madeMix = (Object.keys(mezcla) as OrigenPlano[])
    .filter((o) => mezcla[o].segundos > 0)
    .map((o) => `${METODO[o]}: ${(mezcla[o].segundos / d.duracionS).toFixed(2)}`)
    .join(', ');
  const nombre = nombreVideoMd(`${f.cuenta ?? f.red}-${f.id}`);
  const descripcion = (d.resumen || `Video de ${f.cuenta ?? f.red}, plano a plano.`).slice(0, 1024);
  const tamanoDe = (ruta: string) => tokensDe(archivos[ruta].split('\n---\n').slice(1).join('\n---\n') || archivos[ruta]);
  const mapa = [
    `video/timeline.md | ${tamanoDe('video/timeline.md')} | ${acerca['video/timeline.md']}`,
    `video/shots/*.md | ${Math.round(d.planos.reduce((a, p) => a + tamanoDe(`video/shots/${dos(p.n)}.md`), 0) / Math.max(1, d.planos.length))} | Un archivo por plano`,
    ...['video/content.md', 'video/look.md', 'video/sound.md', 'video/remake.md'].map((x) => `${x} | ${tamanoDe(x)} | ${acerca[x]}`),
    ...(archivos['video/transcript.vtt'] ? [`video/transcript.vtt | ${tokensDe(archivos['video/transcript.vtt'])} | Lo que se dice, con tiempos (WebVTT)`] : []),
  ];
  const fuente = [`duration: ${seg(d.duracionS)}`, f.url ? `url: ${yaml(f.url)}` : `file: ${yaml(`${f.id}.mp4`)}`, ...(d.proporcion !== 'otra' ? [`aspect: '${d.proporcion}'`] : [])].join(', ');
  const veredicto = [
    `# ${f.cuenta ? `@${f.cuenta}` : 'Video'}${f.titulo ? ` · ${valor(f.titulo, 120)}` : ''}`,
    `${d.resumen} Veredicto: ${r.planos} planos en ${seg(d.duracionS)} s (${(Object.keys(mezcla) as OrigenPlano[]).filter((o) => mezcla[o].planos).map((o) => `${mezcla[o].planos} ${o}`).join(', ')}).`.trim(),
    ...(d.dudas.length ? ['## Preguntas abiertas', d.dudas.map((x) => `- ${x}`).join('\n')] : []),
    ['```videomd-map', ...mapa, '```'].join('\n'),
  ].join('\n\n');
  archivos['VIDEO.md'] = [
    '---',
    'videomd: 1',
    `name: ${nombre}`,
    `description: ${yaml(descripcion)}`,
    `source: {${fuente}}`,
    `shots: ${d.planos.length}`,
    `lang: ${d.idioma || 'es'}`,
    ...(madeMix ? [`made_mix: {${madeMix}}`] : []),
    ...(d.dudas.length ? [`open_questions: ${d.dudas.length}`] : []),
    `generator: {name: mako-desarmar, version: "${g.version}.${miro.modelo}"}`,
    '---',
    '',
    veredicto,
    '',
  ].join('\n');
  return archivos;
}
