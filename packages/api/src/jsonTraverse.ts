export function nav(node: any, ...keys: (string | number)[]): any {
  if (node === null || node === undefined) return null;
  let current = node;
  for (const key of keys) {
    if (current === null || current === undefined) return null;
    if (typeof key === 'string') {
      current = (typeof current === 'object' && key in current) ? current[key] : null;
    } else if (typeof key === 'number') {
      current = (Array.isArray(current) && key >= 0 && key < current.length) ? current[key] : null;
    } else {
      return null;
    }
  }
  return current;
}

export function traverse(node: any, ...keys: string[]): any {
  if (node === null || node === undefined) return null;
  let current = node;
  for (let i = 0; i < keys.length; i++) {
    const isLast = (i === keys.length - 1);
    current = again(current, keys[i], isLast);
  }
  return current;
}

function again(data: any, key: string, deadEnd: boolean): any {
  if (data === null || data === undefined) return null;
  const res: any[] = [];

  if (typeof data === 'object' && !Array.isArray(data) && (key in data)) {
    const val = data[key];
    if (val !== null && val !== undefined) {
      res.push(val);
      if (deadEnd) {
        return res.length === 1 ? res[0] : res;
      }
    }
  }

  if (Array.isArray(data)) {
    for (const item of data) {
      const itemRes = again(item, key, deadEnd);
      if (itemRes !== null && itemRes !== undefined) {
        if (Array.isArray(itemRes)) {
          for (const child of itemRes) {
            if (child !== null && child !== undefined) res.push(child);
          }
        } else {
          res.push(itemRes);
        }
      }
    }
  } else if (typeof data === 'object' && data !== null) {
    for (const k of Object.keys(data)) {
      const itemRes = again(data[k], key, deadEnd);
      if (itemRes !== null && itemRes !== undefined) {
        if (Array.isArray(itemRes)) {
          for (const child of itemRes) {
            if (child !== null && child !== undefined) res.push(child);
          }
        } else {
          res.push(itemRes);
        }
      }
    }
  }

  if (res.length === 1) return res[0];
  if (res.length > 1) return res;
  return null;
}

export function traverseList(data: any, ...keys: string[]): any[] {
  const traversed = traverse(data, ...keys);
  if (traversed === null || traversed === undefined) return [];
  if (Array.isArray(traversed)) {
    return traversed.filter(item => item !== null && item !== undefined);
  }
  return [traversed];
}

export function traverseString(data: any, ...keys: string[]): string {
  const list = traverseList(data, ...keys);
  if (list.length > 0 && list[0] !== null && list[0] !== undefined) {
    const node = list[0];
    if (typeof node === 'object') {
      return JSON.stringify(node);
    }
    return String(node);
  }
  return '';
}
