// =============================================================================
// La compuerta de los proyectos NUEVOS: cinco nacieron en dos días
// =============================================================================
// 12/8/2026. El dueño mandó dos links por WhatsApp para investigar competencia. Los dos
// mensajes eran gemelos y el mismo borrador los trajo juntos; uno cayó en «Feature:
// Competitor Spy», que es donde iban, y el otro abrió un proyecto nuevo —«Feature:
// Funnel de Venta»— con una sola tarea adentro. Su pregunta: «no está bien que haya
// decidido crear un nuevo proyecto, ¿identificás el error?».
//
// El error no fue el modelo. Fue que el «no» del Perro tenía una puerta de atrás:
//
//   1. MaKo, en la tool de WhatsApp, propone `proyecto: "Feature: Funnel de Venta"`.
//   2. El Perro rutea el lote. Propone ese proyecto en `nuevos` y pone ese mismo nombre
//      en `asign` (el contrato viejo lo permitía explícitamente).
//   3. Las barreras rechazan la propuesta: una sola tarea no justifica un proyecto.
//   4. Y ahí se cae el `asign` también, porque el nombre que nombraba ya no existe en
//      la lista de destinos válidos. La tarea queda SIN NINGÚN destino.
//   5. `plan-board` tenía como último recurso el nombre CRUDO de MaKo… que era
//      exactamente el que se acababa de rechazar. Y lo creaba.
//
// Los cinco proyectos del 11 y 12 de agosto («Landing», «Content Machine», «Historia
// del Usuario», «Focus Tracker», «Funnel de Venta») tienen el MISMO renglón en su
// historial: «Creó el proyecto — WhatsApp». Esa es la rama donde no hay ni catálogo ni
// aval del Perro — la firma del agujero, en los cinco.
//
// Se cierra en tres lugares y cada uno tiene su test acá o al lado:
//   · la FORMA del nombre, ejecutable y no solo escrita en el prompt → este archivo;
//   · la REPESCA, para que rechazar no deje a la tarea sin lugar → ruteo-repesca.test.ts;
//   · la COMPUERTA de `plan-board`, que ya no crea nada sin catálogo ni aval.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  puedeSerProyectoNuevo, FAMILIAS_SIDEBAR, delCatalogo, canonNombre, nucleo,
  CATALOGO_PROYECTOS, PREFIJO_FEATURE, PREFIJO_AGENTE,
} from '../lib/plan-proyectos-catalogo';
import { FAMILIAS } from '../app/_components/nav';

test('EL CASO REAL: los cinco nombres del 11 y 12/8, uno por uno', () => {
  // No todos caen por la FORMA, y decirlo importa para no creer que este test solo
  // alcanza. «Funnel de Venta» tiene forma perfecta de tab: lo que lo frena es la otra
  // mitad —una sola tarea no justifica un proyecto— y después la compuerta de
  // plan-board, que ya no crea sin aval. Los dos controles son necesarios.
  assert.equal(puedeSerProyectoNuevo('Feature: Content Machine').ok, false, 'el 11/8 era una familia del sidebar; hoy está en el catálogo, y por las dos razones no es «nuevo»');
  assert.equal(puedeSerProyectoNuevo('Feature: Historia del Usuario').ok, true, 'la forma está bien: lo frena el umbral de tareas');
  assert.equal(puedeSerProyectoNuevo('Feature: Funnel de Venta').ok, true, 'la forma está bien: lo frena el umbral de tareas');
  assert.equal(puedeSerProyectoNuevo('Feature: Focus Tracker').ok, true, 'la forma está bien: lo frena el umbral de tareas');
  assert.equal(puedeSerProyectoNuevo('Feature: Landing').ok, true, 'la forma está bien: lo frena el umbral de tareas');
});

test('el MODELO no puede inventar un proyecto con el nombre de una familia del sidebar', () => {
  // Una familia agrupa diez proyectos: un proyecto con ese nombre se solapa con seis tabs
  // a la vez. Se excluye «Content Machine», que el dueño decidió sumar al catálogo el
  // 12/8 — ver el test de abajo, que cubre justamente esa asimetría.
  for (const f of FAMILIAS_SIDEBAR) {
    if (delCatalogo(f)) continue;
    for (const n of [f, `${PREFIJO_FEATURE}${f}`, `${PREFIJO_AGENTE}${f}`, f.toUpperCase()]) {
      const v = puedeSerProyectoNuevo(n);
      assert.equal(v.ok, false, `«${n}» pasó y es una familia del sidebar`);
      assert.match(v.ok === false ? v.motivo : '', /familia del sidebar/i);
    }
  }
});

test('el catálogo se consulta ANTES que las familias: prohibido inventarla, no que exista', () => {
  // El orden de los dos chequeos ES la regla. «Content Machine» lo inventó el modelo el
  // 11/8 y estaba mal; el 12/8 el dueño decidió que la capa de estrategia sí hacía falta y
  // la sumó al catálogo. Las dos cosas son ciertas: cambia QUIÉN lo decide.
  const cm = puedeSerProyectoNuevo('Feature: Content Machine');
  assert.equal(cm.ok, false, 'sigue sin ser «nuevo»: ya está en el catálogo');
  assert.match(cm.ok === false ? cm.motivo : '', /catálogo/,
    'si cayera por «familia del sidebar», agregar una familia al catálogo no serviría de nada');
  // Y es un destino de verdad, con su prefijo puesto y su descripción.
  assert.equal(canonNombre('Content Machine'), 'Feature: Content Machine');
  assert.ok((delCatalogo('Content Machine')?.que ?? '').length > 80);
});

test('la lista de familias sigue siendo la de nav.ts', () => {
  // Está copiada en el catálogo porque `lib/` no importa de `app/`. Copiada sin guarda,
  // la quinta familia que se agregue no la vería nadie — y sería justo la que falta.
  assert.deepEqual([...FAMILIAS_SIDEBAR], FAMILIAS.map((f) => f.label));
});

test('EL PREFIJO NO ES UNA FORMA DE ESQUIVAR EL CONTROL', () => {
  // Se mide sobre el NÚCLEO. Si se midiera sobre el nombre crudo, «Feature: Investigar
  // competencia» pasaría el filtro del verbo (arranca con «Feature») y «Feature: » se
  // volvería el truco para colar cualquier cosa.
  assert.equal(puedeSerProyectoNuevo('Investigar competencia').ok, false);
  assert.equal(puedeSerProyectoNuevo('Feature: Investigar competencia').ok, false);
  assert.equal(puedeSerProyectoNuevo('Agente: Analizar la competencia').ok, false);
});

test('un verbo de hacer al principio es el título de una TAREA, no un proyecto', () => {
  for (const n of [
    'Implementar cobros', 'Crear el onboarding', 'Migrar a Deepseek', 'Definir la oferta',
    'Replicar el diseño mobile', 'Recopilar historias', 'Auditar el onboarding', 'Analizar la competencia',
  ]) {
    const v = puedeSerProyectoNuevo(n);
    assert.equal(v.ok, false, `«${n}» pasó y arranca con un verbo`);
    assert.match(v.ok === false ? v.motivo : '', /verbo/);
  }
});

test('«Migración» y «Diseño» NO son verbos: un sustantivo parecido no puede caer', () => {
  // El filtro mira el verbo, no la raíz. «Diseño de la app» es un proyecto real del
  // catálogo y empieza igual que «Diseñar»: si el regex fuera por prefijo suelto, se
  // llevaría puesto un transversal que existe hace meses.
  assert.equal(puedeSerProyectoNuevo('Migraciones y datos').ok, true);
  assert.equal(puedeSerProyectoNuevo('Soporte').ok, true);
  assert.equal(puedeSerProyectoNuevo('Feature: Facturación').ok, true);
});

test('un nombre de más de 4 palabras es una tarea disfrazada', () => {
  const v = puedeSerProyectoNuevo('Feature: Sistema de gestión de leads calificados');
  assert.equal(v.ok, false);
  assert.match(v.ok === false ? v.motivo : '', /palabras/);
  // Cuatro justas pasan: el corte es 1-4, no 1-3. (Un nombre que NO esté ya en el
  // catálogo: los que están caen antes, por «ya existe», y el test no probaría nada.)
  assert.equal(puedeSerProyectoNuevo('Vender MaKo: Orgánico LinkedIn').ok, true);
});

test('lo que YA está en el catálogo no es «nuevo»', () => {
  // Con o sin prefijo: si esto devolviera ok, el ruteo abriría un gemelo de un proyecto
  // que ya existe — que es el desastre de 64 proyectos que el catálogo vino a cerrar.
  for (const p of CATALOGO_PROYECTOS.slice(0, 12)) {
    assert.equal(puedeSerProyectoNuevo(p.nombre).ok, false, `«${p.nombre}» está en el catálogo`);
    assert.equal(puedeSerProyectoNuevo(nucleo(p.nombre)).ok, false, `«${nucleo(p.nombre)}» es el mismo sin prefijo`);
  }
});

test('la compuerta no se cuelga con basura', () => {
  for (const n of ['', '   ', 'CRM']) assert.equal(puedeSerProyectoNuevo(n).ok, false, JSON.stringify(n));
});

test('canonNombre no inventa prefijos para lo que no está en el catálogo', () => {
  // Es lo que hace que un nombre inventado llegue a `plan-board` tal cual y no
  // disfrazado de proyecto del catálogo. La compuerta de allá depende de esto.
  assert.equal(canonNombre('CRM'), 'Feature: CRM');
  assert.equal(canonNombre('Feature: Funnel de Venta'), 'Feature: Funnel de Venta');
  assert.equal(delCatalogo('Feature: Funnel de Venta'), undefined);
});
