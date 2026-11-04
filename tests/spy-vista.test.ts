// Lo que decide qué dibuja la pantalla de Competitor Spy. El caso que importa es el primero: la
// versión vieja afirmaba «no hay nada» sin haber leído, y Martín la rechazó (31/10/2026).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  contadorDeTarjeta, debeLeerAlAbrir, destinoDePieza, destinosDe, estadoDeResultados, fraseDeLectura,
  ORDENES, filtrarPiezas, ganchosDe, mezclaDeTipos, ordenarPiezas, pideConectarMeta, tiempoDePieza, tipoDeContenido,
} from '../lib/spy-vista';
import type { LecturaCanalSpy, Pieza } from '../lib/spy';

const AHORA = new Date('2026-10-31T12:00:00Z');
const base = { leyendo: false, trayendo: false, visibles: 0, total: 0, hayCanales: true, lecturas: null };
const lectura = (l: Partial<LecturaCanalSpy>): LecturaCanalSpy => ({ canal: 'youtube', ok: true, piezas: 0, nuevas: 0, detalle: '0 videos', ...l });

test('mientras se lee no se afirma que no hay nada, aunque haya una lectura vieja', () => {
  assert.equal(estadoDeResultados({ ...base, leyendo: true }), 'cargando');
  assert.equal(estadoDeResultados({ ...base, trayendo: true }), 'cargando');
  assert.equal(estadoDeResultados({ ...base, leyendo: true, lecturas: [lectura({})] }), 'cargando');
});

test('sin la lectura en la mano tampoco: el motivo no se guarda, así que no se inventa', () => {
  assert.equal(estadoDeResultados(base), 'cargando');
});

test('leímos y no hay es un cero contado; no pude es otro estado', () => {
  assert.equal(estadoDeResultados({ ...base, lecturas: [lectura({})] }), 'leido-sin-nada');
  assert.equal(estadoDeResultados({ ...base, lecturas: [lectura({ ok: false, detalle: 'No pude' })] }), 'no-pudo');
  assert.equal(estadoDeResultados({ ...base, lecturas: [] }), 'no-pudo', 'si la acción falló no se contó nada: no es un cero');
});

test('Instagram sin números no es «no publica nada»: contestó ok y no nos dieron las piezas', () => {
  const recortada = lectura({ canal: 'instagram', detalle: 'Leí el perfil, pero esta conexión de Meta no entrega los números de cada publicación.' });
  assert.equal(estadoDeResultados({ ...base, lecturas: [recortada] }), 'no-pudo');
  assert.equal(pideConectarMeta([recortada]), true);
  assert.equal(pideConectarMeta([lectura({ canal: 'youtube', ok: false })]), false);
});

test('los filtros que vacían la rejilla no se confunden con un competidor vacío', () => {
  assert.equal(estadoDeResultados({ ...base, total: 5 }), 'sin-coincidencias');
  assert.equal(estadoDeResultados({ ...base, total: 5, visibles: 2 }), 'hay');
  // Refrescando con piezas a la vista la rejilla se queda: el esqueleto no borra lo que ya se ve.
  assert.equal(estadoDeResultados({ ...base, total: 5, visibles: 2, leyendo: true }), 'hay');
});

test('un competidor sin canales no tiene qué leer y lo dice', () => {
  assert.equal(estadoDeResultados({ ...base, hayCanales: false }), 'sin-canales');
});

const yt = { instagram: null, youtube_id: 'UCx', landing_url: null };

test('se lee al abrir lo que nunca se leyó, lo que quedó sin piezas y lo viejo; una vez por sesión', () => {
  assert.equal(debeLeerAlAbrir({ ...yt, mirado_en: null }, 0, false, AHORA), true);
  assert.equal(debeLeerAlAbrir({ ...yt, mirado_en: '2026-10-31T11:00:00Z' }, 0, false, AHORA), true);
  assert.equal(debeLeerAlAbrir({ ...yt, mirado_en: '2026-10-31T11:00:00Z' }, 8, false, AHORA), false);
  assert.equal(debeLeerAlAbrir({ ...yt, mirado_en: '2026-10-29T11:00:00Z' }, 8, false, AHORA), true);
  assert.equal(debeLeerAlAbrir({ ...yt, mirado_en: null }, 0, true, AHORA), false, 'un perfil ilegible no se pide en bucle');
  assert.equal(debeLeerAlAbrir({ instagram: null, youtube_id: null, landing_url: null, mirado_en: null }, 0, false, AHORA), false);
});

test('sin fecha declarada no hay días: «la vemos desde» es otro hecho, y jamás «0 días»', () => {
  const sin = tiempoDePieza({ publicada_en: null, visto_primera_vez: '2026-10-12T00:00:00Z', dejo_de_verse_en: null }, AHORA);
  assert.equal(sin.dias, null);
  assert.equal(sin.linea, 'La vemos desde el 12 oct');
  const con = tiempoDePieza({ publicada_en: '2026-09-17T00:00:00Z', visto_primera_vez: '2026-10-12T00:00:00Z', dejo_de_verse_en: null }, AHORA);
  assert.equal(con.dias, 44);
  assert.equal(con.linea, '17 sep → hoy');
  const ida = tiempoDePieza({ publicada_en: '2026-09-17T00:00:00Z', visto_primera_vez: '2026-10-12T00:00:00Z', dejo_de_verse_en: '2026-10-20T00:00:00Z' }, AHORA);
  assert.equal(ida.sigue, false);
  assert.equal(ida.linea, '17 sep → 20 oct');
});

test('un contador podado no se le atribuye al dueño de la cuenta', () => {
  assert.equal(contadorDeTarjeta(null, '2026-10-30T00:00:00Z', AHORA), 'No lo publica');
  assert.equal(contadorDeTarjeta(null, '2026-01-01T00:00:00Z', AHORA), 'Sin leer');
  assert.equal(contadorDeTarjeta(0, '2026-10-30T00:00:00Z', AHORA), '0');
  assert.equal(contadorDeTarjeta(34_000, '2026-10-30T00:00:00Z', AHORA), '34 mil');
});

test('el destino sale del dominio guardado o de la primera URL que no sea una red', () => {
  assert.equal(destinoDePieza({ dominio_destino: 'www.Acme.com', texto: null }), 'acme.com');
  assert.equal(destinoDePieza({ dominio_destino: null, texto: 'Sígueme https://instagram.com/x y compra en https://www.tienda.mx/oferta?a=1' }), 'tienda.mx');
  assert.equal(destinoDePieza({ dominio_destino: null, texto: 'mira https://youtu.be/abc' }), null);
  assert.equal(destinoDePieza({ dominio_destino: null, texto: null }), null);
  const filas = destinosDe([
    { dominio_destino: 'a.com', texto: null }, { dominio_destino: 'a.com', texto: null },
    { dominio_destino: 'b.com', texto: null }, { dominio_destino: null, texto: null },
  ]);
  assert.deepEqual(filas[0], { rotulo: 'a.com', n: 2, pct: 50 });
});

test('la mezcla ordena por cantidad y la frase cuenta sobre el total', () => {
  const piezas = [{ tipo: 'reel' }, { tipo: 'reel' }, { tipo: 'video' }] as Array<Pick<Pieza, 'tipo'>>;
  assert.deepEqual(mezclaDeTipos(piezas)[0], { rotulo: 'Reels', n: 2, pct: 67 });
  const conTexto = piezas.map((p) => ({ ...p, dominio_destino: 'a.com', texto: null }));
  assert.equal(fraseDeLectura(conTexto, '2026-10-31T00:00:00Z', AHORA), 'De lo que leímos el 31 oct, 2 de sus 3 piezas son reels, y manda sobre todo a a.com.');
  assert.equal(fraseDeLectura([], null, AHORA), null);
});

test('«Más vistas» ordena por vistas y deja al final lo que no publica el número; «Más reciente», por fecha', () => {
  const v = (id: string, vistas: number | null, fecha: string, megusta: number | null = null) => ({ id, vistas, megusta, publicada_en: fecha, visto_primera_vez: fecha });
  const lista = [v('oculto', null, '2026-10-30T00:00:00Z', 900), v('chico', 50, '2026-10-01T00:00:00Z'), v('viral', 90_000, '2026-01-01T00:00:00Z')];
  assert.deepEqual(ordenarPiezas(lista, 'mas-vistas').map((x) => x.id), ['viral', 'chico', 'oculto'], '«no lo publica» no es «nadie lo vio»: va al final, no al principio');
  assert.deepEqual(ordenarPiezas(lista, 'mas-reciente').map((x) => x.id), ['oculto', 'chico', 'viral']);
  assert.deepEqual(ORDENES.map((o) => o.label), ['Más vistas', 'Más reciente']);
});

test('cada pieza cae en UN tipo de contenido: reels, carruseles, videos largos y Shorts', () => {
  assert.equal(tipoDeContenido({ canal: 'instagram', tipo: 'reel', duracion: null }), 'reels');
  assert.equal(tipoDeContenido({ canal: 'instagram', tipo: 'publicacion', duracion: null }), 'carruseles');
  assert.equal(tipoDeContenido({ canal: 'youtube', tipo: 'video', duracion: 'PT45S' }), 'shorts');
  assert.equal(tipoDeContenido({ canal: 'youtube', tipo: 'video', duracion: 'PT12M3S' }), 'largos');
  assert.equal(tipoDeContenido({ canal: 'youtube', tipo: 'video', duracion: null }), 'largos', 'sin duración legible, largo');
  const piezas = [
    { canal: 'instagram', tipo: 'reel', duracion: null, titulo: null, texto: 'cómo vender' },
    { canal: 'youtube', tipo: 'video', duracion: 'PT40S', titulo: 'un short', texto: null },
  ] as const;
  assert.equal(filtrarPiezas(piezas, '', 'shorts').length, 1);
  assert.equal(filtrarPiezas(piezas, 'vender', 'todo').length, 1);
  assert.equal(filtrarPiezas(piezas, 'vender', 'shorts').length, 0);
});

test('los ganchos llevan los días de la pieza, la más vieja primero', () => {
  const ganchos = ganchosDe([
    { analisis: { gancho: 'nueva', tipoGancho: 'promesa', angulo: '', etiquetas: [] }, publicada_en: '2026-10-30T00:00:00Z', dejo_de_verse_en: null },
    { analisis: { gancho: 'vieja', tipoGancho: 'promesa', angulo: '', etiquetas: [] }, publicada_en: '2026-01-01T00:00:00Z', dejo_de_verse_en: null },
    { analisis: null, publicada_en: '2025-01-01T00:00:00Z', dejo_de_verse_en: null },
  ], AHORA);
  assert.deepEqual(ganchos.map((g) => g.gancho), ['vieja', 'nueva']);
});
