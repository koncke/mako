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
import { gananciaPorMes, porcentaje, usd } from './numeros';
import { COMPARACION, COMPARACION_TITULO, LOGO_OTRA, NOMBRE_OTRA } from './comparacion';
import { BENEFICIOS } from './beneficios';
import { Carrusel } from './Carrusel';
import { EstrellaMaKo } from '@/app/vsl/_competencia/marca';
import { MARCA } from '@/lib/tutoriales/marcas';
import {
  Apple, Brain, Briefcase, Calculator, Car, Compass, DraftingCompass, Dumbbell, House, Megaphone, MessagesSquare, MonitorPlay,
  PartyPopper, Plane, Scale, School, ShieldCheck, Smile, Sparkles, TrendingUp, type LucideIcon,
} from 'lucide-react';
import { CSS_REEMPLAZA } from '@/app/vsl/_sitio/estilos';

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
   y debajo, el carrusel y la tabla contra GoHighLevel. */
.mp-conviene { font-style: normal; font-weight: 900; color: var(--mp-azul);
  background: linear-gradient(90deg, var(--mp-azul-osc) 0%, var(--mp-azul) 55%, color-mix(in srgb, var(--mp-azul) 70%, #22B8F0) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
/* LA sección fuerte: más aire, el título más grande, seis tarjetas 3 × 2. */
.mp-seccion.mp-conviene-sec { padding: 112px 0 104px; }
.mp-seccion.mp-conviene-sec h2 { font-size: 46px; }
.mp-conviene-sec h2 + .mp-pasos { margin-top: 40px; }
/* El carrusel: UNA tarjeta grande a la vez (Martín: «como una tarjeta grandota»). La ventana recorta, la pista se corre una
   tarjeta entera; todas miden lo mismo (la fila de flex las estira a la más alta), así no salta el alto al pasar. */
.mp-car { position: relative; max-width: 860px; margin: 40px auto 0; }
.mp-car-ventana { overflow: hidden; border-radius: 28px; border: 1px solid var(--mp-borde);
  background: radial-gradient(640px 280px at 50% 0%, color-mix(in srgb, var(--mp-azul) 14%, transparent), transparent 70%),
    linear-gradient(180deg, color-mix(in srgb, var(--mp-azul) 6%, var(--mp-sup)) 0%, var(--mp-sup) 80%);
  box-shadow: 0 30px 70px -36px color-mix(in srgb, var(--mp-azul) 55%, transparent); }
.mp-car-pista { display: flex; transition: transform .55s cubic-bezier(.22, .61, .36, 1); }
.mp-car-tarjeta { flex: 0 0 100%; box-sizing: border-box; min-height: 320px; padding: 52px 96px 46px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 14px; text-align: center; }
.mp-car-ic { display: inline-flex; align-items: center; justify-content: center; width: 80px; height: 80px; border-radius: 24px; color: var(--mp-sobre-azul);
  background: linear-gradient(140deg, var(--mp-azul) 0%, var(--mp-azul-osc) 100%); box-shadow: 0 16px 32px -14px color-mix(in srgb, var(--mp-azul) 75%, transparent); }
.mp-car-ic svg { width: 42px; height: 42px; }
.mp-car-tarjeta h3 { margin: 8px 0 0; font-size: 32px; line-height: 1.15; font-weight: 800; letter-spacing: -.02em; color: var(--mp-ink); }
.mp-car-tarjeta p { margin: 0; max-width: 580px; font-size: 19px; line-height: 1.5; color: var(--mp-dim); }
.mp-car-fl { position: absolute; top: calc(50% - 22px); transform: translateY(-50%); display: inline-flex; align-items: center; justify-content: center;
  width: 48px; height: 48px; border-radius: 50%; border: 1px solid var(--mp-borde); background: var(--mp-sup); color: var(--mp-ink); cursor: pointer;
  box-shadow: 0 10px 24px -12px rgba(0,0,0,.35); transition: color .15s ease, border-color .15s ease; }
.mp-car-fl.ant { left: -24px; } .mp-car-fl.sig { right: -24px; }
.mp-car-fl:hover { color: var(--mp-azul); border-color: var(--mp-azul); }
.mp-car-fl:focus-visible, .mp-car-puntos button:focus-visible { outline: 2px solid var(--mp-azul); outline-offset: 2px; }
.mp-car-puntos { display: flex; justify-content: center; gap: 2px; margin-top: 16px; }
.mp-car-puntos button { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; border: 0;
  background: none; cursor: pointer; transition: width .25s ease; }
.mp-car-puntos button::before { content: ""; width: 8px; height: 8px; border-radius: 999px; background: color-mix(in srgb, var(--mp-azul) 28%, transparent);
  transition: width .25s ease, background .25s ease; }
.mp-car-puntos button.activo { width: 36px; }
.mp-car-puntos button.activo::before { width: 26px; background: var(--mp-azul); }
@media (prefers-reduced-motion: reduce) { .mp-car-pista, .mp-car-puntos button, .mp-car-puntos button::before { transition: none; } }
.mp-oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
/* MaKo frente a GoHighLevel, a la vista: la columna de MaKo destacada de arriba abajo (fondo de marca suave, borde azul, el logo y
   el chip «Recomendado»), tildes verdes grandes; la de GoHighLevel en gris, lo que cuesta aparte en rojo y la cruz donde no lo tiene. */
.mp-vs2 { max-width: 860px; margin: 72px auto 0; }
.mp-vs2-t { margin: 0 0 30px; text-align: center; font-size: 28px; line-height: 1.2; font-weight: 800; letter-spacing: -.02em; color: var(--mp-ink); text-wrap: balance; }
.mp-vs2-tabla { width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
.mp-vs2-tabla .c1 { width: 40%; } .mp-vs2-tabla .c2 { width: 29%; } .mp-vs2-tabla .c3 { width: 31%; }
.mp-vs2-tabla th, .mp-vs2-tabla td { padding: 15px 18px; vertical-align: middle; font-size: 16px; line-height: 1.35; border-bottom: 1px solid var(--mp-borde); }
.mp-vs2-tabla thead th, .mp-vs2-tabla thead td { padding: 30px 12px 16px; text-align: center; }
.mp-vs2-tabla thead td { border-bottom-color: transparent; }
.mp-vs2-tabla thead th b { display: block; margin-top: 8px; font-size: 18px; font-weight: 800; color: var(--mp-ink); }
.mp-vs2-tabla tbody th { text-align: left; font-weight: 700; color: var(--mp-ink); }
.mp-vs2-tabla .mk { position: relative; text-align: center; color: var(--mp-ink); font-weight: 700; background: color-mix(in srgb, var(--mp-azul) 8%, var(--mp-sup));
  border-left: 2px solid var(--mp-azul); border-right: 2px solid var(--mp-azul); }
.mp-vs2-tabla thead .mk { border-top: 2px solid var(--mp-azul); border-radius: 18px 18px 0 0; }
.mp-vs2-tabla tbody tr:last-child .mk { border-bottom: 2px solid var(--mp-azul); border-radius: 0 0 18px 18px; }
.mp-vs2-tabla tbody tr:last-child th, .mp-vs2-tabla tbody tr:last-child .otra { border-bottom-color: transparent; }
.mp-vs2-tabla .otra { text-align: center; color: #6B7280; background: color-mix(in srgb, #6B7280 5%, var(--mp-sup)); }
.mp-vs2-tabla thead .otra { border-radius: 18px 18px 0 0; }
.mp-vs2-tabla thead .otra b { color: #6B7280; }
.mp-vs2-tabla thead .otra .mp-vs2-logo { filter: grayscale(1); opacity: .65; }
.mp-vs2-chip { position: absolute; top: -13px; left: 50%; transform: translateX(-50%); padding: 5px 11px; border-radius: 999px; white-space: nowrap;
  font-size: 11.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--mp-sobre-azul); background: var(--mp-azul);
  box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--mp-azul) 80%, transparent); }
.mp-vs2-logo { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 10px; vertical-align: middle; }
.mp-vs2-logo.mk-logo { background: #12151B; }
.mp-vs2-si { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; color: #fff;
  background: var(--mp-bien); box-shadow: 0 6px 14px -6px color-mix(in srgb, var(--mp-bien) 80%, transparent); vertical-align: middle; }
.mp-vs2-si svg { width: 18px; height: 18px; }
.mp-vs2-no { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; color: #C2413B;
  background: color-mix(in srgb, #C2413B 12%, var(--mp-sup)); vertical-align: middle; }
.mp-vs2-no svg { width: 15px; height: 15px; }
/* El precio de entrada: los dos montos, sin tilde; el de MaKo en verde. */
.mp-vs2-precio { font-weight: 600; }
.mp-vs2-verde { color: var(--mp-bien); font-size: 1.25em; font-weight: 800; }
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
  .mp-hero-grilla, .mp-numeros, .mp-pasos { grid-template-columns: 1fr; }
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
  .mp-car { margin-top: 28px; }
  .mp-car-fl { display: none; }
  .mp-car.quieto .mp-car-fl { display: inline-flex; top: auto; bottom: -6px; transform: none; width: 40px; height: 40px; }
  .mp-car.quieto .mp-car-fl.ant { left: 0; } .mp-car.quieto .mp-car-fl.sig { right: 0; }
  .mp-car-tarjeta { min-height: 300px; padding: 36px 22px 32px; }
  .mp-car-ic { width: 64px; height: 64px; border-radius: 20px; } .mp-car-ic svg { width: 34px; height: 34px; }
  .mp-car-tarjeta h3 { font-size: 25px; }
  .mp-car-tarjeta p { font-size: 16.5px; }
  .mp-vs2 { margin-top: 56px; }
  .mp-vs2-t { font-size: 22px; margin-bottom: 26px; }
}
/* La tabla en el teléfono: las tres columnas en el ancho, sin scroll. */
@media (max-width: 560px) {
  .mp-vs2-tabla .c1 { width: 36%; } .mp-vs2-tabla .c2 { width: 31%; } .mp-vs2-tabla .c3 { width: 33%; }
  .mp-vs2-tabla th, .mp-vs2-tabla td { padding: 12px 6px; font-size: 13.5px; }
  .mp-vs2-tabla tbody th { padding-left: 4px; }
  .mp-vs2-tabla thead th, .mp-vs2-tabla thead td { padding: 26px 4px 12px; }
  .mp-vs2-tabla thead th b { font-size: 14.5px; }
  .mp-vs2-chip { font-size: 10px; padding: 4px 8px; letter-spacing: .04em; }
  .mp-vs2-logo { width: 30px; height: 30px; }
  .mp-vs2-si { width: 26px; height: 26px; } .mp-vs2-si svg { width: 15px; height: 15px; }
  .mp-vs2-no { width: 26px; height: 26px; } .mp-vs2-no svg { width: 13px; height: 13px; }
  .mp-vs2-precio { font-size: 12.5px; }
}
}
`;

/** El ejemplo del subtítulo, con el plan más caro (18/11/2026, decidido: «Trae 10 y son US$ 291 extra por mes»). */
const NEGOCIOS_DEL_EJEMPLO = 10;

/**
 * A QUIÉN LE PUEDES RECOMENDAR MaKo (18/11/2026, Martín por el Cerebro: «pondría más cosas… prestadores de servicios o más avatares…
 * hay muchos que pueden vender high ticket»). Una lista PROPIA de Partners (ya no los cuatro rubros de Industrias): quienes venden
 * servicios o high ticket, con un ícono cada uno (lucide-react, la librería del sitio; el más cercano y sencillo). Son 20: la fila
 * se llena sola, sin repetirlos.
 */
const RUBROS: ReadonlyArray<{ nombre: string; Icono: LucideIcon }> = [
  { nombre: 'Agencias de marketing', Icono: Megaphone }, { nombre: 'Coaches', Icono: MessagesSquare },
  { nombre: 'Mentores', Icono: Compass }, { nombre: 'Consultores', Icono: Briefcase },
  { nombre: 'Infoproductores', Icono: MonitorPlay }, { nombre: 'Inmobiliarias', Icono: House },
  { nombre: 'Clínicas estéticas', Icono: Sparkles }, { nombre: 'Odontólogos', Icono: Smile },
  { nombre: 'Abogados', Icono: Scale }, { nombre: 'Contadores', Icono: Calculator },
  { nombre: 'Academias y escuelas', Icono: School }, { nombre: 'Entrenadores y gimnasios', Icono: Dumbbell },
  { nombre: 'Psicólogos y terapeutas', Icono: Brain }, { nombre: 'Nutricionistas', Icono: Apple },
  { nombre: 'Brokers de seguros', Icono: ShieldCheck }, { nombre: 'Asesores financieros', Icono: TrendingUp },
  { nombre: 'Agencias de viajes', Icono: Plane }, { nombre: 'Organizadores de eventos', Icono: PartyPopper },
  { nombre: 'Arquitectos y estudios', Icono: DraftingCompass }, { nombre: 'Concesionarias de autos', Icono: Car },
];

/**
 * EL CARRUSEL DE RUBROS (18/11/2026): el MISMO de la portada (las clases `s-tira` de CSS_REEMPLAZA, en su variante clara: velocidad,
 * bordes fundidos y quieto con «reducir movimiento»). Va DOS veces (Martín: «ponerlo abajo de "así de simple", y repetirlo al final
 * antes de las preguntas frecuentes»). Dos listas iguales para que la vuelta no se corte; la segunda, oculta para el lector.
 */
function TiraRubros() {
  return (
    <section className="s-tira s-reemplaza-claro mp-tira" aria-label="A quién le puedes recomendar MaKo">
      <p className="s-tira-r">A quién le puedes recomendar MaKo</p>
      <div className="s-tira-v">
        <div className="s-tira-p">
          {[false, true].map((oculta) => (
            <ul key={String(oculta)} className="s-tira-l" aria-hidden={oculta || undefined}>
              {RUBROS.map(({ nombre, Icono }) => (
                <li key={nombre} className="s-tira-i">
                  <span className="mp-tira-ic"><Icono size={22} strokeWidth={1.9} aria-hidden="true" /></span>
                  {nombre}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
}

/** Los 3 pasos de «Así de simple», con su ícono (Tabler, MIT, como los del resto del sitio): link, negocio y billetera. */
const PASOS: ReadonlyArray<{ titulo: string; texto: string; icono: readonly string[] }> = [
  { titulo: 'Compartes tu link', texto: 'En redes, grupos o anuncios.',
    icono: ['M9 15l6 -6', 'M11 6l.463 -.536a5 5 0 0 1 7.071 7.072l-.534 .464', 'M13 18l-.397 .534a5.068 5.068 0 0 1 -7.127 0a4.972 4.972 0 0 1 0 -7.071l.524 -.463'] },
  { titulo: 'El negocio se suma a MaKo', texto: 'Paga con tu link o tu código.',
    icono: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M16 19h6', 'M19 16v6', 'M6 21v-2a4 4 0 0 1 4 -4h4'] },
  { titulo: 'Cobras del 1 al 5 de cada mes', texto: 'En dólares por Binance o en pesos.',
    icono: ['M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12', 'M20 12v4h-4a2 2 0 0 1 0 -4h4'] },
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

      <TiraRubros />

      <section className="mp-seccion mp-conviene-sec">
        <div className="mp-wrap">
          <h2>¿Por qué ser partner de MaKo <em className="mp-conviene">te conviene</em>?</h2>
          <Carrusel items={BENEFICIOS} />
          {/* MaKo FRENTE A GoHighLevel, A LA VISTA (Martín: «la idea es posicionar a MaKo por arriba de HighLevel… sacar ventaja para
              que elijan revender esto»): la columna de MaKo destacada (fondo de marca, borde, el logo y «Recomendado») con tildes
              verdes; la de GoHighLevel en gris, con lo que cuesta aparte en rojo o la cruz. Cada fila, con su fuente
              (./comparacion.ts). */}
          <div className="mp-vs2">
            <h3 className="mp-vs2-t">{COMPARACION_TITULO}</h3>
            <table className="mp-vs2-tabla">
              <colgroup><col className="c1" /><col className="c2" /><col className="c3" /></colgroup>
              <thead>
                <tr>
                  <td />
                  <th scope="col" className="mk">
                    <span className="mp-vs2-chip">Recomendado</span>
                    {/* `data-tema-fijo`: el sol y la luna del sitio aclara los cuadros oscuros; el del logo queda negro. */}
                    <span className="mp-vs2-logo mk-logo" data-tema-fijo=""><EstrellaMaKo size={22} /></span>
                    <b>MaKo</b>
                  </th>
                  <th scope="col" className="otra">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className="mp-vs2-logo" src={LOGO_OTRA} alt="" width={36} height={36} loading="lazy" />
                    <b>{NOMBRE_OTRA}</b>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARACION.map((f) => (
                  <tr key={f.nombre}>
                    <th scope="row">{f.nombre}</th>
                    {f.precio ? (
                      <>
                        <td className="mk mp-vs2-precio">Desde <b className="mp-vs2-verde">{f.precio.mako}</b> al mes</td>
                        <td className="otra mp-vs2-precio">Desde {f.precio.otra} al mes</td>
                      </>
                    ) : (
                      <>
                        <td className="mk">
                          <span className="mp-vs2-si"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5l9 -10" /></svg></span>
                          <span className="mp-oculto">Sí</span>
                        </td>
                        <td className="otra">
                          <span className="mp-vs2-no"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" aria-hidden="true"><path d="M7 7l10 10" /><path d="M17 7l-10 10" /></svg></span>
                          <span className="mp-oculto">No</span>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <TiraRubros />

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
