// Chunquea TODO el guión y calcula tiempos desde funnel-align.json.
// v2: beats CORTOS (máx 2 líneas) + emojis + fondos azules.
// Escribe chunks-full.js con window.FULL_CH=[{s,e,text,emph,type,side,emoji,bg,big}]
const fs=require('fs');
const align=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const OUT=process.argv[3];
const words=align.words;
// reconstruir string + char->word
let S=''; const idx=[];
words.forEach((w,wi)=>{const t=w.text||'';for(let k=0;k<t.length;k++)idx.push(wi);S+=t;});
function tAt(pos,which){const wi=idx[Math.max(0,Math.min(pos,idx.length-1))];return which==='s'?words[wi].start:words[wi].end;}

// a=audio (para matchear), d=display (opcional), emph=palabras resaltadas,
// emoji=arriba del título, icon=ícono/logo arriba del título (anim/icons2/<icon>),
// bg='blue' invierte el fondo, big=título gigante, video='burnout' = video de stock a
// pantalla completa detrás del texto, flow=1|2 = animación ojo→dinero
const C=[
 // ── HOOK ──
 {a:"Dime la verdad.", emph:["verdad"], emoji:"👀"},
 {a:"Hoy en día, para ver cómo va tu negocio,", emph:["negocio"]},
 {a:"tienes que saltar entre"},
 {a:"seis pestañas diferentes, ¿no?", emph:["seis","pestañas"], emoji:"😵‍💫"},
 {a:"Meta. Tu vsl. Calendly. WhatsApp.", type:"logos"},
 {a:"Y un Excel que rehaces", emph:["Excel"], icon:"excel.svg"},
 {a:"cada vez que necesitas medir algo nuevo."},
 {a:"Y ahí estás,", video:"burnout"},
 {a:"tratando de entender qué está pasando.", emph:["qué","está","pasando"], video:"burnout"},
 // ── DOLOR ──
 {a:"Y no es que te falten datos.", emph:["datos"]},
 {a:"De hecho, te sobran.", emph:["sobran"]},
 {a:"El problema es que están todos sueltos.", emph:["sueltos"], emoji:"🤯"},
 {a:"Así que te hago una pregunta incómoda:", emph:["incómoda"], emoji:"🤔"},
 {a:"¿puedes ver tu negocio entero ahora mismo?", emph:["entero"], bg:"blue"},
 {a:"Porque si para responder eso"},
 {a:"tienes que abrir cinco herramientas,", emph:["cinco","herramientas"]},
 {a:"mirar grabaciones, revisar chats"},
 {a:"y cruzar datos a mano…", emph:["mano"]},
 {a:"No tienes un sistema.", emph:["sistema"], bg:"blue"},
 {a:"Tienes una intuición.", emph:["intuición"], bg:"blue", emoji:"🎲"},
 {a:"Y la intuición puede servir para empezar.", emph:["empezar"]},
 {a:"Pero para escalar, se queda corta.", emph:["corta"]},
 // ── SOLUCIÓN ──
 {a:"Y aquí es donde entra Máko.", d:"Y aquí es donde entra MaKo.", emoji:"⚡"},
 {a:"Máko conecta tu funnel completo", d:"MaKo conecta tu funnel completo"},
 {a:"en un solo lugar.", emph:["solo","lugar"]},
 {a:"Desde que tu cliente mira tu anuncio,", emph:["anuncio"], flow:1},
 {a:"hasta que te realiza el pago.", emph:["pago"], flow:2},
 {a:"Tus anuncios.", icon:"megaphone.svg"},
 {a:"Tu landing.", icon:"layout-template.svg"},
 {a:"Tu vsl.", d:"Tu VSL.", icon:"circle-play.svg"},
 {a:"Tus agendas.", icon:"calendar-check.svg"},
 {a:"Tu WhatsApp.", icon:"whatsapp.png"},
 {a:"Tus llamadas.", icon:"phone-call.svg"},
 {a:"Todo.", emph:["Todo"], bg:"blue", big:1},
 {a:"En un solo lugar, ordenado y en vivo.", emph:["ordenado","vivo"], emoji:"✅"},
 // ── PROOF ──
 {a:"Y esto no es teoría.", emph:["teoría"]},
 {a:"Mira el caso de Mauricio.", emph:["Mauricio"], side:1},
 {a:"Él ya vendía,", side:1},
 {a:"pero tenía todo en un Excel", emph:["Excel"], side:1, icon:"excel.svg"},
 {a:"que armaba de nuevo cada vez.", side:1},
 {a:"Miraba Meta,", side:1, icon:"meta.png"},
 {a:"después Calendly,", side:1, icon:"calendly.png"},
 {a:"y el resto lo cargaba uno por uno.", emph:["uno","por","uno"], side:1},
 // carrusel: capturas a pantalla completa, SIN texto
 {a:"Cuando conectó su funnel en Máko, por fin lo tuvo todo junto.", type:"carousel"},
 {a:"El mismo negocio, en una sola pantalla.", type:"carousel"},
 // ── OBJECIÓN ──
 {a:"Y si tu objeción es"},
 {a:"\"pero yo ya tengo mis números\","},
 {a:"déjame decirte algo:"},
 {a:"claro que los tienes.", emph:["claro"]},
 {a:"Repartidos en un montón de aplicaciones", emph:["Repartidos"]},
 {a:"que no se hablan entre sí.", emph:["hablan"]},
 {a:"Y eso no es tener tu negocio."},
 {a:"Es tener pedazos.", emph:["pedazos"], bg:"blue", emoji:"🧩"},
 // ── CIERRE ──
 {a:"Tu negocio no está roto."},
 {a:"Está desparramado.", emph:["desparramado"], bg:"blue"},
 {a:"Si estás cansado"},
 {a:"de escalar a ciegas,", emph:["ciegas"]},
 {a:"agenda una llamada en el enlace de abajo.", emph:["agenda"], emoji:"🎯"},
 {a:"Y por fin vas a ver tu negocio completo,", emph:["completo"], icon:"trending-up.svg"},
 {a:"de un solo vistazo.", emph:["vistazo"]}
];

let cur=0, out=[], fail=0;
for(const c of C){
  const p=S.indexOf(c.a,cur);
  if(p<0){console.error('NO MATCH:',JSON.stringify(c.a.slice(0,40)));fail++;continue;}
  const s=+tAt(p,'s').toFixed(3), e=+tAt(p+c.a.length-1,'e').toFixed(3);
  out.push({s:Math.round(s*1000), e:Math.round(e*1000), text:c.d||c.a, emph:c.emph||[],
            type:c.type||null, side:c.side||0, emoji:c.emoji||null, bg:c.bg||null, big:c.big||0,
            icon:c.icon||null, video:c.video||null, flow:c.flow||0});
  cur=p+c.a.length;
}
// e de cada chunk = s del siguiente (texto siempre en pantalla, sin huecos)
for(let i=0;i<out.length-1;i++) out[i].e=out[i+1].s;
out[out.length-1].e=out[out.length-1].e+700;
fs.writeFileSync(OUT,'window.FULL_CH='+JSON.stringify(out)+';\n');
console.log('chunks:',out.length,'| fallos:',fail,'| fin:',out[out.length-1].e,'ms');
const largos=out.filter(c=>!c.type&&c.text.length>46).map(c=>c.text.length+' '+c.text);
console.log('beats >46 chars:',largos.length); largos.forEach(l=>console.log('  ',l));
