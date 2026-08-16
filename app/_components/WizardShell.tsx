'use client';

// =============================================================================
// WizardShell — chrome del asistente MaKo (una pregunta por paso), reutilizable
// =============================================================================
// Header con ✦ MAKO + dots de progreso, cuerpo centrado (UNA pregunta por paso)
// y footer Atrás/Siguiente/Confirmar. Lo usan todos los formularios de >1
// pregunta de la app (Kanban, board /plan, onboarding) para que se vean igual.
//
// Dos formas, mismo cuerpo:
//   · modal (default)  — card de 560px sobre un backdrop. Para los de adentro.
//   · fullscreen       — overlay que tapa el sidebar, en DOS pantallas: a la
//                        izquierda el `escenario` (lo que MaKo va encontrando de
//                        tu negocio) y a la derecha la pregunta. Para el
//                        onboarding, que no es un diálogo sino una llegada.
// `bloqueante` va aparte del modo: es "no se puede cerrar" (sin ✕, backdrop
// muerto), que es la semántica del onboarding pero también la del gauntlet.
//
// Los dots NO son un `total` pintado tal cual: ver el bloque "Indicador de
// progreso" abajo. La pieza solo promete una cantidad cuando la cuenta que le
// pasan es verificable; si no, muestra dónde estás y que faltan pasos. Si tu
// wizard tiene RAMAS, pasale el mapa (`pasos` + `pasoActual`) en vez de
// `total`/`idx`: con el mapa la posición no puede desincronizarse y la cola es
// exacta mientras el mapa no se mueva.

import { useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Cómo se le cuenta el progreso a la pieza. Dos formas, y conviene la primera:
 *
 *  · `pasos` + `pasoActual` — el MAPA REAL que el wizard está recorriendo. Es lo
 *    que necesitan los formularios con ramas (el de mover de etapa del CRM
 *    arma su lista de preguntas según lo que se va contestando): la posición
 *    sale de buscar el paso en la lista, así que no puede saltear, y la cola es
 *    exacta mientras la lista no se mueva.
 *  · `total` + `idx` — la cuenta a secas. Sirve cuando el recorrido es fijo. En
 *    un wizard con ramas la cuenta no es verificable y la pieza lo detecta,
 *    pero detectarlo es siempre peor que recibir el mapa.
 */
type ProgresoWizard =
  | { pasos: readonly string[]; pasoActual: string; total?: undefined; idx?: undefined }
  | { total: number; idx: number; pasos?: undefined; pasoActual?: undefined };

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

/** Input estándar de los pasos del wizard (centrado). */
export const wizardInput: CSSProperties = { width: '100%', padding: '12px 15px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: SANS, fontSize: 15, outline: 'none', textAlign: 'center' };

import { useCapaModal } from './pila-modales';
import { colaDeProgreso, etiquetaProgreso } from './wizard-progreso';

export function WizardShell({
  titulo, total, idx, pasos, pasoActual, pregunta, sub, children, error,
  puedeAvanzar, enUltimo, confirmLabel, pending = false, cargando = null,
  atrasLabel, onAtras, onSiguiente, onConfirmar, onClose, bloqueante = false, hideAtras = false,
  fullscreen = false, escenario, siguienteLabel = 'Siguiente →', extraFooter, adminBar, hideSiguiente = false,
  embebido = false, ancho = 560,
}: {
  titulo: string;            // línea mono arriba (ej. "Nutrición manual · Juan")
  pregunta: string; sub?: string;
  children: ReactNode;       // cuerpo del paso (input/textarea/botones)
  error?: string | null;
  puedeAvanzar: boolean;     // habilita Siguiente/Confirmar
  enUltimo: boolean;         // último paso → botón Confirmar
  confirmLabel: string;
  pending?: boolean;
  /**
   * Texto del loader que TAPA y BLOQUEA la pieza entera (null = nada). Es para
   * la espera que hace el wizard por su cuenta —leer un contrato, preguntarle al
   * server qué datos exige la etapa—, distinta de `pending`, que es el guardado
   * final. Mientras esté puesto no se avanza, no se vuelve y no se cierra: si
   * el mapa de preguntas todavía puede cambiar, contestar sobre él es tirar
   * trabajo a la basura.
   *
   * Acepta nodos, no solo un string: las esperas LARGAS (crear veinte tareas y
   * puntuarlas con el Perro tarda minutos) necesitan una segunda línea que diga
   * qué está pasando y que no se cierre. Con una sola línea en negrita, esa
   * explicación no entra y el usuario lee un cuelgue.
   */
  cargando?: ReactNode;
  atrasLabel: string;        // "Cancelar" (primer paso) o "Atrás"
  onAtras: () => void; onSiguiente: () => void; onConfirmar: () => void; onClose: () => void;
  bloqueante?: boolean;      // true → no se puede cerrar (sin ✕, backdrop no cierra)
  hideAtras?: boolean;       // true → oculta el botón izquierdo (sin Cancelar/Atrás)
  /** true → overlay a pantalla completa en 2 columnas (onboarding), no modal. */
  fullscreen?: boolean;
  /** Panel izquierdo del modo fullscreen: lo que MaKo va sabiendo del negocio. */
  escenario?: ReactNode;
  /** Texto del botón de avance (default "Siguiente →"). */
  siguienteLabel?: string;
  /** true → oculta el botón Siguiente por completo (ej. Archivero sin documentos aún). */
  hideSiguiente?: boolean;
  /** Slot a la izquierda del footer (ej. "Completar después"). */
  extraFooter?: ReactNode;
  /** Barra fija arriba del overlay fullscreen (ej. "Salir de la vista" del admin). */
  adminBar?: ReactNode;
  /**
   * Solo con `fullscreen`: renderiza la misma pieza DENTRO del layout (sin
   * position:fixed), así el sidebar sigue visible y se puede salir a otra tab.
   * Es lo que usa el onboarding de una TAB; el onboarding global no lo usa
   * porque es bloqueante a propósito.
   */
  embebido?: boolean;
  /**
   * Ancho de la tarjeta en modo modal (default 560). Los pasos que muestran una LISTA
   * —elegir proyectos, elegir tareas— necesitan más aire: con 560 los títulos se
   * cortan y la pieza se lee como una columna finita.
   */
  ancho?: number;
} & ProgresoWizard) {
  const capa = useCapaModal(!fullscreen);
  // Mientras carga, la pieza está trabada: ni avanzar, ni volver, ni cerrar.
  const trabado = !!cargando;

  // ===========================================================================
  // Indicador de progreso: honesto o mudo, pero nunca mentiroso
  // ===========================================================================
  // `total`/`idx` los cuenta cada llamador, y en los wizards con ramas ese mapa
  // NO es el que se recorre: el total puede no conocerse todavía (el "¿Qué hacer
  // ahora?" del CRM arranca sin rama elegida y pasaba total=0 justamente para
  // que no mintiera), puede crecer cuando la rama suma pantallas, o el paso
  // puede saltar de la 1 a la 3 porque el medio no aplicaba. Pintar `total`
  // puntitos tal cual es firmar una promesa ajena: cinco puntitos y un salto al
  // tercero, o dos puntitos que nunca se van a visitar esperando al final.
  //
  // La pieza no puede arreglar la cuenta del llamador, pero sí puede dejar de
  // firmarla: cuando lo que falta no se puede contar, muestra DÓNDE ESTÁS y que
  // faltan pasos, sin decir cuántos. La posición actual siempre es verdad.
  //
  // Con `pasos`+`pasoActual` no hay nada que adivinar: la posición sale de buscar
  // el paso EN el mapa que se está recorriendo, así que no puede desincronizarse
  // del cuerpo que se está viendo (que es la falla que `total`/`idx` no puede
  // evitar: son dos números sueltos que el llamador mantiene a mano).
  // `posEnMapa` = -1 cuando el paso que se está pintando NO está en el mapa (mapa
  // vacío, o un `pasoActual` que quedó viejo). Ahí la posición es una incógnita:
  // se sigue pintando la primera —no hay mejor número— pero la COLA pasa a
  // "faltan pasos", porque prometer una cuenta desde una posición inventada es
  // exactamente la mentira que esta pieza existe para no firmar.
  const posEnMapa = pasos ? pasos.indexOf(pasoActual ?? '') : 0;
  const actual = pasos
    ? Math.max(0, posEnMapa)
    : typeof idx === 'number' && Number.isFinite(idx) ? Math.max(0, Math.trunc(idx)) : 0;

  // Un salto hacia adelante (de la 1 a la 3) PRUEBA que este wizard se saltea
  // pantallas; desde ahí `total` deja de servir para contar lo que queda, porque
  // incluye pantallas que tampoco se van a ver. Es pegajoso a propósito: una vez
  // que el mapa se mostró variable, no se vuelve a prometer una cantidad.
  // Ajuste de estado en render (patrón "derivar de props"), no efecto: si no, el
  // primer frame del salto todavía muestra la fila vieja, que es la mentira.
  const [salto, setSalto] = useState({ visto: actual, hubo: false });
  if (!pasos && salto.visto !== actual) setSalto({ visto: actual, hubo: salto.hubo || actual > salto.visto + 1 });

  // Modo `pasos`: la cola es EXACTA mientras el mapa no se mueva, y cuando se
  // mueve la pieza se entera (no como con `total`, donde solo puede sospecharlo
  // por un salto). Un mapa que cambia bajo los pies del usuario —una rama que
  // suma o saca pantallas— vuelve la cuenta imprometible, y es pegajoso: una
  // promesa que ya se rompió una vez no se vuelve a hacer.
  //
  // Los cambios mientras la pieza está TRABADA (`cargando`) no cuentan: ahí el
  // mapa todavía se está armando —el caso real es el wizard del CRM esperando
  // que el server le diga qué exige la etapa— y el usuario no pudo leer ninguna
  // promesa todavía, porque no puede ni tocar la pantalla. Se compara también
  // contra el render ANTERIOR: cuando el loader se apaga, la respuesta que lo
  // apagó suele traer el mapa nuevo en el mismo commit, y eso es el final del
  // armado, no una promesa rota.
  const claveMapa = pasos ? pasos.join('\u0000') : '';
  const [mapa, setMapa] = useState({ clave: claveMapa, trabado, variable: false });
  if (mapa.clave !== claveMapa || mapa.trabado !== trabado) {
    const cambioALaVista = mapa.clave !== claveMapa && !mapa.trabado && !trabado;
    setMapa({ clave: claveMapa, trabado, variable: mapa.variable || cambioALaVista });
  }

  // La cuenta de lo que falta vive en app/_components/wizard-progreso.ts: es
  // aritmética pura, y sacarla de acá es lo único que la deja probar. Lo que hay
  // que saber al leer esto está en el JSDoc de `colaDeProgreso` — sobre todo que
  // `enUltimo` gana en las DOS direcciones.
  // futuros: >0 faltan tantos · 0 ninguno · -1 faltan, cantidad desconocida.
  const futuros = colaDeProgreso(
    pasos
      ? { modo: 'mapa', largo: pasos.length, pos: posEnMapa, variable: mapa.variable, enUltimo }
      : { modo: 'cuenta', total, actual, salto: salto.hubo, enUltimo },
  );

  const etiqueta = etiquetaProgreso(actual, futuros);

  const punto = (k: string, w: number, h: number, bg: string) => (
    <span key={k} style={{ width: w, height: h, borderRadius: 999, background: bg, transition: 'width .2s' }} />
  );

  const dots = (
    <div role="img" aria-label={etiqueta} title={etiqueta} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: actual }).map((_, i) => punto(`p${i}`, 8, 8, 'var(--primary-weak, #B9CDF8)'))}
      {punto('actual', 22, 8, 'var(--primary)')}
      {futuros > 0 && Array.from({ length: futuros }).map((_, i) => punto(`f${i}`, 8, 8, 'var(--border)'))}
      {/* Los tres puntos del "faltan pasos" van más chicos y en otro color a
          propósito: si fueran del tamaño de un paso se leerían como "faltan
          exactamente tres", que es la mentira que vinimos a sacar. */}
      {futuros < 0 && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 1 }}>
          {[0, 1, 2].map((i) => punto(`x${i}`, 4, 4, 'var(--border-strong)'))}
        </span>
      )}
    </div>
  );

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px 20px' }}>
      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: '.14em', color: 'var(--accent)' }}>✦ MAKO</span>
      {dots}
      {bloqueante
        ? <span style={{ width: 32 }} />
        : <button onClick={trabado ? undefined : onClose} disabled={trabado} aria-label="Cerrar" style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', cursor: trabado ? 'default' : 'pointer', opacity: trabado ? 0.4 : 1, fontSize: 14, fontFamily: SANS }}>✕</button>}
    </div>
  );

  // Loader que tapa la TARJETA ENTERA (header y footer incluidos, que es donde
  // están los botones que no hay que tocar todavía). Va DENTRO de la tarjeta, en
  // `position:absolute`, a propósito: así hereda el z-index que la pila de
  // modales le dio a esta capa. Un overlay con su propio z-index fijo queda por
  // DEBAJO del modal cuando hay dos abiertos, y un loader invisible se lee como
  // un cuelgue — la pantalla no responde y no hay nada que explique por qué.
  const loader = trabado ? (
    <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
      {/* La cortina va en su propia capa: `opacity` sobre el contenedor apagaría
          también el spinner y el texto. Y el velo sale de --surface, no de un
          blanco fijo: en tema oscuro un blanco al 80% es un flash. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'var(--surface)', opacity: 0.88, backdropFilter: 'blur(1.5px)' }} />
      <span aria-hidden style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)', boxSizing: 'border-box', animation: 'spin .7s linear infinite' }} />
      <div style={{ position: 'relative', fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: SANS, textAlign: 'center', padding: '0 20px' }}>{cargando}</div>
    </div>
  ) : null;

  const cuerpo = (
    <div style={{ padding: fullscreen ? '18px clamp(20px,4vw,44px) 24px' : '26px clamp(20px,6vw,56px) 30px', textAlign: 'center' }}>
      <div style={{ fontSize: 12.5, color: 'var(--faint)', fontFamily: MONO, marginBottom: 8 }}>{titulo}</div>
      <h3 style={{ fontSize: 'clamp(20px,4vw,26px)', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 6px', fontFamily: SANS }}>{pregunta}</h3>
      {sub ? <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: '0 0 18px', lineHeight: 1.55 }}>{sub}</p> : <div style={{ height: 12 }} />}
      {/* Columna con aire: los pasos apilan acción + contexto, y sin gap quedaban
          pegados uno contra otro. Se estira a lo ancho a propósito (la caja de
          contexto y las listas ocupan todo); el CENTRADO de los botones lo pone
          cada paso con alignSelf, que es la regla de la pieza. */}
      <div style={{ maxWidth: fullscreen ? 480 : Math.max(480, ancho - 80), margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
      {error && <div style={{ fontSize: 13, color: 'var(--bad)', fontWeight: 600, marginTop: 12 }}>{error}</div>}
    </div>
  );

  // El botón de avance mira las DOS cosas: que el paso esté contestado y que la
  // pieza no esté trabada esperando algo.
  const avanza = puedeAvanzar && !trabado;

  const footer = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
      {/* Atrás y `extraFooter` CONVIVEN. Antes era un ternario: el extraFooter
          solo aparecía cuando se ocultaba el Atrás, o sea únicamente en el paso
          0. Como el extraFooter es la salida ("Lo configuro después"), a partir
          del paso 1 el usuario se quedaba sin ella — y un paso que además exija
          completar algo para avanzar se vuelve una trampa sin salida. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {!hideAtras && <button onClick={onAtras} disabled={trabado} style={{ padding: '11px 20px', borderRadius: 11, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontSize: 14, fontWeight: 600, cursor: trabado ? 'default' : 'pointer', opacity: trabado ? 0.5 : 1, fontFamily: SANS }}>← {atrasLabel}</button>}
        {extraFooter}
      </div>
      {enUltimo ? (
        <button onClick={onConfirmar} disabled={pending || trabado || !puedeAvanzar} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: avanza ? 'var(--primary)' : 'var(--border)', color: avanza ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: avanza && !pending ? 'pointer' : 'default', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : confirmLabel}</button>
      ) : hideSiguiente ? (
        <span />
      ) : (
        <button onClick={onSiguiente} disabled={!avanza || pending} style={{ padding: '12px 26px', borderRadius: 11, border: 'none', background: avanza ? 'var(--primary)' : 'var(--border)', color: avanza ? '#fff' : 'var(--faint)', fontSize: 14.5, fontWeight: 700, cursor: avanza ? 'pointer' : 'default', fontFamily: SANS, opacity: pending ? 0.6 : 1 }}>{pending ? 'Guardando…' : siguienteLabel}</button>
      )}
    </div>
  );

  // Fullscreen: dos pantallas. El escenario a la izquierda no es decoración —
  // es lo que MaKo ya sabe del negocio, apareciendo mientras el cliente contesta.
  // Fullscreen: UNA tarjeta partida — el mismo grid `.mk-svc-modal` que el modal
  // de /integraciones y que el PanelActivacion de cada tab. No son dos cajas
  // sueltas a propósito: el aside negro tiene que leerse como parte de la misma
  // pieza (por eso su borde y su radio los pone .mk-svc-aside), y así el cliente
  // reconoce la MISMA pantalla en los tres lugares.
  if (fullscreen) {
    // `embebido`: MISMA pieza de 2 columnas, pero SIN position:fixed — vive
    // dentro del main de la tab y por lo tanto NO tapa el sidebar. Solo el
    // onboarding GLOBAL (bloqueante, alta del cliente) se come la pantalla; el
    // onboarding de una tab tiene que dejar salir a cualquier otra parte de la
    // app (ver .claude/skills/tab-onboarding).
    // `minHeight` y no `height`: con `flex: 1` el flex-basis queda en 0% y anula
    // cualquier `height`, así que la pieza colapsaba contra el techo en vez de
    // centrarse. Mismo bug que tenía el loader de la tab.
    // El contenedor NO lleva padding: la barra del admin tiene que ir a sangre,
    // pegada arriba y de lado a lado. El aire se lo pone la zona de contenido.
    const contenedor: CSSProperties = embebido
      ? { flex: 1, minWidth: 0, minHeight: '100vh', background: 'var(--bg)', fontFamily: SANS, display: 'flex', flexDirection: 'column' }
      : { position: 'fixed', inset: 0, zIndex: 100, background: 'var(--bg)', fontFamily: SANS, display: 'flex', flexDirection: 'column' };
    return (
      <div style={contenedor}>
        {/* Barra del admin: por encima del overlay (que si no tapa el banner de
            impersonación), para poder salir de la vista sin terminar el wizard. */}
        {adminBar && <div style={{ flex: 'none' }}>{adminBar}</div>}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px,3vh,36px) 20px' }}>
          <div
            className={escenario ? 'mk-svc-modal' : undefined}
            style={{
              width: '100%', maxWidth: escenario ? 980 : 620,
              minHeight: escenario ? 560 : undefined,
              // Techo fijo: al desplegar una sección de contexto la tarjeta NO
              // crece (que empuja el footer fuera de la pantalla) — scrollea
              // por dentro, que es lo que espera cualquiera que abra un acordeón.
              maxHeight: 'calc(100vh - 96px)',
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 18, overflow: 'hidden',
              // `relative` para que el loader se ancle a la tarjeta y no al viewport.
              position: 'relative',
              ...(escenario ? {} : { display: 'flex', flexDirection: 'column' }),
            }}
          >
            {loader}
            {escenario}
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
              {header}
              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{cuerpo}</div>
              {footer}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MODAL. El techo y el scroll interno NO son un detalle: sin ellos la tarjeta crecía
  // con el contenido (una pregunta larga, quince opciones) hasta pasarse de la pantalla,
  // y como el footer va abajo de todo, el botón Siguiente terminaba fuera del viewport
  // — con el backdrop `position:fixed` no hay scroll de página que lo rescate. La pieza
  // quedaba literalmente sin salida.
  //
  // La receta es la misma que ya usa la rama fullscreen (línea 155-166): techo en vh,
  // columna flex, y UN solo hijo elástico con minHeight:0 (sin eso el flex-item no se
  // achica por debajo de su contenido y el overflow no se activa nunca).
  return (
    // Pila de modales: si se abre otro encima, este se ESCONDE (no se desmonta) y al
    // volver está con el scroll donde lo dejaste. Ver app/_components/pila-modales.ts.
    <div onClick={bloqueante || trabado ? undefined : onClose} style={{ position: 'fixed', inset: 0, zIndex: capa.z, background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)', display: capa.visible ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{ position: 'relative', width: '100%', maxWidth: ancho, maxHeight: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden' }}>
        {loader}
        <div style={{ flex: 'none' }}>{header}</div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{cuerpo}</div>
        <div style={{ flex: 'none' }}>{footer}</div>
      </div>
    </div>
  );
}
