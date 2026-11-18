// Player photo for the ComfyUI workflow: front camera, centre square, NOT mirrored. The preview is mirrored by CSS only.
// The caller owns the stream and must close it. async so a missing mediaDevices (insecure context) rejects instead of throwing.
export const openCamera=async()=>navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1920},height:{ideal:1080}},audio:false});
export const closeCamera=(stream?:MediaStream|null)=>stream?.getTracks().forEach(t=>t.stop());
export const cameraError=(e:unknown)=>{const n=(e as Error)?.name;return n==='NotAllowedError'?'未取得攝影機權限':n==='NotFoundError'?'找不到攝影機':'攝影機無法使用';};
/** Centre square of the live frame as a size×size PNG object URL; the caller revokes it. */
export async function capturePhoto(video:HTMLVideoElement,size=1024){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const s=Math.min(video.videoWidth,video.videoHeight);
  canvas.getContext('2d')!.drawImage(video,(video.videoWidth-s)/2,(video.videoHeight-s)/2,s,s,0,0,size,size);
  const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/png'));
  if(!blob)throw new Error('capture failed');
  return URL.createObjectURL(blob);
}
