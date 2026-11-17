// Genera música o SFX con ElevenLabs. Lee la key del .env.local.
// music: node eleven-audio.js music "<prompt>" <ms> <out.mp3>
// sfx:   node eleven-audio.js sfx   "<prompt>" <seconds> <out.mp3>
const fs=require('fs'), https=require('https');
const ENV='C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing/.env.local';
const [,,mode,prompt,amount,OUT]=process.argv;
let KEY=process.env.ELEVENLABS_API_KEY||'';
if(!KEY){try{const m=fs.readFileSync(ENV,'utf8').match(/^\s*ELEVENLABS_API_KEY\s*=\s*(.+?)\s*$/m);KEY=m?m[1].replace(/^["']|["']$/g,''):'';}catch(e){}}
if(!KEY){console.error('sin key');process.exit(1);}

let path, body;
if(mode==='music'){
  path='/v1/music';
  body=JSON.stringify({prompt, music_length_ms:parseInt(amount,10), model_id:'music_v2', force_instrumental:true});
}else{
  path='/v1/sound-generation';
  body=JSON.stringify({text:prompt, duration_seconds:parseFloat(amount), prompt_influence:0.5});
}
console.log(mode,'|',path,'| len', body.length);
const req=https.request({hostname:'api.elevenlabs.io',path,method:'POST',
  headers:{'xi-api-key':KEY,'Content-Type':'application/json',Accept:'audio/mpeg'}},res=>{
  const ch=[];res.on('data',c=>ch.push(c));res.on('end',()=>{const b=Buffer.concat(ch);
    if(res.statusCode!==200){console.error('ERROR',res.statusCode,b.toString('utf8').slice(0,500));process.exit(1);}
    fs.writeFileSync(OUT,b);console.log('OK ->',OUT,(b.length/1024).toFixed(0)+'KB');});
});
req.on('error',e=>{console.error('req err',e.message);process.exit(1);});
req.write(body);req.end();
