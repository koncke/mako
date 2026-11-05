// El «3,7×» de cada pieza (lib/multiplo-rendimiento.ts): la ÚNICA cuenta de MaKo para «cuántas veces lo que suele hacer su
// cuenta», en Competitors Spy y en Carruseles de Image. Corre el código; nada de leer el fuente (salvo el guard del final, que
// barre quién llama).
//
// Probado rompiéndolo (5/11/2026), base 12/0; cada rotura da 1 rojo, en el test que la nombra:
//   · `MINIMO_PARA_COMPARAR` en 6 → el 1 (con 6 para comparar no hay número);
//   · `noSeCompara` sin el corte de «menos de una semana» → el 2 (ni se mide ni sirve de referencia);
//   · la clave del grupo sin el formato (`${competidor}|${canal}`) → el 3 (cortos y largos, reels y carruseles);
//   · las 20 primeras en vez de las más cercanas en el tiempo → el 4 (una cuenta que creció);
//   · `esSorteo` que nunca da true → el 5; `esPagada` que no lee el texto → el 5;
//   · los anuncios medidos por vistas → el 7 (son días activos y su rótulo lo dice);
//   · el corte de YouTube sin la enmienda III.L sacado → el 8.
// Y un cambio sin efecto (renombrar `vecinas` a `cercanas` en `multiplosDe`) lo deja en 12/0.
// El 12 (una sola cuenta), con una `function vecesSuMediana` vuelta a lib/spy-detalle.ts → rojo; con un `conYouTube: true` en
// lib/spy-vista.ts → rojo. Citar el nombre en un texto (la bitácora) no lo enciende.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MAXIMO_PARA_COMPARAR, MINIMO_PARA_COMPARAR, chipDeMultiplo, esFuerte, esPagada, esSorteo, explicarMultiplo, formatoDeMultiplo,
  multiplosDe, rotuloCortoDeMultiplo, type PiezaParaMultiplo,
} from '../lib/multiplo-rendimiento';
import { marcasDeVoseo } from '../lib/voseo';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const AHORA = Date.parse('2026-11-05T12:00:00Z');
const DIA = 86_400_000;
const hace = (d: number) => new Date(AHORA - d * DIA).toISOString();

let n = 0;
/** Un carrusel de Instagram: me gusta + comentarios. */
const carrusel = (megusta: number, dias: number, p: Partial<PiezaParaMultiplo> = {}): PiezaParaMultiplo => ({
  id: ++n, competidor_id: 1, canal: 'instagram', tipo: 'publicacion', medio: 'carrusel', publicada_en: hace(dias),
  vistas: null, megusta, comentarios: 0, texto: null, ...p,
});
const reel = (vistas: number, dias: number, p: Partial<PiezaParaMultiplo> = {}): PiezaParaMultiplo =>
  carrusel(10, dias, { tipo: 'reel', medio: 'video', vistas, comentarios: 1, ...p });
const video = (vistas: number, dias: number, duracion: string, p: Partial<PiezaParaMultiplo> = {}): PiezaParaMultiplo =>
  carrusel(10, dias, { canal: 'youtube', tipo: 'video', medio: null, vistas, comentarios: 1, duracion, ...p });

/** `k` publicaciones de 100, una por día desde `desde` días atrás. */
const base = (k: number, desde = 10, valor = 100) => Array.from({ length: k }, (_, i) => carrusel(valor, desde + i));

test('1. con menos de 7 para comparar no hay número; con 7, sí (y el chip, el tooltip y lo fuerte salen de ahí)', () => {
  assert.equal(MINIMO_PARA_COMPARAR, 7);
  const seis = [...base(6), carrusel(370, 9)];
  const m6 = multiplosDe(seis, AHORA).get(seis[6].id)!;
  assert.equal(m6.veces, null, 'con 6 para comparar no se inventa un número');
  assert.equal(m6.veces == null && m6.motivo, 'pocas');
  assert.equal(chipDeMultiplo(m6), null, 'sin número no hay chip');
  assert.equal(rotuloCortoDeMultiplo(m6), 'Sin datos suficientes');
  assert.match(explicarMultiplo(m6), /hacen falta 7 publicaciones suyas.*\(hay 6\)/);

  const siete = [...base(7), carrusel(370, 9)];
  const m7 = multiplosDe(siete, AHORA).get(siete[7].id)!;
  assert.equal(m7.veces, 3.7, '370 frente a una mediana de 100');
  assert.equal(m7.veces != null && m7.comparadas, 7);
  assert.equal(chipDeMultiplo(m7), '3,7×');
  assert.equal(esFuerte(m7), true, '2× o más se resalta');
  assert.match(explicarMultiplo(m7), /^3,7 veces lo que suele hacer esta cuenta: 370 me gusta y comentarios, frente a una mediana de 100 en sus 7 publicaciones más cercanas en el tiempo\.$/);
});

test('2. lo publicado hace menos de una semana no entra: ni se mide ni sirve de referencia', () => {
  const viejas = base(8, 10);
  const recientes = [carrusel(5000, 2), carrusel(5000, 3), carrusel(5000, 6)];
  const m = multiplosDe([...viejas, ...recientes], AHORA);
  for (const r of recientes) {
    const x = m.get(r.id)!;
    assert.equal(x.veces, null);
    assert.equal(x.veces == null && x.motivo, 'reciente', 'tiene menos de una semana');
  }
  // Las tres de 5.000 no le suben la mediana a nadie: cada vieja sigue en 1×.
  assert.ok(viejas.every((v) => m.get(v.id)?.veces === 1), 'una pieza reciente no es referencia de las otras');
  // Y a los 7 días justos ya entra.
  const justa = carrusel(300, 7);
  assert.equal(multiplosDe([...viejas, justa], AHORA).get(justa.id)?.veces, 3);
});

test('3. cada formato con el suyo: cortos y largos no se mezclan, ni los reels con los carruseles', () => {
  // YouTube, como quedará el día del trámite (`conYouTube`): 8 shorts de 1.000 y 8 videos largos de 100.000.
  const shorts = Array.from({ length: 8 }, (_, i) => video(1000, 10 + i, 'PT40S'));
  const largos = Array.from({ length: 8 }, (_, i) => video(100_000, 10 + i, 'PT12M'));
  const short = video(3000, 9, 'PT45S');
  const largo = video(300_000, 9, 'PT14M');
  const yt = multiplosDe([...shorts, ...largos, short, largo], AHORA, { conYouTube: true });
  assert.equal(formatoDeMultiplo(short), 'corto');
  assert.equal(formatoDeMultiplo(largo), 'largo');
  assert.equal(yt.get(short.id)?.veces, 3, 'el short contra los shorts, no contra los videos largos');
  assert.equal(yt.get(largo.id)?.veces, 3, 'el largo contra los largos, no contra los shorts');
  assert.match(explicarMultiplo(yt.get(largo.id)), /vistas.*Cálculo de MaKo, no un dato de YouTube\./, 'lo derivado de YouTube lleva su leyenda');

  // Instagram: los reels por vistas y contra los reels; los carruseles por interacción y contra los carruseles.
  const reels = Array.from({ length: 8 }, (_, i) => reel(10_000, 10 + i));
  const uno = reel(20_000, 9);
  const carr = [...base(8, 10, 50), carrusel(100, 9)];
  const ig = multiplosDe([...reels, uno, ...carr], AHORA);
  assert.equal(ig.get(uno.id)?.veces, 2, 'el reel contra sus reels (vistas)');
  assert.equal(ig.get(carr[8].id)?.veces, 2, 'el carrusel contra sus carruseles (me gusta + comentarios)');

  // Otra cuenta no cuenta: la cuenta grande no pisa a la chica.
  const otra = Array.from({ length: 8 }, (_, i) => carrusel(1_000_000, 10 + i, { competidor_id: 2 }));
  assert.equal(multiplosDe([...carr, ...otra], AHORA).get(carr[8].id)?.veces, 2);
});

test('4. la mediana es de las publicadas más cerca en el tiempo (hasta 20), no de toda la cuenta', () => {
  assert.equal(MAXIMO_PARA_COMPARAR, 20);
  // Una cuenta que creció: 30 viejas de 10 (hace 200 días) y 20 recientes de 1.000 (hace 10 a 29 días).
  const viejas = Array.from({ length: 30 }, (_, i) => carrusel(10, 200 + i));
  const nuevas = Array.from({ length: 20 }, (_, i) => carrusel(1000, 10 + i));
  const hoy = carrusel(2000, 8);
  const m = multiplosDe([...viejas, ...nuevas, hoy], AHORA).get(hoy.id)!;
  assert.equal(m.veces, 2, 'contra su momento (1.000), no contra la mediana de toda la cuenta');
  assert.equal(m.veces != null && m.comparadas, 20);
});

test('5. la publicidad pagada y los sorteos no entran en la comparación', () => {
  const pagada = carrusel(9000, 9, { texto: 'Mi rutina con @marca #ad' });
  const colab = carrusel(9000, 9, { texto: 'Colaboración pagada con Café Brasa' });
  const sorteo = carrusel(9000, 9, { texto: '🎁 SORTEO: gana una mentoría' });
  const giveaway = carrusel(9000, 9, { texto: 'Giveaway time!' });
  const viejas = base(8);
  const m = multiplosDe([...viejas, pagada, colab, sorteo, giveaway], AHORA);
  assert.equal(m.get(pagada.id)?.veces == null && (m.get(pagada.id) as { motivo: string }).motivo, 'pagada');
  assert.equal(m.get(colab.id)?.veces == null && (m.get(colab.id) as { motivo: string }).motivo, 'pagada');
  assert.equal(m.get(sorteo.id)?.veces == null && (m.get(sorteo.id) as { motivo: string }).motivo, 'sorteo');
  assert.equal(m.get(giveaway.id)?.veces == null && (m.get(giveaway.id) as { motivo: string }).motivo, 'sorteo');
  assert.ok(viejas.every((v) => m.get(v.id)?.veces === 1), 'y no le mueven la mediana a nadie');
  // Lo que se parece y no es: «#publicidad» es un tema en marketing, «#adultos» no es «#ad», «sortear» un obstáculo no es un sorteo.
  assert.equal(esPagada({ texto: 'Tips de #publicidad y #marketing #adultos' }), false);
  assert.equal(esSorteo({ texto: 'Cómo sortear las objeciones' }), false);
  assert.equal(esPagada({ pagada: true }), true, 'si la fuente lo dice, también');
});

test('6. sin los comentarios a la vista (pueden estar apagados) no se compara', () => {
  const sinComentarios = carrusel(5000, 9, { comentarios: null });
  const apagados = reel(90_000, 9, { comentariosApagados: true });
  const m = multiplosDe([...base(8), sinComentarios, apagados], AHORA);
  assert.equal((m.get(sinComentarios.id) as { motivo?: string }).motivo, 'sin-comentarios');
  assert.equal((m.get(apagados.id) as { motivo?: string }).motivo, 'sin-comentarios');
  assert.match(explicarMultiplo(m.get(sinComentarios.id)), /puede tenerlos apagados/);
});

test('7. un anuncio: los días que lleva activo frente a su anunciante, con su propio rótulo y diciendo que es una señal', () => {
  const ad = (dias: number, fin: number | null, p: Partial<PiezaParaMultiplo> = {}): PiezaParaMultiplo => ({
    id: ++n, competidor_id: 1, canal: 'anuncios', tipo: 'anuncio', publicada_en: hace(dias), dejo_de_verse_en: fin == null ? null : hace(fin),
    vistas: 9_000_000, megusta: null, comentarios: null, texto: null, ...p,
  });
  // Ocho anuncios que duraron 10 días (empezaron hace 40-47 y terminaron 10 días después) y uno que lleva 30 activo.
  const tipicos = Array.from({ length: 8 }, (_, i) => ad(40 + i, 30 + i));
  const largo = ad(30, null);
  const pegado = ad(30, null, { publicada_en: null });
  const m = multiplosDe([...tipicos, largo, pegado], AHORA);
  const x = m.get(largo.id)!;
  assert.equal(x.veces, 3, '30 días frente a una mediana de 10 (no las vistas: Meta no da los resultados de otro)');
  assert.equal(chipDeMultiplo(x), '3× activo');
  assert.match(explicarMultiplo(x), /^Lleva 3 veces más tiempo activo que un anuncio típico de esta cuenta: 30 días.*Es una señal, no un resultado/);
  assert.equal((m.get(pegado.id) as { motivo?: string }).motivo, 'sin-fecha', 'un anuncio pegado sin su inicio no tiene número');
});

test('8. YouTube espera su trámite: sin la enmienda III.L no hay número, y se dice por qué', () => {
  const largos = Array.from({ length: 8 }, (_, i) => video(100_000, 10 + i, 'PT12M'));
  const m = multiplosDe(largos, AHORA).get(largos[0].id)!;
  assert.equal(m.veces, null);
  assert.equal((m as { motivo?: string }).motivo, 'falta-enmienda');
  assert.match(explicarMultiplo(m), /trámite con YouTube/);
});

test('9. lo que dice no vosea, y todo motivo tiene su frase', () => {
  const motivos = ['pocas', 'reciente', 'pagada', 'sorteo', 'sin-comentarios', 'sin-numero', 'sin-fecha', 'mediana-cero', 'falta-enmienda', 'sin-cuenta', 'sin-formato'] as const;
  for (const motivo of motivos) {
    const m = { veces: null, motivo, formato: 'imagenes' as const, canal: 'instagram', comparadas: 3 };
    const t = `${explicarMultiplo(m)} ${rotuloCortoDeMultiplo(m)}`;
    assert.ok(t.trim().length > 10, motivo);
    assert.deepEqual(marcasDeVoseo(t), [], `${motivo}: ${t}`);
  }
});

test('10. la mediana de un número par de vecinas es el promedio de las dos del medio; cero no divide', () => {
  const xs = [...Array.from({ length: 4 }, (_, i) => carrusel(100, 10 + i)), ...Array.from({ length: 4 }, (_, i) => carrusel(300, 20 + i))];
  const una = carrusel(400, 9);
  // Sus 8 vecinas: cuatro de 100 y cuatro de 300 → mediana 200 → 2×.
  assert.equal(multiplosDe([...xs, una], AHORA).get(una.id)?.veces, 2);
  const ceros = [...base(8, 10, 0), carrusel(50, 9)];
  assert.equal((multiplosDe(ceros, AHORA).get(ceros[8].id) as { motivo?: string }).motivo, 'mediana-cero');
});

test('11. una web no tiene formato para comparar', () => {
  const web = { id: ++n, competidor_id: 1, canal: 'landing', tipo: 'pagina', publicada_en: hace(30), vistas: null, megusta: null, comentarios: null };
  assert.equal((multiplosDe([web], AHORA).get(web.id) as { motivo?: string }).motivo, 'sin-formato');
});

test('12. hay UNA cuenta: nadie más calcula «veces la mediana» y nadie de la app prende YouTube a mano', () => {
  const archivos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(archivos.length > 500, `barrió ${archivos.length} archivos`);
  // Una llamada o una declaración, no el nombre citado en un texto (la bitácora cuenta que se borró).
  const viejas = /\bvecesSuMediana\s*[(<=]|function\s+vecesSuMediana\b|mejoresPiezas\([^)]*\)\.map\(\(d\) => \[d\.id, d\.veces\]\)/;
  const malos: string[] = [];
  for (const f of archivos) {
    if (f === 'lib/multiplo-rendimiento.ts') continue;
    const src = readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
    const codigo = src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (viejas.test(codigo)) malos.push(`${f}: la cuenta vieja`);
    if (/conYouTube\s*:/.test(codigo)) malos.push(`${f}: prende YouTube sin la enmienda`);
  }
  assert.deepEqual(malos, []);
});
