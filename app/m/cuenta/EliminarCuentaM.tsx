'use client';

// =============================================================================
// EliminarCuentaM — «Eliminar mi cuenta» en el teléfono (3/11/2026)
// =============================================================================
// Apple (5.1.1(v)) y Play la piden adentro de la app. Referencia: Ajustes › «Eliminar cuenta» de WhatsApp y de Instagram, una
// fila roja que abre una hoja con qué se borra y cuándo. DOS TOQUES: la fila y el botón de la hoja (Apple rechaza un
// camino «innecesariamente difícil»). Las palabras son las de la computadora (`textoDeLaBaja`, lib/baja-cuenta-reglas.ts).
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { haptico } from '@/lib/haptico';
import { CONFIRMACION_BAJA, TITULO_BAJA, fechaDeLaBaja, textoDeLaBaja, type AlcanceBaja } from '@/lib/baja-cuenta-reglas';
import { FilaM } from '../_ui/FilaM';
import { PieM } from '../_ui/Piezas';
import { SheetM } from '../_ui/SheetM';

type Estado = { puede: false; motivo: string } | { puede: true; alcance: AlcanceBaja; negocio: string | null; pendienteHasta: string | null };

export function EliminarCuentaM() {
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState<Estado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [hasta, setHasta] = useState<string | null>(null);

  const abrirDeNuevo = async () => {
    try {
      const j = await (await fetch('/api/cuenta/eliminar', { cache: 'no-store' })).json();
      if (j?.ok) setEstado(j as Estado);
    } catch { /* se queda lo que decía */ }
  };

  const abrir = async () => {
    setAbierta(true); setError(null);
    try {
      const j = await (await fetch('/api/cuenta/eliminar', { cache: 'no-store' })).json();
      if (!j?.ok) { setError(j?.error ?? 'No pudimos leer tu cuenta.'); return; }
      setEstado(j as Estado);
      if (j.puede && j.pendienteHasta) setHasta(j.pendienteHasta);
    } catch { setError('No pudimos leer tu cuenta.'); }
  };

  const confirmar = async () => {
    if (ocupado) return;
    setOcupado(true); setError(null);
    try {
      const j = await (await fetch('/api/cuenta/eliminar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirmar: CONFIRMACION_BAJA, alcance: estado?.puede ? estado.alcance : null }),
      })).json();
      // Cambió lo que se borra (se fue otro admin): se vuelve a leer antes de confirmar.
      if (j?.error && !j.ok) void abrirDeNuevo();
      if (!j?.ok) { haptico('error'); setError(j?.error ?? 'No pudimos anotar tu pedido.'); return; }
      haptico('success');
      setHasta(j.hasta);
    } catch { haptico('error'); setError('No pudimos anotar tu pedido.'); } finally { setOcupado(false); }
  };

  const t = estado?.puede ? textoDeLaBaja(estado.alcance, estado.negocio) : null;
  return (
    <>
      <FilaM titulo={<span className="m-cuenta-rojo">{TITULO_BAJA}</span>} onClick={() => { void abrir(); }} />
      <SheetM id="eliminar" abierto={abierta} onCerrar={() => setAbierta(false)} ocupado={ocupado} titulo={hasta ? 'Pedido recibido' : '¿Eliminar tu cuenta?'}
        rotuloCerrar={hasta ? 'Cerrar' : 'Volver'}
        pie={hasta
          ? <PieM><Button variant="primary" size="lg" full onClick={() => { window.location.href = '/login'; }}>Salir</Button></PieM>
          : t ? <PieM consecuencia={t.plazo}><Button variant="danger" size="lg" full loading={ocupado} onClick={() => { void confirmar(); }}>{TITULO_BAJA}</Button></PieM> : undefined}>
        <div className="m-cuenta-baja">
          {hasta
            ? <p>Se borra antes del {fechaDeLaBaja(hasta)}. Te avisamos por correo al terminar.</p>
            : estado && !estado.puede
              ? <p>{estado.motivo}</p>
              : t && <><p>{t.que}</p>{t.plan && <p>{t.plan}</p>}</>}
          {error && <p role="alert" className="m-cuenta-baja__mal">{error}<ReportarASoporte /></p>}
        </div>
      </SheetM>
    </>
  );
}
