// =============================================================================
// Las plantillas del Dashboard SIN BLOQUES (tanda v5, 12/10/2026, puntos 6, 20, 21 y 22)
// =============================================================================
// Lo que fija, sobre TODAS las plantillas (el informe inicial, las de Analysts, las generales y las de pop-up):
//   · Ninguna trae un bloque (`clase: 'bloque'`), ni en la hoja ni adentro de un pop-up. Los bloques se fueron
//     (Martín, punto 6: «no quiero tener cosas "no editables"»): una plantilla con uno lo perdería en el saneo
//     (`sanearComponente` tira la clase) y la hoja nacería con un hueco.
//   · Cada gráfico pasa el saneo SIN cambiar de conjunto, tipo, métricas, dimensión, desglose ni fecha (tampoco
//     uno de un pop-up). El saneo CORRIGE en silencio: una métrica mal escrita no da error, se cambia por la
//     primera que haya y la tarjeta muestra OTRO número con el título de éste.
//   · Lo que DEFINE una tarjeta (R1/R2, «Sin agendas», «Muestra chica», «Activo», «Entrega del servicio», las
//     cohortes maduras) va como filtro FIJO, y el período propio también, salvo los que miran hacia adelante y
//     van a la vista (el Outstanding y «A quién cobrarle», decisión de la tanda).
//   · Ningún nombre de un cliente real (AGENTS.md: un ejemplo de pantalla es ficticio por regla).
//   · Cada pieza de una ficha existe en PIEZAS_ENTIDAD y cada botón en ACCIONES_ELEMENTO (una pieza con un id que
//     no existe dibuja «Una pieza que ya no existe»; un botón sin acción, el saneo lo tira).
//   · Una caja de IA lee gráficos que ESTÁN en su hoja (si no, el saneo los poda y lee «ninguno»), y cada hoja
//     nueva (VSL, CS, Chat) trae la suya.
//   · Nadie se pisa en la grilla, ni en un pop-up; cada hoja dice de qué plantilla nació; «analyst» encuentra las
//     siete hojas de Analysts.
// Correr: npx tsx --test tests/graficos-plantillas-v5.test.ts
//
// PROBADO ROMPIÉNDOLO (12/10/2026; base en verde: 9 pasan, 0 fallan). Una rotura por vez, con un arnés que
// restaura DE MEMORIA y compara el hash (nunca con git), y que se niega si el fragmento roto ya existe afuera;
// pasan / fallan:
//   · Comercial con un `{ clase: 'bloque', bloque: 'revenue' }` de vuelta                     -> 7 / 2 «ninguna… bloque» y
//     «…SIN cambiar…» (el saneo lo MIGRA a cinco piezas: la hoja ya no tiene los componentes que se escribieron)
//   · `hook_rat` en vez de `hook_rate` en una tarjeta de Ads Analyst                          -> 8 / 1 «…SIN cambiar…»
//   · `cobrado` en `envios` en la general «Automatizaciones»                                  -> 8 / 1 «…SIN cambiar…»
//   · el filtro de «Gasto sin retorno» sin `fijo`                                              -> 8 / 1 «lo que DEFINE…»
//   · el Outstanding con su período fijo (no a la vista)                                       -> 8 / 1 «lo que DEFINE…»
//   · «Clientes de Mauricio» como título de la tabla de CS Analyst                             -> 8 / 1 «ningún nombre…»
//   · la pieza `resumne` en el pop-up «Llamada»                                                -> 8 / 1 «cada pieza…»
//   · la caja de Closing leyendo `cl-factores` (un id que no está)                             -> 8 / 1 «una caja de IA…»
//   · la grabación del pop-up «Llamada» un renglón arriba (y: 3 → 2, pisa la cabecera)         -> 8 / 1 «nadie se pisa…»
//   · Landing sin `buscar`                                                                     -> 8 / 1 «"analyst"…»
//   · `instanciarPlantilla` sin `plantilla: p.id`                                              -> 8 / 1 «cada hoja dice…»
//   · VSL Analyst sin su caja de IA                                                            -> 8 / 1 «una caja de IA…»
// ⚠️ La primera corrida de este paquete (cortada por el límite de sesión) dejó este encabezado escrito con «10 pasan»
//    y «9 / 1» ANTES de correr una sola rotura: el archivo tiene 9 tests. Un número de rotura sale del arnés, no del
//    plan; uno que no cuadra con la cantidad de tests es la señal.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COLS, MAX_IA_POR_HOJA, MAX_POPUP, sanearGrafico, sanearHoja, sanearTablero,
  type Componente, type ControlVista,
} from '../lib/graficos-catalogo';
import {
  PLANTILLAS_HOJA, PLANTILLAS_POPUP, informeDeRol, instanciarPlantilla, popupDeEntidad, tableroInicial,
} from '../lib/graficos-plantillas';
import { DEFINICIONES_GENERALES, filtrarPlantillasHoja } from '../lib/graficos-plantillas-generales';
import { ACCIONES_ELEMENTO, PIEZAS_ENTIDAD } from '../lib/graficos-acciones';

type Crudo = Record<string, unknown> & {
  id: string; clase?: string; tipo?: string;
  controles?: Array<Record<string, unknown>>;
  popup?: { titulo: string; componentes: Crudo[] };
  ia?: { fuentes: string[] | null };
  entidad?: { tipo: string; pieza: string };
  accion?: { id: string };
};
type HojaCruda = { id: string; controles: Crudo[]; componentes: Crudo[] };

/** Cada plantilla armada con sus ids FIJOS, cruda (lo que sale de `armar`, antes del saneo). */
const CRUDAS: ReadonlyArray<{ id: string; hoja: HojaCruda }> = PLANTILLAS_HOJA.map((p) => ({ id: p.id, hoja: p.armar((l) => l) as HojaCruda }));
/** Los pop-ups de cada plantilla de pop-up, crudos. */
const POPUPS: ReadonlyArray<{ id: string; componentes: Crudo[] }> = Object.values(PLANTILLAS_POPUP).map((p) => ({ id: p.id, componentes: p.armar((l) => l).componentes as Crudo[] }));

/** Los componentes crudos de una hoja y los de sus pop-ups, con dónde viven (para el mensaje). */
function todos(h: HojaCruda): Array<{ donde: string; c: Crudo }> {
  return h.componentes.flatMap((c) => [{ donde: h.id, c }, ...(c.popup?.componentes ?? []).map((x) => ({ donde: `${h.id}/${c.id}(pop-up)`, c: x }))]);
}

test('ninguna plantilla trae un bloque, ni en la hoja ni adentro de un pop-up', () => {
  const con: string[] = [];
  for (const { hoja } of CRUDAS) for (const { donde, c } of todos(hoja)) if (c.clase === 'bloque' || 'bloque' in c) con.push(`${donde}/${c.id}`);
  for (const p of POPUPS) for (const c of p.componentes) if (c.clase === 'bloque' || 'bloque' in c) con.push(`pop-up ${p.id}/${c.id}`);
  assert.deepEqual(con, [], 'una plantilla trae un bloque: el saneo lo tira y la hoja nace con un hueco');
  // Y después del saneo (lo que la pantalla recibe), tampoco.
  for (const p of PLANTILLAS_HOJA) assert.ok(!instanciarPlantilla(p).componentes.some((c) => c.clase === 'bloque'), p.id);
});

/** Lo que el saneo no puede cambiar de un gráfico de una plantilla sin que la tarjeta muestre OTRA cosa. */
function mismoGrafico(donde: string, c: Crudo, s: Componente | undefined): void {
  assert.ok(s && s.clase === 'grafico', `${donde}/${c.id}: no es un gráfico después del saneo (¿conjunto que no existe?)`);
  assert.equal(s.fuente, c.fuente, `${donde}/${c.id}: cambió el conjunto`);
  assert.equal(s.tipo, c.tipo, `${donde}/${c.id}: cambió el tipo (¿no admite ese conjunto?)`);
  assert.deepEqual(s.metricas, c.metricas, `${donde}/${c.id}: el saneo le cambió las métricas (una no es del conjunto o no sirve para el tipo)`);
  if (c.dimension !== undefined) assert.equal(s.dimension, c.dimension, `${donde}/${c.id}: cambió la dimensión`);
  if (c.desglose !== undefined) assert.equal(s.desglose, c.desglose, `${donde}/${c.id}: cambió el desglose`);
  if (c.fecha !== undefined) assert.equal(s.fecha, c.fecha, `${donde}/${c.id}: cambió la fecha`);
  for (const k of ['ordenMetrica', 'barra', 'secundaria', 'colorPor', 'alClic'] as const) {
    if (c[k] !== undefined) assert.equal(s[k], c[k], `${donde}/${c.id}: se perdió ${k}`);
  }
  if (c.tabla !== undefined) assert.deepEqual(s.tabla, c.tabla, `${donde}/${c.id}: se perdió una opción de la tabla (¿una columna que no es del conjunto?)`);
  const ks = c.controles ?? [];
  assert.equal(s.controles.length, ks.length, `${donde}/${c.id}: se perdió un control (¿el campo existe?)`);
  for (const k of ks) {
    // El tipo va escrito: con la narrowing del `assert.ok` de arriba, tsc no lo infiere (TS7022).
    const sk: ControlVista | undefined = s.controles.find((x: ControlVista) => x.id === k.id);
    assert.ok(sk, `${donde}/${c.id}: el control ${String(k.id)} cambió de id`);
    assert.deepEqual(sk!.valores, k.valores ?? null, `${donde}/${c.id}: el control ${String(k.id)} perdió sus valores`);
    assert.equal(!!sk!.fijo, k.fijo === true, `${donde}/${c.id}: el control ${String(k.id)} perdió el «fijo»`);
  }
  if (c.popup) assert.equal(s.popup?.componentes.length, c.popup.componentes.length, `${donde}/${c.id}: el pop-up perdió piezas`);
}

test('cada gráfico de cada plantilla pasa el saneo SIN cambiar de conjunto, tipo, métricas, dimensión ni fecha (tampoco en un pop-up)', () => {
  let vistos = 0;
  for (const { id, hoja } of CRUDAS) {
    const h = sanearHoja(hoja, 0)!;
    assert.equal(h.componentes.length, hoja.componentes.length, `${id}: el saneo se comió un componente`);
    for (const c of hoja.componentes) {
      const s = h.componentes.find((x) => x.id === c.id);
      assert.ok(s, `${id}/${c.id}: el id fijo no pasa idValido (hasta 40, letras, números y guiones)`);
      if (c.clase === 'elemento') { assert.equal(s!.clase === 'elemento' && s.tipo, c.tipo, `${id}/${c.id}: cambió el elemento`); continue; }
      mismoGrafico(id, c, s); vistos++;
      for (const x of c.popup?.componentes ?? []) {
        const sx = s!.clase === 'grafico' ? s.popup?.componentes.find((y) => y.id === x.id) : undefined;
        assert.ok(sx, `${id}/${c.id}: la pieza ${x.id} del pop-up no sobrevivió al saneo`);
        if (x.clase !== 'elemento') { mismoGrafico(`${id}/${c.id}(pop-up)`, x, sx); vistos++; }
      }
    }
  }
  // Las generales se arman YA saneadas (`plantilla`, lib/graficos-plantillas-generales.ts): lo que se compara es
  // lo que escribió quien las armó (las piezas) contra lo que queda. (Las pasa además la puerta de la IA, en
  // tests/graficos-ia.test.ts.)
  for (const d of DEFINICIONES_GENERALES) {
    for (const p of d.piezas) {
      if (typeof p.seccion === 'string') continue;
      const { local, controles: _c, ...resto } = p;
      mismoGrafico(d.id, { ...resto, id: local, dimension: resto.dimension ?? undefined } as Crudo, sanearGrafico({ ...resto, id: local }) ?? undefined);
      vistos++;
    }
  }
  assert.ok(vistos > 120, `revisé ${vistos} gráficos: el recorrido no está mirando`);
});

test('lo que DEFINE una tarjeta va FIJO, y el período propio también salvo el que mira hacia adelante (a la vista)', () => {
  // Los dos que miran hacia ADELANTE con su período a la vista (decisión de la tanda v5).
  const VISIBLES: Readonly<Record<string, string>> = { 'co-revenue-pendiente': 'este_mes_completo', 'co-cobranza-tabla': 'este_mes_completo' };
  const malos: string[] = [];
  let fijos = 0;
  for (const { hoja } of CRUDAS) {
    for (const { donde, c } of todos(hoja)) {
      for (const k of (c.controles ?? []) as Array<Partial<ControlVista>>) {
        if (k.tipo === 'agrupar') continue;
        const visible = VISIBLES[c.id];
        if (k.tipo === 'periodo' && visible) { if (k.fijo || k.preset !== visible) malos.push(`${donde}/${c.id}: su período mira hacia adelante y va A LA VISTA (${visible})`); continue; }
        if (!k.fijo) malos.push(`${donde}/${c.id}: el control ${String(k.id)} (${String(k.tipo)}) define la tarjeta y no es fijo`);
        else fijos++;
      }
    }
  }
  assert.deepEqual(malos, []);
  // Los que el pedido nombra: R1/R2, «Sin agendas», «Muestra chica», «Activo»; y los de las hojas nuevas.
  const de = (hoja: string, comp: string) => CRUDAS.find((x) => x.id === hoja)!.hoja.componentes.find((c) => c.id === comp)?.controles ?? [];
  for (const [h, c] of [['closing', 'cl-r1'], ['closing', 'cl-r2'], ['ads-analyst', 'ad-sin-retorno'], ['ads-analyst', 'ad-muestra'], ['productividad', 'pr-avance-proyecto'], ['cs-analyst', 'cs-sesiones'], ['comercial', 'co-funnel-embudo']]) {
    assert.ok(de(h, c).some((k) => k.tipo === 'lista' && k.fijo === true), `${h}/${c}: sin su filtro de definición`);
  }
  assert.ok(fijos >= 25, `encontré ${fijos} controles fijos: el recorrido no está mirando`);
});

test('ningún nombre de un cliente real, en ninguna plantilla (tampoco en los pop-ups)', () => {
  const texto = JSON.stringify([CRUDAS, POPUPS, DEFINICIONES_GENERALES, PLANTILLAS_HOJA.map((p) => [p.nombre, p.linea, p.buscar ?? ''])]);
  for (const nombre of ['Mauricio', 'Bustos', 'Leila', 'Brigitte', 'Leandro', 'Ananda', 'Código Inmobiliario', 'Codigo Inmobiliario', 'Vértice', 'Vertice', 'Martín', 'Koncke']) {
    assert.ok(!texto.toLowerCase().includes(nombre.toLowerCase()), `una plantilla nombra a «${nombre}»`);
  }
});

test('cada pieza de una ficha existe en PIEZAS_ENTIDAD, y cada botón en ACCIONES_ELEMENTO', () => {
  const elementos = [
    ...CRUDAS.flatMap(({ hoja }) => todos(hoja)),
    ...POPUPS.flatMap((p) => p.componentes.map((c) => ({ donde: `pop-up ${p.id}`, c }))),
  ];
  let piezas = 0;
  for (const { donde, c } of elementos) {
    if (c.tipo === 'entidad' && c.clase === 'elemento') {
      const tipo = c.entidad!.tipo as keyof typeof PIEZAS_ENTIDAD;
      assert.ok(PIEZAS_ENTIDAD[tipo]?.some((x) => x.id === c.entidad!.pieza), `${donde}/${c.id}: la pieza «${c.entidad!.pieza}» de ${tipo} no existe`);
      piezas++;
    }
    if (c.tipo === 'accion' && c.clase === 'elemento') assert.ok(ACCIONES_ELEMENTO.some((a) => a.id === c.accion!.id), `${donde}/${c.id}: la acción «${c.accion!.id}» no existe`);
  }
  assert.ok(piezas >= 18, `encontré ${piezas} piezas de ficha: el recorrido no está mirando`);
  // La plantilla «Llamada» lleva las tareas del pie de la ficha (revisar y re-analizar).
  const llamada = POPUPS.find((p) => p.id === 'llamada')!;
  for (const a of ['revisar_llamada', 'reanalizar_llamada']) assert.ok(llamada.componentes.some((c) => c.accion?.id === a), `el pop-up «Llamada» sin «${a}»`);
});

test('una caja de IA lee gráficos que ESTÁN en su hoja; cada hoja nueva trae la suya, y ninguna pasa el tope', () => {
  for (const { id, hoja } of CRUDAS) {
    const graficos = new Set(hoja.componentes.filter((c) => c.clase !== 'elemento').map((c) => c.id));
    const cajas = hoja.componentes.filter((c) => c.tipo === 'ia' && c.clase === 'elemento');
    assert.ok(cajas.length <= MAX_IA_POR_HOJA, `${id}: ${cajas.length} cajas de IA (el saneo tira las de más)`);
    for (const c of cajas) for (const f of c.ia!.fuentes ?? []) assert.ok(graficos.has(f), `${id}/${c.id}: lee «${f}», que no está en la hoja (el saneo lo poda y la caja no lee nada)`);
    if (['vsl-analyst', 'cs-analyst', 'chat-analyst', 'closing', 'ads-analyst'].includes(id)) assert.ok(cajas.length >= 1, `${id}: sin su caja de «Conclusiones de MaKo»`);
  }
  // La de Closing lee las barras de los factores, con el MISMO id que le pone la migración al informe guardado:
  // el closer lee la caja de la cuenta por (hoja, elemento).
  const closing = CRUDAS.find((x) => x.id === 'closing')!.hoja;
  const caja = closing.componentes.find((c) => c.id === 'cl-factores-ia');
  assert.deepEqual(caja?.ia?.fuentes, ['cl-factores-barras']);
});

test('nadie se pisa en la grilla de ninguna plantilla, ni en un pop-up, y todo entra en las 12 columnas', () => {
  const pisa = (a: Crudo, b: Crudo) => (a.x as number) < (b.x as number) + (b.w as number) && (b.x as number) < (a.x as number) + (a.w as number)
    && (a.y as number) < (b.y as number) + (b.h as number) && (b.y as number) < (a.y as number) + (a.h as number);
  const revisar = (donde: string, cs: Componente[]) => {
    for (const c of cs) assert.ok(c.x + c.w <= COLS, `${donde}: ${c.id} se pasa de las 12 columnas`);
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      assert.ok(!pisa(cs[i] as unknown as Crudo, cs[j] as unknown as Crudo), `${donde}: se pisan ${cs[i].id} y ${cs[j].id}`);
    }
  };
  for (const p of PLANTILLAS_HOJA) {
    const h = instanciarPlantilla(p);
    revisar(p.id, h.componentes);
    for (const c of h.componentes) if (c.clase === 'grafico' && c.popup) revisar(`${p.id}/${c.id}(pop-up)`, c.popup.componentes);
  }
  for (const tipo of ['llamada', 'anuncio']) {
    const p = popupDeEntidad(tipo)!;
    assert.ok(p.componentes.length > 0 && p.componentes.length <= MAX_POPUP, `pop-up ${tipo}: ${p.componentes.length} piezas`);
    assert.equal(p.componentes.length, PLANTILLAS_POPUP[tipo as 'llamada'].armar((l) => l).componentes.length, `pop-up ${tipo}: el saneo de un pop-up se comió una pieza`);
    assert.equal(new Set(p.componentes.map((c) => c.id)).size, p.componentes.length, `pop-up ${tipo}: ids repetidos`);
    revisar(`pop-up ${tipo}`, p.componentes);
  }
  assert.equal(popupDeEntidad('lead'), null, 'un lead no tiene plantilla de pop-up: quien lo pide arma la ficha entera');
});

test('«analyst» encuentra las siete hojas de Analysts (aunque Landing, Closing y Productividad no lo digan)', () => {
  const ids = filtrarPlantillasHoja(PLANTILLAS_HOJA, 'analyst').map((p) => p.id);
  for (const id of ['ads-analyst', 'landing', 'vsl-analyst', 'chat-analyst', 'closing', 'cs-analyst', 'productividad']) assert.ok(ids.includes(id), `«analyst» no encuentra ${id}`);
  // El nombre de la tab de antes también, sin acentos ni mayúsculas.
  assert.ok(filtrarPlantillasHoja(PLANTILLAS_HOJA, 'productivity').some((p) => p.id === 'productividad'));
  assert.ok(filtrarPlantillasHoja(PLANTILLAS_HOJA, 'customer success').some((p) => p.id === 'cs-analyst'));
});

test('cada hoja dice de qué plantilla nació (la de «Nueva hoja», el inicial y la de un rol), y el saneo no lo pierde', () => {
  for (const p of PLANTILLAS_HOJA) assert.equal(instanciarPlantilla(p).plantilla, p.id, `${p.id}: la hoja de «Nueva hoja» no dice de qué plantilla nació`);
  const ini = tableroInicial();
  assert.deepEqual(ini.hojas.map((h) => h.plantilla), ['marketing', 'comercial']);
  assert.deepEqual(informeDeRol('closer')!.hojas.map((h) => h.plantilla), ['closing']);
  assert.deepEqual(informeDeRol('setter')!.hojas.map((h) => h.plantilla), ['chat-analyst']);
  // Lo que se guarda y se vuelve a leer (el autoguardado manda el informe ENTERO y el server lo sanea).
  const ida = sanearTablero(JSON.parse(JSON.stringify({ ...ini, hojas: [...ini.hojas, instanciarPlantilla(PLANTILLAS_HOJA.find((p) => p.id === 'cs-analyst')!)] })))!;
  assert.deepEqual(ida.hojas.map((h) => h.plantilla), ['marketing', 'comercial', 'cs-analyst']);
});
