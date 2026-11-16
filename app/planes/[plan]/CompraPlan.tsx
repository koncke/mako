'use client';

// El formulario del checkout de un plan: nombre, email, WhatsApp, con qué pagar (si hay dos pasarelas) y a la pasarela. Postea a
// /api/planes/comprar (nunca una server action: la página es pública) y redirige al link /pagar/<token> que devuelve.
//
// LA PRUEBA GRATIS (25/10/2026): se empieza con 7 días gratis y la tarjeta cargada; el primer cobro es el día 8. `sinPrueba` llega
// en `true` desde la página de vuelta de una prueba rechazada por la tarjeta.
// UNA PRUEBA POR PERSONA (16/11/2026, Martín: «la opción C de email y WhatsApp sin mirar la tarjeta»): si el email o el WhatsApp ya
// tuvieron una, la ruta lo dice (`sinPrueba: true`, lib/compra-plan.ts) y la compra SIGUE, sin la prueba: el aviso dice por qué, el
// botón pasa a «Suscribirme por …» con lo que se cobra hoy y el resumen de la izquierda, a su versión sin prueba (`data-ck-sin-prueba`,
// app/planes/estilo.ts). Nunca se bloquea una compra: un toque y sigue. Ya no hay un segundo botón «Empezar sin prueba».
//
// EL CÓDIGO DE REFERIDO (25/10/2026): el renglón «¿Te recomendó alguien?» arriba del botón (CodigoReferido.tsx).
//
// EL WHATSAPP (31/10/2026, Martín: «que le pida también el whatsapp»): con su código de país. OBLIGATORIO desde el 14/11/2026
// (Martín: «WhatsApp no debe ser opcional… no debería poder darle clic al botón… si no completé todo lo anterior»): el botón
// queda apagado hasta que el email, el nombre, el WhatsApp y la forma de pago están, y la ruta también lo exige.

import { useState } from 'react';
import type { Pasarela } from '@/lib/cobros-tipos';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { telefonoDeFormulario } from '@/lib/paises';
import { PRUEBA_DIAS } from '@/lib/planes-mako';
import { CodigoReferido, codigoParaMandar } from './CodigoReferido';
import { LogoAmex, LogoMastercard, LogoMercadoPago, LogoVisa } from './MarcasDePago';

// Se ven juntas cuando no se sabe el país (local, o una IP que Vercel no ubica), cuando la que le tocaba no está conectada,
// y en Argentina: Mercado Pago en pesos y la tarjeta (13/11/2026, lib/compra-plan-reglas.ts, `pasarelasParaOfrecer`).
// Mercado Pago dice que es para Argentina, así nadie de afuera la elige y se encuentra con «La cuenta del vendedor es de
// otro país».
// ⚠️ A ESTE RÓTULO LE FALTABA CREEM (31/10/2026) y en el checkout salía un radio EN BLANCO: el comprador no sabía qué estaba
// eligiendo, y el que no se leía era justo el de LatAm. El `Record<Pasarela, …>` es total, así que TypeScript lo veía
// (TS2741) — pero `next.config.ts` tiene `typescript: { ignoreBuildErrors: true }`, así que el build lo dejó pasar.
const NOMBRE: Readonly<Record<Pasarela, string>> = {
  stripe: 'Tarjeta de crédito o débito',
  mercadopago: 'Mercado Pago',
  creem: 'Tarjeta internacional (en dólares)',
};
/**
 * LAS FORMAS DE PAGO COMO FILAS (12/11/2026, la estructura de «Payment method» de Stripe Checkout): cada una con su ícono, lo que
 * es y las marcas que acepta. Se ve aunque haya una sola: quien compra sabe con qué va a pagar antes de salir de MaKo.
 */
// 14/11/2026 (Martín): sin «Pagas en la página segura de Stripe»; las marcas con sus LOGOS; Mercado Pago con el suyo, bien distinto.
// La nota de Mercado Pago (el email de su cuenta) va en su fila: debajo del botón ya no hay texto.
const DETALLE: Readonly<Record<Pasarela, { sub: string | null }>> = {
  stripe: { sub: null },
  // Sin subtítulo (14/11/2026, noche, Martín: «en la parte de mercado pago, no pongas ningún subtítulo»).
  mercadopago: { sub: null },
  creem: { sub: null },
};
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * «Suscribirme por …» (16/11/2026): lo que cobra hoy la pasarela elegida, en SU moneda, y sin elegir la primera (como el resumen).
 * Con dos pasarelas van las dos cifras y `CSS_PLANES` deja ver la de la fila elegida con el mismo `:has()` que el resumen, así el
 * botón y el total nunca dicen monedas distintas. Con la prueba gratis el botón no lleva cifra: hoy no se cobra nada.
 */
function TextoSuscribirme({ pasarelas, hoy, primerMes }: { pasarelas: ReadonlyArray<{ pasarela: Pasarela }>; hoy?: Partial<Record<Pasarela, string>>; primerMes: boolean }) {
  const con = pasarelas.filter((x) => hoy?.[x.pasarela]);
  if (!con.length) return <>Suscribirme</>;
  const cola = primerMes ? ' el primer mes' : ' al mes';
  if (con.length === 1) return <>Suscribirme por {hoy?.[con[0].pasarela]}{cola}</>;
  return <>Suscribirme por {con.map((x, i) => <span key={x.pasarela} data-ck-moneda={x.pasarela} data-ck-primera={i === 0 ? '' : undefined}>{hoy?.[x.pasarela]}</span>)}{cola}</>;
}
// Los colores fijos de las páginas de planes (app/planes/estilo.ts): el selector de país es de la app y viene con los del tema.
const CAMPO_TEL: React.CSSProperties = { width: '100%', boxSizing: 'border-box', font: 'inherit', padding: '11px 12px', border: '1px solid rgba(17,17,17,.17)', borderRadius: 10, background: '#fff', color: '#121212' };
const CARA_LADA: React.CSSProperties = { height: '100%', minHeight: 46, border: '1px solid rgba(17,17,17,.17)', borderRadius: 10, background: '#fff', color: '#121212' };

export function CompraPlan(p: {
  plan: string;
  /** El código de país que arranca elegido: el de donde está la persona. Lo puede cambiar. */
  ladaInicial: string;
  pasarelas: Array<{ pasarela: Pasarela; moneda: string; monto: number }>;
  origen: OrigenCompra | null;
  refCodigo: string | null;
  sinPrueba?: boolean;
  /** Esta página mostró el 50% del primer mes. Lo decide la ruta, con la cookie del reloj: si ya no vale, lo dice y se elige seguir. */
  promo?: boolean;
  /**
   * Lo que cobra HOY cada pasarela SIN la prueba, ya escrito en su moneda (el «Total de hoy» del resumen sin prueba,
   * `totalDeHoyPorPasarela`). El botón lo dice cuando no hay prueba: «Suscribirme por $ 75.000 ARS» con Mercado Pago y «… por US$ 47»
   * con la tarjeta (16/11/2026). ⚠️ Siempre el de SIN prueba (revisión del 16/11, hallazgo 4): era el del resumen de la página, y
   * con la prueba ese total es 0: quien ya la había usado veía «Suscribirme por US$ 0 al mes».
   */
  hoy?: Partial<Record<Pasarela, string>>;
}) {
  const [sinPrueba, setSinPrueba] = useState(!!p.sinPrueba);
  const [sinPromo, setSinPromo] = useState(false);
  const [ofrecerSinPromo, setOfrecerSinPromo] = useState(false);
  // Por qué sigue sin la prueba (el email o el WhatsApp ya la usaron): lo dice la ruta, y se muestra arriba del botón.
  const [porQueSinPrueba, setPorQueSinPrueba] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [lada, setLada] = useState(p.ladaInicial);
  const [numero, setNumero] = useState('');
  const [errorWhatsapp, setErrorWhatsapp] = useState<string | null>(null);
  const [web, setWeb] = useState('');
  const [codigo, setCodigo] = useState(p.refCodigo ?? '');
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [pasarela, setPasarela] = useState<Pasarela | null>(p.pasarelas.length === 1 ? p.pasarelas[0].pasarela : null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sin pasarela para su país al momento de pagar (5/11/2026, una pestaña de antes del cierre de Creem): la ruta lo tomó como
  // pedido (lib/compra-plan.ts, `iniciarCompraDePlan`). Nunca un error: lo que escribió ya quedó.
  const [pedido, setPedido] = useState(false);

  // Con un WhatsApp de verdad: su país y al menos 10 dígitos en total (la misma regla que la ruta, `whatsappEscritoMal`).
  const whatsappCompleto = telefonoDeFormulario(lada, numero).replace(/\D/g, '').length >= 10;
  const completo = EMAIL_OK.test(email.trim()) && nombre.trim().length >= 2 && whatsappCompleto && (p.pasarelas.length === 1 || pasarela != null);

  async function enviar(e: React.FormEvent, sin = sinPrueba, sinDescuento = sinPromo) {
    e.preventDefault();
    if (enviando || !completo) return;
    if (p.pasarelas.length > 1 && !pasarela) { setError('Elige con qué quieres pagar.'); return; }
    setEnviando(true);
    setError(null);
    setErrorCodigo(null);
    setErrorWhatsapp(null);
    try {
      const r = await fetch('/api/planes/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p.plan, nombre, email, whatsapp: telefonoDeFormulario(lada, numero), pasarela, origen: p.origen, ref: p.refCodigo, codigo: codigoParaMandar(codigo, p.refCodigo), web, sinPrueba: sin, promo: !!p.promo, sinPromo: sinDescuento }),
      });
      const j = (await r.json().catch(() => ({}))) as { link?: string; pedido?: boolean; error?: string; sinPrueba?: boolean; sinPromo?: boolean; campo?: string };
      if (r.ok && j.link) { window.location.href = j.link; return; }
      if (r.ok && j.pedido) { setPedido(true); setEnviando(false); return; }
      if (j.campo === 'codigo') { setErrorCodigo(j.error ?? 'Revisa el código.'); setEnviando(false); return; }
      if (j.campo === 'whatsapp') { setErrorWhatsapp(j.error ?? 'Revisa tu WhatsApp.'); setEnviando(false); return; }
      // La prueba ya se usó: la compra sigue sin ella. Se dice por qué y el botón pasa a lo que se cobra hoy; un toque y sigue.
      if (j.sinPrueba && !sin) { setSinPrueba(true); setPorQueSinPrueba(j.error ?? null); setEnviando(false); return; }
      setError(j.error ?? 'No pudimos abrir el pago. Prueba otra vez.');
      setOfrecerSinPromo(!!j.sinPromo);
    } catch {
      setError('No pudimos conectarnos. Revisa tu internet y prueba otra vez.');
    }
    setEnviando(false);
  }

  if (pedido) {
    return (
      <div role="status" aria-live="polite">
        <p className="planes-sub" style={{ marginBottom: 6, color: '#121212', fontWeight: 600 }}>¡Listo! Recibimos tu pedido.</p>
        <p className="planes-sub">Todavía no cobramos en línea desde tu país: te escribimos para darte de alta. Con tu email entras a MaKo.</p>
      </div>
    );
  }

  return (
    // `data-ck-sin-prueba`: la página se dibujó con la prueba y la ruta dijo que ya se usó; el resumen pasa a su versión sin prueba.
    <form className="ck-formulario" onSubmit={enviar} noValidate data-ck-sin-prueba={sinPrueba && !p.sinPrueba ? '' : undefined}>
      {/* Como «Contact information» de Stripe: el email primero (con él entras a MaKo). */}
      <h2 className="ck-titulo">Tus datos</h2>
      <label htmlFor="cp-email">Email</label>
      <input id="cp-email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="cp-nombre">Nombre</label>
      <input id="cp-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="cp-whatsapp">WhatsApp</label>
      <TelefonoConPais lada={lada} numero={numero} onLada={(v) => { setLada(v); setErrorWhatsapp(null); }} onNumero={(v) => { setNumero(v); setErrorWhatsapp(null); }}
        inputStyle={CAMPO_TEL} estiloLada={CARA_LADA} anchoLada={112} autoComplete="tel" inputId="cp-whatsapp" />
      {errorWhatsapp && <p className="planes-error planes-codigo-error" role="status" aria-live="polite">{errorWhatsapp}</p>}
      <div className="planes-trampa" aria-hidden="true">
        <label htmlFor="cp-web">Web</label>
        <input id="cp-web" type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
      </div>
      <h2 className="ck-titulo">Forma de pago</h2>
      <div className="ck-medios" role="radiogroup" aria-label="Forma de pago">
        {p.pasarelas.map((x) => (
          <label key={x.pasarela} className={`ck-medio${x.pasarela === 'mercadopago' ? ' ck-medio-mp' : ''}`}>
            {/* `value`: lo lee el resumen de la izquierda para mostrar el precio en la moneda de ESTA fila (`CSS_PLANES`, `:has()`). */}
            <input type="radio" name="pasarela" value={x.pasarela} checked={pasarela === x.pasarela} onChange={() => setPasarela(x.pasarela)} />
            <span className="ck-medio-icono" aria-hidden="true">{x.pasarela === 'mercadopago'
              ? <LogoMercadoPago alto={20} />
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /></svg>}</span>
            <span className="ck-medio-texto"><b>{NOMBRE[x.pasarela]}</b>{DETALLE[x.pasarela].sub && <small>{DETALLE[x.pasarela].sub}</small>}</span>
            {x.pasarela === 'stripe' && <span className="ck-marcas"><LogoVisa /><LogoMastercard /><LogoAmex /></span>}
          </label>
        ))}
      </div>
      <CodigoReferido valor={codigo} onCambio={(v) => { setCodigo(v); setErrorCodigo(null); }} delLink={p.refCodigo} error={errorCodigo} />
      {porQueSinPrueba && <p className="ck-aviso" role="status" aria-live="polite">{porQueSinPrueba}</p>}
      {/* EL MISMO BOTÓN NEGRO CON LAS DOS FORMAS DE PAGO (16/11/2026, Martín: «si pongo tarjeta de crédito o débito, no debería cambiar
          el botón a cuando aprieto Mercado Pago… el mismo botón negro del mismo tamaño»). Con Mercado Pago pasaba a su azul y sumaba
          su logo: lo que distingue a Mercado Pago es su fila. */}
      <button className="planes-btn" type="submit" disabled={enviando || !completo}>
        {enviando ? 'Abriendo el pago…' : sinPrueba ? <TextoSuscribirme pasarelas={p.pasarelas} hoy={sinPromo ? undefined : p.hoy} primerMes={!!p.promo} /> : `Empezar mis ${PRUEBA_DIAS} días gratis`}
      </button>
      {/* role="status" y no "alert": /planes es pública y sin sesión, así que «Reportar a soporte» no serviría acá. */}
      {error && <p className="planes-error" role="status" aria-live="polite">{error}</p>}
      {ofrecerSinPromo && !sinPromo && (
        <button className="planes-btn planes-btn-borde" type="button" disabled={enviando}
          onClick={(e) => { setSinPromo(true); setOfrecerSinPromo(false); void enviar(e, sinPrueba, true); }}>Seguir con el precio normal</button>
      )}
      {/* Sin texto debajo del botón (Martín, 14/11/2026: «elimina también el texto que está debajo del botón grande»). Lo de Mercado
          Pago (la suscripción va a nombre de ESE email, payer_email: revisión del 23/10/2026) quedó en su fila. */}
    </form>
  );
}
