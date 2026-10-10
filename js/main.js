(function(){
  var open=document.getElementById('menu-open'),sheet=document.getElementById('sheet'),close=document.getElementById('menu-close');
  function set(v){sheet.hidden=!v;open.setAttribute('aria-expanded',String(v));if(v){close.focus()}else{open.focus()}}
  open.addEventListener('click',function(){set(true)});close.addEventListener('click',function(){set(false)});
  sheet.addEventListener('click',function(e){if(e.target.tagName==='A')set(false)});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden)set(false)});
  var f=document.getElementById('book'),ci=document.getElementById('ci'),co=document.getElementById('co'),gu=document.getElementById('gu'),sum=document.getElementById('bk-sum'),msg=document.getElementById('bk-msg'),cof=document.getElementById('co-field');
  function nights(){var a=new Date(ci.value),b=new Date(co.value);return Math.round((b-a)/864e5)}
  function upd(){var n=nights(),g=gu.value;if(!(n>0)){cof.classList.add('sv-field--invalid');sum.innerHTML='<strong>Check-out must be after check-in</strong>';return false}cof.classList.remove('sv-field--invalid');sum.innerHTML='<strong>'+n+(n===1?' night':' nights')+'</strong> for '+g+', breakfast included';return true}
  [ci,co,gu].forEach(function(el){el.addEventListener('change',upd)});
  f.addEventListener('submit',function(e){e.preventDefault();if(upd()){msg.textContent='This preview does not send bookings yet. Your dates look good.'}});
  document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){var t=b.getAttribute('data-copy');var done=function(){var o=b.lastChild.textContent;b.lastChild.textContent=' Copied';setTimeout(function(){b.lastChild.textContent=o},1400)};try{navigator.clipboard.writeText(t).then(done,function(){})}catch(err){}})});
})();
