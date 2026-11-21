const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '../..');
const Babel = require(path.join(root, '.build/newtracker/vendor/babel-standalone.js'));
const css = fs.readFileSync(path.join(__dirname, 'compact.css'), 'utf8');
const overrides = {};
for (const name of ['rd-allpolls','rd-cycles']) {
  overrides[name] = Babel.transform(fs.readFileSync(path.join(root, '.build/newtracker/assets', name+'.jsx'),'utf8'), {
    presets: [['react',{runtime:'classic'}]], babelrc:false,configFile:false,comments:false
  }).code;
}
function dataURL(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error('Missing asset '+rel);
  const ext = path.extname(file);
  const mime = {'.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'}[ext] || 'application/octet-stream';
  return 'data:'+mime+';base64,'+fs.readFileSync(file).toString('base64');
}
for (const name of ['allpolls','cycles']) {
  let html = fs.readFileSync(path.join(root,name,'index.html'),'utf8');
  html = html.replace(/<link\b[^>]*rel="preload"[^>]*>/g,'');
  html = html.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (_,src) => {
    const file = path.resolve(root,name,src);
    const base = path.basename(file).replace(/\.[a-f0-9]{8}\.js$/, '');
    const code = overrides[base] || fs.readFileSync(file,'utf8');
    return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';
  });
  // Embed fonts, artwork and lazily read JSON so the file works from disk.
  html = html.replace(/https?:\/\/[^\s"'<>]+|(?:\.\.\/|\/)?(assets\/[A-Za-z0-9_./-]+\.(?:woff2|svg|png|json))/g, (whole, rel) => {
    if (!rel) return whole; // Leave remote links intact, including citations.
    return dataURL(rel);
  });
  html = html.replace('</head>', '<style>'+css+'</style></head>');
  html = html.replace('<title>', '<title>Compact preview · ');
  fs.writeFileSync(path.join(__dirname,name+'.html'),html);
  console.log(name+'.html: '+(Buffer.byteLength(html)/1048576).toFixed(1)+' MB');
}
