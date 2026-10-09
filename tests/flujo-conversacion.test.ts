// =============================================================================
// El flujo de conversación dibujado: un ÁRBOL con ramas, que dice lo que el motor HACE
// =============================================================================
// El pedido (Martín, 08/10/2026, puntos 4-7, 9 y 11): la tarjeta del disparador dice CRON
// y el disparador real; ningún mensaje nace con espera; condicionales con ramas «arriba y
// abajo», creadas desde el punto de cada salida (el molde de ManyChat); «Termina si
// agenda» se va porque es una condición como cualquier otra.
//
// Un lienzo tiene una forma de fallar que una lista no tiene: **dibuja una afirmación**.
// Una flecha que se bifurca dice «acá el motor decide», y si el motor no decide, el
// dibujo miente con más autoridad que un campo en un formulario. De ahí el guard de
// `CONDICIONES_VIVAS` contra el `switch` de `cumpleFila`.
//
// PROBADO ROMPIÉNDOLO (08/10/2026; con todo puesto: 13 pasan, 0 fallan). Cada rotura de a
// una, aplicada y restaurada DE MEMORIA por un arnés (nunca con `git checkout`). Pasan / fallan:
//   1. el título del CRON vuelve a 'Se dispara'                                  -> 12 / 1
//   2. `detalleDisparador` dice la etapa aunque el trigger sea de formulario      -> 12 / 1
//   3. el árbol mide el bloque de ramas sin lo que suben (`bloque` sin `sobre`)   -> 12 / 1
//      ⚠️ La primera vez salió CIEGA (13 / 0): el apilado igual cuenta el `sobre`, así
//      que las ramas no se pisaban; lo que se rompía era el CENTRADO. Ahora lo mide.
//   4. el árbol no normaliza a ≥ 0 (sin `aOrigen`)                                -> 12 / 1
//   5. las flechas salen sin su `puerto`                                          -> 12 / 1
//   6. `insertarDesdeLienzo` ignora el puerto (inserta siempre en 'sig')          -> 12 / 1
//   7. un mensaje nuevo nace con `delay_horas: 24`                                -> 12 / 1
//   8. Publicar sin `validarGrafo` antes del PATCH                                -> 12 / 1
//   9. vuelve el botón «Cambiar a una etapa» a SecuenciaPerfil                    -> 12 / 1
//  10. `seccionesDisparo` ofrece `manual` (no inscribe a nadie)                   -> 12 / 1
//  11. `CONDICIONES_VIVAS` pierde una condición que `cumpleFila` evalúa           -> 12 / 1
//  12. «Esperar» ofrecido debajo de «Si responde»                                 -> 12 / 1
//  13. SecuenciaPerfil convierte con `legadoAGrafo` también un flujo con ids      -> 12 / 1
//  14. Publicar sin la LIMPIEZA de la estrategia al convertir                     -> 12 / 1
//  15. `errorLegible` deja el id crudo                                            -> 12 / 1
//  16. Publicar sin `faltaEscribir` (sale una tarjeta vacía)                      -> 12 / 1
//  17. `faltaEscribir` da por escrita una nota de voz sin audio                   -> 12 / 1
// Segunda tanda (08/10/2026, parte L: «Si responde» cuelga del CRON y el menú del ＋ suma Email y
// Etiqueta). Con todo puesto 13 / 0; el arnés L-roturas2:
//  18. «Si responde» deja de ser hijo del CRON (`destinosDe` sin `resp`)          -> 12 / 1
//  19. el menú del ＋ sin «🏷️ Etiqueta»                                           -> 12 / 1
// Tercera tanda (09/10/2026, parte B: «Ir a» fuera del ＋, el CRON por pasos y el freno de «Probar»).
// Con todo puesto 15 / 0; arnés b-arnes (en memoria):
//  20. vuelve «↪ Ir a» al menú del ＋                                              -> 14 / 1
//  21. vuelve la sección «Eventos» al desplegable del CRON (y al catálogo plano)   -> 13 / 2
//  22. con UN producto, el paso del producto igual está                            -> 14 / 1
//  23. `frenoDelFlujo` sin `validarGrafo` (sólo mira lo vacío)                     -> 14 / 1
//
// Correr: node --import tsx --test tests/flujo-conversacion.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  grafoDeSecuencia, detalleDisparador, insertarDesdeLienzo, nodoNuevo, opcionesDelMas,
  seccionesDisparo, pedidoDisparo, valorDisparo, errorLegible, faltaEscribir, crearRespuesta, agregarCaso, quitarRama, agregarRama,
  rotuloDisparo, opcionesDeSecciones, frenoDelFlujo, pasosDisparo,
  CONDICIONES_VIVAS, FRASE_CONDICION, ID_ENTRADA, PUERTO_RESPUESTA,
  type PasoParaGrafo, type NodoFlujo,
} from '../lib/flujo-conversacion';
import { MARGEN, centroDeFilas } from '../lib/lienzo-grafo';
import { claseDe, nodoPorId, validarGrafo, raizRespuesta, escenariosDeRespuesta } from '../lib/flujo-grafo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas ANTES que los bloques: un `/*` adentro de un `//` se comería código (AGENTS.md).
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};
const PERFIL = '../app/chatbot/SecuenciaPerfil.tsx';

/** Un rnd determinista: los ids nuevos no dependen de la suerte. */
const rndDe = (semilla = 1) => { let s = semilla; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; };
const msg = (id: string, extra: Partial<PasoParaGrafo> = {}): PasoParaGrafo => ({ id, canal: 'whatsapp', delay_horas: 0, cuerpo: 'hola', siguiente: null, ...extra });
const cond = (id: string, ramas: Array<[string, string | null]>, siNo: string | null): PasoParaGrafo => ({
  id, canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', si_no: siNo,
  ramas: ramas.map(([rid, sig]) => ({ id: rid, modo: 'todas', filas: [{ campo: 'agendo' }], siguiente: sig })),
});
const nodo = (g: { nodos: NodoFlujo[] }, id: string): NodoFlujo => { const n = g.nodos.find((x) => x.id === id); assert.ok(n, `no está el nodo ${id}`); return n; };
const centro = (n: NodoFlujo) => n.y + n.alto / 2;
const sePisan = (a: NodoFlujo, b: NodoFlujo) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.alto && b.y < a.y + a.alto;
const sinPisarse = (g: { nodos: NodoFlujo[] }) => {
  for (let i = 0; i < g.nodos.length; i++) for (let j = i + 1; j < g.nodos.length; j++) {
    assert.ok(!sePisan(g.nodos[i], g.nodos[j]), `${g.nodos[i].id} y ${g.nodos[j].id} se pisan`);
  }
};

// ── 4: la tarjeta del disparador ────────────────────────────────────────────

test('⚠️ la tarjeta del disparador dice CRON y el disparador REAL, no la etapa de la fila', () => {
  // La #198: trigger de formulario con `etapa: 'nutri'` en la fila. La tarjeta de antes
  // afirmaba «El lead cae en «No Agenda»».
  const texto = detalleDisparador({ trigger_tipo: 'instant_form_sin_agenda', etapa: 'nutri', etiquetaTrigger: 'Dejó el formulario sin agendar', nombreEtapa: 'No Agenda' });
  assert.equal(texto, 'Dejó el formulario sin agendar');
  const g = grafoDeSecuencia([msg('a')], { disparador: texto });
  const e = nodo(g, ID_ENTRADA);
  assert.equal(e.titulo, 'CRON');
  assert.equal(e.detalle, 'Dejó el formulario sin agendar');
  // La etapa sólo si el disparador ES de etapa; una etiqueta, si es de etiqueta; el horario manda.
  assert.equal(detalleDisparador({ trigger_tipo: 'etapa_actual', etapa: 'agendado', nombreEtapa: 'Agendado' }), 'Llega a «Agendado»');
  assert.equal(detalleDisparador({ trigger_tipo: 'entrega_actual', etapa: 'onb', nombreEtapa: 'Onboarding' }), 'Llega a «Onboarding»');
  assert.equal(detalleDisparador({ trigger_tipo: 'etiqueta_puesta', nombreEtiqueta: 'Cualificado' }), 'Se le puso «Cualificado»');
  assert.match(detalleDisparador({ trigger_tipo: 'etapa_actual', etapa: 'x', cron: { unidad: 'dia', cada: 1, hora: 9, minuto: 0 }, tz: 'America/Tijuana' }), /Todos los días a las 0?9:00 de America\/Tijuana/);
  // Sin el catálogo, el id del trigger (feo y verdadero), nunca la etapa.
  assert.equal(detalleDisparador({ trigger_tipo: 'no_show_j1', etapa: 'nutri' }), 'no_show_j1');
});

// ── 9: el árbol ─────────────────────────────────────────────────────────────

test('⚠️ el árbol: dos ramas no se pisan, se apilan ARRIBA y ABAJO del puerto, y todo queda en ≥ 0', () => {
  // Una condición con dos ramas y su «si no»; la primera rama lleva un mensaje largo (alto)
  // y la segunda OTRA condición con tres salidas: el subárbol grande no puede pisar al de al lado.
  const pasos: PasoParaGrafo[] = [
    cond('c', [['r1', 'm1'], ['r2', 'c2']], 'm3'),
    msg('m1', { cuerpo: 'x'.repeat(300) }),
    cond('c2', [['s1', 'k1'], ['s2', 'k2']], 'k3'),
    msg('k1'), msg('k2'), msg('k3', { siguiente: 'k4' }), msg('k4'),
    msg('m3'),
  ];
  assert.deepEqual(validarGrafo(pasos), [], 'el fixture tiene que ser un flujo válido');
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  sinPisarse(g);
  // Arriba y abajo del CENTRO DE LAS FILAS de la condición (de donde salen las flechas).
  const c = nodo(g, 'c');
  const yFilas = c.y + centroDeFilas(c.alto, c.puertos!.length);
  assert.ok(centro(nodo(g, 'm1')) < yFilas, 'la primera rama tiene que quedar ARRIBA del puerto');
  assert.ok(centro(nodo(g, 'm3')) > yFilas, 'el «si no» tiene que quedar ABAJO del puerto');
  // Y el bloque de las ramas queda CENTRADO en las filas, contando lo que cada subárbol se
  // extiende hacia arriba (la segunda condición abre sus ramas por encima de su tope). Sin
  // ese alto, las ramas no se pisan igual —el apilado lo cuenta— pero el bloque se corre
  // hacia abajo y las de arriba dejan de estar arriba (rotura 3, que salió CIEGA sin esto).
  const debajo = g.nodos.filter((n) => n.id !== ID_ENTRADA && n.id !== 'c');
  const banda = (Math.min(...debajo.map((n) => n.y)) + Math.max(...debajo.map((n) => n.y + n.alto))) / 2;
  assert.ok(Math.abs(banda - yFilas) < 1, `el bloque de las ramas está centrado en ${banda} y las filas en ${yFilas}`);
  // En el orden de las filas, y a la derecha de su padre.
  assert.ok(nodo(g, 'm1').y < nodo(g, 'c2').y && nodo(g, 'c2').y < nodo(g, 'm3').y);
  for (const [padre, hijo] of [['c', 'm1'], ['c', 'c2'], ['c2', 'k1'], ['k3', 'k4']] as const) {
    assert.ok(nodo(g, hijo).x > nodo(g, padre).x + nodo(g, padre).ancho, `${hijo} no quedó a la derecha de ${padre}`);
  }
  // Normalizado: nada fuera de cuadro, y la esquina en el margen.
  assert.equal(Math.min(...g.nodos.map((n) => n.y)), MARGEN);
  assert.equal(Math.min(...g.nodos.map((n) => n.x)), MARGEN);
  for (const n of g.nodos) {
    assert.ok(n.x + n.ancho <= g.ancho && n.y + n.alto <= g.alto, `${n.id} se sale de la caja`);
  }
});

test('«Si responde» CUELGA DEL CRON: columna 1, debajo de la salida, con su flecha desde su fila (segunda tanda)', () => {
  // Decisión 1 (un solo CRON): hasta el 08/10 «Si responde» iba suelta en la columna del CRON y,
  // sin ella, había una tarjeta fantasma «＋ Si responde». Ahora es la segunda fila del CRON.
  const r = crearRespuesta([msg('a', { siguiente: 'b' }), msg('b')], rndDe());
  const conCaso = agregarCaso(r.pasos, r.id, rndDe(7)).pasos;
  const g = grafoDeSecuencia(conCaso, { disparador: 'X' });
  sinPisarse(g);
  const resp = nodo(g, r.id);
  const e = nodo(g, ID_ENTRADA);
  assert.equal(resp.titulo, 'REPLY');
  assert.equal(resp.x, nodo(g, 'a').x, '«Si responde» va en la columna 1, la de la salida');
  assert.ok(resp.x > e.x + e.ancho, '«Si responde» va a la derecha del CRON');
  const salida = g.nodos.filter((n) => n.id === 'a' || n.id === 'b');
  assert.ok(resp.y > Math.max(...salida.map((n) => n.y + n.alto)), '«Si responde» va abajo de la salida');
  const flecha = g.aristas.find((x) => x.hasta === r.id);
  assert.equal(flecha?.desde, ID_ENTRADA);
  assert.equal(flecha?.puerto, PUERTO_RESPUESTA, 'la flecha sale de la fila «Si responde» del CRON');
  assert.equal(flecha?.sinMas, true, 'nada va antes de «Si responde»: sin el ＋ del medio');
  assert.deepEqual(e.puertos!.map((p) => [p.id, p.rotulo, p.vacio]), [['sig', 'Al entrar', false], [PUERTO_RESPUESTA, 'Si responde', false]]);
  assert.equal(g.nodos.length, conCaso.length + 1, 'una tarjeta por paso y el CRON: no hay fantasma');
  // Sus salidas son los casos y «Otra cosa», en ese orden; el caso nace con «MaKo contesta».
  assert.deepEqual(resp.puertos!.map((p) => p.rotulo), ['Caso sin nombre', 'Otra cosa']);
  const caso = nodoPorId(conCaso, r.id)!.casos![0];
  const contesta = nodoPorId(conCaso, caso.siguiente)!;
  assert.equal(contesta.tipo, 'ia');
  // Tercera tanda (decisión 5): un WhatsApp escrito por MaKo también se titula WHATSAPP.
  assert.equal(nodo(g, contesta.id!).titulo, 'WHATSAPP');
  // Y el motor lo lee como la guía del caso (`escenariosDeRespuesta`), con «Otra cosa» avisando.
  assert.equal(escenariosDeRespuesta(conCaso).length, 1);
  assert.equal((nodoPorId(conCaso, nodoPorId(conCaso, r.id)!.si_no)!.accion as { operacion: string }).operacion, 'avisar_al_equipo');
  // Sin «Si responde» (cuarta tanda, punto 4): el CRON no tiene la fila ni se ofrece crearla, y no
  // hay ninguna tarjeta de más. Lo de arriba es lo que sigue dibujando un flujo que YA la tiene.
  const sin = grafoDeSecuencia([msg('a')], { disparador: 'X' });
  assert.equal(sin.nodos.length, 2, 'volvió la tarjeta fantasma');
  assert.equal(nodo(sin, ID_ENTRADA).puertos!.find((p) => p.id === PUERTO_RESPUESTA), undefined, 'volvió la fila «Si responde» al CRON');
  assert.ok(!opcionesDelMas([msg('a')], ID_ENTRADA, false, PUERTO_RESPUESTA).some((o) => o.value === 'respuesta'), 'el ＋ volvió a ofrecer «Si responde»');
});

test('⚠️ cada flecha sale de SU puerto, y une nodos que existen', () => {
  const pasos = [cond('c', [['r1', 'm1'], ['r2', 'm2']], 'm3'), msg('m1'), msg('m2'), msg('m3')];
  const g = grafoDeSecuencia(pasos, { disparador: 'X' });
  const a = (h: string) => g.aristas.find((x) => x.hasta === h);
  assert.equal(a('c')?.desde, ID_ENTRADA);
  assert.equal(a('c')?.puerto, 'sig');
  assert.equal(a('m1')?.puerto, 'r1');
  assert.equal(a('m2')?.puerto, 'r2');
  assert.equal(a('m3')?.puerto, 'si_no');
  const ids = new Set(g.nodos.map((n) => n.id));
  for (const x of g.aristas) assert.ok(ids.has(x.desde) && ids.has(x.hasta), `${x.desde} → ${x.hasta}`);
  // Una salida vacía se dice: su punto lleva el ＋. Y un mensaje de la salida admite flechas en
  // paralelo (`paralelo`: con el punto ocupado, el lienzo ofrece un ＋ más).
  assert.deepEqual(nodo(g, 'm1').puertos, [{ id: 'sig', vacio: true, paralelo: true }]);
  assert.equal(nodo(g, 'c').puertos!.find((p) => p.id === 'si_no')?.rotulo, 'Si no');
});

test('lo que se fue NO vuelve: ni «Termina si…», ni «Sigue con», ni el tiempo sobre la flecha', () => {
  const g = grafoDeSecuencia([msg('a', { siguiente: 'b' }), msg('b')], { disparador: 'X' });
  assert.ok(!g.nodos.some((n) => n.tipo === 'desenlace' || n.tipo === 'cualifica'), 'volvió el nodo del desenlace');
  assert.ok(!g.aristas.some((x) => x.etiqueta), 'volvió un rótulo sobre la flecha: la espera es una tarjeta');
  // Y lo de antes que haya quedado en un paso de un flujo ya convertido se MARCA, no se esconde.
  const viejo = grafoDeSecuencia([msg('a', { delay_horas: 24 })], { disparador: 'X' });
  assert.ok(nodo(viejo, 'a').advertencia, 'un delay de antes en un flujo convertido se veía igual que nada');
});

// ── el ＋ y lo que crea ──────────────────────────────────────────────────────

test('⚠️ el ＋ de un puerto inserta EN ese puerto, y lo que colgaba pasa a colgar de la tarjeta nueva', () => {
  const pasos = [cond('c', [['r1', 'm1'], ['r2', 'm2']], 'm3'), msg('m1'), msg('m2'), msg('m3')];
  const r = insertarDesdeLienzo(pasos, 'c', 'r2', 'mensaje', rndDe());
  assert.ok(r.id);
  const c = nodoPorId(r.pasos, 'c')!;
  assert.equal(c.ramas![1].siguiente, r.id, 'no entró en la rama que se tocó');
  assert.equal(nodoPorId(r.pasos, r.id)!.siguiente, 'm2', 'lo que colgaba de esa rama se perdió');
  assert.equal(c.ramas![0].siguiente, 'm1', 'tocó la OTRA rama');
  assert.equal(c.si_no, 'm3');
  assert.deepEqual(validarGrafo(r.pasos), []);
  // El «si no», y una salida vacía.
  const s = insertarDesdeLienzo(pasos, 'c', 'si_no', 'esperar', rndDe(2));
  assert.equal(nodoPorId(s.pasos, 'c')!.si_no, s.id);
  assert.equal(nodoPorId(s.pasos, s.id)!.siguiente, 'm3');
  const v = insertarDesdeLienzo(pasos, 'm1', 'sig', 'accion', rndDe(3));
  assert.equal(nodoPorId(v.pasos, 'm1')!.siguiente, v.id);
  // El CRON inserta al principio de la salida.
  const ini = insertarDesdeLienzo([msg('a')], ID_ENTRADA, 'sig', 'condicion', rndDe(4));
  const nueva = nodoPorId(ini.pasos, ini.id)!;
  assert.equal(claseDe(nueva), 'condicion');
  assert.equal(nueva.ramas![0].siguiente, 'a', 'la condición nueva se lleva lo que seguía en su primera rama');
  // Tercera tanda, punto 9: la rama nace SIN filas (la fila «Agendó» de relleno era de donde salían
  // las filas repetidas), y «＋ Rama» igual. Una rama vacía la frena `validarGrafo` hasta elegir una.
  // Rotura (volver a `filas: [{ campo: 'agendo' }]` en las dos): 1 fallo de 1.
  assert.deepEqual(nueva.ramas![0].filas, []);
  const conOtra = agregarRama(ini.pasos, ini.id!, rndDe(6));
  assert.deepEqual(nodoPorId(conOtra, ini.id!)!.ramas!.map((r) => r.filas), [[], []]);
  assert.ok(validarGrafo(conOtra).some((e) => /no tiene ninguna condición/.test(e)));
  // La tarjeta MAKO (tercera tanda, decisión 11) entra en el medio como cualquiera: es el aviso al
  // grupo sobre el lead del evento, y lo que seguía cuelga de ella.
  const mk = insertarDesdeLienzo(pasos, 'c', 'r1', 'mako', rndDe(5));
  assert.equal(nodoPorId(mk.pasos, 'c')!.ramas![0].siguiente, mk.id);
  assert.equal(nodoPorId(mk.pasos, mk.id)!.siguiente, 'm1');
  assert.deepEqual(nodoPorId(mk.pasos, mk.id)!.accion, { operacion: 'avisar_al_equipo', params: { leadId: 'evento', mensaje: '' } });
  // El orden queda renumerado (lo lee `orden`, las métricas por paso).
  assert.deepEqual(r.pasos.map((p) => p.orden), r.pasos.map((_, i) => i + 1));
});

test('⚠️ ningún mensaje nace con espera: la espera es su propia tarjeta (punto 7)', () => {
  const m = nodoNuevo('mensaje', [], rndDe());
  assert.equal(m.delay_horas, 0);
  assert.equal(m.espera, undefined);
  assert.equal(claseDe(m), 'mensaje');
  const r = insertarDesdeLienzo([msg('a')], ID_ENTRADA, 'sig', 'mensaje', rndDe());
  assert.equal(r.pasos.filter((p) => claseDe(p) === 'esperar').length, 0, 'agregar un mensaje agregó una espera');
  assert.ok(r.pasos.every((p) => !(Number(p.delay_horas) > 0)));
  // La espera, cuando se pide, es una tarjeta con su valor (un día) y sin `delay_horas`.
  const e = nodoNuevo('esperar', [], rndDe());
  assert.deepEqual(e.espera, { modo: 'tiempo', minutos: 1440 });
  assert.equal(e.delay_horas, 0);
  // Y la pantalla no crea mensajes por su cuenta con un número fijo: eran DOS lugares.
  assert.doesNotMatch(sinComentarios(leer(PERFIL)), /delay_horas:\s*[1-9]/);
});

test('el menú del ＋: sin «Email» ni «Esperar» debajo de «Si responde», sin «Ir a» en ningún lado, y con MaKo', () => {
  const r = crearRespuesta([msg('a')], rndDe());
  const valores = (o: Array<{ value: string }>) => o.map((x) => x.value);
  // Tercera tanda: «Ir a» ya no se crea (decisión 3) y suma «MaKo» con su logo (decisión 11).
  // Sexta tanda (parte «canales»): Instagram y Messenger, con los mensajes.
  assert.deepEqual(valores(opcionesDelMas(r.pasos, ID_ENTRADA, false)), ['mensaje', 'email', 'instagram', 'messenger', 'esperar', 'condicion', 'etiqueta', 'accion', 'mako']);
  assert.ok(!valores(opcionesDelMas(r.pasos, r.id, false)).includes('esperar'), 'se ofreció esperar en «Si responde»');
  const aviso = nodoPorId(r.pasos, r.id)!.si_no!;
  assert.ok(!valores(opcionesDelMas(r.pasos, aviso, false)).includes('esperar'), 'se ofreció esperar debajo de «Si responde»');
  assert.ok(!valores(opcionesDelMas(r.pasos, aviso, false)).includes('email'), 'se ofreció un email debajo de «Si responde»');
  // Ni Instagram ni Messenger: «Si responde» le contesta por el WhatsApp donde escribió, y el motor lo frena.
  assert.ok(!valores(opcionesDelMas(r.pasos, aviso, false)).some((v) => v === 'instagram' || v === 'messenger'), 'se ofreció Instagram debajo de «Si responde»');
  for (const medio of [false, true]) assert.ok(!valores(opcionesDelMas(r.pasos, 'a', medio)).includes('ir_a' as never), 'volvió «Ir a» al ＋');
  // Cuarta tanda, punto 10: sin emojis (cada renglón con su ícono), «MaKo en WhatsApp», y por grupos
  // separados con una línea: mensajes · tiempo y lógica · CRM · MaKo.
  const menu = opcionesDelMas(r.pasos, 'a', false);
  assert.deepEqual(menu.map((x) => x.label), ['WhatsApp', 'Email', 'Instagram', 'Messenger', 'Esperar', 'Condición', 'Etiqueta', 'Acción', 'MaKo en WhatsApp']);
  assert.deepEqual(menu.map((x) => x.grupo), [0, 0, 0, 0, 1, 1, 2, 2, 3]);
  for (const o of menu) {
    assert.ok(o.icono?.startsWith('data:image/svg+xml'), `${o.label} sin ícono`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(o.label), `${o.label} con emoji`);
  }
});

test('quitar una rama se lleva lo que colgaba de ella (y el flujo sigue válido)', () => {
  const pasos = [cond('c', [['r1', 'm1'], ['r2', 'm2']], 'm3'), msg('m1', { siguiente: 'm4' }), msg('m4'), msg('m2'), msg('m3')];
  const out = quitarRama(pasos, 'c', 'r1');
  assert.deepEqual(out.map((p) => p.id), ['c', 'm2', 'm3']);
  assert.deepEqual(validarGrafo(out), []);
});

// ── Publicar ────────────────────────────────────────────────────────────────

test('⚠️ Publicar VALIDA antes de mandar, y el error nombra la tarjeta como se ve', () => {
  const perfil = sinComentarios(leer(PERFIL));
  const pub = bloque(perfil, 'const publicar = async () => {', '\n  };', 2_400);
  // Tercera tanda (decisión 13): la forma y lo que falta escribir los decide UNA función,
  // `frenoDelFlujo`, que también frena «Probar». El error ABRE la tarjeta (`frenar`, con su id).
  // (Integración: el freno recibe además lo que le falta a cada «⚡ Acción» según su formulario.)
  const valida = pub.indexOf('frenoDelFlujo(pasos, faltanEnAccion)');
  assert.ok(valida >= 0 && valida < pub.indexOf("fetch('/api/whatsapp/secuencias'"), 'se manda sin validar');
  assert.match(pub, /const freno = frenoDelFlujo\(pasos, faltanEnAccion\);\s*if \(freno\) \{ frenar\(freno\.error, freno\.tarjeta\); return; \}/);
  const freno = sinComentarios(leer('../lib/flujo-conversacion.ts'));
  const fn = bloque(freno, 'export function frenoDelFlujo(', '\n}\n', 1_800);
  assert.ok(fn.indexOf('validarGrafo(pasos)') >= 0 && fn.indexOf('validarGrafo(pasos)') < fn.indexOf('faltaEscribir(pasos)'), 'el freno no mira la forma antes que lo vacío');
  assert.match(fn, /return \{ error: errorLegible\(errores\[0\], pasos\), tarjeta: tarjetaDelError\(errores\[0\], pasos\) \}/);
  // Convertida: los pasos Y la estrategia con la LIMPIEZA (el motor viejo no repite lo que hacen
  // las tarjetas). Sin estrategia no se manda nada (lienzo-8, en tests/lienzo-revision.test.ts).
  assert.match(pub, /if \(convertida\) \{\s*const limpia = estrategiaConLimpieza\(est\);\s*if \(limpia\) \{\s*const r = await api\(\{ action: 'guardar-estrategia', secuenciaId: secuencia\.id, estrategia: limpia \}\)/);
  assert.ok(pub.indexOf("fetch('/api/whatsapp/secuencias'") < pub.indexOf('guardar-estrategia'), 'primero los pasos, después la limpieza');
  // Una tarjeta VACÍA no se publica: `validarGrafo` mira la forma y no el contenido, y el
  // «MaKo contesta» con el que nace cada caso de «Si responde» nace sin guía.
  const r = crearRespuesta([msg('a')], rndDe());
  const conCaso = agregarCaso(r.pasos, r.id, rndDe(3));
  assert.deepEqual(faltaEscribir(conCaso.pasos), { id: conCaso.mensaje, error: 'Falta completar «WHATSAPP»' });
  // El freno mira primero la FORMA: un caso sin nombre lo frena `validarGrafo`; con nombre, lo vacío.
  assert.equal(frenoDelFlujo(conCaso.pasos)?.error, 'Un caso de «Si responde» no tiene nombre o descripción');
  const nombrado = conCaso.pasos.map((p) => (p.id === r.id ? { ...p, casos: p.casos!.map((c) => ({ ...c, titulo: 'Precio', cuando: 'Pregunta el precio' })) } : p));
  assert.deepEqual(frenoDelFlujo(nombrado), { error: 'Falta completar «WHATSAPP»', tarjeta: conCaso.mensaje });
  assert.equal(faltaEscribir([msg('a'), msg('b', { tipo: 'audio', audio_id: 4, cuerpo: '' })]), null, 'una nota de voz sin pie no está vacía');
  assert.equal(faltaEscribir([msg('a'), msg('b', { tipo: 'audio', cuerpo: '' })])?.error, 'Falta completar «WHATSAPP»', 'una nota de voz sin audio sí');
  // Integración (parte C): un email con SÓLO una imagen no está vacío —su texto plano derivado queda en
  // ''—, y la tarjeta no dice «Sin escribir». Uno con el HTML vacío, sí. Rotura (volver a mirar sólo
  // `cuerpo`): 1 fallo.
  const conImagen = msg('e', { canal: 'email', asunto: 'Mira', cuerpo: '', cuerpo_html: '<p><img src="https://x.com/a.png" alt=""></p>' } as Partial<PasoParaGrafo>);
  assert.equal(faltaEscribir([conImagen]), null);
  assert.equal(nodo(grafoDeSecuencia([conImagen], { disparador: 'X' }), 'e').advertencia, undefined);
  assert.equal(faltaEscribir([{ ...conImagen, cuerpo_html: '<p></p>' } as PasoParaGrafo])?.id, 'e');
  // La tarjeta MAKO sin mensaje tampoco sale (`avisar_al_equipo` lo exige).
  const conMako = insertarDesdeLienzo([msg('a')], 'a', 'sig', 'mako', rndDe(8));
  assert.deepEqual(faltaEscribir(conMako.pasos), { id: conMako.id, error: 'Falta completar «MAKO»' });
  // El error, sin ids crudos, y sin «la condición «CONDITION»».
  const malos: PasoParaGrafo[] = [{ id: 'n0abcde', canal: 'whatsapp', delay_horas: 0, cuerpo: '', nodo: 'condicion', ramas: [], si_no: null }];
  const legible = errorLegible(validarGrafo(malos)[0], malos);
  assert.doesNotMatch(legible, /n0abcde/);
  assert.equal(legible, '«CONDITION» no tiene ninguna rama');
  assert.deepEqual(frenoDelFlujo(malos), { error: legible, tarjeta: 'n0abcde' });
});

test('⚠️ al abrir, lo de antes se ve CONVERTIDO; un flujo de tarjetas no se vuelve a convertir ni pierde lo de su estrategia', () => {
  const perfil = sinComentarios(leer(PERFIL));
  const ini = bloque(perfil, 'const [inicial] = useState(() => {', '\n  });', 1_200);
  // Tener ids NO es ser un flujo (una lista de antes que pasó por setSecuenciaPasos los tiene):
  // lo decide `esFlujoExplicito`. Y un flujo no limpia su estrategia: el motor la sigue leyendo.
  assert.match(ini, /const yaEsFlujo = esFlujoExplicito\(ordenados\);/);
  assert.match(ini, /convertida: false \}/);
  assert.match(ini, /: legadoAGrafo\(ordenados, est, \{ idDeClave: \(clave\) => secuencias\.find\(\(s\) => s\.clave === clave\)\?\.id \?\? null \}\)/);
  assert.match(ini, /yaEsFlujo\s*\? \{ pasos: normalizar\(ordenados\)/, 'un flujo con ramas pasado por el conversor queda aplastado en una fila');
});

// ── 5: el desplegable del disparador ────────────────────────────────────────

test('⚠️ el desplegable del CRON va por PASOS: producto → Adquisición / Entrega → etapa, sin «Eventos» (tercera tanda)', () => {
  const PRODUCTOS = [
    { funnelId: 5, productoId: 9, nombre: 'Mentoría', etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'onb', label: 'Onboarding' }] },
    { funnelId: null, productoId: 11, nombre: 'Servicio', etapas: [], etapasEntrega: [{ value: 'kick', label: 'Kickoff' }] },
  ];
  const DISPARADORES = [
    { value: 'manual', label: 'Manual' }, { value: 'instant_form_sin_agenda', label: 'Dejó el formulario' },
    { value: 'etapa_actual', label: 'Etapa' }, { value: 'entrega_actual', label: 'Entrega' },
  ];
  const secs = pasosDisparo({
    disparadores: DISPARADORES, productos: PRODUCTOS,
    etiquetas: [{ id: 3, nombre: 'Cualificado' }, { id: 4, nombre: 'Vieja', archivada_at: '2026-01-01' }],
    actual: { trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 }, textoActual: 'x',
  });
  // La raíz: «Productos» y «Etiquetas» (cuarta tanda, punto 2). Ni «Eventos» ni «La que tiene puesta».
  assert.deepEqual(secs.map((s) => s.title), ['Productos', 'Etiquetas']);
  const raiz = (t: string) => secs.find((s) => s.title === t)!;
  assert.deepEqual(raiz('Productos').grupos!.map((g) => g.title), ['Mentoría', 'Servicio'], 'adentro de «Productos», el nombre de cada uno');
  const prod = (t: string) => raiz('Productos').grupos!.find((s) => s.title === t) ?? raiz(t);
  assert.deepEqual(prod('Mentoría').options, [], 'un producto no tiene opciones: tiene pasos');
  assert.deepEqual(prod('Mentoría').grupos!.map((g) => [g.title, g.options.map((o) => o.value)]), [
    ['Adquisición de clientes', ['venta:5:agendado']], ['Entrega del servicio', ['entrega:9:onb']],
  ]);
  assert.deepEqual(prod('Servicio').grupos!.map((g) => g.title), ['Entrega del servicio'], 'un servicio sin embudo no tiene «Adquisición»');
  // El último paso dice la etapa; el botón cerrado lo dice entero.
  assert.equal(prod('Mentoría').grupos![0].options[0].label, 'Agendado');
  assert.equal(rotuloDisparo(secs, 'venta:5:agendado', 'x'), 'Mentoría · Llega a «Agendado»');
  assert.deepEqual(prod('Etiquetas').options.map((o) => o.value), ['etiqueta:3'], 'una etiqueta archivada no se ofrece');
  assert.equal(rotuloDisparo(secs, 'etiqueta:3', 'x'), 'Se le puso «Cualificado»');
  // Con UN producto, el producto no está: «Productos» abre directo en Adquisición / Entrega.
  const uno = pasosDisparo({ disparadores: DISPARADORES, productos: [PRODUCTOS[0]], etiquetas: [], actual: { trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 }, textoActual: 'x' });
  assert.deepEqual(uno.map((s) => s.title), ['Productos']);
  assert.deepEqual(uno[0].grupos!.map((s) => s.title), ['Adquisición de clientes', 'Entrega del servicio']);
  assert.equal(rotuloDisparo(uno, 'venta:5:agendado', 'x'), 'Llega a «Agendado»');
  // Un disparador por EVENTO de antes NO es una sección («La que tiene puesta» salió): lo dice el
  // botón, y no se ofrecen los eventos (pasaron a las condiciones).
  const evento = pasosDisparo({ disparadores: DISPARADORES, productos: PRODUCTOS, etiquetas: [], actual: { trigger_tipo: 'instant_form_sin_agenda' }, textoActual: 'Dejó el formulario' });
  assert.ok(!evento.some((s) => s.title === 'La que tiene puesta'), 'volvió «La que tiene puesta»');
  assert.ok(!opcionesDeSecciones(evento).some((o) => o.value.startsWith('trigger:')), 'volvieron los eventos');
  assert.equal(rotuloDisparo(evento, 'trigger:instant_form_sin_agenda', 'Dejó el formulario'), 'Dejó el formulario');
  assert.equal(valorDisparo({ trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 }), 'etiqueta:3');
  // Lo que se le manda al server (lo implementa la parte del motor).
  assert.deepEqual(pedidoDisparo('venta:5:agendado', 7), { action: 'trigger', id: 7, trigger_tipo: 'etapa_actual', etapa: 'agendado', funnel_id: 5 });
  assert.deepEqual(pedidoDisparo('entrega:11:kick', 7), { action: 'trigger', id: 7, trigger_tipo: 'entrega_actual', etapa: 'kick', producto_id: 11 });
  assert.deepEqual(pedidoDisparo('etiqueta:3', 7), { action: 'trigger', id: 7, trigger_tipo: 'etiqueta_puesta', etiqueta_id: 3 });
  assert.deepEqual(pedidoDisparo('trigger:no_show_j1', 7), { action: 'trigger', id: 7, trigger_tipo: 'no_show_j1' });
  assert.equal(pedidoDisparo('entrega::kick', 7), null, 'una entrega sin producto no se manda');
  // Y la pantalla: un desplegable, sin el botón, sin los rótulos de antes.
  // ⚠️ SEXTA TANDA (varios CRON, 09/10/2026): el desplegable de producto se mudó al editor del CRON
  // «Producto» (app/chatbot/EditorDisparadores.tsx), y se guarda la LISTA entera (`action:
  // 'disparadores'`), no un `pedidoDisparo` por CRON. Las etiquetas salieron de este desplegable
  // (CRON punto 3: son un CRON aparte), así que los pasos se arman SIN etiquetas.
  // PROBADO ROMPIÉNDOLO (09/10/2026; este archivo + cron-varias-etapas + flujo-ia-arreglos +
  // lienzo-revision, base 71 / 0): sin `BOTON_CAMPO_CRON` → 70 / 1; con las etiquetas adentro del
  // desplegable → 70 / 1; guardando con `action: 'trigger'` → 70 / 1. Cae éste las tres veces.
  const perfil = sinComentarios(leer(PERFIL));
  const editor = sinComentarios(leer('../app/chatbot/EditorDisparadores.tsx'));
  for (const src of [perfil, editor]) {
    assert.doesNotMatch(src, /Cambiar a una etapa|setCambiandoAEtapa|Cuándo se dispara|Qué lo dispara|Solo a leads recientes|Sale sola/);
  }
  assert.match(editor, /const body = \{ action: 'disparadores', secuenciaId: secuencia\.id, disparadores: nueva \};/);
  assert.match(editor, /pasosDisparo\(\{ disparadores, productos, etiquetas: \[\], actual,/);
  // Cuarta tanda, punto 14: el desplegable elige VARIAS (`varios` con las etapas puestas y la última
  // que no se apaga) y, punto 1, es un campo grande (`BOTON_CAMPO_CRON`). El botón sigue diciendo lo
  // puesto con `rotuloDisparo`.
  assert.match(editor, /<Dropdown\s+value=\{valor\} secciones=\{deProductos\} search width="100%"\s+varios=\{valor \? valoresDisparo\(actual\) : \[\]\} minimo=\{1\} buttonStyle=\{BOTON_CAMPO_CRON\}\s+botonLabel=\{valor \? rotuloDisparo\(conRaiz, valor, textos\.deSiempre\(d\)\) : 'Elige la etapa'\}/);
});

test('`seccionesDisparo` (el catálogo PLANO que lee «Crear con IA»): el de antes, sin «Eventos», y con los valores de los pasos', () => {
  const op = {
    disparadores: [{ value: 'instant_form_sin_agenda', label: 'Dejó el formulario' }],
    productos: [
      { funnelId: 5, productoId: 9, nombre: 'Mentoría', etapas: [{ value: 'agendado', label: 'Agendado' }], etapasEntrega: [{ value: 'onb', label: 'Onboarding' }] },
      { funnelId: null, productoId: 11, nombre: 'Servicio', etapas: [], etapasEntrega: [{ value: 'kick', label: 'Kickoff' }] },
    ],
    etiquetas: [{ id: 3, nombre: 'Cualificado' }],
    actual: { trigger_tipo: 'manual' }, textoActual: 'A mano',
  };
  const plano = seccionesDisparo(op);
  assert.deepEqual(plano.map((s) => s.title), ['Etapa · Mentoría', 'Entrega · Mentoría', 'Entrega · Servicio', 'Etiquetas']);
  assert.deepEqual(plano[0].options, [{ value: 'venta:5:agendado', label: 'Llega a «Agendado»' }]);
  // Los mismos valores que los pasos del desplegable: los dos salen de `kanbansDe`.
  assert.deepEqual(plano.flatMap((s) => s.options.map((o) => o.value)).sort(), opcionesDeSecciones(pasosDisparo(op)).map((o) => o.value).sort());
  // Con un solo producto, «Etapa» y «Entrega» a secas (como antes).
  assert.deepEqual(seccionesDisparo({ ...op, productos: [op.productos[0]], etiquetas: [] }).map((s) => s.title), ['Etapa', 'Entrega']);
});

test('el Dropdown abre un paso MÁS (`grupos`) y buscando aplana con el camino', () => {
  const dd = sinComentarios(leer('../app/components/Dropdown.tsx'));
  // Abrir una sección suma su título al CAMINO; la ‹ lo saca. Un camino y no un título suelto.
  assert.match(dd, /onClick=\{\(\) => setRuta\(\(r\) => \[\.\.\.r, g\.title\]\)\}/);
  assert.match(dd, /onClick=\{\(\) => setRuta\(\(r\) => r\.slice\(0, -1\)\)\}/);
  // Adentro de una sección: primero sus pasos, después sus opciones.
  assert.match(dd, /\{\(abierta\.grupos \?\? \[\]\)\.map\(\(g\) => botonSeccion\(g\)\)\}\s*\{abierta\.options\.map\(/);
  // Lo elegido se encuentra aunque viva dos pasos adentro (el botón dice qué está puesto).
  assert.match(dd, /const flat = secciones \? secciones\.flatMap\(opcionesDe\)/);
  assert.match(dd, /tramosPlanos\(seccVisibles \?\? \[\]\)\.map\(/);
});

// ── La honestidad del dibujo ────────────────────────────────────────────────

test('⚠️ `CONDICIONES_VIVAS` es lo que el motor EVALÚA, medido en el `switch` de `cumpleFila`', () => {
  // `cumpleFila` (lib/flujo-grafo.ts) es la MISMA función que usan el motor y el simulador.
  // Si alguien suma un campo allá, el lienzo lo tiene que ofrecer; si lo saca, dejar de
  // ofrecerlo — una condición que se elige y nadie evalúa es una rama que miente.
  const fuente = sinComentarios(leer('../lib/flujo-grafo.ts'));
  const cuerpo = bloque(fuente, 'export function cumpleFila(', '\n}\n', 2_500);
  const casos = new Set([...cuerpo.matchAll(/case '([a-z_]+)'/g)].map((m) => m[1]));
  assert.ok(casos.size > 0, 'no encontré un solo `case`: el guard se quedó ciego');
  assert.deepEqual([...CONDICIONES_VIVAS].sort(), [...casos].sort());
  // Cada una se dice como frase, en positivo y negada.
  for (const c of CONDICIONES_VIVAS) assert.ok(FRASE_CONDICION[c]?.[0] && FRASE_CONDICION[c]?.[1], `${c} sin frase`);
  // El editor es el de la tercera tanda (app/chatbot/EditorCondicion.tsx, con el catálogo de
  // lib/condiciones-catalogo.ts, que trae estas 9 y las nuevas): FlujoLienzo sólo lo monta, sin una
  // lista propia de condiciones que se quede vieja.
  const lienzo = sinComentarios(leer('../app/chatbot/FlujoLienzo.tsx'));
  assert.match(lienzo, /from '\.\/EditorCondicion'/);
  assert.doesNotMatch(lienzo, /OPCIONES_CAMPO|CONDICIONES_VIVAS/);
  // Con el ámbito del CRON (adquisición o entrega: qué condiciones se ofrecen) y los nombres del
  // catálogo para la tarjeta («Completó la clase «Bienvenida»», no «una clase»).
  assert.match(lienzo, /ambito=\{ambitoDeDisparo\(pr\.triggerTipo\)\}/);
  assert.match(lienzo, /catalogo: nombresCatalogoDe\(catalogosDe\(\{ etapas, productos: productos \?\? \[\], remotos: remotosCond \}\)\)/);
  // Y la tarjeta dice las ramas con el texto del modelo (`textoRama`), no uno propio.
  const r = crearRespuesta([cond('c', [['r1', null]], null)], rndDe());
  assert.ok(raizRespuesta(r.pasos));
  assert.equal(nodo(grafoDeSecuencia(r.pasos, { disparador: 'X' }), 'c').puertos![0].rotulo, 'Agendó');
});
