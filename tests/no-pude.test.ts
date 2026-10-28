// =============================================================================
// Si MaKo le dice a la persona que algo no se pudo, queda un ticket (27/10/2026, Martín y Leila) — lo puro
// =============================================================================
// lib/no-pude.ts: la causa con las señales del código y las dos marcas, las negativas legítimas que NO abren ticket, la `ref`
// (un ticket por negocio + conversación + causa; el proveedor y la configuración, uno por negocio) y las líneas que escribe el
// código. Lo que escribe en la base: tests/no-pude-server.test.ts. Frases parafraseadas: ningún dato de clientes.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  causaDelNoPude, esGuardaDeHerramienta, esReglaUOpinion, LINEA_YA_AVISADO, lineaCortaDelTicket, lineaDelTicket, refDeNoPude, REGLA_NO_PUDE, sacarNoPude, tituloDelNoPude,
} from '../lib/no-pude';
import { REGLA_NO_EXISTE, reglaNoExisteEn, sacarNoExiste } from '../lib/no-existe';
import { esFallaTragada } from '../lib/no-pude-frases';

test('a. la causa sale de las señales del código, en orden, y una regla no abre ticket', () => {
  assert.equal(causaDelNoPude({ regla: true, herramienta: true, noPudo: 'mover el lead' }), null, 'una regla de MaKo abrió ticket');
  assert.equal(causaDelNoPude({ ejecucion: true, herramienta: true }), 'ejecucion');
  assert.equal(causaDelNoPude({ herramienta: true, noPudo: 'x x x' }), 'herramienta');
  assert.equal(causaDelNoPude({ ruteo: true, noExiste: 'editar las cuotas' }), 'ruteo', 'una herramienta que existe y no viajó salió «no existe»');
  // El ruteo SOLO no: MaKo llamó algo que no viajó y siguió con lo que tenía (la revisión del 28/10/2026).
  assert.equal(causaDelNoPude({ ruteo: true }), null, 'un ruteo sin que MaKo dijera que no pudo abrió ticket');
  assert.equal(causaDelNoPude({ proveedor: true, noPudo: 'contestarte' }), 'proveedor');
  assert.equal(causaDelNoPude({ configuracion: true }), 'configuracion');
  assert.equal(causaDelNoPude({ noExiste: 'un tope de comentarios por canal' }), 'no-existe');
  assert.equal(causaDelNoPude({ noPudo: 'crear la tarea en el plan' }), 'texto');
  assert.equal(causaDelNoPude({}), null);
});

test('b. las negativas legítimas y las opiniones no son «no pude»', () => {
  for (const t of [
    'confirmarla: la persona la confirma en su tarjeta', 'hacerlo: sólo el administrador puede', 'mostrarte la clave por seguridad',
    'asegurarte que vaya a convertir', 'no puedo garantizar el resultado', 'no puedo dejar pasar ese dato sin revisarlo',
  ]) {
    assert.ok(esReglaUOpinion(t), `«${t}» se tomó como una falla`);
    assert.equal(causaDelNoPude({ noPudo: t }), null, `«${t}» abrió ticket`);
  }
  for (const t of ['crear la tarea en el plan', 'contar los leads de la semana', 'editar ese dato desde este chat']) {
    assert.equal(esReglaUOpinion(t), false, `«${t}» se tomó como una regla`);
  }
});

test('c. la marca sale del texto, la regla dice que las herramientas son una selección, y va en todo chat (dentro de la de no-existe)', () => {
  const r = sacarNoPude('No pude crear la tarea: el plan no respondió.\n\n[[no-pude: crear la tarea «Llamar a Ana» en el plan]]');
  assert.equal(r.texto, 'No pude crear la tarea: el plan no respondió.');
  assert.equal(r.noPudo, 'crear la tarea «Llamar a Ana» en el plan');
  assert.ok(!sacarNoPude('Hola [[no pude:  algo  ]] chau').texto.includes('[['));
  assert.equal(sacarNoPude('Listo, quedó.').noPudo, null);
  assert.match(REGLA_NO_PUDE, /Tus herramientas de este turno son una SELECCIÓN/);
  assert.ok(REGLA_NO_EXISTE.includes(REGLA_NO_PUDE), 'la regla de no-pude no viaja con la de no-existe');
  assert.match(reglaNoExisteEn('resumen'), /termina el texto de "resumen" con una línea aparte, exactamente así: \[\[no-pude:/);
  // Las dos marcas juntas salen las dos.
  const dos = sacarNoPude(sacarNoExiste('Eso no está.\n[[no-existe: un bloque de Instagram]]\n[[no-pude: guardarlo]]').texto);
  assert.equal(dos.texto, 'Eso no está.');
});

test('d. anti-bucle: las líneas que escribe el código no disparan el detector ni la red', () => {
  for (const l of [lineaDelTicket(12), lineaCortaDelTicket(12), LINEA_YA_AVISADO]) {
    assert.equal(sacarNoPude(l).noPudo, null);
    assert.doesNotMatch(l, /no pude|no puedo|te aviso/i, `«${l}» dice «no pude» o promete`);
  }
});

test('e. la ref: un ticket por negocio + conversación + causa; el proveedor y la configuración, uno por negocio', () => {
  const base = { ws: 13, superficie: 'ops-center' as const, conv: 'sesion-77', causa: 'texto' as const };
  assert.equal(refDeNoPude(base), refDeNoPude({ ...base }));
  assert.notEqual(refDeNoPude(base), refDeNoPude({ ...base, ws: 14 }), 'la ref sin el negocio');
  assert.notEqual(refDeNoPude(base), refDeNoPude({ ...base, conv: 'sesion-78' }));
  assert.notEqual(refDeNoPude(base), refDeNoPude({ ...base, causa: 'ruteo' }));
  // Lo que falló también (la revisión del 28/10/2026): dos pedidos distintos, dos tickets; el mismo, uno.
  assert.notEqual(refDeNoPude({ ...base, clave: 'un registro de cumpleaños' }), refDeNoPude({ ...base, clave: 'un tope por canal' }));
  assert.equal(refDeNoPude({ ...base, clave: 'Un registro de cumpleaños' }), refDeNoPude({ ...base, clave: 'un registro de cumpleanos' }));
  assert.ok(refDeNoPude(base).startsWith('np:13:'));
  const largo = refDeNoPude({ ...base, conv: `whatsapp:${'1'.repeat(15)}@g.us-y-mucho-más-${'x'.repeat(200)}` });
  assert.ok(largo.length <= 120);
  assert.doesNotMatch(largo, /@|whatsapp/, 'la conversación tiene que ir hasheada');
  assert.equal(refDeNoPude({ ...base, causa: 'proveedor' }), refDeNoPude({ ...base, superficie: 'whatsapp', conv: 'otra', causa: 'proveedor' }));
  assert.equal(refDeNoPude({ ...base, causa: 'configuracion' }), 'np:13:configuracion');
});

test('f. el título lo arma el código, nunca el texto del modelo', () => {
  assert.equal(tituloDelNoPude('ruteo', 'analyst', 'Editar una cuota'), 'MaKo dijo que no podía y la operación existe «Editar una cuota», en el MaKo Analyst del lead');
  assert.match(tituloDelNoPude('no-existe', 'ops-center'), /^Pedido de algo que MaKo todavía no tiene, en el Ops Center$/);
  for (const c of ['ejecucion', 'herramienta', 'ruteo', 'proveedor', 'configuracion', 'no-existe', 'texto'] as const) {
    assert.ok(tituloDelNoPude(c, 'whatsapp').length <= 140);
  }
});

test('g. la falla que un runner se TRAGÓ abre ticket; una negativa de estado o de configuración no (la verificación del 28/10)', () => {
  for (const r of ['No se pudo aplicar (Error guardando setting mako.personalidad: Error: BOOM).', 'No pude ejecutarlo (Error obteniendo lead 12: fetch failed).',
    'No se pudo agendar (timeout).', 'No se pudo cambiar el CRM automático (Error guardando setting crm_auto_enabled: Error: BOOM).']) {
    assert.ok(esFallaTragada(r), `«${r}» no se ve como una falla tragada`);
  }
  for (const r of ['Esa decisión ya no estaba abierta.', 'El email dejó de estar conectado: no se prendió el envío real.',
    'La secuencia no existe o ya no estaba archivada.', 'No borré nada: en Meta ya no está pausada.', 'No se pudo: el lead ya está en esa etapa.']) {
    assert.equal(esFallaTragada(r), false, `«${r}» se tomó como una falla`);
  }
  // El mismo fallo dicho de otra forma es la misma clave.
  const base = { ws: 11, superficie: 'ops-center' as const, conv: 'sesion-300', causa: 'texto' as const };
  assert.equal(refDeNoPude({ ...base, clave: 'crear la tarea' }), refDeNoPude({ ...base, clave: 'crear la tarea en el plan' }));
});

test('h. la guarda de una herramienta del turno (un 400, sin isError) es una regla: apaga el «no pude», nunca el «no existe» (base 7)', () => {
  // Lo que devuelve runnerDelRegistro con un 400 (lib/api-mako/ejecutar.ts): TEXTO con ok:false y su error. Y la heredada, «❌ …».
  const guarda = JSON.stringify({ ok: false, error: 'El borrado se hace en tu pantalla de revisión.' });
  for (const out of [guarda, { content: guarda }, JSON.stringify({ ok: false, error: 'Falta el email del lead.', faltan: ['email'] }), '❌ No encontré ese lead.']) {
    assert.ok(esGuardaDeHerramienta(out), `${JSON.stringify(out)} no se ve como una guarda`);
  }
  // Una falla (isError: un 404 o un 500), un ok, un texto, y lo que un runner se TRAGÓ (el error técnico entre paréntesis): no.
  for (const out of [{ content: guarda, isError: true }, JSON.stringify({ ok: true, id: 3 }), 'Listo, quedó movido.', '{"ok":false}', '', null, undefined,
    JSON.stringify({ ok: false, error: 'No se pudo guardar (duplicate key value violates unique constraint).' }), '❌ No se pudo aplicar (Error guardando setting x: BOOM).']) {
    assert.equal(esGuardaDeHerramienta(out), false, `${JSON.stringify(out)} se tomó como una guarda`);
  }
  // `regla` apaga el «no pude»; el «no existe» de la misma respuesta sigue, y con un ruteo es un ruteo.
  assert.equal(causaDelNoPude({ regla: true, noPudo: 'borrar el lead de Juan' }), null);
  assert.equal(causaDelNoPude({ regla: true, noPudo: 'borrar el lead de Juan', noExiste: 'un tablero de comisiones' }), 'no-existe', 'la regla se comió el «no existe»');
  assert.equal(causaDelNoPude({ regla: true, ruteo: true, noExiste: 'editar las cuotas' }), 'ruteo');
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   1. `causaDelNoPude` sin la rama de `ruteo`                         → rojo el a.
//   2. `esReglaUOpinion` sin exclusiones (siempre false)                → rojo el b.
//   3. `REGLA_NO_EXISTE` sin `REGLA_NO_PUDE` adentro                     → rojo el c.
//   4. `refDeNoPude` sin el negocio                                      → rojo el e.
//   5. el ruteo solo, sin marca, da 'ruteo' (28/10)                       → rojo el a.
//   6. `refDeNoPude` sin lo que falló (28/10)                             → rojo el e.
//   7. (28/10, base 7) la regla se come el «no existe» (`if (s.regla) return null`) → rojo el h.
//   8. (28/10) la guarda sin mirar la falla tragada                        → rojo el h.
//   9. (28/10) la guarda aunque traiga isError                            → rojo el h.
