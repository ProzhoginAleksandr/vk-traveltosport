// deploy.cjs — запуск vk-miniapps-deploy с явным выбором окружения.
// Использование: node deploy.cjs [dev|production|both] (по умолчанию both)
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// vk-miniapps-deploy читает токен только из process.env (MINI_APPS_ACCESS_TOKEN)
// или из своего системного хранилища, но не из .env — читаем .env сами.
// Значения из реального окружения имеют приоритет.
function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (value.length > 1 && (value[0] === '"' || value[0] === "'") && value.endsWith(value[0])) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.join(__dirname, '.env'));

const envName = (process.argv[2] || 'both').toLowerCase();
const allowed = ['dev', 'production', 'both'];
if (!allowed.includes(envName)) {
  console.error(`Неизвестное окружение: "${envName}". Используйте: dev | production | both`);
  process.exit(1);
}

console.log(`\n🚀 Деплой в окружение: ${envName}\n`);

const result = spawnSync('vk-miniapps-deploy', [], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    MINI_APPS_ENVIRONMENT: envName,
  },
  cwd: path.resolve(__dirname),
});

process.exit(result.status ?? 1);