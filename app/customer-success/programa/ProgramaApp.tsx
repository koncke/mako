'use client';

// =============================================================================
// Program — el temario, y qué se le pregunta a cada cliente en cada bloque
// =============================================================================
// Doce módulos plegados por defecto. Abiertos de entrada serían 44 clases y 118
// preguntas de un saque, que es una pared: la pantalla contesta primero «cuántos
// bloques hay y cuáles faltan grabar», y recién si se pide, «qué dice cada uno».
//
// El formulario de una clase se abre en un modal y no en línea a propósito: son
// hasta cuatro preguntas con tablas de cinco columnas, y desplegarlas dentro de
// la lista rompe el renglón de todas las demás.

import { useState } from 'react';
import { Pagina, PageHeader, Status, Modal, Banner, Button, useToast, Toast, MONO } from '@/app/_ui';
import { sincronizarWhopAction } from '../actions';
import type { Campo } from '@/lib/programa-campos';

type Clase = {
  id: string; rotulo: string; titulo: string; pregunta: string;
  atoro: string | null; campos: Campo[]; enWhop: boolean; destraba: boolean;
};
type Modulo = {
  id: string; numero: number; titulo: string; fase: string;
  quien: string; porArea: boolean; clases: Clase[];
};

const FASE: Record<string, string> = {
  arranque: 'Arranque', norte: 'Norte Estratégico', pas: 'PAS', palancas: 'Palancas y umbrales', build: 'Build y arranque',
};

const TIPO: Record<Campo['tipo'], string> = {
  texto: 'Párrafo', linea: 'Una línea', numero: 'Número',
  eleccion: 'Elegir una', checks: 'Marcar varias', tabla: 'Tabla',
};

export function ProgramaApp({ modulos, totales, whopConectado }: {
  modulos: Modulo[];
  totales: { clases: number; campos: number; enWhop: number };
  whopConectado: boolean;
}) {
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [clase, setClase] = useState<Clase | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const { toast, show, clear } = useToast();

  // Sincronizar es idempotente: compara por título y solo crea lo que falta.
  // Por eso el botón no pregunta nada — apretarlo dos veces no rompe.
  async function sincronizar() {
    setSincronizando(true);
    const r = await sincronizarWhopAction();
    setSincronizando(false);
    show(
      r.ok
        ? `Listo: ${r.creadas} clases nuevas, ${r.reescritas} reescritas, ${r.sinCambios} sin cambios.`
        : r.error,
      undefined, r.ok ? 'good' : 'bad',
    );
  }

  const plegar = (id: string) => setAbiertos(s => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const faltanEnWhop = totales.clases - totales.enWhop;

  return (
    <Pagina>
      <PageHeader
        titulo="Program"
        proposito={`${modulos.length} módulos · ${totales.clases} clases · ${totales.campos} preguntas`}
        acciones={whopConectado ? (
          <Button variant="secondary" disabled={sincronizando} onClick={() => void sincronizar()}>
            {sincronizando ? 'Sincronizando…' : 'Sincronizar a Whop'}
          </Button>
        ) : undefined}
      />

      {!whopConectado ? (
        <Banner tono="warn">Whop no está conectado, así que no se puede saber qué clases están cargadas.</Banner>
      ) : faltanEnWhop > 0 ? (
        <Banner tono="warn">
          {faltanEnWhop} de {totales.clases} clases todavía no están en Whop.
        </Banner>
      ) : null}

      <p className="pg-intro">
        Las preguntas salen de los dos Cuestionarios Maestros de Mauricio, textuales. Cada una
        lleva de qué pregunta original viene, para poder revisar que no falte ninguna.
      </p>

      <ul className="pg-mods">
        {modulos.map((m) => {
          const abierto = abiertos.has(m.id);
          const preguntas = m.clases.reduce((n, c) => n + c.campos.length, 0);
          return (
            <li key={m.id} className="pg-mod">
              <button className="pg-cab" onClick={() => plegar(m.id)} aria-expanded={abierto}>
                <span className="chev" aria-hidden>{abierto ? '▾' : '▸'}</span>
                <span className="num">{m.numero}</span>
                <span className="tit">{m.titulo}</span>
                <span className="meta">{m.clases.length} clases · {preguntas} preguntas</span>
                <span className="tags">
                  <span className="fase">{FASE[m.fase] ?? m.fase}</span>
                  {m.quien !== 'dueño' && <Status tono="info">Lo contesta el líder del área</Status>}
                  {m.porArea && <Status tono="neutral">Se repite por área</Status>}
                </span>
              </button>

              {abierto && (
                <ul className="pg-clases">
                  {m.clases.map((c) => (
                    <li key={c.id}>
                      <button className="pg-clase" onClick={() => setClase(c)}>
                        <span className="r">{c.rotulo}</span>
                        <span className="t">
                          {c.titulo}
                          {c.destraba && <span className="destraba" title="De los cinco que destraban">⭐</span>}
                        </span>
                        <span className="q">{c.campos.length} {c.campos.length === 1 ? 'pregunta' : 'preguntas'}</span>
                        <span className="w">{c.enWhop ? <Status tono="good">En Whop</Status> : <Status tono="neutral">Falta cargar</Status>}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      {clase && (
        <Modal titulo={`${clase.rotulo} · ${clase.titulo}`} onCerrar={() => setClase(null)} ancho={780}>
          <p className="pg-res">{clase.pregunta}</p>
          {clase.atoro && (
            <p className="pg-atoro"><b>Ojo con esto.</b> {clase.atoro}</p>
          )}

          <h3 className="pg-h3">Lo que el cliente contesta</h3>
          {clase.campos.length === 0 ? (
            <p className="pg-vacio">Este bloque todavía no tiene formulario.</p>
          ) : (
            <ol className="pg-campos">
              {clase.campos.map((f) => (
                <li key={f.id}>
                  <div className="c-cab">
                    <span className="c-tipo">{TIPO[f.tipo]}</span>
                    <span className="c-origen" title="La pregunta del Cuestionario Maestro de la que sale">{f.origen}</span>
                    {f.obligatorio && <span className="c-obl">Obligatoria</span>}
                  </div>
                  <p className="c-label">{f.label}</p>
                  {f.ayuda && <p className="c-ayuda">{f.ayuda}</p>}

                  {f.opciones && (
                    <ul className="c-ops">{f.opciones.map((o, i) => <li key={i}>{o}</li>)}</ul>
                  )}

                  {f.columnas && (
                    <div className="mk-scroll-x">
                      <table className="c-tabla">
                        <thead><tr>{f.columnas.map((col, i) => <th key={i}>{col}</th>)}</tr></thead>
                        <tbody>
                          {(f.filasFijas ?? ['', '']).map((fila, i) => (
                            <tr key={i}>
                              {f.columnas!.map((_, j) => <td key={j}>{j === 0 ? fila : ''}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {f.filasMin && <p className="c-ayuda">Mínimo {f.filasMin} renglones.</p>}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Modal>
      )}

      <Toast state={toast} onClose={clear} />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Pagina>
  );
}

const CSS = `
.pg-intro{ font-size:14.5px; line-height:1.55; color:var(--ink-70); margin:2px 0 20px; }
.pg-mods{ list-style:none; margin:0; padding:0; }
.pg-mod{ border-bottom:1px solid var(--border); }
.pg-cab{ width:100%; display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  background:none; border:0; padding:14px 2px; text-align:left; font:inherit; cursor:pointer; }
.pg-cab:hover{ background:var(--ink-05, rgba(0,0,0,.03)); }
.pg-cab .chev{ color:var(--ink-40); width:12px; }
.pg-cab .num{ font-family:${MONO}; font-size:11px; letter-spacing:.1em; color:var(--ink-40);
  min-width:20px; }
.pg-cab .tit{ font-weight:650; font-size:15.5px; }
.pg-cab .meta{ font-family:${MONO}; font-size:11px; letter-spacing:.06em; color:var(--ink-40); }
.pg-cab .tags{ margin-left:auto; display:flex; gap:6px; align-items:center; flex-wrap:wrap; }
.pg-cab .fase{ font-family:${MONO}; font-size:10px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--ink-40); }
.pg-clases{ list-style:none; margin:0 0 10px; padding:0 0 0 26px; }
.pg-clase{ width:100%; display:flex; align-items:center; gap:12px; flex-wrap:wrap;
  background:none; border:0; border-top:1px solid var(--border); padding:11px 2px;
  text-align:left; font:inherit; cursor:pointer; }
.pg-clase:hover{ background:var(--ink-05, rgba(0,0,0,.03)); }
.pg-clase .r{ font-family:${MONO}; font-size:11px; color:var(--ink-40); min-width:30px; }
.pg-clase .t{ font-size:14.5px; flex:1; min-width:180px; }
.pg-clase .destraba{ margin-left:6px; }
.pg-clase .q{ font-family:${MONO}; font-size:10.5px; letter-spacing:.06em; color:var(--ink-40); }

.pg-res{ font-size:15.5px; line-height:1.55; margin:0 0 12px; }
.pg-atoro{ border-left:2px solid var(--lime-ink, var(--good)); padding:8px 0 8px 14px;
  margin:0 0 18px; font-size:14px; line-height:1.5; color:var(--ink-70); }
.pg-h3{ font-family:${MONO}; font-size:10.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--ink-40); margin:22px 0 12px; font-weight:600; }
.pg-vacio{ color:var(--ink-40); font-size:14px; }
.pg-campos{ list-style:none; margin:0; padding:0; counter-reset:c; }
.pg-campos > li{ padding:14px 0; border-top:1px solid var(--border); }
.c-cab{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:6px; }
.c-tipo{ font-family:${MONO}; font-size:10px; letter-spacing:.09em; text-transform:uppercase;
  color:var(--ink); background:var(--surface-2); border:1px solid var(--border-strong);
  border-radius:4px; padding:2px 6px; }
.c-origen{ font-family:${MONO}; font-size:10px; color:var(--ink-40); }
.c-obl{ font-family:${MONO}; font-size:10px; letter-spacing:.08em; color:var(--warn); }
.c-label{ font-size:15px; line-height:1.5; margin:0; }
.c-ayuda{ font-size:13px; line-height:1.5; color:var(--ink-40); margin:6px 0 0; }
.c-ops{ margin:8px 0 0; padding-left:18px; font-size:13.5px; line-height:1.6; color:var(--ink-70); }
.c-tabla{ width:100%; border-collapse:collapse; margin:10px 0 0; font-size:12.5px; }
.c-tabla th{ text-align:left; font-weight:600; padding:6px 9px; border:1px solid var(--border-strong);
  background:var(--surface-2); white-space:nowrap; }
.c-tabla td{ padding:9px; border:1px solid var(--border); color:var(--ink-70); }
`;
