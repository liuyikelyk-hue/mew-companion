# 🔮 Mew Companion 部署指南

## Leon 的梦幻伙伴应用 — 从零到上线

---

## 第一步：创建 Supabase 数据库（免费）

1. 打开 https://supabase.com 注册账号
2. 点 **New Project**，起名 `mew-companion`
3. 设置数据库密码（记住它），选择离你最近的区域
4. 等待项目创建完成（约1-2分钟）
5. 进入项目后，点左侧 **SQL Editor**
6. 把 `supabase-schema.sql` 文件的全部内容粘贴进去，点 **Run**
7. 去 **Settings > API**，复制以下两个值：
   - `Project URL`（形如 https://xxxxx.supabase.co）
   - `anon public key`（一长串字符）
8. 把这两个值填入 `src/lib/supabase.js` 文件的对应位置

---

## 第二步：部署到 Vercel（免费）

### 方法 A：通过 GitHub（推荐）

1. 注册 GitHub 账号（如果没有）
2. 创建一个新仓库，起名 `mew-companion`
3. 把整个 `mew-app` 文件夹的内容上传到仓库
4. 打开 https://vercel.com 用 GitHub 账号登录
5. 点 **Import Project**，选择 `mew-companion` 仓库
6. 在 Environment Variables 中添加：
   - `VITE_SUPABASE_URL` = 你的 Project URL
   - `VITE_SUPABASE_ANON_KEY` = 你的 anon key
7. 点 **Deploy**
8. 部署完成后你会得到一个链接（形如 https://mew-companion.vercel.app）

### 方法 B：通过 Vercel CLI

```bash
# 安装 Vercel CLI
npm install -g vercel

# 在 mew-app 目录下
cd mew-app
npm install
vercel
```

---

## 第三步：Leon 开始使用

1. 在 Leon 的手机/iPad 浏览器中打开你的链接
2. 首次使用会让 Leon 输入名字和一个4位PIN码
3. 之后每次打开输入PIN码就能登录
4. **添加到主屏幕**：在 Safari 中点分享按钮 > "添加到主屏幕"，这样就像一个真正的 App

---

## 后续更新流程

1. 你跟 Claude 说要改什么功能
2. Claude 修改代码，你下载新文件
3. 把新文件替换到 GitHub 仓库中
4. Vercel 会自动重新部署
5. Leon 刷新页面就能用新版本
6. **所有历史数据保留在 Supabase 中，不受代码更新影响**

---

## 项目文件说明

```
mew-app/
├── package.json            # 项目依赖配置
├── vite.config.js          # Vite 构建配置
├── tailwind.config.js      # Tailwind CSS 配置
├── postcss.config.js       # PostCSS 配置
├── index.html              # 入口 HTML
├── supabase-schema.sql     # 数据库建表脚本
├── public/
│   └── mew-*.gif           # 梦幻动画 GIF 文件
├── src/
│   ├── main.jsx            # React 入口
│   ├── index.css           # 全局样式
│   ├── App.jsx             # 主应用组件
│   ├── lib/
│   │   └── supabase.js     # 数据库操作函数
│   └── components/         # UI 组件（后续拆分用）
└── DEPLOY.md               # 本文件
```

---

## 常见问题

**Q: 免费额度够用吗？**
Supabase 免费版有 500MB 数据库 + 5GB 带宽，对一个人用完全足够。
Vercel 免费版每月 100GB 带宽，也远远够用。

**Q: 数据安全吗？**
Supabase 数据库有加密和备份。PIN码登录虽然简单，但对家庭使用场景足够了。

**Q: 以后想加更多功能怎么办？**
数据库结构是可扩展的，新功能只需要加新表或新字段，不影响现有数据。
