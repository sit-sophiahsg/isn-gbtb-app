-- DANGER: deletes ALL rally data and tables. Run schema.sql (and seed.sql) afterwards.
-- Uploaded photo files stay in Storage; delete them in Storage -> photos if needed.
drop policy if exists "photos upload" on storage.objects;
drop policy if exists "photos admin" on storage.objects;
drop table if exists question_attempts, stamps, photos, people, checkpoint_secrets,
  checkpoints, group_secrets, groups, event, admins cascade;
drop function if exists admin_restore_stamp, admin_reject_stamp, answer_question, leader_stamp,
  verify_leader_pin, submit_photo, claim_qr_stamp, join_group, put_stamp, refresh_group_finish,
  stamp_points, normalise_answer, effective_time, group_from_token, make_checkpoint_secrets,
  make_group_secrets, is_admin cascade;
drop type if exists event_phase, checkpoint_method, stamp_method, stamp_status, person_kind cascade;
