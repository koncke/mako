// =============================================================================
// Los esqueletos de las secciones de un competidor mientras cargan
// =============================================================================
// ⚠️ UNA SECCIÓN QUE CARGA SE DIBUJA CON SU FORMA, NO CON LA CRIATURA (Martín, con Leila Hormozi, 4/11/2026: «el bloque de arriba
// de "Analizando sus formatos…" debería aparecer el bloque con el placeholder típico, con los bloques cargando, no me refiero a
// mako, sino los placeholder típicos»; el Cerebro: «nada de un renglón solo en un hueco… Vale para cada sección que todavía esté
// cargando»).
//
// La criatura de MaKo queda para ENTRAR a un competidor (OrdenSpy.tsx): eso es un loader de pantalla entera. Adentro de la ficha,
// cada sección se dibuja con su tarjeta y sus bloques grises en el lugar donde va a ir lo de verdad, con la MEDIDA de lo de
// verdad (la regla de `Skeleton`, app/_ui/Feedback.tsx: si el esqueleto es más chico, la pantalla pega un salto al cargar).
//
// El esqueleto no dice nada a un lector de pantalla (`aria-hidden`); lo que se anuncia es una frase corta en un `role="status"`.

import { Skeleton } from '@/app/_ui/Feedback';

const CSS = `
/* El gris de la casa (.mk-skel, sobre --surface-2) casi no se ve adentro de una tarjeta blanca: acá va un tono más, el del borde,
   que es translúcido y sirve igual en claro y en oscuro. */
[data-esqueleto] .mk-skel{background:linear-gradient(90deg,var(--border) 25%,color-mix(in srgb,var(--border) 35%,transparent) 37%,var(--border) 63%);
  background-size:400% 100%}
.spyesq-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.spyesq-graf{position:relative;height:380px;margin-left:44px;margin-bottom:22px}
.spyesq-graf__marca{position:absolute;left:0;right:0;border-top:1px dashed color-mix(in srgb,var(--border) 80%,transparent)}
.spyesq-graf__marca > span{position:absolute;right:calc(100% + 8px);top:-6px}
.spyesq-graf__pt{position:absolute}
.spyesq-fila{display:grid;grid-template-columns:minmax(0,220px) minmax(0,1fr);gap:16px;align-items:center;padding:10px 0;border-top:1px solid var(--border)}
.spyesq-fila:first-of-type{border-top:0}
.spyesq-fila__izq{display:flex;flex-direction:column;gap:7px}
.spyesq-pista{position:relative;height:38px}
.spyesq-pista > span{position:absolute;top:50%;translate:0 -50%}
.spyesq-titulo{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 8px}
.spyesq-titulo h3{margin:0}
.spyesq-vivo{display:inline-flex;align-items:center;gap:6px;color:var(--faint);font-size:12.5px;font-weight:600;white-space:nowrap}
.spyesq-oferta{display:flex;flex-direction:column;gap:16px}
.spyesq-oferta__hero{display:flex;align-items:center;gap:18px}
.spyesq-oferta__lineas{display:flex;flex-direction:column;gap:9px;flex:1;min-width:0}
.spyesq-oferta__datos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.spyesq-oferta__dato{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:var(--r-md);background:var(--surface-2)}
.spyesq-pagina{position:absolute;inset:0;display:flex;flex-direction:column;gap:22px;padding:22px 26px;background:var(--surface);overflow:hidden}
.spyesq-pagina__nav{display:flex;align-items:center;justify-content:space-between;gap:16px}
.spyesq-pagina__links{display:flex;gap:14px}
.spyesq-pagina__hero{display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:18px}
.spyesq-pagina__cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:6px}
@media (max-width:640px){
  .spyesq-graf{height:260px;margin-left:36px}
  .spyesq-fila{grid-template-columns:1fr;gap:6px}
  .spyesq-oferta__datos{grid-template-columns:minmax(0,1fr)}
  .spyesq-pagina{padding:16px}
  .spyesq-pagina__cols{grid-template-columns:minmax(0,1fr)}
  .spyesq-pagina__links{display:none}
}
`;

/** Lo que oye un lector de pantalla: la sección sigue cargando. Corto. */
function Estado({ texto }: { texto: string }) {
  return <span role="status" className="spyesq-sr">{texto}</span>;
}

// Dónde caen las miniaturas grises del gráfico. FIJAS a propósito: un esqueleto que se mueve de lugar en cada render se lee como
// datos que cambian, y uno al azar daría un dibujo distinto en el server y en el navegador. Suben de izquierda a derecha como
// suele subir lo que publica una cuenta que crece; x e y van de 0 a 1, `v` es vertical (un reel) y si no, apaisada (un video).
const PUNTOS: ReadonlyArray<{ x: number; y: number; v: boolean }> = [
  { x: 0.02, y: 0.12, v: true }, { x: 0.1, y: 0.3, v: false }, { x: 0.18, y: 0.18, v: true }, { x: 0.27, y: 0.42, v: true },
  { x: 0.35, y: 0.26, v: false }, { x: 0.44, y: 0.55, v: true }, { x: 0.52, y: 0.36, v: true }, { x: 0.6, y: 0.62, v: false },
  { x: 0.69, y: 0.47, v: true }, { x: 0.77, y: 0.74, v: true }, { x: 0.86, y: 0.58, v: false }, { x: 0.94, y: 0.83, v: true },
];

/** El gráfico de lo que publica, mientras bajan sus miniaturas: sus líneas de referencia y las miniaturas en gris. */
export function EsqueletoGrafico({ telefono = false, nombre }: { telefono?: boolean; nombre: string }) {
  const lado = telefono ? 30 : 42;
  const puntos = telefono ? PUNTOS.filter((_, i) => i % 2 === 0) : PUNTOS;
  return (
    <div className="spyesq-graf" data-esqueleto="grafico">
      <style>{CSS}</style>
      <Estado texto={`Cargando lo que publica ${nombre}`} />
      <div aria-hidden>
        {[0.25, 0.5, 0.75].map((y) => (
          <div key={y} className="spyesq-graf__marca" style={{ bottom: `${y * 100}%` }}><Skeleton w={26} h={10} /></div>
        ))}
        {puntos.map((p, i) => {
          const ancho = p.v ? Math.round(lado * 0.8) : lado;
          const alto = p.v ? lado : Math.round(lado * 0.5625);
          return (
            <span key={i} className="spyesq-graf__pt" style={{ left: `calc(${p.x * 100}% - ${p.x * ancho}px)`, bottom: `calc(${p.y * 100}% - ${p.y * alto}px)` }}>
              <Skeleton w={ancho} h={alto} radius={telefono ? 6 : 9} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Las filas de «¿Qué formatos le funcionan?»: las que suele tener (sus formatos, con su gancho), para que la tarjeta no quede
// medio vacía ni pegue un salto al llegar las de verdad.
const FILAS_FORMATOS = [
  { rotulo: 120, cuenta: 150, gancho: '86%', pista: [0.12, 0.34, 0.58, 0.81] },
  { rotulo: 96, cuenta: 130, gancho: '72%', pista: [0.2, 0.46, 0.7] },
  { rotulo: 140, cuenta: 110, gancho: '80%', pista: [0.08, 0.3, 0.52, 0.66, 0.9] },
  { rotulo: 104, cuenta: 140, gancho: '64%', pista: [0.4, 0.62] },
  { rotulo: 128, cuenta: 120, gancho: '76%', pista: [0.16, 0.5, 0.78] },
] as const;

/** «¿Qué formatos le funcionan?» mientras la IA del negocio lee sus piezas: su título, y sus filas (con su gancho) en gris. */
export function EsqueletoFormatos() {
  return (
    <section className="spyg-caja" aria-busy data-esqueleto="formatos">
      <style>{CSS}</style>
      <div className="spyesq-titulo">
        <h3>¿Qué formatos le funcionan?</h3>
        <span className="spyesq-vivo" role="status">Analizando…</span>
      </div>
      <div aria-hidden>
        {FILAS_FORMATOS.map((f, i) => (
          <div key={i} className="spyesq-fila">
            <div className="spyesq-fila__izq">
              <Skeleton w={f.rotulo} h={14} />
              <Skeleton w={f.cuenta} h={10} />
              <Skeleton w={f.gancho} h={10} />
            </div>
            <div className="spyesq-pista">
              {f.pista.map((x) => (
                <Skeleton key={x} w={24} h={30} radius={6} style={{ left: `calc(${x * 100}% - ${x * 24}px)` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * Su oferta mientras la lee el analista: el lugar del puntaje, la tesis en dos líneas y sus cuatro datos. Va ADENTRO de la
 * tarjeta de la oferta (`.spy-oferta-cabeza`), que ya está dibujada.
 */
export function EsqueletoOferta({ nombre }: { nombre: string }) {
  return (
    <div className="spyesq-oferta" data-esqueleto="oferta">
      <style>{CSS}</style>
      <Estado texto={`Leyendo la oferta de ${nombre}`} />
      <div className="spyesq-oferta__hero" aria-hidden>
        <Skeleton w={88} h={88} radius="50%" style={{ flex: 'none' }} />
        <div className="spyesq-oferta__lineas">
          <Skeleton w={70} h={11} />
          <Skeleton w="92%" h={18} />
          <Skeleton w="64%" h={18} />
        </div>
      </div>
      <div className="spyesq-oferta__datos" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="spyesq-oferta__dato">
            <Skeleton w={[60, 52, 110, 96][i]} h={10} />
            <Skeleton w="88%" h={13} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** El puntaje de su oferta que todavía no llegó, en su lugar (con la tesis ya a la vista). */
export function EsqueletoPuntaje() {
  return (
    <span data-esqueleto="puntaje" style={{ flex: 'none' }} aria-hidden>
      <style>{CSS}</style>
      <Skeleton w={88} h={88} radius="50%" />
    </span>
  );
}

/** Su página mientras abre adentro del marco del navegador: una barra de navegación, un titular y tres columnas. */
export function EsqueletoPagina() {
  return (
    <div className="spyesq-pagina" data-esqueleto="pagina">
      <style>{CSS}</style>
      <Estado texto="Abriendo su página" />
      <div className="spyesq-pagina__nav" aria-hidden>
        <Skeleton w={96} h={18} />
        <div className="spyesq-pagina__links">{[54, 62, 48].map((w) => <Skeleton key={w} w={w} h={10} />)}</div>
        <Skeleton w={92} h={30} radius={99} />
      </div>
      <div className="spyesq-pagina__hero" aria-hidden>
        <Skeleton w="62%" h={30} />
        <Skeleton w="44%" h={30} />
        <Skeleton w="54%" h={12} style={{ marginTop: 6 }} />
        <Skeleton w={170} h={42} radius={99} style={{ marginTop: 10 }} />
      </div>
      <div className="spyesq-pagina__cols" aria-hidden>
        {[0, 1, 2].map((i) => <Skeleton key={i} h={150} radius={14} />)}
      </div>
    </div>
  );
}
