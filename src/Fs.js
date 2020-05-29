const fs = require('fs');
const path = require('path');

class Fs {
    static async copy(from, to) {
        return new Promise((resolve, reject) => {
            fs.copyFile(from, to, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static ext(path) {
        return path
            .substr(path.lastIndexOf('.') + 1)
            .toLowerCase()
            .trim();
    }

    static readFile(path, options = { encoding: 'utf8' }) {
        return new Promise((resolve, reject) => {
            fs.readFile(path, options, (error, data) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(data);
                }
            });
        });
    }

    static removeFile(path) {
        return new Promise((resolve, reject) => {
            fs.unlink(path, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static writeFile(path, data) {
        return new Promise((resolve, reject) => {
            fs.writeFile(path, data, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static readDir(path) {
        return new Promise((resolve, reject) => {
            fs.readdir(path, (error, files) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(files);
                }
            });
        });
    }

    static createDir(path, options = { recursive: true }) {
        return new Promise((resolve, reject) => {
            fs.mkdir(path, options, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static removeDir(path, options = { recursive: true, maxRetries: 1 }) {
        return new Promise((resolve, reject) => {
            fs.rmdir(path, options, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(true);
                }
            });
        });
    }

    static stat(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (error, stats) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stats);
                }
            });
        });
    }

    static exists(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (error, stats) => {
                resolve(Boolean(!error && stats));
            });
        });
    }

    static isDir(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (error, stats) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stats.isDirectory());
                }
            });
        });
    }

    static isFile(path) {
        return new Promise((resolve, reject) => {
            fs.stat(path, (error, stats) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stats.isFile());
                }
            });
        });
    }

    static accessibleForRead(path) {
        return new Promise((resolve, reject) => {
            fs.access(path, fs.constants.R_OK, (error) => {
                resolve(!error);
            });
        });
    }

    static accessibleForWrite(path) {
        return new Promise((resolve, reject) => {
            fs.access(path, fs.constants.W_OK, (error) => {
                resolve(!error);
            });
        });
    }

    static async canBeCreated(path) {
        while (path.length > 0) {
            if (!await Fs.exists(path)) {
                path = path.substr(0, path.lastIndexOf('/'));
                if (path === '') path = '/';
            } else {
                return await Fs.accessibleForWrite(path);
            }
        }

        return false;
    }
}

module.exports = Fs;
