import * as path from 'path';

/**
 * Finds the longest common directory path among a list of absolute file paths.
 */
export function getCommonBaseDir(filePaths: string[]): string {
  if (!filePaths || filePaths.length === 0) return '';
  if (filePaths.length === 1) return path.dirname(filePaths[0]);

  // Split paths into parts
  const splitPaths = filePaths.map(p => path.normalize(p).split(path.sep));
  
  let commonPath = '';
  for (let i = 0; i < splitPaths[0].length; i++) {
    const part = splitPaths[0][i];
    // Check if this part matches in all other paths
    const isCommon = splitPaths.every(parts => parts[i] === part);
    if (isCommon) {
      commonPath = commonPath === '' ? part : commonPath + path.sep + part;
    } else {
      break;
    }
  }
  
  return commonPath;
}

/**
 * Transforms a list of absolute file paths into a simple ASCII tree representation.
 */
export function buildFileTree(filePaths: string[]): string {
  if (!filePaths || filePaths.length === 0) return 'No files found.';

  const baseDir = getCommonBaseDir(filePaths);
  
  // Convert to relative paths
  const relativePaths = filePaths
    .map(p => path.relative(baseDir, p))
    .filter(p => p.length > 0)
    .sort(); // sort alphabetically

  if (relativePaths.length === 0) return 'No files found.';

  // Build tree structure
  const tree: any = {};
  
  for (const relPath of relativePaths) {
    const parts = relPath.split(path.sep);
    let current = tree;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = null; // null represents a file
      } else {
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  }

  // Generate ASCII representation
  let output = `/\n`;
  
  function renderTree(node: any, prefix: string = '') {
    const keys = Object.keys(node);
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const isLast = i === keys.length - 1;
      const isFile = node[key] === null;
      
      const connector = isLast ? '└── ' : '├── ';
      output += `${prefix}${connector}${key}\n`;
      
      if (!isFile) {
        const nextPrefix = prefix + (isLast ? '    ' : '│   ');
        renderTree(node[key], nextPrefix);
      }
    }
  }
  
  renderTree(tree);
  return output.trim();
}
