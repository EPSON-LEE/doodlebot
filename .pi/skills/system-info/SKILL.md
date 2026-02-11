---
name: system-info
description: 获取当前主机的详细系统信息，包括操作系统版本、架构、内核版本以及基本资源状态。
---

# 系统信息查询技能

本技能指导你如何组合使用基础工具来提取系统深层信息。

## 查询流程

1. **操作系统与内核**:
   使用 `execute_command` 运行：
   ```bash
   uname -a
   ```

2. **系统负载与内存**:
   使用 `execute_command` 运行：
   ```bash
   top -l 1 | head -n 10
   ```

3. **磁盘使用情况**:
   使用 `execute_command` 运行：
   ```bash
   df -h
   ```

4. **汇总报告**:
   将以上结果整理后回复给用户，保持专业风格。
