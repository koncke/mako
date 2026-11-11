// =============================================================================
// Los cursores de los agentes, en todo momento mientras MaKo edita (11/11/2026)
// =============================================================================
// Martín, mirando las capturas de producción del 11/11/2026: «Lo que no veo que esté en ninguna de las capturas que
// tomaste es el tema de la animación que hicimos con los cursores. Eso es súper importante que esté en todo momento.
// Porque es lo que hace atractivo justamente a esta funcionalidad de edición.»
// Medido ese día en producción (ws 3, un clip de 14 s, la «Edición automática» entera, muestreando cada 200 ms):
//   · 58 s de corrida; subs-01 transcribió 42 s con el cursor clavado en el mismo píxel;
//   · muletillas, B-roll y volumen trabajaron 0,2–0,8 s (el cursor ni llegaba: tarda 520 ms) y cinco agentes ni se
//     prendieron;
//   · fuera de la Edición automática (el chat, «Sí, en el feed», el botón de Subtítulos) no había ningún cursor.
// Lo que se fija:
//   1. un agente que trabaja pasea (enjambre/cursores.ts, `puntoTrabajando`), sin salir de su caja;
//   2. cada cambio del chat tiene su agente, y los trabajos largos prenden el suyo (enjambre/cursores-sueltos.ts);
//   3. lo que prende el chat se ve como mínimo `A_LA_VISTA_MS`;
//   4. el cableado: el componente dibuja también los sueltos y pasea; el chat los prende al aplicar; cada paso de la
//      edición automática dura lo mínimo a la vista.
//
// Correr: node --import tsx --test tests/video-editor-cursores-siempre.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.

import { mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PASEO_MS, puntoDeCursor, puntoTrabajando, ZONA_DE } from '../app/video-editor/_opencut/enjambre/cursores';
import {
  A_LA_VISTA_MS,
  AGENTE_DE_OPERACION,
  agentesDeOperaciones,
  agentesSueltos,
  mostrarCursores,
  useCursoresSueltos,
} from '../app/video-editor/_opencut/enjambre/cursores-sueltos';
import { AGENTES } from '../app/video-editor/_opencut/enjambre/plan';

const leer = (ruta: string) => readFileSync(new URL(`../${ruta}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const OC = 'app/video-editor/_opencut';

const linea = { caja: { left: 100, top: 500, width: 800, height: 200 }, scrollLeft: 0, pps: 40 };
const zonas = {
  reproductor: { left: 400, top: 50, width: 300, height: 400 },
  propiedades: { left: 750, top: 50, width: 250, height: 400 },
  biblioteca: { left: 0, top: 50, width: 350, height: 400 },
  linea: linea.caja,
};
const dentro = (p: { x: number; y: number } | null, c: { left: number; top: number; width: number; height: number }) =>
  !!p && p.x >= c.left && p.x <= c.left + c.width && p.y >= c.top && p.y <= c.top + c.height;

test('1. el que trabaja pasea: la vuelta 0 es su punto exacto, después se corre sin salir de su caja ni repetir', () => {
  assert.ok(PASEO_MS > 520, 'más corto que la transición: el cursor nunca llega a ningún lado');
  for (const a of AGENTES) {
    for (const en of [null, 3]) {
      const base = puntoDeCursor({ agente: a.id, en, zonas, linea });
      assert.deepEqual(puntoTrabajando({ agente: a.id, en, zonas, linea, vuelta: 0 }), base, `${a.id}: un renglón nuevo va al punto exacto`);
      const caja = en === null ? zonas[ZONA_DE[a.id]] : linea.caja;
      let antes = base;
      for (let vuelta = 1; vuelta <= 30; vuelta++) {
        const p = puntoTrabajando({ agente: a.id, en, zonas, linea, vuelta });
        assert.ok(dentro(p, caja), `${a.id} (en ${en}) se sale de su caja en la vuelta ${vuelta}`);
        assert.notDeepEqual(p, antes, `${a.id} (en ${en}) quieto en la vuelta ${vuelta}`);
        antes = p;
      }
    }
  }
  // Pasea de verdad (no un píxel): a lo largo de 10 vueltas recorre al menos 60 px de ancho.
  const xs = Array.from({ length: 10 }, (_, i) => puntoTrabajando({ agente: 'subs-01', en: null, zonas, linea, vuelta: i + 1 })!.x);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 60, `pasea ${Math.max(...xs) - Math.min(...xs)} px`);
  // Sin nada medido no se inventa un lugar.
  assert.equal(puntoTrabajando({ agente: 'subs-01', en: null, zonas: {}, linea: null, vuelta: 3 }), null);
});

test('2. cada cambio del chat tiene su agente; los trabajos largos prenden el suyo', () => {
  const ids = new Set(AGENTES.map((a) => a.id));
  for (const [op, agente] of Object.entries(AGENTE_DE_OPERACION)) assert.ok(agente && ids.has(agente), `${op} → ${agente}`);
  // Sin repetir, en el orden de AGENTES; la edición automática no tiene (dibuja los suyos).
  assert.deepEqual(
    agentesDeOperaciones([{ op: 'velocidad' }, { op: 'borrar_silencios' }, { op: 'cortar_tramo' }, { op: 'edicion_automatica' }]),
    ['corte-01', 'gfx-01'],
  );
  assert.deepEqual(agentesDeOperaciones([{ op: 'generar_subtitulos' }]), ['subs-01']);
  assert.deepEqual(agentesDeOperaciones([{ op: 'normalizar' }, { op: 'reducir_ruido' }]), ['mezcla-01', 'mezcla-02']);
  assert.deepEqual(agentesDeOperaciones([]), []);
  const nada = { delChat: [], subtitulando: false, brolleando: false, recortando: false };
  assert.deepEqual(agentesSueltos(nada), []);
  assert.deepEqual(agentesSueltos({ ...nada, subtitulando: true }), ['subs-01'], '«Sí, en el feed» y el botón de Subtítulos');
  assert.deepEqual(agentesSueltos({ ...nada, brolleando: true, delChat: ['subs-01'] }), ['subs-01', 'broll-01']);
  assert.deepEqual(agentesSueltos({ ...nada, recortando: true, delChat: ['corte-01'] }), ['corte-01'], 'sin repetir');
});

test('3. lo que prende el chat se ve como mínimo A_LA_VISTA_MS, y dos cambios del mismo agente lo dejan prendido', () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  try {
    const prendidos = () => useCursoresSueltos.getState().delChat;
    const soltar = mostrarCursores(['corte-01', 'gfx-01']); // t = 0
    assert.deepEqual(prendidos(), ['corte-01', 'gfx-01']);
    mock.timers.tick(200);
    soltar(); // el cambio se aplicó en 200 ms: el cursor sigue a la vista
    soltar(); // dos veces no descuenta dos
    mock.timers.tick(1);
    assert.deepEqual(prendidos(), ['corte-01', 'gfx-01'], 'se apagó apenas terminó el cambio: el cursor ni llegó');
    const otro = mostrarCursores(['corte-01']); // t = 201
    mock.timers.tick(A_LA_VISTA_MS - 202); // t = A_LA_VISTA_MS − 1
    assert.deepEqual(prendidos(), ['corte-01', 'gfx-01'], 'se apagó antes del mínimo');
    mock.timers.tick(1); // t = A_LA_VISTA_MS
    assert.deepEqual(prendidos(), ['corte-01'], 'gfx-01 se apaga; corte-01 sigue por el otro cambio');
    otro(); // prendido desde t = 201: le faltan 201 ms
    mock.timers.tick(200);
    assert.deepEqual(prendidos(), ['corte-01']);
    mock.timers.tick(1);
    assert.deepEqual(prendidos(), []);
    // Uno largo (más que el mínimo) se apaga apenas termina.
    const largo = mostrarCursores(['broll-01']);
    mock.timers.tick(A_LA_VISTA_MS * 3);
    largo();
    mock.timers.tick(0);
    assert.deepEqual(useCursoresSueltos.getState().delChat, []);
    assert.doesNotThrow(() => mostrarCursores([])());
  } finally {
    mock.timers.reset();
  }
});

test('4. el cableado: el componente dibuja los sueltos y pasea, el chat los prende al aplicar, cada paso se ve', () => {
  const comp = leer(`${OC}/enjambre/components/cursores.tsx`);
  assert.match(comp, /const enMarcha = enjambre \|\| sueltos\.length > 0;/);
  assert.match(comp, /agentesSueltos\(\{ delChat, subtitulando, brolleando, recortando \}\)/);
  assert.match(comp, /const subtitulando = useTrabajoSubtitulos\(\(s\) => s\.fase !== "inactivo"\);/);
  assert.match(comp, /const brolleando = useTrabajoBroll\(\(s\) => s\.fase !== "inactivo" \|\| s\.cambiando !== null\);/);
  assert.match(comp, /const recortando = useTrabajoClips\(\(s\) => s\.fase !== "inactivo"\);/);
  assert.match(comp, /setInterval\(\(\) => setVuelta\(\(v\) => v \+ 1\), PASEO_MS\)/, 'sin la vuelta, el cursor queda clavado');
  assert.match(comp, /\? puntoTrabajando\(\{ agente: a\.id, en: ultimo\.get\(a\.id\) \?\? null, \.\.\.medida, vuelta \}\)/, 'el que trabaja en la edición automática pasea');
  assert.match(comp, /const p = puntoTrabajando\(\{ agente: id, en: null, \.\.\.medida, vuelta \}\);/, 'los sueltos pasean');
  assert.match(comp, /dibujo = ultimos\.current\.map\(\(d\) => \(\{ \.\.\.d, opacidad: 0 \}\)\);/, 'al terminar se desvanecen');

  const chat = leer(`${OC}/chat/PanelChat.tsx`);
  const aceptar = chat.slice(chat.indexOf('const aceptar = async'), chat.indexOf('const restaurar'));
  assert.match(aceptar, /const soltarCursores = mostrarCursores\(agentesDeOperaciones\(m\.propuesta\.operaciones\)\);/);
  assert.match(aceptar, /aceptarPropuesta\([^\n]*\)\.finally\(soltarCursores\);/, 'si falla, el cursor queda prendido para siempre');

  const correr = leer(`${OC}/enjambre/correr.ts`);
  const lazo = correr.slice(correr.indexOf('for (const paso of pasos)'), correr.indexOf('} finally {', correr.indexOf('for (const paso of pasos)')));
  const espera = lazo.indexOf('if (!quietos) await esperar(Math.max(0, PASO_A_LA_VISTA_MS - (Date.now() - empezo)));');
  assert.ok(espera > 0, 'cada paso no dura lo mínimo a la vista');
  assert.ok(espera < lazo.indexOf('fijarAgente(paso.agente, como === "hecho"'), 'la espera va ANTES de apagar al agente');
  assert.match(lazo, /const empezo = Date\.now\(\);/);
  assert.match(correr, /const PASO_A_LA_VISTA_MS = 1400;/);
});

// PROBADO ROMPIÉNDOLO (11/11/2026, cada uno dio rojo y se volvió atrás):
//   · `puntoTrabajando` sin el corrimiento (devuelve el punto)                → rojo el 1 (quieto)
//   · el corrimiento sin el tope de la caja                                  → rojo el 1 (se sale)
//   · `mostrarCursores` apagando en el acto, sin esperar el mínimo           → rojo el 3
//   · el componente sin el intervalo de la vuelta                             → rojo el 4
//   · `aceptarPropuesta` sin el `.finally(soltarCursores)`                    → rojo el 4
//   · correr.ts sin la espera de `PASO_A_LA_VISTA_MS`                         → rojo el 4
