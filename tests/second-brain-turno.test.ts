// =============================================================================
// El turno de MaKo trae del Second Brain lo que nombra la pregunta, antes del modelo (28/10/2026, la tanda 3 del relevamiento)
// =============================================================================
// Martín: «Supongo que todos los chats ya extraen data del second brain, si no lo hacen está mal... y que sea eficiente
// justamente, por eso tenemos tipo grafo, sin gastar tantos tokens». Lo que fija:
//   1. un closer o un setter no recibe la plata del negocio (objetivos, KPIs, clientes ganados): se saca del grafo antes de
//      recuperar, con sus aristas, porque el grafo en caché es del negocio y no de la persona;
//   2. el bloque del system va sólo con una vista local: si la pregunta no nombra nada, no suma nada (ni el índice);
//   3. el turno lo trae en paralelo con el system (arranca antes de armarlo), lo pone hacia el final del system (antes de
//      `ctxDesde` y del contexto atado, que van juntos y al final: tests/ops-center-estrella-desde y mako-analyst-lead), con
//      la plata filtrada por el rol, y no espera al grafo más que un rato ni se cae si el grafo falla.
//
// Probado rompiéndolo (28/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDelSecondBrain, PRESUPUESTO_TURNO, sinLaPlata } from '../lib/cerebro-union';
import { recuperar } from '../lib/cerebro-recuperar';
import type { Cerebro } from '../lib/cerebro-modelo';

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
  assert.match(t, /const segundoCerebroP = paqueteParaElTurno\(textoPersona \|\| textoMemoria, \{ sinPlata: persona\.rol !== 'admin' \}\);\s*const base = await buildSystemPrompt\([^\n]*\);\s*const segundoCerebro = await segundoCerebroP;/,
    'el Second Brain no viaja en el turno, no va en paralelo o no lleva el filtro del rol');
  assert.match(t, /const system = `[^\n]*\$\{segundoCerebro \? `\\n\\n\$\{segundoCerebro\}` : ''\}\$\{ctxDesde \? `\\n\\n\$\{ctxDesde\}` : ''\}\$\{ctxAtado \? `\\n\\n\$\{ctxAtado\}` : ''\}`;/, 'el bloque no va en el system, o no va antes de ctxDesde y del contexto atado');
  const c = fuente('lib/cerebro-para-chat.ts');
  const p = c.slice(c.indexOf('export async function paqueteParaElTurno('), c.indexOf('async function armar('));
  assert.match(p, /Promise\.race\(\[\s*grafoParaChat\(\),\s*new Promise<null>\(\(r\) => setTimeout\(\(\) => r\(null\), ESPERA_GRAFO_TURNO_MS\)\),/, 'el turno espera al grafo sin tope');
  assert.match(p, /recuperar\(o\.sinPlata \? sinLaPlata\(grafo\) : grafo, /, 'la plata no se filtra por el rol');
  assert.match(p, /\} catch \{\s*return '';\s*\}/, 'un grafo que falla tumba el turno');
});

// ── Probado rompiéndolo (28/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado (sha1 igual):
//   T1. los KPIs al closer, T2. aristas a nodos que se fueron                 → rojo el 1.
//   T3. el índice en cada turno                                               → rojo el 2.
//   T4. la plata a cualquiera, T5. esperar al grafo sin tope, T6. el bloque fuera del system → rojo el 3.
