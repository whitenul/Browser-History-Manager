(function () {
  'use strict';

  var isMainWorld = false;
  try {
    isMainWorld = !chrome || !chrome.runtime;
  } catch (e) {
    isMainWorld = true;
  }

  if (!isMainWorld) {
    return;
  }

  document.documentElement.setAttribute('data-hmm-main-ready', 'true');

  var GM_POLYFILL = [
    'var unsafeWindow=window;',
    'var GM_info={script:{name:"",version:"",description:""},scriptHandler:"HMM",version:"1.0"};',
    'var GM_log=console.log.bind(console);',
    'var GM_getValue=function(k,d){try{var v=localStorage.getItem("__hmm_gm_"+k);return v!==null?JSON.parse(v):d}catch{return d}};',
    'var GM_setValue=function(k,v){localStorage.setItem("__hmm_gm_"+k,JSON.stringify(v))};',
    'var GM_deleteValue=function(k){localStorage.removeItem("__hmm_gm_"+k)};',
    'var GM_listValues=function(){var r=[];for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(k&&k.startsWith("__hmm_gm_"))r.push(k.slice(10))}return r};',
    'var GM_addStyle=function(c){var s=document.createElement("style");s.textContent=c;document.head.appendChild(s);return s};',
    'var GM_xmlhttpRequest=function(d){var x=new XMLHttpRequest();x.open(d.method||"GET",d.url,true);if(d.headers)Object.entries(d.headers).forEach(function(e){x.setRequestHeader(e[0],e[1])});if(d.onload)x.onload=function(){d.onload({responseText:x.responseText,responseXML:x.responseXML,status:x.status,statusText:x.statusText,readyState:x.readyState,responseURL:x.responseURL})};if(d.onerror)x.onerror=function(){d.onerror({error:x.statusText})};if(d.ontimeout)x.ontimeout=function(){d.ontimeout({})};if(d.timeout)x.timeout=d.timeout;x.withCredentials=!!d.cookie;x.send(d.data||null);return{abort:function(){x.abort()}}};',
    'var GM_notification=function(d,t){if(typeof d==="string")d={text:d};var n=new Notification(t||d.title||"HMM",{body:d.text||d.body,icon:d.image});if(d.onclick)n.onclick=d.onclick;if(d.ondone)n.onclose=d.ondone};',
    'var GM_setClipboard=function(t){navigator.clipboard.writeText(t).catch(function(){})};',
    'var GM_getResourceText=function(){return""};',
    'var GM_getResourceURL=function(){return""};',
    'var GM_openInTab=function(u){window.open(u,"_blank")};',
    'var GM_registerMenuCommand=function(){return 0};',
    'var GM_unregisterMenuCommand=function(){};',
  ].join('\n');

  window.addEventListener('__hmm_inject', function (e) {
    var detail = e.detail;
    if (!detail || !detail.code) return;
    try {
      var fullCode = GM_POLYFILL + '\n' + detail.code;
      (0, eval)(fullCode);
      console.warn('[HMM-MW] ✅ Script executed in MAIN world:', detail.name || 'unknown');
    } catch (err) {
      console.error('[HMM-MW] Script execution error:', detail.name, err);
    }
  });
})();
