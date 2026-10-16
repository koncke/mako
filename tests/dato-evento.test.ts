// =============================================================================
// La CONDITION sobre los DATOS DEL EVENTO, con «Si no» (16/10/2026)
// =============================================================================
// Martín (16/10, por Cerebro, punto C): «que TODO sea editable en SuperAdmin». Y la causa de las dos capturas
// (docs/inventario-nada-por-detras.md): un evento de la plataforma no admitía CONDITION —no trae lead—, así que el
// código elegía la frase y la fila no tenía el texto que salía. Lo que persigue este archivo (la pieza 1 del inventario):
//   1. el dato se pregunta como cualquier condición: su def sale de su variable, se guarda, se dice y se evalúa con lo
//      que trajo el evento; «no sé» no es «no»;
//   2. una CONDITION con «Si no» o con varias salidas corre en el runner (en fila: pregunta, camino, fin), y la de UNA
//      salida sigue con la traducción y la huella de siempre (una corrida dormida en ella no se corta);
//   3. qué puede preguntar cada evento: sin lead, sólo sus datos; nadie un dato que no trae; dos salidas no se juntan;
//   4. el editor ofrece «Datos del evento» primero, y en un evento sin lead, sólo eso;
//   5. una corrida que sólo pregunta datos no lee ningún lead, ni espera a que abra la oficina para decidir.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026, scratchpad romper-b2b3.mjs, junto con tests/alerta-critica.test.ts y
// tests/aviso-evento.test.ts: base 40 de 40), una rotura por vez:
//   · `cumpleDato` con «no sé» como `false` en vez de `null` → 39 / 1, cae el 1;
//   · `decidir` sin `siNo` (termina siempre que no se cumple) → 37 / 3, caen el 2, el 6 y el de la causa (alerta-critica);
//   · `pasosDelEvento` sin el `fin` de cada salida → 38 / 2, caen el 2 y el 6;
//   · la de UNA salida traducida como las de varias (sin el atajo) → 38 / 2, caen el 2 y el de las tres plantillas;
//   · `problemaDeCondicion` sin el corte de `solo` → 39 / 1, cae el 3;
//   · `seccionesDeCondiciones` sin el `if (datos?.solo)` → 39 / 1, cae el 4;
//   · `esperaApertura` sin la línea de los datos del evento → 39 / 1, cae el 5.
// Y lo que arregló la revisión de B3 (16/10/2026, scratchpad romper-b3r.mjs, los mismos tres archivos: base 43 de 43):
//   · las tarjetas de la alerta sin «Lo manda igual» → 42 / 1, cae el 6;
//   · `decidir` sin el corte de «sin hechos» → 41 / 2, caen el 2 y el de `decidir` (aviso-evento);
//   · `esperaApertura` mirando las dos salidas de una con «Si no» → 42 / 1, cae el 5;
//   · el runner durmiendo en la tarjeta y no en la cadena → 42 / 1, cae el 5;
//   · la tarjeta diciendo que llegó siempre, el emisor contando corridas, o sin el freno de datos fuera de un evento →
//     42 / 1 cada uno, cae el 7.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { campoDeDato, datoDeCampo, hechosDelEvento, soloDatosDelEvento } from '../lib/dato-evento';
import { condicionPorId, problemaDeFila, textoCondicion, seccionesDeCondiciones, deValorOpcion, SECCION_DATOS } from '../lib/condiciones-catalogo';
import { cumpleFila, normalizar, type PasoGrafo, type RamaCondicion, type FilaCondicion, type HechosLead } from '../lib/flujo-grafo';
import { camposDelFlujo } from '../lib/nutricion-grafo-motor';
import { pasosDelEvento, frenoDelEvento, condicionesDelEvento, esperaApertura, emitirPorEvento, MOTIVO_EVENTO, type DepsEvento } from '../lib/aviso-evento';
import { TRIGGER_AVISO_MAKO } from '../lib/disparadores';
import { decidir } from '../lib/flujo-pasos';
import { plantillaPorId, pasosDePlantilla } from '../lib/plantillas-automatizaciones';
import type { Paso } from '../lib/flujos-tipos';

const AHORA = Date.parse('2026-10-16T12:00:00Z');
const leer = (r: string): string => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const H = (datos: Record<string, string>): HechosLead => hechosDelEvento(datos, AHORA);

// ── Las piezas del lienzo (lo mismo que nace del ＋) ──────────────────────────────────────────────
const RELLENO = { orden: 0, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, proveedor: 'no_oficial' } as const;
const mako = (id: string, mensaje: string, siguiente: string | null): PasoGrafo =>
  ({ ...RELLENO, id, siguiente, accion: { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje } } }) as PasoGrafo;
const rama = (id: string, filas: FilaCondicion[], siguiente: string | null): RamaCondicion => ({ id, modo: 'todas', filas, siguiente });
const condicion = (id: string, ramas: RamaCondicion[], siNo: string | null): PasoGrafo =>
  ({ ...RELLENO, id, nodo: 'condicion', ramas, si_no: siNo }) as PasoGrafo;
const estado = (e: string): FilaCondicion => ({ campo: 'dato:anuncios_estado', valor: e });

/** Corre los pasos como el runner (`decidir`), con estos hechos: los textos que salen, en orden. */
function corre(pasos: readonly Paso[], hechos: HechosLead | null): string[] {
  const out: string[] = [];
  const ahora = new Date(AHORA);
  let i = 0;
  for (let vuelta = 0; vuelta < 100; vuelta++) {
    const d = decidir(pasos as Paso[], { paso: i, desde: ahora, respondioAt: null, ahora, hechos });
    if (d.que === 'terminar') return out;
    if (d.que === 'esperar') throw new Error('esperó');
    if (d.que === 'ejecutar' && d.paso.tipo === 'mensaje') out.push(d.paso.texto);
    i = d.siguiente;
  }
  throw new Error('más vueltas que pasos');
}

test('1. el dato de un evento se pregunta como cualquier condición, y «no sé» no es «no»', () => {
  assert.equal(campoDeDato('anuncios_vez'), 'dato:anuncios_vez');
  assert.equal(datoDeCampo('dato:anuncios_vez'), 'anuncios_vez');
  assert.equal(datoDeCampo('dato:Mal-Clave'), null);
  assert.equal(datoDeCampo('agendo'), null);
  // La def sale de su variable (lib/variables-aviso.ts): sección, rótulo y tipo. Un dato que no se pregunta no es condición.
  const def = condicionPorId('dato:anuncios_estado')!;
  assert.equal(def.seccion, SECCION_DATOS);
  assert.deepEqual(def.rotulo, ['Estado de la cuenta es', 'Estado de la cuenta no es']);
  assert.equal(def.valor.t, 'opciones');
  assert.equal(condicionPorId('dato:anuncios_hace'), null, 'un dato que no se pregunta salió como condición');
  assert.equal(condicionPorId('dato:no_existe'), null);
  // Validar y decir, como las demás.
  assert.equal(problemaDeFila(estado('Saldo impago')), null);
  assert.match(problemaDeFila(estado('Inventado'))!, /falta elegir «Estado de la cuenta es»/);
  assert.match(problemaDeFila({ campo: 'dato:anuncios_vez', valor: 0, op: 'menor_igual' })!, /falta el número/);
  assert.equal(textoCondicion(estado('Saldo impago')), 'Estado de la cuenta es «Saldo impago»');
  assert.equal(textoCondicion({ ...estado('Saldo impago'), no: true }), 'Estado de la cuenta no es «Saldo impago»');
  assert.equal(textoCondicion({ campo: 'dato:anuncios_vez', valor: 3, op: 'menor_igual' }), 'Aviso número ≤ 3');
  // Se evalúa con lo que trajo el evento.
  const h = H({ anuncios_estado: 'Saldo impago', anuncios_vez: '2' });
  assert.equal(cumpleFila(estado('saldo IMPAGO'), h), true, 'sin mayúsculas ni tildes');
  assert.equal(cumpleFila(estado('Cerrada'), h), false);
  assert.equal(cumpleFila({ ...estado('Cerrada'), no: true }, h), true);
  assert.equal(cumpleFila({ campo: 'dato:anuncios_vez', valor: 3, op: 'menor_igual' }, h), true);
  assert.equal(cumpleFila({ campo: 'dato:anuncios_vez', valor: 3 }, h), false, 'sin operador es ≥');
  // «No sé» no es «no»: sin el dato no se cumple, ni negada; sin evento (una automatización de leads), tampoco.
  const sin = H({});
  assert.equal(cumpleFila({ ...estado('Cerrada'), no: true }, sin), false);
  assert.equal(cumpleFila({ campo: 'dato:anuncios_vez', valor: 3, op: 'menor_igual' }, sin), false);
  const { evento: _evento, ...deUnLead } = h;
  assert.equal(cumpleFila(estado('Saldo impago'), deUnLead), false);
  // Se guarda: el saneo conserva el valor, la negación y el operador, y descarta un dato que no se pregunta.
  const p = camposDelFlujo({ id: 'c', nodo: 'condicion', si_no: null, ramas: [{ id: 'r', modo: 'todas', siguiente: null, filas: [
    { campo: 'dato:anuncios_vez', op: 'menor_igual', valor: 3 }, { ...estado('Saldo impago'), no: true }, { campo: 'dato:anuncios_hace', valor: '1 h' },
  ] }] });
  assert.deepEqual(p.ramas![0].filas, [{ campo: 'dato:anuncios_vez', op: 'menor_igual', valor: 3 }, { ...estado('Saldo impago'), no: true }]);
});

test('2. «Si no» y varias salidas corren en el runner; la de UNA salida, como siempre', () => {
  // Una salida por estado y el «Si no»: en fila, cada pregunta salta a la siguiente y cada camino termina en su `fin`.
  const pasos = [
    condicion('c1', [rama('c1_a', [estado('Saldo impago')], 'm1'), rama('c1_b', [estado('Cerrada')], 'm2')], 'm3'),
    mako('m1', 'IMPAGO', null), mako('m2', 'CERRADA', null), mako('m3', 'OTRO', null),
  ];
  const t = pasosDelEvento(pasos, 'meta_cuenta_frenada');
  assert.equal(t.problema, null);
  assert.deepEqual(t.pasos.map((p) => p.tipo), ['condicion', 'mensaje', 'fin', 'condicion', 'mensaje', 'fin', 'mensaje']);
  assert.deepEqual(t.pasos.filter((p) => p.tipo === 'condicion').map((p) => (p as { siNo?: number }).siNo), [3, 6]);
  assert.equal(t.firma, 'c1:condicion:c1_a>m1:mensaje>c1:fin>c1:condicion:c1_b>m2:mensaje>c1:fin>m3:mensaje');
  assert.deepEqual(corre(t.pasos, H({ anuncios_estado: 'Saldo impago' })), ['IMPAGO']);
  assert.deepEqual(corre(t.pasos, H({ anuncios_estado: 'Cerrada' })), ['CERRADA']);
  assert.deepEqual(corre(t.pasos, H({ anuncios_estado: 'Deshabilitada' })), ['OTRO']);
  assert.deepEqual(corre(t.pasos, H({})), ['OTRO'], '«no sé» va al «Si no», como en el lienzo');
  // ⚠️ Pero SIN HECHOS (no hay lead que leer, o ya no está) termina, también con «Si no» (revisión del 16/10/2026): el «Si
  // no» es «miré y no se cumple», no «no pude mirar».
  assert.deepEqual(corre(t.pasos, null), []);
  // Anidadas: el techo primero (una salida, sin «Si no»: termina) y los estados adentro.
  const anidada = pasosDelEvento([
    condicion('tope', [rama('tope_si', [{ campo: 'dato:anuncios_vez', op: 'menor_igual', valor: 3 }], 'c1')], null),
    ...pasos,
  ], 'meta_cuenta_frenada');
  assert.equal(anidada.problema, null);
  assert.deepEqual(corre(anidada.pasos, H({ anuncios_estado: 'Cerrada', anuncios_vez: '2' })), ['CERRADA']);
  assert.deepEqual(corre(anidada.pasos, H({ anuncios_estado: 'Cerrada', anuncios_vez: '4' })), []);
  // ⚠️ La de UNA salida sin «Si no» es la de SIEMPRE: el mismo paso y la misma huella. Una corrida dormida guarda la firma
  // (`pasosParaRetomar`): cambiarla cortaría todas las que estaban esperando.
  const una = pasosDelEvento([condicion('c1', [rama('c1_si', [{ campo: 'agendo' }], 'm1')], null), mako('m1', 'A', null)], 'lead_contesta');
  assert.deepEqual(una.pasos[0], { tipo: 'condicion', rama: { id: 'c1_si', modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: 'm1' } });
  assert.equal(una.firma, 'c1:condicion>m1:mensaje');
});

test('3. qué puede preguntar cada evento: sin lead sólo sus datos, nadie uno que no trae, y las salidas no se juntan', () => {
  // La plataforma no trae lead: sus datos sí, una condición del lead no.
  assert.deepEqual(condicionesDelEvento('meta_cuenta_frenada'), { claves: ['anuncios_estado', 'anuncios_entrega', 'anuncios_vez'], solo: true });
  assert.deepEqual(condicionesDelEvento('whatsapp_caido'), { claves: [], solo: true });
  assert.deepEqual(condicionesDelEvento('cuota_vencida'), { claves: [], solo: false });
  const conLead = [condicion('c1', [rama('c1_si', [{ campo: 'agendo' }], 'm1')], null), mako('m1', 'A', null)];
  assert.deepEqual(frenoDelEvento(conLead, 'meta_cuenta_frenada'), { error: MOTIVO_EVENTO.condicionPersona, tarjeta: 'c1' });
  // Un dato que el evento no trae no se sabría nunca: tampoco en un evento de leads.
  const ajeno = [condicion('c1', [rama('c1_si', [estado('Cerrada')], 'm1')], null), mako('m1', 'A', null)];
  assert.deepEqual(frenoDelEvento(ajeno, 'whatsapp_caido'), { error: MOTIVO_EVENTO.datoAjeno, tarjeta: 'c1' });
  assert.deepEqual(frenoDelEvento(ajeno, 'cuota_vencida'), { error: MOTIVO_EVENTO.datoAjeno, tarjeta: 'c1' });
  // Dos salidas a la misma tarjeta: en la fila del runner saldría dos veces.
  const juntas = [condicion('c1', [rama('c1_a', [estado('Cerrada')], 'm1')], 'm1'), mako('m1', 'A', null)];
  assert.deepEqual(frenoDelEvento(juntas, 'meta_cuenta_frenada'), { error: MOTIVO_EVENTO.juntas, tarjeta: 'm1' });
  // Y la plantilla de SuperAdmin pasa.
  assert.equal(frenoDelEvento(normalizar(pasosDePlantilla(plantillaPorId('mako-meta-cuenta-frenada')!)), 'meta_cuenta_frenada'), null);
});

test('4. el editor ofrece «Datos del evento» primero, y en un evento sin lead, sólo eso', () => {
  const ids = (s: ReturnType<typeof seccionesDeCondiciones>) => s.flatMap((x) => x.options.map((o) => deValorOpcion(o.value)?.id));
  const solo = seccionesDeCondiciones('adquisicion', {}, condicionesDelEvento('meta_cuenta_frenada'));
  assert.deepEqual(solo.map((s) => s.title), [SECCION_DATOS]);
  assert.deepEqual(ids(solo), ['dato:anuncios_estado', 'dato:anuncios_estado', 'dato:anuncios_entrega', 'dato:anuncios_entrega', 'dato:anuncios_vez']);
  // Con lead: los datos primero y después lo de siempre.
  const mixto = seccionesDeCondiciones('adquisicion', {}, { claves: ['anuncios_vez'], solo: false });
  assert.equal(mixto[0].title, SECCION_DATOS);
  assert.ok(mixto.length > 1 && ids(mixto).includes('agendo'));
  // Sin evento, como siempre: ni la sección.
  assert.ok(!seccionesDeCondiciones('adquisicion', {}).some((s) => s.title === SECCION_DATOS));
});

test('5. sólo datos: no lee ningún lead, y se decide sin esperar a que abra la oficina', () => {
  assert.equal(soloDatosDelEvento([estado('Cerrada'), { campo: 'dato:anuncios_vez', valor: 3 }]), true);
  assert.equal(soloDatosDelEvento([estado('Cerrada'), { campo: 'agendo' }]), false);
  assert.equal(soloDatosDelEvento([]), false, 'sin filas no hay nada que decidir sin leer');
  // La tarjeta que toca espera sola; la CONDITION de datos no envejece (el dato es del evento, no del lead).
  const conDatos: Paso[] = [
    { tipo: 'condicion', rama: rama('r', [estado('Cerrada')], null), siNo: 2 },
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'A' },
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'B' },
  ];
  assert.equal(esperaApertura(conDatos, 0), false);
  assert.equal(esperaApertura(conDatos, 1), true);
  // ⚠️ La de un lead con «Si no» TAMPOCO mira adelante (revisión del 16/10/2026): qué tarjeta sigue depende de la salida, y
  // mirar las dos hacía esperar a la que «Lo manda igual». Se decide, y si la elegida espera, el runner duerme en la PRIMERA
  // condición de la cadena: al abrir, se decide todo de nuevo.
  const conLead: Paso[] = [
    { tipo: 'condicion', rama: rama('r', [{ campo: 'agendo' }], null), siNo: 2 },
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'A', saleIgual: true },
    { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'B' },
  ];
  assert.equal(esperaApertura(conLead, 0), false);
  // La de UNA salida sin «Si no», como siempre: espera con la tarjeta que sigue.
  assert.equal(esperaApertura([{ tipo: 'condicion', rama: rama('r', [{ campo: 'agendo' }], null) }, { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'A' }], 0), true);
  const flujos = leer('lib/flujos.ts');
  assert.match(flujos, /const dormirEn = cadena \?\? i;\n\s*if \(corridaId\) await avanzar\(ws, corridaId, i, dormirEn, hasta, ctx\);\n\s*else await abrirCorrida\(ws, flujoId, dormirEn, hasta, ctx, \{ reintento: true \}\);/,
    'fuera del horario, la corrida tiene que dormir en la primera condición de la cadena');
  assert.match(flujos, /cadena = pasos\[i\]\?\.tipo === 'condicion' \? \(cadena \?\? i\) : null;\n\s*i = d\.siguiente;/);
  assert.match(flujos, /cadena = null;\n\s*try \{ if \(\(await ejecutarPaso\(flujoId, d\.paso, ws, ctx\)\) === true && entregas\) entregas\.llegaron \+= 1; \}/);
});

test('6. la plantilla de la cuenta frenada corre entera: el techo, cada estado y el «Si no»', () => {
  const t = pasosDelEvento(normalizar(pasosDePlantilla(plantillaPorId('mako-meta-cuenta-frenada')!)), 'meta_cuenta_frenada');
  assert.equal(t.problema, null);
  const sale = (d: Record<string, string>) => corre(t.pasos, H(d));
  assert.equal(sale({ anuncios_estado: 'Saldo impago', anuncios_vez: '1' }).length, 1);
  assert.match(sale({ anuncios_estado: 'Deshabilitada', anuncios_vez: '3' })[0], /DESHABILITÓ/);
  assert.match(sale({ anuncios_estado: 'Cerrada (cualquiera)', anuncios_vez: '1' })[0], /tiene un problema/);
  assert.deepEqual(sale({ anuncios_estado: 'Saldo impago', anuncios_vez: '4' }), []);
  assert.deepEqual(sale({ anuncios_estado: 'Saldo impago' }), [], 'sin saber qué número de aviso es, no sale: «no sé» no es «sí»');
  // ⚠️ «Lo manda igual» fuera del horario (revisión del 16/10/2026): esperando, las tres del techo se apilaban de noche y
  // salían juntas a las 9 con los datos de la noche. Salían a cualquier hora antes de ser una automatización.
  for (const id of ['mako-meta-cuenta-frenada', 'mako-meta-cuenta-recuperada']) {
    const ev = id === 'mako-meta-cuenta-frenada' ? 'meta_cuenta_frenada' : 'meta_cuenta_recuperada';
    const mensajes = pasosDelEvento(normalizar(pasosDePlantilla(plantillaPorId(id)!)), ev).pasos.filter((p) => p.tipo === 'mensaje');
    assert.ok(mensajes.length > 0 && mensajes.every((p) => p.tipo === 'mensaje' && p.saleIgual === true), `${id}: una tarjeta espera a que abra la oficina`);
  }
});

test('7. lo que LLEGÓ se cuenta, y una CONDITION de datos no se guarda fuera de una fila de evento', async () => {
  // El emisor suma lo que cada corrida dice que llegó (`deps.correr`); sin decir nada, cero.
  const fila = {
    id: 9, nombre: 'Alerta', activa: true, trigger_tipo: TRIGGER_AVISO_MAKO,
    disparadores: [{ id: 'd1', subtipo: 'meta_cuenta_frenada', trigger_tipo: TRIGGER_AVISO_MAKO }],
    pasos: normalizar(pasosDePlantilla(plantillaPorId('mako-meta-cuenta-frenada')!)),
  };
  const deps = (llegaron: number | null): DepsEvento => ({
    leerFilas: async () => [fila], emitirAviso: async () => ({ ok: true, feedId: 1, wa: false, deduped: false }),
    reclamar: async () => true, correr: async () => (llegaron == null ? undefined : { llegaron }), wsPlataforma: async () => 9, log: () => {},
  });
  const CAT = { id: 'meta-cuenta-frenada', titulo: 'Cuenta frenada', categoria: 'aviso' as const, semaforo: 'rojo' as const };
  assert.equal((await emitirPorEvento(CAT, 1, { datos: { anuncios_vez: '1' } }, deps(1))).llegaron, 1);
  assert.equal((await emitirPorEvento(CAT, 1, { datos: { anuncios_vez: '1' } }, deps(0))).llegaron, 0);
  assert.equal((await emitirPorEvento(CAT, 1, { datos: { anuncios_vez: '1' } }, deps(null))).llegaron, 0);
  // Y las piezas que lo cuentan: la tarjeta dice si llegó (al grupo o por email), y `depsDelEvento` lo junta.
  const flujos = leer('lib/flujos.ts');
  assert.match(flujos, /return r\.ok && \(r\.wa \|\| r\.email === true\);\n\}/);
  assert.match(leer('lib/avisos.ts'), /const entregas = \{ llegaron: 0 \};\n\s*await runWithWorkspace\(ws, \(\) => ejecutarPasos\(flujoId, pasos, ws, ctx, undefined, entregas\)\);\n\s*return entregas;/);
  // Fuera de una fila de evento no hay evento que conteste un dato: Publicar lo frena (la API, «Crear con IA»).
  assert.match(leer('lib/nutricion.ts'), /if \(\(previo as \{ trigger_tipo\?: string \} \| null\)\?\.trigger_tipo !== TRIGGER_AVISO_MAKO && filasDelFlujo\(grafo\)\.some\(\(f\) => datoDeCampo\(f\.campo\) != null\)\) \{\n\s*throw new PasosInvalidosError\(/);
});
