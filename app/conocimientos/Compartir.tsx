'use client';

// =============================================================================
// Botón "Compartir" del portal — sirve para CUALQUIER curso, no solo Branding
// =============================================================================
// Dos modos, como Google Drive: "cualquiera con el enlace" o solo las personas
// invitadas por email (cada una recibe SU propio enlace, revocable de a una).
//
// Estética CLARA a propósito: el portal es paper (.ahc, var(--ink)/var(--card)).
// La primera versión usaba fondo oscuro con `color: inherit` y quedaba negro
// sobre negro — ilegible.

import { useCallback, useEffect, useState } from 'react';

type Invitado = { id: number; email: string; token_prefijo: string; enviado_at: string | null; visitas: number; revocado_at: string | null };
type ShareRow = {
  id: number; recurso: string; alcance: string; recurso_id: string | null; modo: string;
  etiqueta: string | null; token_prefijo: string; revocado_at: string | null; visitas: number;
  ultima_visita: string | null; created_at: string; invitados: Invitado[];
};

export default function Compartir({ recurso, recursoId, etiqueta }: { recurso: string; recursoId: string; etiqueta: string }) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<'link' | 'invitados'>('link');
  const [emails, setEmails] = useState('');
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<{ enlace: string | null; invitados: { email: string; enviado: boolean; error?: string }[] } | null>(null);
  const [lista, setLista] = useState<ShareRow[] | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`/api/compartir?recurso=${encodeURIComponent(recurso)}&recursoId=${encodeURIComponent(recursoId)}`);
      const j = await r.json();
      setLista(j.ok ? j.shares : []);
    } catch { setLista([]); }
  }, [recurso, recursoId]);

  useEffect(() => { if (abierto) cargar(); }, [abierto, cargar]);

  async function crear() {
    setCreando(true); setError(null); setNuevo(null);
    try {
      const r = await fetch('/api/compartir', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recurso, recursoId, modo, etiqueta, emails: modo === 'invitados' ? emails.split(/[\s,;]+/).filter(Boolean) : [] }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || 'no se pudo crear');
      else { setNuevo({ enlace: j.enlace, invitados: j.invitados || [] }); setEmails(''); cargar(); }
    } catch { setError('no se pudo crear'); }
    setCreando(false);
  }

  async function revocar(id: number, invitadoId?: number) {
    await fetch(`/api/compartir?${invitadoId ? `invitado=${invitadoId}` : `id=${id}`}`, { method: 'DELETE' }).catch(() => {});
    cargar();
  }

  const copiar = (txt: string) => { navigator.clipboard?.writeText(txt); setCopiado(true); setTimeout(() => setCopiado(false), 1800); };
  const vivos = (lista ?? []).filter((s) => !s.revocado_at);

  return (
    <>
      <button type="button" className="cmp-btn" onClick={() => { setAbierto(true); setNuevo(null); setError(null); }}>
        Compartir
      </button>

      {abierto && (
        <div className="cmp-ov" role="dialog" aria-modal="true" onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false); }}>
          <div className="cmp-box">
            <h3 className="cmp-h">Compartir «{etiqueta}»</h3>

            <label className={`cmp-modo${modo === 'link' ? ' on' : ''}`}>
              <input type="radio" name="cmp-modo" checked={modo === 'link'} onChange={() => setModo('link')} />
              <span><b>Cualquiera con el enlace</b><small>Quien tenga el link entra, sin login.</small></span>
            </label>
            <label className={`cmp-modo${modo === 'invitados' ? ' on' : ''}`}>
              <input type="radio" name="cmp-modo" checked={modo === 'invitados'} onChange={() => setModo('invitados')} />
              <span><b>Solo las personas que invite</b><small>Cada una recibe su propio enlace por mail.</small></span>
            </label>

            {modo === 'invitados' && (
              <textarea className="cmp-mails" rows={2} value={emails} onChange={(e) => setEmails(e.target.value)}
                placeholder="nombre@gmail.com, otro@empresa.com" />
            )}

            {error && <p className="cmp-err">{error}</p>}

            {nuevo && (
              <div className="cmp-nuevo">
                {nuevo.enlace && (
                  <>
                    <p className="cmp-nuevo-t">Listo — <b>copialo ahora, se muestra una sola vez</b>:</p>
                    <div className="cmp-linkrow">
                      <input className="cmp-link" readOnly value={nuevo.enlace} onFocus={(e) => e.currentTarget.select()} />
                      <button type="button" className="cmp-copy" onClick={() => copiar(nuevo.enlace!)}>{copiado ? '✓' : 'Copiar'}</button>
                    </div>
                  </>
                )}
                {!!nuevo.invitados.length && (
                  <ul className="cmp-invs">
                    {nuevo.invitados.map((i) => (
                      <li key={i.email}>{i.enviado ? '✓ enviado a ' : '✖ no salió a '}<b>{i.email}</b>{i.error ? ` — ${i.error}` : ''}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {!nuevo && (
              <button type="button" className="cmp-crear" onClick={crear} disabled={creando || (modo === 'invitados' && !emails.trim())}>
                {creando ? 'Creando…' : 'Crear enlace'}
              </button>
            )}

            {!!vivos.length && (
              <div className="cmp-lista">
                <p className="cmp-lista-t">Enlaces activos</p>
                {vivos.map((s) => (
                  <div key={s.id} className="cmp-item">
                    <div className="cmp-item-in">
                      <span className="cmp-item-t">
                        {s.modo === 'link' ? 'Cualquiera con el enlace' : `${s.invitados.filter((i) => !i.revocado_at).length} invitado(s)`}
                        <span className="cmp-pref"> · {s.token_prefijo}…</span>
                      </span>
                      <span className="cmp-item-m">{s.visitas} {s.visitas === 1 ? 'visita' : 'visitas'}</span>
                    </div>
                    <button type="button" className="cmp-rev" onClick={() => revocar(s.id)}>Revocar</button>
                  </div>
                ))}
              </div>
            )}

            <div className="cmp-pie">
              <button type="button" className="cmp-cerrar" onClick={() => setAbierto(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .cmp-btn { font-family: var(--mono, ui-monospace), monospace; font-size: 12px; letter-spacing: .05em; text-transform: uppercase;
          color: var(--ink, #1a1a1a); background: var(--lime, #C8F169); border: 1.5px solid var(--ink, #1a1a1a);
          border-radius: 8px; padding: 8px 14px; cursor: pointer; transition: .14s; }
        .cmp-btn:hover { box-shadow: 3px 3px 0 var(--ink, #1a1a1a); transform: translate(-1px,-1px); }
        .cmp-ov { position: fixed; inset: 0; z-index: 120; background: rgba(24,26,22,.44); display: grid; place-items: center; padding: 20px; }
        .cmp-box { width: min(560px, 100%); max-height: 88vh; overflow: auto; background: var(--card, #fffdf7);
          color: var(--ink, #1a1a1a); border: 1.5px solid var(--ink, #1a1a1a); border-radius: 14px; padding: 22px; box-shadow: 6px 6px 0 rgba(24,26,22,.16); }
        .cmp-h { margin: 0 0 15px; font-size: 19px; font-weight: 800; letter-spacing: -.02em; }
        .cmp-modo { display: flex; gap: 10px; align-items: flex-start; padding: 12px; margin-bottom: 8px; border-radius: 10px;
          border: 1.5px solid rgba(24,26,22,.18); cursor: pointer; font-size: 13.5px; line-height: 1.45; }
        .cmp-modo.on { border-color: var(--ink, #1a1a1a); background: rgba(200,241,105,.22); }
        .cmp-modo small { display: block; opacity: .62; margin-top: 2px; }
        .cmp-mails { width: 100%; margin: 4px 0 2px; padding: 10px 12px; border-radius: 9px; font-family: inherit; font-size: 13.5px;
          background: #fff; border: 1.5px solid rgba(24,26,22,.2); color: var(--ink, #1a1a1a); resize: vertical; }
        .cmp-err { color: #b3261e; font-size: 13px; margin: 10px 0 0; }
        .cmp-crear { margin-top: 14px; width: 100%; padding: 11px; border-radius: 9px; cursor: pointer; font-size: 14px; font-weight: 700;
          font-family: inherit; background: var(--lime, #C8F169); border: 1.5px solid var(--ink, #1a1a1a); color: var(--ink, #1a1a1a); }
        .cmp-crear:disabled { opacity: .5; cursor: not-allowed; }
        .cmp-nuevo { margin-top: 14px; padding: 13px; border-radius: 10px; background: rgba(200,241,105,.18); border: 1.5px solid var(--ink, #1a1a1a); }
        .cmp-nuevo-t { margin: 0 0 8px; font-size: 13.5px; }
        .cmp-linkrow { display: flex; gap: 7px; }
        .cmp-link { flex: 1; padding: 9px 11px; border-radius: 8px; font-family: ui-monospace, monospace; font-size: 11.5px;
          background: #fff; border: 1.5px solid rgba(24,26,22,.22); color: var(--ink, #1a1a1a); }
        .cmp-copy { padding: 9px 14px; border-radius: 8px; cursor: pointer; font-size: 12.5px; font-weight: 700; font-family: inherit;
          background: var(--ink, #1a1a1a); color: #fff; border: 0; }
        .cmp-invs { margin: 10px 0 0; padding-left: 17px; font-size: 12.5px; line-height: 1.7; }
        .cmp-lista { margin-top: 18px; border-top: 1.5px solid rgba(24,26,22,.14); padding-top: 14px; }
        .cmp-lista-t { margin: 0 0 9px; font-size: 11.5px; letter-spacing: .09em; text-transform: uppercase; opacity: .55; font-family: var(--mono, monospace); }
        .cmp-item { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 0; border-bottom: 1px solid rgba(24,26,22,.08); }
        .cmp-item-in { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .cmp-item-t { font-size: 13px; font-weight: 600; }
        .cmp-pref { font-family: ui-monospace, monospace; font-size: 11px; opacity: .5; font-weight: 400; }
        .cmp-item-m { font-size: 11.5px; opacity: .55; }
        .cmp-rev { padding: 6px 12px; border-radius: 7px; cursor: pointer; font-size: 12px; font-weight: 600; font-family: inherit;
          background: transparent; border: 1.5px solid rgba(179,38,30,.45); color: #b3261e; flex: none; }
        .cmp-pie { display: flex; justify-content: flex-end; margin-top: 16px; }
        .cmp-cerrar { padding: 9px 17px; border-radius: 9px; cursor: pointer; font-size: 13.5px; font-weight: 600; font-family: inherit;
          background: transparent; border: 1.5px solid rgba(24,26,22,.25); color: var(--ink, #1a1a1a); }
      `}</style>
    </>
  );
}
