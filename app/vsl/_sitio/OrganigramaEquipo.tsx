// =============================================================================
// Equipo: el organigrama de un equipo de ventas en MaKo, animado (16/11/2026)
// =============================================================================
// Martín: «no quiero ver un formulario… imágenes de personas o como si fuera un organigrama… que se vea lindo»; «crea tú mejor el
// organigrama y saca imágenes de internet»; «no tiene que ser un organigrama súper complejo… el closer, el setter, el media buyer… la
// mano derecha o el COO»; y «que no esté invitado el setter y que le des la animación de clic en invitar a alguien más y que justamente
// se invite… la persona inicial, que sería CEO… una foto de Mauricio».
// Las caras: Mauricio (el caso del sitio) y, para el resto, retratos de randomuser.me (el banco de fotos de prueba de
// lib/prueba-personas.ts) guardados en public/vsl-assets/sitio/equipo/; los nombres del resto, inventados. Lo que dice cada uno es lo
// que hace la función de verdad: cada rol entra sólo a sus pestañas.
// El ciclo (12 s, sólo CSS): Mauricio arriba; baja la línea a la mano derecha; se abre a su equipo (el closer y el media buyer); el
// cursor hace clic en «Invitar a alguien más», sale «Invitación enviada» y entra el setter, nuevo. En unidades del contenedor (cqw):
// entra igual en la fila de la computadora y en la del teléfono. `data-tema-fijo`: el sol y la luna no lo toca.

type Persona = { nombre: string; rol: string; foto: string; permisos: readonly string[]; nuevo?: boolean };

const FOTO = (n: number) => `/vsl-assets/sitio/equipo/cara-${n}.jpg`;
const CEO: Persona = { nombre: 'Mauricio', rol: 'CEO', foto: '/vsl-assets/sitio/avatar/mauricio-foto.jpg', permisos: ['Todo MaKo'] };
const COO: Persona = { nombre: 'Sofía', rol: 'Mano derecha · COO', foto: FOTO(1), permisos: ['Equipo', 'CRM', 'Closing'] };
/** El equipo, en su orden en el organigrama: el setter (el que se invita en la animación), el closer y el media buyer. */
const EQUIPO: readonly Persona[] = [
  { nombre: 'Diego', rol: 'Setter', foto: FOTO(2), permisos: ['Chats', 'Agenda'], nuevo: true },
  { nombre: 'Camila', rol: 'Closer', foto: FOTO(3), permisos: ['Closing', 'CRM'] },
  { nombre: 'Lucas', rol: 'Media buyer', foto: FOTO(4), permisos: ['Anuncios', 'Create'] },
];
const CICLO = 12;
/** En qué % del ciclo entra cada tarjeta: Mauricio, la mano derecha, el setter (después del clic), el closer y el media buyer. */
const ENTRADAS = [0, 10, 62, 25, 30];

const CSS = `
.s-org{container-type:inline-size;position:absolute;inset:0;overflow:hidden;color:#12151B;font-family:inherit;background:radial-gradient(circle at 1px 1px,rgba(18,21,27,.07) 1px,transparent 0) 0 0/2.4cqw 2.4cqw,#F4F6FA}
.s-org-in{position:absolute;inset:0;padding:2.6cqw 4cqw;display:flex;flex-direction:column;align-items:center;justify-content:center}
/* Cada persona, como en un organigrama: la foto arriba, el nombre y el rol abajo, todo centrado; y debajo de una línea fina, las
   pestañas que ve su rol, en texto (Martín: «no me gustan los chips… están como desfasados… el nombre está por arriba de la foto»). */
.s-org-p{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;gap:.2cqw;min-width:15cqw;background:#fff;border:1px solid #E5E8EF;border-radius:1.6cqw;padding:.8cqw 1.6cqw;box-shadow:0 .6cqw 1.6cqw -1cqw rgba(18,21,27,.25);opacity:0;transform:translateY(1.2cqw) scale(.96);animation:${CICLO}s cubic-bezier(.3,0,.2,1) infinite}
.s-org-p img{flex:none;width:4.6cqw;height:4.6cqw;margin-bottom:.4cqw;border-radius:50%;object-fit:cover;box-shadow:0 0 0 .25cqw #fff,0 0 0 .45cqw var(--c)}
.s-org-p b{display:block;font-size:1.7cqw;line-height:1.15;font-weight:800;white-space:nowrap}
.s-org-p small{display:block;font-size:1.2cqw;line-height:1.4;font-weight:600;color:#6B7280;white-space:nowrap}
.s-org-perm{display:block;margin-top:.5cqw;padding-top:.5cqw;border-top:1px solid #EEF0F4;align-self:stretch;font-size:1.1cqw;line-height:1.4;font-weight:700;color:var(--c);white-space:nowrap}
.s-org-nuevo{position:absolute;top:-1cqw;right:-1cqw;font-style:normal;font-size:1.1cqw;font-weight:800;color:#fff;background:#34A853;padding:.3cqw .8cqw;border-radius:99px}
.s-org-ceo{--c:#F2B01E;--f:#FFF4D6}
.s-org-coo{--c:#12B5CB;--f:#E4F7FA}
/* Las líneas: de Mauricio a la mano derecha; de ella, se abren a su equipo (la del setter baja recién cuando lo invitan). */
.s-org-l{position:relative;flex:none;width:66%;height:4.6cqw}
.s-org-l.s-org-l-1{height:3cqw}
.s-org-l i{position:absolute;background:#C9D2E3;animation:${CICLO}s infinite}
.s-org-lv{left:50%;top:0;width:.25cqw;height:100%;transform-origin:top}
.s-org-l-1 .s-org-lv{animation-name:s-org-a}
.s-org-l-2 .s-org-lv{height:50%;animation-name:s-org-b}
.s-org-lh{left:0;right:0;top:50%;height:.25cqw;animation-name:s-org-c}
.s-org-ld{top:50%;width:.25cqw;height:50%;transform-origin:top;animation-name:s-org-d}
.s-org-ld.s-org-d1{left:0;animation-name:s-org-e}.s-org-ld.s-org-d2{left:50%}.s-org-ld.s-org-d3{right:0}
@keyframes s-org-a{0%,5%{transform:scaleY(0)}9%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
@keyframes s-org-b{0%,14%{transform:scaleY(0)}17%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
@keyframes s-org-c{0%,16%{transform:scaleX(0)}21%,95%{transform:scaleX(1)}99%,100%{transform:scaleX(0)}}
@keyframes s-org-d{0%,20%{transform:scaleY(0)}24%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
@keyframes s-org-e{0%,59%{transform:scaleY(0)}62%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
.s-org-grupos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:3cqw;width:100%;align-items:start}
.s-org-g{display:flex;justify-content:center}
.s-org-g:nth-child(1){--c:#7B61FF;--f:#EFEBFF}.s-org-g:nth-child(2){--c:#2F6FED;--f:#E8F0FE}.s-org-g:nth-child(3){--c:#E8710A;--f:#FEEFE3}
/* El lugar para invitar: aparece, el cursor le hace clic, se hunde y dice «Invitación enviada». */
.s-org-inv{position:relative;margin-top:2.6cqw;display:grid;border:.2cqw dashed #B8C2D6;border-radius:99px;padding:1cqw 2.4cqw;font-size:1.4cqw;font-weight:700;color:#6B7280;background:#fff;opacity:0;animation:s-org-inv ${CICLO}s infinite}
.s-org-inv>span{grid-area:1/1;display:flex;align-items:center;justify-content:center;gap:.8cqw;white-space:nowrap}
.s-org-inv svg{width:1.9cqw;height:1.9cqw}
.s-org-inv-1{animation:s-org-t1 ${CICLO}s infinite}
.s-org-inv-2{color:#1E8E3E;opacity:0;animation:s-org-t2 ${CICLO}s infinite}
@keyframes s-org-inv{0%,34%{opacity:0;transform:none}38%,55%{opacity:1;transform:none}56.5%{transform:scale(.93)}58%,95%{opacity:1;transform:none}99%,100%{opacity:0}}
@keyframes s-org-t1{0%,57%{opacity:1}59%,100%{opacity:0}}
@keyframes s-org-t2{0%,58%{opacity:0}60%,95%{opacity:1}99%,100%{opacity:0}}
/* El cursor: entra desde abajo a la derecha, hace clic en el botón y se va. */
.s-org-cur{position:absolute;left:0;top:0;width:3cqw;height:3cqw;opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));animation:s-org-cur ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
@keyframes s-org-cur{0%,42%{opacity:0;transform:translate(92cqw,64cqw)}45%{opacity:1;transform:translate(86cqw,60cqw)}55%{opacity:1;transform:translate(51cqw,var(--y))}56.5%{transform:translate(51cqw,var(--y)) scale(.85)}58%{transform:translate(51cqw,var(--y))}64%{opacity:1;transform:translate(64cqw,calc(var(--y) + 3cqw))}68%,100%{opacity:0;transform:translate(64cqw,calc(var(--y) + 3cqw))}}
@media (prefers-reduced-motion:reduce){.s-org-p,.s-org-inv,.s-org-l i{animation:none!important;opacity:1;transform:none}.s-org-cur,.s-org-inv-1{display:none}.s-org-inv-2{animation:none;opacity:1}}
/* En una caja chica (el teléfono): las caras y los nombres más grandes, sin las pestañas. */
@container (max-width:480px){.s-org-in{padding:2.4cqw 2.4cqw}.s-org-p{min-width:0;width:100%;padding:1.2cqw 1cqw;border-radius:2.4cqw}.s-org-ceo .s-org-p,.s-org-coo .s-org-p{width:auto;min-width:24cqw}.s-org-p{padding:.8cqw 1cqw;gap:0}.s-org-p img{width:5cqw;height:5cqw;margin-bottom:.3cqw}.s-org-p b{font-size:2.2cqw}.s-org-p small{font-size:1.7cqw}.s-org-perm{display:none}.s-org-l{height:3.4cqw}.s-org-l.s-org-l-1{height:2.2cqw}.s-org-inv{margin-top:1.6cqw}.s-org-grupos{gap:1.8cqw}.s-org-inv{font-size:2.2cqw;padding:1.4cqw 3cqw}.s-org-inv svg{width:2.8cqw;height:2.8cqw}.s-org-nuevo{font-size:1.8cqw}.s-org-cur{width:4.4cqw;height:4.4cqw}}
`;
const CSS_TIEMPOS = ENTRADAS.map((e, i) => `@keyframes s-org-e${i}{0%,${e}%{opacity:0;transform:translateY(1.2cqw) scale(.96)}${e + 4}%,95%{opacity:1;transform:none}99%,100%{opacity:0;transform:none}}`).join('\n');

function Tarjeta({ p, n }: { p: Persona; n: number }) {
  return (
    <div className="s-org-p" style={{ animationName: `s-org-e${n}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.foto} alt="" />
      <b>{p.nombre}</b>
      <small>{p.rol}</small>
      <span className="s-org-perm">{p.permisos.join(' · ')}</span>
      {p.nuevo && <em className="s-org-nuevo">Nuevo</em>}
    </div>
  );
}

export function OrganigramaEquipo() {
  return (
    <div className="s-org" data-tema-fijo="" role="img"
      aria-label="El organigrama de un equipo de ventas en MaKo: Mauricio como CEO, su mano derecha, el closer y el media buyer, cada uno con sus pestañas, y la invitación a un setter nuevo">
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_TIEMPOS }} />
      <div className="s-org-in" aria-hidden="true">
        <div className="s-org-ceo"><Tarjeta p={CEO} n={0} /></div>
        <div className="s-org-l s-org-l-1"><i className="s-org-lv" /></div>
        <div className="s-org-coo"><Tarjeta p={COO} n={1} /></div>
        <div className="s-org-l s-org-l-2"><i className="s-org-lv" /><i className="s-org-lh" /><i className="s-org-ld s-org-d1" /><i className="s-org-ld s-org-d2" /><i className="s-org-ld s-org-d3" /></div>
        <div className="s-org-grupos">
          {EQUIPO.map((p, i) => <div key={p.nombre} className="s-org-g"><Tarjeta p={p} n={i + 2} /></div>)}
        </div>
        <div className="s-org-inv">
          <span className="s-org-inv-1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>Invitar a alguien más</span>
          <span className="s-org-inv-2"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>Invitación enviada</span>
        </div>
      </div>
      <svg className="s-org-cur" viewBox="0 0 24 24" aria-hidden="true" style={{ ['--y' as string]: '56cqw' }}>
        <path d="M4 2.5v17.2l4.6-4.4 3.1 6.9 3-1.4-3.1-6.8h6.3z" fill="#12151B" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
