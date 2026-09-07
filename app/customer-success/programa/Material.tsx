'use client';

// =============================================================================
// Tu material — el Banco de Skills leído entero, cruzado contra el programa
// =============================================================================
// LA PREGUNTA QUE CONTESTA: «mandé 1 GB de material, ¿cuánto me ahorra?».
//
// ⚠️ LA PRIMERA VERSIÓN DE ESTA PANTALLA ERA UN DOCUMENTO Y HUBO QUE TIRARLA.
// Tenía toda esta información en párrafos, uno abajo del otro: trece módulos con
// su prosa, cinco defectos con su prosa, siete tareas con su prosa. Todo cierto y
// todo ilegible — un muro de ~4.000 palabras que nadie lee, y menos el dueño de
// ese material, que lo abre para saber qué le falta grabar.
//
// LA REGLA QUE LA GOBIERNA AHORA: en reposo, esta pantalla no muestra NINGÚN
// párrafo salvo una frase. Todo lo demás son FILAS de una línea, y la prosa vive
// adentro de un <details>. El texto no se acortó: se escondió detrás de un click,
// que es distinto — compactar no es sacar.
//
// El test: alguien que la abre tiene que poder contestar «¿cuánto me falta?» y
// «¿qué hago primero?» sin scrollear y sin abrir nada.
//
// El orden es deliberado y NO es el de una auditoría. Una auditoría abre con los
// defectos y deja a Mauricio a la defensiva antes de llegar a lo útil:
//   1. el veredicto, en una frase y tres números
//   2. QUÉ HACER — lo accionable primero, porque es a lo que vino
//   3. los 13 módulos, una fila cada uno
//   4. lo que hay que arreglar antes de publicar
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
  PIEZAS_CLASE, MATERIAL_SUELTO,
  type NivelCobertura, type Cobertura, type Pieza,
} from '@/lib/banco-skills';

/** La palabra y el color de cada nivel. Una sola palabra: es una columna. */
const NIVEL: Record<NivelCobertura, { texto: string; clase: string }> = {
  clase: { texto: 'Cubierto', clase: 'ok' },
  parcial: { texto: 'A medias', clase: 'medio' },
  anexo: { texto: 'Solo apoyo', clase: 'apoyo' },
  nada: { texto: 'Nada', clase: 'cero' },
};

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
 * Es `<details>` nativo y no un `useState`: son 25 filas plegables y el estado de
 * cuál está abierta no le importa a nadie más. Además abre con Enter y se puede
 * buscar con Ctrl+F aunque esté cerrada, que es justo lo que hace falta cuando
 * Mauricio busca el nombre de un archivo.
 */
function Fila({ izq, medio, der, children }: {
  izq: ReactNode; medio: ReactNode; der?: ReactNode; children: ReactNode;
}) {
  return (
    <details className="fila">
      <summary>
        <span className="izq">{izq}</span>
        <span className="medio">{medio}</span>
        {der && <span className="der">{der}</span>}
        <span className="mas" aria-hidden />
      </summary>
      <div className="cuerpo">{children}</div>
    </details>
  );
}

export function Material() {
  const aGrabar = COBERTURA.filter(c => c.nivel !== 'clase').length;

  return (
    <div className="mat">
      {/* 1 · EL VEREDICTO. Una frase y tres números. Nada más entra acá. */}
      <section className="hero">
        <h2>No reemplaza tus clases.</h2>
        <ul className="nums">
          <li><b>{INVENTARIO.archivos}</b><span>archivos que mandaste</span></li>
          <li><b>{INVENTARIO.minutos}</b><span>minutos de video</span></li>
          <li className="bien"><b>{PIEZAS_CLASE.length}</b><span>sirven como clase</span></li>
          <li className="ojo"><b>{aGrabar}</b><span>módulos por grabar</span></li>
        </ul>

        <details className="porque">
          <summary>Por qué no reemplaza una clase</summary>
          <div>
            <p>
              Las 26 grabaciones explican un marco y cierran con una pregunta para pensar.
              <b> Ninguna termina en una tarea.</b> Las clases del programa sí: todas terminan
              en algo que el cliente arma sobre su propio negocio.
            </p>
            <p className="ej">
              «Empieza por el porqué» y la clase «El origen» hablan del mismo tema. La clase le
              pide al cliente que escriba <b>el suyo</b>. El video no.
            </p>
          </div>
        </details>
      </section>

      {/* 2 · QUÉ HACER. Va antes que el diagnóstico: es a lo que vino. */}
      <section className="bloque">
        <h3>Qué hacer <span className="n">{TAREAS.length}</span></h3>
        <div className="lista">
          {TAREAS.map((t, i) => (
            <Fila
              key={t.id}
              izq={<em className="num">{String(i + 1).padStart(2, '0')}</em>}
              medio={<b>{t.titulo}</b>}
              der={<em className="peso">{PESO[t.peso]}</em>}
            >
              <p>{t.porque}</p>
              <p className="listo"><b>Listo cuando:</b> {t.listoCuando}</p>
            </Fila>
          ))}
        </div>
      </section>

      {/* 3 · LOS MÓDULOS. Trece filas de una línea. */}
      <section className="bloque">
        <h3>Los módulos <span className="n">{COBERTURA.length}</span></h3>
        <div className="lista">
          {COBERTURA.map(c => <Modulo key={c.modulo} c={c} />)}
        </div>
      </section>

      {/* 4 · LO QUE HAY QUE ARREGLAR. */}
      <section className="bloque">
        <h3>Arreglar antes de publicarlo <span className="n">{DEFECTOS.length}</span></h3>
        <div className="lista">
          {DEFECTOS.map(d => (
            <Fila
              key={d.id}
              izq={<em className={`punto ${d.loVeElCliente ? 'rojo' : 'gris'}`} aria-hidden />}
              medio={<b>{d.titulo}</b>}
              der={d.loVeElCliente ? <em className="peso rojo">lo ve el cliente</em> : undefined}
            >
              <ul className="archivos">{d.archivos.map(a => <li key={a}>{a}</li>)}</ul>
              <p><b>Cómo lo sabemos.</b> {d.evidencia}</p>
              <p><b>Qué hacer.</b> {d.arreglo}</p>
            </Fila>
          ))}
        </div>
      </section>

      {/* 5 · Lo que no entra en ningún módulo, y los dos programas que no coinciden. */}
      <section className="bloque">
        <h3>Dos cosas más</h3>
        <div className="lista">
          <Fila
            izq={<em className="punto verde" aria-hidden />}
            medio={<b>Tienes un curso corto que no está en ningún módulo</b>}
            der={<em className="peso">{MATERIAL_SUELTO.archivos} archivos</em>}
          >
            <p><b>«{MATERIAL_SUELTO.titulo}»</b> — {MATERIAL_SUELTO.minutos} minutos.</p>
            <p>{MATERIAL_SUELTO.porQueEsUnaUnidad}</p>
            <p><b>Lo que proponemos.</b> {MATERIAL_SUELTO.propuesta}</p>
          </Fila>

          {DIVERGENCIA.length > 0 && (
            <Fila
              izq={<em className="punto rojo" aria-hidden />}
              medio={<b>Tu documento y la plataforma no numeran igual los módulos</b>}
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
        </div>
      </section>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** Un módulo: número, título, nivel y acción. Todo lo demás, plegado. */
function Modulo({ c }: { c: Cobertura }) {
  const m = MODULOS_DOC.find(x => x.numero === c.modulo);
  const n = NIVEL[c.nivel];

  return (
    <Fila
      izq={<em className="num">{String(c.modulo).padStart(2, '0')}</em>}
      medio={<>
        <b>{m?.titulo ?? `Módulo ${c.modulo}`}</b>
        <em className={`nivel ${n.clase}`}>{n.texto}</em>
      </>}
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
.mat{ padding:4px 0 80px; max-width:820px; }

/* ── 1 · El veredicto ─────────────────────────────────────────────────────── */
.mat .hero{ padding:14px 0 32px; }
.mat .hero h2{ margin:0; font-size:clamp(30px,5vw,46px); font-weight:700;
  letter-spacing:-.035em; line-height:1.05; }
.mat .nums{ list-style:none; display:flex; flex-wrap:wrap; gap:22px 44px; margin:30px 0 0; padding:0; }
.mat .nums b{ display:block; font-size:38px; font-weight:700; letter-spacing:-.04em;
  line-height:1; font-variant-numeric:tabular-nums; }
.mat .nums span{ display:block; margin-top:7px; font-size:12.5px; color:var(--dim); }
.mat .nums .bien b{ color:var(--good); }
.mat .nums .ojo b{ color:var(--mako-ink); }

/* El único párrafo de la pantalla, y arranca plegado. */
.mat .porque{ margin:30px 0 0; border-top:1px solid var(--border); }
.mat .porque > summary{ list-style:none; cursor:pointer; padding:15px 0 0; font-size:14px;
  color:var(--dim); display:flex; align-items:center; gap:8px; }
.mat .porque > summary::-webkit-details-marker{ display:none; }
.mat .porque > summary::after{ content:''; width:6px; height:6px; border-right:1.5px solid currentColor;
  border-bottom:1.5px solid currentColor; transform:rotate(45deg); margin-bottom:3px; }
.mat .porque[open] > summary::after{ transform:rotate(-135deg); margin-bottom:-2px; }
.mat .porque > summary:hover{ color:var(--ink); }
.mat .porque > div{ padding:6px 0 4px; }
.mat .porque p{ font-size:15.5px; line-height:1.65; color:var(--dim); margin:10px 0 0; max-width:66ch; }
.mat .porque b{ color:var(--ink); font-weight:650; }
.mat .porque .ej{ border-left:2px solid var(--mako); padding-left:15px; }

/* ── Los bloques ──────────────────────────────────────────────────────────── */
.mat .bloque{ margin:40px 0 0; }
.mat .bloque > h3{ display:flex; align-items:center; gap:9px; margin:0 0 4px;
  font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--faint); font-weight:600; }
.mat .bloque > h3 .n{ font-family:${MONO}; letter-spacing:0; font-size:10.5px;
  background:var(--surface-2); border-radius:20px; padding:2px 8px; }

/* ── La fila plegable ─────────────────────────────────────────────────────── */
.mat .lista{ border-top:1px solid var(--border); }
.mat .fila{ border-bottom:1px solid var(--border); }
.mat .fila > summary{ list-style:none; cursor:pointer; display:flex; align-items:center;
  gap:13px; padding:14px 4px; }
.mat .fila > summary::-webkit-details-marker{ display:none; }
.mat .fila > summary:hover{ background:var(--surface-2); }
.mat .fila > summary:focus-visible{ outline:2px solid var(--mako); outline-offset:-2px; }
.mat .fila .izq{ flex:none; display:flex; align-items:center; }
/* El título y su chip: es la columna que se lee. Nunca envuelve en tres renglones. */
.mat .fila .medio{ flex:1; min-width:0; display:flex; align-items:baseline; gap:10px;
  flex-wrap:wrap; }
.mat .fila .medio b{ font-size:15.5px; font-weight:600; letter-spacing:-.012em; }
.mat .fila .der{ flex:none; }
/* La flechita, a la derecha del todo y siempre en el mismo lugar. */
.mat .fila .mas{ flex:none; width:7px; height:7px; border-right:1.5px solid var(--faint);
  border-bottom:1.5px solid var(--faint); transform:rotate(-45deg); transition:transform .15s; }
.mat .fila[open] .mas{ transform:rotate(45deg); }

.mat .num{ font-family:${MONO}; font-style:normal; font-size:11.5px; color:var(--faint);
  font-variant-numeric:tabular-nums; min-width:20px; }
.mat .peso{ font-style:normal; font-size:12.5px; color:var(--faint); white-space:nowrap; }
.mat .peso.rojo{ color:var(--warn); }
/* El punto NUNCA es el único portador: al lado va siempre la palabra. */
.mat .punto{ width:8px; height:8px; border-radius:50%; display:block; }
.mat .punto.rojo{ background:var(--warn); }
.mat .punto.verde{ background:var(--good); }
.mat .punto.gris{ background:var(--border-strong); }

.mat .nivel{ font-style:normal; font-size:10.5px; letter-spacing:.07em; text-transform:uppercase;
  padding:2px 7px; border-radius:5px; white-space:nowrap; }
.mat .nivel.ok{ background:var(--good-bg,var(--surface-2)); color:var(--good); }
.mat .nivel.medio{ background:var(--mako-bg); color:var(--mako-ink); }
.mat .nivel.apoyo{ background:var(--surface-2); color:var(--dim); }
.mat .nivel.cero{ background:var(--surface-2); color:var(--warn); }

/* ── Lo que hay adentro de una fila ───────────────────────────────────────── */
.mat .cuerpo{ padding:4px 4px 22px 33px; max-width:70ch; }
.mat .cuerpo p{ font-size:14.5px; line-height:1.65; color:var(--dim); margin:0 0 11px; }
.mat .cuerpo p b{ color:var(--ink); }
.mat .cuerpo .rot{ font-size:10.5px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--faint); margin:16px 0 8px; }
.mat .cuerpo .rot:first-child{ margin-top:0; }
.mat .cuerpo .listo{ margin:14px 0 0; padding-top:12px; border-top:1px solid var(--border); }
.mat .cuerpo .alerta{ border-left:2px solid var(--mako); padding:2px 0 2px 14px; }

.mat .piezas{ list-style:none; margin:0; padding:0; }
.mat .piezas > li{ padding:11px 0; border-top:1px solid var(--border); }
.mat .piezas > li:first-child{ border-top:0; padding-top:0; }
.mat .piezas .a{ display:block; font-family:${MONO}; font-size:12.5px; line-height:1.45;
  color:var(--ink); word-break:break-word; }
.mat .piezas .a i{ font-style:normal; font-family:inherit; font-size:10px; letter-spacing:.06em;
  text-transform:uppercase; color:var(--good); }
.mat .piezas .f{ display:block; margin-top:3px; font-size:11px; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.mat .piezas .d{ display:block; margin-top:6px; font-size:14px; line-height:1.6; color:var(--dim); }

.mat .falta{ margin:0; padding-left:17px; font-size:14px; line-height:1.7; color:var(--dim); }
.mat .archivos{ list-style:none; margin:0 0 12px; padding:0; }
.mat .archivos li{ font-family:${MONO}; font-size:12px; color:var(--faint); line-height:1.6;
  word-break:break-word; }

.mat .cuerpo table{ width:100%; border-collapse:collapse; font-size:13px; }
.mat .cuerpo th{ text-align:left; font-weight:600; padding:6px 9px; white-space:nowrap;
  border:1px solid var(--border-strong); background:var(--surface-2); }
.mat .cuerpo td{ padding:7px 9px; border:1px solid var(--border); color:var(--dim); }
.mat .cuerpo td.c{ font-family:${MONO}; font-variant-numeric:tabular-nums; width:1%; }
.mat .cuerpo td i{ color:var(--faint); font-style:normal; }

@media(prefers-reduced-motion:reduce){ .mat .fila .mas{ transition:none; } }
`;
