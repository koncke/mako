// =============================================================================
// El id de una clase es la clave de una respuesta guardada
// =============================================================================
// `lib/programa-catalogo.ts` es la fuente única del temario, y lo leen cuatro
// cosas: el cargador de Whop, el formulario que contesta el cliente, el prompt
// que reescribe la respuesta después de la junta y la tab Program. La respuesta
// del cliente se guarda contra el `id` de la clase.
//
// Por eso el id NO es decoración: si dos clases comparten id, la respuesta de
// una pisa la de la otra y el cliente pierde trabajo escrito a mano. Y si un id
// se renumera porque se insertó una clase en el medio, todas las respuestas
// guardadas apuntan a la clase equivocada — en silencio, porque nada valida que
// un id viejo siga existiendo.
//
// La segunda mitad del archivo cuida el REPARTO EN VIDEOS (`mismoVideoQue` y
// `GRABACIONES`). Es un id escrito a mano adentro de un objeto: escribirlo mal
// no rompe nada visible, la clase se sale de su grupo y encabeza un video
// propio, y el síntoma —«hay un video de más»— es indistinguible de una
// decisión de diseño.
//
// Estos tests son la segunda capa de esa regla. La primera es el comentario del
// catálogo; sin esto, es una expresión de deseo (AGENTS.md → «Una regla en un
// prompt no es una regla»).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROGRAMA, CLASES, GRABACIONES, TOTAL_CLASES, TOTAL_MODULOS, TOTAL_GRABACIONES,
  CLASES_QUE_DESTRABAN, MODULOS_POR_AREA, claseDe, rotuloDe, grabacionesDe,
} from '../lib/programa-catalogo';

test('ningún id de clase se repite: una colisión pisa la respuesta del cliente', () => {
  const ids = CLASES.map(c => c.clase.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  assert.deepEqual(dupes, [], `ids repetidos: ${dupes.join(', ')}`);
});

test('ningún id de módulo se repite', () => {
  const ids = PROGRAMA.map(m => m.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('los números de módulo son correlativos desde 0', () => {
  PROGRAMA.forEach((m, i) => assert.equal(m.numero, i, `módulo ${m.id}`));
});

test('toda clase tiene título y pregunta no vacíos', () => {
  for (const { modulo, clase } of CLASES) {
    assert.ok(clase.titulo.trim().length > 3, `${modulo.id}/${clase.id}: título`);
    assert.ok(clase.pregunta.trim().length > 10, `${modulo.id}/${clase.id}: pregunta`);
  }
});

test('ningún módulo queda sin clases: un bloque vacío es una clase que nadie contesta', () => {
  for (const m of PROGRAMA) assert.ok(m.clases.length > 0, `${m.id} sin clases`);
});

test('las cinco clases que destraban existen de verdad', () => {
  // Si se renombra o se saca una, esto falla acá y no cuando alguien intente
  // grabar el video que ya no está en el temario.
  for (const id of CLASES_QUE_DESTRABAN) {
    assert.ok(claseDe(id), `${id} no existe en el programa`);
    assert.ok(claseDe(id)!.clase.atoro, `${id} está en la lista pero no declara su atoro`);
  }
});

test('los umbrales los contesta el líder del área, no el dueño', () => {
  // No es un detalle de forma: si el umbral lo pone el dueño, el líder no se
  // compromete con el número. Está en su metodología y se rompe solo al editar.
  const umbrales = PROGRAMA.find(m => m.id === 'm8');
  assert.ok(umbrales);
  assert.equal(umbrales!.quien, 'líder de área');
});

test('los módulos que se repiten por área son los de palancas', () => {
  assert.deepEqual(MODULOS_POR_AREA, ['m6', 'm7', 'm8', 'm9']);
});

test('el rótulo numera la clase dentro de su módulo', () => {
  assert.equal(rotuloDe('m4c2'), '4.2 · La MCI 2, el criterio');
  assert.equal(rotuloDe('m0c1'), '0.1 · Qué vas a tener al final');
});

test('rotuloDe devuelve el id cuando no existe, en vez de romper', () => {
  assert.equal(rotuloDe('no-existe'), 'no-existe');
});

test('dos clases nunca comparten rótulo', () => {
  // El rótulo es lo que el cliente ve en Whop y lo que viaja en sus mensajes de
  // WhatsApp (lib/cs-mensajes.ts). Dos «1.6» distintos son dos tareas que el
  // cliente no puede distinguir.
  const todos = CLASES.map(c => rotuloDe(c.clase.id));
  assert.equal(new Set(todos).size, todos.length, 'dos clases comparten rótulo');
});

test('el conteo que se comunica es el real', () => {
  // docs/programa-mauricio.md dice 12 módulos y 44 clases, y de ahí sale cuántos
  // videos hay que grabar. Un número mal contado es un presupuesto mal hecho.
  assert.equal(TOTAL_MODULOS, 12);
  assert.equal(TOTAL_CLASES, 44);
});

// ── El reparto en videos ────────────────────────────────────────────────────

test('cada clase está en exactamente una grabación', () => {
  // Si una se cae del reparto, Mauricio graba un curso al que le falta una clase
  // y se entera cuando un cliente abre la lección vacía.
  const vistas = GRABACIONES.flatMap(g => g.clases.map(c => c.id));
  assert.equal(vistas.length, TOTAL_CLASES, 'faltan o sobran clases en el reparto');
  assert.equal(new Set(vistas).size, TOTAL_CLASES, 'hay una clase en dos grabaciones');
  for (const { clase } of CLASES) {
    assert.ok(vistas.includes(clase.id), `${clase.id} no quedó en ninguna grabación`);
  }
});

test('mismoVideoQue apunta a una clase REAL del MISMO módulo', () => {
  for (const modulo of PROGRAMA) {
    const propias = new Set(modulo.clases.map(c => c.id));
    for (const clase of modulo.clases) {
      if (!clase.mismoVideoQue) continue;
      assert.ok(
        propias.has(clase.mismoVideoQue),
        `${clase.id} comparte video con ${clase.mismoVideoQue}, que no está en el módulo ${modulo.id}`,
      );
      assert.notEqual(clase.mismoVideoQue, clase.id, `${clase.id} se apunta a sí misma`);
    }
  }
});

test('la que encabeza un video no comparte a su vez con otra (sin cadenas)', () => {
  // Una cadena A→B→C agruparía mal: B queda de jefe de A y a la vez sigue a C.
  const jefes = new Set(GRABACIONES.map(g => g.id));
  for (const { clase } of CLASES) {
    if (!clase.mismoVideoQue) continue;
    assert.ok(
      jefes.has(clase.mismoVideoQue),
      `${clase.id} apunta a ${clase.mismoVideoQue}, que no encabeza ningún video`,
    );
  }
});

test('toda clase dice de qué va su video, y no repite el enunciado de la tarea', () => {
  // `graba` es contexto para grabar; `pregunta` es lo que contesta el cliente.
  // Copiar una en la otra deja a Mauricio sin la mitad que necesita.
  for (const { clase } of CLASES) {
    assert.ok(clase.graba && clase.graba.trim().length > 30, `${clase.id} no dice de qué va`);
    assert.notEqual(clase.graba.trim(), clase.pregunta.trim(), `${clase.id} copia la tarea en vez de dar contexto`);
  }
});

test('si el texto dice «en el mismo video», el dato lo dice también', () => {
  // Heurística sobre la frase que de hecho usamos, y existe porque el bug ya
  // ocurrió: 11.2 decía «el cierre del programa, en el mismo video» y NO tenía
  // `mismoVideoQue`, así que se contaba como una grabación aparte. El texto y el
  // dato discrepaban y ninguna pantalla lo podía notar.
  for (const { clase } of CLASES) {
    if (!/\ben el mismo video\b/i.test(clase.graba)) continue;
    assert.ok(
      clase.mismoVideoQue,
      `${clase.id} dice «en el mismo video» pero no comparte grabación con nadie`,
    );
  }
});

test('toda clase trae los puntos de su grabación, y son un esqueleto y no un guion', () => {
  // `puntos` es lo único que Mauricio lee antes de sentarse a grabar. Una clase
  // sin puntos es una clase que no se puede grabar sin volver al cuestionario.
  for (const { clase } of CLASES) {
    const p = clase.puntos ?? [];
    assert.ok(p.length >= 4 && p.length <= 7, `${clase.id}: ${p.length} puntos (van de 4 a 7)`);
    for (const [i, punto] of p.entries()) {
      // El piso de largo es lo que separa un punto de un título. Los cortos
      // fueron el primer intento y no alcanzaban para grabar con ellos.
      assert.ok(punto.length >= 160, `${clase.id}#${i}: demasiado corto para grabar con él`);
      // Un guion palabra por palabra se lee leído. Se dice QUÉ cubrir, no con
      // qué palabras: estas tres formas son las que de hecho se colaron.
      assert.doesNotMatch(punto, /\bdec[íi]:|\bdecir:|tal cual:/i, `${clase.id}#${i}: parece un guion`);
    }
  }
});

test('dentro de UNA grabación, dos clases no cierran con la misma muletilla', () => {
  // Las clases que comparten video se dicen seguidas, en la misma sesión de
  // cámara. Cuatro «Cerrar con…» en un mismo video se escucha como una plantilla
  // — pasó, con los cuatro cierres del módulo 5.
  for (const g of GRABACIONES) {
    if (g.clases.length < 2) continue;
    const arranques = g.clases.map(c => {
      const p = c.puntos ?? [];
      return (p[p.length - 1] ?? '').split(' ').slice(0, 2).join(' ').toLowerCase();
    });
    assert.equal(new Set(arranques).size, arranques.length,
      `la grabación ${g.id} repite el arranque del cierre: ${arranques.join(' / ')}`);
  }
});

test('grabar es MENOS trabajo que el temario, que es el punto de agrupar', () => {
  assert.ok(TOTAL_GRABACIONES < TOTAL_CLASES);
  assert.equal(TOTAL_GRABACIONES, GRABACIONES.length);
  for (const modulo of PROGRAMA) {
    assert.ok(grabacionesDe(modulo.id).length > 0, `el módulo ${modulo.id} no tiene grabaciones`);
  }
});

test('agrupar NO reordena el temario', () => {
  // El rótulo sale de la POSICIÓN de la clase en su módulo, así que mover una
  // clase de lugar para juntar videos le renumera el temario al cliente. Las
  // grabaciones respetan el orden del catálogo, no al revés.
  for (const g of GRABACIONES) {
    const pos = g.clases.map(c => g.modulo.clases.indexOf(c));
    assert.deepEqual(pos, [...pos].sort((a, b) => a - b), `la grabación ${g.id} desordena sus clases`);
  }
});
