'use client';

// =============================================================================
// Tu material — el Banco de Skills leído entero, cruzado contra el programa
// =============================================================================
// LA PREGUNTA QUE CONTESTA: «mandé 1 GB de material, ¿cuánto me ahorra?».
//
// ⚠️ ESTA PANTALLA SE TIRÓ DOS VECES, Y LAS DOS POR LO MISMO: ERA PARA LEER.
//   · v1 — toda la prosa a la vista, ~3.400 palabras. Un informe.
//   · v2 — filas plegables. Ordenado, pero seguía siendo texto chico y gris:
//     nada en la pantalla se veía SIN leerlo.
//
// LA REGLA QUE LA GOBIERNA AHORA: el mensaje principal tiene que entrar por el
// ojo, no por la lectura. Por eso el titular es enorme, los números son enormes,
// y sobre todo existe EL MAPA: trece bloques de color, uno por módulo. Ese mapa
// es el hallazgo entero — se ve de un vistazo que casi todo está gris («solo
// apoyo»), y eso ES la respuesta a la pregunta que trajo a Mauricio acá.
//
// Un bloque de color no puede ser el único portador del dato: cada uno lleva su
// número adentro, la referencia dice qué significa cada color con su cuenta, y
// abajo la lista repite todo con palabras.
//
// El test: alguien que la abre entiende «casi todo hay que grabarlo igual» ANTES
// de leer una sola frase.
//
// EL ORDEN, deliberado, y NO es el de una auditoría — una auditoría abre con los
// defectos y deja a Mauricio a la defensiva antes de llegar a lo útil:
//   1. el veredicto, el mapa y cuatro números
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

export function Material() {
  const cuenta = (n: NivelCobertura) => COBERTURA.filter(c => c.nivel === n).length;
  const aGrabar = COBERTURA.filter(c => c.nivel !== 'clase').length;

  return (
    <div className="mat">
      {/* 1 · EL VEREDICTO — titular enorme, el mapa, y cuatro números. */}
      <section className="hero">
        {/* En ancho completo el titular y los números comparten renglón: el
            titular manda a la izquierda y los cuatro números se apoyan a la
            derecha, en vez de dejar media pantalla vacía. */}
        <div className="top">
          <h2>No reemplaza<br />tus clases.</h2>
          <ul className="nums">
            <li><b>{INVENTARIO.archivos}</b><span>archivos que mandaste</span></li>
            <li><b>{INVENTARIO.minutos}</b><span>minutos de video</span></li>
            <li className="bien"><b>{PIEZAS_CLASE.length}</b><span>sirven como clase</span></li>
            <li className="ojo"><b>{aGrabar}</b><span>módulos por grabar</span></li>
          </ul>
        </div>

        {/* EL MAPA. Trece bloques, uno por módulo: el hallazgo entero de un
            vistazo. Cada bloque lleva su número, y la referencia de abajo le
            pone palabra y cuenta a cada color. */}
        <div className="mapa" role="img"
          aria-label={`Los ${COBERTURA.length} módulos por nivel de cobertura: ${ORDEN
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

      {/* 3 · LOS MÓDULOS. El mismo color del mapa, ahora con palabras. */}
      <Bloque titulo="Los módulos" cuenta={COBERTURA.length}>
        {COBERTURA.map(c => <Modulo key={c.modulo} c={c} />)}
      </Bloque>

      {/* 4 y 5 · Los dos bloques cortos van uno al lado del otro: son listas de
          cinco y dos filas, y apiladas a lo largo dejaban la pantalla vacía. */}
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

      {/* 5 · Lo que no entra en ningún módulo, y los dos programas que no coinciden. */}
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

function Bloque({ titulo, cuenta, children }: { titulo: string; cuenta?: number; children: ReactNode }) {
  return (
    <section className="bloque">
      <h3>{titulo}{cuenta !== undefined && <span className="n">{cuenta}</span>}</h3>
      <div className="lista">{children}</div>
    </section>
  );
}

/** Un módulo: el mismo bloque de color del mapa, el título grande y la acción. */
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
.mat{ padding:8px 0 120px;
  /* Los cuatro colores del mapa, en un solo lugar: los usan el bloque grande,
     la chapa de cada fila, la referencia y el chip. Si se tocan acá, se mueven
     los cuatro a la vez y no pueden quedar diciendo cosas distintas. */
  --n-cero:var(--warn); --n-apoyo:#a8adb8; --n-medio:var(--mako); --n-ok:var(--good); }

/* ── 1 · El veredicto ─────────────────────────────────────────────────────── */
.mat .hero{ padding:26px 0 18px; }
/* Titular a la izquierda y numeros a la derecha, en el mismo renglon: es lo que
   convierte el ancho completo en informacion en vez de aire. Abajo de 1080 px
   se apilan, porque el titular solo ya ocupa el ancho. */
.mat .top{ display:flex; align-items:flex-end; justify-content:space-between;
  gap:36px 60px; flex-wrap:wrap; }
.mat .hero h2{ margin:0; font-size:clamp(42px,7vw,78px); font-weight:800;
  letter-spacing:-.045em; line-height:.96; }

/* EL MAPA. Trece bloques, uno por módulo. Es lo primero que se ve después del
   titular y dice el hallazgo sin una sola palabra. */
.mat .mapa{ display:flex; gap:7px; margin:52px 0 0; }
.mat .mapa .celda{ flex:1; height:58px; border-radius:8px; display:flex; align-items:center;
  justify-content:center; font-family:${MONO}; font-size:14px; font-weight:600;
  font-variant-numeric:tabular-nums; color:#fff; }
.mat .mapa .celda.n-cero{ background:var(--n-cero); }
.mat .mapa .celda.n-apoyo{ background:var(--n-apoyo); }
.mat .mapa .celda.n-medio{ background:var(--n-medio); }
.mat .mapa .celda.n-ok{ background:var(--n-ok); }

.mat .refs{ list-style:none; display:flex; flex-wrap:wrap; gap:10px 26px; margin:16px 0 0; padding:0; }
.mat .refs li{ display:flex; align-items:center; gap:8px; font-size:14px; color:var(--dim); }
.mat .refs b{ color:var(--ink); font-variant-numeric:tabular-nums; }
.mat .sw{ width:13px; height:13px; border-radius:4px; display:block; }
.mat .sw.n-cero{ background:var(--n-cero); }
.mat .sw.n-apoyo{ background:var(--n-apoyo); }
.mat .sw.n-medio{ background:var(--n-medio); }
.mat .sw.n-ok{ background:var(--n-ok); }

.mat .nums{ list-style:none; display:flex; flex-wrap:wrap; gap:26px 56px; margin:0; padding:0 0 10px; }
.mat .nums b{ display:block; font-size:clamp(40px,5.2vw,58px); font-weight:800;
  letter-spacing:-.05em; line-height:1; font-variant-numeric:tabular-nums; }
.mat .nums span{ display:block; margin-top:10px; font-size:14px; color:var(--dim); }
.mat .nums .bien b{ color:var(--good); }
.mat .nums .ojo b{ color:var(--mako-ink); }

/* El único párrafo de la pantalla, y arranca plegado. */
.mat .porque{ margin:40px 0 0; border-top:1px solid var(--border); }
.mat .porque > summary{ list-style:none; cursor:pointer; padding:18px 0 2px; font-size:16px;
  color:var(--dim); display:flex; align-items:center; gap:10px; }
.mat .porque > summary::-webkit-details-marker{ display:none; }
.mat .porque > summary::after{ content:''; width:7px; height:7px; border-right:2px solid currentColor;
  border-bottom:2px solid currentColor; transform:rotate(45deg); margin-bottom:4px; }
.mat .porque[open] > summary::after{ transform:rotate(-135deg); margin-bottom:-2px; }
.mat .porque > summary:hover{ color:var(--ink); }
.mat .porque p{ font-size:17px; line-height:1.65; color:var(--dim); margin:16px 0 0; max-width:62ch; }
.mat .porque b{ color:var(--ink); font-weight:650; }
.mat .porque .ej{ border-left:3px solid var(--mako); padding-left:18px; }

/* ── Los bloques ──────────────────────────────────────────────────────────── */
.mat .bloque{ margin:58px 0 0; }
.mat .bloque > h3{ display:flex; align-items:center; gap:12px; margin:0 0 6px;
  font-size:12.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--faint); font-weight:700; }
.mat .bloque > h3 .n{ font-family:${MONO}; letter-spacing:0; font-size:11.5px;
  background:var(--surface-2); border-radius:20px; padding:3px 10px; }

/* Los dos bloques cortos comparten renglon en pantallas anchas. */
.mat .par{ display:grid; grid-template-columns:1fr; gap:0 56px; }
@media(min-width:1120px){
  .mat .par{ grid-template-columns:1fr 1fr; align-items:start; }
  .mat .par .bloque{ margin-top:58px; }
}

/* ── La fila ──────────────────────────────────────────────────────────────── */
.mat .lista{ border-top:1px solid var(--border); }
.mat .fila{ border-bottom:1px solid var(--border); }
.mat .fila > summary{ list-style:none; cursor:pointer; display:flex; align-items:center;
  gap:20px; padding:24px 6px; }
.mat .fila > summary::-webkit-details-marker{ display:none; }
.mat .fila > summary:hover{ background:var(--surface-2); }
.mat .fila > summary:focus-visible{ outline:2px solid var(--mako); outline-offset:-2px; }
.mat .fila .izq{ flex:none; display:flex; align-items:center; }
.mat .fila .tit{ flex:1; min-width:0; display:flex; align-items:baseline; gap:14px; flex-wrap:wrap; }
/* El título es lo que se lee, así que es grande de verdad. */
.mat .fila .tit b{ font-size:21px; font-weight:650; letter-spacing:-.024em; line-height:1.25; }
.mat .fila .der{ flex:none; }
.mat .fila .mas{ flex:none; width:9px; height:9px; border-right:2px solid var(--faint);
  border-bottom:2px solid var(--faint); transform:rotate(-45deg); transition:transform .15s; }
.mat .fila[open] .mas{ transform:rotate(45deg); }

.mat .num{ font-family:${MONO}; font-style:normal; font-size:15px; color:var(--faint);
  font-variant-numeric:tabular-nums; min-width:26px; }
/* La chapa del módulo: el MISMO color que su bloque en el mapa, para que la
   lista se lea como la continuación del mapa y no como otra cosa. */
.mat .chapa{ font-family:${MONO}; font-style:normal; font-size:13px; color:#fff;
  font-variant-numeric:tabular-nums; width:38px; height:38px; border-radius:9px;
  display:flex; align-items:center; justify-content:center; }
.mat .chapa.n-cero{ background:var(--n-cero); }
.mat .chapa.n-apoyo{ background:var(--n-apoyo); }
.mat .chapa.n-medio{ background:var(--n-medio); }
.mat .chapa.n-ok{ background:var(--n-ok); }

.mat .peso{ font-style:normal; font-size:15px; color:var(--dim); white-space:nowrap; }
.mat .peso.rojo{ color:var(--warn); }
/* El punto NUNCA es el único portador: al lado va siempre la palabra. */
.mat .punto{ width:13px; height:13px; border-radius:50%; display:block; margin:0 12px; }
.mat .punto.rojo{ background:var(--warn); }
.mat .punto.verde{ background:var(--good); }
.mat .punto.gris{ background:var(--n-apoyo); }

.mat .nivel{ font-style:normal; font-size:11.5px; letter-spacing:.09em; text-transform:uppercase;
  font-weight:600; padding:4px 9px; border-radius:6px; white-space:nowrap; color:#fff; }
.mat .nivel.n-cero{ background:var(--n-cero); }
.mat .nivel.n-apoyo{ background:var(--n-apoyo); }
.mat .nivel.n-medio{ background:var(--n-medio); }
.mat .nivel.n-ok{ background:var(--n-ok); }

/* ── Lo que hay adentro de una fila ───────────────────────────────────────── */
.mat .cuerpo{ padding:2px 6px 32px 58px; max-width:68ch; }
.mat .cuerpo p{ font-size:16px; line-height:1.7; color:var(--dim); margin:0 0 14px; }
.mat .cuerpo p b{ color:var(--ink); }
.mat .cuerpo .rot{ font-size:11.5px; letter-spacing:.14em; text-transform:uppercase;
  color:var(--faint); font-weight:700; margin:22px 0 10px; }
.mat .cuerpo .rot:first-child{ margin-top:0; }
.mat .cuerpo .listo{ margin:20px 0 0; padding-top:16px; border-top:1px solid var(--border); }
.mat .cuerpo .alerta{ border-left:3px solid var(--mako); padding:4px 0 4px 18px; }

.mat .piezas{ list-style:none; margin:0; padding:0; }
.mat .piezas > li{ padding:15px 0; border-top:1px solid var(--border); }
.mat .piezas > li:first-child{ border-top:0; padding-top:0; }
.mat .piezas .a{ display:block; font-family:${MONO}; font-size:13.5px; line-height:1.5;
  color:var(--ink); word-break:break-word; }
.mat .piezas .a i{ font-style:normal; font-family:inherit; font-size:11px; letter-spacing:.07em;
  text-transform:uppercase; color:var(--good); font-weight:600; }
.mat .piezas .f{ display:block; margin-top:4px; font-size:12px; color:var(--faint);
  font-variant-numeric:tabular-nums; }
.mat .piezas .d{ display:block; margin-top:8px; font-size:15.5px; line-height:1.65; color:var(--dim); }

.mat .falta{ margin:0; padding-left:20px; font-size:15.5px; line-height:1.8; color:var(--dim); }
.mat .archivos{ list-style:none; margin:0 0 16px; padding:0; }
.mat .archivos li{ font-family:${MONO}; font-size:13px; color:var(--faint); line-height:1.7;
  word-break:break-word; }

.mat .cuerpo table{ width:100%; border-collapse:collapse; font-size:14px; }
.mat .cuerpo th{ text-align:left; font-weight:600; padding:8px 11px; white-space:nowrap;
  border:1px solid var(--border-strong); background:var(--surface-2); }
.mat .cuerpo td{ padding:9px 11px; border:1px solid var(--border); color:var(--dim); }
.mat .cuerpo td.c{ font-family:${MONO}; font-variant-numeric:tabular-nums; width:1%; }
.mat .cuerpo td i{ color:var(--faint); font-style:normal; }

/* En pantallas angostas el mapa se parte en dos filas antes que achicarse. */
@media(max-width:720px){
  .mat .mapa{ flex-wrap:wrap; }
  .mat .mapa .celda{ flex:1 1 12%; height:52px; }
  .mat .fila > summary{ gap:14px; padding:20px 4px; }
  .mat .fila .tit b{ font-size:18px; }
  .mat .cuerpo{ padding-left:0; }
}
@media(prefers-reduced-motion:reduce){ .mat .fila .mas{ transition:none; } }
`;
