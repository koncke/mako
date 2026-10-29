// =============================================================================
// La tarjeta «Automatizaciones» de la ficha, REDISEÑADA (24/10/2026, la tarde)
// =============================================================================
// Martín, con una captura: «Te pedí que rediseñes la tarjeta, no sólo que cambies el texto, se sigue viendo muy fea». El
// norte (del Cerebro): lo que importa se ve antes de leer (un SELLO con forma y color, no un chip en la esquina); una línea
// de tiempo, no un párrafo (el RIEL); las acciones son acciones, y «Frenar» va aparte, en rojo y preguntando con la verdad;
// la tarjeta se cierra sobre sí misma («Hora de Tijuana» suelta se fue); y varias se distinguen de un vistazo.
// Se prueba ejecutando lo puro (app/crm/automatizacion-lead.ts, app/m/crm/ficha-bloques.ts) y leyendo el fuente de la
// pantalla y su hoja. ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  estadoDeTarjeta, ordenarTarjetas, preguntaDeEmpezarDeNuevo, preguntaDeFrenar, preguntaDeFrenarEnFicha, rielDeTarjeta, tipoDeFreno,
  type InscripcionVista, type NoEntroVista,
} from '../app/crm/automatizacion-lead';
import { filaDeAutomatizaciones, tonoDeAutomatizaciones } from '../app/m/crm/ficha-bloques';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const AHORA = Date.parse('2026-10-24T18:00:00Z');

/** La #289 del negocio de Mauricio, con Honorio: le salió la bienvenida, MaKo avisó al equipo, y le sale el segundo. */
const base: InscripcionVista = {
  secuenciaId: 289, nombre: 'Sprint · apertura', link: '/automations?sec=289', estado: 'activa', automatizacionActiva: true,
  paso: { numero: 6, titulo: 'WHATSAPP: Hola {{nombre}}…', total: 6 },
  proximo: { at: '2026-10-25T01:33:00Z', titulo: '«Hola Honorio, si no me das tu email…»', clase: 'mensaje' },
  frenado: null, termino: null, contesto: null, puede: { frenar: true, empezarDeNuevo: true }, reentrada: 'una_vez',
  enviados: [
    { at: '2026-10-24T03:50:15Z', paso: 'Paso 4: MAKO', canal: 'whatsapp', estado: 'accion', error: null, que: 'Aviso al equipo', clase: 'accion' },
    { at: '2026-10-24T01:09:37Z', paso: 'Paso 2: WHATSAPP', canal: 'whatsapp', estado: 'enviado', error: null, que: '«Hola Honorio, ya me llegó tu pago»', clase: 'mensaje' },
  ],
};
const horario = { texto: 'No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale mañana 9:00.', corto: 'Abre mañana 9:00', saleAt: '2026-10-25T16:00:00Z' };

test('el estado entra por el ojo: cada caso con su forma, su tono y dos palabras (el porqué entero, al pasar)', () => {
  const e = (i: Partial<InscripcionVista>) => { const x = estadoDeTarjeta({ ...base, ...i }); return [x.forma, x.tono, x.texto]; };
  assert.deepEqual(e({}), ['disco', 'mako', 'En curso']);
  assert.deepEqual(e({ estado: 'respondio', contesto: '2026-10-24T03:49:57Z' }), ['tilde', 'good', 'Respondió']);
  assert.equal(estadoDeTarjeta({ ...base, estado: 'respondio', contesto: '2026-10-24T03:49:57Z' }).at, '2026-10-24T03:49:57Z', 'cuándo contestó');
  assert.deepEqual(e({ estado: 'handoff' }), ['persona', 'neutral', 'Con una persona']);
  assert.deepEqual(e({ estado: 'completada', termino: { at: '2026-10-20T10:00:00Z', texto: 'Terminó el recorrido.' } }), ['tilde-suave', 'good', 'Terminó']);
  assert.equal(estadoDeTarjeta({ ...base, estado: 'completada', termino: { at: '2026-10-20T10:00:00Z', texto: 'x' } }).soloDia, true, 'lo terminado, sólo el día');
  assert.deepEqual(e({ estado: 'no_responde' }), ['tilde-suave', 'good', 'Terminó sin respuesta']);
  assert.deepEqual(e({ estado: 'cancelada' }), ['cuadro', 'neutral', 'Frenada']);
  assert.deepEqual(e({ estado: 'pausada' }), ['pausa', 'neutral', 'En pausa']);
  assert.deepEqual(e({ automatizacionActiva: false }), ['pausa', 'neutral', 'Automatización en pausa']);
  assert.deepEqual(e({ estado: 'pendiente' }), ['aro', 'mako', 'Por arrancar']);
  assert.deepEqual(e({ frenado: horario }), ['reloj', 'mako', 'Fuera de horario']);
  assert.deepEqual(e({ frenado: { texto: 'No salió: la línea llegó a su tope del día (55).', corto: 'Tope del día' } }), ['reloj', 'mako', 'Tope del día']);
  assert.deepEqual(e({ frenado: { texto: 'No sale: el envío de WhatsApp del negocio está apagado.', corto: 'WhatsApp apagado' } }), ['alerta', 'warn', 'WhatsApp apagado']);
  assert.deepEqual(e({ frenado: { texto: 'No salió: el número no existe.', corto: 'Falló al mandar' } }), ['alerta-llena', 'bad', 'Falló al mandar']);
  assert.equal(estadoDeTarjeta({ ...base, frenado: horario }).porque, horario.texto, 'el porqué entero va al pasar, no se pierde');
});

test('el tipo de freno sale de lo que ya dice el motor, sin tocarlo: si cambian sus textos, esto se entera', () => {
  assert.equal(tipoDeFreno({ corto: 'Abre mañana 9:00' }), 'espera');
  assert.equal(tipoDeFreno({ corto: 'Fuera de horario' }), 'espera');
  assert.equal(tipoDeFreno({ corto: 'Tope de la hora' }), 'fila');
  assert.equal(tipoDeFreno({ corto: 'Falló al mandar' }), 'fallo');
  assert.equal(tipoDeFreno({ corto: 'En pausa' }), 'pausa');
  assert.equal(tipoDeFreno({ corto: 'Sin línea de WhatsApp' }), 'traba');
  const motor = leer('lib/por-que-no-sale.ts');
  for (const c of ["'Falló al mandar'", "'Tope del día'", "'Tope de la hora'", "'En pausa'", "'Fuera de horario'", '`Abre ${cuando(abre)}`']) {
    assert.ok(motor.includes(c), `el motor ya no dice ${c}: tipoDeFreno lo leería como una traba`);
  }
});

test('el riel: del más viejo al más nuevo, cada cosa por lo que es, y al final lo que viene', () => {
  const r = rielDeTarjeta(base, [], { ahoraMs: AHORA });
  assert.deepEqual(r.nodos.map((n) => [n.tipo, n.titulo, n.cita]), [
    ['mensaje', 'Le salió', '«Hola Honorio, ya me llegó tu pago»'],
    ['quieto', 'Aviso al equipo', null],
    ['proximo', 'Le sale', '«Hola Honorio, si no me das tu email…»'],
  ]);
  assert.equal(r.antes, 0);
  // Contestó: en su lugar, con lo que dijo, y nada por delante.
  const c = rielDeTarjeta({ ...base, estado: 'respondio', contesto: '2026-10-24T03:49:57Z', respuesta: '«No hemos mandado pagos»' }, [], { ahoraMs: AHORA });
  assert.deepEqual(c.nodos.map((n) => n.tipo), ['mensaje', 'contesto', 'quieto'], 'la respuesta, entre el mensaje y el aviso que disparó');
  assert.equal(c.nodos[1].cita, '«No hemos mandado pagos»');
  // Contestó sin hora: igual se dice, al final.
  assert.equal(rielDeTarjeta({ ...base, estado: 'respondio' }, [], { ahoraMs: AHORA }).nodos.at(-1)?.tipo, 'contesto');
  // Un fallo dice su error; un borrador, que no se mandó.
  const f = rielDeTarjeta({ ...base, enviados: [{ ...base.enviados[1], estado: 'fallo', error: 'el número no tiene WhatsApp' }] }, [], { ahoraMs: AHORA });
  assert.deepEqual([f.nodos[0].tipo, f.nodos[0].titulo, f.nodos[0].detalle], ['fallo', 'No le salió', 'el número no tiene WhatsApp']);
  assert.equal(rielDeTarjeta({ ...base, enviados: [{ ...base.enviados[1], estado: 'borrador' }] }, [], { ahoraMs: AHORA }).nodos[0].titulo, 'Borrador sin mandar');
  // «No volvió a entrar» va ADENTRO del riel de esa automatización, en su hora.
  const ne: NoEntroVista[] = [{ secuenciaId: 289, nombre: 'Sprint · apertura', at: '2026-10-24T02:00:00Z', texto: 'No volvió a entrar…', motivo: 'Entra una sola vez' }];
  const n = rielDeTarjeta(base, ne, { ahoraMs: AHORA });
  assert.deepEqual(n.nodos.map((x) => x.tipo), ['mensaje', 'noentro', 'quieto', 'proximo']);
  assert.equal(n.nodos[1].detalle, 'Entra una sola vez');
  assert.equal(rielDeTarjeta(base, [{ ...ne[0], secuenciaId: 999 }], { ahoraMs: AHORA }).nodos.length, 3, 'el de otra automatización no entra');
  // Ninguna palabra del motor ni una variable.
  for (const x of [...r.nodos, ...c.nodos, ...f.nodos, ...n.nodos]) assert.doesNotMatch(`${x.titulo} ${x.cita ?? ''}`, /CRON|CONDITION|WHATSAPP|\{\{|Paso \d/);
});

test('lo viejo se pliega: se ve desde el penúltimo mensaje, y «todo» (épico o «Línea de tiempo») no pliega nada', () => {
  const msg = (h: number) => ({ at: `2026-10-2${h}T10:00:00Z`, paso: null, canal: 'whatsapp', estado: 'enviado', error: null, que: `«m${h}»`, clase: 'mensaje' as const });
  const largo = { ...base, enviados: [msg(4), msg(3), msg(2), msg(1)] };
  const r = rielDeTarjeta(largo, [], { ahoraMs: AHORA });
  assert.equal(r.antes, 2, '«Ver 2 antes»');
  assert.deepEqual(r.nodos.map((n) => n.cita), ['«m3»', '«m4»', '«Hola Honorio, si no me das tu email…»']);
  assert.equal(rielDeTarjeta(largo, [], { todo: true, ahoraMs: AHORA }).antes, 0);
  assert.equal(rielDeTarjeta(largo, [], { todo: true, ahoraMs: AHORA }).nodos.length, 5);
});

test('lo próximo dice si sale, cuándo, o por qué no (en gris si hoy no sale); y sin nada, «Todavía no le salió nada.»', () => {
  const p = (i: Partial<InscripcionVista>) => rielDeTarjeta({ ...base, enviados: [], ...i }, [], { ahoraMs: AHORA }).nodos.at(-1);
  assert.deepEqual([p({ frenado: horario })?.titulo, p({ frenado: horario })?.at], ['Abre', '2026-10-25T16:00:00Z'], 'abre cuando abre el horario');
  assert.deepEqual([p({ frenado: { texto: 't', corto: 'Tope del día' } })?.titulo, p({ frenado: { texto: 't', corto: 'Tope del día' } })?.apagado], ['En fila', true]);
  assert.deepEqual([p({ frenado: { texto: 't', corto: 'WhatsApp apagado' } })?.titulo, p({ frenado: { texto: 't', corto: 'WhatsApp apagado' } })?.at], ['No sale', null]);
  assert.equal(p({ frenado: { texto: 't', corto: 'Falló al mandar' } })?.titulo, 'Reintenta', 'el reintento todavía no pasó');
  assert.equal(p({ frenado: { texto: 't', corto: 'Falló al mandar' }, proximo: { ...base.proximo!, at: '2026-10-24T10:00:00Z' } })?.titulo, 'No sale', 'el reintento ya pasó');
  assert.deepEqual([p({ automatizacionActiva: false })?.titulo, p({ automatizacionActiva: false })?.apagado], ['En pausa', true]);
  assert.equal(p({ proximo: { at: '2026-10-25T01:00:00Z', titulo: 'Una espera', clase: 'otro' } })?.titulo, 'Sigue');
  assert.equal(p({ proximo: { at: '2026-10-25T01:00:00Z', titulo: 'Aviso al equipo', clase: 'accion' } })?.titulo, 'Aviso al equipo');
  assert.equal(p({ proximo: { at: '2026-10-25T01:00:00Z', titulo: 'Aviso al equipo', clase: 'accion' } })?.cita, null, 'una acción no lleva burbuja');
  assert.equal(rielDeTarjeta({ ...base, estado: 'respondio', enviados: [] }, [], { ahoraMs: AHORA }).nodos.some((n) => n.tipo === 'proximo'), false, 'a quien contestó no le sale nada');
  const vacio = rielDeTarjeta({ ...base, enviados: [], proximo: null }, [], { ahoraMs: AHORA });
  assert.deepEqual([vacio.nodos.length, vacio.vacio], [0, true]);
  assert.equal(rielDeTarjeta({ ...base, enviados: [], proximo: null, estado: 'completada' }, [], { ahoraMs: AHORA }).vacio, false, 'terminada: el sello ya lo dice');
});

test('varias vivas, en el orden en que hay que mirarlas: falló, trabada, contestó, en curso (lo que sale antes) y quietas', () => {
  const a = (id: number, i: Partial<InscripcionVista>): InscripcionVista => ({ ...base, secuenciaId: id, ...i });
  const orden = ordenarTarjetas([
    a(1, { automatizacionActiva: false }),
    a(2, { proximo: { ...base.proximo!, at: '2026-10-26T10:00:00Z' } }),
    a(3, { estado: 'respondio' }),
    a(4, { frenado: { texto: 't', corto: 'Falló al mandar' } }),
    a(5, { proximo: { ...base.proximo!, at: '2026-10-25T10:00:00Z' } }),
    a(6, { frenado: { texto: 't', corto: 'Sin línea de WhatsApp' } }),
  ]).map((x) => x.secuenciaId);
  assert.deepEqual(orden, [4, 6, 3, 5, 2, 1]);
});

test('las preguntas dicen la verdad: una frenada no vuelve a empezar (ni a mano)', () => {
  assert.deepEqual(preguntaDeFrenarEnFicha({ nombre: 'Victor Basurto', aut: base }), { titulo: 'Frenar «Sprint · apertura»', mensaje: 'A Victor no le sale nada más, y no se puede volver a empezar.' });
  assert.equal(preguntaDeFrenarEnFicha({ aut: base }).mensaje, 'No le sale nada más, y no se puede volver a empezar.');
  assert.deepEqual(preguntaDeEmpezarDeNuevo({ nombre: 'Victor Basurto', aut: base }), { titulo: 'Empezar de nuevo «Sprint · apertura»', mensaje: 'A Victor le vuelve a salir todo desde el principio.' });
  // El tablero decía «Para que vuelva, se lo inscribe a mano»: falso.
  assert.doesNotMatch(preguntaDeFrenar({ leads: 1, nombre: 'Ana' }).mensaje, /a mano/);
  // Y es la regla del motor: una cancelada no se reabre.
  assert.match(leer('lib/automatizaciones-del-lead-reglas.ts'), /const reabre = !cancelada && /);
});

// El bloque (las lecturas, las acciones, el orden) y sus piezas (la tarjeta y la fila, puras).
const P = [leer('app/crm/lead-view/ficha/resumen/automatizaciones.tsx'), leer('app/crm/lead-view/ficha/resumen/tarjeta-automatizacion.tsx')]
  .join('\n').replace(/^[ \t]*\/\/.*$/gm, '');

test('la pantalla: sello y estado arriba, el riel, el pie con «Frenar» aparte y «Empezar de nuevo» como botón', () => {
  assert.match(P, /<Sello forma=\{e\.forma\} \/>/);
  assert.match(P, /<span className="fr-aut-estado" title=\{e\.porque \?\? undefined\}>/);
  assert.match(P, /<article className="fr-aut" data-tono=\{e\.tono\} data-automatizacion=\{a\.secuenciaId\}>/);
  assert.match(P, /const riel = rielDeTarjeta\(a, en\.noEntro, \{ todo, ahoraMs: en\.ahora \}\);/);
  // En épico y en «Línea de tiempo», el riel entero; en «Lista», desde el penúltimo mensaje y «Ver N antes».
  assert.match(P, /const plegaAntes = !epico && diseno !== 'tiempo';/);
  assert.match(P, /todo=\{!plegaAntes \|\| conAntes\.has\(a\.secuenciaId\)\}/);
  assert.match(P, /<footer className="fr-aut-pie">\s*\{frena && \(\s*<button type="button" className="fr-aut-frenar"/, '«Frenar» no va primero en el pie');
  assert.match(P, /<Button variant="secondary" size="sm" icon=\{<IconoMenu nombre="restaurar" size=\{15\} \/>\}/);
  assert.match(P, /preguntaDeFrenarEnFicha\(\{ nombre: ctx\.lead\.nombre, aut: accion\.aut \}\)/);
  // (28/10/2026: y «Volver a probar», ticket #19 de Automations.)
  assert.match(P, /show\(tipo === 'frenar' \? 'Frenada' : tipo === 'probar' \? 'Lista para volver a probar' : 'Empezó de nuevo', undefined, 'good'\);/, 'lo que salió bien, en un toast');
  // Lo que se fue: el chip de la esquina, la caja gris, el triangulito, el botón gris apagado y la zona suelta abajo.
  assert.doesNotMatch(P, /fr-aut-chip|fr-tarjeta|<details|variant="tertiary"|Hora de \$\{/);
  // La zona: en cada hora al pasar, y en lo próximo sólo si quien mira está en otra.
  assert.match(P, /const conZona = \(iso: string\) => `\$\{fecha\(iso\)\} · hora de \$\{ciudadDeZona\(en\.tz\)\}`;/);
  assert.match(P, /\{n\.tipo === 'proximo' && otraZona\(n\.at\) && <span className="fr-aut-zona">/);
  // Lo que no entró de una automatización con tarjeta va en su riel; arriba, sólo lo de las que no tienen.
  assert.match(P, /const sueltos = r\.noEntro\.filter\(\(n\) => !conTarjeta\.has\(n\.secuenciaId\)\);/);
  // Varias: las vivas ordenadas; las terminadas como filas, la primera abierta si no hay vivas, y plegables a mano.
  assert.match(P, /const vivas = ordenarTarjetas\(r\.vivas\);/);
  assert.match(P, /const abierta = \(a: InscripcionVista, k: number\) => !plegadas\.has\(a\.secuenciaId\) && \(abiertas\.has\(a\.secuenciaId\) \|\| \(!vivas\.length && k === 0\)\);/);
});

test('la hoja: un tono por significado, sólo tokens, y el único transform es el chevron (una hoja)', () => {
  const css = leer('app/crm/lead-view/ficha/resumen/estilo.ts');
  const aut = css.slice(css.indexOf('/* El bloque «Automatizaciones»'), css.indexOf('/* «Posibles duplicados»'));
  assert.ok(aut.length > 2000, 'no encontré la hoja de la tarjeta');
  const reglas = aut.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(reglas, /#[0-9a-fA-F]{3,8}\b/, 'un color sin token: no se da vuelta en oscuro');
  assert.equal((reglas.match(/transform:/g) ?? []).length, 1);
  assert.match(reglas, /\.fr-aut-chev\[data-abierto\] \{ transform: rotate\(180deg\); \}/);
  assert.doesNotMatch(reglas, /container-type|filter:/);
  assert.match(aut, /\.fr-aut\[data-tono="warn"\], \.fr-aut-fila\[data-tono="warn"\] \{ --aut-fill: var\(--warn-fill\); --aut-ink: var\(--warn\);/);
  assert.match(aut, /\.fr-aut \{[^}]*box-shadow: inset 3px 0 0 var\(--aut-fill\);/, 'sin la franja, tres tarjetas se ven iguales');
  // El texto dorado, siempre en --mako-ink (el --mako sobre blanco no llega a contraste).
  assert.match(aut, /\.fr-aut, \.fr-aut-fila \{ --aut-fill: var\(--mako\); --aut-ink: var\(--mako-ink\);/);
  // El celular y la vista «Celular» de «Personalizar», iguales.
  assert.match(aut, /@media \(max-width: 720px\) \{\n  \.fr-aut \{ padding: 12px 12px 12px 15px; \}/);
  assert.match(aut, /\.fb-pagina\[data-dispositivo="movil"\] \.fr-aut \{ padding: 12px 12px 12px 15px; \}/);
});

test('el teléfono: la fila nombra la que hay que mirar, cuándo le sale o su estado, y un punto de su color', () => {
  const v = { vivas: [{ ...base, secuenciaId: 2, nombre: 'Bienvenida' }, { ...base, frenado: horario }], terminadas: [], noEntro: [] };
  const f = (iso: string) => `F(${iso.slice(11, 16)})`;
  assert.equal(filaDeAutomatizaciones(v, f), 'Bienvenida · F(01:33) · +1');
  assert.equal(tonoDeAutomatizaciones(v), 'mako');
  const trabada = { vivas: [{ ...base, frenado: { texto: 't', corto: 'WhatsApp apagado' } }], terminadas: [], noEntro: [] };
  assert.equal(filaDeAutomatizaciones(trabada, f), 'Sprint · apertura · WhatsApp apagado');
  assert.equal(tonoDeAutomatizaciones(trabada), 'warn');
  assert.equal(tonoDeAutomatizaciones({ vivas: [], terminadas: [], noEntro: [] }), null);
  const ficha = leer('app/m/crm/[id]/FichaLead.tsx');
  assert.match(ficha, /case 'automatizaciones': \{[\s\S]{0,400}<span className="m-aut__punto" data-tono=\{p\.autTono \?\? 'neutral'\} aria-hidden \/>/);
  assert.match(leer('app/m/crm/[id]/page.tsx'), /autTono=\{d\.autTono\}/);
  assert.match(leer('app/m/m.css'), /\.m-aut__punto\[data-tono="warn"\] \{ background: var\(--warn-fill\); \}/);
});

// ── Las roturas (10 tests; sin romper nada: 10 pases, 0 fallos). Fallos / pases con cada una: ──────────────────────
// 1. Una traba en dorado (sin el naranja): 3 / 7.          2. «Respondió» se ve como «En curso»: 1 / 9.
// 3. Un tope de la línea se lee como traba: 3 / 7.          4. El riel del más nuevo al más viejo: 2 / 8.
// 5. «No entró» fuera del riel: 1 / 9.                      6. Se pliega desde el ÚLTIMO mensaje: 1 / 9.
// 7. Fuera de horario dice «Le sale» y no «Abre»: 1 / 9.    8. A quien contestó le sale lo próximo: 2 / 8.
// 9. Lo que falló, al final del orden: 1 / 9.               10. La pregunta de Frenar vuelve a mentir: 1 / 9.
// 11. «Frenar» vuelve a ser un botón gris: 1 / 9.           12. Vuelve «Hora de Tijuana» suelta: 1 / 9.
// 13. Sin la franja de color: 1 / 9.                        14. Un color sin token: 1 / 9.
// 15. El punto del teléfono, siempre dorado: 1 / 9.         16. La ficha del teléfono sin el punto: 1 / 9.
