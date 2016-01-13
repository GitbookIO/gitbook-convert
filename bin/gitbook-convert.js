#! /usr/bin/env node

var _ = require('lodash');
var program = require('commander');

var gitbookConvert = require('../lib/index');

var allowedFormats = require('../lib/converters').allowedFormats;
var pkg = require('../package.json');

program
    .version(pkg.version)
    .usage('[options] <file>')
    .option('-e, --export-dir [dirname]', 'Name of the main export directory', 'export')
    .option('-a, --assets-dir [dirname]', 'Name of the document\'s assets export directory', 'assets');

program.on('--help', function() {
    console.log('  gitbook-convert accepts the following formats:');
    console.log('');
    allowedFormats.forEach(function(format) {
        console.log('    .'+format.ext+': '+format.description);
    });
    console.log('');
    console.log('  After converting your document, the corresponding GitBook files will be placed in ./export/<file>/.');
});

program.parse(process.argv);

// Parse and fallback to help if no args
if(_.isEmpty(program.parse(process.argv).args) && process.argv.length === 2) {
    program.help();
}

var opts = {
    filename: program.args[0],
    rootDirectory: program.exportDir,
    assetsDirectory: program.assetsDir
};

var converter = gitbookConvert.pickConverter(opts);
converter.convert();