// =============================================================================
// Marketing CoPilot — TODOS los referentes, y cada uno sólo con lo que enseña (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «en los gurus, no creo que hayas puesto a todos, pusiste a pocos... Y fijate bien, porque por ejemplo Doglio,
// no creo que te enseñe a hacer webinar, o si?... El enseña organico en Instagram, estrategia de stories, etc...».
// Fija lib/media-buyer/copiloto-referentes.ts contra lo que se MIDE: cada referente con cara y ficha está; cada clase de su evidencia
// existe en su curso; cada funnel que se le ofrece tiene un marco en su ficha (el agente sólo tiene la ficha); y en la charla, elegir
// a uno ofrece sólo sus estrategias y lo que no enseña se dice con quién sí. El detalle: docs/marketing-copilot/referentes.md.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ASESORES } from '../lib/asesores/catalogo';
import { FICHAS } from '../lib/asesores/fichas';
import { CURSO_DE_REFERENTE } from '../lib/asesores/cursos';
import { FICHA_POR_FUNNEL, QUE_ENSENA, ensenaElFunnel, quienesEnsenan } from '../lib/media-buyer/copiloto-referentes';
import {
  FUNNELS, REFERENTES_COPILOTO, interpretarEscrito, opcionesDeCopiloto, pasoDeCopiloto, propuestaDe, sanearPerfil, textoDeFuera, type IdFunnel,
} from '../lib/media-buyer/copiloto';
import { contextoDelCopiloto, fichasDelCopiloto, quienEnsenaQue } from '../lib/media-buyer/copiloto-contexto';

const RAIZ = join(import.meta.dirname, '..');
const CLASES = JSON.parse(readFileSync(join(RAIZ, 'lib/asesores/clases-de-referentes.json'), 'utf8')) as Record<string, Array<{ t: string }>>;

/** Lo que tiene que decir la ficha (sus MARCOS) para que el funnel se le pueda ofrecer. */
const MARCO_DE: Record<IdFunnel, RegExp> = {
  'vsl-llamada': /\bvsl\b|video de venta|video, agenda|página de venta|landing/i,
  mensajes: /mensaje|whatsapp|conversaci[oó]n|\bdm\b/i,
  formulario: /formulario|aplicaci[oó]n/i,
  carrito: /carrito|checkout|compra|tienda|venta/i,
  webinar: /webinar|clase en vivo|clases|masterclass/i,
  'lead-magnet': /lead magnet|regalo|carnada|gratis|a cambio de|contacto|lista propia/i,
  youtube: /youtube|miniatura/i,
  organico: /instagram|reels?\b|historias|stories|carrusel|contenido|video corto|perfil/i,
  // Email a la lista (9/11/2026): ningún referente lo enseña como funnel propio (FICHA_POR_FUNNEL.email = null); si alguno lo suma, su
  // ficha tiene que traer esto.
  email: /correo|e-?mail|newsletter|secuencia|lista/i,
};
const marcos = (id: string) => (FICHAS as Record<string, string>)[id].split(/\nMARCOS\n/)[1]?.split(/\nCÓMO PIENSA/)[0] ?? '';

test('están TODOS los referentes con cara y ficha, y la grilla de la charla los ofrece a todos', () => {
  for (const a of ASESORES) {
    assert.ok(QUE_ENSENA[a.id], `${a.id} no está en la tabla`);
    assert.ok(existsSync(join(RAIZ, 'public/asesores', `${a.id}.png`)), `${a.id} sin cara`);
    assert.ok((FICHAS as Record<string, string>)[a.id], `${a.id} sin ficha`);
  }
  assert.equal(Object.keys(QUE_ENSENA).length, ASESORES.length, 'la tabla tiene uno que no es de lib/asesores');
  assert.deepEqual(REFERENTES_COPILOTO.map((r) => r.id).sort(), ASESORES.map((a) => a.id).sort());
  assert.ok(REFERENTES_COPILOTO.length >= 30, `son ${REFERENTES_COPILOTO.length}: antes eran 7`);
  // Primero los que arman un funnel.
  const i = REFERENTES_COPILOTO.findIndex((r) => r.funnels.length === 0);
  assert.ok(REFERENTES_COPILOTO.slice(i).every((r) => r.funnels.length === 0));
  // Cualquiera de ellos se puede guardar (antes sólo los siete).
  for (const a of ASESORES) assert.equal(sanearPerfil({ referente: a.id }).referente, a.id);
});

test('la evidencia de cada uno son clases de SU curso, textuales', () => {
  for (const [id, q] of Object.entries(QUE_ENSENA)) {
    const titulos = (CLASES[CURSO_DE_REFERENTE[id]] ?? []).map((c) => c.t);
    assert.ok(titulos.length, `${id}: no encuentro su curso`);
    assert.ok(q.evidencia.length >= 2, `${id}: la evidencia son al menos dos clases`);
    for (const e of q.evidencia) assert.ok(titulos.some((t) => t.includes(e)), `${id}: «${e}» no es una clase de su curso`);
  }
});

test('cada funnel que se ofrece con alguien tiene un marco en su ficha (el agente sólo tiene la ficha)', () => {
  for (const [id, q] of Object.entries(QUE_ENSENA)) {
    for (const f of q.funnels) assert.match(marcos(id), MARCO_DE[f], `${id} → ${f}: su ficha no tiene un marco de eso; va en la nota, no en funnels`);
  }
  // La ficha de cada funnel es de alguien que lo enseña.
  // Email no tiene ficha (null): ningún curso lo enseña como funnel propio y el agente usa su conocimiento de canales.
  for (const f of FUNNELS) if (FICHA_POR_FUNNEL[f.id] !== null) assert.ok(ensenaElFunnel(FICHA_POR_FUNNEL[f.id], f.id), `${f.id}: ${FICHA_POR_FUNNEL[f.id]} no lo enseña`);
  assert.equal(FICHA_POR_FUNNEL.email, null);
  // Y cada funnel tiene a alguien, salvo el email a la lista (9/11/2026): no se le atribuye a nadie lo que su curso no enseña.
  for (const f of FUNNELS) if (f.id !== 'email') assert.ok(quienesEnsenan(f.id).length > 0, `${f.id}: nadie lo enseña`);
  assert.deepEqual(quienesEnsenan('email'), [], 'si algún día un referente lo enseña, va en QUE_ENSENA con su marco y su ficha');
});

test('Doglio, medido: Instagram con historias (lo que dijo Martín) y también webinars (siete clases de su curso)', () => {
  const d = QUE_ENSENA['francisco-doglio'];
  assert.deepEqual(d.funnels, ['organico', 'webinar'], 'lo primero son las historias');
  assert.ok(d.evidencia.includes('2. Estrategias de Promoción de Ventas'));
  assert.match(marcos('francisco-doglio'), /historias de Instagram/, 'su ficha tiene el ciclo por historias');
  const webinar = (CLASES.arcadia ?? []).filter((c) => /webinar/i.test(c.t)).length;
  assert.ok(webinar >= 7, `su curso tiene ${webinar} clases de webinar`);
  // No enseña lead magnets ni YouTube: no se le atribuyen.
  assert.ok(!ensenaElFunnel('francisco-doglio', 'lead-magnet') && !ensenaElFunnel('francisco-doglio', 'youtube'));
});

test('en la charla: elegir a uno ofrece SÓLO sus estrategias; lo que no enseña se dice, con quién sí', () => {
  const doglio = { entrada: 'referente' as const, referente: 'francisco-doglio' as const };
  assert.equal(pasoDeCopiloto(doglio), 'funnel');
  assert.deepEqual(opcionesDeCopiloto('funnel', doglio), ['Orgánico en Instagram', 'Webinar']);
  const r = interpretarEscrito(doglio, 'quiero hacer lead magnets');
  assert.equal(r.tipo, 'fuera');
  const x = textoDeFuera((r as Extract<typeof r, { tipo: 'fuera' }>).fuera);
  assert.match(x.texto, /Francisco Doglio no enseña lead magnets en «ARCADIA»/);
  assert.match(x.texto, /Sofía Contreras/, 'propone a quien sí');
  assert.ok(x.opciones.some((o) => o.texto === 'Seguir a Sofía Contreras' && o.cambio?.referente === 'sofia-contreras'));
  assert.ok(x.opciones.some((o) => o.cambio === null), 'y se puede seguir con él');
  // Uno que enseña otra parte de la venta: lo dice y pregunta el funnel con todos.
  const hormozi = { entrada: 'referente' as const, referente: 'hormozi' as const };
  assert.equal(pasoDeCopiloto(hormozi), 'funnel');
  assert.equal(opcionesDeCopiloto('funnel', hormozi).length, FUNNELS.length);
  // «Inspirado en» sólo con lo suyo.
  const conSuyo = propuestaDe({ ...doglio, funnel: 'webinar', ticket: 3000, presupuestoMes: 2000, llamadas: 'equipo' })!;
  assert.equal(conSuyo.inspirado, 'Inspirado en Francisco Doglio');
  assert.equal(propuestaDe({ ...hormozi, funnel: 'formulario', ticket: 3000, presupuestoMes: 2000, llamadas: 'equipo' })!.inspirado, null);
});

test('el agente: la tabla corta en el contexto, y la ficha de un referente sólo cuando viene al caso', () => {
  const c = contextoDelCopiloto({ entrada: 'referente', referente: 'francisco-doglio', funnel: 'organico' });
  assert.match(c, /QUIÉN ENSEÑA QUÉ/);
  assert.match(c, /Lead magnets: Sofía Contreras/);
  assert.match(c, /eso no está en su curso/);
  assert.match(c, /SU FICHA \(destilada de su curso «ARCADIA»\)/);
  // Aceptó el funnel que propuso MaKo y Doglio no lo enseña: su ficha no viaja, ni se dice «inspirada en».
  const otro = { entrada: 'referente' as const, referente: 'francisco-doglio' as const, funnel: 'carrito' as const, ticket: 300, presupuestoMes: 600, llamadas: 'yo' as const };
  assert.deepEqual(fichasDelCopiloto(otro), ['juan-ads']);
  assert.doesNotMatch(contextoDelCopiloto(otro), /inspirada en Francisco Doglio/);
  // La tabla corta pesa poco (va en cada mensaje).
  assert.ok(quienEnsenaQue({}).length < 2000, `pesa ${quienEnsenaQue({}).length}`);
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. sumar 'lead-magnet' a los funnels de Doglio                           → 2 rojos (sin marco en su ficha; y Doglio «no enseña lead magnets»).
//   2. sacar a un referente de QUE_ENSENA                                    → no compila (Record total) y 1 rojo («están TODOS»).
//   3. una evidencia que no es una clase («Clase inventada»)                 → 1 rojo («la evidencia de cada uno»).
//   4. fichasDelCopiloto que pega la del referente siempre                   → 1 rojo («la ficha … sólo cuando viene al caso»).
