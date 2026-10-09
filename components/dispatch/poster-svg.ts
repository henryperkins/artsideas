import type { PosterData } from '../../lib/domain/domain.ts';
import { POSTER_FONT, GLYPH_ADVANCES } from './poster-font.ts';

function xml(text:string):string { return text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!)); }
function textWidth(text:string,size:number):number { return [...text].reduce((sum,c)=>sum+(GLYPH_ADVANCES[c]??0.65),0)*size; }
function wrap(text:string,size:number,width:number):string[] {
 const words=text.trim().split(/\s+/); const lines:string[]=[];let line='';
 for(const word of words){
  if(line && textWidth(`${line} ${word}`,size)>width){ lines.push(line);line=''; }
  if(textWidth(word,size)>width){
   let part='';for(const c of word){ if(part && textWidth(part+c,size)>width){lines.push(part);part='';}part+=c; }line=part;
  }else line=line?`${line} ${word}`:word;
 }
 if(line)lines.push(line);return lines;
}
function fit(text:string,width:number,height:number,start:number,min:number,leading=1.04):{lines:string[];size:number} {
 let size=start;while(size>min){const lines=wrap(text,size,width);if(lines.length*size*leading<=height)return{lines,size};size-=2;}
 const lines=wrap(text,size,width);if(lines.length*size*leading>height)size=Math.max(8,size*height/(lines.length*size*leading));
 return {lines:wrap(text,size,width),size};
}
function block(lines:string[],x:number,y:number,size:number,color:string,leading=1.04):string {
 return lines.map((line,i)=>`<text x="${x}" y="${+(y+i*size*leading).toFixed(2)}" font-size="${+size.toFixed(2)}" textLength="${+textWidth(line,size).toFixed(2)}" lengthAdjust="spacingAndGlyphs" fill="${color}">${xml(line)}</text>`).join('');
}
/** Preview and export share exact facts, layout and a self-contained font. No external image requests. */
export function posterSvg(data:PosterData):string {
 const width=1080;const height=data.height===1350?1350:1080;
 const colors={blue:'#2250d6',yellow:'#f4b714',teal:'#0f6e6e',red:'#c41e17'};
 const accent=colors[data.template]??colors.blue;
 const titleColor=data.template==='yellow'?'#1a1a1a':accent;
 const title=fit(data.title,948,height*.49,176,80);
 const speaker=fit(data.speaker??'Arts & Ideas',940,130,54,32);
 const details=fit(data.details.join(' · '),944,(height-144)-height*.795-10,34,18,1.15);
 const titleTop=70+title.size*.83;
 const speakerTop=Math.max(height*.63, titleTop+(title.lines.length-1)*title.size*1.04+70);
 const detailTop=height*.795;
 const footerTop=height-99;
 const rings=speaker.lines.length===1?`<circle cx="948" cy="${height*.725}" r="48" stroke="${accent}" stroke-width="5" fill="none"/><circle cx="938" cy="${height*.725+18}" r="48" stroke="${accent}" stroke-width="5" fill="none"/>`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="poster-title poster-description"><title id="poster-title">${xml(data.title)}</title><desc id="poster-description">${xml(data.altText)}</desc><defs><style>@font-face{font-family:DispatchPoster;src:url(data:font/woff2;base64,${POSTER_FONT}) format('woff2');font-weight:500 900}text{font-family:DispatchPoster,Arial,sans-serif;font-weight:900;letter-spacing:-1px}</style></defs><rect width="1080" height="${height}" fill="#f3eddc"/><rect x="20" y="20" width="1040" height="${height-40}" fill="none" stroke="#1a1a1a" stroke-width="4"/><rect x="867" y="58" width="150" height="150" fill="#f4b714"/>${block(title.lines,62,titleTop,title.size,titleColor)}<path d="M62 ${speakerTop-54}H1017" stroke="#1a1a1a" stroke-width="4"/>${block(speaker.lines,62,speakerTop,speaker.size,'#1a1a1a')}${rings}${block(details.lines,62,detailTop,details.size,'#1a1a1a',1.15)}<path d="M62 ${footerTop-45}H1017" stroke="#1a1a1a" stroke-width="4"/>${block(['NEW ORLEANS','ARTS & IDEAS FESTIVAL'],62,footerTop,35,'#1a1a1a',1.17)}<rect x="898" y="${footerTop-5}" width="119" height="47" fill="${accent}"/></svg>`;
}
