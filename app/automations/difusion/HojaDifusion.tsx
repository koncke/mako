'use client';

// =============================================================================
// HojaDifusion — «Mandar mensaje» a los leads elegidos, sin salir del CRM (28/10/2026, pedido de Martín por Leila)
// =============================================================================
// La monta el CRM (la selección del tablero: tildados o la columna entera, y el botón de la barra en bloque). Todo lo demás
// vive acá: por qué canales (y a cuántos les llega por cada uno, quién queda afuera y por qué), la MISMA tarjeta de cada
// canal que en Automations, el goteo y el tope del día de ESTA difusión, y el aviso del WhatsApp por QR. Al mandar crea UNA
// automatización de una sola vez (lib/difusion.ts) que después se ve en Automations con sus métricas.
//
// 2/11/2026, Martín: «que se vea lindo, con el formato de cada red social, como lo tenemos en Automations». Es un modal de
// la casa (`Modal`) con dos columnas, el riel de 336 px de docs/diseno/referencia-spy.md y el panel del lienzo (Lienzo.tsx:
// logo y nombre arriba, padding 14, radio 14): un canal a la vista, y los otros siguen montados para no perder lo escrito.
// ⚠️ La cabecera NO trae el desplegable de número o cuenta de `CabeceraWhatsApp`: la difusión no los guarda (lib/difusion-reglas.ts,
// `MensajesDifusion`), así que elegir uno mentiría.
//
//   <HojaDifusion abierta seleccion={{ leadIds }} | {{ funnelId, etapa }} onCerrar={…} onCreada={(r) => …} />
// =============================================================================

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Button } from '@/app/_ui/Button';
import { Confirm } from '@/app/_ui/Confirm';
import { Modal } from '@/app/_ui/Modal';
import { SANS } from '@/app/_ui/tokens';
import { IconoCanal } from '@/app/chats/iconos-canal';
import { EditorMensajeWhatsApp } from '@/app/automations/EditorMensajeWhatsApp';
import { EditorEmailGmail, type CambioEmail } from '@/app/automations/EditorEmailGmail';
import { EditorMensajeSocial } from '@/app/automations/EditorMensajeSocial';
import { LogoSocial } from '@/app/automations/social-ui';
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

const conMayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** El color de cada canal: el mismo en la fila y en el panel, para no tener que leer el nombre. */
const MARCA: Record<CanalDifusion, string> = { whatsapp: '#25D366', email: '#EA4335', instagram: '#D62976' };

/**
 * El logo del canal. WhatsApp es `IconoCanal` y no el `SvcIcon` del lienzo: ése pinta con un `<use>` de un símbolo que el CRM no
 * monta, y queda un cuadrado verde liso. El sobre de Gmail es el de `IconoNodo` (app/_components/Lienzo.tsx): importarlo traería el lienzo entero.
 */
function LogoCanal({ canal, tam }: { canal: CanalDifusion; tam: number }) {
  if (canal === 'whatsapp') return <IconoCanal canal="whatsapp" size={tam} />;
  if (canal === 'instagram') return <LogoSocial canal="instagram" size={tam} />;
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" aria-hidden style={{ display: 'block', flex: 'none' }}>
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill="#fff" stroke="#EA4335" strokeWidth="1.6" />
      <path d="M3.2 6.4 12 13l8.8-6.6" fill="none" stroke="#EA4335" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** El panel de un canal. Oculto sigue montado: lo que quedó en la barra de un editor no se pierde al mirar otro canal. */
function PanelCanal({ canal, visible, children }: { canal: CanalDifusion; visible: boolean; children: ReactNode }) {
  return (
    <section aria-label={NOMBRE_CANAL_DIFUSION[canal]} data-panel-canal={canal} style={{ ...PANEL, display: visible ? 'flex' : 'none', background: `color-mix(in srgb, ${MARCA[canal]} 4%, var(--surface))` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flex: 'none' }}>
        <LogoCanal canal={canal} tam={24} />
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{NOMBRE_CANAL_DIFUSION[canal]}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </section>
  );
}

export function HojaDifusion({ abierta, seleccion, onCerrar, onCreada }: PropsHojaDifusion) {
  const [vista, setVista] = useState<VistaDifusion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [canales, setCanales] = useState<CanalDifusion[]>([]);
  const [viendo, setViendo] = useState<CanalDifusion | null>(null);
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

  // El panel que se ve: el que se tocó, o el primero que quede prendido.
  const activo = viendo && canales.includes(viendo) ? viendo : CANALES_DIFUSION.find((c) => canales.includes(c)) ?? null;
  const alternar = (c: CanalDifusion) => {
    if (!canales.includes(c)) setViendo(c);
    setCanales((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));
  };

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
    <>
      <Modal ancho={1040} alto="min(88vh, 780px)" etiqueta="Mandar mensaje" onCerrar={onCerrar}
        titulo={<>Mandar mensaje<span style={{ display: 'inline-block', marginLeft: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--dim)' }}>{titulo}{vista ? ` · ${vista.alcance.total} ${vista.alcance.total === 1 ? 'lead' : 'leads'}` : ''}{vista?.cortado ? ' (los primeros)' : ''}</span></>}
        pie={<>
          <span role="status" className="hoja-dif__estado" style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: error ? 'var(--warn)' : 'var(--dim)' }}>{error ?? (vista ? falta ?? '' : '')}</span>
          <Button variant="secondary" onClick={onCerrar} disabled={mandando}>Cancelar</Button>
          <Button variant="primary" disabled={!vista || !!falta || !goteoOk || mandando} loading={mandando} onClick={() => setConfirmando(true)}>
            {alcance && alcance.llegan > 0 ? `Mandar a ${alcance.llegan}` : 'Mandar'}
          </Button>
        </>}>
        <div data-hoja-difusion className="hoja-dif" style={{ fontFamily: SANS }}>
          <style>{CSS}</style>
          <div className="hoja-dif__riel">
            <section aria-label="Canales" className="hoja-dif__canales" style={{ display: 'grid', gap: 8 }}>
              <div style={TITULO}>Por dónde</div>
              {!vista && !error && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--dim)' }}>Mirando a quién le llega…</p>}
              {vista && CANALES_DIFUSION.map((c) => {
                const fila = alcanceDeMotivos(vista.porLead, [c], ritmo).porCanal[0];
                const sinQr = c === 'whatsapp' && !vista.whatsappQr;
                const on = canales.includes(c) && !sinQr;
                const listo = on && !problemaDeDifusion({ canales: [c], mensajes, alcance: { llegan: 1 } });
                return (
                  <div key={c} data-canal={c} data-viendo={activo === c ? '' : undefined}
                    style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px', borderRadius: 14, opacity: sinQr ? 0.6 : 1,
                      background: on ? `color-mix(in srgb, ${MARCA[c]} 8%, var(--surface))` : 'var(--surface-2)',
                      boxShadow: `inset 0 0 0 ${activo === c ? '1.5px' : '1px'} ${activo === c ? MARCA[c] : 'var(--border)'}` }}>
                    <button type="button" disabled={sinQr || mandando} onClick={() => { if (on) setViendo(c); else alternar(c); }}
                      style={{ flex: 1, minWidth: 0, display: 'flex', gap: 10, alignItems: 'center', padding: 0, border: 'none', background: 'none', textAlign: 'left', fontFamily: SANS, color: 'inherit', cursor: sinQr ? 'default' : 'pointer' }}>
                      <LogoCanal canal={c} tam={30} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                          {NOMBRE_CANAL_DIFUSION[c]}{listo && <span aria-label="Mensaje listo" style={{ marginLeft: 6, color: 'var(--good)' }}>✓</span>}
                        </span>
                        <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)' }}>{sinQr ? 'No hay un WhatsApp por QR conectado' : `Le llega a ${fila.llegan}`}</span>
                        {!sinQr && fila.afuera.length > 0 && (
                          <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 2 }}>
                            Afuera: {fila.afuera.map((a) => `${a.cuantos} ${TEXTO_AFUERA[a.motivo]}`).join(' · ')}
                          </span>
                        )}
                      </span>
                    </button>
                    <input type="checkbox" checked={on} disabled={sinQr || mandando} aria-label={`Mandar por ${NOMBRE_CANAL_DIFUSION[c]}`} onChange={() => alternar(c)}
                      style={{ flex: 'none', width: 18, height: 18, accentColor: MARCA[c], cursor: sinQr ? 'default' : 'pointer' }} />
                  </div>
                );
              })}
              {alcance && canales.length > 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  Le llega a <strong>{alcance.llegan}</strong> de {alcance.total}{alcance.ninguno > 0 ? ` · ${alcance.ninguno} no tienen ninguno de estos canales` : ''}.
                </div>
              )}
            </section>

            {vista && canales.length > 0 && (
              <section aria-label="Ritmo" className="hoja-dif__ritmo" style={{ display: 'grid', gap: 8, padding: '12px 14px', borderRadius: 14, background: 'var(--surface-2)', boxShadow: 'inset 0 0 0 1px var(--border)' }}>
                <div style={TITULO}>Ritmo · todos los canales</div>
                <div style={CELDAS}>
                  <label style={CELDA}>Uno cada (min)
                    <input type="number" min={mMin} max={mMax} value={goteo.minutos} disabled={mandando} aria-label="Minutos entre mensajes"
                      onChange={(e) => setGoteo((g) => ({ ...g, minutos: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                  </label>
                  <label style={CELDA}>Tope por día
                    <input type="number" min={dMin} max={dMax} value={goteo.dia} disabled={mandando} aria-label="Tope por día"
                      onChange={(e) => setGoteo((g) => ({ ...g, dia: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                  </label>
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--dim)' }}>
                  Cada canal cuenta lo suyo.{alcance && goteoOk ? ` ${conMayuscula(textoDeDuracionPorCanal(alcance.porCanal, goteo))}.` : ''}
                  {!goteoOk ? ` Entre ${mMin} y ${mMax} minutos, y entre ${dMin} y ${dMax} por día.` : ''}
                </div>
                {canales.includes('whatsapp') && vista.whatsappQr && (
                  <>
                    <label style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', fontSize: 13.5, color: 'var(--ink)' }}>
                      <input type="checkbox" checked={conArranque} disabled={mandando} onChange={(e) => setConArranque(e.target.checked)} />
                      <span>Arrancar de a poco por WhatsApp</span>
                    </label>
                    {conArranque && (
                      <div style={CELDAS}>
                        <label style={CELDA}>Empieza con
                          <input type="number" min={dMin} max={dMax} value={arranque.dia} disabled={mandando} aria-label="Mensajes del primer día"
                            onChange={(e) => setArranque((a) => ({ ...a, dia: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                        </label>
                        <label style={CELDA}>Sube por día
                          <input type="number" min={dMin} max={dMax} value={arranque.sube} disabled={mandando} aria-label="Cuánto sube por día"
                            onChange={(e) => setArranque((a) => ({ ...a, sube: Math.round(Number(e.target.value)) }))} style={NUMERO} />
                        </label>
                      </div>
                    )}
                    {vista.lineaWaDia != null && goteo.dia > vista.lineaWaDia && (
                      <div role="note" style={{ fontSize: 12.5, color: 'var(--warn)' }}>Tu línea de WhatsApp manda hasta {vista.lineaWaDia} por día: más que eso no sale.</div>
                    )}
                  </>
                )}
              </section>
            )}
          </div>

          <div className="hoja-dif__panel">
            {vista && !activo && (
              <div style={{ ...PANEL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13.5, color: 'var(--dim)' }}>Elige por dónde sale</div>
            )}
            {vista && canales.includes('whatsapp') && vista.whatsappQr && (
              <PanelCanal canal="whatsapp" visible={activo === 'whatsapp'}>
                <EditorMensajeWhatsApp paso={wa} onChange={(patch) => setWa((p) => ({ ...p, ...patch }))} audios={[]} permiteAudio={false} permiteAdjuntos={false} conVersiones deshabilitado={mandando} />
                {!wa.variantes?.length && <div style={{ flex: 'none', fontSize: 12.5, color: 'var(--dim)' }}>El mismo texto a muchos sube el riesgo: con ↻ le agregas otras formas de decirlo, y a cada uno le toca una.</div>}
                <div role="note" style={{ flex: 'none', fontSize: 12.5, color: 'var(--warn)' }}>{AVISO_QR}</div>
              </PanelCanal>
            )}
            {vista && canales.includes('email') && (
              <PanelCanal canal="email" visible={activo === 'email'}>
                <EditorEmailGmail asunto={email.asunto} cuerpo={email.cuerpo} cuerpoHtml={email.cuerpo_html} deshabilitado={mandando}
                  onChange={(c: CambioEmail) => setEmail((e) => ({
                    asunto: c.asunto ?? e.asunto, cuerpo: c.cuerpo ?? e.cuerpo, cuerpo_html: c.cuerpo_html ?? e.cuerpo_html,
                  }))} />
              </PanelCanal>
            )}
            {vista && canales.includes('instagram') && (
              <PanelCanal canal="instagram" visible={activo === 'instagram'}>
                <EditorMensajeSocial paso={ig} canal="instagram" onChange={(patch) => setIg((p) => ({ ...p, ...patch }))} deshabilitado={mandando} />
              </PanelCanal>
            )}
          </div>
        </div>
      </Modal>
      {confirmando && alcance && (
        <Confirm tone="primary" title={`Mandar a ${alcance.llegan} ${alcance.llegan === 1 ? 'lead' : 'leads'}`}
          message={`Por ${canales.map((c) => NOMBRE_CANAL_DIFUSION[c]).join(', ')}, de a uno cada ${goteo.minutos} min y hasta ${goteo.dia} por día${goteo.arranque ? `; por WhatsApp arranca con ${goteo.arranque.dia} y sube ${goteo.arranque.sube} por día` : ''}. Queda como una automatización en Automations, con sus métricas.`}
          confirmLabel="Mandar" loading={mandando} onConfirm={() => void mandar()} onCancel={() => setConfirmando(false)} />
      )}
    </>
  );
}

const TITULO: CSSProperties = { fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' };
/** El panel del lienzo (app/_components/Lienzo.tsx): padding 14, radio 14, borde fuerte. */
const PANEL: CSSProperties = { flex: 1, minHeight: 0, flexDirection: 'column', padding: 14, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border-strong)' };
/** En angosto, una sola columna y el modal entero scrollea: canales, el mensaje, el ritmo. */
const CSS = `
.hoja-dif { display: grid; grid-template-columns: 336px minmax(0, 1fr); gap: 18px; height: 100%; min-height: 0; }
.hoja-dif__riel { display: flex; flex-direction: column; gap: 18px; min-height: 0; overflow-y: auto; scrollbar-width: thin; }
.hoja-dif__panel { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
@media (max-width: 860px) {
  .hoja-dif { display: flex; flex-direction: column; height: auto; }
  .hoja-dif__riel { display: contents; }
  .hoja-dif__canales { order: 1; }
  .hoja-dif__panel { order: 2; min-height: 460px; }
  .hoja-dif__ritmo { order: 3; }
  .mk-modal__pie:has(.hoja-dif__estado) { flex-wrap: wrap; }
  .hoja-dif__estado { flex-basis: 100% !important; }
}
`;
const CELDAS: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 };
const CELDA: CSSProperties = { display: 'grid', gap: 4, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)' };
const NUMERO: CSSProperties = { width: '100%', height: 32, borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', padding: '0 8px', fontFamily: SANS, fontSize: 13.5 };
