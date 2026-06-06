(function(){
var canvas=document.getElementById('chart');
var ctx=canvas.getContext('2d');
var candles=[];
var asset='EURUSD';
var tf=5;
var BASE={EURUSD:1.085,GBPUSD:1.27,USDJPY:149.5,BTCUSD:67000,ETHUSD:3500,XAUUSD:2320};

function rand(a,b){return Math.random()*(b-a)+a}

function genCandles(base,n){
  var list=[],price=base,vol=base*0.003;
  for(var i=0;i<n;i++){
    var o=price,c=o+rand(-vol,vol),h=Math.max(o,c)+rand(0,vol*.5),l=Math.min(o,c)-rand(0,vol*.5);
    list.push({open:o,close:c,high:h,low:l});price=c;
  }
  return list;
}

function dec(){return asset==='USDJPY'?3:asset==='BTCUSD'||asset==='ETHUSD'||asset==='XAUUSD'?2:5}

function drawChart(){
  var w=canvas.offsetWidth,h=260;
  canvas.width=w;canvas.height=h;
  var pl=10,pr=60,pt=20,pb=30,cw=w-pl-pr,ch=h-pt-pb;
  var maxP=Math.max.apply(null,candles.map(function(c){return c.high}));
  var minP=Math.min.apply(null,candles.map(function(c){return c.low}));
  var rng=maxP-minP||0.001;
  function py(p){return pt+(1-(p-minP)/rng)*ch}
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='#1e2a45';ctx.lineWidth=.5;
  for(var i=0;i<=4;i++){
    var y=pt+(ch/4)*i;
    ctx.beginPath();ctx.moveTo(pl,y);ctx.lineTo(w-pr,y);ctx.stroke();
    ctx.fillStyle='#546e7a';ctx.font='9px monospace';
    ctx.fillText((maxP-(rng/4)*i).toFixed(dec()),w-pr+4,y+3);
  }
  if(candles.length>=20){
    ctx.beginPath();ctx.strokeStyle='rgba(79,195,247,.2)';ctx.lineWidth=1;
    for(var j=19;j<candles.length;j++){
      var sl=candles.slice(j-19,j+1),avg=sl.reduce(function(s,c){return s+c.close},0)/20;
      var std=Math.sqrt(sl.reduce(function(s,c){return s+Math.pow(c.close-avg,2)},0)/20);
      var xj=pl+(j/(candles.length-1))*cw;
      if(j===19)ctx.moveTo(xj,py(avg+2*std));else ctx.lineTo(xj,py(avg+2*std));
    }
    for(var k=candles.length-1;k>=19;k--){
      var sk=candles.slice(k-19,k+1),ak=sk.reduce(function(s,c){return s+c.close},0)/20;
      var sdk=Math.sqrt(sk.reduce(function(s,c){return s+Math.pow(c.close-ak,2)},0)/20);
      var xk=pl+(k/(candles.length-1))*cw;ctx.lineTo(xk,py(ak-2*sdk));
    }
    ctx.closePath();ctx.fillStyle='rgba(79,195,247,.05)';ctx.fill();ctx.stroke();
  }
  var cw2=Math.max(2,(cw/candles.length)*.6);
  candles.forEach(function(c,i){
    var x=pl+(i/(candles.length-1))*cw,up=c.close>=c.open;
    ctx.strokeStyle=up?'#4caf50':'#ef5350';ctx.fillStyle=up?'#4caf50':'#ef5350';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(x,py(c.high));ctx.lineTo(x,py(c.low));ctx.stroke();
    ctx.fillRect(x-cw2/2,py(Math.max(c.open,c.close)),cw2,Math.abs(py(c.open)-py(c.close))||1);
  });
  if(candles.length>=20){
    ctx.beginPath();ctx.strokeStyle='#ffa726';ctx.lineWidth=1.5;
    candles.forEach(function(c,i){
      if(i<19)return;
      var sl=candles.slice(i-19,i+1),ma=sl.reduce(function(s,cc){return s+cc.close},0)/20;
      var x=pl+(i/(candles.length-1))*cw;
      if(i===19)ctx.moveTo(x,py(ma));else ctx.lineTo(x,py(ma));
    });ctx.stroke();
  }
}

function calcRSI(){
  if(candles.length<15)return 50;
  var g=0,l=0;
  for(var i=candles.length-14;i<candles.length;i++){var d=candles[i].close-candles[i-1].close;if(d>0)g+=d;else l-=d;}
  if(l===0)return 100;return 100-(100/(1+(g/14)/(l/14)));
}
function calcMACD(){
  if(candles.length<26)return 0;
  var cl=candles.map(function(c){return c.close});
  function ema(d,p){var k=2/(p+1),v=d[0];for(var i=1;i<d.length;i++)v=d[i]*k+v*(1-k);return v}
  return((ema(cl.slice(-12),12)-ema(cl.slice(-26),26))/ema(cl.slice(-26),26))*1000;
}
function calcStoch(){
  if(candles.length<14)return 50;
  var sl=candles.slice(-14),hi=Math.max.apply(null,sl.map(function(c){return c.high})),lo=Math.min.apply(null,sl.map(function(c){return c.low}));
  return hi===lo?50:((sl[sl.length-1].close-lo)/(hi-lo))*100;
}

function update(){
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
  if(rsi<30)score+=2;else if(rsi>70)score-=2;
  if(macd>0.5)score+=1;else if(macd<-0.5)score-=1;
  if(stoch<20)score+=1;else if(stoch>80)score-=1;
  var sel=document.getElementById('signal-text');
  sel.className='signal-value';
  if(score>=2){sel.textContent='BUY UP';sel.classList.add('buy');}
  else if(score<=-2){sel.textContent='SELL DOWN';sel.classList.add('sell');}
  else{sel.textContent='TUNGGU';sel.classList.add('neutral');}
  document.getElementById('signal-strength').textContent=Math.abs(score)>=3?'KUAT':'SEDANG';
  var lows=candles.map(function(c){return c.low}),highs=candles.map(function(c){return c.high});
  document.getElementById('support-val').textContent=Math.min.apply(null,lows.slice(-20)).toFixed(dec());
  document.getElementById('resistance-val').textContent=Math.max.apply(null,highs.slice(-20)).toFixed(dec());
  var f=candles.slice(0,10).reduce(function(s,c){return s+c.close},0)/10;
  var l2=candles.slice(-10).reduce(function(s,c){return s+c.close},0)/10;
  document.getElementById('trend-val').textContent=l2>f?'Naik':'Turun';
  document.getElementById('volatility-val').textContent=Math.abs(l2-f)/f*100<0.1?'Rendah':'Tinggi';
  document.getElementById('current-price').textContent=candles[candles.length-1].close.toFixed(dec());
}

function resetCandles(){candles=genCandles(BASE[asset],60);drawChart();update();}
function refresh(){drawChart();update();}

document.getElementById('asset-select').addEventListener('change',function(){asset=this.value;resetCandles();});
document.getElementById('tf-select').addEventListener('change',function(){tf=parseInt(this.value);document.getElementById('signal-duration').textContent=tf+' min';resetCandles();});
document.getElementById('refresh-btn').addEventListener('click',refresh);

setInterval(function(){
  if(!candles.length)return;
  var last=candles[candles.length-1],vol=BASE[asset]*0.001;
  var nc=last.close+(Math.random()-.5)*vol;
  candles[candles.length-1]={open:last.open,close:nc,high:Math.max(last.high,nc),low:Math.min(last.low,nc)};
  drawChart();update();
  var now=new Date();
  document.getElementById('clock').textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2)+':'+('0'+now.getSeconds()).slice(-2);
},3000);

setInterval(function(){
  var now=new Date();
  document.getElementById('clock').textContent=('0'+now.getHours()).slice(-2)+':'+('0'+now.getMinutes()).slice(-2)+':'+('0'+now.getSeconds()).slice(-2);
},1000);

resetCandles();
})();