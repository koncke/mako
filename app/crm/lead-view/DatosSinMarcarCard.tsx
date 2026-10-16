'use client';

// =============================================================================
// DatosSinMarcarCard — «N sin marcar · Ver →» y su desplegable
// =============================================================================
// Feedback del detalle del lead (Martín, 13/10/2026, punto 1), textual: «el botón de "Datos sin
// marcar" debería decir "ver ->" y al darle click, si hay más de un dato sin marcar, debería
// saltarme un desplegable con los títulos de los datos sin marcar, y en ese desplegable, si el
// botón con ícono para "solucionar" y otro ícono para "ignorar"... todos los ignorados como
// también los resueltos, pasan a esconderse, para ver los escondidos, abajo debe estar un botón
// de texto sutil... que diga "Ver más"... En caso de que todos sean resueltos e ignorados, no
// salta el botón de "ver más" sino que todo se ve en el desplegable directamente».
//
// Y «Elimina completamente el pop-up que salta al darle el botón de "solucionar"»: solucionar ya
// no abre el asistente; te lleva al dato (onSolucionar → la ficha cambia de tab y lo señala).
// El asistente queda de respaldo para un dato cuyo campo no está en la ficha (ver la ficha).
//
// ⚠️ EL RENGLÓN SIGUE EN UNA SOLA LÍNEA («Solucionar siempre en 1 sola línea», 27/09/2026):
// «999 sin marcar» + «Ver →» mide menos que el «Solucionar →» que medía 192,7 con Geist.
//
// ⚠️ QUÉ AVISA Y QUÉ SE ESCONDE NO SE DECIDE ACÁ: llega partido del server (`partirDatos`,
// lib/datos-aviso.ts), con los ignorados de este lead y lo que el negocio apagó. Ignorar acá
// actualiza la lista en el lugar y le pide a la ficha que relea.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useCapaModal } from '@/app/_components/pila-modales';
import { ubicarPanel } from '@/app/_components/PortadaPicker';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { Toast, useToast } from '@/app/_ui/Toast';
import { Confirm } from '@/app/_ui';
import { cambiarFichaFunnelAction } from '../ficha-actions';
import { ignorarDatoAction } from '../datos-sin-marcar-actions';
import type { DatoDeLaFicha, EstadoDatos } from '@/lib/datos-aviso';
import type { StepId } from '@/lib/stage-requirements';

const SANS = "'Geist', sans-serif";

const accion: CSSProperties = {
  flex: 'none', background: 'none', border: 'none', padding: 0, cursor: 'pointer',
  fontSize: 12.5, fontWeight: 650, fontFamily: SANS, whiteSpace: 'nowrap', color: 'var(--primary)',
};

const iconoBtn: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, flex: 'none',
  borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--dim)', cursor: 'pointer', padding: 0,
};

/**
 * El ícono del BLOQUE de cada dato: va donde «A revisar» pone la cara del lead («El desplegable en el detail del lead,
 * de datos sin marcar debería ser igual que en todo el CRM... Solo que en lugar de foto de perfil del lead, un ícono
 * del bloque que falta marcar», Martín, 16/10/2026). `Record` a propósito: un dato nuevo sin ícono no compila.
 */
const ICONO_DATO: Record<StepId, NombreIconoMenu> = {
  fechaJ1: 'calendario', asistenciaR1: 'check', calificado: 'calificado', fathomR1: 'video',
  fechaJ2: 'calendario', asistenciaR2: 'check', fathomR2: 'video', r2Respuestas: 'pregunta',
  monto: 'dinero', plan: 'plan', motivo: 'texto', setter: 'persona', closer: 'persona',
  telefono: 'telefono', empresa: 'cliente',
  dealServicio: 'producto', dealPromesa: 'cita', dealFiscal: 'archivo', dealObligaciones: 'escudo', dealFiscalDoc: 'archivo',
  comprobante: 'dinero',
};

/** Ignorar: el basurero ROJO de «A revisar». Completar: su flecha AZUL. */
const ignorarBtn: CSSProperties = { ...iconoBtn, color: 'var(--bad)', borderColor: 'color-mix(in srgb, var(--bad) 40%, var(--border))' };
const completarBtn: CSSProperties = { ...iconoBtn, border: 'none', background: 'var(--primary)', color: '#fff' };

const ROTULO: Record<DatoDeLaFicha['estado'], string> = {
  falta: '', ignorado: 'Ignorado', sin_aviso: 'Sin aviso', resuelto: 'Listo',
};

/** Mueve un dato entre «avisa» e «ignorado» en el lugar, sin esperar al server. */
function conIgnoradoLocal(d: EstadoDatos, id: StepId, ignorar: boolean): EstadoDatos {
  const todos = [...d.avisar, ...d.ocultos];
  const uno = todos.find((x) => x.id === id);
  if (!uno) return d;
  const resto = (xs: DatoDeLaFicha[]) => xs.filter((x) => x.id !== id);
  if (ignorar) return { avisar: resto(d.avisar), ocultos: [{ ...uno, estado: 'ignorado' }, ...resto(d.ocultos)] };
  return { avisar: [...d.avisar, { ...uno, estado: 'falta' }], ocultos: resto(d.ocultos) };
}

// ⚠️ SIN ENGRANAJE (14/10/2026): «de qué datos te avisa MaKo» se elige en la ficha misma, en «Personalizar»
// (lead-view/ficha/PanelFicha.tsx), y por FUNNEL. El modal del negocio que abría el engranaje se fue de acá:
// Martín, «Todas las personalizables, no los hagas con un modal diferente».
export function DatosSinMarcarCard({ leadId, datos, onSolucionar, onCambio, abrirAlMontar = false, ignorarSiempre }: {
  leadId: number;
  datos: EstadoDatos;
  /** Llevar al dato: la ficha cambia de tab y lo señala. */
  onSolucionar: (id: StepId) => void;
  /** Después de ignorar: la ficha relee (el número del tablero y «A revisar» cambian). */
  onCambio?: () => void;
  /** Montar con el desplegable abierto: la ficha la abrió «Revisar» de «A revisar» (16/10/2026). */
  abrirAlMontar?: boolean;
  /**
   * ELEGIR QUÉ AVISA MaKo (16/10/2026, el engranaje de «A revisar»): el basurero pregunta «¿Ignorar siempre?» y, con
   * un sí, ese dato deja de ser obligatorio en ESTE funnel (el mismo `op: 'aviso'` que «Obligatorio» en la barra del
   * bloque), para todos sus leads. Sin esto, el basurero ignora sólo en este lead.
   */
  ignorarSiempre?: { funnelId: number | null };
}) {
  const [local, setLocal] = useState(datos);
  useEffect(() => { setLocal(datos); }, [datos]);
  const [abierto, setAbierto] = useState(false);
  const [preguntar, setPreguntar] = useState<{ id: StepId; label: string } | null>(null);
  // En un efecto y no en el useState: el desplegable se cuelga de `anclaRef`, que recién existe después de pintar.
  useEffect(() => { if (abrirAlMontar) setAbierto(true); }, [abrirAlMontar]);
  const [verMas, setVerMas] = useState(false);
  const anclaRef = useRef<HTMLDivElement>(null);
  const { toast, show, clear } = useToast();

  const faltaAlgo = local.avisar.length > 0 || local.ocultos.some((o) => o.estado !== 'resuelto');
  if (!faltaAlgo && !toast) return null;

  const abrir = () => {
    // Un solo dato que avisa y nada escondido: no hay nada que elegir, se va derecho a él.
    if (local.avisar.length === 1 && local.ocultos.length === 0) { onSolucionar(local.avisar[0].id); return; }
    setVerMas(false);
    setAbierto((v) => !v);
  };

  const ignorar = (id: StepId, si: boolean) => {
    const antes = local;
    setLocal(conIgnoradoLocal(local, id, si));
    void ignorarDatoAction(leadId, id, si).then((r) => {
      if (!r.ok) { setLocal(antes); show(r.error, undefined, 'bad'); return; }
      onCambio?.();
      show(si ? 'Dato ignorado' : 'Vuelve a avisar', si ? () => ignorar(id, false) : undefined);
    }).catch(() => { setLocal(antes); show('No se pudo guardar', undefined, 'bad'); });
  };

  /** «Ignorar siempre»: apaga el aviso del dato en el funnel. Deshacer lo vuelve a prender. */
  const dejarDeAvisar = (id: StepId, avisa: boolean) => {
    if (!ignorarSiempre) return;
    const antes = local;
    if (!avisa) setLocal({ ...local, avisar: local.avisar.filter((d) => d.id !== id) });
    void cambiarFichaFunnelAction(ignorarSiempre.funnelId, { op: 'aviso', paso: id, avisa }).then((r) => {
      if (!r.ok) { setLocal(antes); show(r.error, undefined, 'bad'); return; }
      onCambio?.();
      show(avisa ? 'Vuelve a avisar' : 'Ya no avisa en este funnel', avisa ? undefined : () => dejarDeAvisar(id, true));
    }).catch(() => { setLocal(antes); show('No se pudo guardar', undefined, 'bad'); });
  };

  const n = local.avisar.length;
  return (
    <>
      {faltaAlgo && (
        <div
          ref={anclaRef}
          title={[...local.avisar].map((f) => f.label).join(' · ') || undefined}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', fontFamily: SANS, fontSize: 12.5, lineHeight: 1.4 }}
        >
          <span aria-hidden style={{ flex: 'none', width: 6, height: 6, borderRadius: 999, background: n ? 'var(--warn)' : 'var(--faint)' }} />
          <span style={{ flex: 'none', color: n ? 'var(--ink)' : 'var(--dim)', fontWeight: 650, whiteSpace: 'nowrap' }}>
            {n ? `${n} sin marcar` : 'Datos ignorados'}
          </span>
          <button type="button" onClick={abrir} aria-expanded={abierto} style={accion}>Ver →</button>
        </div>
      )}
      {abierto && (
        <Desplegable
          ancla={anclaRef.current}
          datos={local}
          verMas={verMas}
          onVerMas={() => setVerMas(true)}
          onSolucionar={(id) => { setAbierto(false); onSolucionar(id); }}
          onIgnorar={(id, si) => {
            if (si && ignorarSiempre) { setPreguntar({ id, label: local.avisar.find((d) => d.id === id)?.label ?? 'este dato' }); return; }
            ignorar(id, si);
          }}
          onCerrar={() => setAbierto(false)}
        />
      )}
      {preguntar && (
        <Confirm title="¿Ignorar siempre?"
          message={`MaKo deja de avisar «${preguntar.label}» en todos los leads de este funnel. Se vuelve a prender con «Obligatorio» en el bloque.`}
          confirmLabel="Sí, ignorar siempre" cancelLabel="No" tone="danger"
          onConfirm={() => { const p = preguntar; setPreguntar(null); dejarDeAvisar(p.id, false); }}
          onCancel={() => setPreguntar(null)} />
      )}
      <Toast state={toast} onClose={clear} />
    </>
  );
}

function Desplegable({ ancla, datos, verMas, onVerMas, onSolucionar, onIgnorar, onCerrar }: {
  ancla: HTMLElement | null;
  datos: EstadoDatos;
  verMas: boolean;
  onVerMas: () => void;
  onSolucionar: (id: StepId) => void;
  onIgnorar: (id: StepId, ignorar: boolean) => void;
  onCerrar: () => void;
}) {
  const [montado, setMontado] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const capa = useCapaModal(true, { anidada: true });
  const arriba = capa.esElDeArriba;
  const onCerrarRef = useRef(onCerrar);
  useEffect(() => { onCerrarRef.current = onCerrar; });

  useEffect(() => { setMontado(true); }, []);

  const recolocar = useCallback(() => {
    const p = panelRef.current;
    if (!p) return;
    const caja = p.getBoundingClientRect();
    const a = ancla?.isConnected ? ancla.getBoundingClientRect() : null;
    const ventana = { ancho: window.innerWidth, alto: window.innerHeight };
    setPos(a ? ubicarPanel(a, { ancho: caja.width, alto: caja.height }, ventana)
      : { left: Math.max(10, (ventana.ancho - caja.width) / 2), top: Math.max(10, (ventana.alto - caja.height) / 2) });
  }, [ancla]);

  // `montado` y `verMas` en las deps: el portal no existe en el primer render, y «Ver más»
  // cambia el alto del panel (si abre hacia arriba, hay que volver a ubicarlo).
  useEffect(() => {
    recolocar();
    window.addEventListener('resize', recolocar);
    window.addEventListener('scroll', recolocar, true);
    return () => { window.removeEventListener('resize', recolocar); window.removeEventListener('scroll', recolocar, true); };
  }, [recolocar, montado, verMas]);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t || panelRef.current?.contains(t) || ancla?.contains(t)) return;
      onCerrarRef.current();
    };
    // ⚠️ `stopImmediatePropagation`: el Escape de la ficha vive en `document` y en captura, y
    // sin esto cerrar el desplegable cerraría también la ficha (AGENTS.md, popovers anclados).
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || !arriba()) return;
      e.stopImmediatePropagation(); e.preventDefault(); onCerrarRef.current();
    };
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    return () => { document.removeEventListener('mousedown', fuera, true); document.removeEventListener('keydown', tecla, true); };
  }, [ancla, arriba]);

  if (!montado) return null;

  // Si no queda nada que avise, lo escondido se ve directo: no hay «Ver más» que apretar.
  const mostrarOcultos = verMas || datos.avisar.length === 0;
  // ⚠️ LA MISMA FILA QUE «A REVISAR» (app/_components/MakoConfirmGate.tsx, 16/10/2026): el ícono del bloque en un
  // cuadrado del tamaño de la cara, el nombre, y a la derecha el basurero rojo (ignorar) y la flecha azul (completar).
  // La primera fila va sin raya: la cabecera ya tiene la suya.
  const fila = (d: DatoDeLaFicha, i: number) => {
    const falta = d.estado !== 'resuelto';
    return (
      <li key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 0', borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
        <span aria-hidden style={{ flex: 'none', width: 28, height: 28, borderRadius: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)', color: falta ? 'var(--ink)' : 'var(--faint)' }}>
          <IconoMenu nombre={ICONO_DATO[d.id]} size={15} />
        </span>
        <span style={{ flex: '0 1 auto', minWidth: 0, fontSize: 13.5, fontWeight: 600, color: falta ? 'var(--ink)' : 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
        {d.estado !== 'falta' && <span style={{ flex: 'none', fontSize: 12, color: 'var(--faint)' }}>{ROTULO[d.estado]}</span>}
        <span aria-hidden style={{ flex: 1 }} />
        {d.estado === 'falta' && d.ignorable && (
          <button type="button" style={ignorarBtn} onClick={() => onIgnorar(d.id, true)} title={`Ignorar: no avisar de ${d.label}`} aria-label={`Ignorar ${d.label}`}>
            <IconoMenu nombre="borrar" size={15} />
          </button>
        )}
        {d.estado === 'ignorado' && (
          <button type="button" style={iconoBtn} onClick={() => onIgnorar(d.id, false)} title={`Volver a avisar de ${d.label}`} aria-label={`Volver a avisar de ${d.label}`}>
            <IconoMenu nombre="avisar" size={15} />
          </button>
        )}
        {falta && (
          <button type="button" style={completarBtn} onClick={() => onSolucionar(d.id)} title={`Completar: ${d.label}`} aria-label={`Completar ${d.label}`}>
            <IconoMenu nombre="mover" size={15} />
          </button>
        )}
      </li>
    );
  };
  const visibles = [...datos.avisar, ...(mostrarOcultos ? datos.ocultos : [])];

  return createPortal(
    <div ref={panelRef} role="dialog" aria-label="Datos sin marcar" tabIndex={-1}
      style={{
        position: 'fixed', zIndex: capa.z, left: pos?.left ?? 0, top: pos?.top ?? 0,
        opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none',
        width: 360, maxWidth: 'calc(100vw - 20px)', maxHeight: 'min(440px, calc(100vh - 20px))', overflowY: 'auto',
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 13,
        boxShadow: '0 16px 40px rgba(18,21,27,.18)', padding: '0 14px 8px', fontFamily: SANS,
      }}>
      {/* La cabecera de «A revisar»: el título, el número en su chip y la raya abajo. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 0', borderBottom: '1px solid var(--border)', marginBottom: 2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Datos sin marcar</span>
        {datos.avisar.length > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 19, height: 19, padding: '0 5px', borderRadius: 999, background: 'var(--warn)', color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{datos.avisar.length}</span>
        )}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {visibles.map(fila)}
      </ul>
      {!mostrarOcultos && datos.ocultos.length > 0 && (
        <button type="button" onClick={onVerMas}
          style={{ display: 'block', width: '100%', marginTop: 4, padding: '9px 4px 3px', border: 'none', borderTop: '1px solid var(--border)', background: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
          Ver más
        </button>
      )}
    </div>,
    document.body,
  );
}
