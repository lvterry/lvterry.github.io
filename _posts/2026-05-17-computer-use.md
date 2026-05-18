---
title: Computer Use 有什么用
date: 2026-05-17 10:00:00 +08:00
categories: essay
layout: post
---

想象中让 AI 操作电脑是很有用的，可以自动化一些重复性的工作，把人从枯燥乏味中解放出来，但一直没有尝试具体的事情，今天有机会试了一把。

事情是这样的，我做了一个静态网站，把它部署到了 Cloudflare Page 上，然后我想给它绑定一个我在阿里云上注册和管理的域名。

这个事情不难，我曾在其他网站上操作过，需要先在阿里云上修改域名的 DNS，然后在 Cloudflare 上把域名和网站项目做绑定，再配置好 CNAME 记录，就能解析了。

但是 Cloudflare 我是第一次用，稍微尝试了一下根本就没找到地方，有点烦躁。突然想到几天前看到 Codex 发布 Computer Use 的视频，我判断这件事风险不高，不如让 Codex 操作电脑来做吧。

浏览器里已经打开了阿里云和 Cloudflare 的网站，我把 Codex 打开，输入了下面的指令：

> I have a domain `putaoso.com` on Aliyun. And I have a webpage deployed to Cloudflare pages. Now I want to bind the domain to the project. End goal is to make sure the website is accessible from both `putaoso.com` and `www.putaoso.com`. I have Aliyun and Cloudflare both opened in my Safari. Use @Computer to complete the task.

我看到它很快给自己做好了行动规划，开始用鼠标在网页上点击查看相关信息，就走开了。

过了一会儿回来，发现它停在了阿里云修改 DNS 页面上，这个操作需要我收短信验证码确认，我完成了这个步骤，让 Codex 继续。

过了一会儿我再回来时，它已经弄好了，还在浏览器里访问域名去验证，总耗时6分12秒。

说实话我觉得挺惊艳的，没想到会这么顺利。这不只是把重复性的工作自动化了，这是代替我去探索和完成一件确定性很高，但没那么有趣的任务。

前段时间一直在想 CLI 工具和 Computer Use 哪个才是未来大的方向，现在觉得依然有非常多任务暂时没法 CLI 化，能用 Computer Use 能力完成这些任务，也是一件幸事。