import asyncio, json
from playwright.async_api import async_playwright
FAKE_CAPTURE='''
Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', {configurable:true,value:async()=>{
 const context=new AudioContext(); await context.resume();
 const buffer=await context.decodeAudioData(await (await fetch('/audio/preview.wav')).arrayBuffer());
 const source=context.createBufferSource();source.buffer=buffer;source.loop=true;
 const dest=context.createMediaStreamDestination();source.connect(dest);source.start();
 const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);
 const video=canvas.captureStream(1).getVideoTracks()[0];window.testCaptureContext=context;
 return new MediaStream([...dest.stream.getAudioTracks(), video]);
}});
'''
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  page=await b.new_page(viewport={'width':1440,'height':1080});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  await page.add_init_script(FAKE_CAPTURE);await page.goto('http://localhost:4200')
  await page.get_by_label('رابط يوتيوب',exact=True).fill('https://youtu.be/dQw4w9WgXcQ')
  assert await page.get_by_role('button',name='ابدأ التفريغ',exact=True).is_disabled()
  await page.get_by_label('الموافقة على معالجة الصوت').check()
  requests=[];page.on('request',lambda req:requests.append(req) if '/api/rpc/transcription/chunk' in req.url else None)
  await page.get_by_role('button',name='ابدأ التفريغ',exact=True).click()
  await page.get_by_role('button',name='إيقاف الالتقاط',exact=True).wait_for()
  await page.locator('.transcript-segment').first.wait_for(timeout=80000)
  print('Real API from captured audio:',await page.locator('.transcript-segment textarea').first.input_value())
  await page.get_by_role('button',name='إيقاف الالتقاط',exact=True).click()
  await page.get_by_role('button',name='استئناف الالتقاط',exact=True).wait_for(state='visible',timeout=80000)
  await page.wait_for_function("!document.querySelector('.capture-actions button').disabled",timeout=80000)
  print('Final chunk flush completed:',await page.locator('.transcript-segment').count())
  assert len(requests)>=1
  await page.get_by_label('تعديل المقطع 1',exact=True).fill('هذا نص عربي قابل للتعديل.')
  await page.get_by_role('button',name='تصدير',exact=True).click()
  async with page.expect_download() as d:
   await page.get_by_role('button',name='ترجمة زمنية · SRT',exact=True).click()
  download=await d.value;path=await download.path();text=open(path,encoding='utf-8-sig').read();assert ' --> ' in text and 'هذا نص عربي قابل للتعديل.' in text; print('SRT verified:',text[:120])
  await page.get_by_role('button',name='التفريغات السابقة',exact=False).click()
  assert await page.locator('.history-item').count()==1
  await page.reload();await page.get_by_role('button',name='التفريغات السابقة',exact=False).click();assert await page.locator('.history-item').count()==1
  await page.locator('.history-item').first.click();assert await page.get_by_label('تعديل المقطع 1',exact=True).input_value()=='هذا نص عربي قابل للتعديل.'
  print('History and editing persist after reload.');print('Client errors:',errors)
  await b.close()
asyncio.run(main())
