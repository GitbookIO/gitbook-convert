# gitbook-convert

[![NPM version](https://badge.fury.io/js/gitbook-convert.svg)](http://badge.fury.io/js/gitbook-convert.svg)

> CLI to convert an existing document to a GitBook.

## Install

Install this globally and you'll have access to the `gitbook-convert` command anywhere on your system.

```shell
$ npm install gitbook-convert -g
```

## Use

```shell
$ gitbook-convert [options] <file> [export-directory]
```

### Options

| Short | Long | Description | Type | Default |
| ----- | ---- | ----------- | ---- | ------- |
| -a | --assets-dir | Name of the document's assets export directory | string | assets |
| -m | --max-depth | Maximum title depth to use to split your original document into sub-chapters | integer | 2 |
| -d | --debug | Log stack trace when an error occurs | flag | false |

After converting your document, the corresponding GitBook files will be placed in the `export-directory`. If not provided, the default name is `export` and is created in the current working directory.

### Currently accepted formats

| Type | Extension |
| ---- | --------- |
| Microsoft Office Open XML Document | .docx |
| Docbook Markup Language | .xml |
| HyperText Markup Language | .html |

## Output

This version of `gitbook-convert` generates markdown files only. Support for asciidoc might be added later.

### Document processing

`gitbook-convert` divides your original document into chapters and sub-chapters, if any, one per output file. To do this, `gitbook-convert` automatically detects the headers in your document and uses the `-m` flag to split it into sub-chapters.

When converting a Docbook file though, the depth is always detected automatically.

Thus, converting the following document named **History of modern computers.docx** with the default `--max-depth` flag:
> # Chapter 1
> What the world used to be.
> ## The beginning
> At the beginning was the big bang...
> ## The following
> Strange creatures called “humans” had trouble living in peace...
> # Chapter 2
> What the world is now.
> ## The awakening
> Computers came to rule the world...
> ## The end
> The power supply went disconnected.

will produce the following output:
```shell
user @ cwd/export/history_of_modern_computers
  README.md
  SUMMARY.md
  assets/
  chapter_1/
    README.md
    the_beginning.md
    the_following.md
  chapter_2/
    README.md
    the_awakening.md
    the_end.md
```

While using `1` for `--max-depth` would produce:
```shell
user @ cwd/export/history_of_modern_computers
  chapter_1.md
  chapter_2.md
  README.md
  SUMMARY.md
  assets/
```

### Summary

The `SUMMARY.md` file is created automatically.

For our first example:

```markdown
# Summary

* [Introduction](README.md)
* [Chapter 1](chapter_1/README.md)
  * [The beginning](chapter_1/the_beginning.md)
  * [The following](chapter_1/the_following.md)
* [Chapter 2](chapter_2/README.md)
  * [The awakening](chapter_2/the_awakening.md)
  * [The end](chapter_2/the_end.md)
```

With `--max-depth` set to `1`:

```markdown
# Summary

* [Introduction](README.md)
* [Chapter 1](chapter_1.md)
* [Chapter 2](chapter_2.md)
```

### README

The content of the `README.md` file depends on your document structure. Anyways, the filename of your original document will be used as the main title here.

##### Original document starts with a main header

`gitbook-convert` creates the default GitBook `README.md` file:

```markdown
# History of modern computers

This file serves as your book's preface, a great place to describe your book's content and ideas.
```

##### Original document has an introduction
Otherwise, everything before the first main header is used as the `README.md` content. If we modify our example to be:

> A short history of modern computers.
> # Chapter 1
> ## The beginning
> At the beginning was the big bang...
> ## The following
> ...

The content of the `README.md` file will be:

```markdown
# History of modern computers

A short history of modern computers.
```

The behavior is the same when `--max-depth` is set to higher levels. Each `README.md` in the sub-chapters folders will contain the preface for the current chapter.

## Converters

The appropriate converter for a document type is deduced from its extension.

For now, the converters should:
* be placed in `lib/converters`,
* with its filename being the document-type extension, for example `/lib/converters/docx.js`,
* added to the `lib/converters/index.js` file for reference and use.

### docx

The `.docx` converter uses mwilliamson's [mammoth.js](https://github.com/mwilliamson/mammoth.js) to convert your document to HTML before generating the output.

`gitbook-convert` will try to export your inline images in the `/assets` folder, using the image title as the image filename if provided.

### docbook

`gitbook-convert` requires [**xsltproc**](http://xmlsoft.org/XSLT/xsltproc.html) to be installed to process a Docbook. If you are using MacOS or a Linux distribution, it should be installed by default.

You can test that **xsltproc** is installed using:
```shell
$ which xsltproc
```

**xsltproc** uses the last version of [docbook.xsl](http://sourceforge.net/projects/docbook/files/docbook-xsl/) to convert your Docbook to HTML first. Since the [Docbook XML markup is very large](http://www.docbook.org/tdg5/en/html/chunk-part-d64e8789.html), `gitbook-convert` will try to convert the meta-data as well as possible. Extended conversion might be added to the tool based on user requests.

When you install `gitbook-convert` using [npm](npmjs.com), the [docbook.xsl](http://sourceforge.net/projects/docbook/files/docbook-xsl/) stylesheets are downloaded and installed along with the app.

We recommend using the tool with Docbook version 5. [Here is a walk-through](http://doccookbook.sourceforge.net/html/en/dbc.structure.db4-to-db5.html) for converting an existing Docbook in version 4 to version 5.