'use client';

// El formulario del checkout de un plan: nombre, email, con qué pagar (si hay dos pasarelas) y a la pasarela. Postea a
// /api/planes/comprar (nunca una server action: la página es pública) y redirige al link /pagar/<token> que devuelve.
//
// LA PRUEBA GRATIS (25/10/2026): se empieza con 7 días gratis y la tarjeta cargada; el primer cobro es el día 8. Quien ya la
// usó con ese email recibe el texto claro de la ruta y, si quiere, «Empezar sin prueba» (se cobra desde hoy). `sinPrueba`
// llega en `true` desde la página de vuelta de una prueba rechazada por la tarjeta.
//
// EL CÓDIGO DE REFERIDO (25/10/2026): el renglón «¿Te recomendó alguien?» arriba del botón (CodigoReferido.tsx).

import { useState } from 'react';
import type { Pasarela } from '@/lib/cobros-tipos';
import type { OrigenCompra } from '@/lib/compra-plan-reglas';
import { PRUEBA_DIAS } from '@/lib/planes-mako';
import { DIAS_AVISO_FIN_DE_PRUEBA } from '@/lib/prueba-plan-reglas';
import { CodigoReferido, codigoParaMandar } from './CodigoReferido';

// Las dos se ven juntas sólo cuando no se sabe el país (lib/compra-plan-reglas.ts, `pasarelasDelPais`): Mercado Pago dice que
// es para Argentina, así nadie de afuera la elige y se encuentra con «La cuenta del vendedor es de otro país».
const NOMBRE: Record<Pasarela, string> = { stripe: 'Tarjeta de crédito o débito', mercadopago: 'Mercado Pago (desde Argentina, en pesos)' };

export function CompraPlan(p: {
  plan: string;
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
  const [web, setWeb] = useState('');
  const [codigo, setCodigo] = useState(p.refCodigo ?? '');
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [pasarela, setPasarela] = useState<Pasarela | null>(p.pasarelas.length === 1 ? p.pasarelas[0].pasarela : null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent, sin = sinPrueba, sinDescuento = sinPromo) {
    e.preventDefault();
    if (enviando) return;
    if (p.pasarelas.length > 1 && !pasarela) { setError('Elige con qué quieres pagar.'); return; }
    setEnviando(true);
    setError(null);
    setErrorCodigo(null);
    try {
      const r = await fetch('/api/planes/comprar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: p.plan, nombre, email, pasarela, origen: p.origen, ref: p.refCodigo, codigo: codigoParaMandar(codigo, p.refCodigo), web, sinPrueba: sin, promo: !!p.promo, sinPromo: sinDescuento }),
      });
      const j = (await r.json().catch(() => ({}))) as { link?: string; error?: string; sinPrueba?: boolean; sinPromo?: boolean; campo?: string };
      if (r.ok && j.link) { window.location.href = j.link; return; }
      if (j.campo === 'codigo') { setErrorCodigo(j.error ?? 'Revisa el código.'); setEnviando(false); return; }
      setError(j.error ?? 'No pudimos abrir el pago. Prueba otra vez.');
      setOfrecerSinPrueba(!!j.sinPrueba);
      setOfrecerSinPromo(!!j.sinPromo);
    } catch {
      setError('No pudimos conectarnos. Revisa tu internet y prueba otra vez.');
    }
    setEnviando(false);
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor="cp-nombre">Tu nombre</label>
      <input id="cp-nombre" type="text" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
      <label htmlFor="cp-email">Tu email</label>
      <input id="cp-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <div className="planes-trampa" aria-hidden="true">
        <label htmlFor="cp-web">Web</label>
        <input id="cp-web" type="text" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
      </div>
      {p.pasarelas.length > 1 && (
        <>
          <label>¿Con qué pagas?</label>
          {p.pasarelas.map((x) => (
            <label key={x.pasarela} className="planes-opcion">
              <input type="radio" name="pasarela" checked={pasarela === x.pasarela} onChange={() => setPasarela(x.pasarela)} />
              {NOMBRE[x.pasarela]}
            </label>
          ))}
        </>
      )}
      <CodigoReferido valor={codigo} onCambio={(v) => { setCodigo(v); setErrorCodigo(null); }} delLink={p.refCodigo} error={errorCodigo} />
      <button className="planes-btn" type="submit" disabled={enviando}>
        {enviando ? 'Abriendo…' : sinPrueba ? 'Ir a pagar' : `Empezar mis ${PRUEBA_DIAS} días gratis`}
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
      <p className="planes-nota">
        {sinPrueba
          ? 'Con ese email entras a MaKo: te llega el acceso apenas se confirme el pago.'
          : `Cargas tu tarjeta y no se te cobra nada hoy: el primer cobro es el día ${PRUEBA_DIAS + 1}, y te avisamos ${DIAS_AVISO_FIN_DE_PRUEBA} días antes. Con ese email entras a MaKo.`}
      </p>
      {/* La suscripción de Mercado Pago va a nombre de ESE email (payer_email): con otro, MP no deja autorizarla (revisión del 23/10/2026). */}
      {pasarela === 'mercadopago' && <p className="planes-nota">Con Mercado Pago, usa el email de tu cuenta de Mercado Pago.</p>}
    </form>
  );
}
