'use client';

// =============================================================================
// RespuestaTarea — lo que contestó un cliente en una tarea, como lo lee el EQUIPO
// =============================================================================
// Item 18 del curso tipo Skool (07/10/2026): además de los formularios, una tarea puede pedir un
// archivo, una grabación de audio o video, un link, una escala, un quiz, una checklist, agendar una
// llamada o un «lo hice» (`CampoTipo`, lib/curso.ts). Esto los dibuja TODOS para quien revisa: los
// seis de siempre igual que la ficha (las tablas como tabla, lo que ya no tiene campo al final), y
// los nueve nuevos con su forma — el archivo se abre, la grabación se escucha o se ve ahí mismo, el
// quiz con su nota y pregunta por pregunta (acá SÍ se ven las correctas: es el equipo), la checklist
// con lo que tildó y lo que no.
//
// ⚠️ EL ORDEN Y LO QUE SE MUESTRA SALEN DE `respuestaDe` (../curso-ficha-lectura.ts), la misma
// lectura que usa la ficha: el orden del formulario, las tablas con sus filas fijas y lo contestado
// que ya no tiene campo. Acá sólo se dibuja distinto lo que es de los tipos nuevos. Con dos lecturas,
// la ficha y esto dirían cosas distintas de la misma respuesta.
//
// ⚠️ CON MÁS DE UNA TAREA (item 12 del audio del 08/10/2026), una lista por tarea con su título encima
// (`gruposPorTarea`, en ../curso-ficha-lectura.ts para que tenga test): sin eso, las respuestas de las
// dos tareas salían pegadas y no se sabía de cuál era cada pregunta — lo mismo que se reportó del editor.
//
// ⚠️ ABRIR UN ARCHIVO PIDE UN LINK FIRMADO AL SERVER (`abrirArchivo`, que la ficha conecta a una
// action con su puerta: lib/curso-entregas.ts, `urlEntregaParaEquipo`). Sin esa prop se listan con su
// nombre y su tamaño, sin abrir: un botón que no hace nada se lee como que la app está rota.

import { useState, type ReactNode } from 'react';
import {
  corregirQuiz, esCampoDeArchivo, esCampoDeComunidad, linkValido, refDeComunidad, NOTA_MIN_DEFAULT,
  type ArchivoEntregado, type Calificacion, type Campo, type CampoTipo, type Escala, type ValorCampo, type Valores,
} from '@/lib/curso';
import { Button } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { gruposPorTarea, respuestaDe, type BloqueRespuesta } from '../curso-ficha-lectura';

/** Los tipos que se dibujan con su propia forma; el resto, como la ficha (`respuestaDe`). */
const PROPIOS: ReadonlySet<CampoTipo> = new Set<CampoTipo>(['archivo', 'audio', 'video', 'link', 'escala', 'quiz', 'checklist', 'agenda', 'confirmacion', 'publicar', 'comentar']);

const archivosDe = (v: ValorCampo | undefined): ArchivoEntregado[] =>
  Array.isArray(v) ? (v as unknown[]).filter((x): x is ArchivoEntregado => !!x && typeof x === 'object' && !Array.isArray(x) && typeof (x as ArchivoEntregado).path === 'string') : [];
const textos = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, '0')}`;
const tamano = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`);

export default function RespuestaTarea({ campos, valores, calificacion, abrirArchivo, onOtroIntento }: {
  campos: readonly Campo[];
  valores: Valores | null | undefined;
  /** Las notas de sus quizzes (`curso_progreso.calificacion`, mig 0218). */
  calificacion?: Calificacion | null;
  /** El link firmado para abrir lo que entregó. Sin esto, los archivos se listan sin abrir. */
  abrirArchivo?: (a: ArchivoEntregado) => Promise<string | null>;
  /** Darle otro intento a un quiz que se quedó sin intentos. Sin esto, no se ofrece. */
  onOtroIntento?: (campoId: string) => Promise<void>;
}) {
  const porId = new Map(campos.map((c) => [c.id, c]));
  const vs: Valores = valores && typeof valores === 'object' ? valores : {};
  const bloques = respuestaDe(campos, vs);
  const grupos = gruposPorTarea(campos, bloques);
  const lista = (bs: BloqueRespuesta[]) => (
    <dl className="rt">
      {bs.map((b) => {
        const c = porId.get(b.id);
        const cuerpo = c && PROPIOS.has(c.tipo)
          ? <Propio c={c} v={vs[c.id]} nota={calificacion?.[c.id]} abrirArchivo={abrirArchivo} onOtroIntento={onOtroIntento} />
          : <Generico b={b} />;
        return <div key={b.id} className="rt-b"><dt>{b.label}</dt><dd>{cuerpo}</dd></div>;
      })}
    </dl>
  );
  // El `<style>` va AFUERA del `<dl>`: adentro de una lista de definiciones no es HTML válido, y React
  // lo marca como un anidamiento inválido al hidratar. Y el título de cada tarea va afuera también, por
  // lo mismo: un `<dl>` por tarea, con su título encima.
  return (
    <div className="rt-caja">
      {grupos.length === 1 && grupos[0].titulo == null ? lista(grupos[0].bloques) : grupos.map((g) => (
        <div key={g.clave} className="rt-tarea">
          {g.titulo != null && <p className="rt-tarea-t">{g.titulo}</p>}
          {lista(g.bloques)}
        </div>
      ))}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** Un campo de los seis de siempre (o algo contestado que ya no tiene campo), como la ficha. */
function Generico({ b }: { b: BloqueRespuesta }) {
  if (b.tipo === 'vacio') return <span className="rt-sin">—</span>;
  if (b.tipo === 'texto') return <span className="rt-texto">{b.texto}</span>;
  if (b.tipo === 'lista') return <span className="rt-chips">{b.items.map((x, i) => <span key={i} className="rt-pill">{x}</span>)}</span>;
  const conTitulos = b.columnas.some((x) => x.trim());
  return (
    <div className="mk-scroll-x">
      <table className="rt-tabla">
        {conTitulos && <thead><tr>{b.columnas.map((col, j) => <th key={j} scope="col">{col}</th>)}</tr></thead>}
        <tbody>
          {b.filas.map((f, i) => (
            <tr key={i}>{f.map((x, j) => <td key={j}>{x || <span className="rt-sin">—</span>}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Un campo de los tipos de la #18, con su forma. */
function Propio({ c, v, nota, abrirArchivo, onOtroIntento }: {
  c: Campo; v: ValorCampo | undefined; nota: Calificacion[string] | undefined;
  abrirArchivo?: (a: ArchivoEntregado) => Promise<string | null>;
  onOtroIntento?: (campoId: string) => Promise<void>;
}): ReactNode {
  const sin = <span className="rt-sin">—</span>;

  if (esCampoDeArchivo(c.tipo)) {
    const lista = archivosDe(v);
    if (!lista.length) return sin;
    return <ul className="rt-archivos">{lista.map((a) => <Archivo key={a.path} a={a} abrir={abrirArchivo} />)}</ul>;
  }

  if (c.tipo === 'link') {
    const url = linkValido(v);
    return url ? <a className="rt-link" href={url} target="_blank" rel="noopener noreferrer">{url}</a> : sin;
  }

  if (c.tipo === 'escala') {
    const e: Escala = c.escala ?? { min: 1, max: 10, bajo: '', alto: '' };
    if (typeof v !== 'string' || !v) return sin;
    return (
      <span className="rt-col">
        <span className="rt-grande">{e.estilo === 'estrellas' ? '★ ' : ''}{v} <span className="rt-meta">de {e.max}</span></span>
        {(e.bajo || e.alto) && <span className="rt-meta">{e.min} = {e.bajo} · {e.max} = {e.alto}</span>}
      </span>
    );
  }

  if (c.tipo === 'checklist') {
    const marcadas = textos(v);
    const ops = c.opciones ?? [];
    if (!ops.length) return marcadas.length ? <span className="rt-texto">{marcadas.join(', ')}</span> : sin;
    const hechas = ops.filter((o) => marcadas.includes(o)).length;
    return (
      <span className="rt-col">
        <span className="rt-meta">{hechas} de {ops.length}</span>
        <ul className="rt-checks">
          {ops.map((o) => <li key={o} className={marcadas.includes(o) ? 'is-si' : 'is-no'}><span aria-hidden>{marcadas.includes(o) ? '✓' : '○'}</span> {o}</li>)}
        </ul>
      </span>
    );
  }

  if (c.tipo === 'agenda') return v === 'si' ? <span className="rt-texto">Agendó</span> : <span className="rt-sin">Sin agendar</span>;
  if (c.tipo === 'confirmacion') return v === 'si' ? <span className="rt-texto">Lo hizo</span> : sin;

  if (c.tipo === 'quiz') return <Quiz c={c} v={v} nota={nota} onOtroIntento={onOtroIntento} />;

  // La comunidad (item 17 del 08/10/2026): QUÉ publicó o comentó, con el link al post (la tab Comunidad
  // abre ese post, y elige sola su producto: `?post=`).
  if (esCampoDeComunidad(c.tipo)) {
    const r = refDeComunidad(c.tipo, v);
    if (!r) return c.tipo === 'publicar' ? <span className="rt-sin">Sin publicar</span> : <span className="rt-sin">Sin comentar</span>;
    return (
      <span className="rt-texto">
        {c.tipo === 'publicar' ? 'Publicó un post' : 'Comentó un post'} · <Link className="rt-link" href={`/customer-success/comunidad?post=${r.postId}`}>Ver post</Link>
      </span>
    );
  }

  return sin;
}

/**
 * Un quiz, como lo revisa el equipo: la nota y los intentos arriba, y pregunta por pregunta lo que
 * marcó, si estuvo bien y, si no, cuál era la correcta. Bien/mal sale de `corregirQuiz` (la misma
 * cuenta que el server) sobre lo que hay ahora; la NOTA, de lo que quedó guardado al corregir.
 */
function Quiz({ c, v, nota, onOtroIntento }: {
  c: Campo; v: ValorCampo | undefined; nota: Calificacion[string] | undefined;
  onOtroIntento?: (campoId: string) => Promise<void>;
}) {
  const [dando, setDando] = useState(false);
  const [dado, setDado] = useState(false);
  const ps = c.preguntas ?? [];
  const filas = Array.isArray(v) ? (v as unknown[]) : [];
  const malas = new Set(corregirQuiz(c, v)?.malas ?? []);
  const tope = c.intentos ?? 0;
  const sinIntentos = !!nota && !nota.aprobado && tope > 0 && nota.intentos >= tope && !dado;
  const resumen = !nota
    ? 'Sin corregir'
    : `${nota.aprobado ? 'Aprobado' : 'No aprobó'} · ${nota.nota} % (mínimo ${c.notaMin ?? NOTA_MIN_DEFAULT} %) · ${nota.intentos} ${nota.intentos === 1 ? 'intento' : 'intentos'}${tope ? ` de ${tope}` : ''}`;
  return (
    <span className="rt-col">
      <span className={`rt-meta ${nota?.aprobado ? 'rt-ok' : nota ? 'rt-mal' : ''}`}>{resumen}</span>
      {sinIntentos && onOtroIntento && (
        <span>
          <Button size="sm" variant="secondary" loading={dando}
            onClick={async () => { setDando(true); try { await onOtroIntento(c.id); setDado(true); } finally { setDando(false); } }}>
            Dar otro intento
          </Button>
        </span>
      )}
      <ol className="rt-quiz">
        {ps.map((p, i) => {
          const dadas = textos(filas[i]);
          const bien = dadas.length > 0 && !malas.has(i);
          return (
            <li key={p.id}>
              <span className="rt-preg">{p.texto}</span>
              <span className={bien ? 'rt-ok' : 'rt-mal'}>
                <span aria-hidden>{bien ? '✓ ' : '✗ '}</span>{dadas.length ? dadas.join(', ') : 'Sin contestar'}
              </span>
              {!bien && (p.correctas ?? []).length > 0 && <span className="rt-meta">Correcta: {(p.correctas ?? []).join(', ')}</span>}
            </li>
          );
        })}
      </ol>
    </span>
  );
}

/** Un archivo entregado: se abre en otra pestaña, o se escucha / se ve ahí mismo si es una grabación. */
function Archivo({ a, abrir }: { a: ArchivoEntregado; abrir?: (a: ArchivoEntregado) => Promise<string | null> }) {
  const [src, setSrc] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [cargando, setCargando] = useState(false);
  const esAudio = a.mime.startsWith('audio/');
  const esVideo = a.mime.startsWith('video/');

  async function abrirlo() {
    if (!abrir) return;
    setError(false);
    if (esAudio || esVideo) {
      setCargando(true);
      const url = await abrir(a);
      setCargando(false);
      if (url) setSrc(url); else setError(true);
      return;
    }
    // La pestaña se abre ANTES del pedido: abierta después de un `await`, el navegador la bloquea.
    const w = window.open('', '_blank');
    const url = await abrir(a);
    if (!url) { w?.close(); setError(true); return; }
    if (w) { w.opener = null; w.location.href = url; } else setLink(url);
  }

  return (
    <li className="rt-arch">
      <span className="rt-fila">
        <span className="rt-arch-nom">{a.nombre}</span>
        <span className="rt-meta">{a.seg ? reloj(a.seg) : tamano(a.bytes)}</span>
        {abrir && !src && (
          <Button variant="tertiary" size="sm" loading={cargando} onClick={() => void abrirlo()}>
            {esAudio ? 'Escuchar' : esVideo ? 'Ver' : 'Abrir'}
          </Button>
        )}
      </span>
      {src && esAudio && <audio className="rt-audio" src={src} controls autoPlay />}
      {src && esVideo && <video className="rt-video" src={src} controls autoPlay playsInline />}
      {link && <a className="rt-link" href={link} target="_blank" rel="noopener noreferrer">Abrir {a.nombre}</a>}
      {error && <span className="rt-mal">No se pudo abrir.</span>}
    </li>
  );
}

// ⚠️ Adentro de esta cadena no va ningún acento grave ni la secuencia de interpolación: la cortan.
const CSS = `
.rt{ margin: 0; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.rt-b{ display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.rt-b dt{ font-size: var(--fs-sm); font-weight: 600; color: var(--ink); overflow-wrap: anywhere; }
.rt-b dd{ margin: 0; font-size: var(--fs-sm); color: var(--ink); min-width: 0; }
.rt-texto{ white-space: pre-wrap; overflow-wrap: anywhere; }
.rt-sin{ color: var(--faint); }
.rt-meta{ font-size: var(--fs-meta); color: var(--dim); font-variant-numeric: tabular-nums; }
.rt-ok{ color: var(--good); }
.rt-mal{ color: var(--bad); }
.rt-col{ display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.rt-fila{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; min-width: 0; }
.rt-grande{ font-size: var(--fs-md); font-weight: 600; font-variant-numeric: tabular-nums; }
.rt-chips{ display: flex; flex-wrap: wrap; gap: 4px; }
.rt-pill{ padding: 2px 8px; border-radius: 999px; background: var(--surface-2); border: 1px solid var(--border); font-size: var(--fs-meta); }
.rt-tabla{ border-collapse: collapse; font-size: var(--fs-sm); }
.rt-tabla th{ text-align: left; font-size: var(--fs-meta); color: var(--faint); padding: 0 8px 4px; font-weight: 600; }
.rt-tabla td{ border-top: 1px solid var(--border); padding: 6px 8px; vertical-align: top; }
.rt-archivos, .rt-checks{ list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.rt-arch{ display: flex; flex-direction: column; gap: 6px; padding: 6px 8px; border: 1px solid var(--border); border-radius: 8px; min-width: 0; }
.rt-arch-nom{ flex: 1 1 120px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.rt-audio{ width: 100%; }
.rt-video{ width: 100%; max-height: 320px; background: #000; border-radius: 8px; }
.rt-checks .is-no{ color: var(--dim); }
.rt-quiz{ margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 8px; }
.rt-quiz li{ display: flex; flex-direction: column; gap: 2px; }
.rt-preg{ font-weight: 500; overflow-wrap: anywhere; }
.rt-link{ overflow-wrap: anywhere; }
.rt-caja{ display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.rt-tarea{ display: flex; flex-direction: column; gap: 10px; min-width: 0; padding-left: 12px; border-left: 3px solid var(--border-strong); }
.rt-tarea-t{ margin: 0; font-size: var(--fs-md); font-weight: 700; color: var(--ink); overflow-wrap: anywhere; }
`;
