# 背屏卡片桥 · 模块商店

不需要自建服务器或域名的模块目录。网页与 JSON 由 GitHub Pages 托管，模块 ZIP 由作者的 GitHub Releases 提供。

- **浏览商店**：https://finall1008.github.io/rear-card-modules/
- **机器可读索引**：https://finall1008.github.io/rear-card-modules/modules.json
- **主应用与使用说明**：https://github.com/finall1008/rear-card-bridge
- **模块开发指南**：https://github.com/finall1008/rear-card-bridge/blob/main/docs/module-development.md

## 使用

1. 在商店下载模块 ZIP（不要下载 GitHub 自动生成的 Source code ZIP）。
2. 打开背屏卡片桥，使用「安装 ZIP 模块」导入。
3. 从 App 实际扫描的本地卡片中选择替换目标，按 App 提示完成写入。
4. 需要重新应用时，在系统背屏设置中移除旧卡并从原入口重新应用。

## 投稿与更新

**通过 Pull Request 修改 `modules.json` 即可，不需要账号后台或额外服务。**

1. 在自己的公开仓库发布模块，遵循背屏卡片桥 API 2 模块格式。
2. 将已经构建好的模块 ZIP 上传到 GitHub Release。
3. Fork 本仓库，在 `modules.json` 的 `modules` 数组添加条目；更新时修改同一 ID 的现有条目。
4. 提交 PR，写明用途、仓库地址、版本与发布说明。
5. 维护者审核目录信息与包格式后合并，GitHub Pages 自动更新。

索引中的模块元数据应与对应 ZIP 根目录的 `module.json` 一致。下载地址应固定到明确的 Release 版本，不使用 main 分支归档或 latest 链接，避免展示版本与下载内容不一致。

示例（请替换所有占位值）：

```json
{
  "id": "dev.example.mycard",
  "name": "我的背屏卡片",
  "version": "1.0.0",
  "versionCode": 1,
  "apiVersion": 2,
  "description": "模块用途的一句话介绍",
  "author": "your-name",
  "capabilities": ["storage"],
  "repository": "https://github.com/OWNER/REPO",
  "releaseUrl": "https://github.com/OWNER/REPO/releases/tag/v1.0.0",
  "downloadUrl": "https://github.com/OWNER/REPO/releases/download/v1.0.0/module.zip",
  "tags": ["工具"],
  "previews": [
    "https://raw.githubusercontent.com/OWNER/REPO/v1.0.0/previews/card.webp",
    "https://raw.githubusercontent.com/OWNER/REPO/v1.0.0/previews/detail.webp"
  ]
}
```

### 索引格式

顶层为 `{ "schemaVersion": 1, "modules": [...] }`。

| 字段 | 含义 |
| --- | --- |
| `id` | 模块唯一 ID，对应安装包 `module.json.id` |
| `name`、`description`、`author` | 名称、简介与作者 |
| `version`、`versionCode` | 展示版本与更新比较用的正整数版本号 |
| `apiVersion` | 模块 API，当前仅收录 `2` |
| `capabilities` | 安装包声明的能力，如 `network`、`storage`、`files` |
| `repository` | 源码仓库 HTTPS 地址 |
| `releaseUrl` | 当前版本发布页 HTTPS 地址 |
| `downloadUrl` | 已构建模块 ZIP 的固定版本 HTTPS 地址 |
| `tags` | 分类与搜索标签 |
| `previews` | 有序的 HTTPS 图片直链数组，第一张为封面；可提供多张，省略或空数组表示暂无预览 |

预览图保存在模块作者自己的公开仓库中，使用与发布版本对应的固定 tag 或 commit 下的图片直链（不是 GitHub 文件浏览页），无需复制到商店仓库或加入模块 ZIP。引用 tag 时应在发布 tag 前提交图片；界面更新时同步选择对应版本的预览图。建议使用示例数据，避免展示令牌或个人敏感信息。网页和 App 原生商店按数组顺序左右滑动预览，点击可全屏查看，完整等比显示图片。网页还支持前后按钮和键盘左右键切图，Esc 关闭大图。未提供图片时隐藏整个预览区域，不留占位；图片加载失败不影响下载或安装。

商店仅列出当前收录版本，历史版本在各模块 Release 页查看。搜索与分类在浏览器本地完成，访问商店不调用 GitHub REST API、不需要 Token。

## 部署

仓库无需构建、依赖、数据库、GitHub Actions 脚本或自定义域名。

GitHub 仓库 **Settings → Pages → Build and deployment**：

- Source：**Deploy from a branch**
- Branch：**main**
- Folder：**/ (root)**

提交到 main 后，GitHub Pages 自动部署根目录中的静态网页、JSON 与样式。`.nojekyll` 禁用 Jekyll 内容处理。
