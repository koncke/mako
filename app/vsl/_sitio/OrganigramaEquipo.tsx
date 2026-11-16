// =============================================================================
// Equipo: el organigrama de un equipo de ventas en MaKo, animado (16/11/2026)
// =============================================================================
// Martín: «no quiero ver un formulario… imágenes de personas o como si fuera un organigrama… que se vea lindo»; y, al ver una
// generada con IA: «crea tú mejor el organigrama y saca imágenes de internet». Las caras son los retratos de randomuser.me (el mismo
// banco de fotos de prueba de lib/prueba-personas.ts), guardados en public/vsl-assets/sitio/equipo/; los nombres, inventados. Lo que dice cada uno es lo
// que hace la función de verdad: cada rol entra sólo a sus pestañas (Chats y Agenda el setter, Closing y CRM el closer…).
// El ciclo (10 s, sólo CSS): arriba la mano derecha; bajan las líneas; entran el setter, el closer y el media buyer, de a uno, con sus
// pestañas; y al final el lugar para invitar a alguien más, que late. En unidades del contenedor (cqw): entra igual en la fila de la
// computadora y en la del teléfono. `data-tema-fijo`: el sol y la luna no lo toca.

type Persona = { nombre: string; rol: string; foto: string; permisos: readonly string[] };

const FOTO = (n: number) => `/vsl-assets/sitio/equipo/cara-${n}.jpg`;
// Martín: «no tiene que ser un organigrama súper complejo… el closer, el setter, el media buyer… la mano derecha o el COO».
const DIRECCION: Persona = { nombre: 'Sofía', rol: 'Mano derecha · COO', foto: FOTO(1), permisos: ['Todo MaKo'] };
const EQUIPO: readonly Persona[] = [
  { nombre: 'Diego', rol: 'Setter', foto: FOTO(2), permisos: ['Chats', 'Agenda'] },
  { nombre: 'Camila', rol: 'Closer', foto: FOTO(3), permisos: ['Closing', 'CRM'] },
  { nombre: 'Lucas', rol: 'Media buyer', foto: FOTO(4), permisos: ['Anuncios', 'Create'] },
];
const CICLO = 10;

const CSS = `
.s-org{container-type:inline-size;position:absolute;inset:0;overflow:hidden;color:#12151B;font-family:inherit;background:radial-gradient(circle at 1px 1px,rgba(18,21,27,.07) 1px,transparent 0) 0 0/2.4cqw 2.4cqw,#F4F6FA}
.s-org-in{position:absolute;inset:0;padding:3.4cqw 4cqw;display:flex;flex-direction:column;align-items:center;justify-content:center}
.s-org-p{display:flex;align-items:center;gap:1.2cqw;background:#fff;border:1px solid #E5E8EF;border-radius:1.6cqw;padding:1.1cqw 1.6cqw 1.1cqw 1.1cqw;box-shadow:0 .6cqw 1.6cqw -1cqw rgba(18,21,27,.25);opacity:0;transform:translateY(1.2cqw) scale(.96);animation:${CICLO}s cubic-bezier(.3,0,.2,1) infinite}
.s-org-p img{flex:none;width:7cqw;height:7cqw;border-radius:50%;object-fit:cover;box-shadow:0 0 0 .3cqw #fff,0 0 0 .5cqw var(--c)}
.s-org-p div{min-width:0}
.s-org-p b{display:block;font-size:2cqw;line-height:1.15;font-weight:800;white-space:nowrap}
.s-org-p small{display:block;font-size:1.4cqw;font-weight:600;color:#6B7280}
.s-org-perm{display:flex;flex-wrap:wrap;gap:.5cqw;margin-top:.6cqw}
.s-org-perm span{font-size:1.2cqw;font-weight:700;color:var(--c);background:var(--f);padding:.25cqw .7cqw;border-radius:99px;opacity:0;animation:s-org-perm ${CICLO}s infinite}
@keyframes s-org-perm{0%,52%{opacity:0}58%,95%{opacity:1}99%,100%{opacity:0}}
.s-org-dir{--c:#F2B01E;--f:#FFF4D6}
.s-org-dir .s-org-p{animation-name:s-org-e0}
/* Las líneas: baja una de la dirección, se abre a lo ancho y baja a cada grupo; se dibujan con scale. */
.s-org-lineas{position:relative;width:66%;height:6cqw;flex:none}
.s-org-lineas i{position:absolute;background:#C9D2E3;animation:${CICLO}s infinite}
.s-org-l0{left:50%;top:0;width:.25cqw;height:50%;transform-origin:top;animation-name:s-org-v!important}
.s-org-l1{left:0;right:0;top:50%;height:.25cqw;transform-origin:center;animation-name:s-org-h!important}
.s-org-l2,.s-org-l3,.s-org-l4{top:50%;width:.25cqw;height:50%;transform-origin:top;animation-name:s-org-v2!important}
.s-org-l2{left:0}.s-org-l3{left:50%}.s-org-l4{right:0}
@keyframes s-org-v{0%,8%{transform:scaleY(0)}13%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
@keyframes s-org-h{0%,12%{transform:scaleX(0)}18%,95%{transform:scaleX(1)}99%,100%{transform:scaleX(0)}}
@keyframes s-org-v2{0%,17%{transform:scaleY(0)}21%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
.s-org-grupos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3cqw;width:100%;align-items:start}
.s-org-g{display:flex;flex-direction:column;align-items:stretch;gap:1.1cqw}
.s-org-g>p{margin:0 auto;font-size:1.25cqw;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--c);opacity:0;animation:s-org-rot ${CICLO}s infinite}
@keyframes s-org-rot{0%,19%{opacity:0}23%,95%{opacity:1}99%,100%{opacity:0}}
.s-org-g:nth-child(1){--c:#7B61FF;--f:#EFEBFF}.s-org-g:nth-child(2){--c:#2F6FED;--f:#E8F0FE}.s-org-g:nth-child(3){--c:#E8710A;--f:#FEEFE3}
.s-org-g .s-org-p{justify-content:flex-start}
/* Al final, el lugar para sumar a alguien más: punteado y latiendo. */
.s-org-inv{margin-top:3cqw;display:flex;align-items:center;justify-content:center;gap:.8cqw;border:.2cqw dashed #B8C2D6;border-radius:99px;padding:1.1cqw 2.4cqw;font-size:1.4cqw;font-weight:700;color:#6B7280;opacity:0;animation:s-org-inv ${CICLO}s infinite}
.s-org-inv svg{width:2cqw;height:2cqw}
@keyframes s-org-inv{0%,60%{opacity:0;transform:scale(.96)}65%{opacity:1;transform:scale(1)}72%{transform:scale(1.04)}79%{transform:scale(1)}86%{transform:scale(1.04)}93%,95%{opacity:1;transform:scale(1)}99%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.s-org-p,.s-org-perm span,.s-org-g>p,.s-org-inv,.s-org-lineas i{animation:none!important;opacity:1;transform:none}}
/* En una caja chica (el teléfono): las caras y los nombres más grandes, sin las pestañas ni el rol escrito. */
@container (max-width:480px){.s-org-in{padding:3.6cqw 2.4cqw}.s-org-p{gap:1.4cqw;padding:1.4cqw 1.8cqw 1.4cqw 1.4cqw;border-radius:2.4cqw}.s-org-p img{width:7.6cqw;height:7.6cqw}.s-org-p b{font-size:2.6cqw}.s-org-p small{font-size:2cqw}.s-org-perm{display:none}.s-org-g>p{font-size:2.1cqw}.s-org-grupos{gap:1.8cqw}.s-org-g{gap:1.4cqw}.s-org-inv{font-size:2.2cqw;padding:2cqw}.s-org-inv svg{width:3cqw;height:3cqw}.s-org-lineas{height:6cqw}}
`;

/** Cada tarjeta con SU momento de entrada en el ciclo (la dirección primero; después de a una, grupo por grupo). */
const ENTRADAS = [0, 22, 30, 38];
const CSS_TIEMPOS = ENTRADAS.map((e, i) => `@keyframes s-org-e${i}{0%,${e}%{opacity:0;transform:translateY(1.2cqw) scale(.96)}${e + 5}%,95%{opacity:1;transform:none}99%,100%{opacity:0;transform:none}}`).join('\n');

function Tarjeta({ p, n }: { p: Persona; n: number }) {
  return (
    <div className="s-org-p" style={{ animationName: `s-org-e${n}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.foto} alt="" />
      <div>
        <b>{p.nombre}</b>
        <small>{p.rol}</small>
        <span className="s-org-perm">{p.permisos.map((x) => <span key={x}>{x}</span>)}</span>
      </div>
    </div>
  );
}

export function OrganigramaEquipo() {
  return (
    <div className="s-org" data-tema-fijo="" role="img"
      aria-label="El organigrama de un equipo de ventas en MaKo: la mano derecha arriba y un setter, un closer y un media buyer, cada uno con sus pestañas, y el lugar para invitar a alguien más">
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_TIEMPOS }} />
      <div className="s-org-in" aria-hidden="true">
        <div className="s-org-dir"><Tarjeta p={DIRECCION} n={0} /></div>
        <div className="s-org-lineas"><i className="s-org-l0" /><i className="s-org-l1" /><i className="s-org-l2" /><i className="s-org-l3" /><i className="s-org-l4" /></div>
        <div className="s-org-grupos">
          {EQUIPO.map((p, i) => (
            <div key={p.nombre} className="s-org-g"><Tarjeta p={p} n={i + 1} /></div>
          ))}
        </div>
        <div className="s-org-inv">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Invitar a alguien más
        </div>
      </div>
    </div>
  );
}
