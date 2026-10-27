const $ = (s) => document.querySelector(s);
const canvas = $('#processedCanvas'), ctx = canvas.getContext('2d', { willReadFrequently: true });
const originalCanvas = $('#originalCanvas'), originalCtx = originalCanvas.getContext('2d');
const presets = {
  family: { name:'Family snapshot', year:'1998', description:'Warm indoor flash, soft highlights, and mellow family-album color.', grain:26,size:38,fade:22,black:15,warmth:24,cast:8,contrast:12,saturation:12,highlights:28,flash:40 },
  school: { name:'School portrait', year:'1994', description:'Soft studio light, cool shadows, and a print that has mellowed with time.', grain:16,size:28,fade:18,black:22,warmth:-5,cast:-7,contrast:-8,saturation:-10,highlights:32,flash:5 },
  silver: { name:'Silver print', year:'', description:'Natural silver tones with the lovely texture of a real paper print.', grain:28,size:34,fade:12,black:8,warmth:0,cast:0,contrast:8,saturation:-100,highlights:12,flash:0 },
  disposable: { name:'Disposable camera', year:'2001', description:'Bright faces, a quick flash, and backgrounds that fall away into night.', grain:23,size:35,fade:10,black:4,warmth:18,cast:4,contrast:26,saturation:16,highlights:8,flash:64 },
  album: { name:'Old album scan', year:'', description:'Faded color and quiet saturation from a well-kept family print.', grain:18,size:24,fade:44,black:24,warmth:15,cast:10,contrast:-12,saturation:-24,highlights:34,flash:0 },
  digital: { name:'Early digital', year:'2003', description:'A little cool in the shadows, crisp flash, compact-camera character.', grain:12,size:18,fade:6,black:10,warmth:-10,cast:-12,contrast:22,saturation:-4,highlights:6,flash:34 }
};
const controlMeta = [
  ['grain','Film grain','Fine texture across the print',0,60,'%'], ['size','Grain size','From fine to chunky',0,100,'%'],
  ['fade','Print fade','Let the years soften the color',0,70,'%'], ['black','Black point','Lift or deepen the shadows',0,50,'%'],
  ['warmth','Warmth','Cool daylight ↔ warm tungsten',-40,40,''], ['cast','Color cast','Green shadows ↔ rosy light',-30,30,''],
  ['contrast','Contrast','Gentle ↔ punchy',-35,40,''], ['saturation','Saturation','Quiet color ↔ vivid print',-60,35,''],
  ['highlights','Highlight softness','Keep bright moments gentle',0,60,'%'], ['flash','Flash intensity','Point-and-shoot pop',0,100,'%'],
];
let image = null, filename = '', activePreset = 'family', values = {...presets.family}, raf = 0, showOriginal = false;
function makeControls(){ $('#controlList').innerHTML = controlMeta.map(([key,label,hint,min,max,suffix]) => `<label class="slider-control" for="${key}"><span class="slider-heading"><b>${label}</b><output id="${key}Value">${values[key]}${suffix}</output></span><input id="${key}" type="range" min="${min}" max="${max}" value="${values[key]}" step="1"><small>${hint}</small></label>`).join('');
 controlMeta.forEach(([key,,,,,suffix]) => { $('#'+key).addEventListener('input', e => { values[key] = +e.target.value; $('#'+key+'Value').value = `${values[key]}${suffix}`; $('#'+key+'Value').textContent = `${values[key]}${suffix}`; queueRender(); }); }); }
function applyPreset(id){ activePreset=id; values={...presets[id]}; document.querySelectorAll('.preset-card').forEach(b=>b.classList.toggle('active',b.dataset.preset===id)); $('#activePresetName').innerHTML=`${presets[id].name} ${presets[id].year?`<span>${presets[id].year}</span>`:''}`; $('#presetDescription').textContent=presets[id].description; makeControls(); queueRender(); }
function queueRender(){ if(!image)return; cancelAnimationFrame(raf); raf=requestAnimationFrame(render); }
function fitPreview(){if(!image)return;const stage=$('#photoStage'),style=getComputedStyle(stage),padW=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight),padH=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);const maxW=Math.max(1,stage.clientWidth-padW),maxH=Math.max(1,stage.clientHeight-padH);const scale=Math.min(maxW/image.naturalWidth,maxH/image.naturalHeight,1);const width=Math.max(1,Math.floor(image.naturalWidth*scale)),height=Math.max(1,Math.floor(image.naturalHeight*scale));canvas.style.width=`${width}px`;canvas.style.height=`${height}px`;}
function randGen(seed){let x=seed|0;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296};}
function smoothstep(a,b,x){x=Math.max(0,Math.min(1,(x-a)/(b-a)));return x*x*(3-2*x);}
function render(){ if(!image)return; const w=image.naturalWidth,h=image.naturalHeight; if(!w||!h)return; canvas.width=w;canvas.height=h;originalCanvas.width=w;originalCanvas.height=h;
 // Preserve image detail; adjust only photographic color and tone.
 ctx.drawImage(image,0,0,w,h);
 let frame=ctx.getImageData(0,0,w,h),d=frame.data,random=randGen((w*31+h*17+Math.round(values.grain*113))|0),fade=values.fade/100,contrast=1+values.contrast/55, sat=1+values.saturation/100, warmth=values.warmth*0.58, cast=values.cast*0.52, grain=values.grain*0.38, grainScale=values.size/100,q=Math.max(1,Math.round(grainScale*6)),grainRow=new Float32Array(Math.ceil(w/q));
 // A distinct highlight response for lifted drugstore prints.
 for(let y=0,i=0;y<h;y++)for(let x=0;x<w;x++,i+=4){let r=d[i],g=d[i+1],b=d[i+2], lum=.2126*r+.7152*g+.0722*b;
   let flash=values.flash/100, dx=(x/w-.5)*1.45,dy=(y/h-.49)*1.45,rad=Math.sqrt(dx*dx+dy*dy), center=Math.max(0,1-rad*1.9);
   let flashBoost=flash*center*(activePreset==='disposable'?.27:.16); r+=255*flashBoost;g+=247*flashBoost;b+=225*flashBoost;
   r+=(warmth+cast*.28);g+=cast-warmth*.08;b+=(-warmth*.78-cast*.34);
   const midpoint=128; r=(r-midpoint)*contrast+midpoint;g=(g-midpoint)*contrast+midpoint;b=(b-midpoint)*contrast+midpoint;
   const l=.2126*r+.7152*g+.0722*b;r=l+(r-l)*sat;g=l+(g-l)*sat;b=l+(b-l)*sat;
   // Fade lifts blacks and compresses highlights with a warm paper response.
   const f=fade*.58;r=r*(1-f)+244*f;g=g*(1-f)+235*f;b=b*(1-f)+218*f;
   const black=values.black*1.2;r+=black;g+=black*.93;b+=black*.78;
   const hi=smoothstep(110,255,lum)*values.highlights/100; r=r*(1-hi*.12)+245*hi*.12;g=g*(1-hi*.1)+239*hi*.1;b=b*(1-hi*.08)+225*hi*.08;
   let n=0;if(grain>0){if(q===1)n=(random()*2-1)*grain;else{let bx=Math.floor(x/q);if(x%q===0&&y%q===0)grainRow[bx]=(random()*2-1)*grain;n=grainRow[bx];}}
   d[i]=Math.max(0,Math.min(255,r+n));d[i+1]=Math.max(0,Math.min(255,g+n));d[i+2]=Math.max(0,Math.min(255,b+n));
 }
 ctx.putImageData(frame,0,0);
 originalCtx.clearRect(0,0,w,h);originalCtx.drawImage(image,0,0,w,h);
 updateCompare(); fitPreview(); }
function updateCompare(){const top=$('#originalCanvas'),bottom=$('#processedCanvas');top.classList.toggle('show-original',showOriginal);$('#wipeLine').classList.toggle('hidden',!showOriginal);$('#compareBtn').textContent=showOriginal?'SHOWING ORIGINAL · RELEASE TO SEE PRINT':'HOLD TO SEE ORIGINAL';}
function setCompare(on){if(!image)return;showOriginal=on;updateCompare();}
function loadFile(file){if(!file)return;if(!file.type.startsWith('image/')){alert('Please choose an image file.');return;}const url=URL.createObjectURL(file),img=new Image();img.onload=()=>{image=img;filename=file.name.replace(/\.[^.]+$/,'');$('#fileStatus').textContent=file.name;$('#captionName').textContent=`${filename.toUpperCase()} · 1 PRINT`;$('#emptyState').classList.add('hidden');$('#imageFrame').classList.remove('hidden');$('#stageUpload').classList.remove('hidden');$('#focusToggle').disabled=false;$('#resetBtn').disabled=false;$('#compareBtn').disabled=false;$('#viewOriginal').disabled=false;$('#downloadJpg').disabled=false;$('#downloadPng').disabled=false;$('#previewStatus').textContent=`${img.naturalWidth} × ${img.naturalHeight} · READY TO MAKE A PRINT`;render();URL.revokeObjectURL(url);};img.onerror=()=>{URL.revokeObjectURL(url);alert('That photo could not be opened. Try another image.');};img.src=url;}
function exportImage(type){if(!image)return;const mime=type==='jpeg'?'image/jpeg':'image/png';canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${filename||'rivavr-memory-lab'}-${activePreset}.${type==='jpeg'?'jpg':'png'}`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);},mime,type==='jpeg'?.94:undefined);}
$('#imageInput').addEventListener('change',e=>{const file=e.target.files[0];e.target.value='';loadFile(file);});$('#presetGrid').addEventListener('click',e=>{const btn=e.target.closest('[data-preset]');if(btn)applyPreset(btn.dataset.preset);});
$('#compareBtn').addEventListener('pointerdown',e=>{e.preventDefault();setCompare(true);});['pointerup','pointercancel','pointerleave'].forEach(ev=>$('#compareBtn').addEventListener(ev,()=>setCompare(false)));$('#viewOriginal').addEventListener('click',()=>{setCompare(!showOriginal);});
$('#downloadPng').onclick=()=>exportImage('png');$('#downloadJpg').onclick=()=>exportImage('jpeg');$('#resetBtn').onclick=()=>{if(!image)return;activePreset='original';values={grain:0,size:0,fade:0,black:0,warmth:0,cast:0,contrast:0,saturation:0,highlights:0,flash:0};document.querySelectorAll('.preset-card').forEach(b=>b.classList.remove('active'));$('#activePresetName').textContent='Original photo';$('#presetDescription').textContent='Your photo, just as it came from the camera.';makeControls();$('#previewStatus').textContent=`${image.naturalWidth} × ${image.naturalHeight} · ORIGINAL PHOTO`;queueRender();};
$('#focusToggle').addEventListener('click',()=>{const enabled=document.body.classList.toggle('focus-preview');$('#focusToggle').setAttribute('aria-pressed',String(enabled));$('#focusToggle').setAttribute('aria-label',enabled?'Exit full-screen photo view':'Show photo full screen');$('#focusToggle').querySelector('span').textContent=enabled?'EXIT FULL SCREEN':'FULL SCREEN';});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('focus-preview'))$('#focusToggle').click();});
new ResizeObserver(()=>fitPreview()).observe($('#photoStage'));
applyPreset('family');
