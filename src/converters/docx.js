const fs      = require('fs');
const path    = require('path');
const Promise = require('q');
const mammoth = require('mammoth');
const normall = require('normall');

const HTMLBaseConverter = require('./html-base');
const utils             = require('./utils');

const logger = new utils.Logger('log');

class DocxConverter extends HTMLBaseConverter {
    // Implement toHTML()
    toHTML() {
        const d = Promise.defer();

        // counter for default name (altText unavailable)
        let imgCounter = 0;

        // imgExporter exports inline images to the assets folder and apply src attribute to HTML correctly
        const imgExporter = mammoth.images.inline((element) => {
            return element.read()
            .then((imageBuffer) => {
                // Set image file name
                let imgFilename;

                // Use altText for image name
                if (Boolean(element.altText)) {
                    imgFilename = element.altText;

                    // Remove extension in altText if is equal to contentType
                    const contentType = `image/${path.extname(imgFilename).slice(1)}`;
                    if (element.contentType === contentType) {
                        imgFilename = imgFilename.split('.').slice(0, -1).join('.');
                    }

                    // Shorten if too long
                    imgFilename = imgFilename.slice(0, 35).trim();
                }

                // Normalize filename
                imgFilename = normall.filename(imgFilename);

                // Or use default name -> img-NN.ext
                if (!imgFilename) {
                    imgFilename = `img-${imgCounter}`;
                    imgCounter++;
                }

                // Add extension
                imgFilename = `${imgFilename}.${element.contentType.split('/')[1]}`;
                // Create path
                const imgPath = path.join(this._assetsFolder, imgFilename);

                // Write on disk
                fs.writeFile(imgPath, imageBuffer, (err) => {
                    if (err) {
                        logger.log(`Unable to save image ${imgPath}`);
                    }
                    else {
                        logger.log(`Successfully exported image ${imgPath}`);
                    }
                });

                // Return correct HTML src attribute
                return {
                    src: path.resolve(this._projectFolder, imgPath)
                };
            });
        });

        // Set mammoth options
        const mammothOpts = {
            convertImage: imgExporter
        };

        // Convert to HTML
        logger.log('Converting docx file to HTML...');
        mammoth.convertToHtml({
            path: this.originalDoc.path
        }, mammothOpts)
        .then(
            (result) => {
                logger.log('Done.');

                // The generated HTML
                this._html = result.value;
                // Any messages, such as warnings during conversion
                const messages = result.messages;
                if (this.debug) {
                    logger.log(messages);
                }

                d.resolve();
            },
            (err) => d.reject(err)
        );

        return d.promise;
    }
}

module.exports = DocxConverter;
