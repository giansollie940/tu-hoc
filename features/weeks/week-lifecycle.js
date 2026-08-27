const DEFAULT_OFFSET='+07:00';

function addDaysISO(iso,days){
  const date=new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate()+Number(days||0));
  return date.toISOString().slice(0,10);
}

function localTimestamp(dateISO,time='00:00',offset=DEFAULT_OFFSET){
  if(!dateISO)return NaN;
  const normalized=/^\d{2}:\d{2}$/.test(String(time))?String(time):'00:00';
  return new Date(`${dateISO}T${normalized}:00${offset}`).getTime();
}

function weekStartTimestamp(week,offset){
  return localTimestamp(week?.startDate,'00:00',offset);
}

function fallbackWeekEndTimestamp(week,offset){
  const endDate=week?.endDate||addDaysISO(week?.startDate,4);
  return localTimestamp(endDate,'23:59',offset)+59999;
}

export function getWeekLastSessionEnd({week,slots=[],periods=[],timeZoneOffset=DEFAULT_OFFSET}={}){
  if(!week)return NaN;
  const periodByNumber=new Map((periods||[]).map(item=>[Number(item.n),item]));
  const times=(slots||[]).map(slot=>{
    const period=periodByNumber.get(Number(slot?.period));
    if(!period?.end)return NaN;
    const date=addDaysISO(week.startDate,Number(slot?.dow||0));
    return localTimestamp(date,period.end,timeZoneOffset);
  }).filter(Number.isFinite);
  return times.length?Math.max(...times):fallbackWeekEndTimestamp(week,timeZoneOffset);
}

export function getWeekLifecycle({weeks=[],periods=[],getSlots=()=>[],nowMs=Date.now(),timeZoneOffset=DEFAULT_OFFSET}={}){
  const ordered=[...(weeks||[])].filter(Boolean).sort((a,b)=>
    String(a.startDate||'').localeCompare(String(b.startDate||''))||Number(a.number||0)-Number(b.number||0)
  );
  const statuses={};
  if(!ordered.length)return {currentWeekId:null,statuses,nextBoundaryMs:null};

  const firstStart=weekStartTimestamp(ordered[0],timeZoneOffset);
  if(Number.isFinite(firstStart)&&nowMs<firstStart){
    ordered.forEach(week=>{statuses[week.id]='upcoming';});
    return {currentWeekId:null,statuses,nextBoundaryMs:firstStart};
  }

  const endTimes=ordered.map(week=>getWeekLastSessionEnd({
    week,
    slots:getSlots(week.id)||[],
    periods,
    timeZoneOffset
  }));
  const currentIndex=endTimes.findIndex(end=>Number.isFinite(end)&&nowMs<end);

  ordered.forEach((week,index)=>{
    if(currentIndex<0)statuses[week.id]='locked';
    else if(index<currentIndex)statuses[week.id]='locked';
    else if(index===currentIndex||index===currentIndex+1)statuses[week.id]='open';
    else statuses[week.id]='upcoming';
  });

  return {
    currentWeekId:currentIndex>=0?ordered[currentIndex].id:null,
    statuses,
    nextBoundaryMs:currentIndex>=0?endTimes[currentIndex]:null
  };
}
