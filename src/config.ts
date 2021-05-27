import 'dotenv/config';

export const config = () => ({
  ...process.env,
  ALERTMANAGER_MENTION_ROOM: process.env.MENTION_ROOM === 'true' ?? false,
});
