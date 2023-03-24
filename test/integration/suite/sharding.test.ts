import { strict as assert } from "assert";
import Photo from "../../models/photo";

describe('=> Sharding', function() {
  it('should retain where conditions if sharding needed', function() {
    assert.equal(
      Photo.findOne({ userId: 1 }).with('user').toSqlString(),
      "SELECT `photos`.*, `user`.* FROM (SELECT * FROM `photos` WHERE `photos`.`user_id` = 1 LIMIT 1) AS `photos` LEFT JOIN `users` AS `user` ON `photos`.`user_id` = `user`.`id` WHERE `photos`.`user_id` = 1"
    );
  });
});
