'use client';
// =============================================================================
// El cartel de pago de un cliente de agencia que paga su propia cuenta (25/10/2026)
// =============================================================================
// Agency Dashboard (docs/feedback-25-10-tarde.md punto 9): la agencia le abre la cuenta y elige que la pague su cliente;
// «al finalizar el onboarding de ese cliente debe saltar el cartel de pago». Lo que se dibuja lo decide el server
// (/api/agencia/mi-pago → lib/agency.ts `cartelDelCliente`):
//   · el PRIMER MES: no se cierra. Sin él la cuenta no sigue (es lo que la habilita), y cerrarlo sería usar MaKo gratis.
//     Deja cerrar sesión, que es la salida honesta.
//   · la RENOVACIÓN mensual: se cierra («Ahora no»), porque su mes ya está pago. Vuelve en la próxima carga.
// Pide el dato UNA vez por carga y al volver a la pestaña, como el aviso de la mora (el layout no se desmonta al navegar):
// quien paga en otra pestaña y vuelve, ve el cartel irse solo.
//
// ⚠️ EN UN TELÉFONO NO VENDE (T5, docs/tiendas-play-appstore.md, 3/11/2026): sin precio ni link. El primer mes dice que la cuenta espera y deja cerrar
// sesión; la renovación no sale: su mes ya está pago. El pago se hace en la computadora, donde sigue saliendo este cartel.
// =============================================================================
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { esVistaSinChrome } from './PublicRouteGate';
import { esTelefono } from '@/lib/telefono';

type Cartel =
  | { tipo: 'primer-mes'; link: string; cerrable: false; agencia: string; usd: number }
  | { tipo: 'renovacion'; link: string; desde: string | null; cerrable: true; agencia: string; usd: number };

/** Las pantallas donde no va: lo público, el login, y el onboarding mismo (el cartel sale al TERMINARLO). */
const sinCartel = (p: string) => esVistaSinChrome(p) || /^\/(login|onboarding|cuenta-pausada|restablecer)(\/|$)/.test(p);

export function CartelPagoCliente() {
  const pathname = usePathname() ?? '';
  const fuera = sinCartel(pathname);
  const [cartel, setCartel] = useState<Cartel | null>(null);
  const [cerrado, setCerrado] = useState(false);

  useEffect(() => {
    if (fuera) return;
    let vivo = true;
    const cargar = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/agencia/mi-pago').then((r) => r.json()).then((j) => { if (vivo) setCartel((j?.cartel as Cartel | null) ?? null); }).catch(() => {});
    };
    cargar();
    document.addEventListener('visibilitychange', cargar);
    return () => { vivo = false; document.removeEventListener('visibilitychange', cargar); };
  }, [fuera]);

  if (fuera || !cartel || (cartel.cerrable && cerrado)) return null;
  const primer = cartel.tipo === 'primer-mes';
  // Después del fetch, nunca en el primer dibujo del servidor: mirar el navegador no descuadra la hidratación.
  const telefono = typeof navigator !== 'undefined' && esTelefono(navigator.userAgent);
  if (telefono && !primer) return null;
  const desde = cartel.tipo === 'renovacion' && cartel.desde
    ? new Date(cartel.desde).toLocaleDateString('es', { day: 'numeric', month: 'long' }) : null;

  return (
    <div className="cpc-fondo" role="dialog" aria-modal="true" aria-labelledby="cpc-titulo">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="cpc-caja">
        <span className="cpc-marca" aria-hidden>✦</span>
        <p className="cpc-sobre">{cartel.agencia} te abrió tu cuenta de MaKo</p>
        <h2 id="cpc-titulo" className="cpc-titulo">{primer ? 'Activa tu cuenta' : 'Activa tu renovación mensual'}</h2>
        <p className="cpc-texto">
          {telefono
            ? 'Tu cuenta espera su activación. Entra desde una computadora para terminar.'
            : primer
            ? 'Terminaste tu configuración. Para empezar a usar MaKo, paga tu primer mes.'
            : `Tu mes ya está pago. Autoriza la renovación una vez y se cobra sola cada mes${desde ? `, desde el ${desde}` : ''}.`}
        </p>
        {!telefono && <div className="cpc-precio"><b>US$ {cartel.usd.toLocaleString('es')}</b><span>al mes</span></div>}
        {!telefono && <a className="cpc-pagar" href={cartel.link}>{primer ? 'Pagar con tarjeta' : 'Autorizar la renovación'}</a>}
        {primer ? (
          <button type="button" className="cpc-salir"
            onClick={async () => { await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {}); window.location.href = '/login'; }}>
            Cerrar sesión
          </button>
        ) : (
          <button type="button" className="cpc-salir" onClick={() => setCerrado(true)}>Ahora no</button>
        )}
        <p className="cpc-nota">{telefono ? `¿Dudas? Habla con ${cartel.agencia}.` : `¿Dudas con el pago? Habla con ${cartel.agencia}.`}</p>
      </div>
    </div>
  );
}

// Sin backticks acá adentro: cierran la cadena a la mitad.
const CSS = `
.cpc-fondo{ position:fixed; inset:0; z-index:2147483000; display:flex; align-items:center; justify-content:center; padding:16px;
  background:color-mix(in srgb, #0b0d12 55%, transparent); backdrop-filter:blur(6px); -webkit-backdrop-filter:blur(6px); }
.cpc-caja{ width:100%; max-width:420px; background:var(--surface); color:var(--ink); border:1px solid var(--border);
  border-radius:22px; padding:30px 28px 22px; box-shadow:0 30px 80px rgba(10,12,18,.35); text-align:center;
  font-family:'Geist', sans-serif; display:flex; flex-direction:column; align-items:center; gap:10px; }
.cpc-marca{ width:46px; height:46px; border-radius:14px; display:inline-flex; align-items:center; justify-content:center;
  background:#14161c; color:#f5c542; font-size:22px; margin-bottom:4px; }
.cpc-sobre{ margin:0; font-size:12.5px; font-weight:600; letter-spacing:.02em; color:var(--dim); }
.cpc-titulo{ margin:0; font-size:26px; line-height:1.15; font-weight:800; letter-spacing:-.02em; }
.cpc-texto{ margin:0; font-size:14.5px; line-height:1.5; color:var(--dim); }
.cpc-precio{ display:flex; align-items:baseline; gap:6px; margin:8px 0 4px; }
.cpc-precio b{ font-size:34px; font-weight:800; letter-spacing:-.03em; }
.cpc-precio span{ font-size:14px; color:var(--dim); }
.cpc-pagar{ width:100%; display:inline-flex; justify-content:center; padding:13px 16px; border-radius:12px; background:var(--primary);
  color:var(--on-primary, #fff); font-size:15px; font-weight:700; text-decoration:none; }
.cpc-pagar:hover{ filter:brightness(1.05); }
.cpc-salir{ border:0; background:none; font:inherit; font-size:13.5px; font-weight:600; color:var(--dim); cursor:pointer; padding:8px; }
.cpc-salir:hover{ color:var(--ink); }
.cpc-nota{ margin:2px 0 0; font-size:12px; color:var(--faint); }
`;
