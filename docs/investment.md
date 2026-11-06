# 长期投资页怎么更新

页面路径是 `/investment.html`。合并进网站分支之后，地址是：

https://www.wangyazhou.com/investment.html

这页不在全站导航里。写作站的导航继续是文章、语录、音乐那些。课程页和成绩页是另一套私人记录，这里不跟它们互相链接。

公开页可以进搜索。上面只有框架、目标权重和空的证据位，没有股数和金额。`noindex` 不能拿来保护已经写进仓库的数字，所以数字根本不能提交。如果以后不想被搜索到，在 `investment.html` 的 `<head>` 里加一行 `<meta name="robots" content="noindex" />` 即可。那只影响搜索，不构成隐私保护。

这份说明在 `docs/` 里。Jekyll 排除了整个 `docs` 目录，所以它不会变成网站上的一篇文章。

## 公开和只能留在本机

可以提交：

- 原则、目标权重、公司代码和名称
- 论点、证据、时间线、焦点快照、行动建议
- 有来源的价格、估值、收益、组合贡献
- 脱敏之后、Terry 明确决定公开的实际百分比

不可以提交，无论写在 YAML、HTML、JS 还是这份说明的例子里：

- 股数
- 市值、成本、账户余额、总资产
- 能反推出仓位大小的绝对金额

实际百分比在公开文件里默认是空的。0 表示「真的是 0」，不知道就留 `null`，不要写 0。

本机导入是可选的。浏览器读一个 JSON，只在当次页面里算出百分比，不上传，不放进 `localStorage`，刷新就没了。页面不展示股数和金额。这个网站没有登录，任何写进仓库的东西都是公开的。

没有付费行情接口，也没有 GitHub Actions 或定时任务去拉行情。要数字就手工写，并带上来源。

## 文件

| 文件 | 什么时候改 |
| --- | --- |
| `_data/investment/principles.yml` | 原则措辞，或观察阈值 |
| `_data/investment/targets.yml` | 目标权重。百分比只改这里 |
| `_data/investment/companies.yml` | 论点、状态、关注项、四类证据 |
| `_data/investment/holdings.yml` | 公开的实际百分比、估值、收益、贡献。价格不要写这里 |
| `_data/investment/quotes.yml` | 有来源的行情快照。旧的留着 |
| `_data/investment/events.yml` | 时间线。只追加 |
| `_data/investment/focus.yml` | 焦点快照。只追加 |
| `_data/investment/suggestions.yml` | 行动建议 |
| `_data/investment/themes.yml` | 几家公司共用的风险 |
| `_data/investment/methodology.yml` | 页面底部的口径说明 |
| `investment.html` | 只有改版式才动。日常内容不要改它 |
| `assets/js/investment.js` | 只有改计算或交互才动 |

日期一律加引号，写成 `"2026-11-06"` 或 `"2026-11-06T16:00:00+08:00"`。不加引号时，YAML 会把日期变成别的类型。

改完数据，提交并合并到网站分支。GitHub Pages 会重新生成页面。不需要在本地跑定时脚本。

检查可以在仓库根目录执行：

```bash
node tests/investment-logic.cjs
node tests/investment-privacy.cjs
```

## 工作日看什么

Julie 在工作日只做记录，不发明数字，也不改目标权重。

1. 打开 `/investment.html`，先看「一眼」里的待核实和建议。
2. 有值得记的事情，就在 `events.yml` 的 `events` 下面追加一条。`id` 一旦用过就不要改。`verified` 先写 `false`，打开过来源、事实对得上，再改成 `true`。
3. 这是旧事件的后续：新条目填 `continues: 旧 id`。这是更正：新条目填 `corrects: 旧 id`，把更正写在新条目里。不要改旧条目的事实，也不要删旧条目。
4. 事实写进对应公司的 `evidence.facts`，管理层原话写进 `guidance`，媒体和转述写进 `media`，我们的看法写进 `judgment`。第二手来源在核对前保持 `verified: false`。
5. 价格只有同时具备来源链接、`as_of` 和 `after_hours_included: true/false` 才追加到 `quotes.yml`。不知道有没有含盘后，就先别写这条。
6. `suggestions.yml` 的 `action` 没有新证据就继续留空。留空会显示「无法判断」，不要写成「继续持有」来占位。
7. 股数和金额不要出现在任何会被提交的文件里。

## 每月复核

1. 在 `focus.yml` 追加一条当月快照，写这个月真正在看的主题和原因。没有把握的月份就空着，不要回填。
2. 新快照如果取代了旧焦点，填 `supersedes: 旧 id`。旧快照保留。
3. 在 `companies.yml` 更新 `last_review`。状态要改的话，同时写 `status_rationale`。`status` 只用：正面、观察、恶化、待核实。`confidence` 只用：高、中、低，或者留空。
4. `next_verification` 写成下一次对得上的事件，例如财报日期。没有就留空。
5. 目标权重只有 Terry 决定改了才动 `targets.yml`。改的同时在时间线加一条 `kind: 论点变化` 或 `持仓变化`，说明为什么。不要悄悄改历史。
6. 建议要写判断时，`action` 只用：继续持有、加强观察、评估再平衡、评估减仓。同时写证据、触发、证伪、待核对和时间点。`price_vs_thesis` 只用：价格偏离、论点恶化、两者都有。论点恶化即使权重仍在目标上，也可以把动作写成评估。
7. `principles.yml` 里的 `watch_threshold.value_pp` 在 Terry 确认之前保持 `null`，`confirmed` 保持 `false`。填了数字也只是观察线，页面不会因此自动建议交易。

## 本机持仓文件

页面上可以下载空白模板。形状是：

```json
{
  "holdings_as_of": null,
  "timezone": "Asia/Shanghai",
  "after_hours_included": null,
  "positions": [
    { "ticker": "GOOG", "actual_pct": null },
    { "ticker": "MSFT", "actual_pct": null },
    { "ticker": "NVDA", "actual_pct": null },
    { "ticker": "TSLA", "actual_pct": null },
    { "ticker": "CASH", "actual_pct": null }
  ]
}
```

把 `actual_pct` 换成自己算出的百分比，没算出来的保持 `null`。不要为了凑满 100 去估。SGOV 和 TFLO 算在 `CASH` 里。如果现金百分比空着，也可以另起两行，代码用 `SGOV` 和 `TFLO`，两行都有数字才会加进现金；缺一行不会当成 0。

另一种写法是每行用金额字段而不是百分比。四只股票和现金都要有数字，页面才换算百分比。缺一行就不算，也不会把缺的当成 0。框架外的代码会让这次换算停下来。金额只留在本机文件里，页面上不显示。

股数会被忽略。页面不取行情，没法用股数算权重。

限制：

- 文件不会上传，但下载目录里的原件还在，要自己保管。
- 刷新、关掉页面，这次载入就没了。这是故意的。
- 百分比不会被强行调成 100。对不上就原样提示。
- 「若调整」只显示实际百分比减去目标百分比，不含交易成本和税，也不会下单。
- 境内和境外资金如果本来就重叠，这个文件解决不了穿透。
