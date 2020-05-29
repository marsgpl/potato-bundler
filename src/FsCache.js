class FsCache {
    dirs = {};
    files = {};
    stats = {};

    getDir(path) {
        return this.dirs[path];
    }

    putDir(path, paths) {
        this.dirs[path] = paths;
    }

    getFile(path) {
        return this.files[path];
    }

    putFile(path, content) {
        this.files[path] = content;
    }

    getStat(path) {
        return this.stats[path];
    }

    putStat(path, stat) {
        this.stats[path] = stat;
    }
}

module.exports = FsCache;
