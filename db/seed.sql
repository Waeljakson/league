-- Seed data from the 1448H school football league schedule.

INSERT INTO app_config (id, school_name, app_name, season, rules)
VALUES (
  1,
  'متوسطة وثانوية مدارس المشكاة',
  'دوري المشكاة المدرسي',
  '1448هـ / 2026',
  '["عدد اللاعبين: 6 لاعبين + حارس مرمى","الالتزام بالزي الرياضي وحذاء رياضي مناسب"]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  school_name = EXCLUDED.school_name,
  app_name = EXCLUDED.app_name,
  season = EXCLUDED.season,
  rules = EXCLUDED.rules,
  updated_at = now();

INSERT INTO leagues (slug, name, description, sort_order)
VALUES
  ('first-middle', 'دوري الصف الأول متوسط', 'دوري ذهاب وعودة - كل فريق يلاعب جميع الفرق مرتين', 1),
  ('second-third-middle', 'دوري الصفين الثاني والثالث متوسط', 'دوري من دور واحد - كل فريق يلاعب جميع الفرق مرة واحدة', 2)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;

INSERT INTO teams (league_id, name, short_name, sort_order)
SELECT l.id, v.name, v.name, v.sort_order
FROM leagues l
JOIN (VALUES ('أول 1',1),('أول 2',2),('أول 3',3)) v(name,sort_order) ON true
WHERE l.slug='first-middle'
ON CONFLICT (league_id,name) DO UPDATE SET sort_order=EXCLUDED.sort_order;

INSERT INTO teams (league_id, name, short_name, sort_order)
SELECT l.id, v.name, v.name, v.sort_order
FROM leagues l
JOIN (VALUES ('ثاني 1',1),('ثاني 2',2),('ثاني 3',3),('ثالث 1',4),('ثالث 2',5)) v(name,sort_order) ON true
WHERE l.slug='second-third-middle'
ON CONFLICT (league_id,name) DO UPDATE SET sort_order=EXCLUDED.sort_order;

WITH data(match_no,league_slug,round_no,match_date,day_name,home_name,away_name) AS (
  VALUES
  (1,'second-third-middle',1,DATE '2026-10-04','الأحد','ثالث 2','ثاني 2'),
  (2,'first-middle',1,DATE '2026-10-05','الاثنين','أول 1','أول 2'),
  (3,'second-third-middle',1,DATE '2026-10-06','الثلاثاء','ثاني 1','ثالث 1'),
  (4,'first-middle',1,DATE '2026-10-07','الأربعاء','أول 2','أول 3'),
  (5,'second-third-middle',1,DATE '2026-10-08','الخميس','ثاني 3','ثالث 2'),
  (6,'first-middle',1,DATE '2026-10-11','الأحد','أول 3','أول 1'),
  (7,'second-third-middle',1,DATE '2026-10-12','الاثنين','ثاني 2','ثالث 1'),
  (8,'first-middle',2,DATE '2026-10-13','الثلاثاء','أول 2','أول 1'),
  (9,'second-third-middle',1,DATE '2026-10-14','الأربعاء','ثاني 1','ثاني 3'),
  (10,'first-middle',2,DATE '2026-10-15','الخميس','أول 3','أول 2'),
  (11,'second-third-middle',1,DATE '2026-10-18','الأحد','ثالث 1','ثالث 2'),
  (12,'first-middle',2,DATE '2026-10-19','الاثنين','أول 1','أول 3'),
  (13,'second-third-middle',1,DATE '2026-10-20','الثلاثاء','ثاني 2','ثاني 3'),
  (14,'second-third-middle',1,DATE '2026-10-21','الأربعاء','ثاني 1','ثالث 2'),
  (15,'second-third-middle',1,DATE '2026-10-22','الخميس','ثاني 3','ثالث 1'),
  (16,'second-third-middle',1,DATE '2026-10-25','الأحد','ثاني 1','ثاني 2')
)
INSERT INTO matches(match_no,league_id,round_no,match_date,day_name,home_team_id,away_team_id)
SELECT d.match_no,l.id,d.round_no,d.match_date,d.day_name,h.id,a.id
FROM data d
JOIN leagues l ON l.slug=d.league_slug
JOIN teams h ON h.league_id=l.id AND h.name=d.home_name
JOIN teams a ON a.league_id=l.id AND a.name=d.away_name
ON CONFLICT (match_no) DO UPDATE SET
  league_id=EXCLUDED.league_id,
  round_no=EXCLUDED.round_no,
  match_date=EXCLUDED.match_date,
  day_name=EXCLUDED.day_name,
  home_team_id=EXCLUDED.home_team_id,
  away_team_id=EXCLUDED.away_team_id,
  updated_at=now();
