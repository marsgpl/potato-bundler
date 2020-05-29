const css = require('css');
const path = require('path');
const FsFetch = require('./FsFetch');
const replaceAsync = require('./replaceAsync');

const SELF_CLOSING_HTML_TAGS = {
    'area': true,
    'base': true,
    'br': true,
    'col': true,
    'embed': true,
    'hr': true,
    'img': true,
    'input': true,
    'link': true,
    'meta': true,
    'param': true,
    'source': true,
    'track': true,
    'wbr': true,
};

const cssUrlRegExp = /url\s*\(\s*'(.*?)'\s*\)|url\s*\(\s*"(.*?)"\s*\)|url\s*\(\s*(.*?)\s*\)/gi;

class HtmlExtractor {
    static isSelfClosingTag(tag) {
        return SELF_CLOSING_HTML_TAGS[tag.nodeName];
    }

    static isScriptTag(tag) {
        return tag.nodeName === 'script';
    }

    static isStyleTag(tag) {
        return tag.nodeName === 'style';
    }

    static isExternalLink(link) {
        return link.includes('?') || link.match(/^([a-z]+:)?\/\//i);
    }

    static isStylesheetLinkTag(tag) {
        if (tag.nodeName !== 'link') return false;

        const attrs = tag.attrs;
        if (!attrs) return false;

        for (let i = 0, c = attrs.length; i < c; ++i) {
            const attr = attrs[i];

            if (attr.name === 'rel') {
                return attr.value === 'stylesheet';
            }
        }

        return false;
    }

    static getTagAttribute(tag, attributeName) {
        const attrs = tag.attrs;
        if (!attrs) return '';

        for (let i = 0, c = attrs.length; i < c; ++i) {
            const attr = attrs[i];

            if (attr.name === attributeName) {
                return attr.value;
            }
        }

        return '';
    }

    static concatTagAttrs(tag, classReplaceMap) {
        const attrs = tag.attrs;
        if (!attrs) return '';

        const chunks = [];

        for (let i = 0, c = attrs.length; i < c; ++i) {
            const attr = attrs[i];
            const name = attr.name;

            let value = attr.value.trim().replace(/\s+/g, ' ');

            if (name === 'class') {
                value = value.split(' ').map(className =>
                    classReplaceMap.associate(className)).join(' ');
            }

            const needQuote = value.includes(' ');

            chunks.push(needQuote ? `${name}="${value}" ` : `${name}=${value}`);
        }

        return chunks.join(' ').trim();
    }

    static async extractJs(
        tag,
        chunks,
        baseSrcDir,
        baseDstDir,
        fsCache,
        classReplaceMap,
        fileRenameMap
    ) {
        const children = tag.childNodes;

        if (HtmlExtractor.isScriptTag(tag)) {
            const src = HtmlExtractor.getTagAttribute(tag, 'src');

            if (src) {
                if (HtmlExtractor.isExternalLink(src)) {
                    throw Error(`<script> src "${src}" is not supported`);
                }

                const fileSrcPath = path.resolve(baseSrcDir + '/' + src);
                const fileContent = await FsFetch.file(fileSrcPath, fsCache);

                const bundle = await HtmlExtractor.postprocessJs(
                    fileContent,
                    baseSrcDir,
                    baseDstDir,
                    classReplaceMap,
                    fileRenameMap,
                    fileSrcPath);

                chunks.push(bundle);
            } else if (children) {
                for (let i = 0; i < children.length; ++i) {
                    const child = children[i];

                    if (child.nodeName === '#text') {
                        const bundle = await HtmlExtractor.postprocessJs(
                            child.value,
                            baseSrcDir,
                            baseDstDir,
                            classReplaceMap,
                            fileRenameMap);

                        chunks.push(bundle);
                    }
                }
            }
        } else if (children) {
            for (let i = 0; i < children.length; ++i) {
                await HtmlExtractor.extractJs(
                    children[i],
                    chunks,
                    baseSrcDir,
                    baseDstDir,
                    fsCache,
                    classReplaceMap,
                    fileRenameMap);
            }
        }
    }

    static async extractCss(
        tag,
        chunks,
        baseSrcDir,
        baseDstDir,
        fsCache,
        classReplaceMap,
        fileRenameMap
    ) {
        const children = tag.childNodes;

        if (HtmlExtractor.isStyleTag(tag) && children) {
            for (let i = 0; i < children.length; ++i) {
                const child = children[i];

                if (child.nodeName === '#text') {
                    const bundle = await HtmlExtractor.postprocessCss(
                        child.value,
                        baseSrcDir,
                        baseDstDir,
                        classReplaceMap,
                        fileRenameMap);

                    chunks.push(bundle);
                }
            }
        } else if (HtmlExtractor.isStylesheetLinkTag(tag)) {
            const href = HtmlExtractor.getTagAttribute(tag, 'href');

            if (href) {
                if (HtmlExtractor.isExternalLink(href)) {
                    throw Error(`<link> href "${href}" is not supported`);
                }

                const fileSrcPath = path.resolve(baseSrcDir + '/' + href);
                const fileContent = await FsFetch.file(fileSrcPath, fsCache);

                const bundle = await HtmlExtractor.postprocessCss(
                    fileContent,
                    baseSrcDir,
                    baseDstDir,
                    classReplaceMap,
                    fileRenameMap,
                    fileSrcPath);

                chunks.push(bundle);
            }
        } else if (children) {
            for (let i = 0; i < children.length; ++i) {
                await HtmlExtractor.extractCss(
                    children[i],
                    chunks,
                    baseSrcDir,
                    baseDstDir,
                    fsCache,
                    classReplaceMap,
                    fileRenameMap);
            }
        }
    }

    static async postprocessJs(
        bundle,
        baseSrcDir,
        baseDstDir,
        classReplaceMap,
        fileRenameMap,
        fileSrcPath
    ) {
        const fileName = path.basename(fileSrcPath);

        if (fileName.toLowerCase() === 'css-classes.js') {
            bundle = bundle.replace(/\s*=\s*['"](\.[a-z0-9_-]+)['"]/gi, (_, className) =>
                `='${classReplaceMap.associate(className)}'`);
        }

        return bundle;
    }

    static async postprocessCss(
        bundle,
        baseSrcDir,
        baseDstDir,
        classReplaceMap,
        fileRenameMap,
        fileSrcPath
    ) {
        const parsed = css.parse(bundle, {
            silent: false,
            source: fileSrcPath,
        });

        const relativeDir = path.dirname(fileSrcPath)
            .substr(baseSrcDir.length)
            .replace(/^\//, './');

        await HtmlExtractor.postprocessCssRun(
            parsed,
            baseSrcDir,
            baseDstDir,
            relativeDir,
            classReplaceMap,
            fileRenameMap);

        return css.stringify(parsed, {
            compress: true,
        });
    }

    static async postprocessCssRun(
        parsed,
        baseSrcDir,
        baseDstDir,
        relativeDir,
        classReplaceMap,
        fileRenameMap
    ) {
        const type = parsed.type;

        let run = [];

        if (type === 'stylesheet') {
            run = run.concat(parsed.stylesheet.rules);
        } else if (
            type === 'supports' ||
            type === 'host' ||
            type === 'media' ||
            type === 'document'
        ) {
            run = run.concat(parsed.rules);
        } else if (type === 'keyframe' || type === 'font-face') {
            run = run.concat(parsed.declarations);
        } else if (type === 'keyframes') {
            run = run.concat(parsed.keyframes);
        } else if (type === 'page' || type === 'rule') {
            run = run.concat(parsed.declarations);

            parsed.selectors = parsed.selectors.map(selector =>
                selector.split(/\s+/g).map(chunk =>
                    chunk.replace(/^(\.[a-z0-9_-]+)/i, (_, className) =>
                        classReplaceMap.associate(className))).join(' '));
        } else if (type === 'declaration') {
            parsed.value = await replaceAsync(parsed.value, cssUrlRegExp, async m => {
                let url = m[1] || m[2] || m[3];
                const quote = url.includes(')') ? url.includes('"') ? '\'' : '"' : '';

                if (!HtmlExtractor.isExternalLink(url)) {
                    const fileSrcUrl = path.resolve(`${baseSrcDir}/${relativeDir}/${url}`);
                    const substitute = await fileRenameMap.associate(fileSrcUrl, baseDstDir);
                    url = substitute.name;
                }

                return `url(${quote}${url}${quote})`;
            });
        }

        if (run.length > 0) {
            await Promise.all(run.map(parsed =>
                HtmlExtractor.postprocessCssRun(
                    parsed,
                    baseSrcDir,
                    baseDstDir,
                    relativeDir,
                    classReplaceMap,
                    fileRenameMap)));
        }
    }
}

module.exports = HtmlExtractor;
