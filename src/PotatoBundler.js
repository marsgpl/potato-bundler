const os = require('os');
const path = require('path');
const parse5 = require('parse5');
const csso = require('csso');
const ClosureCompiler = require('google-closure-compiler').compiler;
const Fs = require('./Fs');
const FsCache = require('./FsCache');
const FsFetch = require('./FsFetch');
const HtmlExtractor = require('./HtmlExtractor');
const ClassReplaceMap = require('./ClassReplaceMap');
const FileRenameMap = require('./FileRenameMap');

const USAGE = [
    'Usage: npx potato-bundler --src=DIRECTORY --dst=DIRECTORY [--force-delete-dst] [--lang=FILE]',
    '    --src - directory with sources',
    '    --dst - directory to store compressed bundle',
    '    --force-delete-dst - delete dst directory if it exists',
    '    --lang - json file with translation, see ' +
        path.resolve(__dirname + '/../example/src/lang.json'),
].join('\n');

class PotatoBundler {
    constructor(args) {
        this.fsCache = new FsCache;
        this.classReplaceMap = new ClassReplaceMap;
        this.fileRenameMap = new FileRenameMap(this.fsCache);
        this.parseArgs(args);
    }

    async start() {
        await this.checkInitialSettings();
        await this.initLang();
        await this.bundleDir(this.src, this.dst);

        this.checkCssClassesExistanceInHtmlAndJs();
    }

    checkCssClassesExistanceInHtmlAndJs() {
        const { css, html, js } = this.classReplaceMap.existanceMap;

        if (!css || !html) return;

        const errors = [];

        Object.keys(css).forEach(className => {
            if (!html[className] && !js[className]) {
                errors.push(`class name "${className}" exists only in styles`);
            }
        });

        if (errors.length > 0) {
            this.warning(errors);
        }
    }

    async checkInitialSettings() {
        const errors = [];

        if (!this.src) {
            errors.push('src is not defined');
        } else if (!await Fs.exists(this.src)) {
            errors.push(`src "${this.src}" does not exist`);
        } else if (!await Fs.isDir(this.src)) {
            errors.push(`src "${this.src}" is not a directory`);
        } else if (!await Fs.accessibleForRead(this.src)) {
            errors.push(`src "${this.src}" is not accessible for reading`);
        }

        if (!this.dst) {
            errors.push('dst is not defined');
        } else if (await Fs.exists(this.dst)) {
            if (!this.forceDeleteDst) {
                errors.push(`dst "${this.dst}" already exists and flag --force-delete-dst is not specified`);
            } else if (!await Fs.accessibleForWrite(this.dst)) {
                errors.push(`dst "${this.dst}" can't be deleted: access denied`);
            }
        } else { // does not exist
            if (!await Fs.canBeCreated(this.dst)) {
                errors.push(`dst "${this.dst}" can't be created because parent directory is not accessible`);
            }
        }

        if (this.langFile) {
            if (!await Fs.exists(this.langFile)) {
                errors.push(`lang "${this.langFile}" does not exist`);
            } else if (!await Fs.isFile(this.langFile)) {
                errors.push(`lang "${this.langFile}" is not a file`);
            } else if (!await Fs.accessibleForRead(this.langFile)) {
                errors.push(`lang "${this.langFile}" is not accessible for read`);
            }
        }

        if (errors.length > 0) {
            this.fail(errors);
        }
    }

    fail(errors = []) {
        console.error(`Fail: ${errors.join(', ') || '?'}\n\n${USAGE}`);
        process.exit(1);
    }

    warning(errors = []) {
        if (!errors.length) return;

        console.error(`Warning:\n    ${errors.join('\n    ')}`);
    }

    parseArgs(args) {
        const errors = [];

        for (let i = 2; i < args.length; ++i) {
            const arg = args[i];

            if (arg.startsWith('--')) {
                const [name, value] = arg.substr(2).split('=');

                if (name === 'src') {
                    this.src = value.startsWith('/') ? value : path.resolve('./' + value);
                } else if (name === 'dst') {
                    this.dst = value.startsWith('/') ? value : path.resolve('./' + value);
                } else if (name === 'lang') {
                    this.langFile = value.startsWith('/') ? value : path.resolve('./' + value);
                } else if (name === 'force-delete-dst') {
                    this.forceDeleteDst = true;
                } else {
                    errors.push(`unsupported argument: "${arg}"`);
                }
            } else {
                errors.push(`unsupported argument: "${arg}"`);
            }
        }

        if (errors.length > 0) {
            this.fail(errors);
        }
    }

    async bundleDir(src, dst) {
        const paths = await FsFetch.dir(src, this.fsCache);
        const tasks = [];

        if (this.forceDeleteDst && await Fs.exists(dst)) {
            await Fs.removeDir(dst);
        }

        paths.forEach(path => {
            if (Fs.ext(path) === 'html') {
                tasks.push(this.bundleHtmlEntryPoint(`${src}/${path}`, `${dst}/${path}`));
            }
        });

        if (tasks.length > 0) {
            await Promise.all(tasks);
        }
    }

    async initLang() {
        if (!this.langFile) return;
        this.langs = JSON.parse(await FsFetch.file(this.langFile, this.fsCache));
    }

    replaceLang(bundle, bundleType) {
        if (!bundle.includes('#lang#')) {
            return bundle;
        }

        if (!this.langs) {
            this.fail([`lang file is not provided but #lang# entries exist in ${bundleType} bundle`]);
        }

        const errors = [];

        bundle = bundle.replace(/#lang#([^#]+)#/g, (_, key) => {
            const value = this.langs[key] || '';

            if (!value) {
                errors.push(`lang file missing key: "${key}"`);
            }

            return value;
        });

        if (errors.length > 0) {
            this.fail(errors);
        }

        return bundle;
    }

    async bundleHtmlEntryPoint(src, dst) {
        const htmlSource = await FsFetch.file(src, this.fsCache);
        const htmlRoot = parse5.parse(htmlSource);
        const baseSrcDir = path.dirname(src);
        const baseDstDir = path.dirname(dst);

        const html = [];
        const css = [];
        const js = [];

        await HtmlExtractor.extractCss(
            htmlRoot,
            css,
            baseSrcDir,
            baseDstDir,
            this.fsCache,
            this.classReplaceMap,
            this.fileRenameMap);

        await HtmlExtractor.extractJs(
            htmlRoot,
            js,
            baseSrcDir,
            baseDstDir,
            this.fsCache,
            this.classReplaceMap,
            this.fileRenameMap);

        const cssBundle = await this.postprocessCss(css);
        const jsBundle = await this.postprocessJs(js);

        this.bundleHtml(htmlRoot, html, cssBundle, jsBundle);

        const htmlBundle = this.replaceLang(html.join(''), 'html');

        await Fs.createDir(path.dirname(dst));
        await Fs.writeFile(dst, htmlBundle);
        await this.copyFiles();
    }

    async postprocessCss(chunks) {
        let bundle = chunks.join('').trim();
        if (!bundle) return '';

        bundle = this.replaceLang(bundle, 'css');

        bundle = csso.minify(bundle, {
            restructure: true,
            comments: false,
        }).css;

        return bundle;
    }

    async postprocessJs(chunks) {
        let bundle = chunks.join('').trim();
        if (!bundle) return '';

        bundle = this.replaceLang(bundle, 'js');

        bundle = `(function(window, document) {
            ${bundle}
        })(window, document);`;

        bundle = await this.compileJs(bundle);

        return bundle;
    }

    async compileJs(bundle) {
        const tmpFilePath = `${os.tmpdir()}/${Date.now()}.${Math.random()}.js`;

        await Fs.writeFile(tmpFilePath, bundle);

        return new Promise((resolve, reject) => {
            const closureCompiler = new ClosureCompiler({
                compilation_level: 'ADVANCED',
                js: tmpFilePath,
                env: 'BROWSER',
                language_in: 'ECMASCRIPT_NEXT',
                language_out: 'ECMASCRIPT5_STRICT',
                warning_level: 'VERBOSE',
                strict_mode_input: true,
                formatting: 'SINGLE_QUOTES',
                isolation_mode: 'NONE',
                charset: 'UTF-8',
            });

            closureCompiler.run((exitCode, stdout, stderr) => {
                if (exitCode !== 0 || stderr) {
                    Fs.removeFile(tmpFilePath).then(() => reject(stderr)).catch(reject);
                } else {
                    Fs.removeFile(tmpFilePath).then(() => resolve(stdout)).catch(reject);
                }
            });
        });
    }

    async copyFiles() {
        const tasks = [];
        const exts = this.fileRenameMap.map;

        Object.keys(exts).forEach(ext => {
            const paths = exts[ext];

            Object.keys(paths).forEach(src => {
                const dst = paths[src].dst;
                tasks.push(Fs.copy(src, dst));
            });
        });

        await Promise.all(tasks);
    }

    bundleHtml(tag, result, cssBundle, jsBundle) {
        const mustBeSkipped =
            HtmlExtractor.isStylesheetLinkTag(tag) ||
            HtmlExtractor.isScriptTag(tag) ||
            HtmlExtractor.isStyleTag(tag);

        if (mustBeSkipped) return;

        const tagName = tag.nodeName;
        const children = tag.childNodes;

        if (tagName === '#document') { // root
            children && children.forEach(child =>
                this.bundleHtml(child, result, cssBundle, jsBundle));
        } else if (tagName === '#documentType') {
            result.push(`<!DOCTYPE ${tag.name}>`);
        } else if (tagName === '#text') {
            const text = tag.value.trim();
            if (text.length > 0) {
                result.push(text);
            }
        } else {
            const hasChildren = children && children.length > 0;
            const mustBeClosed = hasChildren || !HtmlExtractor.isSelfClosingTag(tag);
            const attrs = HtmlExtractor.concatTagAttrs(tag, this.classReplaceMap);
            const attrsStr = attrs.length > 0 ? ' ' + attrs : '';

            result.push(`<${tagName}${attrsStr}>`);

            if (mustBeClosed) {
                children && children.forEach(child =>
                    this.bundleHtml(child, result, cssBundle, jsBundle));

                if (tagName === 'body' && jsBundle.length) {
                    result.push(`<script>${jsBundle}</script>`);
                } else if (tagName === 'head' && cssBundle.length) {
                    result.push(`<style>${cssBundle}</style>`);
                }

                result.push(`</${tagName}>`);
            }
        }
    }
}

module.exports = PotatoBundler;
