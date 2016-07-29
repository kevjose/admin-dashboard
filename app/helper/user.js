var moment = require('moment');
var Slack = require('node-slack');
var jwt = require('jwt-simple');

var config = require('./../../config');
var User = require('../model/user');

var slack = new Slack(config.SLACK_URI);


module.exports = {
  /*
   |--------------------------------------------------------------------------
   | Login Required Middleware
   |--------------------------------------------------------------------------
   */
  ensureAuthenticated: function ensureAuthenticated(req, res, next) {
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
  },

  /*
   |--------------------------------------------------------------------------
   | Generate JSON Web Token
   |--------------------------------------------------------------------------
   */
  createJWT: function createJWT(user) {
      var payload = {
          sub: user._id,
          iat: moment().unix(),
          exp: moment().add(14, 'days').unix()
      };
      return jwt.encode(payload, config.TOKEN_SECRET);
  },
  logger: function(req, res, next){
    var user = (req.user||'guest');
    var api = (req.protocol + '://' + req.get('host') + req.originalUrl);
    var ipAddr = req.headers["x-forwarded-for"];
    if (ipAddr){
      var list = ipAddr.split(",");
      ipAddr = list[list.length-1];
    } else {
      ipAddr = req.connection.remoteAddress;
    }
    var requestBody = JSON.stringify(req.body);
    var params = JSON.stringify(req.params);
    slack.send({
      text: 'User: '+user+' ip: '+ipAddr+' api: '+api+' requestBody: '+requestBody+' params: '+params
    }, function(){
      next();
    });
    
  }
}