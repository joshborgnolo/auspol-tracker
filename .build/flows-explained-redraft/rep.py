S='/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/'
import re
t=open(S+'body.tpl').read()
def sub(a,b):
    global t
    assert a in t, a[:70]; t=t.replace(a,b)
sub("have produced a 2PP error of 1.1 points, almost three times greater.",
 'have produced a 2PP error of <span class="edt" title="Was 1.1. Correcting Roy Morgan&rsquo;s 1998&ndash;2004 polls (d4408671) moved the pollsters&rsquo; primary error from 1.11 to 1.22; /lef-success/ updated to match.">1.2</span> points, almost three times greater.')
# 2004 paragraph: replace from "<p>Last-election flows and respondent" to "</p>"
m=re.search(r'<p>Last-election flows and respondent-allocated.*?</p>', t, re.S); assert m
t=t.replace(m.group(0), """<p>Last-election flows and respondent-allocated flows were, in 2004, the difference between <span class="edt" title="Was &lsquo;an exceptional year (+0.4)&rsquo;. With Morgan&rsquo;s poll corrected (Coalition 45.5, not 50.5), the implied errors average +0.9 (Newspoll +1.9, ACNielsen &minus;1.2, Roy Morgan +1.9, Galaxy +1.2).">a better-than-average year for pollsters (+0.9 error)</span> and an average one (+1.5). Roy Morgan had it particularly bad: <span class="edt" title="Was: it would have been the most accurate pollster (&minus;0.5). That rested on the Nationals being counted twice in Morgan&rsquo;s figures, now fixed (d4408671).">had it used LEFs, it would have missed by +1.9; instead, it was the least accurate pollster (+3.7)</span>.<sup class="fn"><a href="#fn2" id="r2">2</a></sup></p>""")
m=re.search(r'<p>Pollsters expected <span class="chk".*?</span> of minor-party preferences to reach Labor, but only 61% did\.', t, re.S); assert m
t=t.replace(m.group(0), """<p><span class="edt" title="Was &lsquo;Pollsters expected&rsquo;. Bonham&rsquo;s 69&ndash;74% covers the three houses using respondent preferences; Galaxy used last-election flows and, per Bonham, had the best final poll. Backing the share out of each rounded published 2PP gives Newspoll 69, ACNielsen 64, Roy Morgan 78; rounding moves these a few points.">The three pollsters using respondent-allocated preferences (Newspoll, ACNielsen and Roy Morgan) expected <a href="https://kevinbonham.blogspot.com/2015/09/wonk-central-track-record-of-last.html">69&ndash;74%</a> of minor-party preferences to reach Labor</span>, but only 61% did. Galaxy, which used last-election flows, published the best final 2PP of the four.""")
t=re.sub(r'<span class="chk" title="The site\'s stored backtest[^"]*">&minus;0\.87</span>','&minus;0.87',t)
t=re.sub(r'<span class="chk" title="flow-lef\.json stores[^"]*">\+0\.82</span>','+0.82',t)
sub("""The size of this error may be put at +4.2: the published-2PP error was 4.2 points greater than the implied-2PP error. Unfortunately, this was the second time in a row Morgan tripped over this stone; in 2001 the gap was +2.6.""",
 """<span class="edt" title="Was +4.2, then &lsquo;the second time in a row &hellip; in 2001 the gap was +2.6&rsquo;. Both rested on the Nationals double-count; corrected, 2004 is +1.8 and 2001 about +0.4 (published +5.5, implied +5.0), so the &lsquo;second time&rsquo; sentence is dropped.">The size of this error may be put at +1.8: the published-2PP error was 1.8 points greater than the implied-2PP error.</span>""")
assert 'class="chk"' in t  # banner still references it
open(S+'body.tpl','w').write(t)
print('chk left:', t.count('class="chk"'))
