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
import { execFileSync } from 'node:child_process';
import {
  problemasDePipeline, DEFAULT_PIPELINE, FUNNEL_TEMPLATES, conTerminales, generateFunnel, esTerminal,
  MAX_LABEL_ETAPA,
  type Stage,
} from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');

/**
 * Los .ts/.tsx de `app/` y `lib/` que están EN GIT.
 *
 * ⚠️ `git ls-files` lista el ÍNDICE, no el disco: un archivo nuevo sin commitear no se
 * revisa. Es el mismo trato que el guard de voseo, y la contracara es la que importa acá —
 * lo que se despliega es el commit, no el árbol de trabajo.
 */
function archivosDeProducto(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/)
    .map((f) => f.trim())
    .filter((f) => /\.tsx?$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 300, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

/** Las páginas que montan un componente, buscadas y no escritas a mano. */
function paginasQueMontan(etiqueta: string): string[] {
  return archivosDeProducto().filter((f) => /page\.tsx$/.test(f) && readFileSync(join(RAIZ, f), 'utf8').includes(etiqueta));
}
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

test('⚠️ los problemas del embudo se calculan en el SERVER y se dibujan ARRIBA', () => {
  // ⚠️ Escribir la función no es ofrecerla. Un `problemasDePipeline` que nadie llama es
  // exactamente el caso que AGENTS.md documenta: compila, tiene test, y no se ejecuta nunca.
  //
  // ⚠️ ESTE TEST SE MUDÓ CON LA PIEZA (29/09/2026). Leía `app/funnel/FunnelEditor.tsx`, que
  // se borró al pasar todo al pop-up del CRM. Un test que lee un archivo por su ruta no se
  // entera de que ese archivo murió: si sólo se hubiera borrado, el aviso del embudo roto
  // habría desaparecido del producto SIN que nada fallara — y ése es justo el caso real de
  // la inmobiliaria que tipó su descarte como «cierre».
  //
  // Y el cálculo cambió de lado a propósito: al pop-up le llegan las etapas DERIVADAS y
  // `problemasDePipeline` mira el `kind` y el ORDEN del pipeline CRUDO, que nunca sale del
  // server. Calcularlo en la pantalla sería calcularlo sobre otra cosa.
  //
  // Probado rompiéndolo (el archivo entero da 17 / 0):
  //   · la lectura deja de calcular los problemas  -> 16 / 1
  //   · el pop-up deja de dibujarlos               -> 16 / 1
  //   · se dibujan DEBAJO de la lista de etapas    -> 16 / 1
  const ac = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');
  assert.match(ac, /problemas: problemasDePipeline\(cfg\.pipeline\)/,
    'la lectura del pop-up no calcula los problemas del embudo');

  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(md, /emb\.problemas\.map\(/, 'el pop-up no dibuja los problemas');
  // ARRIBA de la lista: debajo no lo lee nadie, porque para cuando se llega ahí la persona
  // ya tocó lo que venía a tocar.
  const iAviso = md.indexOf('emb.problemas.map(');
  const iLista = md.indexOf('etapas.map(');
  assert.ok(iAviso > 0 && iLista > 0, 'no se ubicaron el aviso y la lista');
  assert.ok(iAviso < iLista, 'el aviso tiene que ir ANTES de la lista de etapas');
});

test('⚠️ AVISA, no bloquea: guardar nunca se bloquea', () => {
  // Es la decisión del 17/09: mover y cambiar se guardan siempre, y lo que falta queda
  // pendiente. Una pantalla que se niega a guardar deja al cliente sin salida justo donde
  // configura su negocio.
  //
  // Probado rompiéndolo: el pop-up frena con `if (emb.problemas.length) return` -> 16 / 1.
  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8');
  assert.ok(
    !/problemas\.length\s*(>|!==)\s*0\s*\)\s*return/.test(md) && !/if \(emb\.problemas\.length\) return/.test(md),
    'los problemas del embudo no pueden impedir guardar',
  );
  // Y tampoco pueden apagar un control: un botón que no se puede apretar por un aviso es
  // un bloqueo con otro nombre.
  assert.ok(!/disabled=\{[^}]*problemas/.test(md), 'los problemas apagan un control del pop-up');
});
test('⚠️ la pregunta de «cómo entra tu gente» sobrevivió a las DOS mudanzas', () => {
  // `funnels.data.entradas` decide si un opt-in de FORMULARIO entra al CRM. Medido el
  // 28/09/2026: estaba vacío en SEIS de los workspaces con `declarado = true`, así que a
  // todos ellos un formulario se les descartaría.
  //
  // ⚠️ Y LA PANTALLA QUE LO PREGUNTA SE MUDÓ DOS VECES EN DOS DÍAS: vivía en /funnel, pasó
  // a la tab «El funnel» de /onboarding, y el 29/09 Martín pidió eliminar también ésa
  // («Tienes que eliminar esto, ya te lo habia pedido»). Hoy es la subtab «Cómo entran» del
  // pop-up del CRM, que es el ÚNICO lugar donde se configura un embudo.
  //
  // Lo que este test persigue no es dónde está, sino que EXISTA: cinco cosas leen ese dato
  // —los audios, el ensayo, las secuencias, el generador de landings y el estructurador de
  // campañas— y una mudanza que se lo lleve puesto no falla en ningún lado.
  //
  // Probado rompiéndolo (el archivo entero da 17 / 0):
  //   · el pop-up deja de montar `EmbudoEntradas`      -> 16 / 1
  //   · la lectura deja de devolver `entradas`         -> 16 / 1
  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8');
  assert.match(md, /<EmbudoEntradas/, 'el pop-up del embudo no pregunta cómo entra la gente');
  assert.ok(md.includes("'Cómo entran'"), 'la subtab de entradas cambió de nombre o se fue');
  const ac = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');
  assert.match(ac, /entradas: cfg\.entradas/, 'la lectura del pop-up no trae las entradas declaradas');
  // Y el canal EFECTIVO, que es lo que decide si además se pregunta por el encuentro de
  // fecha fija: `funnels.canal = null` significa «heredá el del negocio».
  assert.match(ac, /canalEfectivo\(cfg\.canal/, 'el pop-up resuelve el canal por su cuenta en vez de heredarlo');

  // ⚠️ Y EL EDITOR VIEJO NO PUEDE VOLVER. Dos editores del mismo jsonb —uno que autoguarda
  // por tecla y otro que manda operaciones— es la forma de que el embudo quede distinto
  // según por dónde se lo tocó.
  const enFunnel = execFileSync('git', ['ls-files', 'app/funnel'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
  assert.deepEqual(enFunnel, ['app/funnel/page.tsx'],
    'volvió a aparecer un editor de funnel fuera del CRM: ' + enFunnel.join(', '));
});
test('⚠️ /funnel se retiró: es un redirect, y nadie del producto lo sigue enlazando', () => {
  // «Quiero eliminar la ruta de funnel, que todo se edite como un pop-up dentro del mismo
  // CRM. Así es más simple».
  //
  // ⚠️ REDIRECT Y NO BORRADO: la ruta vivía en el panel de tracking que ve el CLIENTE en su
  // propia landing, y un 404 ahí es peor que la pantalla vieja. Lo que este test persigue es
  // lo otro: que ningún link del producto lleve a un destino que rebota.
  //
  // Probado rompiéndolo (los dos archivos juntos dan 78 / 0):
  //   · landing-token vuelve a `href: '/funnel'`               -> 77 / 1
  //     (ese link lo caza el test de landing-optin, que es el que mide el destino;
  //      éste caza el link que alguien escriba MAÑANA en cualquier otro archivo)
  const fp = readFileSync(join(import.meta.dirname, '../app/funnel/page.tsx'), 'utf8');
  assert.match(fp, /redirect\(await rutaConWs\(/, '/funnel dejó de redirigir');
  assert.ok(!fp.includes('<FunnelEditor'), '/funnel volvió a montar el editor');
  // ⚠️ Y CON `rutaConWs`: un `redirect()` pelado pierde el `?ws=` y deja al super admin
  // mirando su propia cuenta en vez del cliente que estaba abriendo.

  // Ningún archivo del producto puede enlazar a la ruta retirada.
  //
  // ⚠️ SE BUSCA UN LINK, NO LA PALABRA. El primer intento aceptaba `/funnel` rodeado de
  // comillas O DE ESPACIOS, y cazó quince falsos positivos: la ruta se nombra en la prosa
  // de los comentarios de medio repo («el editor de /funnel autoguarda en cada tecla»),
  // que es documentación correcta y no un destino. Lo que rompe es un destino, así que el
  // patrón exige que `/funnel` ARRANQUE una cadena y termine ahí o en un `?`.
  //
  // Se excluyen la propia página (es el redirect) y `revalidatePath('/funnel')`, que no es
  // un link sino un aviso a la caché de Next: la ruta sigue existiendo y su caché es suya.
  //
  // ⚠️ Y EL REGISTRO DE /admin/dev ES DOCUMENTACIÓN, no producto. Sus `bitacora.ts` cuentan
  // en prosa qué se hizo y nombran las rutas retiradas —es su trabajo—, sólo que la prosa
  // vive en una cadena y no en un comentario, así que la salida de arriba no la cubre. La
  // entrada que documenta ESTE retiro hizo fallar al guard que lo persigue.
  const DOCUMENTACION = [/^app\/admin\/dev\/.*bitacora\.ts$/, /^app\/admin\/dev\/areas\.ts$/, /^app\/admin\/docs\/catalogo\.ts$/];
  const malos: string[] = [];
  for (const f of archivosDeProducto()) {
    if (f === 'app/funnel/page.tsx') continue;
    if (DOCUMENTACION.some((re) => re.test(f))) continue;
    readFileSync(join(RAIZ, f), 'utf8').split('\n').forEach((linea, i) => {
      // Una línea de comentario no puede tener un link, y la convención de la casa es
      // nombrar una ruta entre backticks: sin esta salida, el guard se acusa a sí mismo
      // por los comentarios que explican que la ruta se retiró.
      if (/^\s*(\/\/|\*|\/\*)/.test(linea)) return;
      if (/revalidatePath/.test(linea)) return;
      if (/['"`]\/funnel['"`?]/.test(linea)) malos.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(malos, [], 'hay links vivos a la ruta /funnel, que hoy sólo redirige');
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

test('⚠️ y el guardado las respeta, no sólo la función', () => {
  // ⚠️ MUDADO CON LA PIEZA (29/09/2026): la mitad de este test leía el botón de borrar del
  // editor completo, que se borró. Lo que queda es lo que importa y lo que siempre importó:
  // el server es el que decide. La pantalla puede esconder el botón —y lo hace— pero el
  // cuerpo de una server action lo escribe quien quiera.
  //
  // Probado rompiéndolo: se saca el `esTerminal` de `editarEtapaAction` -> 16 / 1.
  const ac = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');
  const elim = ac.slice(ac.indexOf("} else if (op.op === 'eliminar')"), ac.indexOf("} else if (op.op === 'nutricion')"));
  assert.ok(elim.length > 100, 'no se encontró la rama que elimina una etapa');
  assert.match(elim, /esTerminal\(op\.key\)/, 'el server dejó de frenar el borrado de una terminal');
  // Y el guardado las garantiza aunque el cuerpo llegue sin ellas.
  assert.match(ac, /conTerminales\(pipeline\)/, 'saveFunnelAction dejó de garantizar las terminales');

  // La pantalla, del otro lado: las cuatro se dibujan FUERA de la lista que se reordena,
  // y ahí sólo se les puede cambiar el nombre.
  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8');
  assert.match(md, /emb\.fijas\.map\(/, 'el pop-up dejó de dibujar las etapas fijas');
  assert.ok(md.includes('no se puede quitar'), 'el pop-up no dice por qué una etapa fija no se toca');
});
test('⚠️ «Editar las etapas» abre un POP-UP, y sobre EL funnel que estás mirando', () => {
  // Medido el 28/09/2026 con tres funnels en un workspace: el link del menú del CRM iba a
  // /funnel pelado, así que desde «Sistema DOS» se editaba el funnel del negocio — y el
  // editor no daba ninguna pista de cuál había abierto. Guardar ahí pisaba el equivocado.
  //
  // La primera cura fue pasar el id con el nombre que espera la otra página (`?f=` y no
  // `?funnel=`). La definitiva fue sacar la URL del medio: el pop-up recibe el id como
  // prop, así que no hay dos convenciones que mantener de acuerdo.
  //
  // Probado rompiéndolo (el archivo entero da 15 / 0):
  //   · el menú vuelve a navegar en vez de abrir el pop-up  -> 14 / 1
  //   · el tablero abre el pop-up sin decirle qué funnel    -> 14 / 1
  const tb = readFileSync(join(import.meta.dirname, '../app/crm/CrmToolbar.tsx'), 'utf8');
  assert.match(tb, /onClick=\{\(\) => \{ setOpen\(false\); onEditarEtapas\(\); \}\}/,
    'el ítem del menú volvió a navegar en vez de abrir el pop-up');
  const bd = readFileSync(join(import.meta.dirname, '../app/crm/CrmBoard.tsx'), 'utf8');
  assert.match(bd, /onEditarEtapas=\{\(\) => setEtapasDe\(\{ id: funnelActivo,/,
    'el menú del CRM abre el pop-up sin decirle cuál es el funnel del tablero');
  assert.match(bd, /<EtapasModal funnelId=\{etapasDe\.id\}/,
    'el pop-up no recibe el funnel que se pidió abrir');
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
  // Abre el pop-up de ESA fila, que no tiene por qué ser el del tablero: desde «Curso» se
  // edita el embudo de «Mentoría» sin cambiar de tablero.
  assert.match(tb, /onClick: \(\) => onEditarEtapas\(f\.id, comoSeLlama\(f\)\)/, 'el lápiz no abre el funnel de ESA fila');
  const bd = readFileSync(join(import.meta.dirname, '../app/crm/CrmBoard.tsx'), 'utf8');
  assert.match(bd, /<SelectorFunnel[^>]*onEditarEtapas=\{\(id, nombre\) => setEtapasDe\(\{ id, nombre \}\)\}/,
    'el tablero no enchufa el lápiz del selector al pop-up');
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

test('⚠️ el pop-up de etapas: una operación por cambio, y el pipeline nunca viaja', () => {
  // «Quiero eliminar la ruta de funnel, que todo se edite como un pop-up dentro del mismo
  // CRM. Así es más simple. Y que sea simple la edición, nada compleja».
  //
  // ⚠️ LO QUE ESTE GUARD PERSIGUE NO ES QUE EL POP-UP EXISTA: es que no se convierta en el
  // editor viejo adentro de una caja. Dos reglas, y las dos ya se pagaron en este repo:
  //
  //   1) Al tablero le llegan las etapas ya DERIVADAS — el pipeline crudo nunca sale del
  //      server. Un «Guardar» que mande la lista reconstruida desde la pantalla le haría
  //      perder todo lo que la derivación agrega y quita, sin un solo error.
  //   2) Montar `FunnelEditor` acá adentro traería sus 527 líneas, su `<main>`, sus altos
  //      en `vh` y su autoguardado por tecla: las seis decisiones de «Montar una PANTALLA
  //      adentro de un modal», para contestar lo contrario de lo que se pidió.
  //
  // Probado rompiéndolo (el archivo entero da 15 / 0):
  //   · `mover` deja sacar de último al cierre          -> 14 / 1
  //   · `mover` acepta una etapa fuera del pipeline     -> 14 / 1
  //   · el pop-up deja de refrescar el tablero de atrás  -> 14 / 1
  //
  // ⚠️ Y UNA ROTURA QUE NO FALLÓ, que es la que enseña algo: la primera versión de la
  // aserción (1) era `!md.includes('FunnelEditor')`, y el archivo pasó a fallar sin que
  // nadie montara nada — el porqué de la decisión está escrito en su cabecera y nombra al
  // editor tres veces. Un guard que mira la PALABRA no distingue el código del comentario
  // que lo explica.
  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8');

  // 1) No es el editor viejo en una caja.
  //    ⚠️ Se mira lo que IMPORTA y lo que MONTA, no la palabra: el porqué de esta decisión
  //    está escrito en la cabecera del propio archivo y nombra a `FunnelEditor` tres veces.
  //    Un `includes` del nombre fallaba contra el comentario que lo explica.
  assert.ok(!/import[^;]*FunnelEditor/.test(md) && !md.includes('<FunnelEditor'), 'el pop-up volvió a montar el editor completo');
  assert.ok(!/import[^;]*saveFunnelAction/.test(md), 'el pop-up manda el pipeline entero desde el navegador');
  assert.match(md, /editarEtapaAction\(op, funnelId \?\? undefined\)/, 'el pop-up no manda la operación al funnel que abrió');

  // 2) Las cinco operaciones están enchufadas, y cada una es una op propia.
  for (const op of ['renombrar', 'eliminar', 'agregar', 'mover', 'nutricion']) {
    assert.ok(md.includes(`op: '${op}'`), `al pop-up le falta la operación «${op}»`);
  }

  // 3) El tablero de atrás se refresca en CADA cambio, no al cerrar: las columnas se leen
  //    en el server, así que sin esto se renombra una etapa y detrás sigue el nombre viejo.
  assert.match(md, /router\.refresh\(\)/, 'el pop-up no refresca el tablero que está tapando');

  const ac = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');

  // 4) Mover: sólo dentro del pipeline, y el cierre se queda último.
  //    ⚠️ Las tres terminales derivadas NO están en el pipeline: las agrega `generateFunnel`
  //    en cada lectura. Moverlas «funcionaría» —el guardado no falla— y la pantalla las
  //    volvería a dibujar donde estaban, que es la peor forma de no hacer nada.
  const mover = ac.slice(ac.indexOf("} else if (op.op === 'mover')"), ac.indexOf("    } else {", ac.indexOf("op.op === 'mover'")));
  assert.ok(mover.length > 100, 'no se encontró la rama que mueve una etapa');
  assert.match(mover, /if \(i < 0\) return \{ ok: false/, 'mover acepta una etapa que no está en el pipeline');
  assert.match(mover, /kind === 'cierre'/, 'mover deja sacar de último a la etapa donde se cierra la venta');

  // 5) Y la lectura que alimenta al pop-up se planta si el funnel se leyó en ERROR: con
  //    `origen === error` lo que se lee es el pipeline GENÉRICO, y dibujarlo le diría a la
  //    persona que su embudo es otro — y el cambio siguiente lo guardaría.
  const lec = ac.slice(ac.indexOf('export async function embudoEnDetalleAction'));
  assert.ok(lec.length > 200, 'no se encontró la lectura que alimenta al pop-up');
  assert.match(lec.slice(0, 1600), /origen === 'error'/, 'la lectura del pop-up dibuja el pipeline genérico cuando falla Supabase');

  // 6) ⚠️ LAS NUTRICIONES SE PIDEN CON `suppressed` VACÍO. Una nutrición suprimida NO sale
  //    de `generateFunnel` —`nut()` sale temprano y ni la coloca— así que pidiendo la lista
  //    real lo apagado es invisible, que es justo lo que se quiere poder volver a encender.
  assert.match(lec.slice(0, 2600), /generateFunnel\(cfg\.pipeline, \[\], cfg\.labels\)/,
    'el pop-up pide las nutriciones REALES: las apagadas no se podrían volver a encender');

  // 7) Y la op de nutrición valida el id contra las que ESTE embudo puede tener. `suppressed`
  //    es texto libre en un jsonb: sin esto se llena de ids que no significan nada.
  const nut = ac.slice(ac.indexOf("} else if (op.op === 'nutricion')"), ac.indexOf("} else if (op.op === 'mover')"));
  assert.ok(nut.length > 100, 'no se encontró la rama que apaga una nutrición');
  assert.match(nut, /posibles\.has\(op\.id\)/, 'la op de nutrición acepta cualquier id y ensucia `suppressed`');
});

test('⚠️ eliminar un embudo lo ARCHIVA, y hay por dónde recuperarlo', () => {
  // Pedido de Martín (29/09/2026): «Falta la opción de ELIMINAR, renombrar, los funnel. Con
  // mucho cuidado si un funnel tiene leads. Y siempre guardando una copia de seguridad en
  // caso de eliminar un funnel con leads, por si el usuario lo quiere "recuperar"».
  //
  // ⚠️ LA COPIA DE SEGURIDAD NO SE INVENTÓ: la columna `funnels.activo` existe desde la
  // 0170 y `listarFunnels` ya filtra por ella. Archivar saca el embudo de la pantalla y deja
  // la fila, su `data` entera y sus leads intactos. Una tabla de respaldo aparte sería un
  // segundo lugar con los mismos datos, que se queda viejo.
  //
  // Probado rompiéndolo, medido (el archivo entero da 17 / 0):
  //   · `archivarFunnel` deja archivar el default              -> 16 / 1
  //   · se saca el renglón «Embudos eliminados» del selector   -> 16 / 1
  //   · el conteo de leads devuelve 0 cuando la consulta falla -> 16 / 1
  const fn = readFileSync(join(RAIZ, 'lib/funnels.ts'), 'utf8');

  // 1) Archiva, no borra. En ningún lado hay un DELETE sobre funnels.
  assert.match(fn, /activo: false/, 'eliminar un embudo dejó de archivarlo');
  assert.ok(!/from\('funnels'\)[\s\S]{0,80}\.delete\(/.test(fn), 'apareció un DELETE sobre funnels: eso no se recupera');

  // 2) ⚠️ EL DEFAULT NO SE ARCHIVA, y el guard vive en el SERVER. El índice parcial
  //    `funnels_ws_default_uk` garantiza que un ws tiene exactamente uno, y medio repo
  //    asume que existe: getFunnelDefault, el CRM sin ?funnel=, el onboarding, los prompts.
  //    Archivarlo no daría error — daría un workspace cuyo embudo por defecto no se lee.
  const arch = fn.slice(fn.indexOf('export async function archivarFunnel'));
  assert.match(arch.slice(0, 1200), /fila\.es_default/, 'se puede archivar el embudo principal del workspace');

  // 3) Y hay por dónde volver: una copia que nadie puede ver no es una copia.
  assert.match(fn, /export async function restaurarFunnel/, 'no hay forma de recuperar un embudo eliminado');
  assert.match(fn, /export async function listarFunnelsArchivados/, 'no hay forma de VER los embudos eliminados');
  const tb = readFileSync(join(RAIZ, 'app/crm/CrmToolbar.tsx'), 'utf8');
  assert.ok(tb.includes("label: 'Embudos eliminados'"), 'el selector no ofrece la puerta de vuelta');
  assert.match(tb, /restaurarEmbudoAction/, 'la pantalla de eliminados no puede restaurar nada');

  // 4) ⚠️ EL CONTEO DE LEADS NO PUEDE DEVOLVER 0 CUANDO FALLA. «Este embudo no tiene leads»
  //    sobre uno lleno es lo que hace que alguien lo elimine tranquilo. Un error tira.
  const ld = readFileSync(join(RAIZ, 'lib/leads.ts'), 'utf8');
  const cnt = ld.slice(ld.indexOf('export async function contarLeadsDeFunnel'));
  assert.ok(cnt.length > 100, 'no se encontró el conteo de leads por embudo');
  assert.match(cnt.slice(0, 900), /if \(error\) throw/, 'el conteo de leads convierte un error en «cero leads»');
  //    Y cuenta con `head: true`: traerlos para contarlos toparía en 1000 y daría un número
  //    redondo perfectamente plausible sobre un embudo de 1.145.
  assert.match(cnt.slice(0, 900), /head: true/, 'el conteo baja las filas y va a topar en 1000');
});

test('⚠️ crear o eliminar un embudo NAVEGA DURO, no refresca', () => {
  // ⚠️ MEDIDO EN EL NAVEGADOR el 29/09/2026, y es lo que más costó de esta tanda: con
  // `router.push('/crm') + router.refresh()` la lista del selector quedaba SIEMPRE UN PASO
  // ATRÁS. Tras eliminar «Prueba 2» seguía mostrándola; tras recuperarla mostraba la lista
  // de antes de recuperarla — y la base decía la verdad en las dos. Cuatro segundos de
  // espera no alcanzaron.
  //
  // Lo que cambia acá no es una fila del tablero: es QUÉ EMBUDOS EXISTEN, que es el dato del
  // que cuelga media pantalla. Un borrado que parece no haber pasado es peor que uno lento,
  // así que se paga la recarga entera. Es la CUARTA forma de navegar de AGENTS.md, y por eso
  // va con `conWs`: sin el `?ws=`, el super admin que mira a un cliente termina en su CRM.
  //
  // Probado rompiéndolo (el archivo entero da 18 / 0):
  //   · eliminar vuelve a `router.push` + `refresh()`   -> 17 / 1
  //   · recuperar vuelve a `router.push` + `refresh()`  -> 17 / 1
  //   · la navegación dura pierde el `conWs`            -> 17 / 1
  for (const [f, etq] of [['app/crm/EtapasModal.tsx', 'eliminar'], ['app/crm/CrmToolbar.tsx', 'recuperar']] as const) {
    const t = readFileSync(join(RAIZ, f), 'utf8').replace(/^\s*\/\/.*$/gm, '');
    assert.match(t, /window\.location\.href = conWs\(/,
      `${etq} un embudo dejó de navegar duro: la lista va a quedar un paso atrás`);
  }
});
test('⚠️ renombrar un embudo escribe DONDE SE LEE, que puede no ser la tabla funnels', () => {
  // La pantalla muestra el nombre del PRODUCTO: todos los funnels se llaman «Funnel
  // principal» porque lo puso la 0170, y `listarFunnels` lo tapa con el del producto
  // principal. Escribir `funnels.nombre` y refrescar deja la pantalla EXACTAMENTE IGUAL —
  // un guardado que funciona, no da error, y no se ve.
  //
  // Probado rompiéndolo (el archivo entero da 17 / 0): se borra la rama del producto y
  // `renombrarFunnel` escribe siempre en `funnels` -> 16 / 1.
  //
  // ⚠️ Y LA PRIMERA ROTURA NO FALLÓ, que es lo que enseña algo: renombré la vista a
  // `v_funnel_productos_INEXISTENTE`, que SIGUE CONTENIENDO la cadena que el test busca.
  // Una rotura que no rompe lo que el test persigue no prueba nada — hay que borrar la
  // rama, no disfrazarla.
  const fn = readFileSync(join(RAIZ, 'lib/funnels.ts'), 'utf8');
  const ren = fn.slice(fn.indexOf('export async function renombrarFunnel'), fn.indexOf('function traducirChoque'));
  assert.ok(ren.length > 200, 'no se encontró el renombre de un embudo');
  assert.match(ren, /v_funnel_productos/, 'el renombre no mira si el embudo tiene producto: escribiría donde no se lee');
  assert.match(ren, /from\('productos'\)[\s\S]{0,60}\.update\(\{ nombre \}\)/, 'el renombre no escribe el nombre del producto');
  // Y el choque del índice único se traduce: el error crudo de Postgres no le dice nada a nadie.
  assert.match(fn, /Ya tienes un embudo que se llama/, 'un nombre repetido sale con el error crudo de la base');
});

test('⚠️ un menú de acciones no lleva la flecha del desplegable', () => {
  // Reportado así: «En las columnas son tres puntos "..." no 2 y una flecha». El control
  // reusa el `Dropdown` del repo —hace falta, porque el tablero vive dentro de un
  // `overflowX: auto` y un menú en flujo normal se recorta contra el borde de la columna—
  // y ese primitive dibujaba el `▾` sin preguntar. Con los dos juntos se leía «⋯ ▾».
  //
  // Probado rompiéndolo (el archivo entero da 15 / 0):
  //   · se le saca el `sinFlecha` al menú de la columna     -> 14 / 1
  const dd = readFileSync(join(RAIZ, 'app/components/Dropdown.tsx'), 'utf8');
  assert.match(dd, /\{!sinFlecha && \(/, 'el Dropdown volvió a dibujar la flecha sin preguntar');
  const bd = readFileSync(join(RAIZ, 'app/crm/CrmBoard.tsx'), 'utf8');
  const menu = bd.slice(bd.indexOf('placeholder="⋯"'));
  assert.ok(menu.slice(0, 400).includes('sinFlecha'), 'el menú «⋯» de la columna volvió a llevar flecha');
});
