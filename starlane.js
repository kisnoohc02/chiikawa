/* Original endless runner: Hachiware's star candy hill. Canvas and offline SVG art. */
(() => {
  'use strict';
  const W=800,H=380,GROUND=300,PX=150;
  const $=s=>document.querySelector(s);
  const rewardForScore=score=>Math.floor(Math.max(0,score)/10);
  const scoreFor=(distance,stars)=>Math.floor(Math.max(0,distance)/12)+Math.max(0,stars)*35;
  const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v));
  const rand=(a,b)=>a+Math.random()*(b-a);
  function init({state,save,earn,notice,sndPoke,sndBad,sndWin}) {
    const canvas=$('#starlaneCanvas'),ctx=canvas.getContext('2d');
    const overlay=$('#starlaneOverlay'),headline=$('#starlaneHeadline'),message=$('#starlaneMessage');
    const startBtn=$('#starlaneStart'),pauseBtn=$('#starlanePause');
    const scoreEl=$('#starlaneScore'),bestEl=$('#starlaneBest'),starsEl=$('#starlaneStars');
    state.starlane={best:0,runs:0,totalScore:0,totalCoins:0,bestStars:0,...(state.starlane||{})};
    let mode='ready',distance=0,stars=0,objects=[],nextSpawn=600,frame=0,lastTime=0;
    let y=GROUND,vy=0,jumps=0,holding=false,holdUntil=0,score=0,mascotImage=null;
    const dpr=clamp(window.devicePixelRatio||1,1,2);
    canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);
    function record(){
      bestEl.textContent=state.starlane.best;
      $('#starlaneSummary').textContent=`최고 ${state.starlane.best}점`;
      $('#starlaneRecord').textContent=`🏆 최고 ${state.starlane.best}점 · 최고 별 ${state.starlane.bestStars}개 · 플레이 ${state.starlane.runs}회 · 누적 ${state.starlane.totalScore}점`;
    }
    function updateScore(){score=scoreFor(distance,stars);scoreEl.textContent=score;starsEl.textContent=stars;}
    function sprite(){
      const original=$('#mascot');if(!original)return;
      const svg=original.cloneNode(true);
      svg.setAttribute('xmlns','http://www.w3.org/2000/svg');svg.setAttribute('viewBox','105 80 350 420');
      svg.removeAttribute('id');svg.removeAttribute('class');svg.removeAttribute('style');
      svg.querySelector('#bodyShape')?.removeAttribute('style');
      for(const el of svg.querySelectorAll('#eyesClosed,#eyesHappy,#eyesTense,#tongue'))el.remove();
      const eyes=svg.querySelector('#eyes');if(eyes)eyes.style.display='';
      const mouth=svg.querySelector('#mouth');if(mouth)mouth.setAttribute('d','M273 290 Q267 304 259 294 M273 290 Q280 304 291 292 M269 299 Q266 318 276 316 Q285 313 281 300');
      const style=document.createElementNS('http://www.w3.org/2000/svg','style');
      style.textContent=`.body{fill:#fffdfa;stroke:#262321;stroke-width:9;stroke-linejoin:round}.tail{fill:#7faac3;stroke:#262321;stroke-width:8}.blue-patch{fill:#7faac3}.hair-line,.eye-line,.mouth{fill:none;stroke:#262321;stroke-width:8;stroke-linecap:round;stroke-linejoin:round}.cheek{fill:#f4bdca}.blush-lines{fill:none;stroke:#262321;stroke-width:7;stroke-linecap:round}.brow,.eye,.mouth-dot{fill:#262321}.eye-shine{fill:#fff}.accessory-sprite{font-size:57px}`;
      svg.insertBefore(style,svg.firstChild);
      const image=new Image();image.onload=()=>{mascotImage=image;draw();};
      image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
    }
    function reset(){
      cancelAnimationFrame(frame);mode='ready';distance=0;stars=0;objects=[];nextSpawn=600;score=0;
      y=GROUND;vy=0;jumps=0;holding=false;lastTime=0;
      updateScore();record();
      overlay.hidden=false;headline.textContent='별사탕 언덕';message.textContent='점프해서 돌과 웅덩이를 넘고 별사탕을 모아요.';
      startBtn.textContent='달리기 시작 ▶';pauseBtn.disabled=true;pauseBtn.textContent='일시정지';
      sprite();draw();
    }
    function start(){
      if(mode==='running')return;
      if(mode==='over')reset();
      mode='running';overlay.hidden=true;pauseBtn.disabled=false;pauseBtn.textContent='일시정지';
      lastTime=performance.now();frame=requestAnimationFrame(loop);
    }
    function pause(){
      if(mode!=='running')return;
      mode='paused';cancelAnimationFrame(frame);holding=false;
      overlay.hidden=false;headline.textContent='잠깐 쉬어가요';message.textContent=`현재 ${score}점 · 이어서 달릴 수 있어요.`;
      startBtn.textContent='계속 달리기 ▶';pauseBtn.textContent='계속하기';
    }
    function finish(){
      if(mode!=='running')return;
      mode='over';cancelAnimationFrame(frame);pauseBtn.disabled=true;holding=false;
      updateScore();const reward=rewardForScore(score);
      const oldBest=state.starlane.best;
      state.starlane.runs++;state.starlane.totalScore+=score;
      state.starlane.best=Math.max(state.starlane.best,score);
      state.starlane.bestStars=Math.max(state.starlane.bestStars,stars);
      state.starlane.totalCoins+=reward;
      if(reward){earn(reward);sndWin();notice(`${score}점! 🪙${reward} 획득!`);}
      else{save();sndBad();notice(`${score}점! 10점부터 동전을 받아요.`);}
      record();overlay.hidden=false;
      headline.textContent=score>oldBest?'새 최고 기록!':'오늘의 산책 끝!';
      message.textContent=`${score}점 · 별사탕 ${stars}개 · 🪙${reward} 획득`;
      startBtn.textContent='다시 달리기 ▶';draw();
    }
    function jump(){
      if(mode!=='running'||jumps>=2)return;
      vy=jumps===0?-655:-560;jumps++;
      holding=true;holdUntil=performance.now()+170;
      sndPoke();
    }
    function spawn(){
      while(nextSpawn<distance+820){
        const type=Math.random()<.38?'gap':'rock';
        const w=type==='gap'?rand(86,125):rand(34,50);
        objects.push({x:nextSpawn,w,type,starX:nextSpawn+w*.5,starY:type==='gap'?214:224,taken:false});
        nextSpawn+=w+rand(310,480);
      }
      objects=objects.filter(o=>o.x+o.w>distance-240);
    }
    function step(dt,now){
      const speed=Math.min(440,225+distance*.009);
      distance+=speed*dt;spawn();
      const prevY=y;
      if(jumps>0||y>GROUND||objects.some(o=>o.type==='gap'&&distance>=o.x&&distance<=o.x+o.w)){
        vy+=(holding&&now<holdUntil&&vy<0?960:1580)*dt;y+=vy*dt;
      }
      const gap=objects.some(o=>o.type==='gap'&&distance>=o.x-5&&distance<=o.x+o.w+5);
      if(!gap&&vy>=0&&prevY<=GROUND&&y>=GROUND){y=GROUND;vy=0;jumps=0;}
      for(const o of objects){
        if(o.type==='rock'&&distance+19>o.x&&distance-19<o.x+o.w&&y>GROUND-28){finish();return;}
        if(!o.taken&&Math.abs(distance-o.starX)<33&&Math.abs((y-43)-o.starY)<43){o.taken=true;stars++;sndPoke();}
      }
      if(y>GROUND+75){finish();return;}
      updateScore();
    }
    function loop(now){
      if(mode!=='running')return;
      const dt=Math.min(.035,Math.max(0,(now-lastTime)/1000));lastTime=now;
      step(dt,now);draw();if(mode==='running')frame=requestAnimationFrame(loop);
    }
    function rounded(x,y,w,h,r,color){
      r=Math.min(r,w/2,h/2);ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(x+r,y);
      ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);ctx.closePath();ctx.fill();
    }
    function star(x,y,r,color){
      ctx.fillStyle=color;ctx.beginPath();
      for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,d=i%2?r*.45:r;
        const px=x+Math.cos(a)*d,py=y+Math.sin(a)*d;
        if(!i)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
      ctx.closePath();ctx.fill();
    }
    function draw(){
      const dark=document.documentElement.dataset.theme==='dark';
      const sky=ctx.createLinearGradient(0,0,0,GROUND);
      sky.addColorStop(0,dark?'#1d2d47':'#b9e8ee');sky.addColorStop(1,dark?'#47516a':'#f9e9dc');
      ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
      const hillOffset=(distance*.12)%350;
      ctx.fillStyle=dark?'#485770':'#d4e3ce';
      for(let i=-1;i<4;i++){const x=i*350-hillOffset;ctx.beginPath();ctx.ellipse(x+155,GROUND+35,210,110,0,Math.PI,0);ctx.fill();}
      const cloudOffset=(distance*.06)%290;
      ctx.fillStyle=dark?'#78839a':'#ffffffb8';
      for(let i=-1;i<5;i++){const x=i*290-cloudOffset+40,yc=55+(i%3)*36;
        ctx.beginPath();ctx.ellipse(x,yc,43,15,0,0,Math.PI*2);ctx.ellipse(x+18,yc-9,23,18,0,0,Math.PI*2);ctx.fill();}
      ctx.fillStyle=dark?'#65776c':'#a8c896';ctx.fillRect(0,GROUND,W,H-GROUND);
      ctx.fillStyle=dark?'#a6b6a1':'#e3eeb4';ctx.fillRect(0,GROUND,W,8);
      for(const o of objects){
        const x=o.x-distance+PX;if(x>W+50||x+o.w<-50)continue;
        if(o.type==='gap'){
          ctx.fillStyle=dark?'#314869':'#9bd7de';ctx.fillRect(x,GROUND-1,o.w,H-GROUND+1);
          ctx.strokeStyle=dark?'#7fa6c0':'#eafafa';ctx.lineWidth=3;
          ctx.beginPath();ctx.moveTo(x+5,GROUND+21);ctx.quadraticCurveTo(x+20,GROUND+12,x+35,GROUND+21);ctx.stroke();
        }else{
          rounded(x,GROUND-32,o.w,34,10,dark?'#899597':'#9da5a1');
          ctx.fillStyle=dark?'#adb8b7':'#cbd2c9';ctx.beginPath();ctx.ellipse(x+o.w*.35,GROUND-24,5,3,-.3,0,Math.PI*2);ctx.fill();
        }
        if(!o.taken){star(o.starX-distance+PX,o.starY,14,dark?'#ffe1a0':'#f6c96e');
          ctx.fillStyle=dark?'#fff1c7':'#fff9dc';ctx.beginPath();ctx.arc(o.starX-distance+PX,o.starY,4,0,Math.PI*2);ctx.fill();}
      }
      // Hachiware SVG is copied from the main character, then placed in an original small wagon.
      if(mascotImage?.complete&&mascotImage.naturalWidth)ctx.drawImage(mascotImage,PX-39,y-95,78,92);
      else{
        ctx.fillStyle='#fffdfa';ctx.beginPath();ctx.ellipse(PX,y-65,30,31,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#7faac3';ctx.beginPath();ctx.moveTo(PX-31,y-78);ctx.lineTo(PX-24,y-109);ctx.lineTo(PX-5,y-88);ctx.lineTo(PX+12,y-91);ctx.lineTo(PX+27,y-106);ctx.lineTo(PX+31,y-76);ctx.fill();
        ctx.fillStyle='#262321';ctx.beginPath();ctx.ellipse(PX-10,y-69,3,5,0,0,Math.PI*2);ctx.ellipse(PX+10,y-69,3,5,0,0,Math.PI*2);ctx.fill();
      }
      rounded(PX-43,y-21,86,27,9,dark?'#7aa7bb':'#8dbbd0');
      rounded(PX-37,y-22,74,5,3,'#e7f4ed');
      ctx.fillStyle='#415c6a';for(const wx of [PX-26,PX+27]){ctx.beginPath();ctx.arc(wx,y+8,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e5d8b0';ctx.beginPath();ctx.arc(wx,y+8,3,0,Math.PI*2);ctx.fill();ctx.fillStyle='#415c6a';}
      if(mode==='running'&&jumps>0){star(PX-43,y+5,5,dark?'#b1d8e9':'#fff4bc');}
    }
    startBtn.addEventListener('click',start);
    pauseBtn.addEventListener('click',()=>mode==='running'?pause():mode==='paused'?start():null);
    const press=e=>{e.preventDefault();jump();};
    canvas.addEventListener('pointerdown',press);$('#starlaneJump').addEventListener('pointerdown',press);
    window.addEventListener('pointerup',()=>holding=false);
    $('#starlaneJump').addEventListener('click',e=>{if(e.detail===0)jump();});
    window.addEventListener('keydown',e=>{
      if(!$('#view-starlane').classList.contains('is-active'))return;
      if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)jump();}
      if(e.code==='KeyP'&&mode==='running')pause();
    });
    window.addEventListener('keyup',e=>{if(['Space','ArrowUp','KeyW'].includes(e.code))holding=false;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
    reset();
    return {enter(){draw();},leave(){pause();}};
  }
  window.HachiStarlane={init,_test:{rewardForScore,scoreFor}};
})();
