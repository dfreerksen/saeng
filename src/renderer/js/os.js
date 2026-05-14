export function getOS () {
  const platform = process.platform.toLowerCase();
  if (platform.includes('win')) return 'win32';
  if (platform.includes('mac')) return 'darwin';
  if (platform.includes('linux')) return 'linux';
  return 'unknown';
}

export function isWindows () {
  return getOS() === 'win32';
}

export function isMac () {
  return getOS() === 'darwin';
}

export function isLinux () {
  return getOS() === 'linux';
}
