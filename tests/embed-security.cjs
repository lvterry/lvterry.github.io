const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('_includes/open-embed.html', 'utf8').split('<script>')[1].split('</script>')[0];
function element(tag) {
  return { tagName: tag.toUpperCase(), children: [], appendChild(child) { this.children.push(child); },
    replaceChildren(...children) { this.children = children; },
    set innerHTML(_) { throw new Error('HTML string injection sink used'); } };
}
function paragraph(href) {
  const p = element('p'); p.textContent = 'link';
  p.children = [{ tagName: 'A', textContent: 'link', getAttribute: () => href }];
  return p;
}
let paragraphs = [], requests = [], response;
const context = vm.createContext({ URL, document: {
  baseURI: 'https://www.wangyazhou.com/post',
  getElementsByTagName: () => paragraphs,
  createElement: element, createTextNode: text => ({ textContent: text })
}, fetch: async url => { requests.push(url); return { ok: true, json: async () => response }; } });
vm.runInContext(source, context);
(async () => {
  assert.equal(context.get_youtube_id('https://youtu.be/abcdefghijk'), 'abcdefghijk');
  assert.equal(context.get_youtube_id('https://youtube.com.evil.test/watch?v=abcdefghijk'), null);
  assert.equal(context.parse_url('javascript:alert(1)'), null);
  paragraphs = [paragraph('https://youtube.com/watch?v=abcdefghijk&start=12&loop=1')];
  context.video_embed();
  let src = new URL(paragraphs[0].children[0].children[0].src);
  assert.equal(src.searchParams.get('start'), '12');
  assert.equal(src.searchParams.get('playlist'), 'abcdefghijk');
  paragraphs = [paragraph('https://youtube.com/watch?v=abcdefghijk&start=%22%3E%3Cscript%3E')];
  context.video_embed();
  assert.equal(new URL(paragraphs[0].children[0].children[0].src).searchParams.has('start'), false);
  paragraphs = [paragraph('https://example.com/song.mp3?loop=1&controls=0')];
  context.mp3_embed();
  assert.equal(paragraphs[0].children[0].tagName, 'AUDIO');
  assert.equal(paragraphs[0].children[0].controls, false);
  assert.equal(paragraphs[0].children[0].loop, true);
  const p = paragraph('https://vimeo.com/123');
  response = { video_id: '123\"><script>alert(1)</script>' };
  context.vimeo_embed('https://vimeo.com/123', p);
  await new Promise(setImmediate);
  assert.equal(p.children[0].tagName, 'A');
  response = { video_id: 123 };
  context.vimeo_embed('https://vimeo.com/123?autoplay=1', p);
  await new Promise(setImmediate);
  assert.equal(p.children[0].children[0].src, 'https://player.vimeo.com/video/123/?byline=0&title=0&portrait=0&autoplay=1');
  const count = requests.length;
  context.vimeo_embed('https://vimeo.com.evil.test/123', p);
  assert.equal(requests.length, count);
  console.log('Embed security regression checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
