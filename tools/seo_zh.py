"""Simplified Chinese player pages, generated from the same game data as ES/EN."""
from pathlib import Path
import json
import re

def generate(e):
    D, N, z, esc = e['D'], e['N'], e['zh'], e['esc']
    lang = 'zh-CN'
    paths = e['PATH'][lang]
    def link(frm, dest): return e['rel'](paths[frm], paths[dest])
    def cta(pid, text='免费游玩'): return e['cta'](pid, lang, text)
    def write(pid, title, desc, body, ld=None):
        ld = ld or {'@context':'https://schema.org','@graph':[e['crumbs'](pid, lang, title)]}
        e['write'](pid, lang, e['page'](pid, lang, title, desc, body, ld))
    def badge(t): return e['tbadge'](t, lang)
    def card(p, pid):
        d = p['dex']
        label = '<b class="leg">传说</b>' if d in e['LEG'] else '<b class="st">最初的伙伴</b>' if p.get('starter') else ''
        return f'<li id="p{d}">{e["sprite"](d, up=e["upof"](pid, lang))}<span class="n">#{d:03d}</span><span class="nm">{esc(z(p["name"]))}</span><span class="tys">{"".join(badge(t) for t in p["types"])}</span>{label}</li>'

    pid = 'guide'
    faq = [
        ('游戏免费吗？','完全免费。这是非营利同人作品，没有广告和内购。自愿捐款仅用于服务器及域名费用，不提供游戏优势。'),
        ('需要下载吗？','可直接在电脑、平板或手机浏览器中游玩，也可通过“添加到主屏幕”安装为应用。'),
        ('手机怎样操作？','横屏游玩，在屏幕任意位置拖动手指即可移动。点击招式图标切换招式，点击右上角按钮暂停。'),
        ('可以切换语言吗？','支持简体中文、英语和西班牙语。首次访问时，西语浏览器使用西语，其余浏览器使用英语。访问 /zh/ 或在“设置 → 画面 → 语言”中选择简体中文，游戏会记住选择并重新加载。'),
        ('能与好友一起玩吗？','在线合作最多支持 4 人。在好友界面通过昵称添加好友，邀请到房间后开始游戏。经验值共享；靠近倒下的伙伴并停留即可帮助其复活。'),
        ('共有多少只宝可梦？',f'目前收录九个地区的 {N} 只宝可梦，均可成为伙伴。具有异色图像的宝可梦还可选择异色版本。'),
        ('怎样获得更多宝可梦？','使用游玩获得的抽取券在地区卡池抽取。部分普通宝可梦被击败后会掉落抽取券，首领及裂缝中的传说宝可梦有时会掉落十连抽取券。抽取券不能用真实货币购买。'),
        ('裂缝是什么？','地图上出现的神秘传送门。进入后会在对应属性的竞技场挑战传说宝可梦，共有 18 种竞技场。获胜可领取奖励；挑战失败会返回地图。'),
        ('第 30 分钟会发生什么？','阿尔宙斯会降临，将玩家带到审判遗迹。它无法被击败，移动速度会不断提高。每 5 秒会出现一只传说宝可梦，其 HP 和伤害是前一只的两倍；尽可能躲避攻击并坚持更久。第 28 分钟起不再出现裂缝。'),
        ('进度会保存吗？','启用云端服务时，账号进度可跨设备同步。本地账号的数据保存在当前浏览器；清除网站数据会删除本地存档。访客模式不保存进度。'),
        ('这是宝可梦官方游戏吗？','这是免费、非营利的同人项目，与 Nintendo、GAME FREAK 及 The Pokémon Company 没有关联。')
    ]
    body = f'''<article class="doc"><h1>PokéSurvivor 游戏攻略</h1>
<p class="lead">选择一只宝可梦作为伙伴，在无限地图中移动，躲避野生宝可梦的围攻。伙伴会自动使用当前招式攻击，你负责走位、升级和选择组合。</p>{cta(pid)}
<h2>操作方法</h2><ul>
<li><b>电脑：</b>使用 <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 或方向键移动；使用 <kbd>1</kbd>–<kbd>4</kbd>、<kbd>Q</kbd>/<kbd>E</kbd> 或点击图标切换招式；使用 <kbd>Esc</kbd>/<kbd>P</kbd> 暂停。</li>
<li><b>手机和平板：</b>横屏，在屏幕任意位置拖动移动，点击招式切换，右上角按钮暂停。</li>
<li>拾取经验值升级，每次从三张卡牌中选择新招式、招式升级或能力强化。</li></ul>
<h2>游戏内容</h2><ul class="feat">
<li><a href="{link(pid,'pokedex')}">{N} 只宝可梦</a>，每只伙伴拥有独立的永久强化。</li>
<li><a href="{link(pid,'moves')}">招式升级与进化</a>：达到满级并满足强化条件后，火花可进化为大字爆炎，泡沫可进化为冲浪。</li>
<li>敌人会治疗、施加护盾、召唤援军、自爆或发动带有地面预警的攻击。</li>
<li><a href="{link(pid,'legends')}">首领与裂缝</a>：18 种属性竞技场。</li>
<li>第 30 分钟迎来阿尔宙斯的审判：在审判遗迹中躲避无敌的阿尔宙斯与不断增强的传说宝可梦。</li>
<li><a href="{link(pid,'types')}">属性相克与天气</a>：晴天、下雨、沙暴、降雪和迷雾影响战斗。</li>
<li><a href="{link(pid,'shinies')}">野生异色宝可梦</a>出现概率为 1/4096，也可通过抽取获得。</li>
<li>地区卡池使用游玩获得的抽取券，抽取界面采用像素老虎机风格。</li>
<li>从宝箱及首领处获得<a href="{link(pid,'items')}">携带道具</a>，如吃剩的东西、讲究头带和生命宝珠。</li>
<li>最多 4 人在线合作；每日及每周任务、<a href="{link(pid,'achievements')}">{len(D['achievements'])} 项成就</a>、公开个人资料和排行榜。</li>
<li>支持简体中文、英语和西班牙语，可在电脑或移动设备上游玩及安装。</li></ul>
<h2>生存建议</h2><ol><li>保持移动，绕大圈引导敌人排成队列。</li><li>根据敌人的属性切换效果绝佳的招式。</li><li>及时离开地面正在填满的圆圈和线条，它们表示即将发动的攻击。</li><li>优先击败治疗者和提供护盾的敌人。</li><li>把金币投入常用伙伴的永久强化。</li></ol>
<h2>常见问题</h2>{''.join(f'<h3>{esc(q)}</h3><p>{esc(a)}</p>' for q,a in faq)}{cta(pid)}</article>'''
    ld = {'@context':'https://schema.org','@graph':[{'@type':'FAQPage','inLanguage':lang,'mainEntity':[{'@type':'Question','name':q,'acceptedAnswer':{'@type':'Answer','text':a}} for q,a in faq]},e['crumbs'](pid,lang,'游戏攻略')]}
    write(pid,'PokéSurvivor 游戏攻略：操作、技巧与常见问题',f'了解 PokéSurvivor 的操作、{N} 只宝可梦、合作模式、裂缝、招式进化和抽取系统。',body,ld)

    pid = 'pokedex'
    sections = []
    for g in range(1,10):
        mons = [p for p in D['dex'] if p.get('gen') == g]
        sections.append(f'<section id="g{g}"><h2>{e["gen_name"](g,lang)} <small>第 {g} 世代 · {len(mons)} 只</small></h2><ul class="dexgrid">{"".join(card(p,pid) for p in mons)}</ul></section>')
    gens = ''.join(f'<a href="#g{g}">{e["gen_name"](g,lang)}</a>' for g in range(1,10))
    body = f'<article class="doc wide"><h1>宝可梦图鉴：{N} 只可用伙伴</h1><p class="lead">收录从关都到帕底亚的九个地区。通过选择最初的伙伴、地区抽取或击败野生异色宝可梦获得伙伴。下列名称均使用官方简体中文名称。</p><nav class="gens">{gens}</nav>{"".join(sections)}{cta(pid,"选择伙伴，开始游戏")}</article>'
    write(pid,f'PokéSurvivor 宝可梦图鉴：全部 {N} 只伙伴',f'PokéSurvivor 全部 {N} 只可用宝可梦的官方简体中文名称、属性及地区。',body)

    pid = 'legends'
    arenas = ''.join(f'<li>{badge(t)} <b>{esc(z(D["arenas"][t]))}</b></li>' for t in e['TYPES'] if t in D['arenas'])
    cards = ''.join(card(e['BY'][d],pid) for d in sorted(e['LEG']))
    body = f'<article class="doc wide"><h1>传说宝可梦与裂缝：18 种竞技场</h1><p class="lead">地图上会出现神秘裂缝。进入后，在对应属性的竞技场挑战宝可梦，地形与天气随属性变化。获胜可获得十连抽取券；失败则返回地图。合作模式下，全队一起进入。本作将传说和幻之宝可梦归入此类挑战。</p><h2>每种属性对应一座竞技场</h2><ul class="arenas">{arenas}</ul><p>双属性宝可梦会随机选用其中一种属性的竞技场。注意会灼伤的熔岩、滑动的冰面和减速的水域。</p><h2>{len(e["LEG"])} 只裂缝挑战宝可梦</h2><ul class="dexgrid">{cards}</ul>{cta(pid,"寻找裂缝")}</article>'
    write(pid,'PokéSurvivor 传说宝可梦、裂缝与属性竞技场','裂缝挑战的规则、18 种竞技场，以及可挑战的传说与幻之宝可梦。',body)

    pid = 'shinies'
    pairs = ''.join(f'<li><span class="pair">{e["sprite"](d,up=e["upof"](pid,lang))}{e["sprite"](d,True,up=e["upof"](pid,lang))}</span><span class="nm">{esc(z(e["BY"][d]["name"]))}</span></li>' for d in e['SHOW'] if e['META'].get(d,{}).get('sh'))
    body = f'<article class="doc wide"><h1>异色宝可梦：概率与获得方法</h1><p class="lead">异色宝可梦具有不同的配色，十分罕见。本作大多数宝可梦拥有异色版本。</p><h2>怎样获得</h2><ul><li>野生宝可梦出现时，有 <b>1/4096</b> 的概率为异色。发现后会有闪光与提示，击败即可获得。</li><li>地区抽取每次有 <b>1/100</b> 的概率获得异色。</li><li>重复的异色宝可梦会转换为三倍金币。</li><li>拥有伙伴的异色版本后，可在主菜单或图鉴中选择使用。</li></ul><h2>普通与异色版本对照</h2><ul class="dexgrid pairs">{pairs}</ul>{cta(pid,"寻找异色宝可梦")}</article>'
    write(pid,'PokéSurvivor 异色宝可梦：概率与获得方法','野生异色概率 1/4096，抽取异色概率 1/100。查看普通与异色宝可梦对照。',body)

    pid = 'types'
    types = e['TYPES']; matrix = D['matrix']
    head = ''.join(f'<th class="vt">{badge(t)}</th>' for t in types)
    def cell(v):
        cls = 'x16' if v > 1.05 else 'x03' if v < .35 else 'x06' if v < .95 else ''
        return f'<td class="{cls}">{"×"+format(v,"g") if cls else ""}</td>'
    rows = ''.join(f'<tr><th>{badge(a)}</th>{"".join(cell(matrix[a][d]) for d in types)}</tr>' for a in types)
    script = """<script>document.querySelectorAll('#chart td').forEach(td => { td.onmouseenter = () => { const r=td.parentElement,i=[...r.children].indexOf(td); document.querySelectorAll('#chart tr').forEach(tr => tr.children[i] && tr.children[i].classList.add('hl'));r.classList.add('hl'); };td.onmouseleave=()=>document.querySelectorAll('#chart .hl').forEach(el=>el.classList.remove('hl')); });</script>"""
    body = f'<article class="doc wide"><h1>属性相克表与天气</h1><p class="lead">本作调整了伤害倍率：效果绝佳为 <b>×1.6</b>，效果不好为 <b>×0.6</b>，原本无效的攻击为 <b>×0.3</b>。双属性的倍率相乘，上限为 <b>×2.4</b>。规则同时适用于你和敌人的攻击。</p><p>行表示招式属性，列表示受击宝可梦的属性。将鼠标移至单元格可高亮对应行列。</p><div class="tablewrap"><table class="chart" id="chart"><thead><tr><th></th>{head}</tr></thead><tbody>{rows}</tbody></table></div><h2>天气效果</h2><ul><li>下雨：水属性增强，火属性减弱。</li><li>强烈日照：火属性增强，水属性减弱。</li><li>沙暴：岩石、地面和钢属性增强，其他属性受到影响。</li><li>降雪：冰属性增强，其他属性受到影响并减速。</li><li>迷雾：幽灵、妖精和超能力属性增强。</li></ul>{cta(pid,"在战斗中运用属性相克")}</article>{script}'
    write(pid,'PokéSurvivor 属性相克表与天气效果','查看本作 18 种属性的相克倍率及天气效果：×1.6、×0.6、×0.3，双属性上限 ×2.4。',body)

    pid = 'moves'
    kinds = {'projectile':'投射物','melee':'近战','beam':'光束','orbit':'环绕','nova':'爆发','aura':'光环','buff':'能力强化','boomerang':'回旋','chain':'连锁','mine':'地雷','meteor':'陨石','turret':'炮台','dash':'冲刺','trail':'轨迹','cone':'扇形'}
    rows = []
    for t in types:
        for m in [m for m in D['moves'] if m['type'] == t]:
            evo = m['evo']
            ev = f'<b>{esc(z(evo["name"],"move"))}</b><small>需要：{esc(z(evo["needs"]))} · {esc(z(evo["text"]))}</small>' if evo else '—'
            rows.append(f'<tr><td><b>{esc(z(m["name"],"move"))}</b></td><td>{badge(t)}</td><td>{kinds[m["kind"]]}</td><td>{esc(z(m["desc"]))}</td><td class="evo">{ev}</td></tr>')
    nm, nevo = len(D['moves']), sum(bool(m['evo']) for m in D['moves'])
    body = f'<article class="doc wide"><h1>招式与招式进化</h1><p class="lead">共有 {nm} 种基础招式，覆盖 18 种属性。伙伴自动使用当前招式攻击，升级时选择卡牌学习或强化招式。{nevo} 种招式可进化：达到满级并取得所需能力强化后，会出现进化卡牌。名称沿用官方译名，效果说明以本作机制为准。“虫群”为本作原创进化名称。</p><div class="tablewrap"><table class="list"><thead><tr><th>招式</th><th>属性</th><th>攻击方式</th><th>效果</th><th>进化</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>{cta(pid,"尝试不同招式")}</article>'
    write(pid,f'PokéSurvivor 招式：{nm} 种基础招式及进化',f'查看 {nm} 种基础招式的名称、属性、效果和进化条件。',body)

    pid = 'items'
    rows = ''.join(f'<li><b>{esc(z(i["name"],"item"))}</b><span>{esc(z(i["desc"]))}</span></li>' for i in D['items'])
    body = f'<article class="doc"><h1>携带道具</h1><p class="lead">从宝箱或被击败的首领处获得道具。一次只能携带一件；遇到新道具时可选择保留哪件。道具在本局游戏期间生效，名称采用官方译名，效果依据本作。</p><ul class="items">{rows}</ul>{cta(pid,"寻找道具")}</article>'
    write(pid,f'PokéSurvivor 携带道具：全部 {len(D["items"])} 种及其效果','吃剩的东西、讲究头带、气势披带、生命宝珠等携带道具在本作中的效果。',body)

    pid = 'achievements'
    sections = []
    for cid,cname in D['achCats']:
        achievements = [a for a in D['achievements'] if a['cat'] == cid]
        if not achievements: continue
        rows = ''.join(f'<li><b>{esc(z(a["name"]))}</b><span>{esc(z(a["desc"]))}</span>{"<em>称号："+esc(z(a["title"]))+"</em>" if a["title"] else ""}</li>' for a in achievements)
        sections.append(f'<h2>{esc(z(cname))} <small>({len(achievements)})</small></h2><ul class="items ach">{rows}</ul>')
    body = f'<article class="doc wide"><h1>全部 {len(D["achievements"])} 项成就</h1><p class="lead">完成收藏、生存、战斗及裂缝挑战等目标，可获得奖章、抽取券或金币。部分高难度成就还会解锁个人资料称号。</p>{"".join(sections)}{cta(pid,"开始解锁成就")}</article>'
    write(pid,'PokéSurvivor 成就、奖章与称号','查看全部成就及完成条件，收集奖章并解锁个人资料称号。',body)

    pid = 'news'
    parts = [('new','新增'),('chg','调整'),('fix','修复')]
    articles = []
    for n in D['changelog']:
        sections = ''.join(f'<h3>{label}</h3><ul>{"".join("<li>"+esc(z(pair[0]))+"</li>" for pair in n[k])}</ul>' for k,label in parts if n.get(k))
        articles.append(f'<article class="news"><time datetime="{n["d"]}">{n["d"]}</time><h2>{esc(z(n["title"][0]))}</h2>{sections}</article>')
    write(pid,'PokéSurvivor 更新日志','游戏新增内容、调整及修复的完整简体中文更新记录。',f'<div class="doc"><h1>更新日志</h1>{"".join(articles)}{cta(pid)}</div>')

    pid = 'support'
    costs = ''.join(f'<tr><td>{esc(z(c))}</td><td>{v} 欧元／月</td></tr>' for c,v in D['funding']['costs'])
    funding = D['funding']
    buttons = ''.join(f'<a class="btn" href="{url}" rel="noopener">{label}</a>' for url,label in [(f'https://ko-fi.com/{funding["kofi"]}','在 Ko-fi 支持作者') if funding['kofi'] else ('',''),(f'https://github.com/sponsors/{funding["sponsors"]}','GitHub Sponsors') if funding['sponsors'] else ('','')] if url)
    body = f'<article class="doc"><h1>支持 PokéSurvivor</h1><p class="lead">游戏将持续免费，没有广告、内购或付费优势。自愿捐款用于服务器和域名，结余留作后续月份的费用。</p><h2>维护费用</h2><table class="list"><tbody>{costs}</tbody></table><p>服务器用于账号、存档、排行榜和合作游戏。</p><h2>怎样支持</h2><p>{buttons or "捐款入口将由原作者提供。"}</p><p>分享游戏、向朋友推荐，以及反馈问题也能帮助项目。</p>{cta(pid,"返回游戏")}</article>'
    write(pid,'支持 PokéSurvivor：服务器与域名费用','自愿捐款仅用于项目维护，不提供游戏优势。也可通过分享游戏和反馈问题支持作者。',body)

    pid = 'contact'
    source = (Path(e['ROOT'])/'contacto/index.html').read_text(encoding='utf-8')
    mail = re.search(r'href="mailto:([^?\"]+)',source)[1]
    issues = re.search(r'href="(https://github.com/[^\"]+/issues[^\"]*)',source)[1]
    body = f'<article class="doc"><h1>联系作者</h1><p class="lead">发现问题、有建议，或需要处理账号及权利事项时，可联系原作者。</p><h2>电子邮件</h2><p><a href="mailto:{esc(mail)}">{esc(mail)}</a></p><button class="btn" id="copy-mail" type="button">复制邮箱</button><span id="copied" aria-live="polite"></span><h2>问题与建议</h2><p><a class="btn" href="{esc(issues)}" target="_blank" rel="noopener">在 GitHub 反馈</a></p>{cta(pid,"返回游戏")}</article><script>document.getElementById("copy-mail").onclick=async()=>{{try{{await navigator.clipboard.writeText({json.dumps(mail)});document.getElementById("copied").textContent="已复制！";}}catch(e){{document.getElementById("copied").textContent="请选中邮箱地址手动复制。";}}}};</script>'
    write(pid,'联系作者 · PokéSurvivor','PokéSurvivor 原作者的联系邮箱及问题反馈入口。',body)

    root = Path(e['ROOT'])
    # Preserve the generated bundle fingerprint and the shared Spanish DOM source.
    dev = (root/'dev.html').read_text(encoding='utf-8')
    idx = (root/'index.html').read_text(encoding='utf-8')
    app = re.search(r'<script defer src="js/app\.min\.js\?v=[^"]+"></script>',idx)[0]
    a,b = dev.index('<!-- scripts:begin -->'),dev.index('<!-- scripts:end -->')+len('<!-- scripts:end -->')
    src = dev[:a]+app+dev[b:]
    src = re.sub(r'<!-- seo:(begin|end) -->\n?', '', src)
    src = re.sub(r'<meta name="robots" content="noindex">\s*', '', src)
    src = src.replace('<html lang="es">','<html lang="zh-CN">')
    src = re.sub(r'<title>.*?</title>','<title>PokéSurvivor – 免费在线宝可梦生存游戏</title>',src,count=1)
    description = f'选择宝可梦伙伴，躲避围攻、学习招式、挑战传说宝可梦。收录 {N} 只宝可梦，支持异色及最多 4 人合作，免费在浏览器和手机上游玩。'
    for selector in ['name="description"','property="og:description"','name="twitter:description"']:
        src = re.sub(r'(<meta '+selector+r' content=")[^"]*(">)',lambda m:m[1]+description+m[2],src)
    src = src.replace('content="es_ES"','content="zh_CN"')
    for selector in ['property="og:title"','name="twitter:title"']:
        src = re.sub(r'(<meta '+selector+r' content=")[^"]*(">)',r'\1PokéSurvivor – 宝可梦生存游戏\2',src)
    src = src.replace('"inLanguage": "es"','"inLanguage": ["zh-CN", "es", "en"]')
    src = src.replace('PokéSurvivor necesita JavaScript para funcionar. Actívalo para jugar.','PokéSurvivor 需要 JavaScript。请启用后开始游戏。')
    src = src.replace('Fan game gratuito de supervivencia con 966 Pokémon de las 9 regiones: elige tu compañero, sobrevive a las hordas, evoluciona tus ataques, enfréntate a legendarios y juega en cooperativo con hasta 4 amigos.',description)
    src = src.replace('<p>Juego de supervivencia con Pokémon, gratis en el navegador y en el móvil.</p>','<p>免费的宝可梦生存游戏，可在浏览器和手机上游玩。</p>').replace('<p class="boot-ld">Cargando…</p>','<p class="boot-ld">加载中…</p>')
    src = re.sub(r'(<meta property="og:image:alt" content=")[^"]*(">)',r'\1PokéSurvivor：像素地图上被大群宝可梦围绕的伙伴\2',src)
    def localize_schema(match):
        data = json.loads(match[1])
        for item in data.get('@graph',[]):
            if 'description' in item: item['description'] = description
            if 'inLanguage' in item: item['inLanguage'] = lang
            if item.get('name') == 'PokéSurvivor': item['inLanguage'] = lang
        return '<script type="application/ld+json">'+json.dumps(data,ensure_ascii=False)+'\n</script>'
    src = re.sub(r'<script type="application/ld\+json">([\s\S]*?)</script>',localize_schema,src)
    src = src.replace('href="guia/">Guía del juego','href="zh/guide/">游戏攻略').replace('href="pokedex/">Pokédex: todos los Pokémon jugables','href="zh/pokedex/">宝可梦图鉴：全部可用伙伴')
    alts = ''.join(f'<link rel="alternate" hreflang="{l}" href="{e["SITE"]}{e["PATH"][l]["home"]}">\n' for l in e['LANGS'])
    src = src.replace('<meta charset="utf-8">','<meta charset="utf-8">\n'+alts,1)
    src = src.replace('<!-- dev.html: página fuente. Aquí se edita; index.html lo genera tools/build.js. -->','<!-- GENERATED from dev.html: edit source and rebuild. -->')
    # Keep the upstream Spanish home page and metadata; Chinese has its own entry.
    rootgame = re.sub(r'<link rel="alternate"[^>]*>\s*', '', idx)
    rootgame = rootgame.replace('<meta charset="utf-8">','<meta charset="utf-8">\n'+alts,1)
    rootgame = rootgame.replace('"inLanguage": "es"','"inLanguage": ["es", "en", "zh-CN"]')
    (root/'index.html').write_text(rootgame,encoding='utf-8')
    zhgame = src.replace('<head>','<head>\n<base href="../">',1).replace('<link rel="canonical" href="'+e['SITE']+'">','<link rel="canonical" href="'+e['SITE']+'zh/">').replace('<meta property="og:url" content="'+e['SITE']+'">','<meta property="og:url" content="'+e['SITE']+'zh/">')
    (root/'zh/index.html').write_text(zhgame,encoding='utf-8')
    nf = (root/'404.html').read_text(encoding='utf-8')
    nf = nf.replace('<main>','<main><article class="doc center" lang="zh-CN"><h1>404 · 在迷宫中迷路了</h1><p class="lead">此页面不存在。宝可梦们仍在等待你的挑战。</p><p><a class="btn" href="/zh/">返回中文游戏</a></p></article>',1)
    (root/'404.html').write_text(nf,encoding='utf-8')
    print('ok: Simplified Chinese game + 11 player pages; official names shared with runtime')
