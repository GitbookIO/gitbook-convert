var fs = require('fs');
var path = require('path');

var Q = require('q');
var mammoth = require('mammoth');

function convert(opts) {
    var d = Q.defer();

    // counter for default name (altText unavailable)
    var imgCounter = 0;

    ////
    // imgExporter exports inline images to the assets folder and apply src attribute to HTML correctly
    ////
    var imgExporter = mammoth.images.inline(function(element) {
        return element.read().then(function(imageBuffer) {
            // Set image file name
            var imgFilename;
            // Use altText for image name
            if (!!element.altText) {
                imgFilename = element.altText;
                // Remove extension in altText if is equal to contentType
                contentType = 'image/'+path.extname(imgFilename).slice(1);
                if (element.contentType === contentType) {
                    imgFilename = imgFilename.split('.').slice(0, -1).join('.');
                }
            }
            // Or use default name -> img-NN.ext
            else {
                imgFilename = 'img-'+imgCounter;
                imgCounter++;
            }

            // Add extension
            imgFilename = imgFilename+'.'+element.contentType.split('/')[1];
            // Create path
            var imgPath = path.join(opts.assetsFolder, imgFilename);

            // Write on disk
            fs.writeFile(imgPath, imageBuffer, function (err) {
                if (err) console.error('Unable to save image '+imgPath);
                else console.log('Successfully exported image '+imgPath);
            });

            // Return correct HTML src attribute
            return {
                src: './'+path.join(path.basename(opts.assetsFolder), imgFilename)
            };
        });
    });

    ////
    // Set mammoth options
    ////
    var mammothOpts = {
        convertImage: imgExporter
    };

    ////
    // Convert to HTML
    ////
    console.log('Converting docx file to HTML...');
    mammoth.convertToHtml({ path: opts.filename }, mammothOpts)
    .then(function(result) {
        console.log('Done.');

        var html = result.value; // The generated HTML
        var messages = result.messages; // Any messages, such as warnings during conversion

        d.resolve(html);
    })
    .fail(function(err) {
        d.reject(err);
    });

    return d.promise;
};

module.exports = {
    convert: convert
};