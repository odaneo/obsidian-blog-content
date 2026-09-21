
## 结构总览

```plain text
📦 项目代码仓库（如 your-app）← 只负责构建产物（不含敏感信息）
📦 目标服务器（如 EC2 实例）
└── 保留 ~/inject-env.sh（注入脚本）
└── 保留运行时配置：如环境变量、.env.runtime 等

🔄 镜像产物：jpf-<tag>.tar
└── 构建后可用于多个环境部署
```

## CI/CD 流程总览

### 当推送代码到某个分支（如 `main` 或 `staging`）时

GitHub Actions 自动执行构建流程，CI 只做一次，生成通用镜像，不携带任何敏感变量

### GitHub Actions 构建流程

#### 构建镜像（**不注入变量**）

- 使用 `Dockerfile` 构建前端镜像 `jpf:<tag>`
- 镜像中包含构建产物和 nginx 配置
- `index.html` 中保留占位注释：

```html
// __ENV_INJECT_START__
// __ENV_INJECT_END__
```

#### 保存并上传镜像

- 将镜像打包为 `.tar` 文件，上传到目标服务器

#### 服务器 CD 注入变量

- 在服务器上执行以下流程：

```shell
docker load < ~/jpf-<tag>.tar
docker rm -f jpf || true
docker run -d --name jpf -p 80:80 jpf:<tag>
docker cp ~/inject-env.sh jpf:/inject-env.sh
docker exec -e TEST=xxx -e NEXT_PUBLIC_TEST=yyy jpf sh -c "/inject-env.sh"
```

- 另外一种思路是，通过 `--env-file .env.runtime` 注入服务端环境变量

#### inject-env.sh 示例

```shell
# 替换 index.html 中的占位符为实际 window.__ENV__ 值
window.__ENV__ = {
  TEST: "...",
  NEXT_PUBLIC_TEST: "..."
}
```

脚本只存在于服务器本地，不打入镜像，也不出现在 GitHub Repo。
