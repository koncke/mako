// =============================================================================
// Fathom sin fricción: «Cargar» sin IA, el cruce en el server, leer en segundo plano y las no leídas
// =============================================================================
// 16/10/2026, decisión 7 de «hacer el kanban un kanban». Martín, textual: «optimiza la velocidad de
// importación de tareas de Fathom... Que hoy en día tardan un montón porque "cruzan" con las otras
// tareas... Quiero que elimines eso y toda la fricción. Quiero hacerlo "libre", que se creen sin
// prioridad». Y Mauricio (12/10): «que se ejecute de manera automática, pero que no se cargue al
// Kanban… que tú decidas si las quieres cargar» y «que extraiga más rápido».
//
// Lo que fija, una decisión por bloque:
//   · «Cargar» un borrador (aplicarPropuestas) NO llama a ninguna IA, en los dos tableros: las
//     tareas nacen con score 0 («Sin priorizar») en «Por iniciar», el proyecto sale sin modelo y lo
//     que no tiene ninguno va a la bandeja «Sin proyecto». MEDIDO con el código de antes sobre el
//     mismo borrador: 3 llamadas en el cliente y 4 en el dueño (3 y 5 intentos de red). Ahora 0.
//   · El cruce con IA contra el tablero corre en el CRON, después de `crearPropuesta`, y SELLA el
//     borrador (`cruzado_at`); si falla o no entra en el reloj, no sella y lo levanta el barrido. Y
//     «Agregar» carga un borrador sin sellar igual (no espera nunca al cruce).
//   · Leer una reunión a mano (`/api/plan-fathom` `extraer`) contesta ANTES de leer: el borrador
//     queda en «procesando» y la lectura sigue en `after()`.
//   · Las reuniones que el cron NO leyó (descartadas por tipo, o con la lectura fallida) quedan
//     escritas (mig 0300) y la ruta las devuelve para la lista «Sin leer» con «Leer igual».
//
// Las funciones REALES corren en un node aparte (tests/_fathom-carga-hijo.ts, `server-only`) contra
// un PostgREST de mentira, y la RUTA de verdad con `after()` de mentira.
//
// ⚠️ PROBADO ROMPIÉNDOLO (16/10/2026): doce roturas, doce cazadas. La lista, con cuántos tests tiró
// cada una, al final de este archivo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { destinoSinIA, esProyectoBandeja, PROYECTO_SIN_PROYECTO } from '../lib/plan-bandeja';
import { aplicarCruces, candidatasDelCruce, conCruceGuardado, PREFIJO_BORRADOR } from '../lib/cruce-borrador';
import { motivoDelTipo, clasificarReunion } from '../lib/reunion-clasificar';
import type { FathomMeeting } from '../lib/fathom-api';
import type { PropuestaTarea } from '../lib/plan-propuesta';

const RAIZ = join(__dirname, '..');
const leer = (...p: string[]) => readFileSync(join(RAIZ, ...p), 'utf8');

type Creada = { titulo: string; score: number; estado: string; proyectos: string[] };
type ResCruce = { sellado: boolean; marcadas: number; conIA: boolean; motivo?: string };
type TareaCruce = { titulo: string; enriquece: { id: string; confianza: string } | null; incluir: boolean | null };

const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_fathom-carga-hijo.ts'), 'todo'], {
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as {
  cliente: { r: { ok: boolean; ids: string[]; ampliadas: number }; ia: string[]; sinCruzarAntes: boolean; creadas: Creada[]; categorias: string[]; ampliada: string; borrador: string };
  dueno: { r: { ok: boolean; ids: string[]; ampliadas: number }; ia: string[]; creadas: Creada[]; proyectos: string[]; ampliada: string };
  cruceOk: { r: ResCruce; ia: number; pedido: { candidatas: number; universo: number; conReloj: boolean }; cruzadoAt: string | null; tareas: TareaCruce[] };
  cruceFalla: { r: ResCruce; ia: number; cruzadoAt: string | null; tareas: TareaCruce[] };
  cruceSinReloj: { r: ResCruce; ia: number; cruzadoAt: string | null };
  cruceVacio: { r: ResCruce; ia: number; cruzadoAt: string | null };
  barrido: { r: { cruzados: number; fallidos: number }; ia: number; pb1: string | null; pb2: string | null };
  cargaSinCruce: { r: { ok: boolean; ampliadas: number }; ia: number; tareas: number };
  extraer: { status: number; j: { ok: boolean; procesando?: boolean; borradorId?: string; tareas?: unknown }; ms: number; despues: number; fathomAntes: number; iaAntes: number; estado: string | null; candado: string };
  extraerOtraVez: { j: { borradorId?: string; procesando?: boolean }; despues: number };
  trasLeer: { estado: string | null; resumen: string | null; candado: string; ia: number; fathom: number };
  sondeo: { estado: string; sinCompromisos: boolean | null };
  cruzarViejo: { status: number; ia: number };
  carrera: { mismo: boolean; estado: string | null; n: number };
  descartadas: {
    anotadas: number | null; falla: boolean; otraVez: number | null; filas: number; motivo11: string | null;
    lista: Array<{ id: number; tipo: string }>; okRuta: boolean | null;
    enRuta: Array<{ id: number; tipo: string; motivo: string }>; trasLeer: number[]; leida11: boolean;
  };
  cron: {
    borradorDuranteElCruce: boolean | null;
    r: { miradas: number; alPlan: number; conTareas: number; cruzados: number; descartadasAnotadas: number | null };
    cruces: number;
    b901: { estado: string; cruzado: boolean; primera: { id: string; confianza: string } | null; incluir0: boolean | null } | null;
    noLeidas: Array<{ id: number; tipo: string; motivo: string }>;
    candados: string[];
  };
  r1: { modal: { procesando?: boolean; borradorId?: string } | null; encoladas: number; estado: string | null; sondeo: string; sinCompromisos: boolean | null };
  r2: { mismoBorrador: boolean; relanzadas: number; cron: { nuevas: number; conTareas: number }; mismaFila: boolean; estado: string | null; n: number; filas: number };
  r3: { duranteElCruce: { estado: string } | null; vista: { estado: string; cruzado: boolean; enriquece0: string | null }; cruces: number };
  r4: { estado: string | null; cruces: number; selloViejo: boolean; cruzado: boolean; enriquece0: string | null; trasFallarElCruce: { estado: string | null; cruzadoAt: string | null } };
  r5: { errores: number; cerrada4747: boolean; sinLeer4747: string | null; cerrada4848: boolean; leida4848: boolean };
  r6: { guardo: boolean; trasAutosave: string | null; ampliadas: number; creadas: number; tablero: string[] };
  r7: { activo: boolean; conFathomPausado: boolean; pausado: boolean; sinFathom: boolean; noExiste: boolean };
  sinMock: string[];
};

// ── 1) «Cargar» sin IA ─────────────────────────────────────────────────────────

test('«Cargar» un borrador NO llama a ninguna IA, en los dos tableros', () => {
  // La medición del pedido. Con el código de antes, el mismo borrador hacía 3 llamadas en el
  // cliente (ruteo del Perro + el Perro por tandas + checklists) y 4 en el dueño.
  assert.deepEqual(R.cliente.ia, [], 'el cliente no tiene que hablar con ningún proveedor al cargar');
  assert.deepEqual(R.dueno.ia, [], 'el dueño tampoco');
  assert.equal(R.cliente.r.ok, true);
  assert.equal(R.dueno.r.ok, true);
  // El mock conoce todo lo que la carga lee (si no, la cuenta de 0 podría ser un camino cortado).
  assert.deepEqual(R.sinMock.filter((t) => t !== 'mako_knowledge'), [], `tablas sin mock: ${R.sinMock.join(', ')}`);
});

test('las tareas nacen LIBRES: score 0 («Sin priorizar») y en «Por iniciar», aunque la reunión sugiriera prioridad', () => {
  for (const t of [...R.cliente.creadas, ...R.dueno.creadas]) {
    assert.equal(t.score, 0, `«${t.titulo}» tiene que nacer sin prioridad (traía alta/media/baja de la extracción)`);
    assert.equal(t.estado, 'por_hacer', `«${t.titulo}» tiene que nacer en «Por iniciar»`);
  }
  assert.equal(R.cliente.creadas.length, 3);
  assert.equal(R.dueno.creadas.length, 3);
});

test('el proyecto sale SIN IA: el que existe se respeta y lo demás va a la bandeja «Sin proyecto»', () => {
  const proy = (cs: Creada[], titulo: string) => cs.find((c) => c.titulo === titulo)?.proyectos;
  // cliente
  assert.deepEqual(proy(R.cliente.creadas, 'Subir los tres videos nuevos'), ['Anuncios'], 'el proyecto que propuso la reunión y existe');
  assert.deepEqual(proy(R.cliente.creadas, 'Escribir el guion del webinar'), [PROYECTO_SIN_PROYECTO], 'un nombre inventado NO abre un proyecto');
  assert.deepEqual(proy(R.cliente.creadas, 'Llamar al contador por la factura'), [PROYECTO_SIN_PROYECTO], 'sin proyecto → bandeja (nunca suelta)');
  assert.deepEqual(R.cliente.categorias.filter(esProyectoBandeja).length, 1, 'UNA bandeja, no una por tarea');
  assert.ok(!R.cliente.categorias.includes('Webinar Diciembre Especial'), 'el nombre inventado no nació');
  // dueño
  assert.deepEqual(proy(R.dueno.creadas, 'Sumar el campo de origen al lead'), ['Feature: CRM']);
  assert.deepEqual(proy(R.dueno.creadas, 'Diseñar el tablero de la ventana'), [PROYECTO_SIN_PROYECTO]);
  assert.deepEqual(proy(R.dueno.creadas, 'Revisar los permisos del equipo'), [PROYECTO_SIN_PROYECTO]);
  assert.equal(R.dueno.proyectos.filter(esProyectoBandeja).length, 1);
  assert.ok(!R.dueno.proyectos.includes('Ventana Mágica Inventada'));
});

test('el anti-duplicado sin IA se queda: la que ya está en el tablero se AMPLÍA, no se duplica', () => {
  assert.equal(R.cliente.r.ampliadas, 1);
  assert.match(R.cliente.ampliada, /Mauricio pidió otro gancho/);
  assert.equal(R.dueno.r.ampliadas, 1);
  assert.match(R.dueno.ampliada, /etapas vacías/);
  assert.equal(R.cliente.borrador, 'aplicada');
});

// ── 2) El cruce, en el server ─────────────────────────────────────────────────

test('el CRON cruza el borrador recién creado y lo SELLA (el modal ya no cruza nada)', () => {
  const c = R.cron;
  assert.equal(c.r.miradas, 3);
  assert.equal(c.r.alPlan, 2, 'la de ventas no va al plan');
  assert.equal(c.r.conTareas, 1);
  assert.equal(c.cruces, 1, 'UNA llamada de cruce, la del borrador nuevo');
  assert.equal(c.r.cruzados, 1);
  assert.ok(c.b901, 'la reunión de equipo dejó su borrador');
  assert.equal(c.b901!.estado, 'pendiente', 'el borrador espera: Mauricio decide qué cargar');
  assert.equal(c.b901!.cruzado, true, 'sale del cron con `cruzado_at`');
  // Actualizado A PROPÓSITO el 16/10/2026 (revisión adversarial): el cruce corre ANTES de crear el
  // borrador, no después — cruzado después, pasaba hasta un minuto «pendiente» sin cruzar y un modal
  // que lo abría en ese minuto cargaba la duplicada.
  assert.equal(c.borradorDuranteElCruce, false, 'mientras el modelo cruza, el borrador todavía no se ve');
  assert.equal(c.b901!.primera?.id, '500', 'lo que ya está en el tablero viene marcado');
  assert.equal(c.b901!.incluir0, false, 'con confianza alta, destildada');
  assert.deepEqual(c.candados, ['libre', 'libre'], 'el candado de lectura se suelta siempre (también en la que falló)');
});

test('cruzarBorrador: marca lo que ya está, sólo la confianza ALTA destilda, y no mira las de otra persona', () => {
  const c = R.cruceOk;
  assert.equal(c.r.sellado, true);
  assert.ok(c.cruzadoAt, 'sella `cruzado_at`');
  assert.equal(c.r.marcadas, 2);
  assert.equal(c.ia, 1);
  assert.equal(c.pedido.candidatas, 3, 'la de otra persona no entra al cruce');
  assert.equal(c.pedido.universo, 2, 'contra las dos abiertas del tablero');
  assert.equal(c.pedido.conReloj, true, 'el reloj del cron viaja hasta la llamada');
  const [alta, media, nueva, deOtro] = c.tareas;
  assert.equal(alta.enriquece?.id, '500'); assert.equal(alta.incluir, false);
  assert.equal(media.enriquece?.id, '501'); assert.notEqual(media.incluir, false, 'media avisa pero NO esconde la tarea');
  assert.equal(nueva.enriquece, null);
  assert.equal(deOtro.enriquece, null);
});

test('cruzarBorrador: si la IA falla NO sella (lo reintenta el barrido); sin reloj no arranca; sin nada contra qué, sella sin IA', () => {
  assert.equal(R.cruceFalla.r.sellado, false);
  assert.equal(R.cruceFalla.cruzadoAt, null, '«todavía no se cruzó» no es «se cruzó y no encontró nada»');
  assert.ok(R.cruceFalla.tareas.every((t) => t.enriquece == null && t.incluir == null), 'las tareas quedan como estaban');
  assert.equal(R.cruceSinReloj.ia, 0, 'no se arranca una llamada que no va a terminar');
  assert.equal(R.cruceSinReloj.cruzadoAt, null);
  assert.equal(R.cruceVacio.ia, 0);
  assert.equal(R.cruceVacio.r.sellado, true);
  assert.ok(R.cruceVacio.cruzadoAt);
});

test('el barrido del cron cruza sólo los pendientes SIN sello', () => {
  assert.equal(R.barrido.r.cruzados, 1);
  assert.equal(R.barrido.ia, 1, 'el sellado no se vuelve a pagar');
  assert.ok(R.barrido.pb1, 'el que faltaba quedó sellado');
  assert.equal(R.barrido.pb2, '2026-10-16T10:00:00Z', 'el sellado no se tocó');
});

test('«Agregar» NO espera al cruce: un borrador sin sellar carga igual, y sin IA', () => {
  assert.equal(R.cliente.sinCruzarAntes, true, 'el borrador de la carga no estaba cruzado');
  assert.equal(R.cargaSinCruce.r.ok, true);
  assert.equal(R.cargaSinCruce.ia, 0);
  assert.equal(R.cargaSinCruce.r.ampliadas, 1, 'el anti-duplicado del server hizo su parte');
  assert.equal(R.cargaSinCruce.tareas, 3, 'dos que ya estaban + una nueva: ninguna duplicada');
});

test('el modal no cruza ni espera: ni `cruzar`, ni «Agregar» atado al cruce', () => {
  const recibidas = leer('app', 'plan', 'board', 'TareasRecibidasModal.tsx');
  const extraer = leer('app', 'plan', 'board', 'ReunionExtractModal.tsx');
  for (const [nombre, src] of [['TareasRecibidasModal', recibidas], ['ReunionExtractModal', extraer]] as const) {
    assert.doesNotMatch(src, /action:\s*'cruzar'/, `${nombre} no llama al cruce desde el navegador`);
  }
  const boton = recibidas.match(/onClick=\{\(\) => void aplicar\(\)\} disabled=\{([^}]*)\}/);
  assert.ok(boton, 'encontré el botón «Agregar»');
  assert.doesNotMatch(boton![1], /cruz/i, '«Agregar» no se apaga mientras se cruza');
  // La RUTA tampoco lo ofrece (lo prueba el hijo: 400 y ninguna IA).
  assert.equal(R.cruzarViejo.status, 400);
  assert.equal(R.cruzarViejo.ia, 0);
});

test('el alta desde el modal de una reunión (BoardShell) también nace libre y sin el Perro', () => {
  const src = leer('app', 'plan', 'board', 'BoardShell.tsx');
  const ini = src.indexOf('const crearDesdeReunion');
  assert.ok(ini > 0);
  const cuerpo = src.slice(ini, src.indexOf('\n  };', ini));
  assert.doesNotMatch(cuerpo, /priorizarNuevas!?\(/, 'el Perro no corre al crear desde una reunión');
  assert.match(cuerpo, /score:\s*0/, 'nacen con score 0');
});

// ── 3) Leer una reunión a mano, en segundo plano ──────────────────────────────

test('`extraer` contesta ANTES de leer: borrador «procesando» y la lectura en `after()`', () => {
  const e = R.extraer;
  assert.equal(e.status, 200);
  assert.equal(e.j.ok, true);
  assert.equal(e.j.procesando, true);
  assert.ok(e.j.borradorId, 'devuelve el borrador para sondear');
  assert.equal(e.j.tareas, undefined, 'no trae tareas: todavía no leyó');
  assert.equal(e.despues, 1, 'la lectura quedó en `after()`');
  assert.equal(e.fathomAntes, 0, 'ni siquiera pidió la grabación antes de contestar');
  assert.equal(e.iaAntes, 0);
  assert.equal(e.estado, 'procesando');
  assert.equal(e.candado, 'tomado', 'tomó el candado de lectura (el cron no la lee a la vez)');
});

test('`extraer` otra vez mientras se lee: el MISMO borrador, sin una segunda lectura', () => {
  assert.equal(R.extraerOtraVez.j.borradorId, R.extraer.j.borradorId);
  assert.equal(R.extraerOtraVez.j.procesando, true);
  assert.equal(R.extraerOtraVez.despues, 1, 'no se encoló otra lectura');
});

test('al terminar en segundo plano: el borrador dice lo que pasó y el candado se suelta', () => {
  assert.ok(R.trasLeer.fathom > 0, 'la lectura corrió (en `after()`)');
  assert.equal(R.trasLeer.estado, 'fallado', 'sin compromisos queda en «fallado» (se puede volver a leer), no «descartada»');
  assert.match(R.trasLeer.resumen ?? '', /Sin compromisos/);
  assert.equal(R.trasLeer.candado, 'libre');
  assert.equal(R.sondeo.estado, 'fallado');
  assert.equal(R.sondeo.sinCompromisos, true, 'el sondeo del modal lo distingue de un error');
});

test('la carrera: si el cron termina primero la reunión que el modal dejó «procesando», la LLENA', () => {
  assert.equal(R.carrera.mismo, true);
  assert.equal(R.carrera.estado, 'pendiente');
  assert.equal(R.carrera.n, 1, 'antes devolvía el id y el borrador quedaba vacío para siempre');
});

// ── 4) Las que el cron no leyó, a la vista ────────────────────────────────────

test('las descartadas por tipo y las que fallaron quedan ESCRITAS, con su motivo', () => {
  const d = R.descartadas;
  assert.equal(d.anotadas, 2, 'ventas y otra; la de equipo NO es una descartada');
  assert.equal(d.falla, true);
  assert.equal(d.filas, 3);
  assert.equal(d.motivo11, 'motivo 11', 'la corrida siguiente no reescribe el motivo (idempotente)');
  assert.deepEqual(d.lista.map((x) => x.id), [12, 11, 14], 'de la más nueva a la más vieja');
  // El cron, de punta a punta: la de ventas y la que falló entera.
  assert.deepEqual(R.cron.noLeidas.map((x) => [x.id, x.tipo]), [[902, 'ventas'], [903, 'fallo']]);
  assert.match(R.cron.noLeidas[0].motivo, /prospecto/);
  assert.equal(R.cron.r.descartadasAnotadas, 1);
});

test('la ruta las ofrece para «Sin leer» (sin las que ya tienen borrador) y «Leer igual» las saca', () => {
  const d = R.descartadas;
  assert.equal(d.okRuta, true);
  assert.deepEqual(d.enRuta.map((x) => x.id), [11, 14], 'la 12 ya tiene borrador: se leyó por otro lado');
  assert.equal(d.enRuta.find((x) => x.id === 14)?.tipo, 'fallo');
  assert.deepEqual(d.trasLeer, [14], '«Leer igual» la saca de la lista');
  assert.equal(d.leida11, true, 'queda `leida_at`: no se borra');
});

test('motivoDelTipo dice QUÉ correo decidió, por el mismo camino que clasificarReunion', () => {
  const meet = (externos: string[], extra: Partial<{ recorded_by: { email: string } }> = {}) =>
    ({ recording_id: 1, calendar_invitees: externos.map((email) => ({ email, is_external: true })), ...extra }) as unknown as FathomMeeting;
  const leads = new Map([['pro@x.com', { estado_lead: 'abierto' }], ['cli@x.com', { estado_lead: 'ganado' }]]);
  const equipo = new Set(['ana@mako.com']);
  const casos: Array<[FathomMeeting, RegExp]> = [
    [meet(['pro@x.com']), /pro@x\.com.*prospecto/],
    [meet(['cli@x.com']), /cli@x\.com es cliente tuyo/],
    [meet([], { recorded_by: { email: 'ana@mako.com' } }), /ana@mako\.com es de tu equipo/],
    [meet(['a@z.com', 'b@z.com', 'c@z.com', 'd@z.com']), /No reconocí a nadie: a@z\.com, b@z\.com, c@z\.com y 1 más no son/],
    [meet([]), /No tiene invitados/],
  ];
  for (const [m, re] of casos) {
    assert.match(motivoDelTipo(m, leads, equipo), re);
  }
  // Y dice lo mismo que el veredicto: el motivo de una «ventas» habla de un prospecto.
  assert.equal(clasificarReunion(casos[0][0], leads, equipo), 'ventas');
  assert.equal(clasificarReunion(casos[3][0], leads, equipo), 'otra');
});

// ── 5) La regla pura ──────────────────────────────────────────────────────────

test('destinoSinIA: texto → existente → catálogo → cliente de la reunión → bandeja', () => {
  const base = { existe: (n: string) => n === 'Anuncios', delCatalogo: (n: string) => (n.toLowerCase() === 'ventas' ? 'Ventas' : undefined), esClienteDeLaReunion: (n: string) => n.startsWith('Cliente:') };
  assert.equal(destinoSinIA({ ...base, deTexto: { nombre: 'Cliente: Esquer', via: 'cliente-en-texto' }, propuesto: 'Anuncios' }).nombre, 'Cliente: Esquer', 'lo que nombra la tarea manda');
  assert.equal(destinoSinIA({ ...base, propuesto: 'Anuncios' }).via, 'existente');
  assert.deepEqual([destinoSinIA({ ...base, propuesto: 'ventas' }).nombre, destinoSinIA({ ...base, propuesto: 'ventas' }).via], ['Ventas', 'catalogo']);
  assert.equal(destinoSinIA({ ...base, propuesto: 'Cliente: Nuevo' }).via, 'cliente-de-la-reunion');
  const inventado = destinoSinIA({ ...base, propuesto: 'Webinar Diciembre Especial' });
  assert.equal(inventado.nombre, PROYECTO_SIN_PROYECTO);
  assert.match(inventado.razon, /Webinar Diciembre Especial/, 'el nombre propuesto queda escrito en el historial');
  assert.equal(destinoSinIA({ ...base }).via, 'bandeja');
  // la bandeja nunca es un destino «elegido»
  assert.equal(destinoSinIA({ ...base, existe: () => true, propuesto: 'sin proyecto' }).via, 'bandeja');
});

test('aplicarCruces casa por TÍTULO normalizado y respeta lo que ya decidió la persona', () => {
  const frescas: PropuestaTarea[] = [
    { titulo: 'Rehacer el creativo' },
    { titulo: 'Otra', enriquece: { id: '9', razon: 'la marcó la persona', confianza: 'media' } },
    { titulo: 'De Ana', esDeOtro: true },
  ];
  const cand = candidatasDelCruce(frescas);
  assert.deepEqual(cand.map((t) => t.titulo), ['Rehacer el creativo'], 'sólo las propias sin marca');
  const { tareas, marcadas } = aplicarCruces(
    // reordenadas y con otra grafía: el índice del modelo apunta a las candidatas, la escritura casa por título
    [{ titulo: 'De Ana', esDeOtro: true }, { titulo: 'REHACER el creativo ' }, frescas[1]],
    cand, [{ i: 0, idExistente: `${PREFIJO_BORRADOR}0`, razon: '', confianza: 'alta' }],
    [{ id: `${PREFIJO_BORRADOR}0`, titulo: 'Rehacer el creativo (de la otra grabación)' }],
  );
  assert.equal(marcadas, 1);
  assert.equal(tareas[1].enriquece?.id, '', 'una de OTRO borrador no es una tarjeta: sin id');
  assert.match(tareas[1].enriquece?.razon ?? '', /la misma reunión ya la trae/);
  assert.equal(tareas[2].enriquece?.razon, 'la marcó la persona', 'no pisa una marca existente');
});

// ── 5) La revisión adversarial (16/10/2026): lecturas que se cruzan, se mueren o se pisan ─────────
// Dos revisores reprodujeron cada caso contra el código de la rama; éstos son esos escenarios,
// corriendo las funciones reales (y la ruta de verdad) contra la base de mentira.

test('la carrera SIN compromisos: la fila «Leyendo…» del modal no queda «procesando» para siempre', () => {
  const x = R.r1;
  assert.equal(x.modal?.procesando, true, 'el modal pidió leerla mientras el cron la leía');
  assert.equal(x.encoladas, 0, 'y no lanzó una segunda lectura (el candado era del cron)');
  assert.equal(x.estado, 'fallado', 'el cron no encontró nada: la fila del modal se entera');
  assert.equal(x.sinCompromisos, true, 'y el sondeo lo dibuja como lectura vacía, no como error');
});

test('una lectura del modal que se MUERE (Vercel la corta) se reintenta: tocándola, o sola en el cron', () => {
  const x = R.r2;
  assert.equal(x.mismoBorrador, true);
  assert.equal(x.relanzadas, 1, 'tocar la fila «Leyendo…» con el candado vencido RELANZA la lectura');
  assert.deepEqual(x.cron, { nuevas: 1, conTareas: 1 }, 'el cron ya no saltea una ref con una fila «procesando» huérfana');
  assert.equal(x.mismaFila, true, 'llena ESA fila, no crea otra');
  assert.equal(x.estado, 'pendiente');
  assert.equal(x.n, 1);
  assert.equal(x.filas, 1);
  // Y el modal: una fila «Leyendo…» llama a `extraer` (el server decide si mira o relanza).
  const modal = leer('app', 'plan', 'board', 'ReunionExtractModal.tsx');
  assert.doesNotMatch(modal, /leyendo && b \? \(\(\) => \{[^}]*esperarBorrador/, 'la fila «Leyendo…» sólo volvía a mirar');
});

test('leer a mano: el modal NUNCA ve el borrador «pendiente» sin cruzar (y lo ve con la marca)', () => {
  const x = R.r3;
  assert.equal(x.cruces, 1);
  assert.equal(x.duranteElCruce?.estado, 'procesando', 'mientras el modelo cruza, el sondeo sigue viendo «Leyendo…»');
  assert.equal(x.vista.estado, 'pendiente');
  assert.equal(x.vista.cruzado, true, 'sale sellado en la misma escritura');
  assert.equal(x.vista.enriquece0, '500', 'y el modal recibe la marca: «ya está en tu plan»');
});

test('«Volver a analizar» un borrador ya sellado: la lectura NUEVA se cruza y se sella de nuevo', () => {
  const x = R.r4;
  assert.equal(x.estado, 'pendiente');
  assert.equal(x.cruces, 1, 'antes: 0 — el sello viejo decía «ya estaba cruzado»');
  assert.equal(x.selloViejo, false);
  assert.equal(x.cruzado, true);
  assert.equal(x.enriquece0, '500');
  assert.deepEqual(x.trasFallarElCruce, { estado: 'pendiente', cruzadoAt: null }, 'sin cruce no hay sello: lo cruza el barrido');
});

test('Fathom que TOSE (503) no cierra la reunión como «sin compromisos»; una vuelta buena la saca de «Sin leer»', () => {
  const x = R.r5;
  assert.equal(x.cerrada4747, false, 'sin `partesFallidas`, un 503 pasajero la cerraba para siempre');
  assert.equal(x.sinLeer4747, 'fallo', 'queda en «Sin leer» y el cron la reintenta');
  assert.equal(x.errores, 1);
  assert.equal(x.cerrada4848, true, 'la leída entera y vacía sí se cierra');
  assert.equal(x.leida4848, true, 'y sale de «Sin leer»: si no, 14 días con «Reintentar» sobre una reunión ya leída');
});

test('el cruce terminó con el modal ABIERTO: su autosave y su «Agregar» no lo borran', () => {
  const x = R.r6;
  assert.equal(x.guardo, true);
  assert.equal(x.trasAutosave, '500', 'el autosave con SUS filas (sin la marca) la borraba');
  assert.equal(x.ampliadas, 1, '«Agregar» con SU copia amplía la que ya está…');
  assert.equal(x.creadas, 0, '…en vez de crear la duplicada');
  assert.equal(x.tablero.length, 1);
});

test('el webhook usa la MISMA vara que el cron: activo y con Fathom conectado', () => {
  assert.deepEqual(R.r7, { activo: true, conFathomPausado: false, pausado: false, sinFathom: false, noExiste: false });
  const hook = leer('app', 'api', 'webhooks', 'fathom', 'route.ts');
  const a = hook.indexOf("wsEnLaRonda('fathom', wsPlan)");
  assert.ok(a > 0, 'el webhook no pregunta si le toca a ese workspace');
  assert.ok(a < hook.indexOf('procesarReunionesNuevas(wsPlan'), 'y lo pregunta ANTES de leer');
});

test('conCruceGuardado: una copia vieja recupera la marca por título; la que trae la suya manda', () => {
  const guardadas: PropuestaTarea[] = [
    { titulo: 'Montar el flujo', enriquece: { id: '500', razon: 'ya está', confianza: 'alta' }, incluir: false },
    { titulo: 'Otra', enriquece: { id: '7', razon: 'r', confianza: 'media' } },
  ];
  const r = conCruceGuardado([
    { titulo: '  MONTAR el flujo ' },                                                           // sin marca → la recupera
    { titulo: 'Otra', enriquece: { id: '9', razon: 'la persona', confianza: 'alta' }, ampliar: false }, // trae la suya → manda
    { titulo: 'Nueva' },                                                                        // no estaba → igual
  ], guardadas);
  assert.equal(r[0].enriquece?.id, '500');
  assert.equal(r[0].incluir, undefined, 'sólo la marca: lo demás es de quien guarda');
  assert.equal(r[1].enriquece?.id, '9');
  assert.equal(r[1].ampliar, false, '«es otra tarea» se respeta');
  assert.equal(r[2].enriquece, undefined);
});

// =============================================================================
// ROTURAS PROBADAS (16/10/2026), base en verde primero (20 de 20), cada una restaurada. Doce
// roturas, doce cazadas (entre paréntesis, cuántos de los 20 cayeron):
//   1. aplicarPropuestas vuelve a llamar al Perro al final (priorizarNuevasCliente/Owner)
//                → cae «NO llama a ninguna IA» (4 de 20: el Perro también ensucia la cuenta de
//                  IA de tres escenarios que corren después en el mismo proceso)
//   2. crearTarea del cliente con `prioridad: t.prioridad ?? 'media'` (como antes)
//                → cae «nacen LIBRES» (1 de 20)
//   3. agregarTareasPlanOwner sin `sinIA` (el ruteo del Perro de siempre)
//                → caen «NO llama a ninguna IA» y «el proyecto sale SIN IA» (2 de 20)
//   4. destinoSinIA aceptando el nombre propuesto aunque no exista
//                → caen «el proyecto sale SIN IA» y «destinoSinIA» (2 de 20)
//   5. reunion-auto sin el cruce (hasta el 16/10 era `cruzarBorrador` DESPUÉS de crearPropuesta; desde
//      la revisión adversarial es `cruzarTareas` ANTES, y lo prueba la rotura F11 de abajo)
//                → cae «el CRON cruza el borrador recién creado» (1 de 20)
//   6. cruzarBorrador sellando también cuando el modelo falló
//                → cae «si la IA falla NO sella» (1 de 20)
//   7. la ruta `extraer` con `await` de la lectura en vez de `after()`
//                → caen «contesta ANTES de leer» y «otra vez mientras se lee» (2 de 20)
//   8. crearPropuesta sin la rama que llena una fila «procesando» → cae «la carrera» (1 de 20)
//   9. procesarReunionesNuevas sin registrarDescartadas / registrarNoLeida
//                → cae «quedan ESCRITAS» (1 de 20)
//  10. la ruta `reuniones` sin filtrar las que ya tienen borrador → cae «la ruta las ofrece» (1 de 20)
//  11. «Agregar» apagado hasta que todos los borradores estén cruzados → cae «el modal no cruza» (1 de 20)
//  12. `extraer` sin `marcarDescartadaLeida` («Leer igual» no la saca) → cae «la ruta las ofrece» (1 de 20)
//
// Y LA REVISIÓN ADVERSARIAL (16/10/2026), base en verde (28 de 28). Doce roturas, doce cazadas, cada
// una en SU test (entre paréntesis, cuántos de los 28 cayeron):
//   F1. `existePropuestaRef` contando las «procesando» → cae «una lectura que se MUERE» (1 de 28)
//   F2. el cron sin `resolverProcesandoSinCompromisos` → cae «la carrera SIN compromisos» (1 de 28)
//   F3. la lectura a mano marcando «pendiente» ANTES de cruzar → cae «leer a mano» (1 de 28)
//   F4. `marcarProcesado` / `ponerProcesando` sin borrar el sello viejo → cae «Volver a analizar» (1 de 28)
//   F5. `extraerTareasDeReunion` sin `partesFallidas` cuando Fathom no contestó → cae «Fathom que TOSE» (1 de 28)
//   F6. la vuelta buena sin `marcarDescartadaLeida` → cae «Fathom que TOSE» (1 de 28)
//   F7. `guardarRevision` sin `conCruceGuardado` → cae «con el modal ABIERTO» (1 de 28)
//   F8. `aplicarPropuestas` sin `conCruceGuardado` → cae «con el modal ABIERTO» (1 de 28)
//   F9. `wsEnLaRonda` sin mirar el estado → cae «el webhook» (1 de 28; daba 0 hasta que el escenario
//       pausó un workspace CON Fathom: el otro pausado decía «no» sólo por no tener claves)
//  F10. el webhook sin `wsEnLaRonda` → cae «el webhook» (1 de 28)
//  F11. el cron creando el borrador ANTES de cruzar → cae «el CRON cruza» (1 de 28)
//  F12. la fila «Leyendo…» que sólo vuelve a mirar → cae «una lectura que se MUERE» (1 de 28)
// =============================================================================
