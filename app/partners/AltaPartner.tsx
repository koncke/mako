'use client';

// =============================================================================
// AltaPartner — el onboarding corto para hacerse partner (25/10/2026)
// =============================================================================
// Martín (25/10): «Solo los CTA para que se haga Partner, posterior a apretar eso, un pequeño onboarding, que le pregunte
// algunas cosas como, cuantos quisiera referir, etc... Y que ahí le de su link de referido». UNA pregunta por pantalla, con
// respuestas grandes (la regla de Martín: si en un segundo no se deduce qué hacer, está mal), como el diagnóstico del
// Acelerador y los onboardings de Tolt y Dub (cuántos, por dónde, dónde te pagamos):
//   1. ¿A cuántos negocios podrías recomendarle MaKo? (avanza sola al tocar)
//   2. ¿Cómo vas a llegar a ellos? (varias)
//   3. ¿Dónde te transferimos lo que ganes? (alias, CBU o PayPal; se puede dejar para después)
//   4. Tu link: copiar, compartir por WhatsApp e ir a tu panel.
// Lo guarda `hacermePartnerAction` (lib/partners-programa.ts, `hacermePartner`): ahí nace el link. Lo mismo sirve en el
// teléfono (`telefono`: el panel es /partners igual, LAS MISMAS RUTAS).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { COMO_PARTNERS, CUANTOS_PARTNERS, RUTA_PARTNERS, TOPE_COBRO, type ComoPartners, type CuantosPartners } from '@/lib/partners-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { hacermePartnerAction } from './actions';

const CSS = `
.ap-root { max-width: 640px; margin: 8px auto 40px; }
.ap-tarjeta { background: var(--surface); border: 1px solid var(--border); border-radius: 24px; padding: 34px 34px 28px;
  box-shadow: 0 24px 60px rgba(18,21,27,.08); }
.ap-pasos { display: flex; gap: 6px; margin: 0 0 26px; }
.ap-pasos span { flex: 1; height: 5px; border-radius: 3px; background: var(--border); }
.ap-pasos span.hecho { background: var(--primary); }
.ap-ceja { font-size: 12.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--primary); }
.ap-pregunta { margin: 10px 0 22px; font-size: 30px; line-height: 1.15; font-weight: 800; letter-spacing: -.025em; color: var(--ink); outline: none; }
.ap-opciones { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
.ap-opcion { text-align: left; font: inherit; font-size: 19px; font-weight: 700; padding: 22px 20px; border: 1px solid var(--border); border-radius: 16px;
  background: var(--surface); color: var(--ink); cursor: pointer; transition: border-color .15s ease, background .15s ease, transform .1s ease; }
.ap-opcion:hover, .ap-opcion:focus-visible { border-color: var(--primary); background: var(--primary-bg); }
.ap-opcion:active { transform: scale(.99); }
.ap-opcion[aria-pressed=true] { border-color: var(--primary); box-shadow: inset 0 0 0 1px var(--primary); background: var(--primary-bg); }
.ap-opcion[aria-pressed=true]::after { content: " ✓"; color: var(--primary); }
.ap-campo { width: 100%; box-sizing: border-box; font: inherit; font-size: 19px; padding: 16px 18px; border: 1px solid var(--border); border-radius: 14px;
  background: var(--surface); color: var(--ink); }
.ap-campo:focus { outline: 2px solid var(--primary); outline-offset: 1px; border-color: var(--primary); }
.ap-ayuda { margin: 10px 2px 0; color: var(--dim); font-size: 14.5px; }
.ap-seguir { display: block; width: 100%; margin-top: 22px; font: inherit; font-size: 17px; font-weight: 700; padding: 16px 20px; border: 0; border-radius: 14px;
  background: var(--primary); color: var(--on-primary, #fff); cursor: pointer; box-shadow: 0 10px 26px color-mix(in srgb, var(--primary) 30%, transparent); }
.ap-seguir[disabled] { opacity: .55; cursor: default; box-shadow: none; }
.ap-fila-acc { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; gap: 12px; }
.ap-texto { background: none; border: 0; padding: 6px 4px; font: inherit; font-size: 15px; font-weight: 600; color: var(--primary); cursor: pointer; text-decoration: none; }
.ap-error { margin: 14px 0 0; color: var(--bad); font-weight: 600; }
.ap-listo { text-align: center; }
.ap-listo .ap-pregunta { font-size: 34px; }
.ap-confeti { font-size: 46px; line-height: 1; }
.ap-link { display: flex; gap: 8px; align-items: center; margin: 18px 0 10px; background: var(--primary-bg); border: 1px solid var(--primary);
  border-radius: 16px; padding: 8px 8px 8px 18px; }
.ap-link input { flex: 1; min-width: 0; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: 17px; font-weight: 700; }
.ap-link button { flex: none; border: 0; border-radius: 12px; background: var(--primary); color: var(--on-primary, #fff); font: inherit; font-weight: 700; padding: 12px 20px; cursor: pointer; }
.ap-codigo { color: var(--dim); font-size: 15px; margin: 0 0 22px; }
.ap-codigo b { color: var(--ink); }
.ap-compartir { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; text-decoration: none; color: var(--ink); border: 1px solid var(--border);
  border-radius: 12px; padding: 12px 18px; background: var(--surface); }
@media (max-width: 600px) {
  .ap-tarjeta { padding: 24px 18px 22px; border-radius: 20px; }
  .ap-pregunta, .ap-listo .ap-pregunta { font-size: 25px; }
  .ap-opciones { grid-template-columns: 1fr; }
  .ap-opcion { font-size: 18px; padding: 18px 16px; }
}
`;

const TOTAL = 3;

export function AltaPartner({ nombreNegocio }: { nombreNegocio?: string | null }) {
  const [paso, setPaso] = useState(0);
  const [cuantos, setCuantos] = useState<CuantosPartners | null>(null);
  const [como, setComo] = useState<ComoPartners[]>([]);
  const [cobro, setCobro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<{ link: string; codigo: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  // Al cambiar de paso, el foco va a la pregunta nueva (con lector de pantalla se escucha lo que sigue).
  const titulo = useRef<HTMLHeadingElement>(null);
  const primero = useRef(true);
  useEffect(() => {
    if (primero.current) { primero.current = false; return; }
    titulo.current?.focus();
  }, [paso, listo]);

  async function terminar(conCobro: boolean) {
    if (enviando) return;
    setEnviando(true);
    setError(null);
    const r = await hacermePartnerAction({ cuantos, como, cobro: conCobro ? cobro : null }).catch(() => ({ ok: false as const, error: 'No pudimos conectarnos. Prueba otra vez.' }));
    setEnviando(false);
    if (r.ok) setListo({ link: r.link, codigo: r.codigo });
    else setError(r.error);
  }

  const copiar = async () => {
    if (!listo) return;
    try { await navigator.clipboard.writeText(listo.link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* el campo queda seleccionable */ }
  };

  const pasos = (
    <div className="ap-pasos" aria-hidden="true">
      {Array.from({ length: TOTAL + 1 }, (_, i) => <span key={i} className={i <= (listo ? TOTAL : paso) ? 'hecho' : undefined} />)}
    </div>
  );

  if (listo) {
    const texto = `Te recomiendo MaKo para vender más con tu negocio: ${listo.link}`;
    return (
      <div className="ap-root">
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="ap-tarjeta ap-listo" role="status" aria-live="polite">
          {pasos}
          <div className="ap-confeti" aria-hidden="true">🎉</div>
          <h2 className="ap-pregunta" ref={titulo} tabIndex={-1}>¡Ya eres partner{nombreNegocio ? `, ${nombreNegocio}` : ''}! Este es tu link</h2>
          <div className="ap-link">
            <input readOnly value={listo.link} aria-label="Tu link de MaKo Partners" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" onClick={copiar}>{copiado ? 'Copiado' : 'Copiar'}</button>
          </div>
          <p className="ap-codigo">Y tu código para poner al pagar: <b>{listo.codigo}</b></p>
          <a className="ap-compartir" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">Compartir por WhatsApp</a>
          <a className="ap-seguir" href={RUTA_PARTNERS} style={{ textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box' }}>Ir a mi panel</a>
        </div>
      </div>
    );
  }

  const atras = paso > 0 ? <button type="button" className="ap-texto" onClick={() => setPaso(paso - 1)}>← Atrás</button> : <a className="ap-texto" href={RUTA_PARTNERS}>← Volver</a>;
  return (
    <div className="ap-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="ap-tarjeta">
        {pasos}
        <span className="ap-ceja">Paso {paso + 1} de {TOTAL}</span>
        {paso === 0 && (
          <>
            <h2 className="ap-pregunta" ref={titulo} tabIndex={-1}>¿A cuántos negocios podrías recomendarle MaKo este mes?</h2>
            <div className="ap-opciones">
              {CUANTOS_PARTNERS.map((c) => (
                <button key={c.id} type="button" className="ap-opcion" aria-pressed={cuantos === c.id} onClick={() => { setCuantos(c.id); setPaso(1); }}>{c.texto}</button>
              ))}
            </div>
          </>
        )}
        {paso === 1 && (
          <>
            <h2 className="ap-pregunta" ref={titulo} tabIndex={-1}>¿Cómo vas a llegar a ellos?</h2>
            <div className="ap-opciones">
              {COMO_PARTNERS.map((c) => (
                <button key={c.id} type="button" className="ap-opcion" aria-pressed={como.includes(c.id)}
                  onClick={() => setComo(como.includes(c.id) ? como.filter((x) => x !== c.id) : [...como, c.id])}>{c.texto}</button>
              ))}
            </div>
            <p className="ap-ayuda">Elige todas las que quieras.</p>
            <button type="button" className="ap-seguir" disabled={como.length === 0} onClick={() => setPaso(2)}>Seguir</button>
          </>
        )}
        {paso === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); void terminar(true); }}>
            <h2 className="ap-pregunta" ref={titulo} tabIndex={-1}>¿Dónde te transferimos lo que ganes?</h2>
            <input className="ap-campo" type="text" value={cobro} maxLength={TOPE_COBRO} autoComplete="off" onChange={(e) => setCobro(e.target.value)}
              placeholder="Tu alias, CBU o email de PayPal" aria-label="Dónde te transferimos" />
            <p className="ap-ayuda">Puedes cambiarlo cuando quieras desde tu panel.</p>
            <button type="submit" className="ap-seguir" disabled={enviando || !cobro.trim()}>{enviando ? 'Creando tu link…' : 'Crear mi link'}</button>
            {error && <p className="ap-error" role="alert">{error} <ReportarASoporte /></p>}
            <div className="ap-fila-acc">
              {atras}
              <button type="button" className="ap-texto" disabled={enviando} onClick={() => void terminar(false)}>Lo cargo después</button>
            </div>
          </form>
        )}
        {paso < 2 && <div className="ap-fila-acc">{atras}</div>}
      </div>
    </div>
  );
}
