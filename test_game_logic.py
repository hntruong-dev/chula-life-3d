"""Standalone smoke test for the shared Python student-life rules."""
from pathlib import Path
import json

namespace = {}
exec(Path(__file__).parent.joinpath('public/game_logic.py').read_text(), namespace)
Game = namespace['StudentLife']

g = Game()
assert g.state()['floor'] == 1
assert g.state()['time'] == '08:00'
assert len(g.state()['tasks']) == 6
assert g.state()['done_count'] == 0
assert 'not available' not in json.loads(g.go_to_floor(4))['message']
assert g.state()['floor'] == 4
assert g.state()['floor_name'] == 'COLLECTIONS & QUIET STUDY'
assert 'Only public-access' in json.loads(g.go_to_floor(7))['message']
assert g.state()['floor'] == 4
for action in ['checkin','coffee','book','study','friend','print']:
    result = json.loads(g.interact(action))
    assert 'state' in result
assert g.state()['done_count'] == 6
assert g.state()['research'] > 0
assert g.state()['money'] == 405
before = g.state()['time']
for _ in range(50):
    g.tick(0.25)
assert g.state()['time'] != before
assert json.loads(g.finish_day())['score'] >= 0
print('PASS: Python gameplay smoke test')
