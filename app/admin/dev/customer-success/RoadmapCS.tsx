'use client';

// =============================================================================
// El roadmap de Customer Success, renderizado
// =============================================================================
// Los datos y las tres separaciones que lo ordenan (objetivo/camino, ahora/
// después, lo que se ve / lo que se abre) están en `roadmap-cs.ts`.
//
// LA REGLA DE ESTA PANTALLA, textual del dueño: «No pongas infinito scroll, para
// eso existen los desplegables». Sin abrir, cada bloque muestra su título y UNA
// línea. Es la misma regla que ya estaba escrita arriba de `Titular` en
// pricing/Piezas.tsx —«sin abrir se ve un número y como mucho dos frases»— y por
// eso se reusa su `Plegable` en vez de escribir otro: misma anatomía, misma
// pieza. Si aparece un tercer consumidor, se muda a app/_ui.
//
// Cerrada, la pantalla entra en ~2 pantallas: el objetivo, nueve renglones de
// fase y cinco de la propuesta original. Abierta entera son ~90 líneas, y por
// eso no se abre entera nunca.
//
// Del resto de AGENTS.md: lista con filete (`.mk-fila`) y no pila de cajas; el
// color nunca es el único portador (cada estado lleva su rótulo); el tono sale
// de `TONO`; nada adentro lleva ancho propio.

import { Section, MONO, TONO } from '@/app/_ui';
import Link from '@/app/_ui/Link';
import { Plegable } from '../pricing/Piezas';
import {
  OBJETIVO, FASES, DESPUES, ESTADO_CS, conteoCamino, TOTAL_FEATURES_DESPUES,
  type EstadoCS, type ItemCS, type FaseCS,
} from './roadmap-cs';
import type { TareaRoadmap } from '../roadmap';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();

/** El punto + el rótulo. El rótulo no es opcional: el color solo no alcanza. */
function Chip({ estado }: { estado: EstadoCS }) {
  const { label, tono } = ESTADO_CS[estado];
  const t = TONO[tono];
  return (
    <span className="mk-pill" style={{ background: t.bg, color: t.ink, border: `1px solid ${t.border}`, flex: 'none' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.fill, flex: 'none' }} aria-hidden />
      {label}
    </span>
  );
}

/** Solo si la tarea EXISTE. Un número aproximado manda a la tarjeta de otra. */
function EnPlan({ t }: { t: TareaRoadmap }) {
  return (
    <Link href={`/plan?tarea=${t.num}`} style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--primary)', flex: 'none' }}
      title={`${t.proyecto} · score ${t.score}${t.deadline ? ` · vence ${t.deadline}` : ''}`}>
      #{t.num}{t.progreso > 0 ? ` · ${t.progreso}%` : ''}
    </Link>
  );
}

function Fila({ item, tarea }: { item: ItemCS; tarea?: TareaRoadmap }) {
  return (
    <div className="mk-fila">
      <div className="mk-fila__txt">
        <div className="mk-fila__l1">
          <span className="mk-fila__t">{item.titulo}</span>
          <Chip estado={item.estado} />
          {item.quien && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: item.quien === 'Mauricio' ? 'var(--warn)' : 'var(--faint)' }}>{item.quien}</span>
          )}
          {tarea && <EnPlan t={tarea} />}
          {item.tag && (
            <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', textDecoration: item.ojo?.includes('mentía') ? 'line-through' : 'none' }}
              title="El tag que el documento le mostró a Mauricio">{item.tag}</span>
          )}
        </div>
        <span className="mk-fila__c">{item.que}</span>
        {item.ojo && (
          <span className="mk-fila__c" style={{ color: 'var(--faint)', borderLeft: '2px solid var(--border)', paddingLeft: 10 }}>{item.ojo}</span>
        )}
      </div>
    </div>
  );
}

const Lista = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
);

/** El renglón de una fase: cerrado dice qué desbloquea y cuánto trae. */
function Fase({ f, porTitulo }: { f: FaseCS; porTitulo: Map<string, TareaRoadmap> }) {
  const bloqueadas = f.items.filter((i) => i.estado === 'bloqueado').length;
  const resumen = [
    `${f.items.length} ${f.items.length === 1 ? 'cosa' : 'cosas'}`,
    bloqueadas ? `${bloqueadas} bloqueada${bloqueadas > 1 ? 's' : ''}` : null,
    f.paralelo ? 'en paralelo' : null,
  ].filter(Boolean).join(' · ');

  return (
    <Plegable titulo={`Fase ${f.n} · ${f.titulo}`} resumen={`${resumen} — ${f.desbloquea}`} abierto={f.abierta}>
      {f.necesita && (
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 10px' }}>
          <strong style={{ color: 'var(--ink)' }}>Necesita antes:</strong> {f.necesita}
        </p>
      )}
      <Lista>
        {f.items.map((i) => <Fila key={i.titulo} item={i} tarea={i.plan ? porTitulo.get(norm(i.plan)) : undefined} />)}
      </Lista>
    </Plegable>
  );
}

const Bullets = ({ items }: { items: string[] }) => (
  <ul style={{ margin: '0 0 12px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
    {items.map((x) => <li key={x} style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>{x}</li>)}
  </ul>
);

const Cita = ({ children }: { children: React.ReactNode }) => (
  <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', margin: '0 0 12px', lineHeight: 1.6, borderLeft: '2px solid var(--border)', paddingLeft: 12 }}>
    {children}
  </p>
);

export function RoadmapCS({ tareas }: { tareas: TareaRoadmap[] }) {
  const porTitulo = new Map(tareas.map((t) => [norm(t.titulo), t]));
  const conteo = conteoCamino();
  const reclamados = new Set(FASES.flatMap((f) => f.items.map((i) => i.plan).filter(Boolean).map((t) => norm(t!))));
  const sueltas = tareas.filter((t) => !reclamados.has(norm(t.titulo)));
  const total = FASES.reduce((n, f) => n + f.items.length, 0);

  return (
    <>
      {/* ── EL OBJETIVO ─ corto y siempre a la vista: es el norte ──────────── */}
      <Section titulo="El objetivo" card>
        <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', fontWeight: 600, margin: '0 0 8px', lineHeight: 1.4 }}>{OBJETIVO.frase}</p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 14px', lineHeight: 1.6 }}>{OBJETIVO.detalle}</p>

        {/* Los 5 pasos NO llevan estado: son el destino, no trabajo. Cada uno dice
            qué fase lo habilita — el paso 1 es el ÚLTIMO en poder correr. */}
        <Plegable
          titulo="Cómo va a funcionar · el bucle de 5 pasos"
          resumen="el paso 1 es el último en poder correr: necesita la plataforma"
          abierto
        >
          <Lista>
            {OBJETIVO.pasos.map((p) => (
              <div className="mk-fila" key={p.n}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: 'var(--mako-ink)', flex: 'none', paddingTop: 2, width: 16 }}>{p.n}</span>
                <div className="mk-fila__txt">
                  <div className="mk-fila__l1">
                    <span className="mk-fila__t">{p.titulo}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)' }}>{p.habilita}</span>
                  </div>
                  <span className="mk-fila__c">{p.que}</span>
                </div>
              </div>
            ))}
          </Lista>
          <Cita>{OBJETIVO.cita}</Cita>
        </Plegable>
      </Section>

      {/* ── EL CAMINO ─ nueve renglones; se abre el que interesa ───────────── */}
      <Section titulo="El camino" nota={`${total} cosas, en orden de dependencia`} card>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.6 }}>
          No es el orden de los cuatro frentes del Sprint: es el de lo que habilita a qué. Las dos
          primeras están abiertas porque son las de hoy.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
          {(Object.keys(ESTADO_CS) as EstadoCS[]).filter((e) => conteo[e] > 0).map((e) => {
            const t = TONO[ESTADO_CS[e].tono];
            return (
              <span key={e} style={{ fontFamily: MONO, fontSize: 12, color: t.ink, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: '4px 9px' }}>
                {conteo[e]} {ESTADO_CS[e].label.toLowerCase()}
              </span>
            );
          })}
        </div>
        {FASES.map((f) => <Fase key={f.n} f={f} porTitulo={porTitulo} />)}
      </Section>

      {sueltas.length > 0 && (
        <Section titulo="También en el plan" nota="fuera de este camino" card>
          <Plegable titulo={`${sueltas.length} tareas abiertas que ninguna fase reclama`} resumen="o les falta su lugar en el camino, o el camino les falta a ellas">
            <Lista>
              {sueltas.map((t) => (
                <div className="mk-fila" key={t.num}>
                  <div className="mk-fila__txt">
                    <div className="mk-fila__l1">
                      <span className="mk-fila__t">{t.titulo}</span>
                      <EnPlan t={t} />
                    </div>
                  </div>
                </div>
              ))}
            </Lista>
          </Plegable>
        </Section>
      )}

      {/* ── DESPUÉS ─ la propuesta original, entera y plegada ──────────────── */}
      <Section titulo="Después del sprint" nota="la propuesta original" card>
        <p style={{ fontSize: 'var(--fs-card)', color: 'var(--ink)', fontWeight: 600, margin: '0 0 6px', lineHeight: 1.4 }}>{DESPUES.resumen}</p>
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--dim)', margin: '0 0 12px', lineHeight: 1.6 }}>
          Se guarda entero, no resumido: es el material que se vuelve a usar cuando se abra el gatillo.
        </p>

        <Plegable titulo="Por qué se aplazó, y con qué gatillo" resumen="seis objeciones, ninguna de precio">
          <Cita>{DESPUES.porQue.cita}</Cita>
          <Bullets items={DESPUES.porQue.objeciones} />
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', margin: '0 0 8px', fontWeight: 600 }}>El gatillo, en sus palabras:</p>
          <Cita>{DESPUES.porQue.gatillo}</Cita>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', margin: '0 0 8px', fontWeight: 600 }}>Y la frase que resume la relación:</p>
          <Cita>{DESPUES.porQue.frase}</Cita>
        </Plegable>

        <Plegable titulo="Los números" resumen={`${DESPUES.numeros.precio} en ${DESPUES.numeros.forma}, contra ~$60K de un empleado en 3 años`}>
          <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 26, color: 'var(--ink)' }}>{DESPUES.numeros.precio}</div>
              <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>{DESPUES.numeros.forma} · {DESPUES.numeros.nota}</div>
            </div>
          </div>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', margin: '0 0 8px', fontWeight: 600 }}>Contratar un empleado</p>
          <Bullets items={DESPUES.numeros.empleado} />
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', margin: '0 0 8px', fontWeight: 600 }}>Encender el módulo en MaKo</p>
          <Bullets items={DESPUES.numeros.mako} />
          {/* Tabla angosta: si algún día crece, va adentro de .mk-scroll-x. */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-sm)' }}>
            <thead>
              <tr style={{ color: 'var(--dim)', textAlign: 'left' }}>
                <th style={{ padding: '6px 0', fontWeight: 500 }} />
                <th style={{ padding: '6px 0', fontWeight: 500 }}>Año 1</th>
                <th style={{ padding: '6px 0', fontWeight: 500 }}>Año 2</th>
                <th style={{ padding: '6px 0', fontWeight: 500 }}>Año 3</th>
                <th style={{ padding: '6px 0', fontWeight: 500 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {DESPUES.numeros.tresAnios.map((f) => (
                <tr key={f.que} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 0', color: 'var(--ink)', fontWeight: 600 }}>{f.que}</td>
                  <td style={{ padding: '8px 0', fontFamily: MONO, color: 'var(--dim)' }}>{f.a1}</td>
                  <td style={{ padding: '8px 0', fontFamily: MONO, color: 'var(--dim)' }}>{f.a2}</td>
                  <td style={{ padding: '8px 0', fontFamily: MONO, color: 'var(--dim)' }}>{f.a3}</td>
                  <td style={{ padding: '8px 0', fontFamily: MONO, color: 'var(--ink)' }}>{f.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Plegable>

        <Plegable titulo="Las 4 fases del roadmap original" resumen="nunca se desglosaron en features — y eso mismo es el dato">
          <Lista>
            {DESPUES.fasesOriginales.map((f) => (
              <div className="mk-fila" key={f}><div className="mk-fila__txt"><span className="mk-fila__t">{f}</span></div></div>
            ))}
          </Lista>
        </Plegable>

        <Plegable titulo="Lo que MaKo NO reemplaza" resumen="qué se lleva la app y qué queda 100% suyo">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 22 }}>
            <div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', margin: '0 0 8px', fontWeight: 600 }}>Se lo lleva MaKo</p>
              <Bullets items={DESPUES.noReemplaza.seLleva} />
            </div>
            <div>
              <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', margin: '0 0 8px', fontWeight: 600 }}>Queda 100% tuyo</p>
              <Bullets items={DESPUES.noReemplaza.quedaTuyo} />
            </div>
          </div>
        </Plegable>

        <Plegable titulo="Las reglas del acuerdo" resumen="estandarización, la mentoría sagrada y el ejecutor que vence">
          <Lista>
            {DESPUES.reglas.map((r) => (
              <div className="mk-fila" key={r.t}>
                <div className="mk-fila__txt">
                  <div className="mk-fila__l1"><span className="mk-fila__t">{r.t}</span></div>
                  <span className="mk-fila__c">{r.q}</span>
                </div>
              </div>
            ))}
          </Lista>
        </Plegable>

        <Plegable titulo="Los 12 módulos" resumen={`${TOTAL_FEATURES_DESPUES} features · 4 de las 10 marcadas «listo» no lo estaban`}>
          {DESPUES.modulos.map((m) => (
            <Plegable key={m.n} titulo={`${m.n} · ${m.titulo}`} resumen={`${m.items.length} · ${m.que}`}>
              <Lista>{m.items.map((i) => <Fila key={i.titulo} item={i} />)}</Lista>
            </Plegable>
          ))}
        </Plegable>
      </Section>
    </>
  );
}
