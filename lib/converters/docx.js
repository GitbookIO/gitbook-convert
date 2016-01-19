var fs = require('fs');
var path = require('path');
var util = require('util');

var Q = require('q');
var mammoth = require('mammoth');
var normall = require('normall');

var HTMLBaseConverter = require('./html-base');

// Inherit HTMLBaseConverter
function DocxConverter(opts) {
    DocxConverter.super_.call(this, opts);
}

util.inherits(DocxConverter, HTMLBaseConverter);

// Implement toHTML()
DocxConverter.prototype.toHTML = function() {
    var that = this;
    var d = Q.defer();

    // counter for default name (altText unavailable)
    var imgCounter = 0;

    // imgExporter exports inline images to the assets folder and apply src attribute to HTML correctly
    var imgExporter = mammoth.images.inline(function(element) {
        return element.read().then(function(imageBuffer) {
            // Set image file name
            var imgFilename;

            // Use altText for image name
            if (!!element.altText) {
                // From docx documents, alt Text can be a bit long and noisy...
                element.altText = element.altText.replace(/\t\r\n\v/g, ' ');
                element.altText = element.altText.slice(0, 40).trim();

                imgFilename = element.altText;

                // Remove extension in altText if is equal to contentType
                var contentType = 'image/'+path.extname(imgFilename).slice(1);
                if (element.contentType === contentType) {
                    imgFilename = imgFilename.split('.').slice(0, -1).join('.');
                }

                // Shorten if too long
                imgFilename = imgFilename.slice(0, 35);
            }

            // Normalize filename
            imgFilename = normall.filename(imgFilename);

            // Or use default name -> img-NN.ext
            if (!imgFilename) {
                imgFilename = 'img-'+imgCounter;
                imgCounter++;
            }
            // Add extension
            imgFilename = imgFilename+'.'+element.contentType.split('/')[1];
            // Create path
            var imgPath = path.join(that._assetsFolder, imgFilename);

            // Write on disk
            fs.writeFile(imgPath, imageBuffer, function (err) {
                if (err) console.error('Unable to save image '+imgPath);
                else console.log('Successfully exported image '+imgPath);
            });

            // Return correct HTML src attribute
            return {
                src: path.resolve(process.cwd(), imgPath),
                alt: element.altText
            };
        });
    });

    // Set mammoth options
    var mammothOpts = {
        convertImage: imgExporter
    };

    // Convert to HTML
    console.log('Converting docx file to HTML...');
    mammoth.convertToHtml({ path: that.filepath }, mammothOpts)
    .then(function(result) {
        console.log('Done.');

        // The generated HTML
        that._html = result.value;
        // Any messages, such as warnings during conversion
        var messages = result.messages;
        if (that.debug) console.log(messages);

        d.resolve();
    })
    .fail(function(err) {
        d.reject(err);
    });

    return d.promise;
};

module.exports = DocxConverter;