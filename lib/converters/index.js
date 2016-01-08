var docx = require('./docx');

module.exports = {
    allowedFormats: [
        {
            description: 'Microsoft Office Open XML Document',
            ext: 'docx'
        }
    ],
    docx: docx
};