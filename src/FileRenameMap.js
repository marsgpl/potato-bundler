const path = require('path');
const crypto = require('crypto');
const FsFetch = require('./FsFetch');

class FileRenameMap {
    map = {};
    hashMap = {};

    constructor(fsCache) {
        this.fsCache = fsCache;
        this.buildId = Date.now().toString();//.slice(0, -3);
    }

    async associate(fileSrcUrl, baseDstDir) {
        const questionMarkIndex = fileSrcUrl.indexOf('?');

        const fileSrcPath = questionMarkIndex > -1 ?
            fileSrcUrl.substr(0, questionMarkIndex) :
            fileSrcUrl;

        const ext = path.extname(fileSrcPath).toLowerCase();

        let map = this.map[ext];
        let hashMap = this.hashMap[ext];

        if (!map) {
            map = this.map[ext] = {};
        }

        if (!hashMap) {
            hashMap = this.hashMap[ext] = {};
        }

        let substitute = map[fileSrcPath];

        if (!substitute) {
            const content = await FsFetch.file(fileSrcPath, this.fsCache);

            const sha = crypto.createHash('sha1');
            sha.update(content);
            const hash = sha.digest('base64')
                .replace(/\//g, '-')
                .replace(/\+/g, '_')
                .replace(/=/g, '');

            let miniHash;

            for (let i = 1; i <= hash.length; ++i) {
                miniHash = hash.substr(0, i);
                if (!hashMap[miniHash]) break;
            }

            const name = `${miniHash}${ext}`;

            substitute = {
                name,
                hash,
                dst: `${baseDstDir}/${name}`,
            };

            map[fileSrcPath] = substitute;
            hashMap[miniHash] = true;
        }

        return substitute;
    }
}

module.exports = FileRenameMap;
