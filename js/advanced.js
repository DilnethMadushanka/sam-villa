(function(){
  var root=document.documentElement;
  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var ci=document.getElementById('ci'),co=document.getElementById('co'),gu=document.getElementById('gu');
  var form=document.getElementById('book'),msg=document.getElementById('bk-msg');
  function nights(){var n=Math.round((new Date(co.value)-new Date(ci.value))/864e5);return n>0?n:0}
  function guests(){return parseInt(gu.value,10)||1}
  function esc(v){return String(v).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function money(n){return '$'+n.toLocaleString('en-US')}
  var rooms=Array.prototype.slice.call(document.querySelectorAll('[data-room]'));
  function info(el){return{name:el.dataset.room,rate:+el.dataset.rate,sleeps:+el.dataset.sleeps,status:el.dataset.status,bed:el.dataset.bed,img:el.dataset.img,desc:el.dataset.desc}}

  /* Booking results: real totals for the chosen dates */
  var results=document.createElement('div');results.className='sv-results';results.hidden=true;results.setAttribute('aria-live','polite');
  form.appendChild(results);
  form.addEventListener('submit',function(e){
    e.preventDefault();
    var n=nights();if(!n)return;
    var g=guests();
    results.innerHTML='<p class="sv-results__title">Rooms for '+n+(n===1?' night':' nights')+', '+g+(g===1?' guest':' guests')+'</p>';
    rooms.forEach(function(el,i){
      var r=info(el),fits=g<=r.sleeps,open=r.status!=='booked'&&fits;
      var meta=r.status==='booked'?'Fully booked for these dates':!fits?'Sleeps '+r.sleeps+', too small for '+g:r.status==='few'?'Few nights left':'Available';
      var row=document.createElement('div');row.className='sv-result'+(open?'':' is-off');row.style.setProperty('--r',i);
      row.innerHTML='<img src="'+esc(r.img)+'" alt="" loading="lazy"><div><div class="sv-result__name">'+esc(r.name)+'</div><div class="sv-result__meta">'+meta+'</div></div>'+
        (open?'<div class="sv-result__go"><b>'+money(r.rate*n)+'</b><button class="sv-button sv-button--primary" type="button">Reserve</button></div>':'');
      if(open)row.querySelector('button').addEventListener('click',function(){
        results.querySelectorAll('.is-picked').forEach(function(x){x.classList.remove('is-picked')});
        row.classList.add('is-picked');
        msg.textContent=r.name+' selected, '+money(r.rate*n)+' total.';
        document.dispatchEvent(new CustomEvent('sv:reserve',{detail:{room:r.name,rate:r.rate,nights:n,total:r.rate*n,checkIn:ci.value,checkOut:co.value,guests:g}}));
      });
      results.appendChild(row);
    });
    results.hidden=false;
    msg.textContent='Pick a room to reserve';
  });

  /* Room modal */
  var dlg=document.getElementById('room-dialog');
  function fillModal(el){
    var r=info(el);
    document.getElementById('rd-img').src=r.img;
    document.getElementById('rd-img').alt=r.name;
    document.getElementById('rd-title').textContent=r.name;
    document.getElementById('rd-desc').textContent=r.desc;
    var pill=document.getElementById('rd-pill');
    pill.className='sv-pill '+(r.status==='booked'?'sv-pill--booked':r.status==='few'?'sv-pill--few':'sv-pill--available');
    pill.textContent=r.status==='booked'?'Fully booked':r.status==='few'?'Few nights left':'Available';
    document.getElementById('rd-facts').innerHTML='<li>'+esc(r.bed)+'</li><li>Sleeps '+Number(r.sleeps)+'</li><li>Own bathroom</li><li>Garden door</li>';
    document.getElementById('rd-price').innerHTML=money(r.rate)+' <small>/ night, sample rate</small>';
    var n=nights();
    document.getElementById('rd-total').textContent=n?n+(n===1?' night':' nights')+' = '+money(r.rate*n):'';
  }
  if(dlg&&dlg.showModal){
    rooms.forEach(function(el){
      var btn=el.querySelector('.sv-room__foot .sv-button');
      if(btn)btn.addEventListener('click',function(e){e.preventDefault();fillModal(el);dlg.showModal()});
    });
  }

  /* Lightbox */
  var lb=document.getElementById('lightbox');
  if(lb&&lb.showModal){
    document.querySelectorAll('.sv-welcome .sv-photo img,.sv-tile__photo img,.sv-band__photo img,.sv-location__map img').forEach(function(img){
      img.setAttribute('data-zoom','');
      img.parentNode.addEventListener('click',function(){
        document.getElementById('lb-img').src=img.currentSrc||img.src;
        document.getElementById('lb-img').alt=img.alt;
        document.getElementById('lb-cap').textContent=img.alt;
        lb.showModal();
      });
    });
    lb.addEventListener('click',function(e){if(e.target===lb||e.target.id==='lb-img')lb.close()});
  }
  /* close buttons and backdrop for both dialogs */
  [dlg,lb].forEach(function(d){
    if(!d)return;
    d.addEventListener('click',function(e){
      if(e.target.closest('[data-close]')){d.close();return}
      var r=d.getBoundingClientRect();
      if(d===dlg&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close();
    });
  });

  /* Day timeline: line fills and steps light up as you scroll */
  var tl=document.getElementById('timeline');
  if(tl){
    var steps=Array.prototype.slice.call(tl.querySelectorAll('.sv-step'));
    var tick=false;
    function tlUpdate(){
      var vh=window.innerHeight,r=tl.getBoundingClientRect();
      var p=(vh*.6-r.top)/r.height;p=Math.max(0,Math.min(1,p));
      tl.style.setProperty('--p',p.toFixed(3));
      steps.forEach(function(s){var b=s.getBoundingClientRect();s.classList.toggle('is-on',b.top<vh*.62)});
      tick=false;
    }
    window.addEventListener('scroll',function(){if(!tick){tick=true;requestAnimationFrame(tlUpdate)}},{passive:true});
    window.addEventListener('resize',tlUpdate);tlUpdate();
  }

  /* Review carousel arrows */
  var snaps=document.querySelector('.sv-snaps');
  if(snaps){
    var wrap=document.createElement('div');wrap.className='sv-carousel';
    snaps.parentNode.insertBefore(wrap,snaps);wrap.appendChild(snaps);
    var ar=document.createElement('div');ar.className='sv-arrows';
    var path={l:'M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z',r:'M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z'};
    function mk(dir,label){var b=document.createElement('button');b.type='button';b.className='sv-arrow';b.setAttribute('aria-label',label);b.innerHTML='<svg class="sv-icon" viewBox="0 0 256 256" aria-hidden="true"><path d="'+path[dir]+'"/></svg>';return b}
    var prev=mk('l','Previous review'),next=mk('r','Next review');
    ar.appendChild(prev);ar.appendChild(next);wrap.appendChild(ar);
    function step(d){snaps.scrollBy({left:d*(snaps.firstElementChild.offsetWidth+16),behavior:reduce?'auto':'smooth'})}
    prev.addEventListener('click',function(){step(-1)});next.addEventListener('click',function(){step(1)});
    function st(){prev.disabled=snaps.scrollLeft<4;next.disabled=snaps.scrollLeft+snaps.clientWidth>=snaps.scrollWidth-4}
    snaps.addEventListener('scroll',st,{passive:true});st();
    if(fine){
      var down=false,sx=0,sl=0,moved=false;
      snaps.addEventListener('mousedown',function(e){down=true;moved=false;sx=e.pageX;sl=snaps.scrollLeft});
      window.addEventListener('mouseup',function(){down=false;snaps.classList.remove('is-drag')});
      window.addEventListener('mousemove',function(e){if(!down)return;var dx=e.pageX-sx;if(Math.abs(dx)>4){moved=true;snaps.classList.add('is-drag')}snaps.scrollLeft=sl-dx});
    }
  }

  /* Cursor follower and magnetic buttons (mouse only, no reduced motion) */
  if(fine&&!reduce){
    var cur=document.getElementById('cursor');
    if(cur){
      root.classList.add('has-cursor');
      var x=0,y=0,cx=0,cy=0,raf=null;
      function loop(){cx+=(x-cx)*.2;cy+=(y-cy)*.2;cur.style.transform='translate3d('+cx.toFixed(1)+'px,'+cy.toFixed(1)+'px,0)';raf=requestAnimationFrame(loop)}
      window.addEventListener('mousemove',function(e){x=e.clientX;y=e.clientY;if(!cur.classList.contains('is-on')){cx=x;cy=y;cur.classList.add('is-on')}if(!raf)loop()},{passive:true});
      document.addEventListener('mouseleave',function(){cur.classList.remove('is-on')});
      document.addEventListener('mouseover',function(e){
        var t=e.target;
        var view=t.closest&&t.closest('[data-zoom],.sv-photo:has([data-zoom])');
        var link=t.closest&&t.closest('a,button,.sv-room,.sv-arrow,select,input');
        cur.classList.toggle('is-view',!!view);
        cur.classList.toggle('is-link',!!link&&!view);
        cur.firstElementChild.textContent=view?'View':'';
      });
    }
    document.querySelectorAll('.sv-stage .sv-button,.sv-cta .sv-button,.sv-booking .sv-button--block').forEach(function(b){
      b.addEventListener('mousemove',function(e){
        var r=b.getBoundingClientRect();
        b.style.translate=((e.clientX-r.left-r.width/2)*.12).toFixed(1)+'px '+((e.clientY-r.top-r.height/2)*.22).toFixed(1)+'px';
      });
      b.addEventListener('mouseleave',function(){b.style.translate=''});
    });
  }
})();
