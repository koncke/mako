// =============================================================================
// El turno de MaKo trae del Second Brain lo que nombra la pregunta, antes del modelo (28/10/2026, la tanda 3 del relevamiento)
// =============================================================================
// Martín: «Supongo que todos los chats ya extraen data del second brain, si no lo hacen está mal... y que sea eficiente
// justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». Lo que fija:
//   1. un closer o un setter no recibe la plata del negocio (objetivos, KPIs, clientes ganados): se saca del grafo antes de
//      recuperar, con sus aristas, porque el grafo en caché es del negocio y no de la persona. EN POSITIVO: queda sólo lo
//      que un closer SÍ ve; con la lista de lo que se sacaba, el nodo `objetivo` de los settings se coló (la verificación
//      de b2c19c445);
//   2. el bloque del system va sólo con una vista local: si la pregunta no nombra nada, no suma nada (ni el índice);
//   4. en la plataforma, la capa de las funciones entra sólo en una pregunta de producto: «¿cuál es mi meta del trimestre?»
//      traía Ads Manager («meta» es también Facebook) y «¿quién es mi cliente ideal?», el CRM (medido en el ws 9, 28/10/2026);
//   3. el turno lo trae en paralelo con el system (arranca antes de armarlo), lo pone hacia el final del system (antes de
//      `ctxDesde` y del contexto atado, que van juntos y al final: tests/ops-center-estrella-desde y mako-analyst-lead), con
//      la plata filtrada por el rol, y no espera al grafo más que un rato ni se cae si el grafo falla;
//   5. el tope: el bloque no pasa de ~1.200 tokens por más que la pregunta nombre mucho, y busca con las primeras letras del
//      mensaje (un texto pegado de 32.000 letras bloqueaba el proceso de 2 a 6 s: `recuperar` es sincrónico).
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDelSecondBrain, conCapa, LARGO_PREGUNTA_TURNO, preguntaDelTurno, PRESUPUESTO_TURNO, sinLaPlata } from '../lib/cerebro-union';
import { CAPA_FUNCIONES, esPreguntaDeProducto, funcionesDeMako, ID_RAIZ_FUNCIONES, PUENTE_FUNCIONES, sinFunciones } from '../lib/cerebro-funciones';
import { recuperar, tokensDe } from '../lib/cerebro-recuperar';
import { nodoDelObjetivo } from '../lib/cerebro-vivo';
import type { Cerebro, NodoCerebro } from '../lib/cerebro-modelo';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');

const negocio: Cerebro<string> = {
  negocio: 'Negocio de prueba',
  nodos: [
    { id: 'raiz', area: 'norte', etiqueta: 'Negocio de prueba', detalle: '', fuente: '', autoria: 'usuario' },
    { id: 'okr:1', area: 'norte', tipo: 'Objetivo', etiqueta: 'Vender más mentorías', detalle: 'Meta: USD 30.000 en el Q4 2026.', fuente: 'Objetivos', autoria: 'usuario' },
    { id: 'kpi:1', area: 'norte', tipo: 'KPI', etiqueta: 'Cobrado por semana', detalle: 'Compromiso: USD 2.500 por semana.', fuente: 'KPIs', autoria: 'usuario' },
    { id: 'clientes', area: 'funnel', tipo: 'Clientes', etiqueta: '12 clientes', detalle: 'Los que compraron la mentoría', fuente: 'CRM', autoria: 'mako' },
    { id: 'cliente:5', area: 'funnel', tipo: 'Cliente', etiqueta: 'Ana Pérez', detalle: 'Compró la mentoría', fuente: 'CRM', autoria: 'mako' },
    { id: 'prod:1', area: 'productos', tipo: 'Producto', etiqueta: 'Mentoría', detalle: 'La mentoría grupal de 12 semanas', fuente: 'Offer', autoria: 'usuario' },
  ],
  aristas: [
    { de: 'okr:1', a: 'prod:1', motivo: 'Lo mueve' }, { de: 'kpi:1', a: 'okr:1', motivo: 'Mide este objetivo' },
    { de: 'clientes', a: 'cliente:5', motivo: 'Compró' }, { de: 'cliente:5', a: 'prod:1', motivo: 'Compró este producto' },
    { de: 'raiz', a: 'prod:1', motivo: 'Lo que vende' },
  ],
  cuenta: { total: 5, mako: 2, usuario: 3, pendientes: 0 }, vacias: [], posiciones: {}, encuadre: { x: 0, y: 0, lado: 1 },
};

test('1. un closer o un setter no recibe la plata del negocio: se saca del grafo con sus aristas, antes de recuperar', () => {
  const sin = sinLaPlata(negocio);
  assert.deepEqual(sin.nodos.map((n) => n.id).sort(), ['prod:1', 'raiz']);
  assert.ok(sin.aristas.every((a) => sin.nodos.some((n) => n.id === a.de) && sin.nodos.some((n) => n.id === a.a)), 'quedó una arista a un nodo que se fue');
  assert.equal(sinLaPlata({ nodos: [negocio.nodos[0], negocio.nodos[5]], aristas: [] }).nodos.length, 2, 'sin plata, nada cambia');
  // La misma pregunta: el dueño ve la meta; el closer no, pero sí lo que vende.
  // En singular: la búsqueda del grafo reconoce el plural del DATO («mentorías» encuentra «Mentoría»), no el de la pregunta.
  const meta = '¿Cuál es la meta de la mentoría?';
  assert.match(bloqueDelSecondBrain(recuperar(negocio, { pregunta: meta, presupuesto: PRESUPUESTO_TURNO })), /USD 30\.000/);
  const delCloser = bloqueDelSecondBrain(recuperar(sinLaPlata(negocio), { pregunta: meta, presupuesto: PRESUPUESTO_TURNO }));
  assert.doesNotMatch(delCloser, /USD|Ana Pérez|12 clientes/, 'un closer recibió la plata del negocio');
  assert.match(delCloser, /Mentoría \[prod:1\]/);

  // EN POSITIVO: el objetivo de los settings TAL COMO LOS GUARDA el onboarding (strings), y los demás tipos que no son de un
  // closer, uno nuevo incluido. Quedan sólo los que un closer SÍ ve.
  const objetivo = nodoDelObjetivo('12', '30000');
  assert.ok(objetivo, 'con los settings como strings no sale el nodo del objetivo');
  assert.equal(nodoDelObjetivo('', '30000'), null);
  const todo: Cerebro<string> = {
    ...negocio,
    nodos: [...negocio.nodos, objetivo!,
      nodo('etapa:cierre', 'funnel', 'Cierre', 'El lead pagó.'),
      nodo('fase', 'norte', 'Fase 2 · Tracción', 'Cuánto invertir: USD 1.500 por mes en anuncios.'),
      nodo('reunion:5', 'funnel', 'Ana Pérez', 'Resultado: cierre ganado por USD 3.000.'),
      nodo('doc:7', 'documentos', 'Balance 2026', 'Facturación de USD 90.000.'),
      nodo('pan:MÉTRICAS', 'panorama', 'Métricas', 'Facturación mensual de USD 30.000.'),
      nodo('pan:OFERTA Y PRECIOS', 'panorama', 'Oferta y precios', 'La mentoría cuesta mil quinientos dólares.'),
      nodo('campo:negocio_objetivo', 'norte', 'Qué quieres lograr', 'Facturar USD 30.000 por mes.'),
      nodo('campo:oferta_ticket', 'oferta', 'Precio', 'Mil quinientos dólares.'),
      nodo('nuevo:1', 'panorama', 'Ventas del mes', 'USD 30.000 cobrados en cierres.'),
    ],
    aristas: [...negocio.aristas, { de: 'objetivo', a: 'etapa:cierre', motivo: 'Un cierre se cuenta cuando un lead llega aquí' },
      { de: 'reunion:5', a: 'etapa:cierre', motivo: 'Una reunión de venta' }, { de: 'raiz', a: 'etapa:cierre', motivo: 'El funnel' }],
  };
  assert.deepEqual(sinLaPlata(todo).nodos.map((n) => n.id).sort(), ['campo:oferta_ticket', 'etapa:cierre', 'pan:OFERTA Y PRECIOS', 'prod:1', 'raiz']);
  for (const q of ['¿Cuántos cierres tenemos que hacer en 90 días?', '¿Cuál es el objetivo del negocio?', '¿Cuál es el objetivo de cierres?',
    '¿Cuánta facturación?', '¿Cómo manejo una objeción en el cierre?']) {
    assert.doesNotMatch(bloqueDelSecondBrain(recuperar(sinLaPlata(todo), { pregunta: q, presupuesto: PRESUPUESTO_TURNO })), /USD|30\.000|invertir|Ana Pérez/, `«${q}»: un closer recibió la plata`);
  }
  assert.match(bloqueDelSecondBrain(recuperar(todo, { pregunta: '¿Cuál es el objetivo de cierres?', presupuesto: PRESUPUESTO_TURNO })),
    /12 cierres en 90 días \[objetivo\] — Y USD 30\.000 de facturación/, 'el dueño no ve su objetivo');
});

test('2. el bloque va sólo con una vista local: una pregunta que no nombra nada no suma nada, ni el índice', () => {
  assert.equal(bloqueDelSecondBrain(recuperar(negocio, { pregunta: 'hola, ¿cómo estás?' })), '');
  assert.equal(bloqueDelSecondBrain({ modo: 'indice', texto: '# índice' }), '');
  const b = bloqueDelSecondBrain(recuperar(negocio, { pregunta: '¿cuánto dura la mentoría?' }));
  assert.match(b, /^LO QUE TU SECOND BRAIN SABE DE ESTA PREGUNTA/);
  assert.match(b, /Mentoría \[prod:1\] — La mentoría grupal de 12 semanas/);
});

test('3. el turno lo trae en paralelo, al final del system, con la plata según el rol, sin esperar de más ni caerse', () => {
  const t = fuente('lib/mako-turno-app.ts');
  // Arranca ANTES de armar el system (en paralelo) y se espera después: los dos a la vez.
  // ⚠️ 2/11/2026 — LAS OPCIONES YA NO SE FIJAN PALABRA POR PALABRA. Antes el regex pedía el objeto
  // EXACTO `{ sinPlata: persona.rol !== 'admin' }` y se puso rojo al sumarle `referente` (la capa
  // del gurú, que cuelga su curso entero). Lo que este test cuida es otra cosa y sigue intacto: que
  // la llamada arranque ANTES de armar el system y se espere DESPUÉS —o sea, en paralelo— y que
  // lleve el filtro de la plata por rol. Fijar el objeto entero convierte cualquier opción nueva en
  // un rojo que no dice nada.
  // Desde el 12/11/2026 se busca con el mensaje Y los anteriores de la persona (`busquedaConLoAnterior`, tests/chat-app-hilo.test.ts):
  // «dalo de alta» solo no nombra a nadie. Lo que cuida este test sigue igual.
  assert.match(t, /const segundoCerebroP = paqueteParaElTurno\(busquedaConLoAnterior\(textoPersona \|\| textoMemoria, anterioresDeLaPersona\(deLaTab\)\), \{[^}]*sinPlata: persona\.rol !== 'admin'[^}]*\}\);\s*const base = await buildSystemPrompt\([^\n]*\);\s*const segundoCerebro = await segundoCerebroP;/,
    'el Second Brain no viaja en el turno, no va en paralelo o no lleva el filtro del rol');
  assert.match(t, /const system = `[^\n]*\$\{segundoCerebro \? `\\n\\n\$\{segundoCerebro\}` : ''\}\$\{ctxDesde \? `\\n\\n\$\{ctxDesde\}` : ''\}\$\{ctxAtado \? `\\n\\n\$\{ctxAtado\}` : ''\}`;/, 'el bloque no va en el system, o no va antes de ctxDesde y del contexto atado');
  const c = fuente('lib/cerebro-para-chat.ts');
  const p = c.slice(c.indexOf('export async function paqueteParaElTurno('), c.indexOf('async function armar('));
  assert.match(p, /Promise\.race\(\[\s*grafoParaChat\(\),\s*new Promise<null>\(\(r\) => setTimeout\(\(\) => r\(null\), ESPERA_GRAFO_TURNO_MS\)\),/, 'el turno espera al grafo sin tope');
  assert.match(c, /export const ESPERA_GRAFO_TURNO_MS = 2_500;/, 'la espera al grafo no es de 2,5 s');
  // El filtro de la plata se aplica a lo que haya en la mano, que desde el 2/11/2026 puede traer la
  // capa del referente colgada (`conReferente`). Lo que importa es que `sinPlata` siga decidiendo,
  // no sobre qué variable: fijar el nombre convierte cualquier capa nueva en un rojo que no dice nada.
  assert.match(p, /const delRol = o\.sinPlata \? sinLaPlata\((\w+)\) : \1;/, 'la plata no se filtra por el rol');
  // ⚠️ 3/11/2026 — EL CURSO DEL REFERENTE YA NO SE CUELGA DEL GRAFO: va en un bloque aparte, en
  // paralelo con el del negocio. Colgado del grafo viajaba por `recuperar`, que nunca pone el cuerpo de
  // un nodo sin pedirlo por id: el chat veía los títulos de las clases y ni una palabra del curso. Lo
  // que este assert cuida es que vaya en paralelo (no espera al grafo) y que lo decida el referente
  // del chat, no la pregunta (lib/cerebro-referente.ts → `cursoParaElTurno`).
  assert.match(p, /await Promise\.all\(\[\s*paqueteDelNegocio\(q, o\),\s*o\.referente \? cursoParaElTurnoDe\(o\.referente, q\) : Promise\.resolve\(''\),\s*\]\)/,
    'el curso del referente no va aparte y en paralelo con el negocio');
  assert.match(p, /const q = preguntaDelTurno\(pregunta\);\s*if \(!q\) return '';/, 'el turno busca con el mensaje entero');
  // Desde el 31/10/2026 hay DOS capas que se filtran por lo que pregunta el turno, así que son tres asserts y no uno:
  // las funciones (lib/cerebro-funciones.ts), Knowledge (lib/cerebro-knowledge.ts) y la búsqueda con su tope. Juntas en
  // un solo regex, cualquier capa nueva lo rompía por existir y la tentación era aflojarlo.
  assert.match(p, /const conProducto = esPreguntaDeProducto\(q\) \? delRol : sinFunciones\(delRol\);/,
    'las funciones de MaKo entran en cualquier pregunta: «¿cuál es mi meta del trimestre?» traía el Ads Manager');
  assert.match(p, /const g = esPreguntaDeConocimiento\(q\) \? conProducto : sinKnowledge\(conProducto\);/,
    'el método de los cursos entra en cualquier pregunta (o la condición quedó al revés): le come el presupuesto a los datos del negocio');
  assert.match(p, /return bloqueDelSecondBrain\(recuperar\(g, \{ pregunta: q, presupuesto: o\.presupuesto \?\? PRESUPUESTO_TURNO \}\)\);/,
    'el turno no busca con su pregunta y su tope');
  assert.match(p, /\} catch \{\s*return '';\s*\}/, 'un grafo que falla tumba el turno');
});

test('4. en la plataforma, las funciones entran sólo en una pregunta de producto', () => {
  for (const q of ['¿qué reemplaza a respond.io?', '¿qué no hace la bandeja?', 'hacé de esta copia la landing de los Chats', 'el editor tipo CapCut',
    '¿cómo funciona el Web Generator?', '¿para qué sirve la pestaña de Calendar?', '¿MaKo tiene algo como ManyChat?',
    // Sólo con la palabra, sin nombrar una función:
    '¿qué funciones tiene la app?', '¿qué pestañas hay?']) {
    assert.ok(esPreguntaDeProducto(q), `«${q}» no se tomó como de producto`);
  }
  for (const q of ['¿Cuál es mi meta del trimestre?', '¿Quién es mi cliente ideal y qué le duele?', 'corregí el plan de pagos de Ana', '¿Qué anuncios puedo hacer y para qué avatar?',
    '¿Cómo vienen mis leads?', 'hola', '']) {
    assert.equal(esPreguntaDeProducto(q), false, `«${q}» se tomó como de producto`);
  }
  // El grafo de la plataforma sin la capa: ni un nodo ni una arista de las funciones; con una pregunta del negocio, ninguna.
  const plataforma = conCapa(negocio, funcionesDeMako(), { id: CAPA_FUNCIONES, nombre: 'Lo que hace MaKo', raiz: ID_RAIZ_FUNCIONES, motivo: PUENTE_FUNCIONES });
  const sin = sinFunciones(plataforma);
  assert.ok(!sin.nodos.some((n) => n.id.startsWith('fn:') || n.id === ID_RAIZ_FUNCIONES) && sin.aristas.every((a) => !a.de.startsWith('fn:') && !a.a.startsWith('fn:') && a.a !== ID_RAIZ_FUNCIONES));
  assert.equal(sin.nodos.length, negocio.nodos.length, 'se fue un nodo del negocio');
  const meta = '¿Cuál es mi meta del trimestre?';
  assert.doesNotMatch(bloqueDelSecondBrain(recuperar(esPreguntaDeProducto(meta) ? plataforma : sin, { pregunta: meta, presupuesto: PRESUPUESTO_TURNO })), /fn:/, '«meta» trajo una función');
  const bandeja = '¿qué no hace la bandeja?';
  assert.match(bloqueDelSecondBrain(recuperar(esPreguntaDeProducto(bandeja) ? plataforma : sin, { pregunta: bandeja, presupuesto: PRESUPUESTO_TURNO })), /\[fn:chats\]/);
});

test('5. el tope del turno: ~1.200 tokens de grafo y las primeras letras del mensaje, por grande que sea cada uno', () => {
  // Ocho mentorías que nombra la pregunta, cada una con seis módulos: `recuperar` toma ocho semillas y cuatro vecinos de cada
  // una, y eso pasa de sobra el tope.
  const largo = 'con su temario, sus ejercicios, sus casos de alumnos reales del programa y las grabaciones de cada encuentro';
  const nodos: NodoCerebro[] = [];
  const aristas: Cerebro<string>['aristas'] = [];
  for (let k = 1; k <= 8; k++) {
    nodos.push(nodo(`prod:m${k}`, 'productos', `Mentoría ${k}`, `La mentoría ${k}, ${largo}`));
    for (let j = 1; j <= 6; j++) {
      nodos.push(nodo(`ent:${k}-${j}`, 'entregables', `Módulo ${k}.${j}`, `El módulo ${j} de la mentoría ${k}, ${largo}`));
      aristas.push({ de: `prod:m${k}`, a: `ent:${k}-${j}`, motivo: 'Un módulo' });
    }
  }
  const grande: Cerebro<string> = { ...negocio, nodos: [...negocio.nodos, ...nodos], aristas: [...negocio.aristas, ...aristas] };
  const pregunta = '¿qué trae la mentoría?';
  assert.ok(tokensDe(bloqueDelSecondBrain(recuperar(grande, { pregunta, presupuesto: 100_000 }))) > 1_500, 'el grafo de prueba no pasa el tope');
  const b = bloqueDelSecondBrain(recuperar(grande, { pregunta, presupuesto: PRESUPUESTO_TURNO }));
  assert.ok(tokensDe(b) > 600 && tokensDe(b) <= 1_300, `el bloque del turno trae ${tokensDe(b)} tokens`);

  const pegado = `¿Cuánto cobro por la mentoría? ${'Este es un texto pegado de un documento largo, con palabras del negocio y de todo. '.repeat(400)}`;
  const q = preguntaDelTurno(pegado);
  assert.ok(q.length > 300 && q.length <= 1_000 && q.length <= LARGO_PREGUNTA_TURNO, `el turno busca con ${q.length} letras`);
  assert.ok(pegado.startsWith(q) && pegado[q.length] === ' ', 'no son las primeras letras, o se cortó en el medio de una palabra');
  // Palabras de seis letras: el corte cae en el medio de una (600 no es múltiplo de 7) y tiene que volver al espacio.
  const seis = 'cierre '.repeat(200);
  const q6 = preguntaDelTurno(seis);
  assert.ok(q6.length < LARGO_PREGUNTA_TURNO && seis[q6.length] === ' ' && q6.endsWith('cierre'), 'se cortó en el medio de una palabra');
  assert.equal(preguntaDelTurno('  ¿qué no hace la bandeja?  '), '¿qué no hace la bandeja?');
});

function nodo(id: string, area: NodoCerebro['area'], etiqueta: string, detalle: string): NodoCerebro {
  return { id, area, etiqueta, detalle, fuente: '', autoria: 'usuario' };
}

// ── Probado rompiéndolo (28/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   T1. los KPIs al closer, T2. aristas a nodos que se fueron                 → rojo el 1.
//   T3. el índice en cada turno                                               → rojo el 2.
//   T4. la plata a cualquiera, T5. esperar al grafo sin tope, T6. el bloque fuera del system → rojo el 3.
// Y después de la verificación de b2c19c445 (28/10/2026, con un script que cambia, corre y restaura):
//   T7. volver a la lista de lo que se saca, T8. el objetivo entre lo que ve un closer, T9. los documentos y las reuniones,
//   T10. cualquier plano del panorama, T11. los campos del Norte, T12. el objetivo sólo con números (no como lo guarda el
//   onboarding)                                                               → rojo el 1.
//   T14. recuperar sin el tope del turno, T15. la espera en 60 s, T16. buscar con el mensaje entero → rojo el 3.
//   T13. el tope en 6.000, T17. el corte en 32.000 letras, T18. cortar en el medio de una palabra → rojo el 5 (T18 quedó
//   verde con el texto pegado: el corte caía justo en un espacio; por eso el caso de «cierre »).
