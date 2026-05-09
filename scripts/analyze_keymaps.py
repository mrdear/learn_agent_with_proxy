import json
import xml.etree.ElementTree as ET
import os

def parse_air_chord(chord):
    inputs = chord.get('inputs', [])
    res = []
    for inp in inputs:
        mods_str = inp.get('modifiers', '')
        key_raw = inp.get('keyCode', '')
        key = key_raw.replace('[]', '')
        
        mods = mods_str.split('-') if mods_str else []
        normalized_mods = []
        for m in mods:
            m = m.lower()
            if m == 'meta': m = 'cmd'
            if m: normalized_mods.append(m)
        
        if normalized_mods:
            res.append(f"{'-'.join(sorted(normalized_mods))}-{key.lower()}")
        else:
            res.append(key.lower())
    return '+'.join(res)

# Load Air Keymap
air_path = '/Users/quding/Library/Application Support/JetBrains/Air/localStorage/keymap.0.json'
air_keymap = {}
if os.path.exists(air_path):
    with open(air_path, 'r') as f:
        data = json.load(f)
        for entry in data:
            trigger = entry.get('trigger')
            chord = entry.get('chord')
            if trigger and chord:
                key_str = parse_air_chord(chord)
                if trigger not in air_keymap:
                    air_keymap[trigger] = []
                air_keymap[trigger].append(key_str)

# Load IDEA Keymap
idea_path = '/Users/quding/Library/Application Support/JetBrains/IntelliJIdea2026.1/keymaps/Mac OS X copy.xml'
idea_keymap = {}
if os.path.exists(idea_path):
    tree = ET.parse(idea_path)
    root = tree.getroot()
    for action in root.findall('action'):
        action_id = action.get('id')
        shortcuts = []
        for shortcut in action.findall('keyboard-shortcut'):
            ks = shortcut.get('first-keystroke')
            if ks:
                # Normalize IDEA keystroke to Air format
                parts = ks.lower().split(' ')
                mods = []
                key = ''
                for p in parts:
                    if p in ['meta', 'alt', 'shift', 'ctrl']:
                        if p == 'meta': p = 'cmd'
                        mods.append(p)
                    else:
                        key = p
                # Handle special key names
                if key.startswith('digit'): key = key[5:]
                if key == 'back_space': key = 'backspace'
                if key == 'enter': key = 'return'
                
                if mods:
                    shortcuts.append(f"{'-'.join(sorted(mods))}-{key}")
                else:
                    shortcuts.append(key)
        idea_keymap[action_id] = shortcuts

# Comparison Mapping (Air Trigger -> IDEA Action ID)
mapping = {
    'editor/duplicate-line': 'EditorDuplicateLines',
    'editor/delete-line': 'EditorDeleteLine',
    'goto/declaration': 'GotoDeclaration',
    'goto/implementation': 'GotoImplementation',
    'git/branches': 'Git.Branches',
    'terminal/toggle': 'ActivateTerminalToolWindow',
    'search/everywhere': 'SearchEverywhere',
    'action/find': 'Find',
    'search/recent-files': 'RecentFiles',
    'search/actions': 'GotoAction',
    'project/toggle-sidebar': 'ActivateProjectToolWindow',
    'editor/move-line-up': 'MoveStatementUp',
    'editor/move-line-down': 'MoveStatementDown',
}

print(f"{'Air Trigger':<30} | {'Air Keys':<20} | {'IDEA Action':<30} | {'IDEA Keys'}")
print("-" * 120)
for air_trig, idea_act in mapping.items():
    air_keys = air_keymap.get(air_trig, ['N/A'])
    idea_keys = idea_keymap.get(idea_act, ['N/A'])
    print(f"{air_trig:<30} | {str(air_keys):<20} | {idea_act:<30} | {str(idea_keys)}")

