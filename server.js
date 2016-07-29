var path = require('path');
var bodyParser = require('body-parser');
var cors = require('cors');
var express = require('express');
var compression = require('compression')
var jwt = require('jwt-simple');
var moment = require('moment');
var mongoose = require('mongoose');


var config = require('./config');

// mongo configuration 
mongoose.connect(config.MONGO_URI);
mongoose.connection.on('error', function (err) {
    console.log('Error: Could not connect to MongoDB. Did you forget to run `mongod`?'.red);
});

var app = express();

app.use(cors());
// for large payload
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.urlencoded({limit: '50mb', extended: true}));

// Force HTTPS on Heroku
if (app.get('env') === 'production') {
    app.use(function (req, res, next) {
        var protocol = req.get('x-forwarded-proto');
        protocol == 'https' ? next() : res.redirect('https://' + req.hostname + req.url);
    });
}
app.use(compression());
app.use(express.static(path.join(__dirname, '/public')));

require('./app/user.controller')(app);

/*
 |--------------------------------------------------------------------------
 | Start the Server
 |--------------------------------------------------------------------------
 */

app.set('port', process.env.OPENSHIFT_NODEJS_PORT|| process.env.PORT|| 8080);
app.set('ip', process.env.OPENSHIFT_NODEJS_IP|| '0.0.0.0');
app.listen(app.get('port'), app.get('ip'), function(){
  console.log("Express server on "+app.get('port'));
});