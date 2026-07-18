import json

try:
    with open('trace_out.json') as f:
        d = json.load(f)
    
    trace = d.get('trace', [])
    steps_with_board = [s for s in trace if 'board' in s['variables']]
    
    print('Total steps:', len(trace))
    print('Steps with board:', len(steps_with_board))
    
    if steps_with_board:
        print('Type of board in first step:', steps_with_board[0]['variables']['board']['type'])
        if len(steps_with_board) > 1:
            print('Type of board in second step:', steps_with_board[1]['variables']['board']['type'])
except Exception as e:
    print(f"Error: {e}")
