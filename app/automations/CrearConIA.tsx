'use client';
// =============================================================================
// CrearConIA — la caja «✦ Generar con IA» de una automatización del Chatbot
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 11): «Quiero que implementes la
// funcionalidad de crear un secuencia con IA, mediante un "prompt", y que ahí se vayan
// creando...». Decisión 14 de docs/chatbot-flujo-ramas-diseno.md.
//
// TERCERA TANDA (09/10/2026, «Por otro lado», puntos 2 a 6, y la decisión 17 del diseño):
//   · «el imput minimalista… como lo que tenemos en PLAN de nueva tarea» → una línea subrayada y el
//     micrófono al lado, como app/plan/board/CrearTareaModal.tsx;
//   · «que acepte grabar audio y que se vaya transcribiendo ahí mismo» → el MISMO botón de ahí
//     (`BotonDictar`: en vivo con el reconocimiento del navegador, y grabar y subir de respaldo);
//   · «el título… mejor "Generar con IA"»;
//   · «el placeholder… escribe un ejemplo, borra y escribe otra cosa… ejemplos más genéricos… al darle
//     click debe parar la animación completamente» → `useEjemploQueSeEscribe`, que para DEL TODO al
//     primer toque y no vuelve. Los ejemplos que llegaban por props (armados con nombres de etapas, tipo
//     «Nutrición No Show R1») se fueron con la prop, y con toda la cadena que los armaba en la tab;
//   · «la animación de creación debería poner un poco "opaco" todo el resto, y no dejar editar el flujo
//     mientras la IA lo crea… con un botón de cancelar» → mientras trabaja, una CAPA fija sobre toda la
//     pantalla (portal a `document.body`) con el estado encima, que se traga los clics y el teclado, y
//     «Cancelar» corta el pedido (AbortController) y deja la caja con el pedido escrito.
//
// Tres formas, el mismo componente:
//   · `modo: 'galeria'` — «Pídeselo a MaKo» ADENTRO del modal «Nueva automatización» (décima tanda, 11/10/2026,
//     NUEVA AUTOMATIZACIÓN 6: «allí mismo ya debería poder escribir y grabar audio para pedirle a MaKo lo que quiero»).
//     SIN `secuenciaId`: la fila nace AL GUARDAR, en el server (lib/flujo-ia-crear.ts), así un «Cancelar» o un fallo no
//     dejan una vacía huérfana. Al terminar, `onListo` trae el id NUEVO y quien monta cierra el modal y la abre.
//     ⚠️ LAS FASES SE DIBUJAN ADENTRO DEL MODAL, no en la capa: la capa es `zIndex: 125` y un Modal de la pila arranca
//     en 130 (`Z_BASE`, app/_components/pila-modales.ts): portaleada, quedaba DEBAJO del modal, sin un error.
//   · `modo: 'crear'`  — la caja del lienzo VACÍO de una automatización recién creada. Desde la décima tanda el lienzo
//     vacío no la dibuja (pedirle a MaKo vive en el modal; docs/diseno-automations-galeria-v2.md §1, «a confirmar»):
//     queda el modo, para que volver a ponerla sea una línea.
//   · `modo: 'editar'` — una barra de una línea, «Pídele un cambio», para agregarle tarjetas.
//
// Habla con POST /api/chat-agent/secuencias/ia (stream NDJSON) y al terminar llama a `onListo`
// con el flujo, el orden en que se encienden las tarjetas (`revelar` del Lienzo) y los avisos.
// NO decide qué hacer con el resultado: crear ya lo GUARDÓ pausado; editar es un borrador local
// que el padre aplica con UNA foto de deshacer.
//
// ⚠️ MIENTRAS TRABAJA SE VEN LAS FASES REALES, no un spinner eterno: `GRAMATICA.analizando`
// («Revisando») exige mostrar sobre qué está trabajando, y AGENTS.md exige que todo lo que pueda
// pasar los ~8 s diga cuánto puede tardar. El tope del cliente es el de la ruta (300 s) + margen.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { GRAMATICA } from '@/lib/mako-gramatica';
import { avisarCambioEtiquetas } from '@/app/_components/etiquetas-cliente';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import type { EventoIA, ListoIA, GuardadoIA } from '@/lib/flujo-ia';
import type { PasoGrafo } from '@/lib/flujo-grafo';

/**
 * Lo que recibe `onListo`.
 *   · `disparador` (crear): el valor del desplegable del CRON que quedó puesto, para dibujarlo sin
 *     recargar.
 *   · `base` (editar): el borrador que se MANDÓ. El padre lo compara con el lienzo de ahora antes de
 *     aplicar (`edicionVigente`, lib/flujo-ia-cliente.ts): si se tocó en el medio, no lo pisa.
 */
export type ListoCrearIA = Pick<ListoIA, 'secuenciaId' | 'pasos' | 'nombre' | 'orden' | 'avisos' | 'etiquetasNuevas' | 'disparador'>
  & { modo: 'crear' | 'editar'; base?: readonly PasoGrafo[] };

export type CrearConIAProps = {
  /** Editar: el borrador LOCAL del lienzo (puede tener cambios sin publicar). */
  pasos?: readonly PasoGrafo[];
  // (Acá vivía `pedidoInicial`, el pedido ya escrito que mandaba «Armar una» del pie de la lista de
  // /automations. Salió el 10/10/2026 con el pie, que era de una versión anterior.)
  /**
   * `false` = no lo aplicó (editar sobre un lienzo que cambió): el pedido queda escrito. En la galería trae el id de la
   * automatización que NACIÓ (`secuenciaId`), ya guardada y pausada.
   */
  onListo: (r: ListoCrearIA) => boolean | void;
  /** Mientras trabaja (galería): quien monta no deja cerrar ni elegir otra cosa. */
  onOcupado?: (ocupado: boolean) => void;
  deshabilitado?: boolean;
} & (
  | { modo: 'crear' | 'editar'; secuenciaId: number }
  /** Sin `secuenciaId`: la fila nace al guardar (ver la cabecera). */
  | { modo: 'galeria'; secuenciaId?: undefined }
);

/** El tope de la ruta (`maxDuration = 300`) + margen: el `fetch` no puede esperar para siempre. */
const TOPE_CLIENTE_MS = 310_000;

type Fase = 'contexto' | 'modelo' | 'revision';
type Estado =
  | { t: 'quieto'; error?: string; link?: string }
  | { t: 'trabajando'; fase: Fase | null; leido: string | null; reparadas: number | null; desde: number };

/** Lo que se dice de cada fase (corto: AGENTS.md, el texto que se dibuja). */
const TEXTO_FASE: Record<Fase, string> = {
  contexto: 'Leyendo tu negocio',
  modelo: 'Escribiendo el flujo',
  revision: 'Revisando el flujo',
};
const ORDEN_FASES: Fase[] = ['contexto', 'modelo', 'revision'];

// ── El placeholder que se escribe solo ──────────────────────────────────────────

/**
 * Los ejemplos del placeholder: GENÉRICOS a propósito (punto 5). Lo que hace un negocio cualquiera, sin
 * el nombre de una etapa, un producto ni un cliente — un nombre de etapa de un cliente en la pantalla de
 * otro se lee como un dato (AGENTS.md: un ejemplo de UI es ficticio por regla).
 */
export const EJEMPLOS = [
  'Confirmar la reunión un día antes y avisarme si no contesta',
  'Recuperar a quien dejó sus datos y no agendó',
  'Dar la bienvenida por WhatsApp a cada lead nuevo',
  'Volver a escribirle a quien no vino a la llamada',
  'Etiquetar a quien responde que le interesa',
] as const;

/** El título de la caja en el modal «Nueva automatización» (décima tanda, punto 6). */
export const TITULO_GALERIA_IA = 'Pídeselo a MaKo';

/** Lo que queda en el campo cuando la animación ya paró. */
const PLACEHOLDER_QUIETO = 'Escribe o dicta qué tiene que pasar';

/**
 * El ritmo. El mecanismo es el del onboarding (app/onboarding/Bienvenida.tsx, `Maquina`: escribe, se
 * queda, borra, sigue con la próxima, con un jitter para que no suene a metrónomo), pero más rápido:
 * allá se escribe el final de una frase de 3 palabras y acá un pedido entero de 8 a 10.
 */
const MS_LETRA = 60;
const MS_BORRAR = 28;
const MS_JITTER = 40;
const MS_QUIETA = 1900;

/**
 * El ejemplo que se escribe y se borra. Arranca con el primero COMPLETO (el HTML del server y el del
 * cliente coinciden) y, con `activo` en false, deja de moverse para siempre: el primer toque a la caja
 * lo apaga y no vuelve (punto 5: «al darle click debe parar la animación completamente»). Con
 * `prefers-reduced-motion` no se mueve nunca.
 */
// Exportado (AI Step v2, décima tanda): el «¿Qué tiene que lograr?» del AI Step escribe sus propios ejemplos
// con el MISMO mecanismo (app/automations/EditorPasoIA.tsx). `ejemplos` ausente = los de crear una automatización.
export function useEjemploQueSeEscribe(activo: boolean, ejemplos: readonly string[] = EJEMPLOS): string {
  const [i, setI] = useState(0);
  const [largo, setLargo] = useState<number>(ejemplos[0].length);
  const [borrando, setBorrando] = useState(false);
  const [quieto, setQuieto] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setQuieto(true);
    } catch { /* sin matchMedia */ }
  }, []);

  useEffect(() => {
    if (!activo || quieto) return;
    const frase = ejemplos[i % ejemplos.length];
    if (!borrando && largo === frase.length) {
      const t = setTimeout(() => setBorrando(true), MS_QUIETA);
      return () => clearTimeout(t);
    }
    if (borrando && largo === 0) {
      const t = setTimeout(() => { setBorrando(false); setI((x) => (x + 1) % ejemplos.length); }, 280);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setLargo((l) => l + (borrando ? -1 : 1)), (borrando ? MS_BORRAR : MS_LETRA) + Math.random() * MS_JITTER);
    return () => clearTimeout(t);
  }, [activo, quieto, i, largo, borrando, ejemplos]);

  return ejemplos[i % ejemplos.length].slice(0, largo);
}

export function CrearConIA(p: CrearConIAProps) {
  const [pedido, setPedido] = useState('');
  const [estado, setEstado] = useState<Estado>({ t: 'quieto' });
  const [ahora, setAhora] = useState(() => Date.now());
  /** El placeholder ya no se mueve: alguien tocó la caja. No vuelve. */
  const [tocada, setTocada] = useState(false);
  const ejemplo = useEjemploQueSeEscribe(p.modo !== 'editar' && !tocada && !pedido);
  const ctrl = useRef<AbortController | null>(null);
  const capaRef = useRef<HTMLDivElement | null>(null);
  // El campo crece con lo que tiene (hasta 5 renglones), también cuando lo llena el dictado, que no
  // dispara `onInput`.
  const campoRef = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    const t = campoRef.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 132)}px`;
  }, [pedido]);
  /**
   * ⚠️ EL `onListo` DE AHORA, NO EL DEL CLIC (revisión, 09/10/2026). `enviar` cierra sobre las props
   * del render en que se hizo clic: llamar a `p.onListo` al terminar llamaba al del padre de hace
   * un minuto, con SU `pasos` de entonces, y la comparación con el lienzo de ahora daba siempre
   * igual. El ref se actualiza en cada render.
   */
  const onListoRef = useRef(p.onListo);
  useEffect(() => { onListoRef.current = p.onListo; });

  // El reloj de lo que lleva (progreso real, no decorativo). Corre sólo mientras trabaja.
  const trabajando = estado.t === 'trabajando';
  useEffect(() => {
    if (!trabajando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [trabajando]);
  // La galería no deja cerrar el modal ni elegir una plantilla mientras MaKo trabaja (`onOcupado`).
  const onOcupadoRef = useRef(p.onOcupado);
  useEffect(() => { onOcupadoRef.current = p.onOcupado; });
  useEffect(() => { onOcupadoRef.current?.(trabajando); }, [trabajando]);
  /** En la galería todo pasa ADENTRO del modal (ver la cabecera): ni la capa ni el teclado de la pantalla. */
  const enModal = p.modo === 'galeria';

  // Al desmontar (cambiar de automatización, cerrar) se corta el pedido: la ruta mira la señal y
  // no guarda nada si se canceló antes de terminar.
  useEffect(() => () => ctrl.current?.abort(), []);

  const cancelar = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setEstado({ t: 'quieto' });
  };

  /**
   * ⚠️ MIENTRAS TRABAJA, EL TECLADO TAMPOCO LLEGA AL LIENZO (punto 6: «no dejar editar el flujo»). La
   * capa se traga los clics, pero un atajo vive en `document` (el deshacer del lienzo, Suprimir sobre una
   * tarjeta): se corta en CAPTURA todo lo que no nace adentro de la capa. Escape cancela, igual que el
   * botón, y sólo cuando el botón está (en «Revisando el flujo» el server ya no mira la señal).
   */
  const fase = estado.t === 'trabajando' ? estado.fase : null;
  useEffect(() => {
    // En la galería, el modal ya tapa la pantalla y tiene su propio teclado (la pila de modales).
    if (!trabajando || enModal) return;
    capaRef.current?.focus();
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fase !== 'revision') { e.preventDefault(); e.stopImmediatePropagation(); cancelar(); return; }
      // Tab no saca el foco de la capa (lo de abajo no se puede tocar). Lo demás que nace en la capa
      // (Enter o espacio sobre «Cancelar») sigue su camino.
      if (e.key === 'Tab') { e.preventDefault(); return; }
      if (capaRef.current && e.target instanceof Node && capaRef.current.contains(e.target)) return;
      // Sin `preventDefault`: los atajos del NAVEGADOR (recargar, cambiar de pestaña) siguen andando;
      // lo que se corta es que lleguen a los de la app.
      e.stopImmediatePropagation();
    };
    document.addEventListener('keydown', alTeclado, true);
    return () => document.removeEventListener('keydown', alTeclado, true);
  }, [trabajando, fase, enModal]);

  const enviar = async () => {
    const texto = pedido.trim();
    if (!texto || trabajando || p.deshabilitado) return;
    setTocada(true);
    const c = new AbortController();
    ctrl.current = c;
    const tope = setTimeout(() => c.abort(), TOPE_CLIENTE_MS);
    // La foto que se manda (editar): vuelve en `onListo` como `base`.
    const base = p.modo === 'editar' ? p.pasos : undefined;
    setEstado({ t: 'trabajando', fase: null, leido: null, reparadas: null, desde: Date.now() });
    setAhora(Date.now());
    try {
      const res = await fetch('/api/chat-agent/secuencias/ia', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pedido: texto, modo: p.modo === 'galeria' ? 'crear' : p.modo, ...(p.secuenciaId != null ? { secuenciaId: p.secuenciaId } : {}), ...(base ? { pasos: base } : {}) }),
        signal: c.signal,
      });
      // Los errores de antes del stream (403, 400, 409) llegan como JSON plano.
      if (!res.ok || (res.headers.get('content-type') ?? '').includes('application/json')) {
        const j = await res.json().catch(() => null) as { error?: string; guardado?: GuardadoIA } | null;
        // Crear sobre una que YA tiene tarjetas: esta pantalla quedó vieja (un Cancelar que llegó
        // tarde). Lo guardado pasa al lienzo como si recién se hubiera creado, con el aviso.
        const g = j?.guardado;
        if (p.modo === 'crear' && res.status === 409 && g && Array.isArray(g.pasos) && g.pasos.length) {
          setEstado({ t: 'quieto' });
          onListoRef.current({
            modo: 'crear', secuenciaId: p.secuenciaId, pasos: g.pasos, nombre: g.nombre, orden: g.orden,
            avisos: j?.error ? [j.error] : [], etiquetasNuevas: [], disparador: g.disparador ?? null,
          });
          return;
        }
        setEstado({ t: 'quieto', error: j?.error || `Error ${res.status}` });
        return;
      }
      if (!res.body) { setEstado({ t: 'quieto', error: 'Sin respuesta' }); return; }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      // Una línea NDJSON; true = el stream terminó (listo o error).
      const procesar = (line: string): boolean => {
        if (!line) return false;
        let ev: EventoIA;
        try { ev = JSON.parse(line) as EventoIA; } catch { return false; }
        if (ev.t === 'listo') {
          setEstado({ t: 'quieto' });
          // ⚠️ LAS ETIQUETAS QUE CREÓ EL SERVER (revisión, 09/10/2026): `crearEtiqueta` corre en la ruta,
          // no pasa por `crearEtiquetaCliente`, y las listas de la pestaña ya estaban pedidas. Sin este
          // aviso la tarjeta 🏷️ decía «+ una etiqueta» y el selector «Una etiqueta que ya no está»
          // hasta recargar. Va ANTES de `onListo`: las tarjetas nuevas se dibujan con la lista nueva.
          if (ev.etiquetasNuevas.length) avisarCambioEtiquetas();
          const aplicado = onListoRef.current({
            modo: ev.modo, secuenciaId: ev.secuenciaId, pasos: ev.pasos, nombre: ev.nombre, orden: ev.orden,
            avisos: ev.avisos, etiquetasNuevas: ev.etiquetasNuevas, disparador: ev.disparador ?? null, base,
          });
          // Si el padre no lo aplicó (el lienzo cambió en el medio), el pedido queda escrito.
          if (p.modo === 'editar' && aplicado !== false) setPedido('');
          return true;
        }
        if (ev.t === 'error') { setEstado({ t: 'quieto', error: ev.error || 'No se pudo', link: ev.link }); return true; }
        if (ev.t === 'fase') {
          setEstado((s) => (s.t !== 'trabajando' ? s : {
            ...s, fase: ev.fase,
            leido: ev.fase === 'contexto' ? ev.texto : s.leido,
            reparadas: ev.fase === 'revision' ? ev.reparadas : s.reparadas,
          }));
        }
        return false;
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1);
          if (procesar(line)) return;
        }
      }
      if (procesar(buf.trim())) return;
      // El stream se cerró sin decir cómo terminó (se cortó la conexión o la función).
      setEstado({ t: 'quieto', error: 'Se cortó. Prueba de nuevo.' });
    } catch (e) {
      // Cancelar no es un error: la caja vuelve con el pedido escrito.
      if (c.signal.aborted && ctrl.current !== c) return;
      setEstado({ t: 'quieto', error: c.signal.aborted ? 'Tardó demasiado. Prueba de nuevo.' : (e instanceof Error ? e.message : String(e)) });
    } finally {
      clearTimeout(tope);
      if (ctrl.current === c) ctrl.current = null;
    }
  };

  const segundos = trabajando ? Math.max(0, Math.round((ahora - estado.desde) / 1000)) : 0;

  // ── Trabajando: la capa que oscurece todo, con las fases reales encima ──
  if (estado.t === 'trabajando') {
    const actual = estado.fase ? ORDEN_FASES.indexOf(estado.fase) : -1;
    const fases = (
      <div ref={capaRef} tabIndex={-1} style={enModal ? S.trabajandoEnModal : S.trabajando} role="status" aria-live="polite" data-crear-ia-fases="">
        <div style={S.cabeza}>
          <span style={S.rotulo}>✦ {GRAMATICA.analizando.rotulo}</span>
          {estado.leido && <span style={S.leido}>· {estado.leido}</span>}
        </div>
        <ol style={S.fases}>
          {ORDEN_FASES.map((f, i) => (
            <li key={f} style={{ ...S.fase, color: i <= actual ? 'var(--ink)' : 'var(--faint)' }}>
              <span aria-hidden style={{ ...S.punto, background: i < actual ? 'var(--good)' : i === actual ? 'var(--mako)' : 'var(--border)' }} />
              {TEXTO_FASE[f]}
              {f === 'revision' && estado.reparadas ? <span style={S.dim}> · {estado.reparadas} {estado.reparadas === 1 ? 'arreglo' : 'arreglos'}</span> : null}
            </li>
          ))}
        </ol>
        <div style={S.pie}>
          {/* ⚠️ EL TOPE SALE DEL TOPE REAL (revisión, 09/10/2026): decía «hasta 1 min» y la ruta le da
              al modelo hasta 220 s, con reintento, sobre un `maxDuration` de 300. «75 s · hasta 1 min»
              se lee como colgado y la persona cancela un pedido que iba a terminar. */}
          <span style={S.dim}>{segundos} s · hasta {Math.round(TOPE_CLIENTE_MS / 60_000)} min</span>
          {/* ⚠️ SIN «Cancelar» EN «Revisando el flujo» (revisión, 09/10/2026): el server mira la señal
              una sola vez, antes de esa fase, y después crea las etiquetas y guarda igual. Un Cancelar
              ahí dejaba la automatización guardada y la pantalla mostrando la caja vacía. */}
          {estado.fase !== 'revision' && <Button variant="tertiary" size="sm" onClick={cancelar}>Cancelar</Button>}
        </div>
      </div>
    );
    // En la galería, las fases en el MISMO lugar de la caja, adentro del modal (ver la cabecera: la capa quedaría debajo).
    if (enModal) return fases;
    const tarjeta = <div data-crear-ia-capa="" style={S.capa}>{fases}</div>;
    // La capa va al `body`: adentro del lienzo, un ancestro con `transform`, `overflow` o z-index la
    // dejaría recortada o debajo de la lista y de «Publicar» (AGENTS.md, el sticky que clampea el z).
    return typeof document !== 'undefined' ? createPortal(tarjeta, document.body) : tarjeta;
  }

  const error = estado.error ? (
    <p style={S.error} role="alert">
      <TextoConLink texto={estado.error} link={estado.link} />
    </p>
  ) : null;

  // ── Editar: una línea ──
  if (p.modo === 'editar') {
    return (
      <div style={S.barraWrap}>
        <form
          style={S.barra}
          onSubmit={(e) => { e.preventDefault(); void enviar(); }}
        >
          <span aria-hidden style={S.chispa}>✦</span>
          <input
            value={pedido}
            onChange={(e) => setPedido(e.target.value)}
            placeholder="Pídele un cambio"
            aria-label="Pídele un cambio a MaKo"
            maxLength={2000}
            disabled={p.deshabilitado}
            style={S.input}
          />
          <BotonDictar titulo="Dictar el cambio" valor={pedido} onValor={setPedido} onError={(m) => setEstado({ t: 'quieto', error: m })} />
          <Button type="submit" variant="mako" size="sm" disabled={!pedido.trim() || p.deshabilitado}>Agregar</Button>
        </form>
        {error}
      </div>
    );
  }

  // ── Crear (y la galería): la caja, como «Nueva tarea» del Plan ──
  const parar = () => { if (!tocada) setTocada(true); };
  const idCampo = `crear-ia-${p.secuenciaId ?? 'galeria'}`;
  return (
    <form
      style={enModal ? S.cajaEnModal : S.caja} data-crear-ia-caja={p.modo}
      onSubmit={(e) => { e.preventDefault(); void enviar(); }}
      onPointerDownCapture={parar}
      onFocusCapture={parar}
    >
      <div style={S.encabezado}>
        <span aria-hidden style={S.chispa}>✦</span>
        <label htmlFor={idCampo} style={S.titulo}>{enModal ? TITULO_GALERIA_IA : 'Generar con IA'}</label>
      </div>
      <div style={S.fila}>
        <textarea
          ref={campoRef}
          id={idCampo}
          value={pedido}
          onChange={(e) => { setPedido(e.target.value); parar(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
          onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--mako)'; }}
          onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'var(--border)'; }}
          placeholder={tocada ? PLACEHOLDER_QUIETO : ejemplo}
          aria-label="Qué tiene que hacer la automatización"
          rows={2}
          maxLength={2000}
          disabled={p.deshabilitado}
          style={S.campo}
        />
        <BotonDictar titulo="Dictar el pedido" valor={pedido} onValor={(v) => { setPedido(v); parar(); }} onError={(m) => setEstado({ t: 'quieto', error: m })} />
      </div>
      {error}
      <div style={S.pie}>
        <span style={S.dim}>Nace pausada</span>
        <Button type="submit" variant="mako" disabled={!pedido.trim() || p.deshabilitado}>Crear</Button>
      </div>
    </form>
  );
}

/** El error, con la palabra «Integraciones» convertida en el link a donde se arregla (si lo hay). */
function TextoConLink({ texto, link }: { texto: string; link?: string }) {
  if (!link) return <>{texto}</>;
  const i = texto.indexOf('Integraciones');
  if (i < 0) return <>{texto} <Link href={link} style={S.link}>Abrir</Link></>;
  return <>{texto.slice(0, i)}<Link href={link} style={S.link}>Integraciones</Link>{texto.slice(i + 'Integraciones'.length)}</>;
}

// Sólo tokens que existen en claro y en oscuro (app/globals.css → [data-tema="oscuro"]).
const S: Record<string, CSSProperties> = {
  caja: {
    width: 'min(520px, 100%)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10,
    padding: '14px 18px 16px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)',
    boxShadow: '0 10px 30px rgba(18,21,27,.12)',
  },
  encabezado: { display: 'flex', alignItems: 'center', gap: 8 },
  titulo: { fontSize: 14, fontWeight: 700, color: 'var(--ink)' },
  fila: { display: 'flex', alignItems: 'flex-end', gap: 8 },
  campo: {
    flex: 1, minWidth: 0, boxSizing: 'border-box', resize: 'none', padding: '10px 0', border: 'none',
    borderBottom: '2px solid var(--border)', background: 'transparent', color: 'var(--ink)', font: 'inherit',
    fontSize: 16, lineHeight: 1.4, outline: 'none', overflowY: 'auto',
  },
  pie: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dim: { fontSize: 12.5, color: 'var(--faint)' },
  error: { margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--bad)' },
  link: { color: 'var(--primary)', fontWeight: 600, textDecoration: 'underline' },
  capa: {
    position: 'fixed', inset: 0, zIndex: 125, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16, background: 'rgba(18,21,27,.45)', backdropFilter: 'blur(2px)',
  },
  // La galería: a lo ancho del modal y sin sombra (ya está adentro de una caja).
  cajaEnModal: {
    width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 10,
    padding: '14px 18px 16px', borderRadius: 16, background: 'var(--surface)', border: '1.5px solid var(--mako-border)',
  },
  trabajandoEnModal: {
    width: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12,
    padding: '14px 18px 16px', borderRadius: 16, background: 'var(--surface)', border: '1.5px solid var(--mako-border)', outline: 'none',
  },
  trabajando: {
    width: 'min(440px, 100%)', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12,
    padding: 18, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)',
    boxShadow: '0 30px 70px rgba(18,21,27,.35)', outline: 'none',
  },
  cabeza: { display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap', minWidth: 0 },
  rotulo: { fontSize: 14, fontWeight: 600, color: 'var(--mako-ink)' },
  leido: { fontSize: 13, color: 'var(--dim)', overflow: 'hidden', textOverflow: 'ellipsis' },
  fases: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 },
  fase: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 },
  punto: { width: 8, height: 8, borderRadius: 999, flex: 'none' },
  barraWrap: { display: 'flex', flexDirection: 'column', gap: 4, width: 'min(460px, 100%)' },
  barra: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 4px 4px 12px', borderRadius: 999,
    background: 'var(--surface)', border: '1px solid var(--mako-border)', boxShadow: '0 4px 16px rgba(0,0,0,.08)',
  },
  chispa: { color: 'var(--mako-ink)', fontSize: 14, flex: 'none' },
  input: { flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', font: 'inherit', fontSize: 14, padding: '6px 0' },
};
