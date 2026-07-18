import json

with open('trace_out.json', encoding='utf-16') as f:
    d = json.load(f)

trace = d.get('trace', [])
steps = [s for s in trace if s.get('function') == 'solve']
if steps:
    v = steps[0]['variables']
    print(v['board'])
