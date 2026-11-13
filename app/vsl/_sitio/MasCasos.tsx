// =============================================================================
// «Más casos» de la portada del sitio (13/11/2026)
// =============================================================================
// La llamada de Martín con Leila (13/11/2026): «sumar el caso de Axel y alguno más». No hay datos nuevos: son los cuatro testimonios
// que Martín ya publicó en la portada de antes (app/vsl/landing-html.ts, «Esto dicen los que han trabajado conmigo»), con sus
// palabras textuales, su número y su imagen (public/vsl-assets/testi-*). Son de haber trabajado CON MARTÍN, no del software solo, y
// la sección lo dice así. El video de Axel (testi-axel.mp4) dura 6 s y no cuenta su caso: va mudo, como imagen que se mueve.
// =============================================================================

type Caso = { numero: string; cita: string; quien: string; rubro: string; imagen?: string; video?: string };

const CASOS: readonly Caso[] = [
  { numero: '+US$60k', quien: 'Axel', rubro: 'Agencia de IA', video: '/vsl-assets/testi-axel.mp4', cita: 'Vine con una oferta que no despegaba. Martín la rearmó completa, junto con el sistema de adquisición, y se metió en las decisiones reales, no solo en la estrategia. Terminamos siendo la academia de IA más reconocida de Latam, y sumamos más de $60k USD en el camino.' },
  { numero: '<10k → millones', quien: 'Securiters', rubro: 'Hacking ético', imagen: '/vsl-assets/testi-securiters.png', cita: 'Arrancamos con menos de 10 mil seguidores. Con Martín llegamos a millones de follows y de views, y en el camino cerramos varios lanzamientos de cinco cifras. Lo que aporta no es viralidad por viralidad: es saber convertir esa audiencia en ventas.' },
  { numero: '+200M views', quien: 'QS Media', rubro: 'Canales automatizados de YouTube', imagen: '/vsl-assets/testi-qs.jpg', cita: 'Construimos una operación de canales automatizados en YouTube y Martín fue clave para escalarla. Con un equipo de más de 40 personas superamos los 200 millones de views.' },
  { numero: '+20 nichos', quien: 'Social Media Lab', rubro: 'Agencia de marketing', imagen: '/vsl-assets/testi-sml.jpg', cita: 'Con un equipo de más de 30 personas producíamos contenido viral en más de 20 nichos distintos. La estructura y el criterio para que funcionara a escala lo puso Martín.' },
];

export function MasCasos() {
  return (
    <section className="s-sec s-casos" id="casos">
      <div className="s-cont">
        <div className="s-centro">
          <p className="s-rotulo">Más casos</p>
          <h2 className="s-h2">Lo que dicen los que trabajaron con Martín.</h2>
          <p className="s-lede">Antes de MaKo, Martín armó la oferta, la adquisición y el contenido de estos negocios. Esto dicen ellos.</p>
        </div>
        <div className="s-casos-g">
          {CASOS.map((c, i) => (
            <figure key={c.quien} className="s-casos-c" style={{ ['--i' as string]: i }}>
              <div className="s-casos-media">
                {c.video
                  ? <video src={c.video} muted loop autoPlay playsInline preload="metadata" aria-label={`${c.quien}, en video`} />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={c.imagen} alt={`${c.quien} · ${c.rubro}`} loading="lazy" />}
                <span className="s-casos-n">{c.numero}</span>
              </div>
              <blockquote>«{c.cita}»</blockquote>
              <figcaption><b>{c.quien}</b> · {c.rubro}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export const CSS_MAS_CASOS = `
.s-casos-g{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:clamp(28px,4vw,48px)}
.s-casos-c{margin:0;display:flex;flex-direction:column;border-radius:16px;overflow:hidden;background:#0D0B28;border:1px solid rgba(255,255,255,.08);transition:transform .2s ease,border-color .2s ease;animation:s-casos-entra .5s ease both;animation-delay:calc(var(--i,0)*90ms)}
.s-casos-c:hover{transform:translateY(-4px);border-color:rgba(242,176,30,.45)}
.s-casos-media{position:relative;aspect-ratio:4/3;overflow:hidden;background:#1C1940}
.s-casos-media img,.s-casos-media video{width:100%;height:100%;object-fit:cover;display:block}
.s-casos-n{position:absolute;left:14px;bottom:12px;padding:6px 12px;border-radius:10px;background:rgba(6,4,25,.82);color:#F2B01E;font-weight:800;font-size:20px;line-height:24px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}
.s-casos-c blockquote{margin:0;padding:18px 18px 8px;font-size:15.5px;line-height:23px;color:#E6E3FF;flex:1}
.s-casos-c figcaption{padding:0 18px 18px;font-size:14px;color:#C9C6E0}.s-casos-c figcaption b{color:#fff}
@keyframes s-casos-entra{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (max-width:1100px){.s-casos-g{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.s-casos-g{grid-template-columns:1fr}}
@media (prefers-reduced-motion:reduce){.s-casos-c{animation:none}}
`;
