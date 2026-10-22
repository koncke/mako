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

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');

/** Las pantallas de MaKo con chat, y en qué están. «pendiente, de <chat>»: la migra el chat de esa área. */
const INVENTARIO: Record<string, 'caja única' | `pendiente, ${string}`> = {
  'app/admin/operaciones/Conversacion.tsx': 'caja única',
  'app/m/operaciones/ChatsMovil.tsx': 'caja única',
  // El chat del cliente (22/10/2026): su caja vive en PiezasCliente.tsx y la montan la computadora y el teléfono.
  'app/second-brain/PiezasCliente.tsx': 'caja única',
  'app/m/mako/Composer.tsx': 'pendiente, de Ops Center',
  'app/offer/ChatOffer.tsx': 'pendiente, de Offer',
  'app/m/offer/ComposerOfferM.tsx': 'pendiente, de Offer',
  'app/automations/ChatMako.tsx': 'pendiente, de Automations',
  'app/crm/lead-view/MakoAnalystLead.tsx': 'pendiente, de CRM',
  'app/dashboard/EditorMako.tsx': 'pendiente, de Dashboard',
  'app/web-generator/editor/paneles/PanelAgente.tsx': 'pendiente, de Web Generator',
  'app/video-editor/_opencut/chat/PanelChat.tsx': 'pendiente, de Video Generator',
  'app/image-editor/mako/chat/PanelMakoIA.tsx': 'pendiente, de Image Editor',
  'app/plan/board/MakoProyecto.tsx': 'pendiente, de Plan',
  'app/_components/MakoChat.tsx': 'pendiente, del Cerebro',
  // La encontró la guarda el 20/10 (no estaba en el inventario de docs/feedback-20-10.md): «Pregúntale a MaKo…» en el chat de WhatsApp.
  'app/whatsapp/WhatsAppAdvisor.tsx': 'pendiente, de Chats',
};

/** Arma su PROPIA caja: un campo de texto, la barra de WhatsApp (sola o adentro de su hilo) o el botón de mandar del chat. */
const CAJA_PROPIA = /<textarea\b|<ComposerWhatsApp\b|<ChatHilo\b|className="co-enviar"/;
/** Es un chat con MaKo: su hilo, su API, o una caja que le escribe «a MaKo». */
const ES_DE_MAKO = /<HiloMako\b|['"`]\/api\/mako\/chat|['"`]\/api\/m\/mako|(placeholder|aria-label)=\{?["'`][^"'`]*\b(Escr[ií]bele|Escribile|Escribe|Preg[uú]ntale|Pregunt[aá]le|P[ií]dele|Pedile|Dile|Habla con) a MaKo/;

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
    ['alPegar(e, p.adjuntos)', 'pegar una imagen'],
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
    assert.match(s, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/, `${f}: usa la caja única`);
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
  assert.match(c, /return p\.voz \? <CajaConVoz \{\.\.\.p\} voz=\{p\.voz\} \/> : <Caja p=\{p\} grabacion=\{null\} \/>;/, 'sin `voz`, la grabación ni se monta');
  assert.match(c, /const grabacion = useGrabacionVoz\(p\.voz\.onAudio, p\.voz\.onError\);/);
  // Desde el 20/10/2026 (la revisión de caja-voz) el botón gira con `enviando` o con `ocupado` (`girando`): tests/caja-voz-revision.test.ts.
  // Desde el 21/10 graba también mientras MaKo trabaja (sólo la flecha espera): tests/caja-voz-revision.test.ts, 3.
  assert.match(c, /\{grabacion && !hayQueMandar && !enviando \? \(\n\s*<button type="button" className="co-enviar co-enviar--mic" onClick=\{\(\) => void grabacion\.start\(\)\}/, 'con `voz` y nada que mandar, el botón GRABA');
  assert.match(c, /aria-label="Grabar una nota de voz"/);
  assert.match(c, /const conBarra = !!grabacion && \(grabacion\.fase === 'grabando' \|\| !!grabacion\.revision \|\| !!p\.voz\?\.pendiente\);/, 'grabando o con algo para escuchar');
  assert.match(c, /<BarraGrabacion voz=\{grabacion\} ocupado=\{girando\} existente=\{p\.voz\?\.pendiente \?\? null\}/, 'la barra: se termina, se escucha y recién ahí se manda');
  assert.match(c, /\{p\.estado !== undefined && <p className="co-caja__estado" aria-live="polite">\{p\.estado \?\? ''\}<\/p>\}/, 'la línea de estado, si la pantalla la da');
});
