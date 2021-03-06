<%_
var emailSignup = authMethods.indexOf('email') !== -1;
var services = authMethods.filter(function (method) {
  return method !== 'email';
});
_%>
import crypto from 'crypto'
<%_ if (emailSignup) { _%>
import bcrypt from 'bcrypt'
<%_ if (services.length) { _%>
import randtoken from 'rand-token'
<%_ } _%>
<%_ } _%>
import mongoose, { Schema } from 'mongoose'
import mongooseKeywords from 'mongoose-keywords'
<%_ if (emailSignup) { _%>
import { env } from '../../config'
<%_ } _%>

<%_ if (emailSignup) { _%>
const compare = require('bluebird').promisify(bcrypt.compare)
<%_ } _%>
const roles = ['user', 'admin']

const userSchema = new Schema({
  email: {
    type: String,
    match: /^\S+@\S+\.\S+$/,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  <%_ if (emailSignup) { _%>
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  <%_ } _%>
  name: {
    type: String,
    index: true,
    trim: true
  },
  <%_ if (services.length) { _%>
  services: {
    <%- services.map(function(service) {
      return service + ': String'
    }).join(',\n') %>
  },
  <%_ } _%>
  role: {
    type: String,
    enum: roles,
    default: 'user'
  },
  picture: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
})

userSchema.path('email').set(function (email) {
  if (!this.picture || this.picture.indexOf('https://gravatar.com') === 0) {
    const hash = crypto.createHash('md5').update(email).digest('hex')
    this.picture = `https://gravatar.com/avatar/${hash}?d=identicon`
  }

  if (!this.name) {
    this.name = email.replace(/^(.+)@.+$/, '$1')
  }

  return email
})

<%_ if (emailSignup) { _%>
userSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next()

  /* istanbul ignore next */
  const rounds = env === 'test' ? 1 : 9

  bcrypt.hash(this.password, rounds, (err, hash) => {
    /* istanbul ignore next */
    if (err) return next(err)
    this.password = hash
    next()
  })
})

<%_ } _%>
userSchema.methods = {
  view (full) {
    let view = {}
    let fields = ['id', 'name', 'picture']

    if (full) {
      fields = [...fields, 'email', 'createdAt']
    }

    fields.forEach((field) => { view[field] = this[field] })

    return view
  }<%_ if (emailSignup) { _%>,

  authenticate (password) {
    return compare(password, this.password).then((valid) => valid ? this : false)
  }
  <%_ } _%>
}

userSchema.statics = {
  <%_ if (services.length) { _%>
  roles,

  createFromService ({ service, id, email, name, picture }) {
    return this.findOne({ $or: [{ [`services.${service}`]: id }, { email }] }).then((user) => {
      if (user) {
        user.services[service] = id
        user.name = name
        user.picture = picture
        return user.save()
      } else {
        <%_ if (emailSignup) { _%>
        const password = randtoken.generate(16)
        <%_ } _%>
        return this.create({ services: { [service]: id }, email<% if (emailSignup) { %>, password<% } %>, name, picture })
      }
    })
  }
  <%_ } else { _%>
  roles
  <%_ } _%>
}

userSchema.plugin(mongooseKeywords, { paths: ['email', 'name'] })

export default mongoose.model('User', userSchema)
