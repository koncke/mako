'use client';

// =============================================================================
// EnlazarEmail — el «Email» del Calendario, enlazado a un email de Email Marketing (6/11/2026)
// =============================================================================
// La promesa a la agencia de Thiago: «programar en el Calendar un email». Va dentro del modal del evento (EventoModal), sólo
// para una Publicación de formato Email que ya existe, como PublicarEnRed para las redes. Elegir un email (borrador o
// programado) y «Programar a esta hora» muestra ANTES lo que va a pasar (el segmento, cuántos, la hora real de salida: el
// resumen de `programar_broadcast`) y recién con el sí lo programa (lib/calendario-email.ts). Enlazado, el evento dice el
// estado de verdad (Programado, Enviado) y el modal esconde «Ya se publicó».
//
// Lo que no se ve en la firma:
//   · SALE A LA HORA GUARDADA: si la fecha o la hora del modal cambiaron sin guardar, «Programar» espera (`sinGuardar`).
//   · MOVER EL EVENTO MUEVE EL EMAIL (cambiarEventoAction → `reprogramarSiEnlazado`).
//   · SOLTAR uno programado lo vuelve a borrador: no sale.

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Select } from '@/app/_ui/Select';
import { useConfirm } from '@/app/_ui/Confirm';
import Link from '@/app/_ui/Link';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { emailDelEventoAction, enlazarEmailAction, revisarEmailAction, soltarEmailAction } from './actions';
import { estadoDelEmail } from '@/lib/calendario-email-reglas';
import type { EmailDelEvento } from '@/lib/calendario-email';

export function EnlazarEmail({ id, sinGuardar, onEnlazado, onCambio }: {
  id: string;
  sinGuardar: boolean;
  /** Con un email enlazado el modal no ofrece «Ya se publicó»: lo dice el email. */
  onEnlazado: (enlazado: boolean) => void;
  onCambio: () => void;
}) {
  const [datos, setDatos] = useState<EmailDelEvento | null>(null);
  const [elegido, setElegido] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const { confirm, confirmNode } = useConfirm();

  const leer = useCallback(async () => {
    const d = await emailDelEventoAction(id);
    setDatos(d);
    onEnlazado(d.ok && !!d.enlazado);
  }, [id, onEnlazado]);
  useEffect(() => { void leer(); }, [leer]);

  if (!datos) return <div style={CAJA}><span style={TENUE}>Leyendo el email…</span></div>;
  if (!datos.ok) return <div style={CAJA} role="alert"><span style={TENUE}>{datos.error}</span><ReportarASoporte /></div>;

  const programar = async () => {
    const b = Number(elegido);
    if (!b) return;
    setError(null); setHecho(null); setOcupado(true);
    try {
      const r = await revisarEmailAction(id, b);
      if (!r.ok) { setError(r.error); return; }
      const si = await confirm(r.resumen, { title: '¿Programar este email?', confirmLabel: 'Programar el email', cancelLabel: 'No programar', danger: false });
      if (!si) return;
      const e = await enlazarEmailAction(id, b);
      if (!e.ok) { setError(e.error); return; }
      setHecho('Programado para la hora del evento.');
      onCambio();
      await leer();
    } finally { setOcupado(false); }
  };

  const soltar = async () => {
    const programado = datos.enlazado?.estado === 'programado';
    const si = await confirm(programado ? 'El email vuelve a borrador y no sale a esta hora.' : 'El evento vuelve a ser un recordatorio.',
      { title: 'Soltar el email', confirmLabel: 'Soltar el email', cancelLabel: 'Dejarlo', danger: programado });
    if (!si) return;
    setError(null); setHecho(null); setOcupado(true);
    try {
      const r = await soltarEmailAction(id);
      if (!r.ok) { setError(r.error); return; }
      onCambio();
      await leer();
    } finally { setOcupado(false); }
  };

  const enlazado = datos.enlazado;
  return (
    <div style={CAJA} data-enlazar-email="">
      <strong style={{ fontSize: 14 }}>Email Marketing</strong>
      {enlazado ? (
        <>
          <span style={{ fontSize: 14 }}>«{enlazado.asunto || 'Sin asunto'}» · {estadoDelEmail(enlazado).texto}</span>
          {datos.horaDistinta && <span style={{ fontSize: 13, color: 'var(--warn, var(--ink))' }}>El email sale a otra hora que el evento: guarda el evento para moverlo.</span>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link href="/email" style={{ fontSize: 13.5 }}>Abrir Email Marketing</Link>
            {enlazado.estado !== 'enviado' && enlazado.estado !== 'enviando' && (
              <Button variant="tertiary" size="sm" disabled={ocupado} onClick={() => void soltar()}>Soltar el email</Button>
            )}
          </div>
        </>
      ) : datos.motivo ? (
        <span style={TENUE}>{datos.motivo}</span>
      ) : datos.opciones.length === 0 ? (
        <span style={TENUE}>Escribe el email en <Link href="/email">Email Marketing</Link> y vuelve a enlazarlo aquí.</span>
      ) : (
        <>
          <Select label="El email que sale a esta hora" value={elegido} onChange={setElegido} placeholder="Elige un email…"
            options={datos.opciones.map((o) => ({ value: String(o.id), label: o.asunto || 'Sin asunto', sub: estadoDelEmail(o).texto, icono: 'email' as const }))} />
          {sinGuardar && <span style={TENUE}>Guarda la fecha y la hora primero: el email sale a la hora guardada.</span>}
          <div><Button variant="primary" size="sm" loading={ocupado} disabled={!elegido || sinGuardar} onClick={() => void programar()}>Programar a esta hora</Button></div>
        </>
      )}
      {hecho && <span style={{ fontSize: 13, color: 'var(--good, var(--ink))' }}>{hecho}</span>}
      {error && <div role="alert" style={{ fontSize: 13, color: 'var(--bad)' }}>{error}<ReportarASoporte /></div>}
      {confirmNode}
    </div>
  );
}

const CAJA = { display: 'flex', flexDirection: 'column' as const, gap: 8, padding: 12, borderRadius: 12, border: '1px solid var(--border)' };
const TENUE = { fontSize: 13, color: 'var(--dim)' };
