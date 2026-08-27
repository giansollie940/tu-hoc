function quoteKey(quote){
  return String(quote?.id||quote?.text||'').trim().toLocaleLowerCase('vi');
}

function normalizeQuotes(items=[]){
  const seen=new Set();
  const result=[];
  for(const item of items){
    const text=String(item?.text||'').trim();
    if(!text)continue;
    const normalized={...item,text,author:String(item?.author||'Khuyết danh').trim()||'Khuyết danh'};
    const key=quoteKey(normalized);
    if(!key||seen.has(key))continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

export function createQuoteRotator(baseQuotes=[],{recentLimit=4}={}){
  const base=normalizeQuotes(baseQuotes);
  let cursor=0;
  let recent=[];

  function next(extraQuotes=[]){
    const pool=normalizeQuotes([...(Array.isArray(extraQuotes)?extraQuotes:[]),...base]);
    if(!pool.length)return {text:'Mỗi ngày học một điều mới là một bước tiến.',author:'Cú Thông Thái'};
    const maxRecent=Math.min(Math.max(0,Number(recentLimit)||0),Math.max(0,pool.length-1));
    const blocked=new Set(recent.slice(-maxRecent));
    let selectedIndex=-1;
    for(let offset=0;offset<pool.length;offset++){
      const index=(cursor+offset)%pool.length;
      if(!blocked.has(quoteKey(pool[index]))){selectedIndex=index;break;}
    }
    if(selectedIndex<0)selectedIndex=cursor%pool.length;
    const selected=pool[selectedIndex];
    cursor=(selectedIndex+1)%pool.length;
    recent=[...recent,quoteKey(selected)].slice(-maxRecent);
    return selected;
  }

  function reset(){cursor=0;recent=[];}
  return {next,reset};
}
