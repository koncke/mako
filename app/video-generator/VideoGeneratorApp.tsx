'use client';

// =============================================================================
// VideoGeneratorApp — el cliente elige una plantilla y MaKo le hace el anuncio
// =============================================================================
// Esta pantalla se rehízo TRES veces, y las tres correcciones del dueño valen más
// que el código:
//
// 1. «Se ve horrible todo junto» — ocho formatos como tarjetas de texto, todos a
//    la vez. Un formato de video se elige VIENDO el anuncio, no leyéndolo.
// 2. «Aún se ve complejo y lleno de texto» — el guion estaba escrito dos veces y
//    los siete prompts abiertos a la vez.
// 3. «No tiene ningún sentido que la persona entre y vea prompts y guiones.
//    Jamás debe ver prompts. Lo PRIMERO que tiene que ver es el CATÁLOGO.»
//
// De la tercera salen las dos reglas que gobiernan este archivo:
//
// **EL PROMPT NO SE MUESTRA NUNCA.** Es un detalle de implementación de cómo MaKo
// fabrica el video, del mismo orden que la query SQL detrás de una tabla. El
// cliente compró «MaKo me hace los anuncios», no «MaKo me pasa instrucciones para
// que yo se las pegue a otra herramienta». Los prompts se generan, se guardan y
// los consume la producción — no la pantalla.
//
// **LA HOME ES EL CATÁLOGO, siempre.** No el último anuncio. Se entra a elegir
// una plantilla, no a leer lo que ya se hizo; lo hecho está abajo, después.
//
// El flujo: catálogo → tres preguntas → el anuncio.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import {
  Pagina, PageHeader, Section, Button, Alert, Tag, Modal, MONO,
} from '@/app/_ui';
import { WizardShell } from '../_components/WizardShell';
import { Icon } from '../_components/icons';
import type { PlanGuardado, EstadoContextoVideo } from './video-datos';
import {
  guionATexto,
  puestaPorId, puestasOfrecidas, type Puesta,
} from './video-pedido';
import { generarPlanAction, editarLineaPlanAction, reescribirTomaAction } from './actions';
import { PuentePanel } from './PuentePanel';
import type { Puente } from '@/lib/flow-cola';
import { cabidaDeGuion, soloHablado } from '@/lib/puestas-data';
import type { GuionDisponible } from './guiones-datos';
import type { AnuncioHecho } from './anuncios-datos';
import { CargarGuiones } from './CargarGuiones';
import {
  SeccionCard, parsearSecciones, reconstruirSecciones, EditarTexto, ICONO_SECCION_GUION,
} from '../components/SeccionCard';
import { editarGuionAction } from './cargar-guiones-action';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';

type Vista = 'catalogo' | 'wizard' | 'anuncio';

// ⚠️ UN SOLO PASO, y los otros dos no se «simplificaron»: no debían existir.
//
// El dueño sacó los tres originales, cada uno por su motivo:
//
//   · «¿De qué habla tu anuncio?» — «jamás me debe preguntar eso, para eso ya
//     existen guiones creados dentro de MaKo, debe traer esos». Escribir el tema
//     de nuevo era pedirle que reescriba a mano lo que MaKo ya le escribió.
//   · «¿Cuánto tiene que durar?» — «no tiene sentido. Durará lo que dure el
//     guion. Punto.» Y es literal: `cabidaDeGuion` lo calcula con la densidad de
//     palabras por segundo de la puesta.
//   · «¿Con qué acento habla?» — es un atributo del CLIENTE, no del anuncio.
//     Nadie graba uno en norteño y el siguiente en rioplatense. Sale del
//     workspace (lib/acento-workspace.ts) y su lugar es el onboarding de la tab.
//
// La regla que queda: **esta tab no pregunta nada que el sistema ya sepa.**
const PASOS = ['guion', 'revisar'] as const;
type Paso = (typeof PASOS)[number];

const PREGUNTA: Record<Paso, string> = {
  guion: '¿Cuál de tus guiones quieres grabar?',
  revisar: 'Revisa antes de generar',
};

/**
 * Pinta el `**énfasis**` del guion en negrita.
 *
 * El modelo lo marca en markdown porque es la instrucción que mejor obedece —y el
 * énfasis importa: es la palabra que el avatar levanta—, pero los asteriscos
 * crudos en pantalla se leen como un error.
 */
function Enfasis({ texto }: { texto: string }) {
  // Índices impares = lo que estaba entre asteriscos. Un asterisco suelto deja su
  // tramo sin negrita en vez de romper el texto, que es lo conservador.
  const partes = texto.split(/\*\*/);
  return (
    <>
      {partes.map((t, i) => (i % 2 === 1 ? <strong key={i}>{t}</strong> : <span key={i}>{t}</span>))}
    </>
  );
}

// ── El catálogo: la plantilla es el video ────────────────────────────────────
// Un click SELECCIONA (marco azul + tilde) — no dispara el flujo. Quien dispara
// es el botón «Crear» de arriba, que es el único de la pantalla. Con un botón por
// tarjeta había tres formas de empezar y ninguna se leía como la principal.
//
// La descripción no está acá: vive en el detalle. En la tarjeta, el video ya dice
// cómo se ve y el nombre alcanza para nombrarlo.

function Plantilla({
  nombre, video, poster, elegida, onElegir, onDetalle,
}: {
  nombre: string; video: string; poster: string;
  elegida: boolean; onElegir: () => void; onDetalle: () => void;
}) {
  return (
    <div style={{ width: 220 }}>
      <button
        type="button"
        onClick={onElegir}
        onDoubleClick={onDetalle}
        aria-pressed={elegida}
        style={{
          display: 'block', width: '100%', padding: 0, cursor: 'pointer',
          background: 'transparent', border: 'none', fontFamily: 'inherit',
          borderRadius: 'var(--r-md)',
          outline: elegida ? '2px solid var(--primary)' : '1px solid var(--border)',
          outlineOffset: elegida ? 2 : 0,
        }}
      >
        <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', lineHeight: 0 }}>
          {/* Muted + playsInline: sin las dos, el navegador no deja autoplay. */}
          <video
            src={video}
            poster={poster}
            autoPlay
            loop
            muted
            playsInline
            style={{ width: '100%', display: 'block', aspectRatio: '9 / 16', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute', inset: 'auto 0 0 0', padding: '30px 12px 11px',
            background: 'linear-gradient(to top, rgba(0,0,0,.75), transparent)',
            color: '#fff', fontSize: 'var(--fs-card)', fontWeight: 650, lineHeight: 1.25,
            textAlign: 'left',
          }}>
            {nombre}
          </div>
          {elegida && (
            <div style={{
              position: 'absolute', top: 9, right: 9, width: 26, height: 26, borderRadius: 999,
              background: 'var(--primary)', color: '#fff', display: 'grid', placeItems: 'center',
              boxShadow: '0 1px 6px rgba(0,0,0,.35)',
            }}>
              <Icon name="check" size={15} />
            </div>
          )}
        </div>
      </button>

      <button
        type="button"
        onClick={onDetalle}
        style={{
          display: 'block', width: '100%', marginTop: 7, padding: '5px 0',
          background: 'transparent', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 'var(--fs-sm)', color: 'var(--dim)',
          textDecoration: 'underline', textUnderlineOffset: 3,
        }}
      >
        Ver más detalles
      </button>
    </div>
  );
}

// ── El detalle: el anuncio entero, con audio ────────────────────────────────
// Acá vive todo lo que se sacó de la tarjeta. Y el anuncio completo con sonido,
// que es la única forma de juzgar de verdad un formato de video: en la tarjeta se
// ve cómo se mueve, acá se escucha cómo suena.

/**
 * El guion entero, con lo que la card ya no muestra.
 *
 * La card quedó con el título solo porque para ELEGIR alcanza con el nombre. Lo
 * que se sacó no se perdió: vive acá, que es donde se mira cuando se duda.
 *
 * El texto va con sus rótulos de sección visibles —GANCHO, HISTORIA, CTA— porque
 * son la estructura del guion, no ruido: quien lo va a grabar necesita ver dónde
 * abre y dónde cierra.
 */
/** Una fila «rótulo: valor» del paso de revisión. */
function Fila({ k, v, nota }: { k: string; v: string; nota?: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', minWidth: 86 }}>{k}</span>
      <span style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', fontWeight: 600 }}>{v}</span>
      {nota && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>({nota})</span>}
    </div>
  );
}

function DetalleGuion({
  guion, puesta, onCerrar, onUsar, onEditado,
}: {
  guion: GuionDisponible;
  puesta?: Puesta;
  onCerrar: () => void;
  onUsar: () => void;
  /** El guion cambió en el server: hay que volver a bajarlo. */
  onEditado: () => void;
}) {
  /*
    El texto vive en estado local mientras el modal está abierto.

    No se lee de `guion.texto` directamente porque guardar dispara un
    `router.refresh()` y las props tardan un viaje en volver: sin copia local, la
    frase recién escrita parpadearía a la versión vieja antes de asentarse. Se
    escribe optimista y el refresh confirma.
  */
  const [texto, setTexto] = useState(guion.texto);
  const [guardando, setGuardando] = useState(false);
  const [errorEdit, setErrorEdit] = useState<string | null>(null);

  const cab = puesta ? cabidaDeGuion(puesta, soloHablado(texto)) : null;
  const secciones = parsearSecciones(texto, undefined, 20);

  const guardar = useCallback(async (nuevo: string) => {
    setTexto(nuevo);
    setGuardando(true); setErrorEdit(null);
    try {
      const out = await editarGuionAction(guion.id, nuevo);
      if (!out.ok) { setErrorEdit(out.error); return; }
      onEditado();
    } catch (e) {
      setErrorEdit(e instanceof Error ? e.message : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  }, [guion.id, onEditado]);
  return (
    <Modal
      titulo={guion.angulo || 'Sin título'}
      encabezado={guion.estructura || undefined}
      onCerrar={onCerrar}
      ancho={720}
      pie={
        <Button variant="mako" onClick={onUsar} icon={<Icon name="ia" size={15} />}>
          Usar este guion
        </Button>
      }
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginBottom: 14,
      }}>
        <span>{guion.palabras} palabras</span>
        {cab && (
          <>
            <span>·</span>
            <span>{cab.segundosReales}s en {cab.clips} tomas{puesta ? ` con ${puesta.nombre}` : ''}</span>
          </>
        )}
        {guion.yaUsado && (
          <Tag color="var(--good)" icon={<Icon name="check" size={12} />}>
            Generado{guion.grabadoEn.length > 0 ? ` en ${guion.grabadoEn.join(' y ')}` : ''}
          </Tag>
        )}
      </div>

      {cab?.desborda && (
        <div style={{ marginBottom: 14 }}>
          <Alert tono="warn">
            No entra en <strong>{puesta?.nombre}</strong>: sobran {cab.palabrasDeMas} palabras.
            El final quedaría afuera.
          </Alert>
        </div>
      )}

      {/*
        El guion se lee por BLOQUES, con el mismo template desplegable que el
        lector de /ads-writer y la matriz del onboarding. Un guion es texto
        largo, y un muro de texto largo dentro de un modal con scroll propio no
        se lee: se hojea.

        El primero abierto y el resto cerrados: el GANCHO son los 3-5 segundos
        que deciden si el anuncio funciona, y es lo unico que hace falta ver
        para reconocer un guion sin leerlo entero.

        Si el guion no tiene rotulos —los cargados antes de que MaKo los
        ordenara, o uno donde el modelo no pudo— `parsearSecciones` devuelve
        vacio y se cae al texto plano. Un guion sin bloques se sigue leyendo.
      */}
      {errorEdit && <Alert tono="bad">{errorEdit}</Alert>}

      {secciones.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: '52vh', overflowY: 'auto' }}>
          {secciones.map((s, i) => (
            <SeccionCard
              key={s.titulo + i}
              s={s}
              abiertoDefault={i === 0}
              icono={ICONO_SECCION_GUION[s.titulo] ?? '\u{1F3AC}'}
              size="sm"
            >
              <EditarTexto
                valor={s.texto}
                multiline
                disabled={guardando}
                onSave={(v) => void guardar(reconstruirSecciones(
                  secciones.map((sec, j) => (j === i ? { ...sec, texto: v } : sec)),
                ))}
                style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.6 }}
              />
            </SeccionCard>
          ))}
        </div>
      ) : (
        // Un guion sin rótulos —cargado antes de que MaKo los pusiera, o uno
        // donde el modelo no pudo— se edita ENTERO. No se pierde ni se bloquea:
        // el que no tiene bloques es justamente el que más ganas dan de corregir.
        <div style={{ maxHeight: '52vh', overflowY: 'auto' }}>
          <EditarTexto
            valor={texto}
            multiline
            disabled={guardando}
            onSave={(v) => void guardar(v)}
            style={{
              fontSize: 'var(--fs-md)', lineHeight: 1.7, color: 'var(--ink)',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              borderRadius: 10, padding: '12px 14px', margin: 0,
            }}
          />
        </div>
      )}

      {/* Que se puede escribir encima no se descubre solo: el campo se ve igual
          que un texto hasta que alguien le hace clic. Una línea lo dice. */}
      <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 10 }}>
        {guardando ? 'Guardando…' : 'Haz clic en cualquier parte del guion para corregirlo.'}
      </div>
    </Modal>
  );
}

/**
 * Un anuncio terminado.
 *
 * Se reproduce ACÁ, con controles, en vez de abrir un modal: un anuncio de un
 * minuto se mira, no se explora, y meterle un paso de por medio a algo que ya
 * está hecho no agrega nada. Sin `autoPlay` y sin `loop` — cuatro videos
 * arrancando solos al abrir la pantalla es lo contrario de una galería.
 */
function AnuncioCard({ a }: { a: AnuncioHecho }) {
  const puesta = puestaPorId(a.puestaId);
  const mm = Math.floor(a.duracionSeg / 60);
  const ss = String(Math.round(a.duracionSeg % 60)).padStart(2, '0');

  return (
    <div style={{
      width: 240, borderRadius: 14, overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      {/* 9:16, que es como se producen y como se ven en el feed. */}
      <video
        src={a.url}
        poster={a.poster}
        controls
        preload="metadata"
        playsInline
        style={{ display: 'block', width: '100%', aspectRatio: '9 / 16', objectFit: 'cover', background: '#000' }}
      />
      <div style={{ padding: '11px 13px 13px' }}>
        <div style={{
          fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)', lineHeight: 1.35,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {a.titulo}
        </div>
        <div style={{
          fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 5,
          display: 'flex', gap: 7, flexWrap: 'wrap',
        }}>
          <span>{mm}:{ss}</span>
          {puesta && <><span>·</span><span>{puesta.nombre}</span></>}
        </div>
      </div>
    </div>
  );
}

function DetalleFormato({
  puesta, onCerrar, onUsar,
}: {
  puesta: Puesta; onCerrar: () => void; onUsar: () => void;
}) {
  const ej = puesta.ejemplo!;
  return (
    <Modal
      titulo={puesta.nombre}
      encabezado={puesta.tecnico}
      onCerrar={onCerrar}
      ancho={720}
      pie={<Button variant="mako" onClick={onUsar} icon={<Icon name="mako" size={14} />}>Crear con este formato</Button>}
    >
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <video
          src={ej.completo}
          poster={ej.poster}
          controls
          playsInline
          style={{ width: 260, flex: 'none', borderRadius: 'var(--r-md)', display: 'block', background: '#000' }}
        />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--ink)', lineHeight: 1.6 }}>
            {puesta.descripcion}
          </div>
          <div style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)', lineHeight: 1.6, marginTop: 10 }}>
            {puesta.cuando}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            <Tag>{puesta.clips[0]}-{puesta.clips[1]} tomas</Tag>
            <Tag>{puesta.segundosClip[0]}-{puesta.segundosClip[1]} s por toma</Tag>
            <Tag>
              {puesta.habla === 'siempre' ? 'Habla a cámara'
                : puesta.habla === 'nunca' ? 'Voz en off'
                  : 'Alterna habla y voz en off'}
            </Tag>
            {puesta.personas === 2 && <Tag>Dos personas</Tag>}
          </div>

          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 14, lineHeight: 1.6 }}>
            El video de arriba es un anuncio real de {Math.round(ej.duracionSeg)} segundos hecho
            con este formato.
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Una línea del guion ──────────────────────────────────────────────────────
// Solo lo que se DICE y cuánto dura. Nada de cámara, acción ni prompt: eso es
// cómo se fabrica, y el cliente no fabrica nada.

function LineaGuion({
  n, segundos, habla, voz, palabras, tope, voseo, literal, ctaInventado, original,
  onEditar, onPedir, guardando,
}: {
  n: number; segundos: number; habla: boolean; voz: string;
  palabras: number; tope: number; voseo: string[];
  /** Es el cierre del guion: va palabra por palabra como lo escribió el cliente. */
  literal?: boolean;
  /** Palabras de llamado a la acción que MaKo metió y el guion no tenía. */
  ctaInventado?: string[];
  /** Lo que decía el guion, cuando MaKo lo dijo con otras palabras. */
  original?: string;
  /** Guardar el texto corregido a mano. */
  onEditar: (voz: string) => void;
  /** Pedirle a MaKo que cambie ESTA toma. */
  onPedir: (instruccion: string) => Promise<void>;
  guardando: boolean;
}) {
  const alerta = palabras > tope || voseo.length > 0;
  // El campo de instrucción arranca cerrado: siete campos abiertos a la vez es
  // un formulario, y esto es un guion que se lee.
  const [pidiendo, setPidiendo] = useState(false);
  const [instruccion, setInstruccion] = useState('');
  const [enviando, setEnviando] = useState(false);

  const pedir = async () => {
    if (!instruccion.trim()) return;
    setEnviando(true);
    try {
      await onPedir(instruccion.trim());
      setInstruccion(''); setPidiendo(false);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 16, padding: '14px 0',
      borderTop: n === 1 ? 'none' : '1px solid var(--border)',
    }}>
      {/* El número de toma manda sobre los segundos: es como se nombra («cambiá
          la 3»). Los segundos van abajo, chicos, porque se consultan y no se
          buscan. */}
      <div style={{ flex: 'none', minWidth: 34, textAlign: 'right', paddingTop: 2 }}>
        <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: 'var(--dim)', lineHeight: 1.2 }}>
          {n}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>
          {segundos}s
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* El botón vive en la fila, alineado a la derecha del texto: pertenece a
            ESTA toma y a ninguna otra. */}
        <button
          type="button"
          onClick={() => setPidiendo((v) => !v)}
          title="Pedirle a MaKo que cambie esta toma"
          style={{
            float: 'right', marginLeft: 10, background: 'transparent', border: 'none',
            cursor: 'pointer', padding: '2px 5px', borderRadius: 6,
            color: pidiendo ? 'var(--accent)' : 'var(--faint)', lineHeight: 0,
          }}
        >
          <Icon name="ia" size={14} />
        </button>
        {/*
          Se edita ACÁ, escribiendo encima. Antes, para cambiar una palabra había
          que pedirle a MaKo que rehiciera el plan entero: caro, lento, y con el
          riesgo de que las otras seis tomas también cambiaran. Corregir una
          palabra tiene que costar una palabra.

          Se pierde el `**énfasis**` en negrita mientras se escribe —el campo
          muestra el texto crudo— y vuelve al guardar. Es el precio de editar en
          el mismo lugar donde se lee, y es más barato que un modal.
        */}
        {/*
          Tamaño de LECTURA, fuera de la escala de la interfaz, y es a propósito.

          Esto no es texto de una pantalla: es lo que una persona va a decir a
          cámara. Se lee en voz alta, se corrige mirándolo de lejos y se compara
          contra el guion original. A 14 px —`--fs-md`, el tamaño del resto de la
          app— hay que acercarse a la pantalla para leerlo, y el dueño lo dijo:
          «las letras super chiquitas, no se llega a leer bien».

          El `clamp` lo mantiene legible en un monitor grande sin desbordar en uno
          chico.
        */}
        <EditarTexto
          valor={voz}
          multiline
          enfasis
          disabled={guardando}
          onSave={onEditar}
          style={{
            fontSize: 'clamp(16px, 1.15vw, 19px)', lineHeight: 1.62,
            color: habla ? 'var(--ink)' : 'var(--dim)',
            fontStyle: habla ? 'normal' : 'italic',
          }}
        />
        {alerta && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warn)', lineHeight: 1.5, marginTop: 4 }}>
            {palabras > tope && <div>Es muy largo para {segundos} segundos. Pide acortarlo.</div>}
            {voseo.length > 0 && <div>Tiene palabras de otro país ({voseo.join(', ')}) para el acento elegido.</div>}
          </div>
        )}

        {/*
          Qué se hizo con esta línea. MaKo adapta la FORMA —le pone los conectores
          con los que arranca la persona— y eso es deseable; lo que no puede es
          cambiar lo que dice. Estas dos marcas hacen visible la diferencia, que
          antes solo se podía ver comparando a mano contra el guion.
        */}
        {literal && (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 4 }}>
            Cierre — va tal cual lo escribiste.
          </div>
        )}
        {ctaInventado && ctaInventado.length > 0 && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--warn)', lineHeight: 1.5, marginTop: 4 }}>
            MaKo nombró algo que tu guion no dice ({ctaInventado.join(', ')}). Tu guion decía:
            «{original}»
          </div>
        )}

        {pidiendo && (
          <div style={{ marginTop: 9, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input
              autoFocus
              value={instruccion}
              onChange={(e) => setInstruccion(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void pedir(); if (e.key === 'Escape') setPidiendo(false); }}
              placeholder="Más corta. Que arranque con una pregunta. Sacale el nombre del gerente."
              disabled={enviando}
              style={{
                flex: 1, minWidth: 0, fontFamily: 'inherit', fontSize: 'var(--fs-sm)',
                padding: '7px 10px', borderRadius: 9, color: 'var(--ink)',
                background: 'var(--surface)', border: '1px solid var(--border-strong)',
              }}
            />
            <Button size="sm" variant="mako" onClick={() => void pedir()} loading={enviando} disabled={!instruccion.trim()}>
              Cambiar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── La app ───────────────────────────────────────────────────────────────────

export function VideoGeneratorApp({
  historialInicial, contexto, puente, guiones, anuncios }: {
  historialInicial: PlanGuardado[];
  contexto: EstadoContextoVideo | null;
  puente: Puente | null; guiones: GuionDisponible[]; anuncios: AnuncioHecho[] }) {
  const PLANTILLAS = useMemo(() => puestasOfrecidas(), []);

  const [historial, setHistorial] = useState<PlanGuardado[]>(historialInicial);
  const [actual, setActual] = useState<PlanGuardado | null>(null);
  const [editandoLinea, setEditandoLinea] = useState(false);
  // Siempre se entra al catálogo, aunque haya anuncios hechos: se viene a crear
  // uno nuevo, no a releer el anterior.
  const [vista, setVista] = useState<Vista>('catalogo');

  // El reloj que permite que «el puente anda» se apague solo. Arranca en `null`
  // para no decidir una rama con dos relojes distintos —el del server y el del
  // navegador— durante la hidratación.
  const [ahoraTick, setAhoraTick] = useState<number | null>(null);
  useEffect(() => {
    setAhoraTick(Date.now());
    const t = window.setInterval(() => setAhoraTick(Date.now()), 30000);
    return () => window.clearInterval(t);
  }, []);
  /** La plantilla abierta en el detalle. null = modal cerrado. */
  const [detalle, setDetalle] = useState<Puesta | null>(null);
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('guion');

  // Vacío a propósito: el botón «Crear» nace apagado y se enciende al elegir.
  // Con una preseleccionada, el marco azul dice «ya elegiste» sin que nadie
  // haya elegido.
  const [puestaId, setPuestaId] = useState<string>('');
  /** El guion de MaKo elegido. Es lo ÚNICO que el wizard pide. */
  const [guionId, setGuionId] = useState<string>('');
  /** El modal de pegar guiones propios. */
  const [cargando, setCargando] = useState(false);
  /** El guion abierto en el detalle. null = cerrado. */
  const [verGuion, setVerGuion] = useState<GuionDisponible | null>(null);
  const [verGuiones, setVerGuiones] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const puesta = useMemo(() => puestaPorId(puestaId), [puestaId]);
  const puestaActual = useMemo(
    () => (actual ? puestaPorId(actual.plan.puestaId) : undefined),
    [actual],
  );
  const guion = useMemo(
    () => guiones.find((g) => g.id === guionId),
    [guiones, guionId],
  );

  /**
   * Cuánto va a durar ESTE guion en ESTE formato, y si entra.
   *
   * Reemplaza al paso «¿cuánto tiene que durar?»: el número se deriva del texto
   * (palabras ÷ densidad de la puesta) en vez de elegirse de un menú. Y avisa
   * cuando no entra, que antes se recortaba en silencio.
   */
  const cabida = useMemo(
    () => (puesta && guion ? cabidaDeGuion(puesta, guion.hablado) : null),
    [puesta, guion],
  );

  // ── Retomar el anuncio que estaba abierto ────────────────────────────────
  // Si la URL trae un `?plan=`, se abre ese. Es lo que hace que refrescar deje
  // al dueño donde estaba en vez de mandarlo al catálogo.
  //
  // Se busca en el historial que bajó del server, así que un plan que ya se
  // recortó del tope de 10 no vuelve: en ese caso se entra al catálogo, que es
  // la caída correcta —mejor la home que una pantalla vacía.
  const params = useSearchParams();
  useEffect(() => {
    const id = params.get('plan');
    if (!id || actual) return;
    const guardado = historial.find((e) => e.id === id);
    if (guardado) { setActual(guardado); setVista('anuncio'); }
    // Solo al montar: después manda el estado, no la URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const idx = PASOS.indexOf(paso);
  const puedeAvanzar = paso === 'guion' ? !!guionId : true;

  /**
   * Guarda una toma corregida a mano.
   *
   * El plan vuelve del server ya recalculado —palabras, tope y marcas de voseo
   * son MEDIDAS, no declaraciones— así que el estado local se reemplaza entero
   * con lo que devolvió, en vez de parchear el clip que se tocó.
   */
  const editarLinea = useCallback(async (n: number, voz: string) => {
    if (!actual) return;
    setEditandoLinea(true); setError(null);
    try {
      const out = await editarLineaPlanAction(actual.id, n, voz);
      if (!out.ok) { setError(out.error); return; }
      setActual(out.item);
      setHistorial((h) => h.map((e) => (e.id === out.item.id ? out.item : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la toma.');
    } finally {
      setEditandoLinea(false);
    }
  }, [actual]);

  /** Le pide a MaKo el cambio de UNA toma. */
  const pedirCambio = useCallback(async (n: number, instruccion: string) => {
    if (!actual) return;
    setError(null);
    try {
      const out = await reescribirTomaAction(actual.id, n, instruccion);
      if (!out.ok) { setError(out.error); return; }
      setActual(out.item);
      setHistorial((h) => h.map((e) => (e.id === out.item.id ? out.item : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la toma.');
    }
  }, [actual]);

  const empezar = useCallback((id: string) => {
    setPuestaId(id);
    setGuionId('');
    setPaso('guion');
    setError(null);
    setVista('wizard');
  }, []);

  /**
   * Genera el plan del anuncio.
   *
   * Ya no toma `conFeedback`: ese parámetro existía para el bloque de «¿le
   * cambiamos algo?», que rehacía el plan ENTERO con un comentario suelto. Ahora
   * los cambios se piden POR TOMA (`reescribirTomaAction`), que cuesta una
   * llamada barata en vez de un plan completo y no toca las tomas que estaban
   * bien.
   */
  const generar = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const out = await generarPlanAction({
        puestaId,
        // Se manda el guion ENTERO, con sus rótulos: el modelo los usa para saber
        // qué parte es el gancho y qué parte el cierre. Lo que se le sacan los
        // rótulos es solo a la cuenta de palabras (`hablado`), porque eso mide
        // cuánto se TARDA en decirlo.
        guionId: guion?.id ?? '',
        guionTexto: guion?.texto ?? '',
      });
      if (!out.ok) { setError(out.error); return; }
      setHistorial(out.historial);
      setActual(out.item);
      setVista('anuncio');
      // El anuncio abierto queda en la URL. Sin esto, refrescar la página lo
      // perdía y devolvía al catálogo: el plan vive en el server pero la vista
      // vivía solo en el estado del cliente, y un F5 se lo lleva.
      window.history.replaceState(null, '', `?plan=${out.item.id}`);
    } finally {
      setBusy(false);
    }
  }, [puestaId, guion]);

  const copiarGuion = useCallback(() => {
    if (!actual) return;
    navigator.clipboard.writeText(guionATexto(actual.plan)).catch(() => {
      /* sin portapapeles: el guion igual está en pantalla */
    });
  }, [actual]);

  // ── Las tres preguntas ─────────────────────────────────────────────────────
  if (vista === 'wizard') {
    return (
      <WizardShell
        titulo={puesta ? puesta.nombre : 'Nuevo anuncio'}
        pasos={PASOS}
        pasoActual={paso}
        pregunta={PREGUNTA[paso]}
        error={error}
        puedeAvanzar={puedeAvanzar}
        enUltimo={paso === 'revisar'}
        confirmLabel="Generar anuncio"
        pending={busy}
        cargando={busy ? 'MaKo está escribiendo tu anuncio…' : null}
        atrasLabel={idx === 0 ? 'Cambiar plantilla' : 'Atrás'}
        onAtras={() => (idx === 0 ? setVista('catalogo') : setPaso(PASOS[idx - 1]))}
        onSiguiente={() => setPaso(PASOS[idx + 1])}
        onConfirmar={() => void generar()}
        onClose={() => setVista('catalogo')}
        fullscreen
        embebido
      >
        {paso === 'guion' && (
          <div style={{ textAlign: 'left' }}>
            {verGuion && (
              <DetalleGuion
                guion={verGuion}
                puesta={puesta}
                onCerrar={() => setVerGuion(null)}
                onUsar={() => { setGuionId(verGuion.id); setVerGuion(null); }}
                onEditado={() => router.refresh()}
              />
            )}

            {cargando && (
              <CargarGuiones
                onCerrar={() => setCargando(false)}
                onCargado={() => {
                  setCargando(false);
                  // `router.refresh()` y NO `window.location.reload()`.
                  //
                  // Los guiones bajan del server como props, así que hay que
                  // volver a pedirlos —agregarlos a mano al estado local crearía
                  // una segunda copia que se desincroniza en cuanto alguien los
                  // toque desde /ads-writer—. Pero recargar la página entera
                  // tiraba también el estado del cliente, y el estado del cliente
                  // es EN QUÉ PASO ESTABA: terminabas de cargar tus guiones y la
                  // app te devolvía a elegir la plantilla, con todo perdido.
                  //
                  // refresh() vuelve a correr el server component y deja el
                  // wizard donde estaba. Es el mismo dato, sin perder el lugar.
                  router.refresh();
                }}
              />
            )}

            {guiones.length === 0 ? (
              // No es un estado vacío decorativo: dice DÓNDE se arregla. Sin
              // guiones esta tab no tiene nada que grabar, y el lugar donde se
              // escriben es otra pantalla.
              // Sin guiones, el vacío no puede ser solo un aviso: tiene que
              // ofrecer las DOS salidas reales —que MaKo escriba uno, o cargar el
              // propio— porque un estado vacío que solo explica deja igual de
              // trabado que uno que no dice nada.
              <div>
                <Alert tono="warn" accion={{ label: 'Ir a Ads Writer', href: '/ads-writer' }}>
                  <strong>Todavía no tienes guiones escritos.</strong> Los anuncios de video se
                  graban a partir de un guion. MaKo puede escribirte uno en Ads Writer, con tu
                  ángulo y tu avatar — o carga el tuyo aquí abajo.
                </Alert>
                <button
                  type="button"
                  onClick={() => setCargando(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, width: '100%', marginTop: 14,
                    padding: '15px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit', background: 'transparent',
                    border: '1.5px dashed var(--border-strong)',
                    color: 'var(--faint)', transition: 'border-color .12s, color .12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--faint)';
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>Nuevo guion</span>
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 10 }}>
                {/*
                  PRIMERA de la lista, no última.
                  //
                  Cargar el propio no es lo que se hace cuando no encontrás
                  ninguno: es una de las formas de arrancar, y ponerla al final la
                  convierte en el premio consuelo de haber revisado todo lo demás.
                  Arriba se ve sin scrollear y sin leer los otros.
                  //
                  Va DENTRO de la misma grilla y del mismo ancho que una card de
                  guion: es una opción más entre guiones, no una acción de otra
                  categoría. Es el molde de «Crear nuevo proyecto» del board.
                  //
                  Punteada y no sólida porque no hay nada adentro todavía: el
                  borde dice «acá va a haber uno» sin fingir que ya lo hay.
                */}
                <button
                  type="button"
                  onClick={() => setCargando(true)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, width: '100%',
                    padding: '13px 15px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit', background: 'transparent',
                    border: '1.5px dashed var(--border-strong)',
                    color: 'var(--faint)', transition: 'border-color .12s, color .12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--primary)';
                    e.currentTarget.style.color = 'var(--primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-strong)';
                    e.currentTarget.style.color = 'var(--faint)';
                  }}
                >
                  <span style={{ fontSize: 18, lineHeight: 1 }}>＋</span>
                  <span style={{ fontSize: 'var(--fs-md)', fontWeight: 650 }}>Nuevo guion</span>
                </button>

                {guiones.map((g) => {
                  const elegido = g.id === guionId;
                  const cab = puesta ? cabidaDeGuion(puesta, g.hablado) : null;
                  return (
                    <div
                      key={g.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={elegido}
                      onClick={() => setGuionId(g.id)}
                      // Doble click abre el detalle, como en las plantillas de la
                      // portada. El gesto ya existe en esta pantalla: repetirlo
                      // acá es gratis y no repetirlo obliga a aprender dos.
                      onDoubleClick={() => setVerGuion(g)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setGuionId(g.id); }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        cursor: 'pointer', padding: '13px 15px', borderRadius: 12,
                        background: elegido ? 'var(--primary-bg)' : 'var(--surface)',
                        border: `1.5px solid ${elegido ? 'var(--primary)' : 'var(--border)'}`,
                      }}
                    >
                      {/*
                        SOLO el título. Las palabras, la duración y el texto se
                        fueron al detalle: una lista donde cada fila trae cinco
                        datos no se lee, se escanea — y para ELEGIR entre guiones
                        alcanza con el nombre. Lo demás se mira cuando se duda, y
                        para eso está «Abrir».
                      */}
                      <span style={{
                        flex: 1, minWidth: 0, fontSize: 'var(--fs-md)', fontWeight: 650,
                        color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {g.angulo || 'Sin título'}
                      </span>

                      {/* Lo único que sobrevive al lado del título es lo que
                          cambia una DECISIÓN: que ya lo grabaste, y que no entra
                          en este formato. Los dos hacen elegir distinto.

                          Y cuando se sabe CON QUÉ formato se grabó, se nombra:
                          «ya lo grabaste» a secas suena a callejón, cuando lo
                          que suele pasar es que se quiera el mismo guion en otro
                          formato — es exactamente lo que hizo el dueño con su
                          primer anuncio, grabado en Car Talks y en The Office. */}
                      {g.yaUsado && (
                        <Tag color="var(--good)" icon={<Icon name="check" size={12} />}>Generado</Tag>
                      )}
                      {cab?.desborda && <Tag color="var(--warn)">No entra</Tag>}

                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setVerGuion(g); }}
                        style={{
                          flex: 'none', background: 'transparent', border: 'none',
                          padding: '3px 6px', cursor: 'pointer', fontFamily: 'inherit',
                          fontSize: 'var(--fs-meta)', color: 'var(--dim)',
                          textDecoration: 'underline', textUnderlineOffset: 3,
                        }}
                      >
                        Abrir
                      </button>
                    </div>
                  );
                })}


              </div>
            )}

            {/*
              El aviso del desborde va PEGADO al botón que dispara, no arriba de
              todo: es la consecuencia de apretar, y arriba en gris no la lee
              nadie. Y no bloquea — el dueño puede querer grabarlo igual y editar
              después; lo que no puede pasar es que se recorte sin decirlo.
            */}
            {cabida?.desborda && (
              <div style={{ marginTop: 14 }}>
                <Alert tono="warn">
                  Este guion es más largo de lo que <strong>{puesta?.nombre}</strong> puede
                  contar: entran {cabida.palabras - cabida.palabrasDeMas} palabras y tiene{' '}
                  {cabida.palabras}. Si sigues, el final va a quedar afuera. Prueba con otro
                  formato o recorta el guion en Ads Writer.
                </Alert>
              </div>
            )}
          </div>
        )}


        {paso === 'revisar' && (
          <div style={{ textAlign: 'left', display: 'grid', gap: 14 }}>
            {/*
              Lo que se revisa NO es un resumen de lo que elegiste: es lo que el
              sistema puso SOLO y vos nunca viste. El formato y el guion los
              acabás de elegir; la cara, la duración y el acento los decidió MaKo,
              y son justo los que se notan recién en el video terminado.
            */}

            {/* La CARA. Va primero y va como IMAGEN: la pregunta que contesta es
                «¿es esta persona?», y un «3 fotos cargadas» se lee igual con las
                fotos correctas que con las de otro. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 15px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
            }}>
              {contexto?.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contexto.fotoUrl}
                  alt="Tu cara de marca"
                  style={{ width: 62, height: 62, borderRadius: 10, objectFit: 'cover', flex: 'none' }}
                />
              ) : (
                <div style={{
                  width: 62, height: 62, borderRadius: 10, flex: 'none', display: 'grid',
                  placeItems: 'center', background: 'var(--surface-2)', color: 'var(--faint)',
                }}>
                  <Icon name="perfil" size={26} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>
                  {contexto?.tieneFotos ? 'Esta es la cara del avatar' : 'Todavía no cargaste tu cara'}
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
                  {contexto?.tieneFotos
                    ? <>Si no eres tú, cámbiala en <Link href="/onboarding">Onboarding → Persona</Link>.</>
                    : <>Sin una foto tuya, cada toma sale con una persona distinta. Cárgala en <Link href="/onboarding">Onboarding → Persona</Link>.</>}
                </div>
              </div>
            </div>

            {/* Lo que MaKo derivó y nadie eligió. */}
            <div style={{
              padding: '13px 15px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              display: 'grid', gap: 9,
            }}>
              <Fila k="Formato" v={puesta?.nombre ?? '—'} />
              <Fila k="Guion" v={guion?.angulo || 'Sin título'} />
              <Fila
                k="Va a durar"
                v={cabida ? `${cabida.segundosReales} segundos en ${cabida.clips} tomas` : '—'}
              />
              <Fila k="Acento" v={contexto?.acento.etiqueta ?? "—"} nota={contexto?.acento.seguro ? undefined : 'lo deduje de tu zona horaria'} />
            </div>

            {cabida?.desborda && (
              <Alert tono="warn">
                El guion es más largo de lo que <strong>{puesta?.nombre}</strong> puede contar:
                sobran {cabida.palabrasDeMas} palabras y el final va a quedar afuera.
              </Alert>
            )}

            {/*
              Qué pasa al apretar, PEGADO al botón y en tinta normal.
              //
              Y dice lo que NO pasa: acá se escribe el plan —cómo se reparte el
              guion en tomas—, no se genera el video. Sin esa línea, «Generar
              anuncio» promete un video y devuelve un texto, que es la forma más
              barata de que alguien crea que algo se rompió.
            */}
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.6 }}>
              MaKo va a repartir tu guion en {cabida?.clips ?? '—'} tomas y escribir cómo se
              filma cada una. <strong>Todavía no se genera ningún video</strong> ni se gastan
              créditos de tu cuenta de Google.
            </div>
          </div>
        )}
      </WizardShell>
    );
  }

  // ── El anuncio ─────────────────────────────────────────────────────────────
  if (vista === 'anuncio' && actual) {
    return (
      <Pagina>
        <PageHeader
          titulo={actual.plan.titulo}
          // Sin ícono: `arrow-left` no existe en el set y `<Icon>` no falla con
          // un nombre desconocido — cae a `dot` y dibuja un puntito.
          acciones={
            <Button
              variant="secondary"
              onClick={() => {
                setVista('catalogo');
                // Y se limpia el `?plan=`: si quedara, refrescar reabriría el
                // anuncio que el dueño acaba de cerrar.
                window.history.replaceState(null, '', window.location.pathname);
              }}
            >
              Volver al catálogo
            </Button>
          }
          accion={
            <Button
              variant="mako"
              disabled
              // ⚠️ El título decía que esto «se enciende cuando termine la
              // conexión con el generador», y era MENTIRA: el puente ya está
              // conectado y responde. Lo que no existe todavía es la generación.
              //
              // Un botón apagado que culpa a algo que sí funciona manda al dueño a
              // revisar su navegador durante media hora. Un aviso que dice qué
              // falta cuesta lo mismo y no le hace perder el tiempo.
              title="Todavía no está construida la generación del video. El plan de tomas ya está listo para producir a mano."
            >
              Generar el video
            </Button>
          }
        />

        {error && <Alert tono="bad">{error}</Alert>}

        {/*
          DOS COLUMNAS, y la de la derecha no es relleno.

          Antes el guion vivía en una tira de 780 px con media pantalla en blanco
          al lado. Ahora esa mitad contesta las dos preguntas que uno se hace
          leyendo el guion y que hasta acá no tenían respuesta en esta pantalla:
          **¿con qué cara se graba?** y **¿cómo se ve ese formato?**. Las dos se
          contestan mirando, no leyendo — por eso van la foto real y el ejemplo en
          video, y no una lista de propiedades.

          En pantalla angosta la columna baja abajo (`flexWrap`), que es donde
          molesta menos: primero lo que se lee, después la referencia.
        */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 620px', minWidth: 0, maxWidth: 900 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {puestaActual && <Tag>{puestaActual.nombre}</Tag>}
            <Tag>{actual.plan.duracionTotalSeg} segundos</Tag>
            <Tag>{actual.plan.clips.length} tomas</Tag>
          </div>

          <Section
            titulo="Tu guion"
            accion={
              <Button size="sm" variant="tertiary" onClick={copiarGuion} icon={<Icon name="copy" size={13} />}>
                Copiar
              </Button>
            }
          >
            <div>
              {actual.plan.clips.map((c) => (
                <LineaGuion
                  key={c.n}
                  n={c.n}
                  segundos={c.segundos}
                  habla={c.habla}
                  voz={c.voz}
                  // Un anuncio guardado ANTES de que existieran estos campos no
                  // los trae: el historial vive en app_settings y no migra.
                  palabras={c.palabras ?? 0}
                  tope={c.tope ?? 0}
                  // Las marcas de voseo solo importan si el acento NO es rioplatense: en
                  // uno que sí lo es, «tenés» no es una filtración, es el idioma.
                  // El acento sale del PLAN —lo escribió el server al generarlo— y
                  // no de un estado de esta pantalla, que ya no lo pregunta.
                  voseo={actual.plan.acentoEsVoseante ? [] : (c.voseo ?? [])}
                  literal={c.literal}
                  ctaInventado={c.ctaInventado}
                  original={c.original}
                  guardando={editandoLinea}
                  onEditar={(v) => void editarLinea(c.n, v)}
                  onPedir={(i) => pedirCambio(c.n, i)}
                />
              ))}
            </div>
          </Section>

          {/*
            ACÁ VIVÍA «¿le cambiamos algo?», que rehacía el plan ENTERO con un
            comentario suelto. Se fue por pedido del dueño —«mejor que se pueda
            editar escribiendo, o sí darle instrucciones, pero por bloques, no
            todo el guion»— y porque el trato era malo: una frase que no cierra
            costaba las otras seis tomas, que estaban bien.

            Lo que hace lo mismo y mejor vive ahora dentro de cada toma: se
            escribe encima, o se le pide el cambio a MaKo ahí, en esa línea.
          */}
        </div>

        {/* ── La referencia: con quién y cómo ──────────────────────────────── */}
        <aside style={{ flex: '0 1 300px', minWidth: 260, display: 'grid', gap: 16 }}>
          <div style={{
            borderRadius: 14, background: 'var(--surface)',
            border: '1px solid var(--border)', overflow: 'hidden',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
              {contexto?.fotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={contexto.fotoUrl}
                  alt="Tu cara de marca"
                  style={{ width: 54, height: 54, borderRadius: 11, objectFit: 'cover', flex: 'none' }}
                />
              ) : (
                <div style={{
                  width: 54, height: 54, borderRadius: 11, flex: 'none', display: 'grid',
                  placeItems: 'center', background: 'var(--surface-2)', color: 'var(--faint)',
                }}>
                  <Icon name="perfil" size={24} />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)' }}>
                  Quién lo dice
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 2 }}>
                  {contexto?.tieneFotos
                    ? <>Tu cara de marca. <Link href="/onboarding">Cambiarla</Link></>
                    : <><Link href="/onboarding">Sube una foto tuya</Link> o cada toma sale con otra persona.</>}
                </div>
              </div>
            </div>
          </div>

          {puestaActual?.ejemplo && (
            <div style={{
              borderRadius: 14, background: 'var(--surface)',
              border: '1px solid var(--border)', overflow: 'hidden',
            }}>
              <video
                src={puestaActual.ejemplo.video}
                poster={puestaActual.ejemplo.poster}
                autoPlay
                loop
                muted
                playsInline
                style={{ width: '100%', display: 'block', aspectRatio: '9 / 16', objectFit: 'cover' }}
              />
              <div style={{ padding: '12px 15px 14px' }}>
                <div style={{ fontSize: 'var(--fs-card)', fontWeight: 650, color: 'var(--ink)' }}>
                  Cómo se va a ver
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
                  {puestaActual.nombre} · {puestaActual.tecnico}
                </div>
              </div>
            </div>
          )}
        </aside>
        </div>
      </Pagina>
    );
  }

  // ── El catálogo, que es la home ────────────────────────────────────────────
  // Sin «Tus anuncios»: un guion listo NO es un anuncio, y esa lista va a existir
  // cuando existan videos, en su propia tab. Los guiones ya escritos se retoman
  // desde adentro del proceso de crear (primer paso del wizard), que es donde
  // sirven — no en la portada.
  const puedeCrear = !!puestaId;

  // ¿El puente está andando AHORA? Se mira la FRESCURA de la última señal, no su
  // existencia: `ultimoVisto` es un campo con fecha, y usarlo como booleano ya
  // dejó los pasos en verde con una señal de 35 horas antes.
  const puenteAnda = puente?.estado === 'listo'
    && !!puente.ultimoVisto
    && (ahoraTick == null || ahoraTick - new Date(puente.ultimoVisto).getTime() < 2 * 60 * 1000);

  return (
    <Pagina>
      {error && <Alert tono="bad">{error}</Alert>}

      {contexto && !contexto.tieneFotos && (
        <Alert tono="warn">
          Antes de crear tu primer anuncio sube una foto tuya en{' '}
          <Link href="/onboarding">Onboarding → Persona</Link>: es la que le da la cara a tu
          avatar, y sin ella cada toma sale con una persona distinta.
        </Alert>
      )}

      {/* El título es el protagonista de la pantalla y el botón vive a su lado:
          es la única acción, así que se lee junto a lo que hay que hacer antes. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap', marginBottom: 22,
      }}>
        <h1 style={{
          margin: 0, fontSize: 'clamp(26px, 3.2vw, 34px)', fontWeight: 700,
          letterSpacing: '-.02em', color: 'var(--ink)', lineHeight: 1.15,
        }}>
          Elige el formato
        </h1>
        {/*
          El botón es la ÚNICA acción de la pantalla, así que pesa como tal: más
          alto, más aire a los lados y el texto más grande que un botón normal.
          Un `size="lg"` del kit lo dejaba del tamaño de cualquier otro y se leía
          como un control más entre varios — y acá no hay varios.
        */}
        <Button
          variant="mako"
          size="xl"
          disabled={!puedeCrear}
          onClick={() => puestaId && empezar(puestaId)}
          icon={<Icon name="ia" size={19} />}
        >
          Crear mi anuncio
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        {PLANTILLAS.map((p) => (
          <Plantilla
            key={p.id}
            nombre={p.nombre}
            video={p.ejemplo!.video}
            poster={p.ejemplo!.poster}
            elegida={p.id === puestaId}
            onElegir={() => setPuestaId(p.id)}
            onDetalle={() => setDetalle(p)}
          />
        ))}
      </div>

      {/*
        Los anuncios TERMINADOS, abajo de las plantillas.

        Va abajo y no arriba porque a esta pantalla se viene a crear uno nuevo:
        lo hecho es referencia, no destino. Y va acá y no en su propia tab porque
        el dueño lo pidió así — «por ahora los tendremos allí, luego lo
        mudaremos».

        Si no hay ninguno NO se muestra un vacío decorativo: una sección que dice
        «todavía no hay nada» en una pantalla donde todavía no puede haber nada
        es ruido. Aparece cuando hay algo que mirar.
      */}
      {anuncios.length > 0 && (
        <div style={{ marginTop: 'calc(var(--gap) * 1.4)' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 14,
          }}>
            <h2 style={{
              margin: 0, fontSize: 'var(--fs-sect)', fontWeight: 700,
              letterSpacing: '-.01em', color: 'var(--ink)',
            }}>
              Anuncios terminados
            </h2>
            <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
              {anuncios.length}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {anuncios.map((a) => (
              <AnuncioCard key={a.id} a={a} />
            ))}
          </div>
        </div>
      )}

      {/*
        El puente SOLO se muestra cuando hay algo que hacer con él.

        Es un paso previo, no una sección de esta pantalla: una vez que anda, el
        dueño no tiene por qué volver a leer cuatro pasos de instalación cada vez
        que entra a hacer un anuncio. «Ya comprobó que funcionaba, ya no debe
        aparecer.»

        Vivo y no recordado: un puente que dejó de llamar vuelve a mostrarse solo,
        que es exactamente cuando hay algo que hacer otra vez.
      */}
      {puente && !puenteAnda && (
        <div style={{ marginTop: 'var(--gap)', maxWidth: 780 }}>
          <PuentePanel inicial={puente} />
        </div>
      )}

      {detalle && (
        <DetalleFormato
          puesta={detalle}
          onCerrar={() => setDetalle(null)}
          onUsar={() => { const id = detalle.id; setDetalle(null); empezar(id); }}
        />
      )}
    </Pagina>
  );
}
