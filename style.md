# Reusable Product Style

这份风格适合做 AI 工具、代理服务、日志平台、调试台、内部运营面板。界面目标是安静、清楚、可长时间阅读，优先让用户扫表格、看状态、复制配置、进入详情。

## 设计气质

- 产品感：本地工具台、工程控制台、请求审计面板。
- 视觉关键词：冷静、紧凑、低饱和、细边框、方正、信息密度高。
- 避免：营销页大英雄区、彩色渐变背景、大圆角卡片、装饰插画、大面积高饱和色块。
- 主体界面要像一个真实可用的工作台，首屏直接展示导航、状态、数据或配置入口。

## 色彩系统

使用 OKLCH token 管理浅色和深色主题。主色是偏蓝的技术色，只在按钮、状态徽标、选中态和少量高亮里出现；背景和容器以冷灰为主。

```css
:root {
  --background: oklch(0.986 0.004 247);
  --foreground: oklch(0.19 0.018 252);
  --card: oklch(0.999 0.001 247);
  --card-foreground: oklch(0.19 0.018 252);
  --popover: oklch(0.999 0.001 247);
  --popover-foreground: oklch(0.19 0.018 252);
  --primary: oklch(0.55 0.105 225);
  --primary-foreground: oklch(0.99 0.002 247);
  --secondary: oklch(0.957 0.012 235);
  --secondary-foreground: oklch(0.28 0.035 235);
  --muted: oklch(0.965 0.008 247);
  --muted-foreground: oklch(0.49 0.025 252);
  --accent: oklch(0.946 0.025 178);
  --accent-foreground: oklch(0.26 0.052 178);
  --destructive: oklch(0.58 0.19 25);
  --border: oklch(0.895 0.014 247);
  --input: oklch(0.895 0.014 247);
  --ring: oklch(0.63 0.11 225);
  --sidebar: oklch(0.976 0.006 247);
  --sidebar-foreground: oklch(0.21 0.02 252);
  --sidebar-accent: oklch(0.95 0.012 235);
  --sidebar-border: oklch(0.89 0.014 247);
}

.dark {
  --background: oklch(0.18 0.018 248);
  --foreground: oklch(0.925 0.012 235);
  --card: oklch(0.225 0.02 248);
  --card-foreground: oklch(0.925 0.012 235);
  --popover: oklch(0.235 0.022 248);
  --popover-foreground: oklch(0.925 0.012 235);
  --primary: oklch(0.78 0.105 205);
  --primary-foreground: oklch(0.16 0.018 248);
  --secondary: oklch(0.3 0.032 238);
  --secondary-foreground: oklch(0.9 0.018 220);
  --muted: oklch(0.275 0.022 248);
  --muted-foreground: oklch(0.69 0.028 235);
  --accent: oklch(0.42 0.052 168);
  --accent-foreground: oklch(0.92 0.025 168);
  --destructive: oklch(0.68 0.17 24);
  --border: oklch(0.38 0.026 240 / 72%);
  --input: oklch(0.34 0.03 240 / 82%);
  --ring: oklch(0.78 0.105 205);
  --sidebar: oklch(0.155 0.02 248);
  --sidebar-foreground: oklch(0.9 0.014 235);
  --sidebar-accent: oklch(0.255 0.026 244);
  --sidebar-border: oklch(0.36 0.026 240 / 68%);
}
```

### 状态色

- 成功或正常：优先用 `primary`，比如 2xx 状态、Ready、当前 provider。
- 次要状态：用 `secondary`，适合 provider、数量、弱提示。
- 中性占位：用 `outline` 或 `muted-foreground`，比如 pending、空字段、SSE 标记。
- 错误和危险：用 `destructive/10` 背景加 `destructive` 文本，不要大面积纯红。
- 分组和图表：用低透明度 chart 色，背景控制在 `/10`，圆点或细线可用实色。

## 字体

- 正文字体：Inter 或系统 sans-serif。
- 代码、ID、URL、模型名、时间、token 数字：JetBrains Mono。
- 默认文字尺寸偏小，后台工具以可扫描为主。

```css
html {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

code,
pre,
kbd,
samp {
  font-family: var(--font-mono);
}
```

常用字号：

- 页面主标题：`text-2xl` 到 `text-3xl`，只在页面头部使用。
- 卡片标题：`text-sm font-medium`。
- 表格、按钮、输入、徽标：`text-xs`。
- 说明文字：`text-xs text-muted-foreground` 或 `text-sm text-muted-foreground`。
- 元信息标签：`text-[10px] uppercase tracking-[0.18em]`。

## 布局

- 应用壳：左侧 sidebar，右侧主内容，顶部 sticky header。
- 内容宽度：数据页允许 `max-w-none`，概览页控制在 `max-w-6xl`。
- 页面边距：移动端 `px-4 py-6`，桌面端 `sm:px-6 lg:px-8`。
- 模块间距：页面级 `gap-5` 或 `gap-6`，卡片内 `gap-3` 或 `gap-4`。
- 表格和详情页优先横向滚动，保持列宽稳定，避免挤压成难读的多行。

典型页面结构：

```tsx
<div className="flex min-h-svh min-w-0 flex-col bg-background text-foreground">
  <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur">
    ...
  </header>
  <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-6">
      ...
    </div>
  </main>
</div>
```

## 形状和边框

- 主要控件和卡片使用直角：`rounded-none`。
- JSON viewer、Markdown code block、复杂内容容器可以保留小圆角：`rounded-md`。
- 边框是主要分隔手段：`border-border/70`、`ring-1 ring-foreground/10`。
- 阴影只用于浮层、按钮轻微抬起或 sidebar inset：`shadow-sm` 即可。
- 不做厚重投影，不用玻璃拟态大面积装饰。

## 组件规范

### Card

卡片是信息容器，不当作装饰块嵌套使用。默认直角、细 ring、紧凑 padding。

```tsx
<Card className="min-w-0 bg-card/90">
  <CardHeader className="border-b border-border/70">
    <CardDescription>Local proxy workspace</CardDescription>
    <CardTitle className="text-2xl tracking-tight">Request log explorer</CardTitle>
  </CardHeader>
  <CardContent className="flex flex-col gap-4 pt-4">
    ...
  </CardContent>
</Card>
```

### Button

按钮高度小，文本短，命令型操作优先配图标。

- 默认：`h-8 text-xs bg-primary text-primary-foreground`
- 次要：`variant="outline"`，适合刷新、复制、切换。
- 危险：浅红背景，不使用大面积纯红按钮。
- 图标按钮：`size="icon"`，用于刷新、分页、主题切换。

### Badge

徽标用于状态、provider、计数和短标签。高度 `h-5`，直角，字体 `text-xs`。

- `default`：当前、成功、主状态。
- `secondary`：普通分类和计数。
- `outline`：中性状态、占位状态、可选能力。
- `destructive`：错误状态码、离线、失败。

### Table

表格是核心组件，信息密度可以高，但要让列宽稳定。

- 表格容器：`overflow-auto border`。
- 表头：`h-10 px-2 text-xs font-medium`。
- 行高：日志行约 `h-14`。
- 行 hover：`hover:bg-muted/50`。
- 当前行：`ring-2 ring-inset ring-primary/40 bg-primary/10`。
- ID、模型、URL、耗时、时间用 mono 字体。

### Input / Select / Slider

筛选条使用一行 grid，控件高度保持 `h-8`。

```tsx
<div className="grid shrink-0 grid-cols-1 gap-3 md:grid-cols-[160px_220px_minmax(280px,1fr)_190px_auto]">
  ...
</div>
```

### Code Block

代码块用于配置、curl、环境变量、JSON fallback。

- 背景：`bg-muted/30`
- 边框：`border border-border/70`
- 字体：`font-mono text-[11px] leading-relaxed`
- 行为：`overflow-auto`，最大高度按场景限制。

## 图标

- 工具型按钮使用图标，图标大小默认 `size-4`。
- 常用图标：刷新、复制、分页、主题切换、导航。
- 图标和文字按钮使用 `gap-1` 到 `gap-1.5`。
- 图标只做识别，不承担装饰背景。

## 交互状态

- Focus：`focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50`。
- Active：按钮可轻微 `active:translate-y-px`。
- Disabled：`opacity-50`，不额外变色。
- Hover：以 `muted/50` 或 `secondary/80` 为主。
- 选中：低透明主色背景加 ring，方便在表格里追踪当前行。

## 信息表达

- 页面标题直说当前任务，比如 `Request log explorer`、`Prompt diff view`。
- 描述文案短，说明这个区域能做什么。
- 空状态要给下一步动作，比如“复制 baseURL 接入客户端后，这里会出现最新流量”。
- 表格字段尽量短：`Provider`、`Status`、`Model`、`Tokens`、`Duration`。
- 中文文案适合口语化一点，像工具提示，不写报告式总结。

## 可复用 Tailwind 片段

```tsx
// 页面卡片
"min-w-0 overflow-hidden rounded-none bg-card py-4 ring-1 ring-foreground/10"

// 卡片头部分隔
"border-b border-border/70"

// 弱提示
"text-xs text-muted-foreground"

// 元信息
"font-mono text-xs text-muted-foreground"

// 工具条
"flex flex-wrap items-center justify-between gap-3 border border-primary/15 bg-primary/5 px-3 py-2"

// 数据表容器
"min-h-0 min-w-0 flex-1 overflow-auto rounded-md border"

// 代码块
"overflow-auto border border-border/70 bg-muted/30 p-4 font-mono text-[11px] leading-relaxed"

// 空状态
"border border-dashed border-border/80 p-6 text-sm text-muted-foreground"
```

## 迁移清单

- 先复制色彩 token，保证 light/dark 都完整。
- 全局接入 Inter 或系统 sans-serif，mono 使用 JetBrains Mono。
- 基础组件统一改成直角、细边框、小字号。
- 页面先搭 sidebar、sticky header、主内容容器，再放业务卡片。
- 数据表、筛选条、详情抽屉、代码块优先做完整。
- 主色只用在关键动作、当前状态和选中态。
- 所有长文本加 `min-w-0`、`truncate`、`line-clamp` 或 `overflow-auto`。
- 最后检查移动端：筛选条要落到单列，表格允许横向滚动。
