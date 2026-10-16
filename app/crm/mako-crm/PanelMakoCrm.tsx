'use client';

// =============================================================================
// PanelMakoCrm — MaKo al costado del CRM: PLEGADO, con sus sugerencias y su chat
// =============================================================================
// Pedido de Martín (13/10/2026, General 3): «replica el mismo chat que hay en Automations, que se abre
// al costado… que siempre esté plegado y que ahí aparezcan notificaciones». El 14/10: «No veo nada
// sobre el chat de MaKo y las recomendaciones...». El mapa: docs/sugerencias-mako-crm.md.
//
//   · PLEGADO SIEMPRE AL ENTRAR: el botón del logo de MaKo (el de la cabecera de una automatización,
//     `BotonLogoMako`) en el rincón de abajo a la derecha, con el punto y el número de sugerencias.
//     ⚠️ Es una COPIA de su aspecto, no un import: `BotonLogoMako` vive en
//     app/automations/SecuenciaPerfil.tsx, que arrastra el lienzo entero (FlujoLienzo, el wizard…) al
//     bundle de /crm. El día que suba a app/_ui, esto lo importa.
//   · ⚠️ EL RINCÓN: el botón y el panel llevan `data-esquina-ocupada` (AGENTS.md): la esquina de los
//     avisos pinta en toda la app y, sin la marca, taparía el botón y el «Enviar» del chat.
//   · ABIERTO: un panel a la derecha, de arriba abajo, con las sugerencias arriba (UNA línea cada una,
//     «Hacerlo» y «Ahora no») y el chat abajo. Va DEBAJO de los modales (z 50 < 60).
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

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import dynamic from 'next/dynamic';
import { Badge, Button, ButtonLink, IconButton } from '@/app/_ui';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { RAIL } from '@/app/_components/Sidebar';
import { leerRespuesta } from '@/app/m/mako/chat-ui';
import type { SugerenciaDePantalla } from '@/lib/sugerencias-crm';

// El chat (el hilo de WhatsApp, la barra, el micrófono) sólo viaja cuando se abre el panel.
const ChatMakoCrm = dynamic(() => import('./ChatMakoCrm').then((m) => m.ChatMakoCrm), { ssr: false });

const RUTA = '/api/crm/mako';
/** El lado del botón plegado: el alto de «Probar» y «Publicar» del lienzo (`ALTO_ACCION`). */
const LADO_BOTON = 44;
/** El logo adentro (`LADO_LOGO` de BotonLogoMako). */
const LADO_LOGO = 32;
/** Debajo de los modales (z ≥ 60) y de la esquina de los avisos (55). */
const Z_PANEL = 50;

/** La cara de `BotonLogoMako` (app/automations/SecuenciaPerfil.tsx): la tarjeta clara del título con el logo adentro. */
const CARA_BOTON: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};

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

  const abrir = () => { setAbierto(true); setMontado(true); };
  const cerrar = useCallback(() => setAbierto(false), []);

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
        // ⚠️ A LA IZQUIERDA desde el 16/10/2026 («El botón de MaKo siempre a la izquierda, no a la derecha», Martín),
        // pegado a la barra lateral: el layout le reserva siempre `RAIL` (abierta, se superpone). Ya no ocupa el rincón
        // de abajo a la derecha, así que no lleva `data-esquina-ocupada` («A revisar» vuelve a su esquina).
        <button type="button" data-boton-mako-crm onClick={abrir}
          title="Abrir MaKo" aria-label={n ? `Abrir MaKo · ${n} ${n === 1 ? 'sugerencia' : 'sugerencias'}` : 'Abrir MaKo'}
          style={{
            ...CARA_BOTON, position: 'fixed', left: RAIL + 20, bottom: 12, zIndex: Z_PANEL,
            width: LADO_BOTON, height: LADO_BOTON, padding: 0, cursor: 'pointer', boxSizing: 'border-box',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <MakoLogo size={LADO_LOGO} animate={false} />
          {n > 0 && (
            <span aria-hidden style={{ position: 'absolute', top: -7, right: -7, pointerEvents: 'none' }}>
              <Badge>{n}</Badge>
            </span>
          )}
        </button>
      )}

      {montado && (
        // El panel abre del MISMO lado que el botón: a la izquierda, al lado de la barra lateral.
        <aside aria-label="MaKo"
          style={{
            position: 'fixed', top: 'var(--barra-agencia, 0px)', left: RAIL, bottom: 0, zIndex: Z_PANEL,
            width: 'min(420px, 100vw)', display: abierto ? 'flex' : 'none', flexDirection: 'column',
            background: 'var(--surface)', borderRight: '1px solid var(--border)', boxShadow: '12px 0 32px rgba(18,21,27,.12)',
          }}>
          <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--border)', borderTop: '3px solid var(--mako)' }}>
            <MakoLogo size={28} animate={false} />
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
