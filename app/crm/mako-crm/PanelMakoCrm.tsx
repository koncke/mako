'use client';

// =============================================================================
// PanelMakoCrm — MaKo al costado del CRM: PLEGADO, con sus sugerencias y su chat
// =============================================================================
// Pedido de Martín (13/10/2026, General 3): «replica el mismo chat que hay en Automations, que se abre
// al costado… que siempre esté plegado y que ahí aparezcan notificaciones». El 14/10: «No veo nada
// sobre el chat de MaKo y las recomendaciones...». El mapa: docs/sugerencias-mako-crm.md.
//
//   · PLEGADO: desde el 21/10/2026, la criatura de MaKo (la ESTRELLA) ABAJO A LA IZQUIERDA, con la cara de «A
//     revisar» y el número de sugerencias (ver ANCHO_PANEL). La esquina de los avisos es la de abajo a la DERECHA:
//     acá no hace falta `data-esquina-ocupada`.
//   · ABIERTO: un panel a la izquierda, pegado a la sidebar, de arriba abajo, con las sugerencias arriba (UNA línea
//     cada una, «Hacerlo» y «Ahora no») y el chat abajo. Va DEBAJO de los modales (z 50 < 60).
//   · LO CARO NO SE CALCULA ACÁ NI EN LA PÁGINA: el botón pide las sugerencias UNA vez al montarse
//     (GET /api/crm/mako, que no escribe y sale de la caché del server). El HILO se pide recién al ABRIR
//     (el chat se monta ahí): abrirlo escribe.
//   · «HACERLO» Y «AHORA NO» los decide el server por ID (app/api/crm/mako/route.ts): la pantalla no
//     elige plantilla ni etapa. A quien no es admin no se le ofrece lo que es del admin (`hacer`,
//     `callar`). Lo creado nace PAUSADO y la fila deja el link para abrirlo en /automations.
//   · LO CALLADO TIENE VUELTA: debajo de las sugerencias, «Calladas (N)» despliega lo que el equipo
//     calló en ESTE CRM con «Volver a mostrar» en cada una. Del admin, como «Ahora no».
//   · ⚠️ UN PANEL POR CRM (`key`): cambiar de CRM desmonta el de antes, con su chat, y el nuevo nace
//     plegado. Con el mismo componente vivo, el chat ya montado recibía el CRM nuevo y cargaba SU hilo
//     con el panel plegado, y cargar el hilo escribe. Un efecto que desmonta no alcanza: el efecto del
//     chat (hijo) corre ANTES que el del panel, con el CRM nuevo, y el GET ya salió.
// =============================================================================

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Badge, Button, ButtonLink, IconButton } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import '@/app/admin/operaciones/centro.css';
import { leerRespuesta } from '@/app/m/mako/chat-ui';
import type { SugerenciaDePantalla } from '@/lib/sugerencias-crm';

// El chat (el hilo de WhatsApp, la barra, el micrófono) sólo viaja cuando se abre el panel.
const ChatMakoCrm = dynamic(() => import('./ChatMakoCrm').then((m) => m.ChatMakoCrm), { ssr: false });

const RUTA = '/api/crm/mako';
/** El logo adentro (`LADO_LOGO` de BotonLogoMako). */
const LADO_LOGO = 32;
/** Debajo de los modales (z ≥ 60) y de la esquina de los avisos (55). */
const Z_PANEL = 50;
/**
 * ⚠️ UNA BARRA FIJA A LA DERECHA (20/10/2026). Martín: «No veo el chat con MaKo que te había pedido». Dos causas:
 *   · el botón iba en `left: RAIL + 20`, con `RAIL` = 68, el ancho de la sidebar PLEGADA; abierta mide 244 y tiene
 *     z 60, así que el botón quedaba DEBAJO de la sidebar, invisible;
 *   · la regla del 18/10 (docs/feedback-18-10.md): «Editar = el patrón de Web Generator: el chat con MaKo como barra
 *     fija a la derecha». Pisa la del 16/10 («el botón de MaKo a la izquierda»).
 * Abre sola en una pantalla ancha y recuerda si la persona la plegó; plegada, es una pestaña en el borde derecho, a
 * media altura (ni la sidebar ni «A revisar», abajo a la derecha, la tapan). Abierta, el tablero le deja el lugar
 * (`--ancho-panel-mako`, que lee el padding de CrmBoard). El chat es el del CRM hasta que exista la pieza única del
 * chat del Ops Center: ahí se cambia el de adentro, no la barra.
 */
const ANCHO_PANEL = 400;
/**
 * ⚠️ A LA IZQUIERDA DESDE EL 21/10/2026, y con la ESTRELLA. Martín: «En el caso del CRM, debes poner el ícono de la
 * criatura abajo a la izquierda, como "A revisar", solo que a la izquierda... los iconos de las criaturas siempre debe ser
 * el icono de MaKo», y la regla del mismo día: «el chat de MaKo en las otras tabs se debe abrir siempre a la izquierda».
 * Pisa la barra a la derecha del 20/10 (y el muñeco del CRM del 16/10).
 * ⚠️ EL BORDE ES EL DE LA SIDEBAR MEDIDA, no un número: el 20/10 el botón iba en `left: RAIL + 20` (el ancho de la sidebar
 * PLEGADA) y la abierta (244, z 60) lo tapaba entero. Se mide `[data-sidebar]` (app/_components/Sidebar.tsx) y se sigue
 * con un ResizeObserver: plegar o desplegar la sidebar corre el botón y la barra con ella.
 */
const DESDE_ABAJO = 20;
/** El borde derecho de la sidebar, en px (0 sin sidebar). */
function useBordeSidebar(): number {
  const [x, setX] = useState(0);
  useEffect(() => {
    const sb = document.querySelector<HTMLElement>('[data-sidebar]');
    if (!sb) return;
    const medir = () => setX(Math.max(0, Math.round(sb.getBoundingClientRect().right)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(sb);
    window.addEventListener('resize', medir);
    return () => { ro.disconnect(); window.removeEventListener('resize', medir); };
  }, []);
  return x;
}
const CLAVE_PANEL = 'mako-crm:panel';
/** Desde este ancho de ventana abre sola la primera vez; en una más angosta taparía el tablero. */
const ANCHO_PARA_ABRIR = 1280;


type Respuesta = {
  crm: { id: number; nombre: string }; sugerencias: SugerenciaDePantalla[];
  /** null = lo callado no se pudo leer */
  calladas: SugerenciaDePantalla[] | null;
  callar: boolean;
};
type Hecha = { href: string; nombre: string; aviso: string | null };
type AccionFila = 'hacer' | 'ahora_no' | 'volver_a_mostrar';

/** Lo que vuelve a la lista entra en su clase: las del tablero (3) primero, como las ordena el motor. */
const conDeVuelta = (xs: readonly SugerenciaDePantalla[], s: SugerenciaDePantalla): SugerenciaDePantalla[] => {
  if (xs.some((x) => x.id === s.id)) return [...xs];
  const i = s.clase === 3 ? xs.filter((x) => x.clase === 3).length : xs.length;
  return [...xs.slice(0, i), s, ...xs.slice(i)];
};

/** Otro CRM es entrar de nuevo: otro panel, plegado y sin chat montado (ver la cabecera). */
export function PanelMakoCrm({ funnelId }: { funnelId: number | null }) {
  return <PanelDeUnCrm key={funnelId ?? 'principal'} funnelId={funnelId} />;
}

function PanelDeUnCrm({ funnelId }: { funnelId: number | null }) {
  const [abierto, setAbierto] = useState(false);
  /** El chat se monta la PRIMERA vez que se abre y se queda mientras sea este CRM: un turno en curso sigue si se pliega. */
  const [montado, setMontado] = useState(false);
  const [sugs, setSugs] = useState<SugerenciaDePantalla[] | null>(null);
  const [calladas, setCalladas] = useState<SugerenciaDePantalla[]>([]);
  const [verCalladas, setVerCalladas] = useState(false);
  const [callar, setCallar] = useState(false);
  const [errorSugs, setErrorSugs] = useState<string | null>(null);
  const [hechas, setHechas] = useState<Record<string, Hecha>>({});
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [errorFila, setErrorFila] = useState<Record<string, string>>({});
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);
  const borde = useBordeSidebar();

  // ── Las sugerencias: UNA vez, al montarse (el server las tiene calculadas) ──
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(`${RUTA}?funnel=${funnelId ?? ''}`, { signal: AbortSignal.timeout(30_000) });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      if (!vivo) return;
      const l = leerRespuesta<Respuesta>(status, cuerpo);
      if (!l.ok) { setSugs([]); setErrorSugs('No pude cargar las sugerencias.'); return; }
      setSugs(l.datos.sugerencias ?? []);
      setCalladas(l.datos.calladas ?? []);
      setCallar(l.datos.callar === true);
      setErrorSugs(null);
    })();
    return () => { vivo = false; };
  }, [funnelId]);

  const recordar = (v: '1' | '0') => { try { window.localStorage.setItem(CLAVE_PANEL, v); } catch { /* sin almacenamiento: no se recuerda */ } };
  const abrir = () => { setAbierto(true); setMontado(true); recordar('1'); };
  const cerrar = useCallback(() => { setAbierto(false); recordar('0'); }, []);

  // Abierta de entrada en una pantalla ancha, salvo que la persona la haya plegado (se recuerda en este navegador).
  useEffect(() => {
    let pref: string | null = null;
    try { pref = window.localStorage.getItem(CLAVE_PANEL); } catch { /* sin almacenamiento */ }
    if (pref === '1' || (pref == null && window.innerWidth >= ANCHO_PARA_ABRIR)) { setAbierto(true); setMontado(true); }
  }, []);

  // Abierta, el tablero le deja el lugar (el padding IZQUIERDO de CrmBoard lee la variable). En una ventana angosta se
  // superpone, como en el teléfono.
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.style.setProperty('--ancho-panel-mako', abierto && window.innerWidth >= 900 ? `${ANCHO_PANEL}px` : '0px');
    return () => { raiz.style.setProperty('--ancho-panel-mako', '0px'); };
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;
    const alTeclado = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) cerrar(); };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [abierto, cerrar]);

  const sacar = (id: string) => setSugs((xs) => (xs ?? []).filter((x) => x.id !== id));

  const pedirAlServer = async (accion: AccionFila, s: SugerenciaDePantalla) => {
    if (ocupada) return;
    setOcupada(`${accion}:${s.id}`);
    setErrorFila((m) => { const n = { ...m }; delete n[s.id]; return n; });
    try {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(RUTA, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: accion, funnel: funnelId, sugerencia: s.id }),
          signal: AbortSignal.timeout(60_000),
        });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      const l = leerRespuesta<{ secuenciaId?: number; nombre?: string; aviso?: string | null; href?: string }>(status, cuerpo);
      if (!l.ok) {
        // Crear pudo haber corrido igual: no se dice «no pasó», se dice que no se sabe.
        setErrorFila((m) => ({ ...m, [s.id]: l.reintentable ? l.error : 'No sé si se hizo. Recarga para ver.' }));
        return;
      }
      if (accion === 'ahora_no') { sacar(s.id); setCalladas((xs) => [...xs.filter((x) => x.id !== s.id), s]); return; }
      // `cambio: false` (otra persona ya la había vuelto a mostrar, o venció) también deja la fila a la vista.
      if (accion === 'volver_a_mostrar') { setCalladas((xs) => xs.filter((x) => x.id !== s.id)); setSugs((xs) => conDeVuelta(xs ?? [], s)); return; }
      if (l.datos.href) setHechas((m) => ({ ...m, [s.id]: { href: l.datos.href!, nombre: l.datos.nombre ?? 'La automatización', aviso: l.datos.aviso ?? null } }));
    } finally {
      setOcupada(null);
    }
  };

  const hacer = (s: SugerenciaDePantalla) => {
    if (s.tipo === 'chat' && s.pedido) { setPedido({ texto: s.pedido, vez: Date.now() }); sacar(s.id); return; }
    if (s.tipo === 'plantilla') void pedirAlServer('hacer', s);
  };

  const visibles = (sugs ?? []).filter((s) => !hechas[s.id]);
  const n = visibles.length;

  return (
    <>
      {!abierto && (
        // PLEGADA: la criatura ABAJO A LA IZQUIERDA, con la cara de «A revisar» (app/_components/MakoConfirmGate.tsx), que
        // está abajo a la derecha: la tarjeta blanca con borde, el nombre y el número de sugerencias.
        <button type="button" data-boton-mako-crm onClick={abrir}
          title="Abrir MaKo" aria-label={n ? `Abrir MaKo · ${n} ${n === 1 ? 'sugerencia' : 'sugerencias'}` : 'Abrir MaKo'}
          style={{
            position: 'fixed', left: borde + DESDE_ABAJO, bottom: DESDE_ABAJO, zIndex: Z_PANEL,
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px 7px 8px', cursor: 'pointer',
            background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 14,
            boxShadow: '0 14px 40px rgba(18,21,27,.22)', fontFamily: 'inherit',
          }}>
          {/* LA ESTRELLA DE MaKo, la criatura del Cerebro (lib/centro-munecos.ts → FORMA_MAKO): lo que se escribe acá es
              para MaKo, que reparte. Se mueve y parpadea sola (la regla del 21/10 para toda criatura). */}
          <Muneco titulo="Cerebro" animo="despierto" size={LADO_LOGO - 4} />
          <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>MaKo</span>
          {n > 0 && <Badge>{n}</Badge>}
        </button>
      )}

      {montado && (
        // La barra fija a la IZQUIERDA (21/10/2026), pegada a la sidebar: del mismo lado que la criatura.
        <aside aria-label="MaKo" data-panel-mako-crm
          style={{
            position: 'fixed', top: 'var(--barra-agencia, 0px)', left: borde, bottom: 0, zIndex: Z_PANEL,
            width: `min(${ANCHO_PANEL}px, calc(100vw - ${borde}px))`, display: abierto ? 'flex' : 'none', flexDirection: 'column',
            background: 'var(--surface)', borderRight: '1px solid var(--border)', boxShadow: '12px 0 32px rgba(18,21,27,.10)',
          }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--mako)' }}>
            <Muneco titulo="Cerebro" animo="despierto" size={28} />
            <strong style={{ flex: 1, fontSize: 15, color: 'var(--ink)' }}>MaKo</strong>
            <IconButton title="Cerrar MaKo" onClick={cerrar}><IconoMenu nombre="cerrar" /></IconButton>
          </header>

          {(visibles.length > 0 || Object.keys(hechas).length > 0 || errorSugs || (callar && calladas.length > 0)) && (
            <section aria-label="Sugerencias" style={{ maxHeight: '42%', overflowY: 'auto', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
              {errorSugs && <p role="status" style={{ margin: '8px 14px', fontSize: 13, color: 'var(--dim)' }}>{errorSugs}</p>}
              {(sugs ?? []).map((s) => {
                const hecha = hechas[s.id];
                const enCurso = ocupada === `hacer:${s.id}` ? 'hacer' : ocupada === `ahora_no:${s.id}` ? 'ahora_no' : null;
                return (
                  <div key={s.id} style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.4, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{s.texto}</p>
                    {hecha ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--dim)' }}>
                        <span>Quedó pausada{hecha.aviso ? ` · ${hecha.aviso}` : ''}</span>
                        <ButtonLink href={hecha.href} variant="secondary" size="sm">Abrir</ButtonLink>
                      </div>
                    ) : (s.hacer || callar) ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.hacer && (s.tipo === 'link' && s.href
                          ? <ButtonLink href={s.href} variant="primary" size="sm">Hacerlo</ButtonLink>
                          : <Button variant="primary" size="sm" loading={enCurso === 'hacer'} disabled={!!ocupada && enCurso !== 'hacer'} onClick={() => hacer(s)}>Hacerlo</Button>)}
                        {callar && (
                          <Button variant="tertiary" size="sm" loading={enCurso === 'ahora_no'} disabled={!!ocupada && enCurso !== 'ahora_no'} onClick={() => void pedirAlServer('ahora_no', s)}>Ahora no</Button>
                        )}
                      </div>
                    ) : null}
                    {errorFila[s.id] && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)' }}>{errorFila[s.id]}</p>}
                  </div>
                );
              })}
              {callar && calladas.length > 0 && (
                <div style={{ padding: '4px 14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                  <Button variant="tertiary" size="sm" aria-expanded={verCalladas} onClick={() => setVerCalladas((v) => !v)}>
                    Calladas ({calladas.length})
                  </Button>
                  {verCalladas && calladas.map((s) => {
                    const enCurso = ocupada === `volver_a_mostrar:${s.id}`;
                    return (
                      <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, paddingBottom: 4 }}>
                        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--dim)', overflowWrap: 'anywhere' }}>{s.texto}</p>
                        <Button variant="secondary" size="sm" loading={enCurso} disabled={!!ocupada && !enCurso} onClick={() => void pedirAlServer('volver_a_mostrar', s)}>Volver a mostrar</Button>
                        {errorFila[s.id] && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)' }}>{errorFila[s.id]}</p>}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <ChatMakoCrm funnelId={funnelId} pedido={pedido} />
        </aside>
      )}
    </>
  );
}
