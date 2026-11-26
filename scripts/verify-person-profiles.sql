-- Aggregate checks only: no names, email addresses, credentials or assignments.
SELECT profile_type, count(*) AS profile_count FROM people GROUP BY profile_type;
SELECT count(*) AS missing_adult_profiles FROM users u LEFT JOIN people p ON p.account_id=u.id WHERE p.id IS NULL;
SELECT count(*) AS missing_child_profiles FROM children c LEFT JOIN people p ON p.id=c.person_id WHERE p.id IS NULL;
SELECT count(*) AS missing_guardian_links FROM child_adults ca JOIN children c ON c.id=ca.child_id JOIN people a ON a.account_id=ca.adult_id LEFT JOIN person_guardians pg ON pg.person_id=c.person_id AND pg.adult_person_id=a.id WHERE pg.person_id IS NULL;
SELECT count(*) AS missing_group_profiles FROM (
 SELECT m.group_id,p.id AS person_id FROM exchange_group_members m JOIN people p ON p.account_id=m.user_id
 UNION SELECT m.group_id,c.person_id FROM child_group_members m JOIN children c ON c.id=m.child_id
) legacy LEFT JOIN group_people gp ON gp.group_id=legacy.group_id AND gp.person_id=legacy.person_id WHERE gp.person_id IS NULL;
SELECT count(*) AS missing_wishlist_profiles FROM items i LEFT JOIN people p ON p.id=i.person_id WHERE p.id IS NULL OR p.account_id<>i.user_id;
SELECT count(*) AS adult_assignments FROM exchange_assignments;
SELECT count(*) AS kids_assignments FROM child_assignments;
