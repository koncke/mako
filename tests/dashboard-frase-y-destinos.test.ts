// =============================================================================
// La oración de apertura y el «Ver … →» del pie de un bloque (4/11/2026)
// =============================================================================
// Correr: node --import tsx --test tests/dashboard-frase-y-destinos.test.ts
//
// Todo EJECUTA el código: la frase se arma con `tramosDeFrase`, el destino pasa por el saneo de verdad (`sanearGrafico`),
// la composición por `comoDenso` y el pedido de la API por `armarGrafico`.
//
// Probado rompiéndolo (base 11/0):
//   · `tramosDeFrase` escribiendo «—» donde falta un dato (en vez de sacar el tramo) → 4 rojos. Sacar sólo el `break` no
//     rompe nada: la llave cruda que queda la saca la segunda guarda del tramo, y eso es a propósito.
//   · `sanearGrafico` copiando `o.ir` sin `destinoDe` → 1 rojo (el destino inventado sobrevive).
//   · `comoDenso` sin poner la frase primero → 1 rojo (la frase cae donde el molde ponga al principal).
//   · `armarGrafico` sin validar las llaves de la frase → 1 rojo (una llave que no es métrica entra).
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { cambioEnPalabras, fraseDeEntrada, fraseEnTexto, metricasDeFrase, tramosDeFrase } from '../lib/graficos-frase';
import { DESTINOS_GRAFICO, destinoDe } from '../lib/graficos-destinos';
import { sanearGrafico, tipoDe } from '../lib/graficos-catalogo';
import { ALTO_FRASE, comoDenso } from '../lib/graficos-portadas';
import { armarGrafico } from '../lib/api-mako/areas/dashboard.helpers';
import { hojaDestino } from '../lib/graficos-plantillas';

const COLS = [{ id: 'cobrado', nombre: 'Cobrado' }, { id: 'agendas', nombre: 'Agendas' }, { id: 'cierres', nombre: 'Cierres' }];
const texto = (patron: string | undefined, valores: Array<string | null>, cambios: Array<string | null> = []) =>
  fraseEnTexto(tramosDeFrase(patron, COLS, (i) => valores[i] ?? null, (i) => cambios[i] ?? null));

test('la frase escribe los números adentro del patrón, tramo por tramo', () => {
  assert.equal(
    texto('Entraron {cobrado} · {agendas} agendas · {cierres} cierres', ['US$12.400', '48', '7']),
    'Entraron US$12.400 · 48 agendas · 7 cierres',
  );
  const tramos = tramosDeFrase('Entraron {cobrado}', COLS, () => 'US$1', () => null);
  assert.deepEqual(tramos, [[{ texto: 'Entraron ' }, { texto: 'US$1', numero: true }]], 'el número va marcado para resaltarlo');
});

test('un tramo sin dato no se dice; un cero sí (es una medición)', () => {
  assert.equal(texto('Entraron {cobrado} · {agendas} agendas · {cierres} cierres', ['US$12.400', null, '0']), 'Entraron US$12.400 · 0 cierres');
  assert.equal(texto('{agendas} agendas', [null, null, null]), '');
});

test('{x:cambio} dice cuánto cambió; sin período anterior, el tramo se va', () => {
  assert.equal(texto('{cobrado} este mes · {cobrado:cambio} que el anterior', ['US$100'], ['18% más']), 'US$100 este mes · 18% más que el anterior');
  assert.equal(texto('{cobrado} este mes · {cobrado:cambio} que el anterior', ['US$100'], [null]), 'US$100 este mes');
  assert.equal(cambioEnPalabras(118, 100), '18% más');
  assert.equal(cambioEnPalabras(94, 100), '6% menos');
  assert.equal(cambioEnPalabras(100, 100), 'igual');
  assert.equal(cambioEnPalabras(100, 0), null, 'dividir por cero no es un dato');
  assert.equal(cambioEnPalabras(null, 100), null);
});

test('una llave que no es una métrica del gráfico no queda cruda: el tramo se va', () => {
  assert.equal(texto('{cobrado} · {inventada} algo · {Cobrado} mal', ['US$1']), 'US$1');
  assert.deepEqual(metricasDeFrase('Entraron {cobrado} · {cobrado:cambio} · {agendas}'), ['cobrado', 'agendas']);
});

test('sin patrón, la frase se arma sola con sus métricas', () => {
  assert.equal(fraseDeEntrada(COLS.slice(0, 2)), '{cobrado} cobrado · {agendas} agendas');
  assert.equal(texto(undefined, ['US$1', '2']), 'US$1 cobrado · 2 agendas');
});

test('el tipo frase existe en el catálogo y sólo él guarda su patrón', () => {
  const t = tipoDe('frase');
  assert.ok(t && t.dimension === 'ninguna' && t.maxMetricas === 4);
  const g = sanearGrafico({ id: 'f1', clase: 'grafico', tipo: 'frase', fuente: 'negocio', metricas: ['cobrado', 'agendas'], frase: 'Entraron {cobrado}', titulo: 'Cómo viene el mes' })!;
  assert.equal(g.tipo, 'frase');
  assert.equal(g.frase, 'Entraron {cobrado}');
  const numero = sanearGrafico({ id: 'n1', clase: 'grafico', tipo: 'numero', fuente: 'negocio', metricas: ['cobrado'], frase: 'Entraron {cobrado}' })!;
  assert.equal(numero.frase, undefined, 'sólo la frase guarda su patrón');
});

test('el destino del pie: sólo uno de la lista; lo demás se tira en el saneo', () => {
  const con = (ir: unknown) => sanearGrafico({ id: 'g1', clase: 'grafico', tipo: 'numero', fuente: 'leads', metricas: ['leads'], ir });
  assert.equal(con('crm')!.ir, 'crm');
  assert.equal(con('https://otro.com')!.ir, undefined);
  assert.equal(con('/crm')!.ir, undefined, 'un camino suelto no es un destino: lo escribe la tabla');
  assert.equal(destinoDe('inventado'), null);
  assert.equal(new Set(DESTINOS_GRAFICO.map((d) => d.id)).size, DESTINOS_GRAFICO.length, 'ids sin repetir');
});

test('cada destino es una pantalla que existe', () => {
  for (const d of DESTINOS_GRAFICO) {
    assert.ok(d.ruta.startsWith('/') && !d.ruta.startsWith('//'), `${d.id}: sólo caminos de MaKo`);
    const carpeta = d.ruta.split('?')[0];
    assert.ok(existsSync(join(__dirname, '..', 'app', carpeta, 'page.tsx')), `${d.id}: ${carpeta} no tiene page.tsx`);
    assert.ok(d.rotulo.startsWith('Ver '), `${d.id}: el rótulo dice a dónde va`);
  }
});

test('la composición densa abre con la frase a lo ancho, y los paneles conservan su subtítulo', () => {
  const hoja = {
    componentes: [
      { id: 'n1', clase: 'grafico', tipo: 'numero_tendencia', subtitulo: 'no va', x: 0, y: 0, w: 3, h: 4 },
      { id: 'serie', clase: 'grafico', tipo: 'serie', subtitulo: 'Lo cobrado por día', x: 0, y: 4, w: 12, h: 8 },
      { id: 'frase', clase: 'grafico', tipo: 'frase', x: 0, y: 30, w: 12, h: 3 },
    ],
  };
  const out = comoDenso(hoja, undefined, (l) => l).componentes as Array<Record<string, unknown>>;
  const de = (id: string) => out.find((c) => c.id === id)!;
  assert.deepEqual([de('frase').x, de('frase').y, de('frase').w, de('frase').h], [0, 0, 12, ALTO_FRASE]);
  assert.ok(out.filter((c) => c.id !== 'frase').every((c) => Number(c.y) >= ALTO_FRASE), 'nada se dibuja encima de la frase');
  assert.equal(de('serie').subtitulo, 'Lo cobrado por día');
  assert.equal(de('n1').subtitulo, '', 'un número no lleva subtítulo: le come el alto');
});

test('la API arma la frase y el pie validando lo que dicen', () => {
  const ok = armarGrafico({ tipo: 'frase', conjunto: 'negocio', metricas: ['cobrado', 'agendas'], frase: 'Entraron {cobrado} · {agendas} agendas', ir: 'crm' }, null);
  assert.ok(ok.ok);
  if (ok.ok) { assert.equal(ok.grafico.frase, 'Entraron {cobrado} · {agendas} agendas'); assert.equal(ok.grafico.ir, 'crm'); }
  const llave = armarGrafico({ tipo: 'frase', conjunto: 'negocio', metricas: ['cobrado'], frase: 'Entraron {gasto}' }, null);
  assert.equal(llave.ok, false, 'una llave que no es métrica del gráfico se rechaza');
  const destino = armarGrafico({ tipo: 'numero', conjunto: 'negocio', metricas: ['cobrado'], ir: 'otro-lado' }, null);
  assert.equal(destino.ok, false, 'un destino que no existe se rechaza');
  const enOtro = armarGrafico({ tipo: 'numero', conjunto: 'negocio', metricas: ['cobrado'], frase: 'x {cobrado}' }, null);
  assert.equal(enOtro.ok, false, 'sólo la frase lleva frase');
});

test('abrir una plantilla reemplazada vuelve a la hoja que ya nació de ella', () => {
  // `whatsapp` se reemplazó por `chat-analyst`: quien ya tenía una hoja nacida de `whatsapp` vuelve a ésa.
  const vieja = { id: 'h-vieja', nombre: 'WhatsApp', emoji: '', subtitulo: '', controles: [], componentes: [], plantilla: 'whatsapp' };
  const nueva = { id: 'h-nueva', nombre: 'Chat', emoji: '', subtitulo: '', controles: [], componentes: [], plantilla: 'chat-analyst' };
  const t = { v: 3, nombre: 'Dashboard', hojas: [nueva, vieja] } as never;
  assert.equal(hojaDestino(t, 'whatsapp').hojaId, 'h-vieja');
  assert.equal(hojaDestino(t, 'chat-analyst').hojaId, 'h-nueva');
});

test('con «1» la palabra que sigue va en singular: «1 persona», «1 agendó» (11/11/2026, Landing en el teléfono)', () => {
  const cols = [{ id: 'visitas', nombre: 'Visitas' }, { id: 'personas', nombre: 'Personas' }, { id: 'agendas', nombre: 'Agendas' }] as never;
  const escrito = (vals: Record<number, string>) => fraseEnTexto(tramosDeFrase('Entraron {visitas} visitas de {personas} personas · {agendas} agendaron', cols, (i) => vals[i] ?? null, () => null));
  assert.equal(escrito({ 0: '3', 1: '1', 2: '1' }), 'Entraron 3 visitas de 1 persona · 1 agendó');
  assert.equal(escrito({ 0: '1', 1: '2', 2: '11' }), 'Entraron 1 visita de 2 personas · 11 agendaron', '«11» no es «1»');
});
