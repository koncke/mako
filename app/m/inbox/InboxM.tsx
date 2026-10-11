'use client';

// =============================================================================
// /m/inbox — «Para decidir» y «Avisos», en el teléfono
// =============================================================================
// El Inbox ES la campanita (docs/diseno-mako-mobile.md): lo que espera una decisión
// arriba, lo que ya salió abajo. Todo lo que se decide pasa por el SheetM de la
// decisión, nunca por la fila: «una aprobación no se da sin abrir» — el detalle (lo
// que se ejecuta) tiene que estar a la vista ANTES del botón, y la consecuencia
// pegada arriba del primario.
//
// ⚠️ LAS ACCIONES SON LAS DE app/m/inbox/acciones.ts (no las de escritorio): esas
// vuelven a mirar rol + capa, rechazan una acción compleja y refrescan /m. Esta
// pantalla no decide permisos: muestra lo que `leerParaDecidir` le dio.
//
// ⚠️ UNA APROBACIÓN NUNCA SE ENCOLA OFFLINE: sin red, el primario se apaga con el
// motivo pegado. Mandarla «cuando vuelva la red» es ejecutar algo que la persona ya
// no está mirando.
//
// ⚠️ `ok:false` DESPUÉS DE EJECUTAR no se reintenta a ciegas: la acción ya quedó
// cerrada con su error (app/m/inbox/acciones.ts). Se muestra el motivo en el sheet.
// Un throw (la request no volvió) sí ofrece reintentar: no se sabe si llegó, y el
// reclamo del server (`.eq('estado','pendiente')`) hace que un segundo toque sea
// inofensivo.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Switch } from '@/app/_ui/Toggle';
import { Icon } from '@/app/_components/icons';
import { useRouter } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { Parametro } from '@/lib/api-mako/tipos';
import { rotuloDeParametro } from '@/lib/editor-acciones';
import type { ItemDecision, OpcionDecision, ResultadoMovil, TipoDecision } from '@/lib/inbox-movil-reglas';
import { FilaM, SeccionM, SheetM, VacioM, ErrorM, useToastM, useConexion, horaCorta } from '../_ui';
import {
  confirmarPendienteMovil, cancelarPendienteMovil, confirmarAccionMovil, descartarAccionMovil, resolverConfirmacionMovil,
} from './acciones';
import {
  armarPayload, esEditable, fraseDeFallas, minutosRestantes, rielDeVence, rotulosDe, toastDeExito, valorInicial, yaNoPendiente,
} from './inbox-ui';

/** Un aviso del feed, ya traducido por el server (ruta MÓVIL o null = sólo lectura). */
export type AvisoM = {
  id: number;
  titulo: string;
  descripcion: string | null;
  ruta: string | null;
  createdAt: string;
  urgente: boolean;
  nuevo: boolean;
};

export function InboxM({ items, fallas, avisos, avisosFalla, marcarHasta, conAvisos = true }: {
  /** false = el rol no ve los avisos del negocio (son de admin, como en escritorio): sin sección. */
  conAvisos?: boolean;
  items: ItemDecision[];
  fallas: TipoDecision[];
  avisos: AvisoM[];
  /** true = no se pudo leer el feed (no es lo mismo que «no hay avisos»). */
  avisosFalla: boolean;
  /** El createdAt del aviso más nuevo, si es posterior a la marca de agua: se marca al abrir. */
  marcarHasta: string | null;
}) {
  const toast = useToastM();
  const [abierta, setAbierta] = useState<string | null>(null);
  // Lo que ya se resolvió en esta pantalla sale de la lista sin esperar al refresh.
  const [resueltos, setResueltos] = useState<ReadonlySet<string>>(new Set());
  const ahora = useAhora();

  const visibles = useMemo(() => items.filter((i) => !resueltos.has(i.key)), [items, resueltos]);
  const enTelefono = useMemo(() => visibles.filter((i) => i.accionMovil !== 'computadora'), [visibles]);
  const enCompu = useMemo(() => visibles.filter((i) => i.accionMovil === 'computadora'), [visibles]);
  const sel = visibles.find((i) => i.key === abierta) ?? null;
  const falla = fraseDeFallas(fallas);

  // Marca de agua del feed: al abrir el Inbox, lo que se ve queda visto. Una vez.
  const marcado = useRef(false);
  useEffect(() => {
    if (!marcarHasta || marcado.current) return;
    marcado.current = true;
    fetch('/api/notificaciones', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'visto', hasta: marcarHasta }),
    }).catch(() => { /* sin red: se marca la próxima vez que abra */ });
  }, [marcarHasta]);

  const sacar = (key: string) => setResueltos((s) => new Set(s).add(key));

  return (
    <>
      <SeccionM titulo="Para decidir" id="decidir">
        {falla && <ErrorM frase={falla} />}
        {enTelefono.length > 0 ? (
          <div className="m-lista">
            {enTelefono.map((it) => (
              <FilaDecision key={it.key} item={it} ahora={ahora} onAbrir={() => setAbierta(it.key)} />
            ))}
          </div>
        ) : !falla ? (
          <VacioM frase="Nada para decidir." />
        ) : null}
        {/* Lo que se revisa en la computadora (borradores del plan, contactos) no compite con
            lo que se aprueba acá: en el ws 9 eran 68 filas que el teléfono no puede resolver
            (medido el 11/10/2026). Va plegado en UNA fila, y sigue a mano. */}
        {enCompu.length > 0 && (
          <details className="mi-compu">
            <summary className="mi-compu-sum">
              <Icon name="web" size={20} />
              <span>{enCompu.length === 1 ? '1 para revisar en la computadora' : `${enCompu.length} para revisar en la computadora`}</span>
            </summary>
            <div className="m-lista">
              {enCompu.map((it) => (
                <FilaDecision key={it.key} item={it} ahora={ahora} onAbrir={() => setAbierta(it.key)} />
              ))}
            </div>
          </details>
        )}
      </SeccionM>

      {conAvisos && <SeccionM titulo="Avisos" id="avisos">
        {avisosFalla ? (
          <ErrorM frase="No pude leer los avisos." />
        ) : avisos.length ? (
          <div className="m-lista">
            {avisos.map((a) => (
              <FilaM
                key={a.id}
                titulo={a.titulo}
                segunda={a.descripcion ?? undefined}
                pill={a.nuevo ? <span className="mk-pill mi-pill-nuevo">Nuevo</span> : undefined}
                riel={<Cuando iso={a.createdAt} ahora={ahora} />}
                href={a.ruta ?? undefined}
                etiqueta={a.urgente ? `Urgente: ${a.titulo}` : undefined}
              />
            ))}
          </div>
        ) : (
          <VacioM frase="Sin avisos todavía." />
        )}
      </SeccionM>}

      <SheetDecision
        item={sel}
        ahora={ahora}
        onCerrar={() => setAbierta(null)}
        onResuelto={(it, salida, resumen) => {
          haptico('success');
          toast(resumen && resumen.length <= 28 ? resumen : toastDeExito(it.tipo, salida));
          sacar(it.key);
          setAbierta(null);
        }}
        onYaNo={(it) => {
          toast('Ya no está pendiente');
          sacar(it.key);
          setAbierta(null);
        }}
      />
    </>
  );
}

// ── La fila ──────────────────────────────────────────────────────────────────

/** Lo que bloquea lleva la pill naranja: lo único naranja de la pantalla. */
const BLOQUEA: ReadonlySet<TipoDecision> = new Set(['pendiente', 'accion']);

function FilaDecision({ item, ahora, onAbrir }: { item: ItemDecision; ahora: number | null; onAbrir: () => void }) {
  const min = ahora != null ? minutosRestantes(item.venceAt, ahora) : null;
  const segunda = [item.consecuencia ?? item.resumen, item.origen].filter(Boolean).join(' · ');
  return (
    <FilaM
      titulo={item.titulo}
      segunda={segunda}
      pill={BLOQUEA.has(item.tipo) && item.accionMovil !== 'computadora'
        ? <span className="mk-pill mi-pill-aprobacion">{GRAMATICA.aprobacion.rotulo}</span>
        : undefined}
      riel={item.tipo === 'pendiente' ? <span className={min != null && min < 0 ? 'mi-vencida' : undefined}>{rielDeVence(min)}</span> : undefined}
      onClick={onAbrir}
      leading={item.accionMovil === 'computadora' ? <span className="mi-lead"><Icon name="web" size={20} /></span> : undefined}
    />
  );
}

// ── El sheet de la decisión ──────────────────────────────────────────────────

function SheetDecision({ item, ahora, onCerrar, onResuelto, onYaNo }: {
  item: ItemDecision | null;
  ahora: number | null;
  onCerrar: () => void;
  onResuelto: (it: ItemDecision, salida: boolean, resumen?: string) => void;
  onYaNo: (it: ItemDecision) => void;
}) {
  const { enLinea } = useConexion();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<{ texto: string; reintentar: boolean } | null>(null);
  const [ediciones, setEdiciones] = useState<Record<string, string | boolean>>({});
  // El último ítem abierto se conserva mientras el sheet se va (cierra en 220 ms).
  const ultimo = useRef<ItemDecision | null>(null);
  if (item) ultimo.current = item;
  const it = item ?? ultimo.current;

  // Abrir otro ítem arranca limpio.
  const clave = item?.key ?? null;
  useEffect(() => { setError(null); setEdiciones({}); setEnviando(null); }, [clave]);

  if (!it) return <SheetM abierto={false} onCerrar={onCerrar} titulo="" id="decision" />;

  const min = ahora != null ? minutosRestantes(it.venceAt, ahora) : null;
  const vencida = min != null && min < 0;
  const rot = rotulosDe(it);
  const editables = it.tipo === 'accion' && it.accionMovil === 'confirmar-accion'
    ? it.parametros.filter(esEditable)
    : [];

  /** Corre una acción del server y traduce el resultado a lo que ve la persona. */
  const correr = async (cual: string, salida: boolean, fn: () => Promise<ResultadoMovil>) => {
    if (enviando) return;
    if (!enLinea) { setError({ texto: 'Sin conexión: no se envió.', reintentar: false }); return; }
    setEnviando(cual);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) { onResuelto(it, salida, r.resumen); return; }
      if (yaNoPendiente(r.error)) { onYaNo(it); return; }
      haptico('error');
      setError({ texto: `MaKo no pudo: ${r.error ?? 'error sin detalle'}`, reintentar: false });
    } catch {
      haptico('error');
      setError({ texto: 'No llegó al servidor. Revisa la red y reintenta.', reintentar: true });
    } finally {
      setEnviando(null);
    }
  };

  const confirmar = () => {
    if (it.tipo === 'pendiente') return correr('primario', false, () => confirmarPendienteMovil(it.id));
    if (it.tipo === 'accion' && it.accionMovil === 'confirmar-accion') {
      const p = armarPayload(it.parametros, it.payload, ediciones);
      if (!p.ok) { setError({ texto: p.error, reintentar: false }); return; }
      return correr('primario', false, () => confirmarAccionMovil(it.id, p.payload));
    }
  };
  const salir = () => {
    if (it.tipo === 'pendiente') return correr('salida', true, () => cancelarPendienteMovil(it.id));
    if (it.tipo === 'accion') return correr('salida', true, () => descartarAccionMovil(it.id));
  };
  const resolver = (op: OpcionDecision) => {
    if (it.tipo !== 'confirmacion') return;
    return correr(op.decision, op.decision === 'rechazar', () => resolverConfirmacionMovil(it.id, op.decision));
  };

  const sinRed = !enLinea ? <p className="mi-aviso" role="status">Sin conexión: no se puede aprobar.</p> : null;
  const errorTxt = error ? <p className="mi-error" role="alert">{error.texto}</p> : null;

  let pie: ReactNode;
  if (it.accionMovil === 'computadora') {
    pie = (
      <>
        <p className="mi-consecuencia">Se revisa en la computadora.</p>
        <ButtonLink href={it.linkEscritorio} variant="primary" size="lg" full>Revisar en la computadora</ButtonLink>
      </>
    );
  } else if (it.tipo === 'confirmacion') {
    const ops = it.opciones;
    pie = (
      <>
        {errorTxt}{sinRed}
        {it.consecuencia && <p className="mi-consecuencia">{it.consecuencia}</p>}
        {ops.map((op, i) => (
          <Button
            key={op.decision}
            variant={op.tono === 'primary' ? 'primary' : op.tono === 'danger' ? 'danger' : 'secondary'}
            size={i === 0 ? 'lg' : 'md'}
            full
            loading={enviando === op.decision}
            disabled={!enLinea || (enviando != null && enviando !== op.decision)}
            onClick={() => resolver(op)}
          >
            {op.label}
          </Button>
        ))}
      </>
    );
  } else {
    pie = (
      <>
        {errorTxt}{sinRed}
        {vencida
          ? <p className="mi-consecuencia">Esta acción venció: ya no se puede ejecutar.</p>
          : <p className="mi-consecuencia">{it.consecuencia ?? 'MaKo lo ejecuta en cuanto confirmes.'}</p>}
        {!vencida && rot.primario && (
          <Button variant="primary" size="lg" full loading={enviando === 'primario'}
            disabled={!enLinea || enviando === 'salida'} onClick={confirmar}>
            {rot.primario}
          </Button>
        )}
        {rot.salida && (
          <Button variant="tertiary" size="md" full loading={enviando === 'salida'}
            disabled={!enLinea || enviando === 'primario'} onClick={salir}>
            {rot.salida}
          </Button>
        )}
      </>
    );
  }

  return (
    <SheetM
      abierto={item != null}
      onCerrar={onCerrar}
      titulo={it.titulo}
      id="decision"
      snap="alto"
      ocupado={enviando != null}
      pie={pie}
    >
      <div className="mi-detalle">
        {it.resumen && it.resumen !== it.titulo && <p className="mi-resumen">{it.resumen}</p>}
        <p className="mi-meta">
          {it.origen}
          {it.tipo === 'pendiente' && it.vence && (
            <> · <span className={vencida ? 'mi-vencida' : undefined}>{vencida ? 'Vencida' : `Vence ${it.vence}`}</span></>
          )}
          {it.creadaAt && it.tipo !== 'pendiente' && <> · <Cuando iso={it.creadaAt} ahora={ahora} /></>}
        </p>

        {editables.length > 0 && it.tipo === 'accion' ? (
          <CamposEditables
            parametros={editables}
            guardado={it.payload ?? {}}
            ediciones={ediciones}
            onCambio={(n, v) => setEdiciones((e) => ({ ...e, [n]: v }))}
            deshabilitado={enviando != null}
          />
        ) : null}

        {(() => {
          // Lo que NO se edita se muestra igual: lo que bloquea no linkea, se lee acá.
          const editNombres = new Set(editables.map((p) => rotuloDeParametro(p)));
          const lineas = it.detalle.filter((l) => !editables.length || !editNombres.has(l.rotulo));
          if (!lineas.length) return null;
          return (
            <>
              <h3 className="mi-sub">{it.accionMovil === 'computadora' ? 'Lo esencial' : 'Lo que se va a ejecutar'}</h3>
              <dl className="mi-lineas">
                {lineas.map((l, i) => (
                  <div key={i} className="mi-linea">
                    <dt>{l.rotulo}</dt>
                    <dd>{l.valor}</dd>
                  </div>
                ))}
              </dl>
            </>
          );
        })()}
      </div>
    </SheetM>
  );
}

// ── Parámetros que se corrigen en el sheet ───────────────────────────────────

function CamposEditables({ parametros, guardado, ediciones, onCambio, deshabilitado }: {
  parametros: Parametro[];
  guardado: Record<string, unknown>;
  ediciones: Record<string, string | boolean>;
  onCambio: (nombre: string, v: string | boolean) => void;
  deshabilitado: boolean;
}) {
  return (
    <>
      <h3 className="mi-sub">Lo que se va a ejecutar</h3>
      <div className="mi-campos">
        {parametros.map((p) => {
          const v = p.nombre in ediciones ? ediciones[p.nombre] : valorInicial(p, guardado[p.nombre]);
          const rotulo = rotuloDeParametro(p);
          const id = `mi-campo-${p.nombre}`;
          if (p.tipo === 'boolean') {
            return <Switch key={p.nombre} checked={v === true} onChange={(b) => onCambio(p.nombre, b)} label={rotulo} disabled={deshabilitado} />;
          }
          if (p.enum?.length) {
            return (
              <label key={p.nombre} className="mi-campo" htmlFor={id}>
                <span className="mi-campo__rot">{rotulo}</span>
                <select id={id} className="mk-input" value={String(v)} disabled={deshabilitado}
                  onChange={(e) => onCambio(p.nombre, e.target.value)}>
                  {!p.obligatorio && <option value="">Sin elegir</option>}
                  {p.enum.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            );
          }
          const largo = p.tipo === 'string' && (String(v).length > 60 || (p.max ?? 0) > 200);
          return (
            <label key={p.nombre} className="mi-campo" htmlFor={id}>
              <span className="mi-campo__rot">{rotulo}</span>
              {largo ? (
                <textarea id={id} className="mk-input mi-area" value={String(v)} disabled={deshabilitado}
                  maxLength={p.max} rows={4} onChange={(e) => onCambio(p.nombre, e.target.value)} />
              ) : (
                <input id={id} className="mk-input" value={String(v)} disabled={deshabilitado}
                  inputMode={p.tipo === 'number' ? 'decimal' : undefined}
                  maxLength={p.tipo === 'string' ? p.max : undefined}
                  onChange={(e) => onCambio(p.nombre, e.target.value)} />
              )}
            </label>
          );
        })}
      </div>
    </>
  );
}

// ── El tiempo, en el reloj del teléfono ──────────────────────────────────────

/** `Date.now()` después de montar (y cada minuto): el server no sabe la hora del teléfono. */
function useAhora(): number | null {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

/** «10:42» si fue hoy; «12 oct» si no. Nada hasta montar (evita el desfase de hidratación). */
function Cuando({ iso, ahora }: { iso: string; ahora: number | null }) {
  if (ahora == null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const hoy = new Date(ahora);
  const mismoDia = d.toDateString() === hoy.toDateString();
  return <time dateTime={d.toISOString()}>{mismoDia ? horaCorta(d) : FECHA.format(d).replace('.', '')}</time>;
}
