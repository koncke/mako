'use client';

// El formulario del checkout de un plan: nombre, email, WhatsApp, con qué pagar (si hay dos pasarelas) y a la pasarela. Postea a
// /api/planes/comprar (nunca una server action: la página es pública) y redirige al link /pagar/<token> que devuelve.
//
// LA PRUEBA GRATIS (25/10/2026): se empieza con 7 días gratis y la tarjeta cargada; el primer cobro es el día 8. Quien ya la
// usó con ese email recibe el texto claro de la ruta y, si quiere, «Empezar sin prueba» (se cobra desde hoy). `sinPrueba`
// llega en `true` desde la página de vuelta de una prueba rechazada por la tarjeta.
//
// EL CÓDIGO DE REFERIDO (25/10/2026): el renglón «¿Te recomendó alguien?» arriba del botón (CodigoReferido.tsx).
//
// EL WHATSAPP (31/10/2026, Martín: «que le pida también el whatsapp»): con su código de país, y no frena el pago. Vacío, compra igual.

import { useState } from 'react';
import type { Pasarela } from '@/lib/cobros-tipos';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import { TelefonoConPais } from '@/app/_components/TelefonoConPais';
import { telefonoDeFormulario } from '@/lib/paises';
import { PRUEBA_DIAS } from '@/lib/planes-mako';
import { DIAS_AVISO_FIN_DE_PRUEBA } from '@/lib/prueba-plan-reglas';
import { CodigoReferido, codigoParaMandar } from './CodigoReferido';

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
const DETALLE: Readonly<Record<Pasarela, { icono: string; sub: string; marcas?: readonly string[] }>> = {
  stripe: { icono: 'tarjeta', sub: 'Pagas en la página segura de Stripe', marcas: ['VISA', 'MC', 'AMEX'] },
  mercadopago: { icono: 'MP', sub: 'En pesos, desde Argentina: tarjeta, débito o dinero en tu cuenta' },
  creem: { icono: 'tarjeta', sub: 'Pagas en la página segura de Creem', marcas: ['VISA', 'MC'] },
};
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
}) {
  const [sinPrueba, setSinPrueba] = useState(!!p.sinPrueba);
  const [sinPromo, setSinPromo] = useState(false);
  const [ofrecerSinPromo, setOfrecerSinPromo] = useState(false);
  const [ofrecerSinPrueba, setOfrecerSinPrueba] = useState(false);
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

  async function enviar(e: React.FormEvent, sin = sinPrueba, sinDescuento = sinPromo) {
    e.preventDefault();
    if (enviando) return;
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
      setError(j.error ?? 'No pudimos abrir el pago. Prueba otra vez.');
      setOfrecerSinPrueba(!!j.sinPrueba);
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
    <form className="ck-formulario" onSubmit={enviar} noValidate>
      {/* Como «Contact information» de Stripe: el email primero (con él entras a MaKo). */}
      <h2 className="ck-titulo">Tus datos</h2>
      <label htmlFor="cp-email">Email</label>
      <input id="cp-email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <label htmlFor="cp-nombre">Nombre</label>
      <input id="cp-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="cp-whatsapp">WhatsApp <span className="planes-opcional">(opcional)</span></label>
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
          <label key={x.pasarela} className="ck-medio">
            <input type="radio" name="pasarela" checked={pasarela === x.pasarela} onChange={() => setPasarela(x.pasarela)} />
            {/* La tarjeta, dibujada: el «▭» de antes se veía como un rectángulo vacío (el Cerebro, 14/11/2026). */}
            <span className="ck-medio-icono" aria-hidden="true">{DETALLE[x.pasarela].icono === 'tarjeta'
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z" /><path d="M3 10h18" /><path d="M7 15h.01" /><path d="M11 15h2" /></svg>
              : DETALLE[x.pasarela].icono}</span>
            <span className="ck-medio-texto"><b>{NOMBRE[x.pasarela]}</b><small>{DETALLE[x.pasarela].sub}</small></span>
            {DETALLE[x.pasarela].marcas && <span className="ck-marcas" aria-hidden="true">{DETALLE[x.pasarela].marcas!.map((m) => <span key={m}>{m}</span>)}</span>}
          </label>
        ))}
      </div>
      <CodigoReferido valor={codigo} onCambio={(v) => { setCodigo(v); setErrorCodigo(null); }} delLink={p.refCodigo} error={errorCodigo} />
      <button className="planes-btn" type="submit" disabled={enviando}>
        {enviando ? 'Abriendo el pago…' : sinPrueba ? 'Suscribirme' : `Empezar mis ${PRUEBA_DIAS} días gratis`}
      </button>
      {/* role="status" y no "alert": /planes es pública y sin sesión, así que «Reportar a soporte» no serviría acá. */}
      {error && <p className="planes-error" role="status" aria-live="polite">{error}</p>}
      {ofrecerSinPrueba && !sinPrueba && (
        <button className="planes-btn planes-btn-borde" type="button" disabled={enviando}
          onClick={(e) => { setSinPrueba(true); void enviar(e, true); }}>Empezar sin prueba</button>
      )}
      {ofrecerSinPromo && !sinPromo && (
        <button className="planes-btn planes-btn-borde" type="button" disabled={enviando}
          onClick={(e) => { setSinPromo(true); setOfrecerSinPromo(false); void enviar(e, sinPrueba, true); }}>Seguir con el precio normal</button>
      )}
      <p className="ck-legal">
        {sinPrueba
          ? 'Con ese email entras a MaKo: te llega el acceso apenas se confirme el pago. Se cobra cada mes hasta que te des de baja.'
          : `Cargas tu tarjeta y no se te cobra nada hoy: el primer cobro es el día ${PRUEBA_DIAS + 1}, y te avisamos ${DIAS_AVISO_FIN_DE_PRUEBA} días antes. Con ese email entras a MaKo.`}
      </p>
      {/* La suscripción de Mercado Pago va a nombre de ESE email (payer_email): con otro, MP no deja autorizarla (revisión del 23/10/2026). */}
      {pasarela === 'mercadopago' && <p className="planes-nota">Con Mercado Pago, usa el email de tu cuenta de Mercado Pago.</p>}
    </form>
  );
}
