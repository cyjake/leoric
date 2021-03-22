---
layout: en
title: Validations
---

This article will introduce how to use leoric to constrain model's attributes and validate its' values.

## Table of Contents
{:.no_toc}

1. Table of Contents
{:toc}

## allowNull

The attribute definition of the model can set whether the attribute can be `null` or not. When the model is synchronized, the corresponding table's field attribute characteristics (`NOT NULL` or `NULL`) will be generated according to the value of `allowNull`. When the model instance attribute value does not match the setting, an error will be thrown.

```javascript
const { Bone, DataTypes } = require('leoric');

class User extends Bone {
  static attributes {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false },
    ...
  }
};

User.sync();
/*
CREATE TABLE `users` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `email` varchar(256) NOT NULL,
	....
);
*/

User.create({ name: 'OldHunter' }); // throw LeoricValidateError('notNull'); email should not be null
```

## unique
You can set a unique constraint on a field using 'unique':

```javascript
const { Bone, DataTypes } = require('leoric');

class User extends Bone {
  static attributes {
    id: { type: DataTypes.BIGINT, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true },
    ...
  }
};

User.sync();
/*
CREATE TABLE `users` (
  `id` bigint(20) AUTO_INCREMENT PRIMARY KEY,
  `email` varchar(256) NOT NULL UNIQUE,
	....
);
*/
```
## Built-in validator
In addition to validators included in [validator.js](https://github.com/validatorjs/validator.js) as built-in validators, leoric also provides the following built-in validators:
```javascript
User.init({
  var: {
    type: ANYTYPE,
    validate: {
      notIn: [['MHW', 'Bloodborne']], // Not one of them
      notNull: true, // Can't be NULL
      isNull: true, // Must be NULL
      min: 1988, // MinValue
      max: 2077, // MaxValue
      contains: 'Handsome', // Must contains 'Handsome'
      notContains: 'Handsome', // Mustn't contain 'Handsome'
      regex: /^iceborne/g, // Matching RegExp
      notRegex: /^iceborne/g, // Not matching RegExp
      is: /^iceborne/g, // Matching RegExp
      notEmpty: true, // not allow empty string
    }
  }
});
```
### Custom error message
The built-in validator supports customize error messages instead of the default error messages of leoric.
```javascript
User.init({
  var: {
    type: ANYTYPE,
    validate: {
      isIn: {
        args: [ 'MHW', 'Bloodborne' ], // 'args' are the arguments of validator
        msg: 'OH! WHAT HAVE YOU DONE?!' // `msg` is custom error message
      },
      notNull: {
        args: true,
        msg: 'OH! WHAT HAVE YOU DONE?!'
      }
    }
  }
})
```
## Custom validators
leoric supports set custom validators.
You can throw an error or return `false` from the validator while the validation fails, and Leoric will take the next step based on the returns.
```javascript
User.init({
desc: {
  type: DataTypes.STRING,
    validate: {
      isValid() {
        if (this.desc && this.desc.length < 2) { // you can access attribute's value by this
          throw new Error('Invalid desc');
        }
      },
      lengthMax(value) { // the first argument is the value of attribute
        if (value && value.length >= 10) {
          return false;
        }
      }
    }
  }
})
```
