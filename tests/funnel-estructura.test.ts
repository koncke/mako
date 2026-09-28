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
import { problemasDePipeline, DEFAULT_PIPELINE, FUNNEL_TEMPLATES, type Stage } from '../lib/pipeline';

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

  // Ningún cierre: no es un error, y se dice igual.
  const sin = problemasDePipeline([
    { key: 'lead', kind: 'entrada', label: 'Lead' },
    { key: 'agenda', kind: 'reunion', label: 'Llamada' },
  ] as Stage[]);
  assert.equal(sin.length, 1, nombre(sin));
  assert.ok(/ninguna etapa está tipada como cierre/i.test(sin[0]), nombre(sin));

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
