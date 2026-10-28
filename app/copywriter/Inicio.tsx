'use client';

// =============================================================================
// Inicio — el vacío del Copywriter: la caja grande de mila.gg («Create a doc about whales») y los cuatro tipos
// =============================================================================
// mila.gg abre con UNA caja: se escribe qué documento se quiere y su IA lo arma. Acá igual (docs/diseno-copywriter.md,
// D1): «¿Qué guion escribimos?», el tipo debajo (Ad · Reel · Story · YouTube) y Enter. Se crea el guion de ese tipo con
// la estructura de la biblioteca y lo escrito queda como el primer pedido a MaKo.
// Una sola cosa por pantalla (la regla de Martín): no hay lista, ni textos, ni pasos.
// =============================================================================

import { useState } from 'react';
import { INFO_TIPO, TIPOS_GUION, type TipoGuion } from '@/lib/copywriter/tipos';

export function Inicio({ onCrear, creando, arbolPlegado = false, onDesplegarArbol }: {
  onCrear: (tipo: TipoGuion, pedido: string) => void;
  creando: boolean;
  /** La barra de guiones plegada (ventana angosta): «»» la vuelve a abrir, como en las migas del documento. */
  arbolPlegado?: boolean;
  onDesplegarArbol?: () => void;
}) {
  const [tipo, setTipo] = useState<TipoGuion>('ad');
  const [pedido, setPedido] = useState('');
  const ir = () => { if (!creando) onCrear(tipo, pedido.trim()); };
  return (
    <div className="nt-doc">
      {arbolPlegado && (
        <div className="nt-barra">
          <button type="button" className="nt-boton-ico" onClick={onDesplegarArbol} title="Abrir la barra de guiones" aria-label="Abrir la barra de guiones">»</button>
        </div>
      )}
      <div className="nt-inicio">
        <div className="nt-inicio-caja">
          <h1 className="nt-inicio-titulo">¿Qué guion escribimos?</h1>
          <div className="nt-inicio-campo">
            <input value={pedido} onChange={(e) => setPedido(e.target.value)} placeholder={`Escribe ${INFO_TIPO[tipo].uno} sobre…`}
              aria-label="Qué guion quieres" maxLength={2000} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ir(); } }} />
            <button type="button" className="nt-inicio-ir" onClick={ir} disabled={creando} aria-label="Crear el guion">{creando ? '…' : '→'}</button>
          </div>
          <div className="nt-tipos" role="group" aria-label="Tipo de guion">
            {TIPOS_GUION.map((t) => (
              <button key={t} type="button" className="nt-tipo" aria-pressed={t === tipo} onClick={() => setTipo(t)}>
                <span aria-hidden>{INFO_TIPO[t].emoji}</span>{INFO_TIPO[t].label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
