// =============================================================================
// Una pregunta del Dashboard se dibuja en el hilo del Ops Center: el bloque `grafico` (G16, y la tabla)
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, 2.7). «¿Cuánto vendí este mes?» en el chat de la
// app: `consultar_datos_dashboard` devuelve `{ content, bloque }`, `ejecutarOperacion` sanea el bloque y lo pasa por
// `ctx.aDibujar` (el canal de Ops Center 3, 061c1b74d), y el modelo lee sólo `content`. El hilo lo dibuja con la MISMA
// pieza del Dashboard (`CuerpoGrafico`, por app/_chat/bloques/GraficoHilo.tsx).
// Lo que se puede romper sin que se vea: que el saneo deje pasar un gráfico que el catálogo no conoce o un resultado que
// no calza (la pieza dibujaría basura), que no acote las filas, que el modelo reciba también el bloque, que sin el canal
// de dibujo (WhatsApp, HTTP) se le diga al modelo que la persona ya lo ve, y que el chat dibuje con una copia.
// La revisión del 21/10 (sobre 7eb2bbaae) sumó tres: una serie de más de 60 puntos dibujaba los 60 MÁS VIEJOS (y la
// nota decía el período entero), el gráfico del chat no tenía red de error (un pedazo que no carga tumbaba la pantalla)
// y «ya lo ve» se le decía al modelo aunque el bloque no se dibujara (el tope de bloques del turno).
//
// Correr: node --import tsx --test tests/dashboard-bloque-grafico.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (21/10/2026, base 5/0): el saneo sin validar el gráfico contra el catálogo → 4 / 1; sin el tope
// de filas → 4 / 1; el bloque metido en el texto (`J({ bloque, texto })`, lo leería el modelo) → 4 / 1; sin mirar
// `ctx.aDibujar` → 4 / 1; `graficoParaElChat` sin la serie de tiempo → 4 / 1; BloqueHilo sin el caso `grafico` → 4 / 1.
// Lo de la revisión (21/10/2026, base de los dos archivos 14/0, scratchpad romper-revision.mjs): la serie con los 60 más
// viejos → 13 / 1; la nota con el período entero → 13 / 1; «Y N más» también en una tabla → 13 / 1; BloqueHilo sin red →
// 13 / 1; CuerpoGrafico sin red → 13 / 1; ejecutar que dice «ya lo ve» siempre → 13 / 1; el turno que no avisa el tope
// → 13 / 1; el aviso pegado al texto → 13 / 1.
// La segunda revisión (sobre 17c0317b2, base 15/0, romper-revision2.mjs): el texto del modelo con las 25 filas más viejas
// → 14 / 1; el desglose del texto sin correr → 14 / 1; «filas más» en el tiempo → 14 / 1; la tabla cortada con su Total
// → 14 / 1.
// La tercera (sobre 16b2c5cad, base 52/0 con api-mako-dashboard y dashboard-bloques-chat, romper-revision3.mjs): el corte
// sin el «hacia adelante» → 51 / 1; el texto sin él → 51 / 1; el gráfico sin él → 51 / 1; todo lo que falta es «antes»
// → 51 / 1; el bloque sin cortar → 51 / 1; el pie que dice «antes» → 51 / 1; la lectura que no deja lugar a la pregunta
// → 51 / 1; `dibujar` sin la regla → 51 / 1.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_BLOQUES_MENSAJE, sanearBloque } from '../lib/chat-bloques';
import { MAX_FILAS_GRAFICO, cortarTiempo, graficoParaElChat, sanearResultado } from '../lib/chat-bloques-dashboard';
import { bloquesDelMensaje, entraOtroDibujo } from '../lib/mako-turno-app-reglas';
import { sanearComponente, type Grafico } from '../lib/graficos-catalogo';
import type { Resultado } from '../lib/graficos-agregar';
import { rangoDeTramo, resultadoMarkdown } from '../lib/api-mako/areas/dashboard.helpers';

const RAIZ = join(import.meta.dirname, '..');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n'));

const grafico = (extra: Partial<Grafico> = {}): Grafico => sanearComponente({
  clase: 'grafico', id: 'q0', x: 0, y: 0, w: 6, h: 4, tipo: 'tabla', fuente: 'leads', metricas: ['leads'], dimension: null, desglose: null,
  controles: [], periodo: 'ult30', desde: '', hasta: '', titulo: 'Leads', ...extra,
}) as Grafico;
const resultado = (filas: number, clase: Resultado['clase'] = 'categoria'): Resultado => ({
  columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }],
  filas: Array.from({ length: filas }, (_, i) => ({ clave: `k${i}`, etiqueta: `Grupo ${i}`, valores: [i] })),
  totales: [filas], fuera: 0, clase,
});

test('el saneo: un gráfico del catálogo con su resultado pasa; lo que no calza se descarta entero', () => {
  const g = grafico();
  const b = { t: 'grafico', titulo: 'Leads del mes', nota: '1 – 20 oct', grafico: g, resultado: resultado(3) };
  assert.deepEqual(sanearBloque(b), b);
  assert.equal(sanearBloque({ ...b, grafico: { ...g, fuente: 'inventada' } }), null, 'un conjunto que no existe');
  assert.equal(sanearBloque({ ...b, resultado: { ...resultado(3), filas: [{ clave: 'a', etiqueta: 'A', valores: [1, 2] }] } }), null, 'valores de otro largo');
  assert.equal(sanearBloque({ ...b, abrir: { titulo: 'Abrir', href: 'https://otro.com' } }), null, 'un link de afuera');
  assert.equal(sanearBloque({ ...b, titulo: '' }), null);
});

test('acotado: hasta 60 filas, y lo que no entra se cuenta', () => {
  const r = sanearResultado(resultado(75));
  assert.ok(r);
  assert.equal(r.filas.length, MAX_FILAS_GRAFICO);
  assert.equal(r.fuera, 75 - MAX_FILAS_GRAFICO);
  // Lo que el hilo no usa (ids de leads, fotos de afuera) no se guarda.
  const conRef = sanearResultado({ ...resultado(1), filas: [{ clave: 'a', etiqueta: 'Ana', valores: [1], ref: 'lead:12', imagen: 'https://fb.com/x.jpg' }] });
  assert.deepEqual(conRef?.filas[0], { clave: 'a', etiqueta: 'Ana', valores: [1] });
});

/** 90 días seguidos desde el 23/07/2026, como los arma `agregar` para «leads por día de los últimos 90 días». */
const noventaDias = (alReves = false): Resultado => {
  const dia = (i: number) => new Date(Date.UTC(2026, 6, 23 + i)).toISOString().slice(0, 10);
  const filas = Array.from({ length: 90 }, (_, i) => ({ clave: dia(i), etiqueta: dia(i).slice(5), valores: [i] }));
  const orden = alReves ? [...filas].reverse() : filas;
  return {
    columnas: [{ id: 'leads', nombre: 'Leads', formato: 'numero' }], filas: orden, totales: [90], fuera: 0, clase: 'tiempo',
    cruce: { claves: ['meta'], celdas: orden.map((f) => [f.valores[0]]) },
  };
};

test('una serie de tiempo que no entra dibuja los 60 puntos MÁS NUEVOS, y la nota dice ese tramo', () => {
  const r = sanearResultado(noventaDias());
  assert.ok(r);
  assert.equal(r.filas.length, MAX_FILAS_GRAFICO);
  assert.equal(r.filas[0].clave, '2026-08-22', 'arranca 60 días antes del último');
  assert.equal(r.filas.at(-1)?.clave, '2026-10-20', 'y llega al último día: el tramo más reciente no se esconde');
  assert.equal(r.fuera, 30);
  assert.deepEqual(r.cruce?.celdas.map((c) => c[0]), r.filas.map((f) => f.valores[0]), 'el desglose, cortado igual que las filas');
  // Con la tabla al revés (la más nueva arriba), las más nuevas son las primeras.
  const desc = sanearResultado(noventaDias(true));
  assert.equal(desc?.filas[0].clave, '2026-10-20');
  assert.equal(desc?.filas.at(-1)?.clave, '2026-08-22');
  // El runner corta ANTES de armar el bloque (`cortarTiempo`, con la misma función), y la nota dice el tramo cortado.
  const cortado = cortarTiempo(noventaDias());
  assert.deepEqual(cortado.filas.map((f) => f.clave), r.filas.map((f) => f.clave), 'el runner y el saneo cortan igual');
  assert.equal(cortado.fuera, 30);
  assert.deepEqual(sanearResultado(cortado)?.filas.map((f) => f.clave), r.filas.map((f) => f.clave), 'lo ya cortado, el saneo no lo vuelve a cortar');
  assert.deepEqual(rangoDeTramo('dia', cortado.filas, '2026-07-23', '2026-10-20'), { desde: '2026-08-22', hasta: '2026-10-20' });
  assert.equal(cortarTiempo(resultado(75)).filas.length, 75, 'por categoría corta el saneo, con su «N más»');
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  assert.match(run, /const rDib = cortarTiempo\(r, MAX_FILAS_GRAFICO, fechaDef\?\.futuro \? hoy : null\);/);
  assert.match(run, /rangoTexto\(tramo\?\.desde \?\? per\.desde, tramo\?\.hasta \?\? hasta\)/, 'la nota dice el tramo dibujado');
  assert.match(run, /grafico: graficoParaElChat\(\{ \.\.\.principal, titulo \}, rDib\), resultado: rDib,/, 'se dibuja lo cortado');
  // Y abajo, una serie cuenta lo que quedó afuera del tramo (puede ser de antes o de después); una tabla ya dice «+N más».
  const pieza = leer('app/_chat/bloques/GraficoHilo.tsx');
  assert.match(pieza, /\{!tabla && b\.resultado\.fuera > 0 && <p className="ch-grafico__nota">\{b\.resultado\.clase === 'tiempo' \? `Y \$\{b\.resultado\.fuera\} puntos fuera de este tramo` : `Y \$\{b\.resultado\.fuera\} más`\}<\/p>\}/);
});

/** Días seguidos desde `desde`, con valores 0, 1, 2…: lo que arma `agregar` para un gráfico por día. */
const dias = (desde: string, n: number): Resultado => {
  const dia = (i: number) => new Date(Date.parse(`${desde}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
  const filas = Array.from({ length: n }, (_, i) => ({ clave: dia(i), etiqueta: dia(i).slice(5), valores: [i] }));
  return { columnas: [{ id: 'pendiente', nombre: 'Pendiente', formato: 'usd' }], filas, totales: [n], fuera: 0, clase: 'tiempo' };
};

test('con una fecha que mira hacia ADELANTE (el vencimiento), el corte toma lo más CERCANO a hoy: lo que vence hoy entra', () => {
  // La tercera revisión: «¿qué me vence en los próximos 30 días, día por día?» leía del 26/10 al 19/11 (las 25 más
  // «nuevas») y perdía lo que vence HOY y en los 4 días siguientes. Por WhatsApp es lo único que lee el modelo.
  const HOY = '2026-10-21';
  const g = sanearComponente({
    clase: 'grafico', id: 'q0', x: 0, y: 0, w: 6, h: 4, tipo: 'tabla', fuente: 'pagos', metricas: ['pendiente'], dimension: 'dia', desglose: null,
    fecha: 'vencimiento', controles: [], periodo: 'prox30', desde: '', hasta: '', titulo: 'Vencimientos',
  }) as Grafico;
  assert.equal(g.fecha, 'vencimiento');
  const prox30 = dias(HOY, 30);
  const md = resultadoMarkdown(g, prox30, { desde: HOY, hasta: '2026-11-19', topeFilas: 25, hoy: HOY });
  const leidas = md.filter((l) => l.startsWith('|') && !l.startsWith('|-')).slice(1).map((l) => l.split('|')[1].trim());
  assert.equal(leidas[0], '10-21', 'arranca HOY');
  assert.equal(leidas.length, 25);
  assert.ok(md.includes('(y 5 filas después)'), 'lo que no lee es lo de DESPUÉS, y lo dice');
  // El gráfico corta con la MISMA función: los 60 más cercanos de 90 días por venir arrancan hoy.
  const noventa = cortarTiempo(dias(HOY, 90), MAX_FILAS_GRAFICO, HOY);
  assert.equal(noventa.filas[0].clave, HOY);
  assert.equal(noventa.fuera, 30);
  // «Este mes» por vencimiento (del 1 al 31): la ventana incluye hoy y llena el tope hacia atrás.
  const mes = resultadoMarkdown(g, dias('2026-10-01', 31), { desde: '2026-10-01', hasta: '2026-10-31', topeFilas: 25, hoy: HOY });
  const delMes = mes.filter((l) => l.startsWith('|') && !l.startsWith('|-')).slice(1).map((l) => l.split('|')[1].trim());
  assert.ok(delMes.includes('10-21'), 'hoy está en lo que lee el modelo');
  assert.equal(delMes.at(-1), '10-31');
  assert.ok(mes.includes('(y 6 filas antes)'));
  // Sin `futuro` (una fecha que mira hacia atrás) sigue lo más nuevo.
  const altas = resultadoMarkdown(grafico({ dimension: 'dia' }), dias('2026-09-21', 31), { desde: '2026-09-21', hasta: HOY, topeFilas: 25, hoy: HOY });
  assert.ok(altas.includes('(y 6 filas antes)'));
});

test('qué se dibuja: un número; con el tiempo, una serie; por categoría, barras o tabla; con desglose, columnas', () => {
  assert.equal(graficoParaElChat(grafico({ tipo: 'numero' }), resultado(0, null)).tipo, 'numero');
  assert.equal(graficoParaElChat(grafico({ dimension: 'mes' }), resultado(6, 'tiempo')).tipo, 'serie');
  assert.equal(graficoParaElChat(grafico({ dimension: 'origen' }), resultado(5)).tipo, 'barras');
  assert.equal(graficoParaElChat(grafico({ dimension: 'origen' }), resultado(20)).tipo, 'tabla');
  assert.equal(graficoParaElChat(grafico({ tipo: 'columnas', dimension: 'mes', desglose: 'origen' }), resultado(6, 'tiempo')).tipo, 'columnas');
});

test('lo que lee el modelo es el MISMO tramo que se dibuja: sus filas están en el gráfico y llegan al último día', () => {
  // La revisión de 17c0317b2: el gráfico dibujaba del 22/08 al 20/10 y el texto del modelo (25 filas) iba del 23/07 al
  // 16/08. Cero filas en común, y encima se le decía «ya ve los últimos 60 puntos: comenta lo que importa».
  const g = grafico({ dimension: 'dia' });
  const r = noventaDias();
  const b = sanearBloque({ t: 'grafico', titulo: 'Leads por día', grafico: graficoParaElChat(g, r), resultado: r }) as { resultado: Resultado } | null;
  assert.ok(b);
  const dibujadas = b.resultado.filas.map((f) => f.etiqueta);
  const md = resultadoMarkdown(g, r, { desde: '2026-07-23', hasta: '2026-10-20', topeFilas: 25 });
  // Las filas de la tabla markdown, sin la cabecera ni el separador: «| etiqueta | desglose | Total |».
  const tablaMd = md.filter((l) => l.startsWith('|') && !l.startsWith('|-')).slice(1).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
  assert.equal(tablaMd.length, 25);
  const leidas = tablaMd.map((c) => c[0]);
  assert.deepEqual(leidas.filter((e) => !dibujadas.includes(e)), [], 'toda fila que lee el modelo está dibujada');
  assert.equal(leidas.at(-1), dibujadas.at(-1), 'y llega al último día, el mismo que el gráfico');
  assert.ok(md.includes('(y 65 filas antes)'), 'lo que no lee es lo de ANTES, y lo dice');
  // El desglose, alineado con su fila después del corte (acá cada celda vale lo que la fila).
  assert.deepEqual(tablaMd.filter((c) => c[1] !== c[2]), [], 'cada celda del desglose es la de su fila');
  // Una tabla de varias métricas cortada va sin la fila Total: la nota dice 60 días y el Total sumaba los 90.
  const dos = grafico({ dimension: 'dia', metricas: ['leads', 'agendas'] });
  assert.equal(graficoParaElChat(dos, r).total, false);
  assert.equal(graficoParaElChat(dos, resultado(30, 'tiempo')).total, true, 'la que entra entera, con su Total');
});

test('la lectura devuelve { content, bloque }: el bloque va por ctx.aDibujar y el modelo lee sólo el texto', () => {
  const run = leer('lib/api-mako/areas/dashboard.run.ts');
  const c = run.slice(run.indexOf('consultar_datos_dashboard: {'), run.indexOf('listar_informes_dashboard: {'));
  assert.match(c, /if \(http\) return md;/);
  // Sin el canal de dibujo (WhatsApp, HTTP) va el texto, sin el aviso de que la persona ya lo ve.
  assert.match(c, /if \(!ctx\.aDibujar \|\| al\.graficos\.length !== 1\) return texto;/);
  // «Ya lo ve» NO va en `content`: va aparte (`siSeDibuja`) y lo suma ejecutarOperacion sólo si se dibujó.
  assert.match(c, /return \{ content: texto, bloque, siSeDibuja: `\(La persona YA VE \$\{ve\} dibujado en el chat: [^`]*` \};/);
  assert.doesNotMatch(c, /content: `\$\{texto\}[^`]*YA VE/, 'el aviso pegado al texto se dice aunque no se dibuje');
  assert.doesNotMatch(c, /J\(\{ bloque/, 'el bloque metido en el texto lo leería el modelo');
  // El marco (Ops Center 3, 061c1b74d) lo sanea y lo dibuja sólo si hay por dónde, y el modelo recibe `content`.
  const ej = leer('lib/api-mako/ejecutar.ts');
  assert.match(ej, /const bloque = cruda\.bloque && ctx\.aDibujar \? sanearBloque\(cruda\.bloque\) : null;/);
  // Y el saneo del marco conoce el tipo `grafico`.
  assert.ok(sanearBloque({ t: 'grafico', titulo: 'Leads', grafico: grafico(), resultado: resultado(2) }));
});

test('«ya lo ve» llega al modelo SÓLO si el bloque se dibujó: no con el tope lleno, ni descartado, ni sin canal', () => {
  const r = JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_dashboard-dibujado-hijo.ts')], {
    cwd: RAIZ, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
  })) as { acepta: string; callado: string; rechaza: string; sinCanal: string; descartado: string; dibujados: number; aviso: string; red: string[] };
  assert.deepEqual(r.red, [], 'nada sale a la red');
  assert.equal(r.acepta, `la tabla\n\n${r.aviso}`, 'dibujado: el modelo sabe que la persona lo ve');
  assert.equal(r.callado, `la tabla\n\n${r.aviso}`, 'un canal que no contesta (`void`) dibujó');
  assert.equal(r.rechaza, 'la tabla', 'con el tope de bloques del turno lleno, no');
  assert.equal(r.sinCanal, 'la tabla', 'en WhatsApp o por HTTP, no');
  assert.equal(r.descartado, 'la tabla', 'un bloque que el saneo tira, no');
  assert.equal(r.dibujados, 1, 'el descartado no llegó al canal');
  // El turno de la app dice `false` cuando el tope está lleno (el repetido ya está en pantalla: `true`).
  const turno = leer('lib/mako-turno-app.ts');
  assert.match(turno, /const dibujar = \(b: Bloque\): boolean => \{\s*if \(bloquesDelTurno\.some\(\(x\) => JSON\.stringify\(x\.b\) === JSON\.stringify\(b\)\)\) return true;\s*const accion = porId\(herramientaActual\)\?\.tipo !== 'lectura';\s*if \(!entraOtroDibujo\(bloquesDelTurno, accion, MAX_BLOQUES_MENSAJE\)\) return false;/);
});

test('con 4 gráficos y una pregunta, el cuarto NO se anuncia: todo lo que «ya lo ve» llega al mensaje', () => {
  // La tercera revisión: `dibujar` aceptaba 4 lecturas (las 4 leían «ya lo ve») y `bloquesDelMensaje` recortaba la cuarta
  // para hacerle lugar a la pregunta. Se decide al dibujar, con lo que va a quedar.
  const enTurno = (accion: boolean, n: number) => {
    const turno: { accion: boolean; i: number }[] = [];
    const dijo: boolean[] = [];
    for (let i = 0; i < n; i++) {
      const entra = entraOtroDibujo(turno, accion, MAX_BLOQUES_MENSAJE);
      dijo.push(entra);
      if (entra) turno.push({ accion, i });
    }
    return { turno, dijo };
  };
  const lecturas = enTurno(false, 5);
  assert.deepEqual(lecturas.dijo, [true, true, true, false, false], 'la cuarta lectura ya no lee «ya lo ve»');
  const conPregunta = bloquesDelMensaje(lecturas.turno.map((x) => `g${x.i}`), 'pregunta', MAX_BLOQUES_MENSAJE);
  assert.deepEqual(conPregunta, ['g0', 'g1', 'g2', 'pregunta'], 'toda lectura aceptada se ve, con la pregunta');
  // Lo de una acción llega hasta el tope (con una pregunta se retira entero).
  assert.deepEqual(enTurno(true, 5).dijo, [true, true, true, true, false]);
  // Una lectura después de 3 acciones: entra (sin pregunta se ven las 4; con pregunta, las acciones se retiran).
  assert.equal(entraOtroDibujo([{ accion: true }, { accion: true }, { accion: true }], false, MAX_BLOQUES_MENSAJE), true);
});

test('el hilo lo dibuja con la pieza del Dashboard, cargada aparte', () => {
  const hilo = leer('app/_chat/BloqueHilo.tsx');
  assert.match(hilo, /const GraficoHilo = dynamic\(\(\) => import\('\.\/bloques\/GraficoHilo'\), \{\s*ssr: false,/);
  // Con su red: el pedazo que no carga tira al dibujar el Lazy, y sin red subía a app/error.tsx (la pantalla entera).
  assert.match(hilo, /if \(b\.t === 'grafico'\) return <RedDeBloque nombre=\{b\.titulo\} reiniciarCon=\{\[b\]\}><GraficoHilo b=\{b\} \/><\/RedDeBloque>;/);
  assert.match(hilo, /import \{ RedDeBloque \} from '@\/app\/dashboard\/RedDeBloque';/);
  const pieza = leer('app/_chat/bloques/GraficoHilo.tsx');
  assert.match(pieza, /import \{ CuerpoGrafico, esTarjetaNumero \} from '@\/app\/dashboard\/Grafico';/);
  // Y el dibujo adentro de otra, que deja el título y el link en pie (un bloque guardado que tira, tiraría cada vez).
  assert.match(pieza, /<RedDeBloque nombre=\{b\.titulo\} reiniciarCon=\{\[b\]\}>\s*<CuerpoGrafico g=\{b\.grafico\} estado=\{\{ cargando: false, resultado: b\.resultado \}\} tema=\{TEMA\} \/>\s*<\/RedDeBloque>/);
  assert.match(pieza, /<Link className="ch-abrir" href=\{b\.abrir\.href\}>/, 'el link va por Link (le suma el ?ws=)');
});
