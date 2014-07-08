#!/usr/bin/env node

// To invoke this from the commandline you need the following to env vars to exist:
//
// S3_BUCKET_NAME
// TRAVIS_BRANCH
// TRAVIS_TAG
// TRAVIS_COMMIT
// S3_SECRET_ACCESS_KEY
// S3_ACCESS_KEY_ID
//
// Once you have those you execute with the following:
//
// ```sh
// ./bin/publish_to_s3.js
// ```
var S3Publisher = require('ember-publisher');
publisher = new S3Publisher({project: 'ember-data'});
publisher.publish();
