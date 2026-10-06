var T={hi:{home:"होम",lesson:"पाठ",bolo:"बोलो",sch:"छात्रवृत्ति",online:"ऑनलाइन",offline:"ऑफ़लाइन",sub:"बिना इंटरनेट भी सीखें"},
en:{home:"Home",lesson:"Lesson",bolo:"Bolo",sch:"Schemes",online:"Online",offline:"Offline",sub:"Learn even without internet"}};
var SCH=[
{n:"National Scholarship Portal (NSP)",f:function(a){return a.inc<=2},d:"Central & state scholarships via one portal."},
{n:"Post Matric Scholarship (SC/ST)",f:function(a){return (a.cat=="sc"||a.cat=="st")&&a.inc<=2},d:"Fees and maintenance support after class 10."},
{n:"Medhavi Vidyarthi Yojana (MP)",f:function(a){return a.course!="none"&&a.inc<=2},d:"MP scheme for meritorious students in higher education."},
{n:"PM-USP (CSSS)",f:function(a){return a.course=="ug"||a.course=="pg"},d:"Central scheme for college/university students."}];
var ROAD={gov:"Goal: Govt job → Graduation + CUET/Patwari/Police/Railway prep; practise with previous-year papers.",
teach:"Goal: Teacher → B.A/B.Sc + B.Ed, then MP TET/CTET.",tech:"Goal: Tech/Skills → ITI/Polytechnic/BCA, free courses on SWAYAM & Skill India.",biz:"Goal: Business → B.Com + local skill training, MSME & Mudra loan awareness."};

var SA={cat:"gen",inc:1,course:"ug",goal:"gov"};
var DISTRICTS=["Agar Malwa","Alirajpur","Anuppur","Ashoknagar","Balaghat","Barwani","Betul","Bhind","Bhopal","Burhanpur","Chhatarpur","Chhindwara","Damoh","Datia","Dewas","Dhar","Dindori","Guna","Gwalior","Harda","Indore","Jabalpur","Jhabua","Katni","Khandwa","Khargone","Maihar","Mandla","Mandsaur","Mauganj","Morena","Narmadapuram","Narsinghpur","Neemuch","Niwari","Pandhurna","Panna","Raisen","Rajgarh","Ratlam","Rewa","Sagar","Satna","Sehore","Seoni","Shahdol","Shajapur","Sheopur","Shivpuri","Sidhi","Singrauli","Tikamgarh","Ujjain","Umaria","Vidisha"];
function sch(){
 var L=S.lang=="hi";
 function sel(id,lab,opts){return '<p><b>'+lab+'</b></p><select id="'+id+'">'+opts.map(function(o){return '<option value="'+o[0]+'"'+(SA[id]==o[0]?" selected":"")+'>'+o[1]+'</option>'}).join("")+'</select>'}
 var h='<div class="card"><h2>'+(L?"5 आसान सवाल":"5 simple questions")+'</h2>'+
 sel("cat",L?"1. श्रेणी":"1. Category",[["gen","General"],["obc","OBC"],["sc","SC"],["st","ST"]])+
 sel("inc",L?"2. सालाना पारिवारिक आय":"2. Family income / year",[[1,"< ₹1 lakh"],[2,"₹1–2.5 lakh"],[3,"> ₹2.5 lakh"]])+
 sel("course",L?"3. पढ़ाई":"3. Course",[["12","Class 11–12"],["ug","UG / Diploma"],["pg","PG"],["none","Not studying"]])+
 '<p><b>'+(L?"4. ज़िला":"4. District")+'</b></p><select id="dist">'+["Jhabua","Mandla","Dindori","Bhopal","Other"].map(function(d){return "<option>"+d+"</option>"}).join("")+'</select>'+
 sel("goal",L?"5. लक्ष्य":"5. Goal",[["gov","Govt job"],["teach","Teacher"],["tech","Tech / Skills"],["biz","Business"]])+
 '<p><button class="btn o" id="match">'+(L?"योजनाएँ खोजें":"Find schemes")+'</button></p></div><div id="res"></div>';
 return h}
function showRes(){
 var a={cat:SA.cat,inc:+SA.inc,course:SA.course},m=SCH.filter(function(s){return s.f(a)});
 var h='<div class="card"><h2>'+(S.lang=="hi"?"आपके लिए योजनाएँ":"Matched schemes")+'</h2>'+(m.length?m.map(function(s){return '<p><b>🎓 '+s.n+'</b><br><span class="mut">'+s.d+'</span></p>'}).join(""):'<p>'+(S.lang=="hi"?"कोई मेल नहीं मिला।":"No match found.")+'</p>')+
 '<p class="mut">* Demo list. Verify eligibility on official portals before applying.</p></div><div class="card"><h2>🧭 Career roadmap</h2><p>'+ROAD[SA.goal]+'</p></div>';
 $("res").innerHTML=h}

// ---------- Core ----------
var $=function(i){return document.getElementById(i)},t=function(k){return T[S.lang][k]},L=function(){return S.lang=="hi"};
var esc=function(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return"&#"+c.charCodeAt(0)+";"})};
var S={lang:"hi",tab:"home",profile:null,packs:{},cat:[],gen:[],open:null,ans:null,rec:false,q:"",queue:0,busy:{},fl:0};
try{var x=JSON.parse(localStorage.getItem("ss")||"{}");if(x.lang)S.lang=x.lang;if(x.profile&&x.profile.name&&x.profile.path&&x.profile.district)S.profile=x.profile}catch(e){}
function save(){try{localStorage.setItem("ss",JSON.stringify({lang:S.lang,profile:S.profile}))}catch(e){}}

// ---------- IndexedDB (packs + sync queue) ----------
var DB;
function tx(st,mode,fn){return new Promise(function(ok,no){
 function run(){var q,tr=DB.transaction(st,mode);q=fn(tr.objectStore(st));tr.oncomplete=function(){ok(q&&q.result)};tr.onerror=function(){no(tr.error)}}
 if(DB)return run();
 var r=indexedDB.open("ss",1);
 r.onupgradeneeded=function(){r.result.createObjectStore("packs",{keyPath:"id"});r.result.createObjectStore("queue",{keyPath:"id",autoIncrement:true})};
 r.onsuccess=function(){DB=r.result;run()};r.onerror=function(){no(r.error)}})}

// ---------- Packs: download / share / import ----------
function dl(id){S.busy[id]=1;render();
 return fetch("packs/"+id+".json").then(function(r){if(!r.ok)throw 0;return r.json()})
 .then(function(p){return tx("packs","readwrite",function(s){return s.put(p)}).then(function(){S.packs[id]=p})})
 .catch(function(){alert(L()?"डाउनलोड नहीं हुआ। इंटरनेट जाँचें।":"Download failed. Check your connection.")})
 .then(function(){delete S.busy[id];render()})}
function share(){var a=Object.keys(S.packs).map(function(i){return S.packs[i]});
 if(!a.length)return alert(L()?"पहले कोई पैक डाउनलोड करें।":"Download a pack first.");
 var f=new File([JSON.stringify(a)],"shikshasetu-packs.txt",{type:"text/plain"});
 if(navigator.canShare&&navigator.canShare({files:[f]}))navigator.share({files:[f],title:"ShikshaSetu"}).catch(function(){});
 else{var l=document.createElement("a");l.href=URL.createObjectURL(f);l.download=f.name;l.click()}}
function imp(f){var rd=new FileReader();rd.onload=function(){try{var a=JSON.parse(rd.result);if(!Array.isArray(a))a=[a];
 var ok=a.filter(function(p){return p&&typeof p.id=="string"&&/^[\w-]+$/.test(p.id)&&typeof p.hi=="string"&&typeof p.en=="string"&&p.t&&typeof p.t.hi=="string"&&typeof p.t.en=="string"});
 Promise.all(ok.map(function(p){return tx("packs","readwrite",function(s){return s.put(p)}).then(function(){S.packs[p.id]=p})}))
 .then(function(){alert(ok.length+(L()?" पैक जुड़ गए ✅":" pack(s) imported ✅"));render()})}catch(e){alert(L()?"फ़ाइल सही नहीं है।":"Invalid file.")}};rd.readAsText(f)}

// ---------- Doubts: offline FAQ -> AI -> Smart Sync queue ----------
function find(q){var l=q.toLowerCase(),all=S.gen.slice();
 Object.keys(S.packs).forEach(function(i){all=all.concat(S.packs[i].faq||[])});
 return all.filter(function(e){return e&&Array.isArray(e.k)&&e.a&&e.k.some(function(k){return l.indexOf(String(k).toLowerCase())>-1})})[0]}
function api(q,l,m){return fetch("/api/doubts",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({question:q,lang:l||S.lang,mentor:!!m})}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(j){return j})}
function enqueue(q,m){tx("queue","readwrite",function(s){return s.add({q:q,lang:S.lang,m:!!m})}).then(function(){S.queue++;
 S.ans={q:q,a:L()?"उत्तर ऑफ़लाइन नहीं मिला। सवाल सेव हो गया, नेटवर्क मिलते ही जवाब आएगा।":"No offline answer. Saved; the answer will arrive when a network appears.",src:"🕒 Smart Sync queue"};render()})}
function answer(q){S.q="";var f=find(q);
 if(f){S.ans={q:q,a:String(f.a[S.lang]||f.a.en||""),src:"📦 "+(L()?"ऑफ़लाइन FAQ से":"Offline FAQ")};return render()}
 if(!navigator.onLine)return enqueue(q);
 S.ans={q:q,a:"…",src:"🌐 AI"};render();
 api(q).then(function(j){got(q,j)}).catch(function(){enqueue(q)})}
function askMentor(q){S.q="";if(!navigator.onLine)return enqueue(q,true);S.ans={q:q,a:"…",src:"👩‍🏫 Mentor"};render();api(q,S.lang,true).then(function(j){got(q,j)}).catch(function(){enqueue(q,true)})}
function flush(){if(!navigator.onLine||S.fl)return;S.fl=1;
 tx("queue","readonly",function(s){return s.getAll()}).then(function(a){
  return Promise.all((a||[]).map(function(it){return api(it.q,it.lang,it.m).then(function(j){
   return tx("queue","readwrite",function(s){return s.delete(it.id)}).then(function(){S.queue=Math.max(0,S.queue-1);got(it.q,j)})}).catch(function(){})}))})
 .then(function(){S.fl=0},function(){S.fl=0})}

// ---------- AI answer or mentor wait ----------
function waits(){try{return JSON.parse(localStorage.getItem("sw")||"[]")}catch(e){return[]}}
function setW(a){try{localStorage.setItem("sw",JSON.stringify(a))}catch(e){}}
function got(q,j){if(j&&j.answer)S.ans={q:q,a:j.answer,src:"🌐 AI"};
 else{if(j&&j.id){var a=waits();a.push({id:j.id,q:q});setW(a)}
  S.ans={q:q,a:L()?"सवाल मेंटर को भेज दिया गया। जवाब यहीं आएगा (कुछ घंटे लग सकते हैं)।":"Sent to a mentor. The reply will appear here (may take a few hours).",src:"👩‍🏫 Mentor queue"}}
 render()}
function poll(){if(!navigator.onLine)return;waits().forEach(function(w){fetch("/api/doubts/"+encodeURIComponent(w.id)).then(function(r){return r.json()}).then(function(j){if(!j.answer)return;
 setW(waits().filter(function(x){return x.id!=w.id}));S.ans={q:w.q,a:j.answer,src:"👩‍🏫 "+(L()?"मेंटर का जवाब":"Mentor reply")};S.tab="bolo";render()}).catch(function(){})})}

// ---------- Views ----------
function login(){
 var Lh=L(),p=S.profile||{},paths=[["school",Lh?"स्कूल":"School"],["college",Lh?"कॉलेज":"College"],["prep",Lh?"परीक्षा की तैयारी":"Exam preparation"]];
 return '<div class="card login-card"><div class="row sp"><h2>'+(p.name?(Lh?"अपनी जानकारी बदलें":"Update your details"):(Lh?"छात्र लॉगिन":"Student login"))+'</h2><div class="row"><button type="button" class="chip '+(Lh?"on":"")+'" data-l="hi">हिन्दी</button><button type="button" class="chip '+(Lh?"":"on")+'" data-l="en">English</button></div></div><p class="mut">'+(Lh?"बस ये जानकारी भरें। इंटरनेट के बिना भी लॉगिन होगा।":"Just fill in these details. Login works offline too.")+'</p><form id="student-form">'+
 '<label for="student-name">'+(Lh?"छात्र का नाम":"Student name")+'</label><input id="student-name" name="name" autocomplete="name" maxlength="60" required value="'+esc(p.name||"")+'" placeholder="'+(Lh?"अपना नाम लिखें":"Enter your name")+'">'+
 '<label for="student-path">'+(Lh?"आप अभी क्या कर रहे हैं?":"What are you currently doing?")+'</label><select id="student-path" name="path" required><option value="">'+(Lh?"एक विकल्प चुनें":"Choose an option")+'</option>'+paths.map(function(o){return '<option value="'+o[0]+'"'+(p.path===o[0]?" selected":"")+'>'+o[1]+'</option>'}).join("")+'</select>'+
 '<label for="student-district">'+(Lh?"ज़िला चुनें":"Select district")+'</label><select id="student-district" name="district" required><option value="">'+(Lh?"अपना ज़िला चुनें":"Choose your district")+'</option>'+DISTRICTS.map(function(d){return '<option value="'+d+'"'+(p.district===d?" selected":"")+'>'+d+'</option>'}).join("")+'</select>'+
 '<button class="btn o login-submit" type="submit">'+(Lh?"लॉगिन करें":"Log in")+'</button></form>'+(p.name?'<button class="btn g login-cancel" id="cancel-profile">'+(Lh?"वापस जाएँ":"Cancel")+'</button>':"")+'</div>'}
function home(){
 var pathName={school:L()?"स्कूल":"School",college:L()?"कॉलेज":"College",prep:L()?"परीक्षा की तैयारी":"Exam preparation"};
 var h='<div class="card student-card"><div><h2>'+esc(S.profile.name)+'</h2><p class="mut">'+esc(pathName[S.profile.path]||S.profile.path)+' · '+esc(S.profile.district)+'</p></div><button class="btn g" id="edit-profile">'+(L()?"जानकारी बदलें":"Edit details")+'</button></div>';
 h+='<div class="card"><h2>'+(L()?"भाषा चुनें":"Choose language")+'</h2><div class="row"><button class="chip '+(L()?"on":"")+'" data-l="hi">हिन्दी</button><button class="chip '+(L()?"":"on")+'" data-l="en">English</button><button class="chip" disabled>भीली · गोंडी (soon)</button></div></div>';
 var list=S.cat.slice();Object.keys(S.packs).forEach(function(i){if(!list.some(function(c){return c.id==i}))list.push(S.packs[i])});
 h+='<div class="card"><h2>'+(L()?"लेसन पैक":"Lesson packs")+'</h2><p class="mut">'+(L()?"एक बार CSC या पंचायत WiFi पर डाउनलोड करें, फिर बिना नेट पढ़ें।":"Download once at a CSC or panchayat WiFi, then learn without net.")+'</p>';
 list.forEach(function(p){var s=S.packs[p.id],b=S.busy[p.id];
  h+='<div class="row sp" style="padding:10px 0;border-top:1px solid var(--bd)"><div><b>'+esc(p.ic)+' '+esc(p[S.lang])+'</b><br><span class="mut">'+esc(p.kb||1)+' KB</span> '+(s?'<span class="tag ok">✓ saved</span>':'')+'</div>'+
  (s?'<button class="btn g" data-o="'+esc(p.id)+'">'+(L()?"खोलें":"Open")+'</button>':'<button class="btn o" data-d="'+esc(p.id)+'"'+(navigator.onLine&&!b?'':' disabled')+'>'+(b?'⏳':'⬇ '+(L()?"डाउनलोड":"Download"))+'</button>')+'</div>'});
 h+=(navigator.onLine?'':'<p class="mut">'+(L()?"डाउनलोड के लिए ऑनलाइन होना ज़रूरी है।":"You need to be online to download.")+'</p>')+'</div>';
 h+='<div class="card"><h2>🤝 Shiksha Sathi</h2><p class="mut">'+(L()?"डाउनलोड किए पैक WhatsApp/Nearby Share से साथियों को भेजें। साथी \"इम्पोर्ट\" दबाएँ।":"Send saved packs to peers via WhatsApp / Nearby Share. They tap Import.")+'</p><div class="row"><button class="btn g" id="share">📤 '+(L()?"पैक शेयर करें":"Share packs")+'</button><button class="btn g" id="imp">📥 '+(L()?"इम्पोर्ट":"Import")+'</button></div><input type="file" id="file" class="hide"></div>';
 return h}
function lesson(){var ids=Object.keys(S.packs);
 if(!ids.length)return '<div class="card"><p>'+(L()?"पहले होम से कोई पैक डाउनलोड करें।":"Download a pack from Home first.")+'</p></div>';
 if(!S.packs[S.open])S.open=ids[0];var p=S.packs[S.open];
 return '<div class="row" style="margin-bottom:10px">'+ids.map(function(i){return '<button class="chip '+(i==S.open?"on":"")+'" data-o="'+esc(i)+'">'+esc(S.packs[i].ic)+'</button>'}).join("")+'</div><div class="card"><h2>'+esc(p[S.lang])+'</h2><p style="font-size:17px;line-height:1.7">'+esc(p.t[S.lang])+'</p><div class="row"><button class="btn" id="say">🔊 '+(L()?"सुनें":"Listen")+'</button><button class="btn g" id="stop">⏹</button></div></div>'}
function bolo(){
 var h='<div class="card" style="text-align:center"><h2>🎤 '+(L()?"अपना सवाल बोलिए":"Ask by voice")+'</h2><button class="mic '+(S.rec?"rec":"")+'" id="mic">🎙</button><p class="mut">'+(S.rec?(L()?"सुन रहा हूँ…":"Listening…"):(L()?"माइक दबाएँ या नीचे लिखें":"Tap mic or type below"))+'</p><div class="row" style="margin-top:8px"><input id="q" placeholder="'+(L()?"जैसे: प्रतिशत क्या है?":"e.g. what is percent?")+'" value="'+esc(S.q)+'"><button class="btn" id="ask">→</button></div><button class="btn o" id="ment" style="margin-top:10px;width:100%">👩‍🏫 '+(L()?"मेंटर से पूछें":"Ask a mentor")+'</button></div>';
 if(S.queue)h+='<p class="mut">🕒 '+S.queue+(L()?" सवाल सिंक के इंतज़ार में":" doubt(s) waiting to sync")+'</p>';
 if(S.ans)h+='<div class="card"><b>❓ '+esc(S.ans.q)+'</b><div class="ans">'+esc(S.ans.a)+'</div><p class="mut">'+esc(S.ans.src)+'</p><button class="btn g" id="sayans">🔊 '+(L()?"सुनें":"Listen")+'</button></div>';
 return h}

// ---------- Speech ----------
function speak(s){if(!window.speechSynthesis)return alert("Speech not supported in this browser");speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(s);u.lang=L()?"hi-IN":"en-IN";speechSynthesis.speak(u)}
function listen(){var R=window.SpeechRecognition||window.webkitSpeechRecognition;if(!R)return alert("Voice input not supported here. Use Chrome or type.");
 if(!navigator.onLine){alert(L()?"माइक को इंटरनेट चाहिए। नीचे लिखें, या कीबोर्ड का 🎤 बटन इस्तेमाल करें।":"The mic needs internet. Type below, or use your keyboard's 🎤 button.");var qi=$("q");if(qi)qi.focus();return}
 var r=new R();r.lang=L()?"hi-IN":"en-IN";S.rec=true;render();
 r.onresult=function(e){S.rec=false;answer(e.results[0][0].transcript)};
 r.onerror=function(e){S.rec=false;render();alert(L()?"माइक नहीं चला ("+e.error+")। नीचे लिखकर पूछें।":"Mic failed ("+e.error+"). Please type your question.")};r.onend=function(){if(S.rec){S.rec=false;render()}};r.start()}

// ---------- Render & events ----------
function render(){
 $("sub").textContent=t("sub");var on=navigator.onLine,n=$("net");n.textContent=(on?"● ":"✈ ")+(on?t("online"):t("offline"));n.className="net"+(on?"":" off");
 if(!S.profile)S.tab="login";
 $("app").className=S.tab==="login"?"login":"";
 if(S.tab==="login"){$("nav").innerHTML="";$("main").innerHTML=login();bind();return}
 var tabs=[["home","🏠"],["lesson","📖"],["bolo","🎤"],["sch","🎓"]];
 $("nav").innerHTML=tabs.map(function(a){return '<button class="'+(S.tab==a[0]?"on":"")+'" data-t="'+a[0]+'"><b>'+a[1]+'</b>'+t(a[0])+'</button>'}).join("");
 $("main").innerHTML={home:home,lesson:lesson,bolo:bolo,sch:sch}[S.tab]();bind()}
function bind(){
 var all=function(s,f){Array.prototype.forEach.call(document.querySelectorAll(s),f)};
 if($("student-form"))$("student-form").onsubmit=function(e){e.preventDefault();var name=$("student-name").value.trim(),path=$("student-path").value,district=$("student-district").value;
  if(!name||!path||!district)return;
  S.profile={name:name,path:path,district:district};S.tab="home";save();render()};
 if($("edit-profile"))$("edit-profile").onclick=function(){S.tab="login";render()};
 if($("cancel-profile"))$("cancel-profile").onclick=function(){S.tab="home";render()};
 all("[data-t]",function(b){b.onclick=function(){S.tab=b.dataset.t;render()}});
 all("[data-l]",function(b){b.onclick=function(){S.lang=b.dataset.l;save();render()}});
 all("[data-o]",function(b){b.onclick=function(){S.open=b.dataset.o;S.tab="lesson";render()}});
 all("[data-d]",function(b){b.onclick=function(){dl(b.dataset.d)}});
 if($("share"))$("share").onclick=share;
 if($("imp"))$("imp").onclick=function(){$("file").click()};
 if($("file"))$("file").onchange=function(){if(this.files[0])imp(this.files[0])};
 if($("say"))$("say").onclick=function(){speak(S.packs[S.open].t[S.lang])};
 if($("stop"))$("stop").onclick=function(){if(window.speechSynthesis)speechSynthesis.cancel()};
 if($("mic"))$("mic").onclick=listen;
 if($("ask"))$("ask").onclick=function(){var v=$("q").value.trim();if(v)answer(v)};
 if($("ment"))$("ment").onclick=function(){var v=$("q").value.trim();if(v)askMentor(v);else $("q").focus()};
 if($("q"))$("q").onkeydown=function(e){if(e.key=="Enter")$("ask").click()};
 if($("sayans"))$("sayans").onclick=function(){speak(S.ans.a)};
 ["cat","inc","course","goal"].forEach(function(k){if($(k))$(k).onchange=function(){SA[k]=this.value}});
 if($("match"))$("match").onclick=showRes}

window.addEventListener("online",function(){render();flush();poll()});
window.addEventListener("offline",render);
Promise.all([
 fetch("packs/index.json").then(function(r){return r.json()}).then(function(c){S.cat=c}).catch(function(){}),
 fetch("faq.json").then(function(r){return r.json()}).then(function(g){S.gen=g}).catch(function(){}),
 tx("packs","readonly",function(s){return s.getAll()}).then(function(a){(a||[]).forEach(function(p){S.packs[p.id]=p})}).catch(function(){}),
 tx("queue","readonly",function(s){return s.count()}).then(function(n){S.queue=n||0}).catch(function(){})
]).then(function(){render();flush();poll()});setInterval(poll,30000);
render();
if("serviceWorker" in navigator)navigator.serviceWorker.register("sw.js").catch(function(){});
