// La razón social de MaKo tiene que estar en el HTML que SIRVE el server de hola-mako.com.
//
// El 08/10/2026 Meta rechazó la verificación del negocio del portafolio MaKo con «la razón
// social de la empresa debe aparecer en el sitio web». El verificador de un tercero puede no
// ejecutar JavaScript, así que lo que se agrega en el `useEffect` de la landing para él no
// existe: por eso estos tests RENDERIZAN en el server (renderToStaticMarkup no corre efectos)
// en vez de buscar el texto en el fuente.
//
// Verificado rompiéndolo: sacar el <span> del pie de la landing → 1 fallo (el primero);
// volver RESPONSABLE a 'MaKo' en /privacidad → 1 fallo; lo mismo en /terminos → 1 fallo.
// Y los que se sumaron con el segundo rechazo: sacar `legalName` del JSON-LD → 1 fallo;
// moverlo DESPUÉS de la landing → 1 fallo; sacar '/robots.txt' de PUBLICOS → 1 fallo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server';
import Landing from '../app/vsl/Landing';
import Privacidad from '../app/privacidad/page';
import Terminos from '../app/terminos/page';
import Home from '../app/page';
import robots from '../app/robots';
import { esPublica } from '../lib/rutas-publicas';
import { RAZON_SOCIAL_MAKO } from '../lib/titular-mako';

// ── Lo que ve quien NO ejecuta JavaScript ─────────────────────────────────────────────
// El segundo rechazo (08/10) pasó con el nombre YA en el HTML: estaba adentro de un
// `<div hidden id="S:0">`. El layout raíz envolvía toda la app en un <Suspense>, y React
// escribe aparte —oculto hasta que un script lo inserta— todo bloque de Suspense de más de
// 500 bytes una vez que lo ya escrito pasa los ~12.800, aunque ya esté listo.
// renderToStaticMarkup NO reproduce eso (no hace streaming), así que este test renderiza en
// streaming y busca el nombre en lo que queda VISIBLE después de sacar los segmentos ocultos.
//
// Desde el 10/10/2026 el layout ya no tiene ese Suspense (tests/layout-sin-suspense.test.ts),
// así que se renderiza la portada como sale hoy: sin envoltorio. El segmento oculto que queda
// es el del Suspense PROPIO de la landing (app/page.tsx), que se dejó a propósito; lo que se lee
// sin JavaScript es su fallback, PortadaSinJs, que es lo que aprobó Meta.
//
// Verificado rompiéndolo (10/10/2026), sobre una base en verde: sacar la razón social del
// fallback (PortadaSinJs) → 1 fallo; sacar el <Suspense> propio de la landing → 1 fallo (la
// condición «hay un segmento oculto» deja de cumplirse: el test avisa que hay que reescribirlo
// en vez de dar verde sobre otra pantalla).
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

/** El HTML sin los segmentos ocultos (`<div hidden id="S:n">…</div>`), cerrando por profundidad. */
function quitarOcultos(html: string): string {
  let out = html;
  for (;;) {
    const ini = out.indexOf('<div hidden id="S:');
    if (ini < 0) return out;
    const re = /<div\b|<\/div>/g;
    re.lastIndex = ini;
    let prof = 0;
    let fin = -1;
    for (let m = re.exec(out); m; m = re.exec(out)) {
      prof += m[0] === '</div>' ? -1 : 1;
      if (prof === 0) { fin = m.index + m[0].length; break; }
    }
    if (fin < 0) return out.slice(0, ini);
    out = out.slice(0, ini) + out.slice(fin);
  }
}

test('sin JavaScript, la portada muestra la razón social (la landing va en su propio Suspense)', async () => {
  // ⚠️ Con <html><body> o no reproduce nada: React sólo escribe bloques aparte cuando
  // renderiza un DOCUMENTO. Un fragmento suelto de 175 KB sale entero y visible (medido).
  const html = await streamear(createElement('html', null, createElement('body', null, createElement(Home))));
  // El segmento oculto es el del Suspense propio de la landing. Si desaparece, se lo sacó a
  // propósito: el test tiene que pasar a pedir la razón social del PIE de la landing.
  assert.ok(html.includes('<div hidden id="S:'), 'la landing ya no va en su propio Suspense: reescribí este test');
  const visible = quitarOcultos(html);
  assert.ok(visible.includes(`Razón social: ${RAZON_SOCIAL_MAKO}`), 'la razón social quedó solo en lo oculto');
});

// La portada: además del pie, la razón social va en datos estructurados AL PRINCIPIO del
// HTML (el pie cae al final de ~200 KB). Se pide que aparezca ANTES que el contenido de la
// landing, que es lo que hace a este bloque distinto del pie.
test('la portada trae legalName en JSON-LD antes que el contenido de la landing', () => {
  const html = renderToStaticMarkup(createElement(Home));
  const ld = html.indexOf('application/ld+json');
  assert.ok(ld >= 0, 'no hay JSON-LD');
  const fin = html.indexOf('</script>', ld);
  const datos = JSON.parse(html.slice(html.indexOf('>', ld) + 1, fin));
  assert.equal(datos['@type'], 'Organization');
  assert.equal(datos.legalName, RAZON_SOCIAL_MAKO);
  assert.ok(ld < html.indexOf('class="vsl-root"'), 'el JSON-LD quedó después de la landing');
});

// /robots.txt caía en el gate y redirigía a /login: un crawler que pide reglas recibía una
// página de login. Tiene que ser público y dejar leer el sitio.
test('robots.txt es público y deja leer el sitio', () => {
  assert.equal(esPublica('/robots.txt'), true);
  const r = robots();
  const reglas = Array.isArray(r.rules) ? r.rules : [r.rules];
  assert.ok(reglas.some((x) => x.userAgent === '*' && x.allow === '/' && !x.disallow));
});

test('la landing trae la razón social en el HTML del server, sin ejecutar sus efectos', () => {
  const html = renderToStaticMarkup(createElement(Landing));
  assert.ok(html.includes(`Razón social: ${RAZON_SOCIAL_MAKO}`), 'el pie de la landing no trae la razón social');
});

test('/privacidad nombra a la razón social como responsable del tratamiento', () => {
  const html = renderToStaticMarkup(createElement(Privacidad));
  assert.match(html, new RegExp(`Responsable del tratamiento: <strong>${RAZON_SOCIAL_MAKO} \\(MaKo\\)</strong>`));
});

test('/terminos nombra a la razón social como responsable del servicio', () => {
  const html = renderToStaticMarkup(createElement(Terminos));
  assert.match(html, new RegExp(`Responsable del servicio: <strong>${RAZON_SOCIAL_MAKO} \\(MaKo\\)</strong>`));
});

test('la razón social se escribe como en la verificación de Meta: apellido primero', () => {
  // Si alguien la «prolija» a «Leandro Martín Tejado Gonzalvez», a una persona le dice lo mismo
  // y al chequeo de Meta puede no: este test obliga a que el cambio sea a propósito.
  assert.equal(RAZON_SOCIAL_MAKO, 'Tejado Gonzalvez Leandro Martin');
});
