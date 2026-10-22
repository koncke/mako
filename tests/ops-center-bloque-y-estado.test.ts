// =============================================================================
// El bloque de decisiones, como lo pidió Martín al usarlo, y el estado honesto de cada chat (22/10/2026)
// =============================================================================
// Martín, ya usando el bloque, con captura: «Que no se ponga con el fondo blanco, que sea un bloque flotante… Falta un
// desplegable, una flecha o algo para ocultarlo… Tienes que ser capaz de poner links… al final salió como un resumen de todo.
// No debería, pero sí debería poder ver unos botones o algo para volver a la pregunta anterior». Y: «hay muchos chats que
// dicen "Espera tu respuesta" y cuando entro, no veo el mensaje de "Completado" o el bloque de preguntas».
//   1. el bloque flota sobre el fondo del chat, se pliega con una flecha (recordado por chat y por sus preguntas);
//   2. los links se tocan, también los que vienen sin https, y abrir uno no elige la opción;
//   3. con varias, «‹ Anterior», los puntos y «Siguiente ›»; sin pantalla de resumen: con la última, salen todas;
//   4. «Espera tu respuesta» sólo con una pregunta; un «Ya está» sin su ✓ dice «Completado» y el hilo va a él;
//   5. lo que el chat le escribió a OTRO chat va plegado en una línea, «Avance: …».
//
// Correr: node --import tsx --test tests/ops-center-bloque-y-estado.test.ts
// PROBADO ROMPIÉNDOLO (base 5/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conDominiosComoLinks } from '../lib/links-texto';
import { TEXTO_SEGUNDO_RENGLON, lineasDeConversacion, primeraOracion, segundoRenglon, turnosParaOtro, ultimoYaEsta, yaEstaSinVer, type LineaChat } from '../lib/centro-chats';
import type { TurnoChat } from '../lib/operaciones-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const bloque = () => sinComentarios(leer('app/admin/operaciones/PreguntasDelChat.tsx'));

test('1. flota sobre el fondo del chat y se pliega con una flecha, recordado por chat y por sus preguntas', () => {
  const css = leer('app/admin/operaciones/centro.css');
  assert.match(css, /\.co-caja-wrap \{ background: var\(--bg\); \}/, 'el pie de la caja, con el fondo del chat (no la franja blanca)');
  assert.match(css, /\.co-preg--arriba \{ margin: 0 auto 10px; box-shadow: [^}]*0 10px 30px/, 'una tarjeta flotante, con su sombra');
  const b = bloque();
  assert.match(b, /if \(plegado\) return <Plegada n=\{preguntas\.length\} onAbrir=\{\(\) => setPlegado\(false\)\} \/>;/);
  assert.match(b, /const esperando = \(n: number\) => \(n === 1 \? '1 pregunta esperando' : `\$\{n\} preguntas esperando`\);/);
  assert.match(b, /<Plegar onPlegar=\{\(\) => setPlegado\(true\)\} \/>/);
  // Por chat Y por las preguntas que espera: una nueva lo abre solo.
  assert.match(b, /window\.localStorage\.getItem\(CLAVE_PLEGADO \+ chat\) === firma/);
  for (const f of ['app/admin/operaciones/Conversacion.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.match(sinComentarios(leer(f)), /<PreguntasDelChat key=\{`p-\$\{[a-z.]+\}`\} chat=\{[a-z]+\.clave\}/, `${f}: le dice de qué chat es`);
  }
});

test('2. los links se tocan, también sin https, y abrir uno no elige la opción', () => {
  assert.equal(conDominiosComoLinks('1) Entrá a aistudio.google.com/apikey con la cuenta.'), '1) Entrá a [aistudio.google.com/apikey](https://aistudio.google.com/apikey) con la cuenta.');
  assert.equal(conDominiosComoLinks('hola-mako.com/integraciones, y listo'), '[hola-mako.com/integraciones](https://hola-mako.com/integraciones), y listo');
  for (const igual of ['mirá https://aistudio.google.com/apikey ya', '[acá](https://x.com/a)', 'Next.js, hilo.ts y la v1.2', 'escribime a ana@mako.com']) {
    assert.equal(conDominiosComoLinks(igual), igual, igual);
  }
  const b = bloque();
  assert.match(b, /const conLinks = \(texto: string, k: string\): ReactNode => conFormato\(conDominiosComoLinks\(texto\), k\);/);
  for (const campo of ['p.pregunta', 'p.contexto', 'o.detalle']) assert.ok(b.includes(`conLinks(${campo},`), campo);
  assert.match(b, /onClick=\{\(e\) => \{ if \(!enviando && !\(e\.target as HTMLElement\)\.closest\('a'\)\) tocar\(o\.i\); \}\}/, 'el link no elige');
  assert.match(b, /<div role="button" tabIndex=/, 'la opción no es un <button>: un link adentro de un botón no se abre');
});

test('3. con varias, «‹ Anterior», los puntos y «Siguiente ›»; sin resumen: con la última, salen todas', () => {
  const b = bloque();
  assert.doesNotMatch(b, /repaso|Tus respuestas|Repasar/, 'sin pantalla de resumen');
  assert.match(b, />‹ Anterior</);
  assert.match(b, />Siguiente ›</);
  assert.match(b, /className="co-preg__punto"/);
  assert.match(b, /if \(pos \+ 1 < preguntas\.length\) \{ ir\(pos \+ 1\); return; \}\n\s*const falta = preguntas\.findIndex\(\(q\) => !todo\[q\.id\]\);\n\s*if \(falta >= 0\) ir\(falta\); else void enviar\(todo\);/);
});

const LOCAL = 'local_22222222-2222-4222-8222-222222222222';
const t = (uuid: string, rol: TurnoChat['rol'], texto: string, at: string): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: rol === 'otro' ? 'Cerebro' : null, texto, at, trabajo: null } });
// Lo de la captura del chat «CRM»: Martín le pide algo, el chat dice «Ya está», y después le escribe al Cerebro lo del tren.
const CRM: LineaChat[] = [
  t('a', 'yo', 'arreglá el filtro del CRM', '2026-10-22T10:00:00Z'),
  t('b', 'el', 'Voy a trabajar en el filtro del CRM.', '2026-10-22T10:01:00Z'),
  t('c', 'el', 'Ya está: el filtro del CRM anda. Pruébalo en /crm.', '2026-10-22T10:30:00Z'),
  t('d', 'otro', 'Cerebro: el tren 2 está armado, mergeá main', '2026-10-22T11:00:00Z'),
  t('e', 'el', '**Mergeé main en crm-2210.** Corrí los tests afectados: 120/0. Paso el sha a Integración.', '2026-10-22T11:05:00Z'),
];

test('4. «Espera tu respuesta» sólo con una pregunta; un «Ya está» sin su ✓ dice «Completado», y el hilo va a él', () => {
  const quieto = { estado: 'abierto' as const, viejo: false };
  assert.equal(TEXTO_SEGUNDO_RENGLON[segundoRenglon(quieto, 1)!], 'Espera tu respuesta', 'una pregunta abierta');
  assert.equal(TEXTO_SEGUNDO_RENGLON[segundoRenglon(quieto, 0, true)!], 'Completado', 'su «Ya está» sin ✓: no pide nada');
  assert.equal(segundoRenglon(quieto, 0, false), null, 'quieto, sin pregunta ni «Ya está»: tranquilo, sin subtítulo');
  assert.match(sinComentarios(leer('app/admin/operaciones/PiezasCentro.tsx')), /r === 'revisar' \? 'co-fila__l2--ok'/, 'en verde, no en el color que pide algo');
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /renglon === 'espera' \? 'm-operaciones-espera' : 'm-operaciones-vivo'/, 'y en el teléfono');
  // Sigue hasta su ✓ aunque el chat haya escrito después (la regla del 18/10, tests/centro-ya-visto.test.ts)…
  assert.equal(ultimoYaEsta(CRM), Date.parse('2026-10-22T10:30:00Z'));
  // …y al abrir el chat, el hilo va a ESE turno (no al último).
  assert.equal(yaEstaSinVer(CRM, null), 'c');
  assert.equal(yaEstaSinVer(CRM, Date.parse('2026-10-22T10:30:00Z')), null, 'con su ✓, no');
  assert.match(sinComentarios(leer('app/admin/operaciones/Conversacion.tsx')), /const sinVer = useMemo\(\(\) => yaEstaSinVer\(lineas, yaVisto\), \[lineas, yaVisto\]\);[\s\S]{0,300}?window\.setTimeout\(\(\) => irAlTurno\(sinVer\), 120\);/);
});

test('5. lo que el chat le escribió a OTRO chat va plegado en una línea («Avance: …»); su «Ya está», a la vista', () => {
  assert.deepEqual([...turnosParaOtro(CRM)], ['e']);
  const vista = lineasDeConversacion(CRM);
  assert.deepEqual(vista.filter((l) => l.tipo === 'turno' && l.plegado).map((l) => l.tipo === 'turno' && l.turno.uuid), ['e']);
  assert.ok(!vista.some((l) => l.tipo === 'turno' && l.turno.rol === 'otro'), 'lo del otro chat no se dibuja (la regla de siempre)');
  // Un «Ya está» que pidió otro chat es para Martín: no se pliega.
  const conYa = [...CRM, t('f', 'otro', 'Cerebro: subilo', '2026-10-22T12:00:00Z'), t('g', 'el', 'Ya está: en producción.', '2026-10-22T12:30:00Z')];
  assert.ok(!turnosParaOtro(conYa).has('g'));
  // Lo que vuelve a decir Martín corta: lo de después es para él.
  assert.ok(!turnosParaOtro([...CRM, t('h', 'yo', 'gracias', '2026-10-22T13:00:00Z'), t('i', 'el', 'De nada.', '2026-10-22T13:01:00Z')]).has('i'));
  assert.equal(primeraOracion('**Mergeé main en crm-2210.** Corrí los tests afectados: 120/0.'), 'Mergeé main en crm-2210.');
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /if \(t\.rol === 'el' && l\.tipo === 'turno' && l\.plegado\) \{[\s\S]{0,200}?<Avance texto=\{t\.texto\} \/>/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Hilo.tsx')), /\{`Avance: \$\{primeraOracion\(texto\)\}`\}/);
});

// PROBADO ROMPIÉNDOLO (22/10/2026, base 5/0):
//   · el pie vuelve al fondo blanco                       → 4/1 (1)
//   · sin recordar el plegado                             → 4/1 (1)
//   · un dominio sin https no es link                     → 4/1 (2)
//   · el link elige la opción                             → 4/1 (2)
//   · la última no manda todas                            → 4/1 (3)
//   · «Completado» vuelve a pedir respuesta               → 4/1 (4)
//   · el hilo no va al «Ya está»                          → 4/1 (4)
//   · se pliega el «Ya está» que pidió otro chat          → 4/1 (5)
