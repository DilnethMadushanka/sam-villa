/* Entrance doors: scrolling the first screen swings the doors open and walks the camera through into the hero.
   Native scroll, no hijacking: the hero is pinned (sticky) for one runway of scroll while this plays.
   window.svDoorDist tells effects.js how much scroll the doors use, so the hero parallax starts after them. */
(function(){
  var root=document.documentElement;
  var doors=document.getElementById('doors'),entry=document.getElementById('entry');
  if(!doors||!entry)return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches){doors.parentNode.removeChild(doors);return}
  root.classList.add('has-doors');

  var pin=entry.querySelector('.sv-entry__pin'),run=entry.querySelector('.sv-entry__run');
  var scene=doors.querySelector('.sv-doors__scene'),frame=doors.querySelector('.sv-doors__frame');
  var dist=1,sEnd=4,ticking=false;
  function clamp(v){return v<0?0:v>1?1:v}
  function inOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}

  function measure(){
    // pin the hero exactly where it already sits, so nothing jumps when it sticks
    pin.style.top=Math.max(0,entry.getBoundingClientRect().top+(window.scrollY||0))+'px';
    dist=Math.max(1,run.offsetHeight);
    window.svDoorDist=dist;
    // zoom until the doorway is well past every edge of the screen
    var fw=frame.offsetWidth||1,fh=frame.offsetHeight||1;
    sEnd=Math.max(window.innerWidth/fw,window.innerHeight/fh)*2.2;
    scene.style.transformOrigin='50% '+(frame.offsetTop+frame.parentNode.offsetTop+fh*.6).toFixed(0)+'px';
    update();
  }
  function update(){
    ticking=false;
    var p=clamp((window.scrollY||0)/dist);
    var swing=inOut(clamp(p/.6));
    var walk=clamp((p-.1)/.9);walk=walk*walk*walk;
    doors.style.setProperty('--a',(swing*104).toFixed(2));
    doors.style.setProperty('--fade',clamp(1-p/.2).toFixed(3));
    scene.style.transform='scale('+(1+(sEnd-1)*walk).toFixed(4)+')';
    doors.style.opacity=clamp((1-p)/.18).toFixed(3);
    doors.classList.toggle('is-open',p>=1);
  }
  function stepIn(){window.scrollTo({top:dist,behavior:'smooth'})}

  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
  var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(measure,120)});
  window.addEventListener('load',measure);
  doors.querySelector('.sv-doors__hint').addEventListener('click',stepIn);
  // "back to top" links land on the open hero, not the closed doors
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a[href="#top"]');
    if(a){e.preventDefault();stepIn()}
  });
  // keyboard users tabbing into the page should not land on links hidden behind the closed doors
  document.addEventListener('focusin',function(){if(!doors.classList.contains('is-open'))window.scrollTo(0,dist)});
  measure();
})();
