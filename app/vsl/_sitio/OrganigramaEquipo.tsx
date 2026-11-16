// =============================================================================
// Equipo: el organigrama de un equipo de ventas en MaKo, animado (16/11/2026)
// =============================================================================
// Martín: «no quiero ver un formulario… como si fuera un organigrama… que se vea lindo»; «saca imágenes de internet»; «no tiene que
// ser un organigrama súper complejo… el closer, el setter, el media buyer… la mano derecha o el COO»; «la persona inicial, que sería
// CEO… una foto de Mauricio»; «no me gustan los chips… el nombre está por arriba de la foto»; y «que el nuevo esté al final… al
// principio sean solamente dos y cuando se agrega el tercero… que se desplacen los otros… cuando le dé a agregar… un pequeño
// formulario de nombre, email… está todo muy chiquito… jugar con los zoom».
// Las caras: Mauricio (el caso del sitio) y, para el resto, retratos de randomuser.me (el banco de fotos de prueba de
// lib/prueba-personas.ts) guardados en public/vsl-assets/sitio/equipo/; los nombres del resto, inventados. Lo que dice cada uno es lo
// que hace la función de verdad: cada rol entra sólo a sus pestañas.
// El ciclo (14 s, sólo CSS): entran Mauricio, su mano derecha y su equipo (el closer y el media buyer); el cursor hace clic en
// «Invitar a alguien más»; se abre el formulario y se escribe solo (nombre, email, rol); clic en «Enviar invitación»; sale el aviso y
// el setter entra AL FINAL de la fila (los otros dos se corren) mientras la cámara se acerca a la fila. En unidades del contenedor
// (cqw): entra igual en la computadora y en el teléfono. `data-tema-fijo`: el sol y la luna no lo toca.

type Persona = { nombre: string; rol: string; foto: string; permisos: readonly string[]; nuevo?: boolean };

const FOTO = (n: number) => `/vsl-assets/sitio/equipo/cara-${n}.jpg`;
const CEO: Persona = { nombre: 'Mauricio', rol: 'CEO', foto: '/vsl-assets/sitio/avatar/mauricio-foto.jpg', permisos: ['Todo MaKo'] };
const COO: Persona = { nombre: 'Sofía', rol: 'Mano derecha · COO', foto: FOTO(1), permisos: ['Equipo', 'CRM', 'Closing'] };
/** El equipo, en su orden en la fila: el closer, el media buyer y, al final, el setter que se invita en la animación. */
const EQUIPO: readonly Persona[] = [
  { nombre: 'Camila', rol: 'Closer', foto: FOTO(3), permisos: ['Closing', 'CRM'] },
  { nombre: 'Lucas', rol: 'Media buyer', foto: FOTO(4), permisos: ['Anuncios', 'Create'] },
  { nombre: 'Diego', rol: 'Setter', foto: FOTO(2), permisos: ['Chats', 'Agenda'], nuevo: true },
];
const CICLO = 14;
/** En qué % del ciclo entra cada tarjeta: Mauricio, la mano derecha, el closer, el media buyer y el setter (después de enviar). */
const ENTRADAS = [0, 7, 16, 19, 66];

const CSS = `
.s-org{container-type:inline-size;position:absolute;inset:0;overflow:hidden;color:#12151B;font-family:inherit;background:radial-gradient(circle at 1px 1px,rgba(18,21,27,.07) 1px,transparent 0) 0 0/2.4cqw 2.4cqw,#F4F6FA}
/* La cámara: cuando entra el nuevo, se acerca a la fila del equipo. */
.s-org-cam{position:absolute;inset:0;transform-origin:50% 75%;animation:s-org-zoom ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
@keyframes s-org-zoom{0%,62%{transform:none}71%,95%{transform:scale(1.28)}100%{transform:none}}
.s-org-in{position:absolute;inset:0;padding:1.6cqw 4cqw;display:flex;flex-direction:column;align-items:center;justify-content:center}
/* Cada persona, como en un organigrama: la foto arriba, el nombre y el rol centrados, y debajo de una línea fina sus pestañas. */
.s-org-p{position:relative;display:flex;flex-direction:column;align-items:center;text-align:center;width:18cqw;background:#fff;border:1px solid #E5E8EF;border-radius:1.8cqw;padding:1cqw 1.2cqw .9cqw;box-shadow:0 .7cqw 1.8cqw -1cqw rgba(18,21,27,.28);opacity:0;transform:translateY(1.2cqw) scale(.96);animation:${CICLO}s cubic-bezier(.3,0,.2,1) infinite}
.s-org-p img{flex:none;width:5.4cqw;height:5.4cqw;margin-bottom:.5cqw;border-radius:50%;object-fit:cover;box-shadow:0 0 0 .25cqw #fff,0 0 0 .5cqw var(--c)}
.s-org-p b{font-size:1.9cqw;line-height:1.15;font-weight:800;white-space:nowrap}
.s-org-p small{font-size:1.35cqw;line-height:1.45;font-weight:600;color:#6B7280;white-space:nowrap}
.s-org-perm{display:block;align-self:stretch;margin-top:.5cqw;padding-top:.5cqw;border-top:1px solid #EEF0F4;font-size:1.2cqw;line-height:1.4;font-weight:700;color:var(--c);white-space:nowrap}
.s-org-nuevo{position:absolute;top:-1.1cqw;right:-1.1cqw;font-style:normal;font-size:1.2cqw;font-weight:800;color:#fff;background:#34A853;padding:.35cqw .9cqw;border-radius:99px}
.s-org-ceo{--c:#F2B01E}.s-org-coo{--c:#12B5CB}
/* Las líneas: de Mauricio a la mano derecha, de ella a la fila, y la de la fila, que se estira cuando entra el tercero. */
.s-org-l{flex:none;width:.25cqw;height:2.6cqw;background:#C9D2E3;transform-origin:top;animation:${CICLO}s infinite}
.s-org-l1{animation-name:s-org-a}.s-org-l2{height:2cqw;animation-name:s-org-b}
@keyframes s-org-a{0%,4%{transform:scaleY(0)}7%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
@keyframes s-org-b{0%,11%{transform:scaleY(0)}13%,95%{transform:scaleY(1)}99%,100%{transform:scaleY(0)}}
.s-org-fila{position:relative;display:flex;justify-content:center;gap:3cqw;padding-top:2cqw}
.s-org-bus{position:absolute;top:0;left:50%;height:.25cqw;width:21cqw;background:#C9D2E3;transform:translateX(-50%) scaleX(0);animation:s-org-bus ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
@keyframes s-org-bus{0%,13%{width:21cqw;transform:translateX(-50%) scaleX(0)}16%,63%{width:21cqw;transform:translateX(-50%) scaleX(1)}69%,95%{width:42cqw;transform:translateX(-50%) scaleX(1)}99%,100%{width:42cqw;transform:translateX(-50%) scaleX(0)}}
.s-org-g{position:relative;flex:none;width:18cqw}
.s-org-g::before{content:'';position:absolute;left:50%;top:-2cqw;width:.25cqw;height:2cqw;background:#C9D2E3}
.s-org-g:nth-child(2){--c:#2F6FED}.s-org-g:nth-child(3){--c:#E8710A}.s-org-g:nth-child(4){--c:#7B61FF}
/* El lugar del nuevo: no ocupa nada hasta que se envía la invitación; entonces crece y los otros dos se corren a la izquierda. */
.s-org-g.s-org-g-nuevo{width:0;margin-left:-3cqw;animation:s-org-lugar ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
.s-org-g-nuevo::before{opacity:0;animation:s-org-gota ${CICLO}s infinite}
@keyframes s-org-lugar{0%,63%{width:0;margin-left:-3cqw}69%,96%{width:18cqw;margin-left:0}100%{width:0;margin-left:-3cqw}}
@keyframes s-org-gota{0%,67%{opacity:0}69%,95%{opacity:1}99%,100%{opacity:0}}
/* El botón para invitar: aparece, el cursor le hace clic y se va cuando se abre el formulario. */
.s-org-inv{margin-top:2cqw;display:flex;align-items:center;gap:.8cqw;border:.2cqw dashed #B8C2D6;border-radius:99px;padding:1cqw 2.4cqw;font-size:1.5cqw;font-weight:700;color:#6B7280;background:#fff;white-space:nowrap;opacity:0;animation:s-org-inv ${CICLO}s infinite}
.s-org-inv svg{width:2cqw;height:2cqw}
@keyframes s-org-inv{0%,25%{opacity:0;transform:none}28%,36.5%{opacity:1;transform:none}38%{opacity:1;transform:scale(.92)}39.5%{opacity:1;transform:none}42%,100%{opacity:0;transform:none}}
/* El formulario: se abre grande en el medio, se escribe solo y se envía. */
.s-org-velo{position:absolute;inset:0;background:rgba(18,21,27,.28);opacity:0;animation:s-org-velo ${CICLO}s infinite}
@keyframes s-org-velo{0%,39%{opacity:0}42%,59%{opacity:1}62%,100%{opacity:0}}
.s-org-form{position:absolute;left:50%;top:50%;width:46cqw;padding:2.6cqw 3cqw;border-radius:2cqw;background:#fff;box-shadow:0 2cqw 5cqw -2cqw rgba(0,0,0,.45);display:flex;flex-direction:column;gap:1.3cqw;opacity:0;transform:translate(-50%,-46%) scale(.92);animation:s-org-form ${CICLO}s cubic-bezier(.3,0,.2,1) infinite}
@keyframes s-org-form{0%,39%{opacity:0;transform:translate(-50%,-46%) scale(.92)}43%,59%{opacity:1;transform:translate(-50%,-50%)}62%,100%{opacity:0;transform:translate(-50%,-54%) scale(.96)}}
.s-org-form-t{margin:0 0 .4cqw;font-size:2.3cqw;font-weight:800}
.s-org-campo{display:flex;flex-direction:column;gap:.5cqw;font-size:1.35cqw;font-weight:700;color:#6B7280}
.s-org-campo>span{display:flex;align-items:center;justify-content:space-between;height:4.2cqw;padding:0 1.4cqw;border:1px solid #D7DCE6;border-radius:1cqw;font-size:1.8cqw;font-weight:600;color:#12151B}
.s-org-campo svg{width:2cqw;height:2cqw;color:#6B7280}
.s-org-tip{font-style:normal;white-space:nowrap;clip-path:inset(0 100% 0 0)}
.s-org-tip1{animation:s-org-tip1 ${CICLO}s steps(5) infinite}
.s-org-tip2{animation:s-org-tip2 ${CICLO}s steps(19) infinite}
@keyframes s-org-tip1{0%,44%{clip-path:inset(0 100% 0 0)}48%,100%{clip-path:inset(0 0 0 0)}}
@keyframes s-org-tip2{0%,48.5%{clip-path:inset(0 100% 0 0)}54.5%,100%{clip-path:inset(0 0 0 0)}}
.s-org-btn{margin-top:.6cqw;display:flex;align-items:center;justify-content:center;height:4.6cqw;border-radius:1cqw;background:#2F6FED;color:#fff;font-size:1.8cqw;font-weight:800;animation:s-org-btn ${CICLO}s infinite}
@keyframes s-org-btn{0%,57%{transform:none}58%{transform:scale(.95)}59%,100%{transform:none}}
/* El aviso de arriba, cuando se envió. */
.s-org-aviso{position:absolute;left:50%;top:3cqw;display:flex;align-items:center;gap:1cqw;padding:1.1cqw 2.2cqw;border-radius:99px;background:#12151B;color:#fff;font-size:1.6cqw;font-weight:700;white-space:nowrap;opacity:0;transform:translate(-50%,-1cqw);animation:s-org-aviso ${CICLO}s infinite}
.s-org-aviso svg{width:2cqw;height:2cqw;color:#34A853}
@keyframes s-org-aviso{0%,60%{opacity:0;transform:translate(-50%,-1cqw)}63%,82%{opacity:1;transform:translate(-50%,0)}86%,100%{opacity:0;transform:translate(-50%,0)}}
/* El cursor: va al botón de invitar, le hace clic, después al de enviar, clic, y se va. */
.s-org-cur{position:absolute;left:0;top:0;width:3.2cqw;height:3.2cqw;opacity:0;filter:drop-shadow(0 .3cqw .5cqw rgba(0,0,0,.25));animation:s-org-cur ${CICLO}s cubic-bezier(.45,0,.2,1) infinite}
@keyframes s-org-cur{0%,27%{opacity:0;transform:translate(90cqw,64cqw)}29%{opacity:1;transform:translate(84cqw,60cqw)}36.5%{opacity:1;transform:translate(51cqw,var(--y1))}38%{transform:translate(51cqw,var(--y1)) scale(.85)}39.5%{transform:translate(51cqw,var(--y1))}44%{transform:translate(70cqw,44cqw)}55%{transform:translate(70cqw,44cqw)}57%{opacity:1;transform:translate(52cqw,var(--y2))}58%{transform:translate(52cqw,var(--y2)) scale(.85)}59%{transform:translate(52cqw,var(--y2))}63%{opacity:1;transform:translate(66cqw,58cqw)}66%,100%{opacity:0;transform:translate(66cqw,58cqw)}}
@media (prefers-reduced-motion:reduce){.s-org-cam,.s-org-p,.s-org-l,.s-org-bus{animation:none!important;opacity:1;transform:none}.s-org-bus{transform:translateX(-50%);width:42cqw}.s-org-g.s-org-g-nuevo{animation:none;width:18cqw;margin-left:0}.s-org-g-nuevo::before{animation:none;opacity:1}.s-org-cur,.s-org-velo,.s-org-form,.s-org-inv,.s-org-aviso{display:none}}
/* En una caja chica (el teléfono): sin las pestañas, con las letras y el formulario más grandes. */
@container (max-width:480px){.s-org-cam{animation:none}.s-org-p{width:26cqw;padding:1.2cqw 1cqw;border-radius:2.4cqw}.s-org-p img{width:7cqw;height:7cqw}.s-org-p b{font-size:2.8cqw}.s-org-p small{font-size:2cqw}.s-org-perm{display:none}
.s-org-g{width:26cqw}.s-org-fila{gap:2.4cqw}.s-org-g.s-org-g-nuevo{margin-left:-2.4cqw;animation-name:s-org-lugar-tel}
.s-org-inv{font-size:2.4cqw;padding:1.4cqw 3cqw}.s-org-inv svg{width:3cqw;height:3cqw}.s-org-nuevo{font-size:2cqw}
.s-org-form{width:70cqw;gap:1.6cqw}.s-org-form-t{font-size:3.4cqw}.s-org-campo{font-size:2.2cqw}.s-org-campo>span{height:6cqw;font-size:2.8cqw}.s-org-btn{height:6.4cqw;font-size:2.8cqw}.s-org-aviso{font-size:2.6cqw}.s-org-cur{width:4.6cqw;height:4.6cqw}}
@keyframes s-org-lugar-tel{0%,63%{width:0;margin-left:-2.4cqw}69%,96%{width:26cqw;margin-left:0}100%{width:0;margin-left:-2.4cqw}}
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

const Mas = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
const Ok = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

export function OrganigramaEquipo() {
  return (
    <div className="s-org" data-tema-fijo="" role="img"
      aria-label="El organigrama de un equipo de ventas en MaKo: Mauricio como CEO, su mano derecha, el closer y el media buyer; con un clic en invitar se completa el formulario y entra un setter nuevo al final">
      <style dangerouslySetInnerHTML={{ __html: CSS + CSS_TIEMPOS }} />
      <div className="s-org-cam" aria-hidden="true">
        <div className="s-org-in">
          <div className="s-org-ceo"><Tarjeta p={CEO} n={0} /></div>
          <i className="s-org-l s-org-l1" />
          <div className="s-org-coo"><Tarjeta p={COO} n={1} /></div>
          <i className="s-org-l s-org-l2" />
          <div className="s-org-fila">
            <span className="s-org-bus" />
            {EQUIPO.map((p, i) => (
              <div key={p.nombre} className={`s-org-g${p.nuevo ? ' s-org-g-nuevo' : ''}`}><Tarjeta p={p} n={i + 2} /></div>
            ))}
          </div>
          <span className="s-org-inv"><Mas />Invitar a alguien más</span>
        </div>
      </div>
      <div className="s-org-velo" aria-hidden="true" />
      <div className="s-org-form" aria-hidden="true">
        <p className="s-org-form-t">Invitar a tu equipo</p>
        <span className="s-org-campo">Nombre<span><i className="s-org-tip s-org-tip1">Diego</i></span></span>
        <span className="s-org-campo">Email<span><i className="s-org-tip s-org-tip2">diego@tuempresa.com</i></span></span>
        <span className="s-org-campo">Rol<span>Setter<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg></span></span>
        <span className="s-org-btn">Enviar invitación</span>
      </div>
      <span className="s-org-aviso" aria-hidden="true"><Ok />Invitación enviada a Diego</span>
      <svg className="s-org-cur" viewBox="0 0 24 24" aria-hidden="true" style={{ ['--y1' as string]: '58cqw', ['--y2' as string]: '44cqw' }}>
        <path d="M4 2.5v17.2l4.6-4.4 3.1 6.9 3-1.4-3.1-6.8h6.3z" fill="#12151B" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
