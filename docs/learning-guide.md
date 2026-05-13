# Learning Guide

这个项目的学习目标是观察成熟 Agent 的请求结构和响应组织方式。

查看捕获日志时，可以关注：

- System Prompt: 角色、规则、边界条件。
- Few-shot: 示例如何约束输出。
- Tool Use: tool schema、调用参数、tool result 的组织方式。
- 多轮上下文: 历史消息如何影响当前输出。
- 流式响应: chunk 与最终结果是否一致。

建议结合日志详情页的 messages、tools、params、response、raw tab 一起看。raw 数据适合核对 SDK 原始形态，归一化视图适合快速比较不同 provider 的行为差异。
