#!/bin/bash

RESOURCES_DIR="./resources"
DOCBOOK_DIR="./docbook"
TAR_FILE="docbook.tar.bz2"

# Create resources directory
echo "Creating resources directory..."
mkdir $RESOURCES_DIR
cd $RESOURCES_DIR

# Create docbook directory
echo "Creating docbook stylesheets directory..."
mkdir $DOCBOOK_DIR
cd $DOCBOOK_DIR

# Download latest docbook.xsl
echo "Downloading docbook.xsl stylesheets..."
URL="http://sourceforge.net/projects/docbook/files/docbook-xsl/1.79.1/docbook-xsl-1.79.1.tar.bz2"
wget -O $TAR_FILE -q --show-progress $URL

# Inflate and delete zip
echo "Inflating $TAR_FILE..."
tar -xjf $TAR_FILE --strip-components=1
echo "Deleting $TAR_FILE..."
rm $TAR_FILE

echo "Done."