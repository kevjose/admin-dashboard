var path = require('path');
var bcrypt = require('bcryptjs');
var bodyParser = require('body-parser');
var colors = require('colors');
var cors = require('cors');
var express = require('express');
var compression = require('compression')
var logger = require('morgan');
var jwt = require('jwt-simple');
var moment = require('moment');
var mongoose = require('mongoose');
var request = require('request');
var cheerio = require('cheerio');
var async = require("async");

var config = require('./config');

var userSchema = new mongoose.Schema({
    email: {type: String, unique: true, lowercase: true},
    password: {type: String, select: false},
    displayName: String,
    picture: String
});

userSchema.pre('save', function (next) {
  var user = this;
  if (!user.isModified('password')) {
    return next();
  }
  bcrypt.genSalt(10, function (err, salt) {
    bcrypt.hash(user.password, salt, function (err, hash) {
      user.password = hash;
      next();
    });
  });
});

userSchema.methods.comparePassword = function (password, done) {
    bcrypt.compare(password, this.password, function (err, isMatch) {
        done(err, isMatch);
    });
};

var User = mongoose.model('User', userSchema);


/*
Startup Schema
*/
var startupSchema = new mongoose.Schema({
  name: {type: String},
  createdById: String,
  createdAt: {type: Date, default: Date.now},
  updatedAt: {type: Number, default: new Date().getTime() },
  description: {type: String},
  location: String,
  sectors: [String],
  lvId: {type: String, unique: true},
  lvScore: Number,
  growthScore: Number,
  lvLink: String,
  investmentType: String,
  amount: Number,
  funded: {type: Boolean, default: false},
  twitter_handle: String,
  twitterRank: Number,
  twitterInfo: [{ 
    name: String,
    location: String,
    description: String,
    twitterImage: String,
    url: String,
    followersCount: Number,
    friendsCount: Number,
    listedCount: Number,
    createdAt: Date,
    favouritesCount: Number,
    statusesCount: Number,
    lang: String,
    fetchedOn: Number
  }],
  websiteUrl: String,
  alexaRank: Number,
  alexaInfo: [{
    globalRank: String,
    countryRank: {
      rank: String,
      country: String
    },
    engagement: {
      bounceRate: String,
      dailyPageViewPerVisitor: String,
      dailyTimeOnSite: String 
    },
    fetchedOn: Number
  }],
  facebookHandle: String,
  facebookRank: Number,
  facebookInfo: [{
    likes: String,
    about: String,
    category: String,
    link: String,
    name: String,
    talking_about_count: String,
    username: String,
    website: String,
    were_here_count: String,
    fetchedOn: Number
  }],
  googlePlayHandle: String,
  playRank: Number,
  googlePlayInfo: [{
    title: String,
    url: String,
    icon: String,
    minInstalls: Number,
    maxInstalls: Number,
    score: Number,
    histogram: {},
    screenshots: [String],
    developer: String,//'DxCo Games',
    developerEmail: String,//'dxcogames@gmail.com',
    fetchedOn: Number
  }]
});


var Startup = mongoose.model('Startup', startupSchema);

var projectSchema = new mongoose.Schema({
});

var Project = mongoose.model('Project', projectSchema)

var profileSchema = new mongoose.Schema({
  startupId: String,
  startupName: String,
  startupUserId: String,
  startupMember: String,
  headline: String,
  location: String,
  summary: String,
  positions: [],
  educations: [],
  skills: [],
  publicProfileUrl: String,
  createdAt: {type: Date, default: Date.now}
});

var Profile = mongoose.model('Profile', profileSchema)

var linkedinSchema = new mongoose.Schema({
  startupId: String,
  startupName: String,
  startupUserId: String,
  startupMember: String,
  headline: String,
  location: String,
  summary: String,
  positions: [],
  educations: [],
  skills: [],
  publicProfileUrl: String,
  createdAt: {type: Date, default: Date.now}
});

var Linkedin = mongoose.model('Linkedin', linkedinSchema)

var columnConfigSchema = new mongoose.Schema({
  name: Boolean,
  description: Boolean,
  location: Boolean,
  sectors: Boolean,
  lvLink : Boolean,
  lvScore : Boolean,
  twitter: Boolean,
  facebook: Boolean,
  alexa: Boolean,
  play: Boolean,
  twitterRank: Boolean,
  facebookRank: Boolean,
  alexaRank: Boolean,
  playRank: Boolean
});

var ColumnConfig = mongoose.model('ColumnConfig', columnConfigSchema)

mongoose.connect(config.MONGO_URI);
mongoose.connection.on('error', function (err) {
    console.log('Error: Could not connect to MongoDB. Did you forget to run `mongod`?'.red);
});

var app = express();

app.set('port', process.env.PORT || 8080);
app.use(cors());
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));
//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({extended: true}));

// Force HTTPS on Heroku
if (app.get('env') === 'production') {
    app.use(function (req, res, next) {
        var protocol = req.get('x-forwarded-proto');
        protocol == 'https' ? next() : res.redirect('https://' + req.hostname + req.url);
    });
}
app.use(compression());
app.use(express.static(path.join(__dirname, '/public')));

/*
 |--------------------------------------------------------------------------
 | Login Required Middleware
 |--------------------------------------------------------------------------
 */
function ensureAuthenticated(req, res, next) {
    if (!req.headers.authorization) {
        return res.status(401).send({message: 'Please make sure your request has an Authorization header'});
    }
    var token = req.headers.authorization.split(' ')[1];

    var payload = null;
    try {
        payload = jwt.decode(token, config.TOKEN_SECRET);
    }
    catch (err) {
        return res.status(401).send({message: err.message});
    }

    if (payload.exp <= moment().unix()) {
        return res.status(401).send({message: 'Token has expired'});
    }
    req.user = payload.sub;
    next();
}

function isAuthorized(req, res, next){
  User.findOne({_id: req.user},{_id:0, email:1},function(err, user){
    console.log(user.email);
    if(user.email != 'abc')
      return res.send({message: 'Not Authorised '});
    next();
  })
  next();
}

/*
 |--------------------------------------------------------------------------
 | Generate JSON Web Token
 |--------------------------------------------------------------------------
 */
function createJWT(user) {
    var payload = {
        sub: user._id,
        iat: moment().unix(),
        exp: moment().add(14, 'days').unix()
    };
    return jwt.encode(payload, config.TOKEN_SECRET);
}

/*
 |--------------------------------------------------------------------------
 | GET /api/me
 |--------------------------------------------------------------------------
 */
app.get('/api/me', ensureAuthenticated, function (req, res) {
    User.findById(req.user, function (err, user) {
        res.send(user);
    });
});

/*
 |--------------------------------------------------------------------------
 | PUT /api/me
 |--------------------------------------------------------------------------
 */
app.put('/api/me', ensureAuthenticated, function (req, res) {
  var $set = { $set: {} };
  if(req.body.displayName)
    $set.$set['displayName'] = req.body.displayName;
  if(req.body.email)
    $set.$set['email'] = req.body.email;
  User.update({_id:req.user}, $set ,function(err){
    if(err)
      return res.send(err)
    res.status(200).end();
  });
});


/*
 |--------------------------------------------------------------------------
 | Log in with Email
 |--------------------------------------------------------------------------
 */
app.post('/auth/login', function (req, res) {
    User.findOne({email: req.body.email}, '+password', function (err, user) {
        if (!user) {
            return res.status(401).send({message: 'Wrong email and/or password'});
        }
        user.comparePassword(req.body.password, function (err, isMatch) {
            if (!isMatch) {
                return res.status(401).send({message: 'Wrong email and/or password'});
            }
            res.send({token: createJWT(user)});
        });
    });
});

/*
 |--------------------------------------------------------------------------
 | Create Email and Password Account
 |--------------------------------------------------------------------------
 */
app.post('/auth/signup', function (req, res) {
    User.findOne({email: req.body.email}, function (err, existingUser) {
        if (existingUser) {
            return res.status(409).send({message: 'Email is already taken'});
        }
        var user = new User({
            displayName: req.body.displayName,
            email: req.body.email,
            password: req.body.password
        });
        user.save(function () {
            res.send({token: createJWT(user)});
        });
    });
});

/**
 * Create Startup
 */
app.post('/api/startup/create', ensureAuthenticated, function (req, res) {
  var startup = new Startup({
    name: req.body.name,
    createdById: req.user,
    description: req.body.description,
    location: req.body.location,
    sectors: req.body.sectors
  });
  startup.save(function (err, startup) {
    if (err)
      return res.status(400).send(err);
    return res.send(startup);
  });
});

/**
 * Create startups for csv
 */
app.post('/api/startups/create', ensureAuthenticated, function (req, res) {
  var startups = [];
  bulk = Startup.collection.initializeUnorderedBulkOp();
  console.log(req.body.length);
  var today = new Date()
  for (i in req.body) {
    startups[i] = {};
    startups[i].name = req.body[i]['startup_name'];
    startups[i].createdById = req.user;
    startups[i].location = req.body[i]['location'] || '';
    startups[i].sectors = req.body[i]['sectors'];
    startups[i].lvId = req.body[i]['startup_id'];
    startups[i].lvLink = req.body[i]['startup_url'];
    startups[i].lvScore = req.body[i]['fundability_score'] || 0;
    startups[i].twitter_handle = req.body[i]['twitter_url'] || '';
    startups[i].websiteUrl = req.body[i]['website_url'] || '';
    startups[i].facebookHandle = req.body[i]['facebook_url'] || '';
    bulk.find({ lvId: req.body[i]['id']}).upsert().update(
      { $set: {
        "name": startups[i].name,
        "createdById": startups[i].createdById,
        "location": startups[i].location,
        "sectors": startups[i].sectors,
        "lvId": startups[i].lvId,
        "lvLink": startups[i].lvLink,
        "lvScore": startups[i].lvScore,
        "twitter_handle": startups[i].twitter_handle,
        "websiteUrl": startups[i].websiteUrl,
        "facebookHandle": startups[i].facebookHandle,
        "updatedAt": today.getTime()
      } });
  }
  bulk.execute(function(err, docs){
    console.log(err);
    if (err)
      return res.send({message: err});
    return res.send(docs);
  })
});

/**
 * Get Startups 
  var re = new RegExp(req.params.search, 'i');

  app.User.find().or([{ 'firstName': { $regex: re }}, { 'lastName': { $regex: re }}]).sort('title', 1).exec(function(err, users) {
      res.json(JSON.stringify(users));
  });
 */
app.get('/api/startups', ensureAuthenticated, function (req, res) {
  ColumnConfig.findOne({}, {'_id':0, '__v': 0 }, function (err, columns) {
    if(err)
      return res.send({message: err});
    //for pagination
    var page = parseInt(req.query.page, 10) || 1;
    var limit = parseInt(limit, 10) || 50;
    var skipFrom = (page * limit) - limit;

    var re = new RegExp(req.query.searchPhrase, 'i');
    var sortObject = {};
    var stype = req.query.sortBy||'createdAt';
    var sdir = req.query.sortDir|| 1;
    sortObject[stype] = sdir;
    var startupProjection = {};
    //excluded fields added to list 
    if(!columns.name)
      startupProjection['name'] = false
    if(!columns.description)
      startupProjection['description'] = false
    if(!columns.location)
      startupProjection['location'] = false
    if(!columns.sectors)
      startupProjection['sectors'] = false
    if(!columns.lvLink)
      startupProjection['lvLink'] = false
    if(!columns.lvScore)
      startupProjection['lvScore'] = false
    if(!columns.twitterRank)
      startupProjection['twitterRank'] = false
    if(!columns.facebookRank)
      startupProjection['facebookRank'] = false
    if(!columns.alexaRank)
      startupProjection['alexaRank'] = false
    if(!columns.playRank)
      startupProjection['playRank'] = false
    startupProjection['twitterInfo'] =  {$slice: -1};
    startupProjection['alexaInfo'] = {$slice: -1};
    startupProjection['facebookInfo'] = {$slice: -1};
    startupProjection['googlePlayInfo'] = {$slice: -1} ;
    var findStartups = Startup.find({"funded":{$exists: false}})
    .or([{ 'name': { $regex: re }}, { 'description': { $regex: re }}, { 'sectors': { $regex: re }}])
    .select(startupProjection)
    .sort(sortObject)
    .skip(skipFrom)
    .limit(limit);
    findStartups.exec(function(err, startups) {
      if (err)
        return res.status(400).send({message: err});
      Startup.count(findStartups._conditions, function(err, total) {
          if(err)
            res.send({"message": err});
          var data = {
            startups: startups,
            total: total
          }
          res.send(data);
      });
    });
  });
});

app.get('/api/lookup/startups',ensureAuthenticated, function (req, res) {
  var re = new RegExp(req.query.searchPhrase, 'i');
  var sortObject = {};
  var stype = req.query.sortBy||'createdAt';
  var sdir = req.query.sortDir|| 1;
  sortObject[stype] = sdir;
  var startupProjection = {};
  startupProjection['name'] = true;

  Startup.find({ 'name': { $regex: re }})
  .select(startupProjection)
  .sort(sortObject)
  .exec(function(err, startups) {
    if (err)
      return res.status(400).send({message: err});
    return res.send(startups);
  });
  
});

app.get('/api/all/startups',ensureAuthenticated, function (req, res) {
  Startup.find({})
  .exec(function(err, startups) {
    if (err)
      return res.status(400).send({message: err});
    return res.send(startups);
  });
});

/**
 * Get startups for comparison
 */
app.post('/api/compare',ensureAuthenticated, function(req, res){
  var startupProjection = {
    twitterInfo:{$slice: -1},
    alexaInfo: {$slice: -1},
    facebookInfo: {$slice: -1},
    googlePlayInfo: {$slice: -1}
  };
  Startup.find({
    'name':{
      '$in':req.body
    }
  }, startupProjection, function(err, startups){
    if(err)
      return res.send({message: err});
    return res.send(startups); 
  });
});

/**
 * Fetch startup based on _id
 */
app.get('/api/startups/:id', ensureAuthenticated, function (req, res) {
  var startupProjection = {
    twitterInfo:{$slice: -1},
    alexaInfo: {$slice: -1},
    facebookInfo: {$slice: -1},
    googlePlayInfo: {$slice: -1}
  };
  Startup.findOne({_id: req.params.id}, startupProjection, function (err, startup) {
    if (err)
      return res.status(400).send({message: 'no such startup found'});
    return res.send(startup);
  });
});

/**
 * Update startup
 */
app.put('/api/startup', ensureAuthenticated, function (req, res) {
  var $set = { $set: {} };
  if(req.body.name)
    $set.$set['name'] = req.body.name;
  if(req.body.description)
    $set.$set['description'] = req.body.description;
  if(req.body.location)
    $set.$set['location'] = req.body.location;
  if(req.body.sectors)
    $set.$set['sectors'] = req.body.sectors;
  if(req.body.twitter_handle)
    $set.$set['twitter_handle'] = req.body.twitter_handle;
  if(req.body.websiteUrl)
    $set.$set['websiteUrl'] = req.body.websiteUrl;
  if(req.body.facebookHandle)
    $set.$set['facebookHandle'] = req.body.facebookHandle;
  if(req.body.googlePlayHandle)
    $set.$set['googlePlayHandle'] = req.body.googlePlayHandle;
  Startup.update({_id:req.body.id}, $set ,function(err){
    if(err)
      return res.status(400).send({message: 'Update Failed'});
    res.status(200).send({message: 'Update values:'+JSON.stringify($set.$set)});
  });
}); 

/**
 * Update twitter Info
 */

var Twitter = require('twitter-node-client').Twitter;
var twitterConfig = {
    "consumerKey": "OP1bjc2rD1Rg1kbkmpkVn6qri",
    "consumerSecret": "36k2UR5uCTNDZA8Rp5igXwMrqSY7lz2KW7wE5UCFQrgjpaUuKa",
    "accessToken": "2478478806-SrKSO0CQtHMgvmQ9Z4RFeEivmMqAQMBfykuqqJq",
    "accessTokenSecret": "aPMD1YqzFiQpnfTeO5LcQuX7b4hVf75uylVufAQkQDGl3"
}
var twitter = new Twitter(twitterConfig);
  
app.put('/api/twitter/details', ensureAuthenticated ,function(req,res){
  twitter.getUser({ screen_name: req.body.twitter_handle, include_entities: false},function(err){
    return res.send(err);
  },function(data){
    data = JSON.parse(data);
    var today = new Date();
    var twitterInfo = {
      "name": data.name,
      "location": data.location,
      "description": data.description,
      "twitterImage": data.profile_image_url_https,
      "url": data.url,
      "followersCount": data.followers_count,
      "friendsCount": data.friends_count,
      "listedCount": data.listed_count,
      "createdAt": data.created_at,
      "favouritesCount": data.favourites_count,
      "statusesCount": data.statuses_count,
      "lang": data.lang,
      "fetchedOn": today.getTime()//today.getTime() - 30*24*60*60*1000
    }
    Startup.findByIdAndUpdate(
     req.body.id,
     { $push: {"twitterInfo": twitterInfo},$set: {"updatedAt": today.getTime() }},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          return res.send(err);
        }
        return res.send(twitterInfo);
      }
    );
  });
});

/**
 * Update Alexa Data 
 */
var alexaData = require('alexa-traffic-rank');
app.put('/api/alexa/details', ensureAuthenticated, function(req, res){
  alexaData.AlexaWebData(req.body.websiteUrl, function(err, result) {
    if(err)
      return res.send(err);
    var today = new Date();
    result.fetchedOn = today.getTime();
    var alexaInfo = {
      globalRank: result.globalRank, 
        countryRank: {
          rank: result.countryRank?result.countryRank.rank:'',
          country: result.countryRank?result.countryRank.country:''
        },
        engagement: {
          bounceRate: result.engagement?result.engagement.bounceRate:'',
          dailyPageViewPerVisitor: result.engagement?result.engagement.dailyPageViewPerVisitor:'',
          dailyTimeOnSite: result.engagement?result.engagement.dailyTimeOnSite:'' 
        },
      fetchedOn: result.fetchedOn
    }
    Startup.findByIdAndUpdate(
     req.body.id,
     { $push: {"alexaInfo": alexaInfo},$set: {"updatedAt": today.getTime() }},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          return res.send(err);
        }
        return res.send(alexaInfo);
      }
    );

  });
}); 

/**
 * Update Facebook Details
 */
app.put('/api/facebook/details', ensureAuthenticated, function(req, res){
  var detailsUrl = "https://graph.facebook.com/"+req.body.facebookHandle+"?access_token=472415586283791|a8922a99c7584e780bf09bcb789172e3&fields=likes,about,birthday,category,link,name,talking_about_count,username,website,were_here_count";
  request.get({url: detailsUrl, json: true},function(err, response, data){
    if (err)
      return res.send(err) 
    var today = new Date();
    var facebookInfo = {
      likes: data.likes,
      about: data.about,
      category: data.category,
      link: data.link,
      name: data.name,
      talking_about_count: data.talking_about_count,
      username: data.username,
      website: data.website,
      were_here_count: data.were_here_count,
      fetchedOn: today.getTime()
    }
    Startup.findByIdAndUpdate(
     req.body.id,
     { $push: {"facebookInfo": facebookInfo},$set: {"updatedAt": today.getTime()}},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          return res.send(err);
        }
        return res.send(facebookInfo);
      }
    );
  });
}); 

/**
 * Update goolge play Info
 */
var gplay = require('google-play-scraper');
app.put('/api/google-play/details', ensureAuthenticated, function(req, res){
  gplay.app({appId: req.body.googlePlayHandle})
  .then(function(app){
    var today = new Date();
    var googlePlayInfo = {
      title: app.title,
      url: app.url,
      icon: app.icon,
      minInstalls: app.minInstalls,
      maxInstalls: app.maxInstalls,
      score: app.score,
      histogram:app.histogram,
      screenshots: app.screenshots,
      developer: app.developer,
      developerEmail: app.developerEmail,
      fetchedOn: today.getTime()
    }
    Startup.findByIdAndUpdate(
     req.body.id,
     { $push: {"googlePlayInfo": googlePlayInfo},$set: {"updatedAt": today.getTime()}},
     { safe: true, upsert: true},
      function(err, model) {
        if(err){
          return res.send(err);
        }
        return res.send(googlePlayInfo);
      }
    );
  })
  .catch(function(e){
    return res.send(e);
  });
});


app.get('/api/projects', function (req, res) {
  Project.find({},{'_id': 0, 'school_state': 1, 'resource_type': 1, 'poverty_level': 1, 'date_posted': 1, 'total_donations': 1, 'funding_status': 1, 'grade_level': 1 },{skip: 3000,limit: 1000}, function (err, projects) {
    if(err)
      return res.send(err);
    return res.send(projects);
  });
});

/**
 * Columns to be shown in the startup-table
 */
app.get('/api/columns', function (req, res) {
  ColumnConfig.findOne({}, function (err, columns) {
    if(err)
      return res.send(err);
    return res.send(columns);
  });
});

/**
 * Update column config
 */
app.put('/api/columns', ensureAuthenticated, function (req, res) {
  var set = {};
  set['name'] = req.body.name;
  set['description'] = req.body.description;
  set['location'] = req.body.location;
  set['sectors'] = req.body.sectors;
  set['lvLink'] = req.body.lvLink;
  set['lvScore'] = req.body.lvScore;
  set['twitter'] = req.body.twitter;
  set['facebook'] = req.body.facebook;
  set['alexa'] = req.body.alexa;
  set['play'] = req.body.play;
  set['twitterRank'] = req.body.twitterRank;
  set['facebookRank'] = req.body.facebookRank;
  set['alexaRank'] = req.body.alexaRank;
  set['playRank'] = req.body.playRank;
  ColumnConfig.findByIdAndUpdate(
   req.body._id,
   {$set: set },
   {  safe: true, upsert: true},
    function(err, model) {
      if(err){
        return res.send(err);
      }
      res.send({"message": "success"});
    }
  );
});

/**
 * Bulk Update Twitter
 */
app.get('/api/bulk/twitterInfo',ensureAuthenticated,function(req, res){
  var today = new Date();
  var toBeUpdated = today.getTime() - 15*24*60*60*1000;
  var sleep = false;
  var getTwitterInfo = function (startup) {
    twitter.getUser({ screen_name: startup.twitter_handle, include_entities: false},function(err){
      console.log(err);
    },function(twitterData){
      var data = {};
      data = JSON.parse(twitterData);
      var twitterInfo = {
        "name": data.name,
        "location": data.location,
        "description": data.description,
        "twitterImage": data.profile_image_url_https,
        "url": data.url,
        "followersCount": data.followers_count,
        "friendsCount": data.friends_count,
        "listedCount": data.listed_count,
        "createdAt": data.created_at,
        "favouritesCount": data.favourites_count,
        "statusesCount": data.statuses_count,
        "lang": data.lang,
        "fetchedOn": today.getTime()//today.getTime() - 30*24*60*60*1000
      }
      Startup.findByIdAndUpdate(
       startup._id,
       { $push: {"twitterInfo": twitterInfo},$set: {"updatedAt": today.getTime() }},
       {  safe: true, upsert: true},
        function(err, model) {
          if(err){
            return res.send(err);
          }
        }
      );
    });
  }

  Startup.find({$or:([{"twitterInfo": {$exists: false}},{"updatedAt": {$lte: toBeUpdated }}])}, function(err, startups){
    if(err)
      return res.send(err)
    var today = new Date();
    var loopLength = startups.length;
    function requestCall (i) {
      setTimeout(function () {
        getTwitterInfo(startups[i-1])
        console.log("Fetching twitter details!");
        if (--i) {          
          requestCall(i);  
        }
      }, 6000);
    }
    requestCall(loopLength);
    return res.send({"message": "done"});
  })
})

/**
 * Bulk Update Facebook
 */
app.get('/api/bulk/facebookInfo',ensureAuthenticated, function(req, res){
  var today = new Date();
  var toBeUpdated = today.getTime() - 1*24*60*60*1000;
  Startup.find({$or:([{"facebookInfo": {$exists: false}},{"updatedAt": {$lte: toBeUpdated }}])}, function(err, startups){
    if(err)
      console.log(err);
    startups.forEach(function(startup){
      var detailsUrl = "https://graph.facebook.com/"+startup.facebookHandle+"?access_token=472415586283791|a8922a99c7584e780bf09bcb789172e3&fields=likes,about,birthday,category,link,name,talking_about_count,username,website,were_here_count";
      request.get({url: detailsUrl, json: true},function(err, response, data){
        if (err)
          console.log(err); 
        var today = new Date();
        if(data){
          var facebookInfo = {
            likes: data.likes,
            about: data.about,
            category: data.category,
            link: data.link,
            name: data.name,
            talking_about_count: data.talking_about_count,
            username: data.username,
            website: data.website,
            were_here_count: data.were_here_count,
            fetchedOn: today.getTime()
          }
          Startup.findByIdAndUpdate(
           startup._id,
           { $push: {"facebookInfo": facebookInfo},$set: {"updatedAt": today.getTime()}},
           { safe: true, upsert: true},
            function(err, model) {
              if(err){
                console.log(err);
              }
              console.log(model);
            }
          );
        }
      });
    })
    return res.send({"message": "done"});
  })
})

/**
 * Bulk Update Alexa
 */
app.get('/api/bulk/alexaInfo', ensureAuthenticated, function(req, res){
  var today = new Date();
  var toBeUpdated = today.getTime() - 15*24*60*60*1000;
  Startup.find({$or:([{"alexaInfo": {$exists: false}},{"updatedAt": {$lte: toBeUpdated }}])}, function(err, startups){
    if(err)
      console.log(err);
    startups.forEach(function(startup){
      alexaData.AlexaWebData(startup.websiteUrl, function(err, result) {
        if(err)
          console.log(err);
        result.fetchedOn = today.getTime();
        var alexaInfo = {
          globalRank: result.globalRank, 
            countryRank: {
              rank: result.countryRank?result.countryRank.rank:'',
              country: result.countryRank?result.countryRank.country:''
            },
            engagement: {
              bounceRate: result.engagement?result.engagement.bounceRate:'',
              dailyPageViewPerVisitor: result.engagement?result.engagement.dailyPageViewPerVisitor:'',
              dailyTimeOnSite: result.engagement?result.engagement.dailyTimeOnSite:'' 
            },
          fetchedOn: result.fetchedOn
        }
        Startup.findByIdAndUpdate(
         startup._id,
         { $push: {"alexaInfo": alexaInfo},$set: {"updatedAt": today.getTime() }},
         {  safe: true, upsert: true},
          function(err, model) {
            if(err){
              console.log(err);
            }
            console.log(alexaInfo);
          }
        );
      });
    })
    return res.send({"message": "done"});
  })
})

app.get('/api/bulk/googlePlayInfo', ensureAuthenticated, function(req, res){
  var today = new Date();
  var toBeUpdated = today.getTime() - 15*24*60*60*1000; 
  Startup.find({$or:([{"googlePlayInfo": {$exists: false}},{"updatedAt": {$lte: toBeUpdated }}])}, function(err, startups){
    if(err)
      console.log(err);
    var loopLength = startups.length;
    function requestCall (i) {
      setTimeout(function () {
        getPlayInfo(startups[i-1]);
        console.log("Fetching Play Store details!" + i);
        if (--i) {          
          requestCall(i);  
        }
      }, Math.floor(Math.random() * 5000) + 2000);
    }
    requestCall(loopLength);
    var getPlayInfo = function(startup){
      var reg = /^(https?):\/\/(www\.)?/;
      var url = startup.websiteUrl;
      var website = url.replace(reg, '');
      gplay.search({term: website ,num: 1, fullDetail: true })
      .then(function(app){
        if(app[0].developerWebsite.replace(reg, '') == website){
          var googlePlayInfo = {
            title: app[0].title,
            url: app[0].url,
            icon: app[0].icon,
            minInstalls: app[0].minInstalls,
            maxInstalls: app[0].maxInstalls,
            score: app[0].score,
            histogram:app[0].histogram,
            screenshots: app[0].screenshots,
            developer: app[0].developer,
            developerEmail: app[0].developerEmail,
            fetchedOn: today.getTime()
          }
          var appId = app[0].appId
          Startup.findByIdAndUpdate(
           startup._id,
           { $push: {"googlePlayInfo": googlePlayInfo},
              $set: {"updatedAt": today.getTime(),"googlePlayHandle": appId }},
           { safe: true, upsert: true},
            function(err, model) {
              if(err){
                console.log(err);
              }
              //console.log(googlePlayInfo);
            }
          );
          //console.log(app);
        }
      })
      .catch(function(e){
        console.log(e);
      });
    }
    return res.send({"message": "done"});
  })
})


/** 
 * Calculate Twitter Percentiles 
 */
function compareTwitter(a,b) {
  if (a.twitterInfo[0].listedCount < b.twitterInfo[0].listedCount)
    return -1;
  else if (a.twitterInfo[0].listedCount > b.twitterInfo[0].listedCount )
    return 1;
  else 
    return 0;
}
var calculatePercentileTwitter = function(startups){
  startups.sort(compareTwitter);
  for (var i = 0; i < startups.length; i++) {
    var count = 0;
    var start = i;
    if (i > 0) {
      startups[i].twitterRankFactor = startups[i].twitterInfo[0].followersCount / startups[i].twitterInfo[0].listedCount;
      startups[i-1].twitterRankFactor = startups[i-1].twitterInfo[0].followersCount / startups[i-1].twitterInfo[0].listedCount;
      while (i > 0 && startups[i].twitterRankFactor == startups[i - 1].twitterRankFactor) {
        count++;
        i++;
      }
    }
    var perc = ((start - 0) + (0.5 * count));
    perc = perc / (startups.length - 1);
    for (var k = 0; k < count + 1; k++)
      startups[start+ k].twitterRank = (perc *100)
  }
  for(j in startups){
    Startup.findByIdAndUpdate(
     startups[j]._id,
     { $set: {"twitterRank": startups[j].twitterRank }},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          console.log(err);
        }
      }
    );
  }
}
app.get('/api/rank/twitter',ensureAuthenticated,function(req, res){
  var startupProjection = {};
  startupProjection['_id'] = true;
  startupProjection['name'] = true;
  startupProjection['twitterInfo'] =  {$slice: -1};
  Startup.find({"twitterInfo" : {$exists: true},"funded":{$exists: false}})
  .select(startupProjection)
  .exec(function(err, startups) {
    if (err)
      return res.send({message: err});
    calculatePercentileTwitter(startups);
    return res.send({message: "done"});
  });
})

/** 
 * Calculate Facebook Percentiles 
 */
function compareFacebook(a,b) {
  if (a.facebookInfo[0].likes < b.facebookInfo[0].likes)
    return -1;
  else if (a.facebookInfo[0].likes > b.facebookInfo[0].likes )
    return 1;
  else 
    return 0;
}
var calculatePercentileFacebook = function(startups){
  startups.sort(compareFacebook);
  for (var i = 0; i < startups.length; i++) {
    var count = 0;
    var start = i;
    if (i > 0) {
      startups[i].facebookRankFactor = startups[i].facebookInfo[0].talking_about_count / startups[i].facebookInfo[0].likes;
      startups[i-1].facebookRankFactor = startups[i-1].facebookInfo[0].talking_about_count / startups[i-1].facebookInfo[0].likes;
      while (i > 0 && startups[i].facebookRankFactor == startups[i - 1].facebookRankFactor) {
        count++;
        i++;
      }
    }
    var perc = ((start - 0) + (0.5 * count));
    perc = perc / (startups.length - 1);
    for (var k = 0; k < count + 1; k++)
      startups[start+ k].facebookRank = (perc *100)
  }
  for(j in startups){
    Startup.findByIdAndUpdate(
     startups[j]._id,
     { $set: {"facebookRank": startups[j].facebookRank }},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          console.log(err);
        }
      }
    );
  }
}
var movingAvg = function(startups){
  for(i in startups){
    var sumTalkingAbout = 0;
    var sumLikes = 0;
    var rank = 0;
    var avg = 0;
    var facebookRank = 0;
    var startupsLength = startups[i].facebookInfo.length;
    for(var j=0;j< startupsLength -1; j++){
      sumTalkingAbout = sumTalkingAbout + startups[i].facebookInfo[j].talking_about_count;
      sumLikes = sumLikes + startups[i].facebookInfo[j].likes;
    }
    //avg0 = (sumTalkingAbout/sumLikes)/(startupsLength -1);
    avg1 = ((sumTalkingAbout + startups[i].facebookInfo[startupsLength -1 ].talking_about_count)/(sumLikes + startups[i].facebookInfo[startupsLength -1 ].likes))/startupsLength;
    //delta = avg1 - avg0;
    switch (true) {
      case (avg1 <= 0.1):
        facebookRank = 1;
        break;
      case (avg1 > 0.1 && avg1 <= 0.3):
        facebookRank = 2;
        break;
      case (avg1 > 0.3 && avg1 <= 0.4):
        facebookRank = 3;
        break;
      case (avg1 > 0.4 && avg1 <= 0.5):
        facebookRank = 4;
        break;
      default:
        facebookRank = 5;
        break;
    }
    facebookRank = facebookRank * 20;
    console.log(startups[i].name +":::: "+"::::"+avg1+"::::"+facebookRank);
  }
}
app.get('/api/rank/facebook', function(req, res){
  var startupProjection = {};
  startupProjection['_id'] = true;
  startupProjection['name'] = true;
  startupProjection['facebookInfo'] =  {$slice: -1};
  Startup.find({"facebookInfo" : {$exists: true},"funded":{$exists: false}})
  .select(startupProjection)
  .exec(function(err, startups) {
    if (err)
      return res.send({message: err});
    calculatePercentileFacebook(startups);
    //movingAvg(startups);
    return res.send({message: "done"});
  });
})

/** 
 * Calculate Alexa Percentiles 
 */
function compareAlexa(a,b) {
  if (a.alexaInfo[0].globalRank < b.alexaInfo[0].globalRank)
    return -1;
  else if (a.alexaInfo[0].globalRank > b.alexaInfo[0].globalRank )
    return 1;
  else 
    return 0;
}
var calculatePercentileAlexa = function(startups){
  startups.sort(compareAlexa);
  for (var i = 0; i < startups.length; i++) {
    var count = 0;
    var start = i;
    if (i > 0) {
      startups[i].alexaRankFactor = startups[i].alexaInfo[0].globalRank + startups[i].alexaInfo[0].dailyPageViewPerVisitor + startups[i].alexaInfo[0].bounceRate;
      startups[i-1].alexaRankFactor = startups[i-1].alexaInfo[0].globalRank + startups[i-1].alexaInfo[0].dailyPageViewPerVisitor + startups[i-1].alexaInfo[0].bounceRate;
      while (i > 0 && startups[i].alexaRankFactor == startups[i - 1].alexaRankFactor) {
        count++;
        i++;
      }
    }
    var perc = ((start - 0) + (0.5 * count));
    perc = perc / (startups.length - 1);
    for (var k = 0; k < count + 1; k++)
      startups[start+ k].alexaRank = (perc *100)
  }
  for(j in startups){
    Startup.findByIdAndUpdate(
     startups[j]._id,
     { $set: {"alexaRank": startups[j].alexaRank }},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          console.log(err);
        }
      }
    );
  }
}
app.get('/api/rank/alexa', ensureAuthenticated, function(req, res){
  var startupProjection = {};
  startupProjection['_id'] = true;
  startupProjection['name'] = true;
  startupProjection['alexaInfo'] =  {$slice: -1};
  Startup.find({"alexaInfo" : {$exists: true},"funded":false})
  .select(startupProjection)
  .exec(function(err, startups) {
    if (err)
      return res.send({message: err});
    calculatePercentileAlexa(startups);
    return res.send({message: "done"});
  });
})

/** 
 * Calculate Google Play Percentiles 
 */
function comparePlay(a,b) {
  if (a.googlePlayInfo[0].score < b.googlePlayInfo[0].score)
    return -1;
  else if (a.googlePlayInfo[0].score > b.googlePlayInfo[0].score )
    return 1;
  else 
    return 0;
}
var calculatePercentilePlay = function(startups){
  startups.sort(comparePlay);
  for (var i = 0; i < startups.length; i++) {
    var count = 0;
    var start = i;
    if (i > 0) {
      while (i > 0 && startups[i] && startups[i].googlePlayInfo[0].score == startups[i - 1].googlePlayInfo[0].score) {
        count++;
        i++;
      }
    }
    var perc = ((start - 0) + (0.5 * count));
    perc = perc / (startups.length - 1);
    for (var k = 0; k < count + 1; k++){
      if(startups[start + k])
        startups[start+ k].playRank = (perc *100)
    }
    
  }
  for(j in startups){
    Startup.findByIdAndUpdate(
     startups[j]._id,
     { $set: {"playRank": startups[j].playRank }},
     {  safe: true, upsert: true},
      function(err, model) {
        if(err){
          console.log(err);
        }
      }
    );
  }
}
app.get('/api/rank/play', ensureAuthenticated,function(req, res){
  var startupProjection = {};
  startupProjection['_id'] = true;
  startupProjection['name'] = true;
  startupProjection['googlePlayInfo'] =  {$slice: -1};
  Startup.find({"googlePlayInfo" : {$exists: true}, "funded":{$exists: false}})
  .select(startupProjection)
  .exec(function(err, startups) {
    if (err)
      return res.send({message: err});
    calculatePercentilePlay(startups);
    return res.send({message: "done"});
  });
})

app.get('/api/growth',function(req, res){
  var startupProjection = {};
  startupProjection['_id'] = true;
  startupProjection['name'] = true;
  startupProjection['alexaRank'] = true;
  startupProjection['playRank'] = true;
  Startup.find({"funded":{$exists: false}})
  .select(startupProjection)
  .exec(function(err, startups) {
    if (err)
      return res.send({message: err});
    for(j in startups){
      if(startups[j].alexaRank > startups[j].playRank || !startups[j].playRank){
        startups[j].growthScore = (startups[j].alexaRank/100)*5
      }
      if(startups[j].playRank > startups[j].alexaRank || !startups[j].alexaRank){
        startups[j].growthScore = (startups[j].playRank/100)*5
      }
      Startup.findByIdAndUpdate(
       startups[j]._id,
       { $set: {"growthScore": startups[j].growthScore }},
       {  safe: true, upsert: true},
        function(err, model) {
          if(err){
            console.log(err);
          }
        }
      );
    }
    return res.send({message: "done"});
  });
})

app.get('/api/similarweb/scrape', function(req, res){
  url = 'http://www.similarweb.com/website/flipkart.com';
  request(url, function(error, response, html){
  if(!error){
      var $ = cheerio.load(html, { normalizeWhitespace: true });
      var similarWebData ={
        globalRank:'',
        countryRank:{
          country:'',
          rank:''
        },
        categoryRank:{
          category:'',
          rank:''
        },
        engagement:{
          dated:'',
          visits:'',
          time:'',
          ppv:'',
          bounce:''
        },
        trafficSource:{
          direct:'',
          refferals:'',
          search:'',
          social:'',
          mail:'',
          display: ''
        }
      }
      var data;
      var node;
      $("[data-analytics-label='Global Rank/Worldwide']").filter(function(){
        node = $(this);
        similarWebData.globalRank = node.parent().next().children('.rankingItem-value').text();
      });
      $("[data-analytics-label*='Country Rank/']").filter(function(){
        node = $(this);
        similarWebData.countryRank.country = node.text();
        similarWebData.countryRank.rank = node.parent().next().children('.rankingItem-value').text();
      });
      $("[data-analytics-label*='Category Rank/']").filter(function(){
        node = $(this);
        similarWebData.categoryRank.category = node.text().replace(/>/g,",");
        similarWebData.categoryRank.rank = node.parent().next().children('.rankingItem-value').text();
      });
      $('[data-view="WebsitePageModule.Views.Engagement"]').filter(function(){
        node = $(this).prev('.websitePage-note');
        similarWebData.engagement.dated = node.text().trim();
        similarWebData.engagement.visits = $(this).children('.engagementInfo-line').children('[data-type="visits"]').children('.engagementInfo-value').text();
        similarWebData.engagement.time = $(this).children('.engagementInfo-line').children('[data-type="time"]').children('.engagementInfo-value').text();
        similarWebData.engagement.ppv = $(this).children('.engagementInfo-line').children('[data-type="ppv"]').children('.engagementInfo-value').text();
        similarWebData.engagement.bounce = $(this).children('.engagementInfo-line').children('[data-type="bounce"]').children('.engagementInfo-value').text();
      });
      $('[data-key="Direct"]').filter(function(){
        node = $(this);
        similarWebData.trafficSource.direct = node.find('div > div > div').text();
      });
      $('[data-key="Referrals"]').filter(function(){
        node = $(this);
        similarWebData.trafficSource.refferals = node.find('div > div > div').text();
      });
      $('[data-key="Search"]').filter(function(){
        node = $(this);
        similarWebData.trafficSource.search = node.find('div > div > div').text();
      });
      $('[data-key="Social"]').filter(function(){
        node = $(this);
        similarWebData.trafficSource.social = node.find('div > div > div').text();
      });
      $('[data-key="Mail"]').filter(function(){
        node = $(this);
        similarWebData.trafficSource.mail = node.find('div > div > div').text();
      });
      $('[data-key="Display"]').filter(function(){
        node = $(this);
        similarWebData.trafficSource.display = node.find('div > div > div').text();
      });

      res.send(similarWebData);
    }
  });
})



app.get('/api/trak/scrape',function(req, res){
  url = 'http://trak.in/india-startup-funding-investment-2015/';
  request(url, function(error, response, html){
    if(!error){
      var trakDetails=[];
      var $ = cheerio.load(html, { normalizeWhitespace: true });
      $('tr').each(function(i, elem){
        var a = $(this).children('td')
        if(!trakDetails[i])
          trakDetails[i] ={}; 
        trakDetails[i].postedDate = '';
        trakDetails[i].startupName = '';
        trakDetails[i].startupLink = '';
        trakDetails[i].vertical = '';
        trakDetails[i].subVertical = '';
        trakDetails[i].city = '';
        trakDetails[i].investor = '';
        trakDetails[i].investmentType ='';
        trakDetails[i].amount='';


        $(this).children('td').each(function(j, elem){
          var b = $(this);
          if(b.text()!="Sr. No." && b.text()!="Date (dd/mm/yyyy)" && b.text()!="Startup Name" && b.text()!="Industry/ Vertical" && b.text()!="Sub-Vertical" && b.text()!="City / Location" && b.text()!="Investors’ Name" && b.text()!="Invest-mentType" && b.text()!="Amount (in USD)"){
            if(trakDetails[i] && j == 1 && b.text() ){
              trakDetails[i].postedDate = b.text();
            }else if(trakDetails[i] && j== 2 && b.text()){
              trakDetails[i].startupName = b.text();
              if(b.children('a').attr('href'))
              trakDetails[i].startupLink = b.children('a').attr('href');  
            }else if(j== 3 && b.text()){
              trakDetails[i].vertical = b.text();
            }else if(j== 4 && b.text()){
              trakDetails[i].subVertical = b.text();
            }else if(j== 5 && b.text()){
              trakDetails[i].city = b.text();
            }else if(j==6 && b.text()){
              trakDetails[i].investor = b.text();
            }else if(j==7 && b.text()){
              trakDetails[i].investmentType = b.text();
            }else if(j==8 && b.text()){
              trakDetails[i].amount = b.text();
            }
          }
        })
      })
      var k = 0;
      var filteredTrak =[];
      for(i in trakDetails){
        if(trakDetails[i].startupName != "" && trakDetails[i].startupName != " "){
          filteredTrak[k] = trakDetails[i]
          k++;
        }
      }
      res.send(filteredTrak);
    }else
      res.send({message: error});
  })
});


/**
 * Create startups for json
 */
app.post('/api/startups/trak', ensureAuthenticated, function (req, res) {
  var startups = [];
  bulk = Startup.collection.initializeUnorderedBulkOp();
  console.log(req.body.length);
  var today = new Date()
  for (i in req.body) {
    startups[i] = {};
    startups[i].name = req.body[i]['name'];
    startups[i].createdById = req.user;
    startups[i].location = req.body[i]['location'] || '';
    startups[i].sectors = req.body[i]['sectors'];
    startups[i].lvId = req.body[i]['lvId'];
    startups[i].websiteUrl = req.body[i]['websiteUrl'] || '';
    startups[i].investmentType = req.body[i]['investmentType'];
    startups[i].amount = req.body[i]['amount'];
    startups[i].funded = req.body[i]['funded'];
    bulk.find({ lvId: req.body[i]['lvId']}).upsert().update(
      { $set: {
        "name": startups[i].name,
        "createdById": startups[i].createdById,
        "location": startups[i].location,
        "sectors": startups[i].sectors,
        "lvId": startups[i].lvId,
        "websiteUrl": startups[i].websiteUrl,
        "investmentType":startups[i].investmentType,
        "amount": startups[i].amount,
        "funded": startups[i].funded,
        "updatedAt": today.getTime()
      } });
  }
  bulk.execute(function(err, docs){
    console.log(err);
    if (err)
      return res.send({message: err});
    return res.send(docs);
  })
});


app.get('/api/social/scrape',function(req, res){
  var findStartups = Startup.find();
  var startupsToSend = [];
  findStartups.exec(function(err, startups){
    if(!err){
      for(i in startups){
        url = startups[i].websiteUrl;
        request(url, function(error, response, html){
          if(!error){
            var $ = cheerio.load(html);
            $('a').each(function(i, elem){
              var a = $(this).attr('href');
              if(a)
                if((a.indexOf("facebook.com")!= -1 || a.indexOf("twitter.com")!= -1)&& a.indexOf("profile")==-1 && a.indexOf("status")==-1 && a.indexOf("sharer")==-1 && a.indexOf("intent")==-1 && a.indexOf("hashtag")==-1 && a.indexOf("dialog")==-1 && a.indexOf(".php")==-1){
                   console.log(a);
                }
            })
          }
        })
        
      }
      res.send({message:"success"});
    }else
       res.send({message: err});
  })
});
//https://emailhunter.co/v1/search?offset=0&domain=dilmil.co&api_key=9eb8654aabb44da784edb567c46465a72e4d09d1&format=json
app.post('/api/social/search', function(req, res){
  var url  = req.body.url;
  var facebookUrl = '';
  var twitterUrl = '';
  var title = '';
  console.log(url);
  request(url, function(error, response, html){
    if(!error){
      var $ = cheerio.load(html);
      title = $('title').text()
      $('a').each(function(i, elem){
        var a = $(this).attr('href');
        if(a)
          if((a.indexOf("facebook.com")!= -1 || a.indexOf("twitter.com")!= -1)&& a.indexOf("profile")==-1 && a.indexOf("status")==-1 && a.indexOf("sharer")==-1 && a.indexOf("intent")==-1 && a.indexOf("hashtag")==-1 && a.indexOf("dialog")==-1 && a.indexOf(".php")==-1){
            if(a.indexOf("facebook.com")!= -1)
              facebookUrl = a;
            if(a.indexOf("twitter.com")!= -1)
              twitterUrl = a;
          }
      })
      var result = {
        title: title,
        facebookUrl: facebookUrl,
        twitterUrl: twitterUrl
      }
      
      var protomatch1 = /^(https?):\/\/(www\.)?/;
      var protomatch2 = /(\/)$/;
      var absUrl = url.replace(protomatch1, '').replace(protomatch2, '');
      var emailhunter = "https://emailhunter.co/v1/search?offset=0&domain="+absUrl+"&api_key=9eb8654aabb44da784edb567c46465a72e4d09d1&format=json";
      request(emailhunter, function(error, response, html){
        console.log(JSON.parse(response.body));
        var body = JSON.parse(response.body) ;
        if(body.emails[0]) 
          result.email = body.emails[0].value;
        res.send(result);
      })
      //res.send(result);
    }
    else
      res.send({message: error});
  })
})

//Crunchbase

/*
http://api.crunchbase.com/v/1/search.js?query=anupam&api_key=4568c46b5c97886c88b28f311616ed62'
*/
/*var crunchbase = require('crunchbase2');
crunchbase.init("4568c46b5c97886c88b28f311616ed62");*/
app.get('/api/crunchbase/', function(req, res){
  console.log("crunch crunch");
  request.post({
    url:'https://a0ef2haqr0-3.algolia.io/1/indexes/main_production/query', 
    formData: {
      apiKey: "4568c46b5c97886c88b28f311616ed62",
      appID: "A0EF2HAQR0",
      params: "query=sanjay%20jha&facets=*&distinct=true&page=0&hitsPerPage=20&facetFilters=type%3APerson"
    }
  }, function(err,httpResponse,body){
     res.send(body);
  })
  /*crunchbase.organization( "apple" , function(error, results) {
    console.log(error);
    if (!error) {
      res.send({message: results}) // Print the search results
    }
    else
      res.send({error: error});
  });*/
});



var Xray = require('x-ray');
var x = Xray();
app.post('/api/social/xray', function(req, res){
  var url = req.body.url;
  async.parallel([
    //Get Facebook Handle
    function(callback) {
      x(url, 'a', [{
        a: '',
        href: '@href',
      }])
      (function(err, obj) {
        if(err)
          callback(err);
        else {
          var handle ;
          for(i in obj){
            var a = obj[i].href;
            if(a && a.indexOf("facebook.com")!= -1 && a.indexOf("intent")==-1  && a.indexOf("profile")==-1 && a.indexOf("status")==-1 && a.indexOf("sharer")==-1 && a.indexOf("hashtag")==-1 && a.indexOf("dialog")==-1 && a.indexOf(".php")==-1){
              if(a[a.length-1]!='/' && a.length < 80)
                a = a+"/";
              handle = a.match(/facebook\.com\/(.+)\/+/);
            }
          }
          callback(null, handle?handle[1]:'');
        }
      })
    },
 
    //Get Twitter Handle
    function(callback) {
      x(url, 'a', [{
        a: '',
        href: '@href',
      }])
      (function(err, obj) {
        if(err)
          callback(err);
        else {
          var handle ;
          for(i in obj){
            var a = obj[i].href;
            if(a && a.indexOf("twitter.com")!= -1 && a.indexOf("intent")== -1 && a.indexOf("profile")==-1 && a.indexOf("status")==-1 && a.indexOf("sharer")==-1  && a.indexOf("hashtag")==-1 && a.indexOf("dialog")==-1 && a.indexOf(".php")==-1){
              if(a[a.length-1]!='/' && a.length < 80)
                a = a+"/";
              var handle = a.match(/twitter\.com\/(.+)\/+/);
            }
          }
          callback(null, handle?handle[1]:'');
        }
      })
    },

    //Get Website Url
    function(callback) {
      x( url, 'title')(function(err, title) {
        if(err)
          callback(err);
        else {
          callback(null, title?title:'');
        }
      })
    }
  ],
   
  //Compute all results
  function(err, results) {
    if (err) {
      console.log(err);
      return res.send(err);
    }
    if (results == null || results[0] == null) {
      return res.send({"message": "error"});
    }
    //results contains [facebookHandle, twitterHandle, title]
    var sheetData = {};
    sheetData.facebookHandle = results[0] || '';
    sheetData.twitterHandle = results[1] || '';
    sheetData.title = results[2] || '';
 
    return res.send(sheetData);
  });
})




// Math.floor(Math.random() * 4000) + 1000
// var CronJob = require('cron').CronJob;
// new CronJob('*/10 * * * * *', function() {
//   var startupProjection = {};
//   startupProjection['_id'] = true;
//   startupProjection['name'] = true;
//   startupProjection['alexaRank'] = true;
//   startupProjection['playRank'] = true;
//   Startup.find({"funded":{$exists: false}})
//   .select(startupProjection)
//   .exec(function(err, startups) {
//     if (err)
//       return res.send({message: err});
//     for(j in startups){
//       if(startups[j].alexaRank > startups[j].playRank || !startups[j].playRank){
//         startups[j].growthScore = (startups[j].alexaRank/100)*5
//       }
//       if(startups[j].playRank > startups[j].alexaRank || !startups[j].alexaRank){
//         startups[j].growthScore = (startups[j].playRank/100)*5
//       }
//       Startup.findByIdAndUpdate(
//        startups[j]._id,
//        { $set: {"growthScore": startups[j].growthScore }},
//        {  safe: true, upsert: true},
//         function(err, model) {
//           if(err){
//             console.log(err);
//           }
//         }
//       );
//     }
//     console.log("/growth executed at : "+ new Date());
//   });
// }, null, true, 'Asia/Kolkata');




var linkedinScraper = require('linkedin-scraper2');
var phantom = require("phantom");
app.post('/api/linkedin', function(req, res){

  var urlObj = req.body ; //['http://in.linkedin.com/in/smanishsinghal/','www.linkedin.com/pub/bhupen-shah/0/605/65a','https://www.linkedin.com/in/sjhablr','https://in.linkedin.com/in/shantimohan92/'];

  var loopLength = urlObj.length;
  var getLinkedinInfo = function(url){
    var linkedInURL = url.linkedin_url.replace(/[a-z]*\.linkedin/, 'www.linkedin');
    
    var _ph, _page, _outObj;

    phantom.create().then(ph => {
        _ph = ph;
        return _ph.createPage();
    }).then(page => {
        _page = page;
        return _page.open(url.linkedin_url);
    }).then(status => {
        console.log(status);
        return _page.property('content')
    }).then(content => {
      
      _page.close();
      _ph.exit();
      var $ = cheerio.load(content);
      var profile = {
        name: $('#name').text(),
        pictureUrl: (function(img) {
            return img.attr('src') || img.attr('data-delayed-url');
        })($('.profile-picture a .photo')),
        headline: $('p[data-section=headline]').text(),
        location: $('span.locality').text(),
        summary: $('#summary .description').text(),
        // currentPositions: [],
        // pastPositions: [],
        // websites: [],
        positions: [],
        //honors: [],
        //projects: [],
        educations: [],
        skills: [],
        languages: []
      };
      
      $('#experience .positions .position').each(function () {
        var experience = $(this);
        var obj = {};

        obj.title  = experience.find('.item-title').text();
        obj.companyName = experience.find('.item-subtitle').text();
        obj.date = experience.find('.date-range').text();

        profile.positions.push(obj);
      });
      $('#education .schools .school').each(function () {
        var education = $(this);
        var subtitle = education.find('.item-subtitle').text().split(', ');
        var obj = {};
        obj.name = education.find('.item-title').text();
        obj.link = education.find('.item-title a[href]').attr('href');
        obj.degree = subtitle[0];
        obj.major = subtitle[1];
        obj.date = education.find('.date-range').text();
        profile.educations.push(obj);
      });

      $('#skills .skill a').each(function () {
          profile.skills.push($(this).text());
      });

      $('#languages .language .wrap').each(function () {
          var lang = $(this);
          var obj ={};
          obj.name = lang.find('.name').text()
          profile.languages.push(obj);
      });
      var linkedin = new Linkedin({
        startupId : url.startup_id,
        startupName: url.startup_name,
        startupUserId: url.User_id,
        startupMember: url.startup_member,
        headline: profile.headline,
        location: profile.location,
        summary: profile.summary,
        positions: profile.positions,
        educations: profile.educations,
        skills: profile.skills,
        publicProfileUrl: profile.publicProfileUrl
      });
      if(linkedin.headline != '') {
        linkedin.save(function (err, linkedin) {
          if (err)
            console.log(err);
          console.log(linkedin);
        });
      }
      
    }).catch(error => {
      console.log(error);
      _ph.exit();
    });
    
  }
  function requestCall (i) {
    setTimeout(function () {
      getLinkedinInfo(urlObj[i-1])
      console.log("Fetching Linkedin details!"+urlObj[i-1].linkedin_url);
      if (--i) {          
        requestCall(i);  
      }
    }, 3000);
  }
  requestCall(loopLength);
  
  res.send({"message":"done"})
});


app.get('/api/all/profiles',ensureAuthenticated, function (req, res) {
  Profile.find({})
  .exec(function(err, profiles) {
    if (err)
      return res.status(400).send({message: err});
    return res.send(profiles);
  });
});

app.get('/api/phantom', function(req, res){
  var phantom = require("phantom");
  var _ph, _page, _outObj;

  phantom.create().then(ph => {
      _ph = ph;
      return _ph.createPage();
  }).then(page => {
      _page = page;
      return _page.open('https://in.linkedin.com/in/kevin-jose-860a926b');
  }).then(status => {
      console.log(status);
      return _page.property('content')
  }).then(content => {
      _page.close();
      _ph.exit();
      var $ = cheerio.load(content);
      var profile = {
        name: $('#name').text(),
        pictureUrl: (function(img) {
            return img.attr('src') || img.attr('data-delayed-url');
        })($('.profile-picture a .photo')),
        headline: $('p[data-section=headline]').text(),
        location: $('span.locality').text(),
        summary: $('#summary .description').text(),
        // currentPositions: [],
        // pastPositions: [],
        // websites: [],
        positions: [],
        //honors: [],
        //projects: [],
        educations: [],
        skills: [],
        languages: []
      };
      
      $('#experience .positions .position').each(function () {
        var experience = $(this);
        var obj = {};

        obj.title  = experience.find('.item-title').text();
        obj.companyName = experience.find('.item-subtitle').text();
        obj.date = experience.find('.date-range').text();

        profile.positions.push(obj);
      });
      $('#education .schools .school').each(function () {
        var education = $(this);
        var subtitle = education.find('.item-subtitle').text().split(', ');
        var obj = {};
        obj.name = education.find('.item-title').text();
        obj.link = education.find('.item-title a[href]').attr('href');
        obj.degree = subtitle[0];
        obj.major = subtitle[1];
        obj.date = education.find('.date-range').text();
        profile.educations.push(obj);
      });

      $('#skills .skill a').each(function () {
          profile.skills.push($(this).text());
      });

      $('#languages .language .wrap').each(function () {
          var lang = $(this);
          var obj ={};
          obj.name = lang.find('.name').text()
          profile.languages.push(obj);
      });
      return res.send(profile);
   
  }).catch(error => {
      console.log(error);
      _ph.exit();
  });
})




/*
 |--------------------------------------------------------------------------
 | Start the Server
 |--------------------------------------------------------------------------
 */
/*app.listen(app.get('port'), function () {
  console.log('Express server listening on port ' + app.get('port'));
});*/
app.set('port', process.env.OPENSHIFT_NODEJS_PORT|| process.env.PORT|| 3000);
app.set('ip', process.env.OPENSHIFT_NODEJS_IP|| '127.0.0.1');
var http = require('http').createServer(app);
http.listen(app.get('port'), app.get('ip'), function(){
  console.log("Express server on "+app.get('port')+":::"+config.MONGO_URI);
});