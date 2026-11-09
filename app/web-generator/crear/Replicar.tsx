'use client';

// =============================================================================
// crear/Replicar — «Replicar landing»: una página de afuera, copiada al editor en el formato elegido
// =============================================================================
// Pedido de Martín (14/10/2026), punto 3: «La sección de "Crear con IA", le faltan las opciones de "Analizar
// Landing" y "Replicar Landing"». Y su decisión (d) del mismo día: «Replicar en el editor» pregunta 3
// formatos — Presentación = diapositivas, Landing = secciones editables, Página web = la copia idéntica.
// El server ya los arma (POST /api/landing-generator/replicar con `formato`, lib/editor-landing/
// replicar-reglas.ts: `configDeReplica`); esto es la pantalla y lo que comparte con el Diagnóstico:
//   · `useReplicar`: el pedido con `{ url, formato, lectura?, texto? }` y, si sale bien, el editor (navegación
//     DURA: lo que cambió es QUÉ EXISTE). La URL va TAL CUAL la pegó la persona (con su www y su query: hay
//     hosts que sólo existen así; el server la baja con `urlTalCual`);
//   · `SelectorFormato`: los 3 formatos con su ícono del set (las pastillas de «Landing | Presentación»);
//   · `ReplicarUnaPagina`: la vista de la derecha del Panel con el link del cuadro y «Replica esta landing»: arranca sola.
//     Tanda 7: «Replicar landing» SIN link ya no abre esto; es un modo del cuadro (el contenedor del link, CajaCrear.tsx).
// Cuando el server no puede leer la página (una app de Vite/React, o una que le contesta 403) contesta
// `enNavegador` y se ofrece leerla en el navegador de la persona o pegar su texto (../lector/LeerOPegar.tsx).
// La copia «Página web» necesita el HTML: con ella el server no ofrece esa salida, y si propone otro formato
// (`probar`: una app de Vite o Lovable, un login, una página que no entra) se ofrece con un botón (`FallaReplicar`).
//
// TANDA 7 (15/10/2026). Martín: «Si no pudo leer la landing, no me debe saltar el botón de "MaKo no pudo leerla
// sola" y las opciones de leer en tu navegador... Por defecto si no pudo de una manera que vaya directo a abrir la
// ventana emergente...». `replicar` recibe la ventana que se abrió EN EL CLIC (`extra.ventana`: `abrirEnElClic`,
// o la que reservó el ↑ de la caja y toma el arranque automático con `tomarVentanaReservada`) y la usa con
// `pedirConVentana` (lib/editor-landing/lector-navegador.ts): si el server contesta `enNavegador`, la página se
// lee en ESA ventana y el pedido se repite con la lectura, sin ningún clic. LeerOPegar queda como la salida de
// un fallo (`salida`). La «Página web» no lee en el navegador: ahí no se abre ninguna ventana (`pideVentana`).
//
// 28/10/2026, Martín: «es muy importante que al momento de replicar una landing se defina qué se quiere replicar […]
// una cosa es replicar el branding, otra cosa es replicar la estructura, otra cosa es replicar los ángulos de
// comunicación, los copies». `ReplicarUnaPagina` va en DOS pasos:
//   1. «Leer»: MaKo lee la página (`useLeerParaReplicar`, POST /replicar/leer, con la ventana del clic si el server no
//      puede) y muestra lo que tiene: su estructura (cada sección con su molde), sus ángulos y su diseño
//      (`LecturaDeLaPagina`);
//   2. «Qué replicar» (`SelectorPartes`: Diseño · Estructura · Ángulos · Texto literal, combinables) y, sin el diseño de
//      la original, el tema propio de la persona (`SelectorTemaCrear`); «Replicar» manda las partes, el tema, los
//      ángulos ya leídos y la lectura del navegador (la réplica no vuelve a abrir una ventana).
//   El link pegado en la caja («Replica esta landing», «Replica y adapta») arranca el paso 1 solo, con la ventana que
//   reservó el ↑; las partes arrancan con el caso de Martín (estructura + ángulos) o, con «adapta», diseño + estructura
//   + ángulos. Lo último que eligió la persona (las partes y el tema) se recuerda en ESTE navegador.
//
// 28/10/2026, la regla de AGENTS.md («Lo que MaKo construye se ve CONSTRUYÉNDOSE»): la réplica se ve armarse. El server
// manda una línea por cosa armada (`enVivo`, lib/editor-landing/replicar-progreso.ts: el esquema, cada sección cuando su
// tanda volvió, el diseño) y `ArmadoEnVivo` (app/_ui) la muestra con una cadencia corta: las fases, un punto por sección
// y la lista que crece. Cuando terminó Y ya se ve todo, se abre el editor de la copia. La lectura llega entera: su lista
// de secciones también se revela de a una (`useRevelado`).
//
// 9/11/2026, el reel de Web Replicate (Martín: «COPIAR ESTO… Sobre todo la animación de los multiples mouse actuando»): lo
// armado se ve en un escenario con doce cursores con nombre que trazan una caja por sección, escriben su título y pintan
// el diseño (./EscenarioReplica.tsx, lib/editor-landing/replicar-escena.ts), atados a los MISMOS eventos y a la misma
// cadencia. El editor se abre `ESPERA_FINAL_MS` después de que se ve todo: lo que tardan en juntarse al lado del botón.
//
// TICKET #54 (4/11/2026, Leandro, ws 10): «quise volver para atrás […] se me borró completamente la página analizada […] lo que
// haría no sería que se borre, sino de que quede en estado borrador». Lo leído vivía SÓLO en esta pantalla: volver al chat
// desde la lista del editor (que cierra «Nueva landing»), ir a otra landing o el «atrás» se lo llevaban. Ahora la ruta de
// lectura lo guarda como BORRADOR del negocio con lo elegido (lib/editor-landing/replica-borrador.ts); esta pantalla, al abrir
// una dirección que tiene borrador, lo RETOMA sin volver a leer (`leerPagina`: no paga IA otra vez y no abre la ventana), guarda
// lo que la persona va eligiendo (qué replicar, el formato, el tema, «Tu oferta») y ofrece «Descartar». La réplica creada borra
// su borrador (la ruta de replicar). «Leer de nuevo» sobre lo que ya está a la vista lee de verdad.
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import type { Lectura } from '@/lib/editor-landing/lectura-tipos';
import type { TemaPropio } from '@/lib/editor-landing/api-tipos';
import { TEMAS } from '@/lib/editor-landing/temas';
import {
  NOMBRE_PARTE, PARTES_ADAPTAR, PARTES_REPLICA, PARTES_TODAS, alternarParte, formatoConPartes, listaDePartes,
  type ParteReplica, type PartesReplica,
} from '@/lib/editor-landing/replicar-partes';
import { resumenDeMolde } from '@/lib/editor-landing/replicar-estructura';
import { NOMBRE_TIPO_SECCION, type Angulos } from '@/lib/editor-landing/replicar-angulos';
import type { LecturaReplica, RespuestaLectura } from '@/lib/editor-landing/replicar-lectura-tipos';
import { leerEventos, vistaDeEventos, type EventoReplica } from '@/lib/editor-landing/replicar-progreso';
import { ArmadoEnVivo, useRevelado } from '@/app/_ui/ArmadoEnVivo';
import { ESPERA_FINAL_MS } from '@/lib/editor-landing/replicar-escena';
import { EscenarioReplica } from './EscenarioReplica';
import {
  abrirEnElClic, cerrarVentana, leerEnNavegador, mensajeSinFoto, pedirConVentana, tomarVentanaReservada,
  type SalidaSinLectura, type VentanaDelClic,
} from '@/lib/editor-landing/lector-navegador';
import {
  FORMATOS_REPLICAR, NOMBRE_FORMATO_REPLICAR, adaptaElFormato, formatoReplicar, type FormatoReplicar, type PedidoReplicar, type RespuestaReplicar,
} from '@/lib/editor-landing/replicar-reglas';
import { AVISO_SCROLL } from '@/lib/editor-landing/replicar-animaciones';
import { PLAZO_IA_MS, guardarLocal, leerLocal, postJson } from '../cliente';
import { dejarAvisoDeReplica } from './aviso-replica';
import { Ico, irDuro, type OpcionDesplegable } from '../MiniaturaLanding';
import { urlParaAnalizar } from '../panel-reglas';
import { LeerOPegar } from '../lector/LeerOPegar';
import { CSS_TIPO } from './PiezasTipo';
import { FORMATO_INICIAL } from './caja-modos';
import { SelectorTemaCrear, temaSugerido } from './SelectorTemaCrear';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { eleccionEnPantalla, esRelectura, lineaDeRetomado, type BorradorReplica, type EleccionReplica } from '@/lib/editor-landing/replica-borrador';
import { avisarBorradores, descartarBorrador, guardarEleccion, pedirBorrador } from './borradores-replica';
import { BloqueExtension, useReplicaConExtension, type FotoDeLaExtension } from './ConLaExtension';

/** El ícono de cada formato (lib/editor-landing/iconos.ts): las diapositivas, las secciones y la página. */
export const ICONO_FORMATO: Record<FormatoReplicar, string> = { presentacion: 'presentar', landing: 'paginas', web: 'globo' };

/** Los formatos como opciones de un desplegable (el del link pegado en la caja). */
export const OPCIONES_FORMATO: readonly OpcionDesplegable<FormatoReplicar>[] = FORMATOS_REPLICAR.map((f) => ({
  valor: f, texto: NOMBRE_FORMATO_REPLICAR[f], icono: ICONO_FORMATO[f],
}));

/** El formato por default: las secciones editables (vive en ./caja-modos.ts, puro: el link del cuadro arranca con él). */
export { FORMATO_INICIAL };

export type EstadoReplicar =
  | { fase: 'quieto' }
  /** `leyendo` (tanda 7): la página se está leyendo en la ventana del clic, antes de la segunda vuelta. */
  | { fase: 'replicando'; formato: FormatoReplicar; leyendo?: boolean }
  /** `salida` (tanda 7): por qué no se leyó SIN clic en la ventana del clic (LeerOPegar la muestra), o null. */
  | { fase: 'falla'; formato: FormatoReplicar; error: string; enNavegador: boolean; pegable: boolean; probar: FormatoReplicar | null; salida: SalidaSinLectura | null };

/** Lo que se le pasa a `replicar`: la página ya leída o el texto pegado, o la ventana abierta en el clic (tanda 7). */
export type ExtraReplicar = {
  lectura?: Lectura; texto?: string; ventana?: VentanaDelClic | null; adaptar?: boolean;
  /** 28/10/2026: qué se replica, el tema de la persona (sin el diseño de la original) y los ángulos ya leídos. */
  partes?: ParteReplica[]; tema?: string; angulos?: Angulos;
  /** «Tu oferta»: de qué habla la copia cuando el texto se escribe de nuevo. */
  oferta?: string;
};

/** Lo que puede medir el pedido de la copia idéntica: por arriba, la plataforma lo corta (4,5 MB) sin decir por qué. */
const TOPE_PEDIDO_FOTO = 4_200_000;
const sonTodas = (p: PartesReplica): boolean => p.diseno && p.estructura && p.angulos && p.texto;

/**
 * ¿Este Replicar puede necesitar la ventana de lectura? (Para abrirla en el clic SÓLO cuando sirve.) La «Página
 * web» necesita el HTML del server y no lee en el navegador; con la lectura o el texto ya a mano, tampoco.
 */
export const pideVentana = (formato: FormatoReplicar, extra: { lectura?: unknown; texto?: unknown } = {}): boolean =>
  formato !== 'web' && !extra.lectura && !extra.texto;

/** Lo que se hace con la copia recién creada en vez de abrir su editor (el «Aplicar» del Diagnóstico). */
export type AlReplicar = (copia: { id: number; titulo: string }) => Promise<void> | void;

/**
 * Replicar una página. `replicar(url, formato, extra, alListo?)` manda el pedido de la tanda 6 y, si sale
 * bien, abre el editor de la copia. `extra` es la página ya leída en el navegador (`lectura`) o el texto
 * pegado (`texto`): reemplazan la bajada (sólo en Presentación y Landing). `alListo` (decisión c de Martín:
 * «en una landing externa, "Aplicar" lleva a replicar primero y los comentarios pasan a la copia»): lo que
 * sigue con la copia, en vez del editor; el estado se queda en «replicando» mientras corre (navega solo).
 */
export function useReplicar(): {
  estado: EstadoReplicar;
  replicar: (url: string, formato: FormatoReplicar, extra?: ExtraReplicar, alListo?: AlReplicar) => Promise<void>;
} {
  const ws = useWs();
  const [estado, setEstado] = useState<EstadoReplicar>({ fase: 'quieto' });
  // La segunda vuelta (con la lectura) paga IA: no corre si la pantalla ya se fue.
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const replicar = useCallback(async (url: string, formato: FormatoReplicar, extra: ExtraReplicar = {}, alListo?: AlReplicar) => {
    const { ventana = null, adaptar = false, ...dato } = extra;
    const usaVentana = pideVentana(formato, dato);
    // Una ventana que este pedido no va a usar (no debería llegar: los clics preguntan `pideVentana`) no queda abierta.
    if (ventana && ventana !== 'bloqueada' && !usaVentana) cerrarVentana(ventana);
    setEstado({ fase: 'replicando', formato });
    const { r, sinLectura } = await pedirConVentana({
      url,
      ventana: usaVentana ? ventana : null,
      pedir: (lectura) => {
        // La segunda vuelta (ya leída): de «Leyendo la página…» a «Replicando…».
        if (lectura) setEstado({ fase: 'replicando', formato });
        const cuerpo: PedidoReplicar = formato === 'web'
          ? { url, formato }
          : { url, formato, ...dato, ...(lectura ? { lectura } : {}), ...(adaptar ? { adaptar: true } : {}) };
        return postJson<RespuestaReplicar>('/api/landing-generator/replicar', cuerpo, PLAZO_IA_MS);
      },
      pideNavegador: (x) => !x.ok && (x as { enNavegador?: boolean }).enNavegador === true,
      alLeer: () => setEstado({ fase: 'replicando', formato, leyendo: true }),
      sigue: () => montado.current,
    });
    // Lo que no se copió se lee al abrirse el editor de la copia (./aviso-replica.ts). Tanda 8: sólo la línea del scroll;
    // desde el 17/10/2026 TODO lo que avisa el server («quedó sin diseño», «sin el estilo de la original», «imágenes no
    // copiadas», el scroll), que hasta ahí sólo leía MaKo. Y también cuando la copia sigue con otra cosa (`alListo`:
    // «Aplicar» del Diagnóstico sobre una landing de afuera), para cuando se abra su editor.
    if (r.ok) {
      const aviso = r.aviso ?? (r.avisoScroll ? AVISO_SCROLL : null);
      if (aviso) dejarAvisoDeReplica(r.id, aviso);
    }
    // Sale bien: el editor de la copia (se queda «replicando» mientras navega), o lo que siga con ella.
    if (r.ok && alListo) { await alListo({ id: r.id, titulo: r.titulo }); return; }
    if (r.ok) {
      irDuro(`/web-generator/${r.id}`, ws);
      return;
    }
    const f = r as { error: string; enNavegador?: boolean; pegable?: boolean; probar?: unknown };
    const probar = formatoReplicar(f.probar);
    setEstado({
      fase: 'falla', formato, error: f.error, enNavegador: f.enNavegador === true, pegable: f.pegable === true,
      probar: probar && probar !== formato ? probar : null, salida: sinLectura,
    });
  }, [ws]);
  return { estado, replicar };
}

/** De dónde sale la foto de la copia idéntica: la ventana abierta en el clic (el lector) o la que trajo la extensión. */
export type OpcionesFoto = { ventanaFoto?: VentanaDelClic | null; foto?: Record<string, unknown> };

/**
 * Replicar A LA VISTA (28/10/2026): el mismo pedido que `useReplicar`, con `enVivo`, leyendo el flujo de eventos
 * (`eventos`) mientras el server arma la copia. No abre ventanas (la página ya se leyó en el paso 1). Si sale bien, deja
 * el aviso de lo que no se copió y la copia en `lista`: la pantalla abre su editor cuando terminó de mostrarse. Si la
 * ruta contesta sin flujo (la puerta: 401, 403), se lee como la respuesta de siempre.
 */
export function useReplicarEnVivo(): {
  estado: EstadoReplicar;
  eventos: readonly EventoReplica[];
  lista: { id: number } | null;
  replicar: (url: string, formato: FormatoReplicar, extra?: Omit<ExtraReplicar, 'ventana'>, op?: OpcionesFoto) => Promise<void>;
} {
  const [estado, setEstado] = useState<EstadoReplicar>({ fase: 'quieto' });
  const [eventos, setEventos] = useState<EventoReplica[]>([]);
  const [lista, setLista] = useState<{ id: number } | null>(null);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const replicar = useCallback(async (url: string, formato: FormatoReplicar, extra: Omit<ExtraReplicar, 'ventana'> = {}, op: OpcionesFoto = {}) => {
    const { adaptar = false, ...dato } = extra;
    setEventos([]);
    setLista(null);
    setEstado({ fase: 'replicando', formato });
    const fallar = (error: string) => setEstado({ fase: 'falla', formato, error, enNavegador: false, pegable: false, probar: 'landing', salida: null });
    // La copia idéntica (28/10/2026): la FOTO de la página ya armada, en el navegador de la persona (lector-script.ts), en
    // la ventana que se abrió en el clic de «Replicar». Sin ventana (`ventanaFoto` ausente), la «Página web» de antes.
    // O la foto que ya trajo la extensión de MaKo desde la pestaña real de la persona (ConLaExtension.tsx): sin ventana.
    let foto: unknown = formato === 'web' ? op.foto : undefined;
    if (formato === 'web' && foto === undefined && op.ventanaFoto !== undefined) {
      setEventos([{ fase: 'leer' }]);
      const v = op.ventanaFoto;
      const l = await leerEnNavegador(url, { foto: true, ...(v && v !== 'bloqueada' ? { ventana: v } : {}) });
      if (!montado.current) return;
      // Sin foto, el MOTIVO que mandó el lector (lector-navegador.ts → mensajeSinFoto), no un «Vuelve a intentar» para todo.
      if (!l.ok || !l.foto) { fallar(l.ok ? mensajeSinFoto(l.sinFoto) : l.mensaje); return; }
      foto = l.foto;
    }
    const cuerpo = { ...(formato === 'web' ? { url, formato, ...(foto ? { foto } : {}) } : { url, formato, ...dato, ...(adaptar ? { adaptar: true } : {}) }), enVivo: true };
    const json = JSON.stringify(cuerpo);
    if (json.length > TOPE_PEDIDO_FOTO) { fallar('La página pesa demasiado para copiarla tal cual.'); return; }
    let r: RespuestaReplicar = { ok: false, error: 'La réplica se cortó antes de terminar. Vuelve a intentar.' };
    try {
      const res = await fetch('/api/landing-generator/replicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: json, signal: AbortSignal.timeout(PLAZO_IA_MS) });
      if (res.body && /ndjson/.test(res.headers.get('content-type') ?? '')) {
        const lector = res.body.getReader();
        const dec = new TextDecoder();
        let resto = '';
        for (;;) {
          const { done, value } = await lector.read();
          const l = leerEventos(resto, done ? '\n' : dec.decode(value, { stream: true }));
          resto = l.resto;
          if (l.eventos.length && montado.current) setEventos((prev) => [...prev, ...l.eventos]);
          for (const e of l.eventos) if (e.fase === 'fin') r = e.respuesta;
          if (done) break;
        }
      } else {
        const d = await res.json().catch(() => null) as RespuestaReplicar | null;
        if (d && typeof d.ok === 'boolean') r = d;
        else r = { ok: false, error: `Error ${res.status}` };
      }
    } catch {
      r = { ok: false, error: 'Se cortó la conexión mientras se replicaba. Vuelve a intentar.' };
    }
    if (!montado.current) return;
    if (r.ok) {
      const aviso = r.aviso ?? (r.avisoScroll ? AVISO_SCROLL : null);
      if (aviso) dejarAvisoDeReplica(r.id, aviso);
      setLista({ id: r.id });
      // Su borrador lo borró la ruta (ticket #54): la lista de «Sin terminar» se vuelve a pedir.
      avisarBorradores();
      return;
    }
    const f = r as { error: string; enNavegador?: boolean; pegable?: boolean; probar?: unknown };
    const probar = formatoReplicar(f.probar);
    setEstado({ fase: 'falla', formato, error: f.error, enNavegador: f.enNavegador === true, pegable: f.pegable === true, probar: probar && probar !== formato ? probar : null, salida: null });
  }, []);
  return { estado, eventos, lista, replicar };
}

/**
 * La falla de Replicar: el error y, si el server propone otro formato (`probar`), el botón que replica así.
 * Verificación de la tanda 6: una app de Vite o Lovable en «Página web» terminaba en «La página no trae nada
 * para copiar.», sin salida; «Landing» sí la lee (en el navegador de la persona, si hace falta).
 */
export function FallaReplicar({ error, probar, onProbar, deshabilitado, clase = 'gp-error' }: {
  error: string;
  probar: FormatoReplicar | null;
  onProbar: (f: FormatoReplicar) => void;
  deshabilitado?: boolean;
  clase?: string;
}) {
  return (
    <>
      <p className={clase} role="alert">{error}<ReportarASoporte /></p>
      {probar && (
        <button type="button" className="gp-btn gp-btn-contorno" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={deshabilitado} onClick={() => onProbar(probar)}>
          <Ico n={ICONO_FORMATO[probar]} t={14} /> Replicar como {NOMBRE_FORMATO_REPLICAR[probar]}
        </button>
      )}
    </>
  );
}

/** Los 3 formatos de Replicar, con su ícono: un radiogroup con la cara de las pastillas «Landing | Presentación». */
export function SelectorFormato({ valor, onCambio, deshabilitado, adaptar = false, partes }: {
  valor: FormatoReplicar;
  onCambio: (f: FormatoReplicar) => void;
  deshabilitado?: boolean;
  /** Adaptada a la oferta: la copia idéntica no se reescribe (`adaptaElFormato`). */
  adaptar?: boolean;
  /** Lo que se replica (28/10/2026): la copia idéntica es TODO (`formatoConPartes`). */
  partes?: PartesReplica;
}) {
  return (
    <div className="gp-tipos" role="radiogroup" aria-label="Formato">
      {FORMATOS_REPLICAR.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          className="gp-tipo"
          aria-checked={valor === f}
          disabled={deshabilitado || (adaptar && !adaptaElFormato(f)) || (!!partes && !formatoConPartes(f, partes))}
          onClick={() => onCambio(f)}
        >
          <Ico n={ICONO_FORMATO[f]} t={15} />
          {NOMBRE_FORMATO_REPLICAR[f]}
        </button>
      ))}
    </div>
  );
}

/**
 * QUÉ se replica (28/10/2026): cuatro partes que se prenden y se apagan (`alternarParte`: el texto literal trae la
 * estructura y los ángulos). Botones con `aria-pressed`, con la cara de las pastillas «Landing | Presentación».
 */
export function SelectorPartes({ partes, onCambio, deshabilitado }: { partes: PartesReplica; onCambio: (p: PartesReplica) => void; deshabilitado?: boolean }) {
  return (
    <div className="gp-rp-partes" role="group" aria-label="Qué replicar">
      {PARTES_REPLICA.map((k) => (
        <button key={k} type="button" className="gp-rp-parte" aria-pressed={partes[k]} disabled={deshabilitado} onClick={() => onCambio(alternarParte(partes, k))}>
          <span className="gp-rp-parte-cabeza"><Ico n={partes[k] ? 'check' : NOMBRE_PARTE[k].icono} t={15} />{NOMBRE_PARTE[k].nombre}</span>
          <span className="gp-rp-parte-detalle">{NOMBRE_PARTE[k].detalle}</span>
        </button>
      ))}
    </div>
  );
}

/** Lo que dice la pantalla de lo elegido, en una línea (lo que viene de la original y lo que es propio). */
export function lineaDePartes(p: PartesReplica): string {
  const tomado = listaDePartes(p).map((k) => NOMBRE_PARTE[k].nombre.toLowerCase());
  const propio = [!p.diseno ? 'tu diseño' : '', !p.texto ? 'el texto escrito para tu oferta' : ''].filter(Boolean);
  return `De la original: ${tomado.join(', ')}.${propio.length ? ` Tuyo: ${propio.join(' y ')}.` : ''}`;
}

/** Cuántas secciones se ven antes de «Ver todas». */
const SECCIONES_A_LA_VISTA = 6;

/**
 * La lectura de la página, ANTES de replicar: su estructura (cada sección con su papel en la venta y su molde), sus
 * ángulos y su diseño. Todo texto plano: sale de la página de un tercero y de la IA.
 */
export function LecturaDeLaPagina({ lectura }: { lectura: LecturaReplica }) {
  const [todas, setTodas] = useState(false);
  const a = lectura.angulos;
  const tipoDe = (i: number) => a?.secciones.find((s) => s.n === i + 1)?.tipo;
  // Llega entera de una vez: igual se revela de a una sección (AGENTS.md, «se ve CONSTRUYÉNDOSE»).
  const { visibles } = useRevelado(lectura.secciones.length);
  const secciones = (todas ? lectura.secciones : lectura.secciones.slice(0, SECCIONES_A_LA_VISTA)).slice(0, visibles);
  const host = (() => { try { return new URL(lectura.url).hostname.replace(/^www\./, ''); } catch { return lectura.url; } })();
  const fila = (rotulo: string, v: string | string[] | undefined) => {
    const lista = Array.isArray(v) ? v.filter(Boolean) : v ? [v] : [];
    if (!lista.length) return null;
    return (
      <div className="gp-rp-dato">
        <dt>{rotulo}</dt>
        <dd>{lista.length === 1 ? lista[0] : <ul>{lista.map((x, k) => <li key={k}>{x}</li>)}</ul>}</dd>
      </div>
    );
  };
  return (
    <section className="gp-rp-lectura" aria-label="Lo que tiene esta landing">
      <h2 className="gp-rp-titulo">Lo que tiene {host}</h2>
      <div className="gp-rp-bloque">
        <h3 className="gp-rp-sub"><Ico n="paginas" t={15} /> Estructura · {lectura.secciones.length} {lectura.secciones.length === 1 ? 'sección' : 'secciones'}</h3>
        <ol className="gp-rp-secciones">
          {secciones.map((m, i) => {
            const tipo = tipoDe(i);
            return (
              <li key={i} className="gp-rp-sec-entra">
                <span className="gp-rp-sec-titulo">{tipo && tipo !== 'otro' ? <span className="gp-rp-chip">{NOMBRE_TIPO_SECCION[tipo]}</span> : null}{m.titulo}</span>
                <span className="gp-rp-sec-molde">{resumenDeMolde(m) || 'Sólo el título'}</span>
              </li>
            );
          })}
        </ol>
        {lectura.secciones.length > SECCIONES_A_LA_VISTA && (
          <button type="button" className="gp-btn gp-btn-contorno gp-rp-ver" onClick={() => setTodas((t) => !t)} aria-expanded={todas}>
            {todas ? 'Ver menos' : `Ver las ${lectura.secciones.length}`}
          </button>
        )}
      </div>
      <div className="gp-rp-bloque">
        <h3 className="gp-rp-sub"><Ico n="objetivo" t={15} /> Ángulos</h3>
        {a ? (
          <dl className="gp-rp-datos">
            {fila('Promesa', a.promesa)}
            {fila('A quién le habla', a.avatar)}
            {fila('Dolores', a.dolores)}
            {fila('Forma de venta', a.formaDeVenta)}
            {fila('Objeciones', a.objeciones)}
            {fila('Prueba', a.pruebaSocial)}
            {fila('Oferta', a.oferta)}
          </dl>
        ) : (
          <p className="gp-rp-nota" role="status">{lectura.errorAngulos ?? 'MaKo no pudo leer los ángulos.'} La estructura y el diseño se replican igual.</p>
        )}
      </div>
      <div className="gp-rp-bloque">
        <h3 className="gp-rp-sub"><Ico n="paleta" t={15} /> Diseño</h3>
        {lectura.diseno ? (
          <div className="gp-rp-diseno">
            <span className="gp-rp-colores" aria-label={`Colores: ${lectura.diseno.colores.join(', ')}`}>
              {lectura.diseno.colores.map((c) => <span key={c} className="gp-rp-color" style={{ background: c }} title={c} />)}
            </span>
            {lectura.diseno.fuentes.length ? <span className="gp-rp-fuentes">{lectura.diseno.fuentes.join(' · ')}</span> : null}
          </div>
        ) : (
          <p className="gp-rp-nota">No se leyó su diseño.</p>
        )}
      </div>
    </section>
  );
}

/** Lo que tarda la lectura como mucho (la ruta tiene 120 s). */
const PLAZO_LECTURA_MS = 125_000;

export type EstadoLectura =
  | { fase: 'quieta' }
  | { fase: 'leyendo'; enVentana?: boolean }
  /** `leidaEnNavegador` / `texto`: de dónde salió, para que la réplica use lo mismo sin abrir otra ventana. */
  | { fase: 'leida'; url: string; lectura: LecturaReplica; leidaEnNavegador: Lectura | null; texto: string | null }
  | { fase: 'falla'; url: string; error: string; enNavegador: boolean; pegable: boolean; salida: SalidaSinLectura | null };

/**
 * Leer una página antes de replicarla. `leer(url, { ventana })` con la ventana abierta EN EL CLIC (o la reservada por el
 * ↑ de la caja): si el server no puede, la página se lee en ESA ventana y el pedido se repite con la lectura, como en
 * `useReplicar`. Con `lectura` (el lector manual) o `texto` (pegado), sin ventana.
 */
export function useLeerParaReplicar(): {
  estado: EstadoLectura;
  leer: (url: string, extra?: { ventana?: VentanaDelClic | null; lectura?: Lectura; texto?: string; sinAngulos?: boolean; eleccion?: EleccionReplica }) => Promise<void>;
  /** Lo leído antes, desde su borrador (ticket #54): sin volver a leer. */
  retomar: (url: string, b: BorradorReplica) => void;
  /** «Descartar»: vuelve a la dirección sola. */
  olvidar: () => void;
} {
  const [estado, setEstado] = useState<EstadoLectura>({ fase: 'quieta' });
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  const leer = useCallback(async (url: string, extra: { ventana?: VentanaDelClic | null; lectura?: Lectura; texto?: string; sinAngulos?: boolean; eleccion?: EleccionReplica } = {}) => {
    const { ventana = null, sinAngulos = false, eleccion, ...dato } = extra;
    const usaVentana = !dato.lectura && !dato.texto;
    if (ventana && ventana !== 'bloqueada' && !usaVentana) cerrarVentana(ventana);
    setEstado({ fase: 'leyendo' });
    const { r, lectura, sinLectura } = await pedirConVentana({
      url,
      ventana: usaVentana ? ventana : null,
      pedir: (leida) => {
        if (leida) setEstado({ fase: 'leyendo' });
        // `eleccion`: lo que eligió la persona, para el borrador que guarda la ruta (ticket #54).
        return postJson<RespuestaLectura>('/api/landing-generator/replicar/leer', { url, ...dato, ...(leida ? { lectura: leida } : {}), ...(sinAngulos ? { angulos: false } : {}), ...(eleccion ? { eleccion } : {}) }, PLAZO_LECTURA_MS);
      },
      pideNavegador: (x) => !x.ok && (x as { enNavegador?: boolean }).enNavegador === true,
      alLeer: () => setEstado({ fase: 'leyendo', enVentana: true }),
      sigue: () => montado.current,
    });
    if (!montado.current) return;
    if (r.ok) {
      setEstado({ fase: 'leida', url, lectura: r.lectura, leidaEnNavegador: lectura ?? dato.lectura ?? null, texto: dato.texto ?? null });
      avisarBorradores();
      return;
    }
    const f = r as { error: string; enNavegador?: boolean; pegable?: boolean };
    setEstado({ fase: 'falla', url, error: f.error, enNavegador: f.enNavegador === true, pegable: f.pegable === true, salida: sinLectura });
  }, []);
  const retomar = useCallback((url: string, b: BorradorReplica) => {
    setEstado({ fase: 'leida', url, lectura: b.lectura, leidaEnNavegador: (b.fuente.lectura as Lectura | null) ?? null, texto: b.fuente.texto });
  }, []);
  const olvidar = useCallback(() => setEstado({ fase: 'quieta' }), []);
  return { estado, leer, retomar, olvidar };
}

/** Lo último que eligió la persona, en ESTE navegador (una comodidad, nunca un dato: puede volver vacío). */
const CLAVE_PARTES = 'gp.replicar.partes';
const CLAVE_TEMA = 'gp.replicar.tema';
const CLAVE_OFERTA = 'gp.replicar.oferta';
/** Lo que se acepta de «Tu oferta» (`TOPE_OFERTA` de replicar-partes.ts). */
const TOPE_OFERTA_PANTALLA = 1_200;

/**
 * El tema con que nace la réplica sin el diseño de la original: el último que eligió la persona; si no, su primer tema
 * propio que no sea el estilo de otra página replicada («Estilo de …»); si no, el sugerido para vender.
 */
export function temaInicialDeReplica(propios: readonly TemaPropio[], guardado: string | null): string {
  if (guardado && (TEMAS.some((t) => t.id === guardado) || propios.some((p) => `ws:${p.id}` === guardado))) return guardado;
  const mio = propios.find((p) => !/^Estilo de /i.test(p.nombre));
  return mio ? `ws:${mio.id}` : temaSugerido('vender');
}

/**
 * «Replicar landing», a la derecha del Panel: la dirección y «Leer»; después lo que tiene la página, qué replicar, el
 * tema (sin el diseño de la original), el formato y «Replicar». Con `auto` (el link pegado en la caja con «Replica esta
 * landing») LEE sola, UNA vez: el clic ya fue el ↑ de la caja. Replicar sigue siendo un clic: es lo que se paga.
 */
export function ReplicarUnaPagina({ url: urlInicial, formato: formatoInicial, adaptar: adaptarInicial = false, auto = false, propios = [], entrega }: {
  url?: string;
  /** La foto que ya está en la extensión de MaKo (Replicar abierto por ella, `?extension=`): se toma en vez de leer. */
  entrega?: string;
  formato?: FormatoReplicar;
  /** «Replica y adapta a tu oferta» (la pastilla del link): arranca con diseño + estructura + ángulos. */
  adaptar?: boolean;
  auto?: boolean;
  /** Los temas propios del negocio (para «Tu diseño»). */
  propios?: readonly TemaPropio[];
}) {
  const [texto, setTexto] = useState(urlInicial ?? '');
  // Martín, 28/10/2026 (~09:40): «Enfocate primero en replicar tal cual, tanto en diseño como copy y luego vemos de
  // personalizarlo». Replicar arranca SIEMPRE en la copia idéntica (las cuatro partes, «Página web»); personalizar es
  // elegir otras partes, a mano. Sólo «Replica y adapta» (la pastilla del link) arranca adaptando.
  const [partes, setPartes] = useState<PartesReplica>(() => (adaptarInicial ? PARTES_ADAPTAR : PARTES_TODAS));
  const [formato, setFormato] = useState<FormatoReplicar>(() => (sonTodas(partes) ? 'web' : formatoInicial && formatoConPartes(formatoInicial, partes) ? formatoInicial : FORMATO_INICIAL));
  const partesVivas = useRef(partes);
  partesVivas.current = partes;
  const [tema, setTema] = useState<string>(() => temaInicialDeReplica(propios, leerLocal<string | null>(CLAVE_TEMA, null)));
  // De qué habla la copia escrita de nuevo. Sin ella (y sin el perfil del negocio cargado) la IA vuelve sobre la oferta de la
  // competencia: medido el 28/10/2026 en el ws9, la réplica de Reportei seguía hablando de Reportei.
  const [oferta, setOferta] = useState<string>(() => leerLocal<string>(CLAVE_OFERTA, ''));
  const sugerido = useMemo(() => temaSugerido('vender'), []);
  const { estado: lectura, leer, retomar, olvidar } = useLeerParaReplicar();
  // El borrador (ticket #54): cuándo se leyó lo que se retomó, y si se está buscando antes de leer.
  const [retomado, setRetomado] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  // Mientras se borra, «Leer» no puede retomar lo que se está descartando.
  const [descartando, setDescartando] = useState(false);
  const { estado, eventos, lista, replicar } = useReplicarEnVivo();
  const ws = useWs();
  const vista = useMemo(() => vistaDeEventos(eventos), [eventos]);
  // La copia está lista: se abre su editor cuando ya se vio armarse (`onTodoVisible`), o a los pocos segundos si no.
  const abrirCopia = useCallback(() => { if (lista) irDuro(`/web-generator/${lista.id}`, ws); }, [lista, ws]);
  useEffect(() => {
    if (!lista) return;
    const t = setTimeout(abrirCopia, 8_000);
    return () => clearTimeout(t);
  }, [lista, abrirCopia]);
  // «Copiar con la extensión» (9/11/2026): la página que el servidor no baja, copiada en la pestaña real de la persona. La
  // foto queda acá (por su dirección) y es la que usa «Replicar» en «Página web», sin abrir ninguna ventana.
  const [fotoExt, setFotoExt] = useState<{ url: string; foto: Record<string, unknown> } | null>(null);
  const lecturaViva = useRef(lectura);
  lecturaViva.current = lectura;
  const alTomarDeExtension = useCallback((f: FotoDeLaExtension) => {
    setFotoExt({ url: f.url, foto: f.foto });
    const l = lecturaViva.current;
    // Ya se había leído (falló la foto de la ventana al replicar «Página web»): se replica con ésta.
    if (l.fase === 'leida' && l.url === f.url) { void replicar(f.url, 'web', {}, { foto: f.foto }); return; }
    const t = f.texto.trim();
    // Con su texto, el paso «Leer» (la estructura de la página) sale de él, sin bajarla; sin texto (una página de imágenes),
    // la copia idéntica directo.
    if (t.length >= 40) void leer(f.url, { texto: t, eleccion: eleccionViva.current, ...(sonTodas(partesVivas.current) ? { sinAngulos: true } : {}) });
    else void replicar(f.url, 'web', {}, { foto: f.foto });
  }, [leer, replicar]);
  const ext = useReplicaConExtension(alTomarDeExtension);
  const recibirDeExtension = ext.recibir;
  const campo = useRef<HTMLInputElement>(null);
  const url = urlParaAnalizar(texto);
  const leyendo = lectura.fase === 'leyendo';
  const replicando = estado.fase === 'replicando' || !!lista;
  const ocupado = leyendo || replicando || buscando || descartando;
  /** Lo elegido, tal como va al borrador. */
  const eleccion = useMemo<EleccionReplica>(() => ({
    partes: listaDePartes(partes), formato, oferta: oferta.trim().slice(0, TOPE_OFERTA_PANTALLA), tema: partes.diseno ? null : tema, adaptar: adaptarInicial,
  }), [partes, formato, oferta, tema, adaptarInicial]);
  const eleccionViva = useRef(eleccion);
  eleccionViva.current = eleccion;
  const leidaViva = useRef<string | null>(null);
  leidaViva.current = lectura.fase === 'leida' ? lectura.url : null;

  /** Lo leído antes vuelve a la pantalla tal como quedó: la lectura y lo elegido. */
  const retomarBorrador = useCallback((u: string, b: BorradorReplica) => {
    const e = eleccionEnPantalla(b.eleccion, FORMATO_INICIAL);
    setPartes(e.partes);
    setFormato(e.formato);
    if (e.oferta) setOferta(e.oferta);
    if (e.tema) setTema(e.tema);
    retomar(u, b);
    setRetomado(b.actualizado);
  }, [retomar]);

  /** Leer `u`. `ventana`: la que se abrió EN EL CLIC (el submit) o la que reservó el ↑ de la caja (el arranque). */
  // Con la copia idéntica (las cuatro partes), la lectura no paga los ángulos: no los usa.
  // Ticket #54: si esa dirección tiene borrador, se RETOMA (sin leer, sin la ventana); «Leer de nuevo» sobre lo que ya está a la
  // vista lee de verdad.
  const leerPagina = useCallback((u: string, ventana: VentanaDelClic | null) => {
    const releer = esRelectura(leidaViva.current, u);
    void (async () => {
      setBuscando(true);
      const b = releer ? null : await pedirBorrador(u);
      setBuscando(false);
      if (b) {
        if (ventana && ventana !== 'bloqueada') cerrarVentana(ventana);
        retomarBorrador(u, b);
        return;
      }
      setRetomado(null);
      void leer(u, { ventana, eleccion: eleccionViva.current, ...(sonTodas(partesVivas.current) ? { sinAngulos: true } : {}) });
    })();
  }, [leer, retomarBorrador]);

  // Lo que se va eligiendo queda en el borrador (con un respiro), y lo último sale aunque la pantalla se cierre.
  const urlLeida = lectura.fase === 'leida' ? lectura.url : null;
  const pendiente = useRef<{ url: string; eleccion: EleccionReplica } | null>(null);
  const guardada = useRef<string | null>(null);
  useEffect(() => {
    // Replicando, lo pendiente no sale: la réplica ya lleva lo elegido, y su borrador se borra al salir bien.
    if (!urlLeida || replicando) { if (replicando) pendiente.current = null; return; }
    const firma = `${urlLeida}|${JSON.stringify(eleccion)}`;
    // La primera vez es la de la lectura (la guardó la ruta) o la del borrador retomado: no hay nada nuevo.
    if (guardada.current === null || !guardada.current.startsWith(`${urlLeida}|`)) { guardada.current = firma; return; }
    // Volvió a lo que ya está guardado: lo intermedio no sale.
    if (guardada.current === firma) { pendiente.current = null; return; }
    pendiente.current = { url: urlLeida, eleccion };
    const t = setTimeout(() => {
      const p = pendiente.current;
      if (!p) return;
      pendiente.current = null;
      guardada.current = firma;
      void guardarEleccion(p.url, p.eleccion);
    }, 900);
    return () => clearTimeout(t);
  }, [urlLeida, eleccion, replicando]);
  useEffect(() => () => { const p = pendiente.current; if (p) void guardarEleccion(p.url, p.eleccion, { alSalir: true }); }, []);

  const descartar = useCallback(() => {
    if (!urlLeida) return;
    pendiente.current = null;
    guardada.current = null;
    setRetomado(null);
    olvidar();
    setDescartando(true);
    void descartarBorrador(urlLeida).finally(() => setDescartando(false));
  }, [urlLeida, olvidar]);

  // El ref sobrevive al doble montaje del modo estricto: la lectura se paga una sola vez (y la ventana se toma una).
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    const u = urlParaAnalizar(urlInicial);
    if (entrega && u) recibirDeExtension(entrega, u);
    else if (auto && u) leerPagina(u, tomarVentanaReservada(u));
    else campo.current?.focus();
  }, [auto, urlInicial, leerPagina, entrega, recibirDeExtension]);

  /**
   * Replicar lo leído como `f`, con las partes elegidas. La copia idéntica («Página web») lleva la ventana abierta EN EL CLIC
   * (`ventanaFoto`): ahí el lector saca la foto de la página. Lo demás, sin ventana: si hizo falta el navegador, ya se leyó.
   */
  const replicarLeida = (f: FormatoReplicar, ventanaFoto?: VentanaDelClic | null) => {
    if (lectura.fase !== 'leida') return;
    if (f === 'web') {
      // Con la foto de la extensión, ésa (la ventana del lector bajaría la página por el servidor, que no puede).
      if (fotoExt && fotoExt.url === lectura.url) { if (ventanaFoto && ventanaFoto !== 'bloqueada') cerrarVentana(ventanaFoto); void replicar(lectura.url, f, {}, { foto: fotoExt.foto }); return; }
      void replicar(lectura.url, f, {}, { ventanaFoto: ventanaFoto ?? null });
      return;
    }
    guardarLocal(CLAVE_PARTES, listaDePartes(partes));
    if (!partes.diseno) guardarLocal(CLAVE_TEMA, tema);
    const tuOferta = partes.texto ? '' : oferta.trim().slice(0, TOPE_OFERTA_PANTALLA);
    if (tuOferta) guardarLocal(CLAVE_OFERTA, tuOferta);
    const angulos = partes.angulos && !partes.texto ? lectura.lectura.angulos : null;
    void replicar(lectura.url, f, {
      ...(lectura.leidaEnNavegador ? { lectura: lectura.leidaEnNavegador } : {}),
      ...(lectura.texto ? { texto: lectura.texto } : {}),
      partes: listaDePartes(partes),
      ...(!partes.diseno ? { tema } : {}),
      ...(angulos ? { angulos } : {}),
      ...(tuOferta ? { oferta: tuOferta } : {}),
    });
  };
  /** ¿«Página web» ya tiene su foto (la de la extensión)? Entonces el clic de Replicar no abre ninguna ventana. */
  const conFotoExt = lectura.fase === 'leida' && !!fotoExt && fotoExt.url === lectura.url;
  const bloqueExt = (u: string, primario: boolean) => (
    <BloqueExtension estado={ext.estado} onEmpezar={() => ext.empezar(u)} onVolver={ext.volver} onCancelar={ext.cancelar} primario={primario} />
  );
  const cambiarPartes = (p: PartesReplica) => {
    setPartes(p);
    if (sonTodas(p)) setFormato('web');
    else if (!formatoConPartes(formato, p)) setFormato(FORMATO_INICIAL);
  };

  return (
    <section className="gp-analizar gp-replicar" aria-label="Replicar landing">
      <style href="gp-tipo" precedence="medium">{CSS_TIPO}</style>
      <style href="gp-replicar" precedence="medium">{CSS_REPLICAR}</style>
      <h1 className="gp-cabeza-titulo">Replicar landing</h1>
      <p className="gp-analizar-sub">Pega la dirección: MaKo la lee y eliges qué replicar.</p>
      {/* La ventana se abre EN ESTE submit (el clic o el Enter), primera cosa y sin nada antes (tanda 7). */}
      <form className="gp-analizar-fila" onSubmit={(e) => { e.preventDefault(); if (url && !ocupado) leerPagina(url, abrirEnElClic()); }}>
        <input
          ref={campo}
          className="gp-campo"
          inputMode="url"
          autoComplete="url"
          value={texto}
          maxLength={2_000}
          placeholder="https://su-landing.com"
          aria-label="Dirección de la página"
          disabled={ocupado}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className={`gp-btn ${lectura.fase === 'leida' ? 'gp-btn-contorno' : 'gp-btn-primario'}`} data-tam="lg" disabled={!url || ocupado}>
          {leyendo ? <span className="gp-giro" aria-hidden /> : <Ico n="reporte" t={14} />} {lectura.fase === 'leida' ? 'Leer de nuevo' : 'Leer'}
        </button>
      </form>
      {leyendo && (
        <p className="gp-analizar-sub gp-replicar-estado" role="status">
          <span className="gp-giro" aria-hidden /> {lectura.enVentana ? 'Leyendo la página en tu navegador…' : 'Leyendo la página: su estructura, sus ángulos y su diseño…'}
        </p>
      )}
      {lectura.fase === 'falla' && (lectura.enNavegador || lectura.pegable) ? (
        <LeerOPegar
          key={`${lectura.url}|${lectura.salida?.motivo ?? ''}`}
          url={lectura.url}
          error={lectura.error}
          enNavegador={lectura.enNavegador}
          ocupado={false}
          accionTexto="Leer este texto"
          salida={lectura.salida}
          onLectura={(l) => void leer(lectura.url, { lectura: l, eleccion, ...(sonTodas(partes) ? { sinAngulos: true } : {}) })}
          onTexto={(t) => void leer(lectura.url, { texto: t, eleccion, ...(sonTodas(partes) ? { sinAngulos: true } : {}) })}
          extension={fotoExt && fotoExt.url === lectura.url ? (
            <button type="button" className="gp-btn gp-btn-primario" disabled={replicando} onClick={() => void replicar(lectura.url, 'web', {}, { foto: fotoExt.foto })}>
              <Ico n="copiar" t={14} /> Replicar la copia tal cual
            </button>
          ) : bloqueExt(lectura.url, true)}
        />
      ) : lectura.fase === 'falla' ? (
        <p className="gp-error" role="alert">{lectura.error}<ReportarASoporte /></p>
      ) : null}
      {buscando && (
        <p className="gp-analizar-sub gp-replicar-estado" role="status"><span className="gp-giro" aria-hidden /> Buscando lo que ya leíste…</p>
      )}
      {/* La foto que trajo la extensión, mientras se toma (o si no se pudo tomar), cuando la pantalla no leyó nada todavía. */}
      {lectura.fase === 'quieta' && ext.estado.fase !== 'quieta' && ext.estado.fase !== 'lista' && <div className="gp-replicar-ext">{bloqueExt(urlParaAnalizar(urlInicial) ?? url ?? '', true)}</div>}
      {lectura.fase === 'leida' && (
        <>
          {retomado && (
            <p className="gp-rp-nota gp-rp-retomado" role="status">
              {lineaDeRetomado(retomado)}
              <button type="button" className="gp-rp-descartar" disabled={replicando} onClick={descartar}>Descartar</button>
            </p>
          )}
          <LecturaDeLaPagina lectura={lectura.lectura} />
          <section className="gp-rp-elegir" aria-label="Qué replicar">
            <h2 className="gp-rp-titulo">Qué replicar</h2>
            <SelectorPartes partes={partes} onCambio={cambiarPartes} deshabilitado={replicando} />
            <p className="gp-rp-nota">{lineaDePartes(partes)}</p>
            {!partes.texto && (
              <label className="gp-rp-oferta">
                <span className="gp-rp-oferta-titulo">Tu oferta</span>
                <textarea
                  className="gp-campo"
                  rows={3}
                  maxLength={TOPE_OFERTA_PANTALLA}
                  value={oferta}
                  disabled={replicando}
                  placeholder="Qué vendes, a quién y por cuánto. Ej.: mentoría de 8 semanas para dueños de agencias que quieren cerrar más clientes; US$997."
                  onChange={(e) => setOferta(e.target.value)}
                />
                {lectura.lectura.tieneOferta === false && !oferta.trim() && (
                  <span className="gp-rp-aviso" role="note">Tu negocio no tiene la oferta cargada: escríbela aquí para que el texto hable de lo tuyo y no de la otra.</span>
                )}
              </label>
            )}
            {!partes.diseno && (
              <div className="gp-rp-tema">
                <SelectorTemaCrear valor={tema} onCambio={setTema} sugerido={sugerido} propios={propios} />
              </div>
            )}
            <div className="gp-replicar-formato">
              <SelectorFormato valor={formato} onCambio={setFormato} deshabilitado={replicando} partes={partes} />
            </div>
            <button type="button" className="gp-btn gp-btn-primario gp-rp-replicar" data-tam="lg" disabled={replicando} onClick={() => replicarLeida(formato, formato === 'web' && !conFotoExt ? abrirEnElClic() : undefined)}>
              {replicando ? <span className="gp-giro" aria-hidden /> : <Ico n="copiar" t={14} />} Replicar
            </button>
          </section>
          {replicando && (
            <ArmadoEnVivo
              titulo={lista ? 'Lista: abriendo el editor' : 'Replicando… puede tardar unos minutos'}
              fases={vista.fases}
              piezas={vista.piezas}
              total={vista.total || lectura.lectura.secciones.length}
              unidad="secciones"
              terminado={vista.terminado}
              onTodoVisible={() => setTimeout(abrirCopia, ESPERA_FINAL_MS)}
              escena={({ visibles, llegadas, saltear }) => (
                <EscenarioReplica
                  eventos={eventos}
                  visibles={visibles}
                  llegadas={llegadas}
                  saltear={saltear}
                  moldes={lectura.lectura.secciones}
                  colores={lectura.lectura.diseno?.colores}
                />
              )}
            />
          )}
          {estado.fase === 'falla' && (
            <FallaReplicar
              error={estado.error}
              probar={estado.probar}
              onProbar={(f) => { setFormato(f); replicarLeida(f, f === 'web' && !conFotoExt ? abrirEnElClic() : undefined); }}
            />
          )}
          {/* La foto no salió en la ventana (una app de Vite en módulos, una página que no corre aislada): desde la pestaña real. */}
          {estado.fase === 'falla' && estado.formato === 'web' && !conFotoExt && <div className="gp-replicar-ext">{bloqueExt(lectura.url, false)}</div>}
        </>
      )}
    </section>
  );
}

/** La hoja de la vista (el resto es de la del Panel: `.gp-analizar`, Inicio.tsx). */
const CSS_REPLICAR = `
.gp .gp-replicar-formato { margin-top: 14px; }
.gp .gp-replicar-ext { margin-top: 12px; }
.gp .gp-replicar .gp-tipos { justify-content: flex-start; }
.gp .gp-replicar > .gp-leer, .gp .gp-replicar > .gp-error, .gp .gp-replicar > [role="status"] { margin-top: 14px; }
.gp .gp-replicar-estado { display: flex; align-items: center; gap: 8px; }
.gp .gp-rp-lectura, .gp .gp-rp-elegir { margin-top: 20px; }
.gp .gp-rp-titulo { margin: 0 0 10px; font-size: 17px; font-weight: 600; color: var(--gp-titulo); overflow-wrap: anywhere; }
.gp .gp-rp-bloque { border: 1px solid var(--gp-borde); border-radius: 12px; background: var(--gp-superficie); padding: 12px 14px; margin-top: 10px; }
.gp .gp-rp-sub { display: flex; align-items: center; gap: 6px; margin: 0 0 8px; font-size: 14px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-rp-secciones { margin: 0; padding-left: 22px; display: grid; gap: 6px; font-size: 13.5px; }
.gp .gp-rp-secciones li { color: var(--gp-texto); }
.gp .gp-rp-sec-titulo { display: block; overflow-wrap: anywhere; }
.gp .gp-rp-sec-molde { display: block; color: var(--gp-tenue); font-size: 12.5px; }
.gp .gp-rp-chip { display: inline-block; margin-right: 6px; padding: 1px 7px; border-radius: 9999px; background: var(--gp-activo-fondo); color: var(--gp-activo-texto); font-size: 11.5px; font-weight: 600; vertical-align: 1px; }
.gp .gp-rp-ver { margin-top: 8px; }
.gp .gp-rp-datos { margin: 0; display: grid; gap: 8px; font-size: 13.5px; }
.gp .gp-rp-dato { display: grid; grid-template-columns: 130px 1fr; gap: 8px; }
.gp .gp-rp-dato dt { color: var(--gp-tenue); font-weight: 600; }
.gp .gp-rp-dato dd { margin: 0; color: var(--gp-texto); overflow-wrap: anywhere; }
.gp .gp-rp-dato ul { margin: 0; padding-left: 18px; }
.gp .gp-rp-nota { margin: 8px 0 0; color: var(--gp-tenue); font-size: 13px; }
.gp .gp-rp-diseno { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13.5px; color: var(--gp-texto); }
.gp .gp-rp-colores { display: inline-flex; gap: 6px; }
.gp .gp-rp-color { width: 22px; height: 22px; border-radius: 6px; border: 1px solid var(--gp-borde); }
.gp .gp-rp-partes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.gp .gp-rp-parte { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-height: 64px; padding: 10px 12px; border: 1px solid var(--gp-borde); border-radius: 12px; background: transparent; color: var(--gp-texto); font: inherit; text-align: left; cursor: pointer; transition: background-color .15s, border-color .15s, box-shadow .15s; }
.gp .gp-rp-parte:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-rp-parte[aria-pressed="true"] { background: var(--gp-superficie); border-color: var(--gp-azul-300); box-shadow: var(--gp-sombra-tarjeta); }
.gp .gp-rp-parte[aria-pressed="true"] .gp-rp-parte-cabeza { color: var(--gp-activo-texto); }
.gp .gp-rp-parte:disabled { opacity: .55; cursor: default; }
.gp .gp-rp-parte-cabeza { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; }
.gp .gp-rp-parte-detalle { color: var(--gp-tenue); font-size: 12px; line-height: 1.3; }
.gp .gp-rp-tema { margin-top: 12px; }
.gp .gp-rp-oferta { display: grid; gap: 6px; margin-top: 12px; }
.gp .gp-rp-oferta-titulo { font-size: 14px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-rp-oferta textarea { height: auto; padding: 10px 12px; resize: vertical; line-height: 1.45; }
.gp .gp-rp-aviso { font-size: 13px; color: var(--gp-activo-texto); }
.gp .gp-rp-replicar { margin-top: 16px; }
.gp .gp-rp-retomado { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-top: 14px; }
.gp .gp-rp-descartar { padding: 0; border: 0; background: transparent; font: inherit; font-size: 13px; color: var(--gp-tenue); text-decoration: underline; cursor: pointer; }
.gp .gp-rp-descartar:hover:not(:disabled) { color: var(--gp-texto); }
.gp .gp-rp-sec-entra { animation: gp-rp-entra .3s ease-out both; }
@keyframes gp-rp-entra { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { .gp .gp-rp-sec-entra { animation: none; } }
@media (max-width: 760px) {
  .gp .gp-replicar { margin-top: 16px; }
  .gp .gp-rp-partes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .gp .gp-rp-dato { grid-template-columns: 1fr; gap: 2px; }
  /* Los temas de a dos (la grilla compartida pide 180 px: de a uno, seis tarjetas altas tapaban «Replicar»). */
  .gp .gp-rp-tema .gp-tema-grilla { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
}
`;
