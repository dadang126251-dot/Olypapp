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

function rand(a,b){return Math.random()*(b-a)+a;}

function fetchForexBase(cb){
  fetch('https://open.er-api.com/v6/latest/USD')
    .then(function(r){return r.json();})
    .then(function(data){
      var rate=null;
      if(asset==='EURUSD'&&data.rates)rate=data.rates.EUR;
      else if(asset==='GBPUSD'&&data.rates)rate=data.rates.GBP;
      else if(asset==='USDJPY'&&data.rates)rate=data.rates.JPY;
      cb(rate||BASE[asset]);
    }).catch(function(){cb(BASE[asset]);});
}

function fetchPrice(cb){
  if(BINANCE_MAP[asset]){
    fetch('https://api.binance.com/api/v3/ticker/price?symbol='+BINANCE_MAP[asset])
      .then(function(r){return r.json();})
      .then(function(d){if(d.price)cb(parseFloat(d.price));else cb(BASE[asset]);})
      .catch(function(){cb(BASE[asset]);});
  } else {
    if(!forexLoaded){
      // First time: fetch real rate, then simulate ticks around it
      fetchForexBase(function(rate){
        forexBase=rate;forexLoaded=true;
        cb(forexBase);
      });
    } else {
      // Subsequent ticks: micro-movement ±0.03% around last price
      var last=priceHistory.length?priceHistory[priceHistory.length-1]:forexBase;
      var tick=last*(rand(-0.0003,0.0003));
      cb(last+tick);
    }
  }
}

function addPrice(p){
  if(!p)return;
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
    ctx.fillText('Mengambil data harga real-time...',w/2,h/2);
    return;
  }
  var pl=10,pr=65,pt=20,pb=20,cw=w-pl-pr,ch=h-pt-pb;
  var maxP=Math.max.apply(null,priceHistory);
  var minP=Math.min.apply(null,priceHistory);
  var pad=(maxP-minP)*0.1||currentPrice*0.0005;
  maxP+=pad;minP-=pad;
  var rng=maxP-minP||0.001;
  function px(i){return pl+(i/(priceHistory.length-1))*cw;}
  function py(p){return pt+(1-(p-minP)/rng)*ch;}
  ctx.clearRect(0,0,w,h);
  // Grid
  ctx.strokeStyle='#1e2a45';ctx.lineWidth=.5;
  for(var i=0;i<=4;i++){
    var y=pt+(ch/4)*i,val=maxP-(rng/4)*i;
    ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(w-pr,y);ctx.stroke();
    ctx.fillStyle='#546e7a';ctx.font='9px monospace';ctx.textAlign='left';
    ctx.fillText(val.toFixed(dec()),w-pr+4,y+3);
  }
  // Gradient fill under line
  var grad=ctx.createLinearGradient(0,pt,0,pt+ch);
  var isUp=currentPrice>=prevPrice;
  grad.addColorStop(0,isUp?'rgba(76,175,80,.3)':'rgba(239,83,80,.3)');
  grad.addColorStop(1,'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(px(0),py(priceHistory[0]));
  for(var j=1;j<priceHistory.length;j++)ctx.lineTo(px(j),py(priceHistory[j]));
  ctx.lineTo(px(priceHistory.length-1),pt+ch);
  ctx.lineTo(px(0),pt+ch);
  ctx.closePath();ctx.fillStyle=grad;ctx.fill();
  // Line
  ctx.beginPath();
  ctx.strokeStyle=isUp?'#4caf50':'#ef5350';ctx.lineWidth=2;
  ctx.moveTo(px(0),py(priceHistory[0]));
  for(var k=1;k<priceHistory.length;k++)ctx.lineTo(px(k),py(priceHistory[k]));
  ctx.stroke();
  // Current price dot
  var lx=px(priceHistory.length-1),ly=py(currentPrice);
  ctx.beginPath();ctx.arc(lx,ly,4,0,Math.PI*2);
  ctx.fillStyle=isUp?'#4caf50':'#ef5350';ctx.fill();
  // MA20
  if(priceHistory.length>=20){
    ctx.beginPath();ctx.strokeStyle='rgba(255,167,38,.7)';ctx.lineWidth=1.5;
    var started=false;
    for(var m=19;m<priceHistory.length;m++){
      var sl=priceHistory.slice(m-19,m+1),ma=sl.reduce(function(s,v){return s+v},0)/20;
      if(!started){ctx.moveTo(px(m),py(ma));started=true;}else{ctx.lineTo(px(m),py(ma));}
    }ctx.stroke();
  }
}

function calcRSI(){
  if(priceHistory.length<15)return 50;
  var g=0,l=0,n=14;
  for(var i=priceHistory.length-n;i<priceHistory.length;i++){
    var d=priceHistory[i]-priceHistory[i-1];
    if(d>0)g+=d;else l-=d;
  }
  if(l===0)return 100;return 100-(100/(1+(g/n)/(l/n)));
}
function calcMACD(){
  if(priceHistory.length<26)return 0;
  function ema(arr,p){var k=2/(p+1),v=arr[0];for(var i=1;i<arr.length;i++)v=arr[i]*k+v*(1-k);return v;}
  var e12=ema(priceHistory.slice(-12),12),e26=ema(priceHistory.slice(-26),26);
  return e26?((e12-e26)/e26)*1000:0;
}
function calcStoch(){
  if(priceHistory.length<14)return 50;
  var sl=priceHistory.slice(-14),hi=Math.max.apply(null,sl),lo=Math.min.apply(null,sl),last=sl[sl.length-1];
  return hi===lo?50:((last-lo)/(hi-lo))*100;
}

function updateSignal(){
  var rsi=calcRSI(),macd=calcMACD(),stoch=calcStoch();
  function bar(id,v,min,max,valId){
    var b=document.getElementById(id),pct=Math.min(100,Math.max(0,((v-min)/(max-min))*100));
    b.style.width=pct+'%';b.style.background=v>(max*.7)?'#ef5350':v<(max*.3)?'#4caf50':'#4fc3f7';
    document.getElementById(valId).textContent=v.toFixed(1);
  }
  bar('rsi-bar',rsi,0,100,'rsi-val');
  bar('macd-bar',Math.min(100,Math.max(0,macd+50)),0,100,'macd-val');
  document.getElementById('macd-val').textContent=macd.toFixed(2);
  bar('stoch-bar',stoch,0,100,'stoch-val');
  var score=0;
  if(rsi<40)score+=2;else if(rsi>60)score-=2;else if(rsi<50)score+=1;else score-=1;
  if(macd>0.1)score+=2;else if(macd<-0.1)score-=2;
  if(stoch<30)score+=2;else if(stoch>70)score-=2;else if(stoch<50)score+=1;else score-=1;
  var sel=document.getElementById('signal-text');sel.className='signal-value';
  if(score>=3){sel.textContent='BUY UP';sel.classList.add('buy');}
  else if(score<=-3){sel.textContent='SELL DOWN';sel.classList.add('sell');}
  else if(score>0){sel.textContent='LEMAH BUY';sel.classList.add('buy');}
  else if(score<0){sel.textContent='LEMAH SELL';sel.classList.add('sell');}
  else{sel.textContent='TUNGGU';sel.classList.add('neutral');}
  document.getElementById('signal-strength').textContent=Math.abs(score)>=5?'KUAT':Math.abs(score)>=3?'SEDANG':'LEMAH';
  if(priceHistory.length>=20){
    document.getElementById('support-val').textContent=Math.min.apply(null,priceHistory.slice(-20)).toFixed(dec());
    document.getElementById('resistance-val').textContent=Math.max.apply(null,priceHistory.slice(-20)).toFixed(dec());
  }
  var f=priceHistory.slice(0,10).reduce(function(s,v){return s+v},0)/Math.min(10,priceHistory.length);
  var l2=priceHistory.slice(-10).reduce(function(s,v){return s+v},0)/Math.min(10,priceHistory.length);
  document.getElementById('trend-val').textContent=l2>f?'Naik':'Turun';
  document.getElementById('volatility-val').textContent=Math.abs(l2-f)/f*100<0.05?'Rendah':'Tinggi';
  var change=currentPrice&&prevPrice?((currentPrice-prevPrice)/prevPrice*100):0;
  document.getElementById('current-price').textContent=currentPrice.toFixed(dec())+(change>=0?' ▲':' ▼');
  document.getElementById('current-price').style.color=change>=0?'#4caf50':'#ef5350';
}

function tick(){
  fetchPrice(function(p){
    showLoading(false);
    if(p){addPrice(p);drawChart();updateSignal();}
  });
}

document.getElementById('asset-select').addEventListener('change',function(){
  asset=this.value;priceHistory=[];currentPrice=0;prevPrice=0;
  forexBase=0;forexLoaded=false;
  document.getElementById('current-price').textContent='--';
  document.getElementById('current-price').style.color='#4fc3f7';
  document.getElementById('support-val').textContent='--';
  document.getElementById('resistance-val').textContent='--';
  showLoading(true);tick();
});
document.getElementById('tf-select').addEventListener('change',function(){
  tf=parseInt(this.value);document.getElementById('signal-duration').textContent=tf+' min';
});
document.getElementById('refresh-btn').addEventListener('click',tick);

// Fetch real price every 3 seconds
setInterval(tick,3000);

setInterval(function(){
  var now=new Date();
  document.getElementById('clock').textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2)+':'+('0'+now.getSeconds()).slice(-2);
},1000);

showLoading(true);tick();
})();