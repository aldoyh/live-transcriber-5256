"""Native Chrome picker: no autoplay, capture auto-selection or permission bypass flags.
Pause at the picker so an operator can select the source through native Chrome UI.
"""
import asyncio
import os
import subprocess
from pathlib import Path
from playwright.async_api import async_playwright

async def main():
    Path('/home/user/nass-test-display.txt').write_text(os.environ['DISPLAY'])
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False, executable_path='/usr/bin/google-chrome', ignore_default_args=['--mute-audio'], args=['--no-sandbox', '--window-size=1440,1100'])
        context = await browser.new_context(viewport={'width':1400,'height':950})
        source = await context.new_page()
        await source.goto('http://localhost:4200/audio/preview.wav')
        await source.evaluate("document.title='Nass real audio source'")
        await source.locator('audio, video').click()
        await source.locator('audio, video').evaluate('(a)=>{a.loop=true;return a.play()}')
        app = await context.new_page()
        errors = []
        app.on('pageerror', lambda e: errors.append(str(e)))
        await app.goto('http://localhost:4200')
        await app.get_by_label('رابط يوتيوب', exact=True).fill('https://youtu.be/dQw4w9WgXcQ')
        await app.get_by_label('الموافقة على معالجة الصوت').check()
        await app.get_by_role('button', name='ابدأ التفريغ', exact=True).click()
        subprocess.run(['import','-window','root','/home/user/nass-native-picker.png'],check=True)
        print('Picker ready. Select source and audio through native UI.',flush=True)
        try:
            await app.get_by_role('button',name='إيقاف الالتقاط',exact=True).wait_for(timeout=90000)
            await app.locator('.transcript-segment').first.wait_for(timeout=75000)
            print('Manual picker, default autoplay, real API:',await app.locator('.transcript-segment textarea').first.input_value(),flush=True)
            await app.get_by_role('button',name='إيقاف الالتقاط',exact=True).click()
            await app.wait_for_function("!document.querySelector('.capture-actions button').disabled",timeout=75000)
            print('Errors:',errors,flush=True)
            await app.screenshot(path='/home/user/nass-manual-capture.png',full_page=True)
        finally:
            await browser.close()

asyncio.run(main())