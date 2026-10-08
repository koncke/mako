'use client';

// =============================================================================
// EditorEvento — crear o editar un evento del calendario (sólo el equipo)
// =============================================================================
// Los campos de Skool (relevo, B.6): título, fecha, hora, ZONA HORARIA, duración (30 min a 24 h),
// lugar (un link de Zoom/Meet/otro, o una dirección), portada (el selector de portadas de la casa,
// app/_components/PortadaPicker.tsx), descripción, si se repite (cada día / semana con sus días / mes;
// termina nunca, en una fecha o tras N veces) y quién entra (todos, desde un nivel, o los que tienen un
// módulo del curso). Lo que se manda, el server lo vuelve a validar entero (`sanearEvento`).
//
// ⚠️ EDITAR UNA SERIE PREGUNTA EL ALCANCE AL GUARDAR («este / este y los siguientes / todos»), como
//    Google y Skool: el formulario se abre con la fecha de la ocurrencia que se tocó, y es esa fecha la
//    que viaja (`ocurrencia`) para que el server sepa dónde partir.
//
// ⚠️ EL DÍA DE LA SEMANA DE LA FECHA VA SIEMPRE MARCADO en una semanal (y no se puede desmarcar): el
//    primer evento de la serie es ése. El server lo agrega igual (`sanearRecurrencia`).

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, RadioGroup, Select, Spinner, Textarea } from '@/app/_ui';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import { fondoPortada } from '@/lib/portadas';
import {
  DIAS_CORTOS, TOPE_DESCRIPCION_EVENTO, TOPE_TITULO_EVENTO, VECES_MAX, CADA_MAX_EVENTO,
  type AccesoEvento, type Frecuencia, type LugarTipo,
} from '@/lib/comunidad-eventos';
import type { EventoVista, OcurrenciaVista, OpcionesEvento } from '@/lib/comunidad-tipos';
import type { AlcanceEvento, EntradaEvento } from './api';
import { Ico, useComunidad } from './piezas';
import { diaDeSemanaTexto, duracionTexto, hoyEn, zonasDisponibles } from './tiempo';

const DURACIONES = [30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 1440];
const COLOR_PORTADA = '#7c8796';
/** Los días en el orden en que se lee una semana en español (lunes primero). */
const SEMANA = [1, 2, 3, 4, 5, 6, 0];

type Repite = 'no' | Frecuencia;
type Fin = 'nunca' | 'fecha' | 'veces';

export function EditorEvento({ evento, oc, zonaVista, onCerrar, onListo }: {
  /** El que se edita (`null` = uno nuevo). */
  evento: EventoVista | null;
  /** La ocurrencia desde la que se abrió (una serie se edita desde una fecha). */
  oc: OcurrenciaVista | null;
  zonaVista: string;
  onCerrar: () => void;
  onListo: () => void;
}) {
  const { api } = useComunidad();
  const r0 = evento?.recurrencia ?? null;
  const [opciones, setOpciones] = useState<OpcionesEvento | null>(null);
  const [titulo, setTitulo] = useState(evento?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? '');
  // La fecha es la de la ocurrencia tocada (una serie) o la del evento; la hora, la de pared del evento.
  const [fecha, setFecha] = useState(oc?.fecha ?? evento?.local.fecha ?? hoyEn(zonaVista));
  const [hora, setHora] = useState(evento?.local.hora ?? '18:00');
  const [zona, setZona] = useState(evento?.zona ?? '');
  const [duracion, setDuracion] = useState(evento?.duracionMin ?? 60);
  const [lugarTipo, setLugarTipo] = useState<LugarTipo>(evento?.lugarTipo ?? 'link');
  const [lugar, setLugar] = useState(evento?.lugar ?? '');
  const [portada, setPortada] = useState<string | null>(evento?.portada ?? null);
  const [acceso, setAcceso] = useState<AccesoEvento>(evento?.acceso ?? { tipo: 'todos' });
  const [repite, setRepite] = useState<Repite>(r0?.frecuencia ?? 'no');
  const [cada, setCada] = useState(String(r0?.cada ?? 1));
  const [dias, setDias] = useState<number[]>(r0?.dias ?? []);
  const [fin, setFin] = useState<Fin>(r0?.fin.tipo ?? 'nunca');
  const [finFecha, setFinFecha] = useState(r0?.fin.tipo === 'fecha' ? r0.fin.fecha : '');
  const [finVeces, setFinVeces] = useState(String(r0?.fin.tipo === 'veces' ? r0.fin.veces : 10));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [preguntando, setPreguntando] = useState(false);
  // El botón que abrió el selector de portadas (de ahí cuelga el panel). En un estado y no en un ref:
  // un ref no se lee al dibujar (react-hooks/refs), y el panel lo necesita como prop.
  const [anclaPortada, setAnclaPortada] = useState<HTMLElement | null>(null);

  // Los módulos del curso (para «con un módulo») y la zona por defecto de la comunidad.
  useEffect(() => {
    let vivo = true;
    void api.opcionesEvento?.().then((r) => {
      if (!vivo) return;
      if (r.ok) setOpciones({ modulos: r.modulos, zona: r.zona }); else setError(r.error);
    });
    return () => { vivo = false; };
  }, [api]);

  // Un evento nuevo nace en la zona de la comunidad (o del negocio); si no se pudo leer, en la tuya.
  const zonaFinal = zona || opciones?.zona || zonaVista;
  const zonas = useMemo(() => zonasDisponibles(zonaFinal), [zonaFinal]);
  const dowFecha = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? diaDeSemanaTexto(fecha) : null;
  const diasEfectivos = dowFecha == null ? dias : [...new Set([...dias, dowFecha])];

  const esSerieGuardada = !!evento && evento.recurrente && !evento.esReemplazo;
  // Una ocurrencia movida de una serie («editar este evento») es UNA fecha: no se repite (el server
  // tampoco lo guarda, lib/comunidad-calendario.ts). Ofrecerlo sería un control que no hace nada.
  const puedeRepetirse = !evento?.esReemplazo;

  const entrada = (alcance?: AlcanceEvento): EntradaEvento => ({
    ...(evento ? { id: evento.id, alcance, ocurrencia: oc?.fecha ?? null } : {}),
    titulo, descripcion, fecha, hora, zona: zonaFinal, duracionMin: duracion, lugarTipo, lugar, portada, acceso,
    recurrencia: repite === 'no' || !puedeRepetirse ? null : {
      frecuencia: repite, cada: Number(cada) || 1, dias: diasEfectivos,
      fin: fin === 'fecha' ? { tipo: 'fecha', fecha: finFecha } : fin === 'veces' ? { tipo: 'veces', veces: Number(finVeces) || 1 } : { tipo: 'nunca' },
    },
  });

  const guardar = async (alcance?: AlcanceEvento) => {
    if (!api.guardarEvento) return;
    setError(null);
    if (!titulo.trim()) { setError('Falta el título.'); return; }
    if (!fecha || !hora) { setError('Falta la fecha o la hora.'); return; }
    if (acceso.tipo === 'modulo' && !acceso.clave) { setError('Elige un módulo.'); return; }
    if (esSerieGuardada && !alcance) { setPreguntando(true); return; }
    setGuardando(true);
    const r = await api.guardarEvento(entrada(alcance));
    setGuardando(false);
    if (!r.ok) { setError(r.error); return; }
    onListo();
  };

  const modulos = opciones?.modulos ?? [];
  const tipoAcceso = acceso.tipo;

  return (
    <>
      <Modal titulo={evento ? 'Editar evento' : 'Nuevo evento'} ancho={680} onCerrar={onCerrar}
        pie={(
          <>
            <Button variant="tertiary" onClick={onCerrar}>No guardar</Button>
            <Button loading={guardando} onClick={() => void guardar()}>{evento ? 'Guardar evento' : 'Crear evento'}</Button>
          </>
        )}>
        {!opciones && !error ? <div style={{ display: 'grid', placeItems: 'center', padding: 30 }}><Spinner /></div> : (
          <div className="cmu-form">
            <div className="cmu-ev-portada cmu-ev-portada--editor" style={{ background: portada ? fondoPortada(portada, COLOR_PORTADA) : undefined }}>
              <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={(e) => { const b = e.currentTarget; setAnclaPortada((x) => (x ? null : b)); }}>
                {portada ? 'Cambiar portada' : 'Agregar portada'}
              </button>
            </div>
            {anclaPortada && (
              <PortadaPicker valor={portada} colorBase={COLOR_PORTADA} ancla={anclaPortada} titulo="Portada del evento" sinAutomatico
                onElegir={(v) => setPortada(v)} onCerrar={() => setAnclaPortada(null)} />
            )}

            <label className="cmu-campo-l">Título
              <Input value={titulo} maxLength={TOPE_TITULO_EVENTO} onChange={(e) => setTitulo(e.target.value)} autoFocus />
            </label>

            <div className="cmu-form-fila">
              <label className="cmu-campo-l">Fecha
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
              </label>
              <label className="cmu-campo-l">Hora
                <Input type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
              </label>
              <div className="cmu-campo-l">Duración
                <Select ariaLabel="Duración" value={String(duracion)} onChange={(v) => setDuracion(Number(v))}
                  options={DURACIONES.map((d) => ({ value: String(d), label: duracionTexto(d) }))} />
              </div>
            </div>

            <div className="cmu-campo-l">Zona horaria
              <Select ariaLabel="Zona horaria" value={zonaFinal} onChange={setZona} search
                options={zonas.map((z) => ({ value: z, label: z.replace(/_/g, ' ') }))} />
            </div>

            {puedeRepetirse && <div className="cmu-form-fila">
              <div className="cmu-campo-l">Se repite
                <Select ariaLabel="Se repite" value={repite} onChange={(v) => setRepite(v as Repite)} options={[
                  { value: 'no', label: 'No se repite' },
                  { value: 'diaria', label: 'Cada día' },
                  { value: 'semanal', label: 'Cada semana' },
                  { value: 'mensual', label: 'Cada mes' },
                ]} />
              </div>
              {repite !== 'no' && (
                <label className="cmu-campo-l">Cada
                  <Input type="number" min={1} max={CADA_MAX_EVENTO} value={cada} onChange={(e) => setCada(e.target.value)}
                    suffix={repite === 'diaria' ? 'días' : repite === 'semanal' ? 'semanas' : 'meses'} />
                </label>
              )}
            </div>}
            {puedeRepetirse && repite === 'semanal' && (
              <div className="cmu-chips" role="group" aria-label="Días de la semana">
                {SEMANA.map((d) => {
                  const fijo = d === dowFecha;
                  const on = fijo || dias.includes(d);
                  return (
                    <button key={d} type="button" className="cmu-chip" data-on={on} aria-pressed={on} disabled={fijo}
                      onClick={() => setDias((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]))}>
                      {DIAS_CORTOS[d]}
                    </button>
                  );
                })}
              </div>
            )}
            {puedeRepetirse && repite !== 'no' && (
              <div className="cmu-form-fila">
                <div className="cmu-campo-l">Termina
                  <Select ariaLabel="Termina" value={fin} onChange={(v) => setFin(v as Fin)} options={[
                    { value: 'nunca', label: 'Nunca' },
                    { value: 'fecha', label: 'En una fecha' },
                    { value: 'veces', label: 'Tras N veces' },
                  ]} />
                </div>
                {fin === 'fecha' && (
                  <label className="cmu-campo-l">Último día
                    <Input type="date" value={finFecha} min={fecha} onChange={(e) => setFinFecha(e.target.value)} />
                  </label>
                )}
                {fin === 'veces' && (
                  <label className="cmu-campo-l">Veces
                    <Input type="number" min={1} max={VECES_MAX} value={finVeces} onChange={(e) => setFinVeces(e.target.value)} />
                  </label>
                )}
              </div>
            )}

            <div className="cmu-campo-l">Lugar
              <div className="cmu-chips" role="tablist" aria-label="Tipo de lugar">
                <button type="button" role="tab" className="cmu-chip" data-on={lugarTipo === 'link'} aria-selected={lugarTipo === 'link'} onClick={() => setLugarTipo('link')}>
                  <Ico n="link" size={13} /> Link
                </button>
                <button type="button" role="tab" className="cmu-chip" data-on={lugarTipo === 'direccion'} aria-selected={lugarTipo === 'direccion'} onClick={() => setLugarTipo('direccion')}>
                  <Ico n="lugar" size={13} /> Dirección
                </button>
              </div>
              <Input value={lugar} onChange={(e) => setLugar(e.target.value)} aria-label={lugarTipo === 'link' ? 'Link de la llamada' : 'Dirección'}
                placeholder={lugarTipo === 'link' ? 'Link de Zoom, Meet u otro' : 'Calle, número, ciudad'} />
            </div>

            <div className="cmu-form-fila">
              <div className="cmu-campo-l">Quién entra
                <Select ariaLabel="Quién entra" value={tipoAcceso}
                  onChange={(v) => setAcceso(v === 'nivel' ? { tipo: 'nivel', nivel: 2 } : v === 'modulo' ? { tipo: 'modulo', clave: modulos[0]?.clave ?? '' } : { tipo: 'todos' })}
                  options={[
                    { value: 'todos', label: 'Todos' },
                    { value: 'nivel', label: 'Desde un nivel' },
                    ...(modulos.length || tipoAcceso === 'modulo' ? [{ value: 'modulo', label: 'Con un módulo' }] : []),
                  ]} />
              </div>
              {acceso.tipo === 'nivel' && (
                <div className="cmu-campo-l">Nivel
                  <Select ariaLabel="Nivel" value={String(acceso.nivel)} onChange={(v) => setAcceso({ tipo: 'nivel', nivel: Number(v) })}
                    options={[2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ value: String(n), label: `Nivel ${n}` }))} />
                </div>
              )}
              {acceso.tipo === 'modulo' && (
                <div className="cmu-campo-l">Módulo
                  <Select ariaLabel="Módulo" value={acceso.clave} placeholder="Elige un módulo" onChange={(v) => setAcceso({ tipo: 'modulo', clave: v })}
                    options={modulos.map((m) => ({ value: m.clave, label: m.nombre }))} />
                </div>
              )}
            </div>

            <label className="cmu-campo-l">Descripción
              <Textarea value={descripcion} maxLength={TOPE_DESCRIPCION_EVENTO} rows={4} onChange={(e) => setDescripcion(e.target.value)} />
            </label>

            {error && <p className="cmu-error" role="alert">{error}</p>}
          </div>
        )}
      </Modal>
      {preguntando && (
        <AlcanceModal accion="guardar" onCerrar={() => setPreguntando(false)}
          onElegir={(a) => { setPreguntando(false); void guardar(a); }} />
      )}
    </>
  );
}

// ── «Este / este y los siguientes / todos» ──────────────────────────────────────

/** El alcance de una edición o un borrado sobre una serie (Skool: this event / this and following / all events). */
export function AlcanceModal({ accion, onCerrar, onElegir }: { accion: 'guardar' | 'borrar'; onCerrar: () => void; onElegir: (a: AlcanceEvento) => void }) {
  const [alcance, setAlcance] = useState<AlcanceEvento>('este');
  return (
    <Modal titulo={accion === 'borrar' ? 'Borrar un evento que se repite' : 'Editar un evento que se repite'} ancho={440} onCerrar={onCerrar} anidada
      pie={(
        <>
          <Button variant="tertiary" onClick={onCerrar}>{accion === 'borrar' ? 'No borrar' : 'No guardar'}</Button>
          <Button variant={accion === 'borrar' ? 'danger' : 'primary'} onClick={() => onElegir(alcance)}>{accion === 'borrar' ? 'Borrar' : 'Guardar'}</Button>
        </>
      )}>
      <RadioGroup value={alcance} onChange={(v) => setAlcance(v as AlcanceEvento)} options={[
        { value: 'este', label: 'Este evento' },
        { value: 'siguientes', label: 'Este y los siguientes' },
        { value: 'todos', label: 'Todos los eventos' },
      ]} />
    </Modal>
  );
}
