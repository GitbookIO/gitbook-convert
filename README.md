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
$ gitbook-convert [options] <file>
```

### Options

Short | Long | Description | Type | Default
-- | -- | -- | -- | --
-e | --export-dir | Name of the main export directory | `string` | `export`
-a | --assets-dir | Name of the document's assets export directory | `string` | `assets`

After converting your document, the corresponding GitBook files will be placed in `./export/<file>/`.

### Currently accepted formats

Type | Extension
-- | --
Microsoft Office Open XML Document | `.docx`

## Output

### Document processing

`gitbook-convert` smartly divides your original document into chapters, one per output file. To do this, `gitbook-convert` makes the assumption that each chapter will begin by a main header.

Thus, converting the following document named **History of modern computers.docx**:
> # Chapter 1
> ## The beginning
> At the beginning was the big bang...
> ## The following
> Computers came to rule the world...
> # Chapter 2
> ## The end
> Who knows what will happen next?

will produce the following output:
```shell
user @ cwd/export/history_of_modern_computers
  1-chapter_1.md
  2-chapter_2.md
  README.md
  SUMMARY.md
  assets/
```

### Summary

The `SUMMARY.md` file is created automatically:

```markdown
# Summary

* [Introduction](README.md)
* [Chapter 1](1-chapter_1.md)
* [Chapter 2](2-chapter_2.md)
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

## Converters

The appropriate converter for a document type is deduced from its extension.

For now, the converters should:
* process a document-type to render HTML,
* be promise-based,
* resolve the HTML as a single `String` after processing,
* be placed in `lib/converters`,
* with its filename being the document-type extension, for example `/lib/converters/docx.js`,
* added to the `lib/converters/index.js` file for reference and use.

`gitbook-convert` might be updated to handle different kind of processing. It might be best to convert directly some document types to markdown directly.