import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])),base=s=>s.replace(/\.[^.]+$/,'');
const q=new URLSearchParams(location.search),tool=q.get('tool')||'rotate';const names={rotate:['PDFを回転','ページの向きを90°単位で変更','回転したいPDFを選択してください'],nup:['2・4ページ → 1枚','複数ページを1枚にまとめて印刷','PDFを選択してください'],organize:['PDF整理','ページの削除・抽出・並べ替え','整理したいPDFを選択してください'],compress:['PDFを軽量化','PDFの容量を小さくする','軽量化したいPDFを選択してください'],'page-numbers':['ページ番号を追加','ページ番号と総ページ数を追加','ページ番号を付けたいPDFを選択してください'],text:['PDFに文字を入れる','文字を追加してプレビュー','文字を入れたいPDFを選択してください']};
const E={title:$('#title'),hint:$('#hint'),drop:$('#drop'),pick:$('#pick'),input:$('#input'),files:$('#files'),settings:$('#settings'),progress:$('#progress'),result:$('#result'),error:$('#error')};let file=null,order=[],cancel=false,orderPdf=null,orderRenderToken=0,textPreviewScale=1,textPreviewPageWidth=595,textPreviewPageHeight=842,blankCandidates=new Set();
const fmt=n=>n<1024?n+' B':n<1048576?(n/1024).toFixed(1)+' KB':(n/1048576).toFixed(1)+' MB';function safeScale(page,requestedScale,maxDim=4000){const v=page.getViewport({scale:1}),cap=maxDim/Math.max(v.width,v.height);return Math.min(requestedScale,cap)}
function step(n){document.querySelectorAll('.step').forEach((x,i)=>x.classList.toggle('active',i===n-1))}function clear(){[E.files,E.settings,E.progress,E.result].forEach(x=>{x.hidden=true;x.innerHTML='' });E.error.hidden=true;E.error.textContent=''}function error(m,t=''){E.error.hidden=false;E.error.innerHTML='<strong>'+esc(m)+'</strong>'+(t?'<div class="hint">'+esc(t)+'</div>':'')}function prog(d,t,s){E.progress.hidden=false;E.progress.innerHTML=`<div class="progress-text"><strong>${esc(s)}</strong><span>${d} / ${t}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${t?d/t*100:0}%"></div></div><div class="actions"><button class="secondary-button" id="cancel">キャンセル</button></div>`;$('#cancel').onclick=()=>cancel=true}
async function load(f){try{return await pdfjsLib.getDocument({data:await f.arrayBuffer()}).promise}catch(e){if(e?.name==='PasswordException')throw Error('password');throw e}}
function range(s,max){const input=String(s||'').trim();if(!input)throw Error('range');const out=new Set();for(const z of input.split(',')){const part=z.trim(),m=part.match(/^(\d+)(?:\s*[-~〜]\s*(\d+))?$/);if(!m)throw Error('range');let a=Number(m[1]),b=m[2]?Number(m[2]):a;if(a>b)[a,b]=[b,a];if(a<1||b>max||!Number.isSafeInteger(a)||!Number.isSafeInteger(b))throw Error('range');for(let i=a;i<=b;i++)out.add(i)}return[...out].sort((a,b)=>a-b)}
function setFile(f){if(!f)return;if(f.type!=='application/pdf'&&!f.name.toLowerCase().endsWith('.pdf'))return error('PDFファイルを選択してください。');file=f;E.files.hidden=false;E.files.innerHTML=`<h3>選択したPDF</h3><div class="file-list"><div class="file-row"><div><div class="file-name">${esc(f.name)}</div><div class="file-meta">${fmt(f.size)}</div></div></div></div>`;if(tool==='organize')loadOrder();else settings()}
async function loadOrder(){try{orderRenderToken++;orderPdf=await load(file);orderPreviewCache.clear();order=Array.from({length:orderPdf.numPages},(_,i)=>i+1);renderOrder()}catch(e){error(e.message==='password'?'このPDFはパスワードで保護されています。':'このPDFは読み込めませんでした。')}}
const orderPreviewCache=new Map();
function renderOrder(){
  const token=++orderRenderToken;
  E.files.hidden=false;
  E.files.innerHTML=`<h3>ページ ${order.length}枚</h3><p class="field-note">ページの見た目を確認し、カードのドラッグまたは矢印で順番を変更できます。不要なページは削除してください。</p><div class="page-thumb-grid" id="ol"></div>`;
  const box=$('#ol');
  order.forEach((n,i)=>{
    const card=document.createElement('article');
    card.className='page-thumb-card';
    card.draggable=true;
    card.dataset.originalPage=String(n);
    const cached=orderPreviewCache.get(n);
    card.innerHTML=`<div class="page-thumb-art">${cached?`<img alt="元の${n}ページのプレビュー" src="${cached}">`:'<span class="thumb-loading">プレビュー作成中…</span>'}</div><div class="page-thumb-meta"><strong>並び順 ${i+1}</strong><span>元のページ ${n}</span></div><div class="thumb-controls"><button type="button" data-a="u" ${i?'':'disabled'} aria-label="${i+1}番目を上へ">↑</button><button type="button" data-a="d" ${i===order.length-1?'disabled':''} aria-label="${i+1}番目を下へ">↓</button><button type="button" data-a="x" ${order.length<=1?'disabled':''}>削除</button></div>`;
    card.querySelectorAll('button').forEach(b=>b.onclick=()=>{
      const a=b.dataset.a;
      if(a==='x'&&order.length>1)order.splice(i,1);
      if(a==='u'&&i)[order[i-1],order[i]]=[order[i],order[i-1]];
      if(a==='d'&&i<order.length-1)[order[i+1],order[i]]=[order[i],order[i+1]];
      renderOrder();
    });
    card.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';card.classList.add('sortable-drag')};
    card.ondragend=()=>card.classList.remove('sortable-drag');
    card.ondragover=e=>{e.preventDefault();card.classList.add('drag-over')};
    card.ondragleave=()=>card.classList.remove('drag-over');
    card.ondrop=e=>{
      e.preventDefault();card.classList.remove('drag-over');
      const from=Number(e.dataTransfer.getData('text/plain'));
      const to=Array.from(box.children).indexOf(card);
      if(Number.isInteger(from)&&from>=0&&from<order.length&&to>=0&&from!==to){
        const [moved]=order.splice(from,1);order.splice(to,0,moved);renderOrder();
      }
    };
    box.appendChild(card);
  });
  settings();
  fillOrderPreviews(token);
}
async function fillOrderPreviews(token){
  for(const n of [...new Set(order)]){
    if(token!==orderRenderToken)return;
    if(!orderPreviewCache.has(n)){
      try{
        const page=await orderPdf.getPage(n),baseView=page.getViewport({scale:1});
        const viewport=page.getViewport({scale:Math.min(.42,220/Math.max(baseView.width,baseView.height))});
        const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));
        await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,background:'white'}).promise;
        orderPreviewCache.set(n,canvas.toDataURL('image/jpeg',.72));canvas.width=canvas.height=1;
      }catch(e){orderPreviewCache.set(n,'');}
    }
    if(token!==orderRenderToken)return;
    const card=$('#ol')?.querySelector(`[data-original-page="${n}"]`);
    const art=card?.querySelector('.page-thumb-art');
    if(art&&orderPreviewCache.get(n))art.innerHTML=`<img alt="元の${n}ページのプレビュー" src="${orderPreviewCache.get(n)}">`;
    else if(art)art.innerHTML='<span class="thumb-loading">プレビューできません</span>';
    await new Promise(resolve=>setTimeout(resolve,0));
  }
}
function settings(){E.settings.hidden=false;step(2);let h;if(tool==='rotate')h='<h3>回転設定</h3><div class="settings-grid"><div class="field"><label>回転角度</label><select id="ang"><option value="90">90° 時計回り</option><option value="180">180°</option><option value="270">270° 時計回り</option></select></div><div class="field"><label>対象ページ</label><select id="tar"><option value="all">全ページ</option><option value="range">指定ページ</option></select></div><div class="field" id="rw" hidden><label>ページ範囲</label><input id="rng" placeholder="例：1-3,5,8"></div></div>';
else if(tool==='nup')h='<h3>印刷設定</h3><div class="settings-grid"><div class="field"><label>まとめるページ数</label><select id="num"><option value="2">2ページ → 1枚</option><option value="4">4ページ → 1枚</option></select></div><div class="field"><label>並べ方</label><select id="lay"><option value="vertical">縦に並べる</option><option value="horizontal">横に並べる</option></select></div><div class="field"><label>用紙</label><select id="paper"><option value="p">A4 縦</option><option value="l">A4 横</option></select></div><div class="field"><label>画質</label><select id="nupQuality"><option value="0.84">標準</option><option value="0.92">高画質</option></select></div></div>';
else if(tool==='organize')h='<h3>整理設定</h3><p class="field-note">ページを削除・並べ替えできます。白紙候補は自動で削除せず、確認してから削除します。</p><div class="actions"><button class="secondary-button" type="button" id="detectBlank">白紙候補を検出</button><button class="secondary-button" type="button" id="removeBlank" '+([...blankCandidates].some(n=>order.includes(n))?'':'disabled')+'>候補ページを削除</button></div>'+(blankCandidates.size?'<p class="field-note">白紙候補：'+[...blankCandidates].filter(n=>order.includes(n)).join('、')+'ページ（元のページ番号）</p>':'');
else if(tool==='page-numbers')h='<h3>ページ番号の設定</h3><div class="settings-grid"><div class="field"><label for="startNumber">開始番号</label><input id="startNumber" type="number" min="1" max="999999" value="1"></div><div class="field"><label for="numberSize">文字サイズ</label><select id="numberSize"><option value="9">小さめ</option><option value="11" selected>標準</option><option value="14">大きめ</option></select></div><div class="field"><label for="numberPosition">表示位置</label><select id="numberPosition"><option value="bottom-center">下・中央</option><option value="bottom-right">下・右</option><option value="bottom-left">下・左</option><option value="top-center">上・中央</option></select></div></div><p class="field-note">表示例：1 / 12。ページの内容は画像化せず、文字やリンクを保ったまま番号を追加します。</p>';
else if(tool==='text')h=`<h3>文字の設定</h3><div class="field"><label for="overlayText">入れる文字</label><textarea id="overlayText" rows="3" maxlength="1200" placeholder="例：確認済み・配付用・名前など"></textarea></div><div class="settings-grid"><div class="field"><label for="textSize">文字サイズ</label><select id="textSize"><option value="10">小さめ</option><option value="12" selected>標準</option><option value="16">大きめ</option><option value="20">大きい</option><option value="24">特大</option></select></div><div class="field"><label for="textColor">文字色</label><select id="textColor"><option value="#111827">黒</option><option value="#c62828">赤</option><option value="#1d4ed8">青</option></select></div><div class="field"><label for="textPosition">表示位置</label><select id="textPosition"><option value="top-left">上・左</option><option value="top-center">上・中央</option><option value="top-right">上・右</option><option value="center">中央</option><option value="bottom-left">下・左</option><option value="bottom-center" selected>下・中央</option><option value="bottom-right">下・右</option></select></div><div class="field"><label for="textTarget">対象ページ</label><select id="textTarget"><option value="all">すべてのページ</option><option value="first">1ページ目のみ</option><option value="range">ページを指定</option></select></div><div class="field" id="textRangeWrap" hidden><label for="textRange">ページ範囲</label><input id="textRange" placeholder="例：1-3,5,8"><span class="field-note">指定したページすべてに文字を入れます。</span></div></div><div class="text-preview-panel"><h3>仕上がりプレビュー（1ページ目）</h3><div class="text-preview-stage" id="textPreviewStage"><canvas id="textPreviewCanvas" aria-label="PDFのプレビュー"></canvas><div id="textPreviewLabel" class="text-preview-label pos-bottom-center is-placeholder">文字を入力すると表示されます</div></div><p class="field-note">プレビューは1ページ目です。文字の位置・色・大きさを確認してから保存できます。日本語対応のため、追加文字は画像として重ねます（元のPDF本文は残りますが、追加文字の選択・検索はできません）。</p></div>`;
else h='<h3>軽量化設定</h3><div class="settings-grid"><div class="field"><label>軽量化レベル</label><select id="level"><option value="high">画質優先（約150dpi）</option><option value="std" selected>標準（約108dpi）</option><option value="light">容量優先（約72dpi）</option></select><span class="field-note">PDFを画像として再構成します。文字の選択・検索などが失われる場合があります。</span></div></div>';
E.settings.innerHTML=h+`<div class="actions"><button class="primary-button" id="start">${tool==='rotate'?'PDFを回転':tool==='organize'?'整理したPDFを作成':tool==='compress'?'軽量化する':tool==='page-numbers'?'ページ番号を追加':tool==='text'?'文字を入れたPDFを作成':'PDFを作成'}</button></div>`;$ ('#start').onclick=run;const detect=$('#detectBlank');if(detect)detect.onclick=detectBlankPages;const remove=$('#removeBlank');if(remove)remove.onclick=()=>{const candidates=[...blankCandidates].filter(n=>order.includes(n));if(candidates.length&&confirm('元の'+candidates.join('、')+'ページを削除しますか？削除前にプレビューを確認してください。')){order=order.filter(n=>!candidates.includes(n));renderOrder()}};const tar=$('#tar');if(tar)tar.onchange=()=>$('#rw').hidden=tar.value!=='range';
  const textTarget=$('#textTarget');if(textTarget)textTarget.onchange=()=>$('#textRangeWrap').hidden=textTarget.value!=='range';
  if(tool==='text'){
    $('#overlayText').oninput=updateTextPreview;$('#textSize').onchange=updateTextPreview;$('#textColor').onchange=updateTextPreview;$('#textPosition').onchange=updateTextPreview;
    renderTextPreview();
  }
}
async function run(){cancel=false;E.error.hidden=true;E.error.textContent='';E.result.hidden=true;E.progress.hidden=true;E.progress.innerHTML='';step(3);try{let r;if(tool==='rotate')r=await rotate();else if(tool==='nup')r=await nup();else if(tool==='organize')r=await organize();else if(tool==='page-numbers')r=await addPageNumbers();else if(tool==='text')r=await addText();else r=await compress();if(!cancel)show(r)}catch(e){console.error(e);if(e.message==='cancelled'){E.progress.hidden=true;step(2);return}error(e.message==='password'?'このPDFはパスワードで保護されています。':e.message==='range'?'ページ範囲を確認してください。例：1-3,5,8。存在するページ番号を指定してください。':e.message&&e.message!=='undefined'?e.message:'PDFを処理できませんでした。','ファイルを小さくする、ページ数を減らす、または別のブラウザで試してください。')}}
async function rotate(){const d=await PDFLib.PDFDocument.load(await file.arrayBuffer()),n=d.getPageCount(),t=$('#tar').value==='all'?Array.from({length:n},(_,i)=>i+1):range($('#rng').value,n);if(!t.length)throw Error('range');const a=+$('#ang').value;t.forEach(i=>{const p=d.getPage(i-1);p.setRotation(PDFLib.degrees((p.getRotation().angle+a)%360))});prog(1,1,'回転完了');return[{blob:new Blob([await d.save()],{type:'application/pdf'}),name:base(file.name)+'_回転.pdf'}]}
async function nup(){const src=await load(file),count=+$('#num').value,land=$('#paper').value==='l',pw=land?842:595,ph=land?595:842,lay=$('#lay').value,q=+$('#nupQuality').value,d=await PDFLib.PDFDocument.create(),groups=Math.ceil(src.numPages/count);for(let g=0;g<groups;g++){if(cancel)break;prog(g,groups,`${g+1} / ${groups} 枚を作成中`);const pg=d.addPage([pw,ph]),cw=lay==='horizontal'?pw/count:pw,ch=lay==='horizontal'?ph:ph/count;for(let j=0;j<count&&g*count+j<src.numPages;j++){const p=await src.getPage(g*count+j+1),v=p.getViewport({scale:1}),fit=Math.min((cw-16)/v.width,(ch-16)/v.height),dw=v.width*fit,dh=v.height*fit,renderScale=safeScale(p,q>=.9?2.08:1.5),c=document.createElement('canvas');c.width=Math.ceil(v.width*renderScale);c.height=Math.ceil(v.height*renderScale);await p.render({canvasContext:c.getContext('2d',{alpha:false}),viewport:p.getViewport({scale:renderScale}),background:'white'}).promise;const b=await new Promise((r,x)=>c.toBlob(z=>z?r(z):x(Error('encode')),'image/jpeg',q)),jpg=await d.embedJpg(new Uint8Array(await b.arrayBuffer()));const x=lay==='horizontal'?j*cw+(cw-dw)/2:(cw-dw)/2,y=lay==='horizontal'?(ph-dh)/2:ph-(j+1)*ch+(ch-dh)/2;pg.drawImage(jpg,{x,y,width:dw,height:dh});c.width=c.height=1}}return[{blob:new Blob([await d.save()],{type:'application/pdf'}),name:base(file.name)+`_${count}ページまとめ.pdf`}]}
async function detectBlankPages(){if(!orderPdf)return;const button=$('#detectBlank');if(button)button.disabled=true;blankCandidates.clear();cancel=false;try{for(let n=1;n<=orderPdf.numPages;n++){if(cancel)break;prog(n-1,orderPdf.numPages,'白紙候補を確認中（'+n+' / '+orderPdf.numPages+'ページ）');const page=await orderPdf.getPage(n),baseView=page.getViewport({scale:1});const viewport=page.getViewport({scale:Math.min(.2,120/Math.max(baseView.width,baseView.height))});const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(viewport.width));canvas.height=Math.max(1,Math.ceil(viewport.height));const ctx=canvas.getContext('2d',{willReadFrequently:true});await page.render({canvasContext:ctx,viewport,background:'white'}).promise;const {data,width,height}=ctx.getImageData(0,0,canvas.width,canvas.height);let ink=0,samples=0;const x0=Math.floor(width*.05),x1=Math.ceil(width*.95),y0=Math.floor(height*.05),y1=Math.ceil(height*.95);for(let y=y0;y<y1;y+=2)for(let x=x0;x<x1;x+=2){const i=(y*width+x)*4;samples++;if(data[i]<238||data[i+1]<238||data[i+2]<238)ink++}if(samples&&ink/samples<.0015)blankCandidates.add(n);canvas.width=canvas.height=1;await new Promise(resolve=>setTimeout(resolve,0))}E.progress.hidden=true;if(!cancel&&!blankCandidates.size)error('白紙候補は見つかりませんでした。','薄い印刷や小さな記号だけのページは検出されない場合があります。');renderOrder()}catch(e){error('白紙候補を検出できませんでした。','PDFの状態を確認してください。')}finally{if(button)button.disabled=false}}
async function organize(){const d=await PDFLib.PDFDocument.load(await file.arrayBuffer()),o=await PDFLib.PDFDocument.create(),p=await o.copyPages(d,order.map(x=>x-1));p.forEach(x=>o.addPage(x));return[{blob:new Blob([await o.save()],{type:'application/pdf'}),name:base(file.name)+'_整理済み.pdf'}]}
async function addPageNumbers(){const d=await PDFLib.PDFDocument.load(await file.arrayBuffer()),pages=d.getPages(),font=await d.embedFont(PDFLib.StandardFonts.Helvetica),start=Math.max(1,Math.min(999999,Math.floor(Number($('#startNumber').value)||1))),size=+$('#numberSize').value,position=$('#numberPosition').value,total=pages.length;for(let i=0;i<pages.length;i++){if(cancel)break;const p=pages[i],{width,height}=p.getSize(),label=`${start+i} / ${total}`,textWidth=font.widthOfTextAtSize(label,size),margin=28;let x=(width-textWidth)/2,y=margin;if(position==='bottom-left')x=margin;else if(position==='bottom-right')x=width-margin-textWidth;else if(position==='top-center')y=height-size-margin;p.drawText(label,{x:Math.max(4,x),y:Math.max(4,y),size,font,color:PDFLib.rgb(0.25,0.28,0.33)});if(i%10===0||i===pages.length-1)prog(i+1,pages.length,`${i+1} / ${pages.length}ページに番号を追加中`)}return[{blob:new Blob([await d.save()],{type:'application/pdf'}),name:base(file.name)+'_ページ番号付き.pdf'}]}
async function renderTextPreview(){
  try{
    const doc=await load(file),page=await doc.getPage(1),baseView=page.getViewport({scale:1});
    textPreviewPageWidth=baseView.width;textPreviewPageHeight=baseView.height;
    textPreviewScale=Math.min(.9,650/Math.max(baseView.width,baseView.height));
    const viewport=page.getViewport({scale:textPreviewScale}),canvas=$('#textPreviewCanvas');
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport,background:'white'}).promise;
    updateTextPreview();
  }catch(e){error('PDFのプレビューを表示できませんでした。','PDFの状態を確認してください。')}
}
function updateTextPreview(){
  const label=$('#textPreviewLabel'),canvas=$('#textPreviewCanvas'),stage=$('#textPreviewStage');
  if(!label||!canvas)return;
  if(stage){stage.style.setProperty('--text-preview-inset-x',(28/Math.max(1,textPreviewPageWidth)*100)+'%');stage.style.setProperty('--text-preview-inset-y',(28/Math.max(1,textPreviewPageHeight)*100)+'%');}
  const text=$('#overlayText')?.value||'';
  label.textContent=text||'文字を入力すると表示されます';
  label.className='text-preview-label pos-'+($('#textPosition')?.value||'bottom-center')+(text?'':' is-placeholder');
  label.style.color=$('#textColor')?.value||'#111827';
  const cssRatio=canvas.clientWidth/Math.max(1,canvas.width);
  label.style.fontSize=(Number($('#textSize')?.value||12)*textPreviewScale*cssRatio)+'px';
}
function wrapCanvasLines(ctx,text,maxWidth){
  const lines=[];
  for(const paragraph of String(text).replace(/\r/g,'').split('\n')){
    if(paragraph===''){lines.push('');continue}
    let line='';
    for(const ch of Array.from(paragraph)){
      const candidate=line+ch;
      if(line&&ctx.measureText(candidate).width>maxWidth){lines.push(line);line=ch}else line=candidate;
    }
    lines.push(line);
  }
  return lines.length?lines:[''];
}
async function addText(){
  const text=$('#overlayText').value.trim();
  if(!text)throw Error('文字を入力してください。');
  const d=await PDFLib.PDFDocument.load(await file.arrayBuffer()),pages=d.getPages();
  const target=$('#textTarget').value,selected=target==='all'?pages.map((_,i)=>i+1):target==='first'?[1]:range($('#textRange').value,pages.length);
  if(!selected.length)throw Error('ページ範囲が正しくありません。');
  const size=Number($('#textSize').value),color=$('#textColor').value,position=$('#textPosition').value;
  const scaleForPage=(w,h)=>Math.min(3,5000/Math.max(w,h));
  for(let k=0;k<selected.length;k++){
    if(cancel)throw Error('cancelled');
    const page=pages[selected[k]-1],{width,height}=page.getSize(),scale=scaleForPage(width,height);
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(width*scale));canvas.height=Math.max(1,Math.ceil(height*scale));
    const ctx=canvas.getContext('2d');
    if(!ctx)throw Error('この端末では文字を描画できません。');
    ctx.scale(scale,scale);ctx.font=`${size}px sans-serif`;ctx.fillStyle=color;ctx.textBaseline='alphabetic';ctx.textAlign=position.endsWith('left')?'left':position.endsWith('right')?'right':'center';
    const margin=28,maxWidth=Math.max(20,width-margin*2),lines=wrapCanvasLines(ctx,text,maxWidth),lineHeight=size*1.4,blockHeight=lines.length*lineHeight;
    let x=ctx.textAlign==='left'?margin:ctx.textAlign==='right'?width-margin:width/2;
    let y=position.startsWith('top')?margin+size:position==='center'?(height-blockHeight)/2+size:height-margin-blockHeight+size;
    y=Math.max(size+2,Math.min(height-size,y));
    lines.forEach((line,i)=>{const baseline=y+i*lineHeight;if(baseline<=height-margin+size)ctx.fillText(line,x,baseline,maxWidth)});
    const png=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('文字画像を作成できませんでした。')),'image/png'));
    const embedded=await d.embedPng(new Uint8Array(await png.arrayBuffer()));page.drawImage(embedded,{x:0,y:0,width,height});
    canvas.width=canvas.height=1;prog(k+1,selected.length,`${selected[k]}ページに文字を追加中`);
  }
  return[{blob:new Blob([await d.save()],{type:'application/pdf'}),name:base(file.name)+'_文字入り.pdf'}];
}
async function compress(){const src=await load(file),lv=$('#level').value,c=lv==='high'?{s:2.08,q:.9}:lv==='light'?{s:1.0,q:.62}:{s:1.5,q:.78},d=await PDFLib.PDFDocument.create();for(let i=0;i<src.numPages;i++){if(cancel)break;prog(i,src.numPages,`${i+1} / ${src.numPages}ページを軽量化中`);const p=await src.getPage(i+1),renderScale=safeScale(p,c.s),v=p.getViewport({scale:renderScale}),cv=document.createElement('canvas');cv.width=Math.ceil(v.width);cv.height=Math.ceil(v.height);await p.render({canvasContext:cv.getContext('2d',{alpha:false}),viewport:v,background:'white'}).promise;const b=await new Promise((r,x)=>cv.toBlob(z=>z?r(z):x(Error('encode')),'image/jpeg',c.q)),jpg=await d.embedJpg(new Uint8Array(await b.arrayBuffer()));const pg=d.addPage([v.width,v.height]);pg.drawImage(jpg,{x:0,y:0,width:v.width,height:v.height});cv.width=cv.height=1}const blob=new Blob([await d.save()],{type:'application/pdf'});return blob.size<file.size?[{blob,name:base(file.name)+'_軽量版.pdf',original:file.size}]:[{blob:file,name:base(file.name)+'_そのまま.pdf',original:file.size,note:'元のPDFのほうが小さいため、元ファイルを保存します。'}]}
function show(rs){step(4);E.result.hidden=false;E.result.innerHTML='<h3>変換しました！</h3>'+rs.map((r,i)=>`<div class="file-row"><div><div class="file-name">${esc(r.name)}</div><div class="file-meta">${fmt(r.blob.size)}${r.original?' · 元 '+fmt(r.original):''}${r.note?' · '+esc(r.note):''}</div></div><button class="primary-button" data-i="${i}">ダウンロード</button></div>`).join('')+'<div class="actions"><a class="secondary-button" href="index.html">トップへ戻る</a></div>';E.result.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{const r=rs[+b.dataset.i],u=URL.createObjectURL(r.blob),a=document.createElement('a');a.href=u;a.download=r.name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)})}
E.title.textContent=names[tool]?.[0]||'PDFツール';E.hint.textContent=names[tool]?.[2]||'';E.pick.onclick=()=>E.input.click();E.drop.onclick=e=>{if(e.target!==E.pick)E.input.click()};E.input.onchange=e=>{setFile(e.target.files[0]);e.target.value=''};E.drop.ondragover=e=>{e.preventDefault();E.drop.classList.add('dragover')};E.drop.ondragleave=()=>E.drop.classList.remove('dragover');E.drop.ondrop=e=>{e.preventDefault();E.drop.classList.remove('dragover');setFile(e.dataTransfer.files[0])};E.drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();E.input.click()}};
