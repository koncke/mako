// =============================================================================
// comunidad-reglas — saneo de posts, comentarios y encuestas; menciones; dos niveles; puntos
// =============================================================================
// Ejecuta lib/comunidad-reglas.ts (puro): lo que el server vuelve a preguntar antes de escribir.
//
// Verificado ROMPIÉNDOLO: ver el bloque «ROTURAS» al final del archivo (números medidos).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanearTexto, extracto, tokensDeTexto, nombraA, sanearMenciones, sanearEncuesta, encuestaGuardada, resultadosEncuesta,
  padreDeRespuesta, arbolDeComentarios, validarPost, validarComentario, videoDePost, puntosPorMiembro, tablaDeRanking,
  consultaDeOrden, ordenarPorLikes, haceCuanto, enLinea, fotoDeLead, sanearPerfil, linksGuardados, validarCategoria,
  aperturasPorNivel, consultaDeMencion, insertarMencion, leerClave, pathDeAdjunto, pathEsDeLaComunidad, validarAdjunto,
  mencionesDeTokens, puedePublicarEnLaComunidad,
  TOPE_TITULO, TOPE_CUERPO, TOPE_COMENTARIO, MAX_CATEGORIAS,
  type ActorRegla, type CategoriaRegla,
} from '../lib/comunidad-reglas';

const ALUMNO: ActorRegla = { clave: 'l:7', equipo: false, adminWs: false };
const EQUIPO: ActorRegla = { clave: 'u:3', equipo: true, adminWs: true };
const CATS: CategoriaRegla[] = [{ id: 1, nombre: 'General', permiso: 'todos' }, { id: 2, nombre: 'Anuncios', permiso: 'equipo' }];
const NOMBRES: Record<string, string> = { 'l:7': 'Ana Pérez', 'l:8': 'José', 'u:3': 'Mauricio' };
const nombreDe = (k: string) => NOMBRES[k];
const ctx = (actor: ActorRegla, categorias = CATS) => ({ actor, categorias, ws: 3, productoId: 12, nombreDe });
const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

// ── Texto ────────────────────────────────────────────────────────────────────────

test('el texto se limpia: CRLF, controles, líneas en blanco de más; el HTML queda como TEXTO', () => {
  assert.equal(sanearTexto('a\r\nb\r\rc'), 'a\nb\n\nc');
  assert.equal(sanearTexto('  hola\u0000\u0007 mundo  '), 'hola mundo');
  assert.equal(sanearTexto('a\n\n\n\n\nb'), 'a\n\nb');
  assert.equal(sanearTexto('<script>alert(1)</script>'), '<script>alert(1)</script>', 'no se interpreta ni se «limpia»');
  assert.equal(sanearTexto('  un\n  título  ', { unaLinea: true }), 'un título');
  assert.equal(sanearTexto(42), '');
});

test('el HTML crudo se dibuja como texto: ningún pedazo es HTML', () => {
  const t = tokensDeTexto('<img src=x onerror=alert(1)> <b>negrita</b>');
  assert.deepEqual(t, [{ tipo: 'texto', texto: '<img src=x onerror=alert(1)> <b>negrita</b>' }]);
});

test('links: sólo http/https, sin la puntuación de la oración; javascript: nunca es link', () => {
  const t = tokensDeTexto('mira https://ejemplo.com/a?b=1. y javascript:alert(1) y http://x.io');
  const links = t.filter((x) => x.tipo === 'link');
  assert.deepEqual(links.map((l) => (l as { href: string }).href), ['https://ejemplo.com/a?b=1', 'http://x.io/']);
  assert.ok(t.some((x) => x.tipo === 'texto' && x.texto.includes('javascript:alert(1)')), 'el javascript: queda como texto');
  assert.equal(t.map((x) => x.texto).join(''), 'mira https://ejemplo.com/a?b=1. y javascript:alert(1) y http://x.io', 'no se pierde ni una letra');
});

test('menciones: `@Nombre` con borde Unicode, el más largo primero, sin partir a otro', () => {
  assert.equal(nombraA('hola @José, ¿cómo va?', 'José'), true, 'una vocal acentuada al final tiene borde');
  assert.equal(nombraA('hola @Joséfina', 'José'), false, '@José no es @Joséfina');
  assert.equal(nombraA('hola @ana pérez', 'Ana Pérez'), true, 'sin mayúsculas');
  const t = tokensDeTexto('Gracias @Ana Pérez y @Ana', [{ clave: 'l:7', nombre: 'Ana Pérez' }, { clave: 'l:9', nombre: 'Ana' }]);
  assert.deepEqual(t.filter((x) => x.tipo === 'mencion').map((x) => (x as { clave: string }).clave), ['l:7', 'l:9']);
});

test('las menciones que se GUARDAN: miembros de esta comunidad y nombrados en el texto, sin repetir', () => {
  const texto = 'Hola @Ana Pérez y @Mauricio';
  assert.deepEqual(sanearMenciones(texto, ['l:7', 'u:3', 'l:7'], nombreDe), ['l:7', 'u:3']);
  assert.deepEqual(sanearMenciones(texto, ['l:8'], nombreDe), [], 'José es miembro pero el texto no lo nombra: no notifica');
  assert.deepEqual(sanearMenciones(texto, ['l:99'], nombreDe), [], 'una clave que no es miembro se tira');
  assert.deepEqual(sanearMenciones(texto, ['admin@x.com', 'drop table'], nombreDe), [], 'lo que no es una clave se tira');
  assert.deepEqual(sanearMenciones(texto, 'l:7', nombreDe), [], 'tiene que ser una lista');
});

test('el extracto de la tarjeta corta en una palabra', () => {
  assert.equal(extracto('corto'), 'corto');
  const e = extracto(`${'palabra '.repeat(40)}`, 60);
  assert.ok(e.endsWith('…') && e.length <= 61 && !e.includes('  '));
});

// ── El post ──────────────────────────────────────────────────────────────────────

test('el equipo publica en la categoría «solo el equipo»; el alumno, no', () => {
  assert.equal(validarPost({ titulo: 'Aviso', categoriaId: 2 }, ctx(EQUIPO)).ok, true);
  assert.equal(validarPost({ titulo: 'Aviso', categoriaId: 2 }, ctx(ALUMNO)).ok, false);
});

test('un post válido de un alumno, en una categoría abierta', () => {
  const r = validarPost({ titulo: '  Mi avance  ', cuerpo: 'Gracias @Ana Pérez', categoriaId: 1, menciones: ['l:7'] }, ctx(ALUMNO));
  assert.ok(r.ok);
  assert.equal(r.post.titulo, 'Mi avance');
  assert.equal(r.post.categoriaId, 1);
  assert.deepEqual(r.post.menciones, ['l:7']);
});

test('los largos: título y cuerpo con tope, y título obligatorio', () => {
  assert.equal(validarPost({ titulo: '', categoriaId: 1 }, ctx(ALUMNO)).ok, false);
  assert.equal(validarPost({ titulo: 'x'.repeat(TOPE_TITULO + 1), categoriaId: 1 }, ctx(ALUMNO)).ok, false);
  assert.equal(validarPost({ titulo: 'x'.repeat(TOPE_TITULO), categoriaId: 1 }, ctx(ALUMNO)).ok, true);
  assert.equal(validarPost({ titulo: 'ok', cuerpo: 'x'.repeat(TOPE_CUERPO + 1), categoriaId: 1 }, ctx(ALUMNO)).ok, false);
});

test('con categorías, elegir una es obligatorio; sin categorías, el post va sin una', () => {
  assert.equal(validarPost({ titulo: 'ok' }, ctx(ALUMNO)).ok, false);
  assert.equal(validarPost({ titulo: 'ok', categoriaId: 999 }, ctx(ALUMNO)).ok, false, 'una categoría de otra comunidad no existe acá');
  const sin = validarPost({ titulo: 'ok', categoriaId: 1 }, ctx(ALUMNO, []));
  assert.ok(sin.ok && sin.post.categoriaId === null);
});

test('el video: YouTube, Vimeo o Loom con su id; cualquier otra cosa no se guarda', () => {
  assert.equal(videoDePost('https://youtu.be/dQw4w9WgXcQ')?.proveedor, 'youtube');
  assert.equal(videoDePost('https://vimeo.com/123456/abcdef12')?.embed, 'https://player.vimeo.com/video/123456?h=abcdef12');
  assert.equal(videoDePost('https://www.loom.com/share/abc123')?.proveedor, 'loom');
  for (const malo of ['javascript:alert(1)', 'https://drive.google.com/file/d/xyz/view', 'https://x.com/v.mp4', 'https://youtube.com/watch']) {
    assert.equal(videoDePost(malo), null, malo);
  }
  // ~160 letras escritas, más de 600 al normalizar (cada «ñ» es `%C3%B1`): el CHECK de la 0217 mira lo guardado.
  const largo = `https://youtu.be/dQw4w9WgXcQ?t=${'ñ'.repeat(130)}`;
  assert.ok(largo.length < 600);
  assert.equal(videoDePost(largo), null, 'un link que normalizado no entra en la columna');
  assert.equal(validarPost({ titulo: 'ok', categoriaId: 1, videoUrl: 'https://drive.google.com/file/d/xyz' }, ctx(ALUMNO)).ok, false);
});

test('la encuesta: 2 a 10 opciones, cortas, sin repetir; ids estables', () => {
  assert.deepEqual(sanearEncuesta(null), { ok: true, encuesta: null });
  assert.deepEqual(sanearEncuesta(['', '  ']), { ok: true, encuesta: null }, 'vacía = no hay encuesta');
  assert.equal(sanearEncuesta(['sólo una']).ok, false);
  assert.equal(sanearEncuesta(Array.from({ length: 11 }, (_, i) => `o${i}`)).ok, false);
  assert.equal(sanearEncuesta(['Sí', 'x'.repeat(81)]).ok, false);
  assert.equal(sanearEncuesta(['Mañana', 'mañana']).ok, false, 'repetidas sin importar mayúsculas');
  const e = sanearEncuesta([' A ', '<b>B</b>']);
  assert.ok(e.ok && e.encuesta);
  assert.deepEqual(e.encuesta.opciones, [{ id: 'o1', texto: 'A' }, { id: 'o2', texto: '<b>B</b>' }]);
});

test('los resultados: un voto por persona, opciones viejas no cuentan, y mi voto', () => {
  const enc = encuestaGuardada({ opciones: [{ id: 'o1', texto: 'A' }, { id: 'o2', texto: 'B' }] })!;
  const r = resultadosEncuesta(enc, [
    { opcion: 'o1', miembro: 'l:1' }, { opcion: 'o2', miembro: 'l:2' }, { opcion: 'o2', miembro: 'l:3' },
    { opcion: 'o9', miembro: 'l:4' }, { opcion: 'o1', miembro: 'l:2' },
  ], 'l:2');
  assert.equal(r.total, 3);
  assert.deepEqual(r.opciones.map((o) => [o.votos, o.pct]), [[2, 67], [1, 33]]);
  assert.equal(r.miVoto, 'o1', 'el último voto de la persona es el que vale');
  assert.equal(encuestaGuardada({ opciones: [{ id: 'o1', texto: 'A' }] }), null, 'con una sola opción no hay encuesta');
});

test('el adjunto: el path tiene que ser de ESTA comunidad, con el tipo que dice', () => {
  const path = pathDeAdjunto(3, 12, 'image/png', UUID)!;
  assert.equal(path, `3/12/${UUID}.png`);
  assert.equal(pathEsDeLaComunidad(path, 3, 12), true);
  assert.equal(pathEsDeLaComunidad(path, 4, 12), false, 'de otro workspace');
  assert.equal(pathEsDeLaComunidad(path, 3, 13), false, 'de otro producto');
  assert.equal(pathEsDeLaComunidad(`3/12/../4/12/${UUID}.png`, 3, 12), false);
  assert.equal(validarAdjunto({ path, mime: 'application/pdf', bytes: 10, nombre: 'a.pdf' }, 3, 12).ok, false, 'un PNG declarado como PDF');
  assert.equal(validarAdjunto({ path, mime: 'image/png', bytes: 26 * 1024 * 1024, nombre: 'a.png' }, 3, 12).ok, false);
  const ok = validarAdjunto({ path, mime: 'image/png', bytes: 1000, nombre: '../../etc/passwd' }, 3, 12);
  assert.ok(ok.ok && !ok.adjunto.nombre.includes('/'));
  assert.equal(pathDeAdjunto(3, 12, 'application/x-msdownload', UUID), null);
});

// ── Comentarios: DOS niveles ─────────────────────────────────────────────────────

test('responder a un comentario lo cuelga de él; responder a una RESPUESTA queda en el mismo hilo', () => {
  assert.equal(padreDeRespuesta({ id: 10, padreId: null }), 10);
  assert.equal(padreDeRespuesta({ id: 11, padreId: 10 }), 10, 'nunca un tercer nivel');
  assert.equal(padreDeRespuesta(null), null);
});

test('el árbol: primer nivel y respuestas en orden cronológico; una respuesta huérfana no se dibuja', () => {
  const c = (id: number, padreId: number | null, creado: string) => ({ id, padreId, creado });
  const arbol = arbolDeComentarios([
    c(3, 1, '2026-10-07T10:03:00Z'), c(1, null, '2026-10-07T10:00:00Z'), c(2, null, '2026-10-07T10:01:00Z'),
    c(4, 1, '2026-10-07T10:02:00Z'), c(5, 99, '2026-10-07T10:04:00Z'),
  ]);
  assert.deepEqual(arbol.map((r) => r.id), [1, 2]);
  assert.deepEqual(arbol[0].respuestas.map((r) => r.id), [4, 3]);
  assert.deepEqual(arbol[1].respuestas, []);
  assert.equal(arbol.flatMap((r) => r.respuestas).some((r) => r.id === 5), false);
});

test('un comentario: obligatorio, con tope, y la respuesta dice a quién', () => {
  assert.equal(validarComentario({ cuerpo: '   ' }, nombreDe).ok, false);
  assert.equal(validarComentario({ cuerpo: 'x'.repeat(TOPE_COMENTARIO + 1) }, nombreDe).ok, false);
  const r = validarComentario({ cuerpo: '@José dale', menciones: ['l:8'], responderA: '15' }, nombreDe);
  assert.ok(r.ok);
  assert.equal(r.responderA, 15);
  assert.deepEqual(r.menciones, ['l:8']);
});

// ── Puntos y ranking ─────────────────────────────────────────────────────────────

test('1 like recibido = 1 punto; sacar el like (la fila) resta el punto', () => {
  const likes = [
    { autor: 'l:1', creado: '2026-10-01T00:00:00Z' }, { autor: 'l:1', creado: '2026-10-06T00:00:00Z' },
    { autor: 'l:2', creado: '2026-10-06T00:00:00Z' },
  ];
  assert.equal(puntosPorMiembro(likes).get('l:1'), 2);
  const sinUno = likes.filter((_, i) => i !== 0);
  assert.equal(puntosPorMiembro(sinUno).get('l:1'), 1, 'el punto se va con la fila');
  const semana = puntosPorMiembro(likes, Date.parse('2026-10-05T00:00:00Z'));
  assert.equal(semana.get('l:1'), 1, 'la tabla de 7 días cuenta desde el corte');
});

test('el ranking: sin el equipo, sin ex miembros, empates comparten puesto', () => {
  const puntos = new Map([['l:1', 5], ['u:3', 50], ['l:2', 5], ['l:3', 2], ['l:4', 9], ['l:5', 0]]);
  const filas = tablaDeRanking(puntos, (k) => k !== 'l:4');
  assert.deepEqual(filas.map((f) => [f.clave, f.puesto]), [['l:1', 1], ['l:2', 1], ['l:3', 3]]);
  assert.equal(tablaDeRanking(puntos, () => true, 1).length, 1);
});

// ── El orden del feed ────────────────────────────────────────────────────────────

test('el orden: Recientes por actividad, Nuevos por fecha, Top por likes desde el corte', () => {
  const ahora = Date.parse('2026-10-08T00:00:00Z');
  assert.deepEqual(consultaDeOrden('default', ahora), { columna: 'actividad_at', desde: null, porLikes: false });
  assert.deepEqual(consultaDeOrden('nuevos', ahora), { columna: 'created_at', desde: null, porLikes: false });
  assert.equal(consultaDeOrden('top_semana', ahora).desde, '2026-10-01T00:00:00.000Z');
  assert.equal(consultaDeOrden('top_mes', ahora).desde, '2026-09-08T00:00:00.000Z');
  const o = ordenarPorLikes([{ id: 1, likes: 2, creado: 'b' }, { id: 2, likes: 5, creado: 'a' }, { id: 3, likes: 2, creado: 'c' }]);
  assert.deepEqual(o.map((x) => x.id), [2, 3, 1]);
});

// ── El tiempo y la presencia ─────────────────────────────────────────────────────

test('hace cuánto, corto; y «en línea» son los últimos 5 minutos', () => {
  const ahora = Date.parse('2026-10-08T12:00:00Z');
  assert.equal(haceCuanto('2026-10-08T11:59:30Z', ahora), 'ahora');
  assert.equal(haceCuanto('2026-10-08T11:55:00Z', ahora), '5 min');
  assert.equal(haceCuanto('2026-10-08T09:00:00Z', ahora), '3 h');
  assert.equal(haceCuanto('2026-10-06T12:00:00Z', ahora), '2 d');
  assert.equal(haceCuanto('2026-09-12T12:00:00Z', ahora), '12 sep');
  assert.equal(haceCuanto('2025-09-12T12:00:00Z', ahora), '12 sep 2025');
  assert.equal(haceCuanto('basura', ahora), '');
  assert.equal(enLinea('2026-10-08T11:55:30Z', ahora), true);
  assert.equal(enLinea('2026-10-08T11:54:00Z', ahora), false);
  assert.equal(enLinea(null, ahora), false);
});

// ── La cara y el perfil ──────────────────────────────────────────────────────────

test('la foto del alumno: la elegida gana, después la de WhatsApp guardada; sólo https', () => {
  assert.equal(fotoDeLead({ avatar_url: 'https://a/x.png', foto_auto_url: 'https://b/y.png' }), 'https://a/x.png');
  assert.equal(fotoDeLead({ icono: 'icon:mdi:star', foto_auto_url: 'https://b/y.png' }), 'https://b/y.png', 'un ícono no es una foto');
  assert.equal(fotoDeLead({ avatar_url: 'javascript:alert(1)' }), null);
  assert.equal(fotoDeLead(null), null);
});

test('el perfil: bio con tope, links http/https con el nombre de la red', () => {
  const ok = sanearPerfil({ bio: '  Hola  ', links: { web: 'miweb.com', instagram: '', otra: 'https://x.com' }, ubicacion: 'CDMX' });
  assert.ok(ok.ok);
  assert.deepEqual(ok.perfil.links, { web: 'https://miweb.com/' });
  assert.equal(sanearPerfil({ bio: 'x'.repeat(301) }).ok, false);
  const malo = sanearPerfil({ links: { youtube: 'javascript:alert(1)' } });
  assert.ok(!malo.ok && malo.error.includes('YouTube'));
  // Parsea como URL (`https://ftp://x.com/a` tiene host «ftp») y no es una dirección: rebota igual.
  assert.equal(sanearPerfil({ links: { web: 'ftp://x.com/a' } }).ok, false);
  assert.deepEqual(linksGuardados({ web: 'javascript:x', x: 'https://x.com/a' }), { x: 'https://x.com/a' });
});

// ── Categorías ───────────────────────────────────────────────────────────────────

test('categorías: 1-30 letras, sin repetir (ni con acentos), hasta 10', () => {
  const ex = [{ id: 1, nombre: 'Presentación' }];
  assert.equal(validarCategoria({ nombre: 'presentacion' }, ex).ok, false);
  assert.equal(validarCategoria({ nombre: 'x'.repeat(31) }, ex).ok, false);
  assert.equal(validarCategoria({ nombre: 'Presentación' }, ex, 1).ok, true, 'editar la misma no choca consigo');
  const diez = Array.from({ length: MAX_CATEGORIAS }, (_, i) => ({ id: i + 1, nombre: `c${i}` }));
  assert.equal(validarCategoria({ nombre: 'otra' }, diez).ok, false);
  const r = validarCategoria({ nombre: ' Anuncios ', permiso: 'equipo', ordenDefault: 'top_mes' }, ex);
  assert.ok(r.ok);
  assert.deepEqual(r.categoria, { nombre: 'Anuncios', permiso: 'equipo', ordenDefault: 'top_mes' });
  const raro = validarCategoria({ nombre: 'X', permiso: 'admins', ordenDefault: 'drop' }, ex);
  assert.ok(raro.ok && raro.categoria.permiso === 'todos' && raro.categoria.ordenDefault === 'default');
});

// ── Lo demás ─────────────────────────────────────────────────────────────────────

test('qué abre cada nivel: sólo bloqueos por nivel 1-9', () => {
  const a = aperturasPorNivel([
    { nombre: 'Módulo 4', bloqueo: { tipo: 'nivel', nivel: 3 } },
    { nombre: 'Clase extra', bloqueo: { tipo: 'nivel', nivel: '3' } },
    { nombre: 'Por días', bloqueo: { tipo: 'dias', dias: 7 } },
    { nombre: 'Nivel 12', bloqueo: { tipo: 'nivel', nivel: 12 } },
    { nombre: 'Sin', bloqueo: null },
  ]);
  assert.deepEqual(a, { 3: ['Módulo 4', 'Clase extra'] });
});

test('la mención a medio escribir: después de un espacio, con espacios adentro, sin saltos', () => {
  assert.deepEqual(consultaDeMencion('hola @Ana Pé', 12), { ini: 5, q: 'Ana Pé' });
  assert.equal(consultaDeMencion('correo@ejemplo', 14), null, 'un email no es una mención');
  assert.equal(consultaDeMencion('@x\ny', 4), null);
  assert.deepEqual(insertarMencion('hola @An y más', 8, { ini: 5 }, 'Ana Pérez'), { texto: 'hola @Ana Pérez  y más', cursor: 16 });
});

test('las claves: u:<id> o l:<id>, nada más', () => {
  assert.deepEqual(leerClave('l:12'), { tipo: 'alumno', id: 12, clave: 'l:12' });
  assert.deepEqual(leerClave(' u:3 '), { tipo: 'equipo', id: 3, clave: 'u:3' });
  for (const x of ['l:0', 'l:-1', 'x:1', 'l:1;drop', 'mauricio@x.com', 12, null]) assert.equal(leerClave(x), null, String(x));
});

// ── La revisión del 08/10/2026 ───────────────────────────────────────────────────

test('editar conserva las menciones: las que el texto partido YA tenía vuelven como {clave, nombre}', () => {
  const tokens = tokensDeTexto('Gracias @Ana Pérez y @josé, y otra vez @Ana Pérez.', [
    { clave: 'l:7', nombre: 'Ana Pérez' }, { clave: 'l:8', nombre: 'José' },
  ]);
  const m = mencionesDeTokens(tokens);
  // Sin repetir, en el orden del texto, y con el nombre como se ESCRIBIÓ (el server compara sin mayúsculas).
  assert.deepEqual(m, [{ clave: 'l:7', nombre: 'Ana Pérez' }, { clave: 'l:8', nombre: 'josé' }]);
  // Y lo que se reenvía al guardar pasa de nuevo el saneo del server: las dos siguen siendo menciones.
  const texto = tokens.map((t) => t.texto).join('');
  assert.deepEqual(sanearMenciones(texto, m.map((x) => x.clave), nombreDe), ['l:7', 'l:8']);
  assert.deepEqual(mencionesDeTokens(tokensDeTexto('sin nadie https://x.com')), []);
});

test('publicar ALGO acá: el nivel mínimo y, con categorías, alguna que lo deje (todas «del equipo» = no)', () => {
  const soloEquipo: CategoriaRegla[] = [{ id: 2, nombre: 'Anuncios', permiso: 'equipo' }];
  assert.equal(puedePublicarEnLaComunidad(ALUMNO, 1, 1, []), true, 'sin categorías, publica');
  assert.equal(puedePublicarEnLaComunidad(ALUMNO, 1, 1, CATS), true, 'hay una de «todos»');
  assert.equal(puedePublicarEnLaComunidad(ALUMNO, 1, 1, soloEquipo), false, 'todas son del equipo');
  assert.equal(puedePublicarEnLaComunidad(ALUMNO, 2, 3, CATS), false, 'no llega al nivel');
  assert.equal(puedePublicarEnLaComunidad(EQUIPO, 1, 9, soloEquipo), true, 'el equipo publica siempre');
});

// ── ROTURAS ──────────────────────────────────────────────────────────────────────
// Medido rompiendo lib/comunidad-reglas.ts a propósito (08/10/2026, arnés del scratchpad que restaura
// de memoria). Cada rotura, sola, contra este archivo de 27 tests: 1 fallo y 26 pases en TODAS.
//   · sanearTexto sin sacar los caracteres de control            · RE_LINK con `javascript:` y sin mirar el protocolo
//   · `@José` sin borde Unicode (matchea `@Joséfina`)             · sanearMenciones sin exigir que el texto nombre
//   · encuesta con opciones repetidas                             · resultados contando votos a opciones viejas
//   · padreDeRespuesta abriendo un TERCER nivel                   · respuestas sin orden cronológico
//   · categoría opcional con categorías                           · ranking con el equipo adentro
//   · puntos de 7 días sin el corte                               · path de adjunto de cualquier comunidad
//   · adjunto sin chequear su extensión                           · link de perfil sin chequear que sea dirección
//   · «ahora» hasta los 10 minutos                                · «en línea» de 10 minutos
//   · un ícono tomado como foto                                   · categoría con nombre repetido
//   · un nivel 12 que abre                                        · un email tomado como mención
//   · una clave floja (`l:0`, `l:1;drop`)                         · «Top semana» de 30 días
//   · un video de Drive aceptado
// (Las cinco de permisos de este módulo —fijar, borrar, like propio, configurar, categoría del equipo—
// las caza tests/comunidad-permisos.test.ts: 1 fallo y 16 pases cada una.)
// La REVISIÓN (08/10/2026, scratchpad/revision-comunidad/romper.mjs), con 29 tests: `mencionesDeTokens`
// con la `@` adentro del nombre · `puedePublicarEnLaComunidad` que ignora las categorías · el link de
// video sin el tope sobre lo normalizado: 1 fallo, 28 pases cada una. Las de arriba, re-medidas: 1 / 28.
