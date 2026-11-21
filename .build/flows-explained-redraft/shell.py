import json,re
R='/Users/joshuaborgnolo/auspol tracker/'
S='/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/'
shell=open(R+'lef-success/index.html').read()
i=shell.index('<main id="sh-content"'); j=shell.index('</main>')+len('</main>')
head,foot=shell[:i],shell[j:]
head=re.sub(r'<title>.*?</title>','<title>Preference flows explained – auspol tracker (draft)</title>',head,flags=re.S)
head=re.sub(r'<!--.*?-->','',head,count=1,flags=re.S)  # drop the lef-success page comment
t=open(S+'body.tpl').read()
d=json.load(open(S+'parts.json'))
for k,v in d.items(): t=t.replace('{{'+k+'}}',v)
t=t.replace('id="fn5"','id="fn4"').replace('href="#fn5" id="r5">5<','href="#fn4" id="r4">4<').replace('href="#r5"','href="#r4"')
style=t[t.index('<style>')+7:t.index('</style>')]
banner=re.search(r'<div class="draft-banner">.*?</div>',t,re.S).group(0)
body=t[t.index('</p>',t.index('class="dr-head"'))+4:t.rindex('</div>\n</article>')]
title=re.search(r'<h1>(.*?)</h1>',t).group(1)
sub=re.search(r'<p class="ss-sub">(.*?)</p>',t).group(1)
hed=re.search(r'<p class="dr-head">(.*?)</p>',t).group(1)
party='''
:root { --alp: oklch(0.55 0.150 27); --lnp: oklch(0.50 0.095 250); --grn: oklch(0.60 0.120 150); --onp: oklch(0.66 0.130 58); --oth: oklch(0.64 0.018 70); --alp-text: var(--alp); --lnp-text: var(--lnp); --grn-text: oklch(0.52 0.120 150); --onp-text: oklch(0.52 0.130 58); --oth-text: oklch(0.52 0.018 70); }
@media (prefers-color-scheme: dark) { :root:not(.sh-light) { --alp: oklch(0.660 0.165 28); --lnp: oklch(0.680 0.130 252); --grn: oklch(0.720 0.135 152); --onp: oklch(0.760 0.135 64); --oth: oklch(0.700 0.018 72); --alp-text: var(--alp); --lnp-text: var(--lnp); --grn-text: var(--grn); --onp-text: var(--onp); --oth-text: var(--oth); } }
:root.sh-dark { --alp: oklch(0.660 0.165 28); --lnp: oklch(0.680 0.130 252); --grn: oklch(0.720 0.135 152); --onp: oklch(0.760 0.135 64); --oth: oklch(0.700 0.018 72); --alp-text: var(--alp); --lnp-text: var(--lnp); --grn-text: var(--grn); --onp-text: var(--onp); --oth-text: var(--oth); }
.draft-banner { position: static !important; margin: 0 0 18px; border-radius: 6px; }
.ex-body sup.fn a { border: 0; }
.sh-page > .ex-body { max-width: 760px; margin-top: 22px; }
.sh-page > .ex-body > p, .sh-page > .ex-body > blockquote, .sh-page > .ex-body > .ex-tnote { max-width: 66ch; }
'''
head=head.replace('<!--/shell:head-->','<style>'+party+style+'</style>\n<!--/shell:head-->')
main=f'''<main id="sh-content" class="sh-page">
  {banner}
  <header>
    <div class="sh-arow">
      <h1 class="sh-atitle">{title}</h1>
      <span class="sh-ameta">{sub}</span>
    </div>
    <p class="sh-hed">{hed}</p>
  </header>
  <div class="ex-body">
{body}
  </div>
</main>'''
out=head+main+foot
F='file://'+R
out=out.replace('"/assets/','"'+F+'assets/').replace("url(/assets/","url("+F+"assets/")
open(S+'flows-explained-draft.html','w').write(out)
