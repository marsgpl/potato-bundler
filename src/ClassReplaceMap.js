const ntob = require('./ntob');

class ClassReplaceMap {
    nextIndex = 1;
    map = {};

    generate = () => ntob(this.nextIndex++);

    associate(className) {
        const hasLeadingDot = className.startsWith('.');

        if (hasLeadingDot) {
            className = className.substr(1);
        }

        let substitute = this.map[className];

        if (!substitute) {
            substitute = this.map[className] = this.generate();
        }

        return hasLeadingDot ? `.${substitute}` : substitute;
    }
}

module.exports = ClassReplaceMap;
