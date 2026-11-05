import asyncio
import json
import subprocess
import time
import urllib.request
import websockets
import base64
import os

async def main():
    proc = subprocess.Popen([
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        '--headless',
        '--disable-gpu',
        '--remote-debugging-port=9222',
        '--window-size=1280,880',
        'http://localhost:8000'
    ])
    try:
        await asyncio.sleep(2)
        tabs = json.loads(urllib.request.urlopen('http://localhost:9222/json').read())
        ws_url = tabs[0]['webSocketDebuggerUrl']
        
        async with websockets.connect(ws_url) as ws:
            msg_id = 1
            async def send_cmd(method, params=None):
                nonlocal msg_id
                cid = msg_id
                msg_id += 1
                await ws.send(json.dumps({'id': cid, 'method': method, 'params': params or {}}))
                while True:
                    data = await ws.recv()
                    resp = json.loads(data)
                    if resp.get('id') == cid:
                        if 'error' in resp:
                            print("CDP error:", resp['error'])
                        return resp.get('result', {})

            # Enable Page
            await send_cmd('Page.enable')
            await asyncio.sleep(1)

            # Evaluate initial state
            res = await send_cmd('Runtime.evaluate', {
                'expression': '''JSON.stringify({
                    sec: window.reiteracionesApp ? window.reiteracionesApp.stateStore.getState().section : null,
                    tempo: document.getElementById('tempo-val') ? document.getElementById('tempo-val').textContent : null,
                    tabs: Array.from(document.querySelectorAll('.section-tab')).map(b => ({
                        sec: b.dataset.sec,
                        disabled: b.disabled
                    }))
                })''',
                'returnByValue': True
            })
            val = json.loads(res.get('result', {}).get('value', '{}'))
            print("Initial state check:", val)

            # Trigger sample and analysis
            await send_cmd('Runtime.evaluate', {
                'expression': '''(() => {
                    document.getElementById('btn-sample-violin').click();
                    setTimeout(() => {
                        document.getElementById('btn-analyze').click();
                    }, 300);
                })()'''
            })

            # Wait 2.5 seconds for spectral analysis and score generation
            await asyncio.sleep(2.5)

            # Check post-capture state
            res2 = await send_cmd('Runtime.evaluate', {
                'expression': '''JSON.stringify((() => {
                    const sec = window.reiteracionesApp.stateStore.getState().section;
                    const tempo = document.getElementById('tempo-val').textContent;
                    const tabs = Array.from(document.querySelectorAll('.section-tab')).map(b => ({
                        sec: b.dataset.sec,
                        disabled: b.disabled
                    }));
                    
                    const scoreSvg = document.querySelector('.score-viewport svg');
                    const allTexts = scoreSvg ? Array.from(scoreSvg.querySelectorAll('text')).map(t => ({
                        text: t.textContent,
                        y: t.getAttribute('y'),
                        font: t.getAttribute('font-family'),
                        size: t.getAttribute('font-size')
                    })) : [];

                    // Advance one note to test active note
                    window.reiteracionesApp.performanceEngine.nextEvent();
                    const activeNote = document.querySelector('.active-score-note');

                    return { sec, tempo, tabs, allTexts, hasActiveNote: !!activeNote };
                })())''',
                'returnByValue': True
            })
            val2 = json.loads(res2.get('result', {}).get('value', '{}'))
            print("After audio capture check:")
            print("  Section:", val2.get('sec'))
            print("  Tempo:", val2.get('tempo'))
            print("  Has active note:", val2.get('hasActiveNote'))
            print("  SVG texts in score:", val2.get('allTexts'))
            print("  Unlocked tabs count:", len([t for t in val2.get('tabs', []) if not t.get('disabled')]))

            # Take screenshot
            shot = await send_cmd('Page.captureScreenshot', {'format': 'png'})
            temp_path = os.path.join(os.environ.get('TEMP', ''), 'screenshot_score_birth.png')
            with open(temp_path, 'wb') as f:
                f.write(base64.b64decode(shot.get('data', '')))
            print("Screenshot saved to:", temp_path)

    finally:
        proc.terminate()

asyncio.run(main())
