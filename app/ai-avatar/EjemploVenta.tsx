'use client';
// =============================================================================
// EjemploVenta — «Ver ejemplo» de una plantilla de venta de AI Avatar (6/11/2026)
// =============================================================================
// La regla de Create (Martín, 29/10/2026: «Poné la estructura, la misma, y en algún lado un botón de "ver ejemplo"»): la
// tarjeta muestra la forma (cuándo usarla y sus secciones) y el ejemplo lleno, de un negocio FICTICIO del elenco, se ve
// aquí: el guion por secciones con lo que se ve y el texto en pantalla, y los tres ganchos para elegir
// (docs/plantillas-reales/avatar.md). «Usar esta plantilla» hace lo mismo que la tarjeta: pone el preset y la escena.
// =============================================================================

import { Button, Modal } from '@/app/_ui';
import { seccionDelGuion, type PlantillaVentaAvatar } from '@/lib/ai-avatar/plantillas-venta';

const th: React.CSSProperties = { textAlign: 'left', fontSize: 12, fontWeight: 650, color: 'var(--dim)', padding: '6px 8px', borderBottom: '1px solid var(--border)' };
const td: React.CSSProperties = { fontSize: 13.5, verticalAlign: 'top', padding: '8px', borderBottom: '1px solid var(--border)' };

export function EjemploVenta({ p, alSalir, alUsar }: { p: PlantillaVentaAvatar; alSalir: () => void; alUsar: () => void }) {
  return (
    <Modal titulo={`Ejemplo: ${p.negocio} (negocio ficticio)`} onCerrar={alSalir} ancho={760}
      pie={<><Button variant="secondary" onClick={alSalir}>Volver</Button><Button variant="primary" onClick={alUsar}>Usar esta plantilla</Button></>}>
      <p style={{ margin: '0 0 12px', fontSize: 13.5 }}><strong>{p.nombre}</strong> · {p.rubro} · ~{p.duracion} s</p>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Sección</th><th style={th}>Lo que dice</th><th style={th}>Se ve</th></tr></thead>
        <tbody>
          {p.estructura.map((etiqueta) => {
            const tramos = p.ejemplo.tramos.filter((t) => t.etiqueta === etiqueta);
            const dice = seccionDelGuion(p.ejemplo.guion, etiqueta, p.estructura);
            return (
              <tr key={etiqueta}>
                <td style={{ ...td, fontWeight: 650, whiteSpace: 'nowrap' }}>{etiqueta}</td>
                <td style={td}>{dice}</td>
                <td style={{ ...td, color: 'var(--dim)' }}>
                  {tramos.map((t, i) => <div key={i}>{t.seVe}{t.texto ? <> · <strong style={{ color: 'var(--ink)' }}>«{t.texto}»</strong></> : null}</div>)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {p.ejemplo.ganchos.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, margin: '18px 0 6px' }}>Tres ganchos para elegir</h3>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5 }}>
            {p.ejemplo.ganchos.map((g, i) => <li key={i} style={{ marginBottom: 6 }}><strong>{g.disparador}:</strong> {g.dice}{g.texto ? <span style={{ color: 'var(--dim)' }}> · en pantalla «{g.texto}»</span> : null}</li>)}
          </ol>
        </>
      )}
      <p style={{ margin: '16px 0 0', fontSize: 12.5, color: 'var(--dim)' }}>Con tu negocio, MaKo te pregunta: {p.pide.join(', ')}.</p>
    </Modal>
  );
}
