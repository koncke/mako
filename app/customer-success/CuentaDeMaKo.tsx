'use client';

// =============================================================================
// CuentaDeMaKo — el renglón de «este cliente tiene cuenta» adentro de su ficha
// =============================================================================
// Un renglón, cuatro estados, y en cada uno UNA cosa para hacer:
//
//   · sin cuenta   → «Abrir cuenta de MaKo»
//   · pendiente    → «Espera aprobación» (y nada más: no hay nada que hacer acá,
//                    lo tiene que firmar el super-admin)
//   · aprobado     → «Entrar como →»
//   · revocado     → «Revocado»
//
// ⚠️ ES UN RENGLÓN Y NO UNA TARJETA. Lo que dice cabe en una línea, y una caja
// con título encima del tablero del cliente le roba el lugar a lo único que la
// ficha vino a mostrar. «Cards are the lazy container» aplicado a un dato.
//
// ⚠️ Y LO QUE SE DIBUJA NO PROTEGE NADA. Que acá diga 'aprobado' es cosmético:
// quien decide es el server en cada request (`puedeEntrarAhora`, lib/agencia.ts)
// y la puerta es `/api/agencia/entrar`, que vuelve a preguntarle a la base. Si
// el super-admin revoca mientras la ficha está abierta, el botón sigue dibujado
// y el endpoint contesta que no — que es el orden correcto de las dos capas.

import { useState } from 'react';
import type { ClienteCruce } from './cruce';
import { ROTULO_CARTERA, type EstadoCartera } from '@/lib/agencia-cartera';
import { crearCuentaMakoAction } from './actions';

export function CuentaDeMaKo({ c, cuentas, onError }: {
  c: ClienteCruce;
  cuentas?: { estadoPorWs: Record<number, string>; puedeAbrir: boolean };
  onError: (m: string) => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  // Sin el mapa no se dibuja nada. NO es lo mismo que «no tiene cuenta»: es que
  // esta pantalla no pudo saberlo, y un «Abrir cuenta» sobre un cliente que ya
  // la tiene es la peor de las dos equivocaciones posibles.
  if (!cuentas) return null;

  const ws = c.clienteWs ?? null;
  const estado = ws ? (cuentas.estadoPorWs[ws] as EstadoCartera | undefined) : undefined;

  const abrir = async () => {
    setOcupado(true);
    const r = await crearCuentaMakoAction(c.leadId);
    if (!r.ok) { onError(r.error); setOcupado(false); return; }
    // No se apaga `ocupado`: el revalidate del server va a repintar la ficha con
    // el estado nuevo, y un botón que vuelve a estar disponible mientras tanto
    // invita al segundo click que la idempotencia después rechaza.
    window.location.reload();
  };

  const entrar = async () => {
    if (!ws) return;
    setOcupado(true);
    try {
      const r = await fetch('/api/agencia/entrar', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ws }),
      });
      const j = await r.json();
      if (!j?.ok) { onError(j?.error ?? 'No se pudo entrar.'); setOcupado(false); return; }
      // Recarga dura y no `router.push`: el contexto de workspace lo resuelve el
      // SERVER desde la cookie que este fetch acaba de dejar, así que todo lo que
      // ya esté montado en el navegador es de la cuenta anterior. Es el mismo
      // motivo por el que salir de la vista también recarga.
      window.location.href = '/general';
    } catch {
      onError('No se pudo entrar.'); setOcupado(false);
    }
  };

  return (
    <div className="cmk">
      <span className="cmk-rot">Cuenta de MaKo</span>
      {!ws ? (
        cuentas.puedeAbrir
          ? <button type="button" className="cmk-btn" onClick={abrir} disabled={ocupado}>
              {ocupado ? 'Abriendo…' : 'Abrir cuenta'}
            </button>
          : <span className="cmk-no">Sin cuenta</span>
      ) : estado === 'aprobado' ? (
        <button type="button" className="cmk-btn cmk-ok" onClick={entrar} disabled={ocupado}
          title={`Ver el dashboard de ${c.nombre || 'este cliente'}`}>
          {ocupado ? 'Entrando…' : 'Entrar como →'}
        </button>
      ) : (
        // 'pendiente' y 'revocado' son estados, no acciones: no llevan botón.
        // Un botón que no hace nada se lee como que la app está rota.
        <span className={estado === 'revocado' ? 'cmk-no' : 'cmk-espera'}>
          {estado ? ROTULO_CARTERA[estado] : `Workspace ${ws}`}
        </span>
      )}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

// ⚠️ NINGÚN BACKTICK ACÁ ADENTRO, ni en un comentario: cierra la cadena a la
// mitad y la ruta contesta 200 con el layout entero y sin cuerpo.
const CSS = `
.cmk{ display:flex; align-items:center; gap:10px; margin:0 0 14px;
  padding:9px 12px; border:1px solid var(--border); border-radius:11px; background:var(--surface-2); }
.cmk-rot{ font-size:11px; letter-spacing:.07em; text-transform:uppercase; color:var(--faint); font-weight:700; }
.cmk-btn{ margin-left:auto; border:1px solid var(--border-strong); background:var(--surface); border-radius:8px;
  padding:5px 11px; font:inherit; font-size:12.5px; font-weight:600; color:var(--ink); cursor:pointer; }
.cmk-btn:hover:not(:disabled){ border-color:var(--primary); color:var(--primary); }
.cmk-btn:disabled{ opacity:.6; cursor:default; }
.cmk-ok{ border-color:var(--primary); color:var(--primary); }
.cmk-espera,.cmk-no{ margin-left:auto; font-size:12.5px; color:var(--dim); }
.cmk-espera{ color:var(--accent-soft, var(--dim)); }
`;
