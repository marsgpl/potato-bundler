async function replaceAsync(text, regexp, newValue) {
    let m;
    let lastIndex = 0;

    while (m = regexp.exec(text)) {
        const index = m.index;
        if (index < lastIndex) break;
        const [match] = m;
        const value = await newValue(m);
        lastIndex = index + match.length;
        text = `${text.substr(0, index)}${value}${text.substr(lastIndex)}`;
    }

    return text;
};

module.exports = replaceAsync;
