// A tiny simulated filesystem for a device under investigation.
// Supports normal files, "deleted" files (recoverable), and hidden files.

export class VFile {
  constructor({ name, content = "", deleted = false, hidden = false, locked = false, tag = null }) {
    this.name = name;
    this.content = content;
    this.deleted = deleted;   // needs PERCEPTION/recover to find
    this.hidden = hidden;     // not shown by plain ls; needs ls -a
    this.locked = locked;     // encrypted; needs a key/crack
    this.tag = tag;           // optional evidence tag id
  }
}

export class VDir {
  constructor(name) {
    this.name = name;
    this.children = new Map(); // name -> VFile | VDir
  }
  add(node) {
    this.children.set(node.name, node);
    return this;
  }
  get(name) {
    return this.children.get(name);
  }
  list({ all = false, includeDeleted = false } = {}) {
    const out = [];
    for (const node of this.children.values()) {
      if (node instanceof VFile) {
        if (node.deleted && !includeDeleted) continue;
        if (node.hidden && !all) continue;
      }
      out.push(node);
    }
    return out;
  }
}

export function isDir(node) {
  return node instanceof VDir;
}
export function isFile(node) {
  return node instanceof VFile;
}
