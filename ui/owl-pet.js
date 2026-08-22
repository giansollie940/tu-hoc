const MAX_PUPIL_OFFSET=3;
const SETTLE_EPSILON=0.04;
const FOLLOW_EASE=0.22;

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

function prefersReducedMotion(){
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
}

function bindOwlStage(stage){
  if(!stage||stage.dataset.owlReady==='true')return null;

  const pupils=[
    stage.querySelector('.owl-layer-pupil-left'),
    stage.querySelector('.owl-layer-pupil-right')
  ].filter(Boolean);

  if(!pupils.length)return null;

  stage.dataset.owlReady='true';

  const requestedRange=Number(stage.dataset.eyeRange||MAX_PUPIL_OFFSET);
  const maxOffset=clamp(Number.isFinite(requestedRange)?requestedRange:MAX_PUPIL_OFFSET,0,MAX_PUPIL_OFFSET);
  let targetX=0;
  let targetY=0;
  let currentX=0;
  let currentY=0;
  let rafId=0;
  let flapTimer=0;

  const applyPupilOffset=()=>{
    const x=`${currentX.toFixed(2)}px`;
    const y=`${currentY.toFixed(2)}px`;
    pupils.forEach(pupil=>{
      pupil.style.setProperty('--owl-eye-x',x);
      pupil.style.setProperty('--owl-eye-y',y);
    });
  };

  const animate=()=>{
    rafId=0;
    currentX+=(targetX-currentX)*FOLLOW_EASE;
    currentY+=(targetY-currentY)*FOLLOW_EASE;

    if(Math.abs(targetX-currentX)<SETTLE_EPSILON)currentX=targetX;
    if(Math.abs(targetY-currentY)<SETTLE_EPSILON)currentY=targetY;
    applyPupilOffset();

    if(currentX!==targetX||currentY!==targetY){
      rafId=requestAnimationFrame(animate);
    }
  };

  const schedule=()=>{
    if(!rafId)rafId=requestAnimationFrame(animate);
  };

  const setTargetFromPointer=(event)=>{
    if(prefersReducedMotion()){
      targetX=0;
      targetY=0;
      schedule();
      return;
    }

    const rect=stage.getBoundingClientRect();
    if(!rect.width||!rect.height)return;

    const centerX=rect.left+rect.width/2;
    const centerY=rect.top+rect.height/2;
    const dx=event.clientX-centerX;
    const dy=event.clientY-centerY;
    const radius=Math.max(rect.width,rect.height)*0.62;
    const length=Math.hypot(dx,dy)||1;
    const magnitude=clamp(length/radius,0,1);
    const unitX=dx/length;
    const unitY=dy/length;

    targetX=unitX*maxOffset*magnitude;
    targetY=unitY*maxOffset*magnitude;
    schedule();
  };

  const resetEyes=()=>{
    targetX=0;
    targetY=0;
    schedule();
  };

  const flap=()=>{
    if(prefersReducedMotion())return;
    clearTimeout(flapTimer);
    stage.classList.remove('owl-stage-flap');
    void stage.offsetWidth;
    stage.classList.add('owl-stage-flap');
    flapTimer=window.setTimeout(()=>stage.classList.remove('owl-stage-flap'),720);
  };

  window.addEventListener('pointermove',setTargetFromPointer,{passive:true});
  window.addEventListener('blur',resetEyes);
  stage.addEventListener('pointerleave',resetEyes);
  stage.addEventListener('click',flap);
  applyPupilOffset();

  return ()=>{
    window.removeEventListener('pointermove',setTargetFromPointer);
    window.removeEventListener('blur',resetEyes);
    stage.removeEventListener('pointerleave',resetEyes);
    stage.removeEventListener('click',flap);
    clearTimeout(flapTimer);
    if(rafId)cancelAnimationFrame(rafId);
    stage.dataset.owlReady='false';
  };
}

export function initOwlPet(root=document){
  const stages=[...root.querySelectorAll?.('[data-owl-stage]')||[]];
  if(root.matches?.('[data-owl-stage]'))stages.unshift(root);
  const cleanups=stages.map(bindOwlStage).filter(Boolean);

  return {
    destroy(){
      cleanups.forEach(cleanup=>cleanup());
    }
  };
}

export {MAX_PUPIL_OFFSET};
