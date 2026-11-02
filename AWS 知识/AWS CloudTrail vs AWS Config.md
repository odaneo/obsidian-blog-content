
CloudTrail主要记录操作活动；AWS Config主要保存资源配置及变化，并按规则评估合规性。

| 对比项  | AWS CloudTrail           | AWS Config         |
| ---- | ------------------------ | ------------------ |
| 主要记录 | API调用和相关账户活动             | 已启用记录的资源配置、关系及变化历史 |
| 常见问题 | 谁在什么时间、从哪个IP发起了删除安全组的请求？ | 安全组有哪些规则，何时发生变化？   |
| 调查重点 | 调用者、请求参数、时间和执行结果         | 资源状态、配置差异和关联关系     |
| 合规用途 | 为操作审计提供证据                | 根据配置好的规则检查资源是否合规   |

例如，发现安全组开放了不该开放的端口，可以用Config查看配置变化，再结合CloudTrail追查相关操作。[CloudTrail记录说明](https://docs.aws.amazon.com/config/latest/developerguide/log-api-calls.html)、[Config工作方式](https://docs.aws.amazon.com/config/latest/developerguide/how-does-config-work.html)
