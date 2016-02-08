/*eslint-disable */
/**
 *
 * This script creates a new line item for each price point specified in
 * ./price-points.json.
 *
 * Usage:
 *
 *   $ node scripts/create-line-items.js --channel A --platform M --position MIDDLE --region USA --partner SONOBI
 *
 */
/*eslint-enble */
'use strict';

var Bluebird = require('bluebird');
var formatter = require('../lib/formatter');
var _ = require('lodash');
var ProgressBar = require('progress');
var progressBar;
var argv = require('minimist')(process.argv.slice(2));

var DFP_CREDS = require('../local/application-creds');
var config = require('../local/config');
var formatter = require('../lib/formatter');

var Dfp = require('node-google-dfp-wrapper');

var credentials = {
  clientId: DFP_CREDS.installed.client_id,
  clientSecret: DFP_CREDS.installed.client_secret,
  redirectUrl: DFP_CREDS.installed.redirect_uris[0]
};

var dfp = new Dfp(credentials, config, config.refreshToken);

var channel = argv.channel;
var region = argv.region;
var position = argv.position;
var partner = argv.partner;
var platform = argv.platform;
var offset = argv.offset;

var pricePoints = require('./price-points');
var sizes = require('./sizes')(platform);
var slots = require('../input/index-slot')(platform);

var size = sizes[position];
var slot = slots[position];

var orderName = [
  partner,
  channel,
  region,
  offset + '-CENT'
].join('_');

var CONCURRENCY = {
  concurrency: 1
};

console.log(process.argv.slice(2).join(' '));

function getCPM(pricePoint) {
  var cpm = pricePoint;

  //add trailing 0 if needed
  var index = pricePoint.length - 2;
  if (cpm[index] === '.') {
    cpm += '0';
  }

  return cpm;
}

function getCombinations() {
  var combinations = [];

  console.log(orderName)

  offset = Number(offset)/100;
  _.forEach(pricePoints, function(bucket, pricePoint) {
    var price = Number(pricePoint) + offset;
    var cpm = getCPM(price).toFixed(2);
    var lineItem = formatter.formatLineItem({
      offset: offset,
      cpm: cpm,
      channel: channel,
      position: position,
      platform: platform,
      orderName: orderName,
      region: region,
      partner: partner,
      width: size.split('x')[0],
      height: size.split('x')[1],
      customCriteriaKVPairs: {
        "hb_pb": (cpm.toString())
      },
      date: "2-04-2016, 16:10:53"
    });

    combinations.push(lineItem);
  });

  progressBar = new ProgressBar('Progress [:bar] :percent :elapseds', {
    total: combinations.length + 1
  });

  return combinations;
}

function prepareLineItem(lineItem) {
  return dfp.prepareLineItem(lineItem)
    .tap(function() {
      progressBar.tick();
    });
}

function createLineItems(lineItems) {
  return dfp.createLineItems(lineItems);
}

function logSuccess(results) {
  if (results) {
    console.log('sucessfully created lineItems');
  }
}

function handleError(err) {
  progressBar.tick();
  console.log('creating line items failed');
  console.log('because', err.stack);
}

Bluebird.resolve(getCombinations())
  .map(prepareLineItem, CONCURRENCY)
  .then(createLineItems)
  .then(logSuccess)
  .catch(handleError);
