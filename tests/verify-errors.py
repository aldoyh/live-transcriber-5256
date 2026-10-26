import asyncio,json
from playwright.async_api import async_playwright
from pathlib import Path
FAKE=Path('tests/verify-transcription.py').read_text().split("FAKE_CAPTURE='''")[1].split("'''\nasync")[0]
async def prep(page,script):
 await page.add_init_script(script);await page.goto('http://localhost:4200')
 await page.get_by_label('رابط يوتيوب',exact=True).fill('https://youtube.com/watch?v=dQw4w9WgXcQ')
 await page.get_by_label('الموافقة على معالجة الصوت').check();await page.get_by_role('button',name='ابدأ التفريغ',exact=True).click()
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--autoplay-policy=no-user-gesture-required'])
  page=await b.new_page()
  await prep(page,"Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{throw new DOMException('denied','NotAllowedError')}})")
  await page.get_by_role('alert').wait_for();assert 'رفض الإذن' in await page.get_by_role('alert').inner_text();assert await page.get_by_role('button',name='ابدأ التفريغ',exact=True).is_enabled();print('Permission denial: recoverable Arabic error.')
  await page.close();page=await b.new_page()
  await prep(page,"Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{const c=document.createElement('canvas');c.getContext('2d').fillRect(0,0,10,10);return c.captureStream(1)}})")
  await page.get_by_role('alert').wait_for();assert 'لم تصل قناة صوت' in await page.get_by_role('alert').inner_text();print('Missing audio: explicit instructions, no model call.')
  await page.close();page=await b.new_page()
  calls=[]
  async def error_route(route):
   calls.append(route.request.post_data)
   await route.fulfill(status=502,content_type='application/json',body=json.dumps({'json':{'defined':False,'code':'BAD_GATEWAY','status':502,'message':'خطأ اختباري في الاتصال'}}))
  await page.route('**/api/rpc/transcription/chunk',error_route)
  await prep(page,FAKE)
  await page.get_by_role('button',name='إيقاف الالتقاط',exact=True).wait_for()
  await page.get_by_role('alert').wait_for(timeout=25000)
  assert await page.locator('.transcript-segment').count()==0
  await page.get_by_role('button',name='إعادة المحاولة',exact=True).wait_for();await page.get_by_role('button',name='إعادة المحاولة',exact=True).click()
  await page.wait_for_timeout(500);assert len(calls)>=2;print('Failed chunk retained and retry attempted; no invented transcript.')
  await page.get_by_role('button',name='تجاهل المقاطع',exact=True).click()
  await page.get_by_role('button',name='تفريغ جديد',exact=True).click()
  assert await page.get_by_label('رابط يوتيوب',exact=True).input_value()==''
  print('Discard failed queue and new-session reset verified.')
  await b.close()
asyncio.run(main())
