// https://stackoverflow.com/questions/6213227/fastest-way-to-convert-a-number-to-radix-64-in-javascript

const alphabet = '-_0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const ntob = function(number) {
    if (number < 0) return `-${ntob(-number)}`;

    let lo = number >>> 0;
    let hi = (number / 4294967296) >>> 0;

    let right = '';

    while (hi > 0) {
        right = alphabet[0x3f & lo] + right;
        lo >>>= 6;
        lo |= (0x3f & hi) << 26;
        hi >>>= 6;
    }

    let left = '';

    do {
        left = alphabet[0x3f & lo] + left;
        lo >>>= 6;
    } while (lo > 0);

    return left + right;
};

module.exports = ntob;
