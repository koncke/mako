// =============================================================================
// Las landings de MaKo: UN diseño, ocho contenidos
// =============================================================================
// El LEEME de docs/tableros dice «las 7 que faltan se copian de la primera». Esto lo hace cumplir:
// el molde está una sola vez acá abajo y cada landing es sólo datos. Si hay que cambiar el diseño,
// se cambia en un lugar y salen las ocho iguales.
//
// ⚠️ REGLA, y me costó una landing entera aprenderla: NINGUNA FRASE SIN FUENTE. Cada afirmación de
// este archivo sale del código (lib/planes-mako.ts, lib/cobros.ts, …) o de docs/como-venden-otros.md.
// Lo que no se pueda sostener, no va. Una landing que promete lo que el producto no hace devuelve el
// reembolso dos semanas después, con la reseña puesta.
//
// ⚠️ Y el copy va en ESPAÑOL NEUTRO con «tú»: la audiencia es México. Se mide con `voseoEn` de
// lib/voseo.ts antes de publicar, no a ojo.
// =============================================================================
import { writeFileSync } from 'node:fs';

const USD_PRO = 97; // lib/planes-mako.ts, plan `pro`

// ─────────────────────────────────────────────────────────────────────────────
// EL MOLDE
// ─────────────────────────────────────────────────────────────────────────────
const ESTILO = `
:root{--fondo:#f6f5f2;--panel:#fff;--borde:#ddd9d1;--texto:#221f1a;--tenue:#56514a;--apagado:#938c80;--acento:#8a4b2a;--suave:#f3e7df;--bien:#1d6b3a;--mal:#9c2c2c;--sombra:0 1px 3px rgba(34,31,26,.08);--titulo:'Bitter',Georgia,serif;--cuerpo:'Source Sans 3',system-ui,sans-serif;--mono:'IBM Plex Mono',ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--fondo:#16140f;--panel:#201d17;--borde:#37332a;--texto:#ece7dd;--tenue:#bdb5a8;--apagado:#827a6d;--acento:#d98f62;--suave:#322319;--bien:#6fc08c;--mal:#e08585;--sombra:0 1px 3px rgba(0,0,0,.5);color-scheme:dark}}
:root[data-theme="dark"]{--fondo:#16140f;--panel:#201d17;--borde:#37332a;--texto:#ece7dd;--tenue:#bdb5a8;--apagado:#827a6d;--acento:#d98f62;--suave:#322319;--bien:#6fc08c;--mal:#e08585;--sombra:0 1px 3px rgba(0,0,0,.5);color-scheme:dark}
*{box-sizing:border-box}body{margin:0;background:var(--fondo);color:var(--texto);font-family:var(--cuerpo);font-size:17px;line-height:1.6}
.env{padding-left:max(18px,env(safe-area-inset-left,0px));padding-right:max(18px,env(safe-area-inset-right,0px));max-width:760px;margin:0 auto}
.ancho{max-width:960px}
section{padding-block:52px}
.hero{padding-block:62px 48px;text-align:center}
.ante{font-size:.88rem;font-weight:600;color:var(--acento);text-transform:uppercase;letter-spacing:.07em;margin:0 0 14px}
h1{font-family:var(--titulo);font-size:clamp(2rem,1.5rem + 2.6vw,3.1rem);font-weight:700;line-height:1.12;margin:0 0 18px;letter-spacing:-.02em;text-wrap:balance}
h1 em{font-style:normal;color:var(--acento)}
.bajada{font-size:clamp(1.05rem,1rem + .4vw,1.22rem);color:var(--tenue);margin:0 auto 30px;max-width:54ch;text-wrap:pretty}
h2{font-family:var(--titulo);font-size:clamp(1.4rem,1.2rem + .9vw,1.9rem);font-weight:700;margin:0 0 10px;letter-spacing:-.012em;text-wrap:balance}
h3{font-family:var(--titulo);font-size:1.12rem;font-weight:600;margin:0 0 6px}
.sec-sub{color:var(--tenue);margin:0 0 26px;max-width:58ch}
.centro{text-align:center}.centro .sec-sub{margin-left:auto;margin-right:auto}
.btn{display:inline-block;background:var(--acento);color:#fff;text-decoration:none;font-weight:700;font-size:1.05rem;padding:14px 32px;border-radius:10px;box-shadow:var(--sombra);transition:transform .12s}
.btn:hover{transform:translateY(-1px)}
.bajo-btn{font-size:.88rem;color:var(--apagado);margin-top:12px}
.franja{background:var(--panel);border-block:1px solid var(--borde)}
.chat{max-width:440px;margin:0 auto;background:var(--panel);border:1px solid var(--borde);border-radius:16px;padding:18px;box-shadow:var(--sombra)}
.msj{max-width:84%;padding:10px 14px;border-radius:14px;margin-bottom:9px;font-size:.96rem;line-height:1.45}
.ellos{background:var(--suave);color:var(--texto);border-bottom-left-radius:4px}
.mako{background:var(--acento);color:#fff;margin-left:auto;border-bottom-right-radius:4px}
.hora{font-size:.74rem;color:var(--apagado);display:block;margin-top:3px;font-family:var(--mono)}
.mako .hora{color:rgba(255,255,255,.75)}
.pie-chat{font-size:.84rem;color:var(--apagado);text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--borde)}
.cajas{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
.caja{background:var(--panel);border:1px solid var(--borde);border-radius:12px;padding:18px 20px;box-shadow:var(--sombra)}
.caja p{margin:0;color:var(--tenue);font-size:.97rem}
.vs{display:grid;grid-template-columns:1fr auto 1fr;gap:0;align-items:stretch;background:var(--panel);border:1px solid var(--borde);border-radius:12px;overflow:hidden;box-shadow:var(--sombra)}
.vs>div{padding:20px 22px}
.vs .medio{background:var(--borde);width:1px;padding:0}
.vs h3{margin-bottom:10px}
.vs .precio{font-family:var(--titulo);font-size:1.7rem;font-weight:700;display:block;margin-bottom:4px}
.vs .n-mal{color:var(--mal)}.vs .n-bien{color:var(--bien)}
.vs ul{margin:12px 0 0;padding-left:20px;color:var(--tenue);font-size:.95rem}
.vs li{margin-bottom:5px}
.vs .chico{color:var(--apagado);font-size:.9rem}
.q{border-bottom:1px solid var(--borde);padding:16px 0}
.q:last-child{border-bottom:0}
.q summary{cursor:pointer;font-weight:600;list-style:none;display:flex;justify-content:space-between;gap:12px;align-items:baseline}
.q summary::-webkit-details-marker{display:none}
.q summary::after{content:"+";color:var(--acento);font-weight:700;font-size:1.3rem;line-height:1}
.q[open] summary::after{content:"\\2212"}
.q p{margin:10px 0 0;color:var(--tenue);font-size:.97rem}
.no-es{background:var(--panel);border:1px solid var(--borde);border-left:4px solid var(--mal);border-radius:12px;padding:20px 22px}
.no-es ul{margin:10px 0 0;padding-left:20px;color:var(--tenue)}
.precio-caja{background:var(--panel);border:2px solid var(--acento);border-radius:16px;padding:28px;text-align:center;box-shadow:var(--sombra);max-width:420px;margin:0 auto}
.precio-caja .n{font-family:var(--titulo);font-size:3rem;font-weight:700;color:var(--acento);line-height:1;display:block}
.precio-caja .mes{color:var(--apagado);font-size:.95rem;display:block;margin-bottom:18px}
.precio-caja ul{text-align:left;color:var(--tenue);font-size:.96rem;margin:0 0 22px;padding-left:20px}
.precio-caja li{margin-bottom:6px}
footer{border-top:1px solid var(--borde);padding-block:28px;color:var(--apagado);font-size:.88rem;text-align:center}
.marca{font-family:var(--titulo);font-weight:700;color:var(--texto)}
@media (max-width:620px){.vs{grid-template-columns:1fr}.vs .medio{width:auto;height:1px}}
`.trim();

/** Lo que incluye el plan, TEXTUAL del `incluye` de `pro` y `esencial` en lib/planes-mako.ts. */
const INCLUYE = [
  'WhatsApp e Instagram en una sola bandeja',
  'Un tablero para ver en qué paso está cada cliente',
  'Seguimientos automáticos, sin tope',
  'Tu agenda, tus tareas y tus cobros',
  'Soporte en español, con personas',
];

/** El cierre es el mismo en las ocho: sin prueba gratis (PRUEBA_GRATIS_PRENDIDA = false). */
const LINEA_BOTON = 'Cancelas cuando quieras · Usas tu propia IA';

/** La sección del «traé tu IA», que es el hueco que nadie ocupa (docs/como-venden-otros.md). */
const BYOK = {
  h2: 'Y la parte que nadie te cuenta',
  h3: 'La inteligencia artificial la pones tú, y por eso el precio es este',
  p: 'Casi todas las herramientas de este tipo te revenden la IA con su margen encima y lo cargan al plan. MaKo se conecta a <b>tu</b> cuenta de Claude, de GPT o de Gemini: pagas el consumo real al proveedor, sin intermediario. Si ya tienes una cuenta, está listo. Si no, se conecta pegando una clave.',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (slug) =>
  'https://hola-mako.com/planes/pro?landing=' + slug + '&amp;funcionalidad=' + slug +
  '&amp;utm_source=instagram&amp;utm_medium=organico&amp;utm_campaign=' + slug;

function bloqueChat(chat) {
  const msjs = chat.mensajes.map((m) =>
    '      <div class="msj ' + (m.de === 'mako' ? 'mako' : 'ellos') + '">' + m.texto +
    '<span class="hora">' + m.hora + '</span></div>').join('\n');
  return [
    '<section class="franja">',
    '  <div class="env">',
    '    <div class="centro"><h2>' + chat.h2 + '</h2><p class="sec-sub">' + chat.sub + '</p></div>',
    '    <div class="chat">',
    msjs,
    '      <p class="pie-chat">' + chat.pie + '</p>',
    '    </div>',
    '  </div>',
    '</section>',
  ].join('\n');
}

function bloqueCajas(sec, franja) {
  const cajas = sec.cajas.map((c) =>
    '    <div class="caja"><h3>' + c.t + '</h3><p>' + c.p + '</p></div>').join('\n');
  const dentro = [
    '  <div class="centro"><h2>' + sec.h2 + '</h2>' + (sec.sub ? '<p class="sec-sub">' + sec.sub + '</p>' : '') + '</div>',
    '  <div class="cajas">',
    cajas,
    '  </div>',
  ].join('\n');
  return franja
    ? '<section class="franja">\n  <div class="env">\n' + dentro + '\n  </div>\n</section>'
    : '<section class="env">\n' + dentro + '\n</section>';
}

function bloqueVs(vs) {
  const li = (xs) => xs.map((x) => '          <li>' + x + '</li>').join('\n');
  return [
    '<section class="franja">',
    '  <div class="env ancho">',
    '    <div class="centro"><h2>' + vs.h2 + '</h2><p class="sec-sub">' + vs.sub + '</p></div>',
    '    <div class="vs">',
    '      <div>',
    '        <h3>' + vs.ellos.que + '</h3>',
    '        <span class="precio n-mal">' + vs.ellos.precio + '</span>',
    '        <span class="chico">' + vs.ellos.pie + '</span>',
    '        <ul>', li(vs.ellos.puntos), '</ul>',
    '      </div>',
    '      <div class="medio"></div>',
    '      <div>',
    '        <h3>MaKo</h3>',
    '        <span class="precio n-bien">US$' + USD_PRO + '</span>',
    '        <span class="chico">al mes, sin permanencia</span>',
    '        <ul>', li(vs.nosotros), '</ul>',
    '      </div>',
    '    </div>',
    '  </div>',
    '</section>',
  ].join('\n');
}

function bloqueFaq(faq) {
  const qs = faq.map((f) =>
    '  <details class="q"><summary>' + f.q + '</summary><p>' + f.a + '</p></details>').join('\n');
  return [
    '<section class="env">',
    '  <div class="centro"><h2>Preguntas que siempre aparecen</h2></div>',
    qs,
    '</section>',
  ].join('\n');
}

function bloqueNoEs(items) {
  return [
    '<section class="franja">',
    '  <div class="env">',
    '    <div class="no-es">',
    '      <h3>Para quién NO es</h3>',
    '      <ul>',
    items.map((x) => '        <li>' + x + '</li>').join('\n'),
    '      </ul>',
    '    </div>',
    '  </div>',
    '</section>',
  ].join('\n');
}

function armar(p) {
  const partes = [
    '<!doctype html>',
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<title>' + esc(p.titulo) + ' — MaKo</title>',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bitter:wght@600;700&family=Source+Sans+3:wght@400;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap">',
    '<style>', ESTILO, '</style>', '',
    '<section class="hero env">',
    '  <p class="ante">' + p.para + '</p>',
    '  <h1>' + p.h1 + '</h1>',
    '  <p class="bajada">' + p.bajada + '</p>',
    '  <a class="btn" href="#precio">Empezar ahora</a>',
    '  <p class="bajo-btn">' + LINEA_BOTON + '</p>',
    '</section>', '',
  ];
  if (p.chat) partes.push(bloqueChat(p.chat), '');
  if (p.muestra) partes.push(bloqueCajas(p.muestra, true), '');
  partes.push(bloqueCajas(p.duele, false), '');
  if (p.vs) partes.push(bloqueVs(p.vs), '');
  partes.push(bloqueCajas(p.control, false), '');
  partes.push(
    '<section class="franja">',
    '  <div class="env">',
    '    <div class="centro"><h2>' + BYOK.h2 + '</h2></div>',
    '    <div class="caja" style="border-left:4px solid var(--acento)">',
    '      <h3>' + BYOK.h3 + '</h3>',
    '      <p>' + BYOK.p + '</p>',
    '    </div>',
    '  </div>',
    '</section>', '');
  partes.push(bloqueFaq(p.faq), '');
  partes.push(bloqueNoEs(p.noEs), '');
  partes.push(
    '<section class="env centro" id="precio">',
    '  <h2>MaKo Pro</h2>',
    '  <p class="sec-sub">' + p.cierre + '</p>',
    '  <div class="precio-caja">',
    '    <span class="n">US$' + USD_PRO + '</span>',
    '    <span class="mes">al mes · sin permanencia</span>',
    '    <ul>',
    INCLUYE.map((x) => '      <li>' + x + '</li>').join('\n'),
    '    </ul>',
    '    <a class="btn" href="' + link(p.slug) + '">Empezar ahora</a>',
    '    <p class="bajo-btn">' + LINEA_BOTON + '</p>',
    '  </div>',
    '</section>', '',
    '<footer class="env">',
    '  <p><span class="marca">MaKo</span> · hola-mako.com</p>',
    '</footer>', '');
  return partes.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOS CONTENIDOS
// ─────────────────────────────────────────────────────────────────────────────
export const LANDINGS = [];

export function generar(dir) {
  const hechas = [];
  for (const p of LANDINGS) {
    const ruta = dir + '/landing-' + p.slug + '.html';
    writeFileSync(ruta, armar(p));
    hechas.push(p.slug);
  }
  return hechas;
}

export { armar };
