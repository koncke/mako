'use client';
// =============================================================================
// CajaPedido — LA caja de «¿Qué vas a crear hoy?»: la tarjeta blanca con el ejemplo que se escribe solo, el «+» y lo
// que quien monta ponga a su lado, el micrófono y el ↑ de enviar
// =============================================================================
// Nació adentro de CajaCrear.tsx (Landing Generator, 11/10/2026: la caja de Gamma 5, relevo gamma-ui §3). Salió a su
// archivo en la decimocuarta tanda de Automations (12/10/2026). Martín, textual, sobre el modal «Pídeselo a MaKo» de
// «Nueva automatización»: «Vuelve a crear el modal... y que se vea exactamente igual que en la captura... Ya lo tenemos en
// landing generator, copialo». Es la MISMA caja en las dos puertas: con dos copias, la que se arregla es una.
//
// Qué es de la caja y qué es de quien monta:
//   · de la caja: el campo (crece hasta ~6 renglones, Enter envía y Mayús+Enter salta de línea), el ejemplo que se
//     escribe y se borra (`useEjemploQueSeEscribe`, app/automations/CrearConIA.tsx: para del todo al primer toque), el
//     micrófono de la casa (`BotonDictar`, app/plan/board/CrearTareaModal.tsx: en vivo y, de respaldo, grabar y
//     transcribir) y el ↑;
//   · de quien monta (`antes`): el «+» con su menú y los chips de al lado (en la landing, «Plan | Express»). Cada puerta
//     tiene sus opciones; la forma del «+» es la clase `gp-cc-mas`.
//
// ⚠️ LA HOJA USA LOS TOKENS DE LA LANDING (`--gp-*`, CSS_GP de MiniaturaLanding.tsx). Adentro del Landing Generator ya
// están; afuera (el modal de /automations) quien monta envuelve la caja en `.gp.cp-casa` y suma `CSS_TOKENS_CASA`, que
// los saca de los de la casa (`--surface`, `--ink`, `--border`…): así el oscuro de la casa también la da vuelta. Los
// azules son los medidos de Gamma, en claro y en oscuro.
// =============================================================================

import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { useEjemploQueSeEscribe } from '@/app/automations/CrearConIA';
import { Ico } from './Ico';

export type PropsCajaPedido = {
  valor: string;
  onValor: (v: string) => void;
  onEnviar: () => void;
  /** Los ejemplos que se escriben solos mientras el campo está vacío y nadie lo tocó. */
  ejemplos: readonly string[];
  /** ¿Se mueve el ejemplo? (false para siempre al primer toque: lo decide quien monta). */
  animar: boolean;
  /** El placeholder cuando el ejemplo ya paró. */
  placeholderQuieto: string;
  /** Qué se escribe, para lectores de pantalla. */
  etiqueta: string;
  /** El primer toque al campo (para el ejemplo). */
  onTocar: () => void;
  /** Lo que va a la izquierda del micrófono: el «+» y sus chips. */
  antes?: ReactNode;
  /** El tope del pedido. */
  tope?: number;
  /** Cambiarlo vuelve a empezar el ejemplo (la landing: otra lista al pasar de Landing a Presentación). */
  reinicio?: string;
  deshabilitado?: boolean;
  /** El error del dictado (sin permiso de micrófono, no se entendió). */
  onError: (m: string | null) => void;
};

/** El tope del pedido (el de la caja de la landing y del generador). */
export const TOPE_PEDIDO = 8_000;

export function CajaPedido(p: PropsCajaPedido) {
  const tope = p.tope ?? TOPE_PEDIDO;
  return (
    <form className="gp-cc-caja" data-caja-pedido="" onSubmit={(e) => { e.preventDefault(); if (!p.deshabilitado) p.onEnviar(); }}>
      {/* Con `key`: el ejemplo que se escribe solo arranca de cero con la lista nueva (el hook supone una lista fija:
          cambiarla a mitad deja el largo de la frase vieja). */}
      <CampoPedido
        key={p.reinicio ?? ''}
        ejemplos={p.ejemplos}
        valor={p.valor}
        animar={p.animar}
        tope={tope}
        placeholderQuieto={p.placeholderQuieto}
        etiqueta={p.etiqueta}
        deshabilitado={p.deshabilitado}
        onValor={p.onValor}
        onTocar={p.onTocar}
        onEnviar={() => { if (!p.deshabilitado) p.onEnviar(); }}
      />
      <div className="gp-cc-fila">
        {p.antes}
        <span className="gp-cc-mic gp-mic">
          <BotonDictar titulo="Dictar el pedido" valor={p.valor} onValor={(v) => { p.onValor(v.slice(0, tope)); p.onTocar(); p.onError(null); }} onError={p.onError} />
        </span>
        <button type="submit" className="gp-cc-enviar" aria-label="Enviar" disabled={!!p.deshabilitado || !p.valor.trim()}>
          <Ico n="flecha-arriba" t={16} />
        </button>
      </div>
    </form>
  );
}

/**
 * El campo del pedido. Crece con lo que tiene (hasta ~6 renglones), también cuando lo llena el dictado, que no
 * dispara `onInput`. Enter envía y Mayús+Enter hace un salto de línea.
 */
function CampoPedido({ ejemplos, valor, animar, tope, placeholderQuieto, etiqueta, deshabilitado, onValor, onTocar, onEnviar }: {
  ejemplos: readonly string[];
  valor: string;
  animar: boolean;
  tope: number;
  placeholderQuieto: string;
  etiqueta: string;
  deshabilitado?: boolean;
  onValor: (v: string) => void;
  onTocar: () => void;
  onEnviar: () => void;
}) {
  const ejemplo = useEjemploQueSeEscribe(animar, ejemplos);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    // ⚠️ ESCONDIDA NO SE MIDE (la trampa de la decimotercera tanda, docs/hallazgos-chatbot.md): un modal recién montado se
    // pinta con `display: none` hasta que entra en la pila, y ahí `scrollHeight` da 0. Fijar `height: 0px` dejaba el campo
    // colapsado hasta la próxima tecla. Con 0 queda el alto natural (`rows={2}`), que es el de la caja vacía.
    if (!t.scrollHeight) return;
    t.style.height = `${Math.min(t.scrollHeight, 168)}px`;
  }, [valor]);
  return (
    <textarea
      ref={ref}
      className="gp-cc-entrada"
      value={valor}
      rows={2}
      maxLength={tope}
      disabled={deshabilitado}
      placeholder={animar ? ejemplo : placeholderQuieto}
      aria-label={etiqueta}
      onPointerDown={onTocar}
      onFocus={onTocar}
      onChange={(e) => onValor(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onEnviar(); } }}
    />
  );
}

/**
 * La hoja de la caja (tokens de CSS_GP; las medidas, las de la caja de Gamma 5 del relevo). El micrófono es `BotonDictar`
 * con sus estilos EN LÍNEA (42px, radio 11): para que sea un círculo de 34 como el «+» y el ↑, la hoja le pisa SÓLO el
 * tamaño y el radio con `!important` (un `!important` de hoja le gana a un estilo en línea sin él). Los colores de
 * «escuchando» siguen siendo los suyos: son la única señal de que el micrófono está abierto.
 */
export const CSS_CAJA_PEDIDO = `
.gp .gp-cc-caja { width: 100%; max-width: 720px; border-radius: 14px; background: var(--gp-superficie); box-shadow: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -2px rgba(0,0,0,.04); border: 1px solid var(--gp-borde-suave); }
.gp .gp-cc-caja:focus-within { border-color: var(--gp-azul-300); }
.gp .gp-cc-entrada { display: block; width: 100%; min-height: 64px; padding: 16px 18px 6px; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 16px; line-height: 1.5; resize: none; outline: none; overflow-y: auto; }
.gp .gp-cc-entrada::placeholder { color: var(--gp-debil); }
.gp .gp-cc-fila { display: flex; align-items: center; gap: 8px; padding: 8px 10px 10px; }
.gp .gp-cc-mas { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 0; border-radius: 9999px; background: var(--gp-azul-50); color: var(--gp-azul-600); cursor: pointer; }
[data-tema="oscuro"] .gp .gp-cc-mas { background: #0b2e79; color: #aad5fe; }
.gp .gp-cc-mic { display: inline-flex; margin-left: auto; flex: none; }
.gp .gp-mic > button { width: 34px !important; height: 34px !important; border-radius: 9999px !important; }
.gp .gp-cc-enviar { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 0; border-radius: 9999px; background: var(--gp-azul-500); color: #fff; cursor: pointer; }
.gp .gp-cc-enviar:disabled { background: var(--gp-borde); cursor: not-allowed; }
`;

/**
 * LOS TOKENS DE LA CAJA FUERA DE LA LANDING (el modal de /automations): las superficies, el texto y los bordes, de la
 * casa (se dan vuelta solos en oscuro); los azules, los de Gamma. Va con la clase `cp-casa` junto a `gp`.
 */
export const CSS_TOKENS_CASA = `
.gp.cp-casa {
  --gp-azul-50: #ebf3fe; --gp-azul-300: #84c1fa; --gp-azul-500: #2c88f7; --gp-azul-600: #0858f7;
  --gp-superficie: var(--surface); --gp-borde-suave: var(--border); --gp-borde: var(--border-strong);
  --gp-texto: var(--ink); --gp-debil: var(--faint);
  display: flex; flex-direction: column; align-items: center; width: 100%; color: var(--gp-texto);
}
[data-tema="oscuro"] .gp.cp-casa { --gp-azul-50: #0b2e79; --gp-azul-600: #aad5fe; }
.gp.cp-casa, .gp.cp-casa * { box-sizing: border-box; }
.gp.cp-casa button { font: inherit; }
.gp.cp-casa .gp-ico { display: inline-flex; flex: none; line-height: 0; }
.gp.cp-casa .gp-ico svg { display: block; }
`;
