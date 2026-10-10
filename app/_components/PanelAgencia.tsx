'use client';

// =============================================================================
// PanelAgencia — los controles de la agencia sobre el cliente de prueba
// =============================================================================
// Vive en la barra de "estás viendo el dashboard de X", al lado de "Salir de la
// vista", y es el ÚNICO lugar donde aparecen. Adentro del onboarding no va
// ningún atajo: el recorrido tiene que verse EXACTAMENTE igual que el de un
// cliente real, porque si no, lo que se prueba no es lo que el cliente va a ver.
//
//   · Datos de Mauricio — traer o devolver, agrupado por recorrido.
//   · Reset — vaciar el cliente entero, con confirmación.
//
// Se pinta solo si /api/datos-mau dice que corresponde: super-admin de la
// agencia parado EXACTAMENTE en el cliente de prueba (`WS_PRUEBA`).
//
// ⚠️ La condición era «un workspace que no sea el del dueño», o sea que estos
// botones —incluido el Reset, que vacía 50+ tablas y 4 buckets— aparecían
// también adentro de los clientes REALES. Quién decide sigue siendo el server:
// esconder el botón no protege nada si el endpoint acepta igual.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { IconoBorrar } from '@/app/_ui/BotonBorrar';
import { AvisoFlotante } from './AvisoFlotante';
import { WS_DISENO } from '@/lib/auth-session';
import { TEMAS, ATTR_TEMA, ATTR_MODO, LS_MODO } from '@/lib/temas-candidatos';
import { aplicarTemaCandidato } from './TemaCandidato';
import { InterruptorModo } from './InterruptorModo';

const MONO = "'Geist Mono', monospace";
const SANS = "'Geist', sans-serif";

type Ambito = { key: string; titulo: string; seccion: string; label: string; nota: string | null };

const chip: CSSProperties = {
  fontFamily: MONO, fontSize: 11.5, letterSpacing: '.06em', textTransform: 'uppercase',
  padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(243,240,231,.3)',
  background: 'transparent', color: '#F3F0E7', cursor: 'pointer', whiteSpace: 'nowrap',
};

/** Acción como ícono: se reconoce por la forma y no empuja el resto de la fila. */
function BotonIcono({ icono, titulo, onClick, disabled, tono = 'neutro', cargando }: {
  icono: 'traer' | 'trash';
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  tono?: 'neutro' | 'malo';
  cargando?: boolean;
}) {
  const color = tono === 'malo' ? 'var(--bad)' : 'var(--dim)';
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={titulo} aria-label={titulo}
      style={{
        flex: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)',
        background: 'var(--surface)', color, cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {cargando
        ? <span aria-hidden style={{ width: 12, height: 12, border: '2px solid var(--border)', borderTopColor: color, borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
        : icono === 'trash' ? <IconoBorrar size={15} />
        : <span aria-hidden style={{ fontSize: 14, lineHeight: 1, fontWeight: 700 }}>↓</span>}
    </button>
  );
}

/**
 * El tema en prueba — SOLO adentro del Cliente de Diseño.
 *
 * Vive acá y no en la barra lateral porque la barra la ven todos, y esto no es
 * una feature del producto: es una herramienta de obra. Una versión anterior lo
 * puso en el perfil de cualquier usuario y un cliente NUEVO abrió MaKo en
 * oscuro sin haber tocado nada, con toda la cola de contraste que el rebrand
 * todavía no cerró.
 */
function TemaEnPrueba() {
  const [tema, setTema] = useState<string | null>(null);
  useEffect(() => {
    const sync = () => setTema(document.documentElement.getAttribute(ATTR_TEMA));
    sync();
    window.addEventListener('mako-tema-candidato', sync);
    window.addEventListener('mako-modo', sync);
    return () => {
      window.removeEventListener('mako-tema-candidato', sync);
      window.removeEventListener('mako-modo', sync);
    };
  }, []);
  const t = TEMAS[0];
  const on = tema === t.id;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button
        type="button" title={t.idea.slice(0, 100)}
        onClick={() => aplicarTemaCandidato(on ? null : t.id)}
        style={{
          ...chip,
          background: on ? '#F3F0E7' : 'transparent',
          color: on ? '#14161B' : '#F3F0E7',
          borderColor: on ? '#F3F0E7' : 'rgba(243,240,231,.3)',
        }}
      >
        {on ? t.nombre : 'Probar tema'}
      </button>
      {/* El claro/oscuro solo existe MIENTRAS hay tema en prueba: sin tema no hay
          modo, que es lo que garantiza que ningún cliente lo vea. */}
      {on && <InterruptorModo compacto />}
    </span>
  );
}

export function PanelAgencia({ cliente, onCambio }: {
  cliente: string;
  /** Se llama tras traer o eliminar. Sin él, refresco de ruta a secas. */
  onCambio?: () => void;
}) {
  const router = useRouter();
  const [disponible, setDisponible] = useState(false);
  const [ambitos, setAmbitos] = useState<Ambito[]>([]);
  const [completados, setCompletados] = useState<string[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [seccionAbierta, setSeccionAbierta] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; tono: 'info' | 'error' } | null>(null);
  const [confirmarReset, setConfirmarReset] = useState(false);
  const caja = useRef<HTMLDivElement | null>(null);
  // Lo dice el SERVER en la respuesta, nunca el `?ws=` de la URL.
  const [wsPanel, setWsPanel] = useState<number | null>(null);

  const mirar = useCallback(async () => {
    try {
      const j = await (await fetch('/api/datos-mau', { cache: 'no-store' })).json();
      setDisponible(!!j.disponible);
      setWsPanel(typeof j.ws === 'number' ? j.ws : null);
      setAmbitos(Array.isArray(j.ambitos) ? j.ambitos : []);
      setCompletados(Array.isArray(j.completados) ? j.completados : []);
    } catch (e) {
      console.warn('[datos-mau] no se pudo consultar', e);
      setDisponible(false);
    }
  }, []);

  useEffect(() => { void mirar(); }, [mirar]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (caja.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement)?.closest?.('#panel-agencia-menu')) return;
      setAbierto(false);
    };
    const cerrar = () => setAbierto(false);
    // El scroll DENTRO del menú (la lista de ámbitos) también dispara este
    // listener — un scroll no burbujea, pero sí pasa por la fase de captura de
    // window, así que sin este filtro cualquier intento de scrollear la lista
    // cerraba el menú al toque. Solo cierra un scroll de verdad AFUERA (el
    // botón se desplaza y la posición medida queda vieja).
    const cerrarPorScroll = (e: Event) => {
      if ((e.target as HTMLElement)?.closest?.('#panel-agencia-menu')) return;
      cerrar();
    };
    document.addEventListener('mousedown', fuera);
    window.addEventListener('resize', cerrar);
    window.addEventListener('scroll', cerrarPorScroll, true);
    return () => {
      document.removeEventListener('mousedown', fuera);
      window.removeEventListener('resize', cerrar);
      window.removeEventListener('scroll', cerrarPorScroll, true);
    };
  }, [abierto]);

  /** Corre la acción sobre uno o varios ámbitos y resume el total. */
  async function correr(action: 'completar' | 'eliminar', keys: string[], marca: string) {
    setBusy(marca); setAviso(null);
    let total = 0;
    const detalle: string[] = [];
    try {
      for (const ambito of keys) {
        const j = await (await fetch('/api/datos-mau', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ambito }),
        })).json();
        if (!j.ok) { detalle.push(`${ambito}: ${j.error}`); continue; }
        total += ((action === 'completar' ? j.copiado : j.borrado) as number) ?? 0;
        for (const a of (j.avisos ?? []) as string[]) if (!detalle.includes(a)) detalle.push(a);
      }
      const base = action === 'completar'
        ? (total ? `Traídos ${total} elementos.` : 'No hay nada cargado ahí.')
        : `Eliminados ${total} elementos.`;
      setAviso({ texto: [base, ...detalle].join(' · '), tono: detalle.length ? 'error' : 'info' });
      await mirar();
      // Refresco suave: recargar la página entera pierde el scroll y el estado
      // del formulario, y se lee como si la app se hubiera caído. Quien monta el
      // panel puede pedir su propio refresco (el wizard remonta sus pasos).
      if (onCambio) onCambio(); else router.refresh();
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo completar.', tono: 'error' });
    } finally { setBusy(null); }
  }

  /** Trae absolutamente todo y da el alta por terminada: derecho al dashboard. */
  // ⚠️ Este panel SOLO se dibuja mientras mirás a otro cliente, así que sus dos
  // navegaciones duras son las únicas del repo que corren siempre adentro del modo
  // agencia — y son justo las que perdían la pestaña.
  const ws = useWs();

  async function traerTodo() {
    setBusy('todo'); setAviso(null);
    try {
      const j = await (await fetch('/api/datos-mau', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'todo' }),
      })).json();
      if (!j.ok) { setAviso({ texto: j.error || 'No se pudo completar.', tono: 'error' }); return; }
      setAviso({ texto: `Cliente listo: ${j.copiado ?? 0} elementos. Entrando al dashboard…`, tono: 'info' });
      // Recarga dura y no router.refresh(): el onboarding pasó a 'done' y hay
      // que volver a pedir la ruta para que el guard sirva el dashboard.
      //
      // ⚠️ CON `conWs`. Este panel SOLO existe mientras mirás a OTRO, así que una
      // navegación dura sin el `?ws=` acá no es un detalle: te devuelve a tu propia
      // cuenta justo después de cargarle los datos al cliente, y parece que no pasó nada.
      window.location.href = conWs('/inicio', ws);
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo completar.', tono: 'error' });
    } finally { setBusy(null); }
  }

  async function resetear() {
    setBusy('reset'); setAviso(null); setConfirmarReset(false);
    try {
      const j = await (await fetch('/api/datos-mau', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      })).json();
      if (!j.ok) { setAviso({ texto: j.error || 'No se pudo resetear.', tono: 'error' }); return; }
      const filas = Object.values((j.borrado ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
      setAviso({ texto: `Workspace vaciado: ${filas} registros y ${j.archivos ?? 0} archivos.`, tono: 'info' });
      // El navegador guarda borradores y marcas de leído sin distinguir
      // workspace: sin limpiarlos, el cliente reseteado sigue pareciendo lleno.
      try { Object.keys(localStorage).filter((k) => k.toLowerCase().startsWith('mako')).forEach((k) => localStorage.removeItem(k)); } catch { /* modo privado */ }
      // Vaciado el workspace, el onboarding vuelve a estar pendiente: se va
      // derecho ahí, sin pasar por una pantalla que ya no tiene nada que mostrar.
      //
      // ⚠️ ESTA LÍNEA, SIN `conWs`, ERA EL BUG QUE EL DUEÑO REPORTÓ COMO «apreté RESET y
      // no pasó nada». Pasaba: el workspace se vaciaba entero. Lo que fallaba es que
      // acto seguido esto lo sacaba de la vista del cliente y lo depositaba en SU
      // propio onboarding — donde, lógicamente, no había cambiado nada. El aviso de
      // «Workspace vaciado: N registros» alcanzaba a pintarse y se lo llevaba puesto la
      // navegación. Un botón que hace su trabajo y después te muestra otra pantalla es
      // indistinguible de un botón roto.
      window.location.href = conWs('/onboarding', ws);
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'No se pudo resetear.', tono: 'error' });
    } finally { setBusy(null); }
  }

  if (!disponible) return null;

  // Agrupado por sección, respetando el orden del catálogo.
  const secciones: Array<{ nombre: string; items: Ambito[] }> = [];
  for (const a of ambitos) {
    const g = secciones.find((x) => x.nombre === a.seccion);
    if (g) g.items.push(a); else secciones.push({ nombre: a.seccion, items: [a] });
  }

  return (
    <div ref={caja} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
      <style>{'@keyframes mako-spin{to{transform:rotate(360deg)}}'}</style>

      {wsPanel === WS_DISENO && <TemaEnPrueba />}

      <button
        ref={btnRef} type="button" style={chip}
        onClick={() => {
          const r = btnRef.current?.getBoundingClientRect();
          if (r) setPos({ top: Math.round(r.bottom + 8), right: Math.round(window.innerWidth - r.right) });
          setAbierto((a) => !a);
        }}
      >
        Datos de Mauricio {abierto ? '▴' : '▾'}
      </button>

      {confirmarReset ? (
        <>
          <span style={{ fontSize: 12.5, color: '#F3F0E7', whiteSpace: 'nowrap' }}>¿Vaciar por completo {cliente}?</span>
          <button type="button" onClick={() => void resetear()} disabled={busy !== null}
            style={{ ...chip, borderColor: '#E5484D', color: '#FF9A9D' }}>
            {busy === 'reset' ? 'Vaciando…' : 'Sí, vaciar'}
          </button>
          <button type="button" onClick={() => setConfirmarReset(false)} style={chip}>No</button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirmarReset(true)} disabled={busy !== null}
          style={{ ...chip, borderColor: 'rgba(229,72,77,.55)', color: '#FF9A9D' }}>
          Reset
        </button>
      )}

      {abierto && pos && createPortal(
        <div id="panel-agencia-menu" style={{
          position: 'fixed', top: pos.top, right: pos.right, zIndex: 3000, width: 410,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 18px 44px rgba(23,21,17,.32)', padding: '0 0 4px', maxHeight: '70vh', overflowY: 'auto',
          fontFamily: SANS,
        }}>
          <div style={{ padding: '11px 14px 12px', fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, borderBottom: '1px solid var(--border)' }}>
            Trae a <strong style={{ color: 'var(--ink)' }}>{cliente}</strong> la parte de Mauricio que necesites probar. Eliminar quita lo que se trajo, no lo que hayas creado tú.
          </div>

          <button
            type="button" onClick={() => void traerTodo()} disabled={busy !== null}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '11px 14px', border: 0, borderBottom: '1px solid var(--border)',
              background: 'var(--surface-2)', cursor: busy ? 'default' : 'pointer',
              textAlign: 'left', fontFamily: SANS, opacity: busy && busy !== 'todo' ? 0.5 : 1,
            }}
          >
            <span aria-hidden style={{ flex: 'none', width: 26, height: 26, borderRadius: 8, background: 'var(--accent-soft)', color: '#171511', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
              {busy === 'todo'
                ? <span style={{ width: 12, height: 12, border: '2px solid rgba(23,21,17,.3)', borderTopColor: '#171511', borderRadius: '50%', display: 'inline-block', animation: 'mako-spin .8s linear infinite' }} />
                : '↓'}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>
                {busy === 'todo' ? 'Trayendo todo…' : 'Traer todo y entrar al dashboard'}
              </span>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4 }}>
                Completa el onboarding y te lleva directo a la app
              </span>
            </span>
          </button>

          {secciones.map((sec) => {
            const traidos = sec.items.filter((i) => completados.includes(i.key));
            const abiertaSec = seccionAbierta === sec.nombre;
            const marca = `sec:${sec.nombre}`;
            return (
              <div key={sec.nombre} style={{ borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px 9px 13px' }}>
                  <button
                    type="button" onClick={() => setSeccionAbierta(abiertaSec ? null : sec.nombre)}
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', padding: 0, fontFamily: SANS }}
                  >
                    <span aria-hidden style={{ flex: 'none', color: 'var(--faint)', fontSize: 11, transform: abiertaSec ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>▾</span>
                    {/* Apagada mientras no haya nada traído; se enciende sola. */}
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 600, color: traidos.length ? 'var(--ink)' : 'var(--faint)' }}>{sec.nombre}</span>
                    <span style={{ flex: 'none', fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{traidos.length}/{sec.items.length}</span>
                  </button>
                  <BotonIcono
                    icono="traer" titulo={`Traer todo: ${sec.nombre}`}
                    onClick={() => void correr('completar', sec.items.map((i) => i.key), marca)}
                    disabled={busy !== null} cargando={busy === marca}
                  />
                  {traidos.length > 0 && (
                    <BotonIcono
                      icono="trash" tono="malo" titulo={`Eliminar todo: ${sec.nombre}`}
                      onClick={() => void correr('eliminar', traidos.map((i) => i.key), `${marca}:del`)}
                      disabled={busy !== null} cargando={busy === `${marca}:del`}
                    />
                  )}
                </div>

                {abiertaSec && sec.items.map((a) => {
                  const hecho = completados.includes(a.key);
                  return (
                    // Sin traer, la fila va apagada; al traerla se enciende y
                    // recién ahí aparece la papelera.
                    <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px 8px 33px', opacity: hecho ? 1 : 0.45 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{a.titulo}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--faint)', lineHeight: 1.4 }}>{a.label}</div>
                      </div>
                      <BotonIcono
                        icono="traer" titulo={`Traer: ${a.titulo}`}
                        onClick={() => void correr('completar', [a.key], a.key)}
                        disabled={busy !== null} cargando={busy === a.key}
                      />
                      {hecho && (
                        <BotonIcono
                          icono="trash" tono="malo" titulo={`Eliminar: ${a.titulo}`}
                          onClick={() => void correr('eliminar', [a.key], `${a.key}:del`)}
                          disabled={busy !== null} cargando={busy === `${a.key}:del`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>,
        document.body,
      )}

      {aviso && <AvisoFlotante mensaje={aviso.texto} tono={aviso.tono} onCerrar={() => setAviso(null)} />}
    </div>
  );
}
