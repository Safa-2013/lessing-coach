// No media autoplay permission is needed for the continuous fallback animation.
export function advanceDvd(s,dt){
 const width=720,height=405,lw=120,lh=64;
 s.x+=s.vx*Math.min(dt,.05);s.y+=s.vy*Math.min(dt,.05);
 let hit=false;
 if(s.x<=0||s.x>=width-lw){s.x=Math.max(0,Math.min(width-lw,s.x));s.vx*=-1;hit=true}
 if(s.y<=0||s.y>=height-lh){s.y=Math.max(0,Math.min(height-lh,s.y));s.vy*=-1;hit=true}
 if(hit)s.color=(s.color+1)%6;return s;
}
export function createDvdScreensaver(root){
 const video=document.createElement('video');video.autoplay=true;video.loop=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.controls=false;video.preload='auto';video.src='/assets/dvd-screensaver.mp4';video.setAttribute('playsinline','');video.setAttribute('muted','');video.setAttribute('aria-label','DVD-Bildschirmschoner');video.className='dvd-media';video.style.display='none';
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=405;canvas.className='dvd-media';canvas.setAttribute('aria-label','Automatisch laufender DVD-Bildschirmschoner');root.append(video,canvas);
 const context=canvas.getContext('2d'),colors=['#66deff','#ff75aa','#fbe474','#73ffb0','#b791ff','#ff985f'];let live=true,frame=0,last=0;const s={x:35,y:80,vx:110,vy:83,color:0};
 function draw(t){if(!live)return;advanceDvd(s,last?(t-last)/1000:0);last=t;if(context){context.fillStyle='#03050b';context.fillRect(0,0,720,405);context.save();context.translate(s.x,s.y);context.fillStyle=colors[s.color];context.font='italic 900 38px Arial';context.textAlign='center';context.fillText('DVD',60,35);context.beginPath();context.ellipse(60,45,56,7,0,0,Math.PI*2);context.fill();context.fillStyle='#03050b';context.beginPath();context.ellipse(60,45,12,3,0,0,Math.PI*2);context.fill();context.fillStyle=colors[s.color];context.font='bold 12px Arial';context.fillText('V I D E O',60,64);context.restore()}frame=requestAnimationFrame(draw)}
 function fallback(){if(!live)return;video.style.display='none';canvas.style.display='block';if(!frame){last=0;frame=requestAnimationFrame(draw)}}
 video.addEventListener('playing',()=>{if(!live)return;canvas.style.display='none';video.style.display='block';cancelAnimationFrame(frame);frame=0});for(const event of ['error','stalled','pause'])video.addEventListener(event,fallback);
 fallback();const play=video.play();play?.catch(fallback);
 const visibility=()=>{if(!live)return;if(document.hidden){cancelAnimationFrame(frame);frame=0;video.pause()}else{fallback();video.play()?.catch(fallback)}};document.addEventListener('visibilitychange',visibility);
 return ()=>{live=false;cancelAnimationFrame(frame);video.pause();video.removeAttribute('src');video.load();document.removeEventListener('visibilitychange',visibility)};
}
