S='/Users/joshuaborgnolo/auspol tracker/.build/flows-explained-redraft/'
g=open(S+'gen.py').read()
i=g.index("c19=chart('fig-2019'"); j=g.index("def sgn(")
new=open(S+'calls.txt').read().replace('@@CHART2@@', S+'chart2.py')
open(S+'gen.py','w').write(g[:i]+new+g[j:])
t=open(S+'body.tpl').read()
t=t.replace('  .flag, .chk { cursor: help; }', open(S+'sm.css').read()+'  .flag, .chk { cursor: help; }')
open(S+'body.tpl','w').write(t)
