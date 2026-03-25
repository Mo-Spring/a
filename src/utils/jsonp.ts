/**
 * 统一 JSONP 管理器
 *
 * 职责：
 * - 请求去重（同一 key 不重复发）
 * - 超时清理（防止内存泄漏）
 * - 全局清理（组件卸载时批量清理）
 * - 错误兜底（自动尝试 fetch fallback）
 */

const pendingRequests = new Map<string, void>();

let counter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`;
}

function cleanupScript(cbName: string, key?: string) {
  if (key) pendingRequests.delete(key);
  delete (window as any)[cbName];
  document.getElementById(cbName)?.remove();
}

export interface JsonpOptions {
  /** 去重 key，相同 key 的并发请求会被跳过 */
  key?: string;
  /** 超时毫秒数，默认 10000 */
  timeout?: number;
  /** JSONP 失败后是否尝试 fetch fallback，默认 false */
  fetchFallback?: string;
}

/**
 * 发起 JSONP 请求，返回 Promise
 */
export function jsonp<T = any>(url: string, options: JsonpOptions = {}): Promise<T> {
  const { key, timeout = 10000, fetchFallback } = options;

  if (key && pendingRequests.has(key)) {
    return Promise.reject(new Error('duplicate'));
  }

  return new Promise<T>((resolve, reject) => {
    const cbName = uniqueId('jsonp');
    if (key) pendingRequests.set(key, undefined as any);

    const timer = setTimeout(() => {
      cleanupScript(cbName, key);
      reject(new Error('JSONP timeout'));
    }, timeout);

    (window as any)[cbName] = (data: T) => {
      clearTimeout(timer);
      cleanupScript(cbName, key);
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = cbName;
    if (key) script.dataset.jsonpKey = key;
    script.src = url;
    script.onerror = () => {
      clearTimeout(timer);
      cleanupScript(cbName, key);

      if (fetchFallback) {
        fetch(fetchFallback)
          .then(r => r.json())
          .then(resolve)
          .catch(reject);
      } else {
        reject(new Error('JSONP load error'));
      }
    };

    document.head.appendChild(script);
  });
}

/**
 * 批量清理所有 pending JSONP 脚本
 * 在组件卸载时调用，防止内存泄漏
 */
export function cleanupAllJsonp() {
  document.querySelectorAll('script[id^="jsonp_"]').forEach(el => {
    const id = el.getAttribute('id');
    const key = (el as HTMLElement).dataset.jsonpKey;
    if (id) cleanupScript(id, key);
  });
  pendingRequests.clear();
}
