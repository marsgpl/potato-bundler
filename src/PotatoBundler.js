class PotatoBundler {
    constructor(args) {
        this.parseArgs(args);
        console.log('this:', this);
    }

    parseArgs(args) {
        for (let i = 2; i < args.length; ++i) {
            const arg = args[i];

            if (arg.startsWith('--') && arg.includes('=')) {
                const [name, value] = arg.substr(2).split('=');

                if (name === 'in' || name === 'src' || name === 'from') {
                    this.src = value;
                } else if (name === 'out' || name === 'dst' || name === 'to') {
                    this.dst = value;
                } else if (name == 'entry') {
                    this.entry = value;
                }
            }
        }
    }
}

module.exports = PotatoBundler;
