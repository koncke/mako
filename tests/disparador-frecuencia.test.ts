// =============================================================================
// El disparador editable: CADA CUÁNTO sale un mensaje
// =============================================================================
// El pedido llegó dos veces el 29/09/2026: «el primer paso debería ser el
// disparador y eso se DEBE poder configurar… un evento o está configurado por
// tiempo cada X tiempo por ejemplo» + «falta poder editar la frecuencia», y
// después, sobre la versión en prosa, «el "Qué lo dispara" NO es editable».
//
// Lo que se abrió es la mitad que es una decisión del negocio. Y un control que
// decide cuántos WhatsApps recibe una persona tiene dos formas de fallar, opuestas
// y las dos silenciosas:
//
//   · Que no haga NADA — el id con el que se busca la config no es el id con el
//     que se guarda, así que el store contesta el default y el desplegable queda
//     decorativo. Es el caso de los tres reportes (`reporte_diario` con guion bajo
//     contra `reporte-diario` con guion medio) y no da ningún error.
//   · Que haga DE MÁS — que elegir «cada vez» borre el dedup que el call site
//     puso para que un cron no repita la misma alerta cada hora. Ahí la pantalla
//     pasaría a producir más mensajes que antes, que es lo único que no puede.
//
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FRECUENCIAS, FRECUENCIA_MAX, ID_DE_REPORTE, SIN_LIMITE,
  frecuenciaEfectiva, idDeMensaje, labelFrecuencia, sanearFrecuencia,
} from '../lib/disparador-mensaje';
import { CATALOGO_AVISOS } from '../lib/avisos-catalogo';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');

/**
 * El fuente sin sus comentarios. Los de LÍNEA van primero: un bloque puede abrirse
 * adentro de un comentario de línea y tragarse cincuenta líneas de código de verdad,
 * que es como un guard de esta casa dio verde sobre algo que nunca miró.
 */
function sinComentarios(src: string): string {
  return src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

// ── Que el control no quede decorativo ───────────────────────────────────────

test('Los tres reportes se buscan en el catálogo con el id que el catálogo tiene', () => {
  // Probado rompiéndolo: cambiando 'reporte-diario' por 'reporte_diario' en
  // ID_DE_REPORTE → 2 fallos, 10 pases. Sin este test el síntoma es que el
  // desplegable de los tres reportes guarda y no cambia nada.
  const ids = new Set(CATALOGO_AVISOS.map((c) => c.id));
  for (const [tipo, id] of Object.entries(ID_DE_REPORTE)) {
    assert.ok(ids.has(id), `${tipo} apunta a «${id}», que no existe en el catálogo`);
  }
});

test('El despachador de reportes usa el id del catálogo, no el `tipo` del reporte', () => {
  const src = sinComentarios(leer('../lib/notify.ts'));
  assert.match(src, /idDeMensaje\(rep\.tipo\)/, 'el gate volvió a buscar la config con rep.tipo: no la va a encontrar nunca');
  assert.ok(
    !/estadoAviso\(\s*wsRep\s*,\s*rep\.tipo\s*\)/.test(src),
    'estadoAviso recibe rep.tipo crudo (guion bajo) y el store guarda con guion medio',
  );
});

test('Un `tipo` desconocido cae al mismo string, no a un id inventado', () => {
  // Un `replace` de guiones habría contestado un id plausible para cualquier tipo
  // nuevo. Devolver el mismo string hace que el store no lo encuentre y el mensaje
  // salga como siempre — el lado que no silencia.
  assert.equal(idDeMensaje('reporte_diario'), 'reporte-diario');
  assert.equal(idDeMensaje('reporte_mensual'), 'reporte_mensual');
  assert.equal(idDeMensaje('reunion-cancelada'), 'reunion-cancelada');
});

// ── Que el control no pueda producir un mensaje de MÁS ───────────────────────

test('Elegir «cada vez» NO borra el dedup del call site', () => {
  // Es la razón de existir de `frecuenciaEfectiva` en vez de un `??`. Probado
  // rompiéndolo: con `return sanearFrecuencia(delNegocio)` en el módulo → 1 fallo,
  // 11 pases.
  assert.equal(frecuenciaEfectiva(60, SIN_LIMITE), 60);
  assert.equal(frecuenciaEfectiva(60, 24 * 60), 24 * 60, 'gana el mayor de los dos');
  assert.equal(frecuenciaEfectiva(undefined, SIN_LIMITE), SIN_LIMITE);
  assert.equal(frecuenciaEfectiva(0, 7 * 24 * 60), 7 * 24 * 60, 'sin dedup del call site manda lo elegido');
});

test('Los dos choke points aplican el mayor de los dos, no el elegido', () => {
  for (const f of ['../lib/avisos.ts', '../lib/notify.ts']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /frecuenciaEfectiva\(/, `${f} dejó de pasar por frecuenciaEfectiva`);
  }
  // Probado rompiéndolo: con `const minutos = a.dedupTtlMin ?? 0` en el choke point de
  // avisos → 1 fallo, 11 pases. El síntoma sin este test es un desplegable que guarda
  // y no cambia nada, para los 62 mensajes que no son reportes.
  const avisos = sinComentarios(leer('../lib/avisos.ts'));
  assert.ok(
    !/reclamarEspaciado\(ws,\s*a\.tipo,\s*a\.dedupTtlMin/.test(avisos),
    'el reclamo volvió a usar el número del call site pelado: lo elegido en la pantalla no se aplica',
  );
});

test('El reclamo atómico vive en UN solo lugar', () => {
  // Con una copia en cada despachador, la de reportes —escrita después— nacería sin
  // el compare-and-set, que es la parte que hace que funcione.
  for (const f of ['../lib/avisos.ts', '../lib/notify.ts']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /from '\.\/espaciado'/, `${f} no importa el reclamo compartido`);
    assert.ok(!/cambiarSettingSi\(/.test(src), `${f} escribió su propia marca de dedup`);
  }
  assert.match(sinComentarios(leer('../lib/espaciado.ts')), /cambiarSettingSi\(/, 'el reclamo dejó de ser atómico');
});

// ── El default y el saneo ────────────────────────────────────────────────────

test('El default es el que no le cambia la vida a nadie', () => {
  assert.equal(FRECUENCIAS[0]!.min, SIN_LIMITE, 'la primera opción tiene que ser «cada vez»');
  assert.equal(sanearFrecuencia(undefined), SIN_LIMITE);
  assert.equal(sanearFrecuencia(null), SIN_LIMITE);
  assert.equal(sanearFrecuencia('nada'), SIN_LIMITE);
  assert.equal(sanearFrecuencia(-90), SIN_LIMITE, 'un negativo no es «para siempre»');
});

test('Un valor de fuera de la lista cae al más cercano POR DEBAJO', () => {
  // El lado que no silencia de más. Probado rompiéndolo: recorriendo la lista al revés
  // para quedarse con la opción de ARRIBA, 61 minutos pasan a ser 6 horas → 1 fallo,
  // 11 pases.
  assert.equal(sanearFrecuencia(61), 60, '61 min es «máximo uno por hora», no uno cada 6');
  assert.equal(sanearFrecuencia(59), SIN_LIMITE, 'por debajo de la primera opción real no hay límite');
  assert.equal(sanearFrecuencia(9_999_999), FRECUENCIA_MAX, 'el techo es un mes: más que eso es apagarlo');
  assert.equal(sanearFrecuencia(30 * 24 * 60), FRECUENCIA_MAX);
});

test('Todas las opciones sobreviven al saneo y tienen rótulo', () => {
  for (const f of FRECUENCIAS) {
    assert.equal(sanearFrecuencia(f.min), f.min, `la opción ${f.min} no sobrevive a su propio saneo`);
    assert.ok(f.label.trim().length > 0 && f.label.length <= 30, `rótulo fuera de rango: «${f.label}»`);
    assert.equal(labelFrecuencia(f.min), f.label);
  }
  const vistos = new Set(FRECUENCIAS.map((f) => f.min));
  assert.equal(vistos.size, FRECUENCIAS.length, 'hay dos opciones con los mismos minutos');
});

// ── Dónde corta cada uno ─────────────────────────────────────────────────────

test('Un aviso espaciado deja su fila en el feed; un reporte espaciado no ocurrió', () => {
  // Son dos decisiones distintas y el lugar del corte es lo que las implementa. En
  // avisos el gate va DESPUÉS de `crearNotificacion` (el evento pasó igual, se espacia
  // el WhatsApp); en reportes va ANTES (el feed ES el reporte).
  const avisos = sinComentarios(leer('../lib/avisos.ts'));
  assert.ok(
    avisos.indexOf('crearNotificacion({') < avisos.indexOf('reclamarEspaciado('),
    'el espaciado de un aviso se adelantó al feed: se pierde la bitácora de que el evento pasó',
  );
  // Probado rompiéndolo: mudando el gate de `despacharReporte` a después de
  // `crearNotificacion` → 1 fallo, 11 pases.
  const notify = sinComentarios(leer('../lib/notify.ts'));
  assert.ok(
    notify.indexOf('reclamarEspaciado(') < notify.indexOf('crearNotificacion({'),
    'el espaciado de un reporte quedó después del feed: llena el historial de reportes que nadie pidió',
  );
});

test('⚠️ El CRON guarda al elegir, y REVIERTE si falla', () => {
  // ESTE GUARD MUDÓ DE ARCHIVO. Vivía sobre `app/agencia/Disparador.tsx`, que la
  // sección CRON del lienzo reemplazó el 30/09/2026 — y ponerse rojo es lo que hizo
  // que alguien enumerara qué tenía de propio ese componente antes de borrarlo. Eran
  // tres cosas:
  //   · «que el botón de "Guardar" no exista, para eso solo un check al final del input»
  //   · revertir el control si el POST falla — sin eso el desplegable queda diciendo
  //     un horario que NO se guardó, y no hay forma de saberlo mirando la pantalla;
  //   · y el desplegable de «cada cuánto, como máximo», que se sacó a pedido.
  // Las dos primeras se mudaron; la tercera no vuelve.
  const src = leer('../app/agencia/FlujoAviso.tsx');
  assert.match(src, /action: 'cron-set'/, 'la sección CRON dejó de escribir');
  assert.ok(!/>\s*Guardar\s*</.test(src), 'volvió el botón de Guardar');
  assert.match(src, /else setCron\(previo\)/, 'sin revertir, el desplegable dice un horario que no se guardó');
  assert.ok(!/action: 'frecuencia'/.test(src), 'volvió el desplegable que se sacó a pedido');
});

test('Las dos rutas aceptan la action y sanean lo que llega', () => {
  for (const f of ['../app/api/admin/plantillas/route.ts', '../app/api/perfil/plantillas/route.ts']) {
    const src = sinComentarios(leer(f));
    assert.match(src, /case 'frecuencia'/, `${f} no acepta la action`);
    assert.match(src, /sanearFrecuencia\(b\.frecuenciaMin\)/, `${f} guarda el número crudo del body`);
  }
});
