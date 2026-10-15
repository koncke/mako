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
//   · `ReplicarUnaPagina`: la vista de la derecha del Panel («Replicar landing» de la caja, o el link pegado
//     en el chat con «Replica esta landing»).
// Cuando el server no puede leer la página (una app de Vite/React, o una que le contesta 403) contesta
// `enNavegador` y se ofrece leerla en el navegador de la persona o pegar su texto (../lector/LeerOPegar.tsx).
// La copia «Página web» necesita el HTML: con ella el server no ofrece esa salida, y si propone otro formato
// (`probar`: una app de Vite o Lovable, un login, una página que no entra) se ofrece con un botón (`FallaReplicar`).
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import type { Lectura } from '@/lib/editor-landing/lectura-tipos';
import {
  FORMATOS_REPLICAR, NOMBRE_FORMATO_REPLICAR, formatoReplicar, type FormatoReplicar, type PedidoReplicar, type RespuestaReplicar,
} from '@/lib/editor-landing/replicar-reglas';
import { PLAZO_IA_MS, postJson } from '../cliente';
import { Ico, irDuro, type OpcionDesplegable } from '../MiniaturaLanding';
import { urlParaAnalizar } from '../panel-reglas';
import { LeerOPegar } from '../lector/LeerOPegar';
import { CSS_TIPO } from './PiezasTipo';

/** El ícono de cada formato (lib/editor-landing/iconos.ts): las diapositivas, las secciones y la página. */
export const ICONO_FORMATO: Record<FormatoReplicar, string> = { presentacion: 'presentar', landing: 'paginas', web: 'globo' };

/** Los formatos como opciones de un desplegable (el del link pegado en la caja). */
export const OPCIONES_FORMATO: readonly OpcionDesplegable<FormatoReplicar>[] = FORMATOS_REPLICAR.map((f) => ({
  valor: f, texto: NOMBRE_FORMATO_REPLICAR[f], icono: ICONO_FORMATO[f],
}));

/** El formato por default: las secciones editables (lo que se quiere casi siempre). */
export const FORMATO_INICIAL: FormatoReplicar = 'landing';

export type EstadoReplicar =
  | { fase: 'quieto' }
  | { fase: 'replicando'; formato: FormatoReplicar }
  | { fase: 'falla'; formato: FormatoReplicar; error: string; enNavegador: boolean; pegable: boolean; probar: FormatoReplicar | null };

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
  replicar: (url: string, formato: FormatoReplicar, extra?: { lectura?: Lectura; texto?: string }, alListo?: AlReplicar) => Promise<void>;
} {
  const ws = useWs();
  const [estado, setEstado] = useState<EstadoReplicar>({ fase: 'quieto' });
  const replicar = useCallback(async (url: string, formato: FormatoReplicar, extra: { lectura?: Lectura; texto?: string } = {}, alListo?: AlReplicar) => {
    setEstado({ fase: 'replicando', formato });
    const cuerpo: PedidoReplicar = formato === 'web' ? { url, formato } : { url, formato, ...extra };
    const r = await postJson<RespuestaReplicar>('/api/landing-generator/replicar', cuerpo, PLAZO_IA_MS);
    // Sale bien: el editor de la copia (se queda «replicando» mientras navega), o lo que siga con ella.
    if (r.ok && alListo) { await alListo({ id: r.id, titulo: r.titulo }); return; }
    if (r.ok) { irDuro(`/web-generator/${r.id}`, ws); return; }
    const f = r as { error: string; enNavegador?: boolean; pegable?: boolean; probar?: unknown };
    const probar = formatoReplicar(f.probar);
    setEstado({ fase: 'falla', formato, error: f.error, enNavegador: f.enNavegador === true, pegable: f.pegable === true, probar: probar && probar !== formato ? probar : null });
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

  const empezar = useCallback((u: string, f: FormatoReplicar) => { setPedida(u); void replicar(u, f); }, [replicar]);

  // El ref sobrevive al doble montaje del modo estricto: replicar se paga una sola vez.
  const arrancado = useRef(false);
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    const u = urlParaAnalizar(urlInicial);
    if (auto && u) empezar(u, formatoInicial ?? FORMATO_INICIAL);
    else campo.current?.focus();
  }, [auto, urlInicial, formatoInicial, empezar]);

  return (
    <section className="gp-analizar gp-replicar" aria-label="Replicar landing">
      <style href="gp-tipo" precedence="medium">{CSS_TIPO}</style>
      <style href="gp-replicar" precedence="medium">{CSS_REPLICAR}</style>
      <h1 className="gp-cabeza-titulo">Replicar landing</h1>
      <p className="gp-analizar-sub">Pega la dirección y elige el formato.</p>
      <form className="gp-analizar-fila" onSubmit={(e) => { e.preventDefault(); if (url && !ocupado) empezar(url, formato); }}>
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
      {ocupado && <p className="gp-analizar-sub" role="status">Replicando… puede tardar unos minutos.</p>}
      {estado.fase === 'falla' && pedida && (estado.enNavegador || estado.pegable) ? (
        <LeerOPegar
          key={`${pedida}|${estado.formato}`}
          url={pedida}
          error={estado.error}
          enNavegador={estado.enNavegador}
          ocupado={false}
          accionTexto="Replicar este texto"
          onLectura={(lectura) => void replicar(pedida, estado.formato, { lectura })}
          onTexto={(t) => void replicar(pedida, estado.formato, { texto: t })}
        />
      ) : estado.fase === 'falla' ? (
        <FallaReplicar
          error={estado.error}
          probar={pedida ? estado.probar : null}
          onProbar={(f) => { if (!pedida) return; setFormato(f); empezar(pedida, f); }}
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
@media (max-width: 760px) { .gp .gp-replicar { margin-top: 16px; } }
`;
