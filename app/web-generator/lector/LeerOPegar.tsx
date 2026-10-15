'use client';

// =============================================================================
// LeerOPegar — la salida cuando MaKo no puede leer una página sola: leerla en TU navegador o pegar su texto
// =============================================================================
// Pedido de Martín (14/10/2026): «El mimso error que nos saltaba con Mauricio "No pude leer el texto de esa
// página.". Soluciona eso...». Ese mensaje era un callejón sin salida: la página (una app de Vite/React, o
// una que le contesta 403 a nuestro servidor) no se podía leer desde el server y la pantalla no ofrecía
// nada más. Ahora, cuando el server contesta `enNavegador` (lectura-tipos.ts), esto ofrece:
//   · «Leer en tu navegador»: el lector de la tanda 6 (useLectorEnNavegador: con el Pixel si está, y si no
//     en una ventana emergente). Si las emergentes están bloqueadas NO se abre nada y se ve el aviso con
//     la flecha (decisión de Martín, «no continue, no abra la página, sino que indique dentro de MaKo que
//     lo tiene que habilitar»);
//   · «Pega el texto»: el campo de siempre. También si el navegador tampoco encontró texto (palabras 0:
//     una app que no corre aislada), que es la única salida que queda.
// Lo usan el Diagnóstico (Analizar, diagnostico/PanelDiagnostico.tsx) y Replicar (crear/Replicar.tsx). Quien
// monta decide qué hacer con la lectura o el texto (`onLectura`, `onTexto`): el mismo pedido de antes con
// el campo `lectura` o `texto`.
//
// TANDA 7 (15/10/2026). Martín: «Si no pudo leer la landing, no me debe saltar el botón de "MaKo no pudo leerla
// sola" y las opciones de leer en tu navegador... Por defecto si no pudo de una manera que vaya directo a abrir la
// ventana emergente y a analizar la landing». En el camino normal esto YA NO SE VE: la ventana se abre en el clic
// de Analizar o Replicar y la lectura vuelve sola (`pedirConVentana`, lib/editor-landing/lector-navegador.ts).
// Queda como la SALIDA de un fallo de ese camino, y `salida` dice cuál: `bloqueadas` (el aviso con la flecha ya a
// la vista), `vacia` (se leyó y no había texto: recién ahí se pega), o la ventana que se cerró o no contestó (la
// línea de por qué, y el botón para reintentar). Sin `salida`: la ventana nunca se abrió (un arranque sin clic,
// o la cerró la persona antes de que contestara el server) y es la pantalla de antes.
//
// ⚠️ `leer(url)` SE LLAMA DIRECTO EN EL `onClick`, SIN NINGÚN `await` ANTES: la ventana se abre en el clic
//    (lib/editor-landing/lector-navegador.ts). Con una espera antes (un pedido al server), la activación del
//    clic puede vencer y Chrome la bloquea aunque la persona tenga las emergentes habilitadas: el aviso
//    le diría algo falso.
// Va adentro de `.gp` (CSS_GP de MiniaturaLanding.tsx: los botones y los tokens `--gp-*`).
// =============================================================================

import { useState } from 'react';
import type { Lectura } from '@/lib/editor-landing/lectura-tipos';
import type { SalidaSinLectura } from '@/lib/editor-landing/lector-navegador';
import { Ico } from '../Ico';
import { useLectorEnNavegador } from './useLectorEnNavegador';

/** Lo que se dibuja (corto: es un rótulo o una línea). */
export const TEXTO_NO_PUDO = 'MaKo no pudo leerla sola.';
export const BOTON_LEER = 'Leer en tu navegador';
export const BOTON_PEGAR = 'Pega el texto';
export const SIN_TEXTO_EN_NAVEGADOR = 'Tampoco mostró texto. Pégalo aquí.';

export function LeerOPegar({ url, error, enNavegador, ocupado, accionTexto, texto, salida = null, onLectura, onTexto }: {
  /** La página TAL CUAL la pegó la persona (con su www y su query). */
  url: string;
  /** El error del server (se muestra cuando no hay lector que ofrecer). */
  error: string;
  /** El server contestó `enNavegador`: se ofrece el lector. Sin esto, sólo pegar. */
  enNavegador: boolean;
  /** Algo se está pidiendo (los botones se apagan). */
  ocupado: boolean;
  /** El botón del texto pegado («Analizar este texto», «Replicar este texto»). */
  accionTexto: string;
  /** La línea de arriba cuando se ofrece el lector, si hace falta decir para qué (dos cajas en una pantalla). */
  texto?: string;
  /** Tanda 7: por qué no se leyó SIN clic en la ventana del clic (ver la cabecera), o null. */
  salida?: SalidaSinLectura | null;
  onLectura: (l: Lectura) => void;
  onTexto: (texto: string) => void;
}) {
  const { leer, leyendo, aviso } = useLectorEnNavegador({ bloqueadas: salida?.motivo === 'bloqueadas' });
  const [pegar, setPegar] = useState(!enNavegador || salida?.motivo === 'vacia');
  const [pegado, setPegado] = useState('');
  // 'bloqueadas' ya lo dice el aviso con la flecha; sin texto, la misma línea que con el botón; lo demás, su línea.
  const [nota, setNota] = useState<string | null>(
    !salida || salida.motivo === 'bloqueadas' ? null : salida.motivo === 'vacia' ? SIN_TEXTO_EN_NAVEGADOR : salida.mensaje,
  );

  const leerAhora = () => {
    setNota(null);
    // Directo en el clic (ver la cabecera): primero la ventana, después todo lo demás.
    void leer(url).then((r) => {
      if (!r.ok) {
        // 'bloqueadas' ya lo dice el aviso con la flecha; lo demás, una línea.
        if (r.motivo !== 'bloqueadas') setNota(r.mensaje);
        return;
      }
      if (r.detalle.palabras === 0) { setNota(SIN_TEXTO_EN_NAVEGADOR); setPegar(true); return; }
      onLectura(r.lectura);
    });
  };

  return (
    <div className="gp-leer" role="group" aria-label="Leer la página">
      <style href="gp-leer" precedence="medium">{CSS_LEER}</style>
      <p className="gp-leer-error" role="alert">{enNavegador ? texto ?? TEXTO_NO_PUDO : error}</p>
      <div className="gp-leer-acciones">
        {enNavegador && (
          <button type="button" className="gp-btn gp-btn-primario" disabled={ocupado || leyendo} onClick={leerAhora}>
            {leyendo ? <span className="gp-giro" aria-hidden /> : <Ico n="globo" t={14} />} {leyendo ? 'Leyendo…' : BOTON_LEER}
          </button>
        )}
        {!pegar && (
          <button type="button" className="gp-btn gp-btn-contorno" disabled={leyendo} onClick={() => setPegar(true)}>
            <Ico n="pegar" t={14} /> {BOTON_PEGAR}
          </button>
        )}
      </div>
      {nota && <p className="gp-leer-nota">{nota}</p>}
      {pegar && (
        <div className="gp-leer-pegar">
          <textarea
            className="gp-campo gp-leer-texto"
            value={pegado}
            rows={6}
            maxLength={60_000}
            placeholder="Pega aquí el texto de la página, de arriba a abajo"
            aria-label="Texto de la página"
            onChange={(e) => setPegado(e.target.value)}
          />
          <button type="button" className="gp-btn gp-btn-primario" disabled={ocupado || !pegado.trim()} onClick={() => onTexto(pegado.trim())}>
            {accionTexto}
          </button>
        </div>
      )}
      {aviso}
    </div>
  );
}

/** La hoja (tokens de CSS_GP, con respaldo: el Diagnóstico la monta adentro de `.gdg`). */
const CSS_LEER = `
.gp .gp-leer { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 12px 14px; border-radius: 12px; border: 1px solid var(--gp-borde-suave, #ececed); background: var(--gp-superficie, #fff); }
.gp .gp-leer-error { margin: 0; font-size: 14px; font-weight: 600; color: var(--gp-titulo, #002253); }
.gp .gp-leer-acciones { display: flex; flex-wrap: wrap; gap: 8px; }
.gp .gp-leer-nota { margin: 0; font-size: 13px; color: var(--gp-tenue, #66666b); }
.gp .gp-leer-pegar { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; width: 100%; }
.gp .gp-leer-texto { width: 100%; min-height: 120px; }
`;
