// =============================================================================
// Los links y las navegaciones de la parte «pantalla» llevan el `?ws=` de la pestaña
// =============================================================================
// Revisión adversarial de la sexta tanda (10/10/2026), hallazgos 12 y 13. AGENTS.md, «Hay CINCO formas
// de navegar, y las cinco llevan el `?ws=`»: un link va por `app/_ui/Link`, un `router.push/replace`
// por el `useRouter` de esa misma pieza y un `window.location.href` por `conWs(destino, useWs())`. Si
// alguna pierde la pestaña, la forma en que falla no se parece a un bug: te deja mirando OTRA cuenta.
//
//   · 12: WhatsAppApp rebotaba `/whatsapp?ws=9&stab=plantillas` a `/automations?stab=plantillas` con el
//     router de `next/navigation`: Automations se abría en la cuenta de la cookie, no la del ws9.
//   · 13: el wizard compartido (OnboardingChatAgent, que /automations abre en «Tu forma de escribir» y
//     /email en «Configurar mi dominio») tenía `<a href>` crudos: la pestaña nueva abría /whatsapp o
//     /email en la cuenta propia del super admin.
//   · y de paso, el `window.location.href = '/extension/instalar'` del onboarding del Video Generator.
//
// ⚠️ Sólo se sacan los comentarios de LÍNEA: el `accept="image/*"` de estas pantallas abre un «bloque»
// para un regex de comentarios de bloque y se come el código hasta el próximo `*/`. Las regex de abajo
// piden la FORMA del código (`href="/…`, `= '/…`), así que la prosa de un comentario no las dispara.
//
// Correr: node --import tsx --test tests/pantalla-links-ws.test.ts
// PROBADO ROMPIÉNDOLO (10/10/2026, de a una y restaurando de memoria; base 3/0):
//   P1 WhatsAppApp de vuelta al `useRouter` de `next/navigation`            → 1/2
//   P2 «Configurar mi dominio» de vuelta a un `<a href="/email">`           → 1/2
//   P3 el link al chat de «Tu forma de escribir» de vuelta a `<a href={…}>` → 1/2
//   P4 el `window.location.href` a /extension/instalar sin `conWs`          → 1/2
// (Cada rotura la cazan DOS: el barrido general y el que fija el lugar.) Restaurado: 3/0.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinLineas = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '');

/** Las pantallas de esta parte que navegan: ninguna pierde la pestaña. */
const PANTALLAS = [
  'app/whatsapp/WhatsAppApp.tsx',
  'app/whatsapp/EmpresaInbox.tsx',
  'app/automations/OnboardingChatAgent.tsx',
  'app/automations/MakoRedacta.tsx',
  'app/video-generator/OnboardingVideoGen.tsx',
  'app/configuraciones/HorarioEnvioPanel.tsx',
  'app/email/OnboardingCanalEmail.tsx',
  // «Editar en el editor» (11/10/2026): los dos lugares de Video Generator que abren el
  // Video Editor, el botón y la pantalla del editor que importa el anuncio y reemplaza
  // la URL. El resto de app/video-editor lo barre entero tests/video-editor-integracion.test.ts.
  'app/video-generator/PasoMontaje.tsx',
  'app/video-generator/VideoGeneratorApp.tsx',
  'app/video-generator/editor-video.tsx',
  'app/video-editor/desde/ImportarDesde.tsx',
];

test('ninguna pantalla de esta parte navega sin el `?ws=`: ni `<a href="/…">` crudo, ni el router de Next, ni un `window.location` pelado', () => {
  for (const r of PANTALLAS) {
    const src = sinLineas(leer(r));
    assert.doesNotMatch(src, /<a\s[^>]*\bhref=\{?["'`]\//, `${r}: un <a href> interno crudo pierde el ?ws= (va por app/_ui/Link)`);
    assert.doesNotMatch(src, /import\s*\{[^}]*\buseRouter\b[^}]*\}\s*from\s*'next\/navigation'/, `${r}: el useRouter de Next pierde el ?ws= (va el de app/_ui/Link)`);
    assert.doesNotMatch(src, /from\s*'next\/link'/, `${r}: el Link de Next pierde el ?ws=`);
    assert.doesNotMatch(src, /window\.location\.href\s*=\s*["'`]\//, `${r}: un window.location.href pelado pierde el ?ws= (va conWs(destino, useWs()))`);
  }
});

test('12: el rebote de /whatsapp?stab=plantillas a /automations sale por el router de la casa', () => {
  const app = sinLineas(leer('app/whatsapp/WhatsAppApp.tsx'));
  assert.match(app, /import \{ useRouter \} from '@\/app\/_ui\/Link';/);
  // El guard de arriba sólo vale si el rebote sigue saliendo por `router`: si se mudara a otra forma, esto falla.
  assert.match(app, /router\.replace\(`\/automations\?stab=plantillas/);
});

// (Eran cuatro: el cuarto, «Abrir integraciones ↗», era del paso del WhatsApp OFICIAL, que salió del
// wizard el 10/10/2026 con la línea oficial. El barrido de arriba sigue mirando el archivo entero.)
test('13: los links del wizard compartido van por `Link` (los tres), y el del Video Generator por `conWs`', () => {
  const wiz = sinLineas(leer('app/automations/OnboardingChatAgent.tsx'));
  assert.match(wiz, /import Link from '@\/app\/_ui\/Link';/);
  assert.match(wiz, /<Link href=\{`\/whatsapp\?canal=no-oficial&chat=\$\{encodeURIComponent\(c\.jids\[0\] \?\? ''\)\}`\} target="_blank" rel="noreferrer"/, '«Tu forma de escribir»: el chat abría en la cuenta propia');
  assert.match(wiz, /<Link href="\/email" target="_blank" rel="noreferrer"/, '«Configurar mi dominio» abría /email en la cuenta propia');
  assert.match(wiz, /<Link href="\/crm\?embudo=entradas"/);
  const vg = sinLineas(leer('app/video-generator/OnboardingVideoGen.tsx'));
  assert.match(vg, /window\.location\.href = conWs\('\/extension\/instalar', ws\);/);
});
