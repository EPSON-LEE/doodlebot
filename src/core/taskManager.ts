import { EventEmitter } from "events";
import { spawn, type ChildProcess } from "child_process";

/**
 * 后台任务的状态定义
 */
export interface BackgroundTask {
  id: string;
  command: string;
  description: string;
  status: "pending" | "running" | "done" | "error" | "cancelled";
  stdout: string;
  stderr: string;
  exitCode: number | null;
  startedAt: number;
  finishedAt: number | null;
  pid: number | null;
}

// stdout/stderr 滚动缓冲区大小
const MAX_BUFFER_SIZE = 5000;

/**
 * 生成短随机 ID（不引入额外依赖）
 */
function generateId(): string {
  return `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 追加内容到滚动缓冲区，保留最后 MAX_BUFFER_SIZE 个字符
 */
function appendToBuffer(existing: string, chunk: string): string {
  const combined = existing + chunk;
  if (combined.length > MAX_BUFFER_SIZE) {
    return combined.slice(-MAX_BUFFER_SIZE);
  }
  return combined;
}

/**
 * TaskManager — 后台任务共享状态管理器
 * 
 * 使用 EventEmitter 实现，支持以下事件：
 * - 'task:start'  (task: BackgroundTask)
 * - 'task:done'   (task: BackgroundTask)
 * - 'task:error'  (task: BackgroundTask)
 * - 'task:cancel' (task: BackgroundTask)
 */
export class TaskManager extends EventEmitter {
  private tasks: Map<string, BackgroundTask> = new Map();
  private processes: Map<string, ChildProcess> = new Map();

  /**
   * 启动一个后台命令，立即返回 TaskID
   */
  spawn(command: string, description: string = ""): BackgroundTask {
    const id = generateId();

    const task: BackgroundTask = {
      id,
      command,
      description: description || command,
      status: "pending",
      stdout: "",
      stderr: "",
      exitCode: null,
      startedAt: Date.now(),
      finishedAt: null,
      pid: null,
    };

    this.tasks.set(id, task);

    // 启动子进程
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    task.pid = child.pid ?? null;
    task.status = "running";
    this.processes.set(id, child);
    this.emit("task:start", task);

    // 收集 stdout
    child.stdout?.on("data", (chunk: Buffer) => {
      task.stdout = appendToBuffer(task.stdout, chunk.toString());
    });

    // 收集 stderr
    child.stderr?.on("data", (chunk: Buffer) => {
      task.stderr = appendToBuffer(task.stderr, chunk.toString());
    });

    // 进程退出
    child.on("close", (code) => {
      task.exitCode = code;
      task.finishedAt = Date.now();
      this.processes.delete(id);

      if (task.status === "cancelled") {
        // 已被手动取消，不覆盖状态
        return;
      }

      if (code === 0) {
        task.status = "done";
        this.emit("task:done", task);
      } else {
        task.status = "error";
        this.emit("task:error", task);
      }
    });

    // 进程启动失败
    child.on("error", (err) => {
      task.status = "error";
      task.stderr = appendToBuffer(task.stderr, err.message);
      task.finishedAt = Date.now();
      this.processes.delete(id);
      this.emit("task:error", task);
    });

    return task;
  }

  /**
   * 查询单个任务
   */
  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * 列出所有任务，可按状态过滤
   */
  listTasks(filter?: BackgroundTask["status"]): BackgroundTask[] {
    const all = Array.from(this.tasks.values());
    if (filter) {
      return all.filter((t) => t.status === filter);
    }
    return all;
  }

  /**
   * 取消一个正在运行的任务
   * 先发送 SIGTERM，2 秒后若未退出则 SIGKILL
   */
  cancelTask(id: string): boolean {
    const task = this.tasks.get(id);
    const child = this.processes.get(id);

    if (!task || !child || task.status !== "running") {
      return false;
    }

    task.status = "cancelled";
    task.finishedAt = Date.now();

    // 优雅终止
    child.kill("SIGTERM");

    // 2 秒后强制终止
    setTimeout(() => {
      if (!child.killed) {
        child.kill("SIGKILL");
      }
    }, 2000);

    this.emit("task:cancel", task);
    return true;
  }

  /**
   * 格式化任务状态为可读文本
   */
  formatTask(task: BackgroundTask): string {
    const elapsed = task.finishedAt
      ? ((task.finishedAt - task.startedAt) / 1000).toFixed(1) + "s"
      : ((Date.now() - task.startedAt) / 1000).toFixed(1) + "s (running)";

    const statusMap: Record<BackgroundTask["status"], string> = {
      pending: "⏳ 等待中",
      running: "▶ 运行中",
      done: "✅ 已完成",
      error: "❌ 出错",
      cancelled: "🚫 已取消",
    };

    let result = `[${task.id}] ${statusMap[task.status]} | ${task.description} | ${elapsed}`;

    if (task.stdout) {
      // 只取最后 500 字符作为摘要
      const summary = task.stdout.length > 500 ? "..." + task.stdout.slice(-500) : task.stdout;
      result += `\n输出:\n${summary}`;
    }

    if (task.stderr && task.status === "error") {
      const summary = task.stderr.length > 500 ? "..." + task.stderr.slice(-500) : task.stderr;
      result += `\n错误:\n${summary}`;
    }

    return result;
  }

  /**
   * 清理已完成的任务记录（释放内存）
   */
  cleanup(): void {
    for (const [id, task] of this.tasks) {
      if (task.status === "done" || task.status === "error" || task.status === "cancelled") {
        this.tasks.delete(id);
      }
    }
  }
}

/**
 * 全局单例
 */
export const taskManager = new TaskManager();
