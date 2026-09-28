// =============================================================================
// Un funnel armado a mano puede quedar roto Y CALLADO
// =============================================================================
// Renombrar una etapa es seguro y ya pasa en producción: toda la lógica cuelga de
// la CLAVE canónica, del `kind` y del ORDEN — la única comparación por label en
// todo el repo es `mismoPipeline`, y es deliberada. Lo que NO es seguro es el
// `kind` y el orden, y el editor de /funnel los deja poner como sea.
//
// EL CASO REAL, medido el 28/09/2026 sobre el funnel que una inmobiliaria armó a
// mano (traído de producción tal cual, es el fixture de abajo):
//
//   lead    · entrada · «Lead (Instant form)»
//   agenda  · grupo   · «En revision»
//   ganado  · grupo   · «Calificado»             ← la venta, tipada como grupo
//   st0     · CIERRE  · «NO Calificado»          ← el DESCARTE, tipado como cierre
//   st1     · reunion · «TASACION / PRE LISTING»
//
// Corriendo `funnelReqInfo` + `stepsForStage` con ese pipeline: «NO Calificado» da
// `esVenta: true` y pide fecha de R1, asistencia, el Fathom, el CLOSER y el MONTO
// DE CIERRE — o sea que el sistema pide el monto de la venta para DESCALIFICAR a
// alguien. Y «Calificado», cuya clave hace que `terminalEstadoFor` escriba
// `estado_lead='ganado'`, da `esVenta: false` y no pide nada.
//
// La consecuencia se mide en una consulta: ese workspace tiene 5 leads en `ganado`
// y CERO con monto de cierre cargado. Nada falló nunca — la pantalla lo dejó
// guardar y no dijo una palabra.
//
// Probado rompiéndolo (con el guard puesto, 5 pasan y 0 fallan):
//   · la regla de la venta tipada (la 1) se saca        -> 4 / 1
//   · la regla del cierre que no es último (la 3) se saca -> 4 / 1
//   · el editor deja de dibujar los avisos              -> 4 / 1

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  problemasDePipeline, DEFAULT_PIPELINE, FUNNEL_TEMPLATES, conTerminales, generateFunnel, esTerminal,
  MAX_LABEL_ETAPA,
  type Stage,
} from '../lib/pipeline';

/** El pipeline REAL del cliente, copiado de `funnels.data.pipeline` en producción. */
const ROTO: Stage[] = [
  { key: 'lead', kind: 'entrada', label: 'Lead (Instant form)' },
  { key: 'agenda', kind: 'grupo', label: 'En revision' },
  { key: 'ganado', kind: 'grupo', label: 'Calificado' },
  { key: 'st0', kind: 'cierre', label: 'NO Calificado' },
  { key: 'st1', kind: 'reunion', label: 'TASACION / PRE LISTING' },
] as Stage[];

test('⚠️ el funnel real y roto: los DOS problemas se nombran', () => {
  const p = problemasDePipeline(ROTO);
  // La venta tipada como grupo: por eso no pide el monto.
  assert.ok(
    p.some((t) => t.includes('Calificado') && /etapa de venta/i.test(t)),
    `no avisó que la etapa de venta no es el cierre: ${JSON.stringify(p)}`,
  );
  // Y el cierre que no es el último: por eso la última exige menos que la cuarta.
  assert.ok(
    p.some((t) => t.includes('NO Calificado') && /última etapa/i.test(t)),
    `no avisó que el cierre no es la última etapa: ${JSON.stringify(p)}`,
  );
  // El aviso tiene que NOMBRAR la etapa. «Hay un problema en tu funnel» no sirve:
  // el cliente tiene cinco y no sabe cuál tocar.
  for (const t of p) {
    assert.ok(/«[^»]+»/.test(t), `este aviso no nombra ninguna etapa: ${t}`);
  }
});

test('⚠️ y NO avisa de lo que está bien: cero falsos positivos en lo que sale de fábrica', () => {
  // Es la mitad que decide si el aviso sirve. Un guard que marca los pipelines
  // buenos se ignora en una semana, y con él se ignora el caso real.
  assert.deepEqual(problemasDePipeline(DEFAULT_PIPELINE), [], 'el pipeline por default no puede tener avisos');
  for (const t of FUNNEL_TEMPLATES) {
    assert.deepEqual(
      problemasDePipeline(t.pipeline as Stage[]), [],
      `la plantilla «${t.id}» —que la sembramos nosotros— dispara avisos: ${JSON.stringify(problemasDePipeline(t.pipeline as Stage[]))}`,
    );
  }
});

test('cada regla se dispara sola, sin arrastrar a las otras', () => {
  const nombre = (t: string[]) => t.join(' | ');
  // Dos cierres.
  const dos = problemasDePipeline([
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'x', kind: 'cierre', label: 'Uno' },
    { key: 'ganado', kind: 'cierre', label: 'Otro' },
  ] as Stage[]);
  assert.ok(dos.some((t) => /2 etapas de cierre/.test(t)), nombre(dos));

  // Ningún cierre: no es un error, y se dice igual. El fixture LLEVA `ganado` a propósito,
  // para aislar esta regla de la de «falta la terminal» — si no, saltan las dos y el test
  // deja de decir cuál se disparó.
  const sin = problemasDePipeline([
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'agenda', kind: 'reunion', label: 'Llamada' },
    { key: 'ganado', kind: 'grupo', label: 'Ganado' },
  ] as Stage[]);
  // Dos: «ninguna etapa es cierre» y «la venta no está tipada como cierre», que son la misma
  // cosa mirada desde dos lados y las dos ayudan a arreglarla.
  assert.equal(sin.length, 2, nombre(sin));
  assert.ok(sin.some((t) => /ninguna etapa está tipada como cierre/i.test(t)), nombre(sin));

  // Un cierre sobre una clave que el sistema lee como PERDIDA: es la vuelta entera.
  const perdido = problemasDePipeline([
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'descal', kind: 'cierre', label: 'Descartado' },
  ] as Stage[]);
  assert.ok(
    perdido.some((t) => /descalificado/.test(t)),
    `no avisó que un cierre sobre una clave de descarte pide el monto de una venta: ${nombre(perdido)}`,
  );

  // Y una lista vacía no es un funnel roto: es un funnel que no existe.
  assert.deepEqual(problemasDePipeline([]), []);
});

test('el EDITOR los dibuja, y arriba del mapa', () => {
  // ⚠️ Escribir la función no es ofrecerla. Un `problemasDePipeline` que nadie
  // llama es exactamente el caso que AGENTS.md documenta: compila, tiene test, y
  // no se ejecuta nunca.
  const ed = readFileSync(join(import.meta.dirname, '../app/funnel/FunnelEditor.tsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(ed, /problemasDePipeline\(pipeline\)/, 'el editor no calcula los problemas');
  assert.match(ed, /problemas\.map\(/, 'el editor no dibuja los problemas');
  // Arriba del mapa: después de un lienzo de 600 px no lo lee nadie.
  const iAviso = ed.indexOf('problemas.map(');
  const iMapa = ed.indexOf('canvasRef.current = el');
  assert.ok(iAviso > 0 && iMapa > 0, 'no se ubicaron el aviso y el mapa');
  assert.ok(iAviso < iMapa, 'el aviso tiene que ir ANTES del mapa del funnel');
});

test('⚠️ AVISA, no bloquea: guardar nunca se bloquea', () => {
  // Es la decisión del 17/09: mover y cambiar se guardan siempre, y lo que falta
  // queda pendiente. Un editor que se niega a guardar deja al cliente sin salida
  // en la pantalla donde configura su negocio.
  const ed = readFileSync(join(import.meta.dirname, '../app/funnel/FunnelEditor.tsx'), 'utf8');
  const i = ed.indexOf('const problemas =');
  assert.ok(i > 0, 'no se encontró el cálculo de problemas');
  // Nada entre el cálculo y el final puede usar `problemas` para frenar el guardado.
  assert.ok(
    !/problemas\.length\s*(>|!==)\s*0\s*\)\s*return/.test(ed) && !/if \(problemas\.length\) return/.test(ed),
    'los problemas del pipeline no pueden impedir guardar',
  );
});

test('⚠️ la pregunta de «de dónde entran tus leads» está en los TRES montajes del editor', () => {
  // `funnels.data.entradas` decide si un opt-in de FORMULARIO entra al CRM. Medido el
  // 28/09/2026: estaba vacío en SEIS de los workspaces con `declarado = true` (1, 4, 10, 13,
  // 14, 15), así que a todos ellos un formulario se les descartaría. Lo único que los salva
  // hoy es la excepción de Cal.com, y el único que lo declaró es el ws11 — que resulta ser
  // el único que recibe formularios sin reserva (6 de 8).
  //
  // La causa no era el dato: la ÚNICA pantalla donde se declara era /funnel, que NO está en
  // el nav. Los otros dos montajes del editor lo montaban sin la tarjeta, así que quien
  // configuraba su funnel por el camino normal nunca veía la pregunta.
  //
  // Probado rompiéndolo: se saca el `encabezado` de /second-brain → 5 / 1.
  for (const ruta of ['../app/funnel/page.tsx', '../app/onboarding/page.tsx', '../app/second-brain/page.tsx']) {
    const t = readFileSync(join(import.meta.dirname, ruta), 'utf8');
    assert.match(t, /<EntradasCard/, `${ruta} monta el editor del funnel SIN la tarjeta de entradas`);
  }
  // Y la herencia del canal se resuelve en UN lugar: `funnels.canal = null` significa
  // «heredá el del negocio», y repetido en tres pantallas el tercero se queda viejo.
  for (const ruta of ['../app/funnel/page.tsx', '../app/onboarding/page.tsx', '../app/second-brain/page.tsx']) {
    const t = readFileSync(join(import.meta.dirname, ruta), 'utf8');
    assert.match(t, /canalEfectivo\(/, `${ruta} resuelve el canal por su cuenta en vez de usar canalEfectivo`);
  }
});

test('⚠️ las CUATRO terminales están siempre, son únicas, y sólo se renombran', () => {
  // Decisión de Martín (28/09/2026): «Ganado, Perdido, Descalificado y No Responde deberían
  // estar SIEMPRE, no importa qué funnel es. No dejes eliminar esas etapas en ningún funnel.
  // Y son únicas: no puede haber 2 ganados en un mismo funnel, porque ahí justamente se
  // rompen los datos que MaKo pide en esas etapas. Sí pueden cambiarle el nombre».
  //
  // ⚠️ NO SON CUATRO COSAS IGUALES: son 1 + 3. `perdido`, `descal` y `noresp` ya eran
  // imborrables porque las inyecta la derivación. `ganado` vivía en el pipeline editable y el
  // botón de borrar la aceptaba — y borrarla no rompe nada ruidoso: ninguna venta vuelve a
  // escribir estado_lead='ganado' y los OCHO lectores de facturación cuentan cero, sin error
  // y sin log. Mi propio chequeo de estructura tampoco la cazaba.
  //
  // Probado rompiéndolo (con el guard puesto, 8 pasan y 0 fallan):
  //   · `conTerminales` deja de reponer el ganado que falta   -> 7 / 1
  //   · `generateFunnel` deja de inyectarlo                    -> 7 / 1
  //   · el guardado deja de llamar a `conTerminales`           -> 7 / 1
  //   · el editor vuelve a dejar borrar una terminal           -> 7 / 1
  const sinGanado = [
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'agenda', kind: 'reunion', label: 'Llamada' },
    { key: 'st0', kind: 'cierre', label: 'Cerrado' },
  ] as Stage[];

  // 1) Se AVISA que falta, porque un arreglo silencioso sobre el funnel de alguien tampoco
  //    está bien.
  assert.ok(
    problemasDePipeline(sinGanado).some((t) => /Ganado/.test(t)),
    'un pipeline sin la etapa de Ganado tiene que avisarlo',
  );
  // 2) Y se REPONE al guardar, que es el lugar que manda: el pipeline es un argumento de una
  //    server action, así que la pantalla no es la última palabra.
  assert.ok(conTerminales(sinGanado).some((s) => s.key === 'ganado'), 'conTerminales no repuso el ganado');
  // 3) Y la derivación la dibuja igual, lo que cura a los funnels ya guardados sin migración.
  assert.ok(generateFunnel(sinGanado).stages.some((s) => s.key === 'ganado'), 'la derivación no inyecta ganado');

  // 4) Únicas. La segunda hoy se EVAPORA en la derivación: queda guardada y sin columna, que
  //    es la peor forma de no existir.
  const dos = [
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'ganado', kind: 'cierre', label: 'Vendido' },
    { key: 'ganado', kind: 'grupo', label: 'Otro vendido' },
  ] as Stage[];
  const unico = conTerminales(dos).filter((s) => s.key === 'ganado');
  assert.equal(unico.length, 1, 'quedaron dos ganado');
  assert.equal(unico[0].label, 'Vendido', 'se quedó con la segunda en vez de la primera');

  // 5) Renombrar es lo ÚNICO que se puede, y tiene que sobrevivir al saneo.
  const renom = [
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'ganado', kind: 'cierre', label: 'Escriturado' },
  ] as Stage[];
  assert.equal(conTerminales(renom).find((s) => s.key === 'ganado')?.label, 'Escriturado');

  // 6) Y las cuatro claves son las cuatro. Ojo: la clave es `descal`, el ESTADO es
  //    'descalificado' — no son el mismo string y confundirlos deja el guard cazando nada.
  for (const k of ['ganado', 'perdido', 'descal', 'noresp']) assert.ok(esTerminal(k), k);
  for (const k of ['lead', 'agenda', 'st0', 'descalificado']) assert.ok(!esTerminal(k), k);
});

test('⚠️ y el guardado y el editor las respetan, no sólo la función', () => {
  // Escribir la función no es ofrecerla: un `conTerminales` que nadie llama compila, tiene
  // test y no se ejecuta nunca.
  const act = readFileSync(join(import.meta.dirname, '../app/crm/actions.ts'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.match(act, /conTerminales\(pipeline\)/, 'saveFunnelAction no garantiza las terminales');
  assert.ok(
    !/saveFunnelDe\(funnelId, pipeline,/.test(act) && !/saveFunnelDefault\(pipeline,/.test(act),
    'el guardado sigue escribiendo el pipeline crudo, sin pasar por conTerminales',
  );
  const ed = readFileSync(join(import.meta.dirname, '../app/funnel/FunnelEditor.tsx'), 'utf8');
  // ⚠️ La aserción va sobre el `disabled`, no sobre «aparece esTerminal en el archivo». La
  // primera versión buscaba la función en cualquier lado y quedaban tres usos (el title y el
  // style), así que sacarla del `disabled` —que es lo único que impide borrar— pasaba el test
  // igual. Una rotura que no falla es una aserción que mide otra cosa.
  assert.match(
    ed, /disabled=\{pipeline\.length <= 1 \|\| esTerminal\(s\.key\)\}/,
    'el botón de borrar del editor volvió a aceptar una etapa terminal',
  );
});

test('⚠️ «Editar funnel» abre EL funnel que estás mirando, no el del negocio', () => {
  // Medido el 28/09/2026 con tres funnels en un workspace: el link del menú del CRM iba a
  // /funnel pelado, así que desde «Sistema DOS» se editaba el funnel del negocio — y el
  // editor no da ninguna pista de cuál abrió. Guardar ahí pisa el funnel equivocado.
  //
  // ⚠️ Y pasar el id no alcanzaba: el CRM viaja con `?funnel=` y /funnel lee `?f=`. Dos
  // páginas con dos convenciones — el id hay que pasarlo con el nombre que espera la OTRA.
  const tb = readFileSync(join(import.meta.dirname, '../app/crm/CrmToolbar.tsx'), 'utf8');
  assert.match(tb, /href=\{funnelActivo \? `\/funnel\?f=\$\{funnelActivo\}`/,
    'el link de editar funnel volvió a ir sin el funnel activo, o con el parámetro equivocado');
  const bd = readFileSync(join(import.meta.dirname, '../app/crm/CrmBoard.tsx'), 'utf8');
  assert.match(bd, /<AccionesHeader[^>]*funnelActivo=\{funnelActivo\}/,
    'el tablero no le pasa el funnel activo al menú');
  // Y /funnel tiene que seguir leyendo `?f=`: si cambia, el link de arriba queda mudo.
  const fp = readFileSync(join(import.meta.dirname, '../app/funnel/page.tsx'), 'utf8');
  assert.match(fp, /searchParams: Promise<\{ f\?: string \}>/, '/funnel dejó de leer ?f=');
});

test('⚠️ la etapa se edita desde su COLUMNA, y el menú está enchufado', () => {
  // Pedido de Martín (28/09/2026): «en el lugar donde hoy está el 14 que estén 3 puntitos
  // para opciones de editar esa columna/etapa del funnel. Y que los cambios se guarden. Que
  // se pueda renombrar o eliminar, y otra opción de agregar nueva etapa. El actual 14 que
  // esté posterior al título».
  //
  // ⚠️ Y EL MENÚ MANDA LA OPERACIÓN, NO EL PIPELINE. Al tablero le llegan las etapas ya
  // GENERADAS —el pipeline crudo nunca viaja al navegador— así que reconstruirlo desde lo
  // que se dibuja le haría perder todo lo que la derivación agrega y quita. Por eso hay una
  // action angosta que lee, parcha y guarda del lado del server.
  //
  // Probado rompiéndolo (con todo puesto, 11 pasan y 0 fallan):
  //   · el menú deja de llamar a la action     -> 10 / 1
  //   · el input pierde el maxLength           -> 10 / 1
  //   · el contador se mueve fuera del título -> 10 / 1
  const bd = readFileSync(join(import.meta.dirname, '../app/crm/CrmBoard.tsx'), 'utf8');

  // 1) El menú existe, y las tres opciones.
  for (const op of ['renombrar', 'agregar', 'eliminar']) {
    assert.ok(bd.includes(`value: '${op}'`), `falta la opción «${op}» en el menú de la columna`);
  }
  // 2) Y está ENCHUFADO: escribir la salida no es ofrecerla.
  assert.match(bd, /editarEtapaAction\(op, funnelActivo/, 'el menú no llama a la action con el funnel activo');
  assert.match(bd, /router\.refresh\(\)/, 'sin refresh el cambio se guarda y la pantalla sigue igual');

  // 3) El tope de caracteres, que es lo que impide que un título rompa el diseño.
  assert.match(bd, /maxLength=\{MAX_LABEL_ETAPA\}/, 'el input de renombrar no topea el largo');
  assert.ok(MAX_LABEL_ETAPA >= 24, `el tope es ${MAX_LABEL_ETAPA}: el label más largo guardado hoy tiene 24 y se le recortaría`);

  // 4) El contador va DESPUÉS del título, y el menú donde estaba el contador.
  // ⚠️ NO ALCANZA CON EL ORDEN. La primera versión pedía título < contador < menú, y eso lo
  // cumple también el contador puesto FUERA del grupo del título — que es exactamente el
  // layout viejo, con el `space-between` empujándolo al otro extremo. Lo que hay que fijar es
  // que el contador esté DENTRO del mismo grupo flex que el nombre: ahí queda pegado a él.
  const iTitulo = bd.indexOf('title={c.label}');
  const iMenu = bd.indexOf('Opciones de la etapa');
  assert.ok(iTitulo > 0 && iMenu > 0, 'no se ubicaron el título y el menú');
  const grupo = bd.slice(iTitulo, iMenu);
  const iContador = grupo.indexOf('{cards.length}');
  const iCierreGrupo = grupo.indexOf('</div>');
  assert.ok(iContador > 0, 'el contador ya no está entre el título y el menú');
  assert.ok(
    iContador < iCierreGrupo,
    'el contador quedó FUERA del grupo del título: con space-between se va al otro extremo, que es el layout que Martín pidió cambiar',
  );

  // 5) Y una terminal no se puede eliminar desde acá tampoco.
  assert.match(bd, /disabled: esTerminal\(c\.key\)/, 'el menú deja eliminar una etapa terminal');
});

test('⚠️ cada funnel del desplegable tiene su lápiz, y abre EL suyo', () => {
  // «También al lado de cada uno debe aparecer el botón de editar, para editar las etapas de
  // ese funnel». El `Dropdown` del repo ya sabía dibujar acciones por renglón: lo que faltaba
  // era usarlo.
  const tb = readFileSync(join(import.meta.dirname, '../app/crm/CrmToolbar.tsx'), 'utf8');
  assert.match(tb, /acciones: \[\{/, 'los funnels del desplegable no tienen su botón de editar');
  // Con `?f=`, que es lo que /funnel lee. Con `?funnel=` abriría el del negocio.
  assert.match(tb, /router\.push\(`\/funnel\?f=\$\{f\.id\}`\)/, 'el lápiz no abre el funnel de ESA fila');
});

test('⚠️ un funnel nuevo nace VACÍO y con SUS etapas', () => {
  // Martín lo reportó TRES veces, la última así: «creé una prueba 3 y aún no cambió
  // absolutamente nada... los mismos leads, se cargó todo lleno en lugar de vacío... las
  // mismas etapas en lugar de preguntarme».
  //
  // ⚠️ ERAN DOS CAUSAS APILADAS, y arreglar una sola no se nota. (1) El selector cambiaba
  // las COLUMNAS y no los leads: un lead no pertenecía a ningún funnel. (2) Y un funnel
  // nuevo nacía SIN etapas, así que caía a la plantilla genérica — que en un workspace que
  // nunca tocó su funnel es IDÉNTICA a la del negocio. Con sólo el filtro, el tablero nuevo
  // quedaba con las columnas del negocio y cero tarjetas; con sólo las etapas, con columnas
  // propias y los 1.145 leads de siempre.
  //
  // Probado rompiéndolo (con todo puesto, 12 pasan y 0 fallan):
  //   · el CRM vuelve a pedir todos los leads       -> 11 / 1
  //   · el funnel nuevo nace sin etapas             -> 11 / 1
  //   · el modal deja de preguntar el canal         -> 11 / 1
  const pg = readFileSync(join(import.meta.dirname, '../app/crm/page.tsx'), 'utf8');
  const ld = readFileSync(join(import.meta.dirname, '../lib/leads.ts'), 'utf8');
  const pc = readFileSync(join(import.meta.dirname, '../lib/producto-con-funnel.ts'), 'utf8');
  const tb = readFileSync(join(import.meta.dirname, '../app/crm/CrmToolbar.tsx'), 'utf8');

  // 1) El tablero pide los leads de SU funnel.
  assert.match(pg, /listLeadsDeFunnel\(funnelId\)/, 'el CRM volvió a pedir todos los leads del workspace');
  // ⚠️ Y el filtro NO está en la lectura compartida: `listLeads()` tiene otros seis
  //    llamadores que necesitan el negocio entero (MaKo, Fathom, la búsqueda). Filtrar ahí
  //    no falla: devuelve de menos, que es peor.
  assert.ok(
    !/_listLeads\([^)]*funnel/i.test(ld),
    'el filtro por funnel se metió en listLeads(): eso rompe en silencio la búsqueda de MaKo, el enganche de Fathom y los conteos del negocio',
  );
  // null = el del negocio, y eso NO puede cambiar: si un lead sin funnel dejara de
  // aparecer, el CRM quedaría vacío para todos el día del deploy.
  assert.match(ld, /funnelId == null \? q\.is\('funnel_id', null\)/, 'los leads sin funnel dejaron de ser los del negocio');

  // 2) El funnel nuevo nace con las etapas del canal que se eligió.
  assert.match(pc, /templateDeCanal\(canal\)/, 'el funnel nuevo volvió a nacer sin etapas');
  assert.match(pc, /pipeline: tpl\?\.pipeline/, 'la plantilla no se siembra en el funnel nuevo');

  // 3) Y el modal PREGUNTA, que es lo que no hacía.
  assert.match(tb, /CANALES\.map/, 'el modal de nuevo producto no pregunta cómo se vende');
  assert.match(tb, /crearProductoAction\(n, canal\)/, 'el modal no manda el canal elegido');
  // Sin default: preseleccionar haría que la mayoría cree su tablero con las etapas de otro
  // negocio sin darse cuenta, que es el mismo bug con un paso más.
  assert.match(tb, /if \(!canal\)/, 'el canal dejó de ser obligatorio');

  // 4) Y el lead que se crea ahí CAE en ese funnel, o desaparece de la pantalla donde se
  //    acaba de cargar.
  const nl2 = readFileSync(join(import.meta.dirname, '../app/crm/new/NewLeadForm.tsx'), 'utf8');
  assert.match(nl2, /crearLeadEnTableroAction\(fd, enModal\.funnelId/, 'el alta no manda el funnel del tablero');
});
