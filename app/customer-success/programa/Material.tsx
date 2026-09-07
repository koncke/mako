'use client';

// =============================================================================
// Tu material — ¿alcanza para no grabar?
// =============================================================================
// ⚠️ LA PREGUNTA NO ES «QUÉ MANDÉ», ES «¿ME SALVO DE GRABAR?».
//
// Mauricio compartió su carpeta con una intención concreta y dicha en voz alta:
// evitarse grabar. Esta pantalla existe para contestar ESO, y por eso abre con
// la conclusión —no se puede— y con los tres motivos. Todo lo demás (el mapa,
// las listas, la evidencia) es respaldo de esa respuesta, no un informe.
//
// Se tiró tres veces por no entender esto:
//   · v1 — toda la prosa a la vista. Un informe de 3.400 palabras.
//   · v2 — filas plegables. Ordenado, pero texto chico y gris.
//   · v3 — titular enorme y un mapa de color. Ya se veía, pero el titular decía
//     «no reemplaza tus clases»: cierto, y no es lo que él preguntó. Y todo
//     flotaba sobre el fondo, sin nada que lo contuviera.
//
// LAS DOS REGLAS QUE LA GOBIERNAN:
//   1. Lo primero que se lee es la respuesta a lo que él preguntó, y debajo los
//      tres números que la prueban. Si eso no entra en la primera pantalla, la
//      pantalla está mal.
//   2. Nada flota: cada lista vive adentro de una CAJA. El fondo separa bloques,
//      la caja los agrupa — sin caja, catorce filas se leen como catorce cosas
//      sueltas en vez de como una sola lista.
//
// El color nunca es el único portador: cada bloque del mapa lleva su número, la
// referencia le pone palabra y cuenta a cada color, y la lista lo repite escrito.
//
// ⚠️ CADA AFIRMACIÓN LLEVA SU PRUEBA, aunque esté plegada. «Están duplicados» va
// con el md5; «trae otro cliente» va con la cita textual. Es material de otra
// persona y el que lo lee es su autor: una afirmación sin evidencia no es un dato
// flojo, es una discusión.
//
// Los datos salen de `lib/banco-skills.ts` y se importan DIRECTO en vez de
// bajarlos por props: son estáticos y no dependen del workspace, así que pasarlos
// por la página sería serializar el mismo objeto en cada request.

import type { ReactNode } from 'react';
import { MONO } from '@/app/_ui';
import {
  INVENTARIO, COBERTURA, DEFECTOS, TAREAS, MODULOS_DOC, DIVERGENCIA,
  MATERIAL_SUELTO,
  type NivelCobertura, type Cobertura, type Pieza,
} from '@/lib/banco-skills';

/** La palabra y el color de cada nivel. El color nunca viaja solo. */
const NIVEL: Record<NivelCobertura, { texto: string; clase: string }> = {
  clase: { texto: 'Cubierto', clase: 'ok' },
  parcial: { texto: 'A medias', clase: 'medio' },
  anexo: { texto: 'Solo apoyo', clase: 'apoyo' },
  nada: { texto: 'Nada', clase: 'cero' },
};

/** El orden de la referencia: de peor a mejor, que es como se lee el mapa. */
const ORDEN: NivelCobertura[] = ['nada', 'anexo', 'parcial', 'clase'];

const PESO: Record<'chico' | 'medio' | 'grande', string> = {
  chico: 'un rato', medio: 'media mañana', grande: 'un día',
};

function formatoDe(p: Pieza): string {
  return p.formato.tipo === 'video'
    ? `Video · ${p.formato.minutos} min`
    : `Documento · ${p.formato.palabras.toLocaleString('es')} palabras`;
}

/**
 * La fila plegable: TODA la prosa de esta pantalla vive acá adentro.
 *
 * Es `<details>` nativo y no un `useState`: son 27 filas, el estado de cuál está
 * abierta no le importa a nadie más, abre con Enter, y Ctrl+F encuentra el nombre
 * de un archivo aunque la fila esté plegada — que es justo como se busca acá.
 */
function Fila({ izq, titulo, chip, der, children }: {
  izq: ReactNode; titulo: ReactNode; chip?: ReactNode; der?: ReactNode; children: ReactNode;
}) {
  return (
    <details className="fila">
      <summary>
        <span className="izq">{izq}</span>
        <span className="tit">
          <b>{titulo}</b>
          {chip}
        </span>
        {der && <span className="der">{der}</span>}
        <span className="mas" aria-hidden />
      </summary>
      <div className="cuerpo">{children}</div>
    </details>
  );
}

/** Un bloque = un rótulo afuera y una CAJA con la lista adentro. */
function Bloque({ titulo, cuenta, encabezado, children }: {
  titulo: string; cuenta?: number; encabezado?: ReactNode; children: ReactNode;
}) {
  return (
    <section className="bloque">
      <h3>{titulo}{cuenta !== undefined && <span className="n">{cuenta}</span>}</h3>
      <div className="caja">
        {encabezado}
        <div className="lista">{children}</div>
      </div>
    </section>
  );
}

export function Material() {
  const cuenta = (n: NivelCobertura) => COBERTURA.filter(c => c.nivel === n).length;
  const aGrabar = COBERTURA.filter(c => c.nivel !== 'clase').length;

  return (
    <div className="mat">
      {/* 1 · LA RESPUESTA A SU PREGUNTA. Nada más entra acá arriba. */}
      <section className="hero">
        <h2>No te vas a poder<br />evitar grabar.</h2>
        <p className="baja">
          Leímos enteras las {INVENTARIO.videos} grabaciones y los {INVENTARIO.documentos}{' '}
          documentos de tu carpeta. Sirven de lectura de apoyo; no reemplazan una clase.
        </p>

        <ul className="razones">
          <li>
            <b>0</b>
            <span>
              de tus {INVENTARIO.videos} grabaciones termina en una tarea. Explican un marco;
              tus clases piden que el cliente arme algo sobre su negocio.
            </span>
          </li>
          <li>
            <b>{cuenta('anexo')}</b>
            <span>
              de los {COBERTURA.length} módulos quedan igual: hay material para colgar de
              lectura, pero ninguna clase.
            </span>
          </li>
          <li className="ojo">
            <b>{aGrabar}</b>
            <span>
              módulos hay que grabar de todos modos. Con la carpeta te ahorras contenido de
              apoyo, no grabaciones.
            </span>
          </li>
        </ul>
      </section>

      {/* 2 · QUÉ HACER. Lo accionable antes que el diagnóstico. */}
      <Bloque titulo="Qué hacer" cuenta={TAREAS.length}>
        {TAREAS.map((t, i) => (
          <Fila
            key={t.id}
            izq={<em className="num">{String(i + 1).padStart(2, '0')}</em>}
            titulo={t.titulo}
            der={<em className="peso">{PESO[t.peso]}</em>}
          >
            <p>{t.porque}</p>
            <p className="listo"><b>Listo cuando:</b> {t.listoCuando}</p>
          </Fila>
        ))}
      </Bloque>

      {/* 3 · LOS MÓDULOS, con el mapa como encabezado de su propia caja: el mapa
          y la lista dicen lo mismo, así que van juntos y no separados. */}
      <Bloque
        titulo="Módulo por módulo"
        cuenta={COBERTURA.length}
        encabezado={
          <div className="cab-mapa">
            <div className="mapa" role="img"
              aria-label={`Los ${COBERTURA.length} módulos por nivel: ${ORDEN
                .filter(n => cuenta(n) > 0)
                .map(n => `${cuenta(n)} ${NIVEL[n].texto}`).join(', ')}.`}>
              {COBERTURA.map(c => (
                <span key={c.modulo} className={`celda n-${NIVEL[c.nivel].clase}`}>
                  {String(c.modulo).padStart(2, '0')}
                </span>
              ))}
            </div>
            <ul className="refs">
              {ORDEN.filter(n => cuenta(n) > 0).map(n => (
                <li key={n}>
                  <i className={`sw n-${NIVEL[n].clase}`} aria-hidden />
                  <b>{cuenta(n)}</b> {NIVEL[n].texto.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>
        }
      >
        {COBERTURA.map(c => <Modulo key={c.modulo} c={c} />)}
      </Bloque>

      {/* 4 y 5 · Los dos bloques cortos comparten renglón en pantallas anchas. */}
      <div className="par">
        <Bloque titulo="Arreglar antes de publicarlo" cuenta={DEFECTOS.length}>
          {DEFECTOS.map(d => (
            <Fila
              key={d.id}
              izq={<em className={`punto ${d.loVeElCliente ? 'rojo' : 'gris'}`} aria-hidden />}
              titulo={d.titulo}
              der={d.loVeElCliente ? <em className="peso rojo">lo ve el cliente</em> : undefined}
            >
              <ul className="archivos">{d.archivos.map(a => <li key={a}>{a}</li>)}</ul>
              <p><b>Cómo lo sabemos.</b> {d.evidencia}</p>
              <p><b>Qué hacer.</b> {d.arreglo}</p>
            </Fila>
          ))}
        </Bloque>

        <Bloque titulo="Dos cosas más">
          <Fila
            izq={<em className="punto verde" aria-hidden />}
            titulo="Tienes un curso corto que no está en ningún módulo"
            der={<em className="peso">{MATERIAL_SUELTO.archivos} archivos</em>}
          >
            <p><b>«{MATERIAL_SUELTO.titulo}»</b> — {MATERIAL_SUELTO.minutos} minutos.</p>
            <p>{MATERIAL_SUELTO.porQueEsUnaUnidad}</p>
            <p><b>Lo que proponemos.</b> {MATERIAL_SUELTO.propuesta}</p>
          </Fila>

          {DIVERGENCIA.length > 0 && (
            <Fila
              izq={<em className="punto rojo" aria-hidden />}
              titulo="Tu documento y la plataforma no numeran igual los módulos"
              der={<em className="peso rojo">{DIVERGENCIA.length} no coinciden</em>}
            >
              <p>
                Desde el módulo {DIVERGENCIA[0]?.numero}, un mismo número nombra dos cosas
                distintas. Los módulos de arriba son los de <b>tu documento</b>.
              </p>
              <div className="mk-scroll-x">
                <table>
                  <thead>
                    <tr><th>Nº</th><th>En tu documento</th><th>En la plataforma</th></tr>
                  </thead>
                  <tbody>
                    {DIVERGENCIA.map(d => (
                      <tr key={d.numero}>
                        <td className="c">{d.numero}</td>
                        <td>{d.enDocumento ?? <i>no existe</i>}</td>
                        <td>{d.enPlataforma ?? <i>no existe</i>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Fila>
          )}
        </Bloque>
      </div>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** Un módulo: el mismo color del mapa, el título y la acción. */
function Modulo({ c }: { c: Cobertura }) {
  const m = MODULOS_DOC.find(x => x.numero === c.modulo);
  const n = NIVEL[c.nivel];

  return (
    <Fila
      izq={<em className={`chapa n-${n.clase}`}>{String(c.modulo).padStart(2, '0')}</em>}
      titulo={m?.titulo ?? `Módulo ${c.modulo}`}
      chip={<em className={`nivel n-${n.clase}`}>{n.texto}</em>}
      der={<em className="peso">{c.accion}</em>}
    >
      {c.piezas.length > 0 && (
        <>
          <p className="rot">Lo que ya tienes</p>
          <ul className="piezas">
            {c.piezas.map(p => (
              <li key={p.archivo}>
                <span className="a">{p.archivo}{p.esClase && <i> · sirve como clase</i>}</span>
                <span className="f">{formatoDe(p)}</span>
                <span className="d">{p.aporta}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {c.falta.length > 0 && (
        <>
          <p className="rot">Lo que no está en ningún material</p>
          <ul className="falta">{c.falta.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </>
      )}
      {c.ojo && <p className="alerta"><b>Ojo con esto.</b> {c.ojo}</p>}
      <p className="listo"><b>Qué hacer:</b> {c.tarea}</p>
    </Fila>
  );
}

const CSS = `
.mat{ padding:8px 0 110px;
  /* Los cuatro colores, en un solo lugar: los usan el bloque del mapa, la chapa
     de cada fila, la referencia y el chip. Si se tocan acá se mueven los cuatro
     a la vez y no pueden quedar diciendo cosas distintas. */
  --n-cero:var(--warn); --n-apoyo:#a3a9b4; --n-medio:var(--mako); --n-ok:var(--good); }

/* ── 1 · La respuesta ─────────────────────────────────────────────────────── */
.mat .hero{ padding:22px 0 6px; }
.mat .hero h2{ margin:0; font-size:clamp(40px,6.2vw,68px); font-weight:800;
  letter-spacing:-.045em; line-height:.98; max-width:15ch; }
.mat .baja{ margin:22px 0 0; font-size:18px; line-height:1.55; color:var(--dim); max-width:54ch; }

/* Los tres motivos son LA prueba de la respuesta de arriba, así que van en cajas
   y no sueltos: un número flotando se lee como decoración. */
.mat .razones{ list-style:none; display:grid; gap:14px; margin:34px 0 0; padding:0;
  grid-template-columns:1fr; }
@media(min-width:900px){ .mat .razones{ grid-template-columns:repeat(3,1fr); } }
.mat .razones > li{ background:var(--surface); border:1px solid var(--border);
  border-radius:16px; padding:24px 24px 26px; }
.mat .razones b{ display:block; font-size:52px; font-weight:800; letter-spacing:-.05em;
  line-height:1; font-variant-numeric:tabular-nums; }
.mat .razones span{ display:block; margin-top:14px; font-size:15px; line-height:1.55;
  color:var(--dim); }
.mat .razones .ojo{ border-color:var(--mako); }
.mat .razones .ojo b{ color:var(--mako-ink); }

/* ── Los bloques: rótulo afuera, caja adentro ─────────────────────────────── */
.mat .bloque{ margin:54px 0 0; }
.mat .bloque > h3{ display:flex; align-items:center; gap:11px; margin:0 0 13px; padding-left:2px;
  font-size:12px; letter-spacing:.16em; text-transform:uppercase; color:var(--faint); font-weight:700; }
.mat .bloque > h3 .n{ font-family:${MONO}; letter-spacing:0; font-size:11px;
  background:var(--surface-2); border-radius:20px; padding:3px 9px; }
/* LA CAJA. Sin esto las filas flotan sobre el fondo y catorce se leen como
   catorce cosas sueltas en vez de como una sola lista. */
.mat .caja{ background:var(--surface); border:1px solid var(--border); border-radius:18px;
  overflow:hidden; }

/* El mapa vive DENTRO de la caja de su lista, como encabezado. */
.mat .cab-mapa{ padding:22px 22px 20px; border-bottom:1px solid var(--border); }
.mat .mapa{ display:flex; gap:6px; }
.mat .mapa .celda{ flex:1; height:52px; border-radius:8px; display:flex; align-items:center;
  justify-content:center; font-family:${MONO}; font-size:13px; font-weight:600;
  font-variant-numeric:tabular-nums; color:#fff; }
.mat .mapa .celda.n-cero{ background:var(--n-cero); }
.mat .mapa .celda.n-apoyo{ background:var(--n-apoyo); }
.mat .mapa .celda.n-medio{ background:var(--n-medio); }
.mat .mapa .celda.n-ok{ background:var(--n-ok); }
.mat .refs{ list-style:none; display:flex; flex-wrap:wrap; gap:8px 22px; margin:14px 0 0; padding:0; }
.mat .refs li{ display:flex; align-items:center; gap:7px; font-size:13.5px; color:var(--dim); }
.mat .refs b{ color:var(--ink); font-variant-numeric:tabular-nums; }
.mat .sw{ width:12px; height:12px; border-radius:4px; display:block; }
.mat .sw.n-cero{ background:var(--n-cero); }
.mat .sw.n-apoyo{ background:var(--n-apoyo); }
.mat .sw.n-medio{ background:var(--n-medio); }
.mat .sw.n-ok{ background:var(--n-ok); }

/* Los dos bloques cortos comparten renglón en pantallas anchas. */
.mat .par{ display:grid; grid-template-columns:1fr; gap:0 30px; }
@media(min-width:1120px){
  .mat .par{ grid-template-columns:1fr 1fr; align-items:start; }
  .mat .par .bloque{ margin-top:54px; }
}

/* ── La fila ──────────────────────────────────────────────────────────────── */
.mat .fila + .fila{ border-top:1px solid var(--border); }
.mat .fila > summary{ list-style:none; cursor:pointer; display:flex; align-items:center;
  gap:17px; padding:19px 22px; }
.mat .fila > summary::-webkit-details-marker{ display:none; }
.mat .fila > summary:hover{ background:var(--surface-2); }
.mat .fila > summary:focus-visible{ outline:2px solid var(--mako); outline-offset:-2px; }
.mat .fila[open] > summary{ background:var(--surface-2); }
.mat .fila .izq{ flex:none; display:flex; align-items:center; }
.mat .fila .tit{ flex:1; min-width:0; display:flex; align-items:center; gap:11px; flex-wrap:wrap; }
.mat .fila .tit b{ font-size:18px; font-weight:650; letter-spacing:-.022em; line-height:1.3; }
.mat .fila .der{ flex:none; }
.mat .fila .mas{ flex:none; width:8px; height:8px; border-right:2px solid var(--faint);
  border-bottom:2px solid var(--faint); transform:rotate(-45deg); transition:transform .15s; }
.mat .fila[open] .mas{ transform:rotate(45deg); }

.mat .num{ font-family:${MONO}; font-style:normal; font-size:13px; color:var(--faint);
  font-variant-numeric:tabular-nums; min-width:22px; }
/* La chapa lleva el MISMO color que su bloque en el mapa, para que la lista se
   lea como la continuación del mapa y no como otra cosa. */
.mat .chapa{ font-family:${MONO}; font-style:normal; font-size:12px; color:#fff;
  font-variant-numeric:tabular-nums; width:32px; height:32px; border-radius:8px;
  display:flex; align-items:center; justify-content:center; font-weight:600; }
.mat .chapa.n-cero{ background:var(--n-cero); }
.mat .chapa.n-apoyo{ background:var(--n-apoyo); }
.mat .chapa.n-medio{ background:var(--n-medio); }
.mat .chapa.n-ok{ background:var(--n-ok); }

.mat .peso{ font-style:normal; font-size:14px; color:var(--dim); white-space:nowrap; }
.mat .peso.rojo{ color:var(--warn); }
/* El punto NUNCA es el único portador: al lado va siempre la palabra. */
.mat .punto{ width:11px; height:11px; border-radius:50%; display:block; margin:0 10px; }
.mat .punto.rojo{ background:var(--warn); }
.mat .punto.verde{ background:var(--good); }
.mat .punto.gris{ background:var(--n-apoyo); }

.mat .nivel{ font-style:normal; font-size:10.5px; letter-spacing:.09em; text-transform:uppercase;
  font-weight:700; padding:3px 8px; border-radius:5px; white-space:nowrap; color:#fff; }
.mat .nivel.n-cero{ background:var(--n-cero); }
.mat .nivel.n-apoyo{ background:var(--n-apoyo); }
.mat .nivel.n-medio{ background:var(--n-medio); }
.mat .nivel.n-ok{ background:var(--n-ok); }

/* ── Lo que hay adentro de una fila ───────────────────────────────────────── */
.mat .cuerpo{ padding:2px 24px 26px 61px; max-width:70ch; }
.mat .cuerpo p{ font-size:15.5px; line-height:1.7; color:var(--dim); margin:0 0 13px; }
.mat .cuerpo p b{ color:var(--ink); }
.mat .cuerpo .rot{ font-size:11px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--faint); font-weight:700; margin:20px 0 9px; }
.mat .cuerpo .rot:first-child{ margin-top:0; }
.mat .cuerpo .listo{ margin:18px 0 0; padding-top:15px; border-top:1px solid var(--border); }
.mat .cuerpo .alerta{ border-left:3px solid var(--mako); padding:4px 0 4px 16px; }

.mat .piezas{ list-style:none; margin:0; padding:0; }
.mat .piezas > li{ padding:14px 0; border-top:1px solid var(--border); }
.mat .piezas > li:first-child{ border-top:0; padding-top:0; }
.mat .piezas .a{ display:block; font-family:${MONO}; font-size:13px; line-height:1.5;
  color:var(--ink); word-break:break-word; }
.mat .piezas .a i{ font-style:normal; font-family:inherit; font-size:10.5px; letter-spacing:.07em;
  text-transform:uppercase; color:var(--good); font-weight:700; }
.mat .piezas .f{ display:block; margin-top:4px; font-size:11.5px; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.mat .piezas .d{ display:block; margin-top:7px; font-size:15px; line-height:1.65; color:var(--dim); }

.mat .falta{ margin:0; padding-left:19px; font-size:15px; line-height:1.8; color:var(--dim); }
.mat .archivos{ list-style:none; margin:0 0 15px; padding:0; }
.mat .archivos li{ font-family:${MONO}; font-size:12.5px; color:var(--faint); line-height:1.7;
  word-break:break-word; }

.mat .cuerpo table{ width:100%; border-collapse:collapse; font-size:13.5px; }
.mat .cuerpo th{ text-align:left; font-weight:600; padding:7px 10px; white-space:nowrap;
  border:1px solid var(--border-strong); background:var(--surface-2); }
.mat .cuerpo td{ padding:8px 10px; border:1px solid var(--border); color:var(--dim); }
.mat .cuerpo td.c{ font-family:${MONO}; font-variant-numeric:tabular-nums; width:1%; }
.mat .cuerpo td i{ color:var(--faint); font-style:normal; }

@media(max-width:720px){
  .mat .mapa{ flex-wrap:wrap; }
  .mat .mapa .celda{ flex:1 1 12%; height:44px; }
  .mat .fila > summary{ gap:13px; padding:17px 16px; }
  .mat .fila .tit b{ font-size:16.5px; }
  .mat .cuerpo{ padding:2px 16px 22px 16px; }
  .mat .cab-mapa{ padding:16px; }
}
@media(prefers-reduced-motion:reduce){ .mat .fila .mas{ transition:none; } }
`;
