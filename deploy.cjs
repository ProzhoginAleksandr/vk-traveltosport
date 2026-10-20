// deploy.cjs — запуск vk-miniapps-deploy с явным выбором окружения.
// Использование: node deploy.cjs [dev|production|both] (по умолчанию both)
const { spawnSync } = require('child_process');
const path = require('path');

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