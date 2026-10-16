// =============================================================================
// El hilo de una conversación del Centro — lo dibujan la computadora (Conversacion.tsx) y el teléfono
// (app/m/operaciones/ChatsMovil.tsx), la misma pieza en los dos
// =============================================================================
// La estructura es la de Claude y ChatGPT (lo propio a la derecha en burbuja, lo del asistente a la izquierda
// como texto) con las píldoras de día y los ticks de WhatsApp, ADENTRO de la burbuja, junto a la hora.
// escrito ≠ entregado ≠ hecho (docs/diseno-centro-de-operaciones.md §3):
//   · ✓         → escrito o entregando: está en MaKo y todavía no salió de la PC;
//   · ✓✓ gris   → entregado: el chat lo recibió, nunca «lo leyó»;
//   · ✓✓ azul   → hecho o comprobado: el chat dejó su cierre (que va abajo, como respuesta);
//   · ✕         → no se pudo / no sé si llegó / cancelado, con el motivo debajo.
//
// ⚠️ SIN 'use client' Y SIN HOOKS, a propósito: el teléfono la usa sin llevarse la pantalla de escritorio
// (AGENTS.md → MaKo Mobile). Las clases son las de centro.css, que importa quien la monta.
// ⚠️ Las horas son las de Argentina (el reloj de Martín), calculadas con el `ahora` que llega de afuera: el
// HTML del server y la hidratación tienen que decir lo mismo.

import { Icon } from '@/app/_components/icons';
import { ROTULO, type EstadoPedido } from '@/lib/operaciones-reglas';
import type { LineaChat, TrabajoP } from '@/lib/centro-chats';
import { textoDeRespuesta } from '@/app/admin/runway/decisiones';
import { Muneco, type Animo } from './Muneco';
import type { Aspecto } from '@/lib/centro-munecos';
import { ROTULO_TIPO, hace, pushDelCommit, type PushP } from '@/lib/progreso-reglas';

/** «10:52», con el reloj de Argentina. */
const horaAR = (t: number) => new Date(t).toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const diaAR = (t: number) => Math.floor((t - 3 * 3_600_000) / 86_400_000);
function rotuloDia(t: number, ahora: number): string {
  const d = diaAR(ahora) - diaAR(t);
  if (d <= 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  return new Date(t).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: 'numeric', month: 'short' });
}

/** Los ticks de WhatsApp: ✓ escrito, ✓✓ entregado, ✓✓ azul hecho, ✕ no salió. */
export function Tick({ estado }: { estado: EstadoPedido }) {
  const doble = (clase: string) => (
    <span className={`co-tick ${clase}`} title={ROTULO[estado]}>
      <Icon name="check" size={13} /><span style={{ display: 'inline-flex', marginLeft: -8 }}><Icon name="check" size={13} /></span>
    </span>
  );
  if (estado === 'escrito' || estado === 'tomado') return <span className="co-tick" title={ROTULO[estado]}><Icon name="check" size={13} /></span>;
  if (estado === 'entregado') return doble('');
  if (estado === 'hecho' || estado === 'comprobado') return doble('co-tick--hecho');
  return <span className="co-tick co-tick--mal" title={ROTULO[estado]}><Icon name="x" size={12} /></span>;
}

/** Quién habla del otro lado: el empleado (su título decide su muñeco). */
/** El empleado del chat: su nombre y, si Martín le eligió uno, su muñeco. */
type Quien = { titulo: string; aspecto?: Aspecto | null };

function Trabajo({ w, quien }: { w: TrabajoP; quien: Quien }) {
  const t = Date.parse(w.created_at);
  const estado = w.estado ?? 'escrito';
  const mal = estado === 'no_entregado' || estado === 'incierto' || estado === 'cancelado';
  const c = w.cierre;
  return (
    <>
      <div className="co-yo">
        <p className="co-burbuja">
          {w.texto ?? ''}
          <span className="co-burbuja__pie">{Number.isFinite(t) ? horaAR(t) : ''}<Tick estado={estado} /></span>
        </p>
        {mal && <p className="co-nota co-nota--mal">{`${ROTULO[estado]}${w.motivo ? ` · ${w.motivo}` : ''}`}</p>}
      </div>
      {c && (
        <div className="co-el">
          <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
          <div className="co-el__cuerpo">
            <p className="co-el__rotulo">{`${ROTULO[estado]}${w.cerrado_at ? ` · ${horaAR(Date.parse(w.cerrado_at))}` : ''}`}</p>
            <p className="co-el__texto">{c.hecho || c.decidido}</p>
            {(c.comprobado || c.sigue || c.prueba) && (
              <dl className="co-el__dl">
                {c.comprobado && <><dt>Comprobado</dt><dd>{c.comprobado}</dd></>}
                {c.sigue && <><dt>Sigue</dt><dd>{c.sigue}</dd></>}
                {c.prueba && <><dt>Prueba</dt><dd>{c.prueba}</dd></>}
              </dl>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Linea({ l, pushes, ahora, quien }: { l: LineaChat; pushes: readonly PushP[]; ahora: number; quien: Quien }) {
  if (l.tipo === 'trabajo') return <Trabajo w={l.trabajo} quien={quien} />;
  if (l.tipo === 'respuesta') {
    // Lo que contestó a una pregunta del chat: su burbuja, con la pregunta arriba en chico (como la cita de WhatsApp).
    return (
      <div className="co-yo">
        <p className="co-burbuja">
          <span className="co-burbuja__cita">{l.decision.pregunta}</span>
          {textoDeRespuesta(l.decision)}
          <span className="co-burbuja__pie">{horaAR(l.instante)}</span>
        </p>
      </div>
    );
  }
  if (l.tipo === 'derivado') {
    return (
      <div className="co-yo">
        <p className="co-burbuja">{l.pedido.texto}<span className="co-burbuja__pie">{horaAR(l.instante)}</span></p>
        <p className="co-nota">{l.trabajaron.length ? `Lo trabajó ${l.trabajaron.join(', ')}` : 'Nadie lo tomó todavía'}</p>
      </div>
    );
  }
  return (
    <>
      <div className="co-yo">
        <p className="co-burbuja">{l.pedido.texto}<span className="co-burbuja__pie">{horaAR(l.instante)}</span></p>
        {l.desde && <p className="co-nota">{`Lo pediste en ${l.desde}`}</p>}
      </div>
      {l.pasos.map((s, j) => {
        const subio = s.commits.map((k) => pushDelCommit(k.sha, pushes)).find(Boolean);
        return (
          <div key={j} className="co-el">
            <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo="despierto" size={26} />
            <div className="co-el__cuerpo">
              <p className="co-el__rotulo">{`${ROTULO_TIPO[s.tipo] ?? s.tipo}${s.instante != null ? ` · ${horaAR(s.instante)}` : ''}${subio ? ` · subió ${hace(subio.creado, ahora)}` : ''}`}</p>
              <p className="co-el__texto">{s.titulo}</p>
            </div>
          </div>
        );
      })}
    </>
  );
}

/** Las líneas de un chat, la más vieja arriba, con la píldora del día cada vez que cambia (WhatsApp). */
export function Hilo({ lineas, pushes, ahora, vacio, quien }: {
  lineas: readonly LineaChat[]; pushes: readonly PushP[]; ahora: number; vacio: string;
  /** El empleado de este chat: su muñeco va al lado de lo que hizo, y grande si todavía no hay nada. */
  quien: Quien & { animo: Animo; dato?: string | null };
}) {
  if (!lineas.length) {
    return (
      <div className="co-portada">
        <Muneco titulo={quien.titulo} aspecto={quien.aspecto} animo={quien.animo} size={76} />
        <p className="co-portada__nombre">{quien.titulo}</p>
        <p className="co-portada__dato">{quien.dato ?? vacio}</p>
      </div>
    );
  }
  const items: Array<{ k: string; dia?: string; l?: LineaChat }> = [];
  let ultimoDia: number | null = null;
  lineas.forEach((l, i) => {
    const d = diaAR(l.instante);
    if (d !== ultimoDia) { items.push({ k: `d${i}`, dia: rotuloDia(l.instante, ahora) }); ultimoDia = d; }
    items.push({ k: `l${i}`, l });
  });
  return (
    <>
      {items.map((it) => (it.dia
        ? <span key={it.k} className="co-dia">{it.dia}</span>
        : <Linea key={it.k} l={it.l!} pushes={pushes} ahora={ahora} quien={quien} />))}
    </>
  );
}
