// Los competidores SEGUIDOS de Competitor Spy (13/11/2026, Martín para Marketing CoPilot): a quién sigue el negocio, el número
// por red («con qué número se publica») y las alertas. Las reglas: lib/spy-seguidos-reglas.ts.
// Probado rompiéndolo:
//   · un registro roto que tira en vez de dar «no sigue a nadie»           → 1
//   · seguir a quien ya sigue le pisa el «desde»                          → 1
//   · un competidor borrado que sigue apareciendo como seguido            → 1
//   · el promedio de TODAS las piezas juntas en vez del de cada cuenta    → 2
//   · tomar más de 20 piezas por cuenta, o las más viejas                 → 2
//   · contar lo de menos de una semana, lo pago o un sorteo               → 2
//   · una cuenta con menos de 7 piezas que entra igual                    → 3
//   · YouTube con número sin la enmienda                                  → 4
//   · un outlier que no va primero, o que sale dos veces (nuevo y outlier) → 5
//   · lo nuevo fuera de la ventana de días                                → 5
//   · lo nuevo sin tope por cuenta (Dave Ramsey tapaba a todos)           → 5b
//   · un video de YouTube marcado outlier sin la enmienda                 → 5
//   · la alerta compacta sin el id que replica Copywriting                → 6
//   · un seguido que se relee cada semana como los demás                  → 7
//   · «vuelvo a intentar mañana» que con un seguido reintenta en una hora  → 7
//   · el cron que marca leído el YouTube de una lectura que falló         → 8
//   · la vista sin su URL (la tarea de CoPilot no llega), o el teléfono sin ella → 8
//   · la API sin las tres operaciones, o declaradas antes que las viejas  → 8

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  TOPE_NUEVAS_POR_CUENTA, CLAVE_SEGUIDOS, DIAS_ENTRE_CORRIDAS_SEGUIDO, DIAS_NOVEDADES, RUTA_SEGUIDOS, alertaCompacta, alertasDe, cambiarSeguido,
  formatoDeAlerta, idsSeguidos, leerLecturasYoutube, leerRegistroSeguidos, numeroDeSeguidos, rotuloDelNumero, tocaYoutube,
  type PiezaSeguida,
} from '../lib/spy-seguidos-reglas';
import { DIAS_ENTRE_CORRIDAS, tocaPedir, ultimaParaManana } from '../lib/spy-todo-reglas';
import { FALTA_LA_ENMIENDA } from '../lib/spy-reglas';

const RAIZ = resolve(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(resolve(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const DIA = 86_400_000;
const AHORA = Date.parse('2026-11-13T12:00:00Z');
const hace = (dias: number) => new Date(AHORA - dias * DIA).toISOString();

let siguiente = 1;
/** Una pieza: un reel por defecto, publicado hace `dias`, con sus vistas. */
function pieza(competidor: number, dias: number, o: Partial<PiezaSeguida> = {}): PiezaSeguida {
  const id = siguiente++;
  return {
    id, competidor_id: competidor, canal: 'instagram', tipo: 'reel', medio: 'video', duracion: null,
    publicada_en: hace(dias), visto_primera_vez: hace(dias), vistas: 1000, megusta: 50, comentarios: 5,
    titulo: null, texto: `pieza ${id}`, ref: `r${id}`, url: `https://www.instagram.com/p/r${id}/`, miniatura: null, analisis: null, ...o,
  };
}

test('1. el registro de seguidos: se lee sin tirar, seguir dos veces no cambia el «desde», y un borrado no se sigue', () => {
  assert.equal(CLAVE_SEGUIDOS, 'spy.seguidos');
  assert.equal(RUTA_SEGUIDOS, '/competitor-spy?ver=seguidos');
  assert.deepEqual(leerRegistroSeguidos(null), {});
  assert.deepEqual(leerRegistroSeguidos('esto no es json'), {});
  assert.deepEqual(leerRegistroSeguidos('[1,2]'), {});
  // Lo que no se entiende se descarta, lo bueno queda.
  assert.deepEqual(leerRegistroSeguidos(JSON.stringify({ 5: { desde: hace(3) }, x: { desde: hace(1) }, 7: { desde: 'mañana' }, '-2': { desde: hace(1) } })), { 5: { desde: hace(3) } });

  const r1 = cambiarSeguido({}, 8, true, hace(2));
  const r2 = cambiarSeguido(r1, 5, true, hace(1));
  assert.equal(cambiarSeguido(r2, 8, true, hace(0)), r2, 'seguir a quien ya sigue no cambia nada');
  assert.equal(r2['8'].desde, hace(2));
  assert.deepEqual(idsSeguidos(r2), [8, 5], 'del más viejo al más nuevo');
  assert.deepEqual(idsSeguidos(cambiarSeguido(r2, 8, false, hace(0))), [5]);
  assert.equal(cambiarSeguido(r2, 99, false, hace(0)), r2, 'dejar de seguir a quien no sigue no cambia nada');
  assert.deepEqual(idsSeguidos(r2, [5, 6]), [5], 'el 8 ya no existe: no se sigue');
});

test('2. el número es el promedio de lo que suele hacer CADA cuenta (su mediana de las últimas 20), no el de todas juntas', () => {
  // La cuenta 1 tiene 40 reels: los 20 más nuevos con 1000 vistas, los 20 más viejos con 900.000. Sólo entran los 20 más nuevos.
  const a = [
    ...Array.from({ length: 20 }, (_, i) => pieza(1, 8 + i, { vistas: 1000 })),
    ...Array.from({ length: 20 }, (_, i) => pieza(1, 60 + i, { vistas: 900_000 })),
  ];
  // La cuenta 2, con 7 reels de 3000 vistas. Si fuera el promedio de todas las piezas juntas, la cuenta 1 pesaría por tres.
  const b = Array.from({ length: 7 }, (_, i) => pieza(2, 10 + i, { vistas: 3000 }));
  // Lo que no entra: lo de menos de una semana, lo pago y un sorteo (con números enormes, para que se note si entran).
  const fuera = [
    pieza(2, 2, { vistas: 5_000_000 }),
    pieza(2, 12, { vistas: 5_000_000, texto: 'Mi nuevo curso #ad' }),
    pieza(2, 13, { vistas: 5_000_000, texto: '¡SORTEO! Comenta y participa' }),
  ];
  const n = numeroDeSeguidos([...a, ...b, ...fuera], [{ id: 1, nombre: 'Uno' }, { id: 2, nombre: 'Dos' }], AHORA);
  const reels = n.redes.find((r) => r.red === 'reel');
  assert.ok(reels);
  assert.equal(n.seguidos, 2);
  assert.equal(reels.motivo, null);
  assert.deepEqual(reels.competidores.map((c) => [c.id, c.mediana, c.piezas]), [[1, 1000, 20], [2, 3000, 7]]);
  assert.equal(reels.promedio, 2000);
  assert.equal(reels.competidores[0].hasta, hace(8), 'de cuándo es su número: la más nueva que entró');
  assert.equal(rotuloDelNumero(reels), '2 mil vistas');
  // Las publicaciones se miden por me gusta + comentarios.
  const pubs = Array.from({ length: 7 }, (_, i) => pieza(2, 9 + i, { tipo: 'publicacion', medio: 'carrusel', vistas: null, megusta: 100, comentarios: 20 }));
  const p = numeroDeSeguidos(pubs, [{ id: 2, nombre: 'Dos' }], AHORA).redes.find((r) => r.red === 'publicacion');
  assert.equal(p?.promedio, 120);
  assert.equal(p?.metrica, 'interaccion');
  assert.equal(rotuloDelNumero({ promedio: 120, metrica: 'interaccion' }), '120 me gusta y comentarios');
});

test('3. una cuenta con menos de 7 piezas no tiene número; si nadie tiene, el motivo lo dice', () => {
  const pocas = Array.from({ length: 6 }, (_, i) => pieza(1, 8 + i));
  const n = numeroDeSeguidos(pocas, [{ id: 1, nombre: 'Uno' }], AHORA).redes.find((r) => r.red === 'reel');
  assert.equal(n?.promedio, null);
  assert.equal(n?.motivo, 'pocas');
  assert.equal(n?.competidores[0].mediana, null);
  assert.equal(n?.competidores[0].piezas, 6);
  const nadie = numeroDeSeguidos([], [], AHORA);
  assert.equal(nadie.seguidos, 0);
  assert.ok(nadie.redes.every((r) => r.motivo === 'sin-seguidos' && r.promedio == null));
});

test('4. YouTube no tiene número sin la enmienda (y lo dice); con ella, sale solo', () => {
  const videos = Array.from({ length: 8 }, (_, i) => pieza(1, 8 + i, { canal: 'youtube', tipo: 'video', medio: null, duracion: 'PT12M', vistas: 5000 }));
  const sin = numeroDeSeguidos(videos, [{ id: 1, nombre: 'Uno' }], AHORA).redes.find((r) => r.red === 'video');
  assert.equal(sin?.promedio, null);
  assert.equal(sin?.motivo, 'falta-enmienda');
  assert.equal(sin?.explicacion, FALTA_LA_ENMIENDA);
  const con = numeroDeSeguidos(videos, [{ id: 1, nombre: 'Uno' }], AHORA, { conYouTube: true }).redes.find((r) => r.red === 'video');
  assert.equal(con?.promedio, 5000);
  // Un short no se mezcla con los videos largos.
  const short = numeroDeSeguidos(videos, [{ id: 1, nombre: 'Uno' }], AHORA, { conYouTube: true }).redes.find((r) => r.red === 'short');
  assert.equal(short?.motivo, 'pocas');
});

test('5. las alertas: los outliers primero (una sola vez), después lo nuevo de la ventana; YouTube sin outlier sin la enmienda', () => {
  // 10 reels de 1000 vistas en el último mes y medio, y uno de 9000 publicado hace 9 días: el outlier.
  const base = Array.from({ length: 10 }, (_, i) => pieza(1, 8 + i * 3, { vistas: 1000 }));
  const fuerte = pieza(1, 9, { vistas: 9000, analisis: { gancho: 'El error que nadie ve', angulo: 'Miedo a perder clientes' } });
  const nuevo = pieza(1, 2, { vistas: 50 });
  const viejo = pieza(1, DIAS_NOVEDADES + 5, { vistas: 1000 });
  const yt = Array.from({ length: 10 }, (_, i) => pieza(2, 8 + i, { canal: 'youtube', tipo: 'video', medio: null, duracion: 'PT10M', vistas: i === 0 ? 90_000 : 1000 }));
  const anuncio = pieza(3, 20, { canal: 'anuncios', tipo: 'anuncio', medio: null, vistas: null, megusta: null, comentarios: null, publicada_en: null, visto_primera_vez: hace(1) });
  const alertas = alertasDe([...base, fuerte, nuevo, viejo, ...yt, anuncio], AHORA);
  assert.equal(alertas[0].tipo, 'outlier');
  assert.equal(alertas[0].pieza.id, fuerte.id);
  assert.equal(alertas.filter((a) => a.pieza.id === fuerte.id).length, 1, 'el outlier no se repite como nuevo');
  assert.ok(alertas.every((a, i) => i === 0 || a.tipo === 'nueva'), 'sólo hay un outlier');
  assert.ok(!alertas.some((a) => a.pieza.id === viejo.id), 'lo de hace 19 días no es nuevo');
  assert.ok(alertas.some((a) => a.pieza.id === nuevo.id));
  assert.ok(alertas.some((a) => a.pieza.id === anuncio.id && a.formato === 'anuncio'), 'un anuncio sin fecha usa cuándo se vio');
  const video = alertas.find((a) => a.pieza.id === yt[0].id);
  assert.equal(video?.tipo, 'nueva', 'sin la enmienda, un video de YouTube no es outlier');
  // Lo nuevo, lo más nuevo primero.
  const nuevas = alertas.filter((a) => a.tipo === 'nueva').map((a) => Date.parse(a.pieza.publicada_en ?? a.pieza.visto_primera_vez));
  assert.deepEqual(nuevas, [...nuevas].sort((x, y) => y - x));
  // Con más días, entra lo de hace 19.
  assert.ok(alertasDe([...base, viejo], AHORA, { dias: 30 }).some((a) => a.pieza.id === viejo.id));
  assert.equal(formatoDeAlerta({ canal: 'instagram', tipo: 'publicacion', medio: 'carrusel' }), 'carrusel');
  assert.equal(formatoDeAlerta({ canal: 'instagram', tipo: 'publicacion', medio: null }), 'publicacion');
  assert.equal(formatoDeAlerta({ canal: 'youtube', tipo: 'video', duracion: 'PT45S' }), 'short');
  assert.equal(formatoDeAlerta({ canal: 'landing', tipo: 'landing' }), null);
});

test('5b. lo nuevo, con un tope por cuenta: una que publica diez videos por día no tapa a las demás', () => {
  const ramsey = Array.from({ length: 20 }, (_, i) => pieza(26, i * 0.5, { canal: 'youtube', tipo: 'video', medio: null, duracion: 'PT9M' }));
  const otra = [pieza(19, 9), pieza(19, 10)];
  const nuevas = alertasDe([...ramsey, ...otra], AHORA).filter((a) => a.tipo === 'nueva');
  assert.equal(nuevas.filter((a) => a.pieza.competidor_id === 26).length, TOPE_NUEVAS_POR_CUENTA);
  assert.equal(nuevas.filter((a) => a.pieza.competidor_id === 19).length, 2);
  // Las que quedan de Ramsey son las más nuevas.
  assert.deepEqual(nuevas.filter((a) => a.pieza.competidor_id === 26).map((a) => a.pieza.id), ramsey.slice(0, TOPE_NUEVAS_POR_CUENTA).map((p) => p.id));
});

test('6. la alerta como la lee CoPilot: con el id que replica Copywriting, el chip y el ángulo', () => {
  const base = Array.from({ length: 10 }, (_, i) => pieza(1, 8 + i * 3, { vistas: 1000 }));
  const fuerte = pieza(1, 9, { vistas: 9000, analisis: { gancho: ' El error ', angulo: 'Miedo a perder clientes' } });
  const [a] = alertasDe([...base, fuerte], AHORA);
  const c = alertaCompacta(a, { id: 1, nombre: 'Uno', avatar: 'https://x/y.jpg' }, 'https://x/mini.jpg');
  assert.equal(c.replicar, `spy:${fuerte.id}`);
  assert.match(c.replicar, /^(spy|biblioteca):-?\d{1,12}$/, 'el formato que acepta Copywriting (esIdOutlierCopy)');
  assert.equal(c.tipo, 'outlier');
  assert.equal(c.multiplo?.chip, '9×');
  assert.equal(c.angulo, 'Miedo a perder clientes');
  assert.equal(c.gancho, 'El error');
  assert.equal(c.pieza.titulo, 'El error');
  assert.deepEqual(c.competidor, { id: 1, nombre: 'Uno', avatar: 'https://x/y.jpg' });
  assert.equal(c.pieza.miniatura, 'https://x/mini.jpg');
});

test('7. un seguido mira lo nuevo cada día (los demás, cada semana), y «mañana» es mañana con cualquier cadencia', () => {
  const ayer = { ultima: new Date(AHORA - DIA).toISOString() };
  assert.equal(tocaPedir(ayer, AHORA), false, 'el de siempre, a la semana');
  assert.equal(tocaPedir(ayer, AHORA, DIAS_ENTRE_CORRIDAS_SEGUIDO), true, 'el seguido, al día');
  assert.equal(tocaPedir({ ...ayer, run: 'x' }, AHORA, DIAS_ENTRE_CORRIDAS_SEGUIDO), false, 'nunca con una en marcha');
  // Lo que no sirvió vuelve a intentar mañana: no en una hora (el seguido) ni en una semana (el de siempre).
  assert.equal(ultimaParaManana(AHORA, DIAS_ENTRE_CORRIDAS), hace(6));
  assert.equal(tocaPedir({ ultima: ultimaParaManana(AHORA, DIAS_ENTRE_CORRIDAS_SEGUIDO) }, AHORA + 3_600_000, DIAS_ENTRE_CORRIDAS_SEGUIDO), false);
  assert.equal(tocaPedir({ ultima: ultimaParaManana(AHORA, DIAS_ENTRE_CORRIDAS_SEGUIDO) }, AHORA + DIA, DIAS_ENTRE_CORRIDAS_SEGUIDO), true);
  assert.equal(tocaPedir({ ultima: ultimaParaManana(AHORA) }, AHORA + DIA), true);
  // El YouTube de un seguido, cada 20 horas.
  assert.equal(tocaYoutube(undefined, AHORA), true);
  assert.equal(tocaYoutube(new Date(AHORA - 5 * 3_600_000).toISOString(), AHORA), false);
  assert.equal(tocaYoutube(new Date(AHORA - 21 * 3_600_000).toISOString(), AHORA), true);
  assert.deepEqual(leerLecturasYoutube('{"5":"2026-11-12T00:00:00Z","6":3}'), { 5: '2026-11-12T00:00:00Z' });
  assert.deepEqual(leerLecturasYoutube('roto'), {});
});

test('8. todo enchufado: la vista con su URL en los dos lados, el cron, la API y el contrato de CoPilot', () => {
  const app = leer('app/competitor-spy/SpyApp.tsx');
  assert.match(app, /<Seguidos competidores=\{competidores\}/);
  assert.match(app, /url\.searchParams\.set\('ver', 'seguidos'\)/);
  assert.match(leer('app/competitor-spy/page.tsx'), /vistaInicial=\{sp\.ver === 'seguidos' \? 'seguidos' : 'todos'\}/);
  const m = leer('app/m/competitor-spy/SpyM.tsx');
  assert.match(m, /<Seguidos competidores=\{competidores\} telefono/);
  assert.match(leer('app/m/competitor-spy/page.tsx'), /ver=\{/);
  // «¿Creamos uno parecido?» replica en Copywriting, con el id de la alerta.
  const vista = leer('app/competitor-spy/Seguidos.tsx');
  assert.match(vista, /pedirReplicar\(idParaReplicar\(a\.pieza\.id\)\)/);
  assert.match(vista, /¿Creamos uno parecido\?/);
  // El cron: lo leído del YouTube de un seguido se anota SÓLO si la lectura anduvo.
  const cron = leer('app/api/cron/spy-todo/route.ts');
  assert.match(cron, /x\.canal === 'youtube' && x\.ok/);
  assert.match(cron, /mirarCompetidor\(c\.id, 'rutina', undefined, \['youtube'\]\)/);
  assert.match(leer('lib/spy-todo.ts'), /const dias = seguido \? DIAS_ENTRE_CORRIDAS_SEGUIDO : DIAS_ENTRE_CORRIDAS;/);
  // La API: las tres, al FINAL del área (el clasificador reparte su presupuesto por orden).
  const def = leer('lib/api-mako/areas/spy.def.ts');
  const ids = [...def.matchAll(/id: '([a-z_]+)', area: 'spy'/g)].map((x) => x[1]);
  assert.deepEqual(ids.slice(-3), ['ver_seguidos', 'seguir_competidor', 'alertas_de_seguidos']);
  const run = leer('lib/api-mako/areas/spy.run.ts');
  for (const id of ['ver_seguidos', 'seguir_competidor', 'alertas_de_seguidos']) assert.match(run, new RegExp(`\\n  ${id}: \\{`));
  // El contrato que lee Marketing CoPilot (lib/spy-seguidos.ts): estos cuatro nombres.
  const srv = leer('lib/spy-seguidos.ts');
  for (const f of ['leerSeguidos', 'seguirCompetidor', 'promedioDeSeguidos', 'alertasDeSeguidos']) {
    assert.match(srv, new RegExp(`export async function ${f}\\(`), f);
  }
});
