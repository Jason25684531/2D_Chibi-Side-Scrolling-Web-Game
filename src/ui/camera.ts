import {FACE,characterIds,pose} from '../assets/catalog';
// UC03-1 custom avatar: front camera → round mirrored photo. The caller owns the stream and must close it.
// async so a missing mediaDevices (insecure context) rejects instead of throwing.
export const openCamera=async()=>navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:640,height:480},audio:false});
export const closeCamera=(stream?:MediaStream|null)=>stream?.getTracks().forEach(t=>t.stop());
export const cameraError=(e:unknown)=>{const n=(e as Error)?.name;return n==='NotAllowedError'?'未取得攝影機權限':n==='NotFoundError'?'找不到攝影機':'攝影機無法使用';};
/** Centre square of the live frame, mirrored like the preview, clipped to a circle (transparent corners). */
export function capturePhoto(video:HTMLVideoElement,size=256){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const g=canvas.getContext('2d')!,s=Math.min(video.videoWidth,video.videoHeight);
  g.beginPath();g.arc(size/2,size/2,size/2,0,Math.PI*2);g.clip();
  g.translate(size,0);g.scale(-1,1);
  g.drawImage(video,(video.videoWidth-s)/2,(video.videoHeight-s)/2,s,s,0,0,size,size);
  g.setTransform(1,0,0,1,0,0);g.lineWidth=size*.06;g.strokeStyle='#fff';g.stroke(); // inner rim keeps the face readable on any body
  return canvas.toDataURL('image/webp',.85);
}
const load=async(src:string)=>{const image=new Image();image.src=src;await image.decode();return image;};
/** Pose with the face pasted at FACE, downscaled to maxH, for every body and UI frame. */
export async function dress(photo:string,maxH=700){
  const face=await load(photo),looks:Record<string,Record<string,string>>={};
  for(const id of characterIds)for(const frame of ['idle1','attack1'] as const){
    const body=await load(pose(id,frame)),f=FACE[id][frame],k=Math.min(1,maxH/body.height),canvas=document.createElement('canvas');
    canvas.width=Math.round(body.width*k);canvas.height=Math.round(body.height*k);
    const g=canvas.getContext('2d')!,d=f.d*canvas.height;g.drawImage(body,0,0,canvas.width,canvas.height);g.drawImage(face,f.x*canvas.width-d/2,f.y*canvas.height-d/2,d,d);
    (looks[id]??={})[frame]=canvas.toDataURL('image/webp',.9);
  }
  return looks;
}
