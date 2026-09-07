'use client';

// =============================================================================
// Tu material — el Banco de Skills leído entero, cruzado contra el programa
// =============================================================================
// LA PREGUNTA QUE CONTESTA: «mandé 1 GB de material, ¿cuánto me ahorra?».
//
// La respuesta honesta es «poco», y por eso el orden de la pantalla NO es el de
// una auditoría. Una auditoría abre con los defectos y deja a Mauricio a la
// defensiva antes de llegar a lo útil. Acá el orden es:
//
//   1. el veredicto en una frase, sin rodeos
//   2. POR QUÉ, con el ejemplo concreto (Sinek contra «El origen»)
//   3. lo que SÍ sirve, y es más de lo que parece
//   4. módulo por módulo, para que sepa dónde parar de grabar
//   5. lo que hay que arreglar, con la prueba de cada cosa
//   6. las tareas, en orden
//
// ⚠️ CADA AFIRMACIÓN LLEVA SU PRUEBA. «Están duplicados» no se sostiene solo:
// va con el md5. «Trae otro cliente» va con la cita textual. Es material de otra
// persona y el que lo lee es su autor — una afirmación sin evidencia acá no es
// un dato flojo, es una discusión.
//
// Los datos salen de `lib/banco-skills.ts` y se importan DIRECTO en vez de
// bajarlos por props: son estáticos y no dependen del workspace, así que
// pasarlos por la página sería serializar el mismo objeto en cada request.

import { Status, Banner, MONO } from '@/app/_ui';
import {
  INVENTARIO, COBERTURA, DEFECTOS, TAREAS, MODULOS_DOC, DIVERGENCIA,
  PIEZAS_CLASE, MATERIAL_SUELTO,
  type NivelCobertura, type Cobertura, type Pieza,
} from '@/lib/banco-skills';

/** Cómo se nombra y se pinta cada nivel. La palabra es lo que lee Mauricio. */
const NIVEL: Record<NivelCobertura, { texto: string; tono: 'good' | 'mako' | 'info' | 'warn' }> = {
  clase: { texto: 'Cubre clases', tono: 'good' },
  parcial: { texto: 'Cubre una parte', tono: 'mako' },
  anexo: { texto: 'Sirve de apoyo', tono: 'info' },
  nada: { texto: 'Sin material', tono: 'warn' },
};

const PESO: Record<'chico' | 'medio' | 'grande', string> = {
  chico: 'Rato corto', medio: 'Media mañana', grande: 'Un día',
};

/** El formato de una pieza, en las palabras en que Mauricio piensa el material. */
function formatoDe(p: Pieza): string {
  return p.formato.tipo === 'video'
    ? `Video · ${p.formato.minutos} min`
    : `Documento · ${p.formato.palabras.toLocaleString('es')} palabras`;
}

export function Material() {
  const enCero = COBERTURA.filter(c => c.nivel === 'nada');
  const conApoyo = COBERTURA.filter(c => c.nivel === 'anexo');
  const destraban = COBERTURA.filter(c => c.nivel === 'parcial' || c.nivel === 'clase');

  return (
    <div className="mat">
      {/* 1 · El veredicto. Va primero y va entero: enterarse de esto en el
          renglón catorce sería peor. */}
      <section className="mat-vered">
        <p className="chapeau">Lo leímos todo: las 26 grabaciones y los 35 documentos</p>
        <h2>
          El banco no reemplaza las clases del programa. Pero tiene material de apoyo para
          los {COBERTURA.length} módulos, {PIEZAS_CLASE.length} piezas que sí funcionan como
          clase y un curso corto entero que hoy está suelto.
        </h2>
        <ul className="cifras">
          <li><b>{INVENTARIO.archivos}</b><span>archivos</span></li>
          <li>
            <b>{INVENTARIO.videosUnicos}</b>
            <span>grabaciones distintas{INVENTARIO.videos !== INVENTARIO.videosUnicos && ` (de ${INVENTARIO.videos} archivos)`}</span>
          </li>
          <li><b>{INVENTARIO.minutos}</b><span>minutos de video</span></li>
          <li><b>{INVENTARIO.documentos}</b><span>documentos</span></li>
        </ul>
      </section>

      {/* 2 · El porqué. Un solo argumento, con un ejemplo que se entiende sin
          contexto. Si esto no se entiende, el resto de la pantalla es ruido. */}
      <section className="mat-bloque">
        <h3>Por qué no reemplaza una clase</h3>
        <p className="p">
          Las 26 grabaciones tienen la misma forma: explican un marco —4DX, OKRs, las cinco
          disfunciones, el círculo dorado— y cierran con una pregunta para pensar.{' '}
          <b>Ninguna termina en una tarea.</b>
        </p>
        <p className="p">
          Las clases del programa sí: todas terminan en algo que el cliente produce sobre su
          propio negocio. La ficha de números con líneas base. El organigrama real con
          semáforo. Cada palanca con su umbral y su evidencia.
        </p>
        <p className="ejemplo">
          El video de <b>«Empieza por el porqué»</b> y la clase <b>«El origen»</b> hablan del
          mismo tema. La diferencia es que la clase le pide al cliente que escriba{' '}
          <b>el suyo</b>, y el video no. Es la misma materia y distinto objeto — por eso el
          banco se cuelga de los módulos como lectura, y no baja la lista de grabación.
        </p>
      </section>

      {/* 3 · Lo que SÍ sirve. Va antes de los defectos a propósito. */}
      {PIEZAS_CLASE.length > 0 && (
        <section className="mat-bloque">
          <h3>Lo que sí sirve como clase</h3>
          <p className="p">
            Son {PIEZAS_CLASE.length}, y no son las que llevan el nombre de un libro famoso:
            son las que escribiste como procedimiento y no como concepto.
          </p>
          <ul className="mat-piezas destaca">
            {PIEZAS_CLASE.map(p => (
              <li key={p.archivo}>
                <p className="arch">{p.archivo}</p>
                <p className="fmt">{formatoDe(p)}</p>
                <p className="ap">{p.aporta}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* La numeración de los dos programas no coincide, y eso hay que verlo
          ANTES de la lista por módulo — si no, los números de abajo confunden. */}
      {DIVERGENCIA.length > 0 && (
        <section className="mat-bloque">
          <Banner tono="warn">
            El programa del documento que mandaste tiene {MODULOS_DOC.length} módulos y el que
            está cargado en la plataforma tiene {MODULOS_DOC.length - DIVERGENCIA.filter(d => !d.enPlataforma).length}.
            Desde el módulo {DIVERGENCIA[0]?.numero} un mismo número nombra dos cosas distintas.
            Los módulos de abajo son los <b>del documento</b>.
          </Banner>
          <div className="mk-scroll-x">
            <table className="mat-tabla">
              <thead>
                <tr><th>Módulo</th><th>En tu documento</th><th>En la plataforma hoy</th></tr>
              </thead>
              <tbody>
                {DIVERGENCIA.map(d => (
                  <tr key={d.numero}>
                    <td className="n">{d.numero}</td>
                    <td>{d.enDocumento ?? <em>no existe</em>}</td>
                    <td>{d.enPlataforma ?? <em>no existe</em>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 4 · Módulo por módulo. Es la parte larga y la que se vuelve a mirar. */}
      <section className="mat-bloque">
        <h3>Módulo por módulo</h3>
        <p className="p resumen">
          {destraban.length > 0 && <><b>{destraban.length}</b> tienen material que ahorra grabación. </>}
          {conApoyo.length > 0 && <><b>{conApoyo.length}</b> tienen lecturas de apoyo, pero hay que grabarlos igual. </>}
          {enCero.length > 0 && <><b>{enCero.length}</b> no tienen nada. </>}
          Ninguno queda cubierto entero.
        </p>
        <ol className="mat-mods">
          {COBERTURA.map(c => <li key={c.modulo}><Modulo c={c} /></li>)}
        </ol>
      </section>

      {/* Lo que no cuelga de ningún módulo. Va como propuesta y no como sobrante:
          es de lo mejor grabado del banco y hoy no lo encuentra nadie. */}
      <section className="mat-bloque">
        <h3>Un curso corto que ya tienes y no está en ningún módulo</h3>
        <div className="mat-suelto">
          <p className="tit">«{MATERIAL_SUELTO.titulo}»</p>
          <p className="fmt">
            {MATERIAL_SUELTO.archivos} archivos · {MATERIAL_SUELTO.minutos} minutos de video
          </p>
          <p className="ap">{MATERIAL_SUELTO.porQueEsUnaUnidad}</p>
          <p className="ap"><b>Lo que proponemos.</b> {MATERIAL_SUELTO.propuesta}</p>
        </div>
      </section>

      {/* 5 · Los defectos, cada uno con su prueba. */}
      <section className="mat-bloque">
        <h3>Lo que hay que arreglar antes de publicarlo</h3>
        <p className="p">
          Esto no tiene que ver con grabar y es más urgente: si el banco se sube a Whop tal
          como está, un cliente tuyo abre el material y ve estas cosas.
        </p>
        <ul className="mat-def">
          {DEFECTOS.map(d => (
            <li key={d.id}>
              <div className="cab">
                <h4>{d.titulo}</h4>
                {d.loVeElCliente
                  ? <Status tono="warn">Lo ve el cliente</Status>
                  : <Status tono="neutral">Interno</Status>}
              </div>
              <ul className="archivos">
                {d.archivos.map(a => <li key={a}>{a}</li>)}
              </ul>
              <p className="ev"><b>Cómo lo sabemos.</b> {d.evidencia}</p>
              <p className="ar"><b>Qué hacer.</b> {d.arreglo}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 6 · Las tareas. Cierra la pantalla porque es lo que se lleva. */}
      <section className="mat-bloque">
        <h3>Lo que queda por hacer, en orden</h3>
        <ol className="mat-tareas">
          {TAREAS.map((t, i) => (
            <li key={t.id}>
              <span className="n" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              <div className="in">
                <div className="cab">
                  <h4>{t.titulo}</h4>
                  <Status tono="neutral">{PESO[t.peso]}</Status>
                </div>
                <p className="pq">{t.porque}</p>
                <p className="lc"><b>Está listo cuando:</b> {t.listoCuando}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

/** Un módulo: el nivel, con qué se cubre, qué falta y qué hay que hacer. */
function Modulo({ c }: { c: Cobertura }) {
  const m = MODULOS_DOC.find(x => x.numero === c.modulo);
  const n = NIVEL[c.nivel];

  return (
    <article className={`mat-mod n-${c.nivel}`}>
      <header>
        <span className="rot">Módulo {c.modulo}</span>
        <h4>{m?.titulo ?? `Módulo ${c.modulo}`}</h4>
        <Status tono={n.tono}>{n.texto}</Status>
      </header>

      {c.piezas.length > 0 && (
        <ul className="mat-piezas">
          {c.piezas.map(p => (
            <li key={p.archivo}>
              <p className="arch">
                {p.archivo}
                {p.esClase && <span className="marca">sirve como clase</span>}
              </p>
              <p className="fmt">{formatoDe(p)}</p>
              <p className="ap">{p.aporta}</p>
            </li>
          ))}
        </ul>
      )}

      {c.falta.length > 0 && (
        <div className="falta">
          <p className="tit">Lo que no está en ningún material</p>
          <ul>{c.falta.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}

      {/* La advertencia va DESPUÉS de las piezas y antes de la tarea: es sobre
          material que parece de este módulo, así que solo se entiende habiendo
          visto lo que sí cuelga. */}
      {c.ojo && <p className="ojo"><b>Ojo con esto.</b> {c.ojo}</p>}

      <p className="tarea"><b>Qué hacer.</b> {c.tarea}</p>
    </article>
  );
}

const CSS = `
.mat{ padding:8px 0 70px; max-width:76ch; }

/* ── El veredicto ─────────────────────────────────────────────────────────── */
.mat-vered{ padding:0 0 30px; border-bottom:1px solid var(--border); }
.mat-vered .chapeau{ font-family:${MONO}; font-size:10.5px; letter-spacing:.11em;
  text-transform:uppercase; color:var(--faint); margin:0 0 12px; }
.mat-vered h2{ font-size:clamp(21px,3.1vw,27px); font-weight:700; letter-spacing:-.028em;
  line-height:1.28; margin:0; }
.mat-vered .cifras{ list-style:none; display:flex; flex-wrap:wrap; gap:26px 38px;
  margin:26px 0 0; padding:0; }
.mat-vered .cifras b{ display:block; font-size:27px; font-weight:700; letter-spacing:-.03em;
  line-height:1; font-variant-numeric:tabular-nums; }
.mat-vered .cifras span{ display:block; margin-top:5px; font-size:12.5px; color:var(--dim); }

/* ── Bloques ──────────────────────────────────────────────────────────────── */
.mat-bloque{ margin:34px 0 0; }
.mat-bloque > h3{ font-size:10.5px; letter-spacing:.11em; text-transform:uppercase;
  color:var(--faint); font-weight:600; margin:0 0 14px; }
.mat .p{ font-size:15.5px; line-height:1.65; color:var(--dim); margin:0 0 12px; }
.mat .p b{ color:var(--ink); font-weight:650; }
.mat .p.resumen{ font-variant-numeric:tabular-nums; }
/* El ejemplo es la pieza que hace entender todo lo demás: se separa del cuerpo
   para que no se lea como un párrafo más. */
.mat .ejemplo{ font-size:15.5px; line-height:1.65; color:var(--dim); margin:18px 0 0;
  border-left:2px solid var(--mako); padding:2px 0 2px 16px; }
.mat .ejemplo b{ color:var(--ink); font-weight:650; }

/* ── Las piezas del banco ─────────────────────────────────────────────────── */
.mat-piezas{ list-style:none; margin:0; padding:0; }
.mat-piezas > li{ padding:13px 0; border-top:1px solid var(--border); }
.mat-piezas > li:first-child{ border-top:0; }
.mat-piezas .arch{ margin:0; font-size:13px; font-family:${MONO}; line-height:1.45;
  color:var(--ink); word-break:break-word; }
.mat-piezas .marca{ display:inline-block; margin-left:8px; font-family:inherit; font-size:10px;
  letter-spacing:.06em; text-transform:uppercase; color:var(--good); }
.mat-piezas .fmt{ margin:4px 0 0; font-size:11.5px; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.mat-piezas .ap{ margin:7px 0 0; font-size:14.5px; line-height:1.6; color:var(--dim); }
/* Las dos piezas que sí son clase: caja propia, porque es la buena noticia. */
.mat-piezas.destaca{ border:1px solid var(--mako); border-radius:12px; padding:4px 17px; }

/* ── La divergencia de numeración ─────────────────────────────────────────── */
.mat-tabla{ width:100%; border-collapse:collapse; margin:16px 0 0; font-size:13.5px; }
.mat-tabla th{ text-align:left; font-weight:600; padding:7px 10px;
  border:1px solid var(--border-strong); background:var(--surface-2); white-space:nowrap; }
.mat-tabla td{ padding:9px 10px; border:1px solid var(--border); color:var(--dim); }
.mat-tabla td.n{ font-family:${MONO}; font-variant-numeric:tabular-nums; width:1%;
  white-space:nowrap; }
.mat-tabla em{ color:var(--faint); font-style:normal; }

/* ── Módulo por módulo ────────────────────────────────────────────────────── */
.mat-mods{ list-style:none; margin:0; padding:0; }
.mat-mods > li{ margin:0 0 12px; }
.mat-mod{ background:var(--surface); border:1px solid var(--border); border-left-width:3px;
  border-radius:12px; padding:17px 19px; }
/* El filo izquierdo dice el nivel de un vistazo. Nunca es el ÚNICO portador:
   el chip con la palabra está siempre. */
.mat-mod.n-nada{ border-left-color:var(--warn); }
.mat-mod.n-anexo{ border-left-color:var(--border-strong); }
.mat-mod.n-parcial{ border-left-color:var(--mako); }
.mat-mod.n-clase{ border-left-color:var(--good); }
.mat-mod > header{ display:flex; align-items:baseline; gap:11px; flex-wrap:wrap; }
.mat-mod .rot{ font-family:${MONO}; font-size:10.5px; letter-spacing:.1em; text-transform:uppercase;
  color:var(--faint); font-variant-numeric:tabular-nums; }
.mat-mod h4{ margin:0; font-size:16.5px; font-weight:650; letter-spacing:-.018em; flex:1 1 auto; }
.mat-mod .mat-piezas{ margin-top:14px; }
.mat-mod .falta{ margin:15px 0 0; }
.mat-mod .falta .tit{ margin:0 0 6px; font-size:11px; letter-spacing:.08em;
  text-transform:uppercase; color:var(--faint); }
.mat-mod .falta ul{ margin:0; padding-left:18px; font-size:14px; line-height:1.65; color:var(--dim); }
/* La advertencia sobre material que PARECE de este módulo. Filete dorado, igual
   que el «Ojo con esto» de la tab Clases: es la misma clase de aviso. */
.mat-mod .ojo{ margin:15px 0 0; border-left:2px solid var(--mako); padding:2px 0 2px 14px;
  font-size:14px; line-height:1.6; color:var(--dim); }
.mat-mod .ojo b{ color:var(--ink); }
.mat-mod .tarea{ margin:15px 0 0; padding-top:13px; border-top:1px solid var(--border);
  font-size:14.5px; line-height:1.6; color:var(--dim); }
.mat-mod .tarea b{ color:var(--ink); }

/* ── El material que no cuelga de ningún módulo ───────────────────────────── */
.mat-suelto{ background:var(--surface); border:1px solid var(--border); border-radius:12px;
  padding:18px 19px; }
.mat-suelto .tit{ margin:0; font-size:17px; font-weight:650; letter-spacing:-.02em; }
.mat-suelto .fmt{ margin:5px 0 0; font-size:12px; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.mat-suelto .ap{ margin:13px 0 0; font-size:14.5px; line-height:1.6; color:var(--dim); }
.mat-suelto .ap b{ color:var(--ink); }

/* ── Los defectos ─────────────────────────────────────────────────────────── */
.mat-def{ list-style:none; margin:0; padding:0; }
.mat-def > li{ padding:19px 0; border-top:1px solid var(--border); }
.mat-def .cab{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.mat-def h4{ margin:0; font-size:15.5px; font-weight:650; letter-spacing:-.015em; flex:1 1 auto; }
.mat-def .archivos{ list-style:none; margin:10px 0 0; padding:0; display:flex;
  flex-direction:column; gap:3px; }
.mat-def .archivos li{ font-family:${MONO}; font-size:12px; color:var(--faint);
  word-break:break-word; }
.mat-def .ev, .mat-def .ar{ margin:12px 0 0; font-size:14.5px; line-height:1.6; color:var(--dim); }
.mat-def .ev b, .mat-def .ar b{ color:var(--ink); }

/* ── Las tareas ───────────────────────────────────────────────────────────── */
.mat-tareas{ list-style:none; margin:0; padding:0; }
.mat-tareas > li{ display:flex; gap:15px; padding:19px 0; border-top:1px solid var(--border); }
.mat-tareas > li:first-child{ border-top:0; padding-top:2px; }
.mat-tareas .n{ flex:none; width:26px; font-family:${MONO}; font-size:12px; color:var(--faint);
  font-variant-numeric:tabular-nums; padding-top:3px; }
.mat-tareas .in{ flex:1; min-width:0; }
.mat-tareas .cab{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap; }
.mat-tareas h4{ margin:0; font-size:16px; font-weight:650; letter-spacing:-.018em; flex:1 1 auto; }
.mat-tareas .pq{ margin:8px 0 0; font-size:14.5px; line-height:1.6; color:var(--dim); }
.mat-tareas .lc{ margin:9px 0 0; font-size:13.5px; line-height:1.55; color:var(--faint); }
.mat-tareas .lc b{ color:var(--dim); }
`;
