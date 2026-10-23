// =============================================================================
// landing-marco — ¿esta página se deja mostrar ADENTRO de una página de MaKo?
// =============================================================================
// El Diagnóstico muestra una landing de afuera en un iframe. Si el documento aislado no pinta (una
// landing armada en un constructor la dibuja su propio JavaScript), el recuadro cae a la página REAL
// (app/web-generator/diagnostico/VistaAfuera.tsx). Eso sólo se ve si la página se deja embeber: con
// `X-Frame-Options` o `frame-ancestors` el navegador dibuja un recuadro vacío, y el aviso decía «se
// muestra la página real» sobre un blanco. Lo que el navegador va a hacer lo dicen las CABECERAS de la
// respuesta, que el server ya tiene en la mano porque baja la página (lib/landing-fetch.ts,
// `paginaParaVer`): se deciden acá, puras y con test (tests/landing-marco.test.ts).
//
// Las reglas son las del navegador, no las de un tutorial:
//   · `frame-ancestors` (CSP) MANDA: si alguna política de la respuesta lo trae, `X-Frame-Options` se
//     ignora (CSP Level 2 §7.7.1). Cada política se cumple por separado, así que basta con una que no
//     nombre a MaKo para que no se vea.
//   · `X-Frame-Options`: DENY y SAMEORIGIN no dejan (MaKo nunca es el mismo origen que la landing);
//     ALLOW-FROM está obsoleto y Chrome lo trata como inválido, o sea que NO bloquea.
//   · `Content-Security-Policy-Report-Only` no bloquea nada y no se mira.
//   · Las de un `<meta http-equiv>` no cuentan para el marco (el navegador las ignora para esto).
// =============================================================================

/** Lo que dice una respuesta sobre el marco: las dos cabeceras crudas (null si no vinieron). */
export type CabecerasDeMarco = { xfo: string | null; csp: string | null };

/** El host de una fuente de `frame-ancestors` contra el de MaKo (`*.dominio` no incluye al dominio pelado). */
function hostCoincide(patron: string, host: string): boolean {
  if (patron === '*') return true;
  if (patron.startsWith('*.')) return host.endsWith(patron.slice(1));
  return patron === host;
}

/** ¿La fuente de `frame-ancestors` deja que `origen` (https://hola-mako.com) embeba la página? */
function fuenteDeja(fuente: string, origen: URL): boolean {
  const f = fuente.trim().toLowerCase();
  if (!f || f === "'none'" || f === "'self'") return false;     // 'self' es la landing, nunca MaKo
  if (f === '*') return origen.protocol === 'https:' || origen.protocol === 'http:';
  if (/^[a-z][a-z0-9+.-]*:$/.test(f)) return f === origen.protocol; // una fuente de esquema: `https:`
  if (f.startsWith("'")) return false;                           // 'unsafe-inline', un hash: no son de marco
  const m = /^(?:([a-z][a-z0-9+.-]*):\/\/)?([^/:]+)(?::(\d+|\*))?(?:\/.*)?$/.exec(f);
  if (!m) return false;
  const [, esquema, host, puerto] = m;
  if (esquema && `${esquema}:` !== origen.protocol) return false;
  if (!hostCoincide(host, origen.hostname)) return false;
  if (puerto && puerto !== '*') {
    const nuestro = origen.port || (origen.protocol === 'https:' ? '443' : '80');
    if (puerto !== nuestro) return false;
  }
  return true;
}

/**
 * ¿El navegador va a mostrar esta página adentro de una página de `origen`? `true` sí, `false` no.
 * Cabeceras repetidas llegan unidas por coma (Node las junta así), y una política de CSP no lleva comas
 * adentro: la coma separa políticas.
 */
export function dejaEmbeberse(cab: CabecerasDeMarco, origen: string): boolean {
  let o: URL;
  try { o = new URL(origen); } catch { return false; }
  const politicas = String(cab.csp ?? '').split(',').map((p) => p.trim()).filter(Boolean);
  let hayFrameAncestors = false;
  for (const p of politicas) {
    for (const dir of p.split(';')) {
      const partes = dir.trim().split(/\s+/).filter(Boolean);
      if (partes[0]?.toLowerCase() !== 'frame-ancestors') continue;
      hayFrameAncestors = true;
      if (!partes.slice(1).some((s) => fuenteDeja(s, o))) return false;
      break; // sólo cuenta la primera aparición de la directiva en una política
    }
  }
  if (hayFrameAncestors) return true;
  const xfo = String(cab.xfo ?? '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  return !xfo.some((v) => v === 'deny' || v === 'sameorigin');
}
