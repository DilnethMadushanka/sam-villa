/* Hero 3D tilt: the arched photo leans toward the cursor with a depth shift and a soft glare.
   Mouse and trackpad only; off for touch and under reduced motion. */
(function(){
  var media=document.querySelector('.sv-stage--split .sv-stage__media');
  if(!media)return;
  if(!window.matchMedia('(hover: hover) and (pointer: fine)').matches)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var stage=media.closest('.sv-stage'),raf=0,nx=0,ny=0,MAX=9,DEPTH=16;
  function apply(){
    raf=0;
    media.style.setProperty('--ry',(nx*MAX).toFixed(2)+'deg');
    media.style.setProperty('--rx',(-ny*MAX*.8).toFixed(2)+'deg');
    media.style.setProperty('--px',(-nx*DEPTH).toFixed(1)+'px');
    media.style.setProperty('--py',(-ny*DEPTH).toFixed(1)+'px');
    media.style.setProperty('--gx',(50+nx*45).toFixed(1)+'%');
    media.style.setProperty('--gy',(35+ny*40).toFixed(1)+'%');
  }
  stage.addEventListener('pointermove',function(e){
    if(e.pointerType!=='mouse')return;
    var r=media.getBoundingClientRect();
    nx=Math.max(-1,Math.min(1,(e.clientX-(r.left+r.width/2))/(r.width/2)));
    ny=Math.max(-1,Math.min(1,(e.clientY-(r.top+r.height/2))/(r.height/2)));
    media.classList.add('is-tilting');media.style.setProperty('--glare','1');
    if(!raf)raf=requestAnimationFrame(apply);
  },{passive:true});
  stage.addEventListener('pointerleave',function(){
    nx=0;ny=0;media.classList.remove('is-tilting');media.style.setProperty('--glare','0');
    if(!raf)raf=requestAnimationFrame(apply);
  });
})();
