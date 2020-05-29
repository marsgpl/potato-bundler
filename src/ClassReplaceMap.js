const ntob = require('./ntob');

const BAD_FIRST_SYMBOLS_FOR_CLASS_NAME = {
    '-': true,
    '0': true,
    '1': true,
    '2': true,
    '3': true,
    '4': true,
    '5': true,
    '6': true,
    '7': true,
    '8': true,
    '9': true,
};

class ClassReplaceMap {
    nextIndex = 0;
    map = {};
    existanceMap = {};

    generate = () => ntob(this.nextIndex++);

    isBadClassName = className => BAD_FIRST_SYMBOLS_FOR_CLASS_NAME[className[0]];

    associate(className, type = '') {
        const hasLeadingDot = className.startsWith('.');

        if (hasLeadingDot) {
            className = className.substr(1);
        }

        const map = this.map;

        let substitute = map[className];

        if (!substitute) {
            do {
                substitute = map[className] = this.generate();
            } while (this.isBadClassName(substitute));
        }

        this.existanceMap[type] = this.existanceMap[type] || {};
        this.existanceMap[type][className] = true;

        return hasLeadingDot ? `.${substitute}` : substitute;
    }
}

module.exports = ClassReplaceMap;
