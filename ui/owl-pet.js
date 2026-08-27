const MAX_PUPIL_OFFSET=3;
const MAX_HEAD_TILT=5;
const MAX_HEAD_SHIFT_Y=2.4;
const SETTLE_EPSILON=0.04;
const FOLLOW_EASE=0.18;

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
  const head=stage.querySelector('.owl-layer-head');

  if(!pupils.length||!head)return null;

  stage.dataset.owlReady='true';

  const requestedRange=Number(stage.dataset.eyeRange||MAX_PUPIL_OFFSET);
  const maxOffset=clamp(Number.isFinite(requestedRange)?requestedRange:MAX_PUPIL_OFFSET,0,MAX_PUPIL_OFFSET);
  const requestedTilt=Number(stage.dataset.headTilt||MAX_HEAD_TILT);
  const maxTilt=clamp(Number.isFinite(requestedTilt)?requestedTilt:MAX_HEAD_TILT,0,MAX_HEAD_TILT);

  let targetX=0;
  let targetY=0;
  let currentX=0;
  let currentY=0;
  let targetTilt=0;
  let currentTilt=0;
  let targetHeadY=0;
  let currentHeadY=0;
  let rafId=0;
  let flapTimer=0;

  const applyTransforms=()=>{
    const x=`${currentX.toFixed(2)}px`;
    const y=`${currentY.toFixed(2)}px`;
    pupils.forEach(pupil=>{
      pupil.style.setProperty('--owl-eye-x',x);
      pupil.style.setProperty('--owl-eye-y',y);
    });
    stage.style.setProperty('--owl-head-rotate',`${currentTilt.toFixed(2)}deg`);
    stage.style.setProperty('--owl-head-y',`${currentHeadY.toFixed(2)}px`);
  };

  const animate=()=>{
    rafId=0;
    currentX+=(targetX-currentX)*FOLLOW_EASE;
    currentY+=(targetY-currentY)*FOLLOW_EASE;
    currentTilt+=(targetTilt-currentTilt)*FOLLOW_EASE;
    currentHeadY+=(targetHeadY-currentHeadY)*FOLLOW_EASE;

    if(Math.abs(targetX-currentX)<SETTLE_EPSILON)currentX=targetX;
    if(Math.abs(targetY-currentY)<SETTLE_EPSILON)currentY=targetY;
    if(Math.abs(targetTilt-currentTilt)<SETTLE_EPSILON)currentTilt=targetTilt;
    if(Math.abs(targetHeadY-currentHeadY)<SETTLE_EPSILON)currentHeadY=targetHeadY;
    applyTransforms();

    if(currentX!==targetX||currentY!==targetY||currentTilt!==targetTilt||currentHeadY!==targetHeadY){
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
      targetTilt=0;
      targetHeadY=0;
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
    targetTilt=clamp((dx/(rect.width*0.75))*maxTilt,-maxTilt,maxTilt);
    targetHeadY=clamp((dy/(rect.height*0.75))*MAX_HEAD_SHIFT_Y,-MAX_HEAD_SHIFT_Y,MAX_HEAD_SHIFT_Y);
    schedule();
  };

  const resetPose=()=>{
    targetX=0;
    targetY=0;
    targetTilt=0;
    targetHeadY=0;
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
  window.addEventListener('blur',resetPose);
  stage.addEventListener('pointerleave',resetPose);
  stage.addEventListener('click',flap);
  applyTransforms();

  return ()=>{
    window.removeEventListener('pointermove',setTargetFromPointer);
    window.removeEventListener('blur',resetPose);
    stage.removeEventListener('pointerleave',resetPose);
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

export {MAX_PUPIL_OFFSET,MAX_HEAD_TILT};
