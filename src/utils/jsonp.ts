/**
 * 统一 JSONP 管理器
 *
 * 职责：
 * - 超时清理（防止内存泄漏）
 * - 全局清理（组件卸载时批量清理）
 * - 错误兜底（自动尝试 fetch fallback）
 *
 * 注意：与原始内联 JSONP 行为一致，不做请求去重。
 * 每次调用生成唯一回调名，由调用方自行控制频率。
 */

let counter = 0;
function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${++counter}`;
}

function cleanupScript(cbName: string) {
  delete (window as any)[cbName];
  document.getElementById(cbName)?.remove();
}

export interface JsonpOptions {
  /** 超时毫秒数，默认 10000 */
  timeout?: number;
  /** JSONP 失败后是否尝试 fetch fallback，默认 false */
  fetchFallback?: string;
}

/**
 * 发起 JSONP 请求，返回 Promise
 */
export function jsonp<T = any>(url: string, options: JsonpOptions = {}): Promise<T> {
  const { timeout = 10000, fetchFallback } = options;

  return new Promise<T>((resolve, reject) => {
    const cbName = uniqueId('jsonp');

    const timer = setTimeout(() => {
      cleanupScript(cbName);
      reject(new Error('JSONP timeout'));
    }, timeout);

    (window as any)[cbName] = (data: T) => {
      clearTimeout(timer);
      cleanupScript(cbName);
      resolve(data);
    };

    const script = document.createElement('script');
    script.id = cbName;
    script.src = url.replace(/([?&])cb=[^&]*/, `$1cb=${cbName}`);
    script.onerror = () => {
      clearTimeout(timer);
      cleanupScript(cbName);

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
    if (id) cleanupScript(id);
  });
}
