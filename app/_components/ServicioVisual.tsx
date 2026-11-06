'use client';

// =============================================================================
// ServicioVisual — la cara de cada integración (logo oficial + tile)
// =============================================================================
// Extraído de IntegracionesBoard: lo necesita CUALQUIER pantalla que hable de un
// servicio (el board, el modal, el onboarding y el panel de activación de cada
// tab), no solo /integraciones.
//
// BrandDefs monta los <symbol> una sola vez por página: si dos pantallas lo
// montan a la vez, el <use> toma el primero — son idénticos, así que no rompe,
// pero conviene montarlo una sola vez arriba del árbol.
// =============================================================================

import { RafagaClaude } from './icons';
import { GLIFO_SOCIAL } from '@/lib/canal-social';

// ── Iconos de marca por servicio (color de fondo + símbolo SVG) ──────────────
// REGLA: acá solo van logos OFICIALES, copiados tal cual de la fuente de la marca
// (ver BrandDefs). Si no conseguimos el vector oficial de un servicio, NO se
// dibuja uno "parecido": va un letter-mark (la inicial en Geist sobre el color de
// marca real). Un logo inventado es peor que una inicial honesta.
//
// ⚠️ DÓNDE BUSCAR, Y EN QUÉ ORDEN. El 01/11/2026 Martín reportó que «muchos logos, como por
// ejemplo el de Appify, no son los logos reales de esas empresas», y seis lo eran: Apify, Groq,
// Gemini, ElevenLabs, YouTube y la «G» de Google estaban dibujados a ojo. Otros siete iban con
// letter-mark «porque no hay vector». Los trece tenían su logo publicado. El error no fue dibujar:
// fue dar por agotada la búsqueda después de un 404 de simple-icons. El orden que sí funciona:
//   1. el <link rel="icon"> de la PROPIA página de la empresa (ahí estaban Apify y Groq),
//   2. su carpeta de marca (ahí estaba Creem: /new-branding/Logo/SVG/…),
//   3. el CDN del dueño de la marca (ahí estaban la «G» y Google Business: fonts.gstatic.com y
//      gstatic.com/images/branding),
//   4. el wordmark del sitio, recortado al glifo con viewBox (Fathom, Fireflies, bunny.net, Read AI),
//   5. simple-icons — que es un ATAJO, no la fuente, y retira marcas (Google Business estaba en la 11
//      y no está en la 13),
//   6. recién acá, el letter-mark.
// Un 404 en el paso 5 no dice «no hay logo»: dice «no está en ese atajo».
/**
 * `sym`    el trazo oficial, pegado como <symbol> acá abajo. Lo más liviano: no pide un request.
 * `img`    un ARCHIVO oficial en /public/logos. Es para los logos que no se pueden pegar como un
 *          trazo sin reescribirlos: degradés con sus <defs> (Fireflies, bunny.net, Read AI), un
 *          wordmark que ES la marca (tl;dv) y los que la empresa sólo publica en PNG (Otter,
 *          Google Business). Dibujar «algo parecido» es justo lo que la regla de arriba prohíbe,
 *          así que el archivo entra tal cual y el viewBox sólo lo recorta al glifo.
 * `lleno`  el archivo trae SU propio fondo y sus esquinas (un ícono de app, como el de Otter):
 *          ocupa el tile entero en vez de ir centrado adentro.
 */
export type IconDef = { sym?: string; letter?: string; img?: string; lleno?: boolean; bg: string; bd?: string; fg?: string };
export const ICON: Record<string, IconDef> = {
  meta: { sym: 'ic-meta', bg: '#0866FF' },
  whatsapp: { sym: 'ic-whatsapp', bg: '#25D366' },
  email: { sym: 'ic-resend', bg: '#000000' },      // Resend brand: negro
  anthropic: { sym: 'ic-anthropic', bg: '#CC785C' },
  openai: { sym: 'ic-openai', bg: '#000000' },
  // Groq: el RAYO, que es su marca de verdad (groq.com/favicon.svg). Hasta el 01/11/2026 iba una «G»
  // dibujada a mano, y encima sobre un rojo que no es el suyo (#F55036; el de su propio ícono es #F43E01).
  groq: { sym: 'ic-groq', bg: '#F43E01' },
  gemini: { sym: 'ic-gemini', bg: '#1B72E8' },     // Google Gemini: su spark OFICIAL, blanco sobre azul
  // ElevenLabs: logo negro sobre claro → tile blanco con borde (como panda/google).
  elevenlabs: { sym: 'ic-elevenlabs', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Pexels: su marca de simple-icons 16.36.0 (el cuadrado verde #05A081 con la «P» calada), sobre blanco: la «P» queda
  // blanca, como en su ícono.
  pexels: { sym: 'ic-pexels', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  'apify-instagram': { sym: 'ic-apify-instagram', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  fathom: { sym: 'ic-fathom', bg: '#000000' },     // fathom.video: mark celeste sobre negro
  // Los otros grabadores de reuniones (26/10/2026, lib/grabadores). Loom, Zoom y Google Meet: los marks oficiales de
  // simple-icons 13.21.0 en blanco sobre el color de marca que declara la misma fuente (Loom #625DF5, Zoom #0B5CFF, Google
  // Meet #00897B).
  //
  // ⚠️ tl;dv, Fireflies, Otter y Read AI iban con letter-mark porque NO están en simple-icons, y de ahí se
  // concluyó que no había vector. El 01/11/2026 (Martín: «muchos logos, como por ejemplo el de Appify, no son los
  // logos reales de esas empresas») se buscó en el lugar correcto —la página de cada empresa— y los cuatro tenían
  // su logo publicado. simple-icons es un atajo, no la fuente: lo que manda es la marca.
  loom: { sym: 'ic-loom', bg: '#625DF5' },
  zoom: { sym: 'ic-zoom', bg: '#0B5CFF' },
  meet: { sym: 'ic-googlemeet', bg: '#00897B' },
  // tl;dv: su logo ES el wordmark «tl;dv» (tldv.io/logo-tldv.svg), en su azul #1D1DFF. No publican un glifo
  // aparte que se pueda recortar, así que va el archivo entero.
  tldv: { img: 'tldv.svg', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Fireflies: los cuatro cuadrados en su degradé rosa→azul (fireflies.ai/images/logo-full-color.svg, recortado
  // al glifo con viewBox y sin el wordmark). Son 8 trazos y 8 <linearGradient>: por eso archivo y no <symbol>.
  fireflies: { img: 'fireflies.svg', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Otter: su ícono de app, el único formato en que publican la marca (otter.ai, apple-icon.png). Trae su propio
  // azul y sus esquinas redondeadas → `lleno`: el archivo ES el tile.
  otter: { img: 'otter.png', lleno: true, bg: 'transparent' },
  // Read AI: el cuadrado redondeado con su degradé, del lockup oficial (ReadAILogo_HorizontalLockup_Color,
  // recortado al ícono). También trae su fondo → `lleno`.
  readai: { img: 'readai.svg', lleno: true, bg: 'transparent' },
  calendly: { sym: 'ic-calendly', bg: '#006BFF' },
  // ⚠️ CAL.COM NO ES CALENDLY, y sin esta entrada caía en el FALLBACK de `iconFor`
  // —que es Supabase— así que la tarjeta de la agenda de un cliente mostraba el
  // logo de una base de datos. Un logo ajeno es peor que ninguno: no se lee como
  // «falta el ícono», se lee como que la app se confundió de servicio.
  // Su mark oficial es la palabra «cal» en #292929 pensada para fondo claro, así
  // que va tile blanco con borde — el mismo tratamiento que google, panda,
  // elevenlabs y mistral, por el mismo motivo.
  calcom: { sym: 'ic-calcom', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  google: { sym: 'ic-google', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Panda: su logo es oscuro sobre claro y trae blancos macizos → tile blanco con
  // borde (igual que google). Con un bg de color el logo se rompe.
  panda: { sym: 'ic-panda', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Los otros alojadores de video (25/10/2026): los marks oficiales de simple-icons 13.21.0 en blanco sobre el color de
  // marca que declara la misma fuente (Vimeo #1AB7EA, Wistia #58B7FE, Cloudflare #F38020).
  vimeo: { sym: 'ic-vimeo', bg: '#1AB7EA' },
  wistia: { sym: 'ic-wistia', bg: '#58B7FE' },
  // bunny.net: el conejo de su logotipo (bunny.net/static/bunnynet-dark-….svg, recortado al glifo con viewBox y
  // sin el wordmark). Nueve trazos con degradé → archivo. Iba un letter-mark «B» por el 404 de simple-icons.
  bunny: { img: 'bunny.svg', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  cloudflare: { sym: 'ic-cloudflare', bg: '#F38020' },
  youtube: { sym: 'ic-youtube', bg: '#FF0000' },
  supabase: { sym: 'ic-supabase', bg: '#1F2937' },
  // GitHub: el mark oficial en blanco sobre su negro de marca (#181717).
  github: { sym: 'ic-github', bg: '#181717' },
  'apple-push': { sym: 'ic-apple', bg: '#000000' },
  // El vigía de las aprobaciones: la tienda de Apple y las de Google llevan el logo de su empresa (los dos símbolos ya existen).
  'app-store-connect': { sym: 'ic-apple', bg: '#000000' },
  'tiendas-google': { sym: 'ic-google', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // El Pixel de MaKo es de MaKo: su logo es la ESTRELLA, dorada sobre el negro del ícono de la app (25/10/2026, Martín: «Revisa
  // bien el logo de todas»). Era una ventana genérica sobre violeta: el ícono de nadie.
  landing: { sym: 'ic-mako', bg: '#14161B' },
  // La pasarela de pagos (11/10/2026): los marks oficiales en blanco sobre el color de marca que
  // declara la misma fuente (simple-icons 13.21.0: Stripe #635BFF, Mercado Pago #00B1EA).
  stripe: { sym: 'ic-stripe', bg: '#635BFF' },
  mercadopago: { sym: 'ic-mercadopago', bg: '#00B1EA' },
  // Creem: su ícono oficial, en su negro #151617. El 31/10/2026 iba un letter-mark porque se lo buscó en
  // simple-icons (404) y en los metadatos de creem.io (no hay `theme-color` ni manifest) y se dio por perdido. Sí
  // está publicado, en su propia carpeta de marca: /new-branding/Logo/SVG/«creem logo icon_black.svg».
  // Logo oscuro sobre claro → tile blanco con borde, como google, panda y calcom.
  creem: { sym: 'ic-creem', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  // Zernio: su marca OFICIAL (25/10/2026, Martín: «la de Zernio no es el correcto»). Hasta ese día iba un letter-mark sobre un
  // violeta (#6D4AFF) que no es el suyo: su ícono es la marca blanca sobre rojo anaranjado #EB3514 (zernio.com/icon.svg).
  zernio: { sym: 'ic-zernio', bg: '#EB3514' },
  // Instagram y Messenger: los glifos oficiales (simple-icons 13.21.0) sobre su degradé de marca. Los
  // usa la cabecera de las tarjetas del lienzo de /automations (`IconoNodo` dibuja `SvcIcon` con la clave).
  instagram: { sym: 'ic-instagram', bg: 'linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)' },
  messenger: { sym: 'ic-messenger', bg: 'linear-gradient(45deg, #0099FF 0%, #A033FF 60%, #FF5280 90%, #FF7061 100%)' },
  // Las tarjetas de cada red social (29/10/2026, `red-<red>`, lib/zernio-redes.ts): los marks oficiales de simple-icons 13.21.0 en
  // blanco sobre el color de marca que declara la misma fuente (Facebook #0866FF, LinkedIn #0A66C2, Pinterest #BD081C, Reddit
  // #FF4500; TikTok, X y Threads #000000).
  'red-facebook': { sym: 'ic-facebook', bg: '#0866FF' },
  'red-instagram': { sym: 'ic-instagram', bg: 'linear-gradient(45deg, #FEDA75 0%, #FA7E1E 25%, #D62976 50%, #962FBF 75%, #4F5BD5 100%)' },
  'red-tiktok': { sym: 'ic-tiktok', bg: '#000000' },
  'red-linkedin': { sym: 'ic-linkedin', bg: '#0A66C2' },
  'red-twitter': { sym: 'ic-x', bg: '#000000' },
  'red-threads': { sym: 'ic-threads', bg: '#000000' },
  // Google Business: el toldo de la ficha. Google lo publica en SU propio CDN de marca
  // (gstatic.com/images/branding/product/2x/google_my_business_48dp.png) y sólo en PNG; en simple-icons está
  // retirado. Iba una «G» sobre azul, que es el logo de Google, no el de la ficha de un negocio.
  'red-googlebusiness': { img: 'googlebusiness.png', bg: '#FFFFFF', bd: '1px solid var(--border-strong)' },
  'red-pinterest': { sym: 'ic-pinterest', bg: '#BD081C' },
  'red-reddit': { sym: 'ic-reddit', bg: '#FF4500' },
  // ⚠️ CLAUDE Y ANTHROPIC SON DOS MARCAS Y LLEVAN DOS LOGOS DISTINTOS.
  // `anthropic` de más arriba es la API key que el cliente pega: ahí se está conectando
  // con la EMPRESA, y va su logotipo. `agente` es con lo que el cliente habla —Claude,
  // el producto—, y va la ráfaga. Estaban cambiados: la integración se llamaba «Claude
  // Code» y mostraba el logo de la empresa.
  agente: { sym: 'ic-claude', bg: '#181818' },
};
/**
 * El ícono de un servicio, o un letter-mark honesto.
 *
 * ⚠️⚠️ EL FALLBACK ERA EL LOGO DE SUPABASE. Cualquier servicio nuevo sin entrada en
 * `ICON` no se veía como «falta el ícono»: se veía como **otra marca**. El
 * 24/08/2026 la tarjeta de Cal.com —una agenda— salió con el logo de una base de
 * datos, y el dueño lo reportó como que el logo estaba mal. No estaba mal: era de
 * otro producto.
 *
 * Un logo AJENO es peor todavía que uno inventado, que es lo que la regla de arriba
 * ya prohíbe: no se lee como un error nuestro, se lee como que la app se confundió
 * de servicio. Ahora cae en la inicial sobre un gris neutro — feo a propósito, para
 * que se note que falta, y sin decir nada falso.
 */
export const iconFor = (k: string): IconDef =>
  ICON[k] ?? { letter: (k.trim()[0] ?? '?').toUpperCase(), bg: '#4A5160' };

export function SvcIcon({ k, size = 21, box = 34, radius = 9 }: { k: string; size?: number; box?: number; radius?: number }) {
  const ic = iconFor(k);
  return (
    // Decorativo: el nombre del servicio SIEMPRE va al lado. Sin esto, el
    // letter-mark se lee doble ("P Panda Video").
    <span aria-hidden style={{ width: box, height: box, flex: 'none', borderRadius: radius, background: ic.bg, border: ic.bd, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* ⚠️ Acá había un caso especial que para `agente` dibujaba el escudo del Perro
          Guardián, pisando lo que dice el catálogo. Un `if` por clave adentro del
          renderer es exactamente lo que hace que el catálogo deje de ser la fuente
          única — el que agrega un servicio mira `ICON` y no se entera de que hay una
          excepción escondida acá abajo. */}
      {ic.img
        /* eslint-disable-next-line @next/next/no-img-element -- un logo de 34 px servido de /public: next/image acá sólo suma un wrapper y una ida al optimizador. */
        ? <img src={`/logos/${ic.img}`} alt="" width={ic.lleno ? box : size} height={ic.lleno ? box : size} style={{ display: 'block', borderRadius: ic.lleno ? radius : undefined }} />
        : ic.letter
        ? <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, fontSize: Math.round(box * 0.46), lineHeight: 1, letterSpacing: '-0.03em', color: ic.fg ?? '#fff' }}>{ic.letter}</span>
        : <svg width={size} height={size} viewBox="0 0 24 24"><use href={`#${ic.sym}`} /></svg>}
    </span>
  );
}

/** El trazo del logo de Meta, en un cuadro de 16. Uno solo: lo usan el símbolo de las integraciones y `LogoMeta`. */
const PATH_META = 'M8.217 5.243C9.145 3.988 10.171 3 11.483 3 13.96 3 16 6.153 16.001 9.907c0 2.29-.986 3.725-2.757 3.725-1.543 0-2.395-.866-3.924-3.424l-.667-1.123-.118-.197a55 55 0 0 0-.53-.877l-1.178 2.08c-1.673 2.925-2.615 3.541-3.923 3.541C1.086 13.632 0 12.217 0 9.973 0 6.388 1.995 3 4.598 3q.477-.001.924.122c.31.086.611.22.913.407.577.359 1.154.915 1.782 1.714m1.516 2.224q-.378-.615-.727-1.133L9 6.326c.845-1.305 1.543-1.954 2.372-1.954 1.723 0 3.102 2.537 3.102 5.653 0 1.188-.39 1.877-1.195 1.877-.773 0-1.142-.51-2.61-2.87zM4.846 4.756c.725.1 1.385.634 2.34 2.001A212 212 0 0 0 5.551 9.3c-1.357 2.126-1.826 2.603-2.581 2.603-.777 0-1.24-.682-1.24-1.9 0-2.602 1.298-5.264 2.846-5.264q.137 0 .27.018';

/**
 * El logo de Meta suelto, en su azul, para ponerlo al lado de un texto (el «Asignar campañas» del editor del
 * funnel, 12/10/2026). Sin <BrandDefs>: lleva el trazo adentro, así no depende de que la página lo monte.
 */
export function LogoMeta({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 16 16" style={{ flex: 'none' }}>
      <path fill="#0866FF" fillRule="evenodd" d={PATH_META} />
    </svg>
  );
}

/**
 * Una cámara de videollamada en los verdes de Google Meet, al lado del texto «Asignar evento» de las etapas de reunión
 * (16/10/2026, Martín: «"Asignar evento" con el logo de Meet»). Dibujo propio y simple, sin <BrandDefs>.
 */
export function LogoMeet({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" style={{ flex: 'none' }}>
      <rect x="2" y="6" width="13.5" height="12" rx="2.6" fill="#00AC47" />
      <path d="M15.5 10.4 21.2 6.6c.36-.24.8.02.8.44v9.9c0 .42-.44.68-.8.44l-5.7-3.8z" fill="#00832D" />
      <rect x="2" y="6" width="5" height="5" rx="2.2" fill="#2684FC" />
      <rect x="2" y="13" width="5" height="5" rx="2.2" fill="#FFBA00" />
    </svg>
  );
}

// ── <defs> de todos los símbolos de marca (una sola vez en la página) ─────────
export function BrandDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <linearGradient id="mkGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#F0C60A" /><stop offset="100%" stopColor="#C8870C" /></linearGradient>
      <symbol id="ic-apple" viewBox="0 0 24 24"><path fill="#fff" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></symbol>
      <symbol id="ic-github" viewBox="0 0 16 16"><path fill="#fff" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" /></symbol>
      <symbol id="ic-meta" viewBox="0 0 24 24"><g transform="scale(1.5)"><path fill="#fff" fillRule="evenodd" d={PATH_META} /></g></symbol>
      <symbol id="ic-whatsapp" viewBox="0 0 24 24"><path fill="#fff" d="M12 3.8a8.1 8.1 0 0 0-6.94 12.26L4 20.2l4.25-1.1A8.1 8.1 0 1 0 12 3.8zm4.72 11.43c-.2.56-1.17 1.07-1.62 1.11-.44.04-.86.2-2.9-.6-2.45-.97-4-3.46-4.12-3.62-.12-.16-.98-1.3-.98-2.48s.62-1.76.84-2c.22-.24.48-.3.64-.3h.46c.15 0 .35-.06.54.41l.66 1.6c.05.11.09.24.02.38l-.3.46-.32.35c-.1.1-.21.22-.09.43.12.2.54.9 1.16 1.45.8.71 1.47.93 1.68 1.04.2.11.32.09.44-.05l.63-.73c.16-.2.32-.16.54-.08l1.53.72c.22.11.37.16.42.25.06.09.06.53-.14 1.05z" /></symbol>
      {/* Instagram y Messenger — logos oficiales (simple-icons 13.21.0, `instagram` y `messenger`). El mismo
          trazo vive en lib/canal-social.ts (`GLIFO_SOCIAL`), que es de donde se copia. */}
      <symbol id="ic-instagram" viewBox="0 0 24 24"><path fill="#fff" d={GLIFO_SOCIAL.instagram} /></symbol>
      <symbol id="ic-messenger" viewBox="0 0 24 24"><path fill="#fff" d={GLIFO_SOCIAL.messenger} /></symbol>
      {/* Las redes sociales de /integraciones (29/10/2026) — logos oficiales (simple-icons 13.21.0, mismo slug). */}
      <symbol id="ic-facebook" viewBox="0 0 24 24"><path fill="#fff" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" /></symbol>
      <symbol id="ic-tiktok" viewBox="0 0 24 24"><path fill="#fff" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></symbol>
      <symbol id="ic-x" viewBox="0 0 24 24"><path fill="#fff" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" /></symbol>
      <symbol id="ic-threads" viewBox="0 0 24 24"><path fill="#fff" d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291a13.853 13.853 0 0 1 3.02.142c-.126-.742-.375-1.332-.75-1.757-.513-.586-1.308-.883-2.359-.89h-.029c-.844 0-1.992.232-2.721 1.32L7.734 7.847c.98-1.454 2.568-2.256 4.478-2.256h.044c3.194.02 5.097 1.975 5.287 5.388.108.046.216.094.321.142 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65Zm1.003-11.69c-.242 0-.487.007-.739.021-1.836.103-2.98.946-2.916 2.143.067 1.256 1.452 1.839 2.784 1.767 1.224-.065 2.818-.543 3.086-3.71a10.5 10.5 0 0 0-2.215-.221z" /></symbol>
      <symbol id="ic-linkedin" viewBox="0 0 24 24"><path fill="#fff" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" /></symbol>
      <symbol id="ic-pinterest" viewBox="0 0 24 24"><path fill="#fff" d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z" /></symbol>
      <symbol id="ic-reddit" viewBox="0 0 24 24"><path fill="#fff" d="M12 0C5.373 0 0 5.373 0 12c0 3.314 1.343 6.314 3.515 8.485l-2.286 2.286C.775 23.225 1.097 24 1.738 24H12c6.627 0 12-5.373 12-12S18.627 0 12 0Zm4.388 3.199c1.104 0 1.999.895 1.999 1.999 0 1.105-.895 2-1.999 2-.946 0-1.739-.657-1.947-1.539v.002c-1.147.162-2.032 1.15-2.032 2.341v.007c1.776.067 3.4.567 4.686 1.363.473-.363 1.064-.58 1.707-.58 1.547 0 2.802 1.254 2.802 2.802 0 1.117-.655 2.081-1.601 2.531-.088 3.256-3.637 5.876-7.997 5.876-4.361 0-7.905-2.617-7.998-5.87-.954-.447-1.614-1.415-1.614-2.538 0-1.548 1.255-2.802 2.803-2.802.645 0 1.239.218 1.712.585 1.275-.79 2.881-1.291 4.64-1.365v-.01c0-1.663 1.263-3.034 2.88-3.207.188-.911.993-1.595 1.959-1.595Zm-8.085 8.376c-.784 0-1.459.78-1.506 1.797-.047 1.016.64 1.429 1.426 1.429.786 0 1.371-.369 1.418-1.385.047-1.017-.553-1.841-1.338-1.841Zm7.406 0c-.786 0-1.385.824-1.338 1.841.047 1.017.634 1.385 1.418 1.385.785 0 1.473-.413 1.426-1.429-.046-1.017-.721-1.797-1.506-1.797Zm-3.703 4.013c-.974 0-1.907.048-2.77.135-.147.015-.241.168-.183.305.483 1.154 1.622 1.964 2.953 1.964 1.33 0 2.47-.81 2.953-1.964.057-.137-.037-.29-.184-.305-.863-.087-1.795-.135-2.769-.135Z" /></symbol>
      {/* Resend — logo oficial (simple-icons `resend`, fuente https://resend.com/brand). */}
      <symbol id="ic-resend" viewBox="0 0 24 24"><path fill="#fff" d="M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z" /></symbol>
      {/* Claude — la ráfaga de once radios, en su naranja de marca. El dibujo sale de
          `RafagaClaude` (app/_components/icons.tsx) y no está copiado acá: es la misma
          marca en dos lugares, y copiarla garantizaba que uno de los dos quedara viejo. */}
      <symbol id="ic-claude" viewBox="0 0 24 24"><RafagaClaude /></symbol>
      <symbol id="ic-anthropic" viewBox="0 0 24 24"><path fill="#fff" d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.541Zm-.3712 10.2223 2.2914-5.9456 2.2914 5.9456Z" /></symbol>
      <symbol id="ic-openai" viewBox="0 0 24 24"><path fill="#fff" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.1419.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997z" /></symbol>
      {/* Groq — su mark oficial, pegado tal cual de groq.com/favicon.svg (bajado el 01/11/2026): un RAYO.
          Lo de antes era una «G» dibujada a mano, que no es su logo. El viewBox es el del cuadrado de
          marca del archivo (0.54 0.39 32 32), así que el rayo queda encuadrado como ellos lo encuadran. */}
      <symbol id="ic-groq" viewBox="0.54 0.39 32 32"><path fill="#fff" d="m18.445 4.406-9.468 13.74 7.341.665-1.69 9.578 9.469-13.74-7.342-.664 1.69-9.579Z" /></symbol>
      {/* Gemini — el spark oficial, pegado tal cual (simple-icons 13.21.0 `googlegemini`, fuente declarada
          gemini.google.com). El de antes era un rombo de cuatro puntas hecho con rectas: el real tiene los
          lados CÓNCAVOS (arcos), que es lo que le da la forma de destello y no de estrella. */}
      <symbol id="ic-gemini" viewBox="0 0 24 24"><path fill="#fff" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81" /></symbol>
      {/* Apify — su ícono OFICIAL, pegado tal cual de apify.com/icon0.svg (bajado el 01/11/2026).
          Son DOS CUÑAS que bajan desde arriba (azul #246DFF y verde #20A34E) y un triángulo naranja
          (#F86606) abajo: el logo real. Lo que había eran tres barras inclinadas dibujadas a mano, con
          un verde (#97D700) que tampoco es el suyo. 01/11/2026, Martín: «muchos logos, como por ejemplo
          el de Appify, no son los logos reales de esas empresas». El viewBox recorta al contenido
          (78,22 → 1001,78 en los dos ejes), que es el encuadre del propio archivo. */}
      <symbol id="ic-apify-instagram" viewBox="78 78 924 924">
        <path fill="#246DFF" d="M607.859 78.2218H987.785C995.513 78.2218 1001.78 84.4868 1001.78 92.2151V672.834C1001.78 686.742 983.69 692.134 976.075 680.496L596.15 99.877C590.06 90.5703 596.737 78.2218 607.859 78.2218Z" />
        <path fill="#20A34E" d="M472.141 78.2218H92.215C84.4867 78.2218 78.2217 84.4868 78.2217 92.2151V672.834C78.2217 686.742 96.3094 692.134 103.924 680.496L483.85 99.877C489.94 90.5703 483.263 78.2218 472.141 78.2218Z" />
        <path fill="#F86606" d="M533.491 543.086L101.895 977.927C93.1302 986.758 99.3849 1001.78 111.826 1001.78H968.529C980.919 1001.78 987.197 986.863 978.535 978.003L553.429 543.161C547.969 537.576 538.993 537.542 533.491 543.086Z" />
      </symbol>
      {/* ElevenLabs — su mark oficial, pegado tal cual (simple-icons 13.21.0 `elevenlabs`, fuente declarada
          elevenlabs.io/press): dos barras que ocupan TODO el alto y tienen las esquinas rectas. Las de
          antes eran dos rectángulos redondeados de medio alto, dibujados a ojo. */}
      <symbol id="ic-elevenlabs" viewBox="0 0 24 24"><path fill="#000" d="M4.6035 0v24h4.9317V0zm9.8613 0v24h4.9317V0z" /></symbol>
      <symbol id="ic-pexels" viewBox="0 0 24 24"><path fill="#05A081" d="M1.5 0A1.5 1.5 0 000 1.5v21A1.5 1.5 0 001.5 24h21a1.5 1.5 0 001.5-1.5v-21A1.5 1.5 0 0022.5 0h-21zm6.75 6.75h5.2715a3.843 3.843 0 01.627 7.6348V17.25H8.25V6.75zm1.5 1.5v7.5h2.8984v-2.8145h.873a2.343 2.343 0 100-4.6855H9.75Z" /></symbol>
      {/* Creem — su ícono oficial, pegado tal cual de creem.io/new-branding/Logo/SVG/«creem logo icon_black.svg»
          (bajado el 01/11/2026), en su negro #151617. */}
      <symbol id="ic-creem" viewBox="0 0 121 121"><path fill="#151617" d="M22.1102 11C24.1187 11.0001 25.9669 12.0982 26.9281 13.8619L51.2059 58.4106C52.5699 60.9134 55.7048 61.8368 58.2077 60.473C60.7108 59.109 61.6342 55.9742 60.2701 53.4712L41.5466 19.113C39.554 15.4566 42.2004 11 46.3645 11H103.806C107.885 11 110.539 15.2933 108.715 18.9416L65.0579 106.254C63.0356 110.298 57.2654 110.298 55.2431 106.254L11.5863 18.9416C9.76212 15.2933 12.4156 11 16.4946 11H22.1102Z" /></symbol>
      {/* Fathom (fathom.video, el grabador de reuniones) — mark oficial, extraído de su
          propio wordmark: cdn.prod.website-files.com/…/68e7961f4ff1cd5e326512f7_logo-wordmark-new.svg
          Verificado contra su favicon (mark #00BEFF/#007299 sobre negro).
          OJO: el "Fathom" de simple-icons es Fathom Analytics (usefathom.com), OTRA empresa.
          El mark vive en x 141.42→165.88, y 0→24.95 del wordmark → lo encuadramos a 24×24. */}
      <symbol id="ic-fathom" viewBox="0 0 24 24">
        <g transform="translate(.24 0) scale(.962) translate(-141.42 .043)">
          <path fill="#007299" d="M141.836 16.4481V21.3875C141.836 22.6831 142.645 23.8563 143.861 24.2456C145.927 24.9052 147.825 23.3578 147.825 21.3606V19.501L141.836 16.4481Z" />
          <path fill="#00BEFF" d="M162.465 15.4261C162.015 15.4261 161.559 15.3237 161.128 15.1055L143.553 6.19528C142.097 5.45682 141.42 3.67948 142.099 2.17906C142.807 0.60815 144.65 -0.0430392 146.16 0.722275L163.733 9.63081C165.207 10.3777 165.882 12.249 165.144 13.7444C164.619 14.8101 163.562 15.4261 162.462 15.4261H162.465Z" />
          <path fill="#00BEFF" d="M153.644 19.9273C153.194 19.9273 152.737 19.8249 152.307 19.6068L143.553 15.1693C142.097 14.4308 141.42 12.6535 142.099 11.153C142.807 9.58214 144.65 8.93095 146.162 9.69626L154.913 14.1321C156.387 14.8789 157.062 16.7502 156.324 18.2456C155.799 19.3114 154.742 19.9273 153.642 19.9273H153.644Z" />
        </g>
      </symbol>
      {/* Loom, Zoom y Google Meet — logos oficiales (simple-icons 13.21.0 `loom`, `zoom`, `googlemeet`; fuentes declaradas
          loom.com/press, brand.zoom.us y about.google/brand-resource-center). Bajados de
          cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/<nombre>.svg el 26/10/2026 y pegados tal cual, en blanco. */}
      <symbol id="ic-loom" viewBox="0 0 24 24"><path fill="#fff" d="M24 10.665h-7.018l6.078-3.509-1.335-2.312-6.078 3.509 3.508-6.077L16.843.94l-3.508 6.077V0h-2.67v7.018L7.156.94 4.844 2.275l3.509 6.077-6.078-3.508L.94 7.156l6.078 3.509H0v2.67h7.017L.94 16.844l1.335 2.313 6.077-3.508-3.509 6.077 2.312 1.335 3.509-6.078V24h2.67v-7.017l3.508 6.077 2.312-1.335-3.509-6.078 6.078 3.509 1.335-2.313-6.077-3.508h7.017v-2.67H24zm-12 4.966a3.645 3.645 0 1 1 0-7.29 3.645 3.645 0 0 1 0 7.29z" /></symbol>
      <symbol id="ic-zoom" viewBox="0 0 24 24"><path fill="#fff" d="M5.033 14.649H.743a.74.74 0 0 1-.686-.458.74.74 0 0 1 .16-.808L3.19 10.41H1.06A1.06 1.06 0 0 1 0 9.35h3.957c.301 0 .57.18.686.458a.74.74 0 0 1-.161.808L1.51 13.59h2.464c.585 0 1.06.475 1.06 1.06zM24 11.338c0-1.14-.927-2.066-2.066-2.066-.61 0-1.158.265-1.537.686a2.061 2.061 0 0 0-1.536-.686c-1.14 0-2.066.926-2.066 2.066v3.311a1.06 1.06 0 0 0 1.06-1.06v-2.251a1.004 1.004 0 0 1 2.013 0v2.251c0 .586.474 1.06 1.06 1.06v-3.311a1.004 1.004 0 0 1 2.012 0v2.251c0 .586.475 1.06 1.06 1.06zM16.265 12a2.728 2.728 0 1 1-5.457 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0zm-4.82 0a2.728 2.728 0 1 1-5.458 0 2.728 2.728 0 0 1 5.457 0zm-1.06 0a1.669 1.669 0 1 0-3.338 0 1.669 1.669 0 0 0 3.338 0z" /></symbol>
      <symbol id="ic-googlemeet" viewBox="0 0 24 24"><path fill="#fff" d="M5.53 2.13 0 7.75h5.53zm.398 0v5.62h7.608v3.65l5.47-4.45c-.014-1.22.031-2.25-.025-3.46-.148-1.09-1.287-1.47-2.236-1.36zM23.1 4.32c-.802.295-1.358.995-2.047 1.49-2.506 2.05-4.982 4.12-7.468 6.19 3.025 2.59 6.04 5.18 9.065 7.76 1.218.671 1.428-.814 1.328-1.64v-13a.828.828 0 0 0-.877-.825zM.038 8.15v7.7h5.53v-7.7zm13.577 8.1H6.008v5.62c3.864-.006 7.737.011 11.58-.009 1.02-.07 1.618-1.12 1.468-2.07v-2.51l-5.47-4.68v3.65zm-13.577 0c.02 1.44-.041 2.88.033 4.31.162.948 1.158 1.43 2.047 1.31h3.464v-5.62z" /></symbol>
      {/* Calendly — logo oficial (simple-icons `calendly`, fuente https://calendly.com/newsroom). */}
      {/* Cal.com — mark oficial, bajado de cal.com/api/logo?type=icon y pegado tal
          cual, con su color de marca. El viewBox está encuadrado al contenido (el
          original es 56×56 con mucho aire y en un tile de 34 px se veía diminuto);
          es el mismo recorte que ya lleva ic-panda. */}
      <symbol id="ic-calcom" viewBox="8.9 9.1 38 38"><path fill="#292929" d="M18.628 36.781c2.846 0 4.946-1.096 6.183-2.59l-2.38-2.03c-.957 1.05-2.147 1.587-3.733 1.587-3.22 0-5.204-2.427-5.204-5.413 0-2.987 1.984-5.46 5.134-5.46 1.47 0 2.683.513 3.663 1.54l2.31-2.007c-1.47-1.75-3.313-2.567-5.973-2.567-5.04 0-8.517 3.803-8.517 8.493 0 4.667 3.663 8.447 8.517 8.447ZM31.69 36.781c2.17 0 3.267-.91 3.92-2.286v1.983h3.057V24.344H35.54v1.914c-.653-1.307-1.75-2.17-3.85-2.17-3.337 0-5.997 2.87-5.997 6.37s2.66 6.323 5.997 6.323Zm-2.847-6.346c0-1.89 1.354-3.5 3.36-3.5 2.077 0 3.407 1.633 3.407 3.523 0 1.89-1.33 3.477-3.407 3.477-2.006 0-3.36-1.657-3.36-3.5ZM41.472 36.478h3.15V19.444h-3.15v17.034Z" /></symbol>
      <symbol id="ic-calendly" viewBox="0 0 24 24"><path fill="#fff" d="M19.655 14.262c.281 0 .557.023.828.064 0 .005-.005.01-.005.014-.105.267-.234.534-.381.786l-1.219 2.106c-1.112 1.936-3.177 3.127-5.411 3.127h-2.432c-2.23 0-4.294-1.191-5.412-3.127l-1.218-2.106a6.251 6.251 0 0 1 0-6.252l1.218-2.106C6.736 4.832 8.8 3.641 11.035 3.641h2.432c2.23 0 4.294 1.191 5.411 3.127l1.219 2.106c.147.252.271.519.381.786 0 .004.005.009.005.014-.267.041-.543.064-.828.064-1.816 0-2.501-.607-3.291-1.306-.764-.676-1.711-1.517-3.44-1.517h-1.029c-1.251 0-2.387.455-3.2 1.278-.796.805-1.233 1.904-1.233 3.099v1.411c0 1.196.437 2.295 1.233 3.099.813.823 1.949 1.278 3.2 1.278h1.034c1.729 0 2.676-.841 3.439-1.517.791-.703 1.471-1.306 3.287-1.301Zm.005-3.237c.399 0 .794-.036 1.179-.11-.002-.004-.002-.01-.002-.014-.073-.414-.193-.823-.349-1.218.731-.12 1.407-.396 1.986-.819 0-.004-.005-.013-.005-.018-.331-1.085-.832-2.101-1.489-3.03-.649-.915-1.435-1.719-2.331-2.395-1.867-1.398-4.088-2.138-6.428-2.138-1.448 0-2.855.28-4.175.841-1.273.543-2.423 1.315-3.407 2.299S2.878 6.552 2.341 7.83c-.557 1.324-.842 2.726-.842 4.175 0 1.448.281 2.855.842 4.174.542 1.274 1.314 2.423 2.298 3.407s2.129 1.761 3.407 2.299c1.324.556 2.727.841 4.175.841 2.34 0 4.561-.74 6.428-2.137a10.815 10.815 0 0 0 2.331-2.396c.652-.929 1.158-1.949 1.489-3.03 0-.004.005-.014.005-.018-.579-.423-1.255-.699-1.986-.819.161-.395.276-.804.349-1.218.005-.009.005-.014.005-.023.869.166 1.692.506 2.404 1.035.685.505.552 1.075.446 1.416C22.184 20.437 17.619 24 12.221 24c-6.625 0-12-5.375-12-12s5.37-12 12-12c5.398 0 9.963 3.563 11.471 8.464.106.341.239.915-.446 1.421-.717.529-1.535.873-2.404 1.034.128.716.128 1.45 0 2.166-.387-.074-.782-.11-1.182-.11-4.184 0-3.968 2.823-6.736 2.823h-1.029c-1.899 0-3.15-1.357-3.15-3.095v-1.411c0-1.738 1.251-3.094 3.15-3.094h1.034c2.768 0 2.552 2.823 6.731 2.827Z" /></symbol>
      {/* YouTube — su mark oficial, pegado tal cual (simple-icons 13.21.0 `youtube`, fuente declarada
          youtube.com/howyoutubeworks/resources/brand-resources). El de antes era un rectángulo con un
          triángulo, redondeado a ojo: ni las esquinas ni el play eran los suyos. */}
      <symbol id="ic-youtube" viewBox="0 0 24 24"><path fill="#fff" d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></symbol>
      {/* La «G» de Google — los cuatro trazos oficiales, pegados tal cual del PROPIO CDN de logos de
          producto de Google (fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg, bajado el
          01/11/2026). Los de antes eran los mismos cuatro colores con una geometría aproximada: la
          abertura de la «G» y el largo de la barra no coincidían con el logo real. */}
      <symbol id="ic-google" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></symbol>
      {/* Panda Video — logo OFICIAL. Salió del SVG inline de su sitio: es un sitio
          Framer y el logo vive dentro del sprite #svg-templates, no como archivo
          suelto (ojo: los .svg de framerusercontent son un PNG envuelto en <image>,
          no son vectores). Se le sacó el wordmark "pandavideo" y quedó la marca; el
          viewBox es su bbox real medida con getBBox, no estimada.
          OJO: los paths BLANCOS son rellenos macizos (tapan por debajo de las orejas
          y del triángulo), así que este logo NECESITA fondo claro — por eso ICON.panda
          va con bg blanco + borde, como google. Sobre un tile de color se rompe.
          Su color de marca es #232536 (no #2F2F2F): verificado decodificando la
          paleta PLTE de su favicon oficial. */}
      <symbol id="ic-panda" viewBox="-0.3 0.1 38.45 38.45"><path d="M15.7855 4.28538L15.7844 4.28463L15.7813 4.28268C13.3171 2.65747 10.3959 2.67473 8.0982 3.78454C5.79881 4.89514 4 7.17406 4 10.1354V28.8665C4 31.8281 5.79908 34.1058 8.09847 35.2158C10.3873 36.3208 13.2947 36.3419 15.7529 34.7381L30.7398 25.9877L30.7472 25.9833L30.7541 25.9788L30.7736 25.9658C35.0748 23.1343 35.0754 17.0928 30.7757 14.2603L30.7734 14.2588L15.7855 4.28538Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M16.1641 1.69433L16.1807 1.70428L16.2022 1.71864L32.7824 12.416L32.9208 12.5006L32.9362 12.5159C38.4804 16.1868 38.4332 23.923 32.7945 27.5246L32.7918 27.5263L32.7688 27.5411L32.7316 27.5648L32.6862 27.5908L16.1129 36.973C12.9239 38.9741 9.17164 38.935 6.22709 37.5568C3.25831 36.1672 0.822266 33.2498 0.822266 29.3778V9.25698C0.822266 5.38547 3.25764 2.4668 6.22651 1.07646C9.18676 -0.309869 12.964 -0.342469 16.1641 1.69433ZM14.5666 4.2337C12.3105 2.79099 9.62402 2.79804 7.49884 3.7933C5.37272 4.78897 3.82227 6.7663 3.82227 9.25698V29.3778C3.82227 31.8684 5.37264 33.8444 7.49886 34.8397C9.61595 35.8306 12.2905 35.8412 14.5414 34.4173L14.5724 34.3977L31.1797 24.9962C34.9001 22.6198 35.0153 17.7207 31.5259 15.1879H31.3655L31.0389 14.8613L14.585 4.24542L14.5666 4.2337Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M7.01009 2.7532C9.45819 1.60668 12.5673 1.59083 15.1875 3.2663L15.1909 3.2684L31.7976 13.9829L31.7997 13.9843C36.3476 16.8891 36.3469 23.0617 31.7976 25.9655L31.776 25.9793L15.1644 35.3833C12.5492 37.0413 9.45119 37.0223 7.01029 35.88C4.56059 34.7334 2.67139 32.3965 2.67139 29.3778V9.2571C2.67139 6.2385 4.56039 3.9004 7.01009 2.7532ZM7.83069 4.537C5.92749 5.4283 4.62049 7.1501 4.62049 9.2571V29.3778C4.62049 31.4846 5.92719 33.2051 7.83049 34.0959C9.73539 34.9876 12.1366 34.989 14.1447 33.7071L14.1665 33.6933L30.7767 24.2902C34.096 22.1529 34.089 17.7726 30.7557 15.6449L30.7515 15.6423L14.1441 4.9274L14.1425 4.9263C12.135 3.6435 9.73499 3.6452 7.83069 4.537Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M12.339 14.7021C14.1568 14.7021 15.6258 16.1893 15.6258 18.0183C15.6258 21.2603 13.0269 23.8827 9.81379 23.8775H3.17139V14.7021H12.339ZM11.4523 20.4355C10.3942 20.5818 9.41949 19.8354 9.27449 18.7679C9.12949 17.7002 9.86919 16.7168 10.9274 16.5705C11.9855 16.424 12.9602 17.1706 13.1053 18.2383C13.2503 19.3058 12.5105 20.2892 11.4523 20.4355Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M24.8926 14.7021C23.0798 14.7021 21.6108 16.1893 21.6108 18.0183C21.6108 21.2603 24.2099 23.8827 27.413 23.8775H32.3456C32.8812 23.8775 33.3922 23.6646 33.7704 23.2828C34.1489 22.906 34.36 22.3904 34.36 21.8503V17.9689C34.36 17.1062 34.0211 16.2735 33.412 15.6589C32.8074 15.0442 31.982 14.7021 31.1224 14.7021H24.8926ZM25.313 20.2742C26.3711 20.4205 27.3457 19.6744 27.4908 18.6067C27.6367 17.5324 26.897 16.5487 25.8379 16.4093C24.7797 16.263 23.8051 17.0093 23.6601 18.077C23.5151 19.1447 24.2548 20.128 25.313 20.2742Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M13.4985 8.766C14.0001 8.4776 14.2887 7.9208 14.2292 7.338C14.1697 6.7553 13.7798 6.2671 13.2287 6.0856C11.7669 5.6041 10.1814 5.7284 8.81227 6.4299C7.44307 7.1313 6.40657 8.3543 5.93087 9.8245L5.69297 10.5596C5.50697 11.1345 5.69727 11.7604 6.17187 12.1305C6.64647 12.5006 7.29297 12.531 7.80057 12.208C9.19797 11.3073 10.5073 10.4715 10.5073 10.4715C10.5073 10.4715 12.0138 9.6171 13.4985 8.766Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M19.7902 23.4977C19.7902 23.3008 19.7123 23.1139 19.5775 22.9753C19.4397 22.837 19.2537 22.7593 19.0589 22.7593C18.5822 22.7593 17.9586 22.7593 17.4821 22.7593C17.287 22.7593 17.1013 22.837 16.9635 22.9753C16.8254 23.1139 16.7505 23.3008 16.7505 23.4977C16.7505 23.6919 16.8285 23.8815 16.9635 24.0201C17.1013 24.1584 17.287 24.2361 17.4821 24.2361C17.9586 24.2361 18.5822 24.2361 19.0589 24.2361C19.2537 24.2361 19.4397 24.1584 19.5775 24.0201C19.7123 23.8815 19.7902 23.6945 19.7902 23.4977Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M16.8182 22.8305C16.9942 22.6539 17.232 22.5542 17.4821 22.5542H19.0589C19.3086 22.5542 19.5468 22.6539 19.7228 22.8305L19.7245 22.8323C19.8959 23.0085 19.9953 23.2465 19.9953 23.4977C19.9953 23.7488 19.8959 23.9868 19.7245 24.163L19.7228 24.1648C19.5468 24.3415 19.3086 24.4411 19.0589 24.4411H17.4821C17.232 24.4411 16.9942 24.3414 16.8182 24.1648L16.8166 24.1632C16.6447 23.9867 16.5454 23.7459 16.5454 23.4977C16.5454 23.2484 16.6406 23.0089 16.8182 22.8305ZM17.4821 22.9643C17.3419 22.9643 17.2084 23.02 17.1088 23.12C17.0102 23.2189 16.9556 23.3532 16.9556 23.4977C16.9556 23.6375 17.012 23.7755 17.1096 23.8762C17.2091 23.9756 17.3423 24.031 17.4821 24.031H19.0589C19.1984 24.031 19.3319 23.9756 19.4314 23.8762C19.529 23.7753 19.5851 23.6398 19.5851 23.4977C19.5851 23.3555 19.529 23.22 19.4314 23.1191C19.3319 23.0197 19.1984 22.9643 19.0589 22.9643H17.4821Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M14.1666 25.8098C14.1666 25.8098 14.6248 26.3471 15.3458 26.6664C15.7853 26.8611 16.3134 26.976 16.8923 26.8822C17.6251 26.7626 18.153 26.4293 18.5229 25.9928C18.9204 25.5212 19.1323 24.9157 19.1623 24.2775C19.1856 23.7823 18.8066 23.3598 18.3157 23.3364C17.825 23.3128 17.4065 23.6954 17.3832 24.193C17.3716 24.4252 17.3134 24.6553 17.1667 24.8266C17.0436 24.9719 16.8553 25.0658 16.6111 25.1058C16.4063 25.1386 16.2203 25.0894 16.0643 25.019C15.7296 24.871 15.5108 24.6269 15.5108 24.6269C15.1876 24.2539 14.6248 24.2141 14.2526 24.5403C13.8805 24.8664 13.8433 25.4365 14.1666 25.8098Z" fill="#232536" /><path fillRule="evenodd" clipRule="evenodd" d="M21.0334 24.6269C21.0334 24.6269 20.8171 24.871 20.4799 25.019C20.3241 25.0871 20.1379 25.1386 19.9333 25.1058C19.6891 25.0658 19.5006 24.9719 19.3775 24.8266C19.2308 24.6529 19.1729 24.4252 19.1612 24.193C19.1379 23.6978 18.7192 23.3128 18.2285 23.3364C17.7378 23.3598 17.3586 23.7823 17.3819 24.2775C17.4122 24.9157 17.6217 25.5212 18.0216 25.9928C18.3891 26.4293 18.9194 26.7626 19.6519 26.8822C20.231 26.976 20.759 26.8611 21.1987 26.6664C21.9219 26.3472 22.3779 25.8098 22.3779 25.8098C22.7012 25.4365 22.6639 24.8664 22.2917 24.5403C21.9195 24.2141 21.3567 24.2539 21.0334 24.6269Z" fill="#232536" /><path d="M28 4C26.5 4 24 4.5 22.5 6.5L30 12.5C30.8333 13.1667 32.9802 14.5198 34 13.5C35 12.5 35.3438 11.3751 35 10C34 6 30.5 4 28 4Z" fill="white" /><path fillRule="evenodd" clipRule="evenodd" d="M25.373 8.76318C24.873 8.47948 24.589 7.92118 24.6439 7.33988C24.7003 6.76338 25.0901 6.27518 25.6411 6.09368C27.1029 5.61218 28.6978 5.73348 30.0686 6.43968C31.4392 7.14578 32.4804 8.36718 32.9575 9.84218L33.1924 10.5679C33.3784 11.1428 33.188 11.7686 32.7134 12.1388C32.239 12.5089 31.5923 12.5393 31.0847 12.2163C29.6874 11.3156 28.3783 10.4797 28.3783 10.4797C28.3783 10.4797 26.8625 9.61278 25.373 8.76318Z" fill="#232536" /></symbol>
      <symbol id="ic-supabase" viewBox="0 0 24 24"><path fill="#3ECF8E" d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L2.203 12.424l-.401.562a1.04 1.04 0 0 0 .836 1.659H12v8.959a.396.396 0 0 0 .716.233l9.081-12.261.401-.562a1.04 1.04 0 0 0-.836-1.66z" /></symbol>
      {/* Stripe — logo oficial (simple-icons 13.21.0 `stripe`, fuente declarada
          https://stripe.com/newsroom/information). Bajado de
          cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/stripe.svg el 11/10/2026 y pegado tal cual. */}
      <symbol id="ic-vimeo" viewBox="0 0 24 24"><path fill="#fff" d="M23.9765 6.4168c-.105 2.338-1.739 5.5429-4.894 9.6088-3.2679 4.247-6.0258 6.3699-8.2898 6.3699-1.409 0-2.578-1.294-3.553-3.881l-1.9179-7.1138c-.719-2.584-1.488-3.878-2.312-3.878-.179 0-.806.378-1.8809 1.132l-1.129-1.457a315.06 315.06 0 003.501-3.1279c1.579-1.368 2.765-2.085 3.5539-2.159 1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.5069.5389 2.45 1.1309 3.674 1.7759 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.8679 3.434-5.7568 6.7619-5.6368 2.4729.06 3.6279 1.664 3.4929 4.7969z" /></symbol>
      <symbol id="ic-wistia" viewBox="0 0 24 24"><path fill="#fff" d="M23.69 6.605c.507-3.094-1.24-3.944-1.24-3.944s.073 2.519-4.555 3.053C13.787 6.188 0 5.83 0 5.83l4.43 5.081c1.2 1.378 1.838 1.537 3.187 1.633 1.349.09 4.327.058 6.345-.096 2.206-.169 5.35-.888 7.477-2.535 1.09-.843 2.039-2.016 2.25-3.308m.284 3.205s-.556 1.105-3.33 2.853c-1.182.744-3.637 1.535-6.793 1.84-1.705.166-4.842.031-6.188.031-1.354 0-1.974.285-3.187 1.652L0 21.23s1.55.008 2.72.008c1.17 0 8.488.425 11.735-.468 10.546-2.899 9.518-10.96 9.518-10.96Z" /></symbol>
      <symbol id="ic-cloudflare" viewBox="0 0 24 24"><path fill="#fff" d="M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727" /></symbol>
      <symbol id="ic-stripe" viewBox="0 0 24 24"><path fill="#fff" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" /></symbol>
      {/* Mercado Pago — logo oficial (simple-icons 13.21.0 `mercadopago`, fuente declarada
          https://www.mercadopago.com). Bajado de cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/mercadopago.svg
          el 11/10/2026 y pegado tal cual: el apretón de manos dentro del óvalo. */}
      {/* Zernio — su ícono oficial (zernio.com/icon.svg, bajado el 25/10/2026): la marca blanca, pegada tal cual. El
          cuadrado rojo del archivo es el tile (`bg` #EB3514); el viewBox recorta al glifo para que pese como los demás. */}
      <symbol id="ic-zernio" viewBox="235 238 525 525"><path fill="#fff" d="M253.803 294.019L253.803 478.63L540.935 403.248C576.717 393.854 609.198 426.823 599.272 462.46L519.204 749.918L702.287 749.918L740.228 563.688C743.395 548.144 738.664 532.039 727.593 520.677L483.105 269.754C471.726 258.076 455.189 252.984 439.212 256.24L253.803 294.019Z" /></symbol>
      <symbol id="ic-mercadopago" viewBox="0 0 24 24"><path fill="#fff" d="M11.115 16.479a.93.927 0 0 1-.939-.886c-.002-.042-.006-.155-.103-.155-.04 0-.074.023-.113.059-.112.103-.254.206-.46.206a.816.814 0 0 1-.305-.066c-.535-.214-.542-.578-.521-.725.006-.038.007-.08-.02-.11l-.032-.03h-.034c-.027 0-.055.012-.093.039a.788.786 0 0 1-.454.16.7.699 0 0 1-.253-.05c-.708-.27-.65-.928-.617-1.126.005-.041-.005-.072-.03-.092l-.05-.04-.047.043a.728.726 0 0 1-.505.203.73.728 0 0 1-.732-.725c0-.4.328-.722.732-.722.364 0 .675.27.721.63l.026.195.11-.165c.01-.018.307-.46.852-.46.102 0 .21.016.316.05.434.13.508.52.519.68.008.094.075.1.09.1.037 0 .064-.024.083-.045a.746.744 0 0 1 .54-.225c.128 0 .263.03.402.09.69.293.379 1.158.374 1.167-.058.144-.061.207-.005.244l.027.013h.02c.03 0 .07-.014.134-.035.093-.032.235-.08.367-.08a.944.942 0 0 1 .94.93.936.934 0 0 1-.94.928zm7.302-4.171c-1.138-.98-3.768-3.24-4.481-3.77-.406-.302-.685-.462-.928-.533a1.559 1.554 0 0 0-.456-.07c-.182 0-.376.032-.58.095-.46.145-.918.505-1.362.854l-.023.018c-.414.324-.84.66-1.164.73a1.986 1.98 0 0 1-.43.049c-.362 0-.687-.104-.81-.258-.02-.025-.007-.066.04-.125l.008-.008 1-1.067c.783-.774 1.525-1.506 3.23-1.545h.085c1.062 0 2.12.469 2.24.524a7.03 7.03 0 0 0 3.056.724c1.076 0 2.188-.263 3.354-.795a9.135 9.11 0 0 0-.405-.317c-1.025.44-2.003.66-2.946.66-.962 0-1.925-.229-2.858-.68-.05-.022-1.22-.567-2.44-.57-.032 0-.065 0-.096.002-1.434.033-2.24.536-2.782.976-.528.013-.982.138-1.388.25-.361.1-.673.186-.979.185-.125 0-.35-.01-.37-.012-.35-.01-2.115-.437-3.518-.962-.143.1-.28.203-.415.31 1.466.593 3.25 1.053 3.812 1.089.157.01.323.027.491.027.372 0 .744-.103 1.104-.203.213-.059.446-.123.692-.17l-.196.194-1.017 1.087c-.08.08-.254.294-.14.557a.705.703 0 0 0 .268.292c.243.162.677.27 1.08.271.152 0 .297-.015.43-.044.427-.095.874-.448 1.349-.82.377-.296.913-.672 1.323-.782a1.494 1.49 0 0 1 .37-.05.611.61 0 0 1 .095.005c.27.034.533.125 1.003.472.835.62 4.531 3.815 4.566 3.846.002.002.238.203.22.537-.007.186-.11.352-.294.466a.902.9 0 0 1-.484.15.804.802 0 0 1-.428-.124c-.014-.01-1.28-1.157-1.746-1.543-.074-.06-.146-.115-.22-.115a.122.122 0 0 0-.096.045c-.073.09.01.212.105.294l1.48 1.47c.002 0 .184.17.204.395.012.244-.106.447-.35.606a.957.955 0 0 1-.526.171.766.764 0 0 1-.42-.127l-.214-.206a21.035 20.978 0 0 0-1.08-1.009c-.072-.058-.148-.112-.221-.112a.127.127 0 0 0-.094.038c-.033.037-.056.103.028.212a.698.696 0 0 0 .075.083l1.078 1.198c.01.01.222.26.024.511l-.038.048a1.18 1.178 0 0 1-.1.096c-.184.15-.43.164-.527.164a.8.798 0 0 1-.147-.012c-.106-.018-.178-.048-.212-.089l-.013-.013c-.06-.06-.602-.609-1.054-.98-.059-.05-.133-.11-.21-.11a.128.128 0 0 0-.096.042c-.09.096.044.24.1.293l.92 1.003a.204.204 0 0 1-.033.062c-.033.044-.144.155-.479.196a.91.907 0 0 1-.122.007c-.345 0-.712-.164-.902-.264a1.343 1.34 0 0 0 .13-.576 1.368 1.365 0 0 0-1.42-1.357c.024-.342-.025-.99-.697-1.274a1.455 1.452 0 0 0-.575-.125c-.146 0-.287.025-.42.075a1.153 1.15 0 0 0-.671-.564 1.52 1.515 0 0 0-.494-.085c-.28 0-.537.08-.767.242a1.168 1.165 0 0 0-.903-.43 1.173 1.17 0 0 0-.82.335c-.287-.217-1.425-.93-4.467-1.613a17.39 17.344 0 0 1-.692-.189 4.822 4.82 0 0 0-.077.494l.67.157c3.108.682 4.136 1.391 4.309 1.525a1.145 1.142 0 0 0-.09.442 1.16 1.158 0 0 0 1.378 1.132c.096.467.406.821.879 1.003a1.165 1.162 0 0 0 .415.08c.09 0 .179-.012.266-.034.086.22.282.493.722.668a1.233 1.23 0 0 0 .457.094c.122 0 .241-.022.355-.063a1.373 1.37 0 0 0 1.269.841c.37.002.726-.147.985-.41.221.121.688.341 1.163.341.06 0 .118-.002.175-.01.47-.059.689-.24.789-.382a.571.57 0 0 0 .048-.078c.11.032.234.058.373.058.255 0 .501-.086.75-.265.244-.174.418-.424.444-.637v-.01c.083.017.167.026.251.026.265 0 .527-.082.773-.242.48-.31.562-.715.554-.98a1.28 1.279 0 0 0 .978-.194 1.04 1.04 0 0 0 .502-.808 1.088 1.085 0 0 0-.16-.653c.804-.342 2.636-1.003 4.795-1.483a4.734 4.721 0 0 0-.067-.492 27.742 27.667 0 0 0-5.049 1.62zm5.123-.763c0 4.027-5.166 7.293-11.537 7.293-6.372 0-11.538-3.266-11.538-7.293 0-4.028 5.165-7.293 11.539-7.293 6.371 0 11.537 3.265 11.537 7.293zm.46.004c0-4.272-5.374-7.755-12-7.755S.002 7.277.002 11.55L0 12.004c0 4.533 4.695 8.203 11.999 8.203 7.347 0 12-3.67 12-8.204z" /></symbol>
      {/* Landing: ventana de navegador con el play del VSL adentro. */}
      {/* La estrella de MaKo (app/_components/MakoBrand.tsx, SPARK), en el dorado de la marca (--mako, #F2B01E). */}
      <symbol id="ic-mako" viewBox="-12 -12 24 24"><path fill="#F2B01E" d="M0 -11 C1 -4 4 -1 11 0 C4 1 1 4 0 11 C-1 4 -4 1 -11 0 C-4 -1 -1 -4 0 -11 Z" /><circle cx="8.5" cy="-8.5" r="1.6" fill="#F8CB63" /></symbol>
      <symbol id="ic-landing" viewBox="0 0 24 24"><path fill="#fff" d="M4 3.5h16a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 19V5A1.5 1.5 0 0 1 4 3.5zm0 5V19h16V8.5zm1.6-3.1a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8zm2.6 0a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8z" /><path fill="#7C5CFF" d="M10.4 11.3v4.9l4.3-2.45z" /></symbol>
    </defs></svg>
  );
}
