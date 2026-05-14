export function getOS () {
  const platform = window.electronAPI.platform;
  if (platform === 'darwin') return 'mac';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'unknown';
}

export function isWindows () {
  return getOS() === 'windows';
}

export function isMac () {
  return getOS() === 'mac';
}

export function isLinux () {
  return getOS() === 'linux';
}
