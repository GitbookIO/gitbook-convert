const path = require('path');

const Chapter = require('./chapter');

class Readme extends Chapter {
    setTitle() {
        this.content = this.titleHTML + this.content;
        delete this.titleHTML;
    }

    static generate(ext, documentTitle, rootDir, content) {
        const readme = new Readme(rootDir);

        const defaultContent = '<p>This file serves as your book\'s preface, a great place to describe your book\'s content and ideas.</p>';

        readme.titleHTML = '<h1>' + documentTitle + '</h1>';
        readme.content   = content || defaultContent;

        readme.title    = documentTitle;
        readme.level    = 0;
        readme.children = [];

        readme.path        = rootDir;
        readme.filename    = 'README.' + ext;
        readme.summaryPath = path.join(readme.path, readme.filename);
        readme.filepath    = path.join(readme.rootDir, readme.filename);

        return readme;
    }
}

module.exports = Readme;
