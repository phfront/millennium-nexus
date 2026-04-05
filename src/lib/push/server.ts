import webpush from 'web-push';

let configured = false;

export function configureWebPush(): void {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:nexus@localhost';

  if (!publicKey || !privateKey) {
    throw new Error('Defina NEXT_PUBLIC_VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY no .env.local');
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export { webpush };
