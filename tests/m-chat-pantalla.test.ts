// =============================================================================
// Las conversaciones del teléfono a pantalla completa, como WhatsApp (13/11/2026)
// =============================================================================
// Martín aprobó el prototipo (docs/prototipos/mako-mobile-chat.html): la lista del Ops Center con el grupo del negocio fijado arriba,
// y cada chat —MaKo, el grupo, un gurú, el coach, los del super admin— a pantalla completa, con la flecha para volver, el globo verde y la
// caja de WhatsApp. Esto fija lo que no se ve leyendo una pantalla sola:
//   1. ninguna conversación del Ops Center del teléfono vuelve a la hoja con asa y ✕;
//   2. la pantalla usa el historial de las hojas (el «atrás» de Android la cierra) y la flecha la cierra;
//   3. el aspecto de WhatsApp tiene alcance: ni una regla de chat-wa.css toca la computadora ni las hojas;
//   4. lo que sigue la conversación la busca en la pantalla (si no, el chat no baja a lo último al abrir);
//   5. la lista como el prototipo: el buscador, los chips, el grupo primero y «Nuevo chat» como el «+» flotante;
//   6. deslizar desde el borde: cuándo cierra al soltar.
//
// Probado rompiéndolo (13/11/2026, base 6/0): ChatClienteM con `<SheetM … id="chat-cliente"` otra vez → 5/1 (1) · PantallaChatM sin
// `registrarApertura` → 5/1 (2) · una regla `.co-yo .co-burbuja { … }` sin `.m-wa` en chat-wa.css → 5/1 (3) · HojaDelGrupo buscando
// `.m-sheet__cuerpo` → 5/1 (4) · «Nuevo chat» otra vez como fila → 5/1 (5) · el umbral en 0,6 → 5/1 (6).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const CONVERSACIONES = [
  ['app/m/second-brain/ChatClienteM.tsx', /<PantallaChatM abierto=\{abierta && elegido != null\} onCerrar=\{cerrar\} id="chat-cliente"/],
  ['app/m/second-brain/HojaDelGrupo.tsx', /<PantallaChatM abierto onCerrar=\{onCerrar\} id=\{`grupo-\$\{ws\}`\} grupo\b/],
  ['app/m/second-brain/HojaDelGuru.tsx', /<PantallaChatM abierto onCerrar=\{onCerrar\} id=\{`guru-\$\{r\.id\}`\}/],
  ['app/m/second-brain/HojaDelCoach.tsx', /<PantallaChatM abierto onCerrar=\{onCerrar\} id="funnel-coach"/],
  ['app/m/operaciones/ChatsMovil.tsx', /<PantallaChatM abierto=\{!!elegido\} onCerrar=\{cerrarHoja\} id="chat"/],
] as const;

test('1. ninguna conversación del Ops Center del teléfono vuelve a la hoja', () => {
  for (const [f, re] of CONVERSACIONES) {
    const s = sinComentarios(leer(f));
    assert.match(s, re, `${f}: a pantalla completa`);
  }
  // Las tres de una sola conversación no montan ninguna hoja; la del cliente sólo la de «Tus cuentas de IA» (un ajuste, no un chat).
  for (const f of ['app/m/second-brain/HojaDelGrupo.tsx', 'app/m/second-brain/HojaDelGuru.tsx', 'app/m/second-brain/HojaDelCoach.tsx', 'app/m/operaciones/ChatsMovil.tsx']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /<SheetM\b/, `${f}: sin hoja`);
  }
  const cliente = sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx'));
  assert.equal((cliente.match(/<SheetM\b/g) ?? []).length, 1, 'sólo la hoja del Uso');
  assert.match(cliente, /<SheetM abierto=\{verUso\}/);
});

test('2. la pantalla usa el historial de las hojas: el «atrás», la flecha, Escape y el borde la cierran', () => {
  const p = sinComentarios(leer('app/m/_chat/PantallaChatM.tsx'));
  assert.match(p, /registrarApertura\(\{ id, clave: clave\.current, cerrarYa:/, 'el «atrás» de Android la cierra');
  assert.match(p, /soltarPorGesto\(id, clave\.current\)/, 'cerrarla por la persona saca el ?sheet= del historial');
  assert.match(p, /soltarPorCodigo\(id, clave\.current\)/, 'cerrarla desde el código también');
  assert.match(p, /useEffect\(\(\) => \(\) => soltarAlDesmontar\(clave\.current\)/, 'si la página se va, sólo se suelta el registro');
  assert.match(p, /className="m-chat__volver" onClick=\{pedirCierre\}[^>]*aria-label="Volver"/, 'la flecha');
  assert.match(p, /e\.key === 'Escape'/);
  assert.match(p, /createPortal\(/, 'por arriba del encabezado y la barra (#m-capas)');
  assert.match(p, /className=\{`m-chat m-wa\$\{grupo \? ' m-wa--grupo' : ''\}`\}/, 'el aspecto de WhatsApp, con su alcance');
});

test('3. el aspecto de WhatsApp tiene alcance: la computadora y las hojas no cambian', () => {
  const css = leer('app/m/_chat/chat-wa.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const ALCANCE = /\.m-wa\b|\.m-chat(?:\b|__)|\.m-ops-[a-z]/;
  const selectores = [...css.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim()).filter((s) => s && !s.startsWith('@'));
  assert.ok(selectores.length > 30, `leyó las reglas (${selectores.length})`);
  // Las comas de adentro de un :is() no separan selectores.
  const partes = (s: string): string[] => {
    const out: string[] = [];
    let hondo = 0;
    let ini = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') hondo++;
      else if (s[i] === ')') hondo--;
      else if (s[i] === ',' && !hondo) { out.push(s.slice(ini, i)); ini = i + 1; }
    }
    return [...out, s.slice(ini)];
  };
  for (const s of selectores) for (const parte of partes(s)) {
    assert.match(parte, ALCANCE, `«${parte.trim()}» no tiene alcance: cambiaría la computadora o las hojas`);
  }
  // Ningún color nuevo: lo que no es un token es el blanco de lo rojo, las sombras y el negro de las máscaras.
  for (const hex of css.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) assert.match(hex, /^#fff$/i, `color suelto ${hex}`);
});

test('4. lo que sigue la conversación la busca en la pantalla, no en la hoja', () => {
  for (const [f] of CONVERSACIONES) {
    const s = sinComentarios(leer(f));
    assert.doesNotMatch(s, /closest\('\.m-sheet__cuerpo'\)/, `${f}: buscaba la hoja y el chat no bajaba a lo último`);
    assert.match(s, /closest\(CUERPO_CHAT\)/, f);
  }
  assert.match(leer('app/m/_chat/pantalla-chat.ts'), /export const CUERPO_CHAT = '\.m-sheet__cuerpo, \.m-chat__cuerpo';/);
  assert.match(leer('app/m/_chat/PantallaChatM.tsx'), /<div className="m-chat__cuerpo">\{children\}<\/div>/);
});

test('5. la lista como el prototipo: buscador, chips, el grupo primero y «Nuevo chat» flotante', () => {
  const s = sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx'));
  assert.match(s, /<input type="search" value=\{busca\}[^\n]*aria-label="Buscar en tus chats"/);
  assert.match(s, /<div className="m-ops-chips">[\s\S]*?Second Brain[\s\S]*?Ticketera[\s\S]*?\{k\.iaConectada === false \? 'Conecta tu IA' : 'Uso'\}/);
  // El grupo, primero de los chats; después el Cerebro.
  assert.match(s, /<ListaM etiqueta="Chats">\s*(?:\{\}\s*)?\{[^\n]*<FilasDelGrupoM g=\{grupos\}[^\n]*\n\s*\{cerebro && coincide\(cerebro\.titulo, busca\) && fila\(cerebro\)\}/);
  assert.doesNotMatch(s, /titulo="Nuevo chat"/, '«Nuevo chat» ya no es una fila');
  assert.match(s, /<NuevoChatFlotante onClick=\{\(\) => abrir\(\{ virtual: 'nuevo' \}\)\} \/>/);
  assert.match(leer('app/m/_chat/NuevoChatFlotante.tsx'), /className="m-ops-fab" aria-label="Nuevo chat"/);
  const g = sinComentarios(leer('app/m/second-brain/FilasDelGrupoM.tsx'));
  assert.match(g, /leading=\{<FotoDelGrupo \/>\}/, 'el grupo con su foto de grupo, no la estrella del chat con MaKo');
});

test('6. deslizar desde el borde: cierra pasado el 35 % del ancho, o con un envión', async () => {
  const { cierraAlSoltar, UMBRAL_CIERRE, BORDE_PX } = await import('../app/m/_chat/pantalla-chat');
  assert.equal(UMBRAL_CIERRE, 0.35);
  assert.equal(BORDE_PX, 24);
  assert.equal(cierraAlSoltar(140, 375, 0), true, '140 de 375 es más del 35 %');
  assert.equal(cierraAlSoltar(120, 375, 0), false, '120 de 375 no');
  assert.equal(cierraAlSoltar(60, 375, 1.2), true, 'un envión rápido alcanza aunque haya recorrido poco');
  assert.equal(cierraAlSoltar(60, 375, -1.2), false, 'volviendo hacia la izquierda no');
  assert.equal(cierraAlSoltar(400, 0, 0), false, 'sin ancho medido no se cierra sola');
});

// La última línea de cada chat con MaKo en la lista, como WhatsApp (13/11/2026). Probado rompiéndolo: sin «Tú: » para lo de la persona → 6/1 ·
// listarSesiones sin leer lo último → 6/1 · la fila sin `f.previa` → 6/1.
test('7. cada chat con MaKo muestra lo último que se dijo, lo tuyo con «Tú:»', async () => {
  const { previaDeMensaje, listaDelCliente } = await import('../lib/chat-mako-reglas');
  assert.equal(previaDeMensaje({ role: 'user', content: '¿Cómo viene el **mes**?' }), 'Tú: ¿Cómo viene el mes?');
  assert.equal(previaDeMensaje({ role: 'assistant', content: '## Vas bien\n\n12 ventas en https://www.hola-mako.com/general' }), 'Vas bien 12 ventas en hola-mako.com');
  assert.equal(previaDeMensaje({ role: 'assistant', content: '---\n\n' }), null, 'sin letras, sin línea');
  assert.equal(previaDeMensaje(null), null);
  assert.equal(previaDeMensaje({ role: 'assistant', content: 'a'.repeat(120) })?.length, 91, 'un renglón corto, con «…»');
  const [jefe, otra] = listaDelCliente({
    sesiones: [{ id: 1, titulo: null, pinned: false, updatedAt: '2026-11-13T10:00:00.000Z', ultimo: 'Vas bien' }, { id: 2, titulo: 'Plan', pinned: false, updatedAt: '2026-11-13T09:00:00.000Z', ultimo: 'Tú: anota esto' }],
    offer: [], antes: [], busca: '',
  });
  assert.equal(jefe.previa, 'Vas bien', 'el Cerebro, con su última línea');
  assert.equal(otra?.previa, 'Tú: anota esto');
  assert.match(sinComentarios(leer('lib/mako-turno-app.ts')), /const ultimos = await ultimosDeSesiones\(ss\.map\(\(s\) => s\.id\)\)\.catch\(/, 'la lista lee lo último, y si falla sale igual');
  assert.match(sinComentarios(leer('app/m/second-brain/ChatClienteM.tsx')), /: f\.previa \?\? undefined\}/, 'la fila del teléfono la muestra');
});

// El chat con un lead del teléfono, como WhatsApp y con lo que escritorio ya tenía (13/11/2026). Probado rompiéndolo: sin la nota de voz → 7/1 ·
// sin el clip → 7/1 · sin `.m-wa` → 7/1.
test('8. el chat con un lead: la caja de WhatsApp, adjuntar por WhatsApp y email, y la nota de voz por WhatsApp', () => {
  const c = sinComentarios(leer('app/m/chats/[clave]/ComposerChatsM.tsx'));
  assert.match(c, /<CajaChat\s+sinAdjuntos\b/, 'la caja única; lo adjuntado a un lead viaja como archivo, nunca leído como texto');
  assert.match(c, /adjuntos=\{adjuntosCaja\}/, 'el clip');
  assert.match(c, /const puedeAdjuntar = \(esWa \|\| esEmail\) && !motivo && enLinea;/, 'Instagram y Messenger, sólo texto (como escritorio)');
  assert.match(c, /voz=\{esWa && !motivo \? \{ onAudio: \(blob\) => enviarAudio\(blob\)/, 'la nota de voz, sólo por WhatsApp');
  assert.match(c, /formArchivoWhatsApp\(i, blob, nombre, \{ leadId, caption, tipo \}\)/, 'el multipart de escritorio, con la línea de la identidad');
  assert.match(c, /enviarEnOrden\(items, cap,/, 'en orden, el texto como pie del primero');
  assert.match(c, /<VistaAdjuntosM\s/, 'la vista previa a pantalla completa');
  assert.match(c, /className="m-chats-composer m-wa"/, 'con la cara de WhatsApp');
  assert.match(c, /fila="m-operaciones-caja__fila"/);
  const css = leer('app/m/chats/chats.css');
  assert.match(css, /\.m-chats-burbuja--mia \{ align-self: flex-end; margin-right: 8px; background: var\(--good-bg\);/, 'lo tuyo, el globo verde');
});
