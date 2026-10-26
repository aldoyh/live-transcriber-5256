"""Real Chrome tab capture. No getDisplayMedia, audio-track or API mocks.
Chrome's test flag auto-selects the source tab instead of manual picker consent.
"""
import asyncio
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=False,executable_path='/usr/bin/google-chrome',ignore_default_args=['--mute-audio'],args=['--no-sandbox','--autoplay-policy=no-user-gesture-required','--enable-usermedia-screen-capturing','--allow-http-screen-capture','--auto-select-tab-capture-source-by-title=Nass real audio source'])
  context=await browser.new_context(viewport={'width':1440,'height':1000})
  source=await context.new_page();await source.goto('http://localhost:4200/audio/preview.wav');await source.evaluate("document.title='Nass real audio source'")
  await source.locator('audio, video').evaluate('(a)=>{a.loop=true;return a.play()}')
  print('Source playing:',await source.locator('audio, video').evaluate('(a)=>!a.paused'))
  app=await context.new_page();errors=[];app.on('pageerror',lambda e:errors.append(str(e)))
  await app.goto('http://localhost:4200');await app.bring_to_front()
  await app.get_by_label('رابط يوتيوب',exact=True).fill('https://youtu.be/dQw4w9WgXcQ')
  await app.get_by_label('الموافقة على معالجة الصوت').check()
  await app.get_by_role('button',name='ابدأ التفريغ',exact=True).click()
  try:
   await app.get_by_role('button',name='إيقاف الالتقاط',exact=True).wait_for(timeout=20000)
   print('Native browser capture accepted:',await app.locator('.capture-source-line').inner_text())
   await app.locator('.transcript-segment').first.wait_for(timeout=75000)
   print('Actual Chrome tab audio -> live API -> Arabic:',await app.locator('.transcript-segment textarea').first.input_value())
   await app.get_by_role('button',name='إيقاف الالتقاط',exact=True).click()
   await app.wait_for_function("!document.querySelector('.capture-actions button').disabled",timeout=75000)
   await app.screenshot(path='/home/user/nass-real-chrome-capture.png',full_page=True)
   print('Errors:',errors)
  except Exception:
   print('Current status:',await app.locator('.capture-status').inner_text());print('Errors:',await app.locator('.error-banner').all_text_contents());await app.screenshot(path='/home/user/nass-native-failure.png',full_page=True);raise
  finally: await browser.close()
asyncio.run(main())
