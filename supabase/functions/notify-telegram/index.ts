// Supabase Edge Function: notify-telegram
// Триггерится при INSERT в public.submissions.
// Токен бота и chat_id — из секретов окружения, не из кода.
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY даёт сама Supabase автоматически каждой функции.

import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record ?? payload;

    const name = record.name ?? '—';
    const contact = record.contact ?? '—';
    const photoPaths: string[] = Array.isArray(record.photo_urls) ? record.photo_urls : [];
    const createdAt = record.created_at ? new Date(record.created_at) : new Date();
    const time = createdAt.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const chatId = Deno.env.get('TELEGRAM_CHAT_ID');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!botToken || !chatId) {
      console.error('TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID не заданы в секретах.');
      return new Response(JSON.stringify({ error: 'Telegram secrets not configured' }), { status: 500 });
    }

    const caption =
      '🔔 Новая заявка\n' +
      'Имя: ' + name + '\n' +
      'Контакт: ' + contact + '\n' +
      'Время: ' + time;

    // Bucket "photos" приватный — генерируем временные подписанные ссылки,
    // по которым Telegram сможет скачать фото (обычная публичная ссылка не сработала бы).
    let photoUrls: string[] = [];
    if (photoPaths.length > 0 && supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabase.storage.from('photos').createSignedUrls(photoPaths, 600);
      if (error) {
        console.error('createSignedUrls error:', error);
      } else {
        photoUrls = data.filter((d) => d.signedUrl && !d.error).map((d) => d.signedUrl as string);
      }
    }

    let tgResp: Response;
    if (photoUrls.length >= 2) {
      const media = photoUrls.map((url, i) => ({
        type: 'photo',
        media: url,
        ...(i === 0 ? { caption } : {}),
      }));
      tgResp = await fetch('https://api.telegram.org/bot' + botToken + '/sendMediaGroup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, media }),
      });
    } else if (photoUrls.length === 1) {
      tgResp = await fetch('https://api.telegram.org/bot' + botToken + '/sendPhoto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, photo: photoUrls[0], caption }),
      });
    } else {
      tgResp = await fetch('https://api.telegram.org/bot' + botToken + '/sendMessage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption + '\nФото: не удалось получить ссылки' }),
      });
    }

    const tgResult = await tgResp.json();
    if (!tgResult.ok) {
      console.error('Telegram API error:', tgResult);
      return new Response(JSON.stringify({ error: tgResult }), { status: 502 });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    console.error('notify-telegram error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
