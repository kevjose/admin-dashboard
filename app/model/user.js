var bcrypt = require('bcryptjs');
var mongoose = require('mongoose');

var userSchema = new mongoose.Schema({
	email: {type: String, unique: true, lowercase: true},
  password: {type: String, select: false},
  loginCount:{type: Number},
  displayName: String,
  picture: String,
  linkedin: String,
  investor: {type: Boolean,default:false},
  admin: {type: Boolean, default:false},
  classifier: {type:Boolean, default:false},
  sectors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Sector' }]
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



module.exports = mongoose.model('User', userSchema);