// =============================================================================
// El botón de sol y luna del sitio público (/vsl/<slug>, /vsl/sitio, /vsl/comparaciones), con el barrido de la app
// =============================================================================
// Martín (12/11/2026): «estaría bueno de que ahí arriba también esté como el botoncito de luna y sol que tenemos, que si se
// aprieta haga la misma animación que tenemos dentro de MaKo, que es como el círculo que se va expandiendo, que hace dark
// mode, etcétera, y que obviamente eso se mantenga» al pasar de una página a otra.
//
// Cómo está hecho, y por qué así:
//   · Es un <script> chico, sin React: estas páginas son server components sin JavaScript, y el visor de Martín (las fotos
//     de scripts/visor-landings/) no tiene React; un script en línea anda en las dos.
//   · El barrido es el de la app (app/_components/barrido-tema.ts): 450 ms, cubic-bezier(.65, 0, .35, 1), desde el botón
//     hasta la esquina más lejana. Las reglas `::view-transition-old/new(root)` ya están en app/globals.css.
//   · Las 19 landings copian 19 diseños, cada uno nacido claro u oscuro: el otro modo se arma invirtiendo sus colores (los
//     neutros cambian de luz, los pálidos pasan a su versión oscura y los muy oscuros a la clara; el color de marca, las
//     fotos y los videos quedan). Es la misma cuenta del visor, que Martín ya vio.
//   · El modo elegido se guarda en `localStorage['mako.sitio.modo']` y cada página lo aplica al abrir: «que se mantenga lo
//     último que hice». Sin elección, cada página queda como nació.
//   · El botón lo pone el script en la barra de arriba de cada página, antes del ÚLTIMO link visible a /planes (el botón
//     para empezar; «Ver planes» va antes), fuera de los menús desplegables (en el teléfono el menú también tiene uno). No es
//     un <button> en el JSX: sin onClick, tests/ningun-boton-muerto.test.ts lo
//     marca. Sin un link a /planes en la barra va antes de su último botón (el menú del teléfono), y si la página no tiene barra
//     flota abajo a la derecha.
// =============================================================================

const LUNA = 'M12.3 22h-.1a10.31 10.31 0 0 1-7.34-3.15 10.46 10.46 0 0 1-.26-14 10.13 10.13 0 0 1 4-2.74 1 1 0 0 1 1.06.22 1 1 0 0 1 .24 1 8.4 8.4 0 0 0 1.94 8.81 8.47 8.47 0 0 0 8.83 1.94 1 1 0 0 1 1.27 1.29A10.16 10.16 0 0 1 19.6 19a10.28 10.28 0 0 1-7.3 3z';
const SOL = 'M12 6a1 1 0 0 0 1-1V3a1 1 0 0 0-2 0v2a1 1 0 0 0 1 1zM21 11h-2a1 1 0 0 0 0 2h2a1 1 0 0 0 0-2zM6 12a1 1 0 0 0-1-1H3a1 1 0 0 0 0 2h2a1 1 0 0 0 1-1zM6.22 5A1 1 0 0 0 4.8 6.42l1.44 1.39a1 1 0 0 0 .73.28 1 1 0 0 0 .72-.31 1 1 0 0 0 0-1.41zM17 8.14a1 1 0 0 0 .69-.28l1.44-1.39A1 1 0 0 0 17.78 5l-1.44 1.42a1 1 0 0 0 0 1.41 1 1 0 0 0 .66.31zM12 18a1 1 0 0 0-1 1v2a1 1 0 0 0 2 0v-2a1 1 0 0 0-1-1zM17.73 16.14a1 1 0 0 0-1.39 1.44L17.78 19a1 1 0 0 0 .69.28 1 1 0 0 0 .72-.31 1 1 0 0 0 0-1.41zM6.27 16.14 4.83 17.53a1 1 0 0 0 0 1.41 1 1 0 0 0 .72.31 1 1 0 0 0 .69-.28l1.44-1.39a1 1 0 0 0-1.41-1.44zM12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4z';

/** La clave en localStorage. Es del sitio público: la app guarda el suyo en `mako.modo` (lib/temas-candidatos.ts). */
export const LS_MODO_SITIO = 'mako.sitio.modo';

const CSS = `
.mk-tema-sitio { position: relative; overflow: hidden; flex: none; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 999px; background: transparent; color: inherit; cursor: pointer; transition: background-color .12s ease; }
.mk-tema-sitio:hover { background: rgba(127,127,127,.16); }
.mk-tema-sitio:focus-visible { outline: 2px solid #2F6FED; outline-offset: 2px; }
.mk-tema-sitio svg { position: absolute; top: 50%; left: 50%; width: 18px; height: 18px; margin: -9px 0 0 -9px; fill: currentColor; transition: transform .4s cubic-bezier(0,0,.58,1); }
.mk-tema-sitio .mk-ts-luna { transform: translateY(0); transition-delay: .2s; }
.mk-tema-sitio .mk-ts-sol { transform: translateY(30px); transition-delay: 0s; }
.mk-tema-sitio[data-modo="oscuro"] .mk-ts-luna { transform: translateY(-30px); transition-delay: 0s; }
.mk-tema-sitio[data-modo="oscuro"] .mk-ts-sol { transform: translateY(0); transition-delay: .2s; }
.mk-tema-sitio-flota { position: fixed; z-index: 2147483000; bottom: calc(16px + env(safe-area-inset-bottom, 0px)); right: calc(16px + env(safe-area-inset-right, 0px)); width: 44px; height: 44px; background: rgba(18,21,27,.78); color: #fff; box-shadow: 0 6px 18px rgba(0,0,0,.25); }
@media (prefers-reduced-motion: reduce) { .mk-tema-sitio svg { transition: none; } }
`;

const SCRIPT = `(function(){
if (window.__mkTemaSitio) return; window.__mkTemaSitio = 1;
var BASE_FIJA = document.currentScript && document.currentScript.getAttribute('data-base');
var LS =${JSON.stringify(LS_MODO_SITIO)}, LUNA = ${JSON.stringify(LUNA)}, SOL = ${JSON.stringify(SOL)};
var RGB = /rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/g;
function hsl(r,g,b){r/=255;g/=255;b/=255;var mx=Math.max(r,g,b),mn=Math.min(r,g,b),h=0,s=0,l=(mx+mn)/2;if(mx!==mn){var d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;}return [h,s,l];}
function rgb(h,s,l){function k(n){return (n+h/30)%12;}var a=s*Math.min(l,1-l);function f(n){return l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));}return [f(0),f(8),f(4)].map(function(v){return Math.round(v*255);});}
function cad(c,a){return a!==undefined?'rgba('+c.join(', ')+', '+a+')':'rgb('+c.join(', ')+')';}
function inv(r,g,b,a){var x=hsl(r,g,b),h=x[0],s=x[1],l=x[2],cr=(Math.max(r,g,b)-Math.min(r,g,b))/255;
  if(cr<.14){var nl=Math.max(.045,Math.min(.975,1-l));return cad(nl<.3?rgb(222,.22,nl):rgb(h,Math.min(s,.25),nl),a);}
  if(l>.82)return cad(rgb(h,s*.55,Math.max(.12,1.06-l)),a);
  if(l<.2)return cad(rgb(h,s*.6,Math.min(.92,.95-l)),a);
  return null;}
function mapear(t){return t.replace(RGB,function(m,r,g,b,a){return inv(+r,+g,+b,a)||m;});}
function transp(c){return !c||c==='transparent'||/rgba\\([^)]*,\\s*0\\)$/.test(c);}
var base = null, actual = null, hechos = [];
// La luz del fondo que tiene detrás un elemento: el primer fondo casi opaco hacia arriba (un blanco al 6 % sobre negro no
// cuenta), mirando también los colores de un degradado. Sin ninguno, la del modo en que está la página.
function luzDe(el){
  while(el&&el.nodeType===1){var cs=getComputedStyle(el),c=cs.backgroundColor;
    if(!transp(c)){var n=(c.match(/[\\d.]+/g)||['255','255','255']).map(Number);if(n.length<4||n[3]>=.5)return hsl(n[0],n[1],n[2])[2];}
    var bi=cs.backgroundImage;
    if(bi&&bi!=='none'){var m=bi.match(RGB);if(m){var t=0,k=0;m.forEach(function(x){var v=x.match(/[\\d.]+/g).map(Number);var a=v.length>3?v[3]:1;if(a>=.5){t+=hsl(v[0],v[1],v[2])[2];k++;}});if(k)return t/k;}}
    el=el.parentElement;}
  return (actual||base)==='oscuro'?0:1;}
function medirBase(){var y=Math.min(260,innerHeight/2)-scrollY;var el=y>0?document.elementFromPoint(innerWidth/2,y):null;if(!el)el=document.body.firstElementChild;
  return luzDe(el)<.5?'oscuro':'claro';}
function poner(n,p,v){hechos.push([n,p,n.style.getPropertyValue(p),n.style.getPropertyPriority(p)]);n.style.setProperty(p,v,'important');}
function deshacer(){for(var i=hechos.length-1;i>=0;i--){var x=hechos[i];if(x[2])x[0].style.setProperty(x[1],x[2],x[3]);else x[0].style.removeProperty(x[1]);}hechos=[];}
function invertir(){
  var todos=[].slice.call(document.querySelectorAll('body, body *'));
  // Los logos no se invierten: ni las fotos ni los SVG de marca (sus <symbol>, que dibujan la «f» blanca de Facebook: invertida
  // quedaba negra, Martín 12/11/2026).
  // Y el recuadro de color de un logo (el negro de TikTok, el blanco de Cal.com): invertido, el logo quedaba del mismo color.
  // Sólo si no tiene texto: el renglón de la tira («logo + nombre») sí se invierte, o el nombre queda blanco sobre blanco.
  var esRecuadro=function(n){return n.children.length===1&&!n.textContent.trim()&&n.firstElementChild.matches('svg:has(use), img');};
  var fuera=function(n){return esRecuadro(n)||n.closest('[aria-label^="MaKo"], img, video, picture, canvas, iframe, symbol, defs, svg:has(use), .mk-tema-sitio, script, style');};
  var BOR=['border-top-color','border-bottom-color','border-left-color','border-right-color','outline-color'],TXT=['color','fill','stroke','text-decoration-color'];
  var leidos=todos.filter(function(n){return !fuera(n);}).map(function(n){var cs=getComputedStyle(n),o={n:n,bg:cs.backgroundColor,bi:cs.backgroundImage};BOR.concat(TXT).forEach(function(p){o[p]=cs.getPropertyValue(p);});return o;});
  var fondo=new Map(),quieto=new Set();
  leidos.forEach(function(o){if(!transp(o.bg)){var nb=mapear(o.bg);if(nb!==o.bg)fondo.set(o.n,nb);else quieto.add(o.n);}
    // Un botón con degradado de color de marca (tonos medios, que no se invierten) conserva el color de su texto.
    if(o.bi&&o.bi.indexOf('gradient')>=0){var cs2=o.bi.match(RGB)||[],r2=o.n.getBoundingClientRect();if(r2.width<480&&r2.height<140&&cs2.some(function(c){return mapear(c)===c;}))quieto.add(o.n);}});
  leidos.forEach(function(o){var n=o.n;
    if(fondo.has(n))poner(n,'background-color',fondo.get(n));
    if(o.bi&&o.bi!=='none'&&o.bi.indexOf('gradient')>=0){var v=mapear(o.bi);if(v!==o.bi)poner(n,'background-image',v);}
    BOR.forEach(function(p){var v=o[p];if(v){var nv=mapear(v);if(nv!==v)poner(n,p,nv);}});
    var a=n,q=false;while(a){if(quieto.has(a)){q=true;break;}if(fondo.has(a))break;a=a.parentElement;}
    if(q)return;
    TXT.forEach(function(p){var v=o[p];if(!v||v==='none')return;var nv=mapear(v);if(nv!==v)poner(n,p,nv);});});
  var os=actual==='oscuro';
  [].forEach.call(document.querySelectorAll('[aria-label^="MaKo"]'),function(a){poner(a,'color',os?'#ffffff':'#12151B');var cu=a.querySelector('span');if(cu)poner(cu,'background',os?'rgba(255,255,255,.12)':'#1A1712');[].forEach.call(a.querySelectorAll('span'),function(t){if(t!==cu)poner(t,'color',os?'#ffffff':'#12151B');});});
  poner(document.documentElement,'color-scheme',os?'dark':'light');
  if(!document.documentElement.style.backgroundColor)poner(document.documentElement,'background-color',os?'#0e1219':'#ffffff');}
function botones(){[].forEach.call(document.querySelectorAll('[data-tema-sitio-boton]'),function(b){b.setAttribute('data-modo',actual);if(!b.classList.contains('mk-tema-sitio-flota'))b.style.color=luzDe(b.parentElement)<.5?'#ffffff':'#12151B';b.setAttribute('aria-pressed',String(actual==='oscuro'));var t=actual==='oscuro'?'Pasar a modo claro':'Pasar a modo oscuro';b.setAttribute('aria-label',t);b.title=t;});}
function aplicar(m){deshacer();actual=m;if(m!==base)invertir();botones();document.documentElement.setAttribute('data-sitio-modo',m);try{window.dispatchEvent(new Event('mako-sitio-modo'));}catch(e){}}
function barrido(b,cambiar){var d=document;if(!d.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){cambiar();return;}
  var r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,ra=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  d.startViewTransition(cambiar).ready.then(function(){d.documentElement.animate({clipPath:['circle(0px at '+x+'px '+y+'px)','circle('+ra+'px at '+x+'px '+y+'px)']},{duration:450,easing:'cubic-bezier(.65, 0, .35, 1)',pseudoElement:'::view-transition-new(root)'});}).catch(function(){});}
function boton(){var b=document.createElement('button');b.type='button';b.className='mk-tema-sitio';b.setAttribute('data-tema-sitio-boton','');
  b.innerHTML='<svg class="mk-ts-luna" viewBox="0 0 24 24" aria-hidden="true"><path d="'+LUNA+'"/></svg><svg class="mk-ts-sol" viewBox="0 0 24 24" aria-hidden="true"><path d="'+SOL+'"/></svg>';return b;}
function visible(a){return a.offsetParent!==null&&!a.closest('details, [role="menu"], [aria-modal]');}
function barraDeArriba(){var mejor=null;[].forEach.call(document.querySelectorAll('header, nav, [class*="barra"], [class*="nav"]'),function(e){var r=e.getBoundingClientRect();
    if(r.height>0&&r.height<170&&r.top<130&&r.width>innerWidth*.6&&(!mejor||r.top<mejor.r.top-1||(Math.abs(r.top-mejor.r.top)<=1&&r.width*r.height<mejor.r.width*mejor.r.height)))mejor={e:e,r:r};});
  return mejor&&mejor.e;}
// Dónde va: DESPUÉS del botón para empezar de la barra, a la derecha del todo (Martín, 12/11/2026); si la barra no lo muestra (el teléfono), antes de lo que está más a la
// derecha (el ☰ del menú, que puede no ser un link); y si a la derecha no hay nada, al final de la barra, empujado a la derecha.
function ubicar(){if(document.querySelector('[data-tema-sitio-boton]'))return;
  var barra=barraDeArriba(),b=boton(),ref=null;
  var despues=false;
  if(barra){var cta=[].filter.call(barra.querySelectorAll('a[href="/planes"]'),visible);ref=cta[cta.length-1];despues=!!ref;
    if(!ref){var der=null;[].forEach.call(barra.querySelectorAll('*'),function(e){if(e.offsetParent===null&&!(e instanceof SVGElement))return;if(e.closest('[role="menu"], [aria-modal]')||(e.closest('details')&&!e.closest('summary')))return;var r=e.getBoundingClientRect();
        if(r.width<1||r.height<1||r.width>innerWidth*.45||r.left<innerWidth*.45)return;
        if(!der||r.right>der.r.right+1||(Math.abs(r.right-der.r.right)<=1&&r.width>der.r.width))der={e:e,r:r};});
      ref=der&&der.e;while(ref&&ref instanceof SVGElement)ref=ref.parentElement;
      // Hasta la caja entera de eso (el <details> del menú, no el ☰ de adentro): el botón va AL LADO, nunca adentro.
      while(ref&&ref.parentElement&&ref.parentElement!==barra&&barra.contains(ref.parentElement)){var pr=ref.parentElement.getBoundingClientRect();if(Math.abs(pr.right-der.r.right)<=2&&pr.width<=innerWidth*.45)ref=ref.parentElement;else break;}}}
  if(ref){var padre=ref.parentNode;
    if(padre.tagName==='LI'){var li=document.createElement('li');li.style.display='flex';li.style.alignItems='center';li.style.listStyle='none';li.appendChild(b);padre.parentNode.insertBefore(li,padre);}
    else{padre.insertBefore(b,despues?ref.nextSibling:ref);var cs=getComputedStyle(padre);if(cs.display.indexOf('flex')<0&&cs.display.indexOf('grid')<0){b.style.verticalAlign='middle';b.style[despues?'marginLeft':'marginRight']='8px';}}}
  else if(barra){var fila=barra;while(fila.children.length===1&&getComputedStyle(fila).display.indexOf('flex')<0)fila=fila.children[0];
    fila.appendChild(b);if(getComputedStyle(fila).display.indexOf('flex')>=0)b.style.marginLeft='auto';}
  else{b.classList.add('mk-tema-sitio-flota');document.body.appendChild(b);}}
function iniciar(){base=BASE_FIJA==='oscuro'||BASE_FIJA==='claro'?BASE_FIJA:medirBase();document.documentElement.setAttribute('data-sitio-base',base);ubicar();var p=null;try{p=localStorage.getItem(LS);}catch(e){}
  aplicar(p==='oscuro'||p==='claro'?p:base);
  document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-tema-sitio-boton]');if(!b)return;e.preventDefault();var n=actual==='oscuro'?'claro':'oscuro';try{localStorage.setItem(LS,n);}catch(err){}barrido(b,function(){aplicar(n);});});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar);else iniciar();
})();`;

/**
 * Las landings que NACIERON oscuras, mirándolas una por una el 12/11/2026 (su referencia es oscura). Se dice a mano porque
 * medirlo engaña: un hero oscuro pintado con un degradado o con un ::before tiene el fondo «transparente», y la página se
 * leía como clara (Email, Competitor Spy). Una landing nueva oscura se suma acá.
 */
export const LANDINGS_OSCURAS: ReadonlySet<string> = new Set(['cobranza', 'competitor-spy', 'crm', 'email', 'mako', 'offer', 'web-generator']);

/**
 * La barra copiada de cada diseño, que reemplaza la barra del sitio (app/vsl/_sitio/Barra.tsx → BarraGlobal). Medida en cada
 * página a 1440 y a 390 (12/11/2026): es la misma clase en los dos anchos. Un diseño nuevo suma la suya acá; sin ella, su
 * barra queda debajo de la del sitio (el test lo cuida).
 */
export const BARRA_PROPIA: Readonly<Record<string, string>> = {
  ads: '.d-ads-nav', agenda: '.d-agenda-barra', 'ai-avatar': '.d-ai-avatar-barra', cobranza: '.d-cobranza-barra',
  'competitor-spy': '.d-competitor-spy-nav', copywriting: '.d-copywriting-barra', crm: '.d-crm-barra', dashboard: '.d-dashboard-barra',
  email: '.d-email-barra', funnel: '.d-funnel-barra', image: '.d-image-barra', mako: '.d-mako-nav', offer: '.d-offer-nav',
  prioridades: '.d-prioridades-nav', script: '.d-script-nav', seguimiento: '.d-seguimiento-barra', video: '.d-video-barra',
  'web-generator': '.d-wg-nav-fondo', whatsapp: '.d-whatsapp-hdr',
};

/** El estilo y el script: UNA vez por página, al final. `base`: cómo nació la página (sin ella, se mide). */
export function TemaSitio({ base }: { base?: 'claro' | 'oscuro' }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <script data-tema-sitio="" data-base={base} dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </>
  );
}
