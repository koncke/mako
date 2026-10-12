'use client';

// =============================================================================
// CajaCrear — «¿Qué vas a crear hoy?»: la caja de Gamma 5 con Landing | Presentación,
// el dictado por voz y, debajo, las plantillas del tipo elegido
// =============================================================================
// Pedido de Martín (11/10/2026, tanda 2, punto 6), textual: «Al momento de crear nuevo tengo
// que elegir si crear landing, presentación... Sería bueno que ahí aparezcan los templates
// (deberías hacer más templates de presentaciones)... Y también quiero ahí mismo agregar la
// funcionalidad que tenemos en "nueva automatización", donde le escribo a la IA o le mando un
// audio, pero me gusta el formato que hiciste de "¿Qué vas a crear hoy?", solo falta agregar
// la funcionalidad de dictarle con audio, como lo tenemos en donde te mencioné.»
// Decisión T4 de docs/diseno-editor-landing.md.
//
// Qué tiene, de arriba abajo (relevo gamma-ui §3, la caja de Gamma 5):
//   · el título grande y la caja blanca (el formato que a Martín le gustó);
//   · adentro, el pedido con el ejemplo que se ESCRIBE SOLO (`useEjemploQueSeEscribe`, el de
//     «Nueva automatización»: para del todo al primer toque y no vuelve);
//   · la fila de abajo: «+» (Importar archivo o URL · Usar plantilla · y, en una landing, Del
//     generador anterior: los borradores de landing_drafts, `DialogoBorradores` de
//     MiniaturaLanding.tsx, que el Panel sacó de su fila de botones), Plan | Express, el
//     MICRÓFONO y el ↑ de enviar. El micrófono es `BotonDictar` (app/plan/board/
//     CrearTareaModal.tsx), el MISMO de «Nueva automatización»: en vivo con el reconocimiento
//     del navegador y, de respaldo, grabar y transcribir. Se importa, no se copia: con dos
//     copias, la que se arregla es una;
//   · las pastillas Landing | Presentación (los «chips de formato» de Gamma, debajo de la caja);
//   · las plantillas del tipo elegido con su miniatura: tocar una CREA y ABRE (navegación dura:
//     lo que cambió es QUÉ EXISTE).
//
// Enviar no genera acá: deja el pedido (`dejarCaja`) y abre el generador (crear/CrearConIA.tsx)
// con el modo y el TIPO en la URL (`rutaCaja`, crear/tipo.ts); Plan muestra el esquema para
// aprobar y Express genera directo. Lo que cambia con el tipo (el `formato` del alta, los
// parámetros de la IA, la palabra «diapositiva») vive en crear/tipo.ts y lo usan las dos puertas.
//
// Dónde va: adentro de `.gma.gp` con CSS_GP (MiniaturaLanding.tsx) y la hoja del contenido
// (`CSS_CONTENIDO`, la pone la página del Panel) — es lo que tiene el Panel. Trae SU hoja
// (`CSS_CAJA` + las pastillas) y no depende de las clases del Panel.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useRouter, useWs } from '@/app/_ui/Link';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { useEjemploQueSeEscribe } from '@/app/automations/CrearConIA';
import { tarjetasDe, type JsonNodo } from '@/lib/editor-landing/doc';
import { formatoDe } from '@/lib/editor-landing/api-tipos';
import { temaPorId } from '@/lib/editor-landing/temas';
import {
  DialogoBorradores, Desplegable, Ico, ItemMenu, MenuFlotante, MiniaturaLanding, SeparadorMenu, dejarCaja, irDuro,
  marcarReciente, pedirDocs, useAviso,
} from './MiniaturaLanding';
import {
  EJEMPLOS_CAJA, docDe, pedidoDePlantilla, plantillasDe, rutaCaja, rutaPaso, type PlantillaCrear, type TipoCrear,
} from './crear/tipo';
import { CSS_TIPO, SelectorTipo } from './crear/PiezasTipo';

export type PropsCajaCrear = {
  /** El tipo con el que abre (por ejemplo, el de `?tipo=` de la query). Sin él, una landing. */
  tipoInicial?: TipoCrear;
};

/** El placeholder cuando el ejemplo ya paró (el de la caja de Gamma). */
const PLACEHOLDER_QUIETO = '¿Qué quieres crear?';
/** El tope del pedido (el mismo de la caja de antes y del generador). */
const TOPE_PEDIDO = 8_000;

export default function CajaCrear({ tipoInicial = 'landing' }: PropsCajaCrear) {
  const router = useRouter();
  const ws = useWs();
  const { avisar, nodo: aviso } = useAviso();
  const [tipo, setTipo] = useState<TipoCrear>(tipoInicial);
  const [pedido, setPedido] = useState('');
  const [modo, setModo] = useState<'plan' | 'express'>('plan');
  /** El ejemplo ya no se mueve: alguien tocó la caja. No vuelve. */
  const [tocada, setTocada] = useState(false);
  const [menuMas, setMenuMas] = useState<HTMLElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** La plantilla que se está creando (una a la vez: un doble clic no crea dos). */
  const [creando, setCreando] = useState<string | null>(null);
  const [muestras, setMuestras] = useState<Partial<Record<TipoCrear, Record<string, JsonNodo | null>>>>({});
  const plantillasRef = useRef<HTMLElement>(null);
  const cerrarMas = useCallback(() => setMenuMas(null), []);
  /** «Del generador anterior» abierto (con la hora de cuando se abrió, para el «hace…»), o null. */
  const [borradores, setBorradores] = useState<number | null>(null);
  const cerrarBorradores = useCallback(() => setBorradores(null), []);

  // `contenido()` arma ids NUEVOS en cada llamada: las muestras se arman después de montar (si
  // no, el HTML del server y el del navegador no coincidirían), y sólo las del tipo que se ve.
  useEffect(() => {
    if (muestras[tipo]) return;
    const m = Object.fromEntries(plantillasDe(tipo).map((p) => {
      const pagina = p.contenido().paginas[0];
      return [p.id, pagina ? tarjetasDe(pagina)[0] ?? null : null];
    }));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMuestras((x) => ({ ...x, [tipo]: m }));
  }, [tipo, muestras]);

  const parar = () => { if (!tocada) setTocada(true); };

  const enviar = () => {
    const p = pedido.trim();
    if (!p) return;
    // Sin sessionStorage (ventana privada estricta), el pedido viaja en la URL, recortado.
    const guardado = dejarCaja({ prompt: p, modo });
    router.push(rutaCaja(tipo, modo, p, guardado));
  };

  /** Crear desde una plantilla y abrirla: lo que cambió es QUÉ EXISTE, así que la navegación es dura. */
  const usar = async (p: PlantillaCrear) => {
    if (creando) return;
    setCreando(p.id);
    const r = await pedirDocs(pedidoDePlantilla(p));
    if (!r.ok) { setCreando(null); avisar('No se pudo crear'); console.error('[caja crear] plantilla', p.id, r.error); return; }
    marcarReciente(r.doc.id);
    irDuro(`/landing-generator/${r.doc.id}`, ws);
  };

  const irAPlantillas = () => {
    setMenuMas(null);
    const el = plantillasRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.querySelector<HTMLButtonElement>('.gp-cc-plantilla')?.focus({ preventScroll: true });
  };

  const lista = plantillasDe(tipo);
  const m = muestras[tipo];

  return (
    <section className="gp-cc" aria-label="Crear">
      <style dangerouslySetInnerHTML={{ __html: CSS_TIPO + CSS_CAJA }} />
      <h1 className="gp-cc-titulo">¿Qué vas a crear hoy?</h1>

      <form className="gp-cc-caja" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
        {/* Con `key`: el ejemplo que se escribe solo arranca de cero con la lista del tipo nuevo
            (el hook supone una lista fija: cambiarla a mitad deja el largo de la frase vieja). */}
        <CampoPedido
          key={tipo}
          tipo={tipo}
          valor={pedido}
          animar={!tocada && !pedido}
          onValor={(v) => { setPedido(v); parar(); }}
          onTocar={parar}
          onEnviar={enviar}
        />
        <div className="gp-cc-fila">
          <button
            type="button"
            className="gp-cc-mas"
            aria-label="Agregar"
            aria-haspopup="menu"
            aria-expanded={!!menuMas}
            onClick={(e) => setMenuMas(menuMas ? null : e.currentTarget)}
          >
            <Ico n="mas" t={16} />
          </button>
          <Desplegable
            etiqueta="Modo"
            valor={modo}
            onCambio={setModo}
            ancho={300}
            opciones={[
              { valor: 'plan', texto: 'Plan', etiqueta: 'Predeterminado', sub: 'Revisa el esquema antes de crear', icono: 'lista' },
              { valor: 'express', texto: 'Express', sub: 'Más rápido, sin revisar el esquema', icono: 'rayo' },
            ]}
          />
          <span className="gp-cc-mic gp-mic">
            <BotonDictar titulo="Dictar el pedido" valor={pedido} onValor={(v) => { setPedido(v.slice(0, TOPE_PEDIDO)); parar(); setError(null); }} onError={setError} />
          </span>
          <button type="submit" className="gp-cc-enviar" aria-label="Enviar" disabled={!pedido.trim()}>
            <Ico n="flecha-arriba" t={16} />
          </button>
        </div>
      </form>
      {error && <p className="gp-error gp-cc-error" role="alert">{error}</p>}

      <SelectorTipo valor={tipo} onCambio={setTipo} deshabilitado={!!creando} />

      <section className="gp-cc-plantillas" ref={plantillasRef} aria-labelledby="gp-cc-plantillas-titulo">
        <h2 id="gp-cc-plantillas-titulo" className="gp-cc-subtitulo">Plantillas</h2>
        <div className="gp-cc-grilla">
          {lista.map((p) => (
            <button
              key={p.id}
              type="button"
              className="gp-cc-plantilla"
              disabled={!!creando}
              data-creando={creando === p.id ? 'si' : undefined}
              aria-label={`Crear ${docDe(tipo)} con la plantilla ${p.nombre}`}
              onClick={() => void usar(p)}
            >
              <div className="gp-cc-mini">
                {m
                  ? <MiniaturaLanding tarjeta={m[p.id] ?? null} tema={temaPorId(p.tema)} formato={formatoDe(p)} proporcion={p.proporcion} />
                  : <div className="gp-mini gp-brillo" style={{ aspectRatio: tipo === 'presentacion' ? '16 / 9' : '16 / 10' }} />}
                {creando === p.id
                  ? <span className="gp-cc-usar" data-visible="si"><span className="gp-giro" /> Creando</span>
                  : <span className="gp-cc-usar">Usar plantilla</span>}
              </div>
              <span className="gp-cc-nombre">{p.nombre}</span>
              <span className="gp-cc-desc">{p.descripcion}</span>
            </button>
          ))}
        </div>
      </section>

      {menuMas && (
        <MenuFlotante ancla={menuMas} onCerrar={cerrarMas} ancho={260}>
          <ItemMenu icono="subir" texto="Importar archivo o URL" sub="PowerPoint, Word, PDF o una página web" onClick={() => { setMenuMas(null); router.push(rutaPaso(tipo, 'importar')); }} />
          <ItemMenu icono="plantillas" texto="Usar plantilla" onClick={irAPlantillas} />
          {tipo === 'landing' && (
            <>
              <SeparadorMenu />
              <ItemMenu icono="historial" texto="Del generador anterior" sub="Tus borradores del Landing Generator" onClick={() => { setMenuMas(null); setBorradores(Date.now()); }} />
            </>
          )}
        </MenuFlotante>
      )}
      {borradores !== null && <DialogoBorradores onCerrar={cerrarBorradores} ws={ws} ahora={borradores} />}
      {aviso}
    </section>
  );
}

/**
 * El campo del pedido. Vive aparte para llevar `key={tipo}`: el ejemplo que se escribe solo
 * vuelve a empezar con los ejemplos del tipo elegido. Crece con lo que tiene (hasta ~6
 * renglones), también cuando lo llena el dictado, que no dispara `onInput`. Enter envía y
 * Mayús+Enter hace un salto de línea.
 */
function CampoPedido({ tipo, valor, animar, onValor, onTocar, onEnviar }: {
  tipo: TipoCrear;
  valor: string;
  animar: boolean;
  onValor: (v: string) => void;
  onTocar: () => void;
  onEnviar: () => void;
}) {
  const ejemplo = useEjemploQueSeEscribe(animar, EJEMPLOS_CAJA[tipo]);
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 168)}px`;
  }, [valor]);
  return (
    <textarea
      ref={ref}
      className="gp-cc-entrada"
      value={valor}
      rows={2}
      maxLength={TOPE_PEDIDO}
      placeholder={animar ? ejemplo : PLACEHOLDER_QUIETO}
      aria-label="Qué quieres crear"
      onPointerDown={onTocar}
      onFocus={onTocar}
      onChange={(e) => onValor(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); onEnviar(); } }}
    />
  );
}

/**
 * La hoja de la caja (tokens de CSS_GP; las medidas, las de la caja de Gamma 5 del relevo). El
 * micrófono redondo de 34 sale de `.gp-mic` (CSS_TIPO, crear/PiezasTipo.tsx).
 */
const CSS_CAJA = `
.gp .gp-cc { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 100%; margin: 8px 0 28px; }
.gp .gp-cc-titulo { margin: 0; text-align: center; font-size: 34px; font-weight: 600; line-height: 1.15; letter-spacing: -0.02em; color: var(--gp-titulo); }
.gp .gp-cc-caja { width: 100%; max-width: 720px; border-radius: 14px; background: var(--gp-superficie); box-shadow: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -2px rgba(0,0,0,.04); border: 1px solid var(--gp-borde-suave); }
.gp .gp-cc-caja:focus-within { border-color: var(--gp-azul-300); }
.gp .gp-cc-entrada { display: block; width: 100%; min-height: 64px; padding: 16px 18px 6px; border: 0; background: transparent; color: var(--gp-texto); font: inherit; font-size: 16px; line-height: 1.5; resize: none; outline: none; overflow-y: auto; }
.gp .gp-cc-entrada::placeholder { color: var(--gp-debil); }
.gp .gp-cc-fila { display: flex; align-items: center; gap: 8px; padding: 8px 10px 10px; }
.gp .gp-cc-mas { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 0; border-radius: 9999px; background: var(--gp-azul-50); color: var(--gp-azul-600); cursor: pointer; }
[data-tema="oscuro"] .gp .gp-cc-mas { background: #0b2e79; color: #aad5fe; }
.gp .gp-cc-mic { display: inline-flex; margin-left: auto; flex: none; }
.gp .gp-cc-enviar { display: grid; place-items: center; width: 34px; height: 34px; flex: none; border: 0; border-radius: 9999px; background: var(--gp-azul-500); color: #fff; cursor: pointer; }
.gp .gp-cc-enviar:disabled { background: var(--gp-borde); cursor: not-allowed; }
.gp .gp-cc-error { max-width: 720px; margin: -6px 0 0; }

.gp .gp-cc-plantillas { display: flex; flex-direction: column; gap: 12px; width: 100%; margin-top: 8px; scroll-margin-top: 16px; }
.gp .gp-cc-subtitulo { margin: 0; font-size: 18px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-cc-grilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 18px; }
.gp .gp-cc-plantilla { display: flex; flex-direction: column; gap: 4px; min-width: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.gp .gp-cc-plantilla:disabled { cursor: default; }
.gp .gp-cc-plantilla:disabled:not([data-creando="si"]) { opacity: .6; }
.gp .gp-cc-mini { position: relative; display: block; margin-bottom: 6px; border-radius: 10px; box-shadow: 0 0 0 1px var(--gp-borde-suave), var(--gp-sombra-tarjeta); transition: box-shadow .15s; }
.gp .gp-cc-mini .gp-mini { border-radius: 10px; }
.gp .gp-cc-plantilla:hover:not(:disabled) .gp-cc-mini, .gp .gp-cc-plantilla:focus-visible .gp-cc-mini { box-shadow: 0 0 0 2px var(--gp-azul-300), 0 4px 6px -1px rgba(0,0,0,.1); }
.gp .gp-cc-usar { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: inline-flex; align-items: center; gap: 8px; padding: 7px 14px; border-radius: 9999px; background: var(--gp-primario); color: var(--gp-primario-texto); font-size: 13px; font-weight: 600; white-space: nowrap; opacity: 0; transition: opacity .15s; pointer-events: none; }
.gp .gp-cc-usar .gp-giro { width: 13px; height: 13px; }
.gp .gp-cc-plantilla:hover:not(:disabled) .gp-cc-usar, .gp .gp-cc-plantilla:focus-visible .gp-cc-usar, .gp .gp-cc-usar[data-visible="si"] { opacity: 1; }
.gp .gp-cc-nombre { font-size: 14.5px; font-weight: 600; line-height: 1.3; color: var(--gp-titulo); }
.gp .gp-cc-desc { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.5px; line-height: 1.4; color: var(--gp-tenue); }

@media (max-width: 760px) {
  .gp .gp-cc-titulo { font-size: 28px; }
  .gp .gp-cc-grilla { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 14px; }
}
`;
