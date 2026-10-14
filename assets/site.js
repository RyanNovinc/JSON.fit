/* json.fit shared page script: menu, footer, download tracking, reveal-on-scroll.
   Pages with <body data-store="train"> send App Store taps to the Training custom product page. */
(function(){
  var PPID='b08433ee-bbbe-4c5a-8066-4c6c2df76d44';
  var train=document.body&&document.body.getAttribute('data-store')==='train';
  // Support address assembled at runtime (keeps it out of scrapers).
  var s=document.getElementById('supportLink'); if(s) s.href='mailto:'+['support','json.fit'].join('@');
  // Menu.
  var b=document.getElementById('burger'), n=document.getElementById('navLinks');
  if(b&&n){
    b.addEventListener('click',function(e){e.stopPropagation();var o=n.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');});
    n.addEventListener('click',function(e){if(e.target.closest('a')){n.classList.remove('open');b.setAttribute('aria-expanded','false');}});
    document.addEventListener('click',function(e){if(!n.contains(e.target)){n.classList.remove('open');b.setAttribute('aria-expanded','false');}});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'){n.classList.remove('open');b.setAttribute('aria-expanded','false');}});
  }
  // App Store links on training pages carry the training ppid; download taps are counted.
  function withPpid(href){try{var u=new URL(href);if(u.hostname==='apps.apple.com'&&!u.searchParams.get('ppid')){u.searchParams.set('ppid',PPID);return u.toString();}}catch(e){}return href;}
  // Pages without a download band: "Get the app" goes straight to the App Store.
  if(!document.getElementById('download')) document.querySelectorAll('a.nav-cta[href="#download"]').forEach(function(a){a.href='https://apps.apple.com/au/app/json-fit/id6758357834';});
  if(train) document.querySelectorAll('a[href*="apps.apple.com"]').forEach(function(a){a.href=withPpid(a.href);});
  document.addEventListener('click',function(e){
    var a=e.target.closest&&e.target.closest('a'); if(!a||!a.href) return;
    if(train&&a.href.indexOf('apps.apple.com')>-1) a.href=withPpid(a.href);
    // App Store install attribution: App Store Connect campaign link (provider 127775601), one campaign per button.
    if(a.dataset.loc&&a.href.indexOf('apps.apple.com')>-1&&a.href.indexOf('pt=')<0){try{var au=new URL(a.href);au.searchParams.set('pt','127775601');au.searchParams.set('ct','website_'+a.dataset.loc);au.searchParams.set('mt','8');a.href=au.toString();}catch(e){}}
    // Play Store install attribution: Play Console reports installs by these UTM values.
    if(a.dataset.loc&&a.href.indexOf('play.google.com')>-1&&a.href.indexOf('referrer=')<0){try{var pu=new URL(a.href);pu.searchParams.set('referrer','utm_source=json.fit&utm_medium=web&utm_content='+a.dataset.loc);a.href=pu.toString();}catch(e){}}
    if(a.dataset.loc){var dl={button_location:a.dataset.loc,store:a.href.indexOf('play.google')>-1?'play':'app_store'};if(window.gtag) gtag('event','download_click',dl);if(window.track) window.track('download_click',dl);}
  },true);
  // Reveal on scroll; everything is visible without JS, without IntersectionObserver, or with Reduce Motion.
  var els=document.querySelectorAll('.rv');
  if(!els.length||!('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js');
  var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{rootMargin:'0px 0px -6% 0px',threshold:.06});
  els.forEach(function(el){io.observe(el);});
})();
