// La biblioteca de carruseles de ejemplo (lib/carruseles/biblioteca.ts): los ids en negativo, cómo entra al explorador junto
// a lo del negocio, quién sale y quién no vuelve, qué lee el script de la PC y cuánto puede gastar. Corre el código; nada de
// leer el fuente.
//
// Probado rompiéndolo (4/11/2026), base 13/0 (14/0 con el tope del explorador):
//   · `carruselesDeBiblioteca` sin anular el outlier de los que llegaron por un tema → 1 rojo (lo que no se midió no se dice);
//   · `carruselesDeBiblioteca` sin saltear a los creadores que salieron → 1 rojo (sale de todos lados);
//   · `unirConBiblioteca` sin sacar los repetidos → 1 rojo (la misma publicación una vez, como del negocio);
//   · `decidirCambio` que deja «sumar» a un creador que pidió salir → 1 rojo (no vuelve sin querer);
//   · `techoConCredito` sin descontar la reserva de Spy → 1 rojo (Spy sigue andando);
//   · `planDeLectura` sin cortar en el techo total → 1 rojo (nunca más que lo pedido);
//   · `filasDeLectura` que guarda las imágenes sueltas de un tema → 1 rojo (de un tema, sólo carruseles);
//   · `filasDeLectura` sin ordenar un tema por rendimiento → 1 rojo (se guardan los que mejor rinden).
//   · `recortarBiblioteca` que deja pasar las imágenes sueltas → 1 rojo; que no pone primero lo reciente → 1 rojo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CARRUSELES_POR_DEFECTO, DIAS_ENTRE_LECTURAS, RESERVA_CREDITO_USD, TECHO_USD_POR_DEFECTO, TEMAS_INICIALES,
  carruselesDeBiblioteca, creadorDelItem, cuentaDeInstagram, decidirCambio, entradaDeTema, esDeBiblioteca, filaDeBiblioteca,
  filasDeLectura, hashtagDe, idDeBiblioteca, planDeLectura, recortarBiblioteca, referentesSinCuenta, techoConCredito, techoDeCorrida, unirConBiblioteca,
  type CuentaBiblioteca, type PiezaBiblioteca, type TemaBiblioteca,
} from '../lib/carruseles/biblioteca';
import { carruselesDe, type Carrusel } from '../lib/carruseles/explorar';
import type { PiezaInstagram } from '../lib/instagram-perfil';
import { marcasDeVoseo } from '../lib/voseo';

const AHORA = Date.parse('2026-11-04T12:00:00Z');
const hace = (d: number) => new Date(AHORA - d * 86_400_000).toISOString();

const cuenta = (p: Partial<CuentaBiblioteca>): CuentaBiblioteca => ({
  id: 1, instagram: 'estudio.lumen', nombre: 'Estudio Lumen', fuente: 'lista', referente: null, estado: 'activa', motivo: null, foto: null, leida_en: null, ...p,
});
let n = 0;
const pieza = (p: Partial<PiezaBiblioteca>): PiezaBiblioteca => ({
  id: ++n, ref: `r${n}`, cuenta_id: 1, tema_id: null, url: `https://www.instagram.com/p/r${n}/`, miniatura: null, texto: null, formato: null,
  cierre: null, medio: 'carrusel', laminas: 7, megusta: 100, comentarios: 5, vistas: null, publicada_en: hace(10), visto_primera_vez: hace(2),
  dejo_de_verse_en: null, ...p,
});

test('los ids de la biblioteca van en negativo y vuelven a su fila; el cero y los de Spy no son de la biblioteca', () => {
  assert.equal(idDeBiblioteca(42), -42);
  assert.equal(idDeBiblioteca(-42), -42, 'no se da vuelta dos veces');
  assert.equal(filaDeBiblioteca(-42), 42);
  assert.equal(esDeBiblioteca(-1), true);
  assert.equal(esDeBiblioteca(0), false);
  assert.equal(esDeBiblioteca(7), false);
  assert.equal(filaDeBiblioteca(7), null);
});

test('entran como carruseles del explorador: de la biblioteca, con su creador, y el outlier sólo de la LISTA', () => {
  const lista = cuenta({ id: 1 });
  const deTema = cuenta({ id: 2, instagram: 'cafebrasa', nombre: 'Café Brasa', fuente: 'tema' });
  const ps = [
    pieza({ cuenta_id: 1, megusta: 100 }), pieza({ cuenta_id: 1, megusta: 100 }), pieza({ cuenta_id: 1, megusta: 500, formato: 'tutorial', cierre: 'guardar' }),
    pieza({ cuenta_id: 2, megusta: 100 }), pieza({ cuenta_id: 2, megusta: 100 }), pieza({ cuenta_id: 2, megusta: 900 }),
  ];
  const cs = carruselesDeBiblioteca(ps, [lista, deTema], AHORA);
  assert.equal(cs.length, 6);
  assert.ok(cs.every((c) => c.origen === 'biblioteca' && c.id < 0 && c.competidorId < 0), 'todo de la biblioteca, en negativo');
  const de = (fila: number) => cs.find((c) => c.id === idDeBiblioteca(fila))!;
  assert.equal(de(ps[2].id).outlier, 5, 'de la lista: el outlier de Spy contra la mediana de SU cuenta');
  assert.equal(de(ps[2].id).creador.usuario, 'estudio.lumen');
  assert.equal(de(ps[2].id).formato, 'tutorial', 'el tipo guardado al leerla (el texto vence a los 30 días)');
  assert.equal(de(ps[2].id).cierre, 'guardar');
  assert.equal(de(ps[5].id).outlier, null, 'de un tema no se leyó su cuenta: lo que no se midió no se dice');
});

test('un creador que salió no aparece en ningún lado, haya llegado por la lista o por un tema', () => {
  const fuera = cuenta({ id: 3, instagram: 'pidio.salir', estado: 'excluida', motivo: 'Lo pidió' });
  const cs = carruselesDeBiblioteca([pieza({ cuenta_id: 3 }), pieza({ cuenta_id: 1 })], [cuenta({ id: 1 }), fuera], AHORA);
  assert.equal(cs.length, 1);
  assert.equal(cs[0].creador.usuario, 'estudio.lumen');
});

test('junto a lo del negocio: la misma publicación sale UNA vez, como del negocio', () => {
  const propios = carruselesDe([{
    id: 10, competidor_id: 1, canal: 'instagram', tipo: 'publicacion', url: 'https://www.instagram.com/p/ABC/?igsh=1', texto: null, analisis: null,
    vistas: null, megusta: 1, comentarios: 0, publicada_en: hace(3), visto_primera_vez: hace(3), dejo_de_verse_en: null, miniatura: null, medio: 'carrusel', laminas: 5,
  }], [{ id: 1, nombre: 'Estudio Lumen', instagram: 'estudio.lumen', avatar: null }], AHORA);
  const biblio = carruselesDeBiblioteca([pieza({ url: 'https://instagram.com/p/abc' }), pieza({ url: 'https://www.instagram.com/p/OTRO/' })], [cuenta({})], AHORA);
  const todos: Carrusel[] = unirConBiblioteca(propios, biblio);
  assert.equal(todos.length, 2, 'la de /p/ABC/ está en los dos: queda la del negocio');
  assert.deepEqual(todos.map((c) => c.origen), ['cuentas', 'biblioteca']);
});

test('el @ y el hashtag se guardan como los entiende Instagram, o no se guardan', () => {
  assert.equal(cuentaDeInstagram('@Estudio.Lumen'), 'estudio.lumen');
  assert.equal(cuentaDeInstagram('https://www.instagram.com/cafebrasa/'), 'cafebrasa');
  assert.equal(cuentaDeInstagram('no es un usuario!'), null);
  assert.equal(hashtagDe('#MarcaPersonal'), 'marcapersonal');
  assert.equal(hashtagDe('https://www.instagram.com/explore/tags/emprendimiento/'), 'emprendimiento');
  assert.equal(hashtagDe('#diseño'), 'diseño');
  assert.equal(hashtagDe('#a'), null, 'uno de una letra no es un tema');
  assert.equal(hashtagDe('dos palabras'), null);
});

test('sacar, sumar y volver: el que pidió salir no vuelve con un «sumar», y sacar a uno que no está lo deja fuera igual', () => {
  const sumar = { que: 'cuenta' as const, accion: 'sumar' as const, valor: 'cafebrasa', nombre: 'Café Brasa' };
  assert.deepEqual(decidirCambio(sumar, null), { hacer: 'insertar' });
  assert.ok('error' in decidirCambio(sumar, { estado: 'excluida', fuente: 'lista' }), 'salió porque lo pidió: hace falta «Volver a sumar»');
  assert.deepEqual(decidirCambio(sumar, { estado: 'activa', fuente: 'tema' }), { hacer: 'a-la-lista' }, 'llegó por un tema: pasa a la lista');
  assert.ok('ya' in decidirCambio(sumar, { estado: 'activa', fuente: 'lista' }));
  assert.ok('error' in decidirCambio({ ...sumar, nombre: '  ' }, null), 'sin nombre no se suma');
  const sacar = { que: 'cuenta' as const, accion: 'sacar' as const, valor: 'cafebrasa', motivo: 'Lo pidió' };
  assert.deepEqual(decidirCambio(sacar, { estado: 'activa', fuente: 'tema' }), { hacer: 'excluir' });
  assert.deepEqual(decidirCambio(sacar, null), { hacer: 'excluir-nuevo' }, 'puede llegar por un tema mañana: queda anotado fuera');
  assert.ok('error' in decidirCambio({ ...sacar, motivo: '' }, null), 'sin motivo no sale: queda escrito por qué');
  assert.ok('ya' in decidirCambio(sacar, { estado: 'excluida' }));
  assert.deepEqual(decidirCambio({ que: 'cuenta', accion: 'volver', valor: 'cafebrasa' }, { estado: 'excluida' }), { hacer: 'reactivar' });
  assert.deepEqual(decidirCambio({ que: 'tema', accion: 'sacar', valor: 'ventas' }, { activo: true }), { hacer: 'excluir' });
  assert.ok('error' in decidirCambio({ que: 'tema', accion: 'sacar', valor: 'ventas' }, null));
  assert.deepEqual(decidirCambio({ que: 'tema', accion: 'volver', valor: 'ventas' }, { activo: false }), { hacer: 'reactivar' });
});

test('el techo de la corrida deja libre la reserva de Spy, y sin saber el crédito no se gasta', () => {
  assert.equal(RESERVA_CREDITO_USD, 2);
  assert.equal(techoConCredito(2, { usado: 0.5, tope: 5 }, RESERVA_CREDITO_USD), 2, 'quedan 2,50 libres: alcanza para lo pedido');
  assert.equal(techoConCredito(2, { usado: 1.8, tope: 5 }, RESERVA_CREDITO_USD), 1.2, 'quedan 1,20 por encima de la reserva');
  assert.equal(techoConCredito(2, { usado: 4, tope: 5 }, RESERVA_CREDITO_USD), 0, 'no alcanza: cero, nunca negativo');
  assert.equal(techoConCredito(2, null, RESERVA_CREDITO_USD), null);
  assert.equal(TECHO_USD_POR_DEFECTO, 2);
  assert.equal(CARRUSELES_POR_DEFECTO, 300);
});

test('el plan de lectura: intercala temas y cuentas, saltea lo al día, lo apagado y lo que salió, y nunca pasa el techo', () => {
  const cuentas = [
    cuenta({ id: 1, instagram: 'a.uno', leida_en: null }),
    cuenta({ id: 2, instagram: 'b.dos', leida_en: hace(DIAS_ENTRE_LECTURAS - 1) }),
    cuenta({ id: 3, instagram: 'c.tres', leida_en: hace(30) }),
    cuenta({ id: 4, instagram: 'd.fuera', estado: 'excluida' }),
    cuenta({ id: 5, instagram: 'e.tema', fuente: 'tema' }),
  ];
  const temas: TemaBiblioteca[] = [
    { id: 1, hashtag: 'ventas', nombre: 'Ventas', activo: true, leido_en: null },
    { id: 2, hashtag: 'apagado', nombre: 'Apagado', activo: false, leido_en: null },
  ];
  const p = planDeLectura(cuentas, temas, { techoUsd: 2, ahora: AHORA });
  assert.deepEqual(p.lecturas.map((l) => l.fuente.tipo === 'cuenta' ? `@${l.fuente.instagram}` : `#${l.fuente.hashtag}`), ['#ventas', '@a.uno', '@c.tres']);
  assert.deepEqual(p.alDia, ['@b.dos']);
  assert.ok(p.totalUsd <= 2);
  assert.equal(p.lecturas[0].techoUsd, techoDeCorrida(80));
  const chico = planDeLectura(cuentas, temas, { techoUsd: 0.2, ahora: AHORA });
  assert.ok(chico.totalUsd <= 0.2 && chico.quedanFuera.length > 0, 'con un techo chico, lo que no entra queda afuera y se dice');
  assert.deepEqual(planDeLectura(cuentas, temas, { techoUsd: 2, solo: '@b.dos', ahora: AHORA }).lecturas.map((l) => l.fuente.id), [2], '--solo lee aunque esté al día');
  assert.deepEqual(planDeLectura(cuentas, temas, { techoUsd: 2, soloTemas: true, ahora: AHORA }).lecturas.map((l) => l.fuente.tipo), ['tema']);
  assert.equal(planDeLectura(cuentas, temas, { techoUsd: 0, ahora: AHORA }).lecturas.length, 0, 'con techo cero no se lee nada');
});

const pi = (p: Partial<PiezaInstagram & { creador: string }>): PiezaInstagram & { creador: string } => ({
  ref: `s${++n}`, fecha: hace(5), tipo: 'Sidecar', formato: 'FEED', audio: null, texto: '', permalink: `https://www.instagram.com/p/s${n}/`,
  miniatura: null, vistas: null, megusta: 10, comentarios: 1, laminas: 6, creador: 'cafebrasa', ...p,
});

test('de un tema se guardan sólo los carruseles, del que mejor rinde al que menos, sin repetidos ni los que salieron', () => {
  const xs = [
    pi({ megusta: 50 }), pi({ megusta: 900, texto: '5 errores al vender por WhatsApp. Guárdalo.' }), pi({ tipo: 'Image', megusta: 5000 }),
    pi({ tipo: 'Video', megusta: 8000 }), pi({ formato: 'REELS', megusta: 7000 }), pi({ creador: 'pidio.salir', megusta: 6000 }),
    pi({ megusta: 300 }),
  ];
  xs.push({ ...xs[0] });   // la misma publicación dos veces
  const filas = filasDeLectura(xs, { tema: 7, fuera: new Set(['pidio.salir']), ahora: new Date(AHORA) });
  assert.deepEqual(filas.map((f) => f.megusta), [900, 300, 50]);
  assert.ok(filas.every((f) => f.medio === 'carrusel' && f.tema_id === 7));
  assert.equal(filas[0].formato, 'lista', 'clasificada al leerla: una lista de errores');
  assert.equal(filas[0].cierre, 'guardar', 'y lo que pide al final');
  assert.equal(filasDeLectura(xs, { tema: 7, tope: 2 }).length, 2, 'con tope');
});

test('de una cuenta de la lista se guardan carruseles E imágenes (la mediana del outlier es la de Spy), sin videos', () => {
  const filas = filasDeLectura([pi({}), pi({ tipo: 'Image', laminas: null }), pi({ tipo: 'Video' })], { tema: null });
  assert.deepEqual(filas.map((f) => f.medio), ['carrusel', 'imagen']);
  assert.equal(filas[1].laminas, null);
  assert.equal(filas[0].tema_id, null);
});

test('el creador de una publicación de un tema sale del ítem del actor; sin un @ válido no hay creador', () => {
  assert.deepEqual(creadorDelItem({ ownerUsername: 'CafeBrasa', ownerFullName: '  Café Brasa ' }), { instagram: 'cafebrasa', nombre: 'Café Brasa' });
  assert.deepEqual(creadorDelItem({ ownerUsername: 'cafebrasa' }), { instagram: 'cafebrasa', nombre: 'cafebrasa' });
  assert.equal(creadorDelItem({ ownerFullName: 'Sin usuario' }), null);
  assert.equal(creadorDelItem(null), null);
  const e = entradaDeTema('marca personal', 80);
  assert.deepEqual(e.directUrls, ['https://www.instagram.com/explore/tags/marca%20personal/']);
  assert.equal(e.resultsLimit, 80);
});

test('los temas de arranque son hashtags válidos, sin repetir y en español neutro', () => {
  assert.ok(TEMAS_INICIALES.length >= 8);
  for (const t of TEMAS_INICIALES) assert.equal(hashtagDe(t.hashtag), t.hashtag, t.hashtag);
  assert.equal(new Set(TEMAS_INICIALES.map((t) => t.hashtag)).size, TEMAS_INICIALES.length);
  assert.deepEqual(TEMAS_INICIALES.flatMap((t) => marcasDeVoseo(t.nombre)), []);
});

test('a quién buscar para arrancar: los referentes que todavía no están en la lista, por id o por nombre', () => {
  const refs = [{ id: 'hormozi', completo: 'Alex Hormozi' }, { id: 'brunson', completo: 'Russell Brunson' }, { id: 'kern', completo: 'Frank Kern' }];
  const ya = [
    cuenta({ id: 1, referente: 'hormozi', nombre: 'Alex Hormozi' }),
    cuenta({ id: 2, referente: null, nombre: 'Russell Brunson' }),
    cuenta({ id: 3, referente: null, nombre: 'Frank Kern', fuente: 'tema' }),
  ];
  assert.deepEqual(referentesSinCuenta(refs, ya).map((r) => r.id), ['kern'], 'el que llegó por un tema todavía no está en la lista');
});

test('al explorador llegan sólo carruseles, y con un tope: primero lo reciente, después lo que mejor rindió', () => {
  const base = carruselesDeBiblioteca([
    pieza({ cuenta_id: 1, medio: 'imagen', laminas: null, megusta: 9000 }),
    pieza({ cuenta_id: 1, publicada_en: hace(40), megusta: 50 }),
    pieza({ cuenta_id: 1, publicada_en: hace(40), megusta: 800 }),
    pieza({ cuenta_id: 1, publicada_en: hace(3), megusta: 10 }),
  ], [cuenta({ id: 1 })], AHORA);
  assert.equal(base.length, 4);
  const sinTope = recortarBiblioteca(base, 10, AHORA);
  assert.equal(sinTope.length, 3, 'las imágenes sueltas sirven para el outlier, no son ejemplos');
  assert.ok(sinTope.every((c) => c.medio !== 'imagen'));
  const dos = recortarBiblioteca(base, 2, AHORA);
  assert.deepEqual(dos.map((c) => c.megusta), [10, 800], 'lo de esta semana entra aunque rinda menos; después, lo que mejor rindió');
});
