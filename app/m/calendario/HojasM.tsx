'use client';

// =============================================================================
// Las hojas del Calendario del teléfono: un evento abierto, y «Nuevo evento»
// =============================================================================
//   · EL EVENTO (la tarjeta de escritorio, TarjetaEvento): el título, la fecha, el calendario y lo que tenga (lugar,
//     invitados, la descripción como TEXTO, nunca HTML: viene de afuera). Abajo, lo que se puede hacer: unirse a la
//     videollamada, tildar lo propio, ir a donde vive (la ficha, el Plan, General), abrirlo en Google y borrar.
//   · NUEVO EVENTO (el «crear en el lugar» de escritorio, RapidoNuevo): el título, qué es (Evento, Publicación, Bloque
//     de trabajo, Llamada: `TIPOS_RAPIDO`), todo el día, la fecha y las horas, el formato de una publicación y el
//     calendario. «Más opciones» (lugar, descripción, color) se queda en la computadora.
// Los campos miden 16 px (iOS no hace zoom) y cada control, 44 de alto.
// =============================================================================

import { useState, type CSSProperties } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { FilaDatoM, FilaM, InterruptorM, ListaM, PieM, SheetM } from '@/app/m/_ui';
import { rutaMovil } from '@/lib/movil-rutas';
import {
  FORMATOS_PUBLICACION, ROTULO_FORMATO, ROTULO_TIPO, capaDeTipo,
  type FormatoPublicacion, type ItemCalendario,
} from '@/lib/calendario-modelo';
import { TOPE_TITULO_GOOGLE, type CalendarioGoogle } from '@/lib/calendario-google-modelo';
import {
  COLOR_CAPA, NOMBRE_CAPA, TIPOS_RAPIDO, colorDe, lineaDeFecha, nombreCalendarioDe, rotuloDeIr, sePuedeMover, tituloDe, vaAGoogle,
  type BorradorNuevo,
} from '@/app/calendario/comun';
import { TEXTO_GUARDAR } from './modelo';

const CLASE_BOTON = (variante: 'primary' | 'secondary' | 'tertiary') => `mk-btn mk-btn--${variante} mk-btn--lg mk-btn--full`;

// ── El evento ───────────────────────────────────────────────────────────────────────────────────────────────────────

export function HojaEvento({ abierta, item, tz, calendarios, googleEscribe, onCerrar, onHecho, onBorrar }: {
  abierta: boolean;
  /** El último que se abrió (se queda mientras la hoja baja). */
  item: ItemCalendario | null;
  tz: string;
  calendarios: readonly CalendarioGoogle[];
  googleEscribe: boolean;
  onCerrar: () => void;
  onHecho: (it: ItemCalendario, hecho: boolean) => void;
  onBorrar: (it: ItemCalendario) => void;
}) {
  if (!item) return null;
  const g = item.google;
  // Lo que escritorio deja editar es lo que acá se puede borrar: lo propio y lo de Google editable.
  const editable = sePuedeMover(item, googleEscribe);
  const ir = item.href && !g ? rutaMovil(item.href) : null;
  const meet = g?.videollamada ?? null;
  // Debajo de la fecha, qué es: el tipo de lo propio, el detalle de lo que viene de otro lado, o que se repite.
  const que = item.fuente === 'propio' && item.tipo
    ? `${ROTULO_TIPO[item.tipo]}${item.tipo === 'publicacion' && item.formato ? ` · ${ROTULO_FORMATO[item.formato]}` : ''}`
    : g ? (g.recurrente ? 'Se repite' : null) : item.detalle?.trim() || null;
  const texto = (g?.descripcion || item.notas || '').trim();

  const botones = [
    meet && (
      <a key="meet" className={CLASE_BOTON('primary')} href={meet} target="_blank" rel="noopener noreferrer">
        {/meet\.google\.com/.test(meet) ? 'Unirse con Google Meet' : 'Unirse a la videollamada'}
      </a>
    ),
    item.fuente === 'propio' && (
      <Button key="hecho" variant={item.hecho ? 'secondary' : 'primary'} size="lg" full onClick={() => onHecho(item, !item.hecho)}>
        {item.hecho ? 'Marcar como pendiente' : 'Marcar como hecho'}
      </Button>
    ),
    ir && <ButtonLink key="ir" href={ir} variant="secondary" size="lg" full>{rotuloDeIr(item)}</ButtonLink>,
    g?.enlace && (
      <a key="google" className={CLASE_BOTON('tertiary')} href={g.enlace} target="_blank" rel="noopener noreferrer">Abrir en Google Calendar</a>
    ),
    // Con invitados, Google les avisa al borrar (como en escritorio): el botón lo dice.
    editable && (
      <Button key="borrar" variant="tertiary" size="lg" full icon={<Icon name="trash" size={18} />} onClick={() => onBorrar(item)}>
        {g && g.invitados > 0 ? 'Borrar y avisar' : 'Borrar evento'}
      </Button>
    ),
  ].filter(Boolean);

  return (
    <SheetM abierto={abierta} onCerrar={onCerrar} titulo={tituloDe(item, tz)} id="evento"
      pie={botones.length ? <PieM>{botones}</PieM> : undefined}>
      <div className="m-calendario-hoja-fecha" style={{ '--c': colorDe(item) } as CSSProperties}>
        <i aria-hidden />
        <div>
          <p className="m-calendario-hoja-fecha__t" data-tachado={item.hecho || g?.rechazado ? '' : undefined}>{lineaDeFecha(item, tz)}</p>
          {que && <p className="m-calendario-hoja-fecha__c">{que}</p>}
        </div>
      </div>
      <ListaM>
        <FilaDatoM k="Calendario" v={nombreCalendarioDe(item, calendarios)} />
        {g?.ubicacion && <FilaDatoM k="Lugar" v={g.ubicacion} />}
        {g && g.invitados > 0 && <FilaDatoM k="Invitados" v={String(g.invitados)} />}
        {g?.organizador && <FilaDatoM k="Organiza" v={g.organizador} />}
      </ListaM>
      {texto && <p className="m-calendario-nota">{texto}</p>}
    </SheetM>
  );
}

// ── Nuevo evento ────────────────────────────────────────────────────────────────────────────────────────────────────

export function HojaNueva({ abierta, inicial, editables, guardando, error, onCerrar, onGuardar }: {
  abierta: boolean;
  inicial: BorradorNuevo;
  /** Los calendarios de Google donde se puede crear (vacío = va a MaKo). */
  editables: readonly CalendarioGoogle[];
  guardando: boolean;
  error: string | null;
  onCerrar: () => void;
  onGuardar: (b: BorradorNuevo) => void;
}) {
  const [b, setB] = useState<BorradorNuevo>(inicial);
  const poner = (p: Partial<BorradorNuevo>) => setB((x) => ({ ...x, ...p }));
  const aGoogle = vaAGoogle(b, editables);
  const capa = capaDeTipo(b.tipo === 'evento' ? 'bloque' : b.tipo);
  const calGoogle = aGoogle ? editables.find((c) => c.id === b.calendarioId) ?? editables[0] : null;
  const color = calGoogle?.color ?? COLOR_CAPA[capa];
  const todoElDia = b.hora == null;
  const enviar = () => { if (!guardando) onGuardar({ ...b, calendarioId: calGoogle?.id ?? null }); };

  return (
    <SheetM abierto={abierta} onCerrar={onCerrar} titulo="Nuevo evento" id="nuevo" snap="alto" ocupado={guardando}
      pie={(
        <PieM>
          <Button variant="primary" size="lg" full loading={guardando} onClick={enviar}>{TEXTO_GUARDAR[b.tipo]}</Button>
        </PieM>
      )}>
      <input className="m-calendario-titulo" placeholder="Agregar título" aria-label="Título" value={b.titulo}
        maxLength={TOPE_TITULO_GOOGLE} enterKeyHint="done" onChange={(e) => poner({ titulo: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); enviar(); } }} />
      <div className="m-calendario-tipos" role="group" aria-label="Qué es">
        {TIPOS_RAPIDO.map((t) => (
          <button key={t.id} type="button" className="m-calendario-tipo" aria-pressed={b.tipo === t.id} onClick={() => poner({ tipo: t.id })}>
            {t.nombre}
          </button>
        ))}
      </div>
      <ListaM>
        <FilaM titulo="Todo el día" control={(
          <InterruptorM etiqueta="Todo el día" activo={todoElDia}
            onCambio={(v) => poner(v ? { hora: null, horaFin: null } : { hora: '10:00', horaFin: '11:00' })} />
        )} />
        <label className="m-calendario-campo">
          <span className="m-calendario-campo__k">Fecha</span>
          <input type="date" className="m-calendario-campo__v" value={b.fecha} onChange={(e) => { if (e.target.value) poner({ fecha: e.target.value }); }} />
        </label>
        {!todoElDia && (
          <label className="m-calendario-campo">
            <span className="m-calendario-campo__k">Empieza</span>
            <input type="time" step={900} className="m-calendario-campo__v" value={b.hora ?? ''} onChange={(e) => { if (e.target.value) poner({ hora: e.target.value }); }} />
          </label>
        )}
        {/* Una publicación es un momento, no un rango (como en escritorio). */}
        {!todoElDia && b.tipo !== 'publicacion' && (
          <label className="m-calendario-campo">
            <span className="m-calendario-campo__k">Termina</span>
            <input type="time" step={900} className="m-calendario-campo__v" value={b.horaFin ?? ''} onChange={(e) => poner({ horaFin: e.target.value || null })} />
          </label>
        )}
        {b.tipo === 'publicacion' && (
          <label className="m-calendario-campo">
            <span className="m-calendario-campo__k">Formato</span>
            <select className="m-calendario-campo__v" value={b.formato} onChange={(e) => poner({ formato: e.target.value as FormatoPublicacion })}>
              {FORMATOS_PUBLICACION.map((f) => <option key={f} value={f}>{ROTULO_FORMATO[f]}</option>)}
            </select>
          </label>
        )}
        <label className="m-calendario-campo">
          <span className="m-calendario-campo__k">
            <i className="m-calendario-campo__color" style={{ background: color }} aria-hidden />Calendario
          </span>
          {calGoogle && editables.length > 1 ? (
            <select className="m-calendario-campo__v" value={calGoogle.id} onChange={(e) => poner({ calendarioId: e.target.value })}>
              {editables.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <span className="m-calendario-campo__txt">{calGoogle ? calGoogle.nombre : `MaKo · ${NOMBRE_CAPA[capa]}`}</span>
          )}
        </label>
      </ListaM>
      {error && <p className="m-calendario-error" role="alert">{error}</p>}
    </SheetM>
  );
}
