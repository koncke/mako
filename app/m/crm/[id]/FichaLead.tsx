'use client';

// =============================================================================
// La ficha del lead en el teléfono (v2): lo que se TOCA y lo que se lee debajo del nombre
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, data-ir="ficha". El encabezado (avatar, nombre,
// etapa y funnel) lo dibuja el server en page.tsx; aquí va el resto, porque las filas abren sheets:
//
//   Llamar · WhatsApp · Agendar · Nota   la fila de acciones (HubSpot, 17/10/2026)
//   La etapa ›                           la barra de avance (Pipedrive, 17/10/2026): abre «Mover de etapa»
//   Datos                                las piezas de la ficha
//   Notas                                las últimas + «Nota por voz»
//   Actividad                            las últimas 4 líneas del historial (fija: es el Historial)
//   Pagos, historial y campos · En la computadora
//
// ⚠️ DESDE EL 15/10/2026 LAS PIEZAS SIGUEN A LA FICHA DEL FUNNEL DEL LEAD (`piezas`, ../ficha-bloques.ts):
// Próxima llamada, Teléfono · Email · Empresa (el contacto), Lo que contestó ›, Llegó por, Notas y
// Última llamada › van en el orden en que el admin puso sus bloques en «Personalizar», y las que el funnel
// no tiene no salen. Las filas seguidas van en una lista; las notas, en su sección. Sin editor aquí.
//
// REDISEÑO DEL 17/10/2026 (Martín: «rediseña las actuales de CRM… copia de otras apps que ya lo hacen bien»; se
// miraron las capturas de la App Store de HubSpot y Pipedrive en el teléfono):
//   · LAS ACCIONES son la fila de HubSpot debajo del nombre: un círculo con su ícono y el rótulo abajo (Call · Email
//     · Text · More allá; Llamar · WhatsApp · Agendar · Nota acá). «Nota» abre la hoja para escribir, como el
//     «Add note» de HubSpot; «Nota por voz» sigue en la sección Notas, arrancando el dictado en el mismo toque.
//   · LA ETAPA es la barra de la ficha del deal de Pipedrive («‹ Contact Made / Sales pipeline ›» con una rayita por
//     etapa, llenas hasta la actual): el nombre de la etapa, el funnel debajo, y tocarla abre «Mover de etapa». No
//     se copian las flechas ‹ › de Pipedrive (saltar a la de al lado): desde el teléfono no se puede ir a cualquiera
//     (Ganado, cobros y las del wizard son de la computadora, ../reglas.ts), y la hoja ya dice a cuáles sí.
//     Reemplaza la fila «Etapa ›» que encabezaba «Datos».
//   · Tampoco Won/Lost: Ganado no se mueve desde el teléfono.
//
// ⚠️ AGENDAR NO PASA POR IA: las horas libres las lee /api/crm/horarios por código y se agenda
// con reagendarReunionAction (Google) o con la reserva de Calendly, que casi siempre devuelve un
// LINK de un solo uso para mandarle al lead. Cuál de los caminos lo decide el server
// (`modoAgenda`). La página que monta esto declara maxDuration = 60: reagendar tarda hasta ~28 s.
//
// ⚠️ MOVER NUNCA MANDA calificado NI asistencia (van a Meta y no se deshacen), ni a Ganado, ni a
// una etapa que pide el wizard: eso es «en la computadora». La regla vive en reglas.ts y la
// acción la vuelve a mirar en el server. Mover es como arrastrar la tarjeta en el tablero de
// escritorio: se mueve al tocar, y el toast trae «Deshacer» (undoStageMoveAction).
//
// ⚠️ «NOTA POR VOZ» ARRANCA EL DICTADO EN EL MISMO TOQUE: Safari sólo deja usar el micrófono
// desde un gesto de la persona, así que el dictado vive aquí (no adentro del sheet, que lo
// arrancaría desde un efecto) y el sheet muestra el texto mientras se habla, para revisarlo
// antes de guardar.
// =============================================================================

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { Icon } from '@/app/_components/icons';
import {
  ComputadoraM, FilaDatoM, FilaM, IconoM, ListaM, SeccionM, SheetM, PieM, SkeletonFilas, useToastM, useConexion,
} from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { PanelGrabar } from '@/app/_components/grabar/GrabarLlamada';
// «WhatsApp» abre la conversación del lead en Chats (todos sus canales), con la MISMA función que escritorio
// (17/10/2026; antes iba al hilo de sólo WhatsApp, /m/crm/<id>/chat, que sigue existiendo).
import { rutaChatsDeLead } from '@/lib/chats-links';
import { useDictadoVivo, unirDictado } from '@/app/plan/board/dictado-vivo';
import { duracionReunionAction, linkDeAgendaAction, reagendarReunionAction } from '@/app/crm/actions';
import { huecosR2Action, reservarR2Action } from '@/app/crm/agendar-r2-actions';
import { linkInstagram } from '@/app/crm/campo-inline';
import { notaLeadAction, moverEtapaAction, deshacerMoverAction } from '../acciones';
import { chipsDeDia, rotuloAgendar, rotuloDia, type CualAgendar, type EtapaM, type LineaActividad } from '../reglas';
import { gruposDeLaFicha, type PiezaFicha, type ResumenTelefono, type SaldoTelefono } from '../ficha-bloques';

export type ProductoFicha = { funnelId: number; nombre: string; esCasa: boolean; etapa: string | null; etapaLabel: string | null; movibles: EtapaM[] };
export type ModoAgendaFicha = 'google' | 'calendly-r2' | 'link' | 'nada';
export type LlamadaFicha = { cuando: string | null; resultado: string | null; resumen: string | null; abiertas: string[]; resueltas: number; proximoPaso: string | null };

export type FichaLeadProps = {
  id: number;
  nombre: string;
  email: string | null;
  empresa: string | null;
  /** `tel:` listo, o null si el número no alcanza. */
  tel: string | null;
  /** El teléfono para leer («+5215512345678»). */
  telefono: string | null;
  waMe: string | null;
  tieneChat: boolean;
  agenda: CualAgendar;
  modoAgenda: ModoAgendaFicha;
  hoy: string;
  productos: ProductoFicha[];
  proxima: string | null;
  llegoPor: string | null;
  notas: Array<{ id: number; texto: string; cuando: string; autor: string }>;
  /** Cuántas notas hay en total (puede ser más que las que viajan). */
  totalNotas: number;
  actividad: Array<LineaActividad & { id: number; riel: string }>;
  llamada: LlamadaFicha | null;
  respuestas: Array<{ pregunta: string; respuesta: string }>;
  /**
   * Lo que va debajo de los tres botones, EN ORDEN: la ficha del funnel del lead destilada a lo que tiene
   * versión de teléfono, sin lo que se calla vacío (../ficha-bloques.ts). Lo arma el server.
   */
  piezas: PiezaFicha[];
  /** El estado de cuenta en una fila (la pieza `saldo`, de Pagos). */
  saldo?: SaldoTelefono | null;
  /** El de cada CRM agregado con plata (una renovación, CO2): una fila más, con el nombre del CRM. */
  saldosCrm?: Array<{ crm: string; saldo: SaldoTelefono }>;
  /** Las filas del Resumen nativo (16/10/2026, `resumenDelTelefono`): una en null no se dibuja. */
  resumen?: ResumenTelefono | null;
  /** El color del punto de la fila «Automatización» (24/10/2026, `tonoDeAutomatizaciones`). */
  autTono?: string | null;
  /** La barra de avance de la etapa (17/10/2026, `progresoEnFunnel`): cuántas etapas y hasta cuál llegó. */
  progreso?: { total: number; hasta: number | null } | null;
  /** El @ (sin la @) cuando es su ÚNICO canal (23/10/2026, `soloInstagram`): sin Llamar ni WhatsApp apagados, con «Instagram». */
  soloInstagram?: string | null;
};

/** El rótulo de cada fila del Resumen nativo: el mismo nombre corto que su bloque de escritorio. */
const ROTULO_RESUMEN: Readonly<Record<string, string>> = {
  siguiente: 'Siguiente', equipo: 'Setter · Closer', calificado: 'Calificación', ingreso: 'Ingreso estimado',
  'en-etapa': 'En la etapa', motivo: 'Motivo de salida', plazo: 'Nutrición manual', redes: 'Redes', pagina: 'Se registró en',
  entrada: 'Entró', direccion: 'Dirección', sexo: 'Sexo', automatizaciones: 'Automatización',
};

type Sheet = 'agendar' | 'nota' | 'notas' | 'mover' | 'llamada' | 'respuestas' | 'grabar' | null;

/** Cuántas notas se ven en la ficha; las demás (hasta 20) abren en un sheet. */
const NOTAS_A_LA_VISTA = 3;

function Nota({ n }: { n: { texto: string; cuando: string; autor: string } }) {
  return (
    <div className="m-crm-nota">
      <p className="m-crm-nota__txt">{n.texto}</p>
      <span className="m-crm-nota__meta">{[n.cuando, n.autor].filter(Boolean).join(' · ')}</span>
    </div>
  );
}

export function FichaLead(p: FichaLeadProps) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [sheet, setSheet] = useState<Sheet>(null);
  const casa = p.productos.find((x) => x.esCasa) ?? p.productos[0] ?? null;
  const primerNombre = p.nombre.split(' ')[0];

  // El texto de la nota y el dictado viven AQUÍ (ver la cabecera: el dictado arranca en el toque).
  const [nota, setNota] = useState('');
  const [errorNota, setErrorNota] = useState<string | null>(null);
  const base = useRef('');
  const vivo = useDictadoVivo((t) => setNota(unirDictado(base.current, t)), (m) => setErrorNota(m));

  const notaPorVoz = () => {
    if (!enLinea) { toast('Sin conexión'); return; }
    setErrorNota(null);
    setSheet('nota');
    if (vivo.soportado && !vivo.escuchando) {
      base.current = nota;
      haptico('medium');
      vivo.arrancar();
    }
  };

  /** «Nota» de la fila de acciones: la hoja para ESCRIBIR (el «Add note» de HubSpot), sin arrancar el micrófono. */
  const abrirNota = () => {
    if (!enLinea) { toast('Sin conexión'); return; }
    setErrorNota(null);
    setSheet('nota');
  };

  const puedeWa = p.tieneChat || !!p.waMe;
  const otros = p.productos.length - 1;
  // Su único canal es el @ (sin email ni teléfono). El link se arma en campo-inline (`linkInstagram`): un usuario que no lo es (un
  // nombre con espacios guardado a mano) no tiene link, y entonces no se dibuja el botón en vez de dibujar uno que no lleva a nada.
  const igHref = p.soloInstagram ? linkInstagram(p.soloInstagram) : null;
  // Agendar, Nota y Grabar (04/11/2026) siempre; Llamar y WhatsApp, o Instagram si es su único canal.
  const nAcciones = 3 + (p.soloInstagram ? (igHref ? 1 : 0) : 2);

  // La versión de teléfono de cada bloque de escritorio (../ficha-bloques.ts, PIEZA_DE_BLOQUE). Las que se
  // callan sin datos ya vienen filtradas del server; el `&&` de aquí es el cinturón.
  const filaDe = (pz: PiezaFicha): ReactNode => {
    switch (pz) {
      case 'proxima': return <FilaDatoM k="Próxima llamada" v={p.proxima ?? 'Sin agendar'} />;
      case 'contacto': return (
        <>
          {/* Con el @ como único canal la fila dice ESE canal, no «Sin teléfono» (Martín, 22/10/2026: «si no tiene ese dato, que no lo muestre»). */}
          {p.soloInstagram ? <FilaDatoM k="Instagram" v={`@${p.soloInstagram}`} /> : <FilaDatoM k="Teléfono" v={p.telefono ?? 'Sin teléfono'} />}
          {p.email && <FilaDatoM k="Email" v={p.email} />}
          {p.empresa && <FilaDatoM k="Empresa" v={p.empresa} />}
        </>
      );
      case 'llego-por': return p.llegoPor && <FilaDatoM k="Llegó por" v={p.llegoPor} />;
      // El estado de cuenta: lo que debe en rojo, como en escritorio. El teléfono no cobra (destila).
      case 'saldo': {
        const tono = (t: SaldoTelefono['tono']) => (t === 'rojo' ? 'var(--bad)' : t === 'ambar' ? 'var(--warn)' : undefined);
        return (
          <>
            {p.saldo && <FilaDatoM k="Estado de cuenta" v={<span style={{ color: tono(p.saldo.tono) }}>{p.saldo.texto}</span>} />}
            {(p.saldosCrm ?? []).map((x) => <FilaDatoM key={x.crm} k={`Estado de cuenta · ${x.crm}`} v={<span style={{ color: tono(x.saldo.tono) }}>{x.saldo.texto}</span>} />)}
          </>
        );
      }
      case 'contesto': return p.respuestas.length > 0 && (
        <FilaM icono="notepencil" navegacion titulo="Lo que contestó al agendar" riel={String(p.respuestas.length)} onClick={() => setSheet('respuestas')} />
      );
      case 'llamada': return p.llamada && (
        <FilaM
          icono="closing"
          navegacion
          titulo="Última llamada"
          segunda={[p.llamada.cuando, p.llamada.resultado].filter(Boolean).join(' · ') || undefined}
          onClick={() => setSheet('llamada')}
        />
      );
      case 'notas': return null;
      // El Resumen nativo: una fila que se lee. La siguiente acción y el plazo vencido, en el color de escritorio.
      // «Automatización» (24/10/2026): con un punto del color de su estado, el del sello de la tarjeta de escritorio.
      case 'automatizaciones': {
        const v = p.resumen?.automatizaciones;
        if (!v) return null;
        return <FilaDatoM k={ROTULO_RESUMEN.automatizaciones} v={<span className="m-aut"><span className="m-aut__punto" data-tono={p.autTono ?? 'neutral'} aria-hidden />{v}</span>} />;
      }
      default: {
        const v = p.resumen?.[pz];
        if (!v) return null;
        const tono = pz === 'siguiente' || (pz === 'plazo' && v.startsWith('Venció')) ? 'var(--warn)' : undefined;
        return <FilaDatoM k={ROTULO_RESUMEN[pz] ?? pz} v={tono ? <span style={{ color: tono }}>{v}</span> : v} />;
      }
    }
  };

  return (
    <>
      <div className="m-crm-acciones" role="group" aria-label="Acciones" style={{ gridTemplateColumns: `repeat(${nAcciones}, minmax(0, 1fr))` }}>
        {/* ⚠️ CON EL @ COMO ÚNICO CANAL NO HAY LLAMAR NI WHATSAPP, NI APAGADOS (23/10/2026). Un lead que entró sólo con su @ no
            tiene número: los dos botones de abajo se dibujarían grises con un toast de «Sin teléfono», un botón muerto por cada uno.
            En su lugar va el que sí lleva a algún lado, «Instagram» (el mismo que ofrece la fila de la tabla de escritorio donde las
            demás ofrecen WhatsApp), y la fila se reparte entre los que quedan. Un @ que no es un usuario no tiene link: ninguno. */}
        {p.soloInstagram ? (
          igHref && (
            <a className="m-crm-accion" href={igHref} target="_blank" rel="noopener noreferrer" aria-label={`Abrir el Instagram de ${p.nombre}`}>
              <span className="m-crm-accion__c"><Icon name="instagram" size={22} /></span>Instagram
            </a>
          )
        ) : (
          <>
            {p.tel ? (
              <a className="m-crm-accion" href={p.tel} aria-label={`Llamar a ${p.nombre}`}>
                <span className="m-crm-accion__c"><IconoMenu nombre="telefono" size={22} /></span>Llamar
              </a>
            ) : (
              <button type="button" className="m-crm-accion" aria-disabled="true" aria-label="Llamar: sin teléfono" onClick={() => toast('Sin teléfono')}>
                <span className="m-crm-accion__c"><IconoMenu nombre="telefono" size={22} /></span>Llamar
              </button>
            )}
            {puedeWa ? (
              <Link className="m-crm-accion" href={rutaChatsDeLead(p.id)} aria-label={`WhatsApp con ${p.nombre}`}>
                <span className="m-crm-accion__c"><IconoMenu nombre="whatsapp" size={22} /></span>WhatsApp
              </Link>
            ) : (
              <button type="button" className="m-crm-accion" aria-disabled="true" aria-label="WhatsApp: sin número" onClick={() => toast('Sin número de WhatsApp')}>
                <span className="m-crm-accion__c"><IconoMenu nombre="whatsapp" size={22} /></span>WhatsApp
              </button>
            )}
          </>
        )}
        {/* «Grabar» (04/11/2026, pedido de Martín): el mismo panel que la ficha de escritorio, en una hoja. Una llamada de ESTE
            teléfono no se graba (lo dice el panel): sirve para una llamada en altavoz desde otro aparato o una charla en persona. */}
        <button type="button" className="m-crm-accion" onClick={() => setSheet('grabar')} aria-label={`Grabar la llamada con ${p.nombre}`}>
          <span className="m-crm-accion__c"><IconoMenu nombre="grabar" size={22} /></span>Grabar
        </button>
        <button type="button" className="m-crm-accion" onClick={() => setSheet('agendar')} aria-label={`${p.agenda.titulo} con ${p.nombre}`}>
          <span className="m-crm-accion__c"><IconoMenu nombre="calendario" size={22} /></span>Agendar
        </button>
        <button type="button" className="m-crm-accion" onClick={abrirNota} aria-label={`Escribir una nota de ${p.nombre}`}>
          <span className="m-crm-accion__c"><IconoMenu nombre="nota" size={22} /></span>Nota
        </button>
      </div>

      {casa && (
        <button
          type="button"
          className="m-crm-etapa"
          onClick={() => setSheet('mover')}
          aria-label={`Etapa: ${casa.etapaLabel ?? 'Sin etapa'}, en ${casa.nombre}. Mover de etapa`}
        >
          <span className="m-crm-etapa__txt">
            <span className="m-crm-etapa__n">{casa.etapaLabel ?? 'Sin etapa'}</span>
            <span className="m-crm-etapa__f">{casa.nombre}{otros > 0 ? ` +${otros}` : ''}</span>
          </span>
          <span className="m-crm-etapa__ir" aria-hidden><Icon name="chevron" size={18} /></span>
          {p.progreso && p.progreso.total > 1 && (
            <span className="m-crm-etapa__barra" aria-hidden style={{ gridTemplateColumns: `repeat(${p.progreso.total}, minmax(0, 1fr))` }}>
              {Array.from({ length: p.progreso.total }, (_, i) => (
                <i key={i} data-lleno={(p.progreso?.hasta != null && i <= p.progreso.hasta) || undefined} />
              ))}
            </span>
          )}
        </button>
      )}

      {/* ⚠️ LO DE AQUÍ ABAJO SIGUE A LA FICHA DEL FUNNEL (`p.piezas`, ../ficha-bloques.ts): qué piezas y en qué
          orden. La etapa es la barra de arriba (es del encabezado y no se personaliza). */}
      {gruposDeLaFicha(p.piezas).map((g, i) => {
        if (g.tipo === 'notas') {
          return (
            <SeccionM key={`notas-${i}`} titulo="Notas">
              <ListaM>
                {p.notas.slice(0, NOTAS_A_LA_VISTA).map((n) => <Nota key={n.id} n={n} />)}
                {p.notas.length > NOTAS_A_LA_VISTA && (
                  <FilaM titulo="Todas las notas" navegacion riel={String(p.totalNotas)} onClick={() => setSheet('notas')} />
                )}
                <FilaM
                  leading={<IconoM nombre="mic" azul />}
                  titulo={<span className="m-crm-azul">Nota por voz</span>}
                  navegacion
                  chevron={false}
                  onClick={notaPorVoz}
                  etiqueta="Agregar una nota por voz"
                />
              </ListaM>
            </SeccionM>
          );
        }
        const filas = g.piezas.map((pz) => <Fragment key={pz}>{filaDe(pz)}</Fragment>);
        if (!g.piezas.length) return null;
        if (!g.primero) return <div key={`filas-${i}`} className="m-crm-grupo"><ListaM>{filas}</ListaM></div>;
        // La etapa ya no encabeza «Datos»: es la barra de arriba (Pipedrive, 17/10/2026).
        return (
          <SeccionM key={`datos-${i}`} titulo="Datos">
            <ListaM>{filas}</ListaM>
          </SeccionM>
        );
      })}

      {p.actividad.length > 0 && (
        <SeccionM titulo="Actividad">
          <ListaM>
            {p.actividad.map((a) => (
              <FilaM
                key={a.id}
                leading={<span className="m-icono" aria-hidden><IconoMenu nombre={a.icono} size={18} /></span>}
                titulo={a.titulo}
                segunda={a.segunda ?? undefined}
                riel={a.riel || undefined}
                navegacion
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <ComputadoraM que="Pagos, historial y campos" />

      <SheetAgendar {...p} abierto={sheet === 'agendar'} onCerrar={() => setSheet(null)} primerNombre={primerNombre} />
      {/* Cerrar la hoja NO corta la grabación: sigue en la esquina, con su «Cortar» (app/_components/grabar/grabadora.ts). */}
      <SheetM id="grabar" abierto={sheet === 'grabar'} onCerrar={() => setSheet(null)} titulo="Grabar llamada" snap="alto">
        <PanelGrabar leadId={p.id} leadNombre={p.nombre} />
      </SheetM>
      <SheetNota
        id={p.id}
        abierto={sheet === 'nota'}
        onCerrar={() => { if (vivo.escuchando) vivo.parar(); setSheet(null); }}
        texto={nota}
        setTexto={setNota}
        error={errorNota}
        setError={setErrorNota}
        vivo={vivo}
        base={base}
      />
      <SheetMover {...p} abierto={sheet === 'mover'} onCerrar={() => setSheet(null)} onAgendar={() => setSheet('agendar')} />
      {p.llamada && <SheetLlamada llamada={p.llamada} abierto={sheet === 'llamada'} onCerrar={() => setSheet(null)} />}
      {p.notas.length > NOTAS_A_LA_VISTA && (
        <SheetM id="notas" abierto={sheet === 'notas'} onCerrar={() => setSheet(null)} titulo="Notas" snap="alto">
          <ListaM>{p.notas.map((n) => <Nota key={n.id} n={n} />)}</ListaM>
          {p.totalNotas > p.notas.length && <ComputadoraM que="Las notas más viejas" />}
        </SheetM>
      )}
      {p.respuestas.length > 0 && (
        <SheetM id="respuestas" abierto={sheet === 'respuestas'} onCerrar={() => setSheet(null)} titulo="Lo que contestó" snap="alto">
          <dl className="m-crm-dl">
            {p.respuestas.map((r, i) => (<div key={i}><dt>{r.pregunta}</dt><dd>{r.respuesta}</dd></div>))}
          </dl>
        </SheetM>
      )}
    </>
  );
}

// ── Agendar ───────────────────────────────────────────────────────────────────

type Slot = { hora: string; inicioIso: string; libre: boolean };
type Horarios = { fase: 'cargando' } | { fase: 'listo'; slots: Slot[]; verificado: boolean } | { fase: 'error'; error: string };
type Reserva = { fase: 'nada' } | { fase: 'link'; url: string } | { fase: 'guardada-sin-google' };

function GrillaCargando() {
  return <div className="m-crm-slots" aria-label="Cargando horarios">{Array.from({ length: 6 }, (_, i) => <span key={i} className="m-crm-slot-skel" />)}</div>;
}

function SheetAgendar(p: FichaLeadProps & { abierto: boolean; onCerrar: () => void; primerNombre: string }) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const chips = chipsDeDia(p.hoy);
  const [fecha, setFecha] = useState(p.hoy);
  const [otroDia, setOtroDia] = useState(false);
  const [hora, setHora] = useState<string | null>(null);
  const [duracion, setDuracion] = useState<number | null>(null);
  const [horarios, setHorarios] = useState<Horarios>({ fase: 'cargando' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reserva, setReserva] = useState<Reserva>({ fase: 'nada' });
  // Calendly R2: los huecos vienen agrupados por día desde Calendly.
  const [huecos, setHuecos] = useState<{ fase: 'cargando' } | { fase: 'listo'; dias: Array<{ dia: string; horas: Array<{ hora: string; startIso: string }> }> } | { fase: 'error'; error: string }>({ fase: 'cargando' });
  const [linkAgenda, setLinkAgenda] = useState<{ fase: 'cargando' } | { fase: 'listo'; url: string } | { fase: 'error'; error: string }>({ fase: 'cargando' });

  // Al abrir: la duración real de la reunión (Google) o los huecos (Calendly) o el link.
  useEffect(() => {
    if (!p.abierto) return;
    setError(null); setReserva({ fase: 'nada' }); setHora(null);
    if (p.modoAgenda === 'google' && duracion == null) {
      duracionReunionAction(p.id, p.agenda.cual).then(setDuracion).catch(() => setDuracion(45));
    }
    if (p.modoAgenda === 'calendly-r2') {
      setHuecos({ fase: 'cargando' });
      huecosR2Action().then((r) => setHuecos(r.ok ? { fase: 'listo', dias: r.dias } : { fase: 'error', error: 'Calendly no contestó.' }))
        .catch(() => setHuecos({ fase: 'error', error: 'Calendly no contestó.' }));
    }
    if (p.modoAgenda === 'link') {
      setLinkAgenda({ fase: 'cargando' });
      linkDeAgendaAction(p.agenda.cual === 'r1' ? 'agenda' : 'agendaj2')
        .then((r) => setLinkAgenda(r.url ? { fase: 'listo', url: r.url } : { fase: 'error', error: 'Sin link de agenda.' }))
        .catch(() => setLinkAgenda({ fase: 'error', error: 'Sin link de agenda.' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.abierto]);

  // Google: los horarios libres del día elegido, leídos por CÓDIGO.
  useEffect(() => {
    if (!p.abierto || p.modoAgenda !== 'google' || duracion == null) return;
    let vivo = true;
    setHorarios({ fase: 'cargando' }); setHora(null);
    fetch(`/api/crm/horarios?fecha=${fecha}&duracion=${duracion}`, { signal: AbortSignal.timeout(20_000) })
      .then((r) => r.json())
      .then((j: { ok: boolean; codigo?: string; slots?: Slot[]; error?: string }) => {
        if (!vivo) return;
        if (!j.ok) { setHorarios({ fase: 'error', error: 'No pude leer tu agenda.' }); return; }
        const ahora = Date.now();
        setHorarios({ fase: 'listo', slots: (j.slots ?? []).filter((s) => Date.parse(s.inicioIso) > ahora), verificado: j.codigo === 'ok' });
      })
      .catch(() => { if (vivo) setHorarios({ fase: 'error', error: 'No pude leer tu agenda.' }); });
    return () => { vivo = false; };
  }, [p.abierto, p.modoAgenda, fecha, duracion]);

  const agendarGoogle = async () => {
    if (!hora) return;
    setOcupado(true); setError(null);
    try {
      const r = await reagendarReunionAction(p.id, p.agenda.cual, fecha, hora, { duracionMin: duracion ?? undefined });
      if (r.ok) {
        haptico('success');
        toast('Agendada');
        p.onCerrar();
      } else {
        // La fecha del CRM se guardó igual; lo que no salió es la invitación de Google.
        haptico('error');
        setReserva({ fase: 'guardada-sin-google' });
      }
      // reagendarReunionAction termina con revalidatePath: su respuesta ya trae la ficha fresca. Un
      // router.refresh() acá era un SEGUNDO render completo en serie (medido el 14/10/2026). En el
      // catch sí va: si la action tiró, no revalidó nada.
    } catch {
      haptico('error');
      setError('No se pudo agendar. Revisa la ficha antes de reintentar.');
      router.refresh();
    } finally {
      setOcupado(false);
    }
  };

  const reservarCalendly = async (startIso: string) => {
    setOcupado(true); setError(null);
    try {
      const r = await reservarR2Action(p.id, startIso);
      if (!r.ok) { haptico('error'); setError(r.error.slice(0, 120)); return; }
      haptico('success');
      if (r.modo === 'reserva') { toast('Agendada'); p.onCerrar(); router.refresh(); return; }
      setReserva({ fase: 'link', url: r.url });
    } catch {
      haptico('error'); setError('No se pudo reservar.');
    } finally {
      setOcupado(false);
    }
  };

  const verificado = horarios.fase === 'listo' && horarios.verificado;
  const libres = horarios.fase === 'listo' ? horarios.slots.filter((s) => !verificado || s.libre) : [];
  const diasCalendly = huecos.fase === 'listo' ? huecos.dias : [];
  const diaCalendly = diasCalendly.find((d) => d.dia === fecha) ?? diasCalendly[0] ?? null;

  let pie: React.ReactNode = null;
  if (reserva.fase === 'nada' && p.modoAgenda === 'google') {
    pie = (
      <PieM consecuencia={hora ? (p.email ? `Le llega la invitación a ${p.primerNombre}.` : 'Sin email: no le llega invitación.') : undefined}>
        {error && <p className="m-crm-error">{error}</p>}
        <Button variant="primary" size="lg" full loading={ocupado} disabled={!hora || !enLinea} onClick={agendarGoogle}>
          {hora ? rotuloAgendar(p.agenda, fecha, hora) : 'Elige un horario'}
        </Button>
      </PieM>
    );
  } else if (reserva.fase === 'nada' && p.modoAgenda === 'calendly-r2' && hora && diaCalendly) {
    const h = diaCalendly.horas.find((x) => x.hora === hora);
    pie = (
      <PieM consecuencia={`Calendly suele dar un link para que ${p.primerNombre} confirme.`}>
        {error && <p className="m-crm-error">{error}</p>}
        <Button variant="primary" size="lg" full loading={ocupado} disabled={!h || !enLinea} onClick={() => h && reservarCalendly(h.startIso)}>
          {rotuloAgendar(p.agenda, diaCalendly.dia, hora)}
        </Button>
      </PieM>
    );
  }

  return (
    <SheetM id="agendar" abierto={p.abierto} onCerrar={p.onCerrar} titulo={p.agenda.titulo} snap="alto" ocupado={ocupado} pie={pie}>
      {reserva.fase === 'link' ? (
        <CompartirLink url={reserva.url} nombre={p.primerNombre} waMe={p.waMe} />
      ) : reserva.fase === 'guardada-sin-google' ? (
        <p className="m-crm-texto">Quedó en el CRM, pero la invitación de Google no salió. Revísala en la computadora.</p>
      ) : p.modoAgenda === 'google' ? (
        <>
          <p className="m-crm-subt">Día</p>
          <div className="m-crm-chips" role="group" aria-label="Día">
            {chips.map((c) => (
              <button key={c.fecha} type="button" className="m-crm-chip" aria-pressed={!otroDia && fecha === c.fecha}
                onClick={() => { setOtroDia(false); setFecha(c.fecha); }}>{c.rotulo}</button>
            ))}
            {otroDia ? (
              <input type="date" className="m-crm-fecha" aria-label="Otro día" min={p.hoy} value={fecha}
                onChange={(e) => e.target.value && setFecha(e.target.value)} />
            ) : (
              <button type="button" className="m-crm-chip" aria-pressed={false} onClick={() => setOtroDia(true)}>Otro día</button>
            )}
          </div>
          <p className="m-crm-subt">Horarios libres</p>
          {horarios.fase === 'cargando' ? <GrillaCargando />
            : horarios.fase === 'error' ? <p className="m-crm-error">{horarios.error}</p>
            : libres.length === 0 ? <p className="m-crm-texto m-crm-texto--dim">Sin horarios libres el {rotuloDia(fecha)}.</p>
            : (
              <>
                {!verificado && <p className="m-crm-texto m-crm-texto--dim">No pude leer tu agenda: revisa que la hora esté libre.</p>}
                <div className="m-crm-slots" role="group" aria-label="Horario">
                  {libres.map((s) => (
                    <button key={s.inicioIso} type="button" className="m-crm-slot" aria-pressed={hora === s.hora} onClick={() => setHora(s.hora)}>{s.hora}</button>
                  ))}
                </div>
              </>
            )}
        </>
      ) : p.modoAgenda === 'calendly-r2' ? (
        huecos.fase === 'cargando' ? <GrillaCargando />
          : huecos.fase === 'error' ? <p className="m-crm-error">{huecos.error}</p>
          : !diaCalendly ? <p className="m-crm-texto m-crm-texto--dim">Calendly no tiene horarios libres.</p>
          : (
            <>
              <p className="m-crm-subt">Día</p>
              <div className="m-crm-chips" role="group" aria-label="Día">
                {diasCalendly.slice(0, 6).map((d) => (
                  <button key={d.dia} type="button" className="m-crm-chip" aria-pressed={diaCalendly.dia === d.dia}
                    onClick={() => { setFecha(d.dia); setHora(null); }}>{rotuloDia(d.dia)}</button>
                ))}
              </div>
              <p className="m-crm-subt">Horarios libres</p>
              <div className="m-crm-slots" role="group" aria-label="Horario">
                {diaCalendly.horas.map((h) => (
                  <button key={h.startIso} type="button" className="m-crm-slot" aria-pressed={hora === h.hora} onClick={() => setHora(h.hora)}>{h.hora}</button>
                ))}
              </div>
            </>
          )
      ) : p.modoAgenda === 'link' ? (
        linkAgenda.fase === 'cargando' ? <SkeletonFilas filas={2} />
          : linkAgenda.fase === 'error' ? <p className="m-crm-error">{linkAgenda.error}</p>
          : (
            <>
              <p className="m-crm-texto">Mándale tu link de agenda y que elija el horario.</p>
              <CompartirLink url={linkAgenda.url} nombre={p.primerNombre} waMe={p.waMe} />
            </>
          )
      ) : (
        <>
          <p className="m-crm-texto">Este negocio no tiene una agenda conectada.</p>
          <ComputadoraM que="Conectar Google o Calendly" />
        </>
      )}
    </SheetM>
  );
}

function CompartirLink({ url, nombre, waMe }: { url: string; nombre: string; waMe: string | null }) {
  const toast = useToastM();
  const [puedeCompartir, setPuedeCompartir] = useState(false);
  useEffect(() => { setPuedeCompartir(typeof navigator !== 'undefined' && typeof navigator.share === 'function'); }, []);
  const texto = `Hola ${nombre}, aquí puedes elegir el horario: ${url}`;
  return (
    <div className="m-crm-compartir">
      <div className="m-crm-link">{url}</div>
      {puedeCompartir && (
        <Button variant="primary" size="lg" full onClick={() => { navigator.share({ text: texto }).catch(() => {}); }}>
          Compartir el link
        </Button>
      )}
      {waMe && (
        <a className="mk-btn mk-btn--secondary mk-btn--lg mk-btn--full" href={`${waMe}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
          Mandarlo por WhatsApp
        </a>
      )}
      <Button variant="tertiary" size="lg" full onClick={() => {
        navigator.clipboard?.writeText(url).then(() => toast('Link copiado'), () => toast('No se pudo copiar'));
      }}>
        Copiar el link
      </Button>
    </div>
  );
}

// ── Nota ──────────────────────────────────────────────────────────────────────

function SheetNota({ id, abierto, onCerrar, texto, setTexto, error, setError, vivo, base }: {
  id: number;
  abierto: boolean;
  onCerrar: () => void;
  texto: string;
  setTexto: (t: string) => void;
  error: string | null;
  setError: (e: string | null) => void;
  vivo: ReturnType<typeof useDictadoVivo>;
  base: { current: string };
}) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [ocupado, setOcupado] = useState(false);

  const guardar = async () => {
    if (!texto.trim()) return;
    if (vivo.escuchando) vivo.parar();
    setOcupado(true); setError(null);
    try {
      const r = await notaLeadAction(id, texto);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      haptico('success');
      toast('Nota guardada');
      setTexto('');
      onCerrar();
    } catch {
      haptico('error'); setError('No se guardó');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <SheetM id="nota" abierto={abierto} onCerrar={onCerrar} titulo="Nota" snap="alto" ocupado={ocupado}
      pie={(
        <PieM>
          {error && <p className="m-crm-error">{error}</p>}
          <Button variant="primary" size="lg" full loading={ocupado} disabled={!texto.trim() || !enLinea} onClick={guardar}>Guardar nota</Button>
        </PieM>
      )}>
      <textarea className="m-crm-area" aria-label="Texto de la nota" placeholder={vivo.escuchando ? 'Te escucho…' : 'Qué pasó, qué sigue'} value={texto}
        onChange={(e) => setTexto(e.target.value)} maxLength={4000} />
      {vivo.soportado && (
        <div className="m-crm-dictar">
          <Button variant={vivo.escuchando ? 'primary' : 'secondary'} size="lg" full icon={<IconoMenu nombre="audio" size={18} />}
            onClick={() => {
              if (vivo.escuchando) { vivo.parar(); return; }
              base.current = texto;
              haptico('medium');
              vivo.arrancar();
            }}>
            {vivo.escuchando ? 'Parar el dictado' : 'Dictar la nota'}
          </Button>
        </div>
      )}
    </SheetM>
  );
}

// ── Mover de etapa ────────────────────────────────────────────────────────────

function SheetMover(p: FichaLeadProps & { abierto: boolean; onCerrar: () => void; onAgendar: () => void }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [fid, setFid] = useState<number | null>(p.productos[0]?.funnelId ?? null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prod = p.productos.find((x) => x.funnelId === fid) ?? p.productos[0] ?? null;

  useEffect(() => { if (p.abierto) setError(null); }, [p.abierto]);

  const mover = async (destino: EtapaM) => {
    if (!prod || ocupado) return;
    if (!enLinea) { toast('Sin conexión'); return; }
    setOcupado(destino.key); setError(null);
    try {
      const r = await moverEtapaAction(p.id, prod.funnelId, destino.key);
      if (!r.ok) { haptico('error'); setError(r.error); return; }
      const { antes, esCasa, deshacer } = r;
      const funnelId = prod.funnelId;
      haptico('success');
      p.onCerrar();
      // moverEtapaAction llama a refresh(): su respuesta ya trae la ficha fresca (sin un segundo
      // render completo en serie, medido el 14/10/2026).
      if (!r.cambio) { toast(`Ya estaba en ${destino.label}`); return; }
      toast(r.pendientes.length ? 'Movido, faltan datos' : `En ${destino.label}`, {
        deshacer: () => {
          deshacerMoverAction(p.id, funnelId, antes, esCasa, deshacer)
            .then((d) => { toast(d.ok ? 'Deshecho' : d.error); })
            .catch(() => toast('No se pudo deshacer'));
        },
      });
    } catch {
      haptico('error'); setError('No se pudo mover');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <SheetM id="mover" abierto={p.abierto} onCerrar={p.onCerrar} titulo="Mover de etapa" snap="alto" ocupado={!!ocupado}>
      {p.productos.length > 1 && (
        <div className="m-crm-chips m-crm-chips--funnel" role="group" aria-label="Funnel">
          {p.productos.map((x) => (
            <button key={x.funnelId} type="button" className="m-crm-chip" aria-pressed={x.funnelId === prod?.funnelId} onClick={() => setFid(x.funnelId)}>
              {x.nombre}
            </button>
          ))}
        </div>
      )}
      {error && <p className="m-crm-error m-crm-error--arriba">{error}</p>}
      {prod && (
        <ListaM etiqueta="Etapas">
          {prod.etapa && (
            <FilaM
              titulo={prod.etapaLabel ?? prod.etapa}
              navegacion
              riel={<span className="m-crm-check"><IconoMenu nombre="check" size={20} /></span>}
              etiqueta={`${prod.etapaLabel ?? prod.etapa}, etapa actual`}
            />
          )}
          {prod.movibles.map((e) => (
            <FilaM
              key={e.key}
              titulo={e.label}
              navegacion
              chevron={false}
              deshabilitada={!!ocupado && ocupado !== e.key}
              riel={ocupado === e.key ? <span className="mk-spin m-crm-spin" aria-label="Moviendo" /> : undefined}
              onClick={() => mover(e)}
            />
          ))}
        </ListaM>
      )}
      <ListaM>
        <FilaM leading={<span className="m-icono" aria-hidden><IconoMenu nombre="calendario" size={18} /></span>} titulo="Agendar una reunión" navegacion onClick={p.onAgendar} />
      </ListaM>
      <ComputadoraM que="Ganado y etapas con preguntas" />
    </SheetM>
  );
}

// ── Última llamada ────────────────────────────────────────────────────────────

function SheetLlamada({ llamada: l, abierto, onCerrar }: { llamada: LlamadaFicha; abierto: boolean; onCerrar: () => void }) {
  return (
    <SheetM id="llamada" abierto={abierto} onCerrar={onCerrar} titulo="Última llamada" snap="alto">
      <div className="m-crm-llamada">
        {(l.cuando || l.resultado) && <p className="m-crm-llamada__res">{[l.resultado, l.cuando].filter(Boolean).join(' · ')}</p>}
        {l.resumen && <p className="m-crm-texto">{l.resumen}</p>}
        {l.abiertas.length > 0 && (
          <>
            <p className="m-crm-subt">{l.abiertas.length === 1 ? 'Objeción sin resolver' : `${l.abiertas.length} objeciones sin resolver`}</p>
            <ul className="m-crm-objeciones">{l.abiertas.map((o, i) => <li key={i}>«{o}»</li>)}</ul>
          </>
        )}
        {l.resueltas > 0 && <p className="m-crm-texto m-crm-texto--dim">{l.resueltas === 1 ? 'Y 1 resuelta.' : `Y ${l.resueltas} resueltas.`}</p>}
        {l.proximoPaso && (
          <>
            <p className="m-crm-subt">Próximo paso</p>
            <p className="m-crm-texto">{l.proximoPaso}</p>
          </>
        )}
      </div>
    </SheetM>
  );
}
