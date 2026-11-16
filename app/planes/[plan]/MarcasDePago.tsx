// Los logos de las formas de pago del checkout (14/11/2026, Martín: «hace falta justamente un botón bien distintivo para que se pueda
// pagar también con Mercado Pago, con el logo de Mercado Pago… si vas a poner Visa, Mastercard o Amex, pon los logos»).
//
// MERCADO PAGO: SU LOGO DE VERDAD, EN UN ARCHIVO (16/11/2026, la cuarta vuelta). Martín: «Sigue estando mal el logo de Mercado
// Pago… encuentra un logo bueno». Las tres anteriores eran el apretón de manos de simple-icons, que es UN trazo de UN color (en
// blanco, en azul oscuro #2D3277 y en su celeste): el logo real son tres colores —el óvalo celeste, la mano blanca y el borde azul
// oscuro— y con uno solo la mano se volvía una mancha. Ahora es public/logos/mercadopago.png (256 × 178, recortado de la captura que
// mandó Martín, con el fondo transparente): se ve bien sobre blanco, sobre negro y sobre celeste. Es el mismo archivo que usan «Tus
// apps, conectadas» y la tira de la portada (app/_components/ServicioVisual.tsx), así que no hay dos versiones del logo.
// STRIPE (el pie, 16/11/2026: «en lugar de poner la palabra Mercado Pago y Stripe, poner los logos»): su ícono, la «S» blanca de su
// marca (simple-icons `stripe`, el mismo trazo de ServicioVisual) sobre su violeta #635BFF.
// Visa, Mastercard y American Express: sus marcas dibujadas con sus colores (Visa, la palabra en su azul; Mastercard, los dos
// círculos que se cruzan; Amex, la caja azul con su nombre), al tamaño de una fila de pago.

/** El logo de Mercado Pago: el archivo, del alto que se pida y con su proporción (el óvalo es más ancho que alto). */
export const LOGO_MP = { src: '/logos/mercadopago.png', ancho: 256, alto: 178 } as const;

/** `alto`: el del óvalo, en px. `etiqueta`: si va solo (sin el nombre escrito al lado), lo que lee el lector de pantalla. */
export function LogoMercadoPago({ alto = 22, etiqueta }: { alto?: number; etiqueta?: string }) {
  const ancho = Math.round((alto * LOGO_MP.ancho) / LOGO_MP.alto);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- un logo de 22 px servido de /public: next/image sólo suma un wrapper.
    <img className="ck-logo-mp" src={LOGO_MP.src} width={ancho} height={alto} alt={etiqueta ?? ''} aria-hidden={etiqueta ? undefined : true} decoding="async" style={{ display: 'block' }} />
  );
}

/** El ícono de Stripe: la «S» de su marca en blanco sobre su violeta. */
export function LogoStripe({ size = 18, etiqueta }: { size?: number; etiqueta?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role={etiqueta ? 'img' : undefined} aria-label={etiqueta} aria-hidden={etiqueta ? undefined : true} focusable="false" style={{ display: 'block' }}>
      <rect width="24" height="24" rx="5" fill="#635BFF" />
      <g transform="translate(5.3 5.4) scale(.55)">
        <path fill="#fff" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
      </g>
    </svg>
  );
}

export function LogoVisa() {
  return (
    <svg width="38" height="24" viewBox="0 0 38 24" aria-label="Visa" role="img">
      <rect x=".5" y=".5" width="37" height="23" rx="4" fill="#fff" stroke="#E3E5EA" />
      <text x="19" y="16.2" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="11" fontWeight="900" fontStyle="italic" fill="#1A1F71" letterSpacing=".4">VISA</text>
    </svg>
  );
}

export function LogoMastercard() {
  return (
    <svg width="38" height="24" viewBox="0 0 38 24" aria-label="Mastercard" role="img">
      <rect x=".5" y=".5" width="37" height="23" rx="4" fill="#fff" stroke="#E3E5EA" />
      <circle cx="15.5" cy="12" r="6.5" fill="#EB001B" />
      <circle cx="22.5" cy="12" r="6.5" fill="#F79E1B" />
      <path d="M19 6.52a6.5 6.5 0 0 1 0 10.96a6.5 6.5 0 0 1 0-10.96z" fill="#FF5F00" />
    </svg>
  );
}

export function LogoAmex() {
  return (
    <svg width="38" height="24" viewBox="0 0 38 24" aria-label="American Express" role="img">
      <rect width="38" height="24" rx="4" fill="#006FCF" />
      <text x="19" y="15.6" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="900" fill="#fff" letterSpacing=".3">AMEX</text>
    </svg>
  );
}
