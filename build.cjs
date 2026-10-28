// build.cjs — сборка проекта: проверка типов (tsc) + сборка (vite build).
//
// Зачем нужен этот файл вместо простого "tsc && vite build":
// esbuild обменивается с дочерним процессом через временные файлы в системном %TEMP%.
// На Windows антивирус иногда держит только что созданный файл открытым, и тогда
// дочерний процесс esbuild падает с "remove ...: Access is denied", роняя всю сборку.
// Поэтому сборке выдаётся собственный временный каталог внутри проекта, а не общий системный.
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const tmpDir = path.join(root, '.tmp-build');

fs.mkdirSync(tmpDir, { recursive: true });

const env = { ...process.env, TEMP: tmpDir, TMP: tmpDir };

const run = (title, scriptRelPath, args) => {
  const script = path.join(root, 'node_modules', scriptRelPath);
  if (!fs.existsSync(script)) {
    console.error(`Не найден ${scriptRelPath}. Выполните npm install.`);
    return 1;
  }
  console.log(`\n> ${title}\n`);
  const result = spawnSync(process.execPath, [script, ...args], {
    stdio: 'inherit',
    env,
    cwd: root,
  });
  return result.status === null ? 1 : result.status;
};

let code = run('tsc', path.join('typescript', 'bin', 'tsc'), []);
if (code === 0) code = run('vite build', path.join('vite', 'bin', 'vite.js'), ['build']);

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {
  /* каталог будет переиспользован при следующей сборке */
}

process.exit(code);
