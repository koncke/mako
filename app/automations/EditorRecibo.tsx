'use client';

// =============================================================================
// EditorRecibo — el panel de la tarjeta «Emitir recibo» de Automations (5/11/2026)
// =============================================================================
// Martín: «varios templates de factura que nosotros podemos crear y que el usuario pueda elegir qué template quiere enviar».
// Dos elecciones, que son los parámetros de la ⚡ Acción `emitir_recibo` (lib/recibos-negocio.ts): la PLANTILLA, en una
// galería con su miniatura (el mismo layout del PDF con un pago de muestra, nunca un rectángulo vacío; «Ver ejemplo» abre el
// PDF de verdad con los datos de este negocio), y POR DÓNDE SALE, en el desplegable de la casa (nunca el <select> nativo).
// Copiado del selector de plantillas de factura de Stripe (Settings › Invoice template): tres tarjetas con la hoja en chico,
// el nombre debajo y la elegida con borde.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import { Dropdown, type DropdownOption } from '../components/Dropdown';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { CANALES_RECIBO, PLANTILLAS_RECIBO, ROTULO_CANAL_RECIBO, esCanalRecibo, esPlantillaRecibo, type CanalRecibo, type PlantillaRecibo } from '@/lib/recibo-negocio-reglas';

type Params = Record<string, unknown>;

const OPCIONES_CANAL: DropdownOption[] = CANALES_RECIBO.map((c) => ({
  value: c, label: ROTULO_CANAL_RECIBO[c], icono: c === 'email' ? 'email' : c === 'grupo' ? 'equipo' : 'whatsapp',
}));

/** Una línea gris de la hoja en chico. */
const Renglon = ({ ancho, alto = 3, tono = 'var(--border)' }: { ancho: string; alto?: number; tono?: string }) => (
  <div style={{ width: ancho, height: alto, borderRadius: 2, background: tono }} />
);

/** La hoja en chico: el mismo orden que el PDF (lib/recibo-pdf.ts), con un pago de muestra. */
function Miniatura({ plantilla }: { plantilla: PlantillaRecibo }) {
  const hoja: CSSProperties = {
    aspectRatio: '210 / 297', width: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 4,
    padding: 6, display: 'grid', alignContent: 'start', gap: 4, overflow: 'hidden', boxSizing: 'border-box',
  };
  const txt = (s: string, peso = 400, tam = 5.5): ReactNode => <span style={{ fontSize: tam, fontWeight: peso, color: '#222', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{s}</span>;
  return (
    <div style={hoja} aria-hidden>
      {plantilla === 'marca' && <div style={{ margin: '-6px -6px 2px', height: 9, background: '#1c1c1e', display: 'flex', alignItems: 'center', paddingLeft: 6 }}><span style={{ fontSize: 4.5, color: '#fff', fontWeight: 700 }}>TU NEGOCIO</span></div>}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>{txt('Tu negocio', 700)}{txt('Recibo de pago', 700)}</div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>{txt('N.º 0001', 400, 4.5)}</div>
      <div style={{ background: '#f7f6f3', padding: '3px 4px', display: 'flex', justifyContent: 'space-between' }}>{txt('Ana Pérez', 700, 5)}{txt('US$ 97,00', 700, 5)}</div>
      {plantilla === 'compacto' ? (
        <>
          {txt('Por: Cuota 2 · noviembre', 400, 4.5)}
          {txt('Pagado por transferencia, 5/11 10:30', 400, 4.5)}
        </>
      ) : (
        <>
          {txt('Qué se pagó', 700, 4.8)}
          <Renglon ancho="100%" /><Renglon ancho="80%" />
          {txt('Cómo se pagó', 700, 4.8)}
          <Renglon ancho="100%" /><Renglon ancho="65%" />
        </>
      )}
      <div style={{ marginTop: 6 }}><Renglon ancho="90%" alto={2} /></div>
    </div>
  );
}

export function EditorRecibo({ params, busy, cambiar }: { params: Params; busy: boolean; cambiar: (nuevos: Params) => void }) {
  const ws = useWs();
  const plantilla: PlantillaRecibo = esPlantillaRecibo(params.plantilla) ? params.plantilla : 'clasico';
  const canal: CanalRecibo = esCanalRecibo(params.canal) ? params.canal : 'whatsapp';
  const rot: CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--dim)' };
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={rot}>Plantilla</span>
        <div role="radiogroup" aria-label="Plantilla del recibo" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {PLANTILLAS_RECIBO.map((p) => {
            const elegida = p.id === plantilla;
            return (
              <button key={p.id} type="button" role="radio" aria-checked={elegida} disabled={busy} title={p.detalle}
                onClick={() => { if (!elegida) cambiar({ ...params, plantilla: p.id }); }}
                style={{
                  display: 'grid', gap: 5, padding: 6, borderRadius: 8, cursor: busy ? 'default' : 'pointer', textAlign: 'center',
                  background: 'var(--surface)', border: elegida ? '2px solid var(--accent, var(--ink))' : '1px solid var(--border)',
                }}>
                <Miniatura plantilla={p.id} />
                <span style={{ fontSize: 11.5, fontWeight: elegida ? 700 : 500, color: 'var(--ink)' }}>{p.nombre}</span>
              </button>
            );
          })}
        </div>
        <a href={conWs(`/api/recibos-negocio/ejemplo?plantilla=${plantilla}`, ws)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--link, var(--ink))', justifySelf: 'start' }}>
          Ver ejemplo en PDF
        </a>
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={rot}>Por dónde sale</span>
        <Dropdown value={canal} width="100%" ariaLabel="Por dónde sale el recibo" search={false} disabled={busy} options={OPCIONES_CANAL}
          onChange={(v: string) => { if (esCanalRecibo(v) && v !== canal) cambiar({ ...params, canal: v }); }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
        Sale sobre la última cuota cobrada. Es un recibo de pago, no una factura fiscal. Por correo, sale con el dominio de tu negocio.
      </div>
    </div>
  );
}
