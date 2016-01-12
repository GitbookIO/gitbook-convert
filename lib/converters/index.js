var docx = require('./docx');
var html = require('./html');

module.exports = {
    allowedFormats: [
        {
            description: 'Microsoft Office Open XML Document',
            ext: 'docx'
        },
        {
            description: 'HyperText Markup Language',
            ext: 'html'
        }
    ],
    docx: docx,
    html: html
};