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
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import type { Lectura } from '@/lib/editor-landing/lectura-tipos';
import {
  abrirEnElClic, cerrarVentana, pedirConVentana, tomarVentanaReservada,
  type SalidaSinLectura, type VentanaDelClic,
} from '@/lib/editor-landing/lector-navegador';
import {
  FORMATOS_REPLICAR, NOMBRE_FORMATO_REPLICAR, formatoReplicar, type FormatoReplicar, type PedidoReplicar, type RespuestaReplicar,
} from '@/lib/editor-landing/replicar-reglas';
import { AVISO_SCROLL } from '@/lib/editor-landing/replicar-animaciones';
import { PLAZO_IA_MS, postJson } from '../cliente';
import { dejarAvisoDeReplica } from './aviso-replica';
import { Ico, irDuro, type OpcionDesplegable } from '../MiniaturaLanding';
import { urlParaAnalizar } from '../panel-reglas';
import { LeerOPegar } from '../lector/LeerOPegar';
import { CSS_TIPO } from './PiezasTipo';
import { FORMATO_INICIAL } from './caja-modos';

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
export type ExtraReplicar = { lectura?: Lectura; texto?: string; ventana?: VentanaDelClic | null };

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
    const { ventana = null, ...dato } = extra;
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
        const cuerpo: PedidoReplicar = formato === 'web' ? { url, formato } : { url, formato, ...dato, ...(lectura ? { lectura } : {}) };
        return postJson<RespuestaReplicar>('/api/landing-generator/replicar', cuerpo, PLAZO_IA_MS);
      },
      pideNavegador: (x) => !x.ok && (x as { enNavegador?: boolean }).enNavegador === true,
      alLeer: () => setEstado({ fase: 'replicando', formato, leyendo: true }),
      sigue: () => montado.current,
    });
    // Sale bien: el editor de la copia (se queda «replicando» mientras navega), o lo que siga con ella.
    if (r.ok && alListo) { await alListo({ id: r.id, titulo: r.titulo }); return; }
    if (r.ok) {
      // Tanda 8: lo que no se copió del scroll se lee al abrirse el editor de la copia (./aviso-replica.ts).
      if (r.avisoScroll) dejarAvisoDeReplica(r.id, AVISO_SCROLL);
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
      <p className={clase} role="alert">{error}</p>
      {probar && (
        <button type="button" className="gp-btn gp-btn-contorno" style={{ marginTop: 10, alignSelf: 'flex-start' }} disabled={deshabilitado} onClick={() => onProbar(probar)}>
          <Ico n={ICONO_FORMATO[probar]} t={14} /> Replicar como {NOMBRE_FORMATO_REPLICAR[probar]}
        </button>
      )}
    </>
  );
}

/** Los 3 formatos de Replicar, con su ícono: un radiogroup con la cara de las pastillas «Landing | Presentación». */
export function SelectorFormato({ valor, onCambio, deshabilitado }: {
  valor: FormatoReplicar;
  onCambio: (f: FormatoReplicar) => void;
  deshabilitado?: boolean;
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
          disabled={deshabilitado}
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
 * «Replicar landing», a la derecha del Panel: la dirección, el formato y «Replicar». Con `auto` (el link pegado
 * en la caja con «Replica esta landing») arranca solo, UNA vez: el clic ya fue el ↑ de la caja.
 */
export function ReplicarUnaPagina({ url: urlInicial, formato: formatoInicial, auto = false }: {
  url?: string;
  formato?: FormatoReplicar;
  auto?: boolean;
}) {
  const [texto, setTexto] = useState(urlInicial ?? '');
  const [formato, setFormato] = useState<FormatoReplicar>(formatoInicial ?? FORMATO_INICIAL);
  /** La página del último intento (la que se lee o se pega si el server no pudo). */
  const [pedida, setPedida] = useState<string | null>(null);
  const { estado, replicar } = useReplicar();
  const campo = useRef<HTMLInputElement>(null);
  const url = urlParaAnalizar(texto);
  const ocupado = estado.fase === 'replicando';

  /**
   * Replicar `u` como `f`. `ventana`: la que se abrió EN EL CLIC (tanda 7). Los clics la abren ANTES de llamar a
   * esto (`abrirEnElClic`, sin nada antes); el arranque automático toma la que reservó el ↑ de la caja.
   */
  const empezar = useCallback((u: string, f: FormatoReplicar, ventana: VentanaDelClic | null = null) => {
    setPedida(u);
    void replicar(u, f, { ventana });
  }, [replicar]);

  // El ref sobrevive al doble montaje del modo estricto: replicar se paga una sola vez (y la ventana se toma una).
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    const u = urlParaAnalizar(urlInicial);
    const f = formatoInicial ?? FORMATO_INICIAL;
    if (auto && u) empezar(u, f, pideVentana(f) ? tomarVentanaReservada(u) : null);
    else campo.current?.focus();
  }, [auto, urlInicial, formatoInicial, empezar]);

  return (
    <section className="gp-analizar gp-replicar" aria-label="Replicar landing">
      <style href="gp-tipo" precedence="medium">{CSS_TIPO}</style>
      <style href="gp-replicar" precedence="medium">{CSS_REPLICAR}</style>
      <h1 className="gp-cabeza-titulo">Replicar landing</h1>
      <p className="gp-analizar-sub">Pega la dirección y elige el formato.</p>
      {/* La ventana se abre EN ESTE submit (el clic o el Enter), primera cosa y sin nada antes (tanda 7). */}
      <form className="gp-analizar-fila" onSubmit={(e) => { e.preventDefault(); if (url && !ocupado) empezar(url, formato, pideVentana(formato) ? abrirEnElClic() : null); }}>
        <input
          ref={campo}
          className="gp-campo"
          inputMode="url"
          autoComplete="url"
          value={texto}
          maxLength={2_000}
          placeholder="https://tu-landing.com"
          aria-label="Dirección de la página"
          disabled={ocupado}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button type="submit" className="gp-btn gp-btn-primario" data-tam="lg" disabled={!url || ocupado}>
          {ocupado ? <span className="gp-giro" aria-hidden /> : <Ico n="copiar" t={14} />} Replicar
        </button>
      </form>
      <div className="gp-replicar-formato">
        <SelectorFormato valor={formato} onCambio={setFormato} deshabilitado={ocupado} />
      </div>
      {estado.fase === 'replicando' && (
        <p className="gp-analizar-sub gp-replicar-estado" role="status">
          <span className="gp-giro" aria-hidden /> {estado.leyendo ? 'Leyendo la página…' : 'Replicando… puede tardar unos minutos.'}
        </p>
      )}
      {estado.fase === 'falla' && pedida && (estado.enNavegador || estado.pegable) ? (
        <LeerOPegar
          key={`${pedida}|${estado.formato}|${estado.salida?.motivo ?? ''}`}
          url={pedida}
          error={estado.error}
          enNavegador={estado.enNavegador}
          ocupado={false}
          accionTexto="Replicar este texto"
          salida={estado.salida}
          onLectura={(lectura) => void replicar(pedida, estado.formato, { lectura })}
          onTexto={(t) => void replicar(pedida, estado.formato, { texto: t })}
        />
      ) : estado.fase === 'falla' ? (
        <FallaReplicar
          error={estado.error}
          probar={pedida ? estado.probar : null}
          onProbar={(f) => { if (!pedida) return; const v = pideVentana(f) ? abrirEnElClic() : null; setFormato(f); empezar(pedida, f, v); }}
        />
      ) : null}
    </section>
  );
}

/** La hoja de la vista (el resto es de la del Panel: `.gp-analizar`, Inicio.tsx). */
const CSS_REPLICAR = `
.gp .gp-replicar-formato { margin-top: 14px; }
.gp .gp-replicar .gp-tipos { justify-content: flex-start; }
.gp .gp-replicar > .gp-leer, .gp .gp-replicar > .gp-error, .gp .gp-replicar > [role="status"] { margin-top: 14px; }
.gp .gp-replicar-estado { display: flex; align-items: center; gap: 8px; }
@media (max-width: 760px) { .gp .gp-replicar { margin-top: 16px; } }
`;
