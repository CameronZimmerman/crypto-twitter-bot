const express = require('express');
const request = require('superagent');
const nodemailer = require('nodemailer');
const cors = require('cors');
const client = require('./client.js');
const app = express();
const morgan = require('morgan');
const ensureAuth = require('./auth/ensure-auth');
const createAuthRoutes = require('./auth/create-auth-routes');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan('dev')); // http logging

const authRoutes = createAuthRoutes();

// setup authentication routes to give user an auth token
// creates a /auth/signin and a /auth/signup POST route. 
// each requires a POST body with a .email and a .password
app.use('/auth', authRoutes);

// everything that starts with "/api" below here requires an auth token!
app.use('/api', ensureAuth);

// and now every request that has a token in the Authorization header will have a `req.userId` property for us to see who's talking
app.get('/api/test', (req, res) => {
  res.json({
    message: `in this proctected route, we get the user's id like so: ${req.userId}`
  });
});

// app.get('/tweet_test', async (req, res) => {
//   const result = await sortTweets('bagel');
//   res.json(result);
// });

// app.get('/trending', async(req, res) => {
//   try {

//     let response = await checkTweetsAndSendEmail();

//     res.json(response);
//   } catch(e) {
    
//     res.status(500).json({ error: e.message });
//   }
// });

// app.get('/cap', async(req, res) => {
//   try {

//     let response = await getCoinMarketCapData();

//     res.json(response);
//   } catch(e) {
    
//     res.status(500).json({ error: e.message });
//   }
// });

app.use(require('./middleware/error'));

async function sortTweets(rules) {
  const twitterToken = process.env.BEARER_TOKEN;
  const twitterBaseUrl = 'https://api.twitter.com/2/tweets/search/recent';

  let queryString = rules.reduce((accumulator, currentValue, currentIndex) => {
    if(currentIndex === 0) accumulator += `${currentValue} OR `;
    else if(currentIndex === 1) accumulator += `${currentValue})`;
    else if(currentIndex != rules.length - 1) accumulator += `${currentValue} OR `;
    else accumulator += `${currentValue}`;
    return accumulator;
  }, '?query=-love (');

  const twitterData = await request.get(twitterBaseUrl + queryString + '&max_results=100').set({ 'authorization': `Bearer ${twitterToken}` });

  const parsedData = JSON.parse(twitterData.text);
  const tweetArr = parsedData.data.map(tweetObj => tweetObj.text);
  console.log(twitterData);

  const regex = /\$(\w+)/g;

  let currencyArr = [];
  let slugAndNameArr = [];
  const coinMarketCapData = await getCoinMarketCapData();
  const names = coinMarketCapData[1];
  const slugs = coinMarketCapData[2];
  const symbols = coinMarketCapData[0];

  tweetArr.forEach(tweet =>{

    if(tweet.match(regex) !== null) {
      let matches = tweet.match(regex);
      let match = matches[0].substring(1).toUpperCase();
      for(let symbol of symbols) {
        if(!/\d/.test(matches[0]) && symbol.toUpperCase() === match) currencyArr.push(match);
      }
    }
    
    for(let name of names) {
      if(tweet.includes(` ${name} `)) slugAndNameArr.push(name.toUpperCase());
    }
    for(let slug of slugs) {
      if(tweet.includes(` ${slug} `) && slug !== 'just') slugAndNameArr.push(slug.toUpperCase());
    }
  });

  const finalArr = currencyArr.concat(slugAndNameArr);
  return checkCurrencyPercentages(finalArr, 20);
}

async function getCoinMarketCapData() {
  const coinMarketCapBaseURL = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?start=1&limit=500&convert=USD';
  const coinMarketCapKey = process.env.COIN_MARKET_CAP_KEY;
  
  const coninMarketCapData = await request.get(coinMarketCapBaseURL).set({ 'X-CMC_PRO_API_KEY': coinMarketCapKey });

  const parsedData =  JSON.parse(coninMarketCapData.text);
  const symbolArr = parsedData.data.map(currency => currency.symbol);
  const nameArr = parsedData.data.map(currency => currency.name);
  const slugArr = parsedData.data.map(currency => currency.slug);
  
  return [symbolArr, nameArr, slugArr];

}

function checkCurrencyPercentages(currencyArray, thresholdPercent) {
  let countObj = {};
  let percentObj = {};
  if(currencyArray.length >= 10) {
    for (const currency of currencyArray) {
      if(countObj[currency]) countObj[currency] += 1;
      else countObj[currency] = 1;
    }
    percentObj = countObj;
    for (const key in percentObj) {
      if (Object.hasOwnProperty.call(percentObj, key)) {
        percentObj[key] = percentObj[key] / currencyArray.length * 100;
      }
    }
    for (const key in percentObj) {
      if (Object.hasOwnProperty.call(percentObj, key)) {
        if(percentObj[key] > thresholdPercent) return `It looks like ${key} is popping off!`;
      }
    }
  }
  return 'this is a test. It is working';
}

async function checkTweetsAndSendEmail(){

  const data = await client.query('SELECT * from rules');
  const rules = data.rows.map(rule => rule.name);
  const trending = await sortTweets(rules);
  if(trending) {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'trendingcryptobot@gmail.com',
        pass: process.env.BOT_PASSWORD
      }
    });
    // ${process.env.PHONE_NUMBER1}@${process.env.CARRIER1},${process.env.PHONE_NUMBER2}@${process.env.CARRIER2},
    const mailOptions = {
      from: 'trendingcryptobot@gmail.com',
      to: `${process.env.PHONE_NUMBER3}@${process.env.CARRIER3}`,
      subject: '',
      text: trending
    };
    
    transporter.sendMail(mailOptions, function(error, info){
      if (error) {
        return(error);
      } else {
        return('Email sent: ' + info.response);
      }
    });
  }  
}

setInterval(checkTweetsAndSendEmail(), 600000);
module.exports = app;
