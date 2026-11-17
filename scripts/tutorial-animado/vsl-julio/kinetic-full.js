// ===== VSL cinético · fondo blanco, texto negro, énfasis azul, dorado SOLO para MaKo =====
// v3: + íconos/logos reales de apps, video de stock a pantalla completa,
//     animación ojo→dinero, y carrusel como UNA tira con UNA sola curva + zoom.
var CREAM_A='#FFFFFF', CREAM_B='#F0F0F0', INK='#171310', BLUE='#2F6FED', GOLD='#F2A516';
var BLUE_A='#3B7BF5', BLUE_B='#1E4FBF';   // gradiente del fondo azul
var GOLD_1='#F6D365', GOLD_2='#EF9F27';   // gradiente dorado oficial de MaKo
var EMOJI_FONT="'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";

var CH=window.FULL_CH||[];

// ── ventanas de las secciones especiales ──
var CAROUSEL_START=1e9, CAROUSEL_END=0;
var VIDEO_START=1e9, VIDEO_END=0;
var FLOW1_S=0, FLOW2_S=0, FLOW_END=0;
var EXCEL_S=1e9, EXCEL_E=0;
CH.forEach(function(c){
  if(c.type==='carousel'){if(c.s<CAROUSEL_START)CAROUSEL_START=c.s;if(c.e>CAROUSEL_END)CAROUSEL_END=c.e;}
  if(c.video){if(c.s<VIDEO_START)VIDEO_START=c.s;if(c.e>VIDEO_END)VIDEO_END=c.e;}
  if(c.type==='excel'){if(c.s<EXCEL_S)EXCEL_S=c.s;if(c.e>EXCEL_E)EXCEL_E=c.e;}
  if(c.flow===1)FLOW1_S=c.s;
  if(c.flow===2){FLOW2_S=c.s;FLOW_END=c.e;}
});

var CARDS=[];      // capturas de la app
var ICONS={};      // íconos y logos (svg/png)
var BO=[];         // frames del video de burnout

// flood de logos reales (../logos2). name, tiempo de aparición, posición (frac), rotación (grados)
var FLOOD=[
  {n:'meta',     s:6100, x:0.185,y:0.30, r:-7},
  {n:'youtube',  s:6360, x:0.405,y:0.215,r:5},
  {n:'gmail',    s:6620, x:0.625,y:0.285,r:-5},
  {n:'docs',     s:6880, x:0.83, y:0.24, r:8},
  {n:'meet',     s:7150, x:0.285,y:0.55, r:6},
  {n:'calendly', s:7580, x:0.51, y:0.485,r:-4},
  {n:'sheets',   s:7820, x:0.725,y:0.55, r:7},
  {n:'claude',   s:8050, x:0.155,y:0.75, r:-8},
  {n:'whatsapp', s:8280, x:0.44, y:0.78, r:4},
  {n:'panda',    s:8560, x:0.685,y:0.795,r:-6}
];

var ICON_FILES=['excel.svg','megaphone.svg','layout-template.svg','circle-play.svg',
                'calendar-check.svg','whatsapp.png','phone-call.svg','meta.png',
                'calendly.png','eye.svg','banknote.svg','trending-up.svg'];
var BO_DIR=(typeof window!=='undefined'&&window.BO_DIR)||'bo';
var BO_FRAMES=(typeof window!=='undefined'&&window.BO_FRAMES)||72;

// ---- carga + recorte ----
var TR={};
function trimImg(img){
  var w=img.naturalWidth||img.width,h=img.naturalHeight||img.height;
  var oc=document.createElement('canvas');oc.width=w;oc.height=h;var ox=oc.getContext('2d');ox.drawImage(img,0,0);
  var data;try{data=ox.getImageData(0,0,w,h).data;}catch(e){return {canvas:oc,w:w,h:h};}
  var minX=w,minY=h,maxX=-1,maxY=-1;
  for(var y=0;y<h;y++){var row=y*w;for(var x=0;x<w;x++){if(data[(row+x)*4+3]>18){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}}
  if(maxX<0)return {canvas:oc,w:w,h:h};
  var tw=maxX-minX+1,th=maxY-minY+1,tc=document.createElement('canvas');tc.width=tw;tc.height=th;
  tc.getContext('2d').drawImage(oc,minX,minY,tw,th,0,0,tw,th);return {canvas:tc,w:tw,h:th};
}
function load(src,cb){return new Promise(function(res){var im=new Image();im.onload=function(){try{cb(im);}catch(e){}res();};im.onerror=function(){res();};im.src=src;});}

var _pl=FLOOD.map(function(L){return load('../logos2/'+L.n+'.png',function(im){TR[L.n]=trimImg(im);});});
var _pc=[0,1,2,3,4,5,6,7,8].map(function(i){return load('./shots/c'+i+'.png',function(im){CARDS[i]=im;});});
var _pi=ICON_FILES.map(function(f){return load('./icons2/'+f,function(im){ICONS[f]=trimImg(im);});});
var _pb=[];for(var _i=1;_i<=BO_FRAMES;_i++){(function(k){
  _pb.push(load('./stock/'+BO_DIR+'/b_'+String(k).padStart(3,'0')+'.jpg',function(im){BO[k-1]=im;}));
})(_i);}
window.assetsReady=Promise.all(_pl.concat(_pc,_pi,_pb));

function clamp(v,a,b){return v<a?a:v>b?b:v;}
function lerp(a,b,t){return a+(b-a)*t;}
function eoCubic(x){return 1-Math.pow(1-x,3);}
function eoBack(x){var c1=1.7,c3=c1+1;return 1+c3*Math.pow(x-1,3)+c1*Math.pow(x-1,2);}

function bg(ctx,W,H,azul){
  var g;
  if(azul){g=ctx.createLinearGradient(0,0,W*0.35,H);g.addColorStop(0,BLUE_A);g.addColorStop(1,BLUE_B);}
  else{g=ctx.createRadialGradient(W*0.5,H*0.42,0,W*0.5,H*0.5,H*1.05);g.addColorStop(0,CREAM_A);g.addColorStop(1,CREAM_B);}
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
}
// video de stock a pantalla completa, oscurecido, como fondo del texto
function bgVideo(ctx,W,H,t){
  if(!BO.length){bg(ctx,W,H,false);return false;}
  var idx=Math.round((t-VIDEO_START)/1000*24)%BO.length;   // loop: no se congela
  var im=BO[idx];
  if(!im){bg(ctx,W,H,false);return false;}
  var iw=im.naturalWidth,ih=im.naturalHeight;
  var sc=Math.max(W/iw,H/ih)*1.04, dw=iw*sc, dh=ih*sc;   // cover con un pelín de zoom
  ctx.save();
  ctx.filter='grayscale(28%) contrast(1.05)';
  ctx.drawImage(im,(W-dw)/2,(H-dh)/2,dw,dh);
  ctx.restore();
  var g=ctx.createLinearGradient(0,0,0,H);               // oscurecido para que lea el texto
  g.addColorStop(0,'rgba(8,10,16,0.62)');g.addColorStop(0.5,'rgba(8,10,16,0.50)');g.addColorStop(1,'rgba(8,10,16,0.66)');
  ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  return true;
}
function norm(w){return w.toLowerCase().replace(/[.,¿?¡!…"]/g,'');}
function layout(ctx,text,size,maxW){ctx.font='800 '+size+"px 'Geist', system-ui, sans-serif";
  var words=text.split(' '),lines=[],cur='';
  for(var i=0;i<words.length;i++){var t=cur?cur+' '+words[i]:words[i];if(ctx.measureText(t).width>maxW&&cur){lines.push(cur);cur=words[i];}else cur=t;}
  if(cur)lines.push(cur);return lines;}

function drawIcon(ctx,tr,cx,cy,box,alpha,scale,rot){
  if(!tr)return;var fit=box/Math.max(tr.w,tr.h)*(scale||1),w=tr.w*fit,h=tr.h*fit;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);if(rot)ctx.rotate(rot);
  ctx.drawImage(tr.canvas,-w/2,-h/2,w,h);ctx.restore();
}

function drawTextChunk(ctx,W,H,c,age,life,t){
  var azul=c.bg==='blue', sobreVideo=!!c.video;
  var CX=c.side?W*0.30:W/2;
  var maxLines=2;                                       // nunca más de 2 líneas
  var maxW=c.side?W*0.46:W*0.84;                         // side: angosto, no pisa lo del costado
  var size=c.side?96:(c.big?210:120);
  var lines=layout(ctx,c.text,size,maxW);
  while(lines.length>maxLines&&size>54){size-=8;lines=layout(ctx,c.text,size,maxW);}
  var lh=size*1.14, textH=lines.length*lh;
  // bloque de arriba: emoji o ícono
  var tieneTop=!!(c.emoji||c.icon);
  var emS=0, emGap=0;
  if(c.emoji){emS=size*0.74;emGap=size*0.30;}
  else if(c.icon){emS=c.side?size*1.55:size*1.55;emGap=size*0.34;}
  var groupH=textH+(tieneTop?emS+emGap:0), top=-groupH/2;

  var op=eoCubic(clamp(age/300,0,1)), dy=lerp(40,0,eoBack(clamp(age/400,0,1))), sc=lerp(0.94,1,eoBack(clamp(age/400,0,1)));
  var outStart=life-220; if(age>outStart){var o=clamp((age-outStart)/220,0,1);op*=(1-o*0.9);dy-=o*20;}

  ctx.save();ctx.globalAlpha=op;ctx.translate(CX,H/2+dy);ctx.scale(sc,sc);
  ctx.textBaseline='middle';

  if(c.emoji){
    var eb=eoBack(clamp(age/460,0,1));
    ctx.save();
    ctx.translate(0,top+emS/2);ctx.scale(lerp(0.4,1,eb),lerp(0.4,1,eb));ctx.rotate(lerp(-0.28,0,eb));
    ctx.font=Math.round(emS)+'px '+EMOJI_FONT;ctx.textAlign='center';
    ctx.fillText(c.emoji,0,0);
    ctx.restore();
  }else if(c.icon){
    var ib=eoBack(clamp(age/440,0,1));
    drawIcon(ctx,ICONS[c.icon],0,top+emS/2,emS,1,lerp(0.45,1,ib),lerp(-0.18,0,ib));
  }

  ctx.font='800 '+size+"px 'Geist', system-ui, sans-serif";
  var emph=(c.emph||[]).map(norm);
  // sobre azul o sobre video TODO va en blanco (el fondo ya es el énfasis)
  var claro=azul||sobreVideo;
  var base=claro?'#FFFFFF':INK, hi=claro?'#FFFFFF':BLUE;
  if(sobreVideo){ctx.shadowColor='rgba(0,0,0,0.55)';ctx.shadowBlur=26;ctx.shadowOffsetY=4;}
  var y0=top+(tieneTop?emS+emGap:0)+lh/2;
  for(var li=0;li<lines.length;li++){
    var y=y0+li*lh, ws=lines[li].split(' ');
    var widths=ws.map(function(w){return ctx.measureText(w).width;}), sp=ctx.measureText(' ').width;
    var tot=widths.reduce(function(a,b){return a+b;},0)+sp*(ws.length-1), x=-tot/2;
    ctx.textAlign='left';
    for(var wi=0;wi<ws.length;wi++){var wn=norm(ws[wi]);ctx.fillStyle=(wn==='mako')?GOLD:(emph.indexOf(wn)>=0?hi:base);ctx.fillText(ws[wi],x,y);x+=widths[wi]+sp;}
  }
  ctx.restore();
}

// ── "Desde que mira tu anuncio → hasta que te realiza el pago" ──
// ojo a la izquierda, dinero a la derecha, conector que se dibuja entre los dos
function drawFlow(ctx,W,H,c,t){
  var box=Math.min(W,H)*0.20, cy=H*0.33;
  var xE=W*0.31, xM=W*0.69;
  var aE=eoCubic(clamp((t-FLOW1_S)/420,0,1));
  var sE=lerp(0.5,1,eoBack(clamp((t-FLOW1_S)/520,0,1)));
  drawIcon(ctx,ICONS['eye.svg'],xE,cy,box,aE,sE,0);

  if(t>=FLOW2_S){
    // línea punteada que avanza de ojo a dinero
    var lp=eoCubic(clamp((t-FLOW2_S)/520,0,1));
    var x0=xE+box*0.62, x1=xM-box*0.62, xNow=lerp(x0,x1,lp);
    ctx.save();
    ctx.strokeStyle=BLUE;ctx.lineWidth=Math.max(5,W*0.0035);ctx.lineCap='round';
    ctx.setLineDash([W*0.014,W*0.014]);ctx.lineDashOffset=-(t/26)%(W*0.028);
    ctx.beginPath();ctx.moveTo(x0,cy);ctx.lineTo(xNow,cy);ctx.stroke();
    ctx.setLineDash([]);
    if(lp>0.94){                                  // punta de flecha
      var hh=W*0.011;
      ctx.beginPath();ctx.moveTo(x1+hh*0.9,cy);ctx.lineTo(x1-hh*0.5,cy-hh*0.8);ctx.lineTo(x1-hh*0.5,cy+hh*0.8);ctx.closePath();
      ctx.fillStyle=BLUE;ctx.fill();
    }
    ctx.restore();
    var aM=eoCubic(clamp((t-FLOW2_S-300)/420,0,1));
    var sM=lerp(0.5,1,eoBack(clamp((t-FLOW2_S-300)/520,0,1)));
    drawIcon(ctx,ICONS['banknote.svg'],xM,cy,box,aM,sM,0);
  }

  // texto abajo
  var size=112, maxW=W*0.84;
  var lines=layout(ctx,c.text,size,maxW);
  while(lines.length>2&&size>54){size-=8;lines=layout(ctx,c.text,size,maxW);}
  var lh=size*1.14, y0=H*0.71-(lines.length-1)*lh/2;
  var age=t-c.s, op=eoCubic(clamp(age/300,0,1));
  ctx.save();ctx.globalAlpha=op;ctx.textBaseline='middle';
  ctx.font='800 '+size+"px 'Geist', system-ui, sans-serif";
  var emph=(c.emph||[]).map(norm);
  for(var li=0;li<lines.length;li++){
    var ws=lines[li].split(' ');
    var widths=ws.map(function(w){return ctx.measureText(w).width;}), sp=ctx.measureText(' ').width;
    var tot=widths.reduce(function(a,b){return a+b;},0)+sp*(ws.length-1), x=W/2-tot/2, y=y0+li*lh;
    ctx.textAlign='left';
    for(var wi=0;wi<ws.length;wi++){var wn=norm(ws[wi]);ctx.fillStyle=(wn==='mako')?GOLD:(emph.indexOf(wn)>=0?BLUE:INK);ctx.fillText(ws[wi],x,y);x+=widths[wi]+sp;}
  }
  ctx.restore();
}

function drawLogo(ctx,tr,cx,cy,box,rotDeg,alpha,scale){
  if(!tr)return;var fit=box/Math.max(tr.w,tr.h)*scale,w=tr.w*fit,h=tr.h*fit;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(cx,cy);ctx.rotate(rotDeg*Math.PI/180);
  ctx.shadowColor='rgba(20,16,10,0.18)';ctx.shadowBlur=box*0.06;ctx.shadowOffsetY=box*0.02;
  ctx.drawImage(tr.canvas,-w/2,-h/2,w,h);ctx.restore();
}
function drawLogos(ctx,W,H,t){
  var box=Math.min(W,H)*0.185;
  for(var i=0;i<FLOOD.length;i++){var L=FLOOD[i],tr=TR[L.n];if(!tr)continue;if(t<L.s)continue;
    var age=t-L.s, ap=eoCubic(clamp(age/260,0,1)), sc=0.6+0.4*eoBack(clamp(age/360,0,1));
    var jit=Math.sin(t/500+i*1.7)*(box*0.02);
    drawLogo(ctx,tr,L.x*W,L.y*H+jit,box,L.r,ap,sc);
  }
}
// ── logo MaKo oficial (badge oscuro + estrella dorada + wordmark con barrido) ──
function sparkPath(ctx,cx,cy,r){var k=r/11;ctx.beginPath();
  ctx.moveTo(cx,cy-11*k);
  ctx.bezierCurveTo(cx+1*k,cy-4*k,cx+4*k,cy-1*k,cx+11*k,cy);
  ctx.bezierCurveTo(cx+4*k,cy+1*k,cx+1*k,cy+4*k,cx,cy+11*k);
  ctx.bezierCurveTo(cx-1*k,cy+4*k,cx-4*k,cy+1*k,cx-11*k,cy);
  ctx.bezierCurveTo(cx-4*k,cy-1*k,cx-1*k,cy-4*k,cx,cy-11*k);
  ctx.closePath();}
function rrp(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function drawMakoLogo(ctx,cx,cy,S,t,claro){
  ctx.font='800 '+Math.round(S*0.9)+"px 'Geist', system-ui, sans-serif";
  ctx.textAlign='left';ctx.textBaseline='middle';
  var word='MaKo', ww=ctx.measureText(word).width, gap=S*0.34, groupW=S+gap+ww, left=cx-groupW/2;
  var bx=left, by=cy-S/2;
  var bgd=ctx.createLinearGradient(bx,by,bx+S,by+S);bgd.addColorStop(0,'#2A251C');bgd.addColorStop(1,'#171511');
  ctx.save();rrp(ctx,bx,by,S,S,S*0.27);ctx.fillStyle=bgd;ctx.fill();ctx.lineWidth=Math.max(1,S*0.022);ctx.strokeStyle='rgba(239,159,39,0.4)';ctx.stroke();ctx.restore();
  var gg=ctx.createLinearGradient(bx,by,bx+S,by+S);gg.addColorStop(0,GOLD_1);gg.addColorStop(1,GOLD_2);
  sparkPath(ctx,bx+S/2,by+S/2,S*0.34);ctx.fillStyle=gg;ctx.fill();
  // wordmark con barrido dorado IZQUIERDA -> DERECHA (loop 2600ms)
  var tinta=claro?'#FFFFFF':'#1A1813';
  var wx=left+S+gap, ph=(t%2600)/2600, cxg=wx+ww*(-0.3+ph*1.6);
  var lg=ctx.createLinearGradient(cxg-ww*0.55,0,cxg+ww*0.55,0);
  lg.addColorStop(0,tinta);lg.addColorStop(0.42,tinta);lg.addColorStop(0.5,GOLD_1);lg.addColorStop(0.58,tinta);lg.addColorStop(1,tinta);
  ctx.fillStyle=lg;ctx.fillText(word,wx,cy+S*0.06);
}

// ── carrusel: las 9 capturas son UNA sola tira que atraviesa UNA sola curva ──
// La curva es una deformación cilíndrica FIJA de la pantalla (centro cerca, bordes
// alejándose). La tira se desplaza a través de ella, con separación entre capturas
// y un zoom lento a lo largo de toda la secuencia.
var OFF=null;
var CAR_THMAX=0.60;    // apertura del cilindro (rad)
var CAR_WIN=1.55;      // ancho de tira que entra en la curva (× pantalla)
function drawCarousel(ctx,W,H,t){
  var cards=CARDS.filter(Boolean); if(!cards.length)return;
  var n=cards.length;
  var p=clamp((t-CAROUSEL_START)/(CAROUSEL_END-CAROUSEL_START),0,1);
  var zoom=lerp(1.00,1.13,p);                          // zoom lento

  var OW=Math.round(W*CAR_WIN), OH=H;
  if(!OFF){OFF=document.createElement('canvas');}
  if(OFF.width!==OW||OFF.height!==OH){OFF.width=OW;OFF.height=OH;}
  var o=OFF.getContext('2d');
  o.clearRect(0,0,OW,OH);

  var cw=W*0.78*zoom, chh=cw*908/1920, gap=W*0.05*zoom, step=cw+gap, cy=OH/2;
  var total=n*step;
  var scroll=lerp(-(OW-cw)/2, total-gap-(OW+cw)/2, p);  // recorre las 9 de punta a punta
  for(var i=0;i<n;i++){
    var x=i*step-scroll;
    if(x+cw<-60||x>OW+60)continue;
    o.save();o.shadowColor='rgba(15,20,40,0.30)';o.shadowBlur=38;o.shadowOffsetY=14;
    rrp(o,x,cy-chh/2,cw,chh,20);o.fillStyle='#0e0e12';o.fill();o.restore();
    o.save();rrp(o,x,cy-chh/2,cw,chh,20);o.clip();o.drawImage(cards[i],x,cy-chh/2,cw,chh);o.restore();
  }

  // proyección: UNA curva para toda la tira
  var BH=chh*1.20, by=cy-BH/2;
  var N=190, sw=OW/N, sinMax=Math.sin(CAR_THMAX);
  for(var k=0;k<N;k++){
    var a=(k+0.5)/N*2-1, th=a*CAR_THMAX;
    var a2=(k+1.5)/N*2-1, th2=a2*CAR_THMAX;
    var xs =W/2+(W/2)*Math.sin(th)/sinMax;
    var xs2=W/2+(W/2)*Math.sin(th2)/sinMax;
    var dw=Math.max(1,xs2-xs), s=Math.cos(th), dh=BH*s;
    ctx.drawImage(OFF,k*sw,by,sw,BH,xs,H/2-dh/2,dw+1.2,dh);
  }
}
// ── Excel precario (situación A: llenás tu CRM a mano) ───────────────────────
var EXCEL_HEADS=['Nombre','Teléfono','Estado','Fecha','Nota'];
var EXCEL_ROWS=[
  [{t:'José Rodríguez'},{t:'55 1234'},{t:'agendó?',red:1},{t:'12/7'},{t:''}],
  [{t:'laura m.'},{t:''},{t:'???',red:1},{t:''},{t:'llamar!!'}],
  [{t:'#REF!',red:1},{t:'',red:1},{t:'',red:1},{t:''},{t:''}],
  [{t:'Carlos'},{t:'55 99..'},{t:'perdido?',red:1},{t:'3/7'},{t:'no contesta'}],
  [{t:''},{t:''},{t:''},{t:''},{t:''}],
  [{t:'PEDRO G'},{t:'5577'},{t:'GANADO'},{t:''},{t:''}],
  [{t:'Marcelo'},{t:'55 8'},{t:'__EDIT__'},{t:''},{t:''}],
  [{t:'Jose Rodriguez'},{t:'55 1234'},{t:'',red:1},{t:''},{t:'dup?'}]
];
function drawExcelSheet(ctx,W,H,tt){
  ctx.fillStyle='#FFFFFF';ctx.fillRect(0,0,W,H);
  ctx.fillStyle='#F3F4F2';ctx.fillRect(0,0,W,24);
  ctx.fillStyle='#1E7145';ctx.fillRect(0,0,4,24);
  ctx.fillStyle='#5A6470';ctx.font="600 11px 'Geist', system-ui, sans-serif";
  ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText('CRM_leads_FINAL_v3.xlsx',14,12);
  var gut=26,top=24,headH=22,rowH=(H-top-headH)/EXCEL_ROWS.length;
  var cols=EXCEL_HEADS.length,tableW=W-gut,frac=[0.30,0.18,0.20,0.15,0.17];
  var cx=[gut];for(var i=0;i<cols;i++)cx.push(cx[i]+tableW*frac[i]);
  ctx.fillStyle='#217346';ctx.fillRect(gut,top,tableW,headH);
  ctx.fillStyle='#F3F4F2';ctx.fillRect(0,top,gut,headH);
  ctx.fillStyle='#FFFFFF';ctx.font="700 10.5px 'Geist', system-ui, sans-serif";ctx.textBaseline='middle';
  for(var i=0;i<EXCEL_HEADS.length;i++){ctx.textAlign='left';ctx.fillText(EXCEL_HEADS[i],cx[i]+6,top+headH/2);}
  var editBox=null;
  for(var r=0;r<EXCEL_ROWS.length;r++){
    var row=EXCEL_ROWS[r],y=top+headH+r*rowH;
    ctx.fillStyle='#F3F4F2';ctx.fillRect(0,y,gut,rowH);
    ctx.fillStyle='#98A2AE';ctx.font="400 9px 'Geist', system-ui, sans-serif";
    ctx.textAlign='center';ctx.fillText(String(r+1),gut/2,y+rowH/2);
    for(var i=0;i<row.length;i++){
      var cell=row[i],x=cx[i],w=cx[i+1]-cx[i];
      if(cell.red&&cell.t){ctx.fillStyle='rgba(226,86,86,0.10)';ctx.fillRect(x,y,w,rowH);}
      if(cell.t==='__EDIT__'){editBox={x:x,y:y,w:w,h:rowH,txt:'Presen'};}
      else if(cell.t){ctx.fillStyle=cell.red?'#D64545':'#3A424E';ctx.font="400 10px 'Geist', system-ui, sans-serif";ctx.textAlign='left';var s=cell.t.length>16?cell.t.slice(0,15)+'…':cell.t;ctx.fillText(s,x+6,y+rowH/2);}
    }
  }
  ctx.strokeStyle='#E3E6E1';ctx.lineWidth=1;ctx.beginPath();
  for(var i=0;i<=cols;i++){var xg=(cx[i]!=null?cx[i]:W);ctx.moveTo(xg+0.5,top);ctx.lineTo(xg+0.5,H);}
  for(var r=0;r<=EXCEL_ROWS.length;r++){var yg=top+headH+r*rowH;ctx.moveTo(gut,yg+0.5);ctx.lineTo(W,yg+0.5);}
  ctx.moveTo(gut+0.5,top);ctx.lineTo(gut+0.5,H);ctx.stroke();
  if(editBox){
    var b=editBox;
    ctx.strokeStyle='#217346';ctx.lineWidth=2;ctx.strokeRect(b.x+1,b.y+1,b.w-2,b.h-2);
    ctx.fillStyle='#3A424E';ctx.font="400 10px 'Geist', system-ui, sans-serif";ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText(b.txt,b.x+6,b.y+b.h/2);
    if(Math.floor(tt/500)%2===0){var cxx=b.x+6+ctx.measureText(b.txt).width+1;ctx.strokeStyle='#3A424E';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(cxx,b.y+5);ctx.lineTo(cxx,b.y+b.h-5);ctx.stroke();}
  }
}
var _exCache=null;
function excelCache(W,H){
  if(_exCache&&_exCache.width===W&&_exCache.height===H)return _exCache;
  var oc=document.createElement('canvas');oc.width=W;oc.height=H;
  var o=oc.getContext('2d'),LH=440,k=H/LH;o.save();o.scale(k,k);drawExcelSheet(o,W/k,H/k,999);o.restore();
  _exCache=oc;return oc;
}
function eiCubic(x){return x*x*x;}
function buildShatter(){
  var s=7,rnd=function(){s=(s*48271)%2147483647;return s/2147483647;};
  var N=18,RINGS=[46,112,195,300,430],br=[];
  for(var i=0;i<N;i++){var a=(i/N)*Math.PI*2,arr=[];for(var j=0;j<RINGS.length;j++){var r=RINGS[j],aa=a+(rnd()-0.5)*0.26,rd=r*(0.82+rnd()*0.45);arr.push({x:Math.cos(aa)*rd,y:Math.sin(aa)*rd});}br.push(arr);}
  return br;
}
var SHATTER=buildShatter();
function drawCracks(ctx,cx,cy,p,W){
  var e=eoCubic(clamp(p,0,1));if(e<=0.001)return;var SC=W/442;
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.globalAlpha=clamp(p*1.5,0,1);
  var paint=function(){
    for(var i=0;i<SHATTER.length;i++){var b=SHATTER[i];ctx.beginPath();ctx.moveTo(cx,cy);for(var j=0;j<b.length;j++)ctx.lineTo(cx+b[j].x*e*SC,cy+b[j].y*e*SC);ctx.stroke();}
    for(var ring=0;ring<3;ring++){ctx.beginPath();for(var i=0;i<=SHATTER.length;i++){var b=SHATTER[i%SHATTER.length][ring],x=cx+b.x*e*SC,y=cy+b.y*e*SC;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();}
  };
  ctx.strokeStyle='rgba(255,255,255,0.8)';ctx.lineWidth=2.4*SC;paint();
  ctx.strokeStyle='rgba(124,134,148,0.62)';ctx.lineWidth=0.9*SC;paint();
  ctx.restore();
}
// Entra el Excel precario y de golpe cae BASTA y lo astilla como un vidrio; luego
// aparecen las líneas. Todos los beats type:'excel' son UNA sola animación (ventana
// global). En este tramo NO hay subtítulos del locutor (para no confundir).
// El Excel precario entra a un COSTADO (como el video de Mauricio) mientras el
// subtítulo del locutor sigue a la izquierda. Sin BASTA.
function drawExcelPanel(ctx,W,H,t){
  var age=t-EXCEL_S,DUR=EXCEL_E-EXCEL_S,inp=eoCubic(clamp(age/240,0,1));
  var pw=W*0.38,ph=H*0.54,px=W*0.585+lerp(40,0,inp),py=H*0.23;
  var pcx=px+pw/2,pcy=py+ph*0.40;
  var EXCELMS=Math.max(1300,DUR-2900),DROP=420,ai=age-(EXCELMS+DROP);
  ctx.save();ctx.globalAlpha=inp;
  ctx.save();ctx.shadowColor='rgba(20,16,10,0.30)';ctx.shadowBlur=44;ctx.shadowOffsetY=18;
  rrp(ctx,px,py,pw,ph,20);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
  // excel dentro del panel (nítido; blureado tras el golpe) + grietas clipeadas
  ctx.save();rrp(ctx,px,py,pw,ph,20);ctx.clip();
  if(ai<=0){ctx.save();ctx.translate(px,py);drawExcelSheet(ctx,pw,ph,age);ctx.restore();}
  else{
    ctx.save();ctx.filter='blur('+(clamp(ai/260,0,1)*5).toFixed(1)+'px)';ctx.translate(px,py);drawExcelSheet(ctx,pw,ph,EXCELMS);ctx.restore();ctx.filter='none';
    ctx.save();ctx.globalAlpha=0.5*clamp(ai/280,0,1);ctx.fillStyle='#E8ECF2';ctx.fillRect(px,py,pw,ph);ctx.restore();
    drawCracks(ctx,pcx,pcy,ai/170,pw);
  }
  ctx.restore();
  ctx.save();rrp(ctx,px,py,pw,ph,20);ctx.strokeStyle='rgba(20,16,10,0.10)';ctx.lineWidth=2;ctx.stroke();ctx.restore();
  // BASTA cae sobre el panel y lo rompe; luego las líneas
  if(age>=EXCELMS){
    var dropP=clamp((age-EXCELMS)/DROP,0,1);
    var by=age<EXCELMS+DROP?lerp(py-140,pcy,eiCubic(dropP)):pcy;
    var sc=ai>0?lerp(1.16,1,eoCubic(clamp(ai/150,0,1))):1;
    ctx.save();ctx.translate(pcx,by);ctx.scale(sc,sc);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    ctx.font="800 "+Math.round(pw*0.21)+"px 'Geist', system-ui, sans-serif";ctx.lineWidth=pw*0.022;ctx.strokeStyle='rgba(255,255,255,0.94)';ctx.strokeText('BASTA',0,0);ctx.fillStyle='#0E1116';ctx.fillText('BASTA',0,0);ctx.restore();
    var ln=function(txt,yy,at2,col){var a=eoCubic(clamp((ai-at2)/360,0,1));if(a<=0.001)return;ctx.save();ctx.globalAlpha=a;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font="700 "+Math.round(pw*0.066)+"px 'Geist', system-ui, sans-serif";ctx.lineWidth=pw*0.014;ctx.lineJoin='round';ctx.strokeStyle='rgba(255,255,255,0.94)';ctx.strokeText(txt,pcx,yy);ctx.fillStyle=col;ctx.fillText(txt,pcx,yy);ctx.restore();};
    ln('de planillas aburridas',pcy+pw*0.15,500,'#14171D');
    ln('Con MaKo',pcy+pw*0.15+pw*0.10,1050,'#14171D');
    ln('Nunca más.',pcy+pw*0.15+pw*0.20,1600,'#2F6FED');
  }
  ctx.restore();
}
function drawExcelBeat(ctx,W,H,c,t){
  bg(ctx,W,H,false);
  var cc={};for(var k in c)cc[k]=c[k];cc.side=1;cc.type=null;
  drawTextChunk(ctx,W,H,cc,t-c.s,c.e-c.s,t);
  drawExcelPanel(ctx,W,H,t);
}
// ── Kanban (MaKo mueve los leads solo, con barrido dorado) ──────────────────
function eInOut(x){return x<0.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;}
var KB_TITLES=['Nuevos','Agendados','Ganados'];
var KB_TONE={blue:'#2F6FED',green:'#1E9E57',amber:'#E0890C',gray:'#9AA5B5'};
function kbCols(x0,y0,bw,bh){
  var n=3,gap=bw*0.028,cw=(bw-gap*(n-1))/n,arr=[];
  for(var i=0;i<n;i++)arr.push({title:KB_TITLES[i],x:x0+i*(cw+gap),y:y0,w:cw,h:bh});
  return arr;
}
function kbCard(ctx,x,y,w,h,name,tag,tone,star,alpha,lift){
  alpha=(alpha==null?1:alpha);lift=lift||0;
  ctx.save();ctx.globalAlpha=alpha;
  ctx.save();ctx.shadowColor='rgba(20,28,45,'+(0.10+lift*0.14).toFixed(3)+')';ctx.shadowBlur=10+lift*20;ctx.shadowOffsetY=3+lift*9;
  rrp(ctx,x,y-lift*5,w,h,14);ctx.fillStyle='#fff';ctx.fill();ctx.restore();
  var yy=y-lift*5;
  rrp(ctx,x,yy,w,h,14);ctx.strokeStyle='#E6EAF1';ctx.lineWidth=1.5;ctx.stroke();
  rrp(ctx,x,yy+14,5,h-28,3);ctx.fillStyle=KB_TONE[tone];ctx.fill();
  ctx.fillStyle='#1B2432';ctx.font="600 27px 'Geist', system-ui, sans-serif";ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.fillText(name,x+22,yy+38);
  ctx.fillStyle='#8A94A6';ctx.font="400 21px 'Geist', system-ui, sans-serif";ctx.fillText(tag,x+22,yy+68);
  if(star){rrp(ctx,x+w-44,yy+14,30,30,8);ctx.fillStyle='#1A1712';ctx.fill();sparkPath(ctx,x+w-29,yy+29,9);ctx.fillStyle='#F2B01E';ctx.fill();}
  ctx.restore();
}
function goldWipe(ctx,x,y,w,h,edge){
  ctx.save();rrp(ctx,x,y,w,h,14);ctx.clip();
  var g=ctx.createLinearGradient(edge-30,0,edge+15,0);
  g.addColorStop(0,'rgba(242,176,30,0)');g.addColorStop(0.65,'rgba(242,176,30,0.92)');g.addColorStop(1,'rgba(255,246,214,0.96)');
  ctx.fillStyle=g;ctx.fillRect(edge-30,y-5,50,h+10);ctx.restore();
}
function capWords(ctx,txt,cx,cy,size){
  ctx.font='800 '+size+"px 'Geist', system-ui, sans-serif";
  var ws=txt.split(' '),widths=ws.map(function(w){return ctx.measureText(w).width;});
  var sp=ctx.measureText(' ').width,tot=widths.reduce(function(a,b){return a+b;},0)+sp*(ws.length-1),x=cx-tot/2;
  ctx.textAlign='left';ctx.textBaseline='middle';
  for(var i=0;i<ws.length;i++){var wn=norm(ws[i]);ctx.fillStyle=(wn==='mako')?GOLD:INK;ctx.fillText(ws[i],x,cy);x+=widths[i]+sp;}
}
var KB_STATIC=[{c:0,n:'Ana Torres',tg:'Hace 5 min',to:'blue'},{c:1,n:'Diego Sosa',tg:'Jueves 15:00',to:'amber'},{c:2,n:'Marta Pérez',tg:'Cerró',to:'green'}];
function drawKanbanBeat(ctx,W,H,c,t){
  bg(ctx,W,H,false);
  var age=t-c.s,kn=c.kan;
  var capOp=eoCubic(clamp(age/300,0,1));
  ctx.save();ctx.globalAlpha=capOp;capWords(ctx,kn.cap,W/2,H*0.17,60);ctx.restore();
  var bw=W*0.70,bh=H*0.52,x0=W/2-bw/2,y0=H*0.30;
  var cols=kbCols(x0,y0,bw,bh),pad=18,ch=100,slotY=y0+52,slot2Y=slotY+ch+18;
  for(var i=0;i<cols.length;i++){var col=cols[i];
    rrp(ctx,col.x,col.y,col.w,col.h,18);ctx.fillStyle='#F1F4F9';ctx.fill();
    ctx.fillStyle='#8A94A6';ctx.font="700 21px 'Geist', system-ui, sans-serif";ctx.textAlign='left';ctx.textBaseline='middle';
    ctx.fillText(col.title.toUpperCase(),col.x+20,col.y+26);
  }
  for(var i=0;i<KB_STATIC.length;i++){var s=KB_STATIC[i],col=cols[s.c];kbCard(ctx,col.x+pad,slotY,col.w-pad*2,ch,s.n,s.tg,s.to,0);}
  var toCol=cols[kn.to],cw=toCol.w-pad*2,name='José Rodríguez';
  if(kn.action==='reveal'){
    var p=clamp(age/700,0,1);
    if(p<=0){}
    else if(p<1){var rw=cw*eoCubic(p);ctx.save();rrp(ctx,toCol.x+pad,slot2Y,Math.max(2,rw),ch,14);ctx.clip();kbCard(ctx,toCol.x+pad,slot2Y,cw,ch,name,kn.tag,'blue',1);ctx.restore();goldWipe(ctx,toCol.x+pad,slot2Y,cw,ch,toCol.x+pad+rw);}
    else kbCard(ctx,toCol.x+pad,slot2Y,cw,ch,name,kn.tag,'blue',1);
  } else {
    var frCol=cols[kn.to-1],p=clamp(age/800,0,1),pe=eInOut(p);
    var fx=frCol.x+pad,tx=toCol.x+pad,mx=lerp(fx,tx,pe);
    kbCard(ctx,mx,slot2Y,cw,ch,name,kn.tag,(kn.to===2?'green':'amber'),1,1);
    if(p<1)goldWipe(ctx,mx,slot2Y,cw,ch,mx+(p*1.3-0.15)*cw);
  }
}
// ── Semáforo del negocio: luz roja/ámbar/verde (el visual héroe) ──────────────
var SEM_ON={red:'#E5484D',amber:'#E8A317',green:'#22A85A'};
var SEM_OFF={red:'#3A2323',amber:'#3A331E',green:'#1E3328'};
function drawSemaforo(ctx,cx,cy,S,lit,pulse){
  var bw=S*0.46,bh=S,r=bw*0.44,x=cx-bw/2,y=cy-bh/2;
  ctx.save();ctx.shadowColor='rgba(20,16,10,0.30)';ctx.shadowBlur=S*0.10;ctx.shadowOffsetY=S*0.03;
  rrp(ctx,x,y,bw,bh,r);var bgd=ctx.createLinearGradient(x,y,x,y+bh);bgd.addColorStop(0,'#232320');bgd.addColorStop(1,'#121110');ctx.fillStyle=bgd;ctx.fill();ctx.restore();
  ctx.save();rrp(ctx,x,y,bw,bh,r);ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=Math.max(1,S*0.012);ctx.stroke();ctx.restore();
  var order=['red','amber','green'],lampR=bw*0.29;
  for(var i=0;i<3;i++){
    var col=order[i],ly=y+bh*(0.215+i*0.285),on=(lit===col);
    if(on){
      var g=(pulse==null?1:pulse);
      var hal=ctx.createRadialGradient(cx,ly,0,cx,ly,lampR*2.6);
      hal.addColorStop(0,SEM_ON[col]);hal.addColorStop(0.55,'rgba(0,0,0,0)');hal.addColorStop(1,'rgba(0,0,0,0)');
      ctx.save();ctx.globalAlpha=0.55*g;ctx.fillStyle=hal;ctx.beginPath();ctx.arc(cx,ly,lampR*2.6,0,6.30);ctx.fill();ctx.restore();
      var lg=ctx.createRadialGradient(cx-lampR*0.32,ly-lampR*0.32,lampR*0.1,cx,ly,lampR);
      lg.addColorStop(0,'#FFFFFF');lg.addColorStop(0.28,SEM_ON[col]);lg.addColorStop(1,SEM_ON[col]);
      ctx.fillStyle=lg;ctx.beginPath();ctx.arc(cx,ly,lampR,0,6.30);ctx.fill();
      ctx.save();ctx.globalAlpha=0.3;ctx.strokeStyle='#fff';ctx.lineWidth=Math.max(1,S*0.006);ctx.beginPath();ctx.arc(cx,ly,lampR,0,6.30);ctx.stroke();ctx.restore();
    }else{
      ctx.fillStyle=SEM_OFF[col];ctx.beginPath();ctx.arc(cx,ly,lampR,0,6.30);ctx.fill();
    }
  }
}
function drawSemaforoText(ctx,W,H,c,age){
  var azul=c.bg==='blue',size=104,maxW=W*0.86;
  var lines=layout(ctx,c.text,size,maxW);
  while(lines.length>2&&size>52){size-=8;lines=layout(ctx,c.text,size,maxW);}
  var lh=size*1.14,y0=H*0.75-(lines.length-1)*lh/2,op=eoCubic(clamp(age/300,0,1));
  var base=azul?'#fff':INK,hi=azul?'#fff':BLUE;
  ctx.save();ctx.globalAlpha=op;ctx.textBaseline='middle';ctx.font='800 '+size+"px 'Geist', system-ui, sans-serif";
  var emph=(c.emph||[]).map(norm);
  for(var li=0;li<lines.length;li++){
    var ws=lines[li].split(' '),widths=ws.map(function(w){return ctx.measureText(w).width;}),sp=ctx.measureText(' ').width;
    var tot=widths.reduce(function(a,b){return a+b;},0)+sp*(ws.length-1),x=W/2-tot/2,y=y0+li*lh;ctx.textAlign='left';
    for(var wi=0;wi<ws.length;wi++){var wn=norm(ws[wi]);ctx.fillStyle=(wn==='mako')?GOLD:(emph.indexOf(wn)>=0?hi:base);ctx.fillText(ws[wi],x,y);x+=widths[wi]+sp;}
  }
  ctx.restore();
}
function drawSemaforoBeat(ctx,W,H,c,t){
  var age=t-c.s,lit=(c.sem&&c.sem.light)||'green';
  if(lit==='cycle'){var o=['green','amber','red'];lit=o[Math.min(2,Math.floor(age/240))];}
  var op=eoCubic(clamp(age/280,0,1)),sc=lerp(0.9,1,eoBack(clamp(age/440,0,1))),pulse=0.86+0.14*Math.sin(t/220);
  var S=H*0.42,cx=W/2,cy=H*0.35;
  ctx.save();ctx.globalAlpha=op;ctx.translate(cx,cy);ctx.scale(sc,sc);ctx.translate(-cx,-cy);
  drawSemaforo(ctx,cx,cy,S,lit,pulse);ctx.restore();
  drawSemaforoText(ctx,W,H,c,age);
}
function setSize(cv){var W=window.innerWidth,H=window.innerHeight;if(cv.width!==W)cv.width=W;if(cv.height!==H)cv.height=H;cv.style.width=W+'px';cv.style.height=H+'px';return[W,H];}

window.renderFrame=function(t){
  var cv=document.getElementById('c');var s=setSize(cv),W=s[0],H=s[1];
  var ctx=cv.getContext('2d');ctx.clearRect(0,0,W,H);
  var c=null;for(var i=0;i<CH.length;i++){if(t>=CH[i].s&&t<CH[i].e){c=CH[i];break;}}
  if(!c)c=(t>=CH[CH.length-1].e)?CH[CH.length-1]:CH[0];
  var azul=(c.bg==='blue'), claro=azul;

  if(c.video){claro=bgVideo(ctx,W,H,t);}
  else bg(ctx,W,H,azul);

  if(c.type==='excel')drawExcelBeat(ctx,W,H,c,t);
  else if(c.type==='kanban')drawKanbanBeat(ctx,W,H,c,t);
  else if(c.type==='semaforo')drawSemaforoBeat(ctx,W,H,c,t);
  else if(c.type==='logos')drawLogos(ctx,W,H,t);
  else if(c.type==='carousel')drawCarousel(ctx,W,H,t);
  else if(c.flow)drawFlow(ctx,W,H,c,t);
  else if(c.count){
    // número que sube rápido: se reemplaza {N} en el texto por el conteo animado
    var p=eoCubic(clamp((t-c.s)/(c.count.dur||750),0,1));
    var cur=Math.round(lerp(c.count.from||0,c.count.to,p));
    var num=(''+cur).replace(/\B(?=(\d{3})+(?!\d))/g,'.');   // 1400 -> "1.400"
    var cc={}; for(var kk in c)cc[kk]=c[kk];
    cc.text=c.text.replace('{N}',num); cc.emph=(c.emph||[]).concat([num]);
    drawTextChunk(ctx,W,H,cc,t-c.s,c.e-c.s,t);
  }
  else drawTextChunk(ctx,W,H,c,t-c.s,c.e-c.s,t);
  drawMakoLogo(ctx, W/2, H-104, 40, t, claro);   // más arriba: la barra de progreso tapa el pie
  return true;
};
