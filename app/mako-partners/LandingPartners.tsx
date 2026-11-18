// =============================================================================
// LandingPartners — la página de MaKo Partners, la que VENDE el programa (24/10/2026; rehecha el 25/10/2026; el 30% de por
// vida, 18/11/2026)
// =============================================================================
// EL PROGRAMA NUEVO (18/11/2026, Martín por el Cerebro: «Me gusta la misma… solamente calculado a esto»): MISMA página, mismo
// diseño y mismo orden, recalculada. Se acabó el «100% del primer mes»: el partner se lleva un porcentaje de CADA pago de cada
// negocio que trae, todos los meses: SIEMPRE el 30% (desde las ~18:50 UTC del 18/11, pague como pague el negocio; si paga por
// pasarela, el recargo se le suma a él en el checkout). El porcentaje es del chat de Cobros (`COMISION_PARTNER_DIRECTO`,
// lib/partners-reglas.ts) y la cuenta, ./numeros.ts; acá no se escribe ninguno. «¿Cuándo cobro?» dice «cada pago» y no promete fecha: la acreditación por pago
// la está haciendo Cobros. Se paga del 1 al 5 del mes siguiente, en dólares por Binance o en pesos por transferencia.
//
// LO DE ANTES (25/10/2026):
// La dibujan la página pública (app/mako-partners/page.tsx) y, adentro de la app, /partners mientras el negocio NO se hizo
// partner (y con «Ver la landing» después). Martín, 25/10: «Elimina lo de "gana meses de tu plan", que solo ganen direro y
// listo... No pongas al programa de 1500... Hazlo más marketinero la landing, literalmente se llevan el 100% de lo que
// venden. La calculadora ponlo en dode hoy está "Si se suscribe". Y solo la parte azul. Elimina la sección de "Cómo
// funciona" y "Por ahora MaKo da de alta a mano". Revisa las preguntas frecuentes... Ya no hay "meses" ni "devolución"...
// Si pueden hacer ads que digan "mako", no aclares eso... Elimina lo de "Si llegó con varios links, vale el primero."... Se
// mas claro y marketinero».
//
// EL ORDEN: el título con el porcentaje y la calculadora azul al lado (Calculadora.tsx), tres números grandes, las preguntas y
// el cierre. COPIADO DE (mirados el 24 y el 25/10): LLM Pulse (llmpulse.ai/affiliate) para el hero con la calculadora; Tolt
// (tolt.com/platform/affiliate-portal) para decir lo que gana el partner en números grandes; systeme.io para las preguntas
// cortas. Lo que NO se tomó: los testimonios (hoy no hay partners que hayan cobrado, y uno inventado no se publica).
//
// ⚠️ SÓLO LO QUE PASA (24/10, el Cerebro: «la página de Partners no promete nada que no vayamos a cumplir»): lo transfiere
// MaKo. Los números salen de los planes y de las reglas, nunca escritos a mano.
//
// LOS DOS MODOS: `publica` (colores fijos de la página de venta, la barra de la app escondida) y `app` (los tokens de la
// app: cambia con el tema oscuro y el Nord; la barra queda). La acción es UNA y es un link: hacerse partner (el onboarding
// corto de /partners) o, para quien ya lo es, volver a su panel.
// =============================================================================

import type { ReactNode } from 'react';
import Link from 'next/link';
import { COMISION_PARTNER_DIRECTO, RUTA_ALTA_PARTNERS } from '@/lib/partners-reglas';
import { PLANES_MAKO_DEFAULT } from '@/lib/planes-mako';
import { Calculadora } from './Calculadora';
import { PORCENTAJE_DIRECTO, gananciaPorMes, porcentaje, usd } from './numeros';
import { COMPARACION, COMPARACION_CON, COMPARACION_LEIDA } from './comparacion';
import { TarjetasVs } from '@/app/vsl/_sitio/Comparaciones';
import { MARCA } from '@/lib/tutoriales/marcas';
import { INDUSTRIAS } from '@/app/vsl/_sitio/datos';
import { CSS_BASE, CSS_COMPARACIONES, CSS_REEMPLAZA } from '@/app/vsl/_sitio/estilos';

const CSS = `
.mp-root { --mp-ink: #12151B; --mp-dim: #4A5260; --mp-suave: #5B6472; --mp-borde: #E6EAF2; --mp-sup: #FFFFFF; --mp-gris: #F6F8FB;
  --mp-azul: #2F6FED; --mp-azul-osc: #1F4FC2; --mp-azul-bg: #EEF3FE; --mp-sobre-azul: #FFFFFF; --mp-bien: #1F9D55;
  color: var(--mp-ink); font: 400 16px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.mp-root.mp-app { --mp-ink: var(--ink); --mp-dim: var(--dim); --mp-suave: var(--dim); --mp-borde: var(--border); --mp-sup: var(--surface);
  --mp-gris: var(--surface-2); --mp-azul: var(--primary); --mp-azul-osc: color-mix(in srgb, var(--primary) 78%, #000); --mp-azul-bg: var(--primary-bg);
  --mp-sobre-azul: var(--on-primary, #fff); --mp-bien: var(--good); font: inherit; }
body:has(.mp-publica) aside { display: none !important; }
body:has(.mp-publica) { background: #FFFFFF; }
.mp-wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; box-sizing: border-box; }
.mp-app .mp-wrap { padding: 0; }
.mp-barra { display: flex; justify-content: space-between; align-items: center; padding: 20px 0; }
.mp-marca { font-weight: 800; font-size: 17px; color: var(--mp-azul); text-decoration: none; }
.mp-barra a.mp-entrar { color: var(--mp-ink); font-weight: 600; font-size: 14px; text-decoration: none; }
.mp-hero { background: radial-gradient(1100px 480px at 90% -10%, color-mix(in srgb, var(--mp-azul) 18%, transparent), transparent 60%),
  linear-gradient(180deg, var(--mp-azul-bg) 0%, var(--mp-sup) 100%); padding: 8px 0 64px; }
.mp-app .mp-hero { border: 1px solid var(--mp-borde); border-radius: 24px; padding: 8px 32px 36px; margin: 4px 0 8px; }
.mp-hero-grilla { display: grid; grid-template-columns: 1.15fr 1fr; gap: 44px; align-items: center; padding-top: 36px; }
.mp-ceja { display: inline-block; font-size: 12.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--mp-azul);
  background: color-mix(in srgb, var(--mp-azul) 11%, transparent); padding: 6px 12px; border-radius: 999px; }
.mp-hero h1 { margin: 16px 0 14px; font-size: 52px; line-height: 1.04; letter-spacing: -.035em; font-weight: 800; color: var(--mp-ink); }
.mp-app .mp-hero h1 { font-size: 44px; }
.mp-hero h1 em { font-style: normal; color: var(--mp-azul); }
.mp-bajada { margin: 0 0 26px; font-size: 18.5px; color: var(--mp-dim); max-width: 540px; }
.mp-bajada b { color: var(--mp-ink); }
.mp-junto { white-space: nowrap; }
.mp-acciones { display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
.mp-btn { display: inline-block; border: 0; cursor: pointer; font: inherit; background: var(--mp-azul); color: var(--mp-sobre-azul) !important;
  text-decoration: none; font-weight: 700; font-size: 17px; padding: 16px 28px; border-radius: 12px; text-transform: uppercase; letter-spacing: .04em;
  box-shadow: 0 10px 26px color-mix(in srgb, var(--mp-azul) 32%, transparent); transition: transform .15s ease, box-shadow .15s ease; }
.mp-btn:hover { transform: translateY(-1px); box-shadow: 0 14px 30px color-mix(in srgb, var(--mp-azul) 36%, transparent); }
.mp-calc { border-radius: 24px; padding: 26px 26px 24px; color: var(--mp-sobre-azul);
  background: radial-gradient(420px 220px at 100% 0%, rgba(255,255,255,.16), transparent 70%), linear-gradient(140deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%);
  box-shadow: 0 26px 60px color-mix(in srgb, var(--mp-azul) 34%, transparent); }
/* La calculadora (18/11/2026, Martín: «que sea mucho más claro… siento que hay como muchos botones»): UN control (cuántos negocios),
   el resultado como lo que más se ve y el botón. Nada más. */
.mp-calc-fila { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 22px; }
.mp-calc-fila label { font-weight: 700; font-size: 18px; }
.mp-calc-n { font-size: 40px; line-height: 1; font-weight: 800; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.mp-calc-barra { --mp-lleno: 8%; width: 100%; margin: 16px 0 0; height: 8px; border-radius: 999px; appearance: none; -webkit-appearance: none; cursor: pointer;
  background: linear-gradient(90deg, var(--mp-sobre-azul) var(--mp-lleno), rgba(255,255,255,.28) var(--mp-lleno)); }
.mp-calc-barra::-webkit-slider-thumb { -webkit-appearance: none; width: 24px; height: 24px; border-radius: 50%; background: var(--mp-sobre-azul);
  border: 3px solid var(--mp-azul-osc); box-shadow: 0 2px 10px rgba(0,0,0,.25); }
.mp-calc-barra::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--mp-sobre-azul); border: 3px solid var(--mp-azul-osc); }
.mp-calc-barra:focus-visible { outline: 2px solid var(--mp-sobre-azul); outline-offset: 6px; }
/* Los dos planes, DOS botones uno al lado del otro (18/11/2026, Martín: «el que esté seleccionado que se note, y el otro más
   apagado»). Sobre el azul de la calculadora, el elegido va BLANCO con el texto azul y una sombra suave (un relleno azul se perdía
   en el fondo azul); el otro, transparente, con el texto blanco atenuado y un borde fino, y se aviva al pasar el mouse. El cambio es
   una transición corta. */
.mp-calc-alts { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.mp-calc-alt { display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 52px; padding: 8px; border-radius: 14px;
  cursor: pointer; font: inherit; text-align: center; color: rgba(255,255,255,.72); background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.3); box-shadow: none; container-type: inline-size; -webkit-tap-highlight-color: transparent;
  transition: background .18s ease, color .18s ease, border-color .18s ease, box-shadow .18s ease, transform .12s ease; }
.mp-calc-alt:hover { color: var(--mp-sobre-azul); background: rgba(255,255,255,.16); border-color: rgba(255,255,255,.55); }
.mp-calc-alt:active { transform: scale(.98); }
.mp-calc-alt.elegido { color: var(--mp-azul-osc); background: var(--mp-sobre-azul); border-color: var(--mp-sobre-azul);
  box-shadow: 0 8px 20px rgba(0,0,0,.2); }
.mp-calc-alt:focus-visible { outline: 2px solid var(--mp-sobre-azul); outline-offset: 3px; }
/* Una línea, en semibold el elegido: 15–17 px, siguiendo el ancho del botón. Si «MaKo Essential: US$ 47» no entra, va el corto. */
.mp-calc-alt-largo, .mp-calc-alt-corto { font-size: clamp(14px, calc(100cqi / 11.4), 17px); font-weight: 500; line-height: 1.2; white-space: nowrap; }
.mp-calc-alt.elegido .mp-calc-alt-largo, .mp-calc-alt.elegido .mp-calc-alt-corto { font-weight: 600; }
.mp-calc-alt-corto { display: none; }
@container (max-width: 172px) { .mp-calc-alt-largo { display: none; } .mp-calc-alt-corto { display: inline; } }
@media (prefers-reduced-motion: reduce) { .mp-calc-alt { transition: none; } }
/* En el teléfono, el nombre corto: «Pro: US$ 97» / «Essential: US$ 47». */
@media (max-width: 479px) {
  .mp-calc-alt-largo { display: none; }
  .mp-calc-alt-corto { display: inline; font-size: clamp(14px, calc(100cqi / 9), 16px); }
}
.mp-calc-res { margin: 18px 0 22px; container-type: inline-size; }
/* El precio en UNA línea con «al mes» al final, más chico; la letra sigue el ancho del recuadro (cqi) para que el monto más largo
   («US$ 1.367,70 al mes») entre sin partirse. */
.mp-calc-monto { font-size: min(64px, calc(100cqi / 7.6)); line-height: 1; font-weight: 800; letter-spacing: -.045em; font-variant-numeric: tabular-nums;
  white-space: nowrap; }
.mp-calc-monto span { font-size: .34em; font-weight: 700; letter-spacing: 0; opacity: .9; }
.mp-calc-anio { margin-top: 10px; font-size: 17px; font-weight: 600; opacity: .9; font-variant-numeric: tabular-nums; }
.mp-calc .mp-btn { background: var(--mp-sobre-azul); color: var(--mp-azul-osc) !important; box-shadow: none; width: 100%; text-align: center; box-sizing: border-box; }
.mp-seccion { padding: 72px 0; }
.mp-app .mp-seccion { padding: 44px 0 8px; }
.mp-seccion h2 { margin: 10px 0 10px; font-size: 36px; line-height: 1.12; letter-spacing: -.025em; text-align: center; font-weight: 800; color: var(--mp-ink); }
.mp-app .mp-seccion h2 { font-size: 30px; }
.mp-sub { margin: 0 auto 30px; max-width: 600px; text-align: center; color: var(--mp-suave); font-size: 17px; }
.mp-numeros { list-style: none; margin: 0; padding: 0; display: grid; gap: 16px; grid-template-columns: repeat(3, 1fr); }
.mp-numero { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 22px; padding: 28px 24px 24px; }
.mp-numero b { display: block; font-size: 54px; line-height: 1; font-weight: 800; letter-spacing: -.04em; color: var(--mp-azul); margin-bottom: 12px; }
.mp-numero span { display: block; font-size: 16px; color: var(--mp-dim); }
.mp-numero strong { color: var(--mp-ink); }
.mp-numero .mp-numero-t { margin-bottom: 4px; font-size: 19px; line-height: 1.25; font-weight: 800; color: var(--mp-ink); }
/* «Cuánto te llevas según cómo pagan»: dos tarjetas; la de transferencia, destacada sin gritar. */
/* El carrusel en Partners: la variante clara de la portada, sin su relleno de sección, con el ícono del rubro en un recuadro. */
.mp-tira.s-reemplaza-claro { padding: 8px 0 24px; background: transparent; }
.mp-tira .s-tira-r { color: var(--mp-suave); }
.mp-tira .s-tira-i { color: var(--mp-ink); font-size: 22px; }
.mp-tira-ic { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; color: var(--mp-azul);
  background: var(--mp-azul-bg); }
/* Aire entre el título de una sección y sus tarjetas (sin bajada en medio). */
.mp-seccion h2 + .mp-numeros, .mp-seccion h2 + .mp-pasos { margin-top: 28px; }
/* «¿Por qué ser partner de MaKo te conviene?»: «te conviene» con el degradé de la marca; las mismas tarjetas que «Así de simple»,
   2 × 2, con el ícono en un recuadro (sin línea punteada); y debajo, la tabla contra GoHighLevel. */
.mp-conviene { font-style: normal; font-weight: 900; color: var(--mp-azul);
  background: linear-gradient(90deg, var(--mp-azul-osc) 0%, var(--mp-azul) 55%, color-mix(in srgb, var(--mp-azul) 70%, #22B8F0) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.mp-pasos.mp-ventajas { grid-template-columns: repeat(2, 1fr); gap: 16px; }
.mp-ventajas .mp-paso::after { display: none; }
.mp-paso > .mp-ventaja-ic { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-bottom: 10px; border-radius: 12px;
  color: var(--mp-azul); background: var(--mp-azul-bg); }
.mp-ventaja-ic svg { width: 24px; height: 24px; }
/* LA sección fuerte: más aire, el título más grande, seis tarjetas 3 × 2. */
.mp-seccion.mp-conviene-sec { padding: 112px 0 104px; }
.mp-seccion.mp-conviene-sec h2 { font-size: 46px; }
.mp-conviene-sec h2 + .mp-pasos { margin-top: 40px; }
.mp-conviene-sec .mp-pasos.mp-ventajas { grid-template-columns: repeat(3, 1fr); gap: 20px; }
/* La comparación del sitio (TarjetasVs) adentro de la landing: sin su banda lavanda ni su relleno de página, la tarjeta a lo ancho. */
.mp-vs.s-sitio { min-height: 0; background: transparent; overflow-x: visible; margin-top: 48px; }
.mp-vs .s-cv { background: transparent; padding: 0; }
.mp-vs .s-cont { max-width: 860px; padding: 0; }
.mp-vs .s-cv-grilla { margin-top: 0; grid-template-columns: minmax(0, 1fr); }
.mp-vs .s-mx-fecha { margin-top: 14px; font-size: 13px; line-height: 18px; color: #6B7280; text-align: center; }
/* «Así de simple»: profundidad suave (borde fino, sombra y un degradé muy leve de la marca), el número en un círculo, un ícono, y en
   la computadora la línea punteada que une los pasos (en el hueco entre tarjetas). */
.mp-pasos { list-style: none; margin: 0; padding: 0; display: grid; gap: 28px; grid-template-columns: repeat(3, 1fr); }
.mp-paso { position: relative; display: flex; flex-direction: column; gap: 6px; padding: 24px 24px 26px; border-radius: 22px; border: 1px solid var(--mp-borde);
  background: linear-gradient(180deg, color-mix(in srgb, var(--mp-azul) 7%, var(--mp-sup)) 0%, var(--mp-sup) 75%);
  box-shadow: 0 14px 34px -22px color-mix(in srgb, var(--mp-azul) 45%, transparent); }
.mp-paso:not(:last-child)::after { content: ""; position: absolute; top: 44px; right: -29px; width: 30px; border-top: 2px dotted color-mix(in srgb, var(--mp-azul) 55%, transparent); }
.mp-paso-cab { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.mp-paso-n { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; font-size: 18px; font-weight: 800;
  color: var(--mp-sobre-azul); background: var(--mp-azul); box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--mp-azul) 70%, transparent); }
.mp-paso-ic { width: 26px; height: 26px; color: var(--mp-azul); }
.mp-paso b { font-size: 19px; line-height: 1.25; color: var(--mp-ink); }
.mp-paso > span { font-size: 16px; color: var(--mp-dim); }

.mp-faq { max-width: 780px; margin: 0 auto; display: grid; gap: 10px; }
.mp-faq details { background: var(--mp-sup); border: 1px solid var(--mp-borde); border-radius: 16px; padding: 0 22px; }
.mp-faq summary { cursor: pointer; list-style: none; padding: 18px 0; font-weight: 700; font-size: 17px; color: var(--mp-ink); display: flex;
  justify-content: space-between; gap: 16px; }
.mp-faq summary::-webkit-details-marker { display: none; }
.mp-faq summary::after { content: "+"; color: var(--mp-azul); font-weight: 800; font-size: 22px; line-height: 1; }
.mp-faq details[open] summary::after { content: "−"; }
.mp-faq details p { margin: 0 0 18px; color: var(--mp-dim); font-size: 16px; }
.mp-faq details p b { color: var(--mp-ink); }
.mp-final { background: radial-gradient(600px 260px at 100% 0%, rgba(255,255,255,.14), transparent 70%), linear-gradient(135deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%);
  color: var(--mp-sobre-azul); border-radius: 26px; padding: 52px 32px; text-align: center; }
.mp-final h2 { color: var(--mp-sobre-azul); margin: 0 0 10px; }
.mp-final p { margin: 0 0 26px; opacity: .9; font-size: 18px; }
.mp-final .mp-btn { background: var(--mp-sobre-azul); color: var(--mp-azul-osc) !important; box-shadow: none; }
.mp-final .mp-texto { display: inline-block; margin-top: 18px; color: var(--mp-sobre-azul); opacity: .9; font-weight: 600; text-decoration: none; }
.mp-pie { text-align: center; color: #8A93A2; font-size: 13.5px; padding: 28px 0 40px; }
.mp-pie a { color: #5B6472; }
@media (max-width: 860px) {
  .mp-hero-grilla, .mp-numeros, .mp-pasos, .mp-pasos.mp-ventajas { grid-template-columns: 1fr; }
  .mp-pasos { gap: 14px; }
  .mp-paso:not(:last-child)::after { display: none; }
  .mp-hero h1, .mp-app .mp-hero h1 { font-size: 36px; }
  .mp-app .mp-hero { padding: 4px 16px 20px; border-radius: 18px; }
  .mp-hero-grilla { gap: 28px; padding-top: 24px; }
  .mp-calc { padding: 22px 18px 20px; border-radius: 20px; }
  .mp-numero b { font-size: 44px; }
  .mp-seccion { padding: 52px 0; }
  .mp-seccion h2, .mp-app .mp-seccion h2 { font-size: 27px; }
  .mp-btn { width: 100%; text-align: center; box-sizing: border-box; }
}
@media (max-width: 860px) {
  .mp-seccion.mp-conviene-sec { padding: 72px 0 64px; }
  .mp-seccion.mp-conviene-sec h2 { font-size: 31px; }
  .mp-conviene-sec h2 + .mp-pasos { margin-top: 28px; }
  .mp-conviene-sec .mp-pasos.mp-ventajas { grid-template-columns: 1fr; gap: 14px; }
  .mp-vs.s-sitio { margin-top: 32px; }
}
}
`;

/** El ejemplo del subtítulo, con el plan más caro (18/11/2026, decidido: «Trae 10 y son US$ 291 extra por mes»). */
const NEGOCIOS_DEL_EJEMPLO = 10;

/** Los 3 pasos de «Así de simple», con su ícono (Tabler, MIT, como los del resto del sitio): link, negocio y billetera. */
const PASOS: ReadonlyArray<{ titulo: string; texto: string; icono: readonly string[] }> = [
  { titulo: 'Compartes tu link', texto: 'En redes, grupos o anuncios.',
    icono: ['M9 15l6 -6', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'] },
  { titulo: 'El negocio se suma a MaKo', texto: 'Paga con tu link o tu código.',
    icono: ['M3 21l18 0', 'M5 21v-14l8 -4v18', 'M19 21v-10l-6 -4', 'M9 9l0 .01', 'M9 12l0 .01', 'M9 15l0 .01', 'M9 18l0 .01'] },
  { titulo: 'Cobras del 1 al 5 de cada mes', texto: 'En dólares por Binance o en pesos.',
    icono: ['M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12', 'M20 12v4h-4a2 2 0 0 1 0 -4h4'] },
];

/**
 * «¿POR QUÉ SER PARTNER DE MaKo TE CONVIENE?» (18/11/2026, Martín por el Cerebro: «que se sepa el valor para el partner… ¿qué le
 * evita que sea fácil de usar? Le evita que le estén preguntando todo el tiempo»). La sección importante de la página: el
 * beneficio PARA EL PARTNER, no para el negocio. Sólo lo que existe: el onboarding y los tutoriales, el grupo de WhatsApp de cada
 * negocio con el equipo, las funciones del sitio y el material de lib/partners-recursos.ts (el PDF de venta y los mensajes para
 * copiar; los audios y videos todavía no están grabados y no se nombran). Sin números inventados («en vez de diez» no va).
 * Íconos de Tabler (MIT).
 */
const BENEFICIOS: ReadonlyArray<{ titulo: string; texto: string; icono: readonly string[] }> = [
  { titulo: 'Todo en una sola app', texto: 'CRM, WhatsApp, automatizaciones, anuncios e IA juntos. Dejan de pagar varias herramientas y no quieren volver atrás.',
    icono: ['M4 4h6v6h-6z', 'M14 4h6v6h-6z', 'M4 14h6v6h-6z', 'M14 17h6', 'M17 14v6'] },
  { titulo: 'Ingresos que duran', texto: `Un negocio que lo tiene todo en MaKo no se va. Y tu ${PORCENTAJE_DIRECTO} sigue entrando, mes tras mes.`,
    icono: ['M3 17l6 -6l4 4l8 -8', 'M14 7l7 0l0 7'] },
  { titulo: 'Fácil de usar', texto: 'Lo aprenden solos con el onboarding y los tutoriales. Nadie te escribe para preguntarte cómo se usa.',
    icono: ['M3 12l3 0', 'M12 3l0 3', 'M7.8 7.8l-2.2 -2.2', 'M16.2 7.8l2.2 -2.2', 'M7.8 16.2l-2.2 2.2', 'M12 12l9 3l-4 2l-2 4l-3 -9'] },
  { titulo: 'Soporte prioritario', texto: 'Si algo les pasa, les respondemos nosotros en su grupo de WhatsApp. Tú sólo cobras.',
    icono: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'] },
  // «cobrando por transferencia…» decía que el NEGOCIO cobra así con MaKo, y eso no está: lo que es verdad es que MaKo se paga así.
  { titulo: 'Hecha para Latinoamérica', texto: 'Pensada para cómo se vende en Latinoamérica: por WhatsApp y en español. Y se paga por transferencia, Mercado Pago o Binance.',
    icono: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M3.6 9h16.8', 'M3.6 15h16.8', 'M11.5 3a17 17 0 0 0 0 18', 'M12.5 3a17 17 0 0 1 0 18'] },
  // «No te dejamos solo» no es neutro en género (memoria «textos neutros»): «Nunca vendes sin ayuda».
  { titulo: 'Te ayudamos a vender', texto: 'Nunca vendes sin ayuda: material listo con tu link, te ayudamos con tus anuncios y respondemos las dudas de tus contactos antes de que compren.',
    icono: ['M18 8a3 3 0 0 1 0 6', 'M10 8v11a1 1 0 0 1 -1 1h-1a1 1 0 0 1 -1 -1v-5', 'M12 8h0l4.524 -3.77a.9 .9 0 0 1 1.476 .692v12.156a.9 .9 0 0 1 -1.476 .692l-4.524 -3.77h-8a1 1 0 0 1 -1 -1v-4a1 1 0 0 1 1 -1h8'] },
];

/** La acción de la landing: hacerse partner, o volver al panel. Siempre un link (sin JavaScript también lleva). */
export type AccionLanding = { href: string; texto: string };

/** `marca`: la del tutorial de /partners (sólo el botón de arriba, adentro de la app, para quien todavía no es partner). */
function Boton({ boton, marca }: { boton: AccionLanding | null; marca?: string }) {
  return boton ? <Link className="mp-btn" href={boton.href} data-recorrido={marca}>{boton.texto}</Link> : null;
}

export function LandingPartners({ modo = 'publica', accion, rotulo }: {
  /** `publica`: la página de venta; `app`: adentro de la tab, con los colores de la app. */
  modo?: 'publica' | 'app';
  /** El botón (en el hero, en la calculadora y en el cierre). null = sin botón (el super admin mirando cómo se ve). */
  accion?: AccionLanding | null;
  /** Una línea arriba de todo (el super admin: «así la ven tus clientes»; el partner: «volver a tu panel»). */
  rotulo?: ReactNode;
}) {
  const planes = PLANES_MAKO_DEFAULT.filter((p) => p.activo).slice().sort((a, b) => b.precioUsd - a.precioUsd);
  const tope = planes[0];
  const publica = modo === 'publica';
  // «Hacerme partner», sin «gratis» (Martín, 18/11/2026: «de hecho no es gratis, deben estar pagando su suscripción»). En mayúscula
  // por la clase (`.mp-btn`), como todos los botones de llamada a la acción del sitio.
  const boton = accion === undefined ? { href: RUTA_ALTA_PARTNERS, texto: 'Hacerme partner' } : accion;
  // Adentro de la app ya hay un <main> (el del shell): la landing es un bloque más.
  const Raiz = publica ? 'main' : 'div';
  const directo = porcentaje(COMISION_PARTNER_DIRECTO);
  return (
    <Raiz className={`mp-root ${publica ? 'mp-publica' : 'mp-app'}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS_REEMPLAZA + CSS }} />
      {rotulo}
      <div className="mp-hero">
        <div className="mp-wrap">
          {publica && (
            <nav className="mp-barra">
              <Link className="mp-marca" href="/">MaKo Partners</Link>
              <Link className="mp-entrar" href="/partners">Entrar</Link>
            </nav>
          )}
          <div className="mp-hero-grilla">
            <div>
              <span className="mp-ceja">MaKo Partners</span>
              {/* Martín, 18/11/2026: «Elimina esto del título: de por vida. Y mejora el copy del subtítulo, que sea más claro y
                  marketinero». El ejemplo de 10 negocios en el plan más caro sale de la regla (`gananciaPorMes`), no escrito. */}
              <h1>Recomienda MaKo y llévate el <em>{directo}</em></h1>
              <p className="mp-bajada">
                Cada negocio que traes te deja <b>el {directo}</b> de lo que paga, todos los meses.
                {tope && <> Trae {NEGOCIOS_DEL_EJEMPLO} y son <b className="mp-junto">{usd(gananciaPorMes(NEGOCIOS_DEL_EJEMPLO, tope.precioUsd))} extra por mes</b>.</>}
              </p>
              <div className="mp-acciones"><Boton boton={boton} marca={!publica && boton?.href === RUTA_ALTA_PARTNERS ? MARCA.partnersHacerme : undefined} /></div>
            </div>
            <Calculadora planes={planes.map((p) => ({ id: p.id, nombre: p.nombre, precioUsd: p.precioUsd }))}><Boton boton={boton} /></Calculadora>
          </div>
        </div>
      </div>

      {/* PASADA DE COPY (18/11/2026, Martín: «no pongas "no es un pago único"… se entiende. Mejora bien los copies… que sea
          marketinero, para que se entienda, no sea redundante»; aprobada por el Cerebro). Cada idea, UNA vez en la página: el héroe
          dice cuánto ganas; «Así de simple», los 3 pasos; las preguntas, sólo dudas
          que no estén arriba; el cierre, una frase y el botón. Los números, de las constantes. */}
      {/* EL CARRUSEL DE PARTNERS (18/11/2026, Martín: «utilices el divider tipo carrusel que tenemos… decídelo tú… si ponemos de los
          otros, como las apps… no sé si va a confundir»): UNO, propio, entre el héroe y «Así de simple»: a quién le puedes recomendar
          MaKo, con los rubros de Industrias tal cual están en el código (INDUSTRIAS, app/vsl/_sitio/datos.ts) y sus íconos. El MISMO
          carrusel que la portada (las clases `s-tira` de CSS_REEMPLAZA, en su variante clara): velocidad, bordes fundidos y quieto
          con «reducir movimiento». Son cuatro rubros: cada vuelta los repite para que la fila llene el ancho y no quede un hueco. */}
      <section className="s-tira s-reemplaza-claro mp-tira" aria-label="A quién le puedes recomendar MaKo">
        <p className="s-tira-r">A quién le puedes recomendar MaKo</p>
        <div className="s-tira-v">
          <div className="s-tira-p">
            {[false, true].map((oculta) => (
              <ul key={String(oculta)} className="s-tira-l" aria-hidden={oculta || undefined}>
                {[0, 1, 2].flatMap((vuelta) => INDUSTRIAS.map((r) => (
                  <li key={`${vuelta}-${r.avatar}`} className="s-tira-i" aria-hidden={vuelta > 0 || undefined}>
                    <span className="mp-tira-ic">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {r.icono.map((d) => <path key={d} d={d} />)}
                      </svg>
                    </span>
                    {r.nombre}
                  </li>
                )))}
              </ul>
            ))}
          </div>
        </div>
      </section>

      {/* Martín, 18/11/2026: «Elimina "por qué conviene"… y simplemente pon "así de simple", pero con el diseño de las tarjetas de
          "por qué te conviene"… "tú eliges cómo cobrar…" debería estar arriba, en "así de simple", en el paso 3». Los pasos son una
          secuencia: el número grande arriba de cada tarjeta. */}
      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Así de simple</h2>
          {/* Menos plano, sin dramatismo (Martín, 18/11/2026: «quedó muy plano esas tarjetitas. Tampoco que sea súper dramático… el
              texto de abajo es muy largo»): profundidad suave, el número en un círculo, un ícono por paso, la línea punteada que los
              une en la computadora, y una línea de texto. */}
          <ol className="mp-pasos">
            {PASOS.map((p, i) => (
              <li key={p.titulo} className="mp-paso">
                <div className="mp-paso-cab">
                  <span className="mp-paso-n">{i + 1}</span>
                  <svg className="mp-paso-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {p.icono.map((d) => <path key={d} d={d} />)}
                  </svg>
                </div>
                <b>{p.titulo}</b>
                <span>{p.texto}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mp-seccion mp-conviene-sec">
        <div className="mp-wrap">
          <h2>¿Por qué ser partner de MaKo <em className="mp-conviene">te conviene</em>?</h2>
          <ul className="mp-pasos mp-ventajas">
            {BENEFICIOS.map((v) => (
              <li key={v.titulo} className="mp-paso">
                <span className="mp-ventaja-ic">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {v.icono.map((d) => <path key={d} d={d} />)}
                  </svg>
                </span>
                <b>{v.titulo}</b>
                <span>{v.texto}</span>
              </li>
            ))}
          </ul>
          {/* La comparación con el MISMO componente de las del sitio (Martín: «copia el diseño que ya hicimos en todas las comparaciones,
              MaKo versus otro, que cuando le doy clic abajo sale el desplegable con la tabla»): una tarjeta, sus 5 filas y la fecha. */}
          <div className="s-sitio s-claro mp-vs">
            <style dangerouslySetInnerHTML={{ __html: CSS_BASE + CSS_COMPARACIONES }} />
            <TarjetasVs solo={[COMPARACION_CON]} titulo={null} filas={COMPARACION} nota={`Datos de gohighlevel.com y de su centro de ayuda, ${COMPARACION_LEIDA}.`} conBoton={false} />
          </div>
        </div>
      </section>

      <section className="mp-seccion">
        <div className="mp-wrap">
          <h2>Preguntas frecuentes</h2>
          <p className="mp-sub">Todo lo que necesitas saber para empezar hoy.</p>
          <div className="mp-faq">
            <details open>
              <summary>¿Cuándo cobro?</summary>
              <p>Del 1 al 5 de cada mes, por todo lo que ganaste el mes anterior.</p>
            </details>
            <details>
              <summary>¿Quién cuenta como mi referido?</summary>
              <p>Cualquier negocio que todavía no usa MaKo y entra con tu link o pone tu código al pagar. Tu propio negocio no cuenta.</p>
            </details>
            <details>
              <summary>¿Dónde veo lo que gané?</summary>
              <p>En tu panel de MaKo Partners: cada negocio que trajiste, lo que te deja y lo que tienes a cobrar.</p>
            </details>
            <details>
              <summary>¿Qué necesito para ser partner?</summary>
              <p>
                Tener tu plan {tope?.nombre} activo{tope && <> ({usd(tope.precioUsd)} al mes)</>}. Si tu plan se corta, lo que ganaste no se pierde:
                te lo pagamos cuando lo reactivas.
              </p>
            </details>
          </div>
        </div>
      </section>

      {boton && (
        <section className="mp-seccion">
          <div className="mp-wrap">
            <div className="mp-final">
              <h2>Empieza a ganar con tu link</h2>
              <Boton boton={boton} />
              {publica && <div><Link className="mp-texto" href="/planes">¿Todavía no tienes MaKo? Ver los planes →</Link></div>}
            </div>
            {publica && <p className="mp-pie"><Link href="/planes">Planes de MaKo</Link> · <Link href="/terminos">Términos</Link></p>}
          </div>
        </section>
      )}
    </Raiz>
  );
}
