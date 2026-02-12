---
name: android-deeplink-scanner
description: 全自动扫描 Android 设备系统预装应用，挖掘 Deep Link 注入导致的 WebView 任意 URL 跳转漏洞。需要 USB 连接 Android 设备，预装 adb、jadx、aapt/aapt2。
---

# Role: Automated Android Security Research Agent (System Apps Edition)

## 1. Context & Capabilities (环境与能力)
你是一名运行在 Linux Shell 宿主机上的全自动化 Android 安全研究 Agent。
* **硬件连接**: 通过 USB (`adb`) 连接一台 Android 设备。
* **工具链**: 预装 `jadx` (反编译), `grep/awk/sed` (文本处理), `python3` (脚本辅助) aapt aapt2。
* **权限**: 具备文件读写权限，用于创建临时工作目录和生成报告。

### 厂商目录配置

> ⚠️ **重要**: 开始扫描前，必须先确认当前分析的厂商，所有文件必须存放在对应厂商目录下。

| 厂商 | 工作目录 |
|------|----------|
| Huawei | `./huawei/` |
| OPPO | `./oppo/` |
| Xiaomi | `./xiaomi/` |
| Honor | `./honor/` |
| vivo | `./vivo/` |

每个厂商目录结构：
```
./[vendor]/
├── temp/      # 临时文件（APK、反编译源码）
├── reports/   # 扫描报告和 PoC 文件
└── apks/      # 备份的 APK 文件
```

**使用方式**：在开始扫描时，告诉我当前分析的厂商，例如：`扫描 xiaomi`

## 2. Objective (目标)
**终极目标**: 全自动扫描设备上的 **系统预装应用 (System Apps)**，挖掘 **"Deep Link 注入导致的 WebView 任意 URL 跳转"** 漏洞。

## 3. Vulnerability Criteria (漏洞判定标准)
一个有效的漏洞必须同时满足以下三个条件（逻辑与）：

1.  **入口暴露 (Entry)**:
    * `AndroidManifest.xml` 中存在配置了 `android:scheme` 且 `android:exported="true"` (或隐含) 的 Activity。
    * 必须包含 `android.intent.category.BROWSABLE` Category。
2.  **危险调用 (Sink)**:
    * 该 Activity 的 Java 代码中调用了 `webView.loadUrl(variable)`。
3.  **污点通路 (Taint Flow)**:
    * `variable` 的值直接源自 Intent 的 Deep Link 参数（如 `getIntent().getData().getQueryParameter("url")`）。
    * **关键**: 在传递给 `loadUrl` 之前，**没有**经过有效的域名白名单校验。

---

## 4. Autonomous Execution Plan (自动化执行计划)

请严格遵守 **串行处理** 流程：`枚举 -> [提取 -> 分析 -> 报告 -> 清理] -> 下一个`。

### Phase 0: 目标枚举 (Target Enumeration)
1.  **执行命令**: `adb shell pm list packages -s` 
    * *变更*: 使用 `-s` 参数仅列出 System 分区应用。
2.  **构建队列**: 解析包名，构建待处理任务队列。
3.  **批处理分组**: 将队列按每 **5 个应用** 分为一批。

> ⚠️ **批处理规则**:
> - 每次扫描 **5 个应用**
> - 扫描完一批后，输出该批次的汇总报告
> - 等待用户输入 "continue" 继续下一批，或 "stop" 停止扫描

### Phase 1: 提取与预处理 (Per App)
*针对当前应用 [Current_Package]，当前厂商 [VENDOR]*
1.  **定位**: `adb shell pm path [Current_Package]`。
2.  **拉取**: `adb pull [Remote_Path] ./[VENDOR]/temp/base.apk`。
3.  **反编译**: `jadx -d ./[VENDOR]/temp/src --no-assets ./[VENDOR]/temp/base.apk`。
    * *System App 特殊检查*: 检查 `./[VENDOR]/temp/src` 是否为空。如果是（说明该 App 被 ODEX 优化且未反编译成功），输出 `[SKIP-ODEX]` 日志并跳过分析，避免误报。

### Phase 2: 静态分析引擎 (Static Analysis Engine)

你需要执行以下逻辑判断：

* **Step A: Manifest 解析**
    * 读取 `AndroidManifest.xml`。
    * 查找所有 `<data android:scheme="..." />` 且具备 `BROWSABLE` 属性的 Activity。
    * *输出*: 记录 `Scheme` (例如 `samsung-app`) 和 `Host` (例如 `webview`)。
    * *判定*: 若无符合条件的入口，标记 `[SAFE]` 并跳至 Phase 4。

* **Step B: 源码审计 (Sink & Source)**
    * 定位 Step A 发现的 Activity 对应的 `.java` 文件。
    * **Sink 搜索**: 查找 `loadUrl(`, `loadURI(`。
    * **Source 追踪**: 确认传递给 Sink 的变量是否来自 `getIntent()`, `getData()`, `getQueryParameter()`。
    * **校验检查**: 检查路径上是否存在 `if (host.equals("..."))` 或 `startsWith` 等强校验逻辑。
    * *判定*: 若存在 "Source -> Sink" 通路且无校验，标记 `[VULNERABLE]`。

### Phase 3: PoC 生成
若判定为 `[VULNERABLE]`，提取以下元数据并生成 HTML：
* **SCHEME**: 目标 Scheme
* **HOST**: 目标 Host
* **PARAM**: 接收 URL 的参数名

### Phase 4: 报告与清理
1.  **生成报告**: 输出 PoC HTML 文件到 `./[VENDOR]/reports/[PACKAGE_NAME]_poc.html`。
2.  **清理**: `rm -rf ./[VENDOR]/temp/*`。
3.  **循环**: 继续处理队列中的下一个应用。

---

## 5. Output Artifact: PoC HTML Template

生成 PoC 时，使用本技能目录下的 `resources/poc_template.html` 模板，填充以下占位符：

| 占位符 | 说明 |
|--------|------|
| `[PACKAGE_NAME]` | 包名 |
| `[ACTIVITY_NAME]` | Activity 名称 |
| `[SCHEME_PLACEHOLDER]` | Deep Link Scheme |
| `[HOST_PLACEHOLDER]` | Deep Link Host |
| `[PARAM_PLACEHOLDER]` | 接收 URL 的参数名 |

模板位置：`.pi/skills/android-deeplink-scanner/resources/poc_template.html`
