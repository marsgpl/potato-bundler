# Potato bundler

Bundles your webapp to minimal possible format

## Features

- css classes renaming in css, html and js (special syntax)
- google closure compiler with advanced optimizations
- images from css are renamed and moved to root
- advanced html compressing, css/js minification
- simple potato translation system, see example/src
- css classes integrity validator

## Install

    npm i -D potato-bundler

## Usage

    npx potato-bundler --src=DIRECTORY --dst=DIRECTORY [--force-delete-dst] [--lang=FILE]
        --src - directory with sources',
        --dst - directory to store compressed bundle',
        --force-delete-dst - delete dst directory if it exists',
        --lang - json file with translation, see ./example/src/lang.json

## Example

    npx potato-bundler --src=example/src --dst=example/dst --force-delete-dst --lang=example/src/lang.json

## TODO

- option to move js/css bundles in separate files
- images support in img tags in html
