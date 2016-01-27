#! /usr/bin/env node

var _ = require('lodash');
var program = require('commander');

var gitbookConvert = require('../lib/index');

var allowedFormats = require('../lib/converters').allowedFormats;
var pkg = require('../package.json');

program
    .version(pkg.version)
    .usage('[options] <file>')
    .option('-t, --document-title [string]', 'Name used for the main document title', null)
    .option('-a, --assets-dir [dirname]', 'Name of the document\'s assets export directory', 'assets')
    .option('-m, --max-depth [integer]', 'Maximum title depth to use to split your original document into sub-chapters', 2)
    .option('-p, --prefix', 'Prefix filenames by an incremental counter')
    .option('-d, --debug', 'Log stack trace when an error occurs');

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
    exportDir: program.args[1] || 'export',
    documentTitle: program.documentTitle,
    assetsDirectory: program.assetsDir,
    titleDepth: parseInt(program.maxDepth, 10),
    prefix: program.prefix,
    debug: program.debug
};

var converter;
try {
    converter = gitbookConvert.pickConverter(opts);
}
catch(err) {
    console.log(err.message);
    if (program.debug) console.log(err.stack);
    process.exit(1);
}

converter.convert();