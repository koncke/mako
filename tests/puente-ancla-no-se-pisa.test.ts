// =============================================================================
// El cuerpo que ENSEÑA se protege en las cuatro capas, y la url viaja absoluta
// =============================================================================
// ⚠️ MEDIDO EN PRODUCCIÓN (06/09/2026): `estado_detalle = "FLOW_NUEVO SIN_ANCLA(generar_clip)"`
// con la sentinela intacta al lado, y el respaldo del server con CERO plantillas de
// BOQ mientras el navegador las mandaba en cada latido.
//
// Dos defectos, cada uno en varias capas:
//
// ① EL CUERPO CON LA FRASE SE PISABA. `op` y `sentinela` —los campos que dicen que
//    esta clase ALGUNA VEZ llevó la frase de aprendizaje— se conservaban; el CUERPO
//    que la llevaba lo reemplazaba la siguiente generación de la misma clase. En el
//    espejo (en memoria), en el worker (`guardarPlantillas`) y en el server
//    (`fundirPlantillas`). Y la siembra nunca reparaba una local rota.
//
// ② LA URL VIAJABA RELATIVA. BOQ abre sus XHR con `/_/AiSandbox…`; el server valida
//    el origen con `new URL(url)`, que tira, y descartaba SIN RUIDO. Ahora el espejo
//    absolutiza, y lo que el server descarta queda escrito con motivo.
//
// Lo funcional de ① está en `tests/flow-plantillas*.test.ts`. Acá van las capas que
// no se pueden importar (espejo, worker) y el registro de descartes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OPERACIONES } from '../lib/flow-operaciones';

const raiz = resolve(import.meta.dirname, '..');
const leer = (...p: string[]) => readFileSync(resolve(raiz, ...p), 'utf8');
const vivo = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const espejo = vivo(leer('extension', 'injected.js'));
const worker = vivo(leer('extension', 'background.js'));
const route = vivo(leer('app', 'api', 'flow', 'puente', 'route.ts'));

test('el espejo guarda la url ABSOLUTA en los dos caminos (XHR y fetch)', () => {
  assert.match(espejo, /this\.__makoUrl = absoluta\(url\);/,
    'El XHR volvió a guardar la url tal como la escribió la app: BOQ la escribe\n'
    + 'relativa, y el respaldo del server la descarta sin ruido.');
  assert.match(espejo, /const url = esRequest \? entrada\.url : absoluta\(entrada\);/,
    'El fetch volvió a guardar la url tal como vino.');
  assert.match(espejo, /new URL\(String\(u \|\| ''\), location\.href\)\.href/,
    '`absoluta` ya no resuelve contra la página: una relativa queda relativa.');
});

test('el espejo conoce las DOS anclas, y las dos son del catálogo', () => {
  // La de imagen faltaba: la plantilla de imagen nunca llevaba `sentinela`, así que
  // la regla de «no pisar» no la protegía.
  const src = leer('extension', 'injected.js');
  const frases = OPERACIONES.map((o) => o.frase).filter(Boolean) as string[];
  const tokens = OPERACIONES.map((o) => o.token).filter(Boolean) as string[];
  for (const [nombre, re] of [
    ['SENTINELA', /const SENTINELA = '([^']+)'/],
    ['SENTINELA_IMAGEN', /const SENTINELA_IMAGEN = '([^']+)'/],
  ] as const) {
    const m = re.exec(src);
    assert.ok(m, `no encontré ${nombre} en injected.js`);
    assert.ok(frases.includes(m![1]), `${nombre} («${m![1]}») no es una frase del catálogo`);
  }
  for (const [nombre, re] of [
    ['TOKEN_SENTINELA', /const TOKEN_SENTINELA = '([^']+)'/],
    ['TOKEN_IMAGEN', /const TOKEN_IMAGEN = '([^']+)'/],
  ] as const) {
    const m = re.exec(src);
    assert.ok(m, `no encontré ${nombre}`);
    assert.ok(tokens.includes(m![1]), `${nombre} («${m![1]}») no es un token del catálogo`);
  }
  assert.match(espejo, /for \(const \[frase, token\] of ANCLAS\)/,
    'El detector de sentinela volvió a mirar UNA sola ancla.');
});

test('el espejo no pisa un cuerpo con ancla con uno sin ancla, en los dos caminos', () => {
  assert.match(espejo, /previaX && previaX\.sentinela && !sentinela/,
    'El sitio del XHR volvió a pisar la plantilla que enseña.');
  assert.match(espejo, /previaF && previaF\.sentinela && !plantilla\.sentinela/,
    'El sitio del fetch volvió a pisar la plantilla que enseña.');
  assert.match(espejo, /sentinela: codificacionDeLaSentinela\(cuerpo\),/,
    'El camino del fetch dejó de calcular `sentinela`: sus plantillas no pueden\n'
    + 'declarar que enseñan ni ser protegidas.');
});

test('el worker no pisa, y la siembra REPARA una local sin ancla', () => {
  assert.match(worker, /if \(antes && antes\.cuerpo && operacionDelCuerpo\(antes\.cuerpo\) && !hallado\) continue;/,
    '`guardarPlantillas` volvió a pisar el cuerpo que enseña. Un injected.js viejo\n'
    + '—que sobrevive a la actualización— sigue pisando en memoria: ésta es la copia\n'
    + 'durable y la última defensa.');
  assert.match(worker, /if \(local && !\(operacionDelCuerpo\(p\.cuerpo\) && !operacionDelCuerpo\(local\.cuerpo\)\)\) continue;/,
    '`sembrarPlantillas` volvió a «nunca pisa una local»: una local sin ancla no sirve\n'
    + 'para generar, y el respaldo existe exactamente para repararla.');
});

test('lo que el server descarta queda escrito, con motivo', () => {
  assert.match(route, /sanearPlantillas\(body\.plantillas, descartes\)/,
    'El route volvió a sanear sin colector: los descartes vuelven a ser invisibles.');
  assert.match(route, /setSetting\(KEY_PLANTILLAS_DESCARTES,/,
    'Los descartes ya no se persisten. Un respaldo vacío volvería a parecer uno sano.');
});
