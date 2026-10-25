'use client';

// =============================================================================
// AprendeSolo — de qué fuentes aprende el Second Brain, cuándo fue la última vez y cuánto entró (25/10/2026)
// =============================================================================
// docs/diseno-second-brain-recolector.md §7: «Una pantalla del Second Brain que diga, por negocio: de qué fuentes está
// tomando datos, cuándo fue la última vez, y cuánto entró. Sin eso, el recolector es una caja negra que nadie sabe si está
// viva». Va en la cabecera del Mapa (VistaCerebro.tsx): un botón con su estado (el punto) y, al tocarlo, el detalle — como
// la lista de «fuentes conectadas» de un asistente con memoria: cada fuente, si está viva, lo último y su interruptor.
//
// Lo que se ve, de lib/recolector.ts (`resumenDelRecolector`). El super admin mirando un negocio ve CUÁNTO aprendió, no QUÉ
// dice (§4): sin la lista de conversaciones ni sus hechos.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { textoDeLaVuelta, type ResumenRecolector } from '@/lib/recolector-reglas';
import { cambiarRecolectorAction } from './recolector-actions';
import { BotonIntegracion } from '@/app/_components/ConectarIntegracion';

const CSS = `
.as-boton{display:inline-flex;align-items:center;gap:8px;height:34px;padding:0 14px;border-radius:999px;border:1px solid var(--border);
  background:var(--surface);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.as-boton:hover{border-color:var(--border-strong,var(--border));background:var(--surface-2)}
.as-punto{width:8px;height:8px;border-radius:50%;flex:none;background:var(--faint,#9aa0a6)}
.as-punto[data-tono="bien"]{background:var(--good,#1e9e57)}
.as-punto[data-tono="aviso"]{background:#e0a100}
.as-sub{margin:0 0 16px;color:var(--dim);font-size:14px;line-height:1.55}
.as-fuente{border:1px solid var(--border);border-radius:14px;padding:14px 16px;display:grid;gap:6px}
.as-fuente-cab{display:flex;align-items:center;gap:10px}
.as-fuente-cab b{font-size:15px;color:var(--ink)}
.as-fuente-cab .as-interruptor{margin-left:auto}
.as-fuente p{margin:0;color:var(--dim);font-size:13.5px;line-height:1.5}
.as-numeros{display:flex;gap:18px;margin-top:4px;font-size:13px;color:var(--dim)}
.as-numeros b{color:var(--ink);font-size:15px;margin-right:4px}
.as-aviso{margin:12px 0 0;padding:10px 12px;border-radius:10px;background:color-mix(in srgb,#e0a100 12%,var(--surface));color:var(--ink);font-size:13.5px}
.as-aviso a{color:var(--primary);font-weight:600}
.as-lista{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:8px}
.as-lista h4{margin:0 0 2px;font-size:13px;color:var(--dim);font-weight:600}
.as-item details{border:1px solid var(--border);border-radius:12px;padding:0 12px}
.as-item summary{cursor:pointer;list-style:none;display:flex;justify-content:space-between;gap:10px;padding:10px 0;font-size:14px;color:var(--ink);font-weight:600}
.as-item summary::-webkit-details-marker{display:none}
.as-item summary span{color:var(--dim);font-weight:500;font-size:12.5px;white-space:nowrap}
.as-item ul{margin:0 0 12px;padding-left:18px;color:var(--dim);font-size:13.5px;line-height:1.5}
.as-nota{margin:14px 0 0;color:var(--dim);font-size:12.5px}
`;

/** «hace 5 min», «hace 3 h», «hace 2 días»: cuándo fue la última vuelta. Sólo en el modal (que se abre en el navegador). */
function haceCuanto(iso: string, ahora = Date.now()): string {
  const min = Math.max(0, Math.round((ahora - Date.parse(iso)) / 60_000));
  if (min < 1) return 'recién';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** El punto del botón: verde si está aprendiendo, ámbar si algo lo frena (sin su IA, un error), gris si está apagado. */
export function tonoDelRecolector(r: ResumenRecolector | null): 'bien' | 'aviso' | 'apagado' {
  if (!r || r.sinTabla || !r.estado.prendido) return 'apagado';
  const u = r.estado.ultima;
  if (u && (u.resultado === 'sin-ia' || u.resultado === 'error')) return 'aviso';
  return 'bien';
}

export function AprendeSolo({ resumen, soloCuentas }: { resumen: ResumenRecolector | null; soloCuentas: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  // Un cliente arranca apagado (lo prende acá: gasta su IA); sin poder leer el estado, tampoco se lo da por prendido.
  const [prendido, setPrendido] = useState(resumen?.estado.prendido ?? false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const estado = resumen ? { ...resumen.estado, prendido } : null;
  const cambiar = async () => {
    setGuardando(true);
    setError(null);
    const r = await cambiarRecolectorAction(!prendido).catch(() => ({ ok: false as const, error: 'No se pudo guardar.' }));
    if (r.ok) { setPrendido(!prendido); router.refresh(); } else setError(r.error);
    setGuardando(false);
  };
  return (
    <>
      <style>{CSS}</style>
      <button type="button" className="as-boton" onClick={() => setAbierto(true)} aria-haspopup="dialog">
        <span className="as-punto" data-tono={tonoDelRecolector(resumen ? { ...resumen, estado: estado! } : null)} aria-hidden />
        Aprende solo
      </button>
      {abierto && (
        <Modal titulo="Lo que MaKo aprende solo" ancho={560} onCerrar={() => setAbierto(false)}
          pie={<Button variant="secondary" onClick={() => setAbierto(false)}>Listo</Button>}>
          {/* UN solo hijo: el cuerpo del modal le pone aire y un filete a cada hijo directo (app/_ui/ui.css, .mk-modal__cuerpo). */}
          <div className="as-cuerpo">
          <p className="as-sub">
            MaKo lee tus conversaciones de WhatsApp con tus leads, anota lo importante de cada una y lo suma a tu Second Brain,
            para responderte con eso. Sólo lee: nunca escribe ni contesta. Usa tu propia IA.
          </p>
          {!resumen
            ? <p className="as-sub">No pudimos leer el estado. Prueba otra vez en un minuto.</p>
            : (
              <>
                <section className="as-fuente" aria-label="WhatsApp">
                  <div className="as-fuente-cab">
                    <span className="as-punto" data-tono={tonoDelRecolector({ ...resumen, estado: estado! })} aria-hidden />
                    <b>WhatsApp</b>
                    {!resumen.sinTabla && (
                      <span className="as-interruptor">
                        <Button variant="secondary" size="sm" disabled={guardando} onClick={() => void cambiar()}>{prendido ? 'Apagar' : 'Prender'}</Button>
                      </span>
                    )}
                  </div>
                  <p>{resumen.sinTabla ? 'Todavía no está listo en tu cuenta. Empieza apenas se active.' : textoDeLaVuelta(estado!)}</p>
                  {resumen.estado.ultima && <p>Última vuelta: {haceCuanto(resumen.estado.ultima.at)}.</p>}
                  <div className="as-numeros">
                    <span><b>{resumen.conversaciones}</b>{resumen.conversaciones === 1 ? 'conversación leída' : 'conversaciones leídas'}</span>
                    <span><b>{resumen.conEntrada}</b>con algo aprendido</span>
                  </div>
                  {error && <p role="alert" style={{ color: 'var(--bad, #c5221f)' }}>{error}</p>}
                </section>
                {resumen.sinIndice > 0 && (
                  <p className="as-aviso">
                    {resumen.sinIndice} {resumen.sinIndice === 1 ? 'conversación todavía no la usa' : 'conversaciones todavía no las usa'} al
                    {/* Conectar nunca saca de la tab (regla del 14/10/2026): el modal de la integración, acá mismo. */}
                    responder: <BotonIntegracion servicio="gemini" style={{ color: 'var(--primary)', fontWeight: 600 }}>conecta tu Gemini</BotonIntegracion>.
                  </p>
                )}
                {soloCuentas
                  ? <p className="as-nota">Como super admin ves cuánto aprendió este negocio, no qué dice.</p>
                  : resumen.ultimas.length > 0 && (
                    <ul className="as-lista">
                      <li><h4>Lo último que aprendió</h4></li>
                      {resumen.ultimas.map((u) => (
                        <li key={`${u.etiqueta}-${u.cuando}`} className="as-item">
                          <details>
                            <summary>{u.etiqueta}<span>{haceCuanto(u.cuando)}</span></summary>
                            {u.hechos.length ? <ul>{u.hechos.map((h) => <li key={h}>{h}</li>)}</ul> : <p className="as-nota">Sin hechos guardados.</p>}
                          </details>
                        </li>
                      ))}
                    </ul>
                  )}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
