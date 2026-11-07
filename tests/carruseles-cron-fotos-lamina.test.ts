// El cron que asienta las fotos de lámina A CIEGAS (app/api/cron/carruseles-fotos-lamina/route.ts), con el handler
// corriendo de verdad: la guarda del secreto, la consulta que BUSCA los negocios con algo anotado, el `runWithWorkspace`
// de cada uno y `asentarFotosDeLamina` con su compare-and-set del diseño. El hijo
// (tests/_carruseles-cron-fotos-lamina-hijo.ts) lo corre contra un PostgREST y un Storage de mentira.
//
// Por qué hace falta además de tests/carruseles-foto-lamina.test.ts: ése prueba que la foto se asienta cuando ALGUIEN
// abre el diseño. Lo que decide si este cron sirve es lo otro: que encuentre solo a los negocios que tienen algo en vuelo
// (sin barrer los workspaces), que la foto de uno no entre en el diseño de otro, y que un pendiente que todavía está
// generando no se suelte antes de hora.
//
// Probado rompiéndolo (7/11/2026) — base 24 / 0: los 11 de acá, los 2 de tests/cron-registrado.test.ts (que fija la
// entrada en vercel.json) y los 11 de tests/seguridad-crons-y-publicas.test.ts (que fija la guarda del secreto). Una
// rotura por vez sobre el árbol del worktree, restaurada antes de la siguiente, y los rojos MEDIDOS:
//    1. cada negocio SIN `runWithWorkspace` (como si el cron tuviera la cookie de alguien)   → 6 rojos
//    2. el cron barre `listarWorkspaces()` en vez de buscar por la clave                     → 3 rojos (ver el ⚠️ de abajo)
//    3. se entra igual a los negocios con `[]` anotado (sacar `tieneAlgo`)                   → 1 rojo
//    4. la guarda del secreto DESPUÉS de leer los pendientes                                 → 2 rojos (uno, el de seguridad)
//    5. un negocio que rompe corta la corrida (sin el try/catch del loop)                    → 0 rojos (ver el ⚠️ de abajo)
//    6. `asentarFotosDeLamina(ws, <un diseño fijo>)` en vez de a ciegas                      → 6 rojos
//    7. la consulta sin `.eq('key', …)`: lee las settings de todos los negocios              → 1 rojo
//    8. la consulta sin `order` (el orden lo elige PostgREST)                                → 1 rojo
//    9. un error de la base devuelto como `{ ok: true }` en vez de 500                       → 1 rojo
//   10. la cadencia en cada-10-en-punto, encima de flow-abandono                             → 1 rojo
//   11. la cadencia por hora (`0 * * * *`)                                                   → 1 rojo
//   12. sin la entrada en vercel.json (el cron no corre nunca)                               → 2 rojos (uno, cron-registrado)
//   13. y un cambio SIN efecto (renombrar `tieneAlgo` y `filas`)                             → 24 verdes, como tiene que ser
//
// ⚠️ LA ROTURA 2 ES LA QUE ENSEÑA ALGO. Con el cron barriendo todos los workspaces, los asserts sobre `puestas`,
// `caidas`, los pendientes y los diseños quedan TODOS EN VERDE: contra una base de mentira, iterar todos los negocios
// asienta exactamente las mismas fotos. Los 3 rojos salen de los dos tests que miran las CONSULTAS (que aparezca la tabla
// `workspaces`, y que una corrida sin trabajo sea una sola lectura) más el del 500 (que deja de poder inyectar el fallo de
// base, porque ya nadie lee `app_settings`). Por eso el hijo anota cada consulta: cuando lo que se arregla es el COSTO de
// una consulta, los resultados son idénticos con y sin el arreglo.
//
// ⚠️ Y LA ROTURA 5 DA CERO: hoy nada de `asentarFotosDeLamina` tira por negocio —`pendientesDeFoto`, `bajar` y `anotar`
// tienen su try/catch adentro, `subirAlEditor` se llama con `.catch`, y `leerDiseno`/`guardarDiseno` devuelven
// `{ ok: false }`— así que el try/catch del loop no está probado: es una afirmación, no un test. Queda igual porque en un
// cron CIEGO un negocio que tire mañana se llevaría a los que vienen detrás, y acá queda escrito que el arnés no lo cubre.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type Salida = {
  status: number;
  cuerpo: Record<string, unknown>;
  pendientes: Record<string, number>;
  laminas: Record<string, string[]>;
  paginas: Record<string, string[][]>;
  version: Record<string, number>;
  subidos: Record<string, number>;
  consultas: string[];
};

const RAIZ = resolve(__dirname, '..');
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', join(RAIZ, 'tests', '_carruseles-cron-fotos-lamina-hijo.ts')], {
  // `maxBuffer: 64 MB` desde la primera línea (AGENTS.md): sin tope, node corta el stdout en 1 MB y el JSON llega partido —
  // «Unterminated string in JSON», que no se parece a la causa y aparece sólo cuando la salida crece, o sólo en el runner.
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
});
const R = JSON.parse(salida.slice(salida.indexOf('@@RESULTADO@@') + '@@RESULTADO@@'.length)) as
  Record<string, Salida> & { error?: string; venceMs?: number; key?: string };

/** El nombre que `conLaFoto` le pone a la foto generada: por eso se la reconoce adentro de la lámina. */
const LA_FOTO = 'Foto: la armó tu IA';
/** La tabla que aparecería si el cron barriera los negocios uno por uno en vez de buscarlos por su clave. */
const esDe = (tabla: string) => (c: string) => new RegExp(`^\\w+ ${tabla}\\?`).test(c);

type Cron = { path: string; schedule: string };
const CRONS = (JSON.parse(readFileSync(join(RAIZ, 'vercel.json'), 'utf8')) as { crons: Cron[] }).crons;
// Los minutos de la hora en que corre un schedule: entiende el paso (asterisco, barra y el número) y la lista `a,b,c`,
// que son las dos formas que usa vercel.json acá. Va como comentario de línea a propósito: el paso escrito literal cierra
// un bloque `/** … */` y rompe el archivo (medido).
const minutosDe = (schedule: string): number[] => {
  const m = schedule.split(' ')[0];
  const paso = /^\*\/(\d+)$/.exec(m);
  if (paso) return Array.from({ length: Math.ceil(60 / Number(paso[1])) }, (_, i) => i * Number(paso[1]));
  return m.split(',').map(Number);
};

test('a ciegas, sin que nadie abra un diseño: la foto de cada negocio entra en SU diseño, detrás de los textos', () => {
  assert.equal(R.error, undefined, String(R.error));
  const c = R.ciego;
  assert.equal(c.status, 200);
  assert.deepEqual(c.cuerpo, { ok: true, negocios: 3, puestas: 3, caidas: 0, sinTurno: [] });
  for (const ws of [3, 5, 7]) {
    assert.equal(c.laminas[ws][0], LA_FOTO, `ws ${ws}: la foto es el fondo de la lámina, va primera`);
    assert.deepEqual(c.laminas[ws].slice(1), [`Titular ws${ws}`], `ws ${ws}: y su titular sigue ahí, sin nada de otro negocio`);
    assert.equal(c.subidos[ws], 1, `ws ${ws}: la foto quedó en «Subidos» del Image Editor, no apuntando a la url que vence`);
    assert.equal(c.pendientes[ws], 0, `ws ${ws}: y el pendiente se suelta`);
  }
});

test('las DOS fotos de un diseño entran en la misma corrida: el compare-and-set se encadena y ninguna pisa a la otra', () => {
  // El tope son 2 fotos por diseño (`FOTOS_GENERADAS_MAX`), y es el caso que el cron más va a ver: las dos llegan
  // mientras nadie mira. Cada guardado sube la versión, así que la segunda tiene que RELEER antes de escribir.
  const c = R.dosDelMismoDiseno;
  assert.deepEqual(c.cuerpo, { ok: true, negocios: 1, puestas: 2, caidas: 0, sinTurno: [] });
  assert.equal(c.version[3], 3, 'el diseño arrancó en 1 y cada foto lo guardó una vez');
  assert.equal(c.subidos[3], 2, 'dos fotos distintas en «Subidos», una por lámina');
  assert.deepEqual(c.paginas[3].map((p) => p[0]), [LA_FOTO, LA_FOTO], 'cada lámina tiene SU foto de fondo');
  assert.deepEqual(c.paginas[3].map((p) => p.length), [2, 2], 'y los titulares de las dos siguen ahí');
  assert.equal(c.pendientes[3], 0);
});

test('cada negocio corre en SU workspace: ni una foto, ni una subida, ni un pendiente cruzado', () => {
  const c = R.ciego;
  // Una sola fila en «Subidos» por negocio: si los tres corrieran en el mismo workspace, ahí habría tres.
  assert.deepEqual(Object.values(c.subidos), [1, 1, 1]);
  // Y la foto de cada uno está en su propio diseño: la lámina del 3 no tiene el titular del 5.
  const titulares = [3, 5, 7].map((ws) => c.laminas[ws].filter((n) => /^Titular/.test(n)));
  assert.deepEqual(titulares, [['Titular ws3'], ['Titular ws5'], ['Titular ws7']]);
});

test('el cron BUSCA a los negocios por la clave de los pendientes: no barre los workspaces ni lee settings ajenas', () => {
  for (const [nombre, c] of [['ciego', R.ciego], ['nadaAnotado', R.nadaAnotado]] as const) {
    assert.deepEqual(c.consultas.filter(esDe('workspaces')), [],
      `${nombre}: apareció la tabla workspaces — el cron está barriendo negocios en vez de buscarlos por su clave`);
    // Las LECTURAS de app_settings sin filtro de negocio: la búsqueda. (Las escrituras llevan el workspace en el cuerpo,
    // no en la query, así que se piden por GET a propósito.)
    const busqueda = c.consultas.filter((q) => /^GET app_settings\?/.test(q) && !/workspace_id=eq\./.test(q));
    assert.equal(busqueda.length, 1, `${nombre}: la búsqueda de los pendientes tiene que ser UNA consulta: ${busqueda.join(' | ')}`);
    assert.match(busqueda[0], new RegExp(`key=eq\\.${String(R.key).replace(/\./g, '\\.')}`),
      `${nombre}: la búsqueda no filtra por la clave de los pendientes (lee las settings de todos los negocios)`);
    assert.match(busqueda[0], /order=workspace_id/, `${nombre}: sin order, el orden lo elige PostgREST y dos corridas iguales sirven distinto`);
  }
  // Y el orden en que se sirvió: de menor a mayor, el de la consulta. Los ids se sembraron 7, 3, 5.
  const servidos = R.ciego.consultas
    .filter(esDe('flow_trabajos'))
    .map((q) => Number(/workspace_id=eq\.(\d+)/.exec(q)?.[1]));
  assert.deepEqual(servidos, [3, 5, 7]);
});

test('sin nada anotado —el caso de casi todas las corridas— cuesta UNA lectura y termina ahí', () => {
  const c = R.nadaAnotado;
  assert.equal(c.status, 200);
  assert.deepEqual(c.cuerpo, { ok: true, negocios: 0, puestas: 0, caidas: 0, sinTurno: [] });
  assert.equal(c.consultas.length, 1, `una corrida sin trabajo tiene que ser una sola consulta: ${c.consultas.join(' | ')}`);
  // Y no se entró a los diseños de nadie: un `[]` anotado no es un negocio al que haya que entrar.
  for (const ws of [3, 5]) assert.deepEqual(c.laminas[ws], [`Titular ws${ws}`], `ws ${ws}: el diseño se tocó sin tener nada que asentar`);
});

test('/api/cron es público por prefijo: sin el secreto exacto, 401 y la base ni se toca', () => {
  for (const [nombre, c] of [['sinSecreto', R.sinSecreto], ['secretoMalo', R.secretoMalo]] as const) {
    assert.equal(c.status, 401, nombre);
    assert.deepEqual(c.consultas, [], `${nombre}: la guarda tiene que ir ANTES de leer los pendientes: ${c.consultas.join(' | ')}`);
    assert.deepEqual(c.laminas[3], ['Titular ws3'], `${nombre}: el diseño se tocó sin el secreto`);
    assert.equal(c.pendientes[3], 1, `${nombre}: y el pendiente sigue ahí`);
  }
});

test('un negocio que rompe no corta a los demás, y el que se puede asentar se asienta en la misma corrida', () => {
  const c = R.unoRoto;
  assert.equal(c.status, 200);
  assert.deepEqual(c.cuerpo, { ok: true, negocios: 2, puestas: 1, caidas: 1, sinTurno: [] });
  assert.equal(c.laminas[5][0], LA_FOTO, 'el negocio sano se asentó igual');
  assert.equal(c.pendientes[5], 0);
  assert.equal(c.pendientes[3], 0, 'y el del diseño que ya no existe se suelta en vez de reintentarse para siempre');
  // ⚠️ La foto YA COPIADA de ese negocio se queda en su «Subidos». No es basura: es su foto, en su biblioteca, y la puede
  // usar en cualquier diseño. Queda fijado acá para que nadie lo lea como una fuga la próxima vez que lo vea.
  assert.equal(c.subidos[3], 1, 'la foto del diseño que ya no existe queda en «Subidos» del negocio');
});

test('una foto que todavía se está generando NO se suelta: se vuelve a preguntar en la próxima corrida', () => {
  const c = R.enCurso;
  assert.deepEqual(c.cuerpo, { ok: true, negocios: 1, puestas: 0, caidas: 0, sinTurno: [] });
  assert.equal(c.pendientes[3], 1, 'soltarla sería perder la foto que la pestaña del cliente está armando');
  assert.deepEqual(c.laminas[3], ['Titular ws3'], 'y el diseño queda como estaba');
});

test('a las 6 h (VENCE_MS) una foto que nunca llegó se suelta, y una que falló también', () => {
  assert.deepEqual(R.vencido.cuerpo, { ok: true, negocios: 1, puestas: 0, caidas: 1, sinTurno: [] });
  assert.equal(R.vencido.pendientes[3], 0, 'un pendiente que vence no puede quedar anotado para siempre');
  assert.deepEqual(R.fallido.cuerpo, { ok: true, negocios: 1, puestas: 0, caidas: 1, sinTurno: [] });
  assert.equal(R.fallido.pendientes[3], 0, 'un fallo terminal no se reintenta solo');
  assert.deepEqual(R.fallido.laminas[3], ['Titular ws3'], 'y el diseño no se tocó');
});

test('si no se pueden leer los pendientes, 500: nunca un «ok» que se lea como «no había nada que hacer»', () => {
  const c = R.baseCaida;
  assert.equal(c.status, 500);
  assert.equal(c.cuerpo.ok, false);
  assert.equal(c.pendientes[3], 1, 'y no se perdió nada: la próxima corrida lo reintenta');
  assert.deepEqual(c.laminas[3], ['Titular ws3']);
});

test('la cadencia: cada 10 minutos y DESPLAZADA 5 de flow-abandono, bien por debajo del vencimiento', () => {
  const mio = CRONS.find((c) => c.path === '/api/cron/carruseles-fotos-lamina');
  assert.ok(mio, 'falta { "path": "/api/cron/carruseles-fotos-lamina", "schedule": "5,15,25,35,45,55 * * * *" } en vercel.json: el cron no corre nunca');
  assert.equal(mio!.schedule.split(' ').slice(1).join(' '), '* * * *', 'corre las 24 h: la pestaña del cliente genera a cualquier hora');

  const mios = minutosDe(mio!.schedule);
  const cada = mios.map((m, i) => (i ? m - mios[i - 1] : 60 - mios[mios.length - 1] + mios[0]));
  assert.deepEqual([...new Set(cada)], [10], `las corridas tienen que estar parejas cada 10 minutos: ${mios.join(',')}`);

  // ⚠️ DESPLAZADA 5 MINUTOS DE flow-abandono, para leer DESPUÉS de que ese cron escribió los estados terminales.
  const abandono = CRONS.find((c) => c.path === '/api/cron/flow-abandono');
  assert.ok(abandono, 'no encontré el cron de la cola de Flow');
  const suyos = minutosDe(abandono!.schedule);
  for (const m of mios) {
    assert.ok(!suyos.includes(m), `el minuto ${m} choca con flow-abandono (${abandono!.schedule}): se lee antes de que cierre los abandonados`);
    assert.ok(suyos.includes((m + 55) % 60), `el minuto ${m} no cae 5 minutos después de una pasada de flow-abandono`);
  }

  // Y el techo: por la regla de «dos oportunidades por vencimiento», entre corridas tiene que entrar dos veces antes de
  // que un pendiente venza. Con 10 minutos contra 6 h sobra, y lo que importa es que el test lo note si cambia el plazo.
  assert.ok(10 * 60_000 * 2 <= Number(R.venceMs), `con VENCE_MS = ${R.venceMs} ms, una corrida cada 10 minutos ya no deja dos oportunidades por vencimiento`);
});
