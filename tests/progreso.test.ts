// =============================================================================
// Progreso del Centro — lo que, roto, no da error y muestra otra cosa
// =============================================================================
// Pedido de Martín (15/10/2026): «quiero que dentro del Centro, construyas una sección de "Progreso"
// donde se vea lo que estamos trabajando actualmente, mis pedidos y los pushes». Lo que se fija acá:
//
//   1. La hora de una bitácora es la de Argentina: leída como UTC, todo corría tres horas.
//   2. Lo que le sigue a un pedido en su bitácora es su respuesta, y corta en el pedido siguiente; los
//      pedidos anotados en tanda la comparten.
//   3. El mismo pedido anotado en dos áreas es UNO, con el estado más avanzado.
//   4. «Actual» es el último push que quedó LISTO, no el último que se intentó.
//   5. Las bitácoras reales se pueden leer enteras (una fecha nueva con otro formato se perdería sola).

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cadenas, duracion, frentesEnCurso, grupoPedido, hace, instanteHito, pedidosDeLosPushes, pedidosRecientes, pushDelCommit,
  pushesDeVercel, type AreaP, type HitoP,
} from '../lib/progreso-reglas';

const AHORA = Date.parse('2026-10-15T16:00:00Z'); // 13:00 en Argentina
const hito = (fecha: string, hora: string, tipo: string, extra: Partial<HitoP> = {}): HitoP =>
  ({ fecha, hora, chat: 'Chat A', cuenta: 'claude1', actor: tipo === 'prompt' ? 'martin' : 'claude', tipo, titulo: `${tipo} ${hora}`, puntos: [], ...extra });

test('la hora de la bitácora es la de Argentina, y el año sale de hoy', () => {
  assert.equal(new Date(instanteHito('15 oct', '05:01', AHORA)!).toISOString(), '2026-10-15T08:01:00.000Z');
  // Una entrada de diciembre leída en enero es del año anterior.
  const enero = Date.parse('2027-01-03T12:00:00Z');
  assert.equal(new Date(instanteHito('20 dic', '10:00', enero)!).toISOString(), '2026-12-20T13:00:00.000Z');
  assert.equal(instanteHito('ayer', '10:00', AHORA), null);
});

test('lo que le sigue a un pedido en su bitácora es su respuesta, hasta el pedido siguiente', () => {
  const area: AreaP = {
    slug: 'x', titulo: 'Área X', bitacora: [
      hito('15 oct', '08:00', 'prompt', { pedido: 'Hacé lo primero' }),
      hito('15 oct', '08:30', 'investigacion', { chat: 'Chat B' }),
      hito('15 oct', '09:00', 'implementacion', { chat: 'Chat B', commits: [{ sha: 'aaaa111', msg: 'lo primero' }] }),
      hito('15 oct', '10:00', 'prompt', { pedido: 'Ahora lo segundo' }),
      hito('15 oct', '10:20', 'investigacion', { chat: 'Chat C' }),
      hito('15 oct', '11:00', 'prompt', { pedido: 'Y lo tercero' }),
    ],
  };
  const [uno, dos, tres] = cadenas(area, AHORA);
  assert.equal(uno.estado, 'hecho');
  assert.equal(uno.tomo, 'Chat B', 'lo tomó el chat del primer paso, no el que anotó el pedido');
  assert.deepEqual(uno.commits.map((c) => c.sha), ['aaaa111']);
  assert.equal(dos.estado, 'en_curso', 'pasos sin commits');
  assert.equal(dos.pasos.length, 1, 'corta en el pedido siguiente');
  assert.equal(tres.estado, 'pendiente');
  assert.equal(tres.tomo, null);
});

test('los pedidos anotados en tanda comparten lo que vino después, y una implementación sin commit cierra', () => {
  // Así anotan los chats (medido el 15/10): los pedidos de un mensaje, seguidos, y después lo hecho.
  // Con el corte en el pedido siguiente, los dos primeros salían «pendientes» con el trabajo debajo.
  // Probado rompiéndolo: sin juntar la tanda, 6 pasan y falla éste; sin contar la implementación sin
  // commit como cierre, también 6 y 1.
  const area: AreaP = {
    slug: 'x', titulo: 'Área X', bitacora: [
      hito('15 oct', '08:00', 'prompt', { pedido: 'Uno' }),
      hito('15 oct', '08:00', 'prompt', { pedido: 'Dos' }),
      hito('15 oct', '08:00', 'prompt', { pedido: 'Tres' }),
      hito('15 oct', '09:00', 'implementacion', { chat: 'Chat B' }),
      hito('15 oct', '10:00', 'prompt', { pedido: 'Cuatro' }),
      hito('15 oct', '10:30', 'cosecha', { chat: 'Chat C' }),
    ],
  };
  const ps = cadenas(area, AHORA);
  assert.deepEqual(ps.map((p) => [p.texto, p.estado, p.junto]), [
    ['Uno', 'hecho', 2], ['Dos', 'hecho', 2], ['Tres', 'hecho', 2], ['Cuatro', 'en_curso', 0],
  ]);
  assert.ok(ps.every((p, i) => i === 3 || p.tomo === 'Chat B'));
});

test('los cuatro grupos de Martín: trabajando ahora, sin empezar, empezado sin movimiento y terminado', () => {
  // «los pendientes que estamos trabajando ahora mismo, las cosas que ya están terminadas, empezadas»:
  // lo empezado que nadie movió en 48 h no es «ahora», y lo que nadie tomó no está empezado.
  // Probado rompiéndolo: con todo lo empezado como «ahora», 8 pasan y falla éste.
  const area: AreaP = {
    slug: 'x', titulo: 'Área X', bitacora: [
      hito('10 oct', '09:00', 'prompt', { pedido: 'Viejo y quieto' }),
      hito('10 oct', '10:00', 'investigacion'),
      hito('15 oct', '08:00', 'prompt', { pedido: 'De hoy y movido' }),
      hito('15 oct', '11:00', 'investigacion'),
      hito('15 oct', '12:00', 'prompt', { pedido: 'Nadie lo tomó' }),
    ],
  };
  const ps = cadenas(area, AHORA);
  assert.deepEqual(ps.map((p) => grupoPedido(p, AHORA)), ['empezado', 'ahora', 'sin_empezar']);
  assert.equal(ps[1].ultimo, instanteHito('15 oct', '11:00', AHORA), 'lo último que se movió es su último paso, no el pedido');
  assert.equal(ps[1].cierre, null, 'sin implementación no tiene cierre');
});

test('un push nombra los pedidos cuyo commit lo ENCABEZA, y un commit su push, nunca por la hora', () => {
  // Medido el 15/10 contra git: «el primer push después de anotarlo» acertó 110 de 202, y la punta exacta del
  // ÚLTIMO commit de cada pedido unió 0 de 88. Lo único exacto sin git: el commit que encabeza un push.
  // Probado rompiéndolo: tomando el push más NUEVO con ese commit (el redeploy), 8 pasan y falla éste.
  const area: AreaP = {
    slug: 'x', titulo: 'Área X', bitacora: [
      hito('15 oct', '08:00', 'prompt', { pedido: 'Con un commit que encabeza un push' }),
      hito('15 oct', '09:00', 'implementacion', { commits: [{ sha: 'abc1234', msg: 'm' }] }),
      hito('15 oct', '10:00', 'prompt', { pedido: 'Terminado sin commit anotado' }),
      hito('15 oct', '10:30', 'implementacion'),
    ],
  };
  const ps = cadenas(area, AHORA);
  const push = (id: string, sha: string, creado: string, estado: 'listo' | 'error' = 'listo') =>
    ({ id, sha, mensaje: id, cuerpo: '', estado, creado: Date.parse(creado), duracionMs: null, actual: false, cuenta: null });
  const pushes = [
    push('nuevo', 'abc1234ff', '2026-10-15T15:00:00Z'), // lo vuelve a traer un redeploy: no es el que lo subió
    push('justo-despues', 'fff0000aa', '2026-10-15T13:31:00Z'), // el «primero después» por la hora: NO
    push('el-suyo', 'abc1234ff', '2026-10-15T12:10:00Z'),
    push('fallido', 'abc1234ff', '2026-10-15T12:05:00Z', 'error'),
  ];
  assert.equal(pushDelCommit('abc1234', pushes)?.id, 'el-suyo', 'el más viejo que quedó listo con ese commit en la punta');
  assert.equal(pushDelCommit('9999999', pushes), null, 'un commit que no encabeza ninguno no se adivina');
  const trae = pedidosDeLosPushes(ps, pushes);
  assert.equal(trae.get('el-suyo')?.[0].texto, 'Con un commit que encabeza un push');
  assert.equal(trae.has('justo-despues'), false, 'el push siguiente por la hora no trae nada que se sepa');
  assert.ok(![...trae.values()].flat().some((p) => p.texto === 'Terminado sin commit anotado'));
});

test('el mismo pedido en dos áreas es uno, con sus áreas juntas y el estado más avanzado', () => {
  const texto = 'Sumá el Centro al teléfono';
  const a: AreaP = { slug: 'a', titulo: 'Centro', bitacora: [hito('15 oct', '07:50', 'prompt', { pedido: texto })] };
  const b: AreaP = { slug: 'b', titulo: 'Mobile', bitacora: [
    hito('15 oct', '07:50', 'prompt', { pedido: texto }),
    hito('15 oct', '08:40', 'implementacion', { commits: [{ sha: 'bbbb222', msg: 'm' }] }),
  ] };
  const viejo: AreaP = { slug: 'c', titulo: 'Viejo', bitacora: [hito('1 sep', '10:00', 'prompt', { pedido: 'Hace mucho' })] };
  const ps = pedidosRecientes([a, b, viejo], AHORA, 14);
  assert.equal(ps.length, 1, 'el de septiembre queda fuera de la ventana y los dos iguales son uno');
  assert.deepEqual(ps[0].areas.sort(), ['Centro', 'Mobile']);
  assert.equal(ps[0].estado, 'hecho');
});

test('En curso: un frente por área con actividad en la ventana, el más reciente primero', () => {
  const areas: AreaP[] = [
    { slug: 'quieta', titulo: 'Quieta', bitacora: [hito('10 oct', '10:00', 'implementacion')] },
    { slug: 'viva', titulo: 'Viva', bitacora: [hito('15 oct', '09:00', 'prompt', { pedido: 'algo' }), hito('15 oct', '12:00', 'investigacion', { chat: 'Chat Z', titulo: 'Mirando' })] },
    { slug: 'ayer', titulo: 'Ayer', bitacora: [hito('14 oct', '20:00', 'prompt', { pedido: 'otra cosa' })] },
  ];
  const f = frentesEnCurso(areas, AHORA, 48);
  assert.deepEqual(f.map((x) => x.slug), ['viva', 'ayer']);
  assert.equal(f[0].ultimo, 'Mirando');
  assert.equal(f[0].chat, 'Chat Z');
  assert.equal(f[0].pendientes, 0, 'el pedido de «viva» ya tiene un paso: está en curso, no pendiente');
  assert.equal(f[1].pendientes, 1);
});

test('Pushes: «actual» es el último que quedó listo; la cuenta sale del trailer y el cuerpo va sin trailers', () => {
  const p = pushesDeVercel([
    { uid: 'd1', state: 'ERROR', created: 3000, buildingAt: 3100, ready: 9000, meta: { githubCommitSha: 'aaaaaaa1111', githubCommitMessage: 'Uno que falló\n\nPor qué.\n\nClaude-Cuenta: claude2\nCo-Authored-By: Claude' } },
    { uid: 'd2', state: 'READY', created: 2000, buildingAt: 2000, ready: 2000 + 296_000, meta: { githubCommitSha: 'bbbbbbb2222', githubCommitMessage: 'El que sirve\n\nTrae esto.\n\nClaude-Cuenta: claude1\nCo-Authored-By: Claude' } },
    { uid: 'd3', state: 'READY', created: 1000, meta: {} },
  ]);
  assert.deepEqual(p.map((x) => x.id), ['d1', 'd2', 'd3']);
  assert.equal(p[0].estado, 'error');
  assert.equal(p[0].actual, false, 'el que falló no es el que está en producción');
  assert.equal(p[1].actual, true);
  assert.equal(p[1].cuenta, 'claude1');
  assert.equal(p[1].cuerpo, 'Trae esto.');
  assert.equal(duracion(p[1].duracionMs), '4m 56s');
  assert.equal(p[2].mensaje, 'Redeploy sin datos de git');
  assert.equal(hace(AHORA - 3 * 3_600_000, AHORA), 'hace 3 h');
});

test('las bitácoras reales se leen enteras: ninguna fecha queda sin entender', async () => {
  const { REGISTROS_SLUGS, registroDe } = await import('../app/admin/dev/registros');
  const malas: string[] = [];
  for (const slug of REGISTROS_SLUGS) {
    for (const h of registroDe(slug).bitacora) {
      if (instanteHito(h.fecha, h.hora, AHORA) == null) malas.push(`${slug}: «${h.fecha}» «${h.hora}»`);
    }
  }
  assert.deepEqual(malas, [], 'una fecha que no se entiende hace desaparecer ese hito de Progreso');
  // Y cada pedido con su id: dos de webhook-gateway del 7/10 con la hora «—» y el mismo comienzo chocaban
  // (React: «Encountered two children with the same key»). Probado con el id viejo: 8 pasan y falla éste.
  const areas = REGISTROS_SLUGS.map((slug) => ({ slug, titulo: slug, bitacora: registroDe(slug).bitacora }));
  const ids = pedidosRecientes(areas, AHORA, 3650).map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'dos pedidos con el mismo id');
});

test('desde el 16/10, todo hito de TRABAJO de una bitácora dice qué sesión lo hizo', async () => {
  // El Centro junta cada hito con su chat por la sesión y nunca por el título (lib/centro-chats.ts): el 15/10,
  // 17 de 37 chats coincidían por nombre y había 5 títulos repetidos. La sesión la da el entorno:
  // `echo $CLAUDE_CODE_HOST_SESSION_ID` (local_…) en la app, o cli_<$CLAUDE_CODE_SESSION_ID> en una terminal.
  // Probado con un hito falso del 16/10 sin sesión: 9 pasan y falla éste.
  const { REGISTROS_SLUGS, registroDe } = await import('../app/admin/dev/registros');
  const { DESTINO_RE } = await import('../lib/operaciones-reglas');
  const desde = Date.parse('2026-10-16T03:00:00Z');
  const ahora = Date.now();
  const faltan: string[] = [];
  for (const slug of REGISTROS_SLUGS) {
    for (const h of registroDe(slug).bitacora) {
      const t = instanteHito(h.fecha, h.hora, ahora);
      // El pedido de Martín (`actor: 'martin'`) puede llegar por otro chat cuya sesión no se sabe: ahí no se exige.
      if (t != null && t >= desde && h.actor !== 'martin' && !DESTINO_RE.test(h.sesion ?? '')) faltan.push(`${slug}: «${h.titulo}» (${h.fecha} ${h.hora})`);
    }
  }
  assert.deepEqual(faltan, [], 'sumale `sesion` con el local_… de tu chat (echo $CLAUDE_CODE_HOST_SESSION_ID) a estos hitos');
});
