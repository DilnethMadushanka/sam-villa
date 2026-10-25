/* Hero 3D on scroll: as the hero scrolls away, the card tips back, the arched photo turns in depth
   and two more photos fan out behind it. Writes one variable (--p, 0 to 1) per frame; the CSS in
   hero.css does the rest. Off under reduced motion. */
(function(){
  var stage=document.querySelector('.sv-stage--split');
  if(!stage||!stage.querySelector('.sv-stage__deck'))return;
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  var deck=stage.querySelector('.sv-stage__deck'),raf=0,last=-1;
  function update(){
    raf=0;
    // desktop: full effect after half a screen of scrolling, while most of the hero is still in view
    // on phones the photo sits on top and leaves first, so the effect plays out over its own height
    var span=window.innerWidth<860?deck.offsetHeight*0.8:Math.min(stage.offsetHeight,window.innerHeight)*0.5;
    var p=Math.max(0,Math.min(1,window.scrollY/span));
    if(Math.abs(p-last)<0.001)return;
    last=p;
    stage.style.setProperty('--p',p.toFixed(4));
  }
  function queue(){if(!raf)raf=requestAnimationFrame(update)}
  window.addEventListener('scroll',queue,{passive:true});
  window.addEventListener('resize',queue);
  stage.classList.add('is-scroll3d');
  update();
})();
