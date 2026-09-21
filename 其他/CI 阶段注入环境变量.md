
## 结构总览

```plain text
📦 项目代码仓库（如 your-app）
📦 配置仓库（如 config-repo） ← 由部署机器人拉取环境变量文件

🤖 部署机器人账号（Bot）
└── 拥有只读权限 → config-repo
└── 在 your-app 的 GitHub Secrets 中保存了机器人的 Access Token
```

## CI/CD 流程总览

### 当推送代码到某个分支（如 `main` 或 `staging`）时

GitHub Actions 自动触发 workflow

### Actions 开始执行构建流程

#### 获取环境变量文件

- Actions 使用部署机器人的 Token 去拉取 `config-repo`
- 根据环境（如 production / preproduction / devlopment）选择对应的 `.env` 文件
- 将 `.env` 拷贝到当前目录

#### 构建镜像

- 构建 Docker 镜像
- `.env` 文件供 Next.js 使用（在 `next build` 阶段读取）

#### 部署到服务器

- 镜像保存成 `.tar`，传到服务器
- 在服务器上：
	- 加载镜像
	- 删除旧容器
	- 启动新容器
	- 清理旧镜像和临时文件

## 目录结构参考（config-repo）

```plain text
config-repo/
├── production/.env
├── preproduction/.env
├── development/.env
```

## 安全控制

| **项目** | **措施** |
| --- | --- |
| 环境变量文件 | 保存在私有配置仓库，**不在主仓库出现** |
| 访问权限 | 通过机器人账号的** Token**，只给 `config-repo` 的读权限 |
| 镜像构建环境 | CI 中 `.env` 文件临时生成，用完可立即删除 |
| Secret 保管 | Token 存在 GitHub Secrets 中，不暴露明文 |
