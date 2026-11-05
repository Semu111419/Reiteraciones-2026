import subprocess
import time
import json
import urllib.request
import urllib.error

# Launch Edge with remote debugging
proc = subprocess.Popen([
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    '--headless',
    '--disable-gpu',
    '--remote-debugging-port=9222',
    'http://localhost:8000'
])

time.sleep(2)

try:
    # Get WebSocket debugger URL
    tabs = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
    ws_url = tabs[0]['webSocketDebuggerUrl']
    print("Edge opened, tab ws:", ws_url)
finally:
    proc.terminate()
