// =============================================================================
// /privacidad y /terminos dicen quién publica la app en cada tienda (4/11/2026)
// =============================================================================
// Martín: «Si, el responsable legal es Leandro». El responsable sigue siendo RAZON_SOCIAL_MAKO, que es también el
// vendedor de la App Store. En Google Play la cuenta es de Martín y Play muestra su nombre legal: sin esta línea, el
// revisor de Play ve en la ficha a alguien que las páginas legales no nombran. Los revisores las abren sin cuenta y
// pueden no correr JavaScript, así que se RENDERIZA cada página en streaming, como documento y con CSS delante
// (el peor caso de producción, tests/layout-sin-suspense.test.ts), y se lee lo que queda a la vista.
//
// Probado rompiéndolo (4/11/2026), una rotura por vez sobre una base de 3 pases:
//   · sacar la línea de /privacidad → 1 fallo, 2 pases;
//   · sacar la línea de /terminos → 1 fallo, 2 pases;
//   · poner RAZON_SOCIAL_MAKO también como la de Play en las dos páginas → 2 fallos, 1 pase.
// Restaurado: 3 pases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createElement, Fragment, type ReactElement } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import Privacidad from '../app/privacidad/page';
import Terminos from '../app/terminos/page';
import { RAZON_SOCIAL_MAKO, PUBLICA_EN_PLAY } from '../lib/titular-mako';

function streamear(el: ReactElement): Promise<string> {
  return new Promise((ok, mal) => {
    let html = '';
    let listo = false;
    const out = new Writable({ write(c, _e, cb) { html += c.toString(); cb(); } });
    out.on('finish', () => ok(html));
    const s = renderToPipeableStream(el, {
      onAllReady() { if (listo) return; listo = true; s.pipe(out); },
      onShellError: mal,
    });
  });
}

/** El texto a la vista sin JavaScript: sin los `<div hidden id="S:n">` (cerrados por profundidad), scripts ni estilos. */
function visibleSinJs(html: string): string {
  let out = html;
  for (;;) {
    const ini = out.indexOf('<div hidden id="S:');
    if (ini < 0) break;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = ini;
    let prof = 0;
    let fin = -1;
    for (let m = re.exec(out); m; m = re.exec(out)) {
      prof += m[0] === '</div>' ? -1 : 1;
      if (prof === 0) { fin = m.index + m[0].length; break; }
    }
    out = fin < 0 ? out.slice(0, ini) : out.slice(0, ini) + out.slice(fin);
  }
  return out.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, ' ');
}

const RELLENO = createElement('style', { dangerouslySetInnerHTML: { __html: '.relleno{color:red} '.repeat(800) } });
const documento = (pagina: ReactElement) =>
  createElement('html', null, createElement('body', null, createElement(Fragment, null, RELLENO, pagina)));

/** La oración de quién publica, sacada de lo visible: desde «Quién publica la app» hasta el punto. */
async function lineaDeTiendas(pagina: ReactElement): Promise<string> {
  const vis = visibleSinJs(await streamear(documento(pagina)));
  const m = vis.match(/Quién publica la app:[^.]*\./);
  assert.ok(m, 'sin JavaScript no se lee «Quién publica la app»');
  return m[0].replace(/\s+([;,.])/g, '$1');
}

const ESPERADA = `Quién publica la app: en la App Store, ${RAZON_SOCIAL_MAKO}; en Google Play, ${PUBLICA_EN_PLAY}.`;

test('los dos publicadores son personas distintas, y la de Play no es el responsable', () => {
  assert.ok(PUBLICA_EN_PLAY.trim().length > 0);
  assert.notEqual(PUBLICA_EN_PLAY, RAZON_SOCIAL_MAKO);
});

test('/privacidad, sin JavaScript, nombra a quién publica en la App Store y en Google Play', async () => {
  assert.equal(await lineaDeTiendas(createElement(Privacidad)), ESPERADA);
});

test('/terminos, sin JavaScript, nombra a quién publica en la App Store y en Google Play', async () => {
  assert.equal(await lineaDeTiendas(createElement(Terminos)), ESPERADA);
});
