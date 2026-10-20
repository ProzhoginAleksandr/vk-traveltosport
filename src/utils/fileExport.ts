// src/utils/fileExport.ts
// Отдать файл пользователю. Что именно сработает, зависит от клиента VK:
// в мобильных WebView скачивание часто молча не срабатывает, поэтому результат — «попытка», а не гарантия.

export type SaveFileResult = 'shared' | 'cancelled' | 'download-attempted' | 'failed';

export const textToFile = (text: string, filename: string, mime: string): File =>
  new File([text], filename, { type: mime });

export const saveFile = async (file: File): Promise<SaveFileResult> => {
  // 1. Системное меню «Поделиться» с файлом
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }

  // 2. Обычное скачивание через blob-ссылку
  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'download-attempted';
  } catch {
    return 'failed';
  }
};
