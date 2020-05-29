const Fs = require('./Fs');

class FsFetch {
    static async dir(path, cache) {
        const fromCache = cache && cache.getDir(path);
        const paths = fromCache !== undefined ?
            fromCache :
            await Fs.readDir(path);

        if (cache && !fromCache) {
            cache.putDir(path, paths);
        }

        return paths.filter(path =>
            path !== '.' && path !== '..');
    }

    static async file(path, cache) {
        const fromCache = cache && cache.getFile(path);
        const content = fromCache !== undefined ?
            fromCache :
            await Fs.readFile(path);

        if (cache && !fromCache) {
            cache.putFile(path, content);
        }

        return content;
    }

    static async stat(path, cache) {
        const fromCache = cache && cache.getStat(path);
        const stat = fromCache !== undefined ?
            fromCache :
            await Fs.stat(path);

        if (cache && !fromCache) {
            cache.putStat(path, stat);
        }

        return stat;
    }

    static async precachePath(path, cache, ignoreNames) {
        if (!cache) return;

        if (ignoreNames) {
            const name = path.substr(path.lastIndexOf('/') + 1);
            if (ignoreNames[name]) return;
        }

        const stat = await this.stat(path, cache);

        if (stat.isDirectory()) {
            await this.precacheDir(path, cache, ignoreNames);
        } else if (stat.isFile()) {
            await this.file(path, cache);
        } else {
            throw `FsFetch.precache: path "${path}" has unsupported type`;
        }
    }

    static async precacheDir(path, cache, ignoreNames) {
        const paths = await this.dir(path, cache);

        const promises = paths.map(name =>
            this.precachePath(`${path}/${name}`, cache, ignoreNames));

        await Promise.all(promises);
    }
}

module.exports = FsFetch;
