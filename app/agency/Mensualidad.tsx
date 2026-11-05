'use client';

// =============================================================================
// Mensualidad — lo que la agencia paga este mes en MaKo, por fuera de MaKo (acuerdo con Código Inmobiliario, 30/10/2026)
// =============================================================================
// El total del mes, sus renglones, quién todavía está sin costo y hasta cuándo, y los meses anteriores con su «Pagado».
// La estructura es la de la «próxima factura» de un portal de facturación (Stripe Billing): el monto y hasta cuándo se
// paga arriba, con su estado; los renglones abajo, con el total al pie. Las piezas visuales son las del Agency Dashboard
// (las clases `ad-*` de AgencyApp.tsx), así se lee como parte de la misma pantalla. Desde cuándo cuenta CADA cliente va en
// la lista de cuentas de abajo (su columna «Mensualidad») y en su ficha: una segunda lista de los mismos clientes sobraba.
//
// ⚠️ Lo que ESCRIBE es del super admin parado en la agencia («Marcar pagado», «Corregir fecha», prender o apagar): la
//    agencia lo LEE. La puerta es del server (app/agency/actions.ts); esconder los botones no protege nada.
// ⚠️ Las reglas (quién cuenta, el total, los textos) viven en lib/agencia-mes-reglas.ts: acá no se calcula nada.
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ErrorState, Modal } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { ConfirmDialog } from '@/app/_components/ChatItemMenu';
import type { Mensualidad as DatosMensualidad, MesDeMensualidad, FilaMensualidad } from '@/lib/agencia-mes';
import { DIA_LIMITE_DE_PAGO, DIAS_SIN_COSTO, conceptoDeLinea, diaCorto, diaLargo, nombreDelMes, sumarDias, usd } from '@/lib/agencia-mes-reglas';
import { corregirRelojAction, marcarMesPagadoAction, mensualidadPrendidaAction, quitarMesPagadoAction } from './actions';

type Aviso = (texto: string, tono?: 'good' | 'bad', deshacer?: () => void) => void;
type Resultado = { ok: true; resumen: string } | { ok: false; error: string };

/** Corre una acción, avisa lo que pasó y vuelve a pedir la página (los números salen del server). */
function useCorrer(onAviso: Aviso) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const correr = async (fn: () => Promise<Resultado>, deshacer?: () => void) => {
    setOcupado(true);
    const r = await fn().catch(() => ({ ok: false as const, error: 'Sin conexión.' }));
    setOcupado(false);
    if (r.ok) { onAviso(r.resumen, 'good', deshacer); router.refresh(); } else onAviso(r.error, 'bad');
  };
  return { ocupado, correr };
}

export function Mensualidad({ m, superAdmin, ver, onAviso }: {
  m: DatosMensualidad;
  /** El super admin parado en la agencia: anota los pagos y la prende o apaga. */
  superAdmin: boolean;
  /** `?vista=mensualidad` (el link de los avisos): baja hasta acá al abrir. */
  ver: boolean;
  onAviso: Aviso;
}) {
  const raiz = useRef<HTMLElement | null>(null);
  const [pagar, setPagar] = useState<MesDeMensualidad | null>(null);
  const [apagar, setApagar] = useState(false);
  const { ocupado, correr } = useCorrer(onAviso);

  useEffect(() => { if (ver) raiz.current?.scrollIntoView({ block: 'start' }); }, [ver]);

  if (!m.ok) {
    return (
      <section ref={raiz} id="mensualidad" className="am">
        <ErrorState titulo="No pude armar tu mensualidad" detalle="Reintenta en un momento." detalleTecnico={m.error} />
      </section>
    );
  }
  // Apagada: la agencia sigue con el cobro por pasarela y no ve nada de esto; el super admin ve cómo quedaría.
  if (!m.config && !superAdmin) return null;

  const a = m.actual;
  const mesTxt = nombreDelMes(a.mes);
  const sinCosto = m.clientes.filter((c) => c.situacion.tipo === 'sin-costo');

  return (
    <section ref={raiz} id="mensualidad" className="am" aria-labelledby="am-titulo">
      <div className="am-cab">
        <div className="am-cab-txt">
          <span className="am-eti" id="am-titulo">{m.config ? `Mensualidad de ${mesTxt}` : 'Mensualidad · apagada'}</span>
          <b className="am-total">{usd(a.cuenta.totalUsd)}</b>
          <span className="am-sub">
            {m.config
              ? `Se paga una vez, del 1 al ${DIA_LIMITE_DE_PAGO} de ${mesTxt}, por ${m.config.medio}.`
              : `Así quedaría ${mesTxt} si la prendes. Se paga por fuera de MaKo y se avisa el día 1.`}
          </span>
        </div>
        <div className="am-cab-acc">
          {m.config && <EstadoPago mes={a} />}
          {superAdmin && m.config && !a.pago && (
            <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado} onClick={() => setPagar(a)}>Marcar pagado</button>
          )}
          {superAdmin && m.config && a.pago && (
            <button type="button" className="ad-acc" disabled={ocupado}
              onClick={() => void correr(() => quitarMesPagadoAction(a.mes, a.pago?.pagadoEl ?? null))}>Quitar «Pagado»</button>
          )}
          {superAdmin && !m.config && (
            <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado}
              onClick={() => void correr(() => mensualidadPrendidaAction(a.mes))}>Prender desde {mesTxt}</button>
          )}
        </div>
      </div>

      <div className="ad-tabla am-tabla" role="table" aria-label={`La mensualidad de ${mesTxt}`}>
        <div className="ad-th am-fila" role="row"><span role="columnheader">Concepto</span><span role="columnheader">Monto</span></div>
        {a.cuenta.lineas.map((l, i) => (
          <div key={`${l.tipo}-${l.tipo === 'agencia' ? 0 : l.ws}-${i}`} className="ad-fila am-fila" role="row">
            <span role="cell" className="am-concepto">{conceptoDeLinea(l)}{l.tipo === 'mes' && <em>Cuenta desde el {diaCorto(l.desde)}</em>}</span>
            <span role="cell" className="ad-num">{usd(l.montoUsd)}</span>
          </div>
        ))}
        <div className="ad-fila am-fila am-pie" role="row"><span role="cell">Total</span><span role="cell" className="ad-num">{usd(a.cuenta.totalUsd)}</span></div>
      </div>
      {sinCosto.length > 0 && (
        <p className="ad-nota">
          Todavía sin costo: {sinCosto.map((c) => `${c.nombre} hasta el ${c.situacion.tipo === 'sin-costo' ? diaCorto(c.situacion.hasta) : ''}`).join(' · ')}.
          {' '}Si un cliente no te pagó, dalo de baja antes y no se cobra.
        </p>
      )}

      {m.anteriores.length > 0 && (
        <>
          <h3 className="ad-sub">Meses anteriores</h3>
          <div className="ad-tabla am-tabla" role="table" aria-label="Los meses anteriores">
            {m.anteriores.map((x) => (
              <div key={x.mes} className="ad-fila am-mes" role="row">
                <span role="cell" className="am-concepto"><b className="am-mes-nombre">{nombreDelMes(x.mes)} {x.mes.slice(0, 4)}</b></span>
                <span role="cell"><EstadoPago mes={x} /></span>
                <span role="cell" className="ad-num">{usd(x.pago?.totalUsd ?? x.cuenta.totalUsd)}</span>
                <span role="cell" className="ad-fila-acc">
                  {superAdmin && !x.pago && <button type="button" className="ad-acc" disabled={ocupado} onClick={() => setPagar(x)}>Marcar pagado</button>}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {superAdmin && m.config && (
        <p className="ad-nota am-apagar">
          Prendida desde {nombreDelMes(m.config.desde)} {m.config.desde.slice(0, 4)}.{' '}
          <button type="button" className="am-link" disabled={ocupado} onClick={() => setApagar(true)}>Apagar la mensualidad</button>
        </p>
      )}

      {pagar && (
        <ModalPagado mes={pagar} hoy={m.hoy} ocupado={ocupado} onCerrar={() => setPagar(null)}
          onGuardar={(dia) => {
            const mes = pagar.mes;
            setPagar(null);
            void correr(() => marcarMesPagadoAction(mes, dia), () => void correr(() => quitarMesPagadoAction(mes, dia)));
          }} />
      )}
      {apagar && (
        <ConfirmDialog titulo="¿Apagar la mensualidad de esta agencia?"
          detalle="Deja de avisarle el día 1 y antes de cada plazo. Lo que ya marcaste pagado queda anotado."
          confirmLabel="Apagar la mensualidad" onCancel={() => setApagar(false)}
          onConfirm={() => { setApagar(false); void correr(() => mensualidadPrendidaAction(null)); }} />
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </section>
  );
}

/** «Pagado el 03/11» o «Sin pagar · hasta el 05/11». */
function EstadoPago({ mes }: { mes: MesDeMensualidad }) {
  if (mes.pago) return <span className="ad-est" data-tono="good"><i />Pagado el {diaCorto(mes.pago.pagadoEl)}</span>;
  return <span className="ad-est" data-tono="warn"><i />Sin pagar · hasta el {diaCorto(mes.cuenta.limite)}</span>;
}

function ModalPagado({ mes, hoy, ocupado, onCerrar, onGuardar }: {
  mes: MesDeMensualidad; hoy: string; ocupado: boolean; onCerrar: () => void; onGuardar: (dia: string) => void;
}) {
  const [dia, setDia] = useState(hoy);
  return (
    <Modal titulo={`Pagado: ${nombreDelMes(mes.mes)}`} encabezado="Mensualidad" ancho={420} onCerrar={onCerrar}
      pie={
        <>
          <button type="button" className="ad-acc" onClick={onCerrar}>No marcar</button>
          <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado || !dia} onClick={() => onGuardar(dia)}>Marcar {usd(mes.cuenta.totalUsd)} pagado</button>
        </>
      }>
      <label className="am-campo">
        <span>Día en que entró el pago</span>
        <input className="ad-buscar" type="date" value={dia} max={sumarDias(hoy, 1)} data-autofocus onChange={(e) => setDia(e.target.value)} />
      </label>
      <p className="ad-nota">Queda anotado con este total. Lo que cambie después en la cartera no lo modifica.</p>
    </Modal>
  );
}

/**
 * «Corregir fecha» de un cliente (el super admin, en la ficha de su cuenta): desde qué día corren sus 14 días. Para una
 * cuenta que nació antes como prueba, por ejemplo.
 */
export function CorregirReloj({ fila, puede, onAviso }: { fila: FilaMensualidad; puede: boolean; onAviso: Aviso }) {
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState(fila.corregido ?? fila.invitado);
  const { ocupado, correr } = useCorrer(onAviso);
  const cuenta = dia ? sumarDias(dia, DIAS_SIN_COSTO) : null;
  const guardar = (nuevo: string | null) => {
    const antes = fila.corregido;
    setAbierto(false);
    void correr(() => corregirRelojAction(fila.ws, nuevo), () => void correr(() => corregirRelojAction(fila.ws, antes)));
  };
  return (
    <>
      <div style={{ marginTop: 8 }}>
        <button type="button" className="ad-acc" disabled={ocupado} onClick={() => setAbierto(true)}>Corregir fecha</button>
      </div>
      {/* Por PORTAL: se abre desde la ficha de la cuenta (otro Modal); adentro de ella, la pila de modales lo apagaría con la ficha. */}
      {abierto && typeof document !== 'undefined' && createPortal(
        <Modal titulo={`Corregir la fecha de ${fila.nombre}`} encabezado="Mensualidad" ancho={460} anidada onCerrar={() => setAbierto(false)}
          pie={
            <>
              {fila.corregido && <button type="button" className="ad-acc" disabled={ocupado || !puede} onClick={() => guardar(null)}>Volver a la invitación</button>}
              <button type="button" className="ad-acc ad-acc--fuerte" disabled={ocupado || !puede || !dia} onClick={() => guardar(dia)}>Guardar la fecha</button>
            </>
          }>
          {!puede && <p className="ad-nota" role="status">Aplica la migración 0394 para poder corregir fechas.</p>}
          <label className="am-campo">
            <span>Sus {DIAS_SIN_COSTO} días corren desde</span>
            <input className="ad-buscar" type="date" value={dia} data-autofocus onChange={(e) => setDia(e.target.value)} />
          </label>
          <p className="ad-nota">Invitado el {diaLargo(fila.invitado)}.{cuenta ? ` Con esta fecha cuenta desde el ${diaLargo(cuenta)}.` : ''}</p>
        </Modal>,
        document.body,
      )}
    </>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la mitad.
const CSS = `
.am{ margin:0 0 26px; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:18px 18px 16px; scroll-margin-top:calc(16px + var(--barra-agencia, 0px)); }
.am-cab{ display:flex; gap:16px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; margin:0 0 14px; }
.am-cab-txt{ display:flex; flex-direction:column; gap:4px; min-width:0; }
.am-eti{ font-size:var(--fs-sm); font-weight:650; color:var(--dim); }
.am-total{ font-size:34px; line-height:1.1; font-weight:800; letter-spacing:-.03em; color:var(--ink); font-variant-numeric:tabular-nums; }
.am-sub{ font-size:13.5px; color:var(--dim); }
.am-cab-acc{ display:inline-flex; gap:10px; align-items:center; flex-wrap:wrap; justify-content:flex-end; }
.am-tabla .am-fila{ grid-template-columns:minmax(0, 1fr) 140px; padding:10px 16px; }
.am-tabla .am-fila > :last-child{ text-align:right; }
.am-tabla .am-mes{ grid-template-columns:minmax(140px, 1fr) minmax(200px, 1.4fr) 120px minmax(130px, auto); padding:8px 16px; }
.am-tabla .ad-num{ text-align:right; }
.am-concepto{ min-width:0; display:flex; flex-direction:column; gap:2px; font-size:14px; color:var(--ink); }
.am-concepto b{ font-weight:650; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.am-concepto em{ font-style:normal; font-size:12.5px; color:var(--dim); }
.am-mes-nombre::first-letter{ text-transform:uppercase; }
.am-pie{ background:var(--surface-2); font-weight:700; }
.am-pie .ad-num{ font-size:15px; }
.am-campo{ display:flex; flex-direction:column; gap:6px; margin:0 0 4px; }
.am-campo span{ font-size:13px; font-weight:600; color:var(--ink); }
.am-campo .ad-buscar{ max-width:none; }
.am-apagar{ margin-top:14px; }
.am-link{ border:0; background:none; padding:0; font:inherit; color:var(--bad); cursor:pointer; text-decoration:underline; }
@media (max-width: 980px){
  .am-tabla .am-mes{ grid-template-columns:1fr auto; row-gap:4px; }
}
`;
