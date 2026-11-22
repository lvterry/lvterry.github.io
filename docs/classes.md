# 课程页怎么更新

页面路径是 `/class.html`。合并进网站分支之后，地址是：

https://www.wangyazhou.com/class.html

这页不进全站导航，带 `noindex`。它和成绩页互相链接，不和写作站的文章导航混在一起。

上课和缴费的运行时数据是这份 Google 表格，不是仓库里的 YAML：

https://docs.google.com/spreadsheets/d/1jsDGlPjqnbPS0Pw6Gt5iDbJOEHB5WhHxH-qijaT7ySc

浏览器打开页面时直接读取。没有 API key，没有登录，也不经过一次网站发布。表格必须保持「知道链接的任何人可以查看」。做不到这一点时，访客看到的是标明日期的存档，不是刚刚从表格读到的课。

这份说明在 `docs/` 里。Jekyll 排除了整个 `docs` 目录，所以它不会变成网站上的一篇文章。

## 谁改什么

Maze 记录新的上课和缴费。只在表格里追加行。不要为了一节课去改这个仓库，也不要找 Bo 发布。

Bo 只有在改版式、配色、读表方式，或表格读不到时的存档需要重新导出时，才动仓库。

不要往表格或仓库里放密码、令牌、cookie 或私钥。链接一旦对知道的人开放，表格内容就会被页面下载到浏览器里。

## 表格分页

页面只读这三页：

| 分页 | 列 | 谁来追加 |
| --- | --- | --- |
| Courses | `course_key`, `label`, `emoji`, `sort_order` | 只有新增一门课时才加一行 |
| Sessions | `course_key`, `date`, `credits`, `mode`, `note` | Maze，每上一节课追加一行 |
| Payments | `course_key`, `date`, `amount`, `credits`, `note` | Maze，每一笔缴费追加一行 |

`course_key` 只用 `spanish` 或 `boxing`。`mode` 只用 `线上` 或 `线下`，空着按线下。日期用表格显示出来的 `yyyy-mm-dd`。单元格内部即使是序列数，页面也采用这个显示值，不按浏览器时区把日期改到前一天。金额和课时写普通数字，不要写进备注里代替数字列。

Sessions 的 `credits` 空着就是 1。连上两节或这次扣了不止一节课时才填写。Payments 的 `amount` 和 `credits` 都要填。

空行会被忽略。表头那一行不要改名，也不要调换顺序后删掉表头。

Summary 是表格里的公式，给 Maze 自己对总数。网站不读它，公式改了也不会改变页面。页面用 Sessions 和 Payments 自己算：剩余课时 = 全部已购减全部已上。本卡已上 = 最近一次缴费日期之后的课时（缴费当天不算）/ 该次购买的课时。拳击最近一张卡是 7/10，和剩余 3 节是同一套算法，不要在表格里另写一个余额让页面对着抄。

About 是私人说明，网站不读。

## 存档

`_data/classes.yml` 是读不到表格时的备份。更新一节课不要改它。页面只有在表格请求失败时才用它，并且先写出 `snapshot_as_of` 的日期，标明「不是实时数据」。读到了空的表格，不会悄悄换成这份存档。

重新导出存档时，连同 `snapshot_as_of` 一起改，再提交。那一次才需要发布。

颜色按 `course_key` 写在 `class.html` 的 `--course-spanish` 和 `--course-boxing` 里。表格里的文字不能改页面颜色，也不能写成 HTML。

## 检查

在仓库根目录执行：

```bash
node tests/classes.cjs
```

测试不带 cookie、不带 API key 去读表格。读不到、日期不是 `yyyy-mm-dd`，或页面算出来的购课、已上、剩余和 Summary 页不一致，测试都会失败。Summary 只在这次对照里读取，页面运行时不读它，也不读 About。上课行数比这份存档多时，说明已经有新行，测试仍通过，并打印新的余额。不要把凭据写进仓库。
