(()=>{
  const STORAGE_KEY="so-tu-hoc:theme:v1";
  const root=document.documentElement;
  const systemQuery=window.matchMedia?.("(prefers-color-scheme: dark)");
  const themeMeta=document.querySelector('meta[name="theme-color"]');

  const readStored=()=>{
    try{
      const value=localStorage.getItem(STORAGE_KEY);
      return value==="dark"||value==="light"?value:null;
    }catch{return null;}
  };

  const systemTheme=()=>systemQuery?.matches?"dark":"light";
  const resolveTheme=()=>readStored()||systemTheme();

  const apply=(theme,{persist=false,notify=true}={})=>{
    const value=theme==="dark"?"dark":"light";
    root.dataset.theme=value;
    root.style.colorScheme=value;
    if(themeMeta)themeMeta.setAttribute("content",value==="dark"?"#111827":"#6B48DF");
    if(persist){
      try{localStorage.setItem(STORAGE_KEY,value);}catch{}
    }
    if(notify){
      window.dispatchEvent(new CustomEvent("themechange",{detail:{theme:value,persisted:Boolean(readStored())}}));
    }
    return value;
  };

  const toggle=()=>apply(root.dataset.theme==="dark"?"light":"dark",{persist:true});
  const clear=()=>{
    try{localStorage.removeItem(STORAGE_KEY);}catch{}
    return apply(systemTheme());
  };

  window.ThemePreference={STORAGE_KEY,readStored,resolveTheme,apply,toggle,clear};
  apply(resolveTheme(),{notify:false});

  const followSystem=event=>{
    if(!readStored())apply(event.matches?"dark":"light");
  };
  if(systemQuery?.addEventListener)systemQuery.addEventListener("change",followSystem);
  else systemQuery?.addListener?.(followSystem);
})();
