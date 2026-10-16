'use client';

// =============================================================================
// /m/inbox — «Avisos», la campana de General: «Para decidir · N | Avisos» (v3)
// =============================================================================
// Referencia visual: docs/prototipos/mako-mobile-tableros.html, `PANTALLAS.avisos` (v3, el
// que aprobó Martín el 14/10/2026). Destila /mako/pendientes, /mako/revisar, /crm/revisar,
// los borradores del plan y la tarjeta del CRM automático: los MISMOS rótulos (inbox-ui.ts,
// `BOTONES_ESCRITORIO` y `DATOS_ESCRITORIO`), menos texto.
//
// Apps de referencia:
//   · la lista es la Inbox de GitHub Mobile y de Linear: baldosa de 32 a la izquierda, el
//     título como frase, la hora a la derecha y, si no se leyó, el punto azul en el margen
//     izquierdo (no un color en el texto);
//   · el sheet de una decisión es el de las aprobaciones de Ramp: los datos como filas
//     clave → valor, lo que se va a ejecutar entero, el primario abajo y el «no» como texto.
//
//   [baldosa]  qué, en concreto ...................................  9:40  ›
//              una línea SÓLO si dice algo más (cuánto le queda a una pendiente)
// La estrella dorada va SÓLO si la propuso MaKo (decision-m.ts), dentro de la misma baldosa
// gris que las demás (v3: el dorado es la estrella, no el fondo). Lo que se revisa en la
// computadora (borradores del plan, contactos, acciones con objetos) no compite con lo que
// se aprueba acá: queda plegado en UNA fila gris al final. Avisos (el feed) es sólo del
// admin, como los avisos del negocio en escritorio: sin permiso, no hay segmentado.
//
// Todo lo que se decide pasa por el SheetM de la decisión, nunca por la fila: «una
// aprobación no se da sin abrir» — lo que se va a ejecutar tiene que estar a la vista
// ANTES del botón, y la consecuencia pegada arriba del primario.
//
// ⚠️ LAS ACCIONES SON LAS DE app/m/inbox/acciones.ts (no las de escritorio): esas
// vuelven a mirar rol + capa, rechazan una acción compleja y refrescan /m. Esta
// pantalla no decide permisos: muestra lo que `leerParaDecidir` le dio.
//
// ⚠️ UNA APROBACIÓN NUNCA SE ENCOLA OFFLINE: sin red, los botones se apagan con el
// motivo pegado. Mandarla «cuando vuelva la red» es ejecutar algo que la persona ya
// no está mirando.
//
// ⚠️ `ok:false` DESPUÉS DE EJECUTAR no se reintenta a ciegas: la acción ya quedó
// cerrada con su error (app/m/inbox/acciones.ts). Se muestra el motivo en el sheet.
// Un throw (la request no volvió) deja el botón vivo: no se sabe si llegó, y el
// reclamo del server (`.eq('estado','pendiente')`) hace que un segundo toque sea
// inofensivo.
//
// ⚠️ «ABRIR LA VERSIÓN DE COMPUTADORA» NO ES UN LINK AL PATH DE ESCRITORIO: en un
// teléfono, <DesvioMovil> manda `/plan/revisar/<id>` y `/crm/revisar/<id>` de vuelta a
// /m/inbox (`rutaMovil`), y el botón no haría nada. Escribe la cookie de «Versión de
// computadora» (la misma de More, 12 h) y recién ahí navega.
// =============================================================================

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { MakoStar } from '@/app/_components/MakoBrand';
import { useRouter, useWs } from '@/app/_ui/Link';
import { haptico } from '@/lib/haptico';
import { cookieVistaEscritorio } from '@/lib/movil-dispositivo';
import { conWs } from '@/lib/ws-tab';
import type { Parametro } from '@/lib/api-mako/tipos';
import { rotuloDeParametro } from '@/lib/editor-acciones';
import type { LineaDetalle, OpcionDecision, ResultadoMovil, TipoDecision } from '@/lib/inbox-movil-reglas';
import {
  ErrorM, FilaDatoM, FilaM, IconoM, InterruptorM, ListaM, PieM, PildoraM, SegmentadoM, SheetM, VacioM,
  useConexion, useToastM,
} from '../_ui';
import {
  confirmarPendienteMovil, cancelarPendienteMovil, confirmarAccionMovil, descartarAccionMovil, resolverConfirmacionMovil,
} from './acciones';
import {
  armarPayload, cambioDeEtapa, consecuenciaDe, cuandoCorto, cuandoLargo, DATOS_ESCRITORIO, esEditable, esLineaCorta,
  esMensaje, fraseDeFallas, minutosRestantes, origenCorto, rielDeVence, rotulosDe, segundaDe, toastDeExito,
  valorInicial, yaNoPendiente, type VistaInbox,
} from './inbox-ui';
import type { DecisionM } from './decision-m';

/** Un aviso del feed, ya traducido por el server (ruta MÓVIL o null = sólo lectura). */
export type AvisoM = {
  id: number;
  titulo: string;
  descripcion: string | null;
  ruta: string | null;
  /** El de la sección a la que lleva (decision-m.ts, `iconoDeRuta`). */
  icono: string;
  createdAt: string;
  urgente: boolean;
  /** Posterior a la marca de agua de la persona: el título va en 600 (como un mail sin leer). */
  nuevo: boolean;
};

export function InboxM({
  decisiones, fallas, recortadoCompu = false, avisos, avisosFalla, marcarHasta, conAvisos = true,
  vistaInicial = 'decidir', abrirInicial = null,
}: {
  decisiones: DecisionM[];
  fallas: TipoDecision[];
  /** Alguna bandeja de la computadora llegó a su tope: el número lleva «+». */
  recortadoCompu?: boolean;
  avisos: AvisoM[];
  /** true = no se pudo leer el feed (no es lo mismo que «no hay avisos»). */
  avisosFalla: boolean;
  /** El createdAt del aviso más nuevo, si es posterior a la marca de agua: se marca al mirar Avisos. */
  marcarHasta: string | null;
  /** false = el rol no ve los avisos del negocio (son de admin, como en escritorio): sin segmentado. */
  conAvisos?: boolean;
  vistaInicial?: VistaInbox;
  /** La `key` de una decisión para abrir su sheet al entrar (`?abrir=`). */
  abrirInicial?: string | null;
}) {
  const toast = useToastM();
  const [vista, setVista] = useState<VistaInbox>(conAvisos ? vistaInicial : 'decidir');
  const [abierta, setAbierta] = useState<string | null>(null);
  // Lo que ya se resolvió en esta pantalla sale de la lista sin esperar al refresh.
  const [resueltos, setResueltos] = useState<ReadonlySet<string>>(new Set());
  const ahora = useAhora();

  const visibles = useMemo(() => decisiones.filter((i) => !resueltos.has(i.key)), [decisiones, resueltos]);
  const enTelefono = useMemo(() => visibles.filter((i) => i.enTelefono), [visibles]);
  const enCompu = useMemo(() => visibles.filter((i) => !i.enTelefono), [visibles]);
  const sel = visibles.find((i) => i.key === abierta) ?? null;
  const falla = fraseDeFallas(fallas);

  // `?abrir=<key>`: entra con esa decisión abierta. El parámetro se saca de la URL antes
  // de que el sheet ponga el suyo, para que «atrás» no la vuelva a abrir.
  const abrioInicial = useRef(false);
  useEffect(() => {
    if (abrioInicial.current || !abrirInicial) return;
    abrioInicial.current = true;
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete('abrir');
      window.history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch { /* sin URL no hay nada que limpiar */ }
    if (decisiones.some((i) => i.key === abrirInicial)) setAbierta(abrirInicial);
  }, [abrirInicial, decisiones]);

  // Marca de agua del feed: lo que se MIRA en Avisos queda visto. Una vez.
  const marcado = useRef(false);
  useEffect(() => {
    if (vista !== 'avisos' || !marcarHasta || marcado.current) return;
    marcado.current = true;
    fetch('/api/notificaciones', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'visto', hasta: marcarHasta }),
    }).catch(() => { /* sin red: se marca la próxima vez que mire */ });
  }, [vista, marcarHasta]);

  const sacar = (key: string) => setResueltos((s) => new Set(s).add(key));

  return (
    <>
      {conAvisos && (
        <div className="m-inbox-seg">
          <SegmentadoM<VistaInbox>
            etiqueta="Vista"
            valor={vista}
            onCambio={setVista}
            opciones={[
              { id: 'decidir', label: 'Para decidir', n: enTelefono.length },
              { id: 'avisos', label: 'Avisos' },
            ]}
          />
        </div>
      )}

      <div className={conAvisos ? 'm-inbox-cuerpo' : 'm-inbox-cuerpo m-inbox-cuerpo--solo'}>
        {vista === 'decidir' ? (
          <>
            {falla && <ErrorM frase={falla} />}
            {enTelefono.length > 0 ? (
              <ListaM etiqueta="Para decidir">
                {enTelefono.map((it) => (
                  <FilaDecision key={it.key} item={it} ahora={ahora} onAbrir={() => setAbierta(it.key)} />
                ))}
              </ListaM>
            ) : !falla ? (
              <VacioM frase="Nada para decidir." />
            ) : null}
            {enCompu.length > 0 && (
              <PlegadoCompu items={enCompu} recortado={recortadoCompu} ahora={ahora} onAbrir={(k) => setAbierta(k)} />
            )}
          </>
        ) : avisosFalla ? (
          <ErrorM frase="No pudimos leer los avisos. No es nada tuyo." />
        ) : avisos.length ? (
          <ListaM etiqueta="Avisos">
            {avisos.map((a) => (
              <FilaM
                key={a.id}
                leading={<Baldosa icono={a.icono} nuevo={a.nuevo} />}
                titulo={a.titulo}
                navegacion={!a.nuevo}
                segunda={a.descripcion ?? undefined}
                pill={a.urgente ? <PildoraM tono="bad">Urgente</PildoraM> : undefined}
                riel={<Cuando iso={a.createdAt} ahora={ahora} />}
                href={a.ruta ?? undefined}
              />
            ))}
          </ListaM>
        ) : (
          <VacioM frase="Sin avisos todavía." />
        )}
      </div>

      <SheetDecision
        item={sel}
        ahora={ahora}
        onCerrar={() => setAbierta(null)}
        onResuelto={(it, salida, resumen, decision) => {
          haptico('success');
          toast(resumen && resumen.length <= 28 ? resumen : toastDeExito(it.tipo, salida, decision));
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

/**
 * A la izquierda, la baldosa de 32 de toda fila de /m (`.m-icono`, la de More): la estrella
 * dorada si la propuso MaKo (MakoStar ya se anuncia «MaKo»), si no el ícono de su sección.
 * `nuevo` = un aviso que la persona no vio: el punto azul en el margen izquierdo de la fila,
 * como un no leído de GitHub Mobile o Linear.
 */
function Baldosa({ icono, mako = false, nuevo = false }: { icono: string; mako?: boolean; nuevo?: boolean }) {
  const baldosa = mako
    ? <span className="m-icono"><MakoStar size={18} animate={false} /></span>
    : <IconoM nombre={icono} />;
  if (!nuevo) return baldosa;
  return (
    <span className="m-inbox-lead">
      <span className="m-inbox-nuevo" role="img" aria-label="Nuevo" />
      {baldosa}
    </span>
  );
}

function FilaDecision({ item, ahora, onAbrir }: { item: DecisionM; ahora: number | null; onAbrir: () => void }) {
  const min = ahora != null ? minutosRestantes(item.venceAt, ahora) : null;
  return (
    <FilaM
      leading={<Baldosa icono={item.icono} mako={item.deMako} />}
      titulo={item.titulo}
      segunda={segundaDe(item, min) ?? undefined}
      riel={<Cuando iso={item.creadaAt} ahora={ahora} />}
      onClick={onAbrir}
    />
  );
}

/**
 * Lo que se revisa en la computadora: UNA fila gris al final («12 para revisar · En la
 * computadora»). Tocarla despliega las filas, y cada una abre su sheet (que dice qué es
 * y ofrece la versión de computadora). En el ws 9 eran 68 filas que el teléfono no puede
 * resolver (medido el 11/10/2026): sueltas, tapaban lo que sí se aprueba acá.
 */
function PlegadoCompu({ items, recortado, ahora, onAbrir }: {
  items: DecisionM[];
  recortado: boolean;
  ahora: number | null;
  onAbrir: (key: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const n = `${items.length}${recortado ? '+' : ''}`;
  return (
    <>
      <div className="m-lista m-lista--compu">
        <div className="m-fila-envoltorio">
          <button
            type="button"
            className="m-fila m-fila--toca m-fila--compu m-inbox-compu"
            aria-expanded={abierto}
            aria-controls={abierto ? 'm-inbox-compu-lista' : undefined}
            onClick={() => { haptico('light'); setAbierto((v) => !v); }}
          >
            <span className="m-fila__lead"><IconoM nombre="computadora" /></span>
            <span className="m-fila__txt">
              <span className="m-fila__t m-fila__t--nav">{n} para revisar</span>
              <span className="m-fila__c">En la computadora</span>
            </span>
            <span className="m-fila__ir" aria-hidden><Icon name="chevron" size={18} /></span>
          </button>
        </div>
      </div>
      {abierto && (
        <div id="m-inbox-compu-lista" className="m-inbox-compu__lista">
          <ListaM etiqueta="Para revisar en la computadora">
            {items.map((it) => (
              <FilaDecision key={it.key} item={it} ahora={ahora} onAbrir={() => onAbrir(it.key)} />
            ))}
          </ListaM>
        </div>
      )}
    </>
  );
}

// ── El sheet de la decisión ──────────────────────────────────────────────────

/** La opción que «dice que no» va como texto (la salida), no como botón rojo. */
const varianteDe = (op: OpcionDecision): 'primary' | 'secondary' | 'tertiary' =>
  op.tono === 'primary' ? 'primary' : op.tono === 'danger' ? 'tertiary' : 'secondary';

function SheetDecision({ item, ahora, onCerrar, onResuelto, onYaNo }: {
  item: DecisionM | null;
  ahora: number | null;
  onCerrar: () => void;
  onResuelto: (it: DecisionM, salida: boolean, resumen?: string, decision?: string) => void;
  onYaNo: (it: DecisionM) => void;
}) {
  const { enLinea } = useConexion();
  const router = useRouter();
  const ws = useWs();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ediciones, setEdiciones] = useState<Record<string, string | boolean>>({});
  // El último ítem abierto se conserva mientras el sheet se va (cierra en 220 ms).
  const ultimo = useRef<DecisionM | null>(null);
  if (item) ultimo.current = item;
  const it = item ?? ultimo.current;

  // Abrir otro ítem arranca limpio.
  const clave = item?.key ?? null;
  useEffect(() => { setError(null); setEdiciones({}); setEnviando(null); }, [clave]);

  if (!it) return <SheetM abierto={false} onCerrar={onCerrar} titulo="" id="decision" />;

  const min = ahora != null ? minutosRestantes(it.venceAt, ahora) : null;
  const vencida = min != null && min < 0;
  const rot = rotulosDe(it);
  const editables = it.tipo === 'accion' && it.accionMovil === 'confirmar-accion' ? it.parametros.filter(esEditable) : [];
  // Lo que se edita no se repite en lectura.
  const editNombres = new Set(editables.map((p) => rotuloDeParametro(p)));
  const lineas = it.detalle.filter((l) => !editNombres.has(l.rotulo));
  const etapa = it.tipo === 'confirmacion' ? cambioDeEtapa(lineas) : null;
  const restoLineas = etapa ? lineas.filter((l) => l !== etapa.linea) : lineas;

  /** Corre una acción del server y traduce el resultado a lo que ve la persona. */
  const correr = async (cual: string, salida: boolean, fn: () => Promise<ResultadoMovil>, decision?: string) => {
    if (enviando) return;
    if (!enLinea) { setError('Sin conexión: no se envió.'); return; }
    setEnviando(cual);
    setError(null);
    try {
      const r = await fn();
      if (r.ok) { onResuelto(it, salida, r.resumen, decision); return; }
      if (yaNoPendiente(r.error)) { onYaNo(it); return; }
      haptico('error');
      setError(`MaKo no pudo: ${r.error ?? 'error sin detalle'}`);
    } catch {
      haptico('error');
      setError('No llegó al servidor. Revisa la red y vuelve a intentar.');
    } finally {
      setEnviando(null);
    }
  };

  const confirmar = () => {
    if (it.tipo === 'pendiente') return correr('primario', false, () => confirmarPendienteMovil(it.id));
    if (it.tipo === 'accion' && it.accionMovil === 'confirmar-accion') {
      const p = armarPayload(it.parametros, it.payload, ediciones);
      if (!p.ok) { setError(p.error); return; }
      return correr('primario', false, () => confirmarAccionMovil(it.id, p.payload));
    }
  };
  const salir = () => {
    if (it.tipo === 'pendiente') return correr('salida', true, () => cancelarPendienteMovil(it.id));
    if (it.tipo === 'accion') return correr('salida', true, () => descartarAccionMovil(it.id));
  };
  const resolver = (op: OpcionDecision) => {
    if (it.tipo !== 'confirmacion') return;
    return correr(op.decision, op.decision === 'rechazar', () => resolverConfirmacionMovil(it.id, op.decision), op.decision);
  };
  const abrirEnCompu = () => {
    document.cookie = cookieVistaEscritorio();
    window.location.href = conWs(it.linkEscritorio, ws);
  };
  const irAFicha = (href: string) => { onCerrar(); router.push(href); };

  // ── El cuerpo: TODO lo que se va a ejecutar, y después de dónde vino ──
  const datos: ReactNode[] = [];
  if (it.tipo === 'confirmacion') {
    const ficha = it.ficha;
    datos.push(<FilaDatoM key="lead" k="Lead" v={it.resumen} azul={!!ficha} onClick={ficha ? () => irAFicha(ficha) : undefined} />);
  } else if ((it.tipo === 'pendiente' || it.tipo === 'accion') && it.resumen && it.resumen !== it.titulo) {
    // La operación salió de la fila (v3): acá se dice, con el rótulo de escritorio.
    datos.push(<FilaDatoM key="op" k={DATOS_ESCRITORIO.operacion} v={it.resumen} />);
  }
  if (it.tipo === 'pendiente' && min != null) {
    datos.push(<FilaDatoM key="vence" k={DATOS_ESCRITORIO.vence} v={vencida ? 'Vencida' : `En ${rielDeVence(min)}`} />);
  }
  datos.push(<FilaDatoM key="origen" k={DATOS_ESCRITORIO.origen} v={origenCorto(it.origen)} />);
  const cuando = ahora != null ? cuandoLargo(it.creadaAt, ahora) : null;
  // Una pendiente ya dice cuándo vence (2 h después de propuesta): la hora de propuesta sobra.
  // Un cambio del CRM no es una propuesta (MaKo ya lo hizo, o espera que se elija): «Cuándo».
  if (cuando && it.tipo !== 'pendiente') {
    datos.push(<FilaDatoM key="cuando" k={it.tipo === 'confirmacion' ? 'Cuándo' : DATOS_ESCRITORIO.propuesta} v={cuando} />);
  }

  // ── El pie: el motivo si algo falló, la consecuencia en tinta, y los botones ──
  const aviso = error
    ? <p className="m-inbox-aviso m-inbox-aviso--error" role="alert">{error}</p>
    : !enLinea && it.accionMovil !== 'computadora'
      ? <p className="m-inbox-aviso" role="status">Sin conexión: no se puede aprobar.</p>
      : null;

  let botones: ReactNode;
  if (it.accionMovil === 'computadora') {
    botones = (
      <Button variant="secondary" size="lg" full icon={<Icon name="computadora" size={20} />} onClick={abrirEnCompu}>
        Abrir la versión de computadora
      </Button>
    );
  } else if (it.tipo === 'confirmacion') {
    botones = it.opciones.map((op) => (
      <Button
        key={op.decision}
        variant={varianteDe(op)}
        size="lg"
        full
        loading={enviando === op.decision}
        disabled={!enLinea || (enviando != null && enviando !== op.decision)}
        onClick={() => { void resolver(op); }}
      >
        {op.label}
      </Button>
    ));
  } else {
    botones = (
      <>
        {!vencida && rot.primario && (
          <Button variant="primary" size="lg" full loading={enviando === 'primario'}
            disabled={!enLinea || enviando === 'salida'} onClick={() => { void confirmar(); }}>
            {rot.primario}
          </Button>
        )}
        {rot.salida && (
          <Button variant="tertiary" size="lg" full loading={enviando === 'salida'}
            disabled={!enLinea || enviando === 'primario'} onClick={() => { void salir(); }}>
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
      rotuloCerrar="Cerrar la decisión"
      pie={<>{aviso}<PieM consecuencia={consecuenciaDe(it, vencida)}>{botones}</PieM></>}
    >
      <div className="m-inbox-sheet">
        {etapa && (
          <div className="m-inbox-cambio" aria-label={`${etapa.antes} a ${etapa.despues}`}>
            <span>{etapa.antes}</span>
            <Icon name="chevron" size={18} />
            <span>{etapa.despues}</span>
          </div>
        )}

        {/* Un borrador o un lote de contactos: el resumen («4 tareas · 2 para cerrar») y, debajo,
            UNA fila por tarea o por contacto (lib/inbox-movil-reglas.ts → detalleDeBorrador /
            detalleDeLeads), como el prototipo. El rótulo («Tarea») no se repite en cada fila. */}
        {(it.tipo === 'lead' || it.tipo === 'borrador') && it.resumen && (
          <ListaM><FilaM titulo={it.resumen} navegacion /></ListaM>
        )}
        {(it.tipo === 'lead' || it.tipo === 'borrador') && restoLineas.length > 0 && (
          <ListaM etiqueta={it.tipo === 'borrador' ? 'Tareas' : 'Contactos'}>
            {restoLineas.map((l, i) => <FilaM key={`${l.valor}-${i}`} titulo={l.valor} />)}
          </ListaM>
        )}

        {editables.length > 0 && it.tipo === 'accion' && (
          <CamposEditables
            parametros={editables}
            guardado={it.payload ?? {}}
            ediciones={ediciones}
            onCambio={(n, v) => setEdiciones((e) => ({ ...e, [n]: v }))}
            deshabilitado={enviando != null}
          />
        )}

        {restoLineas.length > 0 && it.tipo !== 'lead' && it.tipo !== 'borrador' && (
          <ListaM etiqueta="Lo que se va a ejecutar">
            {restoLineas.map((l, i) => <LineaM key={`${l.rotulo}-${i}`} linea={l} />)}
          </ListaM>
        )}

        <ListaM>{datos}</ListaM>
      </div>
    </SheetM>
  );
}

/** Una línea de lo que se ejecuta: corta a la derecha de su rótulo; larga, debajo (un mensaje, en burbuja). */
function LineaM({ linea }: { linea: LineaDetalle }) {
  if (esLineaCorta(linea.valor)) return <FilaDatoM k={linea.rotulo} v={linea.valor} />;
  return (
    <div className="m-fila-envoltorio">
      <div className="m-fila m-inbox-linea">
        <span className="m-fila__txt">
          <span className="m-inbox-linea__k">{linea.rotulo}</span>
          <span className={esMensaje(linea.rotulo) ? 'm-inbox-linea__v m-inbox-burbuja' : 'm-inbox-linea__v'}>{linea.valor}</span>
        </span>
      </div>
    </div>
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
  const valor = (p: Parametro) => (p.nombre in ediciones ? ediciones[p.nombre] : valorInicial(p, guardado[p.nombre]));
  const sino = parametros.filter((p) => p.tipo === 'boolean');
  const campos = parametros.filter((p) => p.tipo !== 'boolean');
  return (
    <>
      {campos.length > 0 && (
        <div className="m-inbox-campos">
          {campos.map((p) => {
            const v = valor(p);
            const rotulo = rotuloDeParametro(p);
            const id = `m-inbox-campo-${p.nombre}`;
            if (p.enum?.length) {
              return (
                <label key={p.nombre} className="m-inbox-campo" htmlFor={id}>
                  <span className="m-inbox-campo__rot">{rotulo}</span>
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
              <label key={p.nombre} className="m-inbox-campo" htmlFor={id}>
                <span className="m-inbox-campo__rot">{rotulo}</span>
                {largo ? (
                  <textarea id={id} className="mk-input m-inbox-area" value={String(v)} disabled={deshabilitado}
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
      )}
      {sino.length > 0 && (
        <ListaM>
          {sino.map((p) => {
            const rotulo = rotuloDeParametro(p);
            return (
              <FilaM
                key={p.nombre}
                titulo={rotulo}
                navegacion
                control={<InterruptorM etiqueta={rotulo} activo={valor(p) === true} deshabilitado={deshabilitado} onCambio={(b) => onCambio(p.nombre, b)} />}
              />
            );
          })}
        </ListaM>
      )}
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

/** «9:40», «ayer», «lun», «12 oct». Nada hasta montar (evita el desfase de hidratación). */
function Cuando({ iso, ahora }: { iso: string | null | undefined; ahora: number | null }) {
  if (ahora == null || !iso) return null;
  const txt = cuandoCorto(iso, ahora);
  if (!txt) return null;
  return <time dateTime={new Date(iso).toISOString()}>{txt}</time>;
}
