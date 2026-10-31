'use client';

// =============================================================================
// HojaDifusion — «Mandar mensaje» a los leads elegidos, sin salir del CRM (28/10/2026, pedido de Martín por Leila)
// =============================================================================
// La monta el CRM (la selección del tablero: tildados o la columna entera, y el botón de la barra en bloque). Todo lo demás
// vive acá: por qué canales (y a cuántos les llega por cada uno, quién queda afuera y por qué), la MISMA tarjeta de cada
// canal que en Automations, el goteo y el tope del día de ESTA difusión, y el aviso del WhatsApp por QR. Al mandar crea UNA
// automatización de una sola vez (lib/difusion.ts) que después se ve en Automations con sus métricas.
//
//   <HojaDifusion abierta seleccion={{ leadIds }} | {{ funnelId, etapa }} onCerrar={…} onCreada={(r) => …} />
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button } from '@/app/_ui/Button';
import { Confirm } from '@/app/_ui/Confirm';
import { SANS } from '@/app/_ui/tokens';
import { EditorMensajeWhatsApp } from '@/app/automations/EditorMensajeWhatsApp';
import { EditorEmailGmail, type CambioEmail } from '@/app/automations/EditorEmailGmail';
import { EditorMensajeSocial } from '@/app/automations/EditorMensajeSocial';
import type { PasoSecuenciaDto } from '@/app/automations/ChatAgentApp';
import {
  alcanceDeMotivos, problemaDeDifusion, textoDeDuracionPorCanal, goteoConArranque, CANALES_DIFUSION, NOMBRE_CANAL_DIFUSION, TEXTO_AFUERA, GOTEO_DIFUSION_INICIAL, ARRANQUE_DIFUSION_INICIAL,
  type CanalDifusion, type MensajesDifusion,
} from '@/lib/difusion-reglas';
import { RANGOS_GOTEO } from '@/lib/config-automatizacion';
import { prepararDifusionAction, crearDifusionAction } from './actions';
import type { VistaDifusion } from '@/lib/difusion';

export type SeleccionHojaDifusion = { leadIds: number[] } | { funnelId: number | null; etapa: string };

export type PropsHojaDifusion = {
  abierta: boolean;
  /** Los tildados del tablero, o la columna entera (el server la resuelve: puede tener más tarjetas que las cargadas). */
  seleccion: SeleccionHojaDifusion;
  onCerrar: () => void;
  /** Cuando se mandó: la automatización que quedó (para el aviso «Ver en Automations», /automations?sec=ID). */
  /** `yaEstaban`: era el MISMO pedido y retomó la difusión que ya existía (lib/difusion.ts): no la mandó dos veces. */
  onCreada?: (r: { secuenciaId: number; nombre: string; leads: number; yaEstaban?: number }) => void;
};

/** El aviso del QR (el mismo riesgo que dice la ficha del lead: «nunca en masa»). */
const AVISO_QR = 'WhatsApp por QR: mandarle a muchos puede hacer que WhatsApp bloquee el número. Con goteo y tope por día el riesgo baja, no desaparece.';

const pasoVacio = (canal: 'whatsapp' | 'instagram'): PasoSecuenciaDto => ({
  orden: 0, canal, delay_horas: 0, asunto: null, cuerpo: '', template_wa: null, id: `d_${canal}`,
  ...(canal === 'whatsapp' ? { proveedor: 'no_oficial' } : {}),
} as unknown as PasoSecuenciaDto);

export function HojaDifusion({ abierta, seleccion, onCerrar, onCreada }: PropsHojaDifusion) {
  const [vista, setVista] = useState<VistaDifusion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canales, setCanales] = useState<CanalDifusion[]>([]);
  const [wa, setWa] = useState<PasoSecuenciaDto>(() => pasoVacio('whatsapp'));
  const [ig, setIg] = useState<PasoSecuenciaDto>(() => pasoVacio('instagram'));
  const [email, setEmail] = useState<{ asunto: string; cuerpo: string; cuerpo_html: string | null }>({ asunto: '', cuerpo: '', cuerpo_html: null });
  const [goteoElegido, setGoteo] = useState<{ minutos: number; dia: number }>({ ...GOTEO_DIFUSION_INICIAL });
  // De a poco, de entrada: mandar en masa por QR es el riesgo de bloqueo (ARRANQUE_DIFUSION_INICIAL). Se saca con un tilde.
  const [conArranque, setConArranque] = useState(true);
  const [arranque, setArranque] = useState({ ...ARRANQUE_DIFUSION_INICIAL });
  const [confirmando, setConfirmando] = useState(false);
  const [mandando, setMandando] = useState(false);
  // Cuándo se leyó a quién le llega: desde ahí se cuentan los turnos del goteo de Instagram contra la ventana de cada uno.
  const [leidaAt, setLeidaAt] = useState(0);
  const clave = JSON.stringify(seleccion);

  // Al abrir: a quién le llega. Arranca con los canales por los que le llega a alguien (sin WhatsApp si no hay QR).
  useEffect(() => {
    if (!abierta) return;
    let vivo = true;
    setVista(null); setError(null);
    prepararDifusionAction(JSON.parse(clave)).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setError(r.error); return; }
      setVista(r.vista); setLeidaAt(Date.now());
      setCanales(r.vista.alcance.porCanal.filter((c) => c.llegan > 0).map((c) => c.canal));
    }).catch(() => { if (vivo) setError('No pude leer a quién le llega.'); });
    return () => { vivo = false; };
  }, [abierta, clave]);

  // Escape cierra (si no hay una confirmación encima).
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !confirmando && !e.isComposing) onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierta, confirmando, onCerrar]);

  const [mMin, mMax] = RANGOS_GOTEO.minutos;
  const [dMin, dMax] = RANGOS_GOTEO.dia;
  // El arranque es sólo de WhatsApp (el motor no se lo aplica a los otros canales). Y si empieza en el tope, no hay nada que suba.
  const arrancaDePoco = conArranque && canales.includes('whatsapp') && !!vista?.whatsappQr;
  const goteo = useMemo(() => goteoConArranque(goteoElegido, arrancaDePoco ? arranque : null), [goteoElegido, arrancaDePoco, arranque]);
  const enRango = (n: number) => n >= dMin && n <= dMax;
  const goteoOk = goteo.minutos >= mMin && goteo.minutos <= mMax && goteo.dia >= dMin && goteo.dia <= dMax && (!arrancaDePoco || (enRango(arranque.dia) && enRango(arranque.sube)));
  // Con el goteo, Instagram promete sólo a los que alcanza antes de que se les cierre la ventana (`alcanceDeMotivos`).
  const ritmo = useMemo(() => (goteoOk && leidaAt ? { goteo, ahoraMs: leidaAt } : undefined), [goteoOk, goteo, leidaAt]);
  const alcance = useMemo(() => (vista ? alcanceDeMotivos(vista.porLead, canales, ritmo) : null), [vista, canales, ritmo]);
  const mensajes: MensajesDifusion = useMemo(() => ({
    ...(canales.includes('whatsapp') ? { whatsapp: { cuerpo: String(wa.cuerpo ?? ''), ...(Array.isArray((wa as { partes?: unknown[] }).partes) ? { partes: (wa as { partes?: unknown[] }).partes } : {}), ...(wa.variantes?.length ? { variantes: wa.variantes } : {}) } } : {}),
    ...(canales.includes('email') ? { email } : {}),
    ...(canales.includes('instagram') ? { instagram: { cuerpo: String(ig.cuerpo ?? ''), ...(Array.isArray((ig as { partes?: unknown[] }).partes) ? { partes: (ig as { partes?: unknown[] }).partes } : {}) } } : {}),
  }), [canales, wa, ig, email]);
  const falta = alcance ? problemaDeDifusion({ canales, mensajes, alcance }) : null;

  const alternar = (c: CanalDifusion) => setCanales((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  const mandar = useCallback(async () => {
    setMandando(true); setError(null);
    try {
      const r = await crearDifusionAction({ seleccion: JSON.parse(clave), canales, mensajes, goteo });
      if (r.ok) { onCreada?.({ secuenciaId: r.secuenciaId, nombre: r.nombre, leads: r.leads, ...(r.yaEstaban != null ? { yaEstaban: r.yaEstaban } : {}) }); onCerrar(); }
      else setError(r.error);
    } catch { setError('No se pudo mandar. Vuelve a intentarlo.'); }
    setMandando(false); setConfirmando(false);
  }, [clave, canales, mensajes, goteo, onCreada, onCerrar]);

  if (!abierta) return null;
  const titulo = vista?.etapa ? `A los de «${vista.etapa}»` : 'A los leads elegidos';

  return (
    <div data-hoja-difusion onClick={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(18,21,27,.42)', display: 'flex', justifyContent: 'flex-end' }}>
      <aside role="dialog" aria-modal="true" aria-label="Mandar mensaje" onClick={(e) => e.stopPropagation()}
        style={{ width: 'min(560px, 100vw)', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderLeft: '1px solid var(--border)', boxShadow: '-20px 0 50px rgba(18,21,27,.25)', fontFamily: SANS }}>
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>Mandar mensaje</div>
            <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>
              {titulo}{vista ? ` · ${vista.alcance.total} ${vista.alcance.total === 1 ? 'lead' : 'leads'}` : ''}{vista?.cortado ? ' (los primeros)' : ''}
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onCerrar}
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1, color: 'var(--dim)', padding: 4 }}>×</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'grid', gap: 18, alignContent: 'start' }}>
          {!vista && !error && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>Mirando a quién le llega…</p>}
          {vista && (
            <section aria-label="Canales" style={{ display: 'grid', gap: 8 }}>
              <div style={TITULO}>Por dónde</div>
              {CANALES_DIFUSION.map((c) => {
                const fila = alcanceDeMotivos(vista.porLead, [c], ritmo).porCanal[0];
                const sinQr = c === 'whatsapp' && !vista.whatsappQr;
                const on = canales.includes(c) && !sinQr;
                return (
                  <label key={c} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 12, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)', cursor: sinQr ? 'default' : 'pointer', opacity: sinQr ? 0.6 : 1 }}>
                    <input type="checkbox" checked={on} disabled={sinQr || mandando} onChange={() => alternar(c)} style={{ marginTop: 3 }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{NOMBRE_CANAL_DIFUSION[c]}</span>
                      <span style={{ fontSize: 13, color: 'var(--dim)' }}> · {sinQr ? 'no hay un WhatsApp por QR conectado' : `le llega a ${fila.llegan}`}</span>
                      {!sinQr && fila.afuera.length > 0 && (
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 2 }}>
                          Afuera: {fila.afuera.map((a) => `${a.cuantos} ${TEXTO_AFUERA[a.motivo]}`).join(' · ')}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
              {alcance && canales.length > 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  Le llega a <strong>{alcance.llegan}</strong> de {alcance.total}{alcance.ninguno > 0 ? ` · ${alcance.ninguno} no tienen ninguno de estos canales` : ''}.
                </div>
              )}
            </section>
          )}

          {vista && canales.includes('whatsapp') && vista.whatsappQr && (
            <section aria-label="WhatsApp" style={{ display: 'grid', gap: 8 }}>
              <div style={TITULO}>WhatsApp</div>
              <EditorMensajeWhatsApp paso={wa} onChange={(patch) => setWa((p) => ({ ...p, ...patch }))} audios={[]} permiteAudio={false} permiteAdjuntos={false} conVersiones deshabilitado={mandando} />
              {!wa.variantes?.length && <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>El mismo texto a muchos sube el riesgo: con ↻ le agregas otras formas de decirlo, y a cada uno le toca una.</div>}
            </section>
          )}
          {vista && canales.includes('email') && (
            <section aria-label="Email" style={{ display: 'grid', gap: 8 }}>
              <div style={TITULO}>Email</div>
              <EditorEmailGmail asunto={email.asunto} cuerpo={email.cuerpo} cuerpoHtml={email.cuerpo_html} deshabilitado={mandando}
                onChange={(c: CambioEmail) => setEmail((e) => ({
                  asunto: c.asunto ?? e.asunto, cuerpo: c.cuerpo ?? e.cuerpo, cuerpo_html: c.cuerpo_html ?? e.cuerpo_html,
                }))} />
            </section>
          )}
          {vista && canales.includes('instagram') && (
            <section aria-label="Instagram" style={{ display: 'grid', gap: 8 }}>
              <div style={TITULO}>Instagram</div>
              <EditorMensajeSocial paso={ig} canal="instagram" onChange={(patch) => setIg((p) => ({ ...p, ...patch }))} deshabilitado={mandando} />
            </section>
          )}

          {vista && canales.length > 0 && (
            <section aria-label="Ritmo" style={{ display: 'grid', gap: 8 }}>
              <div style={TITULO}>Ritmo · todos los canales</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13.5, color: 'var(--ink)' }}>
                <span>De a uno cada</span>
                <input type="number" min={mMin} max={mMax} value={goteo.minutos} disabled={mandando} aria-label="Minutos entre mensajes"
                  onChange={(e) => setGoteo((g) => ({ ...g, minutos: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                <span>min, hasta</span>
                <input type="number" min={dMin} max={dMax} value={goteo.dia} disabled={mandando} aria-label="Tope por día"
                  onChange={(e) => setGoteo((g) => ({ ...g, dia: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                <span>por día.</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                Cada canal cuenta lo suyo.{alcance && goteoOk ? ` ${textoDeDuracionPorCanal(alcance.porCanal, goteo)}.` : ''}
                {!goteoOk ? ` Entre ${mMin} y ${mMax} minutos, y entre ${dMin} y ${dMax} por día.` : ''}
              </div>
              {canales.includes('whatsapp') && vista.whatsappQr && (
                <>
                  <label style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13.5, color: 'var(--ink)' }}>
                    <input type="checkbox" checked={conArranque} disabled={mandando} onChange={(e) => setConArranque(e.target.checked)} />
                    <span>Arrancar de a poco por WhatsApp</span>
                  </label>
                  {conArranque && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13.5, color: 'var(--ink)' }}>
                      <span>Empieza con</span>
                      <input type="number" min={dMin} max={dMax} value={arranque.dia} disabled={mandando} aria-label="Mensajes del primer día"
                        onChange={(e) => setArranque((a) => ({ ...a, dia: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                      <span>y sube</span>
                      <input type="number" min={dMin} max={dMax} value={arranque.sube} disabled={mandando} aria-label="Cuánto sube por día"
                        onChange={(e) => setArranque((a) => ({ ...a, sube: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                      <span>por día, hasta el tope.</span>
                    </div>
                  )}
                  {vista.lineaWaDia != null && goteo.dia > vista.lineaWaDia && (
                    <div role="note" style={{ fontSize: 12.5, color: 'var(--warn)' }}>Tu línea de WhatsApp manda hasta {vista.lineaWaDia} por día: más que eso no sale.</div>
                  )}
                  <div role="note" style={{ fontSize: 12.5, color: 'var(--warn)' }}>{AVISO_QR}</div>
                </>
              )}
            </section>
          )}
        </div>

        <footer style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <span role="status" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: error ? 'var(--warn)' : 'var(--dim)' }}>{error ?? (vista ? falta ?? '' : '')}</span>
          <Button variant="secondary" onClick={onCerrar} disabled={mandando}>Cancelar</Button>
          <Button variant="primary" disabled={!vista || !!falta || !goteoOk || mandando} loading={mandando} onClick={() => setConfirmando(true)}>
            {alcance && alcance.llegan > 0 ? `Mandar a ${alcance.llegan}` : 'Mandar'}
          </Button>
        </footer>
      </aside>
      {confirmando && alcance && (
        <Confirm tone="primary" title={`Mandar a ${alcance.llegan} ${alcance.llegan === 1 ? 'lead' : 'leads'}`}
          message={`Por ${canales.map((c) => NOMBRE_CANAL_DIFUSION[c]).join(', ')}, de a uno cada ${goteo.minutos} min y hasta ${goteo.dia} por día${goteo.arranque ? `; por WhatsApp arranca con ${goteo.arranque.dia} y sube ${goteo.arranque.sube} por día` : ''}. Queda como una automatización en Automations, con sus métricas.`}
          confirmLabel="Mandar" loading={mandando} onConfirm={() => void mandar()} onCancel={() => setConfirmando(false)} />
      )}
    </div>
  );
}

const TITULO: CSSProperties = { fontFamily: "'Geist Mono', monospace", fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)' };
const NUMERO: CSSProperties = { width: 72, height: 32, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 8px', fontFamily: SANS, fontSize: 13.5 };
