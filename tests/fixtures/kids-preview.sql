INSERT INTO users(id,first_name,last_name,is_admin,active,created_at,updated_at) VALUES
(9000,'Preview','Admin',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(9001,'Preview','Parent',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(9002,'Preview','Third',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP),
(9003,'Preview','Fourth',0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
INSERT INTO exchange_groups(id,name,created_at) VALUES (9000,'Preview Family',CURRENT_TIMESTAMP);
INSERT INTO exchange_group_members(group_id,user_id) VALUES (9000,9000);
INSERT INTO sessions(id,user_id,expires_at,created_at) VALUES
('kids-preview-admin',9000,'2999-01-01',CURRENT_TIMESTAMP),
('kids-preview-parent',9001,'2999-01-01',CURRENT_TIMESTAMP);
