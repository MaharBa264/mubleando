// B12: geometría canónica, fondo piedra y zona segura maskable. Sin dependencias externas.
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
const structure = [[13,78],[13,13],[27,13],[50,44],[73,13],[87,13],[87,78],[73,78],[73,36],[50,66],[27,36],[27,78],[23,78],[23,65],[13,65]];
const brass = [[50,44],[73,13],[87,13],[50,66]];
const palette = [[239,238,235],[38,38,36],[135,97,45]];
function inside(x,y,poly) {
  let hit=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const [a,b]=poly[i], [c,d]=poly[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) hit=!hit;
  }
  return hit;
}
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcTable[(c^v)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c]);}
function png(size,file){
  const stride=Math.ceil(size/2)+1,raw=Buffer.alloc(stride*size);
  const indexed=[], indices=new Map();
  for(let b=0;b<=4;b++)for(let f=0;f<=4-b;f++){
    indices.set(`${b},${f}`,indexed.length/3);
    for(let k=0;k<3;k++)indexed.push(Math.round((palette[2][k]*b+palette[1][k]*f+palette[0][k]*(4-b-f))/4));
  }
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    let b=0,f=0;
    for(const sy of [.25,.75])for(const sx of [.25,.75]){
      const px=((x+sx)*100/size-15)/.7,py=((y+sy)*100/size-18.5)/.7;
      if(inside(px,py,brass))b++;else if(inside(px,py,structure))f++;
    }
    raw[y*stride+1+(x>>1)]|=indices.get(`${b},${f}`)<<(x%2?0:4);
  }
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=4;ihdr[9]=3;
  writeFileSync(file,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('PLTE',Buffer.from(indexed)),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));
}
const publicDir=resolve(process.argv[2]??'apps/web/public');
const appDir=resolve(process.argv[3]??'apps/web/src/app');
mkdirSync(publicDir,{recursive:true});mkdirSync(appDir,{recursive:true});
png(192,resolve(publicDir,'icon-192.png'));
png(512,resolve(publicDir,'icon-512.png'));
png(180,resolve(appDir,'apple-icon.png'));
