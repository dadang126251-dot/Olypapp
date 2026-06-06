(function(){
var canvas=document.getElementById('chart');
var ctx=canvas.getContext('2d');
var priceHistory=[];
var MAX_POINTS=120;
var asset='EURUSD';
var tf=5;
var currentPrice=0;
var prevPrice=0;
var BASE={EURUSD:1.085,GBPUSD:1.268,USDJPY:142.5,BTCUSD:67000,ETHUSD:3500,XAUUSD:2320};
var BINANCE_MAP={BTCUSD:'BTCUSDT',ETHUSD:'ETHUSDT'};

function dec(){return asset==='USDJPY'?3:asset==='BTCUSD'||asset==='ETHUSD'||asset==='XAUUSD'?2:5}

function showLoading(on){
  var btn=document.getElementById('refresh-btn');
  btn.textContent=on?'Mengambil harga...':'Refresh';
  btn.disabled=on;
}

var forexBase=0;
var forexLoaded=false;
var apiError=false;
var otcMode=false;
var TF_INTERVAL={5:'5m',15:'15m',1:'1m'};

function rand(a,b){return Math.random()*(b-a)+a;}

function setLastUpdated(src){
  var now=new Date();
  var t=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2)+':'+('0'+now.getSeconds()).slice(-2);
  var tag=otcMode?' [OTC SYNTHETIC]':'';
  document.getElementById('last-updated').textContent='Last Updated: '+t+' | Sumber: '+src+tag;
}

function setError(msg){
  apiError=true;
  document.getElementById('signal-text').className='signal-value neutral';
  document.getElementById('signal-text').textContent='ERROR API';
  document.getElementById('signal-strength').textContent=msg;
  document.getElementById('last-updated').textContent='ERROR: '+msg;
  console.error('[OlympAnalyzer] API Error:',msg);
}

// Seed priceHistory with 50 micro-ticks around a base price (for forex bootstrap)
function seedHistory(base){
  priceHistory=[];
  var p=base;
  // OTC mode: higher volatility ±0.08% to simulate broker synthetic movement
  var vol=otcMode?0.0008:0.0002;
  for(var i=0;i<50;i++){p=p+p*(rand(-vol,vol));priceHistory.push(p);}
  currentPrice=p;prevPrice=priceHistory[48];
  console.log('[OlympAnalyzer] Seeded history. Mode:',(otcMode?'OTC':'REAL'),'base:',base,'vol:',vol,'points:',priceHistory.length);
}

// Load real Binance klines (close prices) into priceHistory
function loadBinanceKlines(cb){
  var sym=BINANCE_MAP[asset];
  var interval=TF_INTERVAL[tf]||'5m';
  var url='https://api.binance.com/api/v3/klines?symbol='+sym+'&interval='+interval+'&limit=60';
  console.log('[OlympAnalyzer] Fetching Binance klines:',url);
  fetch(url)
    .then(function(r){return r.json();})
    .then(function(data){
      if(!Array.isArray(data)||data.length===0){cb(false);return;}
      var closes=data.map(function(k){return parseFloat(k[4]);});
      priceHistory=closes;
      currentPrice=closes[closes.length-1];
      prevPrice=closes[closes.length-2]||currentPrice;
      apiError=false;
      console.log('[OlympAnalyzer] Binance klines loaded. Points:',closes.length,'Last close:',currentPrice);
      setLastUpdated('Binance ('+interval+' klines real)');
      cb(true);
    })
    .catch(function(e){
      console.error('[OlympAnalyzer] Binance klines failed:',e);
      cb(false);
    });
}

// Fetch single live price (for live tick updates)
function fetchLiveCrypto(cb){
  fetch('https://api.binance.com/api/v3/ticker/price?symbol='+BINANCE_MAP[asset])
    .then(function(r){return r.json();})
    .then(function(d){
      if(d.price){apiError=false;cb(parseFloat(d.price));}
      else{console.warn('[OlympAnalyzer] Binance price missing');cb(null);}
    })
    .catch(function(e){console.error('[OlympAnalyzer] Binance tick error:',e);cb(null);});
}

function fetchForexBase(cb){
  var url='https://open.er-api.com/v6/latest/USD';
  console.log('[OlympAnalyzer] Fetching forex rate:',url,'asset:',asset);
  fetch(url)
    .then(function(r){return r.json();})
    .then(function(data){
      if(!data||!data.rates){cb(null);return;}
      var rate=null;
      if(asset==='EURUSD')rate=data.rates.EUR;
      else if(asset==='GBPUSD')rate=data.rates.GBP;
      else if(asset==='USDJPY')rate=data.rates.JPY;
      console.log('[OlympAnalyzer] Forex rate received:',asset,'=',rate);
      cb(rate||null);
    }).catch(function(e){console.error('[OlympAnalyzer] Forex API error:',e);cb(null);});
}

function addPrice(p){
  if(!p||isNaN(p))return;
  prevPrice=currentPrice||p;
  currentPrice=p;
  priceHistory.push(p);
  if(priceHistory.length>MAX_POINTS)priceHistory.shift();
}

function drawChart(){
  var w=canvas.offsetWidth,h=260;
  canvas.width=w;canvas.height=h;
  if(priceHistory.length<2){
    ctx.fillStyle='#546e7a';ctx.font='14px sans-serif';ctx.textAlign='center';
    ctx.fillText('Mengambil data...',w/2,h/2);
    return;
  }
  var pl=10,pr=65,pt=20,pb=20,cw=w-pl-pr,ch=h-pt-pb;
  var maxP=Math.max.apply(null,priceHistory);
  var minP=Math.min.apply(null,priceHistory);
  var pad=(maxP-minP)*0.1||currentPrice*0.0005;
  maxP+=pad;minP-=pad;
  var rng=maxP-minP||0.001;
  function pxi(i){return pl+(i/(priceHistory.length-1))*cw;}
  function py(p){return pt+(1-(p-minP)/rng)*ch;}
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#1e2a45';ctx.lineWidth=.5;
  for(var i=0;i<=4;i++){
    var y=pt+(ch/4)*i,val=maxP-(rng/4)*i;
    ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(w-pr,y);ctx.stroke();
    ctx.fillStyle='#546e7a';ctx.font='9px monospace';ctx.textAlign='left';
    ctx.fillText(val.toFixed(dec()),w-pr+4,y+3);
  }
  var isUp=currentPrice>=prevPrice;
  var grad=ctx.createLinearGradient(0,pt,0,pt+ch);
  grad.addColorStop(0,isUp?'rgba(76,175,80,.3)':'rgba(239,83,80,.3)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(pxi(0),py(priceHistory[0]));
  for(var j=1;j<priceHistory.length;j++)ctx.lineTo(pxi(j),py(priceHistory[j]));
  ctx.lineTo(pxi(priceHistory.length-1),pt+ch);
  ctx.lineTo(pxi(0),pt+ch);
  ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();
  ctx.strokeStyle=isUp?'#4caf50':'#ef5350';ctx.lineWidth=2;
  ctx.moveTo(pxi(0),py(priceHistory[0]));
  for(var k=1;k<priceHistory.length;k++)ctx.lineTo(pxi(k),py(priceHistory[k]));
  ctx.stroke();
  var lx=pxi(priceHistory.length-1),ly=py(currentPrice);
  ctx.beginPath();ctx.arc(lx,ly,4,0,Math.PI*2);
  ctx.fillStyle=isUp?'#4caf50':'#ef5350';ctx.fill();
  if(priceHistory.length>=20){
    ctx.beginPath();ctx.strokeStyle='rgba(255,167,38,.7)';ctx.lineWidth=1.5;
    var started=false;
    for(var m=19;m<priceHistory.length;m++){
      var sl=priceHistory.slice(m-19,m+1),ma=sl.reduce(function(s,v){return s+v},0)/20;
      if(!started){ctx.moveTo(pxi(m),py(ma));started=true;}else{ctx.lineTo(pxi(m),py(ma));}
    }ctx.stroke();
  }
}

// --- INDICATOR CALCULATIONS (return null if data insufficient) ---
function calcRSI(){
  var n=14;
  if(priceHistory.length<n+1)return null;
  var g=0,l=0;
  for(var i=priceHistory.length-n;i<priceHistory.length;i++){
    var d=priceHistory[i]-priceHistory[i-1];
    if(d>0)g+=d;else l-=d;
  }
  if(l===0)return 100;
  var rs=(g/n)/(l/n);
  var v=100-(100/(1+rs));
  console.log('[OlympAnalyzer] RSI:',v.toFixed(1),'gains:',g.toFixed(6),'losses:',l.toFixed(6));
  return v;
}
function calcMACD(){
  if(priceHistory.length<27)return null;
  function ema(arr,p){var k=2/(p+1),v=arr[0];for(var i=1;i<arr.length;i++)v=arr[i]*k+v*(1-k);return v;}
  var e12=ema(priceHistory.slice(-12),12),e26=ema(priceHistory.slice(-26),26);
  if(!e26)return null;
  var v=((e12-e26)/e26)*1000;
  console.log('[OlympAnalyzer] MACD:',v.toFixed(2),'EMA12:',e12.toFixed(dec()),'EMA26:',e26.toFixed(dec()));
  return v;
}
function calcStoch(){
  var n=14;
  if(priceHistory.length<n)return null;
  var sl=priceHistory.slice(-n),hi=Math.max.apply(null,sl),lo=Math.min.apply(null,sl),last=sl[sl.length-1];
  if(hi===lo)return null;
  var v=((last-lo)/(hi-lo))*100;
  console.log('[OlympAnalyzer] Stoch:',v.toFixed(1),'Hi:',hi.toFixed(dec()),'Lo:',lo.toFixed(dec()));
  return v;
}

function updateSignal(){
  var rsi=calcRSI(),macd=calcMACD(),stoch=calcStoch();
  var hasData=priceHistory.length>=5;

  function bar(id,v,min,max,valId){
    var b=document.getElementById(id);
    if(v===null){b.style.width='0%';document.getElementById(valId).textContent='...';return;}
    var pct=Math.min(100,Math.max(0,((v-min)/(max-min))*100));
    b.style.width=pct+'%';
    b.style.background=v>(max*.7)?'#ef5350':v<(max*.3)?'#4caf50':'#4fc3f7';
    document.getElementById(valId).textContent=v.toFixed(1);
  }
  bar('rsi-bar',rsi,0,100,'rsi-val');
  bar('macd-bar',macd!==null?Math.min(100,Math.max(0,macd+50)):null,0,100,'macd-val');
  if(macd!==null)document.getElementById('macd-val').textContent=macd.toFixed(2);
  bar('stoch-bar',stoch,0,100,'stoch-val');

  var sel=document.getElementById('signal-text');sel.className='signal-value';
  if(!hasData){
    sel.textContent='LOADING...';sel.classList.add('neutral');
    document.getElementById('signal-strength').textContent='--';
  } else if(rsi===null||macd===null||stoch===null){
    sel.textContent='MENUNGGU DATA';sel.classList.add('neutral');
    document.getElementById('signal-strength').textContent='Kumpulkan data...';
  } else {
    var score=0;
    if(rsi<40)score+=2;else if(rsi>60)score-=2;else if(rsi<50)score+=1;else score-=1;
    if(macd>0.1)score+=2;else if(macd<-0.1)score-=2;
    if(stoch<30)score+=2;else if(stoch>70)score-=2;else if(stoch<50)score+=1;else score-=1;
    console.log('[OlympAnalyzer] Signal score:',score,'RSI:',rsi&&rsi.toFixed(1),'MACD:',macd&&macd.toFixed(2),'Stoch:',stoch&&stoch.toFixed(1));
    if(score>=3){sel.textContent='BUY UP';sel.classList.add('buy');}
    else if(score<=-3){sel.textContent='SELL DOWN';sel.classList.add('sell');}
    else if(score>0){sel.textContent='LEMAH BUY';sel.classList.add('buy');}
    else if(score<0){sel.textContent='LEMAH SELL';sel.classList.add('sell');}
    else{sel.textContent='TUNGGU';sel.classList.add('neutral');}
    document.getElementById('signal-strength').textContent=Math.abs(score)>=5?'KUAT':Math.abs(score)>=3?'SEDANG':'LEMAH';
  }

  // Support & Resistance — works with 5+ points
  var lookback=Math.min(priceHistory.length,20);
  if(priceHistory.length>=5){
    document.getElementById('support-val').textContent=Math.min.apply(null,priceHistory.slice(-lookback)).toFixed(dec());
    document.getElementById('resistance-val').textContent=Math.max.apply(null,priceHistory.slice(-lookback)).toFixed(dec());
  }

  if(priceHistory.length>=2){
    var f=priceHistory.slice(0,Math.min(10,priceHistory.length)).reduce(function(s,v){return s+v},0)/Math.min(10,priceHistory.length);
    var l2=priceHistory.slice(-Math.min(10,priceHistory.length)).reduce(function(s,v){return s+v},0)/Math.min(10,priceHistory.length);
    document.getElementById('trend-val').textContent=l2>f?'Naik':'Turun';
    document.getElementById('volatility-val').textContent=Math.abs(l2-f)/f*100<0.05?'Rendah':'Tinggi';
  }

  if(currentPrice>0){
    var change=prevPrice?((currentPrice-prevPrice)/prevPrice*100):0;
    document.getElementById('current-price').textContent=currentPrice.toFixed(dec())+(change>=0?' ▲':' ▼');
    document.getElementById('current-price').style.color=change>=0?'#4caf50':'#ef5350';
  }
}

function renderAll(){drawChart();updateSignal();}

// --- INIT & TICK ---
function initAsset(){
  priceHistory=[];currentPrice=0;prevPrice=0;forexBase=0;forexLoaded=false;apiError=false;
  document.getElementById('current-price').textContent='--';
  document.getElementById('current-price').style.color='#4fc3f7';
  document.getElementById('support-val').textContent='--';
  document.getElementById('resistance-val').textContent='--';
  document.getElementById('last-updated').textContent='Memuat data...';
  showLoading(true);

  if(BINANCE_MAP[asset]){
    // Crypto: load 60 real klines first, then live tick
    loadBinanceKlines(function(ok){
      showLoading(false);
      if(!ok){setError('Binance klines gagal');return;}
      renderAll();
    });
  } else {
    // Forex: fetch real base rate, seed history, then live tick
    fetchForexBase(function(rate){
      showLoading(false);
      if(!rate){setError('Forex API gagal');return;}
      forexBase=rate;forexLoaded=true;apiError=false;
      seedHistory(forexBase);
      setLastUpdated('ExchangeRate API (base real + micro-tick simulasi)');
      renderAll();
    });
  }
}

function liveTick(){
  if(apiError)return;
  if(BINANCE_MAP[asset]){
    fetchLiveCrypto(function(p){
      if(!p)return;
      if(otcMode){
        // OTC crypto: use Binance real as anchor, add synthetic drift ±0.05%
        var drift=p*(rand(-0.0005,0.0005));
        addPrice(p+drift);
        console.log('[OlympAnalyzer] OTC tick (crypto). Real:',p,'OTC:',( p+drift).toFixed(2));
      } else {
        addPrice(p);
      }
      setLastUpdated(otcMode?'Binance anchor + OTC synthetic':'Binance live tick');
      renderAll();
    });
  } else {
    // Forex: micro-tick
    var last=priceHistory.length?priceHistory[priceHistory.length-1]:forexBase;
    // OTC mode: volatility ±0.08% | Real mode: ±0.03%
    var vol=otcMode?0.0008:0.0003;
    var np=last+last*(rand(-vol,vol));
    addPrice(np);
    renderAll();
  }
}

function applyMode(isOtc){
  otcMode=isOtc;
  var btnReal=document.getElementById('mode-real');
  var btnOtc=document.getElementById('mode-otc');
  var lbl=document.getElementById('mode-label');
  if(isOtc){
    btnReal.className='mode-btn';
    btnOtc.className='mode-btn mode-otc-active';
    lbl.textContent='OTC: harga broker sintetis (base = real market)';
    lbl.style.color='#ce93d8';
  } else {
    btnReal.className='mode-btn mode-active';
    btnOtc.className='mode-btn';
    lbl.textContent='Harga real market';
    lbl.style.color='#546e7a';
  }
  console.log('[OlympAnalyzer] Mode switched to:',(isOtc?'OTC':'REAL'));
  initAsset();
}
document.getElementById('mode-real').addEventListener('click',function(){if(!otcMode)return;applyMode(false);});
document.getElementById('mode-otc').addEventListener('click',function(){if(otcMode)return;applyMode(true);});

document.getElementById('asset-select').addEventListener('change',function(){asset=this.value;initAsset();});
document.getElementById('tf-select').addEventListener('change',function(){
  tf=parseInt(this.value);
  document.getElementById('signal-duration').textContent=tf+' min';
  if(BINANCE_MAP[asset]){
    // Reload klines with new timeframe
    priceHistory=[];currentPrice=0;prevPrice=0;
    showLoading(true);
    loadBinanceKlines(function(ok){showLoading(false);if(ok)renderAll();else setError('Klines gagal untuk TF ini');});
  }
});
document.getElementById('refresh-btn').addEventListener('click',function(){initAsset();});

setInterval(liveTick,3000);
setInterval(function(){
  var now=new Date();
  document.getElementById('clock').textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2)+':'+('0'+now.getSeconds()).slice(-2);
},1000);

initAsset();
})();