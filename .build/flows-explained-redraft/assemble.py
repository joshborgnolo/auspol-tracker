import json
S='/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/'
d=json.load(open(S+'parts.json')); t=open(S+'body.tpl').read()
for k,v in d.items(): t=t.replace('{{'+k+'}}',v)
t=t.replace('id="fn5"','id="fn4"').replace('href="#fn5" id="r5">5<','href="#fn4" id="r4">4<').replace('href="#r5"','href="#r4"')
open(S+'flows-explained-draft.html','w').write(open(S+'head.html').read()+'\n<body>\n'+t)
