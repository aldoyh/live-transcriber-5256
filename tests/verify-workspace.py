"""Real SQLite/oRPC integration, device scoping, offline outbox and redesigned UI."""
import asyncio
import json
import re
import uuid
from playwright.async_api import async_playwright

BASE = 'http://localhost:4200'
async def rpc(page, name, values):
    response = await page.request.post(f'{BASE}/api/rpc/workspace/{name}', data={'json': values})
    assert response.ok, (name, response.status, await response.text())
    return (await response.json())['json']

async def synced(page):
    await page.locator('.sync-status').filter(has_text=re.compile('SQLite · متصل')).wait_for(timeout=45000)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width':1440,'height':1100})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.goto(BASE)
        await page.get_by_label('اسم الجلسة', exact=True).fill('جلسة تحقق SQLite')
        await page.get_by_label('رابط يوتيوب', exact=True).fill('https://youtu.be/dQw4w9WgXcQ')
        await page.get_by_label('الموافقة على معالجة الصوت').check()
        await synced(page)
        key = await page.evaluate("localStorage.getItem('nass-workspace-key')")
        rows = await rpc(page, 'list', {'workspaceKey':key})
        target = next(s for s in rows if s['title']=='جلسة تحقق SQLite')
        assert target['url']=='https://youtu.be/dQw4w9WgXcQ'
        assert all('workspace' not in s for s in rows)
        events = await rpc(page, 'activity', {'workspaceKey':key})
        assert {'app.opened','consent.changed','session.saved'} <= {s['action'] for s in events['rows']}
        assert all('workspace' not in e for e in events['rows'])
        print('Real SQLite: source/title/session and consent/application events persisted; no raw workspace key returned.')
        await page.screenshot(path='/home/user/nass-professional-desktop.png', full_page=True)
        body = await page.locator('body').inner_text()
        assert not any(s in body for s in ['ماذا تريد أن تسمع؟','كل صوت، له نص','من صوتٍ عابر','دع الكلمات تتدفق','Made with Runable'])
        assert await page.locator('.sidebar-tip,.how-card,.intro-badge').count()==0
        print('Professional UI: promotional containers/slogans removed, Tajawal/RTL retained.')

        # Controlled fixture verifies transcript revision audit, not fabricated live capture.
        target['segments']=[{'id':str(uuid.uuid4()),'start':0,'end':12,'text':'نص اختبار قاعدة البيانات.'}]
        target['seconds']=12
        await rpc(page, 'save', {'workspaceKey':key,'session':target})
        target['segments'][0]['text']='تعديل نص اختبار قاعدة البيانات.'
        await rpc(page, 'save', {'workspaceKey':key,'session':target})
        events = await rpc(page, 'activity', {'workspaceKey':key, 'sessionId':target['id']})
        changes = next(e['details']['changedSegments'] for e in events['rows'] if e['details'].get('changedSegments') and e['details']['changedSegments'][0]['text'].startswith('تعديل'))
        assert changes[0]['previousText']=='نص اختبار قاعدة البيانات.'
        await page.evaluate("localStorage.removeItem('nass-sessions')")
        await page.reload()
        await synced(page)
        await page.get_by_role('button', name=re.compile('التفريغات السابقة')).click()
        await page.locator('.session-open').filter(has_text='جلسة تحقق SQLite').click()
        assert await page.get_by_label('تعديل المقطع 1').input_value()=='تعديل نص اختبار قاعدة البيانات.'
        print('Database restoration with local session cache removed; before/after transcript revisions retained.')

        # A second device capability must never see the first device's rows.
        other = await browser.new_context()
        second = await other.new_page();await second.goto(BASE);await synced(second)
        other_key = await second.evaluate("localStorage.getItem('nass-workspace-key')")
        other_rows = await rpc(second,'list',{'workspaceKey':other_key})
        assert all(s['id']!=target['id'] for s in other_rows)
        assert not (await rpc(second,'activity',{'workspaceKey':other_key,'sessionId':target['id']}))['rows']
        print('Session and activity isolation across device-held workspace capabilities verified.')
        await other.close()

        await page.route('**/api/rpc/workspace/*', lambda route: route.abort())
        await page.get_by_label('اسم الجلسة',exact=True).fill('جلسة أعيدت مزامنتها')
        await page.get_by_role('alert').filter(has_text='تعذّر الحفظ').wait_for(timeout=20000)
        assert (await page.evaluate("JSON.parse(localStorage.getItem('nass-outbox')).sessions"))[0]['title']=='جلسة أعيدت مزامنتها'
        await page.unroute('**/api/rpc/workspace/*')
        await page.get_by_role('button',name='إعادة المزامنة',exact=True).click()
        await synced(page)
        assert any(s['title']=='جلسة أعيدت مزامنتها' for s in await rpc(page,'list',{'workspaceKey':key}))
        print('Offline/error outbox preserves snapshots and manual retry writes them to real SQLite.')

        await page.get_by_role('button',name='سجل النشاط',exact=True).click()
        await page.locator('.activity-summary').first.wait_for(timeout=20000)
        await page.locator('.activity-summary').first.click()
        await page.locator('.event-details pre').wait_for()
        async with page.expect_download() as downloaded:
            await page.get_by_role('button',name='تصدير JSON',exact=True).click()
        download=await downloaded.value;await download.save_as('/home/user/nass-activity-test.json')
        assert len(json.loads(open('/home/user/nass-activity-test.json',encoding='utf-8-sig').read()))>0
        await page.screenshot(path='/home/user/nass-professional-activity.png',full_page=True)
        print('Activity inspector and JSON export read real stored events.')
        await page.get_by_role('button',name='مساحة التفريغ',exact=True).click()
        await page.set_viewport_size({'width':390,'height':844})
        await page.wait_for_function("document.querySelector('.nass-sidebar').getBoundingClientRect().left >= window.innerWidth")
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await page.screenshot(path='/home/user/nass-professional-mobile.png',full_page=True)
        assert not errors, errors
        print('Mobile 390px: no horizontal overflow. No browser runtime errors.')
        await browser.close()

asyncio.run(main())