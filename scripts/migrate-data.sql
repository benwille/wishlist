-- Migration from MySQL wishlist dump to D1 schema
-- Run with: wrangler d1 execute wishlist --remote --file=scripts/migrate-data.sql

-- Users (swap $2y$ to $2a$ for bcryptjs compatibility)
INSERT INTO users (id, first_name, last_name, email, password_hash, is_admin, participates_in_exchanges, active, created_at, updated_at) VALUES
(1, 'Ben', 'Wille', 'ben.wille@gmail.com', '$2a$10$f91AWvXMa0IIGm6Zwz4xW.y0zeMvx1NHEyB6qsQ3zH/oKPTefKrxG', 1, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(2, 'Xandra', 'Wille', 'xandra.wille@gmail.com', '$2a$10$yogfCkETXjufT6hzIM4LyeXJ2MMC/d/a43cbbaOqVxQG/4XvqJE02', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(3, 'Jessica', 'Peterson', NULL, '$2a$10$CHq6nAPp2bHorPt4sHxlf.qLAq4yJIFbQ5W/MLjwTdxgPbfKANQ1C', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(4, 'Victoria', 'Olson', NULL, '$2a$10$xSCGuX.jO8loCW2IOi9cNOJK1cVhtntnEWrvezvIFXrMx6R7esFYC', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(5, 'Danny', 'Jorgensen', NULL, '$2a$10$2ZaZGzbrU4d2mrRLiysw5e8JKTikDnjms67cE3wA8sjsJss2QtuCq', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(6, 'Chip', 'Reichanadter', NULL, '$2a$10$aU4xPfPDO2UrZj5fYUgSAu.lL2Azww.cVaeV1hLi3HiZwH0A0Hyti', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(7, 'Chad', 'Reichanadter', NULL, '$2a$10$GN4cH./taq3SoUBH1c49euMIpDK8vvn6edz2Xh2K4YIAvRVJbiYfC', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(8, 'Katie', 'Jorgensen', NULL, '$2a$10$.irkxDit1xApOG2Wn.4Y1.z33MW7ZeQWS7oT/7fT5oq4Fl3EFYdVG', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(9, 'Cam', 'Brasher', NULL, '$2a$10$7UcNrUAT0My2HeOXWOmp0OmgUsSFdoNYozRFLv.pPtNdAv821X8Ey', 0, 1, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z'),
(10, 'Laurie', 'Baum', NULL, '$2a$10$QSxtK5gOcPaVDp3zPZXncOMeUx1SNF/Kb4iZc85NvzxZ9hFvI.hGu', 0, 0, 1, '2022-01-01T00:00:00.000Z', '2022-01-01T00:00:00.000Z');

-- Exchange group: Adults
INSERT INTO exchange_groups (id, name, created_at) VALUES
(1, 'Adults', '2022-01-01T00:00:00.000Z');

-- Group members (all type=1 adults, IDs 1-9)
INSERT INTO exchange_group_members (group_id, user_id) VALUES
(1, 1), (1, 2), (1, 3), (1, 4), (1, 5), (1, 6), (1, 7), (1, 8), (1, 9);

-- Exclusion pairs (households) — from no_pair table
-- Ben + Xandra, Danny + Katie, Victoria + Cam, Chip + Chad
INSERT INTO exchange_exclusions (group_id, user_id_1, user_id_2) VALUES
(1, 1, 2),
(1, 5, 8),
(1, 4, 9),
(1, 6, 7);
-- Laurie (ID 10) excluded from everyone via participates_in_exchanges=0

-- Exchange history (2022-2025)
INSERT INTO exchange_assignments (group_id, giver_id, receiver_id, year, created_at) VALUES
-- 2022
(1, 2, 4, 2022, '2022-11-01T00:00:00.000Z'),
(1, 1, 5, 2022, '2022-11-01T00:00:00.000Z'),
(1, 6, 3, 2022, '2022-11-01T00:00:00.000Z'),
(1, 7, 2, 2022, '2022-11-01T00:00:00.000Z'),
(1, 8, 1, 2022, '2022-11-01T00:00:00.000Z'),
(1, 5, 6, 2022, '2022-11-01T00:00:00.000Z'),
(1, 4, 8, 2022, '2022-11-01T00:00:00.000Z'),
(1, 3, 7, 2022, '2022-11-01T00:00:00.000Z'),
-- 2023
(1, 2, 6, 2023, '2023-11-01T00:00:00.000Z'),
(1, 6, 1, 2023, '2023-11-01T00:00:00.000Z'),
(1, 1, 5, 2023, '2023-11-01T00:00:00.000Z'),
(1, 5, 7, 2023, '2023-11-01T00:00:00.000Z'),
(1, 7, 8, 2023, '2023-11-01T00:00:00.000Z'),
(1, 8, 3, 2023, '2023-11-01T00:00:00.000Z'),
(1, 3, 4, 2023, '2023-11-01T00:00:00.000Z'),
(1, 4, 2, 2023, '2023-11-01T00:00:00.000Z'),
-- 2024
(1, 9, 5, 2024, '2024-11-01T00:00:00.000Z'),
(1, 5, 4, 2024, '2024-11-01T00:00:00.000Z'),
(1, 4, 3, 2024, '2024-11-01T00:00:00.000Z'),
(1, 3, 1, 2024, '2024-11-01T00:00:00.000Z'),
(1, 1, 6, 2024, '2024-11-01T00:00:00.000Z'),
(1, 6, 8, 2024, '2024-11-01T00:00:00.000Z'),
(1, 8, 7, 2024, '2024-11-01T00:00:00.000Z'),
(1, 7, 2, 2024, '2024-11-01T00:00:00.000Z'),
(1, 2, 9, 2024, '2024-11-01T00:00:00.000Z'),
-- 2025
(1, 1, 9, 2025, '2025-11-01T00:00:00.000Z'),
(1, 9, 8, 2025, '2025-11-01T00:00:00.000Z'),
(1, 8, 6, 2025, '2025-11-01T00:00:00.000Z'),
(1, 6, 5, 2025, '2025-11-01T00:00:00.000Z'),
(1, 5, 3, 2025, '2025-11-01T00:00:00.000Z'),
(1, 3, 2, 2025, '2025-11-01T00:00:00.000Z'),
(1, 2, 7, 2025, '2025-11-01T00:00:00.000Z'),
(1, 7, 4, 2025, '2025-11-01T00:00:00.000Z'),
(1, 4, 1, 2025, '2025-11-01T00:00:00.000Z');

-- Wishlist items (carrying over all current items)
INSERT INTO items (id, user_id, name, description, link, price_range, purchased, year_added, created_at) VALUES
(31, 4, 'Amazon Wish List', NULL, 'https://www.amazon.com/hz/wishlist/ls/1J3U2VB1970DG?ref_=wl_share', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(45, 6, 'BIG FAT CUTE CHOOCHIE WISH LIST', NULL, 'https://www.amazon.com/hz/wishlist/ls/R9KXTZRACEOE?ref_=wl_share', NULL, 0, 2023, '2023-01-01T00:00:00.000Z'),
(48, 8, 'Katie', NULL, 'https://www.amazon.com/hz/wishlist/dl/invite/2tIXh5G?ref_=wl_share', NULL, 0, 2023, '2023-01-01T00:00:00.000Z'),
(51, 1, 'Tattoo', NULL, NULL, NULL, 0, 2024, '2024-01-01T00:00:00.000Z'),
(89, 10, 'Amazon Wishlist', NULL, 'https://www.amazon.com/hz/wishlist/ls/3TLAZC6CWV2IR?ref_=wl_share', NULL, 0, 2024, '2024-01-01T00:00:00.000Z'),
(100, 1, 'TikTok lulu lemon shorts', NULL, NULL, NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(101, 1, 'Audible subscription', NULL, NULL, NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(107, 1, 'Solace imperium loop', 'White, black or dark gray', 'https://solacebands.com/products/imperium-v2-loop?variant=44053862908144', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(109, 1, 'Strike man laser fire practice', '9mm', 'https://www.strikeman.io/pages/strikeman-dry-fire-training-save-20-with-promo-america?view=sl-2DB58537', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(112, 7, 'Redbubble Gift Card', 'Any Amount', 'https://www.redbubble.com/gift-certificates/new', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(114, 2, 'Garden Soil', 'For my garden beds and planters', 'https://thedirtbag.com/product/bulk-garden-soil-plus/', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(116, 1, 'Oral-B iO Series 7', NULL, NULL, NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(120, 1, 'New Balance Rebel v5 Running Shoes', NULL, 'https://www.newbalance.com/pd/fuelcell-rebel-v5/MFCXV5-50636-PMG-NA.html', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(121, 1, 'Extra thermometer probe', 'Chef iQ #2', 'https://chefiq.com/products/extra-probe-2', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(122, 3, 'Sephora', NULL, 'https://www.sephora.com/lovelist/sls8914251012tuexoiq', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(132, 1, 'Bike handlebar grips', NULL, NULL, NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(133, 1, 'Small smart projector', NULL, 'https://a.co/d/6R6c1sk', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(136, 4, 'Magnolia Pillow', NULL, 'https://magnolia.com/products/velvet-amber-vines-lumbar-pillow?variant=43155428704307', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(137, 4, 'Blue Platter', NULL, 'https://magnolia.com/products/lakelynn-serving-platter?variant=42160497295411', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(138, 4, 'Checkers', NULL, 'https://magnolia.com/products/green-and-white-marble-checkers-set?variant=41208687067187', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(141, 6, 'Vibrams', 'Size 42', 'https://www.vibram.com/us/shop/fivefingers/men/roadaround-mens/M08_1_IvoryReflective.html', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(142, 3, 'Aspire Gift Certificate', 'For my dysport fund', 'https://www.aspirerewards.com/gift-certificates/landing', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(147, 1, 'Chelsea binho board', NULL, 'https://binhoboard.com/collections/boards/products/binho-classic-chelsea', NULL, 0, 2025, '2025-01-01T00:00:00.000Z'),
(148, 6, 'Mehron Clown White', NULL, 'https://www.mehron.com/clown-white/', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(149, 6, 'Hydro Grip Hydrating Primer', NULL, 'https://milkmakeup.com/products/hydro-grip-hydrating-face-primer', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(150, 6, 'Cheek Thrills Multi-Finish Face Trio', 'Blind Date', 'https://www.morphe.com/products/cheek-thrills-multi-finish-face-trio', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(151, 6, 'Revolution Forever Flawless Allure Shadow Palette', 'Birds of Paradise', 'https://tinyurl.com/4wp2e5un', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(152, 6, 'Mehron Blendcream Sticks', 'Any color', 'https://www.mehron.com/creamblend', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(153, 6, 'Sauron Scleras', NULL, 'https://www.uniqso.com/products/sweety-sclera-sauron-yellow', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(154, 6, 'Phantasee Gold Sclera Contacts', NULL, 'https://www.uniqso.com/products/phantasee-gold-sclera-lens-morbius', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(155, 6, 'Yellow Sclera', NULL, 'https://www.uniqso.com/products/sweety-yellow-sclera', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(156, 6, 'Ice Zombie Sclera', NULL, 'https://www.uniqso.com/products/sweety-blue-sclera-ice-zombie', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(157, 6, 'Tinted Serum', 'medium 4-5', 'https://www.lorealparisusa.com/makeup/face/hyaluronic-tinted-serum-medium-4-5', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(158, 6, 'Fwee - Lip&Cheek Blurry Pudding Pot', 'Dear', 'https://tinyurl.com/behpndcu', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(159, 6, 'Maybelline Fit Me Concealer', 'Medium', 'https://www.maybelline.com/face-makeup/concealer/fit-me-concealer', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(160, 3, 'Costco Gift Cards', NULL, 'https://www.costco.com/p/-/costco-shop-card/10024438', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(161, 7, 'USPS Upcycled Belt Bag', '$75 - Pricey, but beautiful.', 'https://store.usps.com/store/product/upcycled-belt-bag-P_843624', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(162, 7, 'USPS 250th Anniversary Tote Bag', '$20', 'https://store.usps.com/store/product/usps-250th-anniversary-tote-bag-P_843604', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(163, 7, 'Express Mail T-Shirt (White)', 'Size Large - $17.95', 'https://store.usps.com/store/product/usps-250th-anniversary-tote-bag-P_843604', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(164, 7, 'Cocteau Twins - Heaven or Las Vegas Vinyl', 'LP - $23.78', 'https://shopusa.4ad.com/products/cad3420-heaven-or-las-vegas', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(165, 7, 'Moultrie Edge 3', 'Cellular Trail Cam - $79.99 (This is a reminder for Chip. Not for family gift exchange.)', 'https://www.amazon.com/gp/product/B0FJBNWRZT/', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(166, 7, 'Gretsch Streamliner Guitar', 'Color: Olive Drab - $189.99 (This is a reminder for Chip. Not for family gift exchange.)', 'https://www.guitarcenter.com/Gretsch-Guitars/Streamliner-Jet-Club-1-Pickup-Electric-Guitar-Olive-Drab-1500000461446.gc', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(167, 7, 'Fandango at Home Gift Card', 'Any Amount', 'https://athome.fandango.com/gift-cards', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(168, 3, 'Amazon Wishlist', NULL, 'https://www.amazon.com/hz/wishlist/ls/1KAJ0J3403XYT?ref_=wl_share', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(169, 3, 'Amazon skincare', NULL, 'https://www.amazon.com/hz/wishlist/ls/12RHMIW35UNNL?ref_=wl_share', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(171, 2, 'Wood Trellis', NULL, 'https://www.amazon.com/dp/B09YV5J9Z1/', NULL, 0, 2026, '2026-01-01T00:00:00.000Z'),
(173, 2, 'Bees?!', 'Bee Cups', 'https://www.amazon.com/dp/B0FJ2SVDNV/', NULL, 0, 2026, '2026-01-01T00:00:00.000Z');
