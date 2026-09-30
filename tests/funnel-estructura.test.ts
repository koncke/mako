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
  problemasDePipeline, DEFAULT_PIPELINE, DEFAULT_STAGES, FUNNEL_TEMPLATES, conTerminales, generateFunnel, esTerminal,
  MAX_LABEL_ETAPA,
  type Stage,
} from '../lib/pipeline';

const RAIZ = join(import.meta.dirname, '..');

/**
 * El fuente SIN comentarios, para que un guard no se acuse a sí mismo: la convención de
 * la casa es explicar en el comentario justo lo que el guard prohíbe.
 *
 * ⚠️ LOS DE LÍNEA VAN PRIMERO. Al revés, un `//` que contenga la apertura de un bloque
 * —o un `text/*` adentro de un comentario— abre un bloque que se cierra páginas después,
 * y todo lo del medio queda invisible para el guard, que da verde sin haberlo mirado.
 */
const limpio = (src: string) => src.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

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
  // ⚠️ YA NO ES UNA SUBTAB: es un desplegable de la tab de etapas, y una pregunta del alta
  // de producto. «Elimina la tab de Cómo entran, eso debería estar como un paso al momento
  // de crear un nuevo producto... y se debería poder editar con un desplegable luego».
  // ⚠️ SE MIRA EL COMPONENTE QUE LO DIBUJA, NO LA FRASE. Esta aserción decía
  //    `md.includes('Cómo entran')` sobre el fuente SIN limpiar comentarios, así que la
  //    satisfacían las tres apariciones que había en la cabecera del archivo. Cuando el
  //    30/09 se borró el rótulo de la pantalla —«aún sigue el texto informal de "Cómo entra
  //    tu gente", por favor elimínalo»— el guard siguió en verde sobre algo que ya no se
  //    dibujaba. Un guard que mira la PALABRA no distingue el código del comentario que lo
  //    explica, y es el mismo error que la aserción de `FunnelEditor` de más abajo ya
  //    documenta veinte líneas después.
  assert.match(limpio(md), /<EmbudoEntradas/, 'el desplegable de entradas se fue del pop-up');
  assert.match(limpio(md), /entradasAbierto/, 'el panel de entradas ya no se puede abrir ni cerrar');
  const tb2 = readFileSync(join(RAIZ, 'app/crm/CrmToolbar.tsx'), 'utf8');
  assert.match(tb2, /declararEntradasAction\(entradas, null, r\.funnelId\)/,
    'el alta de producto dejó de preguntar cómo entra la gente');
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

  // ⚠️ Y LA PANTALLA DONDE SE RENOMBRAN SE MUDÓ (29/09, segunda tanda). Estaban como
  // pastillas abajo del pop-up y se fueron: «elimina En todos tus embudos, si quieren
  // cambiar el nombre ya lo pueden hacer en los 3 puntos de la columna». O sea que la
  // capacidad no se perdió —se movió—, y lo que hay que exigir es que el menú de la
  // columna SIGA ofreciendo renombrar una terminal. Si eso se cae, las cuatro se vuelven
  // intocables y nadie se entera.
  const bd = readFileSync(join(RAIZ, 'app/crm/CrmBoard.tsx'), 'utf8');
  assert.ok(bd.includes("value: 'renombrar'"), 'el menú de la columna dejó de ofrecer renombrar');
  // Y renombrar NO se apaga para una terminal: sólo eliminar.
  const menu = bd.slice(bd.indexOf("value: 'renombrar'"), bd.indexOf("onChange={(v) => {", bd.indexOf("value: 'renombrar'")));
  assert.ok(!/renombrar[\s\S]{0,120}disabled: esTerminal/.test(menu),
    'el menú de la columna apagó el renombre de una terminal: quedarían intocables');
  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8');
  assert.ok(!md.includes('En todos tus embudos'), 'volvió el bloque de las terminales al pop-up');
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
  //    ⚠️ SE OMITE, NO SE APAGA. Antes se dibujaba deshabilitada, con el rótulo «No se
  //    puede eliminar»: «si no se puede eliminar, no pongas directamente esa opción, no la
  //    dejes en gris» (30/09/2026). Una opción en gris ocupa el lugar de las que sí se
  //    pueden usar y se lee como que la app está rota.
  assert.match(bd, /esTerminal\(c\.key\) \? \[\] : \[\{ value: 'eliminar'/,
    'la opción de eliminar volvió a dibujarse (apagada o no) sobre una etapa terminal');
  assert.ok(!/label: 'No se puede eliminar'/.test(bd), 'volvió el rótulo de la opción apagada');
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
  assert.match(tb, /crearProductoAction\(nombre\.trim\(\), canal\)/, 'el modal no manda el canal elegido');
  // Sin default: preseleccionar haría que la mayoría cree su tablero con las etapas de otro
  // negocio sin darse cuenta, que es el mismo bug con un paso más.
  assert.match(tb, /if \(paso === 1 && !canal\)/, 'el canal dejó de ser obligatorio');

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

  // 1) Eliminar ARCHIVA. Borrar de verdad existe desde el 30/09, y es OTRA decisión en OTRO
  //    momento: sólo se puede sobre algo YA archivado, y antes pone a salvo a su gente.
  assert.match(fn, /activo: false/, 'eliminar un embudo dejó de archivarlo');
  assert.match(fn, /export async function eliminarFunnelDefinitivo/, 'se fue el borrado definitivo');
  const def = fn.slice(fn.indexOf('export async function eliminarFunnelDefinitivo'));
  // ⚠️ EL GUARD EN POSITIVO: sólo lo archivado. Sin esto, «eliminar» y «borrar para
  //    siempre» quedarían a un clic de distancia y nada se podría recuperar.
  assert.match(def.slice(0, 2200), /if \(fila\.activo\) throw new Error/,
    'se puede borrar para siempre un producto que todavía está en el tablero');
  // ⚠️ Y EL RESCATE VA ANTES DEL DELETE. `leads.funnel_id` no tiene foreign key: borrar la
  //    fila sin mover a su gente los deja apuntando a un id que no resuelve, y
  //    `listLeadsDeFunnel` los busca por igualdad exacta — no aparecen en ninguna pantalla,
  //    para siempre, sin un error y sin una fila borrada.
  const iRescate = def.indexOf("update({ funnel_id: destino })");
  const iDelete = def.indexOf('.delete()');
  assert.ok(iRescate > 0 && iDelete > iRescate,
    'el borrado definitivo no pone a salvo a los leads ANTES de borrar: quedarían invisibles en todos los tableros');

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
  // ⚠️ SE LLAMA «PRODUCTOS», NO «EMBUDOS», y va `sutil`: «debe ser Productos eliminados y
  //    ser mucho más sutil, solo un texto» (30/09/2026). El nombre del negocio es el del
  //    producto — «embudo» es como lo llama la tabla, no el cliente.
  assert.ok(tb.includes("label: 'Productos eliminados', sutil: true"),
    'el selector no ofrece la puerta de vuelta, o volvió a llamarse «embudos» / a pesar como una opción más');
  assert.ok(!/label: 'Embudos eliminados'/.test(tb), 'volvió el nombre viejo');
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

test('⚠️ sin leads NO hay fricción, y el deshacer devuelve la MISMA etapa', () => {
  // «Si intento eliminar una columna que NO tiene ningún lead, no debería haber nada de
  // fricción. Solo que me salte el pop-up de deshacer que dura 5 segundos. Lo mismo con un
  // producto sin leads. En caso de que sí tengan leads cualquiera de las 2 opciones,
  // debería saltar otro pop-up de confirmación, no un recuadro abajo».
  //
  // ⚠️ EL DESHACER NO PUEDE SER `agregar` OTRA VEZ. Esa op acuña una clave NUEVA, y la
  // clave es lo que ata a un lead a su etapa: deshacer así devolvería una columna con el
  // mismo nombre y los leads afuera — peor que no deshacer, porque parece que funcionó.
  //
  // ⚠️ Y TODAS LAS ETAPAS ARRANCAN EN 0 EN EL CONTEO. Contando sólo lo que aparece, una
  // etapa vacía no entra al mapa y el lector recibe `undefined`, que la pantalla lee como
  // «no pude contar» y pregunta: la fricción volvía justo en el único caso donde no va.
  // Medido en el navegador antes de arreglarlo.
  //
  // Probado rompiéndolo (el archivo entero da 19 / 0):
  //   · el conteo deja de inicializar las etapas en 0  -> 18 / 1
  //   · el deshacer vuelve a usar `agregar`            -> 18 / 1
  //   · quitar una columna vacía vuelve a preguntar    -> 18 / 1
  const ac = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');
  assert.match(ac, /for \(const st of cfg\.stages\) out\[st\.key\] = 0;/,
    'el conteo por etapa no arranca en 0: una etapa vacía se leería como «no sé» y pediría confirmación');
  assert.match(ac, /op\.op === 'insertar'/, 'no hay forma de devolver una etapa quitada');
  assert.match(ac, /deshacer = \{ etapa: \{ key: quitada\.key/,
    'eliminar dejó de devolver la etapa que sacó: el deshacer tendría que acuñar otra clave');

  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8');
  assert.match(md, /if \(n === 0\) \{ hacer\(\); return; \}/, 'quitar una etapa vacía volvió a pedir confirmación');
  assert.match(md, /op: 'insertar', etapa: d\.etapa, at: d\.at/, 'el toast de deshacer no devuelve la etapa');
  assert.match(md, /extras\?\.leads === 0/, 'eliminar un producto vacío volvió a pedir confirmación');
  // Y cuando SÍ hay algo que perder, se pregunta con un DIÁLOGO — no con un recuadro abajo.
  assert.match(md, /<Confirm/, 'la confirmación volvió a ser un recuadro en vez de un diálogo');

  // Lo mismo desde el «···» de la columna, que es el otro camino para quitar una etapa.
  const bd = readFileSync(join(RAIZ, 'app/crm/CrmBoard.tsx'), 'utf8');
  assert.match(bd, /if \(cuantos > 0\) \{ setBorrarEtapa/,
    'el menú de la columna volvió a preguntar sobre una etapa vacía');
});

test('⚠️ el pop-up: un solo cerrar, sin líneas, y las etapas se arrastran', () => {
  // «Dos botones de cerrar... no entiendo la lógica de eso, elimina el botón de abajo» ·
  // «Elimina todas las líneas divisorias, quedan mal» · «Debería poder agarrar y arrastrar
  // las etapas a donde yo quiera. Replica el diseño que hicimos en el plan» · «Solo si
  // clickeo en el texto del título de esa etapa debería abrirme el input».
  //
  // Probado rompiéndolo (el archivo entero da 19 / 0):
  //   · vuelve el botón «Cerrar» del pie          -> 18 / 1
  //   · las filas dejan de ser `draggable`        -> 18 / 1
  //   · el arrastre usa la imagen del navegador   -> 18 / 1
  const md = readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

  // Un solo cerrar: el pie es para eliminar, no para una segunda ✕.
  assert.ok(!/>\s*Cerrar\s*</.test(md), 'volvió el segundo botón de cerrar, abajo');
  assert.ok(md.includes('Eliminar producto'), 'el pie perdió «Eliminar producto»');

  // Sin líneas: ni bordes de fila ni separadores.
  assert.ok(!/borderTop: '1px solid var\(--border\)'/.test(md), 'volvió una línea divisoria');
  assert.ok(!/border: '1px solid var\(--border\)'/.test(md), 'volvió el borde de las filas');

  // El arrastre, con el molde del plan: imagen VACÍA y copia propia.
  assert.match(md, /data-etapa draggable/, 'las etapas dejaron de arrastrarse');
  assert.match(md, /setDragImage\(vacio, 0, 0\)/,
    'el arrastre volvió a usar la foto del navegador, que el SO pinta translúcida');
  assert.match(md, /document\.addEventListener\('dragover', seguir, true\)/,
    'la copia que sigue al cursor no escucha en `document` y en captura: se clava en los huecos');
  // Y el orden va OPTIMISTA en los DOS caminos: esperar al server por cada flecha es lo
  // que se reportó como «se tarda muchísimo».
  //
  // ⚠️ Y SE CUENTAN LAS DOS. La primera versión pedía `setOrdenLocal(orden)` una vez, y
  // pasó en verde con el `mover` de las flechas ya roto: el `soltarEn` del arrastre tiene
  // la misma línea y la tapaba. Una aserción que se satisface con OTRO call site no mide
  // el que se quería medir.
  const optimistas = [...md.matchAll(/setOrdenLocal\(orden\)/g)].length;
  assert.equal(optimistas, 2, `mover una etapa volvió a esperar al server: ${optimistas} de 2 caminos son optimistas`);

  // El input abre sólo desde el TEXTO: por eso el botón no estira.
  assert.match(md, /flex: 'none', maxWidth: '70%'/, 'el nombre de la etapa volvió a ocupar toda la fila');
});

test('⚠️ el selector de producto: sin tilde, el actual primero y el lápiz sin caja', () => {
  // «No pongas un check, solo haz que sea más notorio que estamos parados en ese producto»
  // · «El producto que estoy parado debería estar primero en las opciones» · «Pon solo el
  // lápiz, no un recuadro alrededor del lápiz».
  //
  // Probado rompiéndolo (el archivo entero da 21 / 0):
  //   · vuelve el recuadro del lápiz        -> 20 / 1
  //   · vuelve el ✓ del renglón elegido     -> 20 / 1
  //   · el selector deja de poner el actual primero -> 20 / 1
  const dd = readFileSync(join(RAIZ, 'app/components/Dropdown.tsx'), 'utf8')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  // El renglón elegido se dice con el PESO del texto y su fondo, no con un tercer portador.
  assert.ok(!dd.includes('✓'), 'volvió el tilde al renglón elegido del desplegable');
  assert.match(dd, /fontWeight: on \? 700 : 600/, 'el renglón elegido dejó de notarse en el texto');
  // El lápiz, sin caja: un borde por renglón convierte cuatro productos en ocho cajas.
  const acc = dd.slice(dd.indexOf('o.acciones.map'));
  assert.match(acc.slice(0, 900), /border: 'none', background: 'transparent'/,
    'volvió el recuadro alrededor del ícono de acción del renglón');

  const tb = readFileSync(join(RAIZ, 'app/crm/CrmToolbar.tsx'), 'utf8');
  assert.match(tb, /const enOrden = \[actual, \.\.\.funnels\.filter\(\(f\) => f\.id !== actual\.id\)\]/,
    'el selector dejó de poner primero el producto que se está mirando');
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

test('⚠️ las líneas divisorias se van por la CAJA, no fila por fila', () => {
  // «Te pedí que eliminaras las lineas divisorias» — la tercera vez que se pide. Las dos
  // primeras se sacaron las de la LISTA, y quedaban las tres de la caja (cabecera, entre
  // bloques del cuerpo, y pie), que las dibuja `Modal` y no este archivo. Por eso la
  // prop vive en la primitive: sacarlas a mano acá dejaba las de `Modal` intactas.
  //
  // Probado rompiéndolo (el archivo entero da 25 / 0):
  //   · se saca el `sinFiletes` del pop-up                -> 24 / 1
  //   · vuelve el filete de «Tu sesión» en EmbudoEntradas -> 24 / 1
  //   · `Modal` emite otro atributo                       -> 24 / 1
  //   · la hoja deja de apagar el filete del pie          -> 24 / 1
  //
  // ⚠️ Y LA PRIMERA VERSIÓN DE ESA TERCERA ROTURA NO ROMPIÓ NADA: se cambió el atributo
  // por `data-sin-filetes-NO`, que el propio regex sigue matcheando, y el archivo dio
  // 25 / 0. Una rotura que el guard no ve no prueba el guard: prueba la rotura.
  const md = limpio(readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8'));
  const ent = limpio(readFileSync(join(RAIZ, 'app/crm/EmbudoEntradas.tsx'), 'utf8'));
  const modal = readFileSync(join(RAIZ, 'app/_ui/Modal.tsx'), 'utf8');
  const css = readFileSync(join(RAIZ, 'app/_ui/ui.css'), 'utf8');

  assert.match(md, /^\s*sinFiletes$/m, 'el pop-up volvió a dibujar los filetes de la caja');
  assert.ok(!/borderTop: '1px solid var\(--border\)'/.test(ent),
    'volvió el filete de «Tu sesión» adentro de la declaración de entradas');
  // Y la prop tiene que HACER algo: un atributo sin CSS es una prop decorativa.
  assert.match(modal, /data-sin-filetes/, '`Modal` dejó de emitir el atributo');
  for (const regla of ['.mk-modal__cab', '.mk-modal__pie', '.mk-modal__cuerpo']) {
    assert.ok(css.includes(`.mk-modal[data-sin-filetes] ${regla}`),
      `la hoja no apaga el filete de ${regla}`);
  }
});

test('⚠️ el pop-up abre con lo que el tablero YA dibujó, y con el MISMO mapeo', () => {
  // «Al abrir sigue tardando mucho en cargar». Medido con el navegador el 29/09, click →
  // primera fila: **941 ms** con la lista esperando al server, **167 ms** pintando con lo
  // que el tablero ya tenía. Las dos consultas que se habían sacado del camino crítico
  // bajaron la action de ~550 a 250 ms y NO movieron el número: los server actions se
  // encolan de a uno, así que diferir una lectura a una segunda action no la saca del
  // camino — la pone detrás de la primera.
  //
  // Probado rompiéndolo (el archivo entero da 25 / 0):
  //   · el tablero deja de pasar la semilla            -> 24 / 1
  //   · la semilla se pasa SIEMPRE, sea cual sea el id -> 24 / 1
  //   · el pop-up vuelve a mirar sólo `emb` para listar -> 24 / 1
  const md = limpio(readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8'));
  const bd = limpio(readFileSync(join(RAIZ, 'app/crm/CrmBoard.tsx'), 'utf8'));
  const ac = limpio(readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8'));
  const pl = readFileSync(join(RAIZ, 'lib/pipeline.ts'), 'utf8');

  // UN mapeo, en la lib, y los dos lo importan. Con dos copias, el pop-up abre mostrando
  // una lista y medio segundo después muestra otra.
  assert.match(pl, /export function etapasVisibles/, 'el mapeo de etapas salió de la lib');
  assert.match(ac, /etapasVisibles\(cfg\.stages\)/, 'el server volvió a mapear las etapas por su cuenta');
  assert.match(bd, /etapasVisibles\(stages\)/, 'el tablero volvió a mapear las etapas por su cuenta');

  // Y la semilla SÓLO para el embudo que se está mirando: desde el desplegable se edita
  // otro producto sin cambiar de tablero, y ahí estas etapas son de otro embudo.
  assert.match(bd, /semilla=\{etapasDe\.id === funnelActivo \? semillaEtapas : null\}/,
    'la semilla dejó de mirar SI el pop-up abre sobre el embudo que se está mirando');
  assert.match(md, /ordenLocal \?\? emb\?\.etapas \?\? semilla\?\.etapas/,
    'el pop-up volvió a esperar al server para listar las etapas');
  // Lo que el tablero NO sabe sigue esperando: las entradas declaradas y el pie.
  assert.match(md, /esEntrada\(e\) && entradasAbierto && !emb && <Cargando \/>/,
    'la declaración de entradas se pinta con la semilla, que no las trae: diría que no hay ninguna');
});

test('⚠️ la etapa de ENTRADA: lápiz, y ni se mueve ni la pisan — también en el server', () => {
  // «Por defecto, la primer etapa debería ser "Lead entrante", no se debería poder mover, y
  // tampoco nadie puede poner algo atrás de esa etapa. Y desde allí debería salir el
  // desplegable para configurar. Para ello, mejor un botón de lapiz, en lugar de las
  // flechas y la X, ya que no serán necesarios».
  //
  // Probado rompiéndolo (el archivo entero da 25 / 0):
  //   · la fila de la entrada vuelve a ser `draggable`   -> 24 / 1
  //   · el server deja mover una etapa `entrada`         -> 24 / 1
  //   · el rótulo por defecto vuelve a «Lead (Instant form)» -> 24 / 1
  const md = limpio(readFileSync(join(RAIZ, 'app/crm/EtapasModal.tsx'), 'utf8'));
  const ac = limpio(readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8'));

  // El rótulo por defecto nombra la ETAPA, no una de las cinco formas de entrar.
  const lead = DEFAULT_STAGES.find((s) => s.key === 'lead');
  assert.equal(lead?.label, 'Lead entrante');

  // En la pantalla: ni se arrastra, ni lleva flechas ni ✕, y su único control es el lápiz.
  assert.match(md, /draggable=\{!esEntrada\(e\)\}/, 'la entrada volvió a poder arrastrarse');
  assert.match(md, /Configurar por dónde entra la gente a/, 'la entrada perdió su lápiz');
  assert.match(md, /if \(idx < pisoDelOrden\) idx = pisoDelOrden/,
    'la marca del arrastre volvió a dibujarse por encima de la entrada');

  // ⚠️ Y EL SERVER LO HACE CUMPLIR, que es lo único que no se puede saltear con una
  // pestaña vieja o un pedido armado a mano. Son las CUATRO puertas al orden.
  assert.match(ac, /kind === 'entrada'\) \{\s*return \{ ok: false, error: 'Por esa etapa entra tu gente: no se puede eliminar/,
    'el server volvió a dejar eliminar la etapa de entrada');
  assert.match(ac, /pipeline\[i\]\.kind === 'entrada' \|\| pipeline\[j\]\.kind === 'entrada'/,
    'el server volvió a dejar mover la entrada, o pasarle algo por encima');
  assert.match(ac, /if \(iEnt > 0\) pipeline = \[ordenadas\[iEnt\]/,
    'un arrastre puede dejar el embudo empezando por otra etapa');
  assert.match(ac, /const piso = pipeline\.findIndex\(\(st\) => st\.kind === 'entrada'\) \+ 1;/,
    'el deshacer de un borrado puede insertar por delante de la entrada');
});

test('⚠️ el alta de producto son TRES pasos, uno por pantalla, y la caja no cambia de alto', () => {
  // «Nuevo producto hazlo modular el formulario, en 3 pasos, no todo junto».
  //
  // Probado rompiéndolo (el archivo entero da 25 / 0):
  //   · las tres preguntas vuelven a la misma pantalla -> 24 / 1
  //   · la caja vuelve al alto automático             -> 24 / 1
  //   · el placeholder vuelve a nombrar a un cliente  -> 24 / 1
  const tb = limpio(readFileSync(join(RAIZ, 'app/crm/CrmToolbar.tsx'), 'utf8'));

  assert.match(tb, /const \[paso, setPaso\] = useState\(0\)/, 'el alta volvió a ser una sola pantalla');
  for (const n of [0, 1, 2]) {
    assert.ok(tb.includes(`{paso === ${n} &&`), `falta el paso ${n + 1}`);
  }
  // Cada paso valida LO SUYO: un error que sale al final manda a buscar cuál de las tres
  // preguntas fue.
  assert.match(tb, /if \(paso === 0 && !nombre\.trim\(\)\)/, 'el paso del nombre dejó de validar');
  assert.match(tb, /if \(paso === 1 && !canal\)/, 'el paso del canal dejó de validar');
  assert.match(tb, /if \(paso === 2 && !entradas\.length\)/, 'el paso de las entradas dejó de validar');
  // ⚠️ Y EL ALTO ES FIJO: los tres pasos miden distinto, y una caja que se encoge entre
  // dos pantallas de la misma tarea es lo que se pidió no hacer dos veces.
  assert.match(tb, /alto="min\(80vh, 520px\)"/, 'la caja del alta volvió a medir según lo que tenga adentro');
  // Y el ejemplo del nombre no nombra a un cliente: «eso está muy mal. Jamás lo hagas».
  assert.ok(!/Sistema DOS/.test(tb), 'el placeholder volvió a nombrar el producto de un cliente');
});

// ════════════════════════════════════════════════════════════════════════════════
// El menú de la columna, el desplegable de productos y el editor de NUTRICIÓN
// ════════════════════════════════════════════════════════════════════════════════

test('⚠️ el filete va DEBAJO de «Nuevo producto», y lo eliminado va centrado', () => {
  // «Que la linea divisoria esté debajo de "Nuevo producto" y que el "Productos
  // eliminados" esté centrado» (Martín, 30/09/2026). Crear uno nuevo cierra la LISTA de
  // productos; lo eliminado es otra cosa, y el filete es lo que las separa.
  const drop = readFileSync(join(RAIZ, 'app/components/Dropdown.tsx'), 'utf8');

  const crear = /\.\.\.\(o\.crear \? \{([^}]*)\}/.exec(drop)?.[1] ?? '';
  const sutil = /\.\.\.\(o\.sutil \? \{([^}]*)\}/.exec(drop)?.[1] ?? '';
  assert.ok(crear, 'se fue la rama de `crear`');
  assert.ok(sutil, 'se fue la rama de `sutil`');
  assert.ok(!/borderTop/.test(crear), 'el filete volvió ARRIBA de «Nuevo producto»');
  assert.ok(/borderTop/.test(sutil), 'lo eliminado quedó sin filete que lo separe');
  // ⚠️ El centrado va por `textAlign` y NO por `justifyContent`: el rótulo vive en un span
  // con `flex: 1`, o sea que ocupa el renglón entero y el eje principal no mueve nada.
  assert.ok(/textAlign: 'center'/.test(sutil), '«Productos eliminados» dejó de estar centrado');
});

test('⚠️ las flechas de mover son DOS botones sin rótulo, y van primeras del menú', () => {
  // «El botón de mover, no debería tener la palabra mover, solo las flechas. Debería
  // estar primero de todos ese botón, y en realidad, deberían ser 2 botones diferentes,
  // solo que están en la misma linea» (Martín, 30/09/2026).
  const bd = readFileSync(join(RAIZ, 'app/crm/CrmBoard.tsx'), 'utf8');
  const drop = readFileSync(join(RAIZ, 'app/components/Dropdown.tsx'), 'utf8');

  // ── 1. El flag existe y el renglón NO dibuja su rótulo ──
  assert.match(drop, /soloAcciones\?: boolean/, 'se fue el flag del renglón sin rótulo');
  const rama = drop.slice(drop.indexOf('if (o.soloAcciones'), drop.indexOf('// Sin acciones, el renglón'));
  assert.ok(rama.length > 200, 'se fue la rama que dibuja el renglón de sólo acciones');
  assert.ok(!/\{cuerpo\}/.test(rama), 'el renglón de sólo acciones volvió a dibujar el rótulo');
  assert.ok(!/onClick=\{elegir\}/.test(rama), 'volvió la media fila clicable que no hace nada');
  // Los dos botones se reparten la línea: si uno no tiene `flex: 1`, no son dos mitades.
  assert.ok(/flex: 1, height: 30/.test(rama), 'los dos botones dejaron de repartirse la línea');

  // ── 2. En el menú de la columna: con el flag, y ANTES que todo lo demás ──
  const menu = bd.slice(bd.indexOf('ariaLabel={`Opciones de la etapa'));
  const opciones = menu.slice(menu.indexOf('options={['), menu.indexOf('onChange={(v) =>'));
  assert.match(opciones, /value: 'mover', label: 'Mover', soloAcciones: true/,
    'el renglón de mover volvió a dibujar la palabra «Mover»');
  const iMover = opciones.indexOf("value: 'mover'");
  const iRenombrar = opciones.indexOf("value: 'renombrar'");
  assert.ok(iMover > -1 && iRenombrar > -1, 'faltan opciones del menú de la columna');
  assert.ok(iMover < iRenombrar, 'las flechas dejaron de ser lo primero del menú');
  // Y siguen colgando del MISMO predicado que habilita el arrastre: dos formas del mismo
  // gesto que se contradigan es peor que tener una sola.
  assert.match(opciones, /\.\.\.\(seArrastraCol\(c\) \? \[\{[\s\S]*?value: 'mover'/,
    'las flechas dejaron de mirar el mismo predicado que el arrastre');
});

test('⚠️ el título del pop-up es el nombre del PRODUCTO, igual que el desplegable', () => {
  // Martín, 30/09/2026: «no entiendo porque se llama "Funnel principal" cuando en el
  // desplegable me dice "Negocio que escala", eso está muy mal». Y no era cosmético: ese
  // título es un INPUT, así que renombrar arrancaba desde el valor equivocado.
  const fn = readFileSync(join(RAIZ, 'lib/funnels.ts'), 'utf8');
  const ac = readFileSync(join(RAIZ, 'app/crm/actions.ts'), 'utf8');

  assert.match(fn, /export async function productosPorFunnel/, 'se fue el resolvedor del nombre');
  // ⚠️ UNA SOLA IMPLEMENTACIÓN del cruce funnel → producto → NOMBRE. Dos lectores del
  // mismo dato con dos respuestas distintas es exactamente lo que produjo el bug.
  const cruces = fn.split('\n').filter((l) => /from\('productos'\)\.select\('id, nombre'\)/.test(l));
  assert.equal(cruces.length, 1, 'hay dos lugares resolviendo el nombre del producto');
  // Los DOS lectores pasan por ahí.
  assert.match(fn, /const productos = await productosPorFunnel\(\);/, 'el desplegable dejó de usar el helper');
  assert.match(ac, /productosPorFunnel\(\[cfg\.id\]\)/, 'el pop-up volvió a mostrar el nombre crudo del funnel');
  assert.ok(!/nombre: cfg\.nombre \|\| 'Tu embudo'/.test(ac), 'volvió el nombre crudo del funnel');
});
