// =============================================================================
// UN solo chat en toda la app: la caja única y la guarda que la hace cumplir (20/10/2026)
// =============================================================================
// Martín, 18/10: «un solo chat en toda la app» (docs/feedback-18-10.md). El 20/10: «Te pedí que unificaras el chat del Ops
// Center en todos lados, su diseño y funcionalidades... Y en el onboarding y en otros lugares el chat sigue siendo
// diferente» (docs/feedback-20-10.md, punto 8). La caja del Ops Center es ahora UNA pieza, app/_chat/CajaChat.tsx, y esto:
//   1. fija que la pieza tiene todo lo de la caja del Ops Center;
//   2. fija que las pantallas que ya la usan no vuelven a armar su caja;
//   3. lleva la lista de las que FALTAN, cada una con su chat: cada migración la achica (una que ya usa la pieza y sigue en
//      «pendiente» falla, para que se la saque) y nadie suma una nueva;
//   4. falla si aparece una pantalla de MaKo nueva que arma su propia caja (un <textarea>, `ComposerWhatsApp`, `ChatHilo`
//      o su botón de mandar) en vez de la pieza.
// ⚠️ «Pantalla de MaKo» = dibuja `HiloMako`, le habla a /api/mako/chat o /api/m/mako, o su caja le escribe «a MaKo».
//
// Probado rompiéndolo (20/10/2026, con la base en 0 fallos):
//   · la pieza sin el «+» (MasCaja) → 1 fallo (1);
//   · Conversacion.tsx con su <textarea> otra vez → 1 fallo (2);
//   · una pantalla nueva de MaKo con su propio <textarea> → 1 fallo (4);
//   · la caja con `voz` que dicta en vez de grabar → 1 fallo (5).
// Y el 22/10/2026 (OC2: la regex ve «Pídele un cambio a MaKo», con palabras en el medio): PanelEditarMako fuera de la lista
// → 1 fallo (4) · una pantalla nueva con un <textarea> «Pídele algo nuevo a MaKo» → 1 fallo (4).

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

/** Las pantallas de MaKo con chat, y en qué están. «pendiente, de <chat>»: la migra el chat de esa área. */
const INVENTARIO: Record<string, 'caja única' | `pendiente, ${string}`> = {
  // La Ticketera del cliente como chat (23/10/2026): la computadora y el teléfono.
  'app/tickets/soporte/PiezasSoporte.tsx': 'caja única',
  'app/admin/operaciones/Conversacion.tsx': 'caja única',
  'app/m/operaciones/ChatsMovil.tsx': 'caja única',
  // El chat del cliente (22/10/2026): su caja vive en PiezasCliente.tsx y la montan la computadora y el teléfono.
  'app/second-brain/PiezasCliente.tsx': 'caja única',
  // El grupo de un negocio (3/11/2026): la caja única con su motor, en la computadora y en el teléfono.
  'app/_chat/grupo/CajaDelGrupo.tsx': 'caja única',
  // Offer, la tab y el onboarding, y Offer en el teléfono (22/10/2026, OF4): con el hilo del Ops Center (HiloMako) en la tab.
  'app/offer/ChatOffer.tsx': 'caja única',
  'app/m/offer/ComposerOfferM.tsx': 'caja única',
  // 23/10/2026 (AU4): el chat de MaKo de Automations dibuja el hilo y la caja únicos desde ChatMakoVista.tsx, que ChatMako.tsx
  // carga con next/dynamic (ChatMako lo importan el lienzo y la galería, que dibujan muchos tests; las piezas traen CSS).
  'app/automations/ChatMakoVista.tsx': 'caja única',
  // El MaKo Analyst de la ficha de un lead (22/10/2026, CR3): el hilo y la caja del Ops Center, con su motor (/api/crm/analyst).
  'app/crm/lead-view/MakoAnalystLead.tsx': 'caja única',
  // 22/10/2026 (OC2): EditorMako.tsx no es un chat (edita el pedido y las sugerencias del botón de un gráfico) y salió de la
  // lista; el panel «Pídele un cambio a MaKo» del Dashboard y la caja de «Pídeselo a MaKo» no estaban, y la regex no los veía.
  // 22/10/2026 (TB3): «Editar con MaKo» del Dashboard y el chat con sesiones de los gráficos (Ads Manager, el Diagnóstico),
  // con la caja y el hilo únicos y su motor de siempre. El chat de un gráfico del Dashboard ya va a la estrella.
  'app/dashboard/PanelEditarMako.tsx': 'caja única',
  'app/web-generator/CajaPedido.tsx': 'pendiente, de Web Generator (la usan Automations, CRM y Dashboard)',
  // 22/10/2026 (TB3): el agente dibuja el hilo y la caja únicos desde ChatAgente.tsx, que carga con next/dynamic (PanelAgente.tsx
  // lo importan tests y las piezas traen CSS); PanelAgente ya no arma ninguna caja.
  'app/web-generator/editor/paneles/ChatAgente.tsx': 'caja única',
  // 22/10/2026 (TB3): los dos editores con su motor (editan lo abierto) y la propuesta en el hueco de la respuesta.
  'app/video-editor/_opencut/chat/PanelChat.tsx': 'caja única',
  'app/image-editor/mako/chat/PanelMakoIA.tsx': 'caja única',
  'app/plan/board/MakoProyecto.tsx': 'pendiente, de Plan',
  'app/_components/MakoChat.tsx': 'caja única',
  // La encontró la guarda el 20/10 (no estaba en el inventario de docs/feedback-20-10.md): «Pregúntale a MaKo…» en el chat de WhatsApp.
  // 22/10/2026 (TB3): con su motor y su «Usar →» en el hueco de cada respuesta (no va a la estrella: el borrador es de ESTE lead).
  'app/whatsapp/WhatsAppAdvisor.tsx': 'caja única',
  // La caja de Chats (24/10/2026, Martín: «me gustaría que se parezca más al chat de MaKo»): no le habla a MaKo, le habla
  // al contacto, pero es la misma caja, con el motor de Chats (docs/diseno-chats.md §8.3).
  'app/chats/Composer.tsx': 'caja única',
};

/** Arma su PROPIA caja: un campo de texto, la barra de WhatsApp (sola o adentro de su hilo) o el botón de mandar del chat. */
const CAJA_PROPIA = /<textarea\b|<ComposerWhatsApp\b|<ChatHilo\b|className="co-enviar"/;
/** Es un chat con MaKo: su hilo, su API, o una caja que le escribe «a MaKo». */
// Con palabras en el medio («Pídele un cambio a MaKo», 22/10/2026: el panel del Dashboard esquivaba la de antes) y «Pídeselo».
const ES_DE_MAKO = /<HiloMako\b|['"`]\/api\/mako\/chat|['"`]\/api\/m\/mako|(placeholder|aria-label)=\{?["'`][^"'`]*\b(Escr[ií]bele|Escribile|Escribe|Preg[uú]ntale|Pregunt[aá]le|P[ií]dele|P[ií]deselo|Pedile|Dile|Habla con)\b[^"'`]{0,40}\ba MaKo/;

function tsxDe(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (n === 'node_modules' || n.startsWith('.')) continue;
    if (statSync(p).isDirectory()) out.push(...tsxDe(p));
    else if (n.endsWith('.tsx')) out.push(relative(RAIZ, p).replace(/\\/g, '/'));
  }
  return out;
}

test('1. la caja única tiene todo lo de la caja del Ops Center', () => {
  const c = leer('app/_chat/CajaChat.tsx');
  for (const [pieza, para] of [
    ['<MasCaja ', 'el «+» (Documento, Fotos, Cámara, Pegar y lo de cada pantalla)'],
    ['<BotonEmojis ', 'los emojis'],
    ['<BotonMandar ', 'UN botón: el micrófono sin nada escrito, la flecha con algo'],
    ['<ListaAdjuntos ', 'las miniaturas de lo adjuntado, arriba'],
    ['alPegar(e, adjuntos)', 'pegar una imagen'],
    ['conVinetas(', 'las viñetas mientras se escribe'],
    ['enterEnLista(', 'Enter adentro de una lista'],
    ['estaAbajo(', 'el scroll que acompaña lo que se escribe'],
    ['<LinksDeLaCaja ', 'los links con su chip'],
    ['<ResalteDeLinks ', 'los links azules mientras se escribe'],
  ] as const) assert.ok(c.includes(pieza), `la caja única no tiene ${para}`);
  assert.doesNotMatch(c, /maxLength=/, 'sin tope de largo');
});

test('2. las pantallas con la caja única no vuelven a armar la suya', () => {
  for (const [f, estado] of Object.entries(INVENTARIO)) {
    if (estado !== 'caja única') continue;
    const s = leer(f);
    // Con comillas simples o dobles: el Video Editor (OpenCut) escribe sus imports con dobles (22/10/2026, TB3).
    assert.match(s, /import \{ CajaChat \} from (['"])@\/app\/_chat\/CajaChat\1;/, `${f}: usa la caja única`);
    assert.match(s, /<CajaChat\b/, `${f}: la dibuja`);
    assert.doesNotMatch(s, CAJA_PROPIA, `${f}: no arma su propia caja (un <textarea>, ComposerWhatsApp, ChatHilo o su botón de mandar)`);
  }
});

test('3. la lista de las que faltan sólo se achica', () => {
  for (const [f, estado] of Object.entries(INVENTARIO)) {
    assert.ok(existsSync(join(RAIZ, f)), `${f} no existe: si se movió, actualizá la lista`);
    if (estado === 'caja única') continue;
    const s = leer(f);
    const yaEsta = /<CajaChat\b/.test(s) && !CAJA_PROPIA.test(s);
    assert.ok(!yaEsta, `${f} ya usa la caja única: pasala a 'caja única' en esta lista`);
  }
});

test('4. una pantalla de MaKo nueva no arma su propia caja: usa la caja única', () => {
  const nuevas = tsxDe(join(RAIZ, 'app'))
    .filter((f) => f !== 'app/_chat/CajaChat.tsx' && !(f in INVENTARIO))
    .filter((f) => { const s = leer(f); return ES_DE_MAKO.test(s) && CAJA_PROPIA.test(s); });
  assert.deepEqual(nuevas, [], `Estas pantallas de MaKo arman su propia caja: usá app/_chat/CajaChat.tsx (o, si de verdad falta, sumalas al INVENTARIO como «pendiente, de <chat>»): ${nuevas.join(', ')}`);
});

test('5. la nota de voz y la línea de estado (lo que pidió el onboarding)', () => {
  // La caja no se dibuja en node (AdjuntosCaja importa su CSS): se mira el código, como los demás de la caja.
  const c = leer('app/_chat/CajaChat.tsx');
  // Desde el 24/10/2026 TODA caja graba: sin `voz`, la nota se transcribe y sale como texto (tests/chat-nota-de-voz.test.ts).
  assert.match(c, /return p\.voz \? <CajaConVoz \{\.\.\.p\} voz=\{p\.voz\} \/> : <CajaConNota \{\.\.\.p\} \/>;/, 'con o sin `voz`, la caja graba');
  assert.match(c, /const grabacion = useGrabacionVoz\(p\.voz\.onAudio, p\.voz\.onError\);/);
  // Desde el 20/10/2026 (la revisión de caja-voz) el botón gira con `enviando` o con `ocupado` (`girando`): tests/caja-voz-revision.test.ts.
  // Desde el 21/10 graba también mientras MaKo trabaja (sólo la flecha espera): tests/caja-voz-revision.test.ts, 3.
  // 24/10/2026: bloqueada (sin la app de escritorio), en el lugar del botón va el que la destraba (tests/caja-sin-app.test.ts).
  assert.match(c, /\{p\.bloqueo \? p\.bloqueo\.boton : grabacion && !hayQueMandar && !enviando \? \(\n\s*<button type="button" className="co-enviar co-enviar--mic" onClick=\{\(\) => void grabacion\.start\(\)\}/, 'con `voz` y nada que mandar, el botón GRABA');
  assert.match(c, /aria-label="Grabar una nota de voz"/);
  assert.match(c, /const conBarra = !!grabacion && \(grabacion\.fase === 'grabando' \|\| !!grabacion\.revision \|\| !!p\.voz\?\.pendiente\);/, 'grabando o con algo para escuchar');
  assert.match(c, /<BarraGrabacion voz=\{grabacion\} ocupado=\{girando\} existente=\{p\.voz\?\.pendiente \?\? null\}/, 'la barra: se termina, se escucha y recién ahí se manda');
  assert.match(c, /\{p\.estado !== undefined && <p className="co-caja__estado" aria-live="polite">\{p\.estado \?\? ''\}<\/p>\}/, 'la línea de estado, si la pantalla la da');
});

// ── EL CHAT ENTERO, NO SÓLO LA CAJA (23/10/2026) ───────────────────────────────────────────────────────────────────────────
// Martín: «revisa que el chat con MaKo en el editor del CRM en el detail de un lead, no es el mismo que debería ser, con la criatura
// y otras cosas del chat que están mal... Tienes que UNIFICAR los chats con MaKo en toda la app». La caja ya era una (arriba); el
// MaKo Analyst del lead tenía la caja y el hilo únicos, pero su propio marco: sin la cabecera con la criatura, su loader («Abriendo
// el chat…») y su arrastrar y soltar. El chat de MaKo es TRES piezas juntas: el panel (app/admin/operaciones/PanelChat.tsx →
// PanelDeChat: la cabecera con la criatura, arrastrar y soltar, la columna del hilo y el lugar de la caja), el hilo (HiloMako) y
// la caja (CajaChat). Lo propio de cada lugar (el contexto del lead, del flujo…) va por props y por el motor de cada uno.
//   · 'panel único': la pantalla dibuja `<PanelDeChat` ella misma;
//   · 'pieza de <archivo>': dibuja el hilo y la caja que monta OTRA pantalla, y ésa dibuja el panel;
//   · 'pendiente, de <chat>': todavía con su marco propio; la migra el chat de esa área (cada migración achica la lista).
// ⚠️ El teléfono (/m) dibuja el chat en su hoja (SheetM, con la criatura en el título): es la versión destilada, no entra acá.

/** Toda pantalla de la computadora que dibuja el hilo de MaKo (`<HiloMako`), y cómo llega al panel. */
const PANEL: Record<string, 'panel único' | `pieza de ${string}` | `pendiente, ${string}`> = {
  'app/crm/lead-view/MakoAnalystLead.tsx': 'panel único',
  'app/second-brain/PiezasCliente.tsx': 'pieza de app/second-brain/ChatSecondBrain.tsx',
  // El grupo de un negocio (3/11/2026): el hilo único con el autor de cada mensaje. El teléfono lo monta en su hoja.
  'app/_chat/grupo/HiloDelGrupo.tsx': 'pieza de app/second-brain/ChatDelGrupo.tsx',
  // La apertura (29/10/2026, MaKo habla primero): sus mensajes van en el hilo del Cerebro, adentro de su panel.
  'app/_chat/AperturaMako.tsx': 'pieza de app/second-brain/ChatSecondBrain.tsx',
  'app/tickets/soporte/PiezasSoporte.tsx': 'pieza de app/tickets/soporte/ChatSoporte.tsx',
  'app/automations/ChatMakoVista.tsx': 'panel único',
  'app/dashboard/PanelEditarMako.tsx': 'panel único',
  'app/offer/ChatOffer.tsx': 'pendiente, de Offer',
  'app/web-generator/editor/paneles/ChatAgente.tsx': 'panel único',
  'app/video-editor/_opencut/chat/PanelChat.tsx': 'pendiente, de Video Editor',
  'app/image-editor/mako/chat/PanelMakoIA.tsx': 'pendiente, de Image Editor',
  'app/_components/MakoChat.tsx': 'panel único',
  'app/whatsapp/WhatsAppAdvisor.tsx': 'pendiente, de Chats',
  'app/ads-manager/ArranqueMediaBuyer.tsx': 'panel único',
};
const DIBUJA_PANEL = /<PanelDeChat\b/;

test('6. el chat entero: las pantallas con el panel único lo dibujan, y las piezas van adentro de una que lo dibuja', () => {
  for (const [f, estado] of Object.entries(PANEL)) {
    assert.ok(existsSync(join(RAIZ, f)), `${f} no existe: si se movió, actualizá la lista`);
    const s = leer(f);
    if (estado === 'panel único') {
      assert.match(s, DIBUJA_PANEL, `${f}: dibuja el panel único (la cabecera con la criatura)`);
      assert.match(s, /<HiloMako\b/, `${f}: con el hilo único`);
      assert.match(s, /<CajaChat\b|<Caja(DelCliente|Soporte)\b/, `${f}: con la caja única`);
    } else if (estado.startsWith('pieza de ')) {
      const montador = estado.slice('pieza de '.length);
      assert.match(leer(montador), DIBUJA_PANEL, `${f} es una pieza de ${montador}, y ésa dibuja el panel único`);
    } else {
      assert.doesNotMatch(s, DIBUJA_PANEL, `${f} ya dibuja el panel único: pasala a 'panel único' en esta lista`);
    }
  }
});

test('7. un chat de MaKo nuevo en la computadora no arma su propio marco: dibuja el panel único', () => {
  const nuevos = tsxDe(join(RAIZ, 'app'))
    .filter((f) => !f.startsWith('app/m/') && f !== 'app/_chat/HiloMako.tsx' && !(f in PANEL))
    .filter((f) => { const s = leer(f); return /<HiloMako\b/.test(s) && !DIBUJA_PANEL.test(s); });
  assert.deepEqual(nuevos, [], `Estos chats de MaKo dibujan el hilo sin el panel único (la cabecera con la criatura): montá app/admin/operaciones/PanelChat.tsx → PanelDeChat (o, si es una pieza, sumala al PANEL con quien la monta): ${nuevos.join(', ')}`);
});

// PROBADO ROMPIÉNDOLO (23/10/2026, tests 6 y 7, base 7/0):
//   · MakoAnalystLead.tsx sin `<PanelDeChat` (su marco de antes)          → 6/1 (6)
//   · una pantalla nueva con `<HiloMako` y sin el panel                   → 6/1 (7)
//   · ChatSoporte.tsx sin el panel (su pieza queda colgando)              → 6/1 (6)
