
选择负载均衡器，先看流量需要怎样分发：按域名、路径等HTTP内容路由，通常考虑ALB；需要固定入口IP，或转发TCP、UDP等流量，可以考虑NLB。

| 对比项 | ALB | NLB |
| --- | --- | --- |
| 工作层级 | 第7层，应用层 | 第4层，传输层 |
| 常见协议 | HTTP、HTTPS，支持HTTP/2和gRPC | TCP、TLS、UDP，也支持TCP_UDP、QUIC、TCP_QUIC监听器 |
| 路由依据 | 主机名、URL路径、请求头等 | 连接或流的网络信息，不按HTTP路径分流 |
| 连接处理 | 以HTTP请求为单位选择目标 | 同一TCP连接持续交给同一目标 |
| 地址特点 | 通常通过DNS名称访问，解析地址可能变化 | 每个启用的可用区有静态入口IP；公网NLB可配置EIP |
| 主要能力 | 内容路由、重定向、用户身份验证 | 高吞吐、低延迟、TLS终止及符合条件的客户端IP保留 |
| 健康检查 | HTTP、HTTPS；gRPC目标可使用对应检查 | TCP、HTTP或HTTPS |
| 常见用途 | 网站、HTTP API、按路径拆分的服务 | 固定IP接入、TCP/UDP服务及网络性能敏感的业务 |

ALB的HTTP/2和gRPC属于应用协议能力，NLB的TLS监听器负责加解密。使用NLB的TCP监听器，也可以把加密流量透传给后端。[ALB说明](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html)、[NLB监听器](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/load-balancer-listeners.html)、[NLB概览](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html)

NLB的主动健康检查使用TCP、HTTP或HTTPS，ICMP不属于可选的健康检查协议。转发UDP流量时，也要配置能反映服务状态的检查端口。[NLB健康检查](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/target-group-health-checks.html)

