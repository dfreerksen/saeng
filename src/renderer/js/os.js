export function getOS() {
  const platform = navigator.platform.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  if (platform.includes('linux')) return 'linux';
  return 'unknown';
}

export function isWindows() {
  return getOS() === 'windows';
}

export function isMacOS() {
  return getOS() === 'macos';
}

export function isLinux() {
  return getOS() === 'linux';
}
