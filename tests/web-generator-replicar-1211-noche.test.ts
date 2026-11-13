// =============================================================================
// Lo que pidió el Cerebro después de mirar las capturas de la prueba del 12/11/2026 (noche)
// =============================================================================
// «La réplica no se parece al original» (la masterclass de clase.highticketclarity.com) y sus decisiones:
//   1. de un outlier sale la ADAPTADA directo (estructura y diseño de la original, contenido del negocio);
//   2. sin «Tu oferta», la oferta principal del negocio (como Copywriting e Image);
//   3. el lector del servidor ve lo que antes perdía: `section.tint`, las tarjetas repetidas, las fotos en base64, el video;
//   4. ninguna cifra inventada, en la réplica y en el chat de editar (las dos capas de Copywriting);
//   5. la publicada con sólo el CSS que usa, caché en el borde y «Abrir» con `?v=`;
//   6. la plantilla del quiz se ve entera.
// Correr: node --import tsx --test tests/web-generator-replicar-1211-noche.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rutaReplicarLanding } from '../app/web-generator/portada-reglas';
import { derechaDeQuery } from '../app/web-generator/panel-reglas';
import { textoDeOferta } from '../lib/editor-landing/replicar-partes';
import { estiloDeHtml } from '../lib/editor-landing/estilo-original';
import { acomodoDeSeccion, disposicionPorSeccion } from '../lib/editor-landing/replicar-estructura';
import { avisoDeCifras, cifrasSinRespaldo } from '../lib/editor-landing/ia-reglas';
import { podarCss, usadasDe } from '../lib/editor-landing/css-usado';
import { conVersion } from '../lib/editor-landing/doc';
import { QUIZ_DE_PLANTILLA } from '../lib/editor-landing/plantillas';
import { quizListo } from '../lib/editor-landing/quiz';

const fuente = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');

test('1. de un outlier sale la ADAPTADA directo: la ruta, la consulta y el arranque solo', () => {
  assert.equal(rutaReplicarLanding('https://clase.highticketclarity.com/'), '/web-generator?replicar=https%3A%2F%2Fclase.highticketclarity.com%2F&adaptar=1');
  assert.deepEqual(derechaDeQuery({ replicar: 'https://clase.highticketclarity.com/', adaptar: '1' }, [], []),
    { tipo: 'replicar', url: 'https://clase.highticketclarity.com/', auto: true, adaptar: true });
  assert.deepEqual(derechaDeQuery({ replicar: 'https://x.com/' }, [], []), { tipo: 'replicar', url: 'https://x.com/', auto: true }, 'Spy y la extensión, como siempre');
  const rep = fuente('app/web-generator/crear/Replicar.tsx');
  assert.match(rep, /if \(!auto \|\| !adaptarInicial \|\| replicadaSola\.current \|\| retomado \|\| replicando \|\| lectura\.fase !== 'leida'\) return;\s*replicadaSola\.current = true;\s*replicarLeidaViva\.current\('landing'\);/);
});

test('2. sin «Tu oferta», la principal del negocio (y la lectura dice cuál)', () => {
  assert.equal(textoDeOferta({ nombre: 'MaKo Acelerador', promesa: 'Tu negocio en piloto automático', para_quien: 'coaches', precio_usd: 997, precio_nota: 'un pago', garantia: null }),
    'MaKo Acelerador; promesa: Tu negocio en piloto automático; para: coaches; precio: US$997 (un pago)');
  assert.equal(textoDeOferta({ nombre: '  ' }), '');
  assert.equal(textoDeOferta(null), '');
  assert.match(fuente('lib/editor-landing/replicar.ts'), /if \(!partes\.texto && !entrada\.oferta\?\.trim\(\)\) \{\s*const principal = await ofertaPrincipalParaReplica\(\);/);
  assert.match(fuente('lib/editor-landing/replicar-lectura.ts'), /tieneOferta: perfil\.replace\(\/\\s\+\/g, ' '\)\.trim\(\)\.length >= 30 \|\| !!principal,/);
});

test('3. el lector del servidor: selectores compuestos, tarjetas, fotos en base64 y el video', () => {
  const html = `<html><head><style>:root{--crema:#FAF7EE}html,body{background:#fff}section.tint{background:var(--crema)}.sec.tint.oscura{background:#111111}</style></head><body>
    <header class="hero"><h1>Imaginá agregar 10K</h1><div class="hero-video"><video src="v.mp4"></video></div></header>
    <section class="sec"><h2>Qué vas a ver</h2><ol class="steps"><li class="step"><h3>Uno</h3><p>a</p></li><li class="step"><h3>Dos</h3><p>b</p></li><li class="step"><h3>Tres</h3><p>c</p></li></ol></section>
    <section class="sec tint quien"><div class="foto"><img src="data:image/jpeg;base64,AAAA" width="600" height="700" alt="Clara"></div><div class="txt"><h2>Quién es Clara</h2><ul><li>x</li><li>y</li><li>z</li></ul></div></section>
    <section class="sec"><h2>Casos</h2><div class="grid"><article class="caso"><img src="data:image/jpeg;base64,BB" width="600" height="700" alt="a"><p class="k">1</p></article><article class="caso"><img src="data:image/jpeg;base64,CC" width="600" height="700" alt="b"><p class="k">2</p></article><article class="caso"><img src="data:image/jpeg;base64,DD" width="600" height="700" alt="c"><p class="k">3</p></article></div></section>
    <section class="sec tint oscura"><h2>Oscura</h2></section>
  </body></html>`;
  const e = estiloDeHtml(html, 'https://x.com/', []);
  const por = (t: string) => e.secciones.find((s) => s.titulo.startsWith(t));
  assert.equal(por('Imaginá')?.video, true, 'el video del hero');
  assert.deepEqual(por('Qué vas')?.tarjetas, { cantidad: 3, conFoto: false }, 'los pasos son tarjetas');
  assert.equal(por('Quién es')?.fondo, '#faf7ee', '`section.tint` con su variable');
  assert.equal(por('Quién es')?.fotos, 1, 'la foto de ANTES del título es de esa parte');
  assert.equal(por('Quién es')?.tarjetas, undefined, 'tres <li> sin clase no son tarjetas');
  assert.deepEqual(por('Casos')?.tarjetas, { cantidad: 3, conFoto: true });
  assert.equal(por('Oscura')?.fondo, '#111111', 'el compuesto más específico gana');
  assert.equal(e.imagenes.length, 0, 'las base64 no se copian');
  const molde = { titulo: 'x', subtitulos: 0, parrafos: 3, vinetas: 0, botones: 0, desplegables: 0, palabras: 10 };
  const hero = e.secciones.findIndex((s) => s.titulo.startsWith('Imaginá'));
  const casos = e.secciones.findIndex((s) => s.titulo === 'Casos');
  const disp = disposicionPorSeccion([[hero], [casos]], e.secciones);
  assert.match(acomodoDeSeccion(molde, null, disp[0]), /un video junto al texto/);
  assert.equal(acomodoDeSeccion(molde, null, disp[1]), '3 tarjetas en grilla, ni una más ni una menos, cada una con el hueco de su foto');
  assert.match(fuente('lib/editor-landing/replicar.ts'), /const conFotosAjenas = partes\.texto;\s*const ws = conFotosAjenas && estilo\?\.imagenes\.length \?/, 'la adaptada no sube fotos de la otra');
});

test('4. ninguna cifra inventada: la regla en el chat de editar y el aviso, en el chat y en la réplica', () => {
  const escrito = 'Martín lleva más de 10 años en negocios online. Acompañó a más de 50 negocios high ticket, +192.000 seguidores y un 73% más. Tres pasos en 30 días.';
  const cifras = cifrasSinRespaldo(escrito, 'MaKo: CRM y WhatsApp. US$97 por mes.');
  for (const c of ['73%', '+192.000', 'más de 10', 'más de 50']) assert.ok(cifras.some((x) => x.includes(c)), `«${c}» sin respaldo: ${cifras.join(' | ')}`);
  assert.ok(!cifras.some((x) => /30 días|Tres pasos/.test(x)), 'las cantidades de la estructura no');
  assert.deepEqual(cifrasSinRespaldo('Más de 50 negocios y 73% de retención', 'Acompañamos a más de 50 negocios con 73% de retención'), [], 'con respaldo en el negocio, nada');
  assert.equal(avisoDeCifras([]), '');
  assert.match(avisoDeCifras(['73%']), /^Tiene cifras que no salen de tu negocio \(73%\)/);
  const ia = fuente('lib/editor-landing/ia.ts');
  assert.match(ia, /\+ `\\n\$\{REGLA_CIFRAS_DEL_NEGOCIO\}`,/);
  assert.match(ia, /resumen: \[hay \? resumenModelo \|\| 'Listo\.' : 'Sin cambios\.', \.\.\.noSePudo, avisoDeCifras\(sinRespaldo\)\]\.filter\(Boolean\)\.join\(' '\),/);
  assert.match(fuente('lib/editor-landing/replicar.ts'), /avisoDeCifras\(cifrasAjenas\),/);
});

test('5. la publicada: sólo el CSS que usa (y lo que prenden sus scripts), caché en el borde y «Abrir» con ?v=', () => {
  const html = '<div class="gm-doc"><section class="gm-tarjeta" data-variante="tarjetas"><p class="gm-x">x</p></section></div><script>el.classList.add(\'gm-visto\'); el.setAttribute(\'data-pausado\', \'1\')</script>';
  const css = [
    ':root{--a:1}', 'body{margin:0}', '.gm-doc .gm-tarjeta{padding:1px}', '.gm-otro{color:red}', '.gm-otro,.gm-x{color:blue}',
    '.gm-tarjeta[data-variante="tarjetas"]{gap:1px}', '.gm-tarjeta[data-variante="grilla"]{gap:2px}', '[data-dispositivo="movil"] .gm-x{font-size:1px}',
    '.gm-x:not(.gm-nadie){top:0}', 'html.gm-visto .gm-x{opacity:1}', '[data-pausado="1"] .gm-x{x:1}',
    '@media (max-width:600px){.gm-otro{a:1}.gm-x{b:1}}', '@media print{.gm-otro{a:1}}', '@keyframes gm-sube{from{opacity:0}to{opacity:1}}',
    '@font-face{font-family:X;src:url(x.woff2)}', '/* fuera */',
  ].join('\n');
  const out = podarCss(css, usadasDe(html));
  for (const queda of [':root{--a:1}', 'body{margin:0}', '.gm-doc .gm-tarjeta{', '.gm-otro,.gm-x{', '[data-variante="tarjetas"]', '.gm-x:not(.gm-nadie)', 'html.gm-visto', '[data-pausado="1"]', '@media (max-width:600px){.gm-x{b:1}}', '@keyframes gm-sube', '@font-face']) {
    assert.ok(out.includes(queda), `queda ${queda}`);
  }
  for (const va of ['.gm-otro{color:red}', 'data-variante="grilla"', 'data-dispositivo', '@media print', '/* fuera */']) assert.ok(!out.includes(va), `se va ${va}`);
  const pub = fuente('lib/editor-landing/pagina-publica.ts');
  assert.match(pub, /const usadas = usadasDe\(\[e\.html, \.\.\.cola, \.\.\.head\]\.join\('\\n'\)\);\s*head\[lugarHoja\] = `<style>\$\{podarCss\(/);
  assert.match(pub, /export const CACHE_BORDE = 's-maxage=30, stale-while-revalidate=300';/);
  assert.match(pub, /if \(modo === 'publico'\) comunes\['Vercel-CDN-Cache-Control'\] = CACHE_BORDE;/);
  assert.equal(conVersion('https://hola-mako.site/x', 'abc'), 'https://hola-mako.site/x?v=abc');
  assert.equal(conVersion('https://hola-mako.site/x?a=1#b', '2026-11-12T10:00:00.000Z'), 'https://hola-mako.site/x?a=1&v=2026-11-12T100000.000Z#b');
  assert.equal(conVersion('https://hola-mako.site/x', null), 'https://hola-mako.site/x');
});

test('6. la plantilla del quiz se ve entera en la publicada (no más «Empieza aquí» vacía)', () => {
  assert.equal(quizListo(QUIZ_DE_PLANTILLA), true);
  assert.equal(QUIZ_DE_PLANTILLA.preguntas.length, 3);
  assert.equal(QUIZ_DE_PLANTILLA.resultados.length, 3);
});
