var request = require('request');

var config = require('./../config');
var User = require('./model/user');
var userHelper = require('./helper/user');

module.exports = function(app) {
	/*
	|--------------------------------------------------------------------------
	| GET /api/me
	|--------------------------------------------------------------------------
	*/
	app.get('/api/me', userHelper.ensureAuthenticated, function (req, res) {
	    User.findById(req.user, function (err, user) {
	        res.send(user);
	    });
	});

	/*
	 |--------------------------------------------------------------------------
	 | PUT /api/me
	 |--------------------------------------------------------------------------
	 */
	app.put('/api/me', userHelper.ensureAuthenticated, function (req, res) {
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
   | Login with LinkedIn
   |--------------------------------------------------------------------------
   */
  app.post('/auth/linkedin', function(req, res) {
    var accessTokenUrl = 'https://www.linkedin.com/uas/oauth2/accessToken';
    var peopleApiUrl = 'https://api.linkedin.com/v1/people/~:(id,first-name,last-name,email-address,picture-url,formatted-name,headline,location,industry,summary,specialties,positions,public-profile-url)';
    var params = {
      code: req.body.code,
      client_id: req.body.clientId,
      client_secret: config.LINKEDIN_SECRET,
      redirect_uri: req.body.redirectUri,
      grant_type: 'authorization_code'
    };
    console.log(params);

    // Step 1. Exchange authorization code for access token.
    request.post(accessTokenUrl, { form: params, json: true }, function(err, response, body) {
      if (response.statusCode !== 200) {
        return res.status(response.statusCode).send({ message: body.error_description });
      }
      var params = {
        oauth2_access_token: body.access_token,
        format: 'json'
      };

      // Step 2. Retrieve profile information about the current user.
      request.get({ url: peopleApiUrl, qs: params, json: true }, function(err, response, profile) {
        // Step 3a. Link user accounts.
        if (req.header('Authorization')) {
          User.findOne({ linkedin: profile.id }, function(err, existingUser) {
            if (existingUser) {
              return res.status(409).send({ message: 'There is already a LinkedIn account that belongs to you' });
            }
            var token = req.header('Authorization').split(' ')[1];
            var payload = jwt.decode(token, config.TOKEN_SECRET);
            User.findById(payload.sub, function(err, user) {
              if (!user) {
                return res.status(400).send({ message: 'User not found' });
              }
              user.linkedin = profile.id;
              user.picture = user.picture || profile.pictureUrl;
              user.displayName = user.displayName || profile.firstName + ' ' + profile.lastName;
              user.email = user.email || profile.emailAddress;
              user.save(function() {
                var token = userHelper.createJWT(user);
                res.send({loginCount:user.loginCount?user.loginCount:0,token: token });
              });
            });
          });
        } else {
          // Step 3b. Create a new user account or return an existing one.
          User.findOne({ linkedin: profile.id }, function(err, existingUser) {
            if (existingUser) {
              return res.send({loginCount:existingUser.loginCount?existingUser.loginCount:0,token: userHelper.createJWT(existingUser) });
            }
            var user = new User();
            user.linkedin = profile.id;
            user.picture = profile.pictureUrl;
            user.displayName = profile.firstName + ' ' + profile.lastName;
            user.email = user.email || profile.emailAddress;
            user.save(function() {
              var token = userHelper.createJWT(user);
              res.send({loginCount:user.loginCount?user.loginCount:0,token: token });
            });
          });
        }
      });
    });
  });


	app.get('/api/user/all',userHelper.ensureAuthenticated, function(req, res){
		User.find()
			.select({"email":1, "investor":1, "admin":1 , "classifier":1})
			.exec(function(err, users){
				if(err)
					return res.send(err);
				return res.send(users);
			});
	});

	app.put('/api/user', userHelper.ensureAuthenticated, function (req, res) {
	  var $set = { $set: {} };
	  if(req.body.investor!= undefined)
	    $set.$set['investor'] = req.body.investor;
	  if(req.body.admin!= undefined)
	    $set.$set['admin'] = req.body.admin;
	  if(req.body.classifier!= undefined)
	    $set.$set['classifier'] = req.body.classifier;

		if(req.body.loginCount != undefined)
			$set.$set['loginCount'] = req.body.loginCount
	  
	  User.update({_id:req.body.id}, $set ,function(err){
	    if(err)
	      return res.status(400).send({message: 'Update Failed'});
	    return res.status(200).send({message: 'Update values:'+JSON.stringify($set.$set)});
	  });
	});

	app.put('/api/user/count', userHelper.ensureAuthenticated, function (req, res) {
		console.log(req.body);
	  var $set = { $set: {} };
		if(req.body.loginCount != undefined)
			$set.$set['loginCount'] = req.body.loginCount
	  
	  User.update({_id:req.user}, $set ,function(err){
	    if(err)
	      return res.status(400).send({message: 'Update Failed'});
	    return res.status(200).send({message: 'Update values:'+JSON.stringify($set.$set)});
	  });
	});
	
}