'use client';

// =============================================================================
// ficha/resumen/reunion — lo que viene: la próxima reunión y la siguiente acción
// =============================================================================
// LA REFERENCIA: la tarjeta de «Upcoming» de HubSpot (la próxima reunión del contacto arriba de la columna del medio,
// con su hora y el link para entrar) y la «next step» que HubSpot y Attio ponen primero en un registro; documentación
// oficial, no se entró a las apps. La siguiente acción es la regla del teléfono (`siguienteAccion`, app/m/crm/reglas.ts)
// con un botón que lleva a donde se resuelve (./logica.ts, `siguienteAccionDe`).
//
// LA PRÓXIMA REUNIÓN, «dos tiempos, automático» (§3 del diseño): antes, el día, la hora del negocio, cuánto falta y
// «Entrar»; pasada la hora sin asistencia, «¿Vino?» ahí mismo. Lo que la etapa pide y no está (la fecha de la junta,
// la asistencia) se carga en el bloque: así «Solucionar» encuentra el campo (`marcaDato`). El banner «Va bien» de
// siempre es uno de sus diseños.
// ⚠️ LAS ASISTENCIAS SE REPITEN A PROPÓSITO con la reunión de la tab Reuniones (§3): es el mismo campo
//    (`TriEditable` → `guardarCampoLeadAction`), con el mismo candado (sin fecha de la junta no hay asistencia).
// =============================================================================

import { nutricionPositivaDe } from '@/lib/pipeline';
import { fmtDDMMYYYY } from '@/lib/date-utils';
import { marcaDato } from '@/lib/datos-aviso';
import { tituloDeBloque } from '@/lib/ficha/registro';
import { Button } from '@/app/_ui/Button';
import { Status } from '@/app/_ui/Badge';
import { horaEnTz } from '@/app/m/crm/reglas';
import { useTzWorkspace } from '../../useTzWorkspace';
import { FechaEditable, TriEditable } from '../../CampoEditable';
import type { CtxFicha, PropsBloque } from '../tipos';
import { reunionesDelCtx, siguienteDelCtx } from '../reglas-resumen';
import { cuandoRelativo, type CualReunion, type ReunionDelLead } from './logica';
import { Bloque, Prop } from './piezas';

/** El nombre de la reunión: el de su etapa («Agenda R1», «Webinar»), nunca «Reunión 1» si el funnel la nombró. */
export const nombreDeReunion = (stages: CtxFicha['stages'], c: CualReunion): string =>
  tituloDeBloque({ id: c === 'r1' ? 'reunion-1' : 'reunion-2', titulo: c === 'r1' ? 'Reunión 1' : 'Reunión 2' }, stages);

/** «jue 16 oct» de una reunión: el instante en la zona del negocio, o el día guardado. */
function diaLargo(r: ReunionDelLead, tz: string): string {
  const conHora = r.at && Number.isFinite(Date.parse(r.at));
  const d = conHora ? new Date(r.at!) : new Date(`${(r.fecha ?? '').slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(d.getTime())) return r.fecha ?? '';
  return new Intl.DateTimeFormat('es-MX', { weekday: 'short', day: 'numeric', month: 'short', timeZone: conHora ? tz : 'UTC' }).format(d).replace(/\./g, '');
}

/** La primera letra en mayúscula (y sólo ésa: `text-transform: capitalize` daba «Lun 19 De Oct»). */
const mayuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function ProximaReunion({ ctx, titulo, diseno, epico }: PropsBloque) {
  const tz = useTzWorkspace();
  const { lead, stages } = ctx;
  const e = reunionesDelCtx(ctx);
  const nombre = (c: CualReunion) => nombreDeReunion(stages, c);

  // El banner «Va bien» de siempre (`nutricionPositivaDe`): el lead avanza y tiene la reunión por delante.
  const np = diseno === 'banner' && !epico ? nutricionPositivaDe(lead, ctx.hoy) : null;

  // Lo que se carga aquí: la asistencia de lo que pasó y las fechas que la etapa pide.
  const cargar = (
    <>
      {e.sinMarcar.map((r) => {
        const campoFecha = r.cual === 'r1' ? 'fecha_junta_1' : 'fecha_junta_2';
        const tieneFecha = r.cual === 'r1' ? !!lead.fecha_junta_1 : !!lead.fecha_junta_2;
        return (
          <div key={r.cual} className="fr-props">
            <Prop k={`¿Vino a ${nombre(r.cual)}?`} editable marca={marcaDato(r.cual === 'r1' ? 'asistenciaR1' : 'asistenciaR2')}>
              <TriEditable leadId={lead.id} campo={r.cual === 'r1' ? 'asistio_j1' : 'asistio_j2'} valor={r.asistio} si="Asistió" no="No asistió"
                titulo={`¿Vino a ${nombre(r.cual)}?`} bloqueado={!tieneFecha} />
            </Prop>
            {!tieneFecha && (
              <Prop k="Fecha" editable>
                <FechaEditable leadId={lead.id} campo={campoFecha} valor={null} fallback={r.cual === 'r1' ? lead.fecha_agenda : null} titulo={`Fecha de ${nombre(r.cual)}`} />
              </Prop>
            )}
          </div>
        );
      })}
      {e.fechasPedidas.length > 0 && (
        <div className="fr-props">
          {e.fechasPedidas.map((c) => (
            <Prop key={c} k={`Fecha de ${nombre(c)}`} editable marca={marcaDato(c === 'r1' ? 'fechaJ1' : 'fechaJ2')}>
              <FechaEditable leadId={lead.id} campo={c === 'r1' ? 'fecha_junta_1' : 'fecha_junta_2'} valor={null} fallback={c === 'r1' ? lead.fecha_agenda : null}
                titulo={`Fecha de ${nombre(c)}`} vacio="sin fecha" />
            </Prop>
          ))}
        </div>
      )}
    </>
  );

  if (np) {
    const cual = np.tipo === 'post-agenda' ? nombre('r1') : nombre('r2');
    return (
      <Bloque titulo={titulo} epico={false} tono="good">
        <span style={{ fontSize: 14.5, lineHeight: 1.5 }}>Va bien: su {cual} es el <b>{fmtDDMMYYYY(np.hasta)}</b> ({cuandoRelativo(np.dias)}).</span>
        {cargar}
      </Bloque>
    );
  }

  const px = e.proxima;
  const hora = px?.at ? horaEnTz(px.at, tz) : null;
  const entrar = px?.url ? <Button size={epico ? 'lg' : 'sm'} onClick={() => window.open(px.url!, '_blank', 'noopener')}>Entrar</Button> : null;

  if (!px) return <Bloque titulo={titulo} epico={epico}>{cargar}</Bloque>;

  if (diseno === 'renglon' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 650 }}>{nombre(px.cual)}</span>
          <span className="fr-sub">{diaLargo(px, tz)}{hora ? ` · ${hora}` : ''}</span>
          <Status tono={px.dias <= 1 ? 'warn' : 'info'}>{cuandoRelativo(px.dias)}</Status>
          {entrar && <span style={{ marginLeft: 'auto' }}>{entrar}</span>}
        </div>
        {cargar}
      </Bloque>
    );
  }

  // «Número grande» (y la épica): cuánto falta es el protagonista.
  if (diseno === 'numero' || epico) {
    const falta = cuandoRelativo(px.dias);
    return (
      <Bloque titulo={titulo} epico={epico}>
        <span className={epico ? 'fr-p' : 'fr-num'}>{mayuscula(falta)}</span>
        <span className="fr-sub">{nombre(px.cual)} · {diaLargo(px, tz)}{hora ? ` · ${hora}` : ''}</span>
        {entrar && <span>{entrar}</span>}
        {cargar}
      </Bloque>
    );
  }

  // «Dos tiempos, automático»: antes, el día, la hora y cuánto falta.
  return (
    <Bloque titulo={titulo} epico={false} derecha={entrar}>
      <div className="fr-dato">
        <span className="fr-sub">{nombre(px.cual)}</span>
        <span className="fr-num">{mayuscula(diaLargo(px, tz))}{hora ? ` · ${hora}` : ''}</span>
        <span><Status tono={px.dias <= 1 ? 'warn' : 'info'}>{cuandoRelativo(px.dias)}</Status></span>
      </div>
      {cargar}
    </Bloque>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// La siguiente acción
// ─────────────────────────────────────────────────────────────────────────────

export function SiguienteAccion({ ctx, titulo, diseno, epico, editando }: PropsBloque) {
  const tz = useTzWorkspace();
  // La misma regla que decide si el bloque se calla (`siguienteDelCtx`, ../reglas-resumen.ts), con los nombres y la hora.
  const s = siguienteDelCtx(ctx, { nombreReunion: (c) => nombreDeReunion(ctx.stages, c), hora: (iso) => horaEnTz(iso, tz) });
  if (!s) return null;
  const hacer = () => {
    const a = s.boton?.accion;
    if (!a) return;
    if (a.tipo === 'entrar') window.open(a.url, '_blank', 'noopener');
    else if (a.tipo === 'tab') ctx.irATab(a.tab);
    else ctx.solucionar(a.paso);
  };
  const boton = s.boton ? <Button size={epico ? 'lg' : 'sm'} variant={s.tono === 'warn' ? 'primary' : 'secondary'} disabled={editando} onClick={hacer}>{s.boton.rotulo}</Button> : null;

  if (diseno === 'chip' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Status tono={s.tono === 'warn' ? 'warn' : s.tono === 'info' ? 'info' : 'neutral'}>{s.titulo}</Status>
          {boton}
        </div>
      </Bloque>
    );
  }
  if (diseno === 'fila' && !epico) {
    return (
      <Bloque titulo={titulo} epico={false}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ flex: '1 1 200px', minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 650 }}>{s.titulo}</span>
            {s.detalle && <span className="fr-sub"> · {s.detalle}</span>}
          </span>
          {boton}
        </div>
      </Bloque>
    );
  }
  // «Banner arriba» (y la épica: la frase que manda y su botón grande).
  return (
    <Bloque titulo={titulo} epico={epico} tono={s.tono === 'warn' ? 'warn' : s.tono === 'info' ? 'info' : undefined}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px 16px', flexWrap: 'wrap' }}>
        <div className="fr-banner-txt">
          {epico ? <p className="fr-frase">{s.titulo}</p> : <div className="fr-banner-tit">{s.titulo}</div>}
          {s.detalle && <div className="fr-banner-det">{s.detalle}</div>}
        </div>
        {boton}
      </div>
    </Bloque>
  );
}
