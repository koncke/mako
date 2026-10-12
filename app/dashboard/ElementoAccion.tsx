'use client';

// =============================================================================
// ElementoAccion — el elemento «Acción»: un botón suelto en la hoja o en un pop-up (tanda v5, I8 del contrato)
// =============================================================================
// Martín (12/10/2026): «Sincronizar llamadas: el cron de siempre + un elemento "Acción" en la hoja Closing». Cada
// botón corre una acción de ACCIONES_ELEMENTO (lib/graficos-acciones.ts) por la PUERTA que ya existe: POST
// /api/closing/sync y /api/closing/analyze (su puerta mira el rol: admin o closer), la ficha de la llamada con
// su revisión, la ficha del lead o la página del anuncio. Nada nuevo del server.
//
// Lo que no se ve en la firma:
//   · LO QUE ESCRIBE PIDE CONFIRMAR, con la consecuencia pegada al botón y ANTES del clic (AGENTS.md). La
//     confirmación va EN la tarjeta, no en un Confirm: adentro de un pop-up, un Confirm encima del Modal apaga al
//     de abajo (la pila), y los dos escuchan Escape.
//   · Mientras corre dice cuánto puede tardar (un giro mudo de minutos se lee colgado), y una tarea vencida NO se
//     afirma fallida: puede haber terminado igual (`postearTarea`).
//   · EDITANDO el botón no corre: un clic elige la tarjeta. Y en un link compartido no se dibuja (un botón que
//     escribe no se sirve sin sesión; ver docs/hallazgos-graficos.md, «Los bloques no saben que están en un link»).
//   · Una acción que no existe (un id guardado de otra versión) lo dice: no es un botón que no hace nada.
//   · «Abrir la ficha» de un LEAD o de un ANUNCIO es un link a su pantalla, en otra pestaña (`ButtonLink`, que lleva
//     el `?ws=`): adentro de un pop-up, la ficha del CRM (LeadEditModal, z 80) quedaría DEBAJO del pop-up (la pila
//     arranca en 130), y un `window.open` a mano perdería la pestaña del cliente que se está mirando (AGENTS.md).
//     La de una LLAMADA sí se abre encima: FichaLlamada es un Modal de la pila, montado en el <body>.

import { useState, type ReactNode } from 'react';
import { Button, ButtonLink, Spinner, Toast, useToast } from '@/app/_ui';
import type { Elemento } from '@/lib/graficos-catalogo';
import {
  ACCIONES_ELEMENTO, accionElementoDe, accionElementoDisponible, type AccionElementoDef, type ContextoEntidad, type TipoEntidad,
} from '@/lib/graficos-acciones';
import { postearTarea, textoDeSync } from './bloques/extra/llamadas-modelo';
import { FichaLlamada } from './bloques/extra/FichaLlamada';
import { Capa } from './bloques/piezas';

type Abierto = { tipo: 'llamada'; id: number; revisar: boolean } | null;

export function ElementoAccion({ e, contexto, editando, soloLectura = false, onCambio }: {
  e: Elemento;
  /** Lo que se abrió, si el botón está en un pop-up (`contextoDeClic`); null en la hoja. */
  contexto: ContextoEntidad | null;
  editando: boolean;
  /** Un link compartido: no se dibuja. */
  soloLectura?: boolean;
  /** La acción cambió datos: la hoja vuelve a pedir sus números. */
  onCambio?: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<Abierto>(null);
  const { toast, show, clear } = useToast();
  if (soloLectura) return null;
  const a = accionElementoDe(e.accion?.id);
  const rotulo = e.accion?.rotulo?.trim() || a?.titulo || 'Acción';
  if (!a) return <Centro><span style={{ fontSize: 13, color: 'var(--faint)' }}>Esta acción ya no existe</span></Centro>;
  const motivo = accionElementoDisponible(a, contexto);

  const correr = async () => {
    setConfirmando(false);
    setError(null);
    if (a.tipo === 'revisar' || (a.tipo === 'ficha' && contexto?.tipo === 'llamada')) {
      setAbierto({ tipo: 'llamada', id: Number(contexto!.ref), revisar: a.tipo === 'revisar' });
      return;
    }
    const cuerpo = a.puerta?.cuerpo(contexto?.ref ?? null);
    if (!a.puerta || !cuerpo) { setError('Falta la llamada.'); return; }
    setCorriendo(true);
    const r = await postearTarea(a.puerta.ruta, cuerpo, a.puerta.topeMs);
    setCorriendo(false);
    if (!r.ok) { setError(r.error); return; }
    // /api/closing/analyze contesta ok con el fallo adentro (`status: 'error'`): se mira.
    if (r.j.status === 'error') { setError('MaKo no pudo analizarla.'); onCambio?.(); return; }
    show(a.id === 'sincronizar_llamadas' ? textoDeSync(r.j) : 'Listo', undefined, 'good');
    onCambio?.();
  };

  const alClic = () => {
    if (editando || corriendo || motivo) return;
    if (a.escribe) setConfirmando(true);
    else void correr();
  };

  // La ficha de un lead o de un anuncio: su pantalla, en otra pestaña (ver la cabecera).
  const link = a.tipo === 'ficha' && contexto && contexto.tipo !== 'llamada'
    ? (contexto.tipo === 'lead' ? `/crm/${encodeURIComponent(contexto.ref)}` : `/anuncio/${encodeURIComponent(contexto.ref)}`)
    : null;
  if (link && !editando) return <Centro><ButtonLink href={link} newTab size="sm" variant="primary">{rotulo}</ButtonLink></Centro>;

  return (
    <Centro>
      {confirmando ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
          <span style={{ fontSize: 13, color: 'var(--ink)' }}>{a.consecuencia}</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button size="sm" variant="secondary" onClick={() => setConfirmando(false)}>No {rotulo.charAt(0).toLowerCase() + rotulo.slice(1)}</Button>
            <Button size="sm" variant="primary" onClick={() => void correr()}>{rotulo}</Button>
          </div>
        </div>
      ) : (
        <>
          <Button size="sm" variant="primary" disabled={!!motivo} loading={corriendo} onClick={alClic}
            title={motivo ?? (editando ? 'Mira la hoja para usarlo' : undefined)} style={editando ? { pointerEvents: 'none' } : undefined}>
            {rotulo}
          </Button>
          {corriendo && a.enCurso && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--dim)' }}><Spinner size={12} /> {a.enCurso}</span>}
          {motivo && editando && <span style={{ fontSize: 12.5, color: 'var(--faint)' }}>{motivo}</span>}
          {error && <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}</span>}
        </>
      )}
      {abierto?.tipo === 'llamada' && (
        <FichaLlamada recordingId={abierto.id} revisarAlAbrir={abierto.revisar} onCerrar={() => setAbierto(null)} onCambio={onCambio} />
      )}
      {toast && <Capa><Toast state={toast} onClose={clear} /></Capa>}
    </Centro>
  );
}

function Centro({ children }: { children: ReactNode }) {
  return <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 8 }}>{children}</div>;
}

/**
 * El panel del elemento «Acción» (P5 lo monta en Propiedades.tsx para `tipo: 'accion'`): qué acción corre y qué
 * dice el botón. Sólo se ofrecen las que tienen sentido ACÁ: en la hoja, las que no necesitan nada abierto; en el
 * pop-up de una llamada, las de la llamada. `entidad` es lo que abre el pop-up (`entidadDeGrafico`), o null.
 */
export function PropsAccion({ e, entidad, onCambiar }: { e: Elemento; entidad: TipoEntidad | null; onCambiar: (p: Partial<Elemento>) => void }) {
  const actual = e.accion ?? { id: '', rotulo: '' };
  const contexto: ContextoEntidad | null = entidad ? { tipo: entidad, ref: '0' } : null;
  const ofrecidas = ACCIONES_ELEMENTO.filter((x) => !accionElementoDisponible(x, contexto) && (entidad ? x.donde !== 'hoja' : x.donde === 'hoja'));
  const elegir = (x: AccionElementoDef) => onCambiar({ accion: { id: x.id, rotulo: actual.rotulo && actual.rotulo !== accionElementoDe(actual.id)?.titulo ? actual.rotulo : x.titulo } });
  return (
    <>
      <div className="lk-seccion">
        <div className="lk-seccion-tit">Acción</div>
        <div className="lk-radios" role="radiogroup" aria-label="Acción">
          {ofrecidas.map((x) => (
            <label key={x.id}><input type="radio" name={`accion-${e.id}`} checked={actual.id === x.id} onChange={() => elegir(x)} /> {x.titulo}</label>
          ))}
        </div>
      </div>
      <div className="lk-seccion">
        <div className="lk-seccion-tit">Rótulo</div>
        <CampoRotulo valor={actual.rotulo} onGuardar={(rotulo) => onCambiar({ accion: { id: actual.id, rotulo } })} />
      </div>
    </>
  );
}

/** El rótulo del botón: se guarda al salir (o con Enter); Escape descarta. Tope 40 (el del saneo). */
function CampoRotulo({ valor, onGuardar }: { valor: string; onGuardar: (v: string) => void }) {
  const [v, setV] = useState(valor);
  const [base, setBase] = useState(valor);
  if (base !== valor) { setBase(valor); setV(valor); }
  const guardar = () => { const t = v.trim().slice(0, 40); if (t !== valor) onGuardar(t); };
  return (
    <input className="lk-input" value={v} maxLength={40} aria-label="Rótulo del botón" onChange={(ev) => setV(ev.target.value)} onBlur={guardar}
      onKeyDown={(ev) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); if (ev.key === 'Escape') { ev.stopPropagation(); setV(valor); } }} />
  );
}
