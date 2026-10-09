import test from 'node:test';
import assert from 'node:assert/strict';
import { posterSvg } from '../components/dispatch/poster-svg.ts';
import type { PosterData } from '../lib/domain/domain.ts';

const data: PosterData = { width:1080,height:1080,template:'blue',paper:'#f3eddc',ink:'#1a1a1a',accent:'#2250d6',festival:'New Orleans Arts & Ideas Festival',title:'Analog Intelligence Since 1440',speaker:'Joseph Makkos',details:['November 12, 2026'],photoUrl:null,altText:'Letterpress workshop graphic with title and speaker.' };
const visibleText=(svg:string)=>[...svg.matchAll(/<text\b[^>]*>([^<]*)<\/text>/g)].map(m=>m[1].replace(/&amp;/g,'&')).join(' ');
test('standalone graphic preserves exact reviewed facts and export dimensions',()=>{
 const svg=posterSvg(data);
 assert.match(svg,/width="1080" height="1080"/);
 assert.match(svg,/Analog/);assert.match(svg,/Intelligence/);assert.match(svg,/Since 1440/);
 assert.match(svg,/Joseph Makkos/);assert.match(svg,/November 12, 2026/);
 assert.match(svg,/Letterpress workshop graphic with title and speaker\./);
 assert.match(svg,/data:font\/woff2;base64,/);
 assert.doesNotMatch(svg,/https?:\/\/[^\s"]+\.(?:woff2|ttf)/);
});
test('graphic treats markup and quoted source strings as plain text',()=>{
 const svg=posterSvg({...data,title:'<script>alert("bad")</script>',speaker:'A & B',altText:'"Quoted" <image href="x" />'});
 assert.doesNotMatch(svg,/<script|<image/);
 assert.match(svg,/&lt;script&gt;/);assert.match(svg,/A &amp; B/);assert.match(svg,/&quot;Quoted&quot;/);
});
test('long Unicode titles and venue strings fit with complete factual text',()=>{
 const svg=posterSvg({...data,height:1350,title:'The Intentional Page: A Device-Free Writing Practice for Reclaiming Your Attention',speaker:'Marcus Rosser & Kaylon Seaberry',details:['November 13, 2026','3:30 PM · New Orleans local time','Education Center • 400 Esplanade Ave']});
 assert.match(svg,/height="1350"/);assert.match(svg,/Intentional/);assert.match(svg,/Attention/);
 assert.ok(visibleText(svg).includes('Marcus Rosser & Kaylon Seaberry'));assert.ok(visibleText(svg).includes('400 Esplanade Ave'));
 const textYs=[...svg.matchAll(/<text[^>]+y="([0-9.]+)"/g)].map(m=>Number(m[1]));
 assert.ok(textYs.length>0);assert.ok(textYs.every(y=>y>=50&&y<1350));
});
test('export constrains every text line when a viewer substitutes the embedded font',()=>{
 const svg=posterSvg({...data,title:'Analog Intelligence Since 1440: A Hands-On Letterpress Workshop'});
 const textNodes=[...svg.matchAll(/<text\b([^>]+)>/g)];
 assert.ok(textNodes.length>3);
 for(const [,attrs] of textNodes){assert.match(attrs,/lengthAdjust="spacingAndGlyphs"/);const match=/textLength="([0-9.]+)"/.exec(attrs);assert.ok(match);assert.ok(Number(match[1])<=948);}
});
