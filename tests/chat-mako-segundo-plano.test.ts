// El chat de MaKo de Automations trabaja en segundo plano, y «No se envió» sólo cuando no salió (22/10/2026)
// =============================================================================
// Martín, mirando #289 en el ws1 (por el Cerebro):
//   1. «En Automations, cuando está ejecutando algo, no debe deshabilitarme la navegación de la sidebar principal... Se debe
//      ejecutar en segundo plano. Si está bien que deshabilite la edición del lienzo»: la capa queda debajo de la barra de
//      la app (tests/lienzo-capas.test.ts), irse no corta el turno, al volver se ve lo que va o el resultado, y si está en
//      otra tab queda avisado para la estrella.
//   2. «No se envió · Reintentar» sobre su mensaje estaba mal: el mensaje SÍ llegó y lo que faltaba era la IA. Si llegó,
//      MaKo dice por qué, con su botón; «No se envió» queda para cuando de verdad no salió.
// ⚠️ PROBADO ROMPIÉNDOLO: los números van al pie.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aQuienLeToca } from '../app/automations/stream-ia';
import { avisarTrabajoTerminado, trabajosSinVer, marcarTrabajoVisto, EVENTO_TRABAJO_MAKO } from '../lib/mako-trabajos';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const LECTOR = () => sinComentarios(leer('app/automations/stream-ia.ts'));
const CHAT = () => sinComentarios(leer('app/automations/ChatMako.tsx'));
const PERFIL = () => sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
/** Desde `desde` hasta el primer `hasta` después (o `tope` caracteres). */
const tramo = (src: string, desde: string, hasta: string, tope = 4000): string => {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  return src.slice(i, j > i ? j + hasta.length : i + tope);
};

test('a quién le toca el fin: al que lo largó si sigue; si no, al que volvió; si no, a nadie (guarda y avisa)', () => {
  const a = {}, b = {};
  assert.equal(aQuienLeToca(a, new Map([[a, 1], [b, 1]])), 'duenio');
  assert.equal(aQuienLeToca(a, new Map([[b, 1]])), 'otro');
  assert.equal(aQuienLeToca(a, new Map()), 'nadie');
  assert.equal(aQuienLeToca(a, undefined), 'nadie');
});

test('irse NO corta el turno: vive por clave afuera del componente; sólo Cancelar y el tope lo cortan', () => {
  const lector = LECTOR();
  const hook = tramo(lector, 'export function useStreamIA(', '\n}\n', 9000);
  // El efecto de montar/desmontar: se anota y mira; al irse se saca de la lista, sin `abort()`.
  const montar = tramo(hook, 'let m = MONTADOS.get(clave);', '}, [clave, yo]);');
  assert.doesNotMatch(montar, /\.abort\(\)/, 'desmontar corta el pedido: irse a otra tab lo pierde');
  assert.match(montar, /if \(t\) \{ t\.oyentes\.add\(setEstado\); setEstado\(t\.estado\); \}/, 'al volver no se ve lo que va');
  // El turno vive en TRABAJOS (uno por clave) y el fin va a quien esté.
  assert.match(hook, /TRABAJOS\.set\(clave, t\);/);
  assert.match(hook, /const quien = aQuienLeToca\(yo, montados\);\n\s+if \(quien === 'otro'\) for \(const \[k, fn\] of montados!\) if \(k !== yo\) fn\(f\);\n\s+if \(quien === 'nadie'\) extra\?\.siNadieMira\?\.\(f\);/);
  // Cancelar y el tope sí cortan.
  assert.match(tramo(hook, 'const cancelar = useCallback(', '}, [clave]);'), /t\.ctrl\.abort\(\);/);
  assert.match(hook, /const tope = setTimeout\(\(\) => c\.abort\(\), TOPE_CLIENTE_MS\);/);
  // ChatMako usa una clave por automatización y adopta lo que termina después de volver.
  const chat = CHAT();
  assert.match(chat, /useStreamIA\(`chat:\$\{p\.secuenciaId\}`, \(f\) => adoptarRef\.current\(f\)\);/);
  const adoptar = tramo(chat, 'adoptarRef.current = (f: FinIA) => {', '\n  };');
  assert.match(adoptar, /void traerChat\(\);/, 'al volver no se relee el hilo que guardó la ruta');
  assert.match(adoptar, /if \(f\.t === 'listo'\) aplicarListo\(f\.listo, p\.pasos\);/, 'al volver el resultado no llega al lienzo');
});

test('«No se envió» sólo si el pedido no llegó; si llegó (falta la IA, un tope, el lienzo cambió) lo dice MaKo con su botón', () => {
  const lector = LECTOR();
  // `noSalio` sólo sin respuesta de la ruta.
  assert.match(lector, /signal: c\.signal,\n\s+\}\);\n\s+respondio = true;/);
  assert.match(lector, /\.\.\.\(respondio \? \{\} : \{ noSalio: true as const \}\),/);
  const turno = tramo(CHAT(), 'const turno = async (', '\n  };', 9000);
  assert.match(turno, /if \(fin\.t === 'error' && fin\.noSalio\) return deshacer\(/);
  assert.match(turno, /if \(fin\.t === 'error'\) return respondeMako\(\{ texto: fin\.error, \.\.\.\(fin\.link \? \{ link: fin\.link \} : \{\}\) \}\);/);
  assert.match(turno, /if \(aplicado === false\) return respondeMako\(\{ texto: NO_APLICADO \}\);/, 'el lienzo cambió: el mensaje llegó, no es «No se envió»');
  // respondeMako NO saca el mensaje del hilo (deshacer sí): queda enviado, con la respuesta de MaKo debajo.
  const responde = tramo(turno, 'const respondeMako = (', '\n    };');
  assert.doesNotMatch(responde, /setMensajes\(\(ms\) => ms\.filter/, 'el mensaje que llegó se saca del hilo');
  assert.match(responde, /ponerExtras\(\(xs\) => \[\.\.\.xs, \{ id: `\$\{PREFIJO_EXTRA\}\$\{nuevoId\('mako'\)\}`, at: new Date\(\)\.toISOString\(\), mako: e \}\]\);/);
  // Y se dibuja como MaKo, con el botón a donde se arregla.
  const chat = CHAT();
  // (23/10/2026, AU4: en el globo de MaKo del hilo único, `hiloUnico`.)
  assert.match(chat, /\} else if \(e\.mako\) \{\n\s+items\.push\(\{ k: 'msg', id, role: 'assistant', texto: e\.mako\.texto, at: e\.at \}\);\n\s+if \(e\.mako\.link\) enGlobo\.set\(id, \{ abajo: <LinkIntegracion href=\{e\.mako\.link\} style=\{S\.botonArreglo\}>/);
});

test('terminó sin nadie mirando: el borrador se guarda por la acción del lienzo, la lista se relee y queda el aviso', () => {
  const perfil = PERFIL();
  assert.match(perfil, /alTerminarSinVer=\{guardarSinVer\}/);
  const guardar = tramo(perfil, 'const guardarSinVer = (f: FinIA) => {', '\n  };');
  assert.match(guardar, /if \(f\.listo\.modo !== 'editar' \|\| !edicionTocaPasos\(f\.listo\)\) \{ onListaCambio\?\.\(\); return; \}/);
  assert.match(guardar, /keepalive: true,/, 'sin keepalive, cerrar la pestaña corta el guardado');
  assert.match(guardar, /body: JSON\.stringify\(\{ secuenciaId: secuencia\.id, action: 'borrador', pasos: renumerar\(f\.listo\.pasos as PasoSecuenciaDto\[\]\), base: secuencia\.base \}\),/,
    'no es la acción ni la base del lienzo: se pisaría lo publicado o no se abriría');
  assert.match(guardar, /\.then\(\(\) => onListaCambio\?\.\(\)\)/, 'al volver en la misma visita se abriría lo de antes');
  assert.doesNotMatch(guardar, /\bset[A-Z]\w*\(/, 'un setState de un componente desmontado');
  // El chat lo dispara SÓLO cuando nadie mira, y deja el aviso para la estrella.
  const turno = tramo(CHAT(), 'const turno = async (', '\n  };', 9000);
  assert.match(turno, /\}, \{ siNadieMira \}\);/);
  const siNadie = tramo(turno, 'const siNadieMira = (f: FinIA) => {', '\n    };');
  assert.match(siNadie, /alTerminarSinVer\?\.\(f\);/);
  assert.match(siNadie, /avisarTrabajoTerminado\(\{\n\s+tab: 'Automations', titulo, href: `\/automations\?sec=\$\{p\.secuenciaId\}`/);
});

test('el aviso para la estrella: uno por automatización, el evento de window, y sale al volver a verla', () => {
  const visto: unknown[] = [];
  const w = new EventTarget();
  (globalThis as { window?: unknown }).window = w;
  w.addEventListener(EVENTO_TRABAJO_MAKO, (e) => visto.push((e as CustomEvent).detail));
  try {
    avisarTrabajoTerminado({ tab: 'Automations', titulo: 'Sprint · apertura', href: '/automations?sec=289', ok: true, texto: 'Cambié 2' });
    avisarTrabajoTerminado({ tab: 'Automations', titulo: 'Bienvenida', href: '/automations?sec=7', ok: false, texto: 'Falta tu IA' });
    avisarTrabajoTerminado({ tab: 'Automations', titulo: 'Sprint · apertura', href: '/automations?sec=289', ok: true, texto: 'Agregué 1' });
    assert.deepEqual(trabajosSinVer().map((t) => [t.href, t.texto]), [['/automations?sec=7', 'Falta tu IA'], ['/automations?sec=289', 'Agregué 1']]);
    assert.equal(visto.length, 3);
    marcarTrabajoVisto('/automations?sec=289');
    assert.deepEqual(trabajosSinVer().map((t) => t.href), ['/automations?sec=7']);
    assert.equal(visto.length, 4);
    marcarTrabajoVisto('/automations?sec=999');
    assert.equal(visto.length, 4, 'sin cambios no sale el evento');
    marcarTrabajoVisto('/automations?sec=7');
  } finally {
    delete (globalThis as { window?: unknown }).window;
  }
});

// ── Probado rompiéndolo (22/10/2026, romper.mjs) ───────────────────────────────────────────────────────────────────
// Los números son «tests / fallan» de ESTE archivo con cada rotura.
//   R1. desmontar vuelve a cortar el pedido (`abort()` en el efecto)                    → 5 / 1
//   R2. al volver no se mira lo que va                                                 → 5 / 1
//   R3. «No se envió» para todo error (sin mirar `noSalio`)                            → 5 / 1
//   R4. `noSalio` siempre (sin `respondio`)                                            → 5 / 1
//   R5. sin `keepalive` en el guardado sin ver                                         → 5 / 1
//   R6. el aviso se repite por automatización (sin el filtro por `href`)               → 5 / 1
// Y la capa ENCIMA de la barra de la app (z 61) → tests/lienzo-capas.test.ts 3 / 1.
