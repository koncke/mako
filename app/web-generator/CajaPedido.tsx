'use client';
// =============================================================================
// CajaPedido — LA caja de «¿Qué vas a crear hoy?»: el título, la tarjeta blanca con el ejemplo que se escribe solo, el
// «+» y lo que quien monta ponga a su lado, el micrófono y el ↑ de enviar
// =============================================================================
// Nació adentro de CajaCrear.tsx (Landing Generator, 11/10/2026: la caja de Gamma 5, relevo gamma-ui §3). Salió a su
// archivo en la decimocuarta tanda de Automations (12/10/2026). Martín, textual, sobre el modal «Pídeselo a MaKo» de
// «Nueva automatización»: «Vuelve a crear el modal... y que se vea exactamente igual que en la captura... Ya lo tenemos en
// landing generator, copialo». Es la MISMA caja en las dos puertas: con dos copias, la que se arregla es una.
//
// Qué es de la caja y qué es de quien monta:
//   · de la caja: el TÍTULO («¿Qué vas a crear hoy?», `titulo`: decimoquinta tanda, punto 1, «Agrega el "¿Qué vas a
//     crear hoy?", tal cual como en la imagen»), el campo (crece hasta ~6 renglones, Enter envía y Mayús+Enter salta de
//     línea), el ejemplo que se escribe y se borra (`useEjemploQueSeEscribe`, app/automations/CrearConIA.tsx), el
//     micrófono de la casa (`BotonDictar`, app/plan/board/CrearTareaModal.tsx: en vivo y, de respaldo, grabar y
//     transcribir) y el ↑;
//   · de quien monta (`antes`): el «+» con su menú y los chips de al lado (en la landing, «Plan | Express»). Cada puerta
//     tiene sus opciones; la forma del «+» es la clase `gp-cc-mas`. Y lo que se suma al pedido: un archivo arriba del
//     campo (`adjunto`) o un flujo pegado EN LUGAR del campo (`enLugarDelCampo`, «Flujo copiado: …»), con `ChipCaja`.
//
// EL EJEMPLO VUELVE (decimoquinta tanda, punto 6). Martín, textual: «En la animación del placeholder de "¿Qué vas a crear
// hoy?", si le doy click y me salgo o al final no escribo nada, debería seguir esa animación». Hasta acá el primer toque
// lo apagaba PARA SIEMPRE (`tocada`, en cada puerta). Ahora lo decide la caja: se mueve mientras la caja NO tiene el
// foco y el campo está vacío (`seMueveElEjemplo`). Tocarla lo para (aparece `placeholderQuieto`); salir sin escribir lo
// vuelve a mover desde donde estaba. El foco es el de la CAJA entera (el micrófono y el «+» también cuentan): dictando,
// el ejemplo no se mueve debajo de lo que se dice.
//
// TANDA 7 DEL WEB GENERATOR (15/10/2026). Martín, textual: «5. Cuando vayas reemplazando el bloque de texto que está hoy
// en día, no quiero que desaparezca el diseño de ese recuadro, quiero que se mantenga igual... […] 6. […] Y ya por defecto
// el cuadro de texto en cualquier estado debe admitir un arrastre de archivo, si se arrastra se debe poner allí. 7. […] en
// el cuadro de texto, cuando pego un link y se pone en azul y al lado aparece la opción de analizar o replicar, todo eso
// debería seguir siendo el cuadro de texto, solo que esos son chips del texto... Pero si le doy a borrar, se deben borrar.
// O si quiero seguir escribiendo luego de pegar eso.» Lo nuevo entra por props OPCIONALES y sin ellas la caja es la de
// siempre (las otras puertas no cambian):
//   · `bajoTitulo`: entre el título y la caja (los modos del cuadro);
//   · `antesDelCampo`: chips EN EL MISMO RENGLÓN que el texto (el link y su pastilla), con `onBorrarAlInicio`: Backspace
//     con el cursor al principio del campo borra el último chip;
//   · `bajoElCampo`: adentro de la caja, entre el campo y la fila (la opción «Tu texto», un aviso corto);
//   · `onSoltar`: la caja recibe lo que se le ARRASTRA o se le pega como archivo (con el borde resaltado mientras pasa
//     por encima); quien monta decide qué hace y dice si lo tomó;
//   · `dictado={false}`: sin micrófono (un modo sin campo de texto); `refCampo`: para darle el foco al campo.
//
// ⚠️ LA HOJA USA LOS TOKENS DE LA LANDING (`--gp-*`, CSS_GP de MiniaturaLanding.tsx). Adentro del Landing Generator ya
// están; afuera (el modal de /automations) quien monta envuelve la caja en `.gp.cp-casa` y suma `CSS_TOKENS_CASA`, que
// los saca de los de la casa (`--surface`, `--ink`, `--border`…): así el oscuro de la casa también la da vuelta. Los
// azules son los medidos de Gamma, en claro y en oscuro.
// =============================================================================

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { useEjemploQueSeEscribe } from '@/app/automations/CrearConIA';
import { Ico } from './Ico';

/** El título de la caja, el mismo en las dos puertas (la landing y «Nueva automatización»). */
export const TITULO_CAJA = '¿Qué vas a crear hoy?';

export type PropsCajaPedido = {
  valor: string;
  onValor: (v: string) => void;
  onEnviar: () => void;
  /** Los ejemplos que se escriben solos mientras el campo está vacío y la caja no tiene el foco. */
  ejemplos: readonly string[];
  /** ¿PUEDE moverse el ejemplo? (false = quieto: hay un archivo adjunto). El foco y lo escrito los mira la caja. */
  animar: boolean;
  /** El placeholder cuando el ejemplo no se mueve. */
  placeholderQuieto: string;
  /** Qué se escribe, para lectores de pantalla. */
  etiqueta: string;
  /** El título de arriba (`TITULO_CAJA`) y su nivel: h1 en una página, h2 adentro de un modal. Sin esto, no hay título. */
  titulo?: { texto: string; nivel: 1 | 2 };
  /** Lo que va a la izquierda del micrófono: el «+» y sus chips. */
  antes?: ReactNode;
  /** Lo que va ARRIBA del campo (un archivo adjunto, con `ChipCaja`). */
  adjunto?: ReactNode;
  /** Lo que va EN LUGAR del campo (un flujo pegado: «Flujo copiado: …», con `ChipCaja`). */
  enLugarDelCampo?: ReactNode;
  /**
   * ¿Se prende el ↑? Si viene, lo decide quien monta (un archivo leído o un flujo pegado lo prenden sin texto; un archivo
   * que todavía se lee lo apaga con texto). Sin esto, con algo escrito.
   */
  listo?: boolean;
  /** El tope del pedido. */
  tope?: number;
  /** Cambiarlo vuelve a empezar el ejemplo (la landing: otra lista al pasar de Landing a Presentación). */
  reinicio?: string;
  deshabilitado?: boolean;
  /** El error del dictado (sin permiso de micrófono, no se entendió). */
  onError: (m: string | null) => void;
  /** Tanda 7: lo que va entre el título y la caja (en el Web Generator, los modos del cuadro). */
  bajoTitulo?: ReactNode;
  /**
   * Tanda 7: chips en el MISMO renglón que el texto, antes del campo (el link pegado y su pastilla). Si quien monta
   * pasa la prop (aunque sea null), el campo va en su renglón siempre: el textarea no se remonta al aparecer un chip.
   */
  antesDelCampo?: ReactNode;
  /** Tanda 7: Backspace con el cursor al principio del campo y sin selección. Devuelve true si borró un chip. */
  onBorrarAlInicio?: () => boolean;
  /** Tanda 7: adentro de la caja, entre el campo y la fila de abajo (la opción «Tu texto», un aviso corto). */
  bajoElCampo?: ReactNode;
  /**
   * Tanda 7: algo ARRASTRADO a la caja o un archivo PEGADO en ella. Devuelve true si lo tomó (si no, sigue lo del
   * navegador: un texto soltado en el campo se escribe ahí). Sin esto, la caja no recibe arrastres.
   */
  onSoltar?: (d: DataTransfer) => boolean;
  /** Tanda 7: ¿tiene micrófono? (false en un modo sin campo de texto). Por default, sí. */
  dictado?: boolean;
  /** Tanda 7: el campo, para darle el foco desde afuera (después de un chip, al volver de un contenedor). */
  refCampo?: Ref<HTMLTextAreaElement>;
  /** Tanda 7: un atributo para la hoja de quien monta (`data-modo` del form). */
  modo?: string;
};

/**
 * ¿Lo que se arrastra es algo que la caja puede tomar? (un archivo, un link, un texto). Pura y exportada para el test:
 * el `dragover` sólo se acepta con esto (si no, el navegador abre el archivo en la pestaña).
 */
export function aceptaArrastre(tipos: readonly string[]): boolean {
  return tipos.includes('Files') || tipos.includes('text/uri-list') || tipos.includes('text/plain');
}

/** El tope del pedido (el de la caja de la landing y del generador). */
export const TOPE_PEDIDO = 8_000;

/**
 * ¿Se mueve el ejemplo? (decimoquinta tanda, punto 6): si quien monta lo deja, la caja NO tiene el foco y el campo está
 * vacío. Pura y exportada para el test: tocar la caja lo para, salir sin escribir lo vuelve a mover.
 */
export function seMueveElEjemplo(animar: boolean, foco: boolean, valor: string): boolean {
  return animar && !foco && !valor;
}

export function CajaPedido(p: PropsCajaPedido) {
  const tope = p.tope ?? TOPE_PEDIDO;
  /** ¿La caja tiene el foco? (el campo, el micrófono o el «+»: `focusin`/`focusout` de React burbujean). */
  const [foco, setFoco] = useState(false);
  /**
   * Tanda 7: ¿pasa algo arrastrado por encima? Con un CONTADOR: `dragenter` y `dragleave` llegan también al pasar de un
   * hijo a otro (el campo, un chip), y con un booleano el borde parpadearía.
   */
  const [arrastre, setArrastre] = useState(false);
  const capas = useRef(0);
  const puedeEnviar = !p.deshabilitado && (p.listo ?? !!p.valor.trim());
  const Titulo = p.titulo?.nivel === 1 ? 'h1' : 'h2';
  const soltar = p.onSoltar;
  const sePuede = (d: DataTransfer) => aceptaArrastre(Array.from(d.types));
  const campo = (
    <CampoPedido
      key={p.reinicio ?? ''}
      ejemplos={p.ejemplos}
      valor={p.valor}
      mover={seMueveElEjemplo(p.animar, foco, p.valor)}
      tope={tope}
      placeholderQuieto={p.placeholderQuieto}
      etiqueta={p.etiqueta}
      deshabilitado={p.deshabilitado}
      onValor={p.onValor}
      onEnviar={() => { if (puedeEnviar) p.onEnviar(); }}
      refExterno={p.refCampo}
      onBorrarAlInicio={p.onBorrarAlInicio}
    />
  );
  return (
    <>
      {p.titulo && <Titulo className="gp-cc-titulo">{p.titulo.texto}</Titulo>}
      {p.bajoTitulo}
      <form className="gp-cc-caja" data-caja-pedido="" data-modo={p.modo} data-arrastre={arrastre ? 'si' : undefined}
        onSubmit={(e) => { e.preventDefault(); if (puedeEnviar) p.onEnviar(); }}
        onFocus={() => setFoco(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFoco(false); }}
        onDragEnter={soltar ? (e) => { if (!sePuede(e.dataTransfer)) return; capas.current += 1; setArrastre(true); } : undefined}
        onDragOver={soltar ? (e) => { if (!sePuede(e.dataTransfer)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } : undefined}
        onDragLeave={soltar ? () => { capas.current = Math.max(0, capas.current - 1); if (!capas.current) setArrastre(false); } : undefined}
        onDrop={soltar ? (e) => { capas.current = 0; setArrastre(false); if (soltar(e.dataTransfer)) e.preventDefault(); } : undefined}
        onPaste={soltar ? (e) => { if (e.clipboardData.files.length && soltar(e.clipboardData)) e.preventDefault(); } : undefined}>
        {p.adjunto && <div className="gp-cc-adjuntos">{p.adjunto}</div>}
        {/* Con `key`: el ejemplo que se escribe solo arranca de cero con la lista nueva (el hook supone una lista fija:
            cambiarla a mitad deja el largo de la frase vieja). Con `antesDelCampo` (tanda 7) el campo va en un renglón
            con los chips: después de ellos se sigue escribiendo. */}
        {p.enLugarDelCampo
          ? <div className="gp-cc-en-lugar">{p.enLugarDelCampo}</div>
          : p.antesDelCampo !== undefined
            ? <div className="gp-cc-linea">{p.antesDelCampo}{campo}</div>
            : campo}
        {p.bajoElCampo && <div className="gp-cc-bajo">{p.bajoElCampo}</div>}
        <div className="gp-cc-fila">
          {p.antes}
          {p.dictado === false
            ? <span className="gp-cc-mic" aria-hidden="true" />
            : (
              <span className="gp-cc-mic gp-mic">
                <BotonDictar titulo="Dictar el pedido" valor={p.valor} onValor={(v) => { p.onValor(v.slice(0, tope)); p.onError(null); }} onError={p.onError} />
              </span>
            )}
          <button type="submit" className="gp-cc-enviar" aria-label="Enviar" disabled={!puedeEnviar}>
            <Ico n="flecha-arriba" t={16} />
          </button>
        </div>
      </form>
    </>
  );
}

/**
 * Un CHIP de la caja: un archivo adjunto («propuesta.pdf · Leyendo…») o un flujo pegado («Flujo copiado: Bienvenida»),
 * con su ✕. `texto` va recortado con «…» si no entra.
 */
export function ChipCaja({ icono, texto, detalle, onQuitar, etiquetaQuitar, error, nombre, titulo }: {
  icono: string;
  texto: ReactNode;
  /** Lo de al lado, más tenue («Leyendo…»). */
  detalle?: string | null;
  onQuitar?: () => void;
  etiquetaQuitar?: string;
  /** El chip en rojo (no se pudo leer). */
  error?: boolean;
  /** Tanda 7: el nombre accesible del chip («Enlace: otra.com»); sin esto, lo que dice su texto. */
  nombre?: string;
  /** Tanda 7: lo que se ve al pasar el mouse (la dirección entera de un link). */
  titulo?: string;
}) {
  return (
    <span className="gp-cc-chip" data-error={error ? 'si' : undefined} role={nombre ? 'group' : undefined} aria-label={nombre} title={titulo}>
      <Ico n={icono} t={15} />
      <span className="gp-cc-chip-texto">{texto}</span>
      {detalle && <span className="gp-cc-chip-detalle">{detalle}</span>}
      {onQuitar && (
        <button type="button" aria-label={etiquetaQuitar ?? 'Quitar'} title={etiquetaQuitar ?? 'Quitar'} onClick={onQuitar}>
          <Ico n="cerrar" t={13} />
        </button>
      )}
    </span>
  );
}

/**
 * El campo del pedido. Crece con lo que tiene (hasta ~6 renglones), también cuando lo llena el dictado, que no
 * dispara `onInput`. Enter envía y Mayús+Enter hace un salto de línea.
 */
function CampoPedido({ ejemplos, valor, mover, tope, placeholderQuieto, etiqueta, deshabilitado, onValor, onEnviar, refExterno, onBorrarAlInicio }: {
  ejemplos: readonly string[];
  valor: string;
  /** ¿Se mueve el ejemplo ahora? (`seMueveElEjemplo`). Si para, retoma desde donde quedó. */
  mover: boolean;
  tope: number;
  placeholderQuieto: string;
  etiqueta: string;
  deshabilitado?: boolean;
  onValor: (v: string) => void;
  onEnviar: () => void;
  refExterno?: Ref<HTMLTextAreaElement>;
  onBorrarAlInicio?: () => boolean;
}) {
  const ejemplo = useEjemploQueSeEscribe(mover, ejemplos);
  const ref = useRef<HTMLTextAreaElement>(null);
  // El campo es de la caja (lo mide para crecer) y, si quien monta lo pide, también suyo (`refCampo`).
  const unirRef = useCallback((el: HTMLTextAreaElement | null) => {
    ref.current = el;
    if (typeof refExterno === 'function') refExterno(el);
    else if (refExterno) refExterno.current = el;
  }, [refExterno]);
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
      ref={unirRef}
      className="gp-cc-entrada"
      value={valor}
      rows={2}
      maxLength={tope}
      disabled={deshabilitado}
      placeholder={mover ? ejemplo : placeholderQuieto}
      aria-label={etiqueta}
      onChange={(e) => onValor(e.target.value)}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing) return;
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnviar(); return; }
        // Tanda 7 (punto 7: «si le doy a borrar, se deben borrar»): con el cursor al principio, Backspace borra el último chip.
        const t = e.currentTarget;
        if (e.key === 'Backspace' && onBorrarAlInicio && t.selectionStart === 0 && t.selectionEnd === 0 && onBorrarAlInicio()) e.preventDefault();
      }}
    />
  );
}

/**
 * La hoja de la caja (tokens de CSS_GP; las medidas, las de la caja de Gamma 5 del relevo). El micrófono es `BotonDictar`
 * con sus estilos EN LÍNEA (42px, radio 11): para que sea un círculo de 34 como el «+» y el ↑, la hoja le pisa SÓLO el
 * tamaño y el radio con `!important` (un `!important` de hoja le gana a un estilo en línea sin él). Los colores de
 * «escuchando» siguen siendo los suyos: son la única señal de que el micrófono está abierto.
 * El título (decimoquinta tanda, punto 1) vivía en la hoja de CajaCrear.tsx: es de la caja, va en las dos puertas.
 */
export const CSS_CAJA_PEDIDO = `
.gp .gp-cc-titulo { margin: 0; text-align: center; font-size: 34px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; color: var(--gp-titulo); }
.gp .gp-cc-caja { width: 100%; max-width: 720px; border-radius: 14px; background: var(--gp-superficie); box-shadow: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -2px rgba(0,0,0,.04); border: 1px solid var(--gp-borde-suave); }
.gp .gp-cc-caja:focus-within { border-color: var(--gp-azul-300); }
.gp .gp-cc-entrada { display: block; width: 100%; min-height: 64px; padding: 16px 18px 6px; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 16px; line-height: 1.5; resize: none; outline: none; overflow-y: auto; }
.gp .gp-cc-entrada::placeholder { color: var(--gp-debil); }
.gp .gp-cc-adjuntos { display: flex; flex-wrap: wrap; gap: 6px; padding: 12px 14px 0; }
.gp .gp-cc-en-lugar { display: flex; align-items: center; min-height: 64px; padding: 14px 14px 6px; }
.gp .gp-cc-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; min-height: 30px; padding: 4px 6px 4px 10px; box-sizing: border-box; border-radius: 9999px; background: var(--gp-azul-50); color: var(--gp-azul-600); font-size: 13.5px; font-weight: 500; line-height: 1.3; }
.gp .gp-cc-chip[data-error="si"] { background: transparent; color: var(--gp-error, #dc2626); box-shadow: inset 0 0 0 1px currentColor; }
.gp .gp-cc-chip-texto { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gp .gp-cc-chip-detalle { flex: none; opacity: .75; }
.gp .gp-cc-chip button { display: grid; place-items: center; flex: none; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 9999px; background: transparent; color: inherit; cursor: pointer; }
.gp .gp-cc-chip button:hover { background: rgba(0,0,0,.06); }
.gp .gp-cc-fila { display: flex; align-items: center; gap: 8px; padding: 8px 10px 10px; }
.gp .gp-cc-mas { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 0; border-radius: 9999px; background: var(--gp-azul-50); color: var(--gp-azul-600); cursor: pointer; }
[data-tema="oscuro"] .gp .gp-cc-mas { background: #0b2e79; color: #aad5fe; }
.gp .gp-cc-mic { display: inline-flex; margin-left: auto; flex: none; }
.gp .gp-mic > button { width: 34px !important; height: 34px !important; border-radius: 9999px !important; }
.gp .gp-cc-enviar { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 0; border-radius: 9999px; background: var(--gp-azul-500); color: #fff; cursor: pointer; }
.gp .gp-cc-enviar:disabled { background: var(--gp-borde); cursor: not-allowed; }
@media (max-width: 760px) { .gp .gp-cc-titulo { font-size: 28px; } }

/* Tanda 7. Los chips en el renglón del texto: la misma caja, con el campo después de ellos. Los paddings suman los
   del campo de siempre (16 arriba, 18 al costado) y su alto, el mismo: la caja vacía mide lo mismo con y sin chips. */
.gp .gp-cc-linea { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 6px; padding: 12px 14px 0; }
.gp .gp-cc-linea > .gp-cc-entrada { flex: 1 1 120px; width: auto; min-width: 120px; min-height: 58px; padding: 4px 4px 6px; }
.gp .gp-cc-linea > .gp-cc-chip, .gp .gp-cc-linea .gp-pildora { min-height: 32px; }
.gp .gp-cc-bajo { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 2px 14px 0; }
/* Algo arrastrado por encima: el borde y un tinte, para que se vea dónde cae. */
.gp .gp-cc-caja[data-arrastre="si"] { border-color: var(--gp-azul-500); background: var(--gp-azul-50); box-shadow: 0 0 0 3px rgba(44,136,247,.18), 0 10px 15px -3px rgba(0,0,0,.08); }
`;

/**
 * LOS TOKENS DE LA CAJA FUERA DE LA LANDING (el modal de /automations): las superficies, el texto y los bordes, de la
 * casa (se dan vuelta solos en oscuro); los azules, los de Gamma. Va con la clase `cp-casa` junto a `gp`. El hueco entre
 * el título y la caja es el de la landing (`.gp-cc`, 16px).
 */
export const CSS_TOKENS_CASA = `
.gp.cp-casa {
  --gp-azul-50: #ebf3fe; --gp-azul-300: #84c1fa; --gp-azul-500: #2c88f7; --gp-azul-600: #0858f7;
  --gp-superficie: var(--surface); --gp-borde-suave: var(--border); --gp-borde: var(--border-strong);
  --gp-texto: var(--ink); --gp-debil: var(--faint); --gp-titulo: var(--ink); --gp-error: var(--bad);
  display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; color: var(--gp-texto);
}
[data-tema="oscuro"] .gp.cp-casa { --gp-azul-50: #0b2e79; --gp-azul-600: #aad5fe; }
.gp.cp-casa, .gp.cp-casa * { box-sizing: border-box; }
.gp.cp-casa button { font: inherit; }
.gp.cp-casa .gp-ico { display: inline-flex; flex: none; line-height: 0; }
.gp.cp-casa .gp-ico svg { display: block; }
`;
