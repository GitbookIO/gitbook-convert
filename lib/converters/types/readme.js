var path = require('path');
var util = require('util');

var Chapter = require('./chapter');

function Readme(rootDir) {
    Readme.super_.call(this, rootDir);
}

// Inherit Chapter's methods
util.inherits(Readme, Chapter);

Readme.prototype.setTitle = function() {
    this.content = this.titleHTML + this.content;
    delete this.titleHTML;
};

Readme.generate = function(ext, documentTitle, rootDir, content) {
    var readme = new Readme(rootDir);

    var defaultContent = '<p>This file serves as your book\'s preface, a great place to describe your book\'s content and ideas.</p>';

    readme.titleHTML = '<h1>'+documentTitle+'</h1>';
    readme.content = content || defaultContent;

    readme.title = 'Introduction';
    readme.level = 0;
    readme.children = [];

    readme.path = '';
    readme.filename = 'README.'+ext;
    readme.summaryPath = path.join(readme.path, readme.filename);
    readme.filepath = path.join(readme.rootDir, readme.filename);

    return readme;
};

module.exports = Readme;