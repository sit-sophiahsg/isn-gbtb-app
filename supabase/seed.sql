-- =============================================================================
-- Sample data for testing. Run AFTER schema.sql. Re-running adds duplicates, so
-- run reset.sql + schema.sql first if you want a clean slate.
-- Everything here can be edited later from the admin dashboard.
-- =============================================================================

update event set
  name = 'Bloom & Roam Stamp Rally',
  club_name = 'Our Student Club',
  -- Starts in the rally phase so you can test stamps straight away.
  -- Set back to 'welcome' (from the admin dashboard) before the event.
  phase = 'rally',
  rally_started_at = now(),
  rally_ends_at = null,
  welcome_md = 'Welcome! Today we explore the Flower Dome together in small groups, collect stamps at each checkpoint, and finish with photos, prizes and a farewell to our committee.',
  programme_md = E'2:00 pm  Gather at Bayfront MRT (Exit B)\n2:15 pm  Walk to the Flower Dome\n2:35 pm  Grouping & briefing\n2:45 pm  Stamp rally\n3:45 pm  Return to meeting point\n4:00 pm  Photo sharing & prizes\n4:30 pm  Closing',
  walk_md = 'From Bayfront MRT Exit B, follow the signs to Gardens by the Bay and cross the Dragonfly Bridge. The Flower Dome is the lower of the two glass domes. Stay with your EXCO leader!',
  briefing_md = E'1. Stay with your group and your EXCO leader at all times.\n2. At each checkpoint, complete the task: usually a group photo with the feature. Some checkpoints have a QR code to scan instead.\n3. Some checkpoints also have a question. You get 3 tries.\n4. No signal? Keep going: your stamps are saved on your phone and sync automatically.\n5. Be gentle with the plants, and do not touch the displays.',
  return_md = 'Head back to the meeting point with your whole group. See you there!',
  closing_message_md = 'Thank you for joining us today! We hope you made new friends and saw something beautiful.',
  meeting_point = 'Flower Dome main entrance, beside the ticket counter',
  feedback_url = 'https://forms.gle/your-feedback-form'
where id = 1;

insert into groups (name, emoji, leader_name, sort_order) values
  ('Ferns',    '🌿', 'Alex Tan',     1),
  ('Orchids',  '🌸', 'Priya Nair',   2),
  ('Baobabs',  '🌳', 'Wei Ming Lim', 3),
  ('Cacti',    '🌵', 'Nur Aisyah',   4),
  ('Lotuses',  '🪷', 'Jordan Lee',   5),
  ('Olives',   '🫒', 'Sam Wong',     6),
  ('Tulips',   '🌷', 'Hana Yeo',     7);

-- Predictable join codes for testing: FERN-01, ORCHID-02, ...
update group_secrets s set join_code = x.code
from (values ('Ferns','FERN-01'), ('Orchids','ORCHID-02'), ('Baobabs','BAOBAB-03'),
             ('Cacti','CACTUS-04'), ('Lotuses','LOTUS-05'), ('Olives','OLIVE-06'),
             ('Tulips','TULIP-07')) as x(name, code)
join groups g on g.name = x.name
where s.group_id = g.id;

insert into checkpoints (sort_order, name, location_hint, method, task_prompt, question, points) values
  (1, 'The Ancient Olive Trees', 'Mediterranean garden, near the entrance', 'photo',
      'Take a group photo with one of the 1,000-year-old olive trees.', null, 10),
  (2, 'Baobab Giants', 'African savanna zone', 'photo',
      'Everyone strike a tree pose next to the baobab and take a photo.',
      'Baobabs store something in their trunks to survive the dry season. What is it?', 10),
  (3, 'Succulent Garden', 'Near the cacti and succulents', 'photo',
      'Find a cactus that looks like it has hair, and take a photo with it.', null, 10),
  (4, 'Flower Field', 'Centre of the dome (changing seasonal display)', 'qr',
      'Find the stamp rally sign in the Flower Field and scan its QR code.',
      'What is the theme of the current Flower Field display?', 10),
  (5, 'Australian Bottle Tree', 'Australian garden', 'photo',
      'Take a photo that shows the bottle shape of the tree trunk.', null, 10);

update checkpoint_secrets s set answers = x.answers
from (values ('Baobab Giants', array['water']),
             ('Flower Field', array['tulips', 'tulip', 'tulipmania'])) as x(name, answers)
join checkpoints c on c.name = x.name
where s.checkpoint_id = c.id;

insert into people (kind, name, role, sort_order) values
  ('exco', 'Alex Tan', 'President', 1),
  ('exco', 'Priya Nair', 'Vice-President', 2),
  ('exco', 'Wei Ming Lim', 'Secretary', 3),
  ('exco', 'Nur Aisyah', 'Treasurer', 4),
  ('exco', 'Jordan Lee', 'Events Director', 5),
  ('exco', 'Sam Wong', 'Publicity Director', 6),
  ('exco', 'Hana Yeo', 'Welfare Director', 7),
  ('new_committee', 'Chris Ong', 'President', 1),
  ('new_committee', 'Mei Lin Goh', 'Vice-President', 2),
  ('new_committee', 'Arjun Das', 'Secretary', 3),
  ('new_committee', 'Rachel Koh', 'Treasurer', 4);

-- Show the codes and PINs you need for testing:
select g.emoji, g.name, s.join_code, s.leader_pin from groups g join group_secrets s on s.group_id = g.id order by g.sort_order;
