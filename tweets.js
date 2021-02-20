const request = require('superagent');

const token = process.env.BEARER_TOKEN;

const baseUrl = 'https://api.twitter.com/2/tweets/search/recent';

