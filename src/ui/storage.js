// Tiny localStorage wrapper that never throws (private mode etc.).
export function load(key, fallback) {
  try {
    return localStorage.getItem(`voxel-explorer:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(`voxel-explorer:${key}`, value);
  } catch {
    /* ignore */
  }
}
