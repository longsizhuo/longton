# Langton's Ant

一个 [朗顿蚂蚁](https://en.wikipedia.org/wiki/Langton%27s_ant) 的交互式可视化模拟器，部署在 Cloudflare Workers 上。

## 规则

在二维网格上，蚂蚁遵循两条规则：

- 在白格上：**右转 90°**，把该格翻成黑，前进一格
- 在黑格上：**左转 90°**，把该格翻成白，前进一格

简单的规则会先后呈现三个阶段：对称图案 → 伪随机混乱 → 涌现出周期 104 步的"高速公路"。

## 本地开发

```bash
npx wrangler dev
```

## 部署

push 到 `main` 或 feature 分支会通过 GitHub Actions 自动部署到 Cloudflare Workers。

需要在仓库 Secrets 中配置：

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
