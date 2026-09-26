/* Offline board games: freestyle Gomoku and legal-move chess. No remote engine. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const dirs = [[1,0],[0,1],[1,1],[1,-1]];
  const queenValues = { p:100,n:320,b:335,r:500,q:900,k:20000 };
  const glyphs = { K:'♔',Q:'♕',R:'♖',B:'♗',N:'♘',P:'♙',k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟' };
  const in8 = (r,c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const idx = (r,c) => r * 8 + c;
  const side = p => p && p === p.toUpperCase() ? 'w' : p ? 'b' : null;
  const other = t => t === 'w' ? 'b' : 'w';

  function initialChess() {
    return { b: [...'rnbqkbnr', ...Array(8).fill('p'), ...Array(32).fill(null), ...Array(8).fill('P'), ...'RNBQKBNR'],
      turn:'w', rights:'KQkq', ep:-1, half:0, ply:0 };
  }
  function chessAttack(s, square, by) {
    const b=s.b, r=Math.floor(square/8), c=square%8;
    const pawnR=r+(by==='w'?1:-1), pawn=by==='w'?'P':'p';
    for(const dc of [-1,1]) if(in8(pawnR,c+dc) && b[idx(pawnR,c+dc)]===pawn) return true;
    for(const [dr,dc] of [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]])
      if(in8(r+dr,c+dc) && b[idx(r+dr,c+dc)]===(by==='w'?'N':'n')) return true;
    for(const [dr,dc] of [...dirs,...dirs.map(([a,d])=>[-a,-d])]) {
      let rr=r+dr,cc=c+dc,steps=1;
      while(in8(rr,cc)) {
        const p=b[idx(rr,cc)];
        if(p){ if(side(p)===by){const type=p.toLowerCase();
          if((dr===0||dc===0) ? (type==='r'||type==='q') : (type==='b'||type==='q')) return true;
          if(steps===1 && type==='k') return true;
        } break; }
        rr+=dr;cc+=dc;steps++;
      }
    }
    return false;
  }
  function inCheck(s,color) {
    const k=s.b.indexOf(color==='w'?'K':'k');
    return k<0 || chessAttack(s,k,other(color));
  }
  function pseudoChess(s, capturesOnly=false) {
    const out=[], b=s.b, t=s.turn;
    const add=(from,to,extra={})=>{if(b[to]?.toLowerCase()==='k') return;out.push({from,to,...extra});};
    for(let from=0;from<64;from++) {
      const p=b[from]; if(!p||side(p)!==t) continue;
      const r=from>>3,c=from&7,type=p.toLowerCase();
      if(type==='p') {
        const d=t==='w'?-1:1, one=idx(r+d,c), prom=r+d===(t==='w'?0:7);
        if(in8(r+d,c)) {
          if(!capturesOnly&&!b[one]) {
            add(from,one,prom?{promotion:t==='w'?'Q':'q'}:{});
            if(r===(t==='w'?6:1)&&!b[idx(r+2*d,c)]) add(from,idx(r+2*d,c));
          }
          for(const dc of [-1,1]) if(in8(r+d,c+dc)) {
            const to=idx(r+d,c+dc);
            if(b[to]&&side(b[to])!==t) add(from,to,prom?{promotion:t==='w'?'Q':'q'}:{});
            else if(to===s.ep) add(from,to,{ep:true});
          }
        }
      } else if(type==='n'||type==='k') {
        const offsets=type==='n'?[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]:
          [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
        for(const [dr,dc] of offsets) if(in8(r+dr,c+dc)) {
          const to=idx(r+dr,c+dc); if(side(b[to])!==t && (!capturesOnly||b[to])) add(from,to);
        }
        if(type==='k'&&!capturesOnly&&!inCheck(s,t)) {
          const home=t==='w'?60:4,enemy=other(t), rook=t==='w'?'R':'r';
          if(from===home && s.rights.includes(t==='w'?'K':'k') && b[home+3]===rook && !b[home+1]&&!b[home+2] &&
            !chessAttack(s,home+1,enemy)&&!chessAttack(s,home+2,enemy)) add(from,home+2,{castle:true});
          if(from===home && s.rights.includes(t==='w'?'Q':'q') && b[home-4]===rook && !b[home-1]&&!b[home-2]&&!b[home-3] &&
            !chessAttack(s,home-1,enemy)&&!chessAttack(s,home-2,enemy)) add(from,home-2,{castle:true});
        }
      } else {
        const steps=type==='b'?[[1,1],[1,-1],[-1,1],[-1,-1]]:type==='r'?[[1,0],[-1,0],[0,1],[0,-1]]:
          [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];
        for(const [dr,dc] of steps) {
          let rr=r+dr,cc=c+dc;
          while(in8(rr,cc)) {
            const to=idx(rr,cc);if(side(b[to])===t) break;
            if(!capturesOnly||b[to]) add(from,to);
            if(b[to])break;
            rr+=dr;cc+=dc;
          }
        }
      }
    }
    return out;
  }
  function chessApply(s,m) {
    const b=s.b.slice(), p=b[m.from], taken=b[m.to];
    b[m.to]=m.promotion||p;b[m.from]=null;
    if(m.ep) b[m.to+(s.turn==='w'?8:-8)]=null;
    if(m.castle){ const row=s.turn==='w'?56:0, short=m.to>m.from, rf=row+(short?7:0),rt=row+(short?5:3);b[rt]=b[rf];b[rf]=null; }
    let rights=s.rights;
    if(p==='K')rights=rights.replace(/[KQ]/g,'');if(p==='k')rights=rights.replace(/[kq]/g,'');
    for(const [sq,ch] of [[63,'K'],[56,'Q'],[7,'k'],[0,'q']]) if(m.from===sq||m.to===sq) rights=rights.replace(ch,'');
    return {b,turn:other(s.turn),rights,ep:p.toLowerCase()==='p'&&Math.abs(m.to-m.from)===16?(m.to+m.from)/2:-1,
      half:p.toLowerCase()==='p'||taken||m.ep?0:s.half+1,ply:s.ply+1};
  }
  function legalChess(s) {return pseudoChess(s).filter(m=>!inCheck(chessApply(s,m),s.turn));}
  function chessEval(s) {
    let score=0;
    for(let i=0;i<64;i++) {const p=s.b[i];if(!p)continue;
      const r=i>>3,c=i&7,center=3.5-Math.abs(3.5-c),advance=side(p)==='w'?6-r:r-1;
      let bonus=0;
      switch(p.toLowerCase()){
        case 'p':bonus=advance*7+center*4;break;
        case 'n':bonus=center*13+(3.5-Math.abs(3.5-r))*12;break;
        case 'b':bonus=center*7;break;
        case 'q':bonus=center*3;break;
        case 'k':bonus=s.ply<36?-center*6: center*8;break;
      }
      score+=(side(p)==='w'?1:-1)*(queenValues[p.toLowerCase()]+bonus);
    }
    return score*(s.turn==='w'?1:-1);
  }
  const chessOrder=(s,m)=> (s.b[m.to]?10*queenValues[s.b[m.to].toLowerCase()]-queenValues[s.b[m.from].toLowerCase()]:0)+(m.promotion?8000:0)+(m.castle?35:0);
  function chessBot(s,level) {
    const moves=legalChess(s);if(moves.length<2)return moves[0];
    const budget=[0,80,120,160,220,300,450,750,1250,2200,3600,5000][level];
    const depthLimit=level<3?1:level<5?2:level<7?3:level<9?4:6;
    const deadline=performance.now()+budget;
    let nodes=0;
    const search=(pos,depth,alpha,beta,ply)=>{
      if((++nodes&255)===0&&performance.now()>deadline)throw new Error('time');
      if(pos.half>=100)return 0;
      const check=inCheck(pos,pos.turn);
      if(depth<=0){
        const stand=chessEval(pos);if(ply>3||(!check&&stand>=beta))return stand;
        if(!check){alpha=Math.max(alpha,stand);const caps=pseudoChess(pos,true).filter(m=>!inCheck(chessApply(pos,m),pos.turn));
          caps.sort((a,b)=>chessOrder(pos,b)-chessOrder(pos,a));
          for(const m of caps){const val=-search(chessApply(pos,m),-1,-beta,-alpha,ply+1);if(val>=beta)return val;alpha=Math.max(alpha,val);}return alpha;
        }
      }
      const all=legalChess(pos);
      if(!all.length)return check?-100000+ply:0;
      all.sort((a,b)=>chessOrder(pos,b)-chessOrder(pos,a));
      for(const m of all){const val=-search(chessApply(pos,m),depth-1,-beta,-alpha,ply+1);if(val>=beta)return val;alpha=Math.max(alpha,val);}
      return alpha;
    };
    let best=moves[Math.floor(Math.random()*moves.length)];
    for(let depth=1;depth<=depthLimit;depth++){
      try{
        const ranked=moves.map(m=>({m,score:-search(chessApply(s,m),depth-1,-Infinity,Infinity,1)}));
        ranked.sort((a,b)=>b.score-a.score);
        if(level<=3){const pool=ranked.filter(x=>x.score>=ranked[0].score-(4-level)*110);best=pool[Math.floor(Math.random()*Math.min(pool.length,4))].m;}
        else best=ranked[0].m;
        moves.sort((a,b)=>a===best?-1:b===best?1:0);
      }catch {break;}
      if(performance.now()>deadline)break;
    }
    return best;
  }
  function chessResult(s,seen) {
    const key=s.b.map(x=>x||'.').join('')+s.turn+s.rights+s.ep;
    const nonKings=s.b.filter(p=>p&&p.toLowerCase()!=='k');
    const insufficient=nonKings.length===0||(nonKings.length===1&&['b','n'].includes(nonKings[0].toLowerCase()));
    if(s.half>=100||(seen[key]||0)>=3||insufficient)return 'draw';
    const moves=legalChess(s);return moves.length?null:inCheck(s,s.turn)?other(s.turn):'draw';
  }
  const chessKey=s=>s.b.map(x=>x||'.').join('')+s.turn+s.rights+s.ep;

  const O=15;
  const oInside=(r,c)=>r>=0&&r<O&&c>=0&&c<O;
  function oWinner(b,last){
    if(last<0||!b[last])return 0;
    const r=Math.floor(last/O),c=last%O,v=b[last];
    for(const [dr,dc] of dirs){let n=1;
      for(const sign of [-1,1]){let rr=r+dr*sign,cc=c+dc*sign;
        while(oInside(rr,cc)&&b[rr*O+cc]===v){n++;rr+=dr*sign;cc+=dc*sign;}}
      if(v===1?n===5:n>=5)return v;
    }return 0;
  }
  function oRun(b,i,dr,dc) {
    const r=Math.floor(i/O),c=i%O,v=b[i];let n=1;
    for(const sign of [-1,1]){
      let rr=r+dr*sign,cc=c+dc*sign;
      while(oInside(rr,cc)&&b[rr*O+cc]===v){n++;rr+=dr*sign;cc+=dc*sign;}
    }
    return n;
  }
  function oWindows(b,i,dr,dc,len) {
    const r=Math.floor(i/O),c=i%O,out=[];
    for(let shift=-(len-1);shift<=0;shift++){
      const cells=[];let valid=true;
      for(let n=0;n<len;n++){
        const rr=r+(shift+n)*dr,cc=c+(shift+n)*dc;
        if(!oInside(rr,cc)){valid=false;break;}
        cells.push(rr*O+cc);
      }
      if(valid)out.push(cells);
    }
    return out;
  }
  function renjuFours(b,i) {
    const groups=new Set();
    for(const [dr,dc] of dirs)for(const line of oWindows(b,i,dr,dc,5)){
      const stones=line.filter(x=>b[x]===1),empties=line.filter(x=>!b[x]);
      if(stones.length!==4||empties.length!==1)continue;
      const end=empties[0];b[end]=1;
      const legalFive=oRun(b,end,dr,dc)===5;
      b[end]=0;
      if(legalFive)groups.add(stones.join(','));
    }
    return groups.size;
  }
  function renjuOpenThrees(b,i,depth) {
    const groups=new Set(),r=Math.floor(i/O),c=i%O;
    for(const [dr,dc] of dirs)for(let offset=-4;offset<=4;offset++){
      if(offset===0)continue;
      const rr=r+offset*dr,cc=c+offset*dc;
      if(!oInside(rr,cc))continue;
      const candidate=rr*O+cc;if(b[candidate])continue;
      b[candidate]=1;
      const straight=[];
      for(const line of oWindows(b,i,dr,dc,4)){
        if(!line.includes(candidate)||!line.every(x=>b[x]===1))continue;
        const first=line[0],last=line[3];
        const beforeR=Math.floor(first/O)-dr,beforeC=first%O-dc;
        const afterR=Math.floor(last/O)+dr,afterC=last%O+dc;
        if(!oInside(beforeR,beforeC)||!oInside(afterR,afterC))continue;
        const before=beforeR*O+beforeC,after=afterR*O+afterC;
        if(b[before]||b[after])continue;
        b[before]=1;const left=oRun(b,before,dr,dc)===5;b[before]=0;
        b[after]=1;const right=oRun(b,after,dr,dc)===5;b[after]=0;
        if(left&&right)straight.push(line.filter(x=>x!==candidate).join(','));
      }
      if(straight.length){
        const next=renjuAnalyzePlaced(b,candidate,depth-1);
        if(!next.forbidden&&!next.win)for(const key of straight)groups.add(key);
      }
      b[candidate]=0;
    }
    return groups.size;
  }
  function renjuAnalyzePlaced(b,i,depth=2) {
    if(dirs.some(([dr,dc])=>oRun(b,i,dr,dc)===5))return {win:true,forbidden:null};
    if(dirs.some(([dr,dc])=>oRun(b,i,dr,dc)>=6))return {win:false,forbidden:'장목(6목 이상)'};
    if(renjuFours(b,i)>=2)return {win:false,forbidden:'4-4 금수'};
    if(depth>0&&renjuOpenThrees(b,i,depth)>=2)return {win:false,forbidden:'3-3 금수'};
    return {win:false,forbidden:null};
  }
  function renjuMove(b,i) {
    if(b[i])return {win:false,forbidden:'이미 돌이 있는 자리'};
    b[i]=1;const result=renjuAnalyzePlaced(b,i);b[i]=0;return result;
  }
  function oCandidates(b) {
    const set=new Set();let count=0;
    for(let i=0;i<b.length;i++)if(b[i]){count++;const r=Math.floor(i/O),c=i%O;
      for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++)if(oInside(r+dr,c+dc)&&!b[(r+dr)*O+c+dc])set.add((r+dr)*O+c+dc);
    }
    return count?[...set]:[112];
  }
  function oPoint(b,i,p) {
    const r=Math.floor(i/O),c=i%O;
    let total=0;
    for(const [dr,dc] of dirs){
      let line=1,open=0;
      for(const sign of [-1,1]){let rr=r+dr*sign,cc=c+dc*sign;
        while(oInside(rr,cc)&&b[rr*O+cc]===p){line++;rr+=dr*sign;cc+=dc*sign;}
        if(oInside(rr,cc)&&!b[rr*O+cc])open++;
      }
      total+=line>=5?10000000:line===4?(open===2?500000:50000):line===3?(open===2?9000:800):line===2?(open===2?350:35):open===2?7:1;
    }
    return total;
  }
  function oRank(b,p,limit=12){return oCandidates(b).map(i=>({i,attack:oPoint(b,i,p),defend:oPoint(b,i,3-p)}))
    .sort((a,z)=>(z.attack+z.defend*.95)-(a.attack+a.defend*.95)).slice(0,limit);}
  function oBot(b,level){
    const initial=oRank(b,2,level>=8?16:level>=5?12:7);
    if(initial.length===1)return initial[0].i;
    const win=initial.find(x=>x.attack>=10000000);if(win)return win.i;
    const block=initial.find(x=>x.defend>=10000000);if(block)return block.i;
    if(level<=2){const top=initial.slice(0,level===1?6:3);return top[Math.floor(Math.random()*top.length)].i;}
    const depth=level>=9?4:level>=6?3:2, beam=level>=8?9:level>=5?7:5;
    const deadline=performance.now()+(level>=9?2800:level>=8?1500:level>=6?750:280);
    function search(player,d,alpha,beta,last){
      if(oWinner(b,last))return -10000000-d;
      const ranked=oRank(b,player,beam);
      if(!ranked.length)return 0;
      if(d===0)return ranked[0].attack+ranked[0].defend*.72;
      let best=-Infinity;
      for(const x of ranked){
        if(performance.now()>deadline)break;
        b[x.i]=player;
        const val=oWinner(b,x.i)?10000000+d:-search(3-player,d-1,-beta,-alpha,x.i);
        b[x.i]=0;
        if(val>best)best=val;
        alpha=Math.max(alpha,val);if(alpha>=beta)break;
      }
      return best===-Infinity?ranked[0].attack:best;
    }
    let best=initial[0].i,bestScore=-Infinity;
    for(const x of initial){if(performance.now()>deadline)break;
      b[x.i]=2;
      const val=-search(1,depth-1,-Infinity,-bestScore,x.i)+x.attack*.002;
      b[x.i]=0;
      if(val>bestScore){bestScore=val;best=x.i;}
    }
    return best;
  }
  function init({state,save,earn,notice,sndWin,sndBad,sndPoke,rewardFor}) {
    state.boardRecords ||= {omok:{},chess:{}};
    for(const game of ['omok','chess'])state.boardRecords[game] ||= {};
    const controllers={};
    function recordFor(game,level){
      return state.boardRecords[game][level] ||= {wins:0,losses:0,draws:0,bestTime:null,streak:0,bestStreak:0};
    }
    function summary(game){
      const wins=Object.values(state.boardRecords[game]).reduce((a,r)=>a+(r.wins||0),0);
      $(`#${game}Summary`).textContent=`총 승리 ${wins}회`;
    }
    function finish(game,level,result,seconds,moves){
      const r=recordFor(game,level);
      if(result==='win'){
        r.wins++;r.streak++;r.bestStreak=Math.max(r.bestStreak||0,r.streak);
        r.bestTime=r.bestTime===null?seconds:Math.min(r.bestTime,seconds);
        const effective=Math.max(seconds,20+moves*(game==='omok'?3:5));
        const coins=rewardFor(level,effective);
        earn(coins);sndWin();notice(`승리! Lv${level} · 🪙${coins} 획득!`);
      }else {r.streak=0;if(result==='draw')r.draws++;else r.losses++;sndBad();notice(result==='draw'?'무승부예요. 다시 도전해요!':'봇이 이겼어요. 다시 도전해요!');}
      save();summary(game);
    }
    function renderRecord(game,level){
      const r=recordFor(game,level);
      $(`#${game}Record`).textContent=`🏆 Lv${level} 승리 ${r.wins||0}회 · 패배 ${r.losses||0}회 · 무승부 ${r.draws||0}회 · 최단 승리 ${r.bestTime==null?'-':fmt(r.bestTime)} · 최다 연승 ${r.bestStreak||0}회`;
      const duration=game==='omok'?100:160;
      $(`#${game}Goal`).textContent=`승리 시 실제 플레이 시간과 Lv에 따른 보상 · ${duration}초 기준 약 🪙${rewardFor(level,duration)} · 무승부·중단은 보상 없음`;
    }
    function setup(game) {
      const select=$(`#${game}Level`),status=$(`#${game}Status`),clock=$(`#${game}Time`);
      select.innerHTML=Array.from({length:10},(_,i)=>`<option value="${i+1}">Lv${i+1}</option>`).join('');
      let level=1,seconds=0,startedAt=0,timer=null,task=null,finished=false,thinking=false;
      let board,history=[],last=-1,selected=-1,hint=-1,flipped=false,seen={};
      const displayTime=()=>{if(startedAt)seconds=Math.floor((Date.now()-startedAt)/1000);clock.textContent=fmt(seconds);};
      const startTime=()=>{if(startedAt)return;startedAt=Date.now();timer=setInterval(displayTime,1000);select.disabled=true;};
      const stopTime=()=>{displayTime();clearInterval(timer);timer=null;startedAt=0;select.disabled=false;};
      const say=t=>{status.textContent=t;};
      const legalNow=()=>game==='chess'?legalChess(board):[];
      function render(){
        const target=$(`#${game}Board`);target.innerHTML='';
        if(game==='omok'){
          for(let i=0;i<O*O;i++){
            const r=Math.floor(i/O),c=i%O,cell=document.createElement('button');
            cell.type='button';cell.className='omok-cell'+(board[i]?' occupied':'')+(last===i?' last':'')+(hint===i?' hint':'');
            cell.dataset.i=i;cell.setAttribute('role','gridcell');
            cell.setAttribute('aria-label',`${r+1}행 ${c+1}열 ${board[i]===1?'흑돌':board[i]===2?'백돌':'빈 곳'}`);
            if(board[i]){const stone=document.createElement('span');stone.className='stone '+(board[i]===1?'black':'white');cell.append(stone);}
            target.append(cell);
          }
        }else{
          const legal=selected>=0?legalNow().filter(m=>m.from===selected).map(m=>m.to):[];
          for(let display=0;display<64;display++){
            const i=flipped?63-display:display,r=i>>3,c=i&7,p=board.b[i],cell=document.createElement('button');
            cell.type='button';cell.dataset.i=i;cell.setAttribute('role','gridcell');
            cell.className=`chess-cell ${(r+c)%2?'dark-square':'light-square'}${selected===i?' selected':''}${legal.includes(i)?' legal':''}${last===i?' last':''}${hint===i?' hint':''}`;
            if(p){cell.textContent=glyphs[p];cell.classList.add(side(p)==='w'?'white-piece':'black-piece');}
            const coord='abcdefgh'[c]+(8-r);
            cell.setAttribute('aria-label',`${coord} ${p?(side(p)==='w'?'백':'흑')+' '+p.toUpperCase():'빈 칸'}`);
            target.append(cell);
          }
        }
        $(`#${game}Undo`).disabled=finished||!history.length;
        $(`#${game}Hint`).disabled=finished||thinking;
      }
      function reset(){
        clearTimeout(task);clearInterval(timer);task=null;timer=null;startedAt=0;seconds=0;clock.textContent='0:00';
        finished=false;thinking=false;history=[];last=-1;selected=-1;hint=-1;seen={};
        select.disabled=false;level=Number(select.value);board=game==='omok'?Array(O*O).fill(0):initialChess();
        if(game==='chess')seen[chessKey(board)]=1;
        say(game==='omok'?'당신 차례 · 흑돌':'당신 차례 · 백');
        renderRecord(game,level);render();
      }
      function resolve(result){
        if(finished)return;
        finished=true;thinking=false;clearTimeout(task);task=null;stopTime();
        finish(game,level,result,seconds,game==='omok'?history.length:board.ply);
        renderRecord(game,level);render();
        say(result==='win'?'승리! 새 대국에서 또 만나요.':result==='draw'?'무승부! 새 대국에서 다시 만나요.':'봇 승리! 새 대국에서 다시 만나요.');
      }
      function omokTurn(i){
        if(finished||thinking||board[i])return;
        if(history.length===0&&i!==112){say('첫 흑돌은 가운데 꽃 표시에서 시작해요.');hint=112;render();return;}
        const move=renjuMove(board,i);
        if(move.forbidden){say(`${move.forbidden}! 다른 자리를 골라주세요.`);hint=i;render();return;}
        history.push(board.slice());board[i]=1;last=i;hint=-1;startTime();sndPoke();render();
        if(move.win){resolve('win');return;}
        if(board.every(Boolean)){resolve('draw');return;}
        thinking=true;say('하치와레가 생각 중…');render();
        task=setTimeout(()=>{if(finished)return;
          const bot=oBot(board.slice(),level);if(bot==null){resolve('draw');return;}
          history.push(board.slice());board[bot]=2;last=bot;thinking=false;sndPoke();
          if(oWinner(board,bot)){resolve('loss');return;}
          if(board.every(Boolean)){resolve('draw');return;}
          say('당신 차례 · 흑돌');render();
        },250);
      }
      function chessTurn(i){
        if(finished||thinking)return;
        const moves=legalNow();
        if(selected>=0){
          const move=moves.find(m=>m.from===selected&&m.to===i);
          if(move){history.push(board);board=chessApply(board,move);last=i;selected=-1;hint=-1;startTime();sndPoke();
            seen[chessKey(board)]=(seen[chessKey(board)]||0)+1;
            const result=chessResult(board,seen);
            if(result){resolve(result==='w'?'win':result==='draw'?'draw':'loss');return;}
            thinking=true;say('하치와레가 수를 읽는 중…');render();
            task=setTimeout(()=>{if(finished)return;
              const bot=chessBot(board,level);if(!bot){resolve('win');return;}
              history.push(board);board=chessApply(board,bot);last=bot.to;thinking=false;sndPoke();
              seen[chessKey(board)]=(seen[chessKey(board)]||0)+1;
              const done=chessResult(board,seen);
              if(done){resolve(done==='b'?'loss':done==='draw'?'draw':'win');return;}
              say(inCheck(board,'w')?'체크! 왕을 지켜주세요.':'당신 차례 · 백');render();
            },180);
            return;
          }
        }
        selected=board.b[i]&&side(board.b[i])==='w'?i:-1;render();
      }
      $(`#${game}Board`).addEventListener('click',e=>{
        const i=Number(e.target.closest('[data-i]')?.dataset.i);
        if(!Number.isInteger(i)||i<0||Number.isNaN(i))return;
        if(game==='omok')omokTurn(i);else chessTurn(i);
      });
      select.addEventListener('change',()=>{if(!startedAt)reset();});
      $(`#${game}Restart`).addEventListener('click',reset);
      $(`#${game}Undo`).addEventListener('click',()=>{
        if(finished||!history.length)return;
        clearTimeout(task);task=null;thinking=false;
        if(game==='omok'){
          board=history.pop();if(history.length && board.filter(Boolean).length%2===1)board=history.pop();
          last=-1;
        }else{
          if(board.turn==='w'&&history.length>=2)history.pop();
          board=history.pop();seen={};
          for(const s of history)seen[chessKey(s)]=(seen[chessKey(s)]||0)+1;
          seen[chessKey(board)]=(seen[chessKey(board)]||0)+1;
          last=-1;selected=-1;
        }
        hint=-1;say('한 수 물렀어요 · 당신 차례');render();
      });
      $(`#${game}Hint`).addEventListener('click',()=>{
        if(finished||thinking)return;
        if(game==='omok'){
          const win=oRank(board,1,15).find(x=>x.attack>=10000000);
          const block=oRank(board,1,15).find(x=>x.defend>=10000000);
          hint=[win?.i,block?.i,...oRank(board,1,15).map(x=>x.i)].find(i=>i!=null&&!renjuMove(board,i).forbidden)??-1;
        }else{
          const moves=legalNow();moves.sort((a,b)=>chessOrder(board,b)-chessOrder(board,a));
          hint=moves[0]?.to??-1;selected=moves[0]?.from??-1;
        }
        say('반짝이는 칸을 참고하세요.');render();
      });
      if(game==='chess')$('#chessFlip').addEventListener('click',()=>{flipped=!flipped;render();});
      reset();
      return {enter(){if(finished)reset();},leave(){
        clearTimeout(task);task=null;if(startedAt||thinking){clearInterval(timer);timer=null;startedAt=0;finished=true;thinking=false;select.disabled=false;}
      }};
    }
    controllers.omok=setup('omok');controllers.chess=setup('chess');summary('omok');summary('chess');
    return {enter:view=>controllers[view]?.enter(),leave:view=>controllers[view]?.leave()};
  }
  window.HachiBoardGames={init, _test:{initialChess,legalChess,chessApply,inCheck,chessResult,chessBot,oWinner,oBot,oCandidates,renjuMove}};
})();
