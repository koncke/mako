'use client';

// =============================================================================
// /api-mako › Cómo se usa — de cero a la primera llamada, en cuatro pasos
// =============================================================================
// Los ejemplos apuntan a la URL de la app (`base`, del server). El camino que se
// enseña es el BARATO: el índice compacto y después el detalle de UNA operación.
// El catálogo entero son ~90k tokens, y un agente que lo baja de una se queda sin
// contexto antes de empezar (medido el 08/10/2026).
// =============================================================================

import { useState, type ReactNode } from 'react';
import { Button, Section } from '@/app/_ui';
import { MONO } from '@/app/_ui/tokens';
import { referenciaApi } from './actions';
import { Codigo, useCopiar } from './piezas';

export function ComoSeUsa({ base, hayToken, irATokens }: { base: string; hayToken: boolean; irATokens: () => void }) {
  const { copiar, copiado } = useCopiar();
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const b = base.replace(/\/+$/, '');

  const bajar = async () => {
    setBajando(true); setError(null);
    try {
      const r = await referenciaApi();
      if ('error' in r) { setError(r.error); return; }
      const url = URL.createObjectURL(new Blob([r.markdown], { type: 'text/markdown;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'api-mako.md';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('No se pudo bajar. Prueba de nuevo.'); }
    finally { setBajando(false); }
  };

  const paso = (n: number, titulo: string, cuerpo: ReactNode) => (
    <div style={{ display: 'grid', gridTemplateColumns: '26px 1fr', gap: 12, alignItems: 'start' }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 999, background: 'var(--ink)', color: 'var(--surface)', fontSize: 12, fontWeight: 700 }}>{n}</span>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--fs-md)' }}>{titulo}</div>
        {cuerpo}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      <Section>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
          {paso(1, 'Crea un token', (
            <div>
              <Button size="sm" variant={hayToken ? 'secondary' : 'primary'} onClick={irATokens}>{hayToken ? 'Ver tokens' : 'Crear token'}</Button>
            </div>
          ))}
          {paso(2, 'Pide el índice', (
            <Codigo clave="indice" copiar={copiar} copiado={copiado}
              texto={`curl -s "${b}/api/v1?compacto=1" -H "Authorization: Bearer $TOKEN"`} />
          ))}
          {paso(3, 'Mira una operación antes de usarla', (
            <Codigo clave="detalle" copiar={copiar} copiado={copiado}
              texto={`curl -s "${b}/api/v1?operacion=buscar_leads" -H "Authorization: Bearer $TOKEN"`} />
          ))}
          {paso(4, 'Llámala', (
            <>
              <Codigo clave="leer" copiar={copiar} copiado={copiado}
                texto={`# Una lectura: GET, parámetros en la URL\ncurl -s "${b}/api/v1/crm/buscar_leads?texto=ana" -H "Authorization: Bearer $TOKEN"\n\n# Una acción: POST, cuerpo en JSON desde un archivo\ncurl -s -X POST "${b}/api/v1/crm/proponer_cambio_etapa" \\\n  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\\n  --data-binary @accion.json`} />
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
                Ninguna acción escribe directo: deja una <strong>pendiente</strong> que confirma una persona, o una <strong>propuesta</strong> con un link para revisarla.
              </div>
            </>
          ))}
        </div>
      </Section>

      <Section titulo="Referencia completa" accion={<Button size="sm" variant="secondary" onClick={() => void bajar()} loading={bajando}>Bajar .md</Button>}>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
          Todas las operaciones con sus parámetros y un ejemplo cada una. Con un token: <code style={{ fontFamily: MONO }}>GET /api/v1/docs</code>.
        </div>
        {error && <div style={{ marginTop: 8, fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{error}</div>}
      </Section>
    </div>
  );
}
