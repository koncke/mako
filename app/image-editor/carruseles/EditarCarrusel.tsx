'use client';

// =============================================================================
// EditarCarrusel — «Editar» un ejemplo: tu versión se arma A LA VISTA y se abre el editor (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «Ahí mismo se elige uno para editar, y recién entonces aparece la vista de edición» y «"Hacer el mío"
// salta a un paso "Elige el tipo" que quedó viejo… dejalo simple: del ejemplo a la edición, sin pasos que no aporten. Si con
// IA es más fácil, usala». No hay tipo que elegir ni láminas que contar: se toca «Editar» y la IA del negocio replica el diseño
// (lib/carruseles/replica-servidor.ts). Mientras, las fases y cada lámina que llega, de a una (AGENTS.md, «Lo que MaKo
// construye se ve CONSTRUYÉNDOSE»; molde: «Replicar» del Web Generator, app/web-generator/crear/Replicar.tsx). Al terminar se
// abre el diseño en el editor, donde está el chat de MaKo.
//
// Si salió sin la IA (no la conectó, o no contestó), NO navega solo: dice por qué, ofrece conectarla (el modal de
// Integraciones AHÍ, sin salir de la tab) y «Abrir el diseño» con las guías. Las láminas guía también se ven armándose, y si no
// se pudo armar nada, la tira de cuadros vacíos se va (6/11/2026: Martín vio el modal con las miniaturas en blanco).
//
// Sirve también para una miniatura de YouTube (Thumbnails, 6/11/2026): una lámina de 1280 × 720.
//
// DESDE EL GUIADO (9/11/2026, ./ReplicarGuiado.tsx): con `guiado` viaja lo que contestó el dueño (la oferta, la foto, qué
// cambia) y la pantalla NO abre el editor sola: cada lámina se ve AL LADO de su original (`originales`) y el dueño decide con
// «Abrir el diseño». Martín, 9/11: «me llevó directamente al editor y no está bueno eso»; y la regla de la casa: lo generado se
// chequea antes de entregar.
// =============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { useRouter } from '@/app/_ui/Link';
import { LinkIntegracion } from '@/app/_components/ConectarIntegracion';
import { fasesDesde } from '@/app/_ui/armado-en-vivo';
import { useRevelado } from '@/app/_ui/ArmadoEnVivo';
import { eventosDe, fasesSegunLaIA, type EventoReplica } from '@/lib/carruseles/replica';
import type { Carrusel } from '@/lib/carruseles/explorar';
import type { Thumbnail } from '@/lib/thumbnails/explorar';
import type { PedidoGuiado } from '@/lib/carruseles/guiado';
import { rutaDiseno } from '../ruta';
import { PaginaCarrusel } from './MiniaturaCarrusel';
import s from './editar.module.css';

const FASES = [
  { id: 'leer', texto: 'Leo sus láminas' },
  { id: 'escribir', texto: 'Escribo tu versión con tu IA' },
  { id: 'armar', texto: 'Armo el diseño editable' },
] as const;

type Pagina = { pagina: Record<string, unknown>; ancho: number; alto: number };
type Fin = Extract<EventoReplica, { fase: 'fin'; ok: true }>;

/** Lo que hace falta del ejemplo para pedirlo y dibujar la espera. */
function ejemploDe(carrusel?: Carrusel | null, thumbnail?: Thumbnail | null) {
  if (thumbnail) {
    return { que: 'thumbnail' as const, id: thumbnail.id, quien: thumbnail.canal.handle || thumbnail.canal.nombre, total: 1, proporcion: '16 / 9', fases: FASES_MINIATURA };
  }
  const c = carrusel as Carrusel;
  return {
    que: 'carrusel' as const, id: c.id, quien: c.creador.usuario ? `@${c.creador.usuario}` : c.creador.nombre,
    total: c.clase === 'anuncio' ? 1 : c.laminas ?? 1, proporcion: c.clase === 'anuncio' ? '1 / 1' : '4 / 5', fases: FASES,
  };
}

const FASES_MINIATURA = [
  { id: 'leer', texto: 'Miro la miniatura' },
  { id: 'escribir', texto: 'Escribo tu versión con tu IA' },
  { id: 'armar', texto: 'Armo el diseño editable' },
] as const;

export function EditarCarrusel({ carrusel = null, thumbnail = null, guiado = null, originales = null, onCerrar, resumen = null, rehacer = [] }: {
  carrusel?: Carrusel | null; thumbnail?: Thumbnail | null;
  /** Lo que contestó el dueño en el guiado: viaja a la ruta, y con él no se abre el editor solo. */
  guiado?: PedidoGuiado | null;
  /** Las láminas del original, para mostrar cada una al lado de la suya (sólo con el guiado). */
  originales?: readonly string[] | null;
  onCerrar: () => void;
  /** Con qué se hizo («6 láminas para «Mentoría», con tu cara de marca…»): va en el encabezado. */
  resumen?: string | null;
  /**
   * Lo que se cambia DESPUÉS (12/11/2026, «Replicar» sin preguntas): otra oferta, la foto, los colores. Al lado de «Abrir el
   * diseño»; cada una rehace la pieza entera.
   */
  rehacer?: ReadonlyArray<{ rotulo: string; alElegir: () => void }>;
}) {
  const router = useRouter();
  const ej = ejemploDe(carrusel, thumbnail);
  const [fase, setFase] = useState<'leer' | 'escribir' | 'armar'>('leer');
  const [total, setTotal] = useState<number>(ej.total);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [fin, setFin] = useState<Fin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const corto = useRef<AbortController | null>(null);
  const { visibles, saltear } = useRevelado(paginas.length);

  const arrancar = useCallback(async () => {
    setError(null); setFin(null); setPaginas([]); setFase('leer');
    const ctrl = new AbortController();
    corto.current = ctrl;
    try {
      const r = await fetch('/api/image-editor/carruseles/replicar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: ej.id, que: ej.que, ...(guiado ? { guiado } : {}) }),
        signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(305_000)]),
      });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setError(j?.error ?? 'No pude armar tu versión. Vuelve a intentar.');
        return;
      }
      const lector = r.body.getReader();
      const dec = new TextDecoder();
      let resto = '';
      for (;;) {
        const { value, done } = await lector.read();
        if (done) break;
        resto += dec.decode(value, { stream: true });
        const corte = resto.lastIndexOf('\n');
        if (corte < 0) continue;
        for (const e of eventosDe(resto.slice(0, corte))) {
          if (e.fase === 'leer') { setTotal(e.laminas); setFase('leer'); }
          else if (e.fase === 'escribir') setFase('escribir');
          else if (e.fase === 'lamina') { setFase('armar'); setPaginas((ps) => [...ps, { pagina: e.pagina, ancho: e.ancho, alto: e.alto }]); }
          else if (e.fase === 'fin') { if (e.ok) setFin(e); else setError(e.error); }
        }
        resto = resto.slice(corte + 1);
      }
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof Error && e.name === 'TimeoutError'
        ? 'Tardó demasiado. Si se armó, está en tus diseños; si no, vuelve a intentar.'
        : 'Se cortó la conexión. Si se armó, está en tus diseños; si no, vuelve a intentar.');
    }
  }, [ej.id, ej.que, guiado]);

  // Arranca UNA vez por apertura: en desarrollo React monta dos veces, y dos pedidos serían dos diseños. Cerrar el panel corta
  // el pedido; si el diseño ya se estaba guardando, queda en tus diseños.
  const empezado = useRef(false);
  useEffect(() => {
    if (empezado.current) return;
    empezado.current = true;
    void arrancar();
  }, [arrancar]);

  // Con la IA, al terminar y con todas las láminas a la vista, se abre el editor (el diseño ya está guardado).
  const abierto = useRef(false);
  const abrir = useCallback((id: string) => {
    if (abierto.current) return;
    abierto.current = true;
    router.push(rutaDiseno(id));
  }, [router]);
  useEffect(() => {
    // Desde el guiado no se abre solo: el dueño mira cada lámina al lado de su original y decide.
    if (!guiado && fin?.ok && !fin.sinIA && !fin.aviso && visibles >= paginas.length) {
      const t = setTimeout(() => abrir(fin.id), 450);
      return () => clearTimeout(t);
    }
  }, [guiado, fin, visibles, paginas.length, abrir]);

  // ⚠️ `fin.sinIA` CAMBIA EL TEXTO DE UNA FASE, y no es cosmético: sin esto, «Escribo tu versión con tu IA»
  // quedaba en verde justo encima del aviso que dice que no hay IA conectada (medido en producción el 7/11).
  const fases = fasesDesde(fasesSegunLaIA(ej.fases, !!fin?.sinIA), fin ? null : fase, { terminado: !!fin, fallo: !!error });
  const quien = ej.quien;
  const vistas = paginas.slice(0, visibles);
  // Sin nada armado y con un error, la tira de cuadros vacíos no promete nada: se va.
  const conTira = !(error && !paginas.length);

  return (
    <Modal titulo={fin ? 'Tu versión está lista' : error ? 'No se pudo armar' : 'Armando tu versión'}
      encabezado={resumen ? `Del ejemplo de ${quien} · ${resumen}` : `Del ejemplo de ${quien}`}
      onCerrar={() => { corto.current?.abort(); onCerrar(); }} ancho={760}
      pie={fin ? (
        <>
          {fin.conectar ? <LinkIntegracion href={fin.conectar} className={s.secundario}>Conectar mi IA</LinkIntegracion> : null}
          {rehacer.map((o) => <button key={o.rotulo} type="button" className={s.secundario} onClick={o.alElegir}>{o.rotulo}</button>)}
          <button type="button" className={s.primario} onClick={() => abrir(fin.id)}>Abrir el diseño</button>
        </>
      ) : error ? (
        <>
          <button type="button" className={s.secundario} onClick={onCerrar}>Cerrar</button>
          <button type="button" className={s.primario} onClick={() => { void arrancar(); }}>Volver a intentar</button>
        </>
      ) : (
        visibles < paginas.length ? <button type="button" className={s.secundario} onClick={saltear}>Ver todo</button> : null
      )}>
      <div className={s.cuerpo}>
        <ol className={s.fases} aria-live="polite">
          {fases.map((f) => (
            <li key={f.id} data-estado={f.estado}>
              <span className={s.marca} aria-hidden>{f.estado === 'hecha' ? '✓' : f.estado === 'fallo' ? '!' : ''}</span>
              {f.texto}
            </li>
          ))}
        </ol>
        {conTira ? (
          <ol className={s.tira} data-miniatura={ej.que === 'thumbnail' ? 'si' : undefined} aria-label={ej.que === 'thumbnail' ? 'Tu miniatura' : 'Láminas de tu versión'}>
            {Array.from({ length: Math.max(total, paginas.length) }, (_, i) => {
              const p = vistas[i];
              const original = originales?.[i] ?? null;
              const tuya = p
                ? <PaginaCarrusel pagina={p.pagina} ancho={p.ancho} alto={p.alto} etiqueta={ej.que === 'thumbnail' ? 'Tu miniatura' : `Lámina ${i + 1}`} style={{ width: '100%' }} />
                : <span className={s.esperando} style={{ aspectRatio: ej.proporcion }} aria-hidden />;
              return (
                <li key={i} data-lista={p ? 'si' : undefined}>
                  {/* Con el guiado, el original ARRIBA de la suya: se juzgan juntas, al mismo ancho. */}
                  {guiado && original ? (
                    // eslint-disable-next-line @next/next/no-img-element -- la lámina del original (CDN de la fuente o nuestro bucket)
                    <img src={original} alt={`Original, lámina ${i + 1}`} style={{ width: '100%', aspectRatio: ej.proporcion, objectFit: 'cover', borderRadius: 8, display: 'block', marginBottom: 6, opacity: 0.92 }} />
                  ) : null}
                  {tuya}
                </li>
              );
            })}
          </ol>
        ) : null}
        {fin?.aviso ? <p className={s.aviso}>{fin.aviso}</p> : null}
        {error ? <p role="alert" className={s.error}>{error}<ReportarASoporte /></p> : null}
      </div>
    </Modal>
  );
}
