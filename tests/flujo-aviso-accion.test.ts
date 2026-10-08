// =============================================================================
// El paso «⚡ Acción» del lienzo de AVISOS corre cualquier acción de MaKo
// =============================================================================
// Decisión de Martín (08/10/2026), textual: un paso de un flujo «que pueda hacer todo,
// sin limitaciones». El dueño confirma la acción al CONFIGURAR el paso; cuando el flujo
// corre, se EJECUTA sin pedir un «sí». Y el paso no se esconde: se hace funcionar.
//
// Hasta ese día el paso tenía tres acciones fijas (`crear_tarea`, `inscribir_nutricion`,
// `marcar_lead`) y el motor dejaba una pendiente `flujo_<acción>` que ningún área del
// registro declaraba: al confirmarla moría como «operación desconocida». Medido: 1 paso
// así en toda la base (ws1) y 0 corridas.
//
// Lo que esto fija, en cuatro mitades:
//   · el MOTOR (lib/flujos.ts) corre `ejecutarDesdeFlujo` con la operación del paso, y un
//     paso viejo (sólo `accion`) no corre ni crea la pendiente muerta;
//   · el GUARDADO conserva `operacion` y `params` en todo lo que escribe el flujo: el
//     store lo guarda ENTERO (no hay saneo campo por campo en este camino — medido el
//     08/10: `setFlujo` y las dos rutas `flujo-set` lo pasan tal cual) y lo que lo arma en
//     el navegador no lo pierde;
//   · el EDITOR monta el editor compartido y no promete «con tu sí»;
//   · la línea que le llega al dueño cuando falla es UNA y corta.
//
// PROBADO ROMPIÉNDOLO el 08/10/2026 (con todo puesto: 8 pasan, 0 fallan), restaurando
// desde memoria. Pasan / fallan:
//   · el motor le pasa a ejecutarDesdeFlujo el `accion` viejo en vez de la operación  -> 7 / 1
//   · `operacionDelPaso` le adivina una operación al paso viejo (cae a `accion`)      -> 6 / 2
//   · el paso que sale del editor pierde los `params`                                 -> 7 / 1
//   · `setFlujo` reconstruye los pasos campo por campo y descarta `operacion`         -> 7 / 1
//   · la ruta `flujo-set` del cliente reconstruye los pasos sin `operacion`           -> 7 / 1
//   · vuelve al panel «MaKo te lo propone en el grupo y se hace con tu «sí».»         -> 7 / 1
//   · la línea de fallo deja de aplanar los saltos de línea del resumen               -> 7 / 1
//   · el ＋ vuelve a crear la acción con `crear_tarea` de default                     -> 7 / 1
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  describirPaso, esFlujoValido, operacionDelPaso, pasoDeAccion, rotuloOperacion, SIN_ACCION,
  type Flujo, type Paso,
} from '../lib/flujos-tipos';
import { grafoDeAviso, insertarPasoTras, quitarPasoDibujado, type AvisoParaGrafo } from '../lib/flujo-aviso';
import { lineaDeFalloAccion, TOPE_RESUMEN_FALLO } from '../lib/flujo-pasos';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md): un `/*` dentro de un `//` abriría
// un bloque que se come el código del medio.
const sinComentarios = (s: string): string =>
  s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const NUEVO: Paso = { tipo: 'accion', operacion: 'mover_lead_etapa', params: { etapa: 'contactado', leadId: 'evento' } };
const VIEJO = { tipo: 'accion', accion: 'crear_tarea' } as Paso;

test('Qué corre un paso: la operación; el `accion` viejo NO cuenta', () => {
  assert.equal(operacionDelPaso(NUEVO as Extract<Paso, { tipo: 'accion' }>), 'mover_lead_etapa');
  assert.equal(operacionDelPaso(VIEJO as Extract<Paso, { tipo: 'accion' }>), null, 'el paso viejo correría algo que nadie eligió');
  assert.equal(operacionDelPaso({ operacion: '   ' }), null);
  assert.equal(operacionDelPaso({ operacion: 7 as unknown as string }), null);
  assert.equal(operacionDelPaso({}), null);
});

test('La tarjeta: un paso viejo se dibuja SIN acción elegida, y ninguno promete «con tu OK»', () => {
  assert.equal(describirPaso(VIEJO), SIN_ACCION);
  assert.equal(describirPaso({ tipo: 'accion' }), SIN_ACCION);
  assert.equal(describirPaso(NUEVO), 'Mover lead etapa');
  assert.equal(rotuloOperacion('crear_tarea_plan'), 'Crear tarea plan');
  for (const p of [VIEJO, NUEVO, { tipo: 'accion', operacion: 'x', requiereAprobacion: true } as unknown as Paso]) {
    assert.ok(!/con tu/i.test(describirPaso(p)), `la tarjeta promete un permiso que nadie va a pedir: «${describirPaso(p)}»`);
  }
  // Y el grafo (lo que de verdad pinta el lienzo) dice lo mismo.
  const aviso: AvisoParaGrafo = {
    disparador: 'x', frecuenciaMin: 0, texto: 'Hola', canales: { wa: true, email: false },
    insistir: null, evento: { tipo: 'evento', evento: 'lead.agendo' }, pasos: [VIEJO, NUEVO],
  };
  const g = grafoDeAviso(aviso);
  assert.equal(g.nodos.find((n) => n.id === 'paso-0')?.detalle, SIN_ACCION);
  assert.equal(g.nodos.find((n) => n.id === 'paso-1')?.detalle, 'Mover lead etapa');
});

test('El paso que sale del editor: la operación y SUS parámetros, sin lo viejo', () => {
  const params = { etapa: 'contactado', nota: 'hola' };
  assert.deepEqual(pasoDeAccion({ operacion: 'mover_lead_etapa', params }), { tipo: 'accion', operacion: 'mover_lead_etapa', params });
  // Sin operación no hay nada que correr: el paso queda vacío, no con un default.
  assert.deepEqual(pasoDeAccion({}), { tipo: 'accion' });
  assert.deepEqual(pasoDeAccion({ operacion: '  ', params }), { tipo: 'accion' });
  // Unos parámetros que no son un objeto plano no viajan.
  assert.deepEqual(pasoDeAccion({ operacion: 'x', params: ['a'] as unknown as Record<string, unknown> }), { tipo: 'accion', operacion: 'x', params: {} });
  const armado = pasoDeAccion({ operacion: 'x', params: {} }) as Record<string, unknown>;
  assert.ok(!('accion' in armado) && !('requiereAprobacion' in armado), 'el paso nuevo arrastra la regla vieja');
});

test('⚠️ EL GUARDADO CONSERVA `operacion` Y `params`: nada reconstruye los pasos campo por campo', () => {
  // 1. Lo que viaja y se guarda: el flujo pasa la validación y sobrevive al JSON del store.
  const flujo: Flujo = { version: 1, activo: true, disparador: { tipo: 'evento', evento: 'lead.agendo' }, pasos: [NUEVO, { tipo: 'esperar', horas: 2 }] };
  assert.ok(esFlujoValido(flujo));
  assert.deepEqual(JSON.parse(JSON.stringify(flujo)).pasos[0], NUEVO);

  // 2. Lo que hace el lienzo con los pasos (insertar y quitar otro) no los toca.
  const conOtro = insertarPasoTras(flujo.pasos, 'paso-0', { tipo: 'accion' });
  assert.deepEqual(conOtro[0], NUEVO, 'insertar un paso le borró los datos al de al lado');
  assert.deepEqual(quitarPasoDibujado(conOtro, 1)[0], NUEVO, 'quitar un paso le borró los datos al de al lado');

  // 3. Los que escriben el flujo en el server lo guardan ENTERO. Si mañana alguno lo
  //    sanea, tiene que conservar los dos campos (AGENTS.md: «un campo nuevo en un objeto
  //    que se guarda ENTERO se busca en TODOS los que lo escriben»).
  const store = sinComentarios(leer('../lib/plantillas.ts'));
  const ini = store.indexOf('export async function setFlujo(');
  const setFlujo = store.slice(ini, store.indexOf('export async function listarFlujosActivos', ini));
  assert.ok(ini > 0 && setFlujo.length > 200 && setFlujo.length < 4000, `el recorte de setFlujo mide ${setFlujo.length}: mira otra cosa`);
  assert.match(setFlujo, /next\.flujo = /, 'setFlujo dejó de guardar el flujo');
  const escritores = [
    ['setFlujo', setFlujo],
    ['admin/plantillas', sinComentarios(leer('../app/api/admin/plantillas/route.ts'))],
    ['perfil/plantillas', sinComentarios(leer('../app/api/perfil/plantillas/route.ts'))],
  ] as const;
  for (const [nombre, src] of escritores) {
    // Hoy ninguno reconstruye: si alguno empieza a hacerlo, tiene que nombrar los dos.
    if (/pasos\s*\.\s*map\(|pasos:\s*\[|sanear(Pasos|Flujo|Paso)\(/.test(src)) {
      // Con borde de palabra: `searchParams` (que las rutas tienen) no es conservar `params`.
      assert.match(src, /\boperacion\b/, `${nombre} reconstruye los pasos y no conserva \`operacion\``);
      assert.match(src, /\bparams\b/, `${nombre} reconstruye los pasos y no conserva \`params\``);
    }
  }

  // 4. Y el editor del navegador guarda lo que arma `pasoDeAccion`, no un spread que
  //    mezcle la acción nueva con la vieja.
  const ui = sinComentarios(leer('../app/agencia/FlujoAviso.tsx'));
  assert.match(ui, /guardarRef\.current\(pasoDeAccion\(v\)\)/, 'el panel dejó de guardar el paso armado por pasoDeAccion');
  assert.ok(!/\.\.\.paso, accion:/.test(ui), 'volvió el reemplazo del `accion` viejo');
});

test('⚠️ EL MOTOR CORRE LA ACCIÓN con `ejecutarDesdeFlujo`, y un paso viejo no deja la pendiente muerta', () => {
  const src = sinComentarios(leer('../lib/flujos.ts'));
  const ini = src.indexOf("if (paso.tipo === 'accion')");
  const rama = src.slice(ini, src.indexOf('function nombreDelAviso', ini));
  assert.ok(ini > 0 && rama.length > 300 && rama.length < 2500, `el recorte de la rama de acción mide ${rama.length}: mira otra cosa`);
  assert.match(rama, /const operacion = operacionDelPaso\(paso\);/, 'la operación dejó de salir de la misma pregunta que contesta el lienzo');
  assert.match(rama, /if \(!operacion\) \{[\s\S]*?console\.warn\([\s\S]*?return;\s*\}/, 'un paso sin operación dejó de cortar (o de dejarlo en el log)');
  assert.match(
    rama,
    /ejecutarDesdeFlujo\(operacion, paso\.params, \{ ws, origen: `aviso:\$\{flujoId\}`, nombre, leadId: ctx\.leadId \?\? null \}\)/,
    'el paso dejó de correr su operación por el ejecutor de flujos (con el aviso como origen y el lead del evento)',
  );
  assert.ok(!/crearPendiente\(|flujo_\$\{/.test(src), 'volvió la pendiente `flujo_<acción>`, que ningún área del registro sabe ejecutar');
  assert.match(rama, /if \(r\.ok\) \{[\s\S]*?return;\s*\}[\s\S]*?enviarAlGrupoMaKo\(ws, lineaDeFalloAccion\(/, 'si falla, el dueño dejó de enterarse en su grupo');
});

test('La línea del fallo es UNA, corta, y dice qué acción y por qué', () => {
  const l = lineaDeFalloAccion('Mover lead de etapa', 'Lead agendó', 'Falta el lead.\nNo vino en el evento.');
  assert.equal(l, '⚠️ No se pudo «Mover lead de etapa» (Lead agendó): Falta el lead. No vino en el evento.');
  assert.ok(!l.includes('\n'));
  const largo = lineaDeFalloAccion('X', 'Y', 'a'.repeat(1000));
  assert.ok(largo.length < TOPE_RESUMEN_FALLO + 40, `la línea mide ${largo.length}`);
  assert.ok(largo.endsWith('…'));
  assert.equal(lineaDeFalloAccion('X', 'Y', '  '), '⚠️ No se pudo «X» (Y).');
});

test('⚠️ El panel del paso monta el editor COMPARTIDO y no promete «con tu sí»', () => {
  const ui = sinComentarios(leer('../app/agencia/FlujoAviso.tsx'));
  assert.match(ui, /<EditorAccionMako valor=\{valor\} onCambio=\{cambiar\} \/>/, 'el panel dejó de montar el editor compartido');
  assert.ok(!/inscribir_nutricion|marcar_lead/.test(ui), 'volvieron las tres acciones fijas');
  // Lo que se DIBUJA (sin comentarios: la casa explica en el comentario lo que se sacó).
  assert.ok(!/con tu «?s[ií]»?|con tu OK|se hace con tu/i.test(ui), 'el editor de avisos vuelve a prometer un «sí» que nadie va a pedir');
});

test('El ＋ crea la acción SIN acción: un default correría algo que nadie eligió', () => {
  const ui = sinComentarios(leer('../app/agencia/FlujoAviso.tsx'));
  const ini = ui.indexOf('const nuevo: Paso =');
  const alta = ui.slice(ini, ui.indexOf(';', ini) + 1);
  assert.ok(ini > 0, 'no encontré el alta del paso');
  assert.match(alta, /: \{ tipo: 'accion' \};$/, `el ＋ crea la acción con algo adentro: ${alta}`);
  assert.ok(!/accion: 'crear_tarea'/.test(ui), 'volvió el `crear_tarea` de default');
});
