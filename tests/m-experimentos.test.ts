// =============================================================================
// MaKo Mobile — «Experiments» (app/m/experimentos): lo que se rompe sin un error
// =============================================================================
// La pantalla destila app/experimentos (AGENTS.md, «MaKo Mobile (/m)»: mismas vistas, mismo orden,
// mismos rótulos). Esto fija:
//   · las cuatro tabs son las de escritorio, en su orden, y la URL las lee con el `tabDeUrl` de escritorio;
//   · cada rótulo que el teléfono repite SIGUE en el fuente de escritorio (tabla escrita a mano: una
//     tabla que se recorre a sí misma no ve una fila borrada, docs/hallazgos-mobile.md);
//   · los números salen del MISMO formateador que escritorio (lib/experimentos-formato.ts, puro), y
//     escritorio lo re-exporta en vez de tener una copia;
//   · «Deshacer» no se ofrece sobre una recomendación ACEPTADA (en el server sólo borra la marca: el
//     experimento y sus tareas quedan corriendo);
//   · el modelo: la píldora y el avance de un experimento, las retros, la línea, la URL;
//   · la página: su guard, que el análisis sólo corre con `?tab=analisis`, y nada del `?ws=`;
//   · el CSS de la carpeta (prefijo entero y tokens que existen), los íconos que existen y cero voseo.
// Que la página dibuje adentro de <PantallaM> lo fija tests/movil-refrescar.test.ts.
//
// Verificado ROMPIÉNDOLO (15/10/2026, base 11 / 0), de a una y restaurando (un script que muta, corre
// y devuelve el archivo):
//   · R.guardados = 'Guardados' (sin «· sin arrancar»)                                  → 10 / 1
//     (con un `includes` daba 11 / 0: «Guardados» está ADENTRO del rótulo de escritorio)
//   · VISTAS_EXPERIMENTOS con 'Conclusions' antes que 'Experiments'                      → 10 / 1
//   · accionesDelPlan de una aceptada devolviendo 'deshacer'                             → 10 / 1
//   · app/experimentos/ui.tsx con su propio `export function fmtVal` (la copia de antes) → 10 / 1
//   · la page corriendo `informe(sp)` siempre (sin `tab === 'analisis'`)                 → 10 / 1
//   · experimentos.css con `.m-exp-x` (prefijo abreviado)                                → 10 / 1
//   · experimentos.css con `var(--mako-fondo)` (no existe)                               → 10 / 1
//   · un «Tocá» en un rótulo de VistaRetroM.tsx                                          → 10 / 1
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ExperimentoConMedicion, Experimento } from '../lib/experimentos';
import type { Retro } from '../lib/retro';
import { tabDeUrl } from '../app/experimentos/tabs';
import { fmtVal, rangoHace } from '../lib/experimentos-formato';
import {
  MOTIVOS_DESCARTE, R, VEREDICTOS, VISTAS_EXPERIMENTOS, VISTAS_RETRO, accionesDelPlan, activoM, advertenciaM, conclusionM,
  estadoDelPlan, guardadoM, mesTexto, rangoElegido, retroDeParam, retroM, rotuloAceptar, textoPlano, toastDelPlan, trazoSpark, urlCon,
} from '../app/m/experimentos/modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Las líneas de comentario PRIMERO y los bloques después (un `/*` dentro de un `//` se comería código). */
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CARPETA = 'app/m/experimentos';
const FUENTES = readdirSync(join(RAIZ, CARPETA)).filter((n) => /\.tsx?$/.test(n)).map((n) => `${CARPETA}/${n}`);

/** De qué archivo de escritorio sale cada rótulo de `R`. A MANO: si se agrega uno a R, se agrega acá. */
const ORIGEN: Record<keyof typeof R, string> = {
  nuevo: 'app/experimentos/ExperimentsTab.tsx',
  sinCorrer: 'app/experimentos/ExperimentsTab.tsx',
  primero: 'app/experimentos/ExperimentsTab.tsx',
  guardados: 'app/experimentos/ExperimentsTab.tsx',
  cerrar: 'app/experimentos/ExperimentsTab.tsx',
  descartar: 'app/experimentos/ExperimentsTab.tsx',
  pregunta: 'app/experimentos/ExperimentsTab.tsx',
  disenar: 'app/experimentos/ExperimentsTab.tsx',
  iniciar: 'app/experimentos/ExperimentsTab.tsx',
  queCambia: 'app/experimentos/ExperimentsTab.tsx',
  criterio: 'app/experimentos/ExperimentsTab.tsx',
  sinConclusiones: 'app/experimentos/ConclusionsTab.tsx',
  sinRetros: 'app/experimentos/RetroTab.tsx',
  nuevaRetro: 'app/experimentos/RetroTab.tsx',
  todas: 'app/experimentos/RetroTab.tsx',
  tesis: 'app/experimentos/RetroReport.tsx',
  hallazgos: 'app/experimentos/RetroReport.tsx',
  planExps: 'app/experimentos/RetroReport.tsx',
  planExp: 'app/experimentos/RetroReport.tsx',
  planTodo: 'app/experimentos/RetroReport.tsx',
  seguimiento: 'app/experimentos/RetroReport.tsx',
  paraProbarlo: 'app/experimentos/RetroReport.tsx',
  motivo: 'app/experimentos/RetroReport.tsx',
  aceptar: 'app/experimentos/RetroReport.tsx',
  posponer: 'app/experimentos/RetroReport.tsx',
  deshacer: 'app/experimentos/RetroReport.tsx',
  sinExps: 'app/experimentos/RetroReport.tsx',
  sinTareas: 'app/experimentos/RetroReport.tsx',
  antesDeLeer: 'app/experimentos/VistaAnalisis.tsx',
  cascada: 'app/experimentos/VistaAnalisis.tsx',
  calificaban: 'app/experimentos/VistaAnalisis.tsx',
  creativos: 'app/experimentos/VistaAnalisis.tsx',
  masTrajeron: 'app/experimentos/VistaAnalisis.tsx',
  masBaratos: 'app/experimentos/VistaAnalisis.tsx',
  escondidos: 'app/experimentos/VistaAnalisis.tsx',
  meta: 'app/experimentos/VistaAnalisis.tsx',
  mesAMes: 'app/experimentos/VistaAnalisis.tsx',
};

test('las cuatro tabs son las de escritorio, en su orden, y la URL se lee con su tabDeUrl', () => {
  const app = sinComentarios(leer('app/experimentos/ExperimentosApp.tsx'));
  const deEscritorio = [...app.matchAll(/\{ key: '(\w+)', label: '([^']+)'/g)].map((m) => ({ id: m[1], label: m[2] }));
  assert.deepEqual(VISTAS_EXPERIMENTOS.map((v) => ({ ...v })), deEscritorio, 'las tabs del teléfono no son las de escritorio');
  assert.deepEqual(VISTAS_EXPERIMENTOS.map((v) => v.label), ['Retro', 'Experiments', 'Conclusions', 'Análisis']);
  for (const v of VISTAS_EXPERIMENTOS) assert.equal(tabDeUrl(v.id), v.id);
  // Y la pantalla la lee de la URL con ESE tabDeUrl (no con un estado copiado del server).
  const shell = sinComentarios(leer(`${CARPETA}/ExperimentosM.tsx`));
  assert.match(shell, /tabDeUrl\(sp\.get\('tab'\)/, 'la tab no se lee de la URL');
  // Las vistas de una Retro: las dos primeras de escritorio, con su nombre.
  const rep = sinComentarios(leer('app/experimentos/RetroReport.tsx'));
  for (const v of VISTAS_RETRO) assert.match(rep, new RegExp(`\\{ id: '${v.id}', name: '${escapar(v.label)}' \\}`));
});

test('cada rótulo que el teléfono repite sigue en el fuente de escritorio', () => {
  assert.deepEqual(Object.keys(ORIGEN).sort(), Object.keys(R).sort(), 'un rótulo de R sin su archivo de escritorio en ORIGEN');
  // El rótulo ENTERO (entre comillas o como texto de JSX, con el «+ », «← » o « →» que escritorio le
  // pone): un `includes` aceptaba «Guardados» porque está adentro de «Guardados · sin arrancar».
  const comoRotulo = (r: string) => new RegExp(`['"\`>]\\s*(?:[+←]\\s*)?${escapar(r)}\\s*(?:→\\s*)?['"\`<]`);
  for (const [k, archivo] of Object.entries(ORIGEN) as Array<[keyof typeof R, string]>) {
    assert.match(sinComentarios(leer(archivo)), comoRotulo(R[k]), `«${R[k]}» (R.${k}) ya no es un rótulo de ${archivo}`);
  }
  // Los motivos de un descarte y los veredictos, los mismos (y en el mismo orden).
  const rep = sinComentarios(leer('app/experimentos/RetroReport.tsx'));
  const motivos = /const MOTIVOS = \[([^\]]+)\]/.exec(rep)?.[1].match(/'([^']+)'/g)?.map((x) => x.slice(1, -1));
  assert.deepEqual([...MOTIVOS_DESCARTE], motivos);
  const concl = sinComentarios(leer('app/experimentos/ConclusionsTab.tsx'));
  for (const [v, d] of Object.entries(VEREDICTOS)) assert.match(concl, new RegExp(`${v}: \\{ label: '${escapar(d.label)}'`));
  // Los datos del Análisis rotulados como escritorio (sin distinguir mayúsculas: escritorio los escribe en una frase).
  const analisis = sinComentarios(leer(`${CARPETA}/AnalisisM.tsx`));
  const vista = sinComentarios(leer('app/experimentos/VistaAnalisis.tsx')).toLowerCase();
  const ks = [...analisis.matchAll(/<FilaDatoM k="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ks.length >= 12, 'no se leyeron las filas del Análisis');
  for (const k of ks) assert.ok(vista.includes(k.toLowerCase()), `«${k}» no es un dato de VistaAnalisis.tsx`);
  // «Aceptar» a secas no: lleva su objeto (LEEME de app/m/_ui).
  assert.equal(rotuloAceptar('exp'), 'Aceptar experimento');
  assert.equal(rotuloAceptar('tarea'), 'Aceptar tarea');
});

test('los números salen del formateador de escritorio, que vive en un módulo puro y escritorio re-exporta', () => {
  const formato = sinComentarios(leer('lib/experimentos-formato.ts'));
  assert.doesNotMatch(formato, /^\s*import\b/m, 'lib/experimentos-formato.ts importa algo: deja de ser puro');
  assert.doesNotMatch(formato, /^\s*['"]use (client|server)['"]/m, 'lib/experimentos-formato.ts dejó de ser un módulo puro');
  const ui = sinComentarios(leer('app/experimentos/ui.tsx'));
  assert.match(ui, /from '@\/lib\/experimentos-formato'/, 'ui.tsx no toma el formato del módulo puro');
  assert.doesNotMatch(ui, /export (?:function|const) (?:fmtVal|fmtFechaLarga|fmtFechaCorta|fmtDelta|dirLabel|METRICA_FMT)\b/,
    'ui.tsx volvió a tener su copia del formato');
  const va = sinComentarios(leer('app/experimentos/VistaAnalisis.tsx'));
  assert.match(va, /from '@\/lib\/experimentos-formato'/, 'VistaAnalisis.tsx no toma el formato del módulo puro');
  assert.doesNotMatch(va, /Math\.round\(v \* 100\)/, 'VistaAnalisis.tsx volvió a tener su copia de pct');
  // Lo que escribe: el de siempre.
  assert.equal(fmtVal(2.5, 'cpc'), '$2.5');
  assert.equal(fmtVal(4.236, 'ctr'), '4.2%');
  assert.equal(fmtVal(null, 'cpc'), '—');
});

const exp = (o: Partial<ExperimentoConMedicion>): ExperimentoConMedicion => ({
  id: 1, titulo: 'Anuncio con caso', hipotesis: 'Si muestro un caso, sube el CTR', cambio: '', estado: 'activo', origen: 'mako',
  metrica: 'ctr', metrica_label: 'CTR', direccion: 'subir', objetivo_valor: null, criterio_exito: null, baseline_valor: null,
  baseline_desde: null, baseline_hasta: null, ventana_dias: 14, presupuesto_usd: null, fecha_inicio: '2026-10-03', fecha_fin: null,
  veredicto: null, resultado_valor: null, aprendizaje: null, cerrado_at: null, config: null, racional: null, model: null,
  created_at: '2026-10-03T00:00:00Z', updated_at: '2026-10-03T00:00:00Z', medicion: null, ...o,
});
const medicion = (o: Partial<NonNullable<ExperimentoConMedicion['medicion']>>): NonNullable<ExperimentoConMedicion['medicion']> => ({
  baseline: 3.1, actual: 4.2, objetivo: null, dias_corridos: 6, dias_total: 14, delta_pct: 35.48, va_bien: true,
  serie: [{ fecha: '2026-10-03', valor: 3 }, { fecha: '2026-10-04', valor: null }, { fecha: '2026-10-05', valor: 4.2 }],
  desde: '2026-10-03', hasta: '2026-10-08', baseline_desde: '2026-09-19', baseline_hasta: '2026-10-02', ...o,
});

test('un experimento en curso: la píldora, el avance y los números de escritorio', () => {
  const a = activoM(exp({ medicion: medicion({}) }));
  assert.deepEqual([a.estado, a.tono, a.linea], ['va bien', 'good', 'good']);
  assert.deepEqual([a.antes, a.ahora, a.delta], ['3.1%', '4.2%', '+35.5%']);
  assert.equal(a.avance, 6 / 14);
  assert.equal(a.listo, false);
  assert.deepEqual(a.serie, [3, 4.2], 'un día sin dato no es un cero');
  assert.equal(a.desde, '3 oct 2026');
  assert.equal(a.cambio, null, 'un «qué se cambia» vacío no dibuja su bloque');

  const contra = activoM(exp({ medicion: medicion({ va_bien: false, delta_pct: -14, dias_corridos: 14 }) }));
  assert.deepEqual([contra.estado, contra.tono, contra.listo, contra.delta], ['en contra', 'bad', true, '-14.0%']);
  // Sin medición: «sin dato aún», día 0 de la ventana, sin variación inventada.
  const nada = activoM(exp({}));
  assert.deepEqual([nada.estado, nada.tono, nada.dia, nada.dias, nada.delta, nada.avance], ['sin dato aún', 'neutro', 0, 14, null, 0]);

  const g = guardadoM(exp({ estado: 'propuesto', direccion: 'bajar', ventana_dias: 21 }) as Experimento);
  assert.deepEqual([g.objetivo, g.ventana], ['bajar ↓', '21 días']);
});

test('una conclusión: el veredicto de escritorio y su línea del cierre', () => {
  const c = conclusionM(exp({
    estado: 'cerrado', veredicto: 'refutada', aprendizaje: 'El caso no sube el CTR', baseline_valor: 3.1, resultado_valor: 2.9,
    cerrado_at: '2026-10-12T10:00:00Z', config: { serie_cierre: [{ fecha: 'a', valor: 3 }, { fecha: 'b', valor: 2.9 }, { fecha: 'c', valor: null }] },
  }));
  assert.deepEqual([c.veredicto, c.tono, c.antes, c.despues, c.cerrado], ['Refutada', 'bad', '3.1%', '2.9%', '12 oct 2026']);
  assert.deepEqual(c.serie, [3, 2.9]);
  assert.equal(conclusionM(exp({ veredicto: null })).veredicto, 'No concluyente');
});

test('el plan de una Retro: qué se ofrece, con qué rótulo, y «Deshacer» nunca sobre una aceptada', () => {
  assert.equal(accionesDelPlan(undefined), 'decidir');
  assert.equal(accionesDelPlan({ estado: 'pospuesta', at: 'x' }), 'deshacer');
  assert.equal(accionesDelPlan({ estado: 'descartada', motivo: 'no es prioridad', at: 'x' }), 'deshacer');
  assert.equal(accionesDelPlan({ estado: 'aceptada', experimento_id: 9, at: 'x' }), 'ninguna',
    'deshacer una aceptada sólo borra la marca: el experimento sigue corriendo');
  assert.deepEqual(estadoDelPlan({ estado: 'descartada', motivo: 'ya lo probé', at: 'x' }), { label: 'Descartada · ya lo probé', tono: 'neutro' });
  assert.equal(estadoDelPlan(undefined), null);
  assert.equal(toastDelPlan('aceptar', 'exp'), 'Experimento iniciado');
  assert.equal(toastDelPlan('aceptar', 'tarea'), 'Tarea en el Plan');
  assert.equal(toastDelPlan('deshacer', 'exp'), '', 'deshacer no dice nada: la hoja ya lo muestra');
  for (const op of ['aceptar', 'posponer', 'descartar'] as const) {
    assert.ok(toastDelPlan(op, 'exp').split(' ').length <= 4, 'un toast de más de 4 palabras');
  }
});

test('una Retro en la lista: cuándo se corrió, cuántas recomendaciones y cuántas aceptadas', () => {
  const base: Retro = {
    id: 7, periodo_desde: '2026-09-01', periodo_hasta: '2026-09-30', titulo: 'La fuga está en el show rate', resumen: '## Qué pasó\n- **Bajó** el show rate\n\n\n- Sube el CPL',
    destacados: null, recomendaciones: [{} as never, {} as never], snapshot: null, reporte: null, model: null, created_at: '2026-10-12T15:00:00Z',
  };
  const vieja = retroM(base);
  assert.equal(vieja.segunda, '12 oct · 2 recomendaciones');
  assert.equal(vieja.aceptadas, null);
  assert.equal(vieja.periodo, 'Corrida el 12 oct 2026 · analiza 1 sep 2026 – 30 sep 2026');
  assert.equal(vieja.resumen, 'Qué pasó\n· Bajó el show rate\n\n· Sube el CPL');
  assert.equal(textoPlano(''), '');

  const conPlan = retroM({
    ...base,
    reporte: {
      version: 3, tesis: { texto: 'La fuga es el show rate', highlight: 'show rate' }, areas: [{ id: 'conversion', name: 'Conversión', st: 'bad', line: '' }],
      findings: [{ id: 'f1', tipo: 'anomalia', area: 'conversion', tool: 'crm', ev: { type: 'num', value: '63%', label: 'sin tocar', tone: 'bad' }, short: '304 leads sin tocar', insight: 'x', source: 'CRM', tab: 'CRM' }],
      plan: [
        { id: 'p1', kind: 'exp', origen: '', titulo: 'Recordatorio', why: '', impacto: '~$1k', status: { estado: 'aceptada', at: 'x' } },
        { id: 'p2', kind: 'tarea', origen: '', titulo: 'Llamar', why: '', impacto: '' },
      ],
      seguimiento: [], cobertura: [], charts: {} as never, proceso: [],
    },
  });
  assert.equal(conPlan.segunda, '12 oct · 2 recomendaciones');
  assert.equal(conPlan.aceptadas, '1 aceptada');
  assert.deepEqual(conPlan.reporte?.hallazgos.map((h) => [h.tipoLabel, h.herramienta, h.salud]), [['Anomalía', 'CRM', 'bad']]);
  assert.deepEqual(conPlan.reporte?.plan.map((p) => [p.id, p.prio, p.chain.length]), [['p1', null, 0], ['p2', null, 0]]);
});

test('el Análisis: el rango elegido, el mes y las advertencias', () => {
  const hoy = new Date('2026-10-15T12:00:00Z');
  const r30 = rangoHace(30, hoy);
  assert.equal(rangoElegido(r30.desde, r30.hasta, hoy), '30');
  assert.equal(rangoElegido('2026-01-01', r30.hasta, hoy), null, 'un rango a mano no marca ninguno');
  assert.equal(rangoElegido(null, null, hoy), null);
  assert.equal(mesTexto('2026-03'), 'mar 2026');
  assert.equal(mesTexto('2026-03-02'), '2026-03-02');
  assert.deepEqual(advertenciaM('⚠️ El 46% sin marcar'), { tono: 'warn', texto: 'El 46% sin marcar' });
  assert.deepEqual(advertenciaM('Moneda fija'), { tono: 'info', texto: 'Moneda fija' });
});

test('la línea, la URL y el id de la Retro', () => {
  assert.equal(trazoSpark([5], 100, 40), null, 'con un punto no hay línea');
  assert.equal(trazoSpark([1, 2, 3], 100, 40, 0), 'M0 40 L50 20 L100 0');
  assert.equal(trazoSpark([2, 2], 100, 40, 0), 'M0 20 L100 20', 'una serie plana va al medio, no al piso');
  assert.equal(urlCon('/experimentos?tab=retro&ws=13&retro=4', { tab: 'experiments', retro: null }), '/experimentos?tab=experiments&ws=13');
  assert.equal(retroDeParam('12'), 12);
  for (const x of ['0', '-3', 'abc', '1.5', '', null]) assert.equal(retroDeParam(x), null);
});

test('la página: su guard, el análisis sólo con ?tab=analisis, y nada del ?ws=', () => {
  const page = sinComentarios(leer(`${CARPETA}/page.tsx`));
  assert.match(page, /requireMovil\(\{ navKey: 'experimentos' \}\)/);
  assert.match(page, /tab === 'analisis' \? informe\(sp\) : null/, 'el análisis (lento) corre aunque la tab no sea Análisis');
  for (const f of FUENTES) {
    const src = sinComentarios(leer(f));
    assert.doesNotMatch(src, /\bsp\.ws\b|get\('ws'\)/, `${f} lee el workspace de la URL`);
  }
});

test('el CSS de la carpeta, los íconos y el copy', () => {
  const css = sinComentarios(leer(`${CARPETA}/experimentos.css`));
  const primitivas = leer('app/m/m.css') + leer('app/_ui/ui.css');
  const clases = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  assert.ok(clases.size > 20, 'no se leyó ninguna clase');
  for (const c of clases) {
    if (c.startsWith('m-experimentos-') || c === 'm-experimentos') continue;
    assert.match(primitivas, new RegExp(`\\.${escapar(c)}(?![\\w-])`), `.${c}: ni lleva .m-experimentos- ni es una primitiva`);
  }
  const globales = leer('app/globals.css');
  const tokens = new Set([...css.matchAll(/var\(--([\w-]+)/g)].map((m) => m[1]));
  for (const t of tokens) assert.match(globales, new RegExp(`--${escapar(t)}\\s*:`), `var(--${t}) no existe en app/globals.css`);

  const iconos = leer('app/_components/icons.tsx');
  const todas = FUENTES.map((f) => sinComentarios(leer(f))).join('\n');
  const usados = new Set([...todas.matchAll(/<Icon name="([\w-]+)"/g)].map((m) => m[1]));
  assert.ok(usados.size >= 3, 'no se leyó ningún ícono');
  for (const n of usados) assert.match(iconos, new RegExp(`^\\s*'?${escapar(n)}'?\\s*:`, 'm'), `<Icon name="${n}"> no existe: dibuja un punto`);

  // Español neutro con tú: ningún voseo en lo que se dibuja.
  // Con la tilde: «toca», «mira» o «hace» son de tú (o de él); «tocá», «mirá» y «hacé», de vos.
  const VOSEO = /(?<![\wáéíóúñ])(tocá|mirá|tenés|podés|querés|elegí|escribí|hacé|andá|fijate|contá|probá|abrí|sabés|decí|poné|usá|guardá)(?![\wáéíóúñ])/i;
  for (const f of FUENTES) {
    for (const m of sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|>([^<>{}\n]+)</g)) {
      const t = m[1] ?? m[2] ?? m[3] ?? '';
      assert.doesNotMatch(t, VOSEO, `${f}: voseo en «${t.trim()}»`);
    }
  }
});
