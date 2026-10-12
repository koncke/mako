// =============================================================================
// La tarjeta «AI STEP» de /automations (novena tanda, Martín 10/10/2026)
// =============================================================================
// Pedido textual: «Todo lo que hiciste de una cantidad impresionante de flujos y tarjetas eso justamente
// debería estar en una nueva tarjeta que sea "AI Step". Configuralo allí». Eligió «una tarjeta con sus
// casos adentro»: el tono general arriba, una fila por situación (cuándo → cómo responder, si sale sola o
// va a revisar, si te avisa) y «Otra cosa → te aviso».
//
// El AI Step es una FORMA del nodo `respuesta` (`paso_ia`), no una clase nueva, y el motor no se reescribe:
// `expandirPasoIA` (lib/flujo-grafo.ts) lo devuelve a la forma de siempre y eso es lo que recorren el motor
// y «Probar». Lo que se EJECUTA acá: la expansión (forma, ids, idempotencia, sola → revisar, avisar), los
// casos que lee el clasificador, el saneo de `setSecuenciaPasos` (`camposDelFlujo`, la quinta puerta), la
// validación en la forma compacta, el conversor (lib/paso-ia-convertir.ts), «enseñar un caso» por la API,
// la tarjeta del lienzo y el ＋, y «Probar» de punta a punta. El motor (`responderConGrafo`) es
// `server-only`: su cableado se fija leyendo el fuente sin comentarios.
//
// ⚠️ UNDÉCIMA TANDA (11/10/2026, docs/diseno-undecima-tanda.md §2 puntos 11-13): UN AI Step por objetivo. Lo que acá
// fijaba la forma de la décima se reescribió en el lugar: el AVISO se deriva de la libertad (`avisar` ya no se lee:
// «Para aprobar» avisa, «Sola» no), Publicar pide el OBJETIVO y frena una libertad que el escenario no puede tener
// (plata → nunca «Sola»), el conversor y «enseñar un caso» dejan UN AI Step, y el ＋ no ofrece un segundo. Lo nuevo,
// con sus roturas, en tests/ai-step-unico.test.ts.
//
// PROBADO ROMPIÉNDOLO (10/10/2026): ver `ROTURAS` al pie, con lo que cazó cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type PasoGrafo, type CasoRespuesta,
  expandirPasoIA, escenariosDeRespuesta, validarGrafo, validarParaGuardar, normalizar, claseDe, esPasoIA, raizRespuesta,
  guiaDeCaso, faltaEnCaso, idRespuestaDeCaso, idAvisoDeCaso, idOtraCosa, nodoPorId, padreDe,
  OP_AVISO_EQUIPO, AVISO_OTRA_COSA, AVISO_DE_CASO, ROTULO_OTRA_COSA, TOPE_RESPONDER, rotuloSiNoDeRespuesta,
  juntarPasosIA,
} from '../lib/flujo-grafo';
import { libertadDeCaso } from '../lib/ai-step-libertad';
import { camposDelFlujo, agregarCasoAlGrafo } from '../lib/nutricion-grafo-motor';
import { respuestaAPasoIA } from '../lib/paso-ia-convertir';
import { OP_AVISAR } from '../lib/flujo-legado';
import { LEAD_DEL_EVENTO } from '../lib/api-mako/flujo-params';
import {
  grafoDeSecuencia, resumenPasoIA, altoPasoIA, opcionesDelMas, opcionesSueltas, insertarDesdeLienzo, nodoNuevo,
  frenoDelFlujo, tarjetasIncompletas, nombreDeTarjeta, ID_ENTRADA, TITULO, type PasoParaGrafo,
} from '../lib/flujo-conversacion';
import { crearSuelta } from '../lib/flujo-edicion';
import { ICONO_MAKO, editorDeTarjeta, ALTO_EDITOR_CONTROL } from '../lib/lienzo-grafo';
import { iniciar, siguiente, pausarPorRespuesta, entrarEnRespuesta, escenarioParaRedactar } from '../lib/simulador-grafo';
import { deIAEdicion, LISTA_BLANCA_IA, type CtxIA } from '../lib/flujo-ia';
import { porId } from '../lib/api-mako/registro';
import { opcionesDeLibertad, conLibertadDe, OPCIONES_LO_DEMAS } from '../lib/ai-step-armar';
import { marcasDeVoseo } from '../lib/puestas-data';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\}/g, '{}');

// Un generador determinista: los ids de los tests no dependen del azar.
const rndDe = () => { let k = 0; return () => ((k++ * 7919) % 100_000) / 100_000 + 0.00001; };

const msg = (o: Partial<PasoGrafo> = {}): PasoGrafo => ({ canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, cuerpo: 'hola', template_wa: null, ...o });
const aviso = (id: string, mensaje = 'Ojo con este', o: Partial<PasoGrafo> = {}): PasoGrafo =>
  ({ ...msg({ cuerpo: '' }), id, accion: { operacion: OP_AVISAR, params: { leadId: 'evento', mensaje } }, siguiente: null, ...o });
const contesta = (id: string, cuerpo: string, o: Partial<PasoGrafo> = {}): PasoGrafo =>
  msg({ id, tipo: 'ia', cuerpo, revisar: true, siguiente: null, ...o });

const caso = (id: string, o: Partial<CasoRespuesta> = {}): CasoRespuesta => ({ id, titulo: `Caso ${id}`, cuando: `cuando ${id}`, siguiente: null, ...o });

/**
 * Un flujo con su salida (m1) y un AI Step R con tres casos: contesta solo (con el `avisar` de antes, que ya no se
 * lee), contesta a revisar, sólo avisa. Sin objetivo: lo que lo necesita, se lo pone.
 */
const conIA = (o: Partial<PasoGrafo> = {}): PasoGrafo[] => [
  msg({ id: 'm1', cuerpo: 'Hola', siguiente: null }),
  {
    ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta', paso_ia: true, instrucciones: 'Cercano, de tú', otra_aviso: 'Revisa este',
    casos: [
      caso('A', { titulo: 'Precio', cuando: 'pregunta el precio', responder: 'Dile que lo ve en la llamada', sola: true, avisar: true }),
      caso('B', { titulo: 'Cambia el día', cuando: 'quiere otro día', responder: 'Ofrécele otro horario' }),
      caso('C', { titulo: 'Se enoja', cuando: 'está molesto', avisar: true }),
    ],
    si_no: null, ...o,
  },
];

// ── La expansión ──────────────────────────────────────────────────────────────────

test('expandir: cada caso a su «MaKo contesta» y su aviso, con ids derivados y al FINAL del array', () => {
  const pasos = conIA();
  const g = expandirPasoIA(pasos);
  // Lo que estaba no se corre: los nodos nuevos van detrás (`paso_actual`, `paso` de los envíos).
  assert.deepEqual(g.slice(0, 2).map((p) => p.id), ['m1', 'R']);
  // UNDÉCIMA: el aviso se DERIVA de la libertad: A sale sola (no avisa aunque diga `avisar`), B es «Para aprobar» (avisa).
  assert.deepEqual(g.slice(2).map((p) => p.id), [
    idRespuestaDeCaso('R', 'A'), idRespuestaDeCaso('R', 'B'), idAvisoDeCaso('R', 'B'), idAvisoDeCaso('R', 'C'), idOtraCosa('R'),
  ]);
  assert.deepEqual(g.slice(2).map((p) => p.id), ['R~A~r', 'R~B~r', 'R~B~a', 'R~C~a', 'R~otra']);
  const r = nodoPorId(g, 'R')!;
  // La forma de siempre: sin la marca ni lo de adentro; cada caso apunta a su primera tarjeta.
  assert.equal(claseDe(r), 'respuesta');
  assert.equal(r.paso_ia, undefined);
  assert.equal(r.instrucciones, undefined);
  assert.equal(r.otra_aviso, undefined);
  assert.deepEqual(r.casos, [
    { id: 'A', titulo: 'Precio', cuando: 'pregunta el precio', siguiente: 'R~A~r' },
    { id: 'B', titulo: 'Cambia el día', cuando: 'quiere otro día', siguiente: 'R~B~r' },
    { id: 'C', titulo: 'Se enoja', cuando: 'está molesto', siguiente: 'R~C~a' },
  ]);
  assert.equal(r.si_no, 'R~otra');
  // «MaKo contesta» de A: WhatsApp no oficial, la guía con el tono, SALE SOLA (revisar false) y no avisa («Sola»).
  const a = nodoPorId(g, 'R~A~r')!;
  assert.equal(claseDe(a), 'mensaje');
  assert.equal(a.tipo, 'ia');
  assert.equal(a.canal, 'whatsapp');
  assert.equal(a.proveedor, 'no_oficial');
  assert.equal(a.cuerpo, 'Tono: Cercano, de tú\nDile que lo ve en la llamada');
  assert.equal(a.revisar, false);
  assert.equal(a.siguiente, null);
  assert.equal(nodoPorId(g, 'R~A~a'), null);
  // B: sin `sola` queda a revisar (el default de todo caso) y, «Para aprobar», AVISA después.
  const b = nodoPorId(g, 'R~B~r')!;
  assert.equal(b.revisar, true);
  assert.equal(b.siguiente, 'R~B~a');
  // El aviso de un caso: «avisar al equipo» sobre el lead del evento, con el título del caso.
  assert.deepEqual(nodoPorId(g, 'R~B~a')!.accion, { operacion: OP_AVISO_EQUIPO, params: { leadId: LEAD_DEL_EVENTO, titulo: 'Cambia el día', mensaje: AVISO_DE_CASO } });
  // C sólo avisa: no hay «MaKo contesta».
  assert.equal(nodoPorId(g, 'R~C~r'), null);
  assert.equal(nodoPorId(g, 'R~C~a')!.siguiente, null);
  // «Otra cosa» con el aviso propio.
  assert.deepEqual(nodoPorId(g, 'R~otra')!.accion, { operacion: OP_AVISO_EQUIPO, params: { leadId: LEAD_DEL_EVENTO, mensaje: 'Revisa este' } });
  // El literal del aviso es el del registro de siempre (flujo-legado no se importa en flujo-grafo).
  assert.equal(OP_AVISO_EQUIPO, OP_AVISAR);
  assert.equal(LEAD_DEL_EVENTO, 'evento');
  // Y lo expandido es un «Si responde» de siempre que se publica.
  assert.deepEqual(validarGrafo(g), []);
});

test('expandir es IDEMPOTENTE, no toca un flujo sin AI Step y uno sin casos sólo tiene «Otra cosa»', () => {
  const g = expandirPasoIA(conIA());
  assert.deepEqual(expandirPasoIA(g), g, 'expandir dos veces cambió el flujo');
  const sin = [msg({ id: 'm1', siguiente: null }), { ...msg(), id: 'R2', nodo: 'respuesta' as const, casos: [caso('x', { siguiente: 'm1' })], si_no: null }];
  assert.deepEqual(expandirPasoIA(sin), sin);
  assert.notEqual(expandirPasoIA(sin), sin, 'devolvió el MISMO array (quien lo edite edita el de afuera)');
  const vacio = expandirPasoIA(conIA({ casos: [], otra_aviso: undefined }));
  assert.deepEqual(vacio.slice(2).map((p) => p.id), ['R~otra']);
  assert.equal(nodoPorId(vacio, 'R')!.si_no, 'R~otra');
  assert.equal((nodoPorId(vacio, 'R~otra')!.accion as { params: { mensaje: string } }).params.mensaje, AVISO_OTRA_COSA);
});

test('la guía de un caso: su respuesta con el tono arriba; sin respuesta no contesta aunque haya tono', () => {
  assert.equal(guiaDeCaso({ instrucciones: 'Corto' }, { responder: 'Dale la fecha' }), 'Tono: Corto\nDale la fecha');
  assert.equal(guiaDeCaso({}, { responder: '  Dale la fecha ' }), 'Dale la fecha');
  assert.equal(guiaDeCaso({ instrucciones: 'Corto' }, { responder: '  ' }), '');
});

test('los casos del clasificador salen del flujo EXPANDIDO: guía, «sale sola» y la primera tarjeta', () => {
  const esc = escenariosDeRespuesta(conIA());
  assert.deepEqual(esc.map((e) => ({ id: e.casoId, guia: e.comoResponder, solo: e.contestaSolo ?? false, sig: e.siguiente })), [
    { id: 'A', guia: 'Tono: Cercano, de tú\nDile que lo ve en la llamada', solo: true, sig: 'R~A~r' },
    { id: 'B', guia: 'Tono: Cercano, de tú\nOfrécele otro horario', solo: false, sig: 'R~B~r' },
    { id: 'C', guia: '', solo: false, sig: 'R~C~a' },
  ]);
  // Lo mismo sobre lo ya expandido (el motor expande antes de preguntar).
  assert.deepEqual(escenariosDeRespuesta(expandirPasoIA(conIA())), esc);
});

// ── El saneo de `setSecuenciaPasos` (la quinta puerta) ───────────────────────────────

test('camposDelFlujo CONSERVA el AI Step: la marca, el tono, el aviso y lo de adentro de cada caso', () => {
  const crudo = {
    id: 'R', nodo: 'respuesta', paso_ia: true, instrucciones: '  Cercano  ', otra_aviso: ' Revisa ', si_no: null,
    casos: [
      { id: 'A', titulo: 'Precio', cuando: 'precio', siguiente: null, responder: ' Dile que en la llamada ', sola: true, avisar: true },
      { id: 'B', titulo: 'Otro', cuando: 'otro', siguiente: null, responder: 'x'.repeat(TOPE_RESPONDER + 50), sola: false, avisar: 'si' },
    ],
  };
  const f = camposDelFlujo(crudo);
  assert.equal(f.paso_ia, true);
  assert.equal(f.instrucciones, 'Cercano');
  assert.equal(f.otra_aviso, 'Revisa');
  // UNDÉCIMA: `avisar` ya no se guarda (el aviso se deriva de la libertad).
  assert.deepEqual(f.casos![0], { id: 'A', titulo: 'Precio', cuando: 'precio', siguiente: null, responder: 'Dile que en la llamada', sola: true });
  // `sola: false` y un `avisar` que no es `true` no se guardan (ausente = el default); la respuesta, con su tope.
  assert.deepEqual(Object.keys(f.casos![1]).sort(), ['cuando', 'id', 'responder', 'siguiente', 'titulo']);
  assert.equal(f.casos![1].responder!.length, TOPE_RESPONDER);
  // En un «Si responde» de los de siempre esos campos no significan nada: no se guardan.
  const clasico = camposDelFlujo({ ...crudo, paso_ia: undefined });
  assert.equal(clasico.paso_ia, undefined);
  assert.equal(clasico.instrucciones, undefined);
  assert.equal(clasico.otra_aviso, undefined);
  assert.deepEqual(clasico.casos![0], { id: 'A', titulo: 'Precio', cuando: 'precio', siguiente: null });
  // Y la ida y vuelta entera: lo saneado expande igual que lo que se escribió.
  assert.deepEqual(escenariosDeRespuesta([camposDelFlujo(conIA()[1]) as PasoGrafo]).map((e) => e.comoResponder),
    escenariosDeRespuesta([conIA()[1]]).map((e) => e.comoResponder));
});

// ── La validación, en la forma COMPACTA ────────────────────────────────────────────────

test('Publicar frena sin objetivo, un escenario sin nombre o sin «cuándo», y una «Sola» que habla de plata; abre la tarjeta del AI Step', () => {
  // UNDÉCIMA: el objetivo es obligatorio, y «Precio» no puede salir sola (plata).
  assert.deepEqual(validarGrafo(conIA()), ['falta el objetivo de la tarjeta R', 'en la tarjeta R, «Precio» no puede salir sola']);
  // Junto (baja «Precio» a «Para aprobar») y con objetivo, se publica.
  assert.deepEqual(validarGrafo(juntarPasosIA(conIA({ objetivo: 'Que agende' })).pasos), [], 'un AI Step completo no se publicaba');
  const sinNombre = conIA({ objetivo: 'x', casos: [caso('A', { titulo: ' ', responder: 'x' })] });
  assert.deepEqual(validarGrafo(sinNombre), ['la tarjeta R tiene un escenario sin nombre']);
  const sinCuando = conIA({ objetivo: 'x', casos: [caso('A', { titulo: 'Confirma', cuando: '', responder: 'x' })] });
  assert.deepEqual(validarGrafo(sinCuando), ['en la tarjeta R, «Confirma» no dice cuándo']);
  // Un escenario sin respuesta es «Sólo te avisa»: ya no hay «no contesta ni avisa».
  assert.deepEqual(validarGrafo(conIA({ objetivo: 'x', casos: [caso('A', { titulo: 'Precio', responder: '  ', avisar: false })] })), []);
  // Al lado de Publicar, con el nombre que se dibuja, y la tarjeta que se abre es la del AI Step.
  const sinObjetivo = conIA({ casos: [caso('A', { titulo: 'Confirma', responder: 'x' })] });
  assert.deepEqual(frenoDelFlujo(sinObjetivo), { error: 'Falta el objetivo de «AI STEP»', tarjeta: 'R' });
  assert.equal(nombreDeTarjeta(sinObjetivo, 'R'), TITULO.paso_ia);
  assert.ok(tarjetasIncompletas(sinObjetivo).has('R'));
  // Lo que se GUARDA como borrador sí pasa: lo incompleto es de Publicar.
  assert.deepEqual(validarParaGuardar(sinObjetivo), []);
  // La regla vive en UN lugar: la misma que pinta la fila en rojo.
  assert.equal(faltaEnCaso(sinNombre[1].casos![0]), 'nombre');
});

test('debajo de un AI Step no van tarjetas: ni un caso con flecha ni un «Otra cosa» con flecha', () => {
  const conFlecha = [...conIA({ casos: [caso('A', { responder: 'x', siguiente: 'm9' })] }), msg({ id: 'm9', siguiente: null })];
  assert.ok(validarParaGuardar(conFlecha).includes('debajo de la tarjeta R no van tarjetas'), 'se guardaba un caso con tarjeta');
  const conOtra = [...conIA({ si_no: 'm9' }), msg({ id: 'm9', siguiente: null })];
  assert.ok(validarParaGuardar(conOtra).includes('debajo de la tarjeta R no van tarjetas'));
  // UNDÉCIMA: UN AI Step por medio (dos que escuchan no se guardan: los junta `juntarPasosIA` antes); un «Si
  // responde» de los de siempre, uno, y sin mezclar.
  const dos = [...conIA(), { ...msg(), id: 'R2', nodo: 'respuesta' as const, paso_ia: true as const, casos: [], si_no: null }];
  assert.ok(!validarParaGuardar(dos).includes('hay más de una tarjeta «Si responde»'));
  assert.ok(validarParaGuardar(dos).includes('hay más de un AI Step de WhatsApp'));
  const mezcla = [...conIA(), { ...msg(), id: 'R2', nodo: 'respuesta' as const, casos: [], si_no: null }];
  assert.ok(validarParaGuardar(mezcla).includes('un AI Step no va con un «Si responde»'));
  // Y sin padre: cuelga del CRON.
  const conPadre = conIA().map((p) => (p.id === 'm1' ? { ...p, siguiente: 'R' } : p));
  assert.ok(validarGrafo(conPadre).includes('«Si responde» cuelga del CRON: ninguna tarjeta puede seguir en él'));
});

// ── El conversor ───────────────────────────────────────────────────────────────────

/** Un «Si responde» de los de siempre que SE PUEDE plegar: las tres formas y un «Otra cosa» que avisa. */
const clasico = (): PasoGrafo[] => [
  msg({ id: 'm1', siguiente: null }),
  {
    ...msg({ cuerpo: '' }), id: 'R', nodo: 'respuesta',
    casos: [caso('A', { titulo: 'Precio', siguiente: 'ia1' }), caso('B', { titulo: 'Fecha', siguiente: 'ia2' }), caso('C', { titulo: 'Enojo', siguiente: 'av3' })],
    si_no: 'otra',
  },
  contesta('ia1', 'Dile que lo ve en la llamada', { revisar: false }),
  contesta('ia2', 'Ofrécele otro día', { siguiente: 'av2' }),
  aviso('av2'),
  aviso('av3'),
  aviso('otra', 'Mira lo que escribió'),
];

test('el conversor pliega cada caso adentro de UN AI Step, conserva los ids, la libertad sale de la forma y contesta IGUAL (salvo la plata, que no sale sola)', () => {
  const r = respuestaAPasoIA(clasico());
  assert.ok('pasos' in r, `no convirtió: ${'error' in r ? r.error : ''}`);
  const p = r.pasos;
  // Las tarjetas plegadas se fueron; el nodo y la salida quedan con sus ids. UNDÉCIMA: UN AI Step con los tres.
  assert.deepEqual(p.map((x) => x.id), ['m1', 'R']);
  const ia = p[1];
  assert.ok(esPasoIA(ia));
  assert.equal(ia.si_no, null);
  assert.equal(ia.otra_aviso, undefined, '«Otra cosa» es «Lo demás: Sólo te avisa»: sin texto propio');
  // A salía sola pero habla de plata («Precio»): «Para aprobar». B contestaba a revisar y avisaba: «Para aprobar».
  // C sólo avisaba: «Sólo te avisa».
  assert.deepEqual(ia.casos, [
    { id: 'A', titulo: 'Precio', cuando: 'cuando A', siguiente: null, responder: 'Dile que lo ve en la llamada' },
    { id: 'B', titulo: 'Fecha', cuando: 'cuando B', siguiente: null, responder: 'Ofrécele otro día' },
    { id: 'C', titulo: 'Enojo', cuando: 'cuando C', siguiente: null, no_contesta: true },
  ]);
  assert.deepEqual(ia.casos!.map((c) => libertadDeCaso(c)), ['aprueba', 'aprueba', 'avisa']);
  // LA EQUIVALENCIA: los casos del clasificador (guía y «sale sola») son los MISMOS antes y después, salvo A.
  const ver = (ps: PasoGrafo[]) => escenariosDeRespuesta(ps).map((e) => [e.casoId, e.comoResponder, e.contestaSolo === true]);
  assert.deepEqual(ver(p), ver(clasico()).map((x) => (x[0] === 'A' ? [x[0], x[1], false] : x)));
  // Sin plata, «sale sola» se conserva.
  const sinPlata = respuestaAPasoIA(clasico().map((x) => (x.id === 'R' ? { ...x, casos: x.casos!.map((c) => (c.id === 'A' ? { ...c, titulo: 'Confirma' } : c)) } : x)));
  assert.ok('pasos' in sinPlata && libertadDeCaso(sinPlata.pasos[1].casos![0]) === 'sola');
  assert.deepEqual(validarGrafo(p.map((x) => (esPasoIA(x) ? { ...x, objetivo: 'Que agende' } : x))), []);
  // Sin «Otra cosa» tampoco hay texto propio.
  const sinOtra = respuestaAPasoIA(clasico().filter((x) => x.id !== 'otra').map((x) => (x.id === 'R' ? { ...x, si_no: null } : x)));
  assert.ok('pasos' in sinOtra && sinOtra.pasos[1].otra_aviso === undefined);
});

test('el conversor NO convierte nada si un caso o «Otra cosa» tiene algo que no entra, y dice cuál', () => {
  const con = (cambio: (p: PasoGrafo[]) => PasoGrafo[]) => respuestaAPasoIA(cambio(clasico()));
  // Un audio fijo en vez de «MaKo contesta».
  assert.deepEqual(con((ps) => ps.map((x) => (x.id === 'ia1' ? { ...x, tipo: 'audio', audio_id: 3 } : x))), { error: '«Precio» tiene tarjetas que no entran en un AI Step' });
  // Una condición debajo del «MaKo contesta».
  assert.deepEqual(con((ps) => [...ps.map((x) => (x.id === 'ia2' ? { ...x, siguiente: 'c1' } : x)), { ...msg(), id: 'c1', nodo: 'condicion' as const, ramas: [], si_no: null }]),
    { error: '«Fecha» tiene tarjetas que no entran en un AI Step' });
  // Una tarjeta a la que también se llega por otro caso.
  assert.deepEqual(con((ps) => ps.map((x) => (x.id === 'R' ? { ...x, casos: x.casos!.map((c) => (c.id === 'C' ? { ...c, siguiente: 'ia1' } : c)) } : x))),
    { error: '«Precio» tiene tarjetas que no entran en un AI Step' });
  // Un «MaKo contesta» de varios mensajes.
  assert.ok('error' in con((ps) => ps.map((x) => (x.id === 'ia1' ? { ...x, partes: [{ tipo: 'texto', cuerpo: 'a' }, { tipo: 'texto', cuerpo: 'b' }] } as PasoGrafo : x))));
  // «Otra cosa» que contesta en vez de avisar.
  assert.deepEqual(con((ps) => ps.map((x) => (x.id === 'otra' ? contesta('otra', 'Respóndele') : x))), { error: '«Otra cosa» no es un aviso' });
  // Ya es uno, o no hay ninguno.
  assert.deepEqual(respuestaAPasoIA(conIA()), { error: 'Ya es un AI Step' });
  assert.deepEqual(respuestaAPasoIA([msg({ id: 'm1' })]), { error: 'No hay «Si responde»' });
});

// ── «Enseñar este caso» (la API de MaKo y el hand-off resuelto) ──────────────────────────

test('un caso enseñado entra ADENTRO del AI Step, sin colgarle una tarjeta', () => {
  const r = agregarCasoAlGrafo(conIA(), { titulo: 'Horario', cuando: 'pregunta el horario', comoResponder: 'De 9 a 18', contestaSolo: true }, rndDe());
  assert.ok('pasos' in r);
  // UNDÉCIMA: el caso nuevo es un escenario MÁS de R (no una tarjeta nueva, ni un «MaKo contesta» colgado).
  assert.equal(r.pasos.length, 2, 'colgó una tarjeta');
  assert.equal(r.pasos[1].casos!.length, 4);
  const nuevo = r.pasos[1].casos![3];
  assert.deepEqual({ ...nuevo, id: 'x' }, { id: 'x', titulo: 'Horario', siguiente: null, cuando: 'pregunta el horario', responder: 'De 9 a 18', sola: true });
  assert.deepEqual(validarParaGuardar(r.pasos), []);
  assert.equal(padreDe(r.pasos, 'R'), null);
  // Mismo título = el mismo caso: se actualiza adentro, y la libertad la dice el caso enseñado (sin `avisar`).
  const r2 = agregarCasoAlGrafo(conIA(), { titulo: 'precio', cuando: 'otra vez el precio', comoResponder: 'Nueva guía' });
  assert.ok('pasos' in r2);
  assert.deepEqual(r2.pasos[1].casos![0], { id: 'A', titulo: 'Precio', cuando: 'otra vez el precio', siguiente: null, responder: 'Nueva guía' });
});

test('«Crear con IA» no le cuelga tarjetas a un AI Step: lo dice y sigue con lo demás', () => {
  const acciones = LISTA_BLANCA_IA.map((id) => { const d = porId(id)!; return { id: d.id, titulo: d.titulo, parametros: d.parametros }; });
  const ctx: CtxIA = { etiquetas: [], productos: [], disparadores: [], audios: [], archivos: [], acciones, links: {} };
  const base = normalizar(conIA());
  const tramo = { tarjetas: [{ id: 'x1', tipo: 'mensaje', texto: 'Hola' }] };
  // Por un caso nuevo, y por una salida del AI Step nombrada por su id (los avisos repetidos se juntan:
  // cada camino va en su propia edición).
  for (const pedido of [
    { despues_de: 'si_responde', caso: { titulo: 'Nuevo', cuando: 'pregunta algo' }, ...tramo },
    { despues_de: 'R', salida: 'otra_cosa', ...tramo },
  ]) {
    const r = deIAEdicion({ agregar: [pedido] }, base, ctx, rndDe());
    assert.ok(r.avisos.some((a) => a.includes('El AI Step lleva sus casos adentro')), `${pedido.despues_de}: ${r.avisos.join(' | ')}`);
    assert.deepEqual(r.agregadas, []);
    assert.deepEqual(validarParaGuardar(r.pasos), []);
  }
});

// ── El lienzo: la tarjeta y el ＋ ──────────────────────────────────────────────────────

test('la tarjeta AI STEP: una sola, sin puertos, con el ✦, colgada del CRON y del alto de sus casos', () => {
  const g = grafoDeSecuencia(conIA() as PasoParaGrafo[], { disparador: 'Llega' });
  const n = g.nodos.find((x) => x.id === 'R')!;
  assert.equal(n.tipo, 'paso-ia');
  assert.equal(n.titulo, 'AI STEP');
  assert.equal(n.icono, ICONO_MAKO);
  assert.deepEqual(n.puertos, [], 'dibujó puertos por caso');
  // ALTO FIJO, no el de sus casos (los escenarios van en una línea).
  assert.equal(n.alto, altoPasoIA());
  // La flecha del CRON, y ninguna que salga de ella.
  assert.ok(g.aristas.some((a) => a.desde === ID_ENTRADA && a.hasta === 'R'));
  assert.ok(!g.aristas.some((a) => a.desde === 'R'));
  // Lo que dice (UNDÉCIMA): «→ objetivo», los escenarios con su libertad y cuántos hay de cada una.
  const r = resumenPasoIA(conIA({ objetivo: 'Que agende' })[1]);
  assert.deepEqual([r.objetivo, r.escenarios, r.conteo, r.loDemas, r.medio], ['Que agende',
    [{ titulo: 'Precio', libertad: 'sola' }, { titulo: 'Cambia el día', libertad: 'aprueba' }, { titulo: 'Se enoja', libertad: 'avisa' }],
    { avisa: 1, aprueba: 1, sola: 1 }, 'avisa', 'whatsapp']);
  assert.equal(rotuloSiNoDeRespuesta(conIA()[1]), ROTULO_OTRA_COSA);
  // Le falta algo para publicar (la regla de Publicar, `erroresDelPasoIA`): el objetivo, o un escenario a medias.
  assert.equal(resumenPasoIA(conIA()[1]).falta, true);
  assert.equal(resumenPasoIA(conIA({ objetivo: 'x', casos: [caso('B', { titulo: 'Cambia', responder: 'x' })] })[1]).falta, false);
  const amedias = conIA({ objetivo: 'x', casos: [caso('A', { titulo: '' })] });
  assert.equal(resumenPasoIA(amedias[1]).falta, true);
  assert.equal(grafoDeSecuencia(amedias as PasoParaGrafo[], { disparador: 'Llega' }).nodos.find((x) => x.id === 'R')!.advertencia, 'Falta completar');
  // Su editor tiene su alto (no el de «Si responde»).
  assert.equal(editorDeTarjeta({ editorForma: 'apaisado', editorAncho: 720, editorAlto: 900 }, 'paso-ia').alto, ALTO_EDITOR_CONTROL['paso-ia']);
});

test('el ＋ ofrece «AI Step» donde puede ir y lo crea colgado del CRON, sin escenarios y pidiendo el objetivo; UNO por medio', () => {
  const solo = [msg({ id: 'm1', siguiente: null })] as PasoParaGrafo[];
  const vals = (o: ReturnType<typeof opcionesDelMas>) => o.map((x) => x.value as string);
  assert.ok(vals(opcionesDelMas(solo, 'm1', false)).includes('ai_step'));
  assert.ok(vals(opcionesSueltas(solo)).includes('ai_step'));
  // UNDÉCIMA: con un AI Step NO se ofrece otro (uno por medio); con un «Si responde» de los de siempre, tampoco.
  assert.ok(!vals(opcionesDelMas(conIA(), ID_ENTRADA, false)).includes('ai_step'));
  assert.ok(!vals(opcionesSueltas(conIA())).includes('ai_step'));
  assert.ok(!vals(opcionesSueltas(clasico())).includes('ai_step'));
  // Creada desde el ＋ de m1: al final, SIN padre, y m1 sigue como estaba.
  const r = insertarDesdeLienzo(solo, 'm1', 'sig', 'ai_step', rndDe());
  assert.ok(r.id);
  const ia = nodoPorId(r.pasos, r.id!)!;
  assert.ok(esPasoIA(ia));
  assert.equal(r.pasos.at(-1)!.id, r.id);
  assert.equal(padreDe(r.pasos, r.id!), null, 'quedó enganchada en la salida');
  assert.equal(nodoPorId(r.pasos, 'm1')!.siguiente, null);
  assert.equal(raizRespuesta(r.pasos), r.id);
  // UNDÉCIMA: nace SIN escenarios y sin objetivo; Publicar pide el objetivo (no se publica un AI Step sin él).
  assert.equal(ia.casos!.length, 0);
  assert.deepEqual(validarGrafo(r.pasos), [`falta el objetivo de la tarjeta ${r.id}`]);
  assert.deepEqual(validarParaGuardar(r.pasos), []);
  assert.equal(nodoNuevo('ai_step', solo, rndDe()).casos!.length, 0);
  // Una segunda NO se crea, ni por el ＋ ni por el click derecho; con un «Si responde» de los de siempre, tampoco.
  assert.equal(insertarDesdeLienzo(r.pasos, 'm1', 'sig', 'ai_step', rndDe()).id, null);
  assert.equal(crearSuelta(r.pasos, 'ai_step').id, '');
  assert.equal(insertarDesdeLienzo(clasico() as PasoParaGrafo[], 'm1', 'sig', 'ai_step').id, null);
  assert.equal(crearSuelta(clasico(), 'ai_step').id, '');
});

// ── «Probar» y el motor: los dos recorren lo EXPANDIDO ──────────────────────────────────

test('«Probar» entra a un caso del AI Step y corre su «MaKo contesta» y su aviso, como el motor', () => {
  const pasos = normalizar(conIA());
  const pausa = pausarPorRespuesta(iniciar(pasos)).estado;
  // B es «Para aprobar»: contesta (a revisar) y después AVISA (undécima: el aviso se deriva de la libertad).
  const e = entrarEnRespuesta(pasos, pausa, 'B');
  assert.equal(e.sinRespuesta, false);
  const r1 = siguiente(pasos, e.estado);
  assert.equal(r1.evento?.t, 'mensaje');
  const ev = r1.evento as Extract<NonNullable<typeof r1.evento>, { t: 'mensaje' }>;
  assert.equal(ev.enRespuesta, true);
  assert.equal(ev.paso.tipo, 'ia');
  assert.deepEqual(escenarioParaRedactar(r1.estado, ev.paso), { titulo: 'Cambia el día', cuando: 'quiere otro día', comoResponder: 'Tono: Cercano, de tú\nOfrécele otro horario' });
  const r2 = siguiente(pasos, r1.estado);
  assert.equal(r2.evento?.t, 'accion');
  assert.equal(siguiente(pasos, r2.estado).evento?.t, 'fin');
  // A sale sola: contesta y termina, sin aviso.
  const a1 = siguiente(pasos, entrarEnRespuesta(pasos, pausa, 'A').estado);
  assert.equal(a1.evento?.t, 'mensaje');
  assert.equal(siguiente(pasos, a1.estado).evento?.t, 'fin');
  // «Otra cosa»: el aviso, sin contestar.
  const otra = entrarEnRespuesta(pasos, pausa, null);
  assert.equal(siguiente(pasos, otra.estado).evento?.t, 'accion');
});

test('el motor y la ruta de «Probar» recorren el flujo EXPANDIDO (guard de cableado)', () => {
  const nut = sinComentarios(leer('lib/nutricion.ts'));
  const i = nut.indexOf('async function responderConGrafo(');
  assert.ok(i >= 0);
  const motor = nut.slice(i, nut.indexOf('\nasync function ', i + 10));
  // AI Step v2: expandido por el MEDIO del mensaje (`{ medio }`).
  assert.match(motor, /const pasos = expandirPasoIA\(secuencia\.pasos, \{ medio \}\);\n\s+const escenarios = escenariosDeRespuesta\(pasos\);/);
  // Lo que camina la rama lee ESE `pasos`, nunca los de la secuencia sin expandir.
  assert.doesNotMatch(motor.slice(motor.indexOf('const escenarios')), /secuencia\.pasos/);
  // La ruta clasifica con `escenariosDeRespuesta`, que expande adentro; el simulador expande al caminar.
  assert.match(sinComentarios(leer('app/api/chat-agent/simulador/route.ts')), /const casos = escenariosDeRespuesta\(pasos\);/);
  const sim = sinComentarios(leer('lib/simulador-grafo.ts'));
  assert.match(sim, /export function siguiente<P extends PasoGrafo>\([\s\S]*?const pasos = recorrido\(pasosIn\);/);
  assert.match(sim, /export function entrarEnRespuesta\([\s\S]*?const pasos = recorrido\(pasosIn\);/);
  // El lienzo: la tarjeta con su cuerpo y su editor.
  const lienzo = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
  assert.match(lienzo, /n\.tipo === 'paso-ia' && paso\s*\? <CuerpoPasoIA paso=\{paso\} pendientes=\{n\.detalle\} advertencia=\{!!n\.advertencia\} \/>/);
  assert.match(lienzo, /if \(esPasoIA\(paso\)\) \{[\s\S]*?<EditorPasoIA key=\{`ia-\$\{id\}`\} id=\{id\}/);
});

// ── EL EDITOR (undécima tanda, w2-aistep-editor: puntos 11, 12 y 13) ─────────────────────────────────
// Martín: «No pongas tanto input de texto en AI Step... solo el primero donde le pides a la IA o grabas audio... El
// resto con desplegables» y «En el paso de "Libertad" lo complejizaste al pedo... Solo basta con los primeros 3
// botones, que me gustaría que sean un desplegable... El "Hasta" siempre es atado al objetivo. Y el "Te avisa cada vez"
// ya es uno de los 3 botones... Poco texto quiero». El panel es un componente de React: se fija leyendo su fuente sin
// comentarios; lo que OFRECE y ESCRIBE sale de funciones puras de lib/ai-step-armar.ts y lib/ai-step-ensayo.ts, que
// se EJECUTAN acá y en tests/ai-step-armar.test.ts / tests/ai-step-ensayo.test.ts.

const EDITOR = 'app/automations/EditorPasoIA.tsx';
/** El panel (`EditorPasoIA` y lo que dibuja), sin comentarios: desde su firma hasta el fin del archivo. */
const panel = (): string => { const s = sinComentarios(leer(EDITOR)); return s.slice(s.indexOf('export function EditorPasoIA(')); };

test('el editor: CUATRO pasos, en este orden (Objetivo · Escenarios · Responde con · Ensayar)', () => {
  const pasos = [...panel().matchAll(/<PasoAIStep n=\{(\d)\} titulo="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`);
  assert.deepEqual(pasos, ['1 Objetivo', '2 Escenarios', '3 Responde con', '4 Ensayar']);
});

test('UN solo campo de texto libre en el panel: el objetivo (con dictar); el ensayo es aparte', () => {
  const p = panel();
  // Contados en el panel (el modal del ensayo vive en su archivo: ahí contesta la persona, y eso se escribe).
  const textareas = p.match(/<textarea\b/g) ?? [];
  const inputs = p.match(/<input\b/g) ?? [];
  assert.equal(textareas.length + inputs.length, 1, `hay ${textareas.length} textarea y ${inputs.length} input en el panel del AI Step`);
  assert.match(p, /<textarea value=\{objetivo\} [^>]*aria-label="Objetivo" onChange=\{\(e\) => cambiar\(\{ objetivo: e\.target\.value \}, false\)\}/);
  assert.match(p, /<BotonDictar titulo="Dictar el objetivo"/);
  // Ni el nombre, ni el «cuándo», ni el «cómo responder» se escriben: no hay `onChange` que los toque.
  assert.doesNotMatch(p, /titulo: e\.target|cuando: e\.target|responder: e\.target/);
  // El ensayo SÍ tiene su texto (la persona corrige a MaKo): vive en el modal, no en el panel.
  assert.match(sinComentarios(leer('app/automations/ModalEnsayoAIStep.tsx')), /<textarea value=\{corrigiendo\}/);
});

test('la libertad es un DESPLEGABLE por escenario con las tres opciones, y las que no puede tener van deshabilitadas', () => {
  const p = panel();
  // Las opciones salen de `opcionesDeLibertad` (= `libertadesPermitidas`, la regla de Publicar y del motor) y lo que se
  // elige lo escribe `conLibertadDe` (`conLibertad`, la única que escribe `sola`/`no_contesta`).
  assert.match(p, /<Dropdown value=\{libertadDeCaso\(c\)\} options=\{conIconos\(opcionesDeLibertad\(c\)\)\}[\s\S]*?onChange=\{\(v\) => setCasos\(conLibertadDe\(casos, c\.id, v as Libertad\)\)\}/);
  assert.match(p, /<Dropdown value=\{loDemas\} options=\{conIconos\(OPCIONES_LO_DEMAS\)\}/);
  assert.match(sinComentarios(leer(EDITOR)), /ops\.map\(\(o\) => \(\{ value: o\.value, label: o\.label, icono: ICONO_LIBERTAD\[o\.value\], disabled: o\.disabled \}\)\);/);
  // Ejecutado: una que contesta, las tres; con plata, sin «Sola»; sin respuesta, sólo «Sólo te avisa»; «Lo demás», dos.
  const habil = (c: Partial<CasoRespuesta>) => opcionesDeLibertad({ titulo: 'x', cuando: 'y', ...c }).map((o) => `${o.label}${o.disabled ? ' ✗' : ''}`);
  assert.deepEqual(habil({ titulo: 'Confirma', responder: 'Agradece' }), ['Sólo te avisa', 'Para aprobar', 'Sola']);
  assert.deepEqual(habil({ titulo: 'Pregunta el precio', responder: 'En la llamada' }), ['Sólo te avisa', 'Para aprobar', 'Sola ✗']);
  assert.deepEqual(habil({ titulo: 'Se queja', responder: '' }), ['Sólo te avisa', 'Para aprobar ✗', 'Sola ✗']);
  assert.deepEqual(OPCIONES_LO_DEMAS.map((o) => o.label), ['Sólo te avisa', 'Para aprobar']);
  // Lo deshabilitado tampoco se escribe por otro lado.
  const cs = [caso('P', { titulo: 'Precio', responder: 'En la llamada' })];
  assert.equal(conLibertadDe(cs, 'P', 'sola'), cs, 'escribió «Sola» en un escenario que habla de plata');
});

test('se fueron «Hasta», «Te aviso cada vez», «＋ Otro AI Step», los campos de nombre/cuándo/cómo y los textos de ayuda', () => {
  const src = sinComentarios(leer(EDITOR));
  for (const x of ['Hasta', 'Te aviso cada vez', 'Otro AI Step', 'El precio siempre va', 'Cuándo entra', 'Cómo responder', 'Nombre del caso', 'Primero ponle', '¿Qué tiene que lograr?']) {
    assert.ok(!src.includes(x), `el editor todavía dice «${x}»`);
  }
  // Sin texto en un hover: ningún `title=` en el panel salvo el de dictar y el del tacho (que dicen qué hacen).
  assert.deepEqual([...panel().matchAll(/\btitle=\{?["`]([^"`]+)/g)].map((m) => m[1]).filter((t) => !/^Dictar|^Quitar/.test(t)), []);
  // «Guardar respuestas» escribe en el NODO (el AI Step), por `cambiar`, nunca en un escenario.
  assert.match(panel(), /cambiar\(cambioDelEnsayo\(paso, nuevos\), true\);/);
});

test('los textos del editor y del ensayo van de TÚ (sin voseo)', () => {
  for (const f of [EDITOR, 'app/automations/ModalEnsayoAIStep.tsx', 'lib/ai-step-armar.ts', 'lib/ai-step-ensayo.ts']) {
    assert.deepEqual(marcasDeVoseo(sinComentarios(leer(f))), [], f);
  }
});

// ── ROTURAS (10/10/2026) ─────────────────────────────────────────────────────────────────
// Cada pieza rota a mano con un arnés que guarda el original en memoria y lo reescribe al final
// (scratchpad/aistep-roturas.mjs, nunca `git checkout`; verifica que cada archivo vuelva byte a byte).
// «N / 15» = tests de este archivo en rojo. 32 roturas, las 32 cazadas:
//    1. expandir pone lo nuevo ADELANTE del array (corre el índice de todos)      → 2 / 15
//    2. expandir con «sola» invertida                                             → 3 / 15
//    3. el aviso de un caso no va después de su «MaKo contesta»                   → 2 / 15
//    4. expandir deja la marca `paso_ia` (no es idempotente)                       → 3 / 15
//    5. la guía sin el tono                                                       → 4 / 15
//    6. `escenariosDeRespuesta` sin expandir adentro                              → 2 / 15
//    7. el saneo pierde la respuesta de un caso                                   → 1 / 15
//    8. el saneo pierde la marca del nodo                                         → 1 / 15
//    9. el saneo guarda lo de adentro también en un «Si responde» de siempre      → 1 / 15
//   10. Publicar deja pasar un caso que no hace nada                              → 2 / 15
//   11. sin la regla «debajo de un AI Step no van tarjetas»                       → 1 / 15
//   12. «avisarme» no cuenta como hacer algo                                      → 4 / 15
//   13. el conversor pliega una tarjeta a la que llega otro caso                  → 1 / 15
//   14. el conversor con «sola» invertida                                         → 1 / 15
//   15. el conversor pliega un «Otra cosa» que contesta                           → 1 / 15
//   16. el caso enseñado por la API cuelga una tarjeta                            → 1 / 15
//   17. el lienzo dibuja el AI Step como «Si responde»                            → 1 / 15
//   18. el ＋ ofrece un segundo AI Step                                            → 1 / 15
//   19. el ＋ engancha el AI Step en su salida                                     → 1 / 15
//   20. el click derecho crea un segundo AI Step                                  → 1 / 15
//   21. el AI Step nace sin casos                                                 → 1 / 15
//   22. «Probar»: `siguiente` sin expandir                                        → 1 / 15
//   23. «Probar»: `entrarEnRespuesta` sin expandir                                → 2 / 15
//   24. el motor recorre sin expandir                                             → 1 / 15
//   25. el panel abre el editor de «Si responde» sobre un AI Step                 → 1 / 15
//   26. el título del AI Step dice CONDITION                                      → 1 / 15
//   27. el nombre del AI Step lleva su primer caso al lado                        → 1 / 15
//   28. «Otra cosa» se rotula «Si no»                                             → 1 / 15
//   29. el editor del AI Step sin su alto                                         → 1 / 15
//   30. la fila de un caso sin terminar no se marca                               → 1 / 15 (no se cazaba en la
//       primera pasada: todos los casos de `conIA` estaban completos; se sumó el caso a medias de la tarjeta)
//   31. «Crear con IA» cuelga un caso nuevo del AI Step                           → 1 / 15
//   32. «Crear con IA» cuelga algo de una salida del AI Step nombrada por su id   → 1 / 15
// UNDÉCIMA (11/10/2026): 10 y 12 rompían «no contesta ni avisa» (se fue: sin respuesta es «Sólo te avisa»), y 18,
// 20 y 21 son ahora lo que se PIDE (uno por medio; nace sin escenarios). Sus reemplazos y las roturas nuevas (el
// aviso derivado, el objetivo del nodo, el tope de uno, juntar) están en tests/ai-step-unico.test.ts; acá, U1-U3:
//   U1 la expansión lee `avisar` en vez de derivarlo                             → 2 / 15 (y ai-step-unico 1 / 12)
//   U2 vuelve el tope de varios AI Step por medio (2)                            → 2 / 15 (y ai-step-unico 2 / 12)
//   U3 «enseñar un caso» no escribe la libertad (conserva `avisar`)              → 1 / 15 (y ai-step-unico 1 / 12)
//   (Se midió también «el conversor deja Sola a un caso que habla de plata»: 0 rojos en los cinco archivos, porque
//   `juntarPasosIA` ya la baja al final. La copia del conversor estaba muerta y se borró: queda UNA regla.)
// UNDÉCIMA, EL EDITOR (11/10/2026, w2-aistep-editor; arnés wf-undecima/w2-aistep-editor/roturas.cjs: una rotura por
// vez, corre los SEIS archivos del paquete —éste, automations-paso-ia-revision, ai-step-armar, ai-step-ensayo, flujo-ia
// y flujo-ia-arreglos: 100 tests—, restaura DE MEMORIA y verifica byte a byte; base 100 / 0, al final igual). «N / 100»
// = tests en rojo entre los seis:
//   E1 un SEGUNDO campo de texto libre en el panel (un <input> con el «cuándo» de cada escenario) → 1 / 100 (cae «UN solo
//      campo de texto libre»)
//   E2 «Guardar respuestas» escribe en el primer ESCENARIO y no en el nodo → 2 / 100 (éste y ai-step-ensayo)
//   E3 `opcionesDeLibertad` no deshabilita nada                               → 1 / 100
//   E4 `conLibertadDe` escribe una libertad que el escenario no puede tener   → 2 / 100 (éste y ai-step-armar)
//   E5 vuelve un «Hasta» al panel                                             → 1 / 100
//   E6 un quinto paso («Libertad»)                                            → 1 / 100
