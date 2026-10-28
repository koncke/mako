// =============================================================================
// Los «no puedo» falsos de MaKo: lo que SÍ se puede tiene que llegar con su herramienta (27/10/2026, Leila, ws 11)
// =============================================================================
// Martín (27/10, 20:37): Leila recibe «no lo puedo hacer» de MaKo cuando lo que pide SÍ se puede. El diagnóstico (con datos de
// producción, sólo lectura) encontró tres caminos de ruteo que dejaban afuera la herramienta. Lo que fija, con la lista de
// herramientas DE VERDAD (`MAKO_TOOLS` + `MAKO_ACCION_TOOLS`: con `deSiempre: []` el presupuesto mide otra selección):
//   1. LA QUEJA no es charla: «No me deja…», «No puedo…», «No funciona…» de hasta 60 letras caían en la 9-bis
//      («confirmación sin nada pendiente») con 0 herramientas, y con una pendiente abierta en la regla 1 («confirmar»).
//      `CONFIRMACION` no se toca (la usan la regla 1 y `corrigeAgenda`): «no», «ok gracias», «no, mejor el martes» siguen igual.
//   2. EL PLAN DE PAGOS sin la palabra «cuota»: «las fechas y las cantidades de pago están mal», «cada quincena», «la
//      mensualidad de Ana» no sumaban cobros y MaKo dijo que no existía (el ticket #13). Ahora traen editar_cuota y
//      editar_venta_lead en la app y en WhatsApp. La mensualidad de MaKo no es esto.
//   3. LA FICHA EN «EDITAR»: un dato de cobro («No me deja editar sus cuotas») ya no se clasifica como un cambio de la vista
//      (`pistaDeEdicion`), y MaKo sabe que al salir de «Editar» los montos se desbloquean.
//   4. LOS DATOS FISCALES (la constancia de Leila): no sumaban ningún área y `editar_dato_deal` no llegaba nunca. Con un adjunto
//      (pensar) lo que escribe no viaja; ahora el turno de la app le dice el NOMBRE de lo que puede ofrecer (`ofrecibles`).
//   5. «ANOTADO» sin escribir nada (el horario, dos veces): `afirmacionesDeHecho` lo ve y el chat le pega la nota de siempre.
// Frases parafraseadas: ningún dato de clientes.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion, esPedidoDeCobro } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno, lineaDeOfrecibles } from '../lib/doer-herramientas';
import { afirmacionesDeHecho } from '../lib/doer-salida';
import { contextoDeEdicion, pistaDeEdicion, PISTA_DATO_DE_COBRO, PISTA_EDICION_FICHA } from '../lib/mako-analyst-lead-reglas';
import { porId, type Vista } from '../lib/api-mako/registro';
import { esDestructiva } from '../lib/relevancia-app';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

/** Los nombres de las herramientas de siempre: viven en módulos `server-only` (el molde de tests/ficha-editar-con-mako.test.ts). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const herramientas = (texto: string, canal: 'app' | 'whatsapp'): string[] => {
  const vista: Vista = { canal, alcance: canal === 'app' ? 'proponer' : 'ejecutar', ws: 13, rol: 'admin', tabs: null };
  const veredicto = clasificarIntencion(texto, canal === 'app' ? { canal: 'app' } : {});
  const entrada = { veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false, contextoDelSi: null };
  return (canal === 'app' ? herramientasDelChat(entrada) : herramientasDelTurno(entrada)).tools.map((t) => t.name);
};

test('1. la queja no es charla, y una pendiente abierta no la toma como un «no»', () => {
  for (const m of ['No me deja editar sus cuotas', 'No puedo cambiar la fecha de la cuota 2', 'No me deja guardar el lead', 'No funciona el link']) {
    for (const canal of ['app', 'whatsapp'] as const) {
      const v = clasificarIntencion(m, canal === 'app' ? { canal: 'app' } : {});
      assert.notEqual(v.intencion, 'charlar', `[${canal}] «${m}» cayó en charla`);
      const conPendiente = clasificarIntencion(m, { ...(canal === 'app' ? { canal: 'app' as const } : {}), hayPendientes: true });
      assert.notEqual(conPendiente.intencion, 'confirmar', `[${canal}] «${m}» con una pendiente se tomó como un «no»`);
    }
  }
  // Lo de siempre, igual.
  for (const m of ['no', 'ok gracias', 'sí dale', 'no, mejor el martes', 'No, gracias, eso es todo', 'no sé']) {
    assert.equal(clasificarIntencion(m, {}).intencion, 'charlar', `«${m}» dejó de ser charla`);
  }
  assert.equal(clasificarIntencion('no', { hayPendientes: true }).intencion, 'confirmar', 'un «no» con una pendiente dejó de contestarla');
  assert.notEqual(clasificarIntencion('no, movela al viernes a las 10', { hayPendientes: true, hayPendienteDeAgenda: true }).intencion, 'charlar');
});

test('2. el plan de pagos sin la palabra «cuota» trae editar_cuota y editar_venta_lead, en la app y en WhatsApp', () => {
  const PEDIDOS = [
    'No me deja editar sus cuotas',
    'No puedo cambiar la fecha de la cuota 2',
    'Las fechas y las cantidades de pago de Ana están mal: son 300 USD cada quincena, los días 1 y 15',
    'Corregí la mensualidad de Ana: son 423, no 4235',
    'Cambiá el plan de pagos de Ana a quincenal',
  ];
  for (const m of PEDIDOS) {
    assert.ok(esPedidoDeCobro(m), `«${m}» no es un pedido de cobro`);
    for (const canal of ['app', 'whatsapp'] as const) {
      const t = herramientas(m, canal);
      for (const h of ['editar_cuota', 'editar_venta_lead']) assert.ok(t.includes(h), `[${canal}] «${m}» no trae ${h} (${t.length} herramientas)`);
    }
  }
  // Lo que no es el plan de un lead.
  for (const m of ['¿cuánto es la mensualidad de MaKo?', 'quiero cambiar mi mensualidad', 'pon las cuotas arriba de todo', 'anotá en el plan: revisar las cuotas de IA']) {
    assert.equal(esPedidoDeCobro(m), null, `«${m}» se tomó como un cobro`);
  }
});

test('3. la ficha en «Editar»: un dato de cobro no es la vista, y MaKo sabe que al salir se desbloquean los montos', () => {
  for (const m of ['No me deja editar sus cuotas', 'cambiale el vencimiento a la cuota 3', 'Corregí la mensualidad: son 423']) {
    assert.equal(pistaDeEdicion(m), PISTA_DATO_DE_COBRO, `«${m}» editando se toma como la vista`);
    const t = herramientas(`${PISTA_DATO_DE_COBRO}${m}`, 'app');
    assert.ok(t.includes('editar_cuota') && t.includes('editar_venta_lead'), `«${m}» editando no trae las de cobro`);
  }
  for (const m of ['pon las cuotas arriba de todo', 'armá el bloque de cuotas con su vencimiento', 'hazla épica', 'saca el bloque de notas']) {
    assert.equal(pistaDeEdicion(m), PISTA_EDICION_FICHA, `«${m}» dejó de ser la vista`);
  }
  assert.doesNotMatch(PISTA_DATO_DE_COBRO, /ficha/i, 'la pista del dato no puede nombrar la ficha (es una palabra de la vista)');
  assert.match(contextoDeEdicion({ tab: 'pagos', nombre: '', embudoId: null }), /al salir de «Editar» se pueden cambiar a mano/);
  assert.match(fuente('lib/mako-analyst-lead.ts'), /pista: pistaDeEdicion\(resto\.mensaje\),/);
});

test('4. los datos fiscales: cargarlos trae editar_dato_deal, y con la constancia adjunta MaKo la OFRECE en vez de decir «no puedo»', () => {
  for (const m of ['Cargale los datos fiscales: razón social, RFC y domicilio', 'Guárdale su constancia de situación fiscal']) {
    assert.ok(herramientas(m, 'app').includes('editar_dato_deal'), `«${m}» no trae editar_dato_deal`);
  }
  // Con un adjunto el turno es «pensar»: lo que escribe no viaja (la ofrece), pero su NOMBRE sí, para ofrecerlo.
  const texto = 'Te paso su constancia fiscal';
  const veredicto = clasificarIntencion(texto, { canal: 'app', hayMedia: true });
  assert.equal(veredicto.intencion, 'pensar');
  const turno = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null }, hayPendientes: false });
  assert.ok(!turno.tools.some((t) => t.name === 'editar_dato_deal'), 'en una pregunta viajó una escritura');
  assert.equal(turno.ofrecibles?.[0], 'editar_dato_deal', `lo primero para ofrecer es ${turno.ofrecibles?.[0]}`);
  assert.match(lineaDeOfrecibles(['editar_dato_deal']), /nunca digas que no se puede: contesta y OFRÉCELA/);
  const app = fuente('lib/mako-turno-app.ts');
  // Y en modo «analizar» no (la revisión del 28/10/2026): con el «sí» lo que escribe tampoco viaja.
  assert.match(app, /const ctxOfrece = turno\.ofrece && turno\.ofrecibles\?\.length && desde\?\.modo !== 'analizar' \? `\\n\\n\$\{lineaDeOfrecibles\(turno\.ofrecibles\)\}` : '';/);
  assert.match(app, /\$\{bloqueTools\}\$\{ctxOfrece\}/, 'el system de la app no dice lo que se puede ofrecer');
});

test('5. «Anotado» sin haber escrito nada se nota: el chat no tiene con qué «recordar»', () => {
  for (const m of ['Anotado.', 'Anotado: el horario es de 7:30 a 9:30.', 'Entendido, queda guardado.', 'Lo tengo en cuenta para la próxima.']) {
    assert.ok(afirmacionesDeHecho(m).length, `«${m}» no se ve como un hecho`);
  }
  for (const m of ['Queda guardado como borrador: confírmalo en la tarjeta.', 'Si quieres, lo dejo anotado.', 'No quedó guardado.', 'Tu horario anotado en el perfil es de 9 a 18.']) {
    assert.deepEqual(afirmacionesDeHecho(m), [], `«${m}» se tomó como un hecho`);
  }
});

// ── La revisión del Cerebro sobre la tanda A (28/10/2026, C:/dev/revisiones/2810-mi-tandaA-y-base.md) ──────────────────────

test('6. «no puedo» sin un objeto de la app SIGUE contestando la propuesta pendiente: viaja cancelar_accion', () => {
  const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };
  for (const m of ['no puedo a esa hora', 'no puedo', 'No consigo turno']) {
    const veredicto = clasificarIntencion(m, { hayPendientes: true, hayPendienteDeAgenda: true, makoPregunto: true });
    assert.equal(veredicto.intencion, 'confirmar', `«${m}» con una reunión propuesta dejó de ser un «no»`);
    const t = herramientasDelTurno({ veredicto, texto: m, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: true, contextoDelSi: null }).tools.map((x) => x.name);
    assert.ok(t.includes('cancelar_accion'), `«${m}»: no viaja cancelar_accion`);
  }
  // La queja con objeto de la app no la toma como un «no».
  assert.notEqual(clasificarIntencion('No me deja editar el lead', { hayPendientes: true }).intencion, 'confirmar');
});

test('7. «quincena» y la mensualidad: sólo el plan de pagos de un lead; la agenda y las preguntas no', () => {
  // La agenda le gana al plan aunque nombre un pago: «la llamada del cobro quincenal» es una reunión que se mueve.
  assert.equal(esPedidoDeCobro('Cambiá la llamada del cobro quincenal de Ana al martes'), null, 'la agenda no le ganó al plan de pagos');
  for (const m of ['Mové la reunión con Pedro a la segunda quincena', 'cambiá la reunión de la quincena al lunes']) {
    assert.equal(esPedidoDeCobro(m), null, `«${m}» se tomó como un cobro`);
    assert.ok(herramientas(m, 'app').includes('proponer_mover_reunion'), `«${m}» perdió las de agenda`);
  }
  for (const m of ['las ventas de la quincena son 12, ¿cómo vamos?', 'esta quincena son 3 reuniones', 'los leads de esta quincena son 45',
    'Pasá para la próxima quincena lo de revisar los anuncios', 'me cobraron mal la mensualidad, son 47 no 97', '¿cuánto es la mensualidad de Ana?']) {
    assert.equal(esPedidoDeCobro(m), null, `«${m}» se tomó como un cobro`);
  }
  assert.equal(clasificarIntencion('las ventas de la quincena son 12, ¿cómo vamos?', { canal: 'app' }).intencion, 'consultar');
});

test('8. lo que se ofrece en una pregunta nunca es una destructiva (reembolsar, dar de baja, despublicar)', () => {
  const vista: Vista = { canal: 'app', alcance: 'proponer', ws: 13, rol: 'admin', tabs: null };
  for (const texto of ['¿qué suscripciones tengo activas?', '¿cuántos cobros hubo esta semana?', '¿cuántas landings tengo publicadas?']) {
    const veredicto = clasificarIntencion(texto, { canal: 'app' });
    const of = herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false }).ofrecibles ?? [];
    const destructivas = of.filter((n) => { const d = porId(n); return !!d && esDestructiva(d); });
    assert.deepEqual(destructivas, [], `«${texto}» ofrece destructivas`);
  }
});

test('9. «Anotado» se nota; un estado LEÍDO de los datos no', () => {
  for (const m of ['La cuota 13 quedó registrada como cobrada el 16/10 por 423,53 USD.', 'El pago de Ana quedó registrado el 16/10.',
    'Según su ficha, el RFC quedó guardado el 20/10.', 'Actualizado al día de hoy, tienes 12 leads en Seguimiento.',
    'Registrados esta semana: 14 leads nuevos.', 'Lo recuerdo: el lunes me dijiste que el horario es de 7:30 a 9:30.']) {
    assert.deepEqual(afirmacionesDeHecho(m), [], `«${m}» se tomó como algo que MaKo hizo`);
  }
  assert.ok(afirmacionesDeHecho('¡Guardado!').length && afirmacionesDeHecho('Lo recordaré para la próxima.').length);
});

test('10. en «Editar», el estilo de los datos de pago es la VISTA', () => {
  for (const m of ['Cambiá el color de los montos de las cuotas', 'Poné las fechas de los pagos en negrita', 'Poné el plan de pagos más grande',
    'Mové las fechas de pago al costado', 'Cambiá el formato de las fechas de pago a dd/mm']) {
    assert.equal(pistaDeEdicion(m), PISTA_EDICION_FICHA, `«${m}» se tomó como un dato`);
  }
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. la 9-bis sin `!QUEJA_NO_ANDA`                                 → rojo el 1.
//   2. la regla 1 sin `!QUEJA_NO_ANDA`                               → rojo el 1.
//   3. `esPedidoDeCobro` sin el tipo `plan`                          → rojo el 2.
//   4. `DEL_PLAN_COBRO` tomando «el plan de pagos» como el Plan       → rojo el 2.
//   5. `pistaDeEdicion` devolviendo siempre la de la vista            → rojo el 3.
//   6. el área cobros sin los datos fiscales                         → rojo el 4.
//   7. `ofrecibles` siempre vacío                                    → rojo el 4.
//   8. `afirmacionesDeHecho` sin `HECHO_EN_MEMORIA`                  → rojo el 5.
//   (28/10, la revisión) 9. la regla 1 con `QUEJA_NO_ANDA` en vez de `QUEJA_DE_LA_APP`  → rojo el 6.
//   10. «quincena» sola como objeto del plan                          → rojo el 7.
//   11. los ofrecibles con destructivas                               → rojo el 8.
//   12. `HECHO_EN_MEMORIA` sin pedir la forma sin sujeto              → rojo el 9.
//   13. `DE_LA_VISTA` sin el estilo (color, negrita, formato…)        → rojo el 10.
