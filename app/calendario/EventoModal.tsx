'use client';

// =============================================================================
// EventoModal — un evento PROPIO del Calendario: crearlo, cambiarlo, tildarlo o borrarlo
// =============================================================================
// Un paso por pantalla: este modal hace UNA cosa, el evento. Lo de afuera (una reunión del CRM, la agenda de Google,
// un deadline del Plan) no se edita acá: lleva a donde vive.
//
// Lo que no se ve en la firma:
//   · LA FECHA Y LA HORA SON DE PARED, en la zona del negocio: las convierte el server (`filaDeEntrada`,
//     lib/calendario-modelo.ts). Una hora vacía es «todo el día».
//   · EL TÍTULO NO SE RECORTA: con más de 160 caracteres el server contesta el error y el modal lo muestra.
//   · `onCerrar` CON IDENTIDAD FIJA (`useCerrarEstable`) y sin cerrar mientras guarda (AGENTS.md, `<Modal>`).
//   · Borrar cierra el modal y deja el «Deshacer» a quien monta (el toast vive afuera, que no se desmonta).

import { useState, type CSSProperties } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { Button } from '@/app/_ui/Button';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { Checkbox } from '@/app/_ui/Toggle';
import { TextField } from '@/app/_ui/Field';
import { Select } from '@/app/_ui/Select';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import { useCerrarEstable } from '@/app/customer-success/curso/dialogo-foco';
import {
  TIPOS_EVENTO, FORMATOS_PUBLICACION, ROTULO_TIPO, ROTULO_FORMATO, TOPE_TITULO,
  type EntradaEvento, type TipoEvento, type FormatoPublicacion,
} from '@/lib/calendario-modelo';

/** El ícono de cada tipo y de cada formato (la regla de la casa: cada opción de un desplegable lleva el suyo). */
export const ICONO_TIPO: Record<TipoEvento, NombreIconoMenu> = { publicacion: 'enviar', bloque: 'reloj', llamada: 'telefono', otro: 'nota' };
export const ICONO_FORMATO: Record<FormatoPublicacion, NombreIconoMenu> = { story: 'imagen', reel: 'video', post: 'texto', ad: 'anuncio', email: 'email', video: 'video', otro: 'nota' };

const DURACIONES = [0, 15, 30, 45, 60, 90, 120, 180, 240];
const rotuloDuracion = (m: number) => (m === 0 ? 'Sin duración' : m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`);

export type EventoEditable = EntradaEvento & { id?: string; hecho?: boolean };

export function EventoModal({ inicial, guardando, error, onCerrar, onGuardar, onBorrar, onHecho }: {
  inicial: EventoEditable;
  guardando: boolean;
  error: string | null;
  onCerrar: () => void;
  onGuardar: (e: EntradaEvento) => void;
  /** Sólo al editar uno que ya existe. */
  onBorrar?: () => void;
  /** Sólo al editar: tildarlo (o destildarlo) en el acto. */
  onHecho?: (hecho: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(inicial.titulo);
  const [tipo, setTipo] = useState<TipoEvento>(inicial.tipo);
  const [formato, setFormato] = useState<FormatoPublicacion>(inicial.formato ?? 'reel');
  const [fecha, setFecha] = useState(inicial.fecha);
  const [hora, setHora] = useState(inicial.hora ?? '');
  const [duracion, setDuracion] = useState(String(inicial.duracionMin ?? 0));
  const [notas, setNotas] = useState(inicial.notas ?? '');
  const cerrar = useCerrarEstable(onCerrar, guardando);
  const editando = !!inicial.id;
  const listo = titulo.trim().length > 0 && titulo.trim().length <= TOPE_TITULO && !!fecha;

  const guardar = () => {
    if (!listo) return;
    onGuardar({
      titulo, tipo, formato: tipo === 'publicacion' ? formato : null, fecha, hora: hora || null,
      duracionMin: hora && Number(duracion) > 0 ? Number(duracion) : null, notas,
    });
  };

  return (
    <Modal titulo={editando ? 'Evento' : 'Nuevo evento'} ancho={560} onCerrar={cerrar}
      pie={
        <>
          {editando && onBorrar && <BotonBorrar title="Borrar este evento" texto="Borrar" disabled={guardando} onClick={onBorrar} style={{ marginRight: 'auto' }} />}
          <Button variant="tertiary" disabled={guardando} onClick={cerrar}>Cancelar</Button>
          <Button variant="primary" loading={guardando} disabled={!listo} onClick={guardar}>{editando ? 'Guardar' : 'Agendar'}</Button>
        </>
      }>
      <div data-evento-modal="" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <TextField label="Título" value={titulo} maxLength={TOPE_TITULO} data-autofocus="" onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar(); } }} />

        <div role="radiogroup" aria-label="Tipo de evento" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TIPOS_EVENTO.map((t) => {
            const es = t === tipo;
            return (
              <button key={t} type="button" role="radio" aria-checked={es} onClick={() => setTipo(t)} style={{ ...CHIP, background: es ? 'var(--ink)' : 'transparent', color: es ? 'var(--surface)' : 'var(--dim)', borderColor: es ? 'var(--ink)' : 'var(--border-strong)' }}>
                <IconoMenu nombre={ICONO_TIPO[t]} size={16} />{ROTULO_TIPO[t]}
              </button>
            );
          })}
        </div>

        {tipo === 'publicacion' && (
          <Select label="Formato" value={formato} onChange={(v) => setFormato(v as FormatoPublicacion)}
            options={FORMATOS_PUBLICACION.map((f) => ({ value: f, label: ROTULO_FORMATO[f], icono: ICONO_FORMATO[f] }))} />
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
          <label style={CAMPO}>
            <span style={ROTULO}>Fecha</span>
            <input className="lead-field" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={INPUT} />
          </label>
          <label style={CAMPO}>
            <span style={ROTULO}>Hora</span>
            <input className="lead-field" type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={INPUT} aria-label="Hora (vacía: todo el día)" />
          </label>
          {hora && (
            <Select label="Duración" value={duracion} onChange={setDuracion}
              options={DURACIONES.map((m) => ({ value: String(m), label: rotuloDuracion(m), icono: 'reloj' as const }))} />
          )}
        </div>
        {!hora && <span style={{ fontSize: 13, color: 'var(--dim)', marginTop: -8 }}>Todo el día</span>}

        <TextField label="Notas" multiline value={notas} maxLength={4000} onChange={(e) => setNotas(e.target.value)} />

        {editando && onHecho && (
          <Checkbox checked={!!inicial.hecho} disabled={guardando} onChange={(v) => onHecho(v)} label={tipo === 'publicacion' ? 'Ya se publicó' : 'Ya está hecho'} />
        )}
        {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}</div>}
      </div>
    </Modal>
  );
}

const CHIP: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 999,
  border: '1px solid var(--border-strong)', fontSize: 13.5, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
};
const CAMPO: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 };
const ROTULO: CSSProperties = { fontSize: 13, fontWeight: 500, color: 'var(--dim)' };
const INPUT: CSSProperties = { width: '100%', boxSizing: 'border-box' };
