---
layout: zh
title: 数据校验
---

本文将介绍如何通过 leoric 对模型的属性进行约束以及对其赋值进行数据校验

## 目录
{:.no_toc}

1. 目录
{:toc}

## allowNull 是否允许为空

模型的属性定义可以设置该属性是否可为空，在进行模型同步时会根据设置条件生成相应的数据表字段属性特征( `NOT NULL` 或者 `NULL` )，且模型实例属性设值时不符合空值检查时会抛出错误

```javascript
const { Bone, DataTypes } = require('leoric');

class User extends Bone {
  static attributes = {
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

## unique 唯一约束

可通过 `unique` 设置字段的唯一约束

```javascript
const { Bone, DataTypes } = require('leoric');

class User extends Bone {
  static attributes = {
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

## 内置验证器

leoric 除了提供 [validator.js](https://github.com/validatorjs/validator.js) 包含的验证器作为内置验证器外还提供以下的内置验证

```javascript
class User extends Bone {
  static attributes = {
    var: {
      type: ANYTYPE,
      validate: {
        notIn: [['MHW', 'Bloodborne']], // 不是其中任何一个
        notNull: true, // 不能为 NULL
        isNull: true, // 只能为 NULL
        min: 1988, // 最小值
        max: 2077, // 最大值
        contains: 'Handsome', //一定要包含**字符串
        notContains: 'Handsome', // 不能包含 ** 字符串
        regex: /^iceborne/g, // 匹配正则
        notRegex: /^iceborne/g, // 不匹配这个正则
        is: /^iceborne/g, // 匹配正则
        notEmpty: true, // 不允许空字符串
      }
    },
  }
});
```

### 自定义错误信息

内置验证器支持传入自定义错误信息，验证失败时不再抛出 leoric 默认的错误信息

```javascript
class User extends Bone {
  static attributes = {
    var: {
      type: ANYTYPE,
      validate: {
        isIn: {
          args: [ 'MHW', 'Bloodborne' ], // args 为该内置验证器需要的参数
          msg: 'OH! WHAT HAVE YOU DONE?!' // msg 即为自定义错误信息
        },
        notNull: {
          args: true,
          msg: 'OH! WHAT HAVE YOU DONE?!'
        }
      }
    }
  }
}
```
## 自定义验证器
leoric 也支持自定义验证器，只需要传入函数即可，在自定义验证器中可使用 `this` 来访问模型的函数或属性值，同时在验证不通过时你既可以在验证器中直接抛出错误，也可以返回 `false` ，leoric 会根据返回值进行下一步处理
```javascript
class User extends Bone {
  static attributes = {
    desc: {
      type: DataTypes.STRING,
      validate: {
        isValid() {
          if (this.desc && this.desc.length < 2) { // 可通过 this 访问属性值
            throw new Error('Invalid desc');
          }
        },
        lengthMax(value) { //自定义验证器函数的第一个参数即为当前属性的赋值
          if (value && value.length >= 10) {
            return false;
          }
        }
      }
    }
  }
}
```
