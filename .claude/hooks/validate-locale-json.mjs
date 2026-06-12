import fs from 'node:fs';

let input = '';
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = data.tool_input?.file_path;
  if (!filePath || !/src\/i18n\/locales\/.*\.json$/.test(filePath)) {
    process.exit(0);
  }

  try {
    JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.log(JSON.stringify({
      decision: 'block',
      reason: `Invalid JSON in ${filePath}: ${err.message}`,
    }));
  }
});
