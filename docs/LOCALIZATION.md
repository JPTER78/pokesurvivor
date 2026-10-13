# 简体中文化维护说明

## 语言与数据约定

语言代码为 `zh-CN`。已保存的 `ps.lang` 有效选择优先，其次是 `/en/` 或 `/zh/` 入口，最后沿用原版浏览器语言规则：西语浏览器使用西语，其余浏览器使用英语。
启动页和运行时采用相同规则；所有文本文件均使用 UTF-8。

`G.I18n.add(dict, locale = 'en', context = '')` 注册当前语言的字典，原有英语调用保持兼容。
`G.T(source, context)` 和 `G.I18n.term(category, source)` 按显示语境取译名。
`pokemon` 类别还支持全国图鉴编号；原游戏对象的 `name`、编号、招式 ID、道具 ID、存档值和网络载荷保持原值。
`{x}` 翻译插入的宝可梦或其他游戏内容，`{name}` 保留玩家昵称。顺序和数量必须与源文一致。
DOM 中的昵称使用 `translate="no"`；Canvas 中使用 `rawCanvas(ctx, method, text, ...args)`，绘制与测量共用字体。
称号选项保留显式原文 `value`，中文搜索同时接受原名和译名。

## 名称来源与校对

候选名称来自项目既有数据提供方 [PokéAPI](https://github.com/PokeAPI/pokeapi/tree/81d20919845b6a445969b9265aab5cec6b04cece/data/v2/csv)，固定版本为
`81d20919845b6a445969b9265aab5cec6b04cece`，使用简体中文语言 ID 12。
PokéAPI 是社区维护的数据源。招式和道具名称对应其实际西班牙语显示名称，英语名称用于交叉核对。

游戏中全部 **966 只宝可梦**按全国图鉴编号，与[宝可梦官方简体中文图鉴的公开数据](https://pokedex.pokemon.cn/play/pokedex/api/v1)中基本形态的名称逐项比较。
采用官方数据并记录两处差异：

| 编号 | 候选数据 | 官方图鉴及本项目 |
| --- | --- | --- |
| 233 | 多边兽２型 | 多边兽2型 |
| 312 | 負电拍拍 | 负电拍拍 |

校对记录、来源文件 SHA-256、64 种基础招式与进化名称、11 种道具及语境映射保存在 `tools/localization/zh-cn-terms.json`。
九个地区的中文名称在生成脚本中显式维护，避免数据源缺少中文地区名称时漏译。

| 源标识／名称 | 简体中文 | 处理方式 |
| --- | --- | --- |
| 属性 Psíquico | 超能力 | 使用属性语境 |
| 招式 Psíquico | 精神强念 | 使用招式语境 |
| 属性 Normal／外观 Normal | 一般／普通 | 使用不同语境 |
| leaf-storm／Tormenta Floral | 落英缤纷 | 按显示名称 Petal Blizzard 对应 |
| giga-drain／Hierba Lazo | 打草结 | 按显示名称 Grass Knot 对应 |
| Enjambre | 虫群 | 本作原创的招式进化名称 |
| La Sentencia de Arceus／Ruinas del Juicio | 阿尔宙斯的审判／审判遗迹 | 本作第 30 分钟的原创事件及场地；与招式名称分开处理 |
| Mejora／Diario／Niebla | 强化／每日／迷雾 | 按界面或天气语境翻译 |

招式、道具、天气和强化的说明依据本作机制校对。舌舔和冰冻光束在本作造成减速，描述中明确这一行为。
招式属性及数值来自原始游戏定义，中文化保持这些定义。

界面翻译草稿和部分兼容性修复参考
[DabaoHuang 的繁体中文贡献 #74](https://github.com/JPTER78/pokesurvivor/pull/74)，
对应版本 `b4479743aed19f79fa01cdfc5a818ef20ba82c6d`。已调整简体用语，并以简体名称表和官方图鉴重新对应名称。
源码继续遵循原项目 MIT 授权；原作者及贡献者署名保留。

## 修改与生成

界面及效果说明维护在 `js/data/lang-zh-cn.js`。名称字典由 `tools/make_zh_names.py` 生成；中文玩家页面的正文维护在 `tools/seo_zh.py`。
新增源文时补充完整句子及动态模板，并检查原有语境和昵称保护。构建后运行测试；新增汉字时重新生成字体。

需要重新核对名称时执行：

```powershell
python tools/fetch_localization.py
python tools/make_zh_names.py
```

下载输入位于忽略的 `tools/cache/localization`。重新抓取官方数据前移除对应缓存文件，保留审核记录并检查差异。
语言数据和页面生成在浏览器以外完成；游戏不请求外部翻译接口。

## 字体

中文采用 [Noto Sans SC](https://github.com/notofonts/noto-cjk/tree/main/Sans/SubsetOTF/SC) 的常规及粗体字形，按当前游戏和中文页面的字符生成 WOFF2 子集。
衍生字体名为 `PSChinese`，源字体许可证随项目保存在 `assets/fonts/NotoSansSC-OFL.txt`；字体文件名带内容哈希，适配现有永久资源缓存。
英文和数字采用原有 Pixelify 字体，子集以外的昵称字符由系统字体补充。

```powershell
python -m pip install fonttools brotli
python tools/make_zh_font.py
```

源字体下载地址及 SHA-256 位于术语记录；生成结果及文件哈希位于 `tools/localization/font-manifest.json`。
重新生成后仅保留该清单引用的两个中文字体文件。字体生成是开发阶段步骤。

## 验证

```powershell
node --test tests/i18n.test.cjs
python tests/locale_pages.py
```

浏览器集成测试需要 Playwright 及已安装的 Chrome：

```powershell
npm install --no-save --package-lock=false playwright
node tests/i18n-browser.cjs dev.html
node tests/i18n-browser.cjs index.html
node tests/i18n-browser.cjs en/index.html
node tests/i18n-browser.cjs zh/index.html
node tests/offline-browser.cjs
```

测试使用独立浏览器配置、本地账号和房间／排行榜数据，阻断外部服务请求。结果位于忽略的 `test-results/`。
覆盖语言选择、名称和占位符、昵称、称号存档值、存档切换、游戏卡牌、合作界面、移动端、字体及本地文件启动。
实际 Firebase 同步和 WebRTC 联机需要另外进行联网验证。
网站生成器的 `SITE` 和仓库的域名配置继续采用原项目设置；部署 fork 时按实际发布地址配置。
