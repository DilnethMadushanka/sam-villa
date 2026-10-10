(function(){
  var root=document.documentElement;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* Split the hero headline into words for the mask-reveal */
  var h1=document.querySelector('.sv-stage .sv-h--xl');
  if(h1){
    var w=0;
    (function walk(node){
      Array.prototype.slice.call(node.childNodes).forEach(function(n){
        if(n.nodeType===3){
          var frag=document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach(function(t){
            if(!t)return;
            if(/^\s+$/.test(t)){frag.appendChild(document.createTextNode(' '));return}
            var o=document.createElement('span');o.className='sv-word';o.style.setProperty('--w',w++);
            var i=document.createElement('span');i.textContent=t;o.appendChild(i);frag.appendChild(o);
          });
          node.replaceChild(frag,n);
        }else if(n.nodeType===1&&!n.classList.contains('sv-word')){walk(n)}
      });
    })(h1);
  }

  /* Loading screen: real progress from images + fonts, with a floor and a ceiling */
  var loader=document.getElementById('loader');
  var bar=loader&&loader.querySelector('.sv-loader__bar');
  var pct=loader&&loader.querySelector('.sv-loader__pct');
  var finished=false;
  function setP(p){
    if(bar)bar.style.strokeDashoffset=String(352*(1-p));
    if(pct)pct.textContent=Math.round(p*100)+'%';
  }
  function reveal(){
    if(finished)return;finished=true;
    setP(1);
    if(!loader){root.classList.remove('is-loading');root.classList.add('is-ready');return}
    setTimeout(function(){
      loader.classList.add('is-done');
      root.classList.remove('is-loading');
      setTimeout(function(){root.classList.add('is-ready')},reduce?0:350);
      setTimeout(function(){loader.classList.add('is-gone')},reduce?50:1100);
    },reduce?0:250);
  }
  if(loader){
    var start=Date.now(),floor=reduce?0:1500,ceiling=4500;
    var imgs=Array.prototype.slice.call(document.querySelectorAll('img[fetchpriority="high"],.sv-stage img'));
    var total=imgs.length+1,loaded=0;
    function tick(){loaded++;setP(Math.min(loaded/total,.96))}
    imgs.forEach(function(im){
      if(im.complete){tick()}else{im.addEventListener('load',tick);im.addEventListener('error',tick)}
    });
    if(document.fonts&&document.fonts.ready){document.fonts.ready.then(tick,tick)}else{tick()}
    var iv=setInterval(function(){
      var el=Date.now()-start;
      if(loaded>=total&&el>=floor){clearInterval(iv);reveal()}
      else if(el>=ceiling){clearInterval(iv);reveal()}
    },60);
  }else{reveal()}

  /* Header state, progress bar, hero parallax, mobile dock */
  var header=document.querySelector('.sv-header');
  var prog=document.createElement('div');prog.className='sv-progress';document.body.appendChild(prog);
  var bg=document.querySelector('.sv-stage__bg');
  var stage=document.querySelector('.sv-stage');
  var dock=document.getElementById('dock');
  var ticking=false;
  function onScroll(){
    var y=window.scrollY||window.pageYOffset;
    var max=document.documentElement.scrollHeight-window.innerHeight;
    prog.style.transform='scaleX('+(max>0?Math.min(y/max,1):0)+')';
    if(header)header.classList.toggle('is-scrolled',y>12);
    if(bg&&!reduce&&y<window.innerHeight*1.2)bg.style.transform='translate3d(0,'+(y*.12).toFixed(1)+'px,0)';
    if(dock&&stage){dock.classList.toggle('is-on',y>stage.offsetHeight*.7)}
    ticking=false;
  }
  window.addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(onScroll)}},{passive:true});
  onScroll();
  if(stage&&'IntersectionObserver' in window)new IntersectionObserver(function(es){stage.classList.toggle('is-off',!es[0].isIntersecting)}).observe(stage);

  /* Scroll reveal with stagger */
  if(!reduce&&'IntersectionObserver' in window){
    var groups=[
      ['.sv-sec__head',null,''],
      ['.sv-welcome__copy',null,'fx--left'],
      ['.sv-welcome__media .sv-photo',null,''],
      ['.sv-room',null,''],
      ['.sv-tile',null,''],
      ['.sv-score',null,'fx--left'],
      ['.sv-quote',null,''],
      ['.sv-review',null,''],
      ['.sv-location__map',null,'fx--left'],
      ['.sv-location > div:last-child > *',null,''],
      ['.sv-travel__item',null,''],
      ['.sv-cta > *',null,''],
      ['.sv-footer__inner > div',null,'']
    ];
    var io=new IntersectionObserver(function(es){
      es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}});
    },{threshold:.12,rootMargin:'0px 0px -6% 0px'});
    groups.forEach(function(g){
      document.querySelectorAll(g[0]).forEach(function(el,i){
        el.classList.add('fx');if(g[2])el.classList.add(g[2]);
        el.style.setProperty('--d',String(i%4));
        io.observe(el);
      });
    });
    document.querySelectorAll('.sv-band').forEach(function(b){
      var o=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){b.classList.add('is-visible');o.disconnect()}})},{threshold:.25});o.observe(b);
    });
    /* Count up the rating */
    var num=document.querySelector('.sv-score__num');
    if(num){
      var target=parseFloat(num.textContent);
      var co=new IntersectionObserver(function(es){
        if(!es[0].isIntersecting)return;co.disconnect();
        var t0=performance.now();
        (function step(t){
          var p=Math.min((t-t0)/1400,1),e=1-Math.pow(1-p,4);
          num.textContent=(target*e).toFixed(1);
          if(p<1)requestAnimationFrame(step);
        })(t0);
      },{threshold:.6});co.observe(num);
    }
  }

  /* Nav highlight follows the section in view */
  var links=Array.prototype.slice.call(document.querySelectorAll('.sv-nav__link'));
  if(links.length&&'IntersectionObserver' in window){
    var map={};links.forEach(function(a){map[a.getAttribute('href').slice(1)]=a});
    var so=new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(e.isIntersecting&&map[e.target.id]){links.forEach(function(a){a.removeAttribute('aria-current')});map[e.target.id].setAttribute('aria-current','page')}
      });
    },{rootMargin:'-40% 0px -55% 0px'});
    Object.keys(map).forEach(function(id){var s=document.getElementById(id);if(s)so.observe(s)});
    var top=document.getElementById('top');
    if(top)new IntersectionObserver(function(es){if(es[0].isIntersecting)links.forEach(function(a){a.removeAttribute('aria-current')})},{rootMargin:'-40% 0px -55% 0px'}).observe(top);
  }

  /* Pointer tilt on room cards (mouse only) */
  if(fine&&!reduce){
    document.querySelectorAll('.sv-room--featured').forEach(function(c){
      c.addEventListener('mousemove',function(e){
        var r=c.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;
        c.style.transform='perspective(1000px) rotateY('+(x*5).toFixed(2)+'deg) rotateX('+(-y*5).toFixed(2)+'deg) translateY(-4px)';
      });
      c.addEventListener('mouseleave',function(){c.style.transform=''});
    });
  }
})();
